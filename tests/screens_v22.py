# tests/screens_v22.py OUTDIR — v0.22: 'Grouped how' N/A when not grouped, Table 4C1 rows when 2+. FAKE data. Server :8765.
import asyncio, sys, os
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.22'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
LIST = "s => { s.size = s.options.length; s.style.height = 'auto'; }"
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for scheme in ['light', 'dark']:
            ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.6, is_mobile=True, has_touch=True, service_workers='block', color_scheme=scheme)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('http://localhost:8765/index.html#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED); await pg.reload(); await pg.wait_for_timeout(900)
            for key, route, name in [('size1', '#/calc/size', 'size'), ('calc2', '#/calc/check', 'check')]:
                for state, g in [('na', ''), ('on', '4')]:
                    await pg.evaluate(f"(() => {{ const k = 'sparky.{key}'; const o = JSON.parse(localStorage.getItem(k) || '{{}}'); o.grouped = '{g}'; o.grouping = 'clipped'; o.cable = 'te'; o.method = '100'; localStorage.setItem(k, JSON.stringify(o)); }})()")
                    await pg.goto('http://localhost:8765/index.html#/calc'); await pg.wait_for_timeout(200)
                    await pg.goto('http://localhost:8765/index.html' + route); await pg.wait_for_timeout(900)
                    for d in await pg.locator('details.more:not([open]) > summary').all():
                        try: await d.click(timeout=1000)
                        except Exception: pass
                    gsel = pg.locator('label:has-text("Grouped how") select').first
                    if state == 'on': await gsel.evaluate(LIST)
                    await gsel.scroll_into_view_if_needed(); await pg.evaluate('window.scrollBy(0, 200)'); await pg.wait_for_timeout(400)
                    await pg.screenshot(path=f'{OUT}/v22-{name}-grouping-{state}-{scheme}.png')
                    if state == 'na':
                        m = pg.locator('label:has-text("reference method") select').first
                        await m.evaluate(LIST); await m.scroll_into_view_if_needed(); await pg.wait_for_timeout(300)
                        await pg.screenshot(path=f'{OUT}/v22-{name}-methods-{scheme}.png')
            await ctx.close()
        await b.close()
    print('errors:', errs)
asyncio.run(main())
