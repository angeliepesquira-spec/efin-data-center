import './styles.css';
import { startDashboard } from './dashboard.js';
import { uploadPage, uploadIcon } from './upload.js';
import { api, getPw, setPw } from './api.js';

const gate = document.getElementById('gate');
const root = document.getElementById('root');
let started = false;

function start(data, opts) {
  if (started) return;
  started = true;
  gate.hidden = true;
  root.hidden = false;
  startDashboard(data, opts);
}

const withBackend = { pages: { upload: uploadPage }, icons: { upload: uploadIcon } };
const emptyData = async () => (await fetch('/sample-data.json')).json();

function askPassword(msg) {
  gate.hidden = false;
  gate.querySelector('.gatebox').innerHTML = `<h1>Taxx Savage Data Center</h1><p>${msg}</p>
    <form class="pwbox" id="pwform"><input type="password" id="pw" placeholder="Password" autofocus><button class="upbtn solid">Open</button></form>`;
  document.getElementById('pwform').addEventListener('submit', e => { e.preventDefault(); setPw(document.getElementById('pw').value); location.reload(); });
}

async function fileGate() {
  // No backend reachable: open a data.json file straight in the browser (nothing is uploaded).
  gate.hidden = false;
  document.getElementById('datafile').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { start(JSON.parse(await f.text())); }
    catch (err) { alert('That file is not valid dashboard JSON: ' + err.message); }
  });
  document.getElementById('demo').addEventListener('click', async e => { e.preventDefault(); start(await emptyData()); });
}

async function boot() {
  root.hidden = true;
  let health = null;
  try { const r = await fetch('/api/health', { cache: 'no-store' }); if (r.ok && (r.headers.get('content-type') || '').includes('json')) health = await r.json(); } catch {}
  if (!health) {
    // Optional local file: public/data.json (git-ignored). Never commit it.
    try { const r = await fetch('/data.json', { cache: 'no-store' }); if (r.ok && (r.headers.get('content-type') || '').includes('json')) return start(await r.json()); } catch {}
    return fileGate();
  }
  if (health.passwordRequired && !getPw()) return askPassword('Enter the password to open the data center.');
  try {
    const d = await api('/api/dashboard');
    if (d.empty) start(await emptyData(), { ...withBackend, startTab: 'upload' });
    else start(d.data, withBackend);
  } catch (e) {
    if (e.status === 401) { setPw(''); return askPassword('That password was not accepted. Try again.'); }
    gate.hidden = false;
    gate.querySelector('.gatebox').innerHTML = `<h1>Taxx Savage Data Center</h1><p>Could not load data: ${e.message}</p>`;
  }
}
boot();
