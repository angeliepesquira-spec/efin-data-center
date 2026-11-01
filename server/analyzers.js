// Report registry. Each report type is parsed generically today; the real analysis
// (turning these into the dashboard DATA object) is added report by report.
import * as XLSX from 'xlsx';

export const REPORTS = [
  { type: 'snapshot',     label: 'Dashboard data (data.json)', hint: 'A ready-made dashboard data file. Loads straight into the dashboard.', accept: '.json' },
  { type: 'fed_efin',     label: 'Federal Return Summary: EFIN offices', hint: 'EFIN Pulls export (e.g. Federal Return Summary 094222).', accept: '.csv,.xlsx,.xls' },
  { type: 'fed_ptin',     label: 'Federal Return Summary: PTIN offices', hint: 'Taxx Savage EFINs / PTIN offices export (e.g. 094551).', accept: '.csv,.xlsx,.xls' },
  { type: 'ra',           label: 'Refund Advantage disbursement listing', hint: 'RA Disbursement Listing.', accept: '.csv,.xlsx,.xls' },
  { type: 'balances',     label: 'Clients Balances', hint: 'Balances owed by each office.', accept: '.csv,.xlsx,.xls' },
  { type: 'nonbank',      label: 'EFIN non-bank invoice summary', hint: 'EFIN_NonBank_Summary workbook.', accept: '.csv,.xlsx,.xls' },
  { type: 'ptin_ref',     label: 'PTIN Client Reference', hint: 'PTIN to office reference list.', accept: '.csv,.xlsx,.xls' },
  { type: 'stripe',       label: 'Stripe Payments', hint: 'Stripe payments export.', accept: '.csv,.xlsx,.xls' },
  { type: 'tap',          label: 'TAP payments', hint: 'Total Audit Protection paid report.', accept: '.csv,.xlsx,.xls' },
];
export const reportTypes = new Set(REPORTS.map(r => r.type));

const SNAPSHOT_KEYS = ['meta', 'offices', 'returnCols', 'returns', 'raCols', 'ra', 'balances', 'subs', 'tapCols', 'tap', 'payCols', 'payments'];

export function parseSnapshot(buf) {
  let d;
  try { d = JSON.parse(buf.toString('utf8')); } catch { throw new Error('That file is not valid JSON.'); }
  const missing = SNAPSHOT_KEYS.filter(k => !(k in d));
  if (missing.length) throw new Error('Not a dashboard data file. Missing: ' + missing.join(', '));
  return d;
}

// Generic parse of CSV/XLSX: every sheet becomes {name, headers, rows}.
export function parseTable(buf) {
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const sheets = wb.SheetNames.map(name => {
    const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true });
    const headers = (grid[0] || []).map(h => String(h).trim());
    const rows = grid.slice(1).filter(r => r.some(c => c !== ''));
    return { name, headers, rows };
  }).filter(s => s.headers.length);
  if (!sheets.length) throw new Error('No data found in that file.');
  return sheets;
}

export function summarize(sheets) {
  const first = sheets[0];
  return {
    rowCount: sheets.reduce((n, s) => n + s.rows.length, 0),
    columns: first.headers,
    preview: first.rows.slice(0, 5),
  };
}

// Placeholder: real per-report analysis is added once the sample files are provided.
export function missingForAnalysis(activeTypes) {
  const need = ['fed_efin', 'fed_ptin', 'ra', 'balances', 'nonbank', 'ptin_ref', 'stripe', 'tap'];
  return need.filter(t => !activeTypes.includes(t)).map(t => REPORTS.find(r => r.type === t).label);
}
