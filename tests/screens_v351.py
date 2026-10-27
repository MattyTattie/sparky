# tests/screens_v351.py: v0.35.1 — runtime table gone, diagram spacing on every leg. FAKE data only.
import asyncio, os, json, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/index.html'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/workspace/sparky-shots/v0.35.1'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
MATT = {'dcdcA': '', 'volts': '48', 'battAh': '2400', 'dod': '90', 'loads': [], 'invW': '5000', '_have': {'invW': True}, 'solarW': ''}
FULL = {'volts': '48', 'battAh': '2400', 'dod': '90', 'invW': '5000', '_have': {'invW': True}, 'solarW': '1600', 'panels': '8', 'pvLayout': 'parallel', 'smartAlt': 'yes', 'altA': '60', 'dcdcA': '30', 'shoreA': '20'}
RED = {'volts': '12', 'panels': '4', 'pvLayout': 'series', 'invW': '5000'}
async def plan(pg, vals, step):
    await pg.evaluate(f"(async()=>{{const D=await import('./js/dcplan.js'); localStorage.setItem('sparky.dcplan1', JSON.stringify({{...D.VAN_EXAMPLE, ...{json.dumps(vals)}}})); localStorage.setItem('sparky.dcstep','{step}');}})()")
    await pg.goto(BASE + '#/calc/dc/plan/' + step); await pg.reload(); await pg.wait_for_timeout(1000)
    await pg.evaluate("document.querySelectorAll('.syncchip').forEach(e=>e.remove())")
    if pg.viewport_size['width'] < 900: await pg.add_style_tag(content='.bottomnav{display:none!important}')
async def leg(pg, name, x0, y0, x1, y1):
    s = pg.locator('.wiring svg').first; await s.scroll_into_view_if_needed(); bb = await s.bounding_box()
    vb = await s.evaluate("e=>e.viewBox.baseVal.width"); k = bb['width'] / vb; sy = await pg.evaluate('scrollY'); sx = await pg.evaluate('scrollX'); bb = {**bb, 'x': bb['x'] + sx, 'y': bb['y'] + sy}
    await pg.screenshot(path=f'{OUT}/{name}.png', clip={'x': bb['x'] + x0 * k, 'y': bb['y'] + y0 * k, 'width': (x1 - x0) * k, 'height': (y1 - y0) * k}, full_page=True)
async def legs(pg, tag):
    m = await pg.evaluate("(async()=>{const D=await import('./js/dcplan.js'); const W=await import('./js/dcwire.js'); const o={...D.VAN_EXAMPLE,...JSON.parse(localStorage.getItem('sparky.dcplan1'))}; const m=W.wiringModel(D.planDC(o),o); return {Y:Object.fromEntries(m.boxes.map(b=>[b.t,[b.y,b.y+b.h]])), H:m.H};})()")
    Y = m['Y']; g = lambda k, i: next((v[i] for t, v in Y.items() if t.startswith(k)), None)
    bus = g('+ BUSBAR', 0); inv = g('Inverter', 1); acb = g('AC output', 1)
    await leg(pg, f'{tag}-leg-solar', 0, 0, 122, bus + 24)
    await leg(pg, f'{tag}-leg-battery-mainfuse-isolator', 118, 0, 242, bus + 24)
    await leg(pg, f'{tag}-leg-dcdc-charger', 238, 0, 360, bus + 24)
    if inv: await leg(pg, f'{tag}-leg-inverter-ac', 0, bus - 4, 130, (acb or inv) + 6)
    await leg(pg, f'{tag}-leg-fusebox-loads-shore', 118, bus - 4, 360, min(m['H'], (acb or bus + 120) + 60))
    neg = g('Battery −', 0)
    if neg: await leg(pg, f'{tag}-leg-negative-chassis', 0, neg - 20, 360, m['H'])
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for (w, hh, scheme) in [(412, 915, 'dark'), (412, 915, 'light'), (1440, 900, 'light'), (1440, 900, 'dark')]:
            phone = w < 900; tag = ('phone' if phone else 'mac') + '-' + scheme
            ctx = await br.new_context(viewport={'width': w, 'height': hh}, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone, service_workers='block', color_scheme=scheme)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(tag + ': ' + str(e)))
            await pg.goto(BASE + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED); await pg.wait_for_timeout(300)
            await plan(pg, MATT, 'results')
            if 'Battery runtime' in await pg.evaluate('document.body.innerText'): errs.append(tag + ': runtime table still there')
            if phone: 
                await pg.evaluate("(()=>{const c=document.querySelector('.card'); const r=c.getBoundingClientRect(); scrollTo(0, scrollY + r.bottom - 420);})()"); await pg.wait_for_timeout(200)
                await pg.screenshot(path=f'{OUT}/{tag}-01-planner-no-runtime.png')
            await shot_svg(pg, f'{tag}-02-diagram-matthew-48V-2400Ah-5000W')
            await legs(pg, tag + '-matthew')
            await plan(pg, FULL, 'results'); await shot_svg(pg, f'{tag}-03-diagram-all-devices'); await legs(pg, tag + '-full')
            await plan(pg, RED, 'results'); await shot_svg(pg, f'{tag}-04-diagram-over-limit-red'); await legs(pg, tag + '-red')
            await ctx.close()
        await br.close()
    print('errors:', errs)
async def shot_svg(pg, name):
    l = pg.locator('.wiring svg').first
    if await l.count(): await l.scroll_into_view_if_needed(); await pg.wait_for_timeout(200); await l.screenshot(path=f'{OUT}/{name}.png')
asyncio.run(main())
