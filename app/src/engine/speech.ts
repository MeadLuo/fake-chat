import { settings } from '../lib/settings';
import { createStore, storage } from '../lib/store';
import { every, later } from '../lib/timers';
import { streamerSaid } from './chat';
import { ttsTalking } from './tts';

type Status = 'off' | 'starting' | 'listening' | 'error';
export const mic = createStore({
  status: 'off' as Status,
  error: '',
  interim: '',
  devices: [] as { id: string; label: string }[],
  supported: !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition),
});

// ---------- level meter (read by the UI every frame, kept out of the store) ----------
let level = 0;
export const micLevel = () => level;

let want = false;
let stream: MediaStream | null = null;
let audioCtx: AudioContext | null = null;
let rafId = 0;
let rec: any = null;
let recState: 'idle' | 'starting' | 'running' = 'idle';
let lastAlive = 0;
let fails = 0;
let stopWatchdog: (() => void) | null = null;
let cancelPause: (() => void) | null = null;
let interim = '';
let committed = '';   // interim text we already sent because you paused

const LISTEN_KEY = 'fc2-listening';

// ---------- mic ----------
async function acquireMic() {
  releaseMic();
  const id = settings.get().micId;
  const audio: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  if (id) audio.deviceId = { exact: id };
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio });
  } catch (e) {
    const err = e as Error;
    if (id && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError')) {
      // picked mic is gone, fall back to the default one
      settings.set({ micId: '' });
      return acquireMic();
    }
    throw err;
  }
  const track = stream.getAudioTracks()[0];
  track.addEventListener('ended', () => { if (want) later(() => void reacquire(), 600); });
  startMeter(stream);
  void refreshDevices();
}

function releaseMic() {
  stream?.getTracks().forEach(t => t.stop());
  stream = null;
  cancelAnimationFrame(rafId);
  level = 0;
}

function startMeter(s: MediaStream) {
  try {
    audioCtx ??= new AudioContext();
    void audioCtx.resume();
    const src = audioCtx.createMediaStreamSource(s);
    const an = audioCtx.createAnalyser();
    an.fftSize = 1024;
    src.connect(an);
    const buf = new Float32Array(an.fftSize);
    const loop = () => {
      an.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      level = level * 0.6 + Math.min(1, rms * 6) * 0.4;
      rafId = requestAnimationFrame(loop);
    };
    cancelAnimationFrame(rafId);
    loop();
  } catch { /* meter is optional */ }
}

export async function refreshDevices() {
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    mic.set({
      devices: all.filter(d => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications')
        .map((d, i) => ({ id: d.deviceId, label: d.label || `Microphone ${i + 1}` })),
    });
  } catch { /* no device list */ }
}
navigator.mediaDevices?.addEventListener?.('devicechange', () => {
  void refreshDevices();
  if (want && stream && !stream.getAudioTracks()[0]?.enabled) void reacquire();
});

async function reacquire() {
  if (!want) return;
  try {
    await acquireMic();
    restartRec();
  } catch {
    mic.set({ status: 'error', error: 'Lost the microphone. Check it is plugged in, then press Start listening.' });
    stop(false);
  }
}

// ---------- speech recognition ----------
function makeRec() {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const r = new SR();
  r.continuous = true;
  r.interimResults = true;
  r.maxAlternatives = 1;
  r.lang = settings.get().lang || navigator.language || 'en-NZ';
  r.onstart = () => { recState = 'running'; lastAlive = Date.now(); if (want) mic.set({ status: 'listening', error: '' }); };
  r.onaudiostart = r.onspeechstart = () => { lastAlive = Date.now(); };
  r.onresult = onResult;
  r.onerror = (e: any) => {
    lastAlive = Date.now();
    const err = e.error as string;
    if (err === 'no-speech' || err === 'aborted') return;
    if (err === 'not-allowed' || err === 'service-not-allowed') {
      mic.set({ status: 'error', error: 'The mic is blocked. Click the icon at the left of the address bar, allow the microphone, then press Start listening.' });
      stop(false);
    } else if (err === 'audio-capture') {
      void reacquire();
    } else if (err === 'network') {
      fails++;
      mic.set({ error: 'Speech recognition lost its connection. Retrying...' });
    } else if (err === 'language-not-supported') {
      mic.set({ status: 'error', error: 'That language is not supported for voice. Pick another on the Voice page.' });
      stop(false);
    } else {
      fails++;
    }
  };
  r.onend = () => {
    recState = 'idle';
    flushInterim();
    if (!want) return;
    // quick restart normally, slower if it keeps failing
    const wait = fails ? Math.min(6000, 300 * 2 ** Math.min(fails, 5)) : 200;
    later(startRec, wait);
  };
  return r;
}

