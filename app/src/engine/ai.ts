import { createStore } from '../lib/store';
import { BRAINS, VIBES, modelName, settings } from '../lib/settings';
import { ACTIVITY, cast, memory } from '../lib/viewers';
import type { Poll } from '../lib/types';
import { activePacks } from '../lib/games';

export type GenKind = 'speech' | 'idle' | 'screen' | 'event';

export interface GenContext {
  kind: GenKind;
  said: string;              // what the streamer just said (may be empty)
  events: string[];          // alerts, poll results, timeouts
  count: number;
  recentChat: string[];
  recentSpeech: string[];
  poll: Poll | null;
  timedOut: string[];
  screenshot: string | null; // base64 jpeg
}

export interface RawMsg { user: string; msg: string; }

// Running totals so the app can show how much the AI is being used
export const usage = createStore({ calls: 0, input: 0, output: 0, cached: 0, lastMs: 0, lastError: '' });

const LENGTH = {
  short: 'Keep almost every message to 1 to 6 words, like a fast busy chat.',
  mixed: 'Most messages are 1 to 10 words, some are just an emote, now and then one is a full sentence or two.',
  long: 'Mix short reactions with plenty of longer messages, full thoughts and proper back-and-forth.',
};
const EMOTES = [
  'Barely use emotes.',
  'Text emotes like KEKW, LUL, Pog, W, L, o7, monkaS, Kappa, <3, Sadge are fine, don\'t overdo them.',
  'Lots of emotes: KEKW, LUL, Pog, W, L, o7, monkaS, Kappa, <3, Sadge, Clap, catJAM, and emote-only messages.',
];
const TYPOS = [
  'Spelling is mostly correct.',
  'Type like real chat: lowercase, little punctuation, slang, the odd typo.',
  'Very messy typing: lowercase, no punctuation, lots of typos and abbreviations.',
];

