import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Volume2 } from 'lucide-react';
import { mic, micLevel, refreshDevices, start as startMic } from '../../engine/speech';
import { speak, voices } from '../../engine/tts';
import { settings } from '../../lib/settings';
import { useStore } from '../../lib/store';
import { pickViewer } from '../../lib/viewers';
import { Field, Group, Notice, Page, Segmented, Select, Slider, Toggle } from '../ui';

const STT_PRESETS = [
  { label: 'Groq (fast, has a free tier)', url: 'https://api.groq.com/openai/v1', model: 'whisper-large-v3-turbo' },
  { label: 'OpenAI', url: 'https://api.openai.com/v1', model: 'gpt-transcribe' },
];

const LANGS = [
  ['', 'Same as my browser'], ['en-NZ', 'English (New Zealand)'], ['en-AU', 'English (Australia)'], ['en-GB', 'English (UK)'], ['en-US', 'English (US)'],
  ['es-ES', 'Spanish'], ['fr-FR', 'French'], ['de-DE', 'German'], ['pt-BR', 'Portuguese (Brazil)'], ['ja-JP', 'Japanese'], ['ko-KR', 'Korean'], ['zh-CN', 'Chinese (Mandarin)'], ['hi-IN', 'Hindi'],
] as const;

function Meter() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => { ref.current?.style.setProperty('--lvl', micLevel().toFixed(3)); raf = requestAnimationFrame(loop); };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <div ref={ref} className="meter" role="img" aria-label="Microphone level"><span /></div>;
}

