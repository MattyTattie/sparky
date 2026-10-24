# tests/screens_v28.py OUTDIR: v0.28 shots. Desktop 1440x900 (light/dark) + phone max demand grouped. FAKE data only.
import asyncio, sys, os, json
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.28'
BASE = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:8765/index.html'
ONLY = sys.argv[3] if len(sys.argv) > 3 else ''
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
MD = {'fuse': '100', 'loads': [{'k': 'cooking', 'qty': 1, 'value': 7.4, 'name': 'Hob'}, {'k': 'heater', 'qty': 1, 'value': 2, 'name': 'Lounge panel'}, {'k': 'cooking', 'qty': 1, 'value': 3, 'name': 'Oven'},
  {'k': 'heater', 'qty': 3, 'value': 1.5, 'name': 'Bedroom panels'}, {'k': 'cooking', 'qty': 1, 'value': 3, 'name': 'Combi microwave'}, {'k': 'immersion', 'qty': 1, 'value': 3},
  {'k': 'ring', 'qty': 2, 'value': 32}, {'k': 'radial', 'qty': 1, 'value': 20, 'name': 'Garage'}, {'k': 'lighting', 'qty': 2, 'value': 400}]}
DESK = [('jobs', '#/'), ('job-detail', '#/job/job-demo'), ('cert-form', '#/cert/cert-eic/s/supply'), ('schedule', '#/cert/cert-eic/b/0'), ('maxdemand', '#/calc/md'), ('settings', '#/settings')]
PHONE_SAME = [('jobs', '#/'), ('job-detail', '#/job/job-demo'), ('cert', '#/cert/cert-eic'), ('cert-form', '#/cert/cert-eic/s/supply'), ('schedule', '#/cert/cert-eic/b/0'), ('calc', '#/calc'), ('settings', '#/settings'), ('customers', '#/customers')]
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []; info = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        sets = [(1440, 900, DESK), (412, 915, [('maxdemand', '#/calc/md')] + PHONE_SAME)]
        if ONLY == 'phone': sets = [(412, 915, PHONE_SAME)]
        for (w, hh, shots) in sets:
            for scheme in ['light', 'dark']:
                phone = w < 900
                ctx = await b.new_context(viewport={'width': w, 'height': hh}, device_scale_factor=2.6 if phone else 1, is_mobile=phone, has_touch=phone, service_workers='block', color_scheme=scheme)
                pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
                await pg.goto(BASE + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED)
                await pg.evaluate(f"localStorage.setItem('sparky.md1', JSON.stringify({json.dumps(MD)}))"); await pg.reload(); await pg.wait_for_timeout(700)
                for name, r in shots:
                    await pg.goto(BASE + '#/calc/symbols'); await pg.wait_for_timeout(100); await pg.goto(BASE + r); await pg.wait_for_timeout(1100)
                    await pg.evaluate("document.querySelectorAll('.syncchip').forEach(e=>e.remove())")
                    tag = 'phone' if phone else 'desk'
                    await pg.screenshot(path=f'{OUT}/v28-{tag}-{name}-{scheme}.png')
                    info[f'{w}-{scheme}-{name}'] = await pg.evaluate("""() => ({ hscroll: document.documentElement.scrollWidth > innerWidth, ell: [...document.querySelectorAll('main *')].filter(e => getComputedStyle(e).textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth).map(e=>e.className).slice(0,3) })""")
                    if name == 'maxdemand':
                        await pg.screenshot(path=f'{OUT}/v28-{tag}-{name}-full-{scheme}.png', full_page=True)
                        await pg.locator('.mdkind[data-kind="heater"]').scroll_into_view_if_needed(); await pg.evaluate('scrollBy(0,-90)'); await pg.wait_for_timeout(200)
                        await pg.screenshot(path=f'{OUT}/v28-{tag}-{name}-heaters-{scheme}.png')
                        # ± must not move the page
                        btn = pg.locator('.mdkind[data-kind="heater"] button[aria-label="One more"]').nth(1)
                        await btn.scroll_into_view_if_needed(); t0 = await btn.evaluate('e=>e.getBoundingClientRect().top'); y0 = await pg.evaluate('scrollY')
                        await btn.click(); await pg.wait_for_timeout(250)
                        info[f'{w}-{scheme}-pm'] = [y0, await pg.evaluate('scrollY'), round(t0, 1), round(await btn.evaluate('e=>e.getBoundingClientRect().top'), 1), await pg.locator('.mdkind[data-kind="heater"] .mdkwork').inner_text()]
                        await btn.locator('xpath=..').locator('button[aria-label="One fewer"]').click()
                        await pg.locator('.mdkind[data-kind="heater"] .mdaddsize').click(); await pg.wait_for_timeout(300)
                        info[f'{w}-{scheme}-addsize'] = await pg.evaluate("[document.querySelectorAll('.mdkind').length, document.querySelectorAll('.mdkind[data-kind=heater] .mdline').length]")
                        await pg.locator('.mdadd button', has_text='Space heater').click(); await pg.wait_for_timeout(300)
                        info[f'{w}-{scheme}-addchip'] = await pg.evaluate("[document.querySelectorAll('.mdkind').length, document.querySelectorAll('.mdkind[data-kind=heater] .mdline').length]")
                        await pg.evaluate(f"localStorage.setItem('sparky.md1', JSON.stringify({json.dumps(MD)}))")
                await ctx.close()
        await b.close()
    print(json.dumps({k: v for k, v in info.items() if not isinstance(v, dict) or v['hscroll'] or v['ell']}, indent=0)); print('errors:', errs)
asyncio.run(main())
