import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BarChart3, Ban, Clock, Eraser, ExternalLink, MessageSquareReply, MonitorUp, MonitorX, PartyPopper, Send, Trash2, UserRound, X } from 'lucide-react';
import { clearChat, closePoll, endPoll, fireAlert, live, removeMessage, sayAs, startPoll, streamerSaid, timeout, type AlertType } from '../../engine/chat';
import { mic, micLevel, start as startMic, stop as stopMic } from '../../engine/speech';
import { screen, shareScreen, stopScreen } from '../../engine/screen';
import { obs } from '../../engine/obs';
import { usage } from '../../engine/ai';
import { feed } from '../../lib/feed';
import { VIBES, aiReady, settings } from '../../lib/settings';
import { useStore } from '../../lib/store';
import { cast } from '../../lib/viewers';
import type { Msg } from '../../lib/types';
import { ChatView } from '../../overlay/ChatView';
import { openPopout } from '../popout';
import { BgPicker, Notice, Slider, Status } from '../ui';
import type { PageProps } from '../App';

export function LivePage({ go }: PageProps) {
  const state = useStore(feed, s => s);
  const [selected, setSelected] = useState<Msg | null>(null);
  const popBg = useStore(settings, s => s.popBg);
  const [pop, setPop] = useState<{ tone: 'bad' | 'info'; text: ReactNode } | null>(null);
  const sayRef = useRef<HTMLInputElement>(null);
  const popOut = () => {
    const err = openPopout();
    setPop(err ? { tone: 'bad', text: err } : {
      tone: 'info',
      text: <>The background colour is meant to disappear. Change it with the swatch next to Pop out. In OBS, add a <b>Window Capture</b> of that window, then right click it, <b>Filters</b>, and add <b>Chroma Key</b> set to the same colour. Boxes are drawn solid there so they key cleanly. For see-through boxes, use <button className="link" onClick={() => go('obs')}>Connect to OBS</button> instead.</>,
    });
  };

  return (
    <div className="live">
      <section className="stage" aria-label="Chat preview">
        <header className="stage-bar">
          <StatusRow go={go} />
          <div className="stage-tools">
            <div className="pop-group">
              <BgPicker compact value={popBg} onChange={v => settings.set({ popBg: v })} />
              <button className="btn ghost sm" onClick={popOut} title="Open the chat in its own window">
                <ExternalLink size={15} /> Pop out
              </button>
            </div>
            <button className="btn ghost sm" onClick={clearChat} title="Clear the chat">
              <Eraser size={15} /> Clear
            </button>
          </div>
        </header>
        {pop && <Notice tone={pop.tone} action={<button className="icon-btn" onClick={() => setPop(null)} aria-label="Dismiss"><X size={16} /></button>}>{pop.text}</Notice>}
        <div className="stage-screen">
          {state.messages.length === 0 && !state.poll && (
            <div className="stage-empty">
              <p>Chat shows up here, exactly like it will on stream.</p>
              <p className="dim">Start listening and say hi, or type something below.</p>
            </div>
          )}
          <ChatView state={state} onMessageClick={setSelected} />
        </div>
        {selected && <MessageActions m={selected} onClose={() => setSelected(null)} onReply={name => {
          setSelected(null);
          if (sayRef.current) { sayRef.current.value = `@${name} `; sayRef.current.focus(); }
        }} />}
      </section>

      <section className="you" aria-label="You">
        <MicOrb />
        <Transcript />
        <TypeBox inputRef={sayRef} />
        <Quick />
        <Actions />
      </section>
    </div>
  );
}

// ---------- status ----------
function StatusRow({ go }: PageProps) {
  const ready = useStore(settings, s => aiReady(s));
  const thinking = useStore(live, s => s.thinking);
  const err = useStore(live, s => s.error);
  const obsStatus = useStore(obs, s => s.status);
  const count = useStore(feed, s => s.viewerCount);
  const sharing = useStore(screen, s => s.sharing);
  const lastMs = useStore(usage, s => s.lastMs);
  return (
    <div className="status-row">
      <button className="status-btn" onClick={() => go('ai')} title={err || undefined}>
        {!ready ? <Status tone="off">Offline chat</Status>
          : err ? <Status tone="bad">AI problem</Status>
          : thinking ? <Status tone="busy">Chat is typing</Status>
          : <Status tone="good">AI ready{lastMs >= 100 ? `, ${(lastMs / 1000).toFixed(1)}s` : ''}</Status>}
      </button>
      <button className="status-btn" onClick={() => go('obs')}>
        <Status tone={obsStatus === 'connected' ? 'good' : obsStatus === 'error' ? 'bad' : obsStatus === 'connecting' ? 'busy' : 'off'}>
          {obsStatus === 'connected' ? 'In OBS' : obsStatus === 'connecting' ? 'Finding OBS' : 'Not in OBS'}
        </Status>
      </button>
      {sharing && <Status tone="good">Chat sees your screen</Status>}
      <span className="viewer-count"><i aria-hidden />{count.toLocaleString()} watching</span>
    </div>
  );
}

