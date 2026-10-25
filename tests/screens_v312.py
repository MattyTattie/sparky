# tests/screens_v312.py OUTDIR PREFIX [na]: v0.31.2 SPD N/A shots, phone (dark) + Mac 1440. FAKE data only.
import asyncio, sys, os, json
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.31.2'
PRE = sys.argv[2] if len(sys.argv) > 2 else 'after'
BASE = 'http://localhost:8765/index.html'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
MEASURE = "[...document.querySelectorAll('.grid3 label.f')].slice(0,3).map(l=>{const i=l.querySelector('input');const r=i.getBoundingClientRect();return 'OCPD '+l.firstChild.textContent+' top'+Math.round(r.top)+' h'+Math.round(r.height)}).concat([...document.querySelectorAll('label.check')].filter(l=>/SPD|T1|T2|T3|N\\/A|polarity|Phase/i.test(l.textContent)).map(l=>{const i=l.querySelector('input');const r=i.getBoundingClientRect();return l.textContent.trim()+' '+Math.round(r.width)+'x'+Math.round(r.height)+' '+(i.checked?'[x]':'[ ]')}))"
VALS = "({dev:(document.querySelector('label.f:has(input) input[value]')||{}).value, spdDevice:[...document.querySelectorAll('label.f')].filter(l=>/SPD protective/.test(l.textContent)).map(l=>l.querySelector('input').value)[0]})"
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []; info = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for (w, hh) in [(1440, 900), (390, 844)]:
            phone = w < 900; tag = 'phone' if phone else 'mac'
            ctx = await b.new_context(viewport={'width': w, 'height': hh}, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone, service_workers='block', color_scheme='dark' if phone else 'light')
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(tag + ': ' + str(e)))
            await pg.goto(BASE + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED)
            await pg.goto(BASE + '#/cert/cert-eic/b/0'); await pg.reload(); await pg.wait_for_timeout(900)
            await pg.evaluate("document.querySelectorAll('.syncchip').forEach(e=>e.remove()); document.querySelectorAll('details.card').forEach(d=>d.open=true)")
            # clear SPD boxes so we start blank
            await pg.evaluate("[...document.querySelectorAll('label.check input')].forEach(i=>{if(i.checked&&/T1|T2|T3|N\\/A|SPD/.test(i.parentNode.textContent)){i.click()}})")
            dev = pg.locator('label.f:has-text("SPD protective") input').first
            await dev.fill(''); await dev.dispatch_event('input'); await dev.dispatch_event('change')
            async def shot(n):
                await dev.scroll_into_view_if_needed(); await pg.evaluate('scrollBy(0,-260)'); await pg.wait_for_timeout(200)
                await pg.screenshot(path=f'{OUT}/{tag}-{n}.png')
            info[tag+'-blank'] = await pg.evaluate(MEASURE)
            await shot(f'{PRE}-1-spd-blank')
            await pg.locator('label.check:has-text("SPD status N/A") input').click(); await pg.wait_for_timeout(300)
            info[tag+'-na'] = await pg.evaluate(MEASURE); info[tag+'-na-dev'] = await dev.input_value()
            await shot(f'{PRE}-2-spd-status-na-ticked')
            if PRE == 'after':
                await pg.locator('label.check:has-text("T2") input').click(); await pg.wait_for_timeout(300)
                info[tag+'-t2'] = await pg.evaluate(MEASURE); info[tag+'-t2-dev'] = await dev.input_value()
                await shot(f'{PRE}-3-real-value-clears')
            await ctx.close()
        await b.close()
    print(json.dumps(info, indent=1)); print('ERRORS', errs)
asyncio.run(main())
