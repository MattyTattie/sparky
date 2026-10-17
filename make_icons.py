# make_icons.py — draws the app icon (a lightning bolt on navy) and saves
# the PNG sizes Android needs. Only needed if you change the icon.
#   python3 make_icons.py
import asyncio, os
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ICONS = os.path.join(HERE, "icons")
def svg(scale=1.0, rounded=True):
    r = 104 if rounded else 0
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="{r}" fill="#1b3a6b"/>
<g transform="translate(256 256) scale({scale}) translate(-256 -256)"><path d="M292 52 L132 292 H244 L212 460 L380 212 H268 Z" fill="#f2b705" stroke="#fff" stroke-width="14" stroke-linejoin="round"/></g></svg>'''
async def main():
    os.makedirs(ICONS, exist_ok=True)
    open(os.path.join(ICONS, "icon.svg"), "w").write(svg())
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        for name, size, s, rnd in [("icon-192.png", 192, 1, True), ("icon-512.png", 512, 1, True), ("icon-maskable-512.png", 512, 0.72, False)]:
            await pg.set_viewport_size({"width": size, "height": size})
            await pg.set_content(f'<html><body style="margin:0;background:transparent">{svg(s, rnd).replace("<svg ", f"<svg width={size} height={size} ")}</body></html>')
            await pg.screenshot(path=os.path.join(ICONS, name), omit_background=True)
        await b.close()
asyncio.run(main())
