export type Provider = 'none' | 'anthropic' | 'openai';
export type Brain = 'fast' | 'smart' | 'genius';
export type BadgeId = '' | 'sub' | 'vip' | 'mod';

export type ThemeId = 'classic' | 'bubbles' | 'minecraft' | 'neon' | 'minimal' | 'cozy';
export type FontId = 'inter' | 'nunito' | 'rubik' | 'space' | 'comic' | 'pixel' | 'minecraft' | 'mono';

export interface Look {
  theme: ThemeId;
  font: FontId;
  size: number;            // px
  nameStyle: 'colon' | 'brackets' | 'stacked';
  avatars: boolean;
  badges: boolean;
  textColor: string;
  outline: 'shadow' | 'outline' | 'glow' | 'none';
  bubbleColor: string;
  bubbleOpacity: number;   // 0-100
  radius: number;          // px
  panelColor: string;
  panelOpacity: number;    // 0-100
  align: 'left' | 'right';
  animation: 'slide' | 'pop' | 'fade' | 'none';
  max: number;             // lines shown
  fade: number;            // seconds before a message leaves, 0 = never
  fadeTop: boolean;
  emotes: 'text' | 'emoji';
  accent: string;          // alerts, highlights, poll
  showPoll: boolean;
  gap: number;             // px between messages
}

export interface Settings {
  // stream
  streamer: string;
  topic: string;
  about: string;
  vibe: string;
  customVibe: string;
  busy: number;            // 1-5
  replyLength: 'short' | 'mixed' | 'long';
  emoteLevel: number;      // 0-2
  typos: number;           // 0-2
  chatLanguage: string;
  swearing: boolean;
  idle: boolean;
  reactToScreen: boolean;
  screenSensitivity: number; // 1-3
  alerts: boolean;
  alertMinutes: number;    // average minutes between alerts
  viewerCount: number;     // shown on the viewer count widget
  newViewers: boolean;
  learn: boolean;
  gamePacks: string[];     // game knowledge picked by hand
  gamesAuto: boolean;      // also pick it from what you're playing
  customKnowledge: string; // anything else chat should know
  // ai
  provider: Provider;
  apiKey: string;
  brain: Brain;
  model: string;
  baseUrl: string;
  // voice
  micId: string;
  lang: string;
  pauseMs: number;         // how long a pause counts as you finishing a sentence
  sttEngine: 'browser' | 'whisper';
  sttUrl: string;
  sttKey: string;
  sttModel: string;
  vocab: string;           // names and words recognition and chat should know
  showTyped: boolean;      // typed messages show in chat as you
  tts: boolean;
  ttsVol: number;
  ttsRate: number;
  ttsChance: number;       // % of messages read
  ttsNames: boolean;
  // obs
  obsHost: string;
  obsPass: string;
  obsAuto: boolean;
  popBg: string;
  // app
  setupDone: boolean;
  look: Look;
}

export interface Viewer {
  name: string;
  color: string;
  note: string;
  badge: BadgeId;
  chat: 1 | 2 | 3;         // lurker, normal, chatty
}

export interface MemoryNote { id: string; t: string; }

export type MsgKind = 'chat' | 'alert' | 'me' | 'system';
export interface Msg {
  id: string;
  kind: MsgKind;
  user?: string;
  color?: string;
  badge?: BadgeId;
  text: string;
  hl?: boolean;            // mentions the streamer
  at: number;
}

export interface Poll {
  id: string;
  question: string;
  options: string[];
  votes: number[];
  endsAt: number;
  done: boolean;
}

export interface OverlayState {
  messages: Msg[];
  look: Look;
  poll: Poll | null;
  viewerCount: number;
}

export type OverlayEvent =
  | { type: 'msg'; m: Msg }
  | { type: 'look'; look: Look }
  | { type: 'clear' }
  | { type: 'rename'; old: string; new: string; color: string }
  | { type: 'purge'; user: string }
  | { type: 'remove'; id: string }
  | { type: 'poll'; poll: Poll | null }
  | { type: 'count'; n: number }
  | { type: 'sync'; state: OverlayState };
