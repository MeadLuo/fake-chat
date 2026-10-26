import { settings } from '../lib/settings';
import { EMOJI } from '../lib/themes';
import type { Msg } from '../lib/types';
import { hash } from '../lib/viewers';

let queued = 0;
let lastEnd = 0;
const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
const EMOTE_WORDS = new RegExp(`(^|\\s)(${Object.keys(EMOJI).map(k => k.replace(/[<>]/g, '\\$&')).join('|')})(?=\\s|$)`, 'g');

export function voices() {
  return synth ? synth.getVoices().filter(v => v.lang.toLowerCase().startsWith('en')) : [];
}
if (synth) { synth.getVoices(); synth.onvoiceschanged = () => synth.getVoices(); }

/** Read a chat message out loud with that viewer's own voice. */
export function speak(m: Msg) {
  const s = settings.get();
  if (!s.tts || !synth || queued >= 3 || !m.user) return;
  if (Math.random() * 100 > s.ttsChance) return;
  const body = m.text.replace(/@([A-Za-z0-9_]+)/g, '$1').replace(EMOTE_WORDS, ' ')
    .replace(/[^\p{L}\p{N}\s?!.,']/gu, '').replace(/\s+/g, ' ').trim();
  if (!body) return;
  const u = new SpeechSynthesisUtterance((s.ttsNames ? `${m.user.replace(/_/g, ' ')} says ` : '') + body.slice(0, 180));
  const list = voices();
  const h = hash(m.user);
  if (list.length) u.voice = list[h % list.length];
  u.pitch = 0.6 + (h % 9) / 10;
  u.rate = s.ttsRate * (1 + (h % 4) / 12);
  u.volume = s.ttsVol / 100;
  queued++;
  u.onend = u.onerror = () => { queued = Math.max(0, queued - 1); lastEnd = Date.now(); };
  synth.speak(u);
}

export function stopSpeaking() { synth?.cancel(); queued = 0; }

/** True while a chat voice is talking (or just stopped), so the mic can ignore it. */
export const ttsTalking = () => !!synth && (synth.speaking || Date.now() - lastEnd < 700);

settings.subscribe(() => { if (!settings.get().tts && queued) stopSpeaking(); });
