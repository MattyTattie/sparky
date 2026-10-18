# tests/screens_v04.py — phone screenshots of the v0.4 features, FAKE data only.
#   python3 -m http.server 8765 &   then   python3 tests/screens_v04.py [outdir]
import asyncio, sys, os, json, importlib.util
from playwright.async_api import async_playwright
spec = importlib.util.spec_from_file_location('screens', os.path.join(os.path.dirname(__file__), 'screens.py'))
src = open(spec.origin).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.4'
URL = 'http://localhost:8765/index.html'
EXTRA = r'''async () => {
  const db = await import('/js/db.js');
  const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const j2 = await db.get('jobs', 'job-2'); j2.nextInspection = d(41); await db.put('jobs', j2);
  const j3 = await db.get('jobs', 'job-3'); j3.nextInspection = d(-12); await db.put('jobs', j3);
  const eic = await db.get('certs', 'cert-eic'); eic.boards[0].circuits[0].ring = true; eic.boards[0].circuits[1].ring = true;
  eic.boards[0].circuits[1].rn = '0.71'; eic.boards[0].circuits[1].r1r2 = '0.52';
  eic.boards[0].circuits[2].zs = '0.27'; eic.boards[0].circuits[2].cable = 'te'; eic.boards[0].circuits[2].cableSize = '2.5'; eic.boards[0].circuits[2].live = '2.5'; eic.boards[0].circuits[2].cpc = '1.5'; eic.boards[0].circuits[2].rating = '20'; eic.boards[0].circuits[2].desc = 'Kitchen radial (demo: low Zs)';
  await db.put('certs', eic);
  localStorage.removeItem('sparky.size1'); localStorage.removeItem('sparky.dc1'); localStorage.removeItem('sparky.calctab');
  return true; }'''