function startRec() {
  if (!want || recState !== 'idle') return;
  rec ??= makeRec();
  recState = 'starting';
  lastAlive = Date.now();
  const track = stream?.getAudioTracks()[0];
  try {
    // Reusing our open mic means Chrome never asks for permission again
    if (track && track.readyState === 'live') rec.start(track);
    else rec.start();
  } catch (e) {
    const msg = (e as Error).message || '';
    if (/already started/i.test(msg)) { recState = 'running'; return; }
    try { rec.start(); } catch { recState = 'idle'; later(startRec, 1000); }
  }
}

function restartRec() {
  if (!rec) return startRec();
  try { rec.abort(); } catch { /* onend restarts it */ }
}

// ---------- turning words into messages ----------
const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, '').split(/\s+/).filter(Boolean);

function onResult(e: any) {
  lastAlive = Date.now();
  fails = 0;
  if (ttsTalking()) { interim = ''; mic.set({ interim: '' }); return; } // that's chat's voice, not you
  let live = '';
  for (let i = e.resultIndex; i < e.results.length; i++) {
    const r = e.results[i];
    const text = String(r[0]?.transcript || '');
    if (r.isFinal) finalise(text);
    else live += text;
  }
  interim = live.trim();
  mic.set({ interim });
  cancelPause?.();
  if (interim) cancelPause = later(commitInterim, settings.get().pauseMs);
}

// You stopped talking but Chrome hasn't decided the sentence is over. Send it anyway.
function commitInterim() {
  cancelPause = null;
  if (!interim) return;
  const extra = remainder(interim, committed);
  if (extra) streamerSaid(extra);
  committed = interim;
}

function finalise(text: string) {
  cancelPause?.(); cancelPause = null;
  const extra = remainder(text, committed);
  committed = '';
  interim = '';
  mic.set({ interim: '' });
  if (extra) streamerSaid(extra);
}

/** The part of `text` we haven't already sent. */
function remainder(text: string, sent: string) {
  const t = words(text);
  if (!sent) return text.trim();
  const s = words(sent);
  let i = 0;
  while (i < s.length && i < t.length && s[i] === t[i]) i++;
  if (i >= s.length * 0.6) {
    const rest = text.trim().split(/\s+/).slice(i).join(' ');
    return rest.split(/\s+/).filter(Boolean).length >= 2 ? rest : '';
  }
  // the recogniser rewrote the sentence: only send if it's mostly new
  const overlap = t.filter(w => s.includes(w)).length / Math.max(1, t.length);
  return overlap > 0.6 ? '' : text.trim();
}

function flushInterim() { if (interim && want) commitInterim(); interim = ''; committed = ''; mic.set({ interim: '' }); }

// ---------- public ----------
export async function start() {
  if (!mic.get().supported) {
    mic.set({ status: 'error', error: 'Voice needs Chrome or Edge. Typing still works.' });
    return;
  }
  if (window.self !== window.top) {
    mic.set({ status: 'error', error: "The mic doesn't work inside a preview. Open the site in its own Chrome tab." });
    return;
  }
  want = true;
  fails = 0;
  mic.set({ status: 'starting', error: '' });
  try {
    await acquireMic();
  } catch (e) {
    want = false;
    const name = (e as Error).name;
    mic.set({
      status: 'error',
      error: name === 'NotFoundError' ? 'No microphone found. Plug one in or check your sound settings.'
        : 'The mic is blocked. Click the icon at the left of the address bar, allow the microphone, then press Start listening.',
    });
    return;
  }
  storage.write(LISTEN_KEY, true);
  startRec();
  stopWatchdog?.();
  stopWatchdog = every(() => {
    if (!want) return;
    const quiet = Date.now() - lastAlive;
    // stuck starting, or silently frozen: kick it
    if ((recState === 'starting' && quiet > 8000) || (recState === 'running' && quiet > 75000)) restartRec();
    if (recState === 'idle') startRec();
    if (stream && stream.getAudioTracks()[0]?.readyState === 'ended') void reacquire();
  }, 4000);
}

export function stop(remember = true) {
  want = false;
  if (remember) storage.write(LISTEN_KEY, false);
  stopWatchdog?.(); stopWatchdog = null;
  cancelPause?.(); cancelPause = null;
  interim = ''; committed = '';
  try { rec?.abort(); } catch { /* fine */ }
  recState = 'idle';
  releaseMic();
  const s = mic.get().status;
  mic.set({ status: s === 'error' ? 'error' : 'off', interim: '' });
}

export const isListening = () => want;
export const wasListening = () => storage.read(LISTEN_KEY, false);

// Picking a different mic or language takes effect straight away
let prevMic = settings.get().micId, prevLang = settings.get().lang;
settings.subscribe(() => {
  const s = settings.get();
  if (s.micId !== prevMic) { prevMic = s.micId; if (want) void reacquire(); }
  if (s.lang !== prevLang) { prevLang = s.lang; if (rec) { rec.lang = s.lang || navigator.language || 'en-NZ'; if (want) restartRec(); } }
});
