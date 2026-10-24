# tests/screens_v27.py OUTDIR: v0.27 desktop layout shots (1440x900, 1280x800) + phone check. FAKE data only.
import asyncio, sys, os, json
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.27'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
U = 'http://localhost:8765/index.html'
MD = {'fuse': '100', 'loads': [{'k': 'cooking', 'qty': 1, 'value': 7.4, 'name': 'Hob'}, {'k': 'cooking', 'qty': 1, 'value': 3, 'name': 'Oven'},
  {'k': 'immersion', 'qty': 1, 'value': 3}, {'k': 'heater', 'qty': 3, 'value': 1.5, 'name': 'Bedroom panels'}, {'k': 'ring', 'qty': 2, 'value': 32}, {'k': 'lighting', 'qty': 2, 'value': 400}]}
SHOTS = [('jobs', '#/'), ('job-detail', '#/job/job-demo'), ('cert', '#/cert/cert-eic'), ('cert-form', '#/cert/cert-eic/s/supply'),
         ('schedule', '#/cert/cert-eic/b/0'), ('calc-index', '#/calc'), ('maxdemand', '#/calc/md'), ('settings', '#/settings')]
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []; info = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for (w, hh) in [(1440, 900), (1280, 800), (412, 915)]:
            for scheme in ['light', 'dark']:
                phone = w < 900
                ctx = await b.new_context(viewport={'width': w, 'height': hh}, device_scale_factor=2.6 if phone else 1, is_mobile=phone, has_touch=phone, service_workers='block', color_scheme=scheme)
                pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
                await pg.goto(U + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED)
                await pg.evaluate(f"localStorage.setItem('sparky.md1', JSON.stringify({json.dumps(MD)}))"); await pg.reload(); await pg.wait_for_timeout(700)
                for name, r in (SHOTS if not phone else [('jobs', '#/'), ('job-detail', '#/job/job-demo'), ('maxdemand', '#/calc/md')]):
                    await pg.goto(U + '#/calc/symbols'); await pg.wait_for_timeout(100); await pg.goto(U + r); await pg.wait_for_timeout(1100)
                    await pg.screenshot(path=f'{OUT}/v27-{name}-{w}x{hh}-{scheme}.png')
                    info[f'{w}-{scheme}-{name}'] = await pg.evaluate("""() => ({ hscroll: document.documentElement.scrollWidth > innerWidth, pane: !!document.querySelector('.jobpane'), nav: !!document.querySelector('nav.bottomnav'), ell: [...document.querySelectorAll('main *')].some(e => getComputedStyle(e).textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth) })""")
                await ctx.close()
        await b.close()
    bad = {k: v for k, v in info.items() if v['hscroll'] or v['ell']}
    print('problems:', json.dumps(bad, indent=1)); print('phone:', {k: v for k, v in info.items() if k.startswith('412')}); print('errors:', errs)
asyncio.run(main())
