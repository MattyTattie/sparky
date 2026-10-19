# tests/screens_v09_look.py — before/after shots of the v0.9 look (home, a cert section, calculators). FAKE data only.
#   python3 tests/screens_v09_look.py [outdir] [prefix] [baseurl]
import asyncio, sys, os, json
from playwright.async_api import async_playwright
src = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.9'
PRE = sys.argv[2] if len(sys.argv) > 2 else 'after'
URL = (sys.argv[3] if len(sys.argv) > 3 else 'http://localhost:8765') + '/index.html'
async def main():
    os.makedirs(OUT, exist_ok=True); errors = []; shots = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for scheme in ['light']:
            ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block', color_scheme=scheme,
              user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Mobile Safari/537.36')
            page = await ctx.new_page()
            page.on('pageerror', lambda e: errors.append(str(e)))
            await page.goto(URL + '#/'); await page.wait_for_timeout(800)
            await page.evaluate(SEED); await page.reload(); await page.wait_for_timeout(1200)
            async def go(hh, wait=1000): await page.evaluate(f"location.hash = '{hh}'"); await page.wait_for_timeout(wait)
            async def snap(name): await page.screenshot(path=os.path.join(OUT, name)); shots.append(name)
            sfx = '' if scheme == 'light' else '-dark'
            await go('#/'); await snap(f'{PRE}-01-home{sfx}.png')
            await go('#/job/job-demo'); await snap(f'{PRE}-02-job{sfx}.png')
            await go('#/cert/cert-eic'); await snap(f'{PRE}-03-cert-overview{sfx}.png')
            await go('#/cert/cert-eic/s/parts'); await snap(f'{PRE}-04-cert-section{sfx}.png')
            await go('#/calc'); await snap(f'{PRE}-05-calc-home{sfx}.png')
            await ctx.close()
        await b.close()
    print(json.dumps({'errors': errors, 'shots': shots}))
asyncio.run(main())
