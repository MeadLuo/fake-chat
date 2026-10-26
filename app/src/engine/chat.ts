import { emit, feed } from '../lib/feed';
import { aiReady, settings } from '../lib/settings';
import { createStore, uid } from '../lib/store';
import { every, later } from '../lib/timers';
import type { Msg, Poll } from '../lib/types';
import { cast, findViewer, makeName, pick, pickViewer, raiderName, rand, remember, updateViewer, viewerFor } from '../lib/viewers';
import { generateChat, usage, type GenKind, type RawMsg } from './ai';
import { grabScreen, onScreenChange } from './screen';
import { speak } from './tts';

// ---------- live state the UI shows ----------
export interface Heard { id: string; text: string; at: number; typed: boolean; }
export const live = createStore({
  thinking: false,
  error: '',
  heard: [] as Heard[],          // what you said, newest last
  timedOut: {} as Record<string, number>, // name -> until (ms), Infinity for bans
  queue: 0,
});

const recentChat: string[] = [];
const recentSpeech: string[] = [];
interface Queued extends RawMsg { gen: number; at: number; }
const queue: Queued[] = [];
let pending: string[] = [];
let pendingEvents: string[] = [];
let busy = false;
let again = false;
let genId = 0;
let lastActivity = Date.now();
let lastGen = 0;
let lastScreenGen = 0;
let cancelDebounce: (() => void) | null = null;

const timedOutNames = () => {
  const now = Date.now();
  return new Set(Object.entries(live.get().timedOut).filter(([, until]) => until > now).map(([n]) => n));
};

// ---------- you talking ----------
export function streamerSaid(text: string, typed = false) {
  text = text.trim().slice(0, 600);
  if (!text) return;
  const s = settings.get();
  live.set(l => ({ heard: [...l.heard, { id: uid(), text, at: Date.now(), typed }].slice(-30) }));
  if (typed && s.showTyped) {
    const m: Msg = { id: uid(), kind: 'me', user: s.streamer.trim() || 'You', color: s.look.accent, text, at: Date.now() };
    emit({ type: 'msg', m });
    recentChat.push(`[${m.user}, the streamer, typed in chat]: ${text}`);
  }
  pending.push(text);
  lastActivity = Date.now();
  schedule(typed ? 150 : 250);
}

function schedule(wait: number) {
  cancelDebounce?.();
  cancelDebounce = later(() => { cancelDebounce = null; void generate('speech'); }, wait);
}

function howMany(kind: GenKind) {
  const b = settings.get().busy;
  if (kind === 'idle') return rand(1, Math.ceil(b / 1.5) + 1);
  if (kind === 'screen') return rand(2, 2 + b);
  if (kind === 'event') return rand(2 + b, 4 + b);
  return rand(1 + b, 3 + b);
}

// ---------- asking the AI ----------
async function generate(kind: GenKind) {
  if (busy) { again = true; return; }
  const said = pending.join(' ').trim();
  const events = pendingEvents.splice(0);
  pending = [];
  if (kind === 'speech' && !said && !events.length) return;
  if (said) { recentSpeech.push(said); while (recentSpeech.length > 14) recentSpeech.shift(); }
  const effective: GenKind = kind === 'speech' && !said ? 'event' : kind;

  busy = true;
  again = false;
  const gen = ++genId;
  lastGen = Date.now();
  // New thing to react to: old reactions still waiting in line are now stale
  if (effective === 'speech' || effective === 'event') dropStale(gen);

  const count = howMany(effective);
  let got = 0;
  const take = (m: RawMsg) => { if (got < count + 4 && fresh(m.msg)) { got++; enqueue({ ...m, gen, at: Date.now() }); } };

  if (aiReady()) {
    live.set({ thinking: true });
    try {
      const { remember: notes } = await generateChat({
        kind: effective, said, events, count,
        recentChat: recentChat.slice(-30), recentSpeech: said ? recentSpeech.slice(0, -1) : recentSpeech.slice(),
        poll: feed.get().poll, timedOut: [...timedOutNames()],
        screenshot: grabScreen(),
      }, take);
      remember(notes);
      live.set({ error: '' });
    } catch (e) {
      const msg = e instanceof Error ? (e.name === 'TimeoutError' ? 'The AI took too long to answer.' : e.message) : String(e);
      live.set({ error: msg });
      usage.set({ lastError: msg });
    }
    live.set({ thinking: false });
  }
  if (!got) offline(effective, said, events, count).forEach(take);

  busy = false;
  if (again || pending.length || pendingEvents.length) schedule(60);
}

