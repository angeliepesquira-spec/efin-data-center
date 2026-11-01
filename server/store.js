// Storage layer: Supabase when configured, otherwise a local JSON file (data/store.json, git-ignored).
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const mode = url && key ? 'supabase' : 'local';
const sb = mode === 'supabase' ? createClient(url, key, { auth: { persistSession: false } }) : null;

const FILE = path.resolve('data/store.json');
const readLocal = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { uploads: [], snapshots: [] }; } };
const writeLocal = db => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(db)); };
const fail = e => { if (e) throw new Error(e.message || String(e)); };

const meta = u => ({ id: u.id, reportType: u.report_type, filename: u.filename, uploadedAt: u.uploaded_at, rowCount: u.row_count, columns: u.columns, preview: u.preview, active: u.active });
const COLS = 'id,report_type,filename,uploaded_at,row_count,columns,preview,active';

export async function addUpload(u) {
  const row = { report_type: u.reportType, filename: u.filename, row_count: u.rowCount, columns: u.columns, preview: u.preview, sheets: u.sheets, active: true };
  if (sb) {
    const off = await sb.from('uploads').update({ active: false }).eq('report_type', u.reportType).eq('active', true); fail(off.error);
    const { data, error } = await sb.from('uploads').insert(row).select(COLS).single(); fail(error);
    return meta(data);
  }
  const db = readLocal();
  db.uploads.forEach(x => { if (x.report_type === u.reportType) x.active = false; });
  const rec = { id: randomUUID(), uploaded_at: new Date().toISOString(), ...row };
  db.uploads.push(rec); writeLocal(db);
  return meta(rec);
}

export async function listUploads() {
  if (sb) { const { data, error } = await sb.from('uploads').select(COLS).order('uploaded_at', { ascending: false }).limit(200); fail(error); return data.map(meta); }
  return readLocal().uploads.map(meta).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function activeUploadsWithData() {
  if (sb) { const { data, error } = await sb.from('uploads').select('*').eq('active', true); fail(error); return data; }
  return readLocal().uploads.filter(x => x.active);
}

export async function deleteUpload(id) {
  if (sb) { const { error } = await sb.from('uploads').delete().eq('id', id); fail(error); return; }
  const db = readLocal(); db.uploads = db.uploads.filter(x => x.id !== id); writeLocal(db);
}

export async function setSnapshot(data, source) {
  if (sb) { const { error } = await sb.from('snapshots').insert({ data, source }); fail(error); return; }
  const db = readLocal(); db.snapshots.push({ id: randomUUID(), created_at: new Date().toISOString(), source, data }); db.snapshots = db.snapshots.slice(-5); writeLocal(db);
}

export async function getSnapshot() {
  if (sb) { const { data, error } = await sb.from('snapshots').select('data,created_at,source').order('created_at', { ascending: false }).limit(1); fail(error); return data[0] || null; }
  const s = readLocal().snapshots; const last = s[s.length - 1];
  return last ? { data: last.data, created_at: last.created_at, source: last.source } : null;
}
