# tests/screens_v07.py — phone shots (412x915) of the v0.7 calculator layout, FAKE data only.
#   python3 -m http.server 8765 &   then   python3 tests/screens_v07.py [outdir] [after|before] [baseurl]
# "before" points at a v0.6 copy (e.g. a git worktree of main served on another port).
import asyncio, sys, os, json
from playwright.async_api import async_playwright
src = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.7'
MODE = sys.argv[2] if len(sys.argv) > 2 else 'after'
URL = (sys.argv[3] if len(sys.argv) > 3 else 'http://localhost:8765') + '/index.html'
W, H = (int(x) for x in os.environ.get('VIEW', '412x915').split('x'))
async def main():
    os.makedirs(OUT, exist_ok=True); errors = []; shots = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        mobile = W < 700
        ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, is_mobile=mobile, has_touch=mobile, service_workers='block',
          user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Mobile Safari/537.36' if mobile else None)
        page = await ctx.new_page()
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(URL + '#/'); await page.wait_for_timeout(800)
        await page.evaluate(SEED)
        await page.evaluate("async () => { const m = await import('/js/dcplan.js'); localStorage.setItem('sparky.dcplan1', JSON.stringify(m.VAN_EXAMPLE)); localStorage.setItem('sparky.dcsub', 'plan'); localStorage.removeItem('sparky.calclast'); localStorage.removeItem('sparky.calctab'); sessionStorage.clear(); }")
        await page.reload(); await page.wait_for_timeout(900)
        async def go(hh, wait=900): await page.evaluate(f"location.hash = '{hh}'"); await page.wait_for_timeout(wait)
        async def snap(name, full=False): await page.screenshot(path=os.path.join(OUT, name), full_page=full); shots.append(name)
        async def text_into(txt, off=-70): await page.evaluate("([t, o]) => { const e = [...document.querySelectorAll('h2,h3,.calchead,summary,.foldt')].find((x) => x.textContent.trim().startsWith(t)); if (e) { e.scrollIntoView({ block: 'start' }); window.scrollBy(0, o); } }", [txt, off]); await page.wait_for_timeout(350)
        async def scroll(y): await page.evaluate(f"window.scrollTo(0, {y})"); await page.wait_for_timeout(300)
        async def open_fold(fid): await page.evaluate("(f) => document.querySelectorAll(`details[data-fold='${f}']`).forEach((d) => d.open = true)", fid); await page.wait_for_timeout(250)
        pre = 'v07' if MODE == 'after' else 'v06-before'
        if MODE == 'before':
            await go('#/calc'); await snap(f'{pre}-01-calc-home.png')
            await go('#/calc/size'); await snap(f'{pre}-02-ac-sizer.png'); await scroll(800); await snap(f'{pre}-03-ac-sizer-2.png')
            await go('#/calc/check'); await snap(f'{pre}-04-check-it.png'); await scroll(800); await snap(f'{pre}-05-check-it-2.png')
            await go('#/calc/dc/pv'); await snap(f'{pre}-06-solar-battery.png')
            await go('#/calc/dc/plan'); await snap(f'{pre}-07-dc-planner-top.png')
            for i, y in enumerate([800, 1600, 2400, 3200]): await scroll(y); await snap(f'{pre}-{8 + i:02d}-dc-planner-{i + 2}.png')
        else:
            await go('#/calc'); await snap(f'{pre}-01-calc-home.png')
            # DC wizard, camper van example
            await go('#/calc/dc/plan/system'); await snap(f'{pre}-02-dc-step1-system.png')
            await open_fold('dc-sys'); await text_into('More options', -300); await snap(f'{pre}-03-dc-step1-more-options.png')
            await go('#/calc/dc/plan/loads'); await snap(f'{pre}-04-dc-step2-loads.png'); await text_into('Your loads'); await snap(f'{pre}-05-dc-step2-your-loads.png')
            await go('#/calc/dc/plan/charging'); await snap(f'{pre}-06-dc-step3-charging.png')
            await open_fold('dc-solar'); await text_into('More options', -200); await snap(f'{pre}-07-dc-step3-solar-more-options.png')
            await go('#/calc/dc/plan/inverter'); await snap(f'{pre}-08-dc-step4-inverter.png')
            await go('#/calc/dc/plan/cables'); await snap(f'{pre}-09-dc-step5-cable-runs.png'); await text_into('Fuse box to each load', -120); await snap(f'{pre}-10-dc-step5-loads.png')
            await page.evaluate("sessionStorage.clear()")
            await go('#/calc/dc/plan/results'); await snap(f'{pre}-11-dc-results-summary.png')
            await text_into('Connections'); await snap(f'{pre}-12-dc-results-connections.png')
            await text_into('Connections', 760); await snap(f'{pre}-13-dc-results-connections-2.png')
            await text_into('Connections', 1520); await snap(f'{pre}-14-dc-results-connections-3.png')
            await text_into('Wiring diagram', -10); await snap(f'{pre}-15-dc-results-wiring-diagram.png')
            await text_into('Wiring diagram', 700); await snap(f'{pre}-16-dc-results-wiring-diagram-2.png')
            await text_into('Cables & fuses', -40); await snap(f'{pre}-17-dc-results-collapsed.png')
            for f in ['dc-runs', 'dc-parts', 'dc-why', 'dc-safety']: await open_fold(f)
            await text_into('Cables & fuses', -40); await snap(f'{pre}-18-dc-results-expanded-cables.png')
            await text_into('Parts list', -40); await snap(f'{pre}-19-dc-results-expanded-parts.png')
            await text_into('Why (the reasons)', -40); await snap(f'{pre}-20-dc-results-expanded-why.png')
            await text_into('Safety notes', -40); await snap(f'{pre}-21-dc-results-expanded-safety.png')
            await page.evaluate("window.scrollTo(0, 99999)"); await page.wait_for_timeout(300); await snap(f'{pre}-22-dc-results-share.png')
            await page.evaluate("sessionStorage.clear()")
            await go('#/calc/size'); await snap(f'{pre}-23-ac-sizer.png'); await text_into('The run', -80); await snap(f'{pre}-24-ac-sizer-inputs.png')
            await open_fold('size-run'); await open_fold('size-how'); await text_into('More options', -200); await snap(f'{pre}-25-ac-sizer-more-options.png')
            await go('#/calc/check'); await snap(f'{pre}-26-check-it.png'); await text_into('The cable', -80); await snap(f'{pre}-27-check-it-inputs.png')
            await go('#/calc/dc/pv'); await snap(f'{pre}-28-solar-battery-checks.png')
            await go('#/calc/ring'); await page.evaluate("() => { localStorage.setItem('sparky.ring1', JSON.stringify({ csa: '2.5', r1: '0.52', rn: '0.53', r2: '0.86', r1r2: '0.36' })); }"); await go('#/calc'); await go('#/calc/ring'); await snap(f'{pre}-29-ring-final-check.png')
            await go('#/calc'); await snap(f'{pre}-30-calc-home-last-used.png')
            # PDF
            await page.evaluate("""async () => { const m = await import('/js/dcplan.js'); const pdf = await import('/js/dcplanpdf.js'); const blob = await pdf.dcPlanPdf(m.planDC(m.VAN_EXAMPLE), { title: 'Camper van (example)', inputs: m.VAN_EXAMPLE }); window.__pdf = blob; }""")
            data = await page.evaluate("async () => { const b = new Uint8Array(await window.__pdf.arrayBuffer()); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); }")
            import base64; open(os.path.join(OUT, 'DC-plan-camper-van-example.pdf'), 'wb').write(base64.b64decode(data))
        await b.close()
    print(json.dumps({'errors': errors, 'shots': shots}, indent=1))
asyncio.run(main())
