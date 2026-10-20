# tests/screens_v184.py OUTDIR — radial circuit ring boxes (auto N/A), light. FAKE SEED data. Server on :8765.
import asyncio, sys, os
from playwright.async_api import async_playwright
src = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
OUT = sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.6, service_workers='block', color_scheme='light')
        page = await ctx.new_page()
        await page.goto('http://localhost:8765/index.html#/'); await page.wait_for_timeout(700); await page.evaluate(SEED); await page.reload(); await page.wait_for_timeout(1200)
        await page.evaluate("location.hash = '#/cert/cert-eic/b/0/c/3'"); await page.wait_for_timeout(1500)
        el = page.locator('.ringna').first; await el.scroll_into_view_if_needed(); await page.evaluate('scrollBy(0, 150)'); await page.wait_for_timeout(300)
        await page.screenshot(path=f'{OUT}/v184-radial-circuit-ring-na.png')
        await page.evaluate("location.hash = '#/cert/cert-eic/b/0/t/ring'"); await page.wait_for_timeout(1200)
        await page.screenshot(path=f'{OUT}/v184-test-across-ring-step.png')
        await b.close()
asyncio.run(main())
