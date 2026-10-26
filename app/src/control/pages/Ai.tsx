import { useState } from 'react';
import { Eye, EyeOff, Zap } from 'lucide-react';
import { generateChat, usage } from '../../engine/ai';
import { BRAINS, VIBES, aiReady, modelName, settings } from '../../lib/settings';
import { useStore } from '../../lib/store';
import type { Brain, Provider } from '../../lib/types';
import { Field, Group, Notice, Page, Segmented, Select, Slider, Toggle } from '../ui';

const PRESETS = [
  { label: 'OpenAI', url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  { label: 'Groq', url: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { label: 'Ollama (local)', url: 'http://localhost:11434/v1', model: 'llama3.1' },
];

export function AiPage() {
  const s = useStore(settings, x => x);
  const u = useStore(usage, x => x);
  const [show, setShow] = useState(false);
  const [test, setTest] = useState<{ tone: 'good' | 'bad' | 'info'; text: string } | null>(null);
  const set = settings.set;

  const runTest = async () => {
    setTest({ tone: 'info', text: 'Asking the AI...' });
    let first = '';
    try {
      await generateChat({ kind: 'speech', said: 'hi chat, can you hear me?', events: [], count: 2, recentChat: [], recentSpeech: [], poll: null, timedOut: [], screenshot: null },
        m => { if (!first) first = `${m.user}: ${m.msg}`; });
      setTest(first ? { tone: 'good', text: `It works. First reply was "${first}"` } : { tone: 'bad', text: "The AI answered but didn't write any chat. Try another model." });
    } catch (e) {
      setTest({ tone: 'bad', text: (e as Error).message });
    }
  };

  return (
    <Page title="Chat brain" intro="Who you are, which AI writes the chat, and how chat talks.">
      <Group title="Your stream">
        <div className="grid2">
          <Field label="Your name" hint="What chat calls you. Messages that mention it get highlighted.">
            {id => <input id={id} className="input" value={s.streamer} onChange={e => set({ streamer: e.target.value })} placeholder="Your name" />}
          </Field>
          <Field label="What you're playing" hint="The more specific, the smarter chat gets.">
            {id => <input id={id} className="input" value={s.topic} onChange={e => set({ topic: e.target.value })} placeholder="Minecraft hardcore, day 12" />}
          </Field>
        </div>
      </Group>

      <Group title="AI">
        <Segmented<Provider> value={s.provider} onChange={v => set({ provider: v })} label="Provider"
          options={[{ value: 'anthropic', label: 'Claude' }, { value: 'openai', label: 'OpenAI or other' }, { value: 'none', label: 'Offline' }]} />
        {s.provider === 'none' && <p className="hint">Offline chat uses simple canned messages. It can't understand you or see your screen.</p>}
        {s.provider !== 'none' && (
          <>
            <Field label="API key" hint={s.provider === 'anthropic' ? 'From console.anthropic.com, under API Keys. Starts with sk-ant-api.' : 'From your provider. Not needed for Ollama.'}>
              {id => (
                <div className="row">
                  <input id={id} className="input" type={show ? 'text' : 'password'} value={s.apiKey} autoComplete="off" spellCheck={false}
                    onChange={e => set({ apiKey: e.target.value.trim() })} placeholder="Paste your key" />
                  <button className="icon-btn" onClick={() => setShow(!show)} aria-label={show ? 'Hide key' : 'Show key'}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                </div>
              )}
            </Field>
            {s.provider === 'anthropic' && (
              <div className="brains" role="radiogroup" aria-label="Brain">
                {(Object.keys(BRAINS) as Brain[]).map(b => (
                  <button key={b} role="radio" aria-checked={s.brain === b} className={`brain ${s.brain === b ? 'on' : ''}`} onClick={() => set({ brain: b })}>
                    <strong>{BRAINS[b].label}</strong><span>{BRAINS[b].note}</span>
                  </button>
                ))}
              </div>
            )}
            {s.provider === 'openai' && (
              <>
                <div className="chips">
                  {PRESETS.map(p => <button key={p.label} className={`chip ${s.baseUrl === p.url ? 'on' : ''}`} onClick={() => set({ baseUrl: p.url, model: p.model })}>{p.label}</button>)}
                </div>
                <div className="grid2">
                  <Field label="Address">{id => <input id={id} className="input" value={s.baseUrl} onChange={e => set({ baseUrl: e.target.value.trim() })} placeholder="https://api.openai.com/v1" />}</Field>
                  <Field label="Model">{id => <input id={id} className="input" value={s.model} onChange={e => set({ model: e.target.value.trim() })} placeholder="gpt-4o-mini" />}</Field>
                </div>
              </>
            )}
            <div className="row">
              <button className="btn" disabled={!aiReady(s)} onClick={() => void runTest()}><Zap size={16} /> Test it</button>
              <span className="hint">Using {modelName(s)}</span>
            </div>
            {test && <Notice tone={test.tone}>{test.text}</Notice>}
            {u.lastError && !test && <Notice tone="bad">Last problem: {u.lastError}</Notice>}
            {u.calls > 0 && (
              <p className="hint">This session: {u.calls} replies, {Math.round(u.input / 1000)}k tokens read ({Math.round(u.cached / 1000)}k from cache, which is cheaper), {Math.round(u.output / 1000)}k written. Last reply took {(u.lastMs / 1000).toFixed(1)}s.</p>
            )}
          </>
        )}
      </Group>

      <Group title="How chat talks">
        <div className="grid2">
          <Field label="Vibe">{id => <Select id={id} value={s.vibe} onChange={v => set({ vibe: v })} options={Object.entries(VIBES).map(([value, v]) => ({ value, label: v.label }))} />}</Field>
          <Field label="Chat writes in">{id => <input id={id} className="input" value={s.chatLanguage} onChange={e => set({ chatLanguage: e.target.value })} placeholder="English" />}</Field>
        </div>
        {s.vibe === 'custom' && (
          <Field label="Describe your chat" wide>
            {id => <textarea id={id} className="input" rows={3} value={s.customVibe} onChange={e => set({ customVibe: e.target.value })}
              placeholder="Sarcastic Kiwi gamers who love a good stitch-up but always back you when it counts" />}
          </Field>
        )}
        <div className="grid2">
          <Field label="Message length">{() => <Segmented value={s.replyLength} onChange={v => set({ replyLength: v })} label="Message length"
            options={[{ value: 'short', label: 'Short' }, { value: 'mixed', label: 'Mixed' }, { value: 'long', label: 'Longer' }]} />}</Field>
          <Field label="Emotes">{() => <Segmented value={s.emoteLevel} onChange={v => set({ emoteLevel: v })} label="Emotes"
            options={[{ value: 0, label: 'Few' }, { value: 1, label: 'Some' }, { value: 2, label: 'Lots' }]} />}</Field>
          <Field label="Typing">{() => <Segmented value={s.typos} onChange={v => set({ typos: v })} label="Typing"
            options={[{ value: 0, label: 'Neat' }, { value: 1, label: 'Casual' }, { value: 2, label: 'Messy' }]} />}</Field>
        </div>
        <Toggle checked={s.swearing} onChange={v => set({ swearing: v })} label="Allow mild swearing" hint="Off keeps chat clean. Slurs and hate are never allowed either way." />
      </Group>

      <Group title="When chat talks">
        <Toggle checked={s.idle} onChange={v => set({ idle: v })} label="Keep talking when I'm quiet" hint="Viewers chat to each other and ask you things." />
        <Toggle checked={s.reactToScreen} onChange={v => set({ reactToScreen: v })} label="React when my screen changes a lot" hint="Needs screen sharing on the Live page. Deaths, new areas and menus get a reaction." />
        {s.reactToScreen && (
          <Field label="Screen sensitivity">{() => <Segmented value={s.screenSensitivity} onChange={v => set({ screenSensitivity: v })} label="Screen sensitivity"
            options={[{ value: 1, label: 'Big changes only' }, { value: 2, label: 'Normal' }, { value: 3, label: 'Notice everything' }]} />}</Field>
        )}
        <Toggle checked={s.alerts} onChange={v => set({ alerts: v })} label="Fake alerts" hint="Random subs, follows, gift subs, bits and raids." />
        <div className="grid2">
          {s.alerts && <Field label="About one alert every">{id => <Slider id={id} value={s.alertMinutes} min={1} max={20} onChange={v => set({ alertMinutes: v })} format={v => v + ' min'} />}</Field>}
          <Field label="Viewer count" hint="Shown on the Live page and the OBS count widget. It drifts a little.">
            {id => <input id={id} className="input" type="number" min={0} max={100000} value={s.viewerCount} onChange={e => set({ viewerCount: Math.max(0, Number(e.target.value) || 0) })} />}
          </Field>
        </div>
      </Group>
    </Page>
  );
}
