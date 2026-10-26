import { createStore, storage, uid } from './store';
import { settings } from './settings';
import type { BadgeId, MemoryNote, Viewer } from './types';

const NAME_A = ['pixel', 'noodle', 'frost', 'turbo', 'lazy', 'salty', 'cosmic', 'kiwi', 'pog', 'sleepy', 'neon', 'chunky', 'spicy', 'silent', 'retro', 'mega', 'tiny', 'shadow', 'crispy', 'lofi', 'grumpy', 'zesty', 'velvet', 'feral', 'soggy', 'hyper'];
const NAME_B = ['goose', 'fox', 'gamer', 'wizard', 'bean', 'toast', 'panda', 'ninja', 'potato', 'moth', 'gremlin', 'dragon', 'muffin', 'tuna', 'yeti', 'pigeon', 'koala', 'biscuit', 'otter', 'raccoon', 'nugget', 'frog', 'waffle', 'cactus', 'possum'];
// No greens, so a green screen key never eats a username
export const COLORS = ['#FF4A4A', '#4AA3FF', '#FFB020', '#C77DFF', '#FF7AC6', '#FF8A3D', '#7C9CFF', '#FFD84A', '#FF5E8A', '#B388FF', '#FFFFFF', '#FF9E80', '#5CC8FF', '#E0A8FF'];

export const PERSONALITIES = [
  'backseat gamer, always says what the streamer should have done',
  'hype man, caps lock, gets excited about everything',
  'shy lurker, barely talks, short lowercase messages',
  'friendly troll, teases the streamer but clearly loves the stream',
  'curious, asks loads of questions about the game and the streamer',
  'emote spammer, mostly reacts with emotes and one-word messages',
  'wholesome supporter, kind, reminds people to drink water',
  'know-it-all who quotes stats and facts, sometimes confidently wrong',
  'first time here, a bit lost, asks what is going on',
  'types fast and makes typos, never fixes them',
  'meme lord, everything is a meme reference',
  'up way too late, keeps saying they should sleep but never leaves',
  'competitive, says they could do it better',
  'theorist who overthinks everything and makes predictions',
  'always hungry, talks about snacks',
  'day one regular, calls the streamer by a nickname, has inside jokes',
  'dramatic, overreacts to absolutely everything',
  'deadpan, dry one-line jokes',
  'sweet older viewer, full sentences and proper punctuation',
  'pun enjoyer, makes terrible puns',
  'gives unsolicited life advice',
  'yells CLIP IT whenever anything happens',
  'compares everything to other games',
  'chaotic gremlin, random thoughts out of nowhere',
  'student who should be doing homework right now',
  'music nerd, asks what song is playing',
  'kiwi who uses slang like chur, sweet as, yeah nah',
  'conspiracy joker, thinks the game is rigged against the streamer',
  'helpful expert, gives real tips and is usually right',
  'mostly talks to other chatters, gossips about chat',
];

export const ACTIVITY: Record<number, string> = { 1: 'lurker', 2: 'normal', 3: 'chatty' };

export const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
export const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
export function hash(s: string) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

export function makeName() {
  const a = pick(NAME_A), b = pick(NAME_B);
  const n = Math.random() < 0.5 ? String(rand(1, 999)) : '';
  return pick([a + b + n, a + '_' + b, cap(a) + cap(b) + n, b + (n || '42'), 'xX' + a + b + 'Xx', a + b + '_tv', 'the' + cap(b) + n]);
}
export const raiderName = () => cap(pick(NAME_A)) + cap(pick(NAME_B));
export const cleanName = (n: unknown) => String(n || '').replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 25);

function randomBadge(mods: number): BadgeId {
  const r = Math.random();
  return r < 0.06 && mods < 2 ? 'mod' : r < 0.14 ? 'vip' : r < 0.4 ? 'sub' : '';
}
export function randomViewer(name: string, used = new Set<string>(), mods = 0): Viewer {
  const free = PERSONALITIES.filter(p => !used.has(p));
  const note = pick(free.length ? free : PERSONALITIES);
  used.add(note);
  const chat = (note.startsWith('shy') ? 1 : Math.random() < 0.25 ? 1 : Math.random() < 0.35 ? 3 : 2) as Viewer['chat'];
  return { name, color: COLORS[hash(name) % COLORS.length], note, badge: randomBadge(mods), chat };
}
export function randomCast(n = 18): Viewer[] {
  const out: Viewer[] = [];
  const used = new Set<string>();
  let mods = 0;
  while (out.length < n) {
    const name = makeName();
    if (out.some(v => v.name === name)) continue;
    const v = randomViewer(name, used, mods);
    if (v.badge === 'mod') mods++;
    out.push(v);
  }
  return out;
}

// ---------- viewers store ----------
const VKEY = 'fc2-viewers';
export const cast = createStore<{ list: Viewer[] }>({ list: storage.read<Viewer[]>(VKEY, []) });
if (!cast.get().list.length) cast.set({ list: randomCast() });
cast.subscribe(() => storage.write(VKEY, cast.get().list));

export const findViewer = (name: string) => cast.get().list.find(v => v.name === name);

export function updateViewer(name: string, patch: Partial<Viewer>) {
  cast.set(s => ({ list: s.list.map(v => (v.name === name ? { ...v, ...patch } : v)) }));
}

/** Random viewer, chatty people picked more often. */
export function pickViewer(exclude?: Set<string>): Viewer {
  const list = cast.get().list.filter(v => !exclude?.has(v.name));
  const pool = list.length ? list : cast.get().list;
  let total = 0;
  for (const v of pool) total += v.chat * v.chat;
  let r = Math.random() * total;
  for (const v of pool) { r -= v.chat * v.chat; if (r <= 0) return v; }
  return pool[0];
}

/** Match a name the AI wrote to a viewer. New names only become viewers if allowed. */
export function viewerFor(raw: unknown, timedOut: Set<string>): Viewer {
  const name = cleanName(raw);
  const list = cast.get().list;
  if (name) {
    const exact = list.find(v => v.name === name) || list.find(v => v.name.toLowerCase() === name.toLowerCase());
    if (exact && !timedOut.has(exact.name)) return exact;
    if (!exact && settings.get().newViewers && list.length < 200) {
      const v: Viewer = { ...randomViewer(name), badge: '', note: 'new here, just found the stream' };
      cast.set({ list: [...list, v] });
      return v;
    }
  }
  return pickViewer(timedOut);
}

// ---------- memory store ----------
const MKEY = 'fc2-memory';
export const memory = createStore<{ notes: MemoryNote[] }>({ notes: storage.read<MemoryNote[]>(MKEY, []) });
memory.subscribe(() => storage.write(MKEY, memory.get().notes));

const memKey = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
export function remember(notes: unknown) {
  if (!settings.get().learn || !Array.isArray(notes)) return;
  const current = memory.get().notes;
  const keys = new Set(current.map(n => memKey(n.t)));
  const added: MemoryNote[] = [];
  for (const raw of notes) {
    const t = String(raw || '').trim().slice(0, 200);
    if (t.length < 4 || keys.has(memKey(t))) continue;
    keys.add(memKey(t));
    added.push({ id: uid(), t });
  }
  if (added.length) memory.set({ notes: [...current, ...added].slice(-50) });
}
