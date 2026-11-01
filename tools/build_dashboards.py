#!/usr/bin/env python3
"""Inject real data into the code-only templates, producing a finished HTML file.

  python tools/build_dashboards.py efin  snapshot.json   out/efin_dashboard.html


The data JSON files must match sample-data/*.empty.json. Keep real data OUT of git
(see .gitignore) and write outputs to out/ (also ignored).
"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
KINDS = {
    "efin": (ROOT / "efin-dashboard/template.html", "SNAPSHOT"),
}

def main(kind, data_path, out_path):
    tpl_path, tag = KINDS[kind]
    data = json.load(open(data_path))
    html = tpl_path.read_text()
    pat = re.compile(r"/\*__%s__\*/.*?/\*__END__\*/" % tag, re.S)
    if not pat.search(html):
        sys.exit("marker not found in template")
    payload = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
    html = pat.sub(lambda m: "/*__%s__*/%s/*__END__*/" % (tag, payload), html, count=1)
    out = pathlib.Path(out_path); out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)
    print("wrote", out, f"({len(html):,} bytes)")

if __name__ == "__main__":
    if len(sys.argv) != 4 or sys.argv[1] not in KINDS:
        sys.exit(__doc__)
    main(*sys.argv[1:])
