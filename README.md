# EFIN Data Center + Taxx Savage Data Center

Code only. This repo contains the dashboard templates, build scripts and the
Claude skill. It contains **no** real balances, PTINs, emails or Stripe links.
Keep it private anyway.

## Layout

| Path | What it is |
| --- | --- |
| `efin-dashboard/template.html` | EFIN Data Center dashboard (account status, decision rules, drill-down, week selector). Data slot: `EMBEDDED_SNAPSHOT`. |
| `taxx-savage-data-center/template.html` | Taxx Savage Data Center (overview, offices, collections, Stripe, disbursements, TAP, subscriptions, profit/payroll). Data slot: `DATA`. |
| `sample-data/*.empty.json` | Empty data files showing the exact schema each template expects. |
| `tools/build_dashboards.py` | Injects a data JSON into a template and writes the finished HTML. |
| `tools/build_efin_xlsx.py` | Builds the EFIN workbook (Summary tab + one tab per EFIN) from a snapshot JSON. |
| `skill/efin-data-center/SKILL.md` | The Claude skill that runs the weekly EFIN update. |

## Weekly run

1. Drop the week's files in the shared "EFIN Data Center" Drive folder.
2. Ask Claude: "run the EFIN update". The skill aggregates RA, EFIN Pulls and the
   NonBank Summary into a `snapshot.json` (schema in `sample-data/efin-snapshot.empty.json`).
3. Build outputs (kept in `out/`, which git ignores):

```bash
pip install openpyxl
python tools/build_dashboards.py efin snapshot.json out/efin_dashboard.html
python tools/build_efin_xlsx.py snapshot.json out/EFIN_Data_Center.xlsx
python tools/build_dashboards.py taxx data.json out/Taxx-Savage-Data-Center.html
```

## Rules baked into the EFIN dashboard

- Bank returns (RA Disbursement Listing) and non-bank returns (WebReport / EFIN Pulls)
  are different populations, not duplicates.
- Balance Due = the unpaid non-bank invoice total.
- Any balance above zero means Risk High, access restricted, action "Disable tax prep access".
- The EFI Number List 2026 is the master EFIN-to-office map.

## Data safety

`.gitignore` blocks `out/`, `data/`, `*.xlsx`, `*.csv` and `snapshot*.json`. Never commit real data.
