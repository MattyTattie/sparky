# tests/screens_v185.py OUTDIR — size calculator, his inputs (3-phase motor, Ib 3.97 A, 15 m 4-core SWA), dark. No customer data.
import asyncio, sys, json
from playwright.async_api import async_playwright
OUT = sys.argv[1]
V = {'phase': '3', 'loadType': 'motor', 'load': '3.97', 'unit': 'A', 'length': '15', 'cable': 'swa4', 'method': 'C', 'device': 'mcb'}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.6, service_workers='block', color_scheme='dark')
        page = await ctx.new_page()
        for name, extra in [('auto-C', {'type': 'auto'}), ('override-B', {'type': 'B'}), ('auto-softstart', {'type': 'auto', 'start': 'soft'})]:
            await page.goto('http://localhost:8765/index.html#/'); await page.wait_for_timeout(500)
            await page.evaluate(f"localStorage.setItem('sparky.size1', JSON.stringify({json.dumps({**V, **extra})}))")
            await page.evaluate("location.hash = '#/calc/size'"); await page.wait_for_timeout(1500)
            await page.screenshot(path=f'{OUT}/v185b-motor-{name}-dark.png', full_page=True)
        await b.close()
asyncio.run(main())
