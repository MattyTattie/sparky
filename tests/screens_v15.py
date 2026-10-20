# tests/screens_v15.py OUTDIR IMPORTFILE - v0.15 shots (Import extra details preview, R1+R2 count fix). FAKE data (screens.py SEED).
import asyncio, sys, os, json
from playwright.async_api import async_playwright
src = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
OUT = sys.argv[1]; FILE = sys.argv[2]; URL = 'http://localhost:8765/index.html'
async def go(page, hash, wait=700):
    await page.evaluate(f"if (location.hash === '{hash}') window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = '{hash}'"); await page.wait_for_timeout(wait)
async def main():
    os.makedirs(OUT, exist_ok=True); errors = []; shots = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 460, 'height': 960}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block')
        page = await ctx.new_page(); page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        await page.goto(URL + '#/'); await page.wait_for_timeout(800); await page.evaluate(SEED); await page.reload(); await page.wait_for_timeout(800)
        async def snap(name, full=False):
            await page.screenshot(path=f'{OUT}/{name}', full_page=full); shots.append(name)
        await go(page, '#/settings')
        btn = page.locator('button:has-text("Import extra details")')
        await btn.scroll_into_view_if_needed(); await page.evaluate("scrollBy(0,-200)"); await page.wait_for_timeout(300)
        await snap('v15-1-settings-button.png')
        async with page.expect_file_chooser() as fc: await btn.click()
        await (await fc.value).set_files(FILE); await page.wait_for_timeout(900)
        await snap('v15-2-import-preview.png'); await snap('v15-2b-import-preview-full.png', True)
        await page.click('.stick button:has-text("Import")'); await page.wait_for_timeout(900)
        await go(page, '#/cert/cert-eic/boards'); await snap('v15-3-after-import-boards.png')
        await go(page, '#/cert/cert-eic/b/0/t/r1r2')
        rows = page.locator('.trow:not(.skip)')
        n = await rows.count()
        for i in range(n):
            ins = rows.nth(i).locator('input')
            await ins.nth(0).fill(''); await ins.nth(1).fill('')
        await rows.nth(0).locator('input').nth(1).fill('N/A')
        await rows.nth(1).locator('input').nth(0).fill('0.42'); await rows.nth(1).locator('input').nth(1).fill('N/A')
        await page.wait_for_timeout(500); await page.evaluate("document.querySelectorAll('.toast').forEach(t=>t.remove()); scrollTo(0,0)"); await page.wait_for_timeout(300)
        await snap('v15-4-r1r2-count-fixed.png')
        await b.close()
    print(json.dumps({'errors': errors, 'shots': shots}))
asyncio.run(main())
