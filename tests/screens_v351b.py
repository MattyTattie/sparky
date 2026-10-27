# tests/screens_v351b.py: v0.35.1 — battery sizing moved to System; over-limit setups (before/after). FAKE data only.
import asyncio, os, sys
sys.argv = sys.argv[:1]
exec(open(os.path.join(os.path.dirname(__file__), 'screens_v351.py')).read().split('async def main():')[0])
AFTER, BEFORE = 'http://localhost:8765/index.html', 'http://localhost:8766/index.html'
RED12 = {'volts': '12', 'invW': '5000', '_have': {'invW': True}}
async def shot_svg(pg, name):
    l = pg.locator('.wiring svg').first
    if await l.count(): await l.scroll_into_view_if_needed(); await pg.wait_for_timeout(200); await l.screenshot(path=f'{OUT}/{name}.png')
async def main():
    global BASE
    os.makedirs(OUT, exist_ok=True); errs = []
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for (w, hh, scheme) in [(412, 915, 'dark'), (412, 915, 'light'), (1440, 900, 'light')]:
            phone = w < 900; tag = ('phone' if phone else 'mac') + '-' + scheme
            for when, base in [('after', AFTER), ('before', BEFORE)]:
                BASE = base
                ctx = await br.new_context(viewport={'width': w, 'height': hh}, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone, service_workers='block', color_scheme=scheme)
                pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(tag + ': ' + str(e)))
                await pg.goto(BASE + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED); await pg.wait_for_timeout(300)
                globals()['BASE'] = base
                if when == 'after':
                    await plan(pg, {}, 'loads')
                    t = await pg.evaluate('document.body.innerText')
                    if 'Size for me' in t: errs.append(tag + ': battery block still on loads')
                    await pg.evaluate("(()=>{const e=document.querySelector('.tot'); e.scrollIntoView({block:'center'});})()"); await pg.wait_for_timeout(200)
                    await pg.screenshot(path=f'{OUT}/{tag}-10-loads-step-ends-at-daily-total.png')
                    await plan(pg, {'battAh': '', '_have': {}}, 'system'); await pg.locator('.card').first.screenshot(path=f'{OUT}/{tag}-11-system-battery-size-for-me.png')
                    await plan(pg, {'volts': '48', 'battAh': '2400', '_have': {'battAh': True}}, 'system'); await pg.locator('.card').first.screenshot(path=f'{OUT}/{tag}-12-system-battery-have-2400Ah.png')
                await plan(pg, RED12, 'results')
                t = await pg.evaluate('document.body.innerText')
                for bad in ['null', 'undefined', 'NaN', ' ?']:
                    if bad in t and when == 'after': errs.append(f'{tag}: "{bad}" on results')
                await pg.locator('.card').first.screenshot(path=f'{OUT}/{tag}-13-{when}-12V-5000W-results.png')
                await shot_svg(pg, f'{tag}-14-{when}-12V-5000W-diagram')
                await ctx.close()
        await br.close()
    print('errors:', errs)
asyncio.run(main())