export function buildPrompt(c: GenContext) {
  const s = settings.get();
  const streamer = s.streamer.trim() || 'the streamer';
  const vibe = s.vibe === 'custom' ? (s.customVibe.trim() || VIBES.hype.prompt) : (VIBES[s.vibe]?.prompt || VIBES.hype.prompt);
  const packs = activePacks(s);
  const knowledge = [
    ...packs.map(p => p.knowledge),
    s.customKnowledge.trim() && `Other things chat knows:\n${s.customKnowledge.trim()}`,
  ].filter(Boolean).join('\n\n');
  const castLines = cast.get().list.slice(0, 70).map(v =>
    `- ${v.name}${v.badge ? ` [${v.badge}]` : ''} (${ACTIVITY[v.chat] || 'normal'}): ${v.note || 'regular viewer'}`).join('\n');

  // Stable part first so it gets cached. Things that change every call go in the user message.
  const system = `You are the live chat of a Twitch stream. You write what the viewers type. It has to feel like a real community: real people with their own personalities, who know each other, know the streamer, and actually pay attention to everything the streamer says.

Streamer: ${streamer}
Stream: ${s.topic.trim() || 'just chatting'}
Chat vibe: ${vibe}
Chat language: ${s.chatLanguage || 'English'}${s.vocab.trim() ? `

Names and words the streamer uses a lot. Speech-to-text often mishears these, so when a word looks like a mishearing of one, read it as the real one: ${s.vocab.trim()}` : ''}${s.about.trim() ? `

What the regulars already know about ${streamer}:
${s.about.trim()}` : ''}

${knowledge ? `Game knowledge. Chat watches this game a lot and knows it well. Use the right names for characters, abilities, weapons, maps and modes, and real player slang. Knowledgeable viewers are accurate. Keep it casual, never lecture or list facts. If speech-to-text mangles a character name, read it as the closest real one.
${knowledge}

` : ''}The viewers (name [badge] (how much they talk): personality):
${castLines}

Be a smart, real chat, not a generic one:
- Respond to everything the streamer says. Pay attention to the specific thing said, not a vague version of it. Pick up on details, jokes, implications and how the streamer feels.
- If the streamer talks to chat or asks something, chat answers right away, with different opinions. If they say a viewer's name (speech-to-text often mangles names, match the closest one), that viewer replies to them directly.
- If the streamer reads out or replies to a chat message, the viewer who wrote it reacts, and others join in.
- Viewers also talk to each other: reply with @name, keep side conversations going, agree, argue, ask follow ups, build on each other's jokes.
- Use the memory. Call back to earlier moments, things the streamer told chat, bets, predictions and running jokes, when it fits.
- Know your stuff. When the streamer asks a real question (game mechanics, tips, where to go, facts), knowledgeable viewers give correct, specific answers in chat style. Only the confidently-wrong type gets it wrong, and others may correct them.
- Read the room. Big moments (wins, deaths, clutch plays, alerts, announcements) get a flood of reactions, small talk gets a few. If the streamer sounds frustrated or down, chat gets supportive, even the trolls ease off.
- Everyone stays in character: their personality, interests and how they type. Chatty viewers talk a lot, lurkers hardly ever. Not everyone talks every time.
- Every message adds something. Never reuse a message, joke or phrasing already in recent chat. Never parrot the streamer's words back.
- ${LENGTH[s.replyLength] || LENGTH.mixed}
- ${TYPOS[s.typos] ?? TYPOS[1]} ${EMOTES[s.emoteLevel] ?? EMOTES[1]} Nobody sounds like an assistant. No hashtags.
- The streamer's words come from speech-to-text, so work out what they meant.
- Messages are in time order, so later ones can react to earlier ones in the same batch.
- ${s.swearing ? 'Mild swearing is fine.' : 'Keep it clean, no swearing.'} No slurs, hate, sexual content, or real personal attacks. Teasing is friendly banter only.
- ${s.newViewers ? 'Use names from the list. Now and then a brand new viewer can show up with a name in the same style.' : 'Only use names from the list, spelled exactly.'}
- When there's an image, it's the streamer's screen right now and viewers can see it. React to what's actually on it: plays, deaths, wins, menus, items, health, funny moments, small details a sharp viewer would notice.

Memory notes: in "remember", add 0 to 2 short notes ONLY for new things worth bringing up later this stream or next time. Good: facts the streamer shared about themselves or their plans, big moments, bets and predictions, running jokes, promises. Write each like "${streamer} said they've never beaten the Ender Dragon". Usually it's empty. Don't repeat what's already in memory.

Reply with ONLY this JSON, no other text:
{"messages":[{"user":"name","msg":"text"}],"remember":["note"]}`;

  const parts: string[] = [];
  const notes = memory.get().notes;
  if (notes.length) parts.push('Chat memory (things that happened before):\n' + notes.map(n => '- ' + n.t).join('\n'));
  if (c.recentChat.length) parts.push('Recent chat (oldest first):\n' + c.recentChat.slice(-30).join('\n'));
  if (c.recentSpeech.length) parts.push(`What ${streamer} said earlier (oldest first):\n` + c.recentSpeech.slice(-10).map(x => '- ' + x).join('\n'));
  if (c.poll && !c.poll.done) parts.push(`Poll running now: "${c.poll.question}". Votes so far: ${c.poll.options.map((o, i) => `${o} (${c.poll!.votes[i]})`).join(', ')}. Viewers talk about it and say what they voted for.`);
  if (c.timedOut.length) parts.push(`Timed out right now (they can't talk): ${c.timedOut.join(', ')}`);
  if (c.events.length) parts.push('Just happened on stream:\n' + c.events.map(e => '- ' + e).join('\n'));
  if (c.said) parts.push(`${streamer} just said: "${c.said}"`);

  const n = c.count;
  if (c.kind === 'speech' || c.kind === 'event') parts.push(`Write the next ${n} chat messages. ${c.said ? `React to what ${streamer} just said` : 'React to what just happened'}, and keep viewer conversations going.`);
  else if (c.kind === 'screen') parts.push(`Something just changed on ${streamer}'s screen. Write the next ${n} chat messages reacting to what's on screen now.`);
  else if (c.screenshot) parts.push(`${streamer} is quiet right now. Write the next ${n} chat messages: react to what's on screen, keep viewer conversations going, maybe ask ${streamer} something.`);
  else parts.push(`${streamer} has gone quiet. Write the next ${n} chat messages: viewers chatting with each other, continuing earlier threads, or asking ${streamer} something.`);

  return { system, user: parts.join('\n\n') };
}

