# tests/screens_v11.py — v0.11 phone shots: device presets (Save as preset, chips, fill), select mode,
# apply dialog, overwrite check, result, Settings → Device presets. FAKE data only.
import asyncio, sys, os, json
from playwright.async_api import async_playwright
src = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.11'
URL = 'http://localhost:8765/index.html'
async def main():
    os.makedirs(OUT, exist_ok=True); errors = []; shots = []; info = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block', user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Mobile Safari/537.36')
        page = await ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e))); page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        await page.goto(URL + '#/'); await page.wait_for_timeout(800); await page.evaluate(SEED)
        n = await page.evaluate("""async () => { const db = await import('/js/db.js'); const T = await import('/js/templates.js'); const c = await db.get('certs', 'cert-eic'); const b = c.boards[0];
          for (let i = 0; i < 2; i++) b.circuits.push(Object.assign(T.blankCircuit(b.circuits.length + 1), { desc: i ? 'Garden lights' : 'Outside socket', live: i ? '1.5' : '2.5', cpc: i ? '1.0' : '1.5' }));
          const s = Object.assign(T.blankCircuit(b.circuits.length + 1), { desc: 'SPARE', noDevice: true }); T.descChanged(s, false); b.circuits.push(s); await db.put('certs', c); return b.circuits.length; }""")
        await page.reload(); await page.wait_for_timeout(900)
        async def go(hh, wait=900): await page.evaluate(f"location.hash = '{hh}'"); await page.wait_for_timeout(wait)
        async def snap(name): await page.screenshot(path=os.path.join(OUT, name)); shots.append(name)
        async def at(sel, off=-90): await page.evaluate("([s, o]) => { const e = document.querySelector(s); if (e) { e.scrollIntoView({ block: 'start' }); window.scrollBy(0, o); } }", [sel, off]); await page.wait_for_timeout(350)
        # 1. circuit 1: offer Save as preset
        await go('#/cert/cert-eic/b/0/c/0'); await at('.presetbox', -150); await snap('v11-01-save-as-preset-offer.png')
        await page.click('.savepreset'); await page.wait_for_timeout(700); await at('.presetbox', -150); await snap('v11-02-saved-chip-on.png')
        # leave lighting circuit (B6) and shower (B40): remembered automatically
        await go('#/cert/cert-eic/b/0/c/5'); await go('#/cert/cert-eic/b/0/c/4'); await go('#/cert/cert-eic/b/0', 1200)
        # 2. new circuit: chips
        await go(f'#/cert/cert-eic/b/0/c/{n-3}'); await at('.presetbox', -150); await snap('v11-03-preset-chips-on-new-circuit.png')
        await page.locator('.presetbox .chip').first.click(); await page.wait_for_timeout(800); await at('.presetbox', -150); await snap('v11-04-tapped-preset-filled.png')
        info['filled'] = await page.evaluate(f"async () => {{ await (await import('/js/state.js')).flush(); const c = (await (await import('/js/db.js')).get('certs', 'cert-eic')).boards[0].circuits[{n-3}]; return {{ bs: c.bs, type: c.type, rating: c.rating, bka: c.bka, rcdIdn: c.rcdIdn, live: c.live, cpc: c.cpc }}; }}")
        # 3. board select mode
        await go('#/cert/cert-eic/b/0', 1000); await page.click('text=Select circuits to change together'); await page.wait_for_timeout(500)
        await at('.selbar', -80); await snap('v11-05-select-mode.png')
        await page.click('.selbar button:text-is("Select all")'); await page.wait_for_timeout(500); await at('.selbar', -80); await snap('v11-06-select-all.png')
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)"); await page.wait_for_timeout(300); await snap('v11-07-select-all-spare-skipped.png')
        for i in range(3, 8): await page.locator('.seltick').nth(i).uncheck(); await page.wait_for_timeout(150)
        await page.evaluate("window.scrollTo(0, 0)"); await page.wait_for_timeout(200)
        await page.click('.selbar button:text-is("Apply…")'); await page.wait_for_timeout(600)
        await page.locator('.applydlg .chip', has_text='B32').first.click(); await page.wait_for_timeout(200)
        await page.locator('.applydlg input[data-k=bka]').fill('10'); await page.wait_for_timeout(200)
        await snap('v11-08-apply-dialog.png')
        await page.click('.modal button:text-is("Apply")'); await page.wait_for_timeout(600); await snap('v11-09-overwrite-check.png')
        await page.click('.modal button:text-is("Overwrite")'); await page.wait_for_timeout(1000)
        await page.evaluate("window.scrollTo(0, 0)"); await at('.ccard', -120); await snap('v11-10-result.png')
        info['after'] = await page.evaluate("async () => { await (await import('/js/state.js')).flush(); return (await (await import('/js/db.js')).get('certs', 'cert-eic')).boards[0].circuits.map((c) => `${c.num} ${c.desc}: ${c.type}${c.rating} ${c.bka}kA ${c.rcdIdn}mA live ${c.live}`); }")
        # 4. Settings
        await go('#/settings', 800); await at('a.linkcard', -100); await snap('v11-11-settings-link.png')
        await go('#/settings/presets', 900); await snap('v11-12-settings-presets.png')
        info['backup_has_presets'] = await page.evaluate("async () => { const b = await (await import('/js/backup.js')).exportAll(); const d = JSON.parse(await b.text()); return (d.meta.devicePresets && d.meta.devicePresets.list.length) || 0; }")
        await b.close()
    print(json.dumps({'errors': errors, 'shots': shots, **info}, indent=1))
asyncio.run(main())
