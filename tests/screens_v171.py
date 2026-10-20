# tests/screens_v171.py BASEURL OUTDIR PREFIX — v0.17.1 spacing audit at Pixel 7 size (412x915).
# Run against main (before) and the branch (after). FAKE data (screens.py SEED).
import asyncio, sys, os
from playwright.async_api import async_playwright
here = os.path.dirname(__file__)
src = open(os.path.join(here, 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
BASE, OUT, PRE = sys.argv[1], sys.argv[2], sys.argv[3]
EXTRA = """async () => { const db = await import('/js/db.js'); const D = await import('/js/dangermodel.js');
  const pdf = new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' });
  const mk = (id, certId, name, at, kind = 'pdf') => db.put('files', { id, jobId: 'job-demo', certId, kind, name, blob: pdf, createdAt: at, version: 1 });
  await mk('p1', 'cert-eic', 'EIC-0001-12-Imaginary-Road-Faketown.pdf', '2026-10-20T09:12:00Z');
  await mk('p2', 'cert-eic', 'EIC-0001-chart-DB1-12-Imaginary-Road-Faketown.pdf', '2026-10-20T09:15:00Z', 'chart');
  await mk('p3', 'cert-eic', 'EIC-0001-12-Imaginary-Road-Faketown.pdf', '2026-10-18T16:40:00Z');
  await mk('p4', 'cert-eic-old', 'MW-0003-Garage-socket-extension-12-Imaginary-Road.pdf', '2026-10-02T11:05:00Z');
  const c = await db.get('certs', 'cert-eicr'); c.observations.push({ id: 'o4', text: 'Exposed live conductors at damaged socket-outlet', code: 'C1', reg: '416.1', location: 'Kitchen (demo)' });
  if (D.blankNotice) { const n = D.blankNotice(c, null, 'dn-demo'); n.action = 'isolated'; n.remedial = 'Repair by a competent person and re-test.'; c.dangerNotices = [n]; }
  await db.put('certs', c); }"""
SCREENS = [('01-home', '#/'), ('02-job', '#/job/job-demo'), ('03-cert', '#/cert/cert-eicr'), ('04-section-supply', '#/cert/cert-eic/s/supply'),
           ('05-section-client', '#/cert/cert-eicr/s/client'), ('06-observations', '#/cert/cert-eicr/s/observations'), ('07-schedule', '#/cert/cert-eic/b/0'),
           ('08-test-across', '#/cert/cert-eic/b/0/t/zs'), ('09-settings', '#/settings'), ('10-danger-notice', '#/cert/cert-eicr/danger/dn-demo'), ('11-signatures', '#/cert/cert-eicr/s/sign')]
async def main():
    os.makedirs(OUT, exist_ok=True); errors = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.6, is_mobile=True, has_touch=True, service_workers='block')
        page = await ctx.new_page(); page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(BASE + '/index.html#/'); await page.wait_for_timeout(800); await page.evaluate(SEED); await page.evaluate(EXTRA)
        await page.reload(); await page.wait_for_timeout(1200)
        for name, h in SCREENS:
            await page.evaluate(f"location.hash = '{h}'"); await page.wait_for_timeout(1300)
            await page.evaluate("document.querySelectorAll('.toast').forEach(t=>t.remove()); scrollTo(0,0)")
            await page.screenshot(path=f'{OUT}/{PRE}-{name}.png', full_page=True)
        # saved PDFs card close-up
        await page.evaluate("location.hash = '#/job/job-demo'"); await page.wait_for_timeout(1200)
        el = page.locator('.card:has(h2:text("Saved PDFs"))')
        await el.scroll_into_view_if_needed(); await el.screenshot(path=f'{OUT}/{PRE}-12-saved-pdfs-card.png')
        await b.close()
    print('errors:', errors)
asyncio.run(main())
