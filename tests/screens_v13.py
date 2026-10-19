# tests/screens_v13.py - v0.13 scan review shots. Photos come from the command line (box only, never in the repo).
# Usage: python3 tests/screens_v13.py OUTDIR photo1.jpg [photo2.jpg ...]
import asyncio, sys, os, json
from playwright.async_api import async_playwright
src = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
OUT, PHOTOS = sys.argv[1], sys.argv[2:]
URL = 'http://localhost:8765/index.html'
async def main():
    os.makedirs(OUT, exist_ok=True); errors = []; shots = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block')
        page = await ctx.new_page(); page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(URL + '#/'); await page.wait_for_timeout(800); await page.evaluate(SEED); await page.reload(); await page.wait_for_timeout(800)
        for n, ph in enumerate(PHOTOS, 1):
            await page.evaluate("location.hash = '#/'"); await page.wait_for_timeout(300)
            await page.evaluate("location.hash = '#/cert/cert-eic/b/0/scan'"); await page.wait_for_timeout(800)
            async with page.expect_file_chooser() as fc: await page.click('button:has-text("From gallery")')
            await (await fc.value).set_files(ph); await page.wait_for_timeout(1500)
            await page.click('.stick button:has-text("Read")')
            await page.wait_for_selector('.waycard', timeout=120000); await page.wait_for_timeout(600)
            await page.screenshot(path=f'{OUT}/v13-{n}a-review-top.png'); shots.append(f'v13-{n}a-review-top.png')
            await page.evaluate("document.querySelectorAll('.waycard')[3].scrollIntoView({block:'start'})"); await page.wait_for_timeout(300)
            await page.screenshot(path=f'{OUT}/v13-{n}b-review-labels.png'); shots.append(f'v13-{n}b-review-labels.png')
            await page.click('button:has-text("adjust box")'); await page.wait_for_timeout(600); await page.evaluate("scrollTo(0,0)")
            await page.screenshot(path=f'{OUT}/v13-{n}c-label-box.png'); shots.append(f'v13-{n}c-label-box.png')
        await b.close()
    print(json.dumps({'errors': errors, 'shots': shots}))
asyncio.run(main())
