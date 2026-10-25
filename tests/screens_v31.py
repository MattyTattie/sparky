# tests/screens_v31.py OUTDIR: v0.31.0 shots, phone (dark) + Mac 1440. FAKE data only.
import asyncio, sys, os, json
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.31.0'
BASE = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:8765/index.html'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []; info = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for (w, hh) in [(1440, 900), (390, 844)]:
            phone = w < 900; tag = 'phone' if phone else 'mac'
            ctx = await b.new_context(viewport={'width': w, 'height': hh}, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone, service_workers='block', color_scheme='dark' if phone else 'light')
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(tag + ': ' + str(e)))
            await pg.goto(BASE + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED)
            async def at(h, wait=900):
                await pg.goto(BASE + '#' + h); await pg.reload(); await pg.wait_for_timeout(wait)
                await pg.evaluate("document.querySelectorAll('.syncchip').forEach(e=>e.remove())")
            async def shot(n, full=False): await pg.screenshot(path=f'{OUT}/{tag}-{n}.png', full_page=full)
            # make the last way a B16 RCBO first, then select two ways and mark spare
            await pg.evaluate("""(async()=>{const db=await import('./js/db.js');const c=await db.get('certs','cert-eic');const cs=c.boards[0].circuits;const x=cs[cs.length-1];x.type='B';x.rating='16';x.device='rcbo';await db.put('certs',c);})()""")
            await at('/cert/cert-eic/b/0' if phone else '/cert/cert-eic/b/0')
            if await pg.locator('text=Select circuits to change together').count():
                await pg.click('text=Select circuits to change together'); await pg.wait_for_timeout(300)
                ticks = pg.locator('input.seltick'); n = await ticks.count(); info[tag+'-ways'] = n
                await ticks.nth(n-1).check(); await ticks.nth(n-2).check(); await pg.wait_for_timeout(200)
                await shot('01-select-ways-mark-spare')
                await pg.click('button:has-text("Mark spare")'); await pg.wait_for_timeout(500)
                await pg.evaluate('scrollTo(0, document.body.scrollHeight)'); await pg.wait_for_timeout(200)
                await shot('02-spare-ways-full-device')
                info[tag+'-spare-lines'] = await pg.evaluate("[...document.querySelectorAll('.ccard.spare .dv')].map(e=>e.textContent)")
            else:
                await pg.click('button:has-text("Mark ways spare")'); await pg.wait_for_timeout(300)
                bx = pg.locator('.sparepick input'); n = await bx.count(); await bx.nth(n-1).check(); await bx.nth(n-2).check()
                await shot('01-mark-ways-spare-dialog')
                await pg.click('.modal-bg button:has-text("Mark spare")'); await pg.wait_for_timeout(500)
                await shot('02-board-table-spares', True)
            # main RCD N/A
            await at('/cert/cert-eic/b/0')
            await pg.evaluate("document.querySelectorAll('details.card').forEach(d=>d.open=true)")
            inp = pg.locator('label.f:has-text("RCD BS (EN)") input').first
            await inp.fill(''); await inp.type('N/A'); await pg.wait_for_timeout(200)
            await inp.scroll_into_view_if_needed(); await pg.evaluate('scrollBy(0,-200)')
            info[tag+'-rcd'] = await pg.evaluate("[...document.querySelectorAll('label.f')].filter(l=>/RCD BS|RCD type|IΔn|Rating \\(A\\)/.test(l.textContent)).map(l=>l.textContent.trim()+'='+(l.querySelector('input')||{}).value)")
            await shot('03-main-rcd-na-fills')
            # circuit page with Copy to next way
            await at('/cert/cert-eic/b/0/c/0'); await shot('04-circuit-copy-to-next-way', True)
            await pg.click('button:has-text("Copy to next way")'); await pg.wait_for_timeout(700)
            info[tag+'-after-copy'] = await pg.evaluate('location.hash')
            await shot('05-next-way-filled')
            if not phone:
                await at('/cert/cert-eic/b/0/c/0'); f = pg.locator('main input').first; await f.focus()
                for _ in range(3): await pg.keyboard.press('Enter')
                info['mac-enter-moves'] = await pg.evaluate("(()=>{const a=document.activeElement;const l=a.closest('label');return a.tagName+' '+(l?l.textContent.trim().slice(0,30):'')})()")
            # cert PDF + chart choice
            await at('/cert/cert-eic')
            await pg.click('button:has-text("Circuit chart")'); await pg.wait_for_timeout(400); await shot('06-chart-view-share')
            await pg.keyboard.press('Escape')
            jid = await pg.evaluate("(async()=>{const db=await import('./js/db.js');return (await db.get('certs','cert-eic')).jobId})()")
            await at(f'/job/{jid}/parts')
            await pg.click('button:has-text("PDF")'); await pg.wait_for_timeout(1500); await shot('07-parts-pdf-view-share')
            await at('/settings'); await shot('08-settings-version')
            await ctx.close()
        await b.close()
    print(json.dumps(info, indent=1, ensure_ascii=False)); print('ERRORS', errs)
asyncio.run(main())
