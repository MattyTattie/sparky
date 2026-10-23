# make_icons.py — draws the Zs Pro icon (bold white "Zs" over a smaller,
# letter-spaced "PRO" on deep navy) as plain SVG paths, then saves the PNG
# sizes Android and browsers need. Only needed if you change the icon.
#   python3 make_icons.py            (needs fonttools + playwright, box only)
import asyncio, os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ICONS = os.path.join(HERE, "icons")
INTER = "/usr/share/fonts/truetype/sand-box/google/Inter/Inter-VariableFont_opsz,wght.ttf"
NAVY = "#0b1e3f"

def word(text, wght, size, track=0):
    f = instantiateVariableFont(TTFont(INTER), {"wght": wght, "opsz": 32})
    gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f["head"].unitsPerEm
    sc = size / upm; x = 0; parts = []; xmin = ymin = 1e9; xmax = ymax = -1e9
    for i, ch in enumerate(text):
        g = cmap[ord(ch)]; pen = SVGPathPen(gs, ntos=lambda v: str(round(v))); gs[g].draw(pen)
        bp = BoundsPen(gs); gs[g].draw(bp)
        if bp.bounds:
            a, b, c, d = bp.bounds; xmin = min(xmin, x + a); xmax = max(xmax, x + c); ymin = min(ymin, b); ymax = max(ymax, d)
        parts.append(f'<path transform="translate({x:.1f} 0)" d="{pen.getCommands()}"/>')
        x += gs[g].width + (track / sc if i < len(text) - 1 else 0)
    return parts, sc, (xmin, ymin, xmax, ymax)

def glyphs(text, wght, size, cx, baseline, track=0):
    parts, sc, (x0, y0, x1, y1) = word(text, wght, size, track)
    w = (x1 - x0) * sc
    tx = cx - w / 2 - x0 * sc
    return f'<g fill="#fff" transform="translate({tx:.1f} {baseline}) scale({sc:.5f} {-sc:.5f})">{"".join(parts)}</g>'

ZS = glyphs("Zs", 800, 300, 256, 322, track=-6)
PRO = glyphs("PRO", 700, 68, 256, 420, track=26)

def svg(scale=1.0, rounded=True):
    r = 112 if rounded else 0
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="{r}" fill="{NAVY}"/>'
            f'<g transform="translate(256 256) scale({scale}) translate(-256 -256)">{ZS}{PRO}</g></svg>')

async def main():
    os.makedirs(ICONS, exist_ok=True)
    open(os.path.join(ICONS, "icon.svg"), "w").write(svg())
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        for name, size, s, rnd in [("icon-192.png", 192, 1, True), ("icon-512.png", 512, 1, True),
                                   ("icon-maskable-512.png", 512, 0.78, False), ("favicon-32.png", 32, 1, True),
                                   ("apple-touch-icon.png", 180, 1, False)]:
            await pg.set_viewport_size({"width": size, "height": size})
            await pg.set_content(f'<html><body style="margin:0;background:transparent">{svg(s, rnd).replace("<svg ", f"<svg width={size} height={size} ")}</body></html>')
            await pg.screenshot(path=os.path.join(ICONS, name), omit_background=True)
        await b.close()
asyncio.run(main())
