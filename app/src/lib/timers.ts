// Timers that keep running when this tab is in the background.
// Chrome heavily slows normal timers in hidden tabs, but not inside a worker.
type Fn = () => void;

const worker: Worker | null = (() => {
  try {
    const src = `const t = new Map();
onmessage = e => {
  const d = e.data;
  if (d.cancel) { clearTimeout(t.get(d.id)); t.delete(d.id); return; }
  t.set(d.id, setTimeout(() => { t.delete(d.id); postMessage(d.id); }, d.ms));
};`;
    return new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  } catch { return null; }
})();

const waiting = new Map<number, Fn>();
let n = 0;
if (worker) worker.onmessage = e => { const fn = waiting.get(e.data); waiting.delete(e.data); fn?.(); };

/** Like setTimeout, but not slowed down in background tabs. Returns a cancel function. */
export function later(fn: Fn, ms: number): Fn {
  if (!worker) { const t = setTimeout(fn, ms); return () => clearTimeout(t); }
  const id = ++n;
  waiting.set(id, fn);
  worker.postMessage({ id, ms: Math.max(0, ms) });
  return () => { waiting.delete(id); worker.postMessage({ id, cancel: true }); };
}

/** Repeats fn every ms until the returned function is called. */
export function every(fn: Fn, ms: number): Fn {
  let stop = false;
  let cancel: Fn = () => {};
  const tick = () => { if (stop) return; fn(); cancel = later(tick, ms); };
  cancel = later(tick, ms);
  return () => { stop = true; cancel(); };
}
