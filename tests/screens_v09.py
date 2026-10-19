# tests/screens_v09.py — v0.9 phone shots: Check it 3-phase, Maximum demand (example house,
# from a certificate), drop into the cert. FAKE data only.  python3 tests/screens_v09.py [outdir]
import asyncio, sys, os, json
from playwright.async_api import async_playwright
src = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.9'
URL = 'http://localhost:8765/index.html'
async def main():
    os.makedirs(OUT, exist_ok=True); errors = []; shots = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block', user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Mobile Safari/537.36')
        page = await ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e))); page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        await page.goto(URL + '#/'); await page.wait_for_timeout(800)
        await page.evaluate(SEED)
        await page.evaluate("() => { localStorage.setItem('sparky.calc2', JSON.stringify({ phase: '3', device: 'mcb', type: 'C', rating: '32', ib: '24', length: '35', ze: '0.35', cable: 'swa4', method: 'C', size: 'auto', ambient: '30', grouped: '1', grouping: 'bunched', ci: '1', time: 0.4 })); localStorage.removeItem('sparky.md1'); }")
        await page.reload(); await page.wait_for_timeout(900)
        async def go(hh, wait=900): await page.evaluate(f"location.hash = '{hh}'"); await page.wait_for_timeout(wait)
        async def snap(name, full=False): await page.screenshot(path=os.path.join(OUT, name), full_page=full); shots.append(name)
        async def into(txt, off=-80): await page.evaluate("([t, o]) => { const e = [...document.querySelectorAll('h2, .resline, summary, .foldt')].find((x) => x.textContent.trim().includes(t)); if (e) { e.scrollIntoView({ block: 'start' }); window.scrollBy(0, o); } }", [txt, off]); await page.wait_for_timeout(350)
        await go('#/settings'); await page.evaluate("document.getElementById('drive').scrollIntoView({ block: 'start' }); window.scrollBy(0, -80)"); await page.wait_for_timeout(300); await snap('v09-sync-00-settings-turn-on.png')
        await go('#/calc/check'); await snap('v09-check-3phase-01-answer.png')
        await into('The circuit'); await snap('v09-check-3phase-02-inputs.png')
        await page.evaluate("document.querySelectorAll('details[data-fold=chk-how]').forEach((d) => d.open = true)"); await into('How it worked'); await snap('v09-check-3phase-03-workings.png')
        # Max demand from the certificate
        await go('#/cert/cert-eic/s/parts'); await page.click('text=Work it out from the loads'); await page.wait_for_timeout(800)
        await snap('v09-md-01-empty-from-cert.png')
        await page.click('text=Load the example house'); await page.wait_for_timeout(500)
        await snap('v09-md-02-example-answer.png')
        await into('Your loads'); await snap('v09-md-03-loads.png')
        await into('How it worked'); await snap('v09-md-04-workings.png')
        await into('What it really draws'); await page.evaluate("document.querySelectorAll('details[data-fold=md-real]').forEach((d) => d.open = true)"); await page.wait_for_timeout(300); await snap('v09-md-05-realistic-peak.png')
        await page.evaluate("window.scrollTo(0,0)"); await page.wait_for_timeout(200)
        await page.click('button:has-text("Use 124 A on")'); await page.wait_for_timeout(1000)
        await snap('v09-md-06-dropped-into-cert.png')
        res = await page.evaluate("async () => { const db = await import('/js/db.js'); const c = await db.get('certs', 'cert-eic'); return c.parts.maxDemand + ' ' + c.parts.mdUnit; }")
        await b.close()
    print(json.dumps({'errors': errors, 'shots': shots, 'cert_md': res}, indent=1))
asyncio.run(main())
