import type { FontId, Look, ThemeId } from './types';

export const FONTS: Record<FontId, { label: string; css: string }> = {
  inter: { label: 'Inter', css: '"Inter Variable", "Inter", system-ui, sans-serif' },
  nunito: { label: 'Nunito (rounded)', css: '"Nunito", system-ui, sans-serif' },
  rubik: { label: 'Rubik', css: '"Rubik Variable", "Rubik", system-ui, sans-serif' },
  space: { label: 'Space Grotesk', css: '"Space Grotesk Variable", "Space Grotesk", system-ui, sans-serif' },
  comic: { label: 'Comic Neue', css: '"Comic Neue", "Comic Sans MS", sans-serif' },
  pixel: { label: 'Arcade pixel', css: '"Press Start 2P", monospace' },
  minecraft: { label: 'Minecraft', css: '"Monocraft", ui-monospace, monospace' },
  mono: { label: 'Monospace', css: 'ui-monospace, Consolas, "Courier New", monospace' },
};

export const DEFAULT_LOOK: Look = {
  theme: 'classic',
  font: 'inter',
  size: 20,
  nameStyle: 'colon',
  avatars: false,
  badges: true,
  textColor: '#ffffff',
  outline: 'shadow',
  bubbleColor: '#000000',
  bubbleOpacity: 0,
  radius: 10,
  panelColor: '#000000',
  panelOpacity: 0,
  align: 'left',
  animation: 'slide',
  max: 14,
  fade: 0,
  fadeTop: true,
  emotes: 'text',
  accent: '#9b6bff',
  showPoll: true,
  gap: 6,
};

// Each theme is a starting point. Everything stays editable after picking one.
export const THEMES: Record<ThemeId, { label: string; blurb: string; look: Partial<Look> }> = {
  classic: {
    label: 'Classic',
    blurb: 'Clean text with a soft shadow, like most stream chats',
    look: { font: 'inter', nameStyle: 'colon', avatars: false, outline: 'shadow', bubbleOpacity: 0, panelOpacity: 0, radius: 10, animation: 'slide', accent: '#9b6bff', textColor: '#ffffff', emotes: 'text', gap: 6 },
  },
  bubbles: {
    label: 'Bubbles',
    blurb: 'Rounded cards with avatars, names on top',
    look: { font: 'nunito', nameStyle: 'stacked', avatars: true, outline: 'none', bubbleColor: '#16122a', bubbleOpacity: 78, panelOpacity: 0, radius: 18, animation: 'pop', accent: '#ff5c8a', textColor: '#ffffff', emotes: 'emoji', gap: 8 },
  },
  minecraft: {
    label: 'Minecraft',
    blurb: 'Blocky font, <name> format, dark bars',
    look: { font: 'minecraft', nameStyle: 'brackets', avatars: false, outline: 'shadow', bubbleColor: '#000000', bubbleOpacity: 45, panelOpacity: 0, radius: 0, animation: 'none', accent: '#ffaa00', textColor: '#ffffff', emotes: 'text', gap: 2 },
  },
  neon: {
    label: 'Neon',
    blurb: 'Glowing names on a dark glassy panel',
    look: { font: 'space', nameStyle: 'colon', avatars: false, outline: 'glow', bubbleOpacity: 0, panelColor: '#0b0420', panelOpacity: 62, radius: 16, animation: 'slide', accent: '#2ef2ff', textColor: '#f2eaff', emotes: 'text', gap: 6 },
  },
  minimal: {
    label: 'Minimal',
    blurb: 'Thin outline text, nothing else',
    look: { font: 'rubik', nameStyle: 'colon', avatars: false, outline: 'outline', bubbleOpacity: 0, panelOpacity: 0, radius: 6, animation: 'fade', accent: '#ffffff', textColor: '#ffffff', emotes: 'text', gap: 4 },
  },
  cozy: {
    label: 'Cozy',
    blurb: 'Warm paper cards, emoji, friendly font',
    look: { font: 'comic', nameStyle: 'stacked', avatars: true, outline: 'none', bubbleColor: '#fff4e3', bubbleOpacity: 94, panelOpacity: 0, radius: 14, animation: 'pop', accent: '#ff8a3d', textColor: '#3a2a1c', emotes: 'emoji', gap: 8 },
  },
};

export const BADGES: Record<string, { icon: string; label: string }> = {
  sub: { icon: '⭐', label: 'Sub' },
  vip: { icon: '💎', label: 'VIP' },
  mod: { icon: '🛡️', label: 'Mod' },
};

export const EMOJI: Record<string, string> = {
  KEKW: '😂', LUL: '🤣', LULW: '🤣', OMEGALUL: '🤣', Pog: '😮', POG: '😮', POGGERS: '😮', PogChamp: '😮',
  Sadge: '😢', monkaS: '😰', Kappa: '😏', o7: '🫡', '<3': '❤️', PepeHands: '😭', Clap: '👏', EZ: '😎', Copium: '🫠',
  catJAM: '🐱', HYPERS: '🤩', W: '🏆', L: '💀',
};

export function hexToRgba(hex: string, alpha: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const n = m ? parseInt(m[1], 16) : 0;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