function dropStale(gen: number) {
  const now = Date.now();
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].gen < gen && now - queue[i].at > 2500) queue.splice(i, 1);
  live.set({ queue: queue.length });
}

// Drop messages chat already said recently. Tiny ones like "W" or "LUL" can repeat, real chat does that.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
function fresh(msg: string) {
  const k = norm(msg);
  if (k.length <= 6) return true;
  const seen = recentChat.slice(-40).map(l => norm(l.slice(l.indexOf(':') + 1))).concat(queue.map(q => norm(q.msg)));
  return !seen.includes(k);
}

// ---------- posting messages at a human pace ----------
let dripping = false;
function enqueue(m: Queued) {
  queue.push(m);
  while (queue.length > 30) queue.shift();
  live.set({ queue: queue.length });
  if (!dripping) { dripping = true; later(drip, rand(250, 700)); }
}
function drip() {
  const m = queue.shift();
  live.set({ queue: queue.length });
  if (!m) { dripping = false; return; }
  post(m);
  const b = settings.get().busy;
  const base = (2600 - b * 430) * (0.35 + Math.random() * 0.9);
  const next = queue[0];
  const typing = next ? Math.min(1400, next.msg.length * 16) * (6 - b) / 5 : 0;
  later(drip, Math.max(140, base + typing));
}

const mentions = (text: string) => {
  const n = settings.get().streamer.trim().toLowerCase();
  return n.length > 1 && text.toLowerCase().includes(n);
};

function post(raw: RawMsg) {
  const v = viewerFor(raw.user, timedOutNames());
  const m: Msg = { id: uid(), kind: 'chat', user: v.name, color: v.color, badge: v.badge, text: raw.msg.slice(0, 280), at: Date.now() };
  m.hl = mentions(m.text);
  recentChat.push(`${m.user}: ${m.text}`);
  while (recentChat.length > 60) recentChat.shift();
  emit({ type: 'msg', m });
  speak(m);
}

function system(text: string, kind: Msg['kind'] = 'system') {
  emit({ type: 'msg', m: { id: uid(), kind, text, at: Date.now() } });
  recentChat.push(`[${kind === 'alert' ? 'ALERT' : 'CHAT NOTICE'}] ${text}`);
}

function react(event: string) {
  pendingEvents.push(event);
  lastActivity = Date.now();
  schedule(300);
}

