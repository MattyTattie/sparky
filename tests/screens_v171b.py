# tests/screens_v171b.py OUTDIR — v0.17.1: delete a certificate (its saved PDFs go too, others kept),
# add-to-notice dialog over the observations page, notice note on the cert PDF. FAKE data. Server :8765.
import asyncio, sys, os
from playwright.async_api import async_playwright
here = os.path.dirname(__file__)
src = open(os.path.join(here, 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
EXTRA = open(os.path.join(here, 'screens_v171.py')).read().split('EXTRA = """', 1)[1].split('"""', 1)[0]
OUT = sys.argv[1]
async def main():
    errors = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.6, is_mobile=True, has_touch=True, service_workers='block')
        page = await ctx.new_page(); page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto('http://localhost:8765/index.html#/'); await page.wait_for_timeout(800); await page.evaluate(SEED); await page.evaluate(EXTRA)
        # a second, unsigned notice-free observation so the dialog shows: take o4 off the demo notice
        await page.evaluate("""async () => { const db = await import('/js/db.js'); const c = await db.get('certs', 'cert-eicr'); c.dangerNotices[0].items = c.dangerNotices[0].items.filter(i => i.obsId !== 'o4'); await db.put('certs', c); }""")
        await page.reload(); await page.wait_for_timeout(1200)
        # deleting cert-eic: its 3 PDFs go, the other certificate's PDF stays
        await page.evaluate("location.hash = '#/cert/cert-eic'"); await page.wait_for_timeout(1200)
        await page.click('button:has-text("Delete certificate")'); await page.wait_for_timeout(400)
        await page.screenshot(path=f'{OUT}/v171-delete-cert-confirm.png')
        await page.click('.modal button:has-text("Delete")'); await page.wait_for_timeout(1500)
        left = await page.evaluate("async () => { const db = await import('/js/db.js'); return (await db.byJob('files', 'job-demo')).map(f => f.id).sort(); }")
        dele = await page.evaluate("async () => { const db = await import('/js/db.js'); return await db.getMeta('sync.deletedItems'); }")
        print('files left:', left, 'deleted:', sorted((dele or {}).get('files', {}).keys()))
        assert left == ['p4'], left
        el = page.locator('#savedpdfs'); await el.scroll_into_view_if_needed(); await el.screenshot(path=f'{OUT}/v171-after-delete-saved-pdfs.png')
        # dialog over the observations page
        await page.evaluate("location.hash = '#/cert/cert-eicr/s/observations'"); await page.wait_for_timeout(1200)
        await page.evaluate("[...document.querySelectorAll('.dnrow a')].find(a => a.textContent.trim() === 'Danger notice').scrollIntoView({block:'center'})"); await page.wait_for_timeout(300)
        await page.locator('.dnrow a', has_text='Danger notice').filter(has_not_text='View').first.click(); await page.wait_for_timeout(700)
        await page.screenshot(path=f'{OUT}/v171-add-to-notice-dialog.png')
        await page.click('.modal button:has-text("Add to")'); await page.wait_for_timeout(1200)
        print('hash:', await page.evaluate('location.hash'))
        await b.close()
    print('errors:', errors)
asyncio.run(main())
