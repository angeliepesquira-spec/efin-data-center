---
name: efin-data-center
description: Builds and refreshes Angelie's EFIN Data Center dashboard for Taxx Savage/BGE — pulling weekly Refund Advantage (RA EFIN), EFIN Pulls (federal return summary), and EFIN_NonBank_Summary files from the shared "EFIN Data Center" Google Drive folder, matching every EFIN to an office via the EFI Number List master, computing Bank vs Non-Bank returns and fees, flagging any outstanding balance for disabled access, and publishing/updating one interactive dashboard artifact (search, sort, nav, per-EFIN drill-down with PTIN lists, week selector). ALWAYS use this skill whenever Angelie mentions the EFIN Data Center, EFIN dashboard, weekly EFIN update, Refund Advantage/RA EFIN, EFIN Pulls, non-bank returns billing, EFIN balances, or asks to "run this week's EFIN update" — even if she doesn't spell out the process again.
---

# EFIN Data Center

Angelie (Taxx Savage / BGE) runs a weekly review of every EFIN (office)
processing returns through Taxx Savage. This skill is the whole pipeline
so she never re-explains it: she drops the week's files into one shared
Drive folder, says "run the EFIN update," and gets back an updated
dashboard at the same link every time.

**The live dashboard**: <your published artifact URL>
Always update this same artifact (publish with its `url`) — never create
a new one for a weekly run.

## Where everything lives

Shared Drive folder: **EFIN Data Center**
`https://drive.google.com/drive/folders/<EFIN_DATA_CENTER_FOLDER_ID>`
(owned by the Taxx Savage admin account — must be shared with whichever Google
account Claude is connected to. The folder itself can show up in search
before the files inside it are actually readable — that's a
sharing-propagation gap on the admin account side, not something
to retry silently; tell Angelie plainly if it happens).

### Reference file — the master mapping (always re-read fresh each run)

**`EFI Number List 2026`** — the master EFIN → Office Name mapping, in
tabs by category ("Taxx Pro", "Taxx Savage", "MSB", ...). This is the
single source of truth for "does this EFIN belong to a known office."
Angelie edits this sheet directly to assign EFINs that showed up
unidentified in a prior run — always re-read it in full at the start of
every run, since she may have just added rows to it.

### Weekly source files (read the newest ones each run)

- Root of the folder: **`EFIN_NonBank_Summary_<date range>`** (or
  `EFIN_NonBank_Summary_JanSep_2026`-style name) — a multi-tab Google
  Sheet:
  - A top **"Invoice Summary"** tab with one row per office (ERO Name,
    Email, Preparer Name, EFIN, PTIN, Rate per Return, Old paid, Total
    Returns, Billable Returns, Invoice Total, Sheet Link, Invoice Link).
  - One **detail tab per office**, with return-level rows (Preparer Name,
    PTIN, taxpayer, ReturnID, Refund, etc.) and its own Total
    Returns/Billable/Non-Billable/Invoice Total line.
  **The detail tabs are authoritative, not the top summary row** — in
  practice the summary row can go stale while the detail tabs are current
  (seen directly in earlier runs: several offices showed a lower total in the
  summary row than in their own detail tab). Always pull
  numbers from each office's own detail tab and flag any mismatch against
  the summary row to Angelie rather than silently picking one.
  A detail tab's freeform note line (e.g. "NEW company this period — rate
  not on file", "separate $599 flat fee — confirm") is real signal to
  carry into that office's notes, not decoration.