// ---------- the mic ----------
function MicOrb() {
  const status = useStore(mic, s => s.status);
  const error = useStore(mic, s => s.error);
  const browserSR = useStore(mic, s => s.supported);
  const whisperOn = useStore(settings, s => s.sttEngine === 'whisper');
  const supported = browserSR || whisperOn;
  const ref = useRef<HTMLButtonElement>(null);
  const on = status === 'listening' || status === 'starting';

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      ref.current?.style.setProperty('--lvl', micLevel().toFixed(3));
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  const label = !supported ? 'Voice needs Chrome' : status === 'starting' ? 'Starting the mic' : on ? 'Listening' : 'Start listening';
  return (
    <div className="orb-wrap">
      <button ref={ref} className={`orb ${on ? 'on' : ''} ${status === 'error' ? 'err' : ''}`} disabled={!supported}
        onClick={() => (on ? stopMic() : void startMic())} aria-pressed={on} aria-label={on ? 'Stop listening' : 'Start listening'}>
        <span className="orb-ring" aria-hidden />
        <span className="orb-ring two" aria-hidden />
        <span className="orb-core">
          <svg viewBox="0 0 24 24" width="44" height="44" aria-hidden><path fill="currentColor" d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 0 0-7 0v6A3.5 3.5 0 0 0 12 15Zm6-3.6a1 1 0 1 0-2 .2 4 4 0 0 1-8 0 1 1 0 1 0-2-.2 6 6 0 0 0 5 5.9V20H8.5a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2H13v-2.7a6 6 0 0 0 5-5.9Z" /></svg>
        </span>
      </button>
      <div className="orb-text">
        <strong>{label}</strong>
        <span>{on ? `Tap to stop. ${whisperOn ? 'Whisper' : 'Chrome'} is listening.` : 'Chat reacts to what you say out loud.'}</span>
      </div>
      {error && <Notice tone="bad">{error}</Notice>}
    </div>
  );
}

function Transcript() {
  const heard = useStore(live, s => s.heard);
  const interim = useStore(mic, s => s.interim);
  const last = heard.slice(-4);
  return (
    <div className="transcript" aria-live="polite">
      {last.length === 0 && !interim && <p className="dim">What you say shows up here.</p>}
      {last.map(h => <p key={h.id} className={h.typed ? 'typed' : ''}>{h.text}</p>)}
      {interim && <p className="interim">{interim}</p>}
    </div>
  );
}

function TypeBox({ inputRef }: { inputRef: React.RefObject<HTMLInputElement> }) {
  const send = () => {
    const el = inputRef.current;
    if (!el || !el.value.trim()) return;
    streamerSaid(el.value, true);
    el.value = '';
  };
  return (
    <form className="typebox" onSubmit={e => { e.preventDefault(); send(); }}>
      <input ref={inputRef} className="input" placeholder="Type to chat" aria-label="Type to chat" />
      <button className="btn primary" type="submit" aria-label="Send"><Send size={17} /></button>
    </form>
  );
}

// ---------- quick controls ----------
function Quick() {
  const vibe = useStore(settings, s => s.vibe);
  const busy = useStore(settings, s => s.busy);
  return (
    <div className="quick">
      <div className="chips" role="radiogroup" aria-label="Chat vibe">
        {Object.entries(VIBES).filter(([k]) => k !== 'custom' || settings.get().customVibe).map(([k, v]) => (
          <button key={k} role="radio" aria-checked={vibe === k} className={`chip ${vibe === k ? 'on' : ''}`} onClick={() => settings.set({ vibe: k })}>{v.label}</button>
        ))}
      </div>
      <div className="busy">
        <label htmlFor="busy">How busy chat is</label>
        <Slider id="busy" value={busy} min={1} max={5} onChange={v => settings.set({ busy: v })}
          format={v => ['', 'Tiny', 'Small', 'Medium', 'Busy', 'Packed'][v]} />
      </div>
    </div>
  );
}

