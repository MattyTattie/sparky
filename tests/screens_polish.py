# tests/screens_polish.py — before/after shots of the main screens, FAKE data only.
#   python3 -m http.server 8765 &   then   python3 tests/screens_polish.py <prefix> [outdir]
import asyncio, sys, os, importlib.util
from playwright.async_api import async_playwright
spec = importlib.util.spec_from_file_location('screens', os.path.join(os.path.dirname(__file__), 'screens.py'))
src = open(spec.origin).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
PFX = sys.argv[1] if len(sys.argv) > 1 else 'after'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/workspace/sparky-shots/v0.5'
URL = 'http://localhost:8765/index.html'
async def main():
    os.makedirs(OUT, exist_ok=True); errors = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2, is_mobile=True, has_touch=True)
        page = await ctx.new_page()
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(URL + '#/'); await page.wait_for_timeout(900)
        await page.screenshot(path=f'{OUT}/polish-{PFX}-00-empty.png')
        await page.evaluate(SEED); await page.reload(); await page.wait_for_timeout(900)
        async def go(hh, name, wait=800):
            await page.evaluate(f"location.hash = '{hh}'"); await page.wait_for_timeout(wait)
            await page.screenshot(path=f'{OUT}/polish-{PFX}-{name}.png')
        await go('#/', '01-home'); await go('#/job/job-demo', '02-job'); await go('#/cert/cert-eic', '03-cert')
        await go('#/cert/cert-eic/b/0', '04-board'); await go('#/cert/cert-eic/b/0/c/0', '05-circuit')
        await go('#/calc/size', '06-calc'); await go('#/customers', '07-customers'); await go('#/settings', '08-settings')
        await b.close()
    print('errors:', errors)
asyncio.run(main())