- **`RA EFIN 2026/`** subfolder — Refund Advantage disbursement data:
  `RA EFIN <date range>.xlsx`, one row per disbursed return (EFIN, Parent
  EFIN, Group EFIN, PTIN, taxpayer info, fee columns including "Service
  Bureau Fee"). This is **Bank Returns**: fees already collected via the
  refund at disbursement — no balance outstanding on these.
- **`EFIN Pulls 2026/`** subfolder —
  `WebReport_Federal Return Summary_<date range>` (sheet + CSV), one row
  per return with PTIN, Preparer Name, SBF Fee/SBF Paid, Total
  Transmission Fee/Transmission Fee Paid, Prep Fee/Preparer Fee Paid,
  etc. **This is the return-level detail behind the Non-Bank population**
  — its per-EFIN return counts match `EFIN_NonBank_Summary` almost
  exactly. Use it for: the PTIN + preparer name + return-count breakdown
  per EFIN, and for real paid/unpaid fee signals (compare *_Fee against
  *_Paid columns; don't infer non-payment from the fee amount alone).

If a file's date range doesn't match the others, use the most recent one
for each category and note the mismatch to Angelie rather than silently
mixing periods. When Angelie starts titling these files with the pull
date (her stated intent for future runs), read that date from the title
to know the period covered instead of assuming a fixed range.

## Bank returns vs Non-Bank returns — do not conflate

These are **two different populations of returns for the same office**,
not two reports of the same thing:
- **Bank returns**: processed via the RA bank product; Taxx Savage's fee
  (Service Bureau Fee) is deducted from the refund automatically at
  disbursement. Source: RA EFIN report. Column: **Bank Returns** / **RA
  Funded Returns**.
- **Non-Bank returns**: fees not collectible via a bank product, so
  they're invoiced directly to the office. Source: EFIN Pulls /
  EFIN_NonBank_Summary. Columns: **Non-Bank Returns**, **Non-Bank Invoice
  Total**, **Transmission Fee** (with paid/unpaid split).

A given EFIN can have both. Do not expect or flag their return counts as
"mismatched" against each other — that was an earlier mistake in this
project. A real mismatch is a fee/paid discrepancy (see below), not a
bank-vs-non-bank count difference.

## Balance Due and access — confirmed definitions

- **Balance Due = the unpaid Non-Bank Invoice Total only** for that EFIN
  (from the EFIN_NonBank_Summary reference sheet). Confirmed by Angelie:
  "use the balance due for the unpaid invoice." Do NOT add unpaid
  SBF/transmission fees on top — that was tried and reverted.
- **Any EFIN carrying a balance above zero → Risk Status "High", Tax Prep
  Access "Restricted"**, with Required Action: "Disable tax prep access
  — outstanding balance ($X) must be resolved first." This is a flat
  rule per Angelie's explicit instruction, not scaled by volume — a
  small balance restricts an office exactly like a large one. In
  practice this restricts most offices most weeks (confirmed 12 of 16 in
  the first real run) — say that plainly when reporting back so it isn't
  a silent surprise.
- An EFIN with **zero balance and active bank collection** → Risk "Low",
  Access "Full", action "Monitor bank collection; no restriction needed."
- An EFIN with **no activity this period** (zero bank returns, zero
  non-bank returns) → action "No activity seen this period."

The Decision Rules reference tab in the dashboard (Volume Tier, the
four-factor risk table, the "same balance treated differently by
production/collection capacity" principle) is kept as *background
context* for judgment calls, but the flat balance-→-restrict rule above
is the actual current instruction and takes precedence over it.

## Matching every EFIN to an office

1. Match every EFIN seen in RA EFIN, EFIN Pulls, or EFIN_NonBank_Summary
   against `EFI Number List 2026`.
2. If an EFIN has no match there, before giving up: check whether its
   PTINs appear under a named office tab in `EFIN_NonBank_Summary` or
   with a Preparer Name in EFIN Pulls — company identity can surface
   there even when the EFIN itself isn't yet in the master list (this is how
   offices were identified in earlier runs before being added to the master). Note the
   found name and that it still needs adding to the master, rather than
   silently treating it as fully resolved.
3. Anything still unidentified after both checks: do not guess. Angelie
   resolves these by editing `EFI Number List 2026` directly (she's done
   this before — check it fresh each run, since previously-unmatched
   EFINs can appear there now with no separate announcement).
4. Once everything matches, there is no separate "Needs Office
   Assignment" section in the dashboard — Angelie removed it as
   unnecessary once matching is complete. Only bring it back if she asks.

## Target schema (per EFIN, per week)

EFIN, Office Name, Bank Returns, Bank Fees (Service Bureau Fee), Volume
Tier, Bank Collection Available?, Non-Bank Returns (+ Billable),
Non-Bank Invoice Total, Transmission Fee (+ unpaid amount), Balance Due,
Risk Status, Tax Prep Access, Required Action, PTINs (ptin + preparer
name + return count, from EFIN Pulls; RA-only EFINs may only have bare
PTIN numbers with no preparer name — that's fine, list them anyway),
Sheet Link, Invoice Link.

## Weekly run procedure

1. Re-read `EFI Number List 2026` in full (she may have just edited it).
2. Identify this week's `EFIN_NonBank_Summary`, `RA EFIN`, and
   `WebReport_Federal Return Summary` files by most recent date/title.
3. Per EFIN: pull Bank Returns/Fees from RA EFIN; pull Non-Bank
   Returns/Invoice Total from the office's own detail tab in
   EFIN_NonBank_Summary (not the top summary row); pull Transmission Fee
   paid/unpaid and the PTIN+preparer+count breakdown from EFIN Pulls.
4. Match to office name per the matching procedure above.
5. Compute Balance Due, Volume Tier, Risk Status, Access, Required Action
   per the rules above.
6. Write this week's snapshot into the dashboard's own database
   (`db` capability, collection `snapshots`, doc id = the week's date)
   and republish the same artifact (pass its existing `url`) — never
   create a new artifact for a routine update.
7. Report back: total balance outstanding, how many offices are newly
   Restricted, any newly-identified-but-not-yet-in-master offices, and
   any fee/paid discrepancy worth Angelie's attention. Link the
   dashboard.

## Dashboard build notes

Published HTML artifact (`db` capability declared), single page:
- Sticky header: title only (no subtitle — Angelie removed
  "Taxx Savage · BGE Operations"), summary metric tiles (known EFINs,
  restricted count, total non-bank invoiced, total outstanding balance),
  and a week selector reading from the artifact's `db` history.
- Two tabs: **Account Status** (the main sortable/searchable table) and
  **Decision Rules** (the reference table + key-rule note). No
  "Needs Office Assignment" tab — removed per above.
- Main table row: EFIN, Office, Bank Returns, Volume Tier, Bank
  Collection, Non-Bank Returns, Balance Due (bank+non-bank owed
  combined), Risk/Restricted pill, Sheet link, Invoice link, Required
  Action, plus an expand (+) button.
- Expanding a row opens a two-panel drill-down: left panel is the
  Bank-vs-Non-Bank fee/return breakdown for that EFIN (not a
  "comparison to spot mismatches" — that framing was wrong; RA and
  EFIN Pulls are complementary populations, not duplicate reports); right
  panel is the PTIN list (ptin — preparer name — return count; bare PTIN
  number alone is fine when no preparer name is available).
- Search matches office name, EFIN, and any PTIN or preparer name under
  it.
- Styling: navy/teal/gold, clean and professional (matches Angelie's
  usual spreadsheet formatting preferences) — this is shared view-only
  with the team.

Confirm sharing/permissions with Angelie before assuming who should see a
given week's data.


## Standing rules added after the first real runs

- **Always follow the reference sheet** `EFIN_NonBank_Summary` (Google
  Sheet) for Sheet links, Invoice links and invoice totals per EFIN.
- **New file names**: RA data may arrive as a *Disbursement Listing*
  `.xlsx`; EFIN Pulls as `WebReport_Federal Return Summary` `.csv`.
- **Name conflicts**: when the office name from the data differs from the
  master list for the same EFIN, surface the conflict to Angelie; do not
  edit her list.
- **Period dating**: label each snapshot with the data period, e.g.
  "Jan 1 – Sep 19, 2026". If the invoice sheet covers a shorter period
  than the other files, say so.
- **Dashboard header**: title "EFIN Data Center" only, with no subtitle.
- **Privacy**: real balances, PTINs, emails and Stripe links never go into
  git. Use `tools/build_dashboards.py` with data kept outside the repo.
