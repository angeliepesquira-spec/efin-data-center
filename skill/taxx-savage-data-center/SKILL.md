---
name: taxx-savage-data-center
description: Builds, runs and maintains the Taxx Savage Data Center app (private tax-season dashboard with an Upload Data menu, Supabase storage and a data analysis step). Use when working on this repo, adding a report, changing how uploads are analysed, or running the weekly upload.
---

# Taxx Savage Data Center

Private dashboard for Taxx Savage's tax season: returns, funded (bank) returns, non-bank returns,
fees, balances owed, risk and prep access, Stripe/TAP payments, subscriptions and profit.
Built to look and behave like the original single-file dashboard the owner approved.

**Never put real data, emails, SSNs, bank numbers or invoice links in git, in this skill, or in chat summaries.**

## How the app is put together

| Part | Where | Notes |
| --- | --- | --- |
| Dashboard (all menus) | `public/data-center/` | Self-contained page with its own CSS, so it matches the approved design. Plain JS, no build step. `dashboard.js` exports `startDashboard(DATA, extras)`. |
| Host + password gate | `src/routes/index.tsx`, `src/lib/data-center/PasswordGate.tsx`, `DataCenterFrame.tsx` | Shows the dashboard in an iframe and answers its requests (postMessage bridge). |
| Server functions | `src/lib/data-center/api.functions.ts` (thin wrappers) -> `datacenter.server.ts` (logic) | Service-role Supabase client, every call checked against `APP_PASSWORD`. |
| Report registry, parsing, privacy | `src/lib/data-center/analyzers.ts` | `REPORTS`, `parseTable`, `sanitizeSheets`, `missingForAnalysis`. |
| Database | Supabase tables `uploads`, `snapshots` | Migration in `supabase/migrations/`. RLS on, no public policies. |
| Single-file export | `tools/build_single_html.py` | Standalone .html with data embedded (a snapshot; contains real data, keep private). |
| Docs | `docs/report-formats.md`, this skill | |

Stack: TanStack Start + React + TypeScript + Tailwind, Supabase Cloud. The project is synced with AI Studio
(`AGENTS.md`): commits to the connected branch show up there. Never force-push or rewrite pushed history.

## Secrets and access

`APP_PASSWORD` (shared password, required), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only, never in client code).
Access levels in the requirements (owner / Angelie / Christian) are **not built yet**: today there is one password.

## Upload Data menu

One card per report type (keys are stored in `uploads.report_type`):

| Key | Report | Notes |
| --- | --- | --- |
| `snapshot` | Dashboard data (data.json) | Ready-made DATA object. Stored in `snapshots`; the dashboard reads the newest. |
| `efin_list` | EFIN Number List (master EFIN -> office, sheets Taxx Pro / Taxx Savage / MSB, no header row) | Source of truth for office names. Covers 100% of EFINs in the Nov 1 reports. |
| `efin_summary` | Federal Return Summary, EFIN offices | CSV/XLSX, 113 columns |
| `ptin_summary` | Federal Return Summary, Taxx Savage EFINs / PTIN offices | CSV/XLSX, 113 columns |
| `refund_disbursements` | Refund Advantage disbursement listing | XLSX, 54 columns, pulled from the parent EFIN |
| `clients_balances` | Clients Balances | Multi-sheet hand-built workbook |
| `efin_invoices` | EFIN non-bank invoice summary | Summary sheet, one row per office |
| `ptin_clients` | PTIN Client Reference | Multi-sheet hand-built workbook |
| `stripe_payments` | Stripe Payments | One sheet, ~2,500 rows |
| `tap_payments` | TAP payments (AMP charges) | One sheet |

The newest upload per report type is the active one. Older uploads stay in the history.

## Privacy rules (already enforced in `sanitizeSheets`)

Raw exports hold full SSNs, bank routing/account numbers, birth dates, phones and addresses.
They are removed on the server **before anything is stored**:
- All report types: any column matching SSN, routing, account number, DOB, address, city, zip, card number, spouse.
- Federal Return Summary: allowlist (113 -> 51 columns). RA listing: allowlist (54 -> 39 columns).
- If a new report type or column is added, decide explicitly what is kept. Default to dropping identity data.
- Tax-return taxpayer lookups (Level 2 only in the requirements) show the last 4 of the SSN only.

## Business rules (from the owner's requirements)

