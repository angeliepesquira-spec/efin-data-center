import './styles.css';
import { startDashboard } from './dashboard.js';

const gate = document.getElementById('gate');
const root = document.getElementById('root');
let started = false;

function start(data) {
  if (started) return;
  started = true;
  gate.hidden = true;
  root.hidden = false;
  startDashboard(data);
}

async function tryLocal() {
  // Optional local file: public/data.json (git-ignored). Never commit it.
  try {
    const r = await fetch('/data.json', { cache: 'no-store' });
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) return await r.json();
  } catch (e) {}
  return null;
}

async function boot() {
  root.hidden = true;
  const local = await tryLocal();
  if (local) start(local);
  else {
    gate.hidden = false;
    document.getElementById('datafile').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { start(JSON.parse(await f.text())); }
      catch (err) { alert('That file is not valid dashboard JSON: ' + err.message); }
    });
    document.getElementById('demo').addEventListener('click', async (e) => {
      e.preventDefault();
      start(await (await fetch('/sample-data.json')).json());
    });
  }
}
boot();
