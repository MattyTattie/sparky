# tests/sweep_v18.py OUTDIR — v0.18 bug sweep: every screen and the main flows, light + dark, at 412 px
# and desktop width. Records console/page errors and anything wider than the screen. FAKE data only.
# Server on :8765.
import asyncio, sys, os, json
from playwright.async_api import async_playwright
here = os.path.dirname(__file__)
src = open(os.path.join(here, 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
OUT = sys.argv[1]; URL = 'http://localhost:8765/index.html'
OVERFLOW = """() => { const W = document.documentElement.clientWidth; const bad = [];
  if (document.documentElement.scrollWidth > W + 1) bad.push('page ' + document.documentElement.scrollWidth + '>' + W);
  for (const el of document.querySelectorAll('main *')) { const r = el.getBoundingClientRect(); if (r.width && r.right > W + 1 && getComputedStyle(el).position !== 'fixed' && !el.closest('.tablewrap, .scrollx, .stepper, .tabs, .subtabs, .tsteps, .chips.seg2, .sched, table, .pdfpages, .cropwrap')) { bad.push((el.className || el.tagName) + ' ' + Math.round(r.right)); if (bad.length > 4) break; } }
  return bad; }"""
ROUTES = ['#/', '#/newjob', '#/job/job-demo', '#/job/job-demo/photos', '#/job/job-demo/details', '#/job/job-demo/next', '#/job/job-demo/pdfs', '#/job/job-demo/backup',
  '#/job/job-2', '#/customers', '#/customer/cust-demo', '#/settings', '#/settings/presets', '#/calc', '#/calc/check', '#/calc/dc', '#/calc/dc/plan', '#/calc/dc/pv', '#/calc/md', '#/calc/ring', '#/calc/size',
  '#/cert/cert-eic', '#/cert/cert-eic/boards', '#/cert/cert-eic/b/0', '#/cert/cert-eic/b/0/c/0', '#/cert/cert-eic/b/0/c/4', '#/cert/cert-eic/b/0/scan', '#/cert/cert-eic/photos', '#/cert/cert-eic/import', '#/import-extra',
  '#/cert/cert-eicr', '#/cert/cert-mw', '#/cert/cert-mw/mwc'] + [f'#/cert/cert-eic/b/0/t/{t}' for t in ['r1r2', 'ring', 'ir', 'pol', 'zs', 'rcd']]
async def run(p, scheme, w, h, mobile, log):
    b = await p.chromium.launch()
    ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1 if not mobile else 2, is_mobile=mobile, has_touch=mobile, service_workers='block', color_scheme=scheme, accept_downloads=True)
    page = await ctx.new_page(); errs = []
    page.on('pageerror', lambda e: errs.append('pageerror ' + str(e)))
    page.on('console', lambda m: errs.append('console ' + m.text) if m.type == 'error' else None)
    await page.goto(URL + '#/'); await page.wait_for_timeout(700); await page.evaluate(SEED); await page.reload(); await page.wait_for_timeout(1000)
    tag = f'{scheme}-{w}'
    async def visit(hh, wait=900):
        n = len(errs); await page.evaluate(f"location.hash = '{hh}'"); await page.wait_for_timeout(wait)
        ov = await page.evaluate(OVERFLOW)
        if ov: log.append(f'[{tag}] overflow {hh}: {ov}')
        for e in errs[n:]: log.append(f'[{tag}] {hh}: {e}')
    # every section of every cert
    secs = await page.evaluate("async () => { const m = await import('/js/certmodel.js'); return Object.fromEntries(['EIC','EICR','MW'].map(t => [t, m.sectionsFor(t).filter(s => !s.special || s.special !== 'boards').map(s => s.special === 'mwcircuit' ? null : s.id).filter(Boolean)])); }")
    routes = ROUTES + [f'#/cert/cert-eic/s/{s}' for s in secs['EIC']] + [f'#/cert/cert-eicr/s/{s}' for s in secs['EICR']] + [f'#/cert/cert-mw/s/{s}' for s in secs['MW']]
    for r in routes: await visit(r)
    if mobile and scheme == 'light':
        # create a job and each certificate type from the new job page
        await visit('#/newjob'); await page.fill('label.f:has-text("What") input', 'Sweep test job (fake)'); await page.fill('label.f:has-text("Name") input', 'Z. Sweep (fake)')
        await page.click('button:has-text("Create job")'); await page.wait_for_timeout(900)
        jid = (await page.evaluate('location.hash')).split('/')[-1]
        for t in ['EIC', 'EICR', 'Minor Works']:
            await page.evaluate(f"location.hash = '#/job/{jid}'"); await page.wait_for_timeout(800)
            await page.click('button.row.addrow'); await page.wait_for_timeout(300); await page.click(f'.modal button:text-is("{t}")'); await page.wait_for_timeout(900)
            if '/cert/' not in await page.evaluate('location.hash'): log.append(f'[{tag}] create {t}: did not open the certificate')
        await page.evaluate(f"location.hash = '#/job/{jid}'"); await page.wait_for_timeout(800)
        n_certs = await page.locator('a.row[href^="#/cert/"]').count()
        if n_certs != 3: log.append(f'[{tag}] job shows {n_certs} certificates, expected 3')
        # sign with the saved signature, make the PDF and view it, then phone back
        await visit('#/cert/cert-eicr/s/sign')
        await page.locator('button:has-text("Sign")').first.click(); await page.wait_for_timeout(400)
        await page.click('.modal button:has-text("Use my saved signature")'); await page.wait_for_timeout(500)
        await visit('#/cert/cert-eicr'); before = await page.evaluate('location.hash')
        await page.click('button:has-text("View PDF")'); await page.wait_for_timeout(4000)
        if not await page.locator('.pdfview').count(): log.append(f'[{tag}] PDF viewer did not open')
        await page.go_back(); await page.wait_for_timeout(600)
        if await page.locator('.pdfview').count(): log.append(f'[{tag}] back did not close the PDF viewer')
        if await page.evaluate('location.hash') != before: log.append(f'[{tag}] back from PDF viewer left the page')
        await page.go_back(); await page.wait_for_timeout(800)
        if await page.evaluate('location.hash') == before: log.append(f'[{tag}] second back did not navigate (double-back trap)')
        # dialog closed by its button, then back goes back a page
        await visit('#/job/job-demo'); await page.click('#jobmore'); await page.wait_for_timeout(300); await page.click('.modal button:has-text("Cancel")'); await page.wait_for_timeout(400)
        await page.go_back(); await page.wait_for_timeout(800)
        if await page.evaluate('location.hash') == '#/job/job-demo': log.append(f'[{tag}] back after closing a dialog did not navigate')
        # dialog closed by back
        await visit('#/job/job-demo'); await page.click('#jobmore'); await page.wait_for_timeout(300); await page.go_back(); await page.wait_for_timeout(500)
        if await page.locator('.modal-bg').count(): log.append(f'[{tag}] back did not close the dialog')
        if await page.evaluate('location.hash') != '#/job/job-demo': log.append(f'[{tag}] back on dialog left the page')
        # sign pad closed by back
        await visit('#/cert/cert-eic/s/sign'); await page.locator('button:has-text("Sign")').first.click(); await page.wait_for_timeout(400)
        await page.go_back(); await page.wait_for_timeout(500)
        if await page.locator('.modal-bg').count(): log.append(f'[{tag}] back did not close the sign pad')
        # danger notice + its PDF
        await visit('#/cert/cert-eicr/s/observations'); await page.locator('.dnrow a').first.click(); await page.wait_for_timeout(1200)
        if '/danger/' not in await page.evaluate('location.hash'): log.append(f'[{tag}] danger notice did not open')
        await page.click('button:has-text("View PDF")'); await page.wait_for_timeout(3500)
        if not await page.locator('.pdfview').count(): log.append(f'[{tag}] danger PDF did not open')
        await page.go_back(); await page.wait_for_timeout(500)
        # backup file out and back in
        await visit('#/settings', 1500)
        async with page.expect_download() as dl: await page.click('button:has-text("Save backup file")')
        f = await (await dl.value).path()
        data = json.load(open(f)); log.append(f'[{tag}] backup file: {len(data.get("jobs", []))} jobs, {len(data.get("certs", []))} certs')
        async with page.expect_file_chooser() as fc: await page.click('button:has-text("Restore from file")')
        await (await fc.value).set_files(f); await page.wait_for_timeout(1500)
        # the job page delete confirm (cancel)
        await visit(f'#/job/{jid}'); await page.click('button.row.frow.danger'); await page.wait_for_timeout(300)
        if not await page.locator('.modal-bg').count(): log.append(f'[{tag}] delete job has no confirm')
        else: await page.click('.modal button:has-text("Cancel")')
    log.extend(f'[{tag}] late: {e}' for e in errs if not any(e in l for l in log))
    await b.close()
async def main():
    os.makedirs(OUT, exist_ok=True); log = []
    async with async_playwright() as p:
        for scheme in ['light', 'dark']:
            await run(p, scheme, 412, 915, True, log)
            await run(p, scheme, 1280, 900, False, log)
    open(f'{OUT}/sweep-log.txt', 'w').write('\n'.join(log) + '\n'); print('\n'.join(log) or 'clean')
asyncio.run(main())
