# tests/screens_v08.py — phone shots (412x915) of v0.8: section G/J show/hide boxes,
# per-service bonding sizes, RCD/OCPD ticks, green dots, inspection help lines,
# Back + Next. FAKE data only.   python3 -m http.server 8765 &   then   python3 tests/screens_v08.py [outdir]
import asyncio, sys, os, json
from playwright.async_api import async_playwright
src = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.8'
URL = 'http://localhost:8765/index.html'
async def main():
    os.makedirs(OUT, exist_ok=True); errors = []; shots = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for W, H, tag in [(412, 915, ''), (1280, 820, 'mac-')]:
            mobile = W < 700
            ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, is_mobile=mobile, has_touch=mobile, service_workers='block',
              user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Mobile Safari/537.36' if mobile else None)
            page = await ctx.new_page()
            page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
            page.on('pageerror', lambda e: errors.append(str(e)))
            await page.goto(URL + '#/'); await page.wait_for_timeout(800)
            await page.evaluate(SEED); await page.reload(); await page.wait_for_timeout(900)
            async def go(hh, wait=800): await page.evaluate(f"location.hash = '{hh}'"); await page.wait_for_timeout(wait)
            async def snap(name, full=False): await page.screenshot(path=os.path.join(OUT, tag + name), full_page=full); shots.append(tag + name)
            async def into(txt, off=-90): await page.evaluate("([t, o]) => { const e = [...document.querySelectorAll('label, .f, .ins, .notice')].find((x) => x.textContent.trim().startsWith(t)); if (e) { e.scrollIntoView({ block: 'start' }); window.scrollBy(0, o); } }", [txt, off]); await page.wait_for_timeout(350)
            async def tick(txt): await page.locator('label.check', has_text=txt).first.locator('input').click(); await page.wait_for_timeout(300)
            if not mobile:
                await go('#/cert/cert-eic/s/parts'); await snap('01-parts-distributor.png')
                await page.close(); await ctx.close(); continue
            # 1. distributor's facility: electrode boxes hidden
            await go('#/cert/cert-eic/s/parts'); await snap('01-parts-distributor-electrode-hidden.png')
            # 2. installation earth electrode: boxes appear, dot goes grey until filled
            await page.locator('button.chip', has_text='Installation earth electrode').click(); await page.wait_for_timeout(400)
            await snap('02-parts-electrode-boxes-showing.png')
            await page.locator('button.chip', has_text='Distributor').click(); await page.wait_for_timeout(400)
            # 3. water + gas ticked: own csa boxes (gas given 16)
            await into('Main bonding material')
            gas = page.locator('label.f', has_text='Gas bonding csa').locator('input'); await gas.fill('16'); await page.wait_for_timeout(300)
            await snap('03-parts-water-gas-own-csa.png')
            # 4. RCD tick on
            await tick('Main switch is an RCD'); await into('Main switch is a breaker', -40)
            await snap('04-parts-rcd-tick-on.png')
            for lab, v in [('RCD type', 'S type A'), ('IΔn', '100'), ('Rated time delay', '0'), ('Measured operating time', '160')]:
                await page.locator('label.f', has_text=lab).locator('input').fill(v)
            await page.wait_for_timeout(300); await snap('05-parts-rcd-filled.png')
            # 6. back/next buttons at the bottom
            await page.evaluate("window.scrollTo(0, 99999)"); await page.wait_for_timeout(400); await snap('06-parts-bottom-back-next.png')
            # 7. section list: green and grey dots
            await go('#/cert/cert-eic'); await page.evaluate("document.querySelector('.list').scrollIntoView({block:'start'}); window.scrollBy(0,-80)"); await page.wait_for_timeout(300); await snap('07-section-list-dots.png')
            await go('#/cert/cert-eic/s/parts'); await page.locator('button.chip', has_text='Installation earth electrode').click(); await page.wait_for_timeout(300)
            await go('#/cert/cert-eic'); await page.evaluate("document.querySelector('.list').scrollIntoView({block:'start'}); window.scrollBy(0,-80)"); await page.wait_for_timeout(300); await snap('07b-section-list-parts-grey.png')
            await go('#/cert/cert-eic/s/parts'); await page.locator('button.chip', has_text='Distributor').click(); await page.wait_for_timeout(300)
            # a complete one, to show the green line
            await go('#/cert/cert-eic/s/supply'); await snap('08-supply-all-filled-green.png')
            # 9. section H with help lines (EIC) and the EICR schedule
            await go('#/cert/cert-eic/s/inspections'); await snap('09-eic-section-h-help.png')
            await page.evaluate("window.scrollTo(0, 900)"); await page.wait_for_timeout(300); await snap('10-eic-section-h-help-2.png')
            await go('#/cert/cert-eicr/s/inspections'); await into('3.1', -60); await snap('11-eicr-schedule-help.png')
            # first section: Next only, no Back
            await go('#/cert/cert-eic/s/client'); await page.evaluate("window.scrollTo(0, 99999)"); await page.wait_for_timeout(300); await snap('12-first-section-next-only.png')
            await page.close(); await ctx.close()
        await b.close()
    print(json.dumps({'errors': errors, 'shots': shots}, indent=1))
asyncio.run(main())
