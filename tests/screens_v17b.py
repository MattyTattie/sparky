# tests/screens_v17b.py OUTDIR — v0.17 (multi-item notices): 3 C1/C2 observations on one notice,
# add-to-existing choice, form, PDF (1 page and a long one), Email buttons. FAKE data. Server on :8765.
import asyncio, sys, os
from playwright.async_api import async_playwright
here = os.path.dirname(__file__)
src = open(os.path.join(here, 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
OUT = sys.argv[1]; URL = 'http://localhost:8765/index.html'
EXTRA = """async () => { const db = await import('/js/db.js'); const c = await db.get('certs', 'cert-eicr'); c.client.email = 'customer@example.com';
  c.observations.push({ id: 'o4', text: 'Exposed live conductors at damaged socket-outlet', code: 'C1', reg: '416.1', location: 'Kitchen, circuit 3 (demo)' },
                      { id: 'o5', text: 'No main protective bonding to incoming gas pipe', code: 'C2', reg: '411.3.1.2', location: 'Meter cupboard (demo)' });
  await db.put('certs', c); }"""
async def main():
    os.makedirs(OUT, exist_ok=True); errors = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 460, 'height': 960}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block')
        page = await ctx.new_page(); page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        await page.goto(URL + '#/'); await page.wait_for_timeout(800); await page.evaluate(SEED); await page.evaluate(EXTRA)
        await page.reload(); await page.wait_for_timeout(1200)
        async def snap(name, full=False):
            await page.evaluate("document.querySelectorAll('.toast').forEach(t=>t.remove())"); await page.screenshot(path=f'{OUT}/{name}', full_page=full)
        async def go(h, w=900): await page.evaluate(f"location.hash = '{h}'"); await page.wait_for_timeout(w)
        async def obs_btn(i):
            await page.evaluate(f"document.querySelectorAll('.dnrow')[{i}].scrollIntoView({{block:'center'}})"); await page.wait_for_timeout(300)
        await go('#/cert/cert-eicr/s/observations'); await obs_btn(0)
        await snap('v17b-1-observation-danger-button.png')
        await page.locator('.dnrow a').nth(0).click(); await page.wait_for_timeout(1000)
        await snap('v17b-2-new-notice-all-c1-c2-ticked.png')
        # untick the gas bonding one, then add it back from its observation
        await page.click('#dnpick label:has-text("gas pipe") input'); await page.wait_for_timeout(300)
        await go('#/cert/cert-eicr/s/observations'); await obs_btn(2)
        await page.locator('.dnrow a').nth(2).click(); await page.wait_for_timeout(700)
        await snap('v17b-3-add-to-existing-or-new.png')
        await page.click('.modal button:has-text("Add to")'); await page.wait_for_timeout(1000)
        # fill in: shared action + remedial; item 2 has its own
        await page.locator('label.check.radio:has-text("Isolated")').last.click()
        await page.locator('.dnitem').nth(1).locator('summary').click(); await page.wait_for_timeout(200)
        await page.locator('.dnitem').nth(1).locator('label.check.radio:has-text("Made safe")').click()
        await page.locator('.dnitem').nth(1).locator('textarea').nth(1).fill('Replace the damaged socket-outlet and re-test circuit 3.')
        await page.click('label.check:has-text("has been told")')
        await page.fill('textarea[placeholder^="e.g. Replace"]', 'Install RCD protection and main protective bonding by a competent person, then re-test.')
        await page.locator('.sigcard').nth(0).locator('button:has-text("Sign")').click(); await page.wait_for_timeout(400)
        await page.click('.modal button:has-text("Use my saved signature")'); await page.wait_for_timeout(400)
        await page.fill('.card:has-text("Customer (optional)") input', 'A. N. Example')
        await page.locator('.sigcard').nth(1).locator('button:has-text("Sign")').click(); await page.wait_for_timeout(500)
        cv = await page.query_selector('canvas.sigpad'); bb = await cv.bounding_box()
        await page.mouse.move(bb['x'] + 30, bb['y'] + 120); await page.mouse.down()
        for i in range(1, 30): await page.mouse.move(bb['x'] + 30 + i * 9, bb['y'] + 100 + (25 if i % 4 < 2 else -25))
        await page.mouse.up(); await page.wait_for_timeout(200)
        await page.click('.modal button:has-text("Use this")'); await page.wait_for_timeout(600)
        await page.evaluate("scrollTo(0,0)"); await snap('v17b-4-notice-form-3-items.png', full=True)
        await page.click('button:has-text("View PDF")'); await page.wait_for_timeout(3500)
        await snap('v17b-5-notice-pdf-3-items.png')
        await page.click('.pdfbtn[aria-label="Close"]'); await page.wait_for_timeout(300)
        # a long notice (fake) to show the continuation page
        await page.evaluate("""async () => { const D = await import('/js/dangermodel.js'); const { dangerPdf } = await import('/js/dangerpdf.js'); const { viewPdf } = await import('/js/pdfview.js');
          const db = await import('/js/db.js'); const c = await db.get('certs', 'cert-eicr'); const n = JSON.parse(JSON.stringify(D.noticesOf(c)[0]));
          for (let i = 0; i < 14; i++) n.items.push({ ...D.blankItem(), code: i % 2 ? 'C2' : 'C1', text: 'Demo defect ' + (i + 4) + ': damaged accessory with exposed conductors (fake)', location: 'Circuit ' + (i + 1) });
          c.dangerNotices = [n]; viewPdf(await dangerPdf(c, n, await db.getMeta('profile')), 'long-demo.pdf'); }""")
        await page.wait_for_timeout(4500)
        await snap('v17b-6-long-notice-pdf-page1.png')
        await page.evaluate("const c=document.querySelectorAll('.pdfpage')[1]; c.scrollIntoView({block:'start'})"); await page.wait_for_timeout(500)
        await snap('v17b-7-long-notice-pdf-page2.png')
        await page.click('.pdfbtn[aria-label="Close"]'); await page.wait_for_timeout(300)
        await go('#/cert/cert-eicr/s/observations'); await obs_btn(1)
        await snap('v17b-8-observations-on-notice.png')
        await go('#/cert/cert-eicr', 1200)
        await page.evaluate("document.querySelector('#emailbtn').scrollIntoView({block:'center'})"); await page.wait_for_timeout(300)
        await snap('v17b-9-cert-email-and-notices.png')
        await b.close()
    print('errors:', errors)
asyncio.run(main())
