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

**A new file is ADDED to the data already stored for that report. It never replaces it** (`merge.ts`, used by `createUpload`):
new rows are added, a row that already exists is updated with the newer non-blank values (a blank never erases an earlier value), and rows that are not in the new file are kept.
The newest `uploads` row holds the combined data; older rows of the same report keep their history entry but their rows are emptied. The upload message says how many rows were added, updated, already there and kept.
Each row has a hidden `_key` column (dropped by `dropKeys` before any report page, the accounts or the analysis read the data):
| Report | Key |
| --- | --- |
| Federal Return Summaries | `ReturnID` |
| Refund Advantage listing | keyed hash (HMAC with `APP_PASSWORD`) of EFIN, PTIN, account number, application date, funding type, masked SSN and name, so no sensitive value is stored |
| Stripe | day + amount + customer email (the product label and the seconds differ between the Excel and CSV exports) |
| TAP | invoice number |
| Non-bank summary | EFIN + PTIN |
| EFIN list | EFIN |
| Balances / PTIN reference | sheet + email (+ name or PTIN) |
Identical lines inside one file stay apart through a repeat counter. A single-sheet report is paired with the stored one by position because two exports can name the sheet differently.
If data was uploaded before combining existed (no `_key`), the first new upload replaces it and says so. Uploading an older file on top of a newer one lets the older values win for rows they share (the latest upload wins). Deleting an upload removes the combined data for that report; re-upload to rebuild.
Verified on the Nov 1 files: a file merged with itself changes nothing, half a file then the whole file adds exactly the rest, five changed values update five rows, and the old and new Stripe exports combine into the new one (+650 new, 2,491 updated, 3,141 total).

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

## Ask & Calculate, EPS reference and column meanings

The **Ask & Calculate** page (`public/data-center/eps-reference.js`, `glossary.js`) is one search box that does three things, all without an AI service:
1. **Numbers from the loaded data.** "20% of the service fee", "$15 per return", "10% of prep fees in March", "20% of service fee for <office name>", "balances owed". It finds the percentage, the metric
   (service bureau, transmitter, prep fees, refund product fee, refunds funded, Stripe, TAP, payments, balances, returns), an optional office / segment (EFIN, PTIN, 10X) and an optional month, then shows the total and the share, with where it came from.
   The page reads the numbers from `window.dcData` (set in `dashboard.js`). Service bureau fees also show who receives them (the "EFIN receiving" column).
1b. **A specific office, client or line.** "tell me about <office>" shows an office profile (returns, bank / non-bank, RA funded, fees Taxx Savage earns, prep fees, Stripe + TAP paid, balance owed, preparers, what it owes; risk and prep access use the Offices-menu rule).
   A client (person) is found by full name, email or PTIN from the Accounts matching (fetched once with `call('accounts')` and cached) and shown with their own totals.
   "show lines for ...", "payments from <email>", "RA lines for <PTIN> in March", "the $59.99 charge for <office> on February 6" list matching Refund Advantage lines, returns, payments, TAP charges and balances,
   filtered by PTIN, email, office, date, month and amount, and limited to the kinds of line named in the question. Taxpayer names, SSNs and bank details are not stored, so lines cannot be found by taxpayer name.
2. **What a column means.** `glossary.js` explains every report column and dashboard term. Entries are marked "sure" (stated in the EPS documents or visible in the data) or "inferred" (worked out from the name and numbers; shown with an "inferred, confirm with EPS" tag).
   Hovering over any table heading shows the meaning as a tooltip. Never write a meaning as fact when it is only a guess.
3. **EPS rules.** A searchable summary of the 2025/2026 EPS Pay-per-Return guide (page numbers shown), the Refund Advance pricing calculator and the training log template, plus two calculators (advance interest: 36% APR on loans of $1,250 or more, capped at 60 days, $250/$500/$1,000 advances are 0%; preparer fees: $15 refund transfer, $34.95 in-season and $75 pre-ack marketing fee per approved advance, $45 processing fee).
   Also covered: the Refund Advantage Cancel Product Form (24-hour rule), Check Distribution Log, training log and the ERO Advance Walk-through (links only, not readable from the PDF); the RA and EPS advance calculators use the same prices. "What does a $2,500 advance cost over 29 days" is calculated directly (amount × 36% × days ÷ 365, capped at 60 days; $250/$500/$1,000 are free).
   Rates and dates change each season. Update the guide text when EPS publishes a new one. Do not copy the EPS or RA PDFs into the repo.

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

