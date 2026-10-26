import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { DEFAULT_SETTINGS, settings } from '../../lib/settings';
import { uid } from '../../lib/store';
import { DEFAULT_LOOK } from '../../lib/themes';
import { cast, memory } from '../../lib/viewers';
import type { Look, Settings, Viewer } from '../../lib/types';
import { Group, Notice, Page } from '../ui';

const SECRET: (keyof Settings)[] = ['apiKey', 'obsPass'];

function exportAll() {
  const s: Partial<Settings> = { ...settings.get() };
  SECRET.forEach(k => delete s[k]);
  const data = { app: 'fake-chat', version: 2, settings: s, viewers: cast.get().list, memory: memory.get().notes };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'fake-chat-backup.json';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Reads backups from this version and from the old single-file version
function importAll(data: any) {
  if (data?.app !== 'fake-chat') throw new Error("That file isn't a Fake Chat backup.");
  const keep = { apiKey: settings.get().apiKey, obsPass: settings.get().obsPass };
  const old = data.version === 1;
  const raw = data.settings || {};
  let next: Settings;
  if (old) {
    const look: Partial<Look> = {
      size: raw.size, max: raw.max, panelColor: raw.panelColor, panelOpacity: raw.panelOpacity,
      bubbleColor: raw.boxColor, bubbleOpacity: raw.boxOpacity, fadeTop: raw.fadeTop, fade: raw.fade,
      font: raw.font === 'minecraft' ? 'minecraft' : raw.font === 'mono' ? 'mono' : raw.font === 'rounded' ? 'nunito' : 'inter',
      nameStyle: raw.nameStyle === 'mc' ? 'brackets' : 'colon',
    };
    Object.keys(look).forEach(k => (look as any)[k] === undefined && delete (look as any)[k]);
    next = {
      ...DEFAULT_SETTINGS, ...settings.get(),
      streamer: raw.streamer ?? '', topic: raw.topic ?? '', about: raw.about ?? '', vibe: raw.vibe || 'hype',
      busy: raw.speed || 3, idle: raw.idle ?? true, alerts: raw.alerts ?? true, newViewers: !!raw.newViewers, learn: raw.learn ?? true,
      provider: raw.provider || 'none', brain: raw.brain || 'smart', model: raw.model || '', baseUrl: raw.baseUrl || '',
      tts: !!raw.tts, ttsVol: raw.ttsVol ?? 80, popBg: raw.bgColor || '#00ff00',
      look: { ...DEFAULT_LOOK, ...look },
    };
  } else {
    next = { ...DEFAULT_SETTINGS, ...raw, look: { ...DEFAULT_LOOK, ...(raw.look || {}) } };
  }
  settings.set({ ...next, ...keep, setupDone: true });

  const viewers: Viewer[] = (old ? (data.viewers || []).map(([name, v]: [string, any]) => ({ name, ...v })) : data.viewers || [])
    .filter((v: any) => v && v.name)
    .map((v: any) => ({ name: String(v.name), color: v.color || '#ffffff', note: v.note || '', badge: v.badge || '', chat: v.chat || 2 }));
  if (viewers.length) cast.set({ list: viewers });
  if (Array.isArray(data.memory)) memory.set({ notes: data.memory.filter((m: any) => m?.t).map((m: any) => ({ id: m.id || uid(), t: String(m.t) })) });
  return { viewers: viewers.length, memories: Array.isArray(data.memory) ? data.memory.length : 0 };
}

export function BackupPage() {
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);

  return (
    <Page title="Backup" intro="Move your viewers, memory and settings to another computer or browser.">
      <Group title="Save and load" note="Your API key and OBS password are left out of the file on purpose. Backups from the old single-file version work too.">
        <div className="row">
          <button className="btn primary" onClick={() => { exportAll(); setMsg({ tone: 'good', text: 'Saved fake-chat-backup.json to your Downloads.' }); }}>
            <Download size={16} /> Export backup
          </button>
          <button className="btn" onClick={() => file.current?.click()}><Upload size={16} /> Import backup</button>
          <input ref={file} type="file" accept=".json,application/json" hidden onChange={async e => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const data = JSON.parse(await f.text());
              if (!confirm('Replace your current viewers, memory and settings with this backup?')) return;
              const r = importAll(data);
              setMsg({ tone: 'good', text: `Loaded ${r.viewers} viewers and ${r.memories} memories.` });
            } catch (err) {
              setMsg({ tone: 'bad', text: err instanceof SyntaxError ? "That file isn't valid JSON." : (err as Error).message });
            }
          }} />
        </div>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      </Group>

      <Group title="Start over" note="Resets settings and the look. Your viewers and memory stay unless you clear them on their pages.">
        <div className="row">
          <button className="btn ghost" onClick={() => {
            if (!confirm('Reset all settings? Your API key and OBS password are kept.')) return;
            const s = settings.get();
            settings.set({ ...DEFAULT_SETTINGS, apiKey: s.apiKey, obsPass: s.obsPass, setupDone: true });
          }}>Reset settings</button>
          <button className="btn ghost" onClick={() => settings.set({ setupDone: false })}>Run the setup again</button>
        </div>
      </Group>
    </Page>
  );
}
