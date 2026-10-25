# tests/screens_v314.py: v0.31.4 SPD exclusive ticks + Not operational observation. FAKE data only, no instrument shots.
import asyncio, os, json
from playwright.async_api import async_playwright
OUT = '/workspace/sparky-shots/v0.31.4'; BASE = 'http://localhost:8765/index.html'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []; info = {}
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for (w, hh) in [(1440, 900), (390, 844)]:
            phone = w < 900; tag = 'phone' if phone else 'mac'
            ctx = await br.new_context(viewport={'width': w, 'height': hh}, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone, service_workers='block', color_scheme='dark' if phone else 'light')
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(tag + ': ' + str(e)))
            await pg.goto(BASE + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED)
            async def at(h):
                await pg.goto(BASE + '#' + h); await pg.reload(); await pg.wait_for_timeout(900)
                await pg.evaluate("document.querySelectorAll('.syncchip').forEach(e=>e.remove()); document.querySelectorAll('details.card').forEach(d=>d.open=true)")
            ck = lambda t: pg.locator(f'label.check:text-is("{t}") input').first
            state = "[...document.querySelectorAll('label.check')].filter(l=>/^(T1|T2|T3|N\\/A|SPD operational status confirmed|Not operational)$/.test(l.textContent.trim())).map(l=>l.textContent.trim()+(l.offsetParent?'':' (hidden)')+(l.querySelector('input').checked?' [x]':' [ ]'))"
            async def shot(n, anchor='T1'):
                await pg.evaluate('scrollTo(0, document.body.scrollHeight)'); await pg.wait_for_timeout(150)
                await ck(anchor).evaluate('e=>e.scrollIntoView({block:"center"})'); await pg.wait_for_timeout(250)
                await pg.screenshot(path=f'{OUT}/{tag}-{n}.png')
            await at('/cert/cert-eic/b/0')
            info[tag+'-eic'] = await pg.evaluate(state)
            await shot('1-eic-no-not-operational-tick', 'N/A')
            await at('/cert/cert-eicr/b/0')
            if await ck('N/A').is_checked(): await ck('N/A').click()
            await ck('T2').click(); await pg.wait_for_timeout(200)
            if not await ck('T2').is_checked(): await ck('T2').click()
            info[tag+'-1'] = await pg.evaluate(state); pass
            await ck('N/A').click(); await pg.wait_for_timeout(300); info[tag+'-2'] = await pg.evaluate(state); await pg.wait_for_timeout(600); pass
            await ck('T2').click(); await pg.wait_for_timeout(300); info[tag+'-3'] = await pg.evaluate(state); await pg.wait_for_timeout(600); pass
            await ck('Not operational').click(); await pg.wait_for_timeout(500); info[tag+'-4'] = await pg.evaluate(state); await shot('2-eicr-not-operational-ticked', 'Not operational')
            await pg.wait_for_timeout(1500)
            await at('/cert/cert-eicr/s/observations')
            info[tag+'-obs'] = await pg.evaluate("(async()=>{const db=await import('./js/db.js');const c=await db.get('certs','cert-eicr');return c.observations.map(o=>o.code+' '+o.text)})()")
            el = pg.locator('textarea, input').filter(has_text='') 
            await pg.evaluate("[...document.querySelectorAll('textarea,input')].find(e=>/replacement required/.test(e.value))?.scrollIntoView()"); await pg.evaluate('scrollBy(0,-200)'); await pg.wait_for_timeout(200)
            await pg.screenshot(path=f'{OUT}/{tag}-3-eicr-observation-added.png')
            await ctx.close()
        await br.close()
    print(json.dumps(info, indent=1)); print('ERRORS', errs)
asyncio.run(main())
