# tests/screens_v21.py OUTDIR — v0.21: calculator cards in design order, light + dark. FAKE data. Server :8765.
import asyncio, sys, os
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.21'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
PAGES = [('01-size', '#/calc/size'), ('02-check', '#/calc/check'), ('03-ring', '#/calc/ring'), ('04-xfmr', '#/calc/xfmr'), ('05-contactor', '#/calc/contactor'),
         ('06-fault', '#/calc/fault'), ('07-solar', '#/calc/dc/pv'), ('09-dcplan-system', '#/calc/dc/plan/system'), ('10-dcplan-loads', '#/calc/dc/plan/loads')]
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for scheme in ['light', 'dark']:
            ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.6, is_mobile=True, has_touch=True, service_workers='block', color_scheme=scheme)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('http://localhost:8765/index.html#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED); await pg.reload(); await pg.wait_for_timeout(1000)
            for n, r in PAGES:
                await pg.goto('http://localhost:8765/index.html' + r); await pg.wait_for_timeout(900)
                # open the "More options" folds so every input shows
                for d in await pg.locator('details.more:not([open]) > summary').all():
                    try: await d.click(timeout=1000)
                    except Exception: pass
                await pg.wait_for_timeout(300)
                order = await pg.evaluate("[...document.querySelectorAll('[data-card]')].map(e => e.dataset.card).join(',')")
                print(scheme, n, order)
                await pg.screenshot(path=f'{OUT}/v21-{n}-{scheme}.png', full_page=True)
                if n == '07-solar':
                    await pg.locator('button:has-text("Battery leads")').first.click(); await pg.wait_for_timeout(600)
                    await pg.screenshot(path=f'{OUT}/v21-08-battery-{scheme}.png', full_page=True)
                    await pg.locator('button:has-text("Solar PV string")').first.click()
            await ctx.close()
        await b.close()
    print('errors:', errs)
asyncio.run(main())