// ---------- offline messages (no AI, or the AI failed) ----------
const GENERIC: Record<string, string[]> = {
  hype: ['LETS GOOO', 'W', 'Pog', 'POGGERS', 'HYPE', 'no way', 'W streamer', 'sheeeesh', '🔥🔥🔥', 'insane'],
  chill: ['lol', 'true', 'fair', 'real', 'haha', 'nice', 'vibes', 'same tbh', 'lmao', 'mood'],
  wholesome: ['<3', 'love this stream', 'ur doing great', 'so wholesome', 'hi chat <3', 'glad i caught this live'],
  roast: ['KEKW', 'bro what', 'L take', 'sure buddy', 'skill issue', 'we believe you Kappa', '💀', 'ratio'],
  chaos: ['KEKW', '???', 'LUL LUL LUL', 'chat is this real', 'first', 'monkaS', 'KEKW KEKW', 'i am a potato'],
  tryhard: ['bad rotation', 'should have played safer', 'clean', 'nice timing', 'check the minimap', 'gg'],
};
const ANSWERS = ['yes', 'nah', 'yeah', 'no way', 'maybe', '100%', 'depends', 'idk', 'YES', 'nope'];
const IDLE = ['hi chat', 'what are we doing today', 'first time here', 'hows everyone', 'lurking o7', 'any plans for later?', 'chat is quiet', 'o7', 'gm chat'];
const CONGRATS = ['W', 'welcome!!', 'LETS GO', 'ty for the support <3', 'Pog', 'hype', '<3 <3', 'W supporter'];
function offline(kind: GenKind, said: string, events: string[], count: number): RawMsg[] {
  const pool = GENERIC[settings.get().vibe] || GENERIC.hype;
  const words = said.split(/\s+/).map(w => w.replace(/[^\w']/g, '').toLowerCase()).filter(w => w.length > 4);
  const question = said.includes('?') || /^(what|who|how|why|should|do|does|is|are|can|would|anyone|chat)\b/i.test(said);
  return Array.from({ length: count }, (_, i) => {
    let msg: string;
    if (events.length && i < 3) msg = pick(CONGRATS);
    else if (kind === 'idle' || kind === 'screen') msg = pick(IDLE);
    else if (question && Math.random() < 0.6) msg = pick(ANSWERS);
    else if (words.length && Math.random() < 0.3) msg = pick([`${pick(words)}?? LUL`, `"${pick(words)}" KEKW`, `${pick(words)} is real`]);
    else msg = pick(pool);
    return { user: pickViewer(timedOutNames()).name, msg };
  });
}

// ---------- alerts ----------
export type AlertType = 'sub' | 'follow' | 'gift' | 'bits' | 'raid';
let nextAlert = Date.now() + rand(70, 160) * 1000;
export function fireAlert(type?: AlertType) {
  const s = settings.get();
  nextAlert = Date.now() + s.alertMinutes * 60000 * (0.5 + Math.random());
  const t: AlertType = type || pick<AlertType>(['sub', 'sub', 'follow', 'follow', 'gift', 'bits', 'raid']);
  const who = pickViewer(timedOutNames());
  let text = '';
  if (t === 'sub') {
    text = `⭐ ${who.name} subscribed${Math.random() < 0.5 ? ` for ${rand(2, 30)} months` : ''}!`;
    if (!who.badge) updateViewer(who.name, { badge: 'sub' });
  } else if (t === 'follow') text = `💜 ${makeName()} just followed`;
  else if (t === 'gift') text = `🎁 ${who.name} gifted ${pick([1, 5, 5, 10, 20])} subs!`;
  else if (t === 'bits') text = `💎 ${who.name} cheered ${pick([100, 200, 500, 1000])} bits`;
  else {
    const n = rand(8, 140);
    text = `🚀 ${raiderName()} is raiding with ${n} viewers!`;
    setCount(feed.get().viewerCount + n);
  }
  system(text, 'alert');
  react(text);
}

// ---------- polls ----------
let pollWeights: number[] = [];
export function startPoll(question: string, options: string[], seconds: number) {
  const opts = options.map(o => o.trim()).filter(Boolean).slice(0, 5);
  if (!question.trim() || opts.length < 2) return;
  const poll: Poll = { id: uid(), question: question.trim(), options: opts, votes: opts.map(() => 0), endsAt: Date.now() + seconds * 1000, done: false };
  pollWeights = opts.map(() => 0.4 + Math.random());
  emit({ type: 'poll', poll });
  react(`${settings.get().streamer || 'The streamer'} started a poll: "${poll.question}" with options ${opts.join(', ')}`);
}
export function endPoll() {
  const p = feed.get().poll;
  if (!p || p.done) return;
  const done = { ...p, done: true, endsAt: Date.now() };
  emit({ type: 'poll', poll: done });
  const max = Math.max(...done.votes);
  const winners = done.options.filter((_, i) => done.votes[i] === max);
  react(`Poll ended: "${done.question}". ${winners.length > 1 ? `Tie between ${winners.join(' and ')}` : `${winners[0]} won`} (${done.options.map((o, i) => `${o} ${done.votes[i]}`).join(', ')})`);
  later(() => { if (feed.get().poll?.id === done.id) emit({ type: 'poll', poll: null }); }, 12000);
}
export function closePoll() { emit({ type: 'poll', poll: null }); }
function tickPoll() {
  const p = feed.get().poll;
  if (!p || p.done) return;
  if (Date.now() >= p.endsAt) return endPoll();
  const total = p.votes.reduce((a, b) => a + b, 0);
  const cap = Math.max(6, Math.round(feed.get().viewerCount * 0.55));
  if (total >= cap) return;
  const votes = [...p.votes];
  const n = rand(0, Math.max(1, Math.round(cap / 12)));
  for (let i = 0; i < n; i++) {
    // momentum: the leader pulls a bit more
    const w = pollWeights.map((x, j) => x * (1 + votes[j] / (total + 8)));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    let j = 0;
    while ((r -= w[j]) > 0 && j < w.length - 1) j++;
    votes[j]++;
  }
  emit({ type: 'poll', poll: { ...p, votes } });
}

// ---------- moderation ----------
export function timeout(name: string, seconds: number) {
  live.set(l => ({ timedOut: { ...l.timedOut, [name]: seconds === Infinity ? Infinity : Date.now() + seconds * 1000 } }));
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].user === name) queue.splice(i, 1);
  emit({ type: 'purge', user: name });
  const what = seconds === Infinity ? 'was banned' : `was timed out for ${seconds >= 60 ? Math.round(seconds / 60) + ' min' : seconds + 's'}`;
  system(`${name} ${what}`);
  react(`${name} ${what} by the streamer`);
}
export function untimeout(name: string) {
  live.set(l => { const t = { ...l.timedOut }; delete t[name]; return { timedOut: t }; });
}
export function removeMessage(id: string) { emit({ type: 'remove', id }); }
export function clearChat() { queue.length = 0; recentChat.length = 0; emit({ type: 'clear' }); live.set({ queue: 0 }); }

/** Make a specific viewer say something (from the Live page). */
export function sayAs(name: string, text: string) {
  const v = findViewer(name);
  if (!v || !text.trim()) return;
  post({ user: v.name, msg: text.trim() });
  react(`${v.name} said: ${text.trim()}`);
}

// ---------- viewer count ----------
export function setCount(n: number) { emit({ type: 'count', n: Math.max(0, Math.round(n)) }); }
function driftCount() {
  const base = settings.get().viewerCount;
  const now = feed.get().viewerCount || base;
  const pull = (base - now) * 0.08; // drift back towards your number after raids
  setCount(Math.max(Math.round(base * 0.6), now + pull + rand(-2, 3)));
}

// ---------- the loop ----------
let started = false;
export function startEngine() {
  if (started) return;
  started = true;
  setCount(settings.get().viewerCount);
  emit({ type: 'look', look: settings.get().look });
  let prevCount = settings.get().viewerCount;
  settings.subscribe(() => {
    const s = settings.get();
    if (s.look !== feed.get().look) emit({ type: 'look', look: s.look });
    if (s.viewerCount !== prevCount) { prevCount = s.viewerCount; setCount(s.viewerCount); }
  });
  // a renamed viewer updates messages already on screen
  let prev = cast.get().list;
  cast.subscribe(() => {
    const next = cast.get().list;
    if (next.length === prev.length) next.forEach((v, i) => {
      const o = prev[i];
      if (o && (o.name !== v.name || o.color !== v.color)) emit({ type: 'rename', old: o.name, new: v.name, color: v.color });
    });
    prev = next;
  });
  onScreenChange(() => {
    const s = settings.get();
    if (!s.reactToScreen || busy || queue.length > 2 || !aiReady()) return;
    if (Date.now() - lastScreenGen < 12000 || Date.now() - lastActivity < 3000) return;
    lastScreenGen = Date.now();
    void generate('screen');
  });
  every(() => {
    const s = settings.get();
    tickPoll();
    if (s.alerts && Date.now() > nextAlert && !busy) { fireAlert(); return; }
    if (!s.idle || busy || queue.length) return;
    const gap = [0, 40, 26, 18, 12, 8][s.busy] * 1000;
    if (Date.now() - lastActivity > gap && Date.now() - lastGen > gap) {
      lastActivity = Date.now();
      void generate('idle');
    }
  }, 1000);
  every(driftCount, 15000);
}
