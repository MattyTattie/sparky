# tests/screens_v30.py OUTDIR: v0.30.0 Reference section shots, phone + desktop. FAKE data only.
import asyncio, sys, os, json
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.30.0'
BASE = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:8765/index.html'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
IDS = ['ground', 'bonding', 'ir', 'disc', 'r1r2', 'rcd', 'special', 'ip']
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []; info = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for (w, hh) in [(1440, 900), (412, 915)]:
            phone = w < 900; tag = 'phone' if phone else 'desk'
            ctx = await b.new_context(viewport={'width': w, 'height': hh}, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone, service_workers='block')
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(tag + ': ' + str(e)))
            await pg.goto(BASE + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED)
            async def at(h, wait=800):
                await pg.goto(BASE + '#' + h); await pg.reload(); await pg.wait_for_timeout(wait)
                await pg.evaluate("document.querySelectorAll('.syncchip').forEach(e=>e.remove())")
            await at('/calc'); await pg.evaluate('scrollTo(0, document.body.scrollHeight)'); await pg.wait_for_timeout(200)
            await pg.screenshot(path=f'{OUT}/{tag}-00-calculators-reference-link.png')
            await at('/ref'); await pg.screenshot(path=f'{OUT}/{tag}-01-reference-list.png', full_page=True)
            for i, id in enumerate(IDS, 2):
                await at('/ref/' + id)
                await pg.evaluate("document.querySelectorAll('details.refmore').forEach(d=>d.open=true)")
                info[f'{tag}-{id}-overflow'] = await pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
                info[f'{tag}-{id}-clipped'] = await pg.evaluate("[...document.querySelectorAll('.reftbl th,.reftbl td,.reflist li')].filter(e=>getComputedStyle(e).textOverflow==='ellipsis'||e.scrollWidth>e.clientWidth+1).length")
                await pg.screenshot(path=f'{OUT}/{tag}-{i:02d}-{id}.png', full_page=True)
            await ctx.close()
        await b.close()
    print(json.dumps(info, indent=1)); print('ERRORS', errs)
asyncio.run(main())