// ---------- reading the AI's reply as it streams in ----------
const MSG_RE = /\{\s*"user"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"msg"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
const unescape = (s: string) => { try { return JSON.parse('"' + s + '"') as string; } catch { return s; } };

export function streamParser(onMsg: (m: RawMsg) => void) {
  let text = '';
  let pos = 0;
  return {
    push(chunk: string) {
      text += chunk;
      MSG_RE.lastIndex = pos;
      let m: RegExpExecArray | null;
      while ((m = MSG_RE.exec(text))) {
        pos = MSG_RE.lastIndex;
        const msg = unescape(m[2]).trim();
        if (msg) onMsg({ user: unescape(m[1]), msg });
      }
    },
    /** Notes to remember, read from the full reply at the end. */
    finish(): string[] {
      const clean = text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(?:json)?/g, '');
      const o = clean.indexOf('{');
      if (o < 0) return [];
      try {
        const j = JSON.parse(clean.slice(o, clean.lastIndexOf('}') + 1));
        return Array.isArray(j.remember) ? j.remember : [];
      } catch {
        const r = /"remember"\s*:\s*(\[[\s\S]*?\])/.exec(clean);
        try { return r ? JSON.parse(r[1]) : []; } catch { return []; }
      }
    },
    text: () => text,
  };
}

async function* sseLines(res: Response) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line.startsWith('data:')) yield line.slice(5).trim();
    }
  }
  if (buf.trim().startsWith('data:')) yield buf.trim().slice(5).trim();
}

async function errorText(res: Response) {
  const j = await res.json().catch(() => null) as { error?: { message?: string } | string } | null;
  const msg = typeof j?.error === 'string' ? j.error : j?.error?.message;
  if (res.status === 401) return 'Your API key was rejected. Check it in the AI page.';
  if (res.status === 429) return 'Rate limited by the AI. Chat will slow down for a bit.';
  if (res.status === 400 && /credit/i.test(msg || '')) return 'Your API account is out of credit.';
  return msg || `The AI returned an error (${res.status}).`;
}

/** Asks the AI for chat messages and calls onMsg for each one as it arrives. */
export async function generateChat(c: GenContext, onMsg: (m: RawMsg) => void, signal?: AbortSignal) {
  const s = settings.get();
  const { system, user } = buildPrompt(c);
  const parser = streamParser(onMsg);
  const started = performance.now();
  const timeout = AbortSignal.timeout(s.brain === 'genius' ? 70000 : 40000);
  const sig = signal ? anySignal([signal, timeout]) : timeout;

  if (s.provider === 'anthropic') {
    const content = c.screenshot
      ? [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: c.screenshot } }, { type: 'text', text: user }]
      : user;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': s.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: modelName(s),
        max_tokens: 1500,
        temperature: 1,
        stream: true,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content }],
      }),
      signal: sig,
    });
    if (!res.ok) throw new Error(await errorText(res));
    let input = 0, output = 0, cached = 0;
    for await (const data of sseLines(res)) {
      let ev: any; try { ev = JSON.parse(data); } catch { continue; }
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') parser.push(ev.delta.text);
      else if (ev.type === 'message_start') {
        const u = ev.message?.usage || {};
        input = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
        cached = u.cache_read_input_tokens || 0;
      } else if (ev.type === 'message_delta') output = ev.usage?.output_tokens || output;
      else if (ev.type === 'error') throw new Error(ev.error?.message || 'The AI stopped with an error.');
    }
    track(input, output, cached, started);
  } else {
    const base = (s.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (s.apiKey) headers.authorization = `Bearer ${s.apiKey}`;
    const content = c.screenshot
      ? [{ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + c.screenshot } }, { type: 'text', text: user }]
      : user;
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST', headers, signal: sig,
      body: JSON.stringify({ model: modelName(s), stream: true, messages: [{ role: 'system', content: system }, { role: 'user', content }] }),
    });
    if (!res.ok) throw new Error(await errorText(res));
    let input = 0, output = 0;
    for await (const data of sseLines(res)) {
      if (data === '[DONE]') break;
      let ev: any; try { ev = JSON.parse(data); } catch { continue; }
      const d = ev.choices?.[0]?.delta?.content;
      if (d) parser.push(d);
      if (ev.usage) { input = ev.usage.prompt_tokens || 0; output = ev.usage.completion_tokens || 0; }
    }
    track(input, output, 0, started);
  }
  return { remember: parser.finish() };
}

function track(input: number, output: number, cached: number, started: number) {
  usage.set(u => ({ calls: u.calls + 1, input: u.input + input, output: u.output + output, cached: u.cached + cached, lastMs: Math.round(performance.now() - started), lastError: '' }));
}

function anySignal(signals: AbortSignal[]) {
  const ctl = new AbortController();
  for (const s of signals) {
    if (s.aborted) { ctl.abort(s.reason); break; }
    s.addEventListener('abort', () => ctl.abort(s.reason), { once: true });
  }
  return ctl.signal;
}

export const brainLabel = () => {
  const s = settings.get();
  return s.provider === 'anthropic' ? `${BRAINS[s.brain].label} (${modelName(s)})` : modelName(s);
};
