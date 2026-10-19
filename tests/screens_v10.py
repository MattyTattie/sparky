# tests/screens_v10.py — v0.10 phone shots: G/J headings, spare circuits (plain / No device fitted /
# typed RCBO), schedule table, sync wording, conflict copy title. FAKE data only.
import asyncio, sys, os, json
from playwright.async_api import async_playwright
src = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.10'
URL = 'http://localhost:8765/index.html'
async def main():
    os.makedirs(OUT, exist_ok=True); errors = []; shots = []; info = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block', user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Mobile Safari/537.36')
        page = await ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e))); page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        await page.goto(URL + '#/'); await page.wait_for_timeout(800); await page.evaluate(SEED)
        # add three blank circuits 10-12 to board 0 + a conflict-copy job
        await page.evaluate("""async () => { const db = await import('/js/db.js'); const T = await import('/js/templates.js'); const SM = await import('/js/syncmerge.js');
          const c = await db.get('certs', 'cert-eic'); const b = c.boards[0]; for (let i = 0; i < 3; i++) { const x = T.blankCircuit(b.circuits.length + 1); b.circuits.push(x); } await db.put('certs', c);
          const j = await db.get('jobs', 'job-demo'); const cp = SM.conflictCopy({ job: j }, { newId: db.newId, label: 'another device', when: new Date('2026-10-19T17:40:00Z') }); await db.put('jobs', cp.job);
          await db.setMeta('sync.conflicts', [{ id: j.id, title: j.title, copyId: cp.job.id, copyTitle: cp.job.title, at: new Date().toISOString(), seen: false }]);
          return b.circuits.length; }""")
        await page.reload(); await page.wait_for_timeout(900)
        async def go(hh, wait=900): await page.evaluate(f"location.hash = '{hh}'"); await page.wait_for_timeout(wait)
        async def snap(name, full=False): await page.screenshot(path=os.path.join(OUT, name), full_page=full); shots.append(name)
        async def into(sel_text, off=-90): await page.evaluate("([t, o]) => { const e = [...document.querySelectorAll('h2, h3, .lab span, label span, label')].find((x) => x.textContent.trim().startsWith(t)); if (e) { e.scrollIntoView({ block: 'start' }); window.scrollBy(0, o); } }", [sel_text, off]); await page.wait_for_timeout(350)
        n = await page.evaluate("async () => (await (await import('/js/db.js')).get('certs', 'cert-eic')).boards[0].circuits.length")
        # G/J
        await go('#/cert/cert-eic/s/parts'); await into('Earthing conductor'); await snap('v10-gj-01-earthing-and-main-bonding.png')
        await into('Bonding of extraneous'); await snap('v10-gj-02-extraneous-parts.png')
        await page.evaluate("async () => { const db = await import('/js/db.js'); const c = await db.get('certs', 'cert-eic'); Object.assign(c.parts, { bondWater: false, bondGas: false, bondOil: false, bondSteel: false, bondLightning: false, bondOther: '', bondNone: true }); await db.put('certs', c); }")
        await go('#/'); await go('#/cert/cert-eic/s/parts'); await into('Main protective bonding'); await snap('v10-gj-03-no-bonding-ticked.png')
        # spare plain: type 'spare' into circuit n-2
        await go(f'#/cert/cert-eic/b/0/c/{n-3}')
        desc = page.locator('.fld:has(.lab span:text-is("Circuit description")) input'); await desc.fill('spare'); await page.wait_for_timeout(400)
        await page.evaluate("window.scrollTo(0, 0)"); await snap('v10-spare-01-typed-spare-top.png')
        await into('Type of wiring'); await snap('v10-spare-02-cable-NA.png')
        await into('Test results', -70); await snap('v10-spare-03-tests-NA.png')
        # No device fitted
        await page.evaluate("window.scrollTo(0, 0)"); await page.click('label.nodev input'); await page.wait_for_timeout(400)
        await into('Circuit description', -60); await snap('v10-spare-04-no-device-fitted.png')
        await into('RCD BS', -200); await snap('v10-spare-05-no-device-rcd-NA.png')
        # spare with a typed RCBO
        await go(f'#/cert/cert-eic/b/0/c/{n-2}')
        await page.locator('.fld:has(.lab span:text-is("Circuit description")) input').fill('SPARE'); await page.wait_for_timeout(300)
        await page.evaluate("""async (i) => { const db = await import('/js/db.js'); }""", n-2)
        for k, v in [('OCPD BS (EN)', '61009'), ('OCPD type', 'B'), ('Breaking capacity (kA)', '6'), ('RCD BS (EN)', '61009'), ('RCD type', 'A'), ('RCD IΔn (mA)', '30'), ('RCD rating (A)', '32'), ('Remarks', 'RCBO fitted, not connected')]:
            loc = page.locator(f'.fld:has(.lab span:text-is("{k}")) input')
            if await loc.count(): await loc.first.fill(v)
        rbtn = page.locator('button:text-is("32")')
        if await rbtn.count(): await rbtn.first.click()
        await page.wait_for_timeout(500); await into('Protective device', -60); await snap('v10-spare-06-typed-RCBO-device.png')
        await into('RCD BS', -120); await snap('v10-spare-07-typed-RCBO-rcd-and-tests.png')
        # removing spare restores empties
        await page.evaluate("window.scrollTo(0, 0)"); await page.locator('.fld:has(.lab span:text-is("Circuit description")) input').fill('Garage sockets'); await page.wait_for_timeout(400)
        await into('Type of wiring'); await snap('v10-spare-08-spare-removed-empties-back.png')
        info['saved'] = await page.evaluate(f"async () => {{ await (await import('/js/state.js')).flush(); const c = await (await import('/js/db.js')).get('certs', 'cert-eic'); return c.boards[0].circuits.slice(-3).map((x) => ({{ desc: x.desc, live: x.live, zs: x.zs, irV: x.irV, bs: x.bs, rating: x.rating, noDevice: !!x.noDevice }})); }}")
        # put circuit back to SPARE for the table
        await page.locator('.fld:has(.lab span:text-is("Circuit description")) input').fill('SPARE'); await page.wait_for_timeout(300)
        await page.wait_for_timeout(600); await page.set_viewport_size({'width': 915, 'height': 412})
        await page.evaluate("location.hash = '#/cert/cert-eic/b/0'"); await page.wait_for_timeout(1200)
        await page.evaluate("(() => { const t = document.querySelector('table'); if (t) { const rows = t.querySelectorAll('tbody tr'); rows[rows.length - 1].scrollIntoView({ block: 'end' }); } })()"); await page.wait_for_timeout(300)
        await page.screenshot(path=os.path.join(OUT, 'v10-spare-09-schedule-table-landscape.png')); shots.append('v10-spare-09-schedule-table-landscape.png')
        await page.set_viewport_size({'width': 412, 'height': 915}); await page.evaluate("location.hash = '#/'"); await page.wait_for_timeout(900)
        await page.screenshot(path=os.path.join(OUT, 'v10-sync-01-home-conflict-copy-wording.png')); shots.append('v10-sync-01-home-conflict-copy-wording.png')
        await page.evaluate("location.hash = '#/settings'"); await page.wait_for_timeout(900)
        await page.evaluate("document.getElementById('drive').scrollIntoView({ block: 'start' }); window.scrollBy(0, -80)"); await page.wait_for_timeout(300)
        await page.screenshot(path=os.path.join(OUT, 'v10-sync-02-settings-wording.png')); shots.append('v10-sync-02-settings-wording.png')
        await b.close()
    print(json.dumps({'errors': errors, 'shots': shots, **info}, indent=1))
asyncio.run(main())
