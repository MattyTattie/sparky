# tests/screens_v18.py OUTDIR — v0.18 shots: job page light + dark, home dark, a certificate section dark,
# Settings > Appearance. FAKE data (screens.py SEED). Server on :8765.
import asyncio, sys, os
from playwright.async_api import async_playwright
here = os.path.dirname(__file__)
src = open(os.path.join(here, 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
OUT = sys.argv[1]
async def shots(p, scheme, items):
    b = await p.chromium.launch()
    ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.6, is_mobile=True, has_touch=True, service_workers='block', color_scheme=scheme)
    page = await ctx.new_page()
    await page.goto('http://localhost:8765/index.html#/'); await page.wait_for_timeout(700); await page.evaluate(SEED); await page.reload(); await page.wait_for_timeout(1000)
    for name, h, js in items:
        await page.evaluate(f"location.hash = '{h}'"); await page.wait_for_timeout(1200)
        if js: await page.evaluate(js); await page.wait_for_timeout(300)
        await page.screenshot(path=f'{OUT}/{name}')
    await b.close()
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        await shots(p, 'light', [('v18-1-job-page-light.png', '#/job/job-2', None), ('v18-2-job-page-new-job-light.png', '#/job/job-3', None),
            ('v18-6-settings-appearance-light.png', '#/settings', "document.querySelector('#appearance').scrollIntoView({block:'center'})")])
        await shots(p, 'dark', [('v18-3-job-page-dark.png', '#/job/job-2', None), ('v18-4-home-dark.png', '#/', None), ('v18-5-cert-section-dark.png', '#/cert/cert-eic/s/supply', None),
            ('v18-7-settings-appearance-dark.png', '#/settings', "document.querySelector('#appearance').scrollIntoView({block:'center'})"),
            ('v18-8-schedule-dark.png', '#/cert/cert-eic/b/0', None), ('v18-9-sign-pad-dark.png', '#/cert/cert-eic/s/sign', "document.querySelector('main button.btn.primary').click()")])
asyncio.run(main())
