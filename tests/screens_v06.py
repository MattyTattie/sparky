# tests/screens_v06.py — phone shots (412x915) of the v0.6 DC system planner, FAKE data only.
#   python3 -m http.server 8765 &   then   python3 tests/screens_v06.py [outdir]
import asyncio, sys, os, json
from playwright.async_api import async_playwright
src = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.6'
URL = 'http://localhost:8765/index.html'
async def main():
    os.makedirs(OUT, exist_ok=True); errors = []; shots = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Mobile Safari/537.36')
        page = await ctx.new_page()
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(URL + '#/'); await page.wait_for_timeout(800)
        await page.evaluate(SEED)
        await page.evaluate("async () => { const m = await import('/js/dcplan.js'); localStorage.setItem('sparky.dcplan1', JSON.stringify(m.VAN_EXAMPLE)); localStorage.setItem('sparky.dcsub', 'plan'); }")
        await page.reload(); await page.wait_for_timeout(900)
        async def go(hh, wait=900): await page.evaluate(f"location.hash = '{hh}'"); await page.wait_for_timeout(wait)
        async def snap(name): await page.screenshot(path=os.path.join(OUT, name)); shots.append(name)
        async def into(sel, block='start', off=0): await page.evaluate("([s, b, o]) => { const e = document.querySelector(s); if (e) { e.scrollIntoView({ block: b }); window.scrollBy(0, o); } }", [sel, block, off]); await page.wait_for_timeout(350)
        async def text_into(txt, off=-70): await page.evaluate("([t, o]) => { const e = [...document.querySelectorAll('h2,h3,.calchead,summary')].find((x) => x.textContent.trim().startsWith(t)); if (e) { e.scrollIntoView({ block: 'start' }); window.scrollBy(0, o); } }", [txt, off]); await page.wait_for_timeout(350)
        await go('#/calc/dc/pv'); await snap('v06-01-dc-tab-solar-battery-checks.png')
        await go('#/calc/dc/plan'); await snap('v06-02-planner-van-summary.png')
        await text_into('System'); await snap('v06-03-planner-system.png')
        await text_into('Loads'); await snap('v06-04-planner-loads.png')
        await text_into('Loads', 820); await snap('v06-05-planner-loads-more.png')
        await text_into('Charging'); await snap('v06-06-planner-charging.png')
        await text_into('Inverter and layout'); await snap('v06-07-planner-inverter-layout.png')
        await page.evaluate("document.querySelectorAll('details.why')[0].open = true; document.querySelectorAll('details.why')[2].open = true")
        await text_into('Cables and fuses'); await snap('v06-08-cables-and-fuses.png')
        await text_into('Parts list'); await snap('v06-09-parts-list.png')
        for i in range(2, 6):
            await text_into('Parts list', 820 * (i - 1)); await snap(f'v06-{8 + i:02d}-parts-list-{i}.png')
        await text_into('Other things to sort'); await snap('v06-14-notes-and-sources.png')
        await page.evaluate("window.scrollTo(0, 99999)"); await page.wait_for_timeout(300); await snap('v06-15-safety-note.png')
        # save to a job
        await text_into('Parts list'); await page.click('button:has-text("Save to a job")'); await page.wait_for_timeout(600); await snap('v06-16-save-to-job.png')
        await page.click('.modal button:has-text("Save")'); await page.wait_for_timeout(2500)
        await go('#/job/job-demo'); await text_into('DC system plans'); await snap('v06-17-job-dc-plan.png')
        # PDF in the viewer
        await page.evaluate("""async () => { const m = await import('/js/dcplan.js'); const pdf = await import('/js/dcplanpdf.js'); const v = await import('/js/pdfview.js'); const blob = await pdf.dcPlanPdf(m.planDC(m.VAN_EXAMPLE), { title: 'Camper van (example)' }); window.__pdf = blob; v.viewPdf(blob, 'DC-plan.pdf'); }""")
        await page.wait_for_selector('canvas.pdfpage', timeout=30000); await page.wait_for_timeout(2500)
        n = await page.locator('canvas.pdfpage').count()
        for i in range(n):
            await page.evaluate("(i) => document.querySelectorAll('canvas.pdfpage')[i].scrollIntoView({block: 'start'})", i); await page.wait_for_timeout(1200)
            await snap(f'v06-pdf-p{i + 1:02d}.png')
        data = await page.evaluate("async () => { const b = new Uint8Array(await window.__pdf.arrayBuffer()); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); }")
        import base64; open(os.path.join(OUT, 'DC-plan-camper-van-example.pdf'), 'wb').write(base64.b64decode(data))
        await b.close()
    print(json.dumps({'errors': errors, 'shots': shots}, indent=1))
asyncio.run(main())
