# tests/screens.py — phone screenshots (portrait + landscape) with FAKE data,
# plus sample PDFs made in the browser. Needs a local server on :8765:
#   python3 -m http.server 8765 &   then   python3 tests/screens.py [outdir]
import asyncio, base64, sys, os, json
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots'
URL = 'http://localhost:8765/index.html'
SEED = r'''async () => {
  const db = await import('/js/db.js'); const s = await import('/tests/sample-data.mjs');
  const { createCert } = await import('/js/certui.js');
  // fake logo + signature drawn on a canvas
  const cv = document.createElement('canvas'); cv.width = 300; cv.height = 120; const g = cv.getContext('2d');
  g.fillStyle = '#1b3a6b'; g.fillRect(0, 0, 120, 120); g.fillStyle = '#f2b705'; g.beginPath(); g.moveTo(70, 10); g.lineTo(30, 66); g.lineTo(58, 66); g.lineTo(46, 110); g.lineTo(92, 50); g.lineTo(64, 50); g.closePath(); g.fill();
  g.fillStyle = '#1b3a6b'; g.font = 'bold 34px sans-serif'; g.fillText('EXAMPLE', 132, 58); g.font = '22px sans-serif'; g.fillText('ELECTRICAL', 134, 90);
  const logo = cv.toDataURL('image/png');
  const sc = document.createElement('canvas'); sc.width = 260; sc.height = 70; const sg = sc.getContext('2d'); sg.strokeStyle = '#0d2a5c'; sg.lineWidth = 3; sg.beginPath(); sg.moveTo(10, 50);
  for (let x = 10; x < 250; x += 6) sg.lineTo(x, 35 + Math.sin(x / 9) * 18 * Math.cos(x / 31)); sg.stroke();
  const sig = sc.toDataURL('image/png');
  const due = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);
  await db.setMeta('profile', { ...s.PROFILE, logo });
  await db.setMeta('instruments', [{ id: 'i1', make: 'Megger', model: 'MFT1741+ (sample)', serial: '000123', calDue: due, kinds: ['multi', 'continuity', 'ir', 'efli', 'rcd'], inUse: true }]);
  await db.setMeta('mysig', sig);
  const now = new Date().toISOString();
  await db.put('customers', { ...s.CUSTOMER, createdAt: now, updatedAt: now });
  await db.put('customers', { id: 'cust-2', name: 'B. Sample (fake)', address: '3 Pretend Lane, Mockford', postcode: 'ZZ2 2ZZ', updatedAt: now });
  await db.put('jobs', { ...s.JOB, createdAt: now, updatedAt: now, version: 1 });
  await db.put('jobs', { id: 'job-2', customerId: 'cust-2', title: 'Periodic inspection (rental)', siteAddress: '3 Pretend Lane, Mockford', sitePostcode: 'ZZ2 2ZZ', createdAt: now, updatedAt: new Date(Date.now() - 864e5).toISOString(), version: 1 });
  await db.put('jobs', { id: 'job-3', customerId: 'cust-2', title: 'Extra socket in kitchen', siteAddress: '3 Pretend Lane, Mockford', createdAt: now, updatedAt: new Date(Date.now() - 2 * 864e5).toISOString(), version: 1 });
  const sign = (c, roles) => { c.sigs = {}; for (const r of roles) c.sigs[r] = { img: sig, date: '2026-10-16' }; return c; };
  const eic = sign(s.sampleEIC(), ['designer']); eic.id = 'cert-eic'; eic.jobId = 'job-demo'; eic.boards = [s.board(false)];
  const eicClean = sign(s.sampleEIC(), ['designer']);
  const eicr = sign(s.sampleEICR(), ['inspector', 'authoriser']); eicr.id = 'cert-eicr'; eicr.jobId = 'job-2';
  const mw = sign(s.sampleMW(), ['mw']); mw.id = 'cert-mw'; mw.jobId = 'job-3';
  for (const c of [eic, eicr, mw]) await db.put('certs', c);
  window.__clean = { eic: eicClean, eicr, mw };
  return true;
}'''
async def shot(page, name, hash, wait=600, full=False):
    await page.evaluate(f"if (location.hash === '{hash}') window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = '{hash}'"); await page.wait_for_timeout(wait)
    await page.screenshot(path=os.path.join(OUT, name), full_page=full)
