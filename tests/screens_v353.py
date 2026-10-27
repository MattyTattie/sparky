# tests/screens_v353.py: v0.35.3 — schedule result boxes grow to fit ('>999', long values). FAKE data only.
import asyncio, os, sys, json
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.35.3'
BASE = 'http://localhost:8765/index.html'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
PREP = r"""(async()=>{const db=await import('./js/db.js');
 const ins=(await db.getMeta('instruments'))||[]; ins.forEach(i=>{i.calDue='';}); await db.setMeta('instruments',ins);
 const e=await db.get('certs','cert-eicr'); const b=e.boards[0];
 b.circuits.forEach((c,i)=>{ c.irV='500'; c.irLL='>999'; c.irLE='>999'; });
 b.circuits[1].irLL='>1999'; b.circuits[1].irLE='>2000'; b.circuits[1].zs='0.123456'; b.circuits[2].r1r2='12.3456';
 await db.put('certs',e); return b.circuits.length; })"""
CHECK = r"""(()=>[...document.querySelectorAll('table.sched tbody input')].filter(i=>i.value&&i.scrollWidth>i.clientWidth+1).map(i=>i.getAttribute('aria-label')+'='+i.value))()"""
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []; info = {}
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for (w, hh, scheme, nm) in [(1440, 900, 'dark', 'mac-dark'), (1440, 900, 'light', 'mac-light'), (1100, 800, 'dark', 'narrow-dark'), (915, 412, 'dark', 'phone-landscape-dark'), (412, 915, 'dark', 'phone-portrait-dark')]:
            phone = w < 900 or hh < 500
            ctx = await br.new_context(viewport={'width': w, 'height': hh}, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone, service_workers='block', color_scheme=scheme)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(nm + ': ' + str(e)))
            await pg.goto(BASE + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED); await pg.wait_for_timeout(300)
            await pg.evaluate(PREP)
            await pg.goto(BASE + '#/cert/cert-eicr/b/0'); await pg.reload(); await pg.wait_for_timeout(1500)
            await pg.evaluate("document.querySelectorAll('.syncchip,.toast').forEach(e=>e.remove())")
            if await pg.locator('table.sched').count():
                await pg.evaluate("(()=>{const t=document.querySelector('table.sched'); t.scrollIntoView({block:'start'}); scrollBy(0,-80); const c=t.querySelector('td[data-k=irLL]'); const w=t.closest('.tablewrap'); w.scrollLeft=c.offsetLeft-260;})()")
                await pg.wait_for_timeout(300)
                info[nm] = await pg.evaluate(CHECK)
            else:
                await pg.evaluate("(()=>{const e=document.querySelector('.ccard'); e&&e.scrollIntoView({block:'start'}); scrollBy(0,-70);})()"); await pg.wait_for_timeout(250)
                info[nm] = 'cards (no table)'
            await pg.screenshot(path=f'{OUT}/{nm}-schedule.png')
            await ctx.close()
        await br.close()
    print(json.dumps(info, indent=1)); print('ERRORS', errs)
asyncio.run(main())
