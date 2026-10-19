# tests/pdf_overlap.py <file.pdf>... — checks that no two words on a page overlap
# (pdftotext -bbox word boxes). Prints overlaps; exit 1 if any.
import sys, subprocess, re, html
def words(pdf):
    out = subprocess.run(['pdftotext', '-bbox', pdf, '-'], capture_output=True, text=True).stdout
    pages = []
    for pg in re.findall(r'<page[^>]*>(.*?)</page>', out, re.S):
        ws = [(float(a), float(b), float(c), float(d), html.unescape(t)) for a, b, c, d, t in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', pg)]
        pages.append(ws)
    return pages
bad = 0
def sizes(pdf):
    out = subprocess.run(['pdftotext', '-bbox', pdf, '-'], capture_output=True, text=True).stdout
    return [(float(a), float(b)) for a, b in re.findall(r'<page width="([\d.]+)" height="([\d.]+)"', out)]
for pdf in sys.argv[1:]:
    sz = sizes(pdf)
    for pi, ws in enumerate(words(pdf), 1):
        W, H = sz[pi - 1]
        for w in ws:
            if w[0] < 14 or w[2] > W - 14 or w[1] < 14 or w[3] > H - 8:
                bad += 1; print(f'{pdf} p{pi}: "{w[4]}" is outside the page margins')
        # rotated (vertical) labels come out as tall narrow boxes: skip those
        ws = [w for w in ws if (w[3] - w[1]) < 2.2 * max(1, (w[2] - w[0])) or len(w[4]) == 1]
        ws.sort()
        for i, a in enumerate(ws):
            for b in ws[i + 1:]:
                if b[0] >= a[2]: break
                ix = min(a[2], b[2]) - max(a[0], b[0]); iy = min(a[3], b[3]) - max(a[1], b[1])
                if ix <= 0.3 or iy <= 0.3: continue
                sm = min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1]))
                if ix * iy > 0.2 * sm:
                    bad += 1; print(f'{pdf} p{pi}: "{a[4]}" overlaps "{b[4]}"')
print('overlaps:', bad); sys.exit(1 if bad else 0)
