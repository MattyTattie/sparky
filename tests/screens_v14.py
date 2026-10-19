# tests/screens_v14.py OUTDIR - v0.14 shots (RCD group, other sources, test across circuits). FAKE data (screens.py SEED).
import asyncio, sys, os, json
from playwright.async_api import async_playwright
src = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
OUT = sys.argv[1]; URL = 'http://localhost:8765/index.html'
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
        # 1. circuit page: RCD group under the protective device
        await go(page, '#/cert/cert-eic/b/0/c/1')
        await page.evaluate("document.querySelector('.rcdgrp').scrollIntoView({block:'center'})"); await page.wait_for_timeout(300)
        await snap('v14-1-circuit-rcd-with-device.png')
        await snap('v14-1b-circuit-full.png', True)
        # 2. other sources
        await go(page, '#/cert/cert-eic/s/supply')
        await page.click('label:has-text("Other sources of supply")'); await page.wait_for_timeout(500)
        await page.wait_for_timeout(3500); await page.evaluate("document.querySelector('h2.sec').scrollIntoView({block:'start'})"); await page.wait_for_timeout(300)
        await snap('v14-2a-sources-empty.png')
        await page.evaluate("document.querySelectorAll('.toast').forEach(t=>t.remove())"); await page.locator('button:has-text("Add a source")').click(); await page.wait_for_timeout(400)
        await page.click('.srccard .chip:has-text("PV inverter")'); await page.wait_for_timeout(400)
        async def typ(label, val, nth=0):
            await page.locator('.srccard').nth(nth).locator('label.f', has_text=label).locator('input, textarea').first.fill(val)
        await typ('Make and model', 'Example Solar 3.6 kW inverter'); await typ('Rating', '3.6'); await typ('G98', 'G98-SAMPLE-0001')
        await typ('Means of isolation', 'AC isolator beside the consumer unit; DC isolator on the inverter in the loft')
        await page.locator('button:has-text("Add another source")').click(); await page.wait_for_timeout(400)
        await page.locator('.srccard >> nth=1').locator('.chip:has-text("Battery storage")').click(); await page.wait_for_timeout(400)
        await typ('Make and model', 'Example 5.2 kWh battery', 1); await typ('Means of isolation', 'Isolator on the battery, garage', 1)
        await page.evaluate("scrollTo(0,0)"); await page.wait_for_timeout(300)
        await snap('v14-2b-supply-status.png')
        await page.evaluate("document.querySelectorAll('.srccard')[0].scrollIntoView({block:'start'})"); await page.wait_for_timeout(300)
        await snap('v14-2c-sources-filled.png')
        # 3. board page entry + test across
        await go(page, '#/cert/cert-eic/b/0'); await snap('v14-3a-board-button.png')
        for t in ['r1r2', 'ring', 'ir', 'zs', 'rcd']:
            await go(page, f'#/cert/cert-eic/b/0/t/{t}'); await snap(f'v14-3-{t}.png')
        await go(page, '#/cert/cert-eic/b/0/t/zs')
        inp = page.locator('.trow:not(.skip) input').first; await inp.fill('9.9'); await page.wait_for_timeout(300)
        await snap('v14-3z-zs-red-flag.png')
        await inp.fill(''); await page.wait_for_timeout(300)
        # 4. EICR too
        await go(page, '#/cert/cert-eicr/b/0/t/ir'); await snap('v14-4-eicr-ir.png')
        await b.close()
    print(json.dumps({'errors': errors, 'shots': shots}))
asyncio.run(main())
