import { useState } from 'react';
import { Check, Copy, ExternalLink, Plug, PlugZap, Send } from 'lucide-react';
import { connect, disconnect, obs, sync } from '../../engine/obs';
import { emit } from '../../lib/feed';
import { settings } from '../../lib/settings';
import { uid, useStore } from '../../lib/store';
import { openPopout } from '../popout';
import { Field, Group, Notice, Page, Select, Status, Toggle } from '../ui';

function siteUrl(view?: string) {
  const base = location.href.split('#')[0].split('?')[0];
  return view ? `${base}?view=${view}` : base;
}

function CopyUrl({ label, url, hint }: { label: string; url: string; hint: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="copy-url">
      <div>
        <strong>{label}</strong>
        <span className="hint">{hint}</span>
      </div>
      <div className="row">
        <code>{url}</code>
        <button className="btn sm" onClick={() => { void navigator.clipboard?.writeText(url); setDone(true); setTimeout(() => setDone(false), 1500); }}>
          {done ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
        </button>
      </div>
    </div>
  );
}

export function ObsPage() {
  const s = useStore(settings, x => x);
  const o = useStore(obs, x => x);
  const [popErr, setPopErr] = useState('');
  const on = o.status === 'connected' || o.status === 'connecting';

  return (
    <Page title="OBS" intro="Get chat into your stream with a see-through background.">
      <Group title="Add chat to OBS" note="This uses the WebSocket server that's already built into OBS. Nothing to install.">
        <ol className="steps">
          <li>In OBS, open <b>Tools</b>, then <b>WebSocket Server Settings</b>. Tick <b>Enable WebSocket server</b>.</li>
          <li>Click <b>Show Connect Info</b> and copy the server password into the box below.</li>
          <li>In your scene, add a <b>Browser</b> source. Paste the chat link from below as the URL, set the size to 400 by 700, and click OK.</li>
          <li>Hit <b>Connect to OBS</b>. Chrome may ask about devices on your network the first time. Allow it, that's just OBS on your computer.</li>
        </ol>
        <div className="grid2">
          <Field label="OBS password">{id => <input id={id} className="input" type="password" autoComplete="off" value={s.obsPass} onChange={e => settings.set({ obsPass: e.target.value })} placeholder="From Show Connect Info" />}</Field>
          <Field label="Address" hint="Leave this unless you changed the port in OBS.">{id => <input id={id} className="input" value={s.obsHost} onChange={e => settings.set({ obsHost: e.target.value })} placeholder="127.0.0.1:4455" />}</Field>
        </div>
        <div className="row">
          <button className={`btn ${on ? '' : 'primary'}`} onClick={() => (on ? disconnect() : connect())}>
            {on ? <><Plug size={16} /> Disconnect</> : <><PlugZap size={16} /> Connect to OBS</>}
          </button>
          <Status tone={o.status === 'connected' ? 'good' : o.status === 'error' ? 'bad' : o.status === 'connecting' ? 'busy' : 'off'}>
            {o.status === 'connected' ? 'Connected' : o.status === 'connecting' ? 'Connecting' : o.status === 'error' ? 'Not connected' : 'Not connected'}
          </Status>
          {o.status === 'connected' && (
            <button className="btn ghost sm" onClick={() => { emit({ type: 'msg', m: { id: uid(), kind: 'system', text: 'Test message from Fake Chat. If you can read this in OBS, you are set.', at: Date.now() } }); sync(); }}>
              <Send size={15} /> Send a test message
            </button>
          )}
        </div>
        {o.error && <Notice tone={o.status === 'connecting' ? 'info' : 'bad'}>{o.error}</Notice>}
        <Toggle checked={s.obsAuto} onChange={v => settings.set({ obsAuto: v })} label="Connect automatically" hint="Reconnects to OBS whenever you open this page." />
      </Group>

      <Group title="Links for Browser sources" note="Each link shows a different piece. Add as many Browser sources as you like.">
        <CopyUrl label="Chat" url={siteUrl()} hint="The chat itself, with polls on top." />
        <CopyUrl label="Viewer count" url={siteUrl('count')} hint='A small "42 watching" badge. Size 300 by 80.' />
        <CopyUrl label="Polls only" url={siteUrl('poll')} hint="Just the poll card, if you want it somewhere else on screen." />
      </Group>

      <Group title="No WebSocket? Use a window instead" note="Opens chat in its own window on a solid colour. Add it in OBS with Window Capture and a Chroma Key filter. See-through backgrounds don't work this way.">
        <div className="row">
          <button className="btn" onClick={() => setPopErr(openPopout() || '')}><ExternalLink size={16} /> Open chat window</button>
          <div style={{ width: 180 }}>
            <Select value={s.popBg} onChange={v => settings.set({ popBg: v })} options={[{ value: '#00ff00', label: 'Green screen' }, { value: '#ff00ff', label: 'Pink screen' }, { value: '#000000', label: 'Black' }]} />
          </div>
        </div>
        {popErr && <Notice tone="bad">{popErr}</Notice>}
      </Group>
    </Page>
  );
}
