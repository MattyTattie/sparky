# tests/screens_v30b.py: v0.30.0 max demand (storage heaters, heat pump) and the RCD C3 observation. FAKE data only.
import asyncio, sys, os, json
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.30.0'
BASE = 'http://localhost:8765/index.html'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
MD = json.dumps({'fuse': '100', 'loads': [{'k': 'storage', 'qty': 3, 'value': 3.4}, {'k': 'heatpump', 'qty': 1, 'value': 5}, {'k': 'heater', 'qty': 2, 'value': 2}, {'k': 'ring', 'qty': 2, 'value': 32}, {'k': 'lighting', 'qty': 2, 'value': 400}]})
async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for (w, hh) in [(1440, 900), (412, 915)]:
            phone = w < 900; tag = 'phone' if phone else 'desk'
            ctx = await b.new_context(viewport={'width': w, 'height': hh}, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone, service_workers='block')
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(tag + ': ' + str(e)))
            await pg.goto(BASE + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED)
            await pg.evaluate(f"localStorage.setItem('sparky.md1', {json.dumps(MD)})")
            await pg.goto(BASE + '#/calc/md'); await pg.reload(); await pg.wait_for_timeout(1000)
            await pg.screenshot(path=f'{OUT}/{tag}-11-max-demand-storage-heatpump.png', full_page=True)
            await pg.goto(BASE + '#/cert/cert-eicr/s/observations'); await pg.reload(); await pg.wait_for_timeout(1000)
            await pg.get_by_text('library', exact=False).first.click(); await pg.wait_for_timeout(500)
            s = pg.locator('.modal input, dialog input').first
            if await s.count(): await s.fill('RCD protection for socket'); await pg.wait_for_timeout(400)
            await pg.screenshot(path=f'{OUT}/{tag}-12-obs-library-rcd-sockets-c3.png')
            await ctx.close()
        await b.close()
    print('ERRORS', errs)
asyncio.run(main())