function Actions() {
  const [open, setOpen] = useState<'' | 'alert' | 'poll'>('');
  const sharing = useStore(screen, s => s.sharing);
  const screenErr = useStore(screen, s => s.error);
  const stream = useStore(screen, s => s.stream);
  const poll = useStore(feed, s => s.poll);
  const vid = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (vid.current) vid.current.srcObject = stream; }, [stream]);

  return (
    <div className="actions">
      <div className="action-row">
        <button className={`btn tile ${sharing ? 'active' : ''}`} onClick={() => (sharing ? stopScreen() : void shareScreen())}>
          {sharing ? <MonitorX size={20} /> : <MonitorUp size={20} />}
          <span>{sharing ? 'Stop sharing' : 'Share screen'}</span>
        </button>
        <button className={`btn tile ${open === 'alert' ? 'active' : ''}`} onClick={() => setOpen(open === 'alert' ? '' : 'alert')} aria-expanded={open === 'alert'}>
          <PartyPopper size={20} /><span>Alert</span>
        </button>
        <button className={`btn tile ${open === 'poll' || poll ? 'active' : ''}`} onClick={() => setOpen(open === 'poll' ? '' : 'poll')} aria-expanded={open === 'poll'}>
          <BarChart3 size={20} /><span>{poll && !poll.done ? 'Poll running' : 'Poll'}</span>
        </button>
      </div>
      {screenErr && <Notice tone="bad">{screenErr}</Notice>}
      {sharing && <video ref={vid} className="screen-thumb" muted playsInline autoPlay />}
      {open === 'alert' && (
        <div className="drawer">
          <p className="drawer-title">Fire a fake alert. Chat reacts to it.</p>
          <div className="chips">
            {([['sub', '⭐ Sub'], ['follow', '💜 Follow'], ['gift', '🎁 Gift subs'], ['bits', '💎 Bits'], ['raid', '🚀 Raid']] as [AlertType, string][]).map(([t, l]) => (
              <button key={t} className="chip" onClick={() => fireAlert(t)}>{l}</button>
            ))}
          </div>
        </div>
      )}
      {open === 'poll' && <PollDrawer />}
      <SayAs />
    </div>
  );
}

function PollDrawer() {
  const poll = useStore(feed, s => s.poll);
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState(['', '']);
  const [secs, setSecs] = useState(60);
  if (poll) {
    return (
      <div className="drawer">
        <p className="drawer-title">{poll.done ? 'Poll finished' : 'Poll running'}: {poll.question}</p>
        <div className="row">
          {!poll.done && <button className="btn" onClick={endPoll}>End it now</button>}
          <button className="btn ghost" onClick={closePoll}>Hide poll</button>
        </div>
      </div>
    );
  }
  return (
    <form className="drawer" onSubmit={e => { e.preventDefault(); startPoll(q, opts, secs); }}>
      <input className="input" placeholder="Question, like: Which boss next?" value={q} onChange={e => setQ(e.target.value)} aria-label="Poll question" />
      {opts.map((o, i) => (
        <input key={i} className="input" placeholder={`Option ${i + 1}`} value={o} aria-label={`Option ${i + 1}`}
          onChange={e => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} />
      ))}
      <div className="row">
        {opts.length < 5 && <button type="button" className="btn ghost sm" onClick={() => setOpts([...opts, ''])}>Add option</button>}
        <select className="input sm" value={secs} onChange={e => setSecs(Number(e.target.value))} aria-label="Poll length">
          <option value={30}>30 seconds</option><option value={60}>1 minute</option><option value={120}>2 minutes</option><option value={300}>5 minutes</option>
        </select>
        <button className="btn primary" disabled={!q.trim() || opts.filter(o => o.trim()).length < 2}>Start poll</button>
      </div>
    </form>
  );
}

function SayAs() {
  const list = useStore(cast, s => s.list);
  const [who, setWho] = useState('');
  const [text, setText] = useState('');
  const name = who || list[0]?.name || '';
  return (
    <details className="sayas">
      <summary><UserRound size={16} /> Make a viewer say something</summary>
      <form className="row" onSubmit={e => { e.preventDefault(); sayAs(name, text); setText(''); }}>
        <select className="input sm" value={name} onChange={e => setWho(e.target.value)} aria-label="Viewer">
          {list.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
        </select>
        <input className="input" value={text} onChange={e => setText(e.target.value)} placeholder="Their message" aria-label="Their message" />
        <button className="btn" disabled={!text.trim()}>Send</button>
      </form>
    </details>
  );
}

// ---------- clicking a message ----------
function MessageActions({ m, onClose, onReply }: { m: Msg; onClose: () => void; onReply: (name: string) => void }) {
  const isMe = m.kind === 'me';
  return (
    <div className="msg-actions" role="dialog" aria-label={`Actions for ${m.user}`}>
      <div className="msg-actions-head">
        <span><strong style={{ color: m.color }}>{m.user}</strong> {m.text}</span>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </div>
      <div className="row wrap">
        {!isMe && <button className="btn sm" onClick={() => onReply(m.user!)}><MessageSquareReply size={15} /> Reply</button>}
        {!isMe && <button className="btn sm" onClick={() => { timeout(m.user!, 60); onClose(); }}><Clock size={15} /> Timeout 1 min</button>}
        {!isMe && <button className="btn sm" onClick={() => { timeout(m.user!, 600); onClose(); }}><Clock size={15} /> 10 min</button>}
        {!isMe && <button className="btn sm danger" onClick={() => { timeout(m.user!, Infinity); onClose(); }}><Ban size={15} /> Ban</button>}
        <button className="btn sm ghost" onClick={() => { removeMessage(m.id); onClose(); }}><Trash2 size={15} /> Delete message</button>
      </div>
    </div>
  );
}
