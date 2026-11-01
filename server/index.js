import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import * as store from './store.js';
import { REPORTS, reportTypes, parseSnapshot, parseTable, summarize, missingForAnalysis } from './analyzers.js';

const PORT = process.env.PORT || 8787;
const PASSWORD = process.env.APP_PASSWORD || '';
const prod = process.env.NODE_ENV === 'production';
if (prod && !PASSWORD) { console.error('APP_PASSWORD is required in production.'); process.exit(1); }

const app = express();
app.disable('x-powered-by');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 60 * 1024 * 1024 } });

const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const guard = (req, res, next) => {
  if (!PASSWORD) return next();                       // local dev only
  if (same(String(req.get('x-app-password') || ''), PASSWORD)) return next();
  res.status(401).json({ error: 'password_required' });
};
const wrap = fn => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(500).json({ error: e.message }); });

app.get('/api/health', (req, res) => res.json({ ok: true, storage: store.mode, passwordRequired: !!PASSWORD }));
app.get('/api/reports', guard, (req, res) => res.json(REPORTS));

app.get('/api/uploads', guard, wrap(async (req, res) => res.json(await store.listUploads())));

app.post('/api/upload', guard, upload.single('file'), wrap(async (req, res) => {
  const type = req.body.reportType;
  if (!reportTypes.has(type)) return res.status(400).json({ error: 'Unknown report type.' });
  if (!req.file) return res.status(400).json({ error: 'Choose a file first.' });
  const filename = req.file.originalname;
  try {
    if (type === 'snapshot') {
      const data = parseSnapshot(req.file.buffer);
      await store.setSnapshot(data, 'upload');
      const rec = await store.addUpload({ reportType: type, filename, rowCount: data.returns.length + data.ra.length, columns: Object.keys(data), preview: [], sheets: [] });
      return res.json({ ok: true, upload: rec, message: 'Dashboard data loaded.', reload: true });
    }
    const sheets = parseTable(req.file.buffer);
    const rec = await store.addUpload({ reportType: type, filename, ...summarize(sheets), sheets });
    res.json({ ok: true, upload: rec, message: `Saved ${rec.rowCount.toLocaleString()} rows.` });
  } catch (e) { res.status(422).json({ error: e.message }); }
}));

app.delete('/api/uploads/:id', guard, wrap(async (req, res) => { await store.deleteUpload(req.params.id); res.json({ ok: true }); }));

// Combine the uploaded reports into the dashboard data. Per-report rules come next.
app.post('/api/analyze', guard, wrap(async (req, res) => {
  const active = (await store.activeUploadsWithData()).map(u => u.report_type);
  const missing = missingForAnalysis(active);
  if (missing.length) return res.status(409).json({ ok: false, message: 'Upload these reports first: ' + missing.join(', ') + '.', missing });
  res.status(501).json({ ok: false, message: 'All reports are uploaded, but the analysis rules are not added yet. They are built once the real files are provided.' });
}));

app.get('/api/dashboard', guard, wrap(async (req, res) => {
  const s = await store.getSnapshot();
  if (!s) return res.json({ empty: true });
  res.json({ empty: false, createdAt: s.created_at, source: s.source, data: s.data });
}));

const dist = path.resolve('dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}
app.listen(PORT, () => console.log(`API on :${PORT} (storage: ${store.mode}${PASSWORD ? ', password on' : ', NO password: dev only'})`));