## PTIN Client Reference page (clean client list)

The page shows ONE table with three columns only: **Office name, Full name, Email address** (`buildClientList` in `accounts.ts`). The PTIN is kept behind the scenes: it is what matches payments and balances to a person, and it is still searchable, but it is not displayed.
One row per person, merged from every sheet. A PTIN identifies a person, so two PTINs are never merged even if they share an email (several preparers use their company's email). A row with no PTIN joins the person with the same email and name, else stays its own row. Section titles, repeated headings and notes are dropped.
With no heading row, the first text is the office and the full name is the next text that looks like a name (two words, or "Last, First"), not a one-word username. Names are only trimmed, not re-ordered. Emails lose stray brackets and punctuation.
**Privacy rule learned here:** the "10x and MSB" sheet has 8 and 9-digit numbers in column A (Excel stores them as `241431743.0`; an SSN that starts with 0 becomes 8 digits). They may be SSNs or EINs, so `scrubIds` removes 8-9 digit numbers and SSN-shaped values from the PTIN reference, balances, non-bank summary and EFIN list when storing, when merging, and when reading old stored data. A scan for SSN-like values must allow a trailing ".0". Phone numbers in that sheet (10 digits) are not scrubbed.
Verified on the real sheet: 1,102 people, 782 offices, all 959 distinct emails present, no heading rows, no digits-only offices, no one holding other people's emails.

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

## Bank pricing per return (report type `bank_pricing`)
Upload card "Bank pricing per return": one sheet per group (10X, MSB, TS EFIN, PTIN) with EFIN #, SB Fee, Total Trans fee, TS Rebate, Bank Fee, Bank Rebate. Rows with empty amounts are kept as "Price not set yet".
Meaning (confirmed by the owner): TS Rebate comes back to us; Bank Rebate goes back to the office. Merge key = group sheet + EFIN, so a newer file updates prices and adds EFINs.
Shown in: the "Pricing per return" menu (`views.ts` `pricingView`), each office's Pricing tab (`public/data-center/pricing.js`, expected = returns x price, a price check not money received), and Ask & Calculate ("pricing for EFIN 311686"). Prices reach the dashboard through `snapshot.pricing`.

## Releasing a change so AI Studio gets it

AI Studio syncs from the `main` branch of `angeliepesquira-spec/savage-tax-dashboard`. A change reaches AI Studio only when it is on `main`.
After every verified change:
1. `git fetch origin main`. AI Studio also commits to `main`, so if `main` moved, merge it into the working branch first and re-run the checks. Read what AI Studio changed (especially anything about storage or privacy) before merging.
2. Run `bunx tsc --noEmit` and prettier on `src/lib/data-center`. Run the security checklist in `skill/data-center-security/SKILL.md` for anything touching auth, uploads, storage, packages or page scripts. Then commit and push the working branch.
3. Fast-forward `main` to it and push (`git merge --ff-only`, never force-push, never rewrite pushed history).
4. Mirror skill and docs changes into `efin-data-center` too.
5. Tell the user what changed and that it is on `main`. Do not release anything that is known to be broken; say what is held back and why.

## Working rules for changes

- Do not change what existing menus show or how they look unless asked. Compare tab text against the approved dashboard when touching `public/data-center/`.
- Keep the DATA schema backward compatible (`sample-data/taxx-savage-data.empty.json`); new fields optional.
- Run `bunx tsc --noEmit` and prettier on `src/lib/data-center` and `src/routes/index.tsx` before pushing. (The rest of the repo has pre-existing lint noise.)
- Never use the word "TaxSlayer" in client-facing output (owner preference); say "the tax software".
