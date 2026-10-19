# tests/screens_v13b.py - both photos of ONE board scanned together: combined numbering on the review screen.
# Usage: python3 tests/screens_v13b.py OUTDIR top.jpg bottom.jpg   (photos stay on the box)
import asyncio, sys, os, json
from playwright.async_api import async_playwright
src = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
OUT, PHOTOS = sys.argv[1], sys.argv[2:]
async def main():
    errors = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block')
        page = await ctx.new_page(); page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto('http://localhost:8765/index.html#/'); await page.wait_for_timeout(800); await page.evaluate(SEED)
        await page.evaluate("async () => { const db = await import('/js/db.js'); const c = await db.get('certs', 'cert-eic'); c.boards[0].circuits = []; await db.put('certs', c); }")
        await page.reload(); await page.wait_for_timeout(800)
        await page.evaluate("location.hash = '#/cert/cert-eic/b/0/scan'"); await page.wait_for_timeout(800)
        async with page.expect_file_chooser() as fc: await page.click('button:has-text("From gallery")')
        await (await fc.value).set_files(PHOTOS); await page.wait_for_timeout(2000)
        await page.click('.stick button:has-text("Read")'); await page.wait_for_selector('.waycard', timeout=180000); await page.wait_for_timeout(600)
        await page.screenshot(path=f'{OUT}/v13-3a-combined-numbering.png')
        nums = await page.evaluate("[...document.querySelectorAll('.waycard')].map((c) => (c.querySelector('b')||{}).textContent + ' ' + ((c.querySelector('.rating')||{}).value||'') + ' ' + ((c.querySelectorAll('input:not([type=checkbox])')[1]||{}).value||''))")
        await page.evaluate("[...document.querySelectorAll('.waycard')].find((c) => /Circuit 14\\b/.test(c.textContent))?.scrollIntoView({block:'start'})"); await page.wait_for_timeout(300)
        await page.screenshot(path=f'{OUT}/v13-3b-row-change-and-spd-mcb.png')
        await page.evaluate("[...document.querySelectorAll('.waycard')].find((c) => /Circuit 29\\b/.test(c.textContent))?.scrollIntoView({block:'start'})"); await page.wait_for_timeout(300)
        await page.screenshot(path=f'{OUT}/v13-3c-last-circuit.png')
        await page.click('.stick button:has-text("Add")'); await page.wait_for_timeout(1500)
        board = await page.evaluate("async () => { await (await import('/js/state.js')).flush(); const b = (await (await import('/js/db.js')).get('certs', 'cert-eic')).boards; return { n: b.length, spd: b[0].spdDevice, c: b[0].circuits.map((c) => c.num + ' ' + c.type + c.rating + ' ' + c.desc) }; }")
        await b.close()
    print(json.dumps({'errors': errors, 'review': nums, 'saved': board}, indent=0))
asyncio.run(main())
