# tests/screens_v17.py OUTDIR — v0.17 shots: Danger notice button on a C2 observation, the notice form,
# the notice PDF, Email to customer buttons. FAKE data (screens.py SEED). Server on :8765.
import asyncio, sys, os
from playwright.async_api import async_playwright
here = os.path.dirname(__file__)
src = open(os.path.join(here, 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
OUT = sys.argv[1]; URL = 'http://localhost:8765/index.html'
async def main():
    os.makedirs(OUT, exist_ok=True); errors = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 460, 'height': 960}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block')
        page = await ctx.new_page(); page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        await page.goto(URL + '#/'); await page.wait_for_timeout(800); await page.evaluate(SEED)
        await page.evaluate("async () => { const db = await import('/js/db.js'); const c = await db.get('certs', 'cert-eicr'); c.client.email = 'customer@example.com'; await db.put('certs', c); }")
        await page.reload(); await page.wait_for_timeout(1200)
        async def snap(name, full=False):
            await page.evaluate("document.querySelectorAll('.toast').forEach(t=>t.remove())"); await page.screenshot(path=f'{OUT}/{name}', full_page=full)
        async def go(h, w=900): await page.evaluate(f"location.hash = '{h}'"); await page.wait_for_timeout(w)
        await go('#/cert/cert-eicr/s/observations')
        await page.evaluate("document.querySelector('.dnrow').scrollIntoView({block:'center'})"); await page.wait_for_timeout(300)
        await snap('v17-1-observation-danger-button.png')
        await page.click('.dnrow a'); await page.wait_for_timeout(1000)
        await snap('v17-2-notice-form-new.png')
        await page.click('label.check.radio:has-text("Isolated")')
        await page.click('label.check:has-text("has been told")')
        await page.fill('textarea[placeholder^="e.g. Replace"]', 'Fit 30 mA RCD protection to the outdoor socket circuit and re-test.')
        await page.click('.sigcard >> nth=0 >> button:has-text("Sign")'); await page.wait_for_timeout(400)
        await page.click('.modal button:has-text("Use my saved signature")'); await page.wait_for_timeout(400)
        await page.fill('.card:has-text("Customer (optional)") input', 'A. N. Example')
        await page.wait_for_timeout(800)
        await page.evaluate("scrollTo(0,0)"); await snap('v17-3-notice-form-filled.png', full=True)
        await page.click('button:has-text("View PDF")'); await page.wait_for_timeout(3500)
        await snap('v17-4-notice-pdf.png')
        await page.click('.pdfbtn[aria-label="Close"]'); await page.wait_for_timeout(300)
        await go('#/cert/cert-eicr/s/observations')
        await page.evaluate("document.querySelector('.dnrow').scrollIntoView({block:'center'})"); await page.wait_for_timeout(300)
        await snap('v17-5-observation-notice-issued.png')
        await go('#/cert/cert-eicr', 1200)
        await page.evaluate("document.querySelector('#emailbtn').scrollIntoView({block:'center'})"); await page.wait_for_timeout(300)
        await snap('v17-6-cert-email-button-and-notices.png')
        await page.click('button:has-text("View PDF") >> nth=0'); await page.wait_for_timeout(5000)
        await page.evaluate("document.querySelector('.pdfpages').scrollTo(0, 0)")
        await snap('v17-7-cert-pdf-email-button.png')
        # the main certificate's observation note (zoomed to section K)
        await page.click('.pdfbtn[aria-label="Close"]'); await page.wait_for_timeout(300)
        await go('#/cert/cert-eicr/s/client')
        await page.evaluate("[...document.querySelectorAll('label.f span')].find(s=>s.textContent.startsWith('Client email')).scrollIntoView({block:'center'})"); await page.wait_for_timeout(300)
        await snap('v17-8-client-email-field.png')
        await b.close()
    print('errors:', errors)
asyncio.run(main())