export function VoicePage() {
  const s = useStore(settings, x => x);
  const devices = useStore(mic, x => x.devices);
  const status = useStore(mic, x => x.status);
  const error = useStore(mic, x => x.error);
  const [voiceCount, setVoiceCount] = useState(voices().length);
  const [showKey, setShowKey] = useState(false);
  useEffect(() => {
    void refreshDevices();
    const t = setTimeout(() => setVoiceCount(voices().length), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <Page title="Mic and voices" intro="How chat hears you, and whether chat talks back out loud.">
      <Group title="Microphone" note="The mic stays open while you're listening, so Chrome only asks for permission once.">
        <div className="grid2">
          <Field label="Mic">{id => (
            <Select id={id} value={s.micId} onChange={v => settings.set({ micId: v })}
              options={[{ value: '', label: 'Default mic' }, ...devices.map(d => ({ value: d.id, label: d.label }))]} />
          )}</Field>
          <Field label="Language you speak" hint="Picking your accent, like English (New Zealand), helps Chrome a lot.">{id => (
            <Select id={id} value={s.lang} onChange={v => settings.set({ lang: v })} options={LANGS.map(([value, label]) => ({ value, label }))} />
          )}</Field>
          <Field label="Level" hint={status === 'listening' ? 'Talk and this should move.' : 'Start listening to test your mic.'}>
            {() => <div className="row"><Meter />{status !== 'listening' && <button className="btn sm" onClick={() => void startMic()}>Start listening</button>}</div>}
          </Field>
          <Field label="Reply after you pause for" hint="Shorter means faster replies. Longer means fewer half-sentences.">
            {id => <Slider id={id} value={s.pauseMs} min={500} max={2500} step={100} onChange={v => settings.set({ pauseMs: v })} format={v => (v / 1000).toFixed(1) + 's'} />}
          </Field>
        </div>
        {error && <Notice tone="bad">{error}</Notice>}
        <Toggle checked={s.showTyped} onChange={v => settings.set({ showTyped: v })} label="Show what I type in chat" hint="Typed messages appear in chat with your name and a mic badge." />
      </Group>

      <Group title="Speech recognition" note="What turns your voice into words. Chrome's is free but struggles with accents, names and game words. Whisper is much more accurate and costs very little.">
        <Segmented value={s.sttEngine} onChange={v => settings.set({ sttEngine: v })} label="Speech recognition"
          options={[{ value: 'browser', label: 'Chrome (free)' }, { value: 'whisper', label: 'Whisper (more accurate)' }]} />
        {s.sttEngine === 'whisper' && (
          <>
            <div className="chips">
              {STT_PRESETS.map(p => (
                <button key={p.label} className={`chip ${s.sttUrl === p.url ? 'on' : ''}`} onClick={() => settings.set({ sttUrl: p.url, sttModel: p.model })}>{p.label}</button>
              ))}
            </div>
            <div className="grid2">
              <Field label="Key" hint={s.sttUrl.includes('groq') ? 'Free key from console.groq.com, under API Keys.' : s.sttUrl.includes('openai') ? 'From platform.openai.com, under API keys.' : 'From your provider.'}>
                {id => (
                  <div className="row">
                    <input id={id} className="input" type={showKey ? 'text' : 'password'} autoComplete="off" spellCheck={false} value={s.sttKey}
                      onChange={e => settings.set({ sttKey: e.target.value.trim() })} placeholder="Paste your key" />
                    <button className="icon-btn" onClick={() => setShowKey(!showKey)} aria-label={showKey ? 'Hide key' : 'Show key'}>{showKey ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                  </div>
                )}
              </Field>
              <Field label="Model">{id => <input id={id} className="input" value={s.sttModel} onChange={e => settings.set({ sttModel: e.target.value.trim() })} />}</Field>
            </div>
            <Field label="Address" hint="Any OpenAI-compatible transcription service works.">{id => <input id={id} className="input" value={s.sttUrl} onChange={e => settings.set({ sttUrl: e.target.value.trim() })} />}</Field>
            {!s.sttKey && <Notice tone="info">Add a key, then press Start listening. Until then the mic won't turn on.</Notice>}
          </>
        )}
        <Field label="Names and words chat should know" wide hint="Your mates, your pets, game words, anything that keeps getting misheard. Whisper uses this to spell them right, and chat uses it to work out what you meant.">
          {id => <textarea id={id} className="input" rows={3} value={s.vocab} onChange={e => settings.set({ vocab: e.target.value.slice(0, 500) })}
            placeholder="Warden, Nether, Ender Dragon, my mate Jordan, my cat Biscuit" />}
        </Field>
      </Group>

      <Group title="Chat reads messages aloud" note="Each viewer gets their own voice. Wear headphones so your mic doesn't hear chat. The mic also ignores you while a voice is talking.">
        <Toggle checked={s.tts} onChange={v => settings.set({ tts: v })} label="Read chat out loud" hint={voiceCount ? `${voiceCount} voices found on this computer.` : 'Your browser has no voices installed.'} />
        <div className="grid2">
          <Field label="Volume">{id => <Slider id={id} value={s.ttsVol} min={0} max={100} onChange={v => settings.set({ ttsVol: v })} format={v => v + '%'} />}</Field>
          <Field label="Speed">{id => <Slider id={id} value={s.ttsRate} min={0.7} max={1.6} step={0.05} onChange={v => settings.set({ ttsRate: v })} format={v => v.toFixed(2) + 'x'} />}</Field>
          <Field label="How many get read" hint="Busy chats sound better below 100%.">{id => <Slider id={id} value={s.ttsChance} min={10} max={100} step={5} onChange={v => settings.set({ ttsChance: v })} format={v => v + '%'} />}</Field>
        </div>
        <Toggle checked={s.ttsNames} onChange={v => settings.set({ ttsNames: v })} label="Say their name first" hint={'Like "noodlefox says nice shot".'} />
        <div className="row">
          <button className="btn" disabled={!s.tts} onClick={() => { const v = pickViewer(); speak({ id: 'test', kind: 'chat', user: v.name, color: v.color, text: 'yo this is what i sound like', at: Date.now() }); }}>
            <Volume2 size={16} /> Play a test voice
          </button>
        </div>
      </Group>
    </Page>
  );
}
