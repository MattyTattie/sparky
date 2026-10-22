# tests/screens_v23.py OUTDIR — v0.23: Iz after factors in the answers (radial, ring, grouped). FAKE data. Server :8765.
import asyncio, sys, os, json
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.23'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
SIZE = [('size-radial', {'phase': '1', 'loadType': 'general', 'load': '28', 'unit': 'A', 'length': '20', 'cable': 'te', 'method': 'C', 'grouped': '1', 'device': 'mcb', 'type': 'auto', 'ze': '0.35', 'ci': '1', 'ambient': '30'}),
        ('size-ring', {'phase': '1', 'loadType': 'ring', 'load': '20', 'unit': 'A', 'length': '40', 'cable': 'te', 'method': 'C', 'grouped': '1', 'device': 'mcb', 'type': 'auto', 'ze': '0.35', 'ci': '1', 'ambient': '30'}),
        ('size-grouped', {'phase': '1', 'loadType': 'general', 'load': '28', 'unit': 'A', 'length': '20', 'cable': 'te', 'method': '100', 'grouped': '4', 'grouping': 'bunched', 'device': 'mcb', 'type': 'auto', 'ze': '0.35', 'ci': '1', 'ambient': '30'})]
CHECK = [('check-radial', {'phase': '1', 'device': 'mcb', 'type': 'B', 'rating': '32', 'ib': '28', 'shape': 'radial', 'length': '20', 'cable': 'te', 'method': 'C', 'size': '6', 'grouped': '1', 'ci': '1', 'ze': '0.35', 'ambient': '30'}),
         ('check-ring', {'phase': '1', 'device': 'mcb', 'type': 'B', 'rating': '32', 'ib': '20', 'shape': 'ring-spread', 'length': '40', 'cable': 'te', 'method': 'C', 'size': '2.5', 'grouped': '1', 'ci': '1', 'ze': '0.35', 'ambient': '30'}),
         ('check-grouped-fail', {'phase': '1', 'device': 'mcb', 'type': 'B', 'rating': '32', 'ib': '28', 'shape': 'radial', 'length': '20', 'cable': 'te', 'method': 'C', 'size': '4', 'grouped': '4', 'grouping': 'bunched', 'ci': '1', 'ze': '0.35', 'ambient': '30'})]
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for scheme in ['light', 'dark']:
            ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.6, is_mobile=True, has_touch=True, service_workers='block', color_scheme=scheme)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('http://localhost:8765/index.html#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED); await pg.reload(); await pg.wait_for_timeout(900)
            for key, route, items in [('size1', '#/calc/size', SIZE), ('calc2', '#/calc/check', CHECK)]:
                for n, v in items:
                    await pg.evaluate(f"localStorage.setItem('sparky.{key}', JSON.stringify({json.dumps(v)}))")
                    await pg.goto('http://localhost:8765/index.html#/calc'); await pg.wait_for_timeout(200)
                    await pg.goto('http://localhost:8765/index.html' + route); await pg.wait_for_timeout(900)
                    await pg.screenshot(path=f'{OUT}/v23-{n}-{scheme}.png')
                    m = pg.locator('.ans-iz details.izmore > summary').first
                    if await m.count(): await m.click(); await pg.wait_for_timeout(300); await pg.screenshot(path=f'{OUT}/v23-{n}-moreinfo-{scheme}.png')
                    how = pg.locator('details:has(summary:has-text("How it worked it out"))').first
                    if await how.count():
                        if not await how.evaluate('d => d.open'): await how.locator('summary').first.click()
                        await how.scroll_into_view_if_needed(); await pg.wait_for_timeout(300)
                        for mm in await how.locator('details.izmore > summary').all(): await mm.click()
                        await pg.wait_for_timeout(300)
                        await pg.screenshot(path=f'{OUT}/v23-{n}-how-{scheme}.png')
            await ctx.close()
        await b.close()
    print('errors:', errs)
asyncio.run(main())
