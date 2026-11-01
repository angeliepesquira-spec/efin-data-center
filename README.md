# EFIN Data Center + Taxx Savage Data Center

> **The live app now lives in `angeliepesquira-spec/savage-tax-dashboard`** (the repo synced with AI Studio).
> This repo is the earlier Vite + Express version, kept for reference together with the EFIN dashboard,
> build scripts and skills. New work goes in `savage-tax-dashboard`. Skills and report formats are mirrored here.

Code only. This repo contains the dashboard templates, build scripts and the
Claude skill. It contains **no** real balances, PTINs, emails or Stripe links.
Keep it private anyway.

## Layout

| Path | What it is |
| --- | --- |
| `efin-dashboard/template.html` | EFIN Data Center dashboard (account status, decision rules, drill-down, week selector). Data slot: `EMBEDDED_SNAPSHOT`. |
| `index.html`, `src/`, `public/` | **Taxx Savage Data Center** as a Vite app (`src/dashboard.js` = dashboard logic, `src/styles.css`, `src/main.js` = data loader). |
| `sample-data/*.empty.json` | Empty data files showing the exact schema each template expects. |
| `tools/build_dashboards.py` | Injects a data JSON into a template and writes the finished HTML. |
| `tools/build_efin_xlsx.py` | Builds the EFIN workbook (Summary tab + one tab per EFIN) from a snapshot JSON. |
| `skill/efin-data-center/SKILL.md` | The Claude skill that runs the weekly EFIN update. |
| `skill/taxx-savage-data-center/SKILL.md` | The Claude skill for the Taxx Savage Data Center app (structure, rules, status). |
| `docs/report-formats.md` | Column layouts of the 8 reports. |

## Weekly run

1. Drop the week's files in the shared "EFIN Data Center" Drive folder.
2. Ask Claude: "run the EFIN update". The skill aggregates RA, EFIN Pulls and the
   NonBank Summary into a `snapshot.json` (schema in `sample-data/efin-snapshot.empty.json`).
3. Build outputs (kept in `out/`, which git ignores):

```bash
pip install openpyxl
python tools/build_dashboards.py efin snapshot.json out/efin_dashboard.html
python tools/build_efin_xlsx.py snapshot.json out/EFIN_Data_Center.xlsx
```

## Rules baked into the EFIN dashboard

- Bank returns (RA Disbursement Listing) and non-bank returns (WebReport / EFIN Pulls)
  are different populations, not duplicates.
- Balance Due = the unpaid non-bank invoice total.
- Any balance above zero means Risk High, access restricted, action "Disable tax prep access".
- The EFI Number List 2026 is the master EFIN-to-office map.

## Data safety

`.gitignore` blocks `out/`, `data/`, `*.xlsx`, `*.csv` and `snapshot*.json`. Never commit real data.

## Taxx Savage Data Center (Vite app)

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # static site in dist/
```

On open, the app asks for a `data.json` (schema: `sample-data/taxx-savage-data.empty.json`).
For local work you can drop it at `public/data.json` (git-ignored). Real data is never committed.

### Upload → backend → results (Supabase)

The app has an **Upload Data** menu. Each report is uploaded in the browser, the Express backend
(`server/`) parses and stores it in Supabase, and the dashboard reads the stored result back.

1. Create a Supabase project and run `supabase/schema.sql` in its SQL editor.
2. Copy `.env.example` to `.env` and fill in `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `APP_PASSWORD`.
3. Run both processes: `npm run server` and `npm run dev` (the dev server proxies `/api` to the backend).
   For production: `npm start` (builds the frontend and serves everything from the backend).

Without Supabase keys the backend stores data in `data/store.json` (git-ignored) so you can try it locally.
`APP_PASSWORD` is required in production; the browser asks for it before showing or uploading any data.

**Status:** uploading and storing all 8 reports works, and a ready-made `data.json` loads straight into the
dashboard. Turning the raw reports into the dashboard numbers (`POST /api/analyze`, `server/analyzers.js`)
is the next step and needs the real sample files.

### Using it in AI Studio
Connect this GitHub repo to the AI Studio project. Commits pushed here update AI Studio, and
changes made in AI Studio can be synced back to GitHub. Add the `.env` values as secrets there;
they are never stored in the repo.

## Privacy

Uploads are sanitised on the server (`sanitizeSheets` in `server/analyzers.js`): SSNs, bank routing/account numbers,
birth dates, addresses and card numbers are dropped before anything is stored. Never commit real data.
