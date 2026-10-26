# tests/screens_v350.py: v0.35.0 items. FAKE data only; no calibration dates. Usage: python3 screens_v350.py [base] [outdir] [beforeonly]
import asyncio, os, json, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/index.html'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/workspace/sparky-shots/v0.35.0'
BEFORE = len(sys.argv) > 3
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
PREP = r"""(async()=>{const db=await import('./js/db.js'); const ins=(await db.getMeta('instruments'))||[]; ins.forEach(i=>{i.calDue='';}); await db.setMeta('instruments',ins);
 const e=await db.get('certs','cert-eic'); e.install.extentType='New installation'; e.comments='New consumer unit and two new circuits fitted.'; await db.put('certs',e); return 1;})()"""
VAN = None
async def plan(pg, vals, step):
    await pg.evaluate(f"(async()=>{{const D=await import('./js/dcplan.js'); localStorage.setItem('sparky.dcplan1', JSON.stringify({{...D.VAN_EXAMPLE, ...{json.dumps(vals)}}})); localStorage.setItem('sparky.dcstep','{step}');}})()")
    await pg.goto(BASE + '#/calc/dc/plan/' + step); await pg.reload(); await pg.wait_for_timeout(1000)
    await pg.evaluate("document.querySelectorAll('.syncchip').forEach(e=>e.remove()); document.querySelectorAll('details').forEach(d=>d.open=true)")
    if pg.viewport_size['width'] < 900: await pg.add_style_tag(content='.bottomnav{display:none!important}')
async def shot(pg, name, sel=None):
    if sel:
        l = pg.locator(sel).first
        if await l.count(): await l.scroll_into_view_if_needed(); await pg.wait_for_timeout(200); await l.screenshot(path=f'{OUT}/{name}.png'); return
    await pg.evaluate('scrollTo(0,0)'); await pg.screenshot(path=f'{OUT}/{name}.png')  # v0.35 QA: viewport, not a 10,000 px strip
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for (w, hh) in [(1440, 900), (412, 915)]:
            phone = w < 900; tag = 'phone' if phone else 'mac'
            ctx = await br.new_context(viewport={'width': w, 'height': hh}, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone, service_workers='block')
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(tag + ': ' + str(e)))
            await pg.goto(BASE + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED); await pg.wait_for_timeout(300); await pg.evaluate(PREP)
            res = {'pvLayout': 'parallel', 'smartAlt': 'yes', 'altA': '60', 'dcdcA': '30'}
            await plan(pg, res, 'results')
            await shot(pg, f'{tag}-11-diagram' + ('-BEFORE' if BEFORE else '-after'), '.wiring svg')
            if BEFORE: continue
            await shot(pg, f'{tag}-11-diagram-results-full')
            bad = {'panels': '4', 'pvLayout': 'series'}
            await plan(pg, bad, 'results'); await shot(pg, f'{tag}-11-diagram-over-limit-red', '.wiring svg')
            await plan(pg, {'volts': '48', 'battAh': '2400', 'loads': []}, 'results'); await shot(pg, f'{tag}-13-no-loads-results', '.card')
            inv = {'volts': '48', 'battAh': '2400', 'dod': '90', 'loads': [], 'invW': '5000', '_have': {'invW': True}, 'solarW': ''}
            await plan(pg, inv, 'results'); await shot(pg, f'{tag}-14-inverter-only-results', '.card')
            await shot(pg, f'{tag}-15-runtime-table', '.card:has-text("Battery runtime at inverter load")')
            await plan(pg, inv, 'inverter'); await shot(pg, f'{tag}-14-inverter-step-kwh-idle')
            for r in ['#/calc/dc/plan/results', '#/calc/dc/pv']:
                await pg.goto(BASE + r); await pg.wait_for_timeout(800)
                bad = await pg.evaluate("(document.body.innerText.match(/.{30}\\b(null|NaN|Infinity|undefined)\\b.{10}/)||[''])[0]")
                if bad: errs.append(f'{tag} {r} text: {bad}')
            await plan(pg, {}, 'loads'); await shot(pg, f'{tag}-12-kwh-battery-step', '.card:has-text("Battery")')
            await plan(pg, {'battUnit': 'kwh', 'battAh': '', 'battKwh': '2.56', '_have': {'battAh': True}}, 'loads'); await shot(pg, f'{tag}-12-kwh-entry', '.card:has-text("Battery size in")')
            await plan(pg, res, 'results'); await shot(pg, f'{tag}-12-kwh-results', '.card')
            await plan(pg, res, 'charging'); await shot(pg, f'{tag}-04-05-06-09-charging-dcdc-alt-smart-layout')
            await plan(pg, res, 'results')
            await shot(pg, f'{tag}-07-charger-settings', '.card:has-text("Charger settings")')
            await shot(pg, f'{tag}-08-solar-cable-row', '.card:has-text("Solar cable")')
            b = pg.get_by_role('button', name='Parts list PDF')
            if await b.count():
                await b.first.click(); await pg.wait_for_timeout(1500); await shot(pg, f'{tag}-10-parts-pdf-view-share')
            await pg.evaluate("localStorage.setItem('sparky.size1', JSON.stringify({load:'10',unit:'kW',length:'15',method:'C',grouped:'1',device:'mcb',type:'B'}))")
            await pg.goto(BASE + '#/calc/size'); await pg.reload(); await pg.wait_for_timeout(1000); await shot(pg, f'{tag}-03-45A-sizer')
            await pg.goto(BASE + '#/settings/presets'); await pg.reload(); await pg.wait_for_timeout(1000); await shot(pg, f'{tag}-02-preset-labels')
            await pg.goto(BASE + '#/cert/cert-eic'); await pg.reload(); await pg.wait_for_timeout(1200)
            t = pg.locator('text=/Section I|Comments/').first
            if await t.count():
                try: await t.click(); await pg.wait_for_timeout(700)
                except Exception: pass
            m = pg.locator('text=/Section B, Description and extent/').first
            if await m.count(): await m.scroll_into_view_if_needed()
            await pg.screenshot(path=f'{OUT}/{tag}-01-section-i-hint.png')
        await br.close()
    print('errors:', errs)
asyncio.run(main())
