# tests/screens_v350c.py: v0.35.0 QA: preset list (no upstream RCD line on MCB presets), 45 A rating chip (MCB + RCBO). FAKE data only.
import asyncio, os, json, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/index.html'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/workspace/sparky-shots/v0.35.0'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
exec(open(os.path.join(os.path.dirname(__file__), 'screens_v350b.py')).read().split('PRESETS = ', 1)[1].split('\nasync def', 1)[0].join(['PRESETS = ', '']))
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for (w, hh) in [(1440, 900), (412, 915)]:
            phone = w < 900; tag = 'phone' if phone else 'mac'
            ctx = await br.new_context(viewport={'width': w, 'height': hh}, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone, service_workers='block')
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(tag + ': ' + str(e)))
            await pg.goto(BASE + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED); await pg.wait_for_timeout(300)
            await pg.evaluate("(async(L)=>{const P=await import('./js/presets.js'); L.forEach(x=>x.name=P.nameFor(P.clean(x.fields))); await P.save(L);})(" + json.dumps(PRESETS) + ")")
            await pg.goto(BASE + '#/settings/presets'); await pg.reload(); await pg.wait_for_timeout(1000)
            notes = await pg.evaluate("[...document.querySelectorAll('.prow .note')].map(n=>n.innerText)")
            print(tag, notes)
            if any('RCD' in n and '60898' in n for n in notes): errs.append(tag + ' MCB preset still shows RCD line')
            if not any('RCD' in n and '61009' in n for n in notes): errs.append(tag + ' RCBO preset lost RCD line')
            await pg.screenshot(path=f'{OUT}/{tag}-02-preset-labels.png', full_page=True)
            for dev in ['mcb', 'rcbo']:
                await pg.evaluate("(async(d)=>{const db=await import('./js/db.js'); const e=await db.get('certs','cert-eic'); const c=e.boards[0].circuits[0]; c.device=d; c.bs=d==='mcb'?'60898':'61009'; c.type='B'; c.rating='45'; await db.put('certs',e);})('" + dev + "')")
                await pg.goto(BASE + '#/cert/cert-eic/b/0/c/0'); await pg.reload(); await pg.wait_for_timeout(1200)
                chip = pg.locator('.f', has_text='Rating, A (col 10)').locator('.chip', has_text='45').first
                if not await chip.count(): errs.append(f'{tag} {dev} no 45 chip'); continue
                await chip.evaluate("e=>e.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(200)
                bb = await pg.locator('.f', has_text='Protective device').first.bounding_box()
                y = max(0, bb['y'] + await pg.evaluate('scrollY') - 20) if bb else 0
                await pg.screenshot(path=f'{OUT}/{tag}-03-45A-circuit-{dev}.png', full_page=True, clip={'x': 0, 'y': y, 'width': w, 'height': 560 if phone else 420})
        await br.close()
    print('errors:', errs)
asyncio.run(main())