1. **RA is the source of truth for bank products and funding.** The tax-software return report is not trusted for bank data.
2. **Non-bank** = every return not processed through the bank (amendments, extensions, prior year...).
3. Non-bank invoice = non-bank returns x rate per return - already paid. Rate is $20 or $39 per office depending on segment; confirm before assuming.
4. A return counts as a **bank product when the Bank code is V or F** (inferred from matching old counts; confirm with the owner).
5. **Own EFINs** (the 5 EFINs in `meta.ownEfins`) come from the Taxx Savage pull; **all other EFINs** come from the EFIN-offices pull. The two pulls overlap on own EFINs, so deduplicate. (Inferred; confirm.)
6. Any balance above zero -> Risk High, prep access Restricted. Zero balance and active bank collection -> Low / Full. Onboarding is allowed; prep access stays locked until paid; an EFIN is not released while it owes money.
7. Balances under $100 can be written off; PTIN balances over $100 stay on record (1099-C list, due about Jan 27; confirm with the accountant).
8. EFIN offices pay through the **bank sheet** (Excel, ready before Jan 1); PTIN offices pay through **prep-fee deduction**.
9. Always record the **pull date**; the newest pull is the default view. Built: see "Pull dates" below. Weekly snapshot comparison is not built yet.
10. Volume tiers (500+ = top) are editable in settings.
11. **A missing date never drops a row.** Rows are matched to the real client by PTIN (or EFIN / email) first. A blank or invalid date only means the row is left out of date-range filters and is listed in Data Health. Never discard a return, payment or balance because its date is missing or invalid (for example the year-2531 dates in the TAP report).

## Run analysis (builds the data the original menus read)

`analyze()` in `datacenter.server.ts` calls `buildSnapshot()` (`src/lib/data-center/snapshot.ts`) on the newest upload of every report and stores the
result as the newest `snapshots` row (label `analysis`). The dashboard shows the newest snapshot, so Offices, Stripe Payments, Disbursements, TAP,
Collections, Risk & Access, Data Health and Profit Outlook all fill in. Subscriptions are kept from the previous snapshot (they come from a separate file).
Confirmed with the owner:
- Offices = one **EFIN office** per EFIN that is not ours (named from the master list) + one **PTIN office per company** in the PTIN Client Reference (primary PTIN = the one with most rows).
- Own EFINs = the "Taxx Savage" sheet of the master list. Returns under own EFINs come from the Taxx Savage pull; every other EFIN from the EFIN-offices pull. Bank product = Bank code V or F.
- A payment or balance is matched by PTIN, then email, then full name. An email shared by several preparers goes to the **company**. Unmatched rows keep a blank office and show as unmatched.
- Performance on the menus: fees Taxx Savage earns (service bureau + transmitter), prep fees, refunds funded, balance owed.
Verified on the Nov 1 files: 11,617 returns, 10,921 funded lines, 775 offices (16 EFIN + 759 PTIN), no row points at a missing office, and the Offices / Stripe /
Disbursements / TAP / Data Health / Profit menus all render with no errors. TAP "bank" flag = the charge's last-4 + last name matches a V/F return.
Stripe: only Paid and Refunded rows count, less the refunded amount (the raw export also lists failed, canceled and unfinished attempts).
Large saves retry on connection errors ("fetch failed" / EPIPE). Every insert carries its own id, so a retry cannot duplicate a row.
Performance note: building the data takes about 10 seconds on a laptop. If the hosting limits CPU time per request, a very large analysis could be cut off; if so move it to a background job.

## Report-file pages

Each uploaded report has its own menu page under **Report files** (`public/data-center/reports.js`), showing the numbers calculated
from that one file, with no cross-report matching. The calculations are in `src/lib/data-center/views.ts` (`buildView`), served by
`reportView()` in `datacenter.server.ts`. EFIN office names are added when the master list is uploaded.
Verified against independent calculations from the raw files (Nov 1 pulls): Federal EFIN 11,617 returns / 6,992 bank / $5,168,011.85 prep fees;
Federal PTIN 9,996 / 5,713; RA 10,921 funded / $56,199,969.58 actual refunds; Stripe 2,491 payments / $349,156.90; TAP 425 charges / $25,195.80 due;
non-bank 9 offices / $8,867 invoiced (all rows reconcile).
Rules learned while verifying:
- Read amounts strictly: a date in an amount column must count as $0 and be reported, never read as its year (the TAP file has 5 such cells).
- Non-bank "Old paid" such as "85 paid" can mean 85 **returns** already paid (total - billable = 85), not dollars.
- The privacy filter must keep email columns (needed for matching) while dropping address columns.

