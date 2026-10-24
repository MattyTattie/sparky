# tests/screens_pane.py OUTDIR BASE: cert open at desktop widths + logo/signature preview. FAKE data only.
import asyncio, sys, os, json
from playwright.async_api import async_playwright
OUT = sys.argv[1]; BASE = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:8765/index.html'
SIGOUT = sys.argv[3] if len(sys.argv) > 3 else None
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []; info = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for (w, hh) in [(1280, 800), (1440, 900)]:
            ctx = await b.new_context(viewport={'width': w, 'height': hh}, service_workers='block')
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(BASE + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED)
            async def at(h):
                await pg.goto(BASE + '#' + h); await pg.reload(); await pg.wait_for_timeout(900)
                await pg.evaluate("document.querySelectorAll('.syncchip').forEach(e=>e.remove())")
            for name, h in [('cert', '/cert/cert-eic'), ('supply', '/cert/cert-eic/s/supply')]:
                await at(h)
                info[f'{w}-{name}'] = await pg.evaluate("(()=>{const m=document.querySelector('main').getBoundingClientRect();const j=document.querySelector('.jobpane');return {mainW:Math.round(m.width),paneW:j?Math.round(j.getBoundingClientRect().width):0,fields:document.querySelectorAll('main input,main select,main textarea').length,textLen:document.querySelector('main').innerText.length}})()")
                await pg.screenshot(path=f'{OUT}/{w}x{hh}-{name}.png')
            await pg.pdf(path=f'{OUT}/{w}x{hh}-supply-print.pdf')
            if await pg.locator('.jobpane .panetoggle').count():
                await pg.click('.jobpane .panetoggle'); await pg.wait_for_timeout(400)
                await pg.screenshot(path=f'{OUT}/{w}x{hh}-supply-jobs-hidden.png')
                await at('/cert/cert-eic'); await pg.screenshot(path=f'{OUT}/{w}x{hh}-cert-jobs-hidden-after-reload.png')
                info[f'{w}-hidden'] = await pg.evaluate("({pane:!!document.querySelector('.jobpane'),mainW:Math.round(document.querySelector('main').getBoundingClientRect().width),show:!!document.querySelector('header .panetoggle')})")
                await pg.click('header .panetoggle'); await pg.wait_for_timeout(400); info[f'{w}-reshown'] = await pg.evaluate("!!document.querySelector('.jobpane')")
            if SIGOUT:
                os.makedirs(SIGOUT, exist_ok=True); await at('/settings')
                await pg.locator('text=Logo').first.scroll_into_view_if_needed(); await pg.wait_for_timeout(200)
                await pg.screenshot(path=f'{SIGOUT}/{w}x{hh}-settings-logo-signature.png', full_page=True)
                info[f'{w}-imgs'] = await pg.evaluate("[...document.querySelectorAll('img.logoprev,img.sigimg')].map(i=>[i.className,i.naturalWidth,Math.round(i.getBoundingClientRect().width)])")
            await ctx.close()
        await b.close()
    print(json.dumps(info)); print('ERRORS', errs)
asyncio.run(main())
