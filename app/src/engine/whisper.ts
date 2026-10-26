import { settings } from '../lib/settings';

// Speech to text with Whisper (Groq or OpenAI). Much better than Chrome's
// built-in recogniser with accents, names and game words.
// We detect when you start and stop talking, then send just that clip.

const RATE = 16000;          // what Whisper wants
const CHUNK = 1024;          // samples per message from the audio thread (64ms)
const CHUNK_MS = (CHUNK / RATE) * 1000;
const PREROLL = 5;           // chunks kept from just before you start talking
const MAX_MS = 15000;        // cut long monologues into pieces

const WORKLET = `
class FcTap extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(${CHUNK}); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) for (let i = 0; i < ch.length; i++) {
      this.buf[this.n++] = ch[i];
      if (this.n === this.buf.length) { this.port.postMessage(this.buf.slice(0)); this.n = 0; }
    }
    return true;
  }
}
registerProcessor('fc-tap', FcTap);`;

// Whisper sometimes "hears" these in silence or noise
const HALLUCINATIONS = [
  'thank you', 'thanks for watching', 'thank you for watching', 'thanks for watching and see you next time', 'bye', 'you',
  'subtitles by the amaraorg community', 'please subscribe', 'see you next time', 'ill see you next time', 'okay', 'so',
];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

export interface WhisperHandlers {
  onText: (text: string) => void;
  onSpeaking: (on: boolean) => void;
  onError: (msg: string) => void;
  isTtsTalking: () => boolean;
}

export function whisperReady() {
  const s = settings.get();
  return !!(s.sttUrl && (s.sttKey || !/api\.(openai|groq)\.com/.test(s.sttUrl)));
}

export function createWhisper(h: WhisperHandlers) {
  let ctx: AudioContext | null = null;
  let node: AudioWorkletNode | null = null;
  let src: MediaStreamAudioSourceNode | null = null;
  let floor = 0.008;
  let speaking = false;
  let voiced = 0;              // voiced chunks in a row before we call it speech
  let voicedTotal = 0;         // voiced chunks in this clip
  let silentMs = 0;
  let tainted = false;         // a chat voice was talking during this clip
  let pre: Float32Array[] = [];
  let seg: Float32Array[] = [];
  let chain: Promise<void> = Promise.resolve();

  function onChunk(c: Float32Array) {
    let sum = 0;
    for (let i = 0; i < c.length; i++) sum += c[i] * c[i];
    const rms = Math.sqrt(sum / c.length);
    const threshold = Math.max(0.012, floor * 3.2);

    if (!speaking) {
      // learn the background noise level while you're quiet
      floor = floor * 0.97 + Math.min(rms, floor * 2 + 0.002) * 0.03;
      pre.push(c);
      if (pre.length > PREROLL) pre.shift();
      if (rms > threshold) {
        if (++voiced >= 2) {
          speaking = true;
          seg = [...pre];
          pre = [];
          voicedTotal = voiced;
          silentMs = 0;
          tainted = h.isTtsTalking();
          h.onSpeaking(true);
        }
      } else voiced = 0;
      return;
    }

    seg.push(c);
    if (h.isTtsTalking()) tainted = true;
    if (rms > threshold * 0.7) { silentMs = 0; voicedTotal++; } else silentMs += CHUNK_MS;
    const lengthMs = seg.length * CHUNK_MS;
    if (silentMs >= settings.get().pauseMs || lengthMs >= MAX_MS) finish(lengthMs >= MAX_MS);
  }

  function finish(keepGoing: boolean) {
    const clip = seg;
    const voicedMs = voicedTotal * CHUNK_MS;
    const skip = tainted;
    seg = [];
    voiced = 0;
    voicedTotal = 0;
    silentMs = 0;
    if (!keepGoing) { speaking = false; h.onSpeaking(false); }
    if (skip || voicedMs < 280) return; // too short, or it was chat's own voice
    // trim most of the trailing silence
    const keep = Math.max(1, clip.length - Math.floor((settings.get().pauseMs - 250) / CHUNK_MS));
    const wav = encodeWav(clip.slice(0, keep));
    // transcribe in parallel, but deliver in the order you spoke
    const job = transcribe(wav, voicedMs);
    chain = chain.then(async () => {
      try {
        const text = await job;
        if (text) h.onText(text);
      } catch (e) { h.onError((e as Error).message); }
    });
  }

  async function transcribe(wav: Blob, voicedMs: number) {
    const s = settings.get();
    const form = new FormData();
    form.append('file', wav, 'speech.wav');
    form.append('model', s.sttModel || 'whisper-large-v3-turbo');
    const lang = (s.lang || navigator.language || 'en').split('-')[0];
    if (lang) form.append('language', lang);
    const hint = [s.streamer && `Streamer: ${s.streamer}.`, s.topic && `Playing ${s.topic}.`, s.vocab && `Words: ${s.vocab}`].filter(Boolean).join(' ').slice(0, 600);
    if (hint) form.append('prompt', hint);
    form.append('temperature', '0');
    form.append('response_format', 'json');
    const res = await fetch(s.sttUrl.replace(/\/+$/, '') + '/audio/transcriptions', {
      method: 'POST',
      headers: s.sttKey ? { authorization: `Bearer ${s.sttKey}` } : {},
      body: form,
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null) as any;
      if (res.status === 401) throw new Error('Your speech recognition key was rejected. Check it on the Mic and voices page.');
      if (res.status === 429) throw new Error('Speech recognition is rate limited. Wait a moment.');
      throw new Error(j?.error?.message || `Speech recognition failed (${res.status}).`);
    }
    const j = await res.json();
    const text = String(j.text || '').trim();
    const n = norm(text);
    if (!n) return '';
    if (voicedMs < 1500 && HALLUCINATIONS.includes(n)) return '';
    if (hint && n.length > 12 && norm(hint).includes(n)) return ''; // echoed the hint back
    return text;
  }

  return {
    async start(stream: MediaStream) {
      this.stop();
      ctx = new AudioContext({ sampleRate: RATE });
      await ctx.resume();
      await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' })));
      src = ctx.createMediaStreamSource(stream);
      node = new AudioWorkletNode(ctx, 'fc-tap');
      node.port.onmessage = e => onChunk(e.data as Float32Array);
      src.connect(node);
      // keep the graph running without making any sound
      const mute = ctx.createGain();
      mute.gain.value = 0;
      node.connect(mute).connect(ctx.destination);
    },
    stop() {
      try { src?.disconnect(); node?.disconnect(); } catch { /* fine */ }
      void ctx?.close().catch(() => {});
      ctx = null; node = null; src = null;
      if (speaking) h.onSpeaking(false);
      speaking = false; seg = []; pre = []; voiced = 0;
    },
  };
}

function encodeWav(chunks: Float32Array[]): Blob {
  const len = chunks.reduce((a, c) => a + c.length, 0);
  const buf = new ArrayBuffer(44 + len * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + len * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, len * 2, true);
  let o = 44;
  for (const c of chunks) for (let i = 0; i < c.length; i++, o += 2) {
    const x = Math.max(-1, Math.min(1, c[i]));
    v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}
