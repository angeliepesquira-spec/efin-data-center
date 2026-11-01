// "Upload Data" page: pick a report, upload it, the backend parses + stores it, results show here.
import { api } from './api.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); };
let reports = [], uploads = [], note = null, busy = '';

function card(r) {
  const last = uploads.find(u => u.reportType === r.type && u.active);
  const isBusy = busy === r.type;
  return `<div class="card upcard">
    <div class="uphead"><h3>${esc(r.label)}</h3>${last ? '<span class="chip ok">Uploaded</span>' : '<span class="chip">Waiting</span>'}</div>
    <div class="sub">${esc(r.hint)}</div>
    <div class="upmeta">${last ? `<b>${esc(last.filename)}</b><br>${last.rowCount.toLocaleString()} rows · ${esc(when(last.uploadedAt))}` : 'No file yet'}</div>
    <label class="upbtn ${isBusy ? 'dis' : ''}">${isBusy ? 'Uploading…' : (last ? 'Replace file' : 'Choose file')}
      <input type="file" data-report="${esc(r.type)}" accept="${esc(r.accept)}" ${isBusy ? 'disabled' : ''} hidden></label>
  </div>`;
}

function history() {
  if (!uploads.length) return '<p class="sub">Nothing uploaded yet.</p>';
  const label = t => (reports.find(r => r.type === t) || {}).label || t;
  return `<div class="tw"><table><thead><tr><th>Report</th><th>File</th><th class="num">Rows</th><th>Uploaded</th><th></th></tr></thead><tbody>${uploads.map(u =>
    `<tr><td>${esc(label(u.reportType))}${u.active ? '' : ' <span class="chip">older</span>'}</td><td>${esc(u.filename)}</td><td class="num">${u.rowCount.toLocaleString()}</td><td>${esc(when(u.uploadedAt))}</td><td><button class="linkbtn" data-delup="${esc(u.id)}">Delete</button></td></tr>`).join('')}</tbody></table></div>`;
}

function paint() {
  const el = document.getElementById('uploadPanel'); if (!el) return;
  const n = note ? `<div class="upnote ${note.bad ? 'bad' : 'good'}">${esc(note.text)}</div>` : '';
  el.innerHTML = `${n}<div class="grid upgrid">${reports.map(card).join('')}</div>
    <div class="card" style="margin-top:16px"><div class="uphead"><div><h3>Analyze</h3><div class="sub">Combines the uploaded reports into the dashboard numbers.</div></div>
      <button class="upbtn solid" id="runAnalyze">Run analysis</button></div></div>
    <div class="card" style="margin-top:16px"><h3 style="margin-bottom:10px">Upload history</h3>${history()}</div>`;
}

async function refresh() {
  try { [reports, uploads] = await Promise.all([api('/api/reports'), api('/api/uploads')]); }
  catch (e) { note = { bad: true, text: e.status === 401 ? 'Password needed. Reload the page and enter it.' : 'Could not reach the backend: ' + e.message }; }
  paint();
}

export const uploadPage = {
  group: 'Data', title: 'Upload Data', desc: 'Upload your reports. The backend reads and stores them, then the dashboard updates.',
  noControls: true, noSearch: true,
  body: () => '<div id="uploadPanel"><p class="sub">Loading…</p></div>',
  after: () => { note = null; refresh(); },
};

export const uploadIcon = '<path d="M12 16V4m0 0L7 9m5-5l5 5M4 16v4h16v-4"/>';

document.addEventListener('change', async e => {
  const inp = e.target.closest && e.target.closest('input[data-report]'); if (!inp || !inp.files[0]) return;
  const fd = new FormData(); fd.append('reportType', inp.dataset.report); fd.append('file', inp.files[0]);
  busy = inp.dataset.report; note = null; paint();
  try {
    const r = await api('/api/upload', { method: 'POST', body: fd });
    note = { text: r.message };
    if (r.reload) { location.reload(); return; }
  } catch (err) { note = { bad: true, text: err.message }; }
  busy = ''; await refresh();
});

document.addEventListener('click', async e => {
  const del = e.target.closest && e.target.closest('[data-delup]');
  if (del) { if (!confirm('Delete this upload?')) return; try { await api('/api/uploads/' + del.dataset.delup, { method: 'DELETE' }); note = { text: 'Deleted.' }; } catch (err) { note = { bad: true, text: err.message }; } await refresh(); return; }
  if (e.target.id === 'runAnalyze') {
    try { const r = await api('/api/analyze', { method: 'POST' }); note = { text: r.message }; }
    catch (err) { note = { bad: true, text: (err.body && err.body.message) || err.message }; }
    paint();
  }
});
