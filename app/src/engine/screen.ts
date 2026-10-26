import { settings } from '../lib/settings';
import { createStore } from '../lib/store';
import { every } from '../lib/timers';

export const screen = createStore({ sharing: false, error: '', stream: null as MediaStream | null });

const video = document.createElement('video');
video.muted = true;
video.playsInline = true;
const canvas = document.createElement('canvas');
const small = document.createElement('canvas');
small.width = 64; small.height = 36;
let prev: Uint8ClampedArray | null = null;
let stopLoop: (() => void) | null = null;
const listeners = new Set<() => void>();

export function onScreenChange(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn); }

export async function shareScreen() {
  screen.set({ error: '' });
  if (!navigator.mediaDevices?.getDisplayMedia) {
    screen.set({ error: "This browser can't share your screen. Use Chrome or Edge." });
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false });
    video.srcObject = stream;
    await video.play().catch(() => {});
    stream.getVideoTracks()[0].addEventListener('ended', stopScreen);
    screen.set({ sharing: true, stream });
    prev = null;
    stopLoop = every(checkChange, 1500);
  } catch (e) {
    if ((e as Error).name !== 'NotAllowedError') screen.set({ error: 'Could not share your screen: ' + (e as Error).message });
  }
}

export function stopScreen() {
  screen.get().stream?.getTracks().forEach(t => t.stop());
  video.srcObject = null;
  stopLoop?.(); stopLoop = null;
  prev = null;
  screen.set({ sharing: false, stream: null });
}

/** The current screen as a base64 JPEG (max 1024px wide), or null when not sharing. */
export function grabScreen(): string | null {
  if (!screen.get().sharing || !video.videoWidth) return null;
  const scale = Math.min(1, 1024 / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
}

// Compare tiny greyscale frames. A big jump (death screen, new area, menu) tells chat to look.
function checkChange() {
  if (!video.videoWidth) return;
  const ctx = small.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(video, 0, 0, small.width, small.height);
  const px = ctx.getImageData(0, 0, small.width, small.height).data;
  const grey = new Uint8ClampedArray(px.length / 4);
  for (let i = 0; i < grey.length; i++) grey[i] = (px[i * 4] * 3 + px[i * 4 + 1] * 6 + px[i * 4 + 2]) / 10;
  if (prev) {
    let diff = 0;
    for (let i = 0; i < grey.length; i++) diff += Math.abs(grey[i] - prev[i]);
    const change = diff / grey.length / 255;
    const threshold = [0, 0.2, 0.12, 0.07][settings.get().screenSensitivity] || 0.12;
    if (change > threshold) listeners.forEach(fn => fn());
  }
  prev = grey;
}
