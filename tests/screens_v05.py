# tests/screens_v05.py — phone shots (412x915) of the v0.5 features, FAKE data only.
#   python3 -m http.server 8765 &   then   python3 tests/screens_v05.py [outdir]
import asyncio, sys, os, json
from playwright.async_api import async_playwright
src = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.5'
URL = 'http://localhost:8765/index.html'
EXTRA = r'''async () => {
  const db = await import('/js/db.js'); const s = await import('/tests/sample-data.mjs');
  const eic = await db.get('certs', 'cert-eic');
  // 20 circuits on the board so the schedules run onto continuation sheets
  const b = eic.boards[0]; const base = b.circuits;
  while (b.circuits.length < 20) { const c = JSON.parse(JSON.stringify(base[b.circuits.length % base.length])); c.id = 'c' + b.circuits.length; c.num = String(b.circuits.length + 1); c.desc = 'Spare way ' + (b.circuits.length + 1); b.circuits.push(c); }
  eic.bonding = [
    { id: 'b1', location: 'Bathroom', parts: 'Hot and cold water pipes, Central heating pipes, Radiator / towel rail', csa: '4', material: 'Copper', reading: '0.03', verified: true },
    { id: 'b2', location: 'Shower room (en-suite)', parts: 'Hot and cold water pipes, Metal bath / shower tray', csa: '4', material: 'Copper', reading: '0.05', verified: true },
    { id: 'b3', location: 'Kitchen', parts: 'Metal sink', csa: '4', material: 'Copper', reading: '0.72', verified: false } ];
  await db.put('certs', eic);
  localStorage.setItem('sparky.size1', JSON.stringify({ phase: '3', loadType: 'general', load: '22', unit: 'kW', pf: '1', length: '40', ze: '0.35', vd: 'auto', cable: 'swa4', method: 'C', ambient: '30', grouped: '1', grouping: 'bunched', ci: '1', device: 'mcb', type: 'auto', time: 0.4 }));
  return true; }'''
async def main():
    os.makedirs(OUT, exist_ok=True); errors = []; shots = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Mobile Safari/537.36')
        await ctx.add_init_script("if (!window.SpeechRecognition && !window.webkitSpeechRecognition) window.webkitSpeechRecognition = function () {};")
        page = await ctx.new_page()
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(URL + '#/'); await page.wait_for_timeout(800)
        await page.evaluate(SEED); await page.evaluate(EXTRA); await page.reload(); await page.wait_for_timeout(900)
        async def go(hh, wait=800): await page.evaluate(f"location.hash = '{hh}'"); await page.wait_for_timeout(wait)
        async def snap(name): await page.screenshot(path=os.path.join(OUT, name)); shots.append(name)
        async def into(sel, block='center'): await page.evaluate("([s, b]) => { const e = document.querySelector(s); if (e) e.scrollIntoView({ block: b }); }", [sel, block]); await page.wait_for_timeout(300)
        # voice note (board page / circuit page, next to the mic button)
        await go('#/cert/cert-eic/b/0')
        if not await page.locator('.voicenote').count(): await go('#/cert/cert-eic/b/0/c/0')
        await into('.voicenote'); await snap('v05-01-voice-note.png')
        # supplementary bonding: filled, and empty
        await go('#/cert/cert-eic/s/bonding'); await snap('v05-02-bonding-schedule.png')
        await page.evaluate("window.scrollTo(0, 99999)"); await page.wait_for_timeout(300); await snap('v05-03-bonding-schedule-bottom.png')
        await go('#/cert/cert-eicr/s/bonding'); await snap('v05-04-bonding-empty.png')
        # cable sizer, three-phase
        await go('#/calc/size', 1000); await snap('v05-05-3phase-sizer-input.png')
        await into('.calchead, .answer, .result', 'start'); await snap('v05-06-3phase-sizer-answer.png')
        # PDF viewer: page by page
        await go('#/cert/cert-eic'); await page.click('button:has-text("View PDF")'); await page.wait_for_selector('canvas.pdfpage', timeout=30000); await page.wait_for_timeout(3000)
        n = await page.locator('canvas.pdfpage').count()
        for i in range(n):
            await page.evaluate("(i) => document.querySelectorAll('canvas.pdfpage')[i].scrollIntoView({block: 'start'})", i); await page.wait_for_timeout(1200)
            await snap(f'v05-pdf-viewer-p{i + 1:02d}.png')
        await b.close()
    print(json.dumps({'errors': errors, 'shots': shots}, indent=1))
asyncio.run(main())
