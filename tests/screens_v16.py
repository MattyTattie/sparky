# tests/screens_v16.py OUTDIR — v0.16 shots: Settings (Sync + Files), results certificate picker,
# certificate page without "Earlier results". FAKE data (screens.py SEED) and a fake Drive
# (tests/sync_mock.py; nothing goes to Google). Server on :8765.
import asyncio, sys, os, json
from playwright.async_api import async_playwright
here = os.path.dirname(__file__)
src = open(os.path.join(here, 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
mock = open(os.path.join(here, 'sync_mock.py')).read().split('async def device', 1)[0]
sys.argv = [sys.argv[0]] + sys.argv[1:]; OUT = sys.argv[1]
g = {'__name__': 'mock'}; exec(mock, g)
URL = 'http://localhost:8765/index.html'
async def go(page, hash, wait=800):
    await page.evaluate(f"location.hash = '{hash}'"); await page.wait_for_timeout(wait)
async def main():
    os.makedirs(OUT, exist_ok=True); errors = []; shots = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 460, 'height': 960}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block')
        await ctx.route('https://accounts.google.com/gsi/client*', lambda r: r.fulfill(body=g['GSI'], content_type='text/javascript'))
        await ctx.route('https://www.googleapis.com/**', g['drive'])
        page = await ctx.new_page(); page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        await page.goto(URL + '#/'); await page.wait_for_timeout(800); await page.evaluate(SEED)
        await page.evaluate(g['TOKEN'].replace('fake@example.com', 'sam@example.com'))
        await page.evaluate("async () => { const db = await import('/js/db.js'); await db.setMeta('sync.config', { enabled: true }); }")
        await page.reload(); await page.wait_for_timeout(1500)
        async def snap(name, full=False):
            await page.evaluate("document.querySelectorAll('.toast').forEach(t=>t.remove())")
            await page.screenshot(path=f'{OUT}/{name}', full_page=full); shots.append(name)
        await go(page, '#/settings', 1500)
        await page.locator('#drive').scroll_into_view_if_needed(); await page.evaluate("document.querySelector('#drive').scrollIntoView({block:'start'}); scrollBy(0,-70)"); await page.wait_for_timeout(400)
        await snap('v16-1-settings-sync-files.png')
        await page.click('details.more > summary'); await page.wait_for_timeout(300)
        await page.evaluate("document.querySelector('#drive').scrollIntoView({block:'start'}); scrollBy(0,-70)"); await page.wait_for_timeout(300)
        await snap('v16-2-settings-sync-more-open.png')
        await page.evaluate("document.querySelector('#files').scrollIntoView({block:'start'}); scrollBy(0,-70)"); await page.wait_for_timeout(300)
        await snap('v16-3-settings-files.png')
        await page.click('#files button:has-text("Import results file")'); await page.wait_for_timeout(600)
        await snap('v16-4-results-pick-certificate.png')
        await page.click('.modal button:has-text("Cancel")'); await page.wait_for_timeout(300)
        await snap('v16-0-settings-full.png', True)
        certs = await page.evaluate("async () => (await (await import('/js/db.js')).all('certs')).filter(c=>c.type!=='MW').map(c=>c.id)")
        await go(page, f'#/cert/{certs[0]}', 1200)
        await snap('v16-5-cert-page.png', True)
        txt = await page.inner_text('main') if await page.locator('main').count() else await page.inner_text('body')
        await b.close()
    print(json.dumps({'errors': errors, 'shots': shots, 'earlierResultsGone': 'Earlier results' not in txt}))
asyncio.run(main())
