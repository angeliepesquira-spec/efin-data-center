// Tiny client for the backend. The shared password is kept for this browser tab only.
const KEY = 'tsdc_pw';
export const getPw = () => { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } };
export const setPw = v => { try { sessionStorage.setItem(KEY, v); } catch {} };

export async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}), 'x-app-password': getPw() };
  const r = await fetch(path, { ...opts, headers });
  let body = null; try { body = await r.json(); } catch {}
  if (!r.ok) { const e = new Error((body && (body.error || body.message)) || r.statusText); e.status = r.status; e.body = body; throw e; }
  return body;
}
