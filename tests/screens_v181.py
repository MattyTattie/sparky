# tests/screens_v181.py OUTDIR — v0.18.1: Earthing section choice chips and the header sync dot, dark + light.
# FAKE data (screens.py SEED) and a fake Drive (tests/sync_mock.py; nothing goes to Google). Server on :8765.
import asyncio, sys, os
from playwright.async_api import async_playwright
here = os.path.dirname(__file__)
src = open(os.path.join(here, 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
mock = open(os.path.join(here, 'sync_mock.py')).read().split('async def device', 1)[0]
OUT = sys.argv[1]; g = {'__name__': 'mock'}; exec(mock, g)
SEC = sys.argv[2] if len(sys.argv) > 2 else 'parts'
async def shots(p, scheme):
    b = await p.chromium.launch()
    ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.6, is_mobile=True, has_touch=True, service_workers='block', color_scheme=scheme)
    await ctx.route('https://accounts.google.com/gsi/client*', lambda r: r.fulfill(body=g['GSI'], content_type='text/javascript'))
    await ctx.route('https://www.googleapis.com/**', g['drive'])
    page = await ctx.new_page()
    await page.goto('http://localhost:8765/index.html#/'); await page.wait_for_timeout(700); await page.evaluate(SEED)
    await page.evaluate(g['TOKEN'].replace('fake@example.com', 'sam@example.com'))
    await page.evaluate("async () => { const db = await import('/js/db.js'); await db.setMeta('sync.config', { enabled: true }); }")
    await page.reload(); await page.wait_for_timeout(2500)
    await page.evaluate(f"location.hash = '#/cert/cert-eic/s/{SEC}'"); await page.wait_for_timeout(1500)
    await page.screenshot(path=f'{OUT}/v181-earthing-{scheme}.png')
    await page.locator('header.top').screenshot(path=f'{OUT}/v181-header-dot-{scheme}.png')
    await page.evaluate("location.hash = '#/cert/cert-eic/b/0/t/zs'"); await page.wait_for_timeout(1200)
    await page.screenshot(path=f'{OUT}/v181-test-across-tabs-{scheme}.png')
    await page.evaluate("location.hash = '#/settings'"); await page.wait_for_timeout(1500)
    await page.evaluate("document.querySelector('#appearance').scrollIntoView({block:'center'})"); await page.wait_for_timeout(300)
    await page.screenshot(path=f'{OUT}/v181-appearance-{scheme}.png')
    await b.close()
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        for s in ['dark', 'light']: await shots(p, s)
asyncio.run(main())
