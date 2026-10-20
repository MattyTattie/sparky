# tests/screens_v172.py OUTDIR — v0.17.2: Saved PDFs card with an orphan EICR PDF (its certificate was
# deleted before v0.17.1), before and after the start-up tidy (sync off). FAKE data. Server :8765.
import asyncio, sys, os
from playwright.async_api import async_playwright
here = os.path.dirname(__file__)
src = open(os.path.join(here, 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
OUT = sys.argv[1]
EXTRA = """async () => { const db = await import('/js/db.js'); const pdf = new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' });
  const mk = (id, certId, name, at) => db.put('files', { id, jobId: 'job-demo', certId, kind: 'pdf', name, blob: pdf, createdAt: at, version: 1 });
  await mk('k1', 'cert-eic', 'EIC-0001-12-Imaginary-Road-Faketown.pdf', '2026-10-20T09:12:00Z');
  await mk('orph', 'cert-deleted-long-ago', 'EICR-0007-12-Imaginary-Road-Faketown.pdf', '2026-10-05T14:30:00Z');
  await mk('nocert', undefined, 'Old-upload-no-certificate.pdf', '2026-09-30T08:00:00Z'); }"""
async def main():
    os.makedirs(OUT, exist_ok=True); errors = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.6, is_mobile=True, has_touch=True, service_workers='block')
        page = await ctx.new_page(); page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto('http://localhost:8765/index.html#/'); await page.wait_for_timeout(800); await page.evaluate(SEED); await page.evaluate(EXTRA)
        await page.evaluate("location.hash = '#/job/job-demo'"); await page.wait_for_timeout(1200)
        el = page.locator('#savedpdfs'); await el.scroll_into_view_if_needed(); await el.screenshot(path=f'{OUT}/v172-1-before-orphan-eicr-pdf.png')
        await page.reload(); await page.wait_for_timeout(2500)
        el = page.locator('#savedpdfs'); await el.scroll_into_view_if_needed(); await el.screenshot(path=f'{OUT}/v172-2-after-start-tidy.png')
        left = await page.evaluate("async () => { const db = await import('/js/db.js'); return (await db.byJob('files', 'job-demo')).map(f => f.id).sort(); }")
        tomb = await page.evaluate("async () => { const db = await import('/js/db.js'); return Object.keys(((await db.getMeta('sync.deletedItems')) || {}).files || {}); }")
        print('left:', left, 'tombstoned:', tomb); assert 'orph' not in left and 'nocert' in left and 'k1' in left
        await b.close()
    print('errors:', errors)
asyncio.run(main())
