import { createStore } from './store';
import { DEFAULT_LOOK } from './themes';
import type { OverlayEvent, OverlayState } from './types';

export const KEEP = 60; // messages kept in memory for the overlay

/** How every overlay (preview, pop-out, OBS) turns an event into new state. */
export function reduce(s: OverlayState, ev: OverlayEvent): OverlayState {
  switch (ev.type) {
    case 'msg': return { ...s, messages: [...s.messages, ev.m].slice(-KEEP) };
    case 'look': return { ...s, look: { ...DEFAULT_LOOK, ...ev.look } };
    case 'clear': return { ...s, messages: [] };
    case 'rename': return {
      ...s,
      messages: s.messages.map(m => (m.user === ev.old ? { ...m, user: ev.new, color: ev.color } : m)),
    };
    case 'purge': return { ...s, messages: s.messages.filter(m => m.user !== ev.user) };
    case 'remove': return { ...s, messages: s.messages.filter(m => m.id !== ev.id) };
    case 'poll': return { ...s, poll: ev.poll };
    case 'count': return { ...s, viewerCount: ev.n };
    case 'sync': return { ...ev.state, look: { ...DEFAULT_LOOK, ...ev.state.look } };
    default: return s;
  }
}

export const emptyOverlay = (): OverlayState => ({ messages: [], look: DEFAULT_LOOK, poll: null, viewerCount: 0 });

// The control page's own copy (drives the preview and the pop-out window)
export const feed = createStore<OverlayState>(emptyOverlay());

type Sender = (ev: OverlayEvent) => void;
const senders = new Set<Sender>();
/** Something else that wants every event too, like the OBS link. */
export function addSender(fn: Sender) { senders.add(fn); return () => senders.delete(fn); }

export function emit(ev: OverlayEvent) {
  feed.set(s => reduce(s, ev));
  senders.forEach(fn => { try { fn(ev); } catch { /* keep going */ } });
}
