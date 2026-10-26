import { useEffect, useReducer } from 'react';
import { emptyOverlay, reduce } from '../lib/feed';
import type { OverlayEvent } from '../lib/types';
import { ChatView, CountView } from './ChatView';

/** What OBS shows. It only listens: the control page sends everything through OBS. */
export function OverlayApp() {
  const [state, dispatch] = useReducer(reduce, undefined, emptyOverlay);
  const view = new URLSearchParams(location.search).get('view') || (location.hash.split('view=')[1] ?? 'chat');

  useEffect(() => {
    const onEvent = (e: Event) => {
      let ev = (e as CustomEvent).detail as OverlayEvent | string;
      if (typeof ev === 'string') { try { ev = JSON.parse(ev); } catch { return; } }
      if (ev && typeof ev === 'object' && 'type' in ev) dispatch(ev);
    };
    window.addEventListener('fakechat', onEvent);
    return () => window.removeEventListener('fakechat', onEvent);
  }, []);

  if (view === 'count') return <CountView state={state} />;
  if (view === 'poll') return <ChatView state={{ ...state, messages: [] }} />;
  return <ChatView state={state} />;
}
