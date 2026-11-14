# tests/pdf_overlap.py <file.pdf> [file.svg|file.json]...
# 1) no two words on a page overlap (pdftotext -bbox)
# 2) on wiring-diagram sheets, no word sits on a symbol shape (socket faceplate, FCU, heater box, …)
#    — the word-vs-word pass alone misses a label drawn through a faceplate.
# Prints overlaps; exit 1 if any. Optional .json shape dumps (from layout())
# and .svg files use the same text-vs-symbol rule, so 390/1440 screens can be checked too.
import sys, subprocess, re, html, json
from pathlib import Path

CAPTION = re.compile(
    r'^(JB|EV|IP|N|\+|MCB|RCBO|Spare|Rail|Rad|Cooker|Hob|PV|Shower|Alarm|'
    r'Immersion|T2|DB\d*|C?\d+|B\d+|A\d+|RCD|SPD|KM\d*|Ctrl|EE|A|DP|13A|ISO)$',
    re.I,
)

def pdf_words(pdf):
    out = subprocess.run(['pdftotext', '-bbox', pdf, '-'], capture_output=True, text=True).stdout
    pages = []
    for pg in re.findall(r'<page[^>]*>(.*?)</page>', out, re.S):
        ws = [(float(a), float(b), float(c), float(d), html.unescape(t)) for a, b, c, d, t in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', pg)]
        pages.append(ws)
    return pages

def pdf_sizes(pdf):
    out = subprocess.run(['pdftotext', '-bbox', pdf, '-'], capture_output=True, text=True).stdout
    return [(float(a), float(b)) for a, b in re.findall(r'<page width="([\d.]+)" height="([\d.]+)"', out)]

def symbol_rects_from_drawings(drawings, max_w=48, max_h=36, min_w=6, min_h=6):
    """Small filled-white (or near-white) rects: faceplates and load boxes, not page-wide headers."""
    out = []
    for d in drawings:
        r = d.get('rect')
        if r is None:
            continue
        w, h = r.width, r.height
        fill = d.get('fill')
        if not (min_w < w < max_w and min_h < h < max_h):
            continue
        if fill and fill[0] > 0.9:
            out.append((r.x0, r.y0, r.x1, r.y1))
    return out

def badge_rects_from_drawings(drawings):
    """Small coloured badges (the IP mark on an outdoor socket's corner)."""
    out = []
    for d in drawings:
        r = d.get('rect'); fill = d.get('fill')
        if r is not None and fill and fill[0] < 0.6 and r.width < 30 and r.height < 16:
            out.append((r.x0, r.y0, r.x1, r.y1))
    return out

def text_symbol_hits(words, rects, badges=()):
    hits = []
    for w in words:
        txt = w[4]
        cx, cy = (w[0] + w[2]) / 2, (w[1] + w[3]) / 2
        # v0.48.1: a caption sat in its own badge overlaps the plate by design
        if CAPTION.match(txt) and any(b[0] < cx < b[2] and b[1] - 1 < cy < b[3] + 1 for b in badges):
            continue
        for r in rects:
            ix = min(w[2], r[2]) - max(w[0], r[0])
            iy = min(w[3], r[3]) - max(w[1], r[1])
            if ix <= 0.35 or iy <= 0.35:
                continue
            area = ix * iy
            ta = max(0.01, (w[2] - w[0]) * (w[3] - w[1]))
            sa = max(0.01, (r[2] - r[0]) * (r[3] - r[1]))
            if area <= 0.12 * min(ta, sa) and area < 2.5:
                continue
            contained = area > 0.7 * ta
            if contained and CAPTION.match(txt):
                continue
            hits.append((txt, r, area))
    return hits

def check_pdf_symbols(pdf):
    try:
        import pymupdf
    except ImportError:
        print(f'{pdf}: pymupdf not available, skipping text-vs-symbol check', file=sys.stderr)
        return []
    hits = []
    doc = pymupdf.open(pdf)
    for pi, page in enumerate(doc, 1):
        words = list(page.get_text('words'))
        # wiring-diagram sheets only: other pages put text inside boxes on purpose (pills, tables)
        head = ' '.join(w[4] for w in words[:6])
        if 'WIRING DIAGRAM' not in head:  # the certificate's single-line diagram sheet (DC plan pills hold text on purpose)
            continue
        dr = page.get_drawings()
        rects = symbol_rects_from_drawings(dr)
        for txt, r, area in text_symbol_hits(words, rects, badge_rects_from_drawings(dr)):
            hits.append((pi, txt, r, area))
    return hits

def load_json_shapes(path):
    data = json.loads(Path(path).read_text())
    pages = data if isinstance(data, list) else data.get('pages', [data])
    out = []
    for pg in pages:
        words = []
        for t in pg.get('texts', pg.get('words', [])):
            if 'x0' in t:
                words.append((t['x0'], t['y0'], t['x1'], t['y1'], t.get('txt') or t.get('text') or ''))
            else:
                words.append((t['x'], t['y'], t['x'] + t['w'], t['y'] + t['h'], t.get('txt') or t.get('text') or ''))
        rects = []
        for r in pg.get('rects', pg.get('symbols', [])):
            if 'x1' in r:
                rects.append((r['x0'], r['y0'], r['x1'], r['y1']))
            else:
                w, h = r['w'], r['h']
                if 6 < w < 50 and 6 < h < 40:
                    rects.append((r['x'], r['y'], r['x'] + w, r['y'] + h))
        out.append((words, rects, pg.get('name', path)))
    return out

def load_svg_shapes(path):
    raw = Path(path).read_text()
    words, rects = [], []
    for m in re.finditer(r'<text\b([^>]*)>([^<]*)</text>', raw, re.I):
        attrs, txt = m.group(1), html.unescape(m.group(2)).strip()
        if not txt:
            continue
        xs = re.search(r'\bx="([\d.]+)"', attrs)
        ys = re.search(r'\by="([\d.]+)"', attrs)
        fs = re.search(r'font-size="([\d.]+)"', attrs) or re.search(r'font-size:\s*([\d.]+)', attrs)
        if not xs or not ys:
            continue
        x, y = float(xs.group(1)), float(ys.group(1))
        size = float(fs.group(1)) if fs else 10
        # SVG y is baseline; approximate the ink box
        w = max(4, 0.56 * size * len(txt))
        anchor = 'start'
        am = re.search(r'text-anchor="(\w+)"', attrs)
        if am:
            anchor = am.group(1)
        if anchor == 'middle':
            x0 = x - w / 2
        elif anchor == 'end':
            x0 = x - w
        else:
            x0 = x
        words.append((x0, y - size * 0.8, x0 + w, y + size * 0.22, txt))
    for m in re.finditer(r'<rect\b([^>]*)/?>', raw, re.I):
        attrs = m.group(1)
        def attr(n, d=0):
            mm = re.search(rf'\b{n}="([\d.]+)"', attrs)
            return float(mm.group(1)) if mm else d
        x, y, w, h = attr('x'), attr('y'), attr('width'), attr('height')
        fill = re.search(r'\bfill="([^"]+)"', attrs)
        if 6 < w < 50 and 6 < h < 40 and (not fill or fill.group(1) not in ('none', 'transparent')):
            rects.append((x, y, x + w, y + h))
    return [(words, rects, path)]

bad = 0
args = [a for a in sys.argv[1:] if not a.startswith('-')]
for f in args:
    path = Path(f)
    suf = path.suffix.lower()
    if suf == '.pdf':
        sz = pdf_sizes(f)
        for pi, ws in enumerate(pdf_words(f), 1):
            W, H = sz[pi - 1]
            for w in ws:
                if w[0] < 14 or w[2] > W - 14 or w[1] < 14 or w[3] > H - 8:
                    bad += 1; print(f'{f} p{pi}: "{w[4]}" is outside the page margins')
            ws2 = [w for w in ws if (w[3] - w[1]) < 2.2 * max(1, (w[2] - w[0])) or len(w[4]) == 1]
            ws2.sort()
            for i, a in enumerate(ws2):
                for b in ws2[i + 1:]:
                    if b[0] >= a[2]: break
                    ix = min(a[2], b[2]) - max(a[0], b[0]); iy = min(a[3], b[3]) - max(a[1], b[1])
                    if ix <= 0.3 or iy <= 0.3: continue
                    sm = min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1]))
                    if ix * iy > 0.2 * sm:
                        bad += 1; print(f'{f} p{pi}: "{a[4]}" overlaps "{b[4]}"')
        for pi, txt, r, area in check_pdf_symbols(f):
            bad += 1
            print(f'{f} p{pi}: "{txt}" overlaps a symbol at ({r[0]:.1f},{r[1]:.1f},{r[2]-r[0]:.1f}x{r[3]-r[1]:.1f})')
    elif suf == '.json':
        for words, rects, name in load_json_shapes(f):
            for txt, r, area in text_symbol_hits(words, rects):
                bad += 1
                print(f'{name}: "{txt}" overlaps a symbol at ({r[0]:.1f},{r[1]:.1f},{r[2]-r[0]:.1f}x{r[3]-r[1]:.1f})')
    elif suf == '.svg':
        raw = Path(f).read_text(); badges = []
        for m in re.finditer(r'<rect\b([^>]*)/?>', raw, re.I):  # v0.48.1: coloured badges (IP mark)
            at = m.group(1); g = lambda n: float((re.search(rf'\b{n}="([\d.]+)"', at) or [0, 0])[1])
            fl = re.search(r'\bfill="([^"]+)"', at)
            if fl and fl.group(1).lower() not in ('none', 'transparent', '#fff', '#ffffff', 'white') and not fl.group(1).lower().startswith('rgb(255') and g('width') < 30 and g('height') < 16:
                badges.append((g('x'), g('y'), g('x') + g('width'), g('y') + g('height')))
        for words, rects, name in load_svg_shapes(f):
            rects = [r for r in rects if r not in badges]
            for txt, r, area in text_symbol_hits(words, rects, badges):
                bad += 1
                print(f'{name}: "{txt}" overlaps a symbol at ({r[0]:.1f},{r[1]:.1f},{r[2]-r[0]:.1f}x{r[3]-r[1]:.1f})')
    else:
        print(f'{f}: unknown type (expected .pdf, .json or .svg)', file=sys.stderr)
        bad += 1
print('overlaps:', bad)
sys.exit(1 if bad else 0)
