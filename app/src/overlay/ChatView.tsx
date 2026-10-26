import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { BADGES, EMOJI, FONTS, hexToRgba } from '../lib/themes';
import type { Look, Msg, OverlayState, Poll } from '../lib/types';

const EMOTE_RE = new RegExp(`(^|\\s)(${Object.keys(EMOJI).map(k => k.replace(/[<>]/g, '\\$&')).join('|')})(?=\\s|$|[!?.,])`, 'g');

function renderText(text: string, look: Look): ReactNode[] {
  const t = look.emotes === 'emoji' ? text.replace(EMOTE_RE, (_, pre, word) => pre + EMOJI[word]) : text;
  return t.split(/(@[A-Za-z0-9_]+)/).filter(Boolean).map((part, i) =>
    part[0] === '@' ? <span key={i} className="fc-at">{part}</span> : <span key={i}>{part}</span>);
}

function Avatar({ m }: { m: Msg }) {
  return <span className="fc-avatar" style={{ background: m.color }} aria-hidden>{(m.user || '?')[0].toUpperCase()}</span>;
}

function Name({ m, look }: { m: Msg; look: Look }) {
  const badge = look.badges && m.badge && BADGES[m.badge] ? <span className="fc-badge" title={BADGES[m.badge].label}>{BADGES[m.badge].icon}</span> : null;
  const me = m.kind === 'me' ? <span className="fc-badge" title="Streamer">🎙️</span> : null;
  const name = <span className="fc-name" style={{ color: m.color }}>{m.user}</span>;
  if (look.nameStyle === 'brackets') return <>{me}{badge}{'<'}{name}{'> '}</>;
  if (look.nameStyle === 'stacked') return <span className="fc-head">{me}{badge}{name}</span>;
  return <>{me}{badge}{name}<span className="fc-colon">: </span></>;
}

export function Message({ m, look, leaving, onClick }: { m: Msg; look: Look; leaving?: boolean; onClick?: (m: Msg) => void }) {
  const cls = ['fc-msg', `fc-${m.kind}`, m.hl ? 'fc-hl' : '', leaving ? 'fc-leaving' : '', onClick && m.kind === 'chat' ? 'fc-clickable' : ''].filter(Boolean).join(' ');
  const click = onClick && (m.kind === 'chat' || m.kind === 'me') ? () => onClick(m) : undefined;
  if (m.kind === 'alert' || m.kind === 'system') {
    return <div className={cls}><span className="fc-body">{m.text}</span></div>;
  }
  const stacked = look.nameStyle === 'stacked';
  return (
    <div className={cls} onClick={click} role={click ? 'button' : undefined} tabIndex={click ? 0 : undefined}
      onKeyDown={click ? e => { if (e.key === 'Enter') click(); } : undefined}>
      {look.avatars && <Avatar m={m} />}
      <div className="fc-content">
        {stacked ? <><Name m={m} look={look} /><span className="fc-body">{renderText(m.text, look)}</span></>
          : <span className="fc-body"><Name m={m} look={look} />{renderText(m.text, look)}</span>}
      </div>
    </div>
  );
}

function PollCard({ poll, now }: { poll: Poll; now: number }) {
  const total = poll.votes.reduce((a, b) => a + b, 0);
  const max = Math.max(...poll.votes);
  const left = Math.max(0, Math.ceil((poll.endsAt - now) / 1000));
  return (
    <div className={`fc-poll ${poll.done ? 'fc-poll-done' : ''}`}>
      <div className="fc-poll-q">{poll.question}</div>
      {poll.options.map((o, i) => {
        const pct = total ? Math.round((poll.votes[i] / total) * 100) : 0;
        const win = poll.done && poll.votes[i] === max && max > 0;
        return (
          <div key={i} className={`fc-poll-opt ${win ? 'fc-win' : ''}`}>
            <div className="fc-poll-bar" style={{ width: pct + '%' }} />
            <span className="fc-poll-label">{win ? '🏆 ' : ''}{o}</span>
            <span className="fc-poll-pct">{pct}%</span>
          </div>
        );
      })}
      <div className="fc-poll-foot">{poll.done ? `Poll closed with ${total} votes` : `${total} votes, ${left}s left`}</div>
    </div>
  );
}

/** solid: for a green screen window. Anything see-through would mix with the key colour, so it's drawn solid instead. */
export function lookVars(look: Look, solid = false): CSSProperties {
  const a = (pct: number) => (solid ? (pct > 0 ? 1 : 0) : pct / 100);
  return {
    '--fc-font': FONTS[look.font]?.css || FONTS.inter.css,
    '--fc-size': look.size + 'px',
    '--fc-text': look.textColor,
    '--fc-bubble': hexToRgba(look.bubbleColor, a(look.bubbleOpacity)),
    '--fc-panel': hexToRgba(look.panelColor, a(look.panelOpacity)),
    '--fc-radius': look.radius + 'px',
    '--fc-accent': look.accent,
    '--fc-accent-soft': hexToRgba(look.accent, 0.22),
    '--fc-gap': look.gap + 'px',
  } as CSSProperties;
}

/** The chat as it appears on stream. */
export function ChatView({ state, onMessageClick, className = '', solid = false }: { state: OverlayState; onMessageClick?: (m: Msg) => void; className?: string; solid?: boolean }) {
  const { look } = state;
  const [now, setNow] = useState(Date.now());
  const ticking = look.fade > 0 || (state.poll && !state.poll.done);
  useEffect(() => {
    if (!ticking) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [ticking]);

  const life = look.fade * 1000;
  // solid mode skips the fade-out: a half-faded message would turn green
  const visible = state.messages.filter(m => !life || now - m.at < life + (solid ? 0 : 700)).slice(-look.max);
  const cls = [
    'fc-root', className, `fc-anim-${look.animation}`, `fc-outline-${look.outline}`, `fc-names-${look.nameStyle}`,
    look.align === 'right' ? 'fc-right' : '', look.fadeTop && !solid ? 'fc-fadetop' : '', solid ? 'fc-solid' : '',
    look.bubbleOpacity > 0 ? 'fc-bubbled' : '', look.avatars ? 'fc-has-avatars' : '', look.font === 'minecraft' || look.font === 'pixel' ? 'fc-pixel' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} style={lookVars(look, solid)}>
      {look.showPoll && state.poll && <PollCard poll={state.poll} now={now} />}
      <div className="fc-list">
        {visible.map(m => <Message key={m.id} m={m} look={look} leaving={!!life && now - m.at > life} onClick={onMessageClick} />)}
      </div>
    </div>
  );
}

export function CountView({ state }: { state: OverlayState }) {
  return (
    <div className="fc-count" style={lookVars(state.look)}>
      <span className="fc-live-dot" /> {state.viewerCount.toLocaleString()} watching
    </div>
  );
}