async def main():
    os.makedirs(OUT, exist_ok=True); errors = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.625, is_mobile=True, has_touch=True, user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Mobile Safari/537.36')
        page = await ctx.new_page()
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(URL + '#/'); await page.wait_for_timeout(800)
        await page.screenshot(path=os.path.join(OUT, 'p00-first-run.png'))
        await page.evaluate(SEED)
        await page.reload(); await page.wait_for_timeout(800)
        P = [('p01-jobs.png', '#/'), ('p02-job.png', '#/job/job-demo'), ('p03-cert-overview.png', '#/cert/cert-eic'),
             ('p04-schedule-cards.png', '#/cert/cert-eic/b/0'), ('p05-circuit-flags.png', '#/cert/cert-eic/b/0/c/4'),
             ('p06-circuit-ring.png', '#/cert/cert-eic/b/0/c/0'), ('p07-supply.png', '#/cert/cert-eic/s/supply'),
             ('p08-eic-inspections.png', '#/cert/cert-eic/s/inspections'), ('p09-eicr-inspections.png', '#/cert/cert-eicr/s/inspections'),
             ('p10-observations.png', '#/cert/cert-eicr/s/observations'), ('p11-sign.png', '#/cert/cert-eicr/s/sign'),
             ('p12-mw-circuit.png', '#/cert/cert-mw/mwc'), ('p13-settings.png', '#/settings'), ('p14-calculators.png', '#/calc'),
             ('p15-new-job.png', '#/newjob'), ('p16-scan.png', '#/cert/cert-eic/b/0/scan'), ('p17-customers.png', '#/customers')]
        for n, hsh in P: await shot(page, n, hsh)
        await shot(page, 'p04-schedule-cards-full.png', '#/cert/cert-eic/b/0', full=True)
        # observation picker + template picker modals
        await shot(page, 'p10-observations.png', '#/cert/cert-eicr/s/observations')
        await page.click('button:has-text("Add observation")'); await page.wait_for_timeout(400); await page.screenshot(path=os.path.join(OUT, 'p18-observation-picker.png'))
        await page.keyboard.press('Escape'); await page.evaluate("document.querySelectorAll('.modal-bg').forEach(m=>m.remove())")
        await page.evaluate("location.hash='#/cert/cert-eic/b/0'"); await page.wait_for_timeout(500)
        await page.click('button:has-text("Circuit") >> nth=0'); await page.wait_for_timeout(400); await page.screenshot(path=os.path.join(OUT, 'p19-templates.png'))
        await page.evaluate("document.querySelectorAll('.modal-bg').forEach(m=>m.remove())")
        # landscape
        await page.set_viewport_size({'width': 915, 'height': 412}); await page.wait_for_timeout(300)
        await shot(page, 'l01-schedule-table.png', '#/cert/cert-eic/b/0', wait=800)
        await page.evaluate("document.querySelector('.tablewrap').scrollLeft = 900"); await page.wait_for_timeout(200)
        await page.screenshot(path=os.path.join(OUT, 'l02-schedule-table-results.png'))
        await shot(page, 'l03-jobs.png', '#/')
        await page.set_viewport_size({'width': 412, 'height': 915})
        # PDFs made in the browser (same code the phone runs)
        await page.evaluate("location.hash='#/'"); await page.wait_for_timeout(300)
        res = await page.evaluate('''async () => {
          const { certificatePdf, boardChartPdf } = await import('/js/pdf.js'); const db = await import('/js/db.js');
          const s = await import('/tests/sample-data.mjs'); const profile = await db.getMeta('profile'); const sig = await db.getMeta('mysig'); const sg = (c, roles) => { c.sigs = {}; for (const r of roles) c.sigs[r] = { img: sig, date: '2026-10-16' }; return c; }; const c = { eic: sg(s.sampleEIC(), ['designer']), eicr: sg(s.sampleEICR(), ['inspector', 'authoriser']), mw: sg(s.sampleMW(), ['mw']) }; const out = {};
          const b64 = async (bl) => { const u = await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(bl); }); return u.split(',')[1]; };
          out['browser-sample-EIC.pdf'] = await b64(await certificatePdf(c.eic, { profile }));
          out['browser-sample-EICR.pdf'] = await b64(await certificatePdf(c.eicr, { profile }));
          out['browser-sample-MinorWorks.pdf'] = await b64(await certificatePdf(c.mw, { profile }));
          out['browser-sample-circuit-chart.pdf'] = await b64(await boardChartPdf(c.eic, c.eic.boards[0], profile));
          return out; }''')
        for n, d in res.items(): open(os.path.join(OUT, n), 'wb').write(base64.b64decode(d))
        # autosave check: type a Zs, reload, value must still be there
        await page.evaluate("location.hash='#/cert/cert-eic/b/0/c/1'"); await page.wait_for_timeout(500)
        zs = page.locator('.fld', has_text='Zs maximum measured').locator('input')
        await zs.fill('0.77'); await page.wait_for_timeout(700); await page.reload(); await page.wait_for_timeout(800)
        kept = await page.locator('.fld', has_text='Zs maximum measured').locator('input').input_value()
        await b.close()
    print(json.dumps({'errors': errors, 'autosave_kept': kept}, indent=1))
asyncio.run(main())
