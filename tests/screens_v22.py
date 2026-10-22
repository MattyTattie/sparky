# tests/screens_v22.py OUTDIR — v0.22: full-wording pickers (Grouped how, How it's installed), open lists and More info sheets. FAKE data. Server :8765.
import asyncio, sys, os
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.22'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for scheme in ['light', 'dark']:
            ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.6, is_mobile=True, has_touch=True, service_workers='block', color_scheme=scheme)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('http://localhost:8765/index.html#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED); await pg.reload(); await pg.wait_for_timeout(900)
            async def go(key, route, g):
                await pg.evaluate(f"(() => {{ const k = 'sparky.{key}'; const o = JSON.parse(localStorage.getItem(k) || '{{}}'); o.grouped = '{g}'; o.grouping = 'tray'; o.cable = 'te'; o.method = '101'; localStorage.setItem(k, JSON.stringify(o)); }})()")
                await pg.goto('http://localhost:8765/index.html#/calc'); await pg.wait_for_timeout(200)
                await pg.goto('http://localhost:8765/index.html' + route); await pg.wait_for_timeout(900)
                for d in await pg.locator('details.more:not([open]) > summary').all():
                    try: await d.click(timeout=1000)
                    except Exception: pass
                await pg.wait_for_timeout(300)
            async def field(lab):
                f = pg.locator('.pkfield', has=pg.locator('.pklab span', has_text=lab)).first
                await f.scroll_into_view_if_needed(); await pg.evaluate('window.scrollBy(0, 120)'); await pg.wait_for_timeout(300); return f
            for key, route, name in [('size1', '#/calc/size', 'size'), ('calc2', '#/calc/check', 'check')]:
                await go(key, route, '')
                await field('Grouped how'); await pg.screenshot(path=f'{OUT}/v22-{name}-fields-na-{scheme}.png')
                await go(key, route, '4')
                f = await field('How it'); await pg.screenshot(path=f'{OUT}/v22-{name}-fields-on-{scheme}.png')
                if name == 'size':
                    await f.locator('.pkbtn').click(); await pg.wait_for_timeout(500); await pg.screenshot(path=f'{OUT}/v22-{name}-method-list-{scheme}.png'); await pg.locator('.pksheet button:text-is("Close")').click()
                    await f.locator('.infolink').click(); await pg.wait_for_timeout(500); await pg.screenshot(path=f'{OUT}/v22-{name}-method-info-{scheme}.png'); await pg.locator('.pksheet button:text-is("Close")').click()
                    g = await field('Grouped how')
                    await g.locator('.pkbtn').click(); await pg.wait_for_timeout(500); await pg.screenshot(path=f'{OUT}/v22-{name}-group-list-{scheme}.png'); await pg.locator('.pksheet button:text-is("Close")').click()
                    await g.locator('.infolink').click(); await pg.wait_for_timeout(500); await pg.screenshot(path=f'{OUT}/v22-{name}-group-info-{scheme}.png')
                    await pg.locator('.pksheet').evaluate('e => e.scrollTop = e.scrollHeight'); await pg.wait_for_timeout(200); await pg.screenshot(path=f'{OUT}/v22-{name}-group-info-end-{scheme}.png'); await pg.locator('.pksheet button:text-is("Close")').click()
            await ctx.close()
        await b.close()
    print('errors:', errs)
asyncio.run(main())
