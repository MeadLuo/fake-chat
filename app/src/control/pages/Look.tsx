import { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { feed } from '../../lib/feed';
import { setLook, settings } from '../../lib/settings';
import { useStore } from '../../lib/store';
import { DEFAULT_LOOK, FONTS, THEMES } from '../../lib/themes';
import { cast } from '../../lib/viewers';
import type { FontId, Look, Msg, OverlayState, ThemeId } from '../../lib/types';
import { ChatView } from '../../overlay/ChatView';
import { ColorInput, Field, Group, Page, Segmented, Select, Slider, Toggle } from '../ui';

const SAMPLE = ['LETS GOOO that was clean', '@{1} nah he got lucky KEKW', 'chat is this the boss everyone talks about', 'W stream <3', 'what keybinds do you use?', 'Pog'];

function useSample(look: Look): OverlayState {
  const state = useStore(feed, s => s);
  const list = useStore(cast, s => s.list);
  const streamer = useStore(settings, s => s.streamer);
  return useMemo(() => {
    if (state.messages.length >= 4) return { ...state, look };
    const at = Date.now();
    const msgs: Msg[] = [
      { id: 'a', kind: 'alert', text: `⭐ ${list[2]?.name || 'someone'} subscribed for 6 months!`, at },
      ...SAMPLE.map((t, i) => {
        const v = list[i % list.length];
        return { id: 's' + i, kind: 'chat' as const, user: v.name, color: v.color, badge: v.badge, text: t.replace('{1}', list[(i + 3) % list.length].name), at, hl: false };
      }),
      { id: 'me', kind: 'me', user: streamer || 'You', color: look.accent, text: 'ok one more try, chat', at },
    ];
    return { messages: msgs, look, poll: state.poll, viewerCount: state.viewerCount };
  }, [state, list, look, streamer]);
}

export function LookPage() {
  const look = useStore(settings, s => s.look);
  const sample = useSample(look);
  const theme = (id: ThemeId) => setLook({ ...THEMES[id].look, theme: id });
  const L = <K extends keyof Look>(k: K) => (v: Look[K]) => setLook({ [k]: v } as Partial<Look>);

  return (
    <Page title="Look" intro="How chat appears on stream. Changes show up in OBS straight away."
      aside={
        <div className="look-preview">
          <div className="preview-frame"><ChatView state={sample} /></div>
          <p className="hint">The checkers show what's see-through on stream.</p>
        </div>
      }>
      <Group title="Theme" note="A starting point. You can change everything below after picking one.">
        <div className="themes">
          {(Object.keys(THEMES) as ThemeId[]).map(id => (
            <button key={id} className={`theme ${look.theme === id ? 'on' : ''}`} onClick={() => theme(id)} aria-pressed={look.theme === id}>
              <span className={`theme-swatch theme-${id}`} aria-hidden><i /><i /><i /></span>
              <strong>{THEMES[id].label}</strong>
              <span>{THEMES[id].blurb}</span>
            </button>
          ))}
        </div>
      </Group>

      <Group title="Text">
        <div className="grid2">
          <Field label="Font">{id => <Select id={id} value={look.font} onChange={L('font')} options={(Object.keys(FONTS) as FontId[]).map(f => ({ value: f, label: FONTS[f].label }))} />}</Field>
          <Field label="Size">{id => <Slider id={id} value={look.size} min={12} max={44} onChange={L('size')} format={v => v + 'px'} />}</Field>
          <Field label="Text colour">{id => <ColorInput id={id} value={look.textColor} onChange={L('textColor')} />}</Field>
          <Field label="Readability">{() => <Segmented value={look.outline} onChange={L('outline')} label="Readability"
            options={[{ value: 'shadow', label: 'Shadow' }, { value: 'outline', label: 'Outline' }, { value: 'glow', label: 'Glow' }, { value: 'none', label: 'None' }]} />}</Field>
          <Field label="Names">{() => <Segmented value={look.nameStyle} onChange={L('nameStyle')} label="Names"
            options={[{ value: 'colon', label: 'name: hi' }, { value: 'brackets', label: '<name> hi' }, { value: 'stacked', label: 'On top' }]} />}</Field>
          <Field label="Emotes">{() => <Segmented value={look.emotes} onChange={L('emotes')} label="Emotes"
            options={[{ value: 'text', label: 'KEKW' }, { value: 'emoji', label: '😂' }]} />}</Field>
        </div>
        <Toggle checked={look.avatars} onChange={L('avatars')} label="Avatars" hint="A coloured circle with their first letter." />
        <Toggle checked={look.badges} onChange={L('badges')} label="Badges" hint="Show sub, VIP and mod icons." />
      </Group>

      <Group title="Background">
        <div className="grid2">
          <Field label="Message boxes" hint="0% means no box.">{id => <Slider id={id} value={look.bubbleOpacity} min={0} max={100} onChange={L('bubbleOpacity')} format={v => v + '%'} />}</Field>
          <Field label="Box colour">{id => <ColorInput id={id} value={look.bubbleColor} onChange={L('bubbleColor')} />}</Field>
          <Field label="Panel behind chat" hint="0% means fully see-through.">{id => <Slider id={id} value={look.panelOpacity} min={0} max={100} onChange={L('panelOpacity')} format={v => v + '%'} />}</Field>
          <Field label="Panel colour">{id => <ColorInput id={id} value={look.panelColor} onChange={L('panelColor')} />}</Field>
          <Field label="Roundness">{id => <Slider id={id} value={look.radius} min={0} max={28} onChange={L('radius')} format={v => v + 'px'} />}</Field>
          <Field label="Accent" hint="Alerts, polls, highlights.">{id => <ColorInput id={id} value={look.accent} onChange={L('accent')} />}</Field>
        </div>
      </Group>

      <Group title="Layout and motion">
        <div className="grid2">
          <Field label="Lines shown">{id => <Slider id={id} value={look.max} min={3} max={30} onChange={L('max')} />}</Field>
          <Field label="Spacing">{id => <Slider id={id} value={look.gap} min={0} max={20} onChange={L('gap')} format={v => v + 'px'} />}</Field>
          <Field label="Side">{() => <Segmented value={look.align} onChange={L('align')} label="Side" options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]} />}</Field>
          <Field label="New messages">{() => <Segmented value={look.animation} onChange={L('animation')} label="Animation"
            options={[{ value: 'slide', label: 'Slide' }, { value: 'pop', label: 'Pop' }, { value: 'fade', label: 'Fade' }, { value: 'none', label: 'None' }]} />}</Field>
          <Field label="Remove messages after">{id => <Select id={id} value={String(look.fade)} onChange={v => setLook({ fade: Number(v) })}
            options={[{ value: '0', label: 'Never' }, { value: '15', label: '15 seconds' }, { value: '30', label: '30 seconds' }, { value: '60', label: '1 minute' }, { value: '120', label: '2 minutes' }]} />}</Field>
        </div>
        <Toggle checked={look.fadeTop} onChange={L('fadeTop')} label="Fade the top" hint="Older messages melt away as they scroll up." />
        <Toggle checked={look.showPoll} onChange={L('showPoll')} label="Show polls in the chat" hint="Polls appear above the messages." />
      </Group>

      <div className="row">
        <button className="btn ghost" onClick={() => setLook({ ...DEFAULT_LOOK })}><RotateCcw size={15} /> Reset the look</button>
      </div>
    </Page>
  );
}
