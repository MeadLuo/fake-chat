import { useEffect, useState } from 'react';
import { Archive, Brain, Mic, MonitorPlay, Palette, Radio, Sparkles, Users } from 'lucide-react';
import { startEngine } from '../engine/chat';
import { connect } from '../engine/obs';
import { start as startMic, wasListening } from '../engine/speech';
import { aiReady, settings } from '../lib/settings';
import { useStore } from '../lib/store';
import { obs } from '../engine/obs';
import { mic } from '../engine/speech';
import { LivePage } from './pages/Live';
import { ViewersPage } from './pages/Viewers';
import { MemoryPage } from './pages/Memory';
import { LookPage } from './pages/Look';
import { VoicePage } from './pages/Voice';
import { AiPage } from './pages/Ai';
import { ObsPage } from './pages/Obs';
import { BackupPage } from './pages/Backup';
import { Setup } from './Setup';
import './app.css';

const PAGES = [
  { id: 'live', label: 'Live', icon: Radio, el: LivePage },
  { id: 'viewers', label: 'Viewers', icon: Users, el: ViewersPage },
  { id: 'memory', label: 'Memory', icon: Brain, el: MemoryPage },
  { id: 'look', label: 'Look', icon: Palette, el: LookPage },
  { id: 'voice', label: 'Mic and voices', icon: Mic, el: VoicePage },
  { id: 'ai', label: 'Chat brain', icon: Sparkles, el: AiPage },
  { id: 'obs', label: 'OBS', icon: MonitorPlay, el: ObsPage },
  { id: 'backup', label: 'Backup', icon: Archive, el: BackupPage },
] as const;
type PageId = typeof PAGES[number]['id'];

const fromHash = (): PageId => {
  const h = location.hash.replace(/^#\/?/, '');
  return (PAGES.find(p => p.id === h)?.id ?? 'live') as PageId;
};

export function App() {
  const [page, setPage] = useState<PageId>(fromHash);
  const setupDone = useStore(settings, s => s.setupDone);
  const ai = useStore(settings, s => aiReady(s));
  const obsStatus = useStore(obs, s => s.status);
  const micStatus = useStore(mic, s => s.status);

  useEffect(() => {
    startEngine();
    if (wasListening()) void startMic();
    const s = settings.get();
    if (s.obsAuto && s.obsPass) connect();
    const onHash = () => setPage(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (id: PageId) => { location.hash = '/' + id; setPage(id); };
  const Current = PAGES.find(p => p.id === page)!.el;
  const dot: Record<string, string> = {
    live: micStatus === 'listening' ? 'good' : micStatus === 'error' ? 'bad' : '',
    ai: ai ? 'good' : '',
    obs: obsStatus === 'connected' ? 'good' : obsStatus === 'error' ? 'bad' : obsStatus === 'connecting' ? 'busy' : '',
  };

  return (
    <div className="shell">
      <nav className="rail" aria-label="Sections">
        <div className="brand">
          <span className="brand-mark" aria-hidden><i /><i /><i /></span>
          <span className="brand-name">Fake Chat</span>
        </div>
        <ul>
          {PAGES.map(p => (
            <li key={p.id}>
              <button className={page === p.id ? 'on' : ''} onClick={() => go(p.id)} aria-current={page === p.id ? 'page' : undefined}>
                <p.icon size={19} strokeWidth={2} aria-hidden />
                <span>{p.label}</span>
                {dot[p.id] && <i className={`rail-dot ${dot[p.id]}`} aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
        <p className="rail-foot">Runs in your browser. Your key and settings never leave it.</p>
      </nav>
      <main className="stage-area">
        <Current go={go as (id: string) => void} />
      </main>
      {!setupDone && <Setup onDone={() => settings.set({ setupDone: true })} />}
    </div>
  );
}

export type PageProps = { go: (id: string) => void };
