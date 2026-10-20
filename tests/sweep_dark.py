# tests/sweep_dark.py OUTDIR SCHEME — screenshot every main screen (FAKE SEED data). Server on :8765.
import asyncio, sys, os
from playwright.async_api import async_playwright
src = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
OUT, SCHEME = sys.argv[1], sys.argv[2]
R = ['', 'customers', 'newjob', 'settings', 'settings/presets', 'calc', 'calc/md', 'calc/ring', 'calc/size', 'calc/check', 'calc/dc/pv', 'calc/dc/plan',
     'job/JOB', 'job/JOB/details', 'job/JOB/photos', 'job/JOB/pdfs', 'job/JOB/backup', 'cert/cert-eic', 'cert/cert-eic/s/parts', 'cert/cert-eic/b/0', 'cert/cert-eic/b/0/t/zs']
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=1.5, service_workers='block', color_scheme=SCHEME)
        page = await ctx.new_page(); errs = []
        page.on('pageerror', lambda e: errs.append(str(e)))
        await page.goto('http://localhost:8765/index.html#/'); await page.wait_for_timeout(700); await page.evaluate(SEED)
        await page.reload(); await page.wait_for_timeout(1500)
        job = await page.evaluate("async () => { const db = await import('/js/db.js'); const c = await db.get('certs', 'cert-eic'); return c && c.jobId || ''; }")
        for r in R:
            r2 = r.replace('JOB', job)
            await page.evaluate(f"location.hash = '#/{r2}'"); await page.wait_for_timeout(1100)
            await page.screenshot(path=f"{OUT}/{SCHEME}-{(r.replace('/', '_') or 'home')}.png", full_page=True)
        print('job', job, 'errors', errs); await b.close()
asyncio.run(main())
