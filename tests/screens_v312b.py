# tests/screens_v312b.py: v0.31.2 SPD type N/A hides boxes; plus PDF SPD area. FAKE data only.
import asyncio, os, json, base64, subprocess
from playwright.async_api import async_playwright
OUT = '/workspace/sparky-shots/v0.31.2'; BASE = 'http://localhost:8765/index.html'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
async def main():
    errs = []; info = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for (w, hh) in [(1440, 900), (390, 844)]:
            phone = w < 900; tag = 'phone' if phone else 'mac'
            ctx = await b.new_context(viewport={'width': w, 'height': hh}, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone, service_workers='block', color_scheme='dark' if phone else 'light')
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(tag + ': ' + str(e)))
            await pg.goto(BASE + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED)
            await pg.goto(BASE + '#/cert/cert-eic/b/0'); await pg.reload(); await pg.wait_for_timeout(900)
            await pg.evaluate("document.querySelectorAll('.syncchip').forEach(e=>e.remove()); document.querySelectorAll('details.card').forEach(d=>d.open=true)")
            na = pg.locator('label.check:has-text("N/A"):not(:has-text("status")) input').first
            vis = "[...document.querySelectorAll('label')].filter(l=>/SPD protective|operational status|SPD status N\\/A|No SPD/.test(l.textContent)).map(l=>l.textContent.trim().slice(0,30)+':'+(l.offsetParent?'shown':'hidden')).concat([...document.querySelectorAll('.spdnone')].map(e=>'note:'+(e.offsetParent?'shown':'hidden')))"
            async def shot(n):
                await na.scroll_into_view_if_needed(); await pg.evaluate('scrollBy(0,-200)'); await pg.wait_for_timeout(200)
                await pg.screenshot(path=f'{OUT}/{tag}-after-{n}.png')
            await na.click(); await pg.wait_for_timeout(300); info[tag+'-ticked'] = await pg.evaluate(vis); await shot('4-type-na-hides-boxes')
            if not phone:
                await pg.wait_for_timeout(1500)
                data = await pg.evaluate("""async()=>{const {certificatePdf}=await import('./js/pdf.js');const db=await import('./js/db.js');const c=await db.get('certs','cert-eic');const bl=await certificatePdf(c,{});const u=new Uint8Array(await bl.arrayBuffer());let s='';for(const x of u)s+=String.fromCharCode(x);return btoa(s)}""")
                open('/tmp/spd.pdf','wb').write(base64.b64decode(data))
            await na.click(); await pg.wait_for_timeout(300); info[tag+'-unticked'] = await pg.evaluate(vis); await shot('5-type-na-unticked-shows-again')
            await ctx.close()
        await b.close()
    print(json.dumps(info, indent=1)); print('ERRORS', errs)
asyncio.run(main())
