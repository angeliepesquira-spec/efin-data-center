#!/usr/bin/env python3
"""Build the EFIN Data Center workbook from a weekly snapshot JSON.

  python tools/build_efin_xlsx.py snapshot.json out/EFIN_Data_Center.xlsx

Summary tab (red = Restricted, green = OK, yellow = no activity) plus one tab per EFIN
with stats, required action, notes and the PTIN table.
"""
import json, pathlib, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

FILL = {"restricted": PatternFill("solid", fgColor="F8D7DA"),
        "ok": PatternFill("solid", fgColor="D4EDDA"),
        "idle": PatternFill("solid", fgColor="FFF3CD")}
HEAD = PatternFill("solid", fgColor="1F3A5F")
COLS = ["EFIN", "Office", "Bank Returns", "Bank Fees", "Volume Tier", "Bank Collection",
        "Non-Bank Returns", "Unpaid Invoice / Balance Due", "Risk", "Access",
        "Required Action", "Sheet Link", "Invoice Link"]

def status(r):
    if (r.get("balance_due") or 0) > 0: return "restricted"
    if not (r.get("bank_returns") or 0) and not (r.get("nonbank_returns") or 0): return "idle"
    return "ok"

def main(src, out):
    snap = json.load(open(src))
    wb = Workbook(); ws = wb.active; ws.title = "Summary"
    ws.append(COLS)
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF"); c.fill = HEAD
        c.alignment = Alignment(wrap_text=True, vertical="center")
    rows = sorted(snap["matched"], key=lambda r: -(r.get("balance_due") or 0))
    for r in rows:
        ws.append([r["efin"], r.get("office"), r.get("bank_returns"), r.get("bank_fees"),
                   r.get("volume_tier"), r.get("bank_collection"), r.get("nonbank_returns"),
                   r.get("balance_due"), r.get("risk"), r.get("access"),
                   r.get("required_action"), r.get("sheet_link"), r.get("invoice_link")])
        for c in ws[ws.max_row]: c.fill = FILL[status(r)]
    for i, w in enumerate([10, 32, 12, 12, 14, 16, 14, 18, 8, 12, 50, 30, 30], 1):
        ws.column_dimensions[chr(64 + i)].width = w
    ws.freeze_panes = "C2"
    for r in rows:
        t = wb.create_sheet(str(r["efin"])[:31])
        t.append(["EFIN", r["efin"]]); t.append(["Office", r.get("office")])
        t.append(["Balance Due", r.get("balance_due")])
        t.append(["Required Action", r.get("required_action")])
        t.append(["Notes", r.get("notes")]); t.append([])
        t.append(["PTIN", "Preparer", "Returns"])
        for p in r.get("ptins", []): t.append([p.get("ptin"), p.get("preparer"), p.get("returns")])
        t.column_dimensions["A"].width = 18; t.column_dimensions["B"].width = 36
    pathlib.Path(out).parent.mkdir(parents=True, exist_ok=True)
    wb.save(out); print("wrote", out, f"({len(wb.sheetnames)} sheets)")

if __name__ == "__main__":
    if len(sys.argv) != 3: sys.exit(__doc__)
    main(*sys.argv[1:])