## Pull dates

`detectPullDate()` in `analyzers.ts` runs on every table upload and stores `pullDate`, `pullDateSource`, `dataFrom`,
`dataThrough` and `dateNote` in `uploads.meta`. Order of trust:
1. A date in the file name (ISO `2026-11-01`, or `DD_MM_YYYY` for the Federal Return Summary, `MM_DD_YYYY` for others). When a name can be
   read two ways, the reading that is on or after the newest data row wins; otherwise it is flagged "check it".
2. The report's own period line (non-bank invoice summary: "Period: January 1 – September 1, 2026").
3. The newest date inside the data (Stripe created date, RA funding date, TAP payment date, return transmit date).
4. Nothing found (PTIN Client Reference, Clients Balances without a date in the name): the card asks for a manual date.
The Upload Data cards and history show the pull date, its source and the date range the data covers. A user can enter or correct
the pull date by hand (`setPullDate`). Dates read from cells accept Date objects, Excel serials, ISO, `M/D/YYYY` and `MM-DD-YYYY`;
anything outside 2020-2030 is ignored.

## What is built and what is not

Built: password gate, all menus matching the approved dashboard, Upload Data page (8 report cards + data.json), sanitised storage in Supabase, pull-date detection with manual override, upload history and delete, single-file export.

Not built yet (in this order):
1. ~~Run analysis~~ built (see above).
2. Weekly snapshot comparison (pull dates are already stored).
3. Access levels (owner / Angelie / Christian), per-role views.
4. Exports: bank sheet, Christian's weekly report, write-off (1099-C) list, end-of-season report.
5. Reminders and alerts (Saturday pull, unknown EFIN, deadlines).
6. AI chat panel answering only from the stored data.

## Verified facts about the data

- RA listing -> dashboard `ra` rows is a **direct column mapping** (verified: all 10,500 rows of the Oct 6 dashboard were found in the Nov 1 pull; dollar fields match on 99-100%, differences are later corrections).
- The 1 Nov Federal Return Summary pulls cover the whole season (Jan-Oct). The Oct 6 dashboard only had a window, so new totals are larger. That is expected.
- File names carry the pull date as DD_MM_YYYY (`..._01_11_2026_...` = 1 Nov 2026).
- TAP workbook has repeated header rows and some invalid dates (for example year 2531); the analysis must skip those rows.
- Clients Balances and PTIN Client Reference are hand-built with different layouts per sheet and some shifted columns. Parse by sheet name with per-sheet rules and report rows that do not parse (Data Health).

## Weekly run (target process)

1. Saturday: pull RA (from the parent EFIN, tax year 2025, Jan 1 to today, export unedited), the two Federal Return Summaries, Clients Balances, non-bank summary, Stripe, TAP; update the PTIN Client Reference and EFIN -> office list (tag old/new EFINs).
2. Sign in, Upload Data, upload each file on its card (Replace file for newer pulls).
3. Run analysis; check Data Health for unmatched EFINs/PTINs.
4. Review Overview, Collections, Risk & Access. Send Christian his report Monday (Tuesday latest): amounts owed and counts only, no revenue.

## Releasing a change so AI Studio gets it

AI Studio syncs from the `main` branch of `angeliepesquira-spec/savage-tax-dashboard`. A change reaches AI Studio only when it is on `main`.
After every verified change:
1. `git fetch origin main`. AI Studio also commits to `main`, so if `main` moved, merge it into the working branch first and re-run the checks. Read what AI Studio changed (especially anything about storage or privacy) before merging.
2. Run `bunx tsc --noEmit` and prettier on `src/lib/data-center`, then commit and push the working branch.
3. Fast-forward `main` to it and push (`git merge --ff-only`, never force-push, never rewrite pushed history).
4. Mirror skill and docs changes into `efin-data-center` too.
5. Tell the user what changed and that it is on `main`. Do not release anything that is known to be broken; say what is held back and why.

## Working rules for changes

- Do not change what existing menus show or how they look unless asked. Compare tab text against the approved dashboard when touching `public/data-center/`.
- Keep the DATA schema backward compatible (`sample-data/taxx-savage-data.empty.json`); new fields optional.
- Run `bunx tsc --noEmit` and prettier on `src/lib/data-center` and `src/routes/index.tsx` before pushing. (The rest of the repo has pre-existing lint noise.)
- Never use the word "TaxSlayer" in client-facing output (owner preference); say "the tax software".
