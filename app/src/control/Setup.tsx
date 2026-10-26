import { useEffect, useRef, useState } from 'react';
import { mic, micLevel, start as startMic } from '../engine/speech';
import { settings } from '../lib/settings';
import { useStore } from '../lib/store';
import { Notice } from './ui';

const STEPS = ['You', 'AI', 'Mic', 'Done'];

export function Setup({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const s = useStore(settings, x => x);
  const micStatus = useStore(mic, x => x.status);
  const micErr = useStore(mic, x => x.error);
  const meter = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => { meter.current?.style.setProperty('--lvl', micLevel().toFixed(3)); raf = requestAnimationFrame(loop); };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : onDone());

  return (
    <div className="setup-backdrop" role="dialog" aria-modal aria-labelledby="setup-title">
      <div className="setup">
        <ol className="setup-steps" aria-label="Setup steps">
          {STEPS.map((t, i) => <li key={t} className={i === step ? 'on' : i < step ? 'done' : ''}><span>{i + 1}</span>{t}</li>)}
        </ol>

        {step === 0 && (
          <div className="setup-body">
            <h2 id="setup-title">Let's set up your chat</h2>
            <p>A crowd of AI viewers that hear you, see your game and talk like a real community. Takes about a minute.</p>
            <label className="setup-field">What should chat call you?
              <input className="input" autoFocus value={s.streamer} onChange={e => settings.set({ streamer: e.target.value })} placeholder="Your name" />
            </label>
            <label className="setup-field">What are you streaming?
              <input className="input" value={s.topic} onChange={e => settings.set({ topic: e.target.value })} placeholder="Minecraft hardcore, day 12" />
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="setup-body">
            <h2 id="setup-title">Give chat a brain</h2>
            <p>Paste a Claude API key from console.anthropic.com, under API Keys. It stays in this browser and only goes to Anthropic.</p>
            <label className="setup-field">Claude API key
              <input className="input" type="password" autoComplete="off" value={s.apiKey} placeholder="sk-ant-api..."
                onChange={e => settings.set({ apiKey: e.target.value.trim(), provider: e.target.value.trim() ? 'anthropic' : s.provider })} />
            </label>
            {s.apiKey && !s.apiKey.startsWith('sk-ant-api') && <Notice tone="bad">That doesn't look like an API key. They start with sk-ant-api.</Notice>}
            <p className="hint">No key? Skip this and chat runs offline with simple canned messages. Other AI providers are on the Chat brain page.</p>
          </div>
        )}

        {step === 2 && (
          <div className="setup-body">
            <h2 id="setup-title">Let chat hear you</h2>
            <p>Chrome asks for the mic once. After that it remembers.</p>
            <div className="row">
              <button className="btn primary" onClick={() => void startMic()} disabled={micStatus === 'listening' || micStatus === 'starting'}>
                {micStatus === 'listening' ? 'Listening' : 'Turn on the mic'}
              </button>
              <div ref={meter} className="meter" role="img" aria-label="Microphone level"><span /></div>
            </div>
            {micStatus === 'listening' && <p className="hint">Say something. The bar should move.</p>}
            {micErr && <Notice tone="bad">{micErr}</Notice>}
          </div>
        )}

        {step === 3 && (
          <div className="setup-body">
            <h2 id="setup-title">You're ready</h2>
            <p>Talk and watch chat react on the Live page. When you want it on stream, the OBS page walks you through it.</p>
            <p className="hint">You can change everything later, and run this setup again from Backup.</p>
          </div>
        )}

        <div className="setup-foot">
          {step > 0 ? <button className="btn ghost" onClick={() => setStep(step - 1)}>Back</button> : <button className="btn ghost" onClick={onDone}>Skip setup</button>}
          <button className="btn primary" onClick={next}>{step === STEPS.length - 1 ? 'Go to Live' : step === 1 && !s.apiKey ? 'Skip, use offline' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}
