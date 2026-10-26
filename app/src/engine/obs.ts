import { addSender, feed } from '../lib/feed';
import { settings } from '../lib/settings';
import { createStore } from '../lib/store';
import { every, later } from '../lib/timers';
import type { OverlayEvent } from '../lib/types';

// Talks to the WebSocket server built into OBS 28+, and passes chat to
// every Browser source through obs-browser's "emit_event" request.
type Status = 'off' | 'connecting' | 'connected' | 'error';
export const obs = createStore({ status: 'off' as Status, error: '', sent: 0 });

let ws: WebSocket | null = null;
let want = false;
let ready = false;
let reqId = 0;
let lastSync = 0;

async function sha256b64(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export function connect() {
  want = true;
  open();
}

function open() {
  if (!want) return;
  try { if (ws) { ws.onclose = null; ws.close(); } } catch { /* ignore */ }
  ready = false;
  obs.set({ status: 'connecting', error: '' });
  const host = (settings.get().obsHost || '127.0.0.1:4455').replace(/^wss?:\/\//, '').replace(/\/+$/, '');
  try {
    ws = new WebSocket('ws://' + host, 'obswebsocket.json');
  } catch {
    want = false;
    obs.set({ status: 'error', error: "That address doesn't look right. It's usually 127.0.0.1:4455." });
    return;
  }
  ws.onmessage = async e => {
    let msg: any;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (msg.op === 0) { // Hello
      const d: any = { rpcVersion: 1, eventSubscriptions: 0 };
      const auth = msg.d?.authentication;
      if (auth) {
        const pass = settings.get().obsPass;
        if (!pass) {
          want = false;
          obs.set({ status: 'error', error: 'OBS wants a password. In OBS open Tools, WebSocket Server Settings, Show Connect Info, and copy it here.' });
          ws?.close();
          return;
        }
        d.authentication = await sha256b64((await sha256b64(pass + auth.salt)) + auth.challenge);
      }
      ws?.send(JSON.stringify({ op: 1, d }));
    } else if (msg.op === 2) { // Identified
      ready = true;
      obs.set({ status: 'connected', error: '' });
      sync();
    } else if (msg.op === 7) {
      const r = msg.d?.requestStatus;
      if (r && !r.result) obs.set({ error: `OBS said: ${r.comment || 'error ' + r.code}. Make sure you added a Browser source.` });
    }
  };
  ws.onclose = e => {
    ready = false;
    if (e.code === 4009) {
      want = false;
      obs.set({ status: 'error', error: 'Wrong OBS password. Copy it again from Show Connect Info.' });
      return;
    }
    if (!want) { obs.set({ status: 'off' }); return; }
    obs.set({
      status: 'connecting',
      error: e.code === 1006 ? "Can't reach OBS. Is it open, with Enable ticked in Tools, WebSocket Server Settings? Retrying..." : 'Lost OBS. Retrying...',
    });
    later(open, 3000);
  };
}

export function disconnect() {
  want = false;
  ready = false;
  try { ws?.close(); } catch { /* ignore */ }
  obs.set({ status: 'off', error: '' });
}

function send(ev: OverlayEvent) {
  if (!ready || !ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({
    op: 6,
    d: {
      requestType: 'CallVendorRequest',
      requestId: String(++reqId),
      requestData: { vendorName: 'obs-browser', requestType: 'emit_event', requestData: { event_name: 'fakechat', event_data: ev } },
    },
  }));
  obs.set(o => ({ sent: o.sent + 1 }));
}

/** Send the whole overlay state, so a freshly loaded OBS source catches up. */
export function sync() {
  lastSync = Date.now();
  const s = feed.get();
  send({ type: 'sync', state: { ...s, messages: s.messages.slice(-s.look.max - 4) } });
}

export const isConnected = () => ready;

addSender(send);
// catch up any OBS source that was reloaded or added
every(() => { if (ready && Date.now() - lastSync > 8000) sync(); }, 4000);
