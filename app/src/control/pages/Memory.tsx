import { Plus, Trash2 } from 'lucide-react';
import { settings } from '../../lib/settings';
import { uid, useStore } from '../../lib/store';
import { memory } from '../../lib/viewers';
import { Field, Group, Page, Toggle } from '../ui';

export function MemoryPage() {
  const notes = useStore(memory, s => s.notes);
  const about = useStore(settings, s => s.about);
  const learn = useStore(settings, s => s.learn);
  const set = (id: string, t: string) => memory.set({ notes: notes.map(n => (n.id === id ? { ...n, t } : n)) });

  return (
    <Page title="Memory" intro="What chat knows about you. Regulars bring this stuff up later, like a real community would.">
      <Group title="About you" note="Things your regulars would already know. Your setup, pets, running jokes, what you're bad at.">
        <Field label="Chat already knows" wide>
          {id => <textarea id={id} className="input" rows={4} value={about} onChange={e => settings.set({ about: e.target.value })}
            placeholder="I stream most nights after uni. My cat walks across the keyboard. I'm terrible at boss fights and chat never lets me forget it." />}
        </Field>
      </Group>

      <Group title={`What chat remembers (${notes.length})`}
        note="Chat adds things as you stream: stuff you tell them, big moments, bets and running jokes. Saved between streams."
        actions={<>
          <button className="btn sm" onClick={() => memory.set({ notes: [...notes, { id: uid(), t: '' }] })}><Plus size={15} /> Add memory</button>
          <button className="btn sm ghost" disabled={!notes.length} onClick={() => { if (confirm('Make chat forget everything it remembers?')) memory.set({ notes: [] }); }}>Forget everything</button>
        </>}>
        <Toggle checked={learn} onChange={v => settings.set({ learn: v })} label="Learn while I stream" hint="Turn off to keep this list exactly as it is." />
        <div className="mem-list">
          {!notes.length && <p className="dim">Nothing yet. Start streaming and chat will start remembering.</p>}
          {notes.map(n => (
            <div key={n.id} className="mem">
              <input className="input" value={n.t} placeholder="Something chat should remember" aria-label="Memory"
                onChange={e => set(n.id, e.target.value.slice(0, 200))}
                onBlur={e => { if (!e.target.value.trim()) memory.set({ notes: memory.get().notes.filter(x => x.id !== n.id) }); }} />
              <button className="icon-btn" onClick={() => memory.set({ notes: notes.filter(x => x.id !== n.id) })} aria-label="Forget this"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </Group>
    </Page>
  );
}
