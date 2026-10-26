# tests/screens_v350d.py: v0.35.0: MCB preset leaves the circuit's RCD boxes alone; RCBO preset fills them. FAKE data only. Phone, light.
import asyncio, os, json, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/index.html'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/workspace/sparky-shots/v0.35.0'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
exec(open(os.path.join(os.path.dirname(__file__), 'screens_v350b.py')).read().split('PRESETS = ', 1)[1].split('\nasync def', 1)[0].join(['PRESETS = ', '']))
RCD = "[...document.querySelectorAll('input')].filter(i=>/rcd/i.test(i.dataset.k||i.name||'')).map(i=>i.value)"
async def main():
    errs = []
    async with async_playwright() as p:
        br = await p.chromium.launch(); w = 412
        ctx = await br.new_context(viewport={'width': w, 'height': 915}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block', color_scheme='light')
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED); await pg.wait_for_timeout(300)
        await pg.evaluate("(async(L)=>{const P=await import('./js/presets.js'); L.forEach(x=>x.name=P.nameFor(P.clean(x.fields))); await P.save(L);})(" + json.dumps(PRESETS) + ")")
        await pg.evaluate("(async()=>{const db=await import('./js/db.js'); const e=await db.get('certs','cert-eic'); const c=e.boards[0].circuits[0]; Object.assign(c,{device:'',bs:'',type:'',rating:'',bka:'',rcdBs:'61008',rcdType:'AC',rcdIdn:'30',rcdRating:'63',rcdS:false}); await db.put('certs',e);})()")
        for name, chip in [('mcb', 'B45 MCB'), ('rcbo', 'B32 RCBO')]:
            await pg.goto(BASE + '#/cert/cert-eic/b/0/c/0'); await pg.reload(); await pg.wait_for_timeout(1200)
            await pg.locator('.chips.presets .chip', has_text=chip).first.click(); await pg.wait_for_timeout(900)
            print(name, await pg.evaluate(RCD))
            y = await pg.evaluate("(()=>{const g=document.querySelector('.rcdgrp');g.scrollIntoView({block:'center'});return g.getBoundingClientRect().top+scrollY-130;})()")
            await pg.wait_for_timeout(300)
            print(name, await pg.evaluate("[...document.querySelector('.rcdgrp').querySelectorAll('input')].map(i=>i.value)"))
            await pg.screenshot(path=f'{OUT}/phone-17-preset-{name}-rcd-boxes.png', full_page=True, clip={'x': 0, 'y': y, 'width': w, 'height': 460})
        await br.close()
    print('errors:', errs)
asyncio.run(main())
