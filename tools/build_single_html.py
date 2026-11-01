#!/usr/bin/env python3
"""Build ONE self-contained Taxx-Savage-Data-Center.html from the Vite source.

  python tools/build_single_html.py data.json out/Taxx-Savage-Data-Center.html

Inlines styles, logo, dashboard code and the data. Keep the output out of git (out/ is ignored).
"""
import base64, json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

def main(data_path, out_path):
    data = json.load(open(data_path))
    idx = (ROOT / "index.html").read_text()
    css = (ROOT / "src/styles.css").read_text()
    js = (ROOT / "src/dashboard.js").read_text().replace("export function startDashboard", "function startDashboard")
    logo = base64.b64encode((ROOT / "public/logo.png").read_bytes()).decode()
    head = idx[: idx.index("</head>")]
    body = re.search(r'<div id="root">\n(.*?)\n</div>\n<script src', idx, re.S).group(1)
    body = body.replace('src="/logo.png"', 'src="data:image/png;base64,%s"' % logo)
    payload = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
    html = (head + "<style>\n" + css + "\n</style>\n</head>\n<body>\n" + body +
            '\n<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" onerror="window.__noxlsx=1"></script>\n'
            "<script>\n" + js + "\nstartDashboard(" + payload + ");\n</script>\n</body>\n</html>\n")
    out = pathlib.Path(out_path); out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)
    print("wrote", out, f"({len(html):,} bytes)")

if __name__ == "__main__":
    if len(sys.argv) != 3: sys.exit(__doc__)
    main(*sys.argv[1:])