async def main():
    os.makedirs(OUT, exist_ok=True); errors = []; shots = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.625, is_mobile=True, has_touch=True, user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Mobile Safari/537.36')
        page = await ctx.new_page()
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(URL + '#/'); await page.wait_for_timeout(800)
        await page.evaluate(SEED); await page.evaluate(EXTRA)
        await page.reload(); await page.wait_for_timeout(900)
        async def go(h, wait=700):
            await page.evaluate(f"if (location.hash === '{h}') window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = '{h}'"); await page.wait_for_timeout(wait)
        async def snap(name, full=False):
            await page.screenshot(path=os.path.join(OUT, name), full_page=full); shots.append(name)
        async def scroll_to(text):
            await page.evaluate("(t) => { const el = [...document.querySelectorAll('h2,summary,.ringhd,.resline,label,.fld .lab span')].find(e => e.textContent.includes(t)); if (el) el.scrollIntoView({block:'start'}); window.scrollBy(0, -70); }", text); await page.wait_for_timeout(300)
        # 1. home with Due soon
        await go('#/'); await snap('01-home-due-soon.png')
        # 2. job: next inspection
        await go('#/job/job-2'); await snap('02-job-next-inspection.png')
        # 3. PDF viewer (makes and saves the PDF)
        await go('#/cert/cert-eic'); await scroll_to('PDF'); await snap('03-cert-pdf-buttons.png')
        await page.click('text=👁 View PDF'); await page.wait_for_selector('canvas.pdfpage', timeout=20000); await page.wait_for_timeout(2500)
        await snap('04-pdf-viewer.png')
        await page.click('.pdfbtn[aria-label=Zoom]'); await page.wait_for_timeout(2500); await snap('04b-pdf-viewer-zoomed.png'); await page.click('.pdfbtn[aria-label=Zoom]'); await page.wait_for_timeout(2000)
        await page.evaluate("document.querySelector('.pdfpages').scrollTop = 2600"); await page.wait_for_timeout(1500); await snap('05-pdf-viewer-page2.png')
        await page.click('.pdfbtn[aria-label=Close]'); await page.wait_for_timeout(300)
        await go('#/job/job-demo'); await scroll_to('Saved PDFs'); await snap('06-job-saved-pdfs-view.png')
        # 4. ring check
        await go('#/cert/cert-eic/b/0/c/0'); await scroll_to('Ring final circuit'); await snap('07-circuit-ring-tick.png')
        await scroll_to('Ring final check'); await snap('08-ring-check-good.png')
        await go('#/cert/cert-eic/b/0/c/1'); await scroll_to('Ring final check'); await snap('09-ring-check-faults.png')
        # 5. non-ring: ring boxes hidden + adiabatic fail
        await go('#/cert/cert-eic/b/0/c/2'); await scroll_to('Adiabatic'); await snap('10-circuit-adiabatic-flag.png')
        await scroll_to('Test results'); await snap('11-radial-no-ring-boxes.png')
        await go('#/cert/cert-eic/b/0/c/3'); await scroll_to('Adiabatic'); await snap('12-circuit-adiabatic-pass.png')
        # 6. copy circuit / board
        await go('#/cert/cert-eic/b/0/c/0'); await page.click('text=Copy circuit'); await page.wait_for_timeout(400); await snap('13-copy-circuit.png')
        await page.click('.modal .btn.primary'); await page.wait_for_timeout(2900)
        await go('#/cert/cert-eic/b/0'); await scroll_to('Copy this board'); await page.click('text=Copy this board'); await page.wait_for_timeout(400); await snap('14-copy-board.png')
        await page.click('.modal .btn.primary'); await page.wait_for_timeout(800); await snap('15-board-copied.png'); await page.wait_for_timeout(2500)
        # 7. observations library
        await go('#/cert/cert-eicr/s/observations'); await snap('16-observations.png')
        await page.click('text=+ Add from library'); await page.wait_for_timeout(400); await snap('17-obs-library.png')
        await page.click('.modal .chip.c2'); await page.wait_for_timeout(300); await snap('18-obs-library-c2.png')
        await page.locator('.modal input[type=search]').fill('bath'); await page.wait_for_timeout(300); await snap('19-obs-library-search.png')
        await page.locator('.modal .row').first.click(); await page.wait_for_timeout(500); await page.evaluate("window.scrollTo(0, document.body.scrollHeight)"); await page.wait_for_timeout(300); await snap('20-obs-added.png')
        # 8. calculators
        top = lambda: page.evaluate("window.scrollTo(0,0)")
        async def scrolls(prefix):
            for i, y in enumerate([900, 1800, 2700]):
                await page.evaluate(f"window.scrollTo(0,{y})"); await page.wait_for_timeout(250); await snap(f'{prefix}-{i+2}.png')
            await top()
        await go('#/calc'); await snap('21-sizer-20A-32m.png'); await scrolls('22-sizer-form')
        sel = lambda label: page.locator('label.f', has_text=label).locator('select')
        await page.click('.chips .chip:text-is("Socket ring final")'); await page.wait_for_timeout(300)
        inp = page.locator('label.f', has_text='Load / design current').locator('input'); await inp.fill('26'); await inp.press('Tab'); await page.wait_for_timeout(200)
        l = page.locator('label.f', has_text='Ring loop length').locator('input'); await l.fill('70'); await l.press('Tab'); await page.wait_for_timeout(400)
        await top(); await page.wait_for_timeout(200); await snap('23-sizer-ring.png')
        await page.click('.chips .chip:text-is("Heating / shower / cooker (resistive)")'); await page.wait_for_timeout(200)
        await page.click('.chips .chip:text-is("kW")'); await page.wait_for_timeout(200)
        inp = page.locator('label.f', has_text='Load (kW)').locator('input'); await inp.fill('9.5'); await inp.press('Tab'); await page.wait_for_timeout(200)
        l = page.locator('label.f', has_text='Length of run').locator('input'); await l.fill('18'); await l.press('Tab'); await page.wait_for_timeout(400)
        await top(); await page.wait_for_timeout(200); await snap('24-sizer-shower-9k5.png')
        await sel('Cable').select_option('swa'); await page.wait_for_timeout(300)
        await sel('Installation').select_option('D'); await page.wait_for_timeout(300)
        l = page.locator('label.f', has_text='Length of run').locator('input'); await l.fill('45'); await l.press('Tab'); await page.wait_for_timeout(400)
        await top(); await page.wait_for_timeout(200); await snap('25-sizer-swa-outbuilding.png'); await scrolls('25-sizer-swa')
        await go('#/calc/check'); await snap('26-check-calc-adiabatic.png')
        await go('#/calc/dc'); await snap('27-dc-pv-string.png'); await scrolls('28-dc-pv')
        await page.click('text=🔋 Battery leads'); await page.wait_for_timeout(400); await top(); await page.wait_for_timeout(200); await snap('29-dc-battery.png')
        # PV with 3 strings (fuses needed)
        await page.click('text=☀ Solar PV string'); await page.wait_for_timeout(300)
        st = page.locator('label.f', has_text='Strings in parallel').locator('input'); await st.fill('3'); await st.press('Tab'); await page.wait_for_timeout(400); await top(); await page.wait_for_timeout(200); await snap('29b-dc-pv-3-strings-fused.png')
        # landscape table still fine
        await page.set_viewport_size({'width': 915, 'height': 412}); await go('#/cert/cert-eic/b/0', 900); await snap('30-landscape-schedule.png')
        await b.close()
    print(json.dumps({'errors': errors, 'shots': shots}, indent=1))
asyncio.run(main())
