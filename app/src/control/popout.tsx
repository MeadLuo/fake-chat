import { useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { feed } from '../lib/feed';
import { settings } from '../lib/settings';
import { useStore } from '../lib/store';
import { ChatView } from '../overlay/ChatView';

let win: Window | null = null;
let root: Root | null = null;

function PopChat() {
  const state = useStore(feed, s => s);
  const bg = useStore(settings, s => s.popBg);
  useEffect(() => { if (win) win.document.body.style.background = bg; }, [bg]);
  return <ChatView state={state} solid />;
}

/** Opens the chat in its own window, for Window Capture + chroma key in OBS. */
export function openPopout(): string | null {
  if (window.self !== window.top) return "Windows can't open from a preview. Open the site in its own Chrome tab.";
  if (win && !win.closed) { win.focus(); return null; }
  win = window.open('', 'fakechat-popout', 'popup,width=440,height=720');
  if (!win) return 'Chrome blocked the window. Click the blocked popup icon at the right of the address bar, choose Always allow, and try again.';
  const doc = win.document;
  doc.open();
  doc.write('<!doctype html><html><head><meta charset="utf-8"><title>Fake Chat for OBS</title></head><body style="margin:0;height:100vh;overflow:hidden"><div id="pop" style="position:fixed;inset:0"></div></body></html>');
  doc.close();
  // bring over the page's styles and fonts, and draw once they've loaded
  const loading: Promise<unknown>[] = [];
  document.querySelectorAll('link[rel="stylesheet"], style').forEach(el => {
    const copy = doc.importNode(el, true) as HTMLElement;
    if (el instanceof HTMLLinkElement) {
      (copy as HTMLLinkElement).href = el.href;
      loading.push(new Promise(r => { copy.addEventListener('load', r); copy.addEventListener('error', r); }));
    }
    doc.head.append(copy);
  });
  const target = win;
  const draw = () => {
    if (win !== target || root) return;
    root = createRoot(doc.getElementById('pop')!);
    root.render(<PopChat />);
  };
  void Promise.race([Promise.all(loading), new Promise(r => setTimeout(r, 2500))]).then(draw);
  win.addEventListener('beforeunload', () => { root?.unmount(); root = null; win = null; });
  return null;
}

export const popoutOpen = () => !!win && !win.closed;
