# tests/screens_v12.py - v0.12 shots: Section complete (normal + H), Still to fill in, comments grown,
# table row bin + confirm, after delete, toast above the bar. FAKE data only.
import asyncio, sys, os, json
from playwright.async_api import async_playwright
src = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.12'
URL = 'http://localhost:8765/index.html'
LONG = ('Existing installation is in fair condition for its age. ' * 3) + '\n\nCooker circuit cable runs in the loft are clipped but some clips are missing near the hatch. Recommend a full EICR within 5 years. Bathroom extract fan not on a dedicated isolator. Outside lights on a separate RCBO.\n\nCustomer advised about the old gas bond clamp under the stairs.'
async def main():
    os.makedirs(OUT, exist_ok=True); errors = []; shots = []; info = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block')
        page = await ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e))); page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        await page.goto(URL + '#/'); await page.wait_for_timeout(800); await page.evaluate(SEED)
        await page.evaluate("""async () => { const db = await import('/js/db.js'); const c = await db.get('certs', 'cert-eic');
          Object.keys(c.inspections || {}).forEach((k) => (c.inspections[k] = c.inspections[k] || 'ok')); c.comments = ''; await db.put('certs', c); }""")
        await page.reload(); await page.wait_for_timeout(900)
        async def go(hh, wait=900): await page.evaluate(f"location.hash = '{hh}'"); await page.wait_for_timeout(wait)
        async def snap(name): await page.screenshot(path=os.path.join(OUT, name)); shots.append(name)
        async def line(): return await page.evaluate("document.querySelector('.secstate')?.textContent")
        await go('#/cert/cert-eic/s/client'); info['client'] = await line(); await snap('v12-01-section-complete-normal.png')
        await go('#/cert/cert-eic/s/inspections'); info['H'] = await line(); await snap('v12-02-section-complete-H.png')
        await go('#/cert/cert-eic/s/supply'); ins = page.locator('.card input:not([type=checkbox])')
        for i in range(2): await ins.nth(i).fill(''); await ins.nth(i).dispatch_event('input')
        await page.wait_for_timeout(400); info['supply'] = await line(); await page.evaluate('scrollTo(0,0)'); await snap('v12-03-still-to-fill-in.png')
        await page.evaluate("""async () => { const st = await import('/js/state.js'); await st.flush(); }""")
        await go('#/cert/cert-eic/s/comments'); info['comments_empty'] = await line()
        await page.locator('textarea').first.click(); await page.keyboard.type(LONG[:120]); await page.locator('textarea').first.fill(LONG); await page.locator('textarea').first.dispatch_event('input'); await page.wait_for_timeout(500)
        info['comments_full'] = await line()
        info['textarea'] = await page.evaluate("(() => { const t = document.querySelector('textarea'); return { client: t.clientHeight, scroll: t.scrollHeight }; })()")
        await snap('v12-04-comments-grown.png')
        await go('#/cert/cert-eic/b/0'); info['boards'] = await line(); await snap('v12-05-boards-status.png')
        await page.reload(); await page.wait_for_timeout(600)
        await page.set_viewport_size({'width': 915, 'height': 412}); await page.wait_for_timeout(1200)
        await page.evaluate("document.querySelector('td.act')?.scrollIntoView({ block: 'center', inline: 'end' })"); await page.wait_for_timeout(300)
        info['before'] = await page.evaluate("[...document.querySelectorAll('tbody tr')].map((r) => r.innerText.split('\\t').slice(0, 2).join(' '))")
        await snap('v12-06-table-row-bin.png')
        await page.locator('td.act button.del').nth(2).click(); await page.wait_for_timeout(500); await snap('v12-07-delete-confirm.png')
        info['confirm'] = await page.evaluate("document.querySelector('.modal')?.innerText")
        await page.click('.modal button:has-text("Delete")'); await page.wait_for_timeout(900)
        await page.evaluate("document.querySelector('td.act')?.scrollIntoView({ block: 'center', inline: 'end' })"); await page.wait_for_timeout(200)
        await snap('v12-08-after-delete.png')
        info['after'] = await page.evaluate("async () => { await (await import('/js/state.js')).flush(); return (await (await import('/js/db.js')).get('certs', 'cert-eic')).boards[0].circuits.map((c) => c.num + ' ' + c.desc); }")
        await page.set_viewport_size({'width': 412, 'height': 915}); await page.wait_for_timeout(800)
        await go('#/cert/cert-eic/b/0/c/0'); await page.evaluate("import('/js/ui.js').then((u) => u.toast('Saved B32 RCBO \\u00b7 30 mA Type A \\u00b7 6 kA as a device preset', 8000))"); await page.wait_for_timeout(400)
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)"); await page.wait_for_timeout(300); await snap('v12-09-toast-above-bar.png')
        await b.close()
    print(json.dumps({'errors': errors, 'shots': shots, **info}, indent=1))
asyncio.run(main())
