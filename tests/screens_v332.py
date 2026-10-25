# tests/screens_v332.py: v0.33.2 tap the circuit number in the schedule table to open that way. FAKE data only; no calibration dates.
import asyncio, os, json
from playwright.async_api import async_playwright
OUT = '/workspace/sparky-shots/v0.33.2'; BASE = 'http://localhost:8765/index.html'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
PREP = r"""(async()=>{const db=await import('./js/db.js');
 const ins=(await db.getMeta('instruments'))||[]; ins.forEach(i=>{i.calDue='';}); await db.setMeta('instruments',ins);
 const e=await db.get('certs','cert-eicr'); const b=e.boards[0]; const t=await import('./js/templates.js');
 const names=['Upstairs lights','Downstairs lights','Hall smoke alarms','Loft sockets','Garage sockets','Outside lights','Shower','Immersion'];
 while(b.circuits.length<16){ const n=t.copyCircuit(b.circuits[b.circuits.length%3],b.circuits.length+1); n.num=String(b.circuits.length+1); n.desc=names[b.circuits.length%names.length]; b.circuits.push(n); }
 await db.put('certs',e); return b.circuits.length; })"""
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []; info = {}
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for (w, hh) in [(1440, 900), (844, 390)]:
            phone = w < 900; tag = 'phone' if phone else 'mac'
            ctx = await br.new_context(viewport={'width': w, 'height': hh}, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone, service_workers='block')
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(tag + ': ' + str(e)))
            await pg.goto(BASE + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED); await pg.wait_for_timeout(300)
            await pg.evaluate(PREP)
            await pg.goto(BASE + '#/cert/cert-eicr/b/0'); await pg.reload(); await pg.wait_for_timeout(1200)
            await pg.evaluate("document.querySelectorAll('.syncchip').forEach(e=>e.remove())")
            # scroll so the table is in view and part-way down
            await pg.evaluate("(()=>{const w=document.querySelector('.tablewrap'); w.scrollIntoView({block:'start'}); scrollBy(0,-70); w.scrollTop=w.scrollHeight>w.clientHeight?140:0;})()")
            await pg.wait_for_timeout(300)
            btn = pg.locator('button.wayopen').nth(8)
            if not phone: await btn.hover()
            else: await btn.focus()
            await pg.wait_for_timeout(250)
            await pg.screenshot(path=f'{OUT}/{tag}-1-table.png')
            before = await pg.evaluate("[scrollY, document.querySelector('.tablewrap').scrollTop]")
            if phone: await btn.tap()
            else: await btn.click()
            await pg.wait_for_timeout(900)
            info[tag + '-hash'] = await pg.evaluate('location.hash')
            await pg.screenshot(path=f'{OUT}/{tag}-2-editor.png')
            await pg.locator('header.top button[aria-label=Back]').click(); await pg.wait_for_timeout(900)
            after = await pg.evaluate("[scrollY, document.querySelector('.tablewrap').scrollTop]")
            info[tag + '-scroll'] = [before, after]
            await pg.screenshot(path=f'{OUT}/{tag}-3-back.png')
            if not phone:  # keyboard: Enter on the number opens it
                await pg.locator('button.wayopen').nth(2).focus(); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(700)
                info['mac-enter-hash'] = await pg.evaluate('location.hash')
            await ctx.close()
        await br.close()
    print(json.dumps(info, indent=1)); print('ERRORS', errs)
asyncio.run(main())
