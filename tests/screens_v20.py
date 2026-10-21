# tests/screens_v20.py OUTDIR — v0.20: new cables in Check a circuit, MPCB/MCCB Im, plug fuse wording, symbols. FAKE data. Server :8765.
import asyncio, sys, os, json
from playwright.async_api import async_playwright
here = os.path.dirname(__file__)
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.20'
SEED = open(os.path.join(here, 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
CHECK = [
  ('01-check-flex-plug', {'device': 'bs1362', 'type': 'plug', 'rating': '13', 'ib': '10', 'length': '3', 'cable': 'flex', 'method': 'C', 'ze': '0.35'}),
  ('02-check-h07rnf', {'device': 'mcb', 'type': 'B', 'rating': '16', 'ib': '16', 'length': '25', 'cable': 'h07', 'method': 'C', 'ze': '0.35'}),
  ('03-check-tri-rated', {'device': 'mcb', 'type': 'C', 'rating': '10', 'ib': '6', 'length': '4', 'cable': 'tri', 'method': 'bunch', 'grouped': '6', 'ze': '0.35'}),
  ('04-check-tails', {'device': 'bs88-3', 'type': 'gG', 'rating': '100', 'ib': '80', 'length': '3', 'cable': 'tails', 'method': 'C', 'ze': '0.35', 'size': '25'}),
  ('05-check-mccb', {'device': 'mccb', 'type': 'adj', 'rating': '100', 'im': '1000', 'ib': '90', 'length': '30', 'cable': 'swa3X', 'method': 'C', 'ze': '0.1'}),
]
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for scheme in ['light', 'dark']:
            ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.6, is_mobile=True, has_touch=True, service_workers='block', color_scheme=scheme)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('http://localhost:8765/index.html#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED); await pg.reload(); await pg.wait_for_timeout(1000)
            async def shot(n, full=True): await pg.wait_for_timeout(500); await pg.screenshot(path=f'{OUT}/v20-{n}-{scheme}.png', full_page=full)
            for n, v in (CHECK if scheme == 'light' else CHECK[:1] + CHECK[4:]):
                await pg.evaluate(f"localStorage.setItem('sparky.calc2', JSON.stringify({json.dumps(v)}))")
                await pg.goto('http://localhost:8765/index.html#/calc'); await pg.wait_for_timeout(300)
                await pg.goto('http://localhost:8765/index.html#/calc/check'); await shot(n)
            await pg.evaluate("localStorage.setItem('sparky.size1', JSON.stringify({phase:'1',loadType:'general',load:'13',unit:'A',length:'3',cable:'flex',method:'C',device:'bs1362'}))")
            await pg.goto('http://localhost:8765/index.html#/calc/size'); await shot('06-size-flex-plug', False)
            # Ib pop-up
            await pg.locator('.sym[data-sym="Ib"]').first.click(force=True, timeout=5000); await shot('07-popup-Ib', False)
            await pg.goto('http://localhost:8765/index.html#/calc'); await shot('08-calc-home')
            await pg.goto('http://localhost:8765/index.html#/calc/symbols'); await shot('09-symbols-sheet')
            await pg.goto('http://localhost:8765/index.html#/cert/cert-eic/b/0/c/0'); await pg.wait_for_timeout(800)
            sel = pg.locator('select').filter(has=pg.locator('option[value="mccb"]')).first
            if await sel.count():
                await sel.select_option('mccb'); await pg.wait_for_timeout(400)
                im = pg.locator('input[aria-label="Magnetic trip setting"]')
                if await im.count(): await im.fill('1000'); await im.scroll_into_view_if_needed()
            await shot('10-circuit-mccb-im', False)
            cab = pg.locator('select[aria-label="Cable type"]')
            if await cab.count():
                await cab.select_option('flex'); await pg.wait_for_timeout(300); await cab.scroll_into_view_if_needed(); await shot('11-circuit-flex-picker', False)
            z = pg.locator('.sym[data-sym="Zs"]').first
            if await z.count(): await z.scroll_into_view_if_needed(); await z.click(force=True, timeout=5000); await shot('12-popup-Zs-circuit', False)
            await ctx.close()
        await b.close()
    print('errors:', errs)
asyncio.run(main())
