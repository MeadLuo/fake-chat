import { useState } from 'react';
import { Plus, Shuffle, Trash2 } from 'lucide-react';
import { live, untimeout } from '../../engine/chat';
import { settings } from '../../lib/settings';
import { useStore } from '../../lib/store';
import { cast, cleanName, makeName, randomCast, randomViewer } from '../../lib/viewers';
import type { BadgeId, Viewer } from '../../lib/types';
import { Group, Page, Toggle } from '../ui';

export function ViewersPage() {
  const list = useStore(cast, s => s.list);
  const newViewers = useStore(settings, s => s.newViewers);
  const timedOut = useStore(live, s => s.timedOut);
  const [filter, setFilter] = useState('');
  const now = Date.now();
  const blocked = Object.entries(timedOut).filter(([, until]) => until > now);

  const update = (i: number, patch: Partial<Viewer>) => cast.set(s => ({ list: s.list.map((v, j) => (j === i ? { ...v, ...patch } : v)) }));
  const rename = (i: number, raw: string) => {
    const name = cleanName(raw);
    if (!name || list.some((v, j) => j !== i && v.name.toLowerCase() === name.toLowerCase())) return false;
    update(i, { name });
    return true;
  };
  const add = () => {
    let name = makeName();
    while (list.some(v => v.name === name)) name = makeName();
    cast.set({ list: [...list, randomViewer(name, new Set(list.map(v => v.note)))] });
  };
  const shown = list.map((v, i) => ({ v, i })).filter(({ v }) => !filter || (v.name + ' ' + v.note).toLowerCase().includes(filter.toLowerCase()));

  return (
    <Page title="Viewers" intro="Your regulars. Each one has a personality, a badge and how much they talk, and the AI writes them that way.">
      <Group title={`${list.length} people in chat`}
        actions={<>
          <input className="input sm" placeholder="Search" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Search viewers" />
          <button className="btn sm" onClick={add}><Plus size={15} /> Add viewer</button>
          <button className="btn sm ghost" onClick={() => { if (confirm('Replace everyone with a new random cast? Your edits will be lost.')) cast.set({ list: randomCast() }); }}>
            <Shuffle size={15} /> New random cast
          </button>
        </>}>
        <div className="viewer-list">
          {shown.map(({ v, i }) => (
            <ViewerRow key={i + v.name} v={v} onChange={p => update(i, p)} onRename={n => rename(i, n)}
              onDelete={list.length > 1 ? () => cast.set({ list: list.filter((_, j) => j !== i) }) : undefined} />
          ))}
          {!shown.length && <p className="dim">Nobody matches that search.</p>}
        </div>
      </Group>

      <Group title="New faces">
        <Toggle checked={newViewers} onChange={v => settings.set({ newViewers: v })} label="Let new viewers turn up"
          hint="Now and then the AI brings in someone new. They get added to this list." />
      </Group>

      {blocked.length > 0 && (
        <Group title="Timed out and banned" note="They can't talk until the time is up, or you let them back.">
          <div className="row wrap">
            {blocked.map(([name, until]) => (
              <button key={name} className="chip" onClick={() => untimeout(name)} title="Let them back">
                {name}, {until === Infinity ? 'banned' : `${Math.ceil((until - now) / 60000)} min left`}. Unban
              </button>
            ))}
          </div>
        </Group>
      )}
    </Page>
  );
}

function ViewerRow({ v, onChange, onRename, onDelete }: { v: Viewer; onChange: (p: Partial<Viewer>) => void; onRename: (n: string) => boolean; onDelete?: () => void }) {
  const [name, setName] = useState(v.name);
  return (
    <div className="viewer">
      <label className="swatch" title="Name colour">
        <input type="color" value={v.color} onChange={e => onChange({ color: e.target.value })} aria-label={`Colour for ${v.name}`} />
        <span style={{ background: v.color }} />
      </label>
      <input className="input vname" style={{ color: v.color }} value={name} spellCheck={false} aria-label="Username"
        onChange={e => setName(e.target.value)}
        onBlur={() => { if (!onRename(name)) setName(v.name); else setName(cleanName(name)); }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
      <select className="input sm" value={v.badge} onChange={e => onChange({ badge: e.target.value as BadgeId })} aria-label="Badge">
        <option value="">No badge</option><option value="sub">⭐ Sub</option><option value="vip">💎 VIP</option><option value="mod">🛡️ Mod</option>
      </select>
      <select className="input sm" value={v.chat} onChange={e => onChange({ chat: Number(e.target.value) as Viewer['chat'] })} aria-label="How much they talk">
        <option value={1}>Lurker</option><option value={2}>Normal</option><option value={3}>Chatty</option>
      </select>
      <button className="icon-btn" onClick={onDelete} disabled={!onDelete} aria-label={`Remove ${v.name}`}><Trash2 size={16} /></button>
      <input className="input vnote" value={v.note} placeholder="How they act and type" aria-label="Personality"
        onChange={e => onChange({ note: e.target.value.slice(0, 200) })} />
    </div>
  );
}
