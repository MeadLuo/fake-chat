import { createStore, storage } from './store';
import { DEFAULT_LOOK } from './themes';
import type { Brain, Settings } from './types';

export const VIBES: Record<string, { label: string; prompt: string }> = {
  hype: { label: 'Hype', prompt: 'high energy, caps, emotes and hype, very supportive' },
  chill: { label: 'Chill', prompt: 'relaxed and friendly, mostly lowercase, cozy small-stream energy' },
  wholesome: { label: 'Wholesome', prompt: 'kind and encouraging, compliments, asks nice questions' },
  roast: { label: 'Roast', prompt: 'playful teasing and banter, never mean-spirited or personal' },
  chaos: { label: 'Chaos', prompt: 'unhinged meme chat, random jokes, emote spam, but still reacting' },
  tryhard: { label: 'Tryhard', prompt: 'competitive gamers who analyse every play, give strats and critique decisions' },
  custom: { label: 'Custom', prompt: '' },
};

export const BRAINS: Record<Brain, { model: string; label: string; note: string }> = {
  fast: { model: 'claude-haiku-5-5', label: 'Fast', note: 'Haiku. Quickest and cheapest.' },
  smart: { model: 'claude-sonnet-5-5', label: 'Smart', note: 'Sonnet. Sharp and funny, a good default.' },
  genius: { model: 'claude-opus-5-5', label: 'Genius', note: 'Opus. The smartest, slower and pricier.' },
};

export const DEFAULT_SETTINGS: Settings = {
  streamer: '', topic: '', about: '',
  vibe: 'hype', customVibe: '',
  busy: 3, replyLength: 'mixed', emoteLevel: 1, typos: 1, chatLanguage: 'English', swearing: false,
  idle: true, reactToScreen: true, screenSensitivity: 2,
  alerts: true, alertMinutes: 4, viewerCount: 42, newViewers: false, learn: true,
  provider: 'none', apiKey: '', brain: 'smart', model: '', baseUrl: '',
  micId: '', lang: '', pauseMs: 1100, showTyped: true,
  sttEngine: 'browser', sttUrl: 'https://api.groq.com/openai/v1', sttKey: '', sttModel: 'whisper-large-v3-turbo', vocab: '',
  tts: false, ttsVol: 80, ttsRate: 1, ttsChance: 60, ttsNames: false,
  obsHost: '127.0.0.1:4455', obsPass: '', obsAuto: true, popBg: '#00ff00',
  setupDone: false,
  look: DEFAULT_LOOK,
};

const KEY = 'fc2-settings';

function load(): Settings {
  const saved = storage.read<Partial<Settings>>(KEY, {});
  return { ...DEFAULT_SETTINGS, ...saved, look: { ...DEFAULT_LOOK, ...(saved.look || {}) } };
}

export const settings = createStore<Settings>(load());
settings.subscribe(() => storage.write(KEY, settings.get()));

export function setLook(patch: Partial<Settings['look']>) {
  settings.set(s => ({ look: { ...s.look, ...patch } }));
}

export function modelName(s = settings.get()) {
  if (s.provider === 'anthropic') return BRAINS[s.brain]?.model || BRAINS.smart.model;
  return s.model || 'gpt-4o-mini';
}

export function aiReady(s = settings.get()) {
  if (s.provider === 'anthropic') return !!s.apiKey;
  if (s.provider === 'openai') return !!(s.apiKey || (s.baseUrl && !s.baseUrl.includes('api.openai.com')));
  return false;
}
