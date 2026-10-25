# tests/screens_v311.py OUTDIR: v0.31.1 Settings Drive note, phone (dark) + Mac 1440. FAKE data only.
import asyncio, sys, os
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.31.1'
BASE = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:8765/index.html'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for (w, hh) in [(1440, 900), (390, 844)]:
            phone = w < 900; tag = 'phone' if phone else 'mac'
            ctx = await b.new_context(viewport={'width': w, 'height': hh}, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone, service_workers='block', color_scheme='dark' if phone else 'light')
            pg = await ctx.new_page()
            await pg.goto(BASE + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED)
            await pg.goto(BASE + '#/settings'); await pg.reload(); await pg.wait_for_timeout(1000)
            el = pg.locator('p.note:has-text("Google Drive")').first
            await el.scroll_into_view_if_needed(); await pg.evaluate('scrollBy(0,-250)'); await pg.wait_for_timeout(200)
            print(tag, await el.text_content())
            await pg.screenshot(path=f'{OUT}/{tag}-settings-drive-note.png')
            await ctx.close()
        await b.close()
asyncio.run(main())
