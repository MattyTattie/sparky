# tests/screens_v28_1.py OUTDIR: v0.28.1 shots. Cooking box with CCU socket tick, phone + desktop, ticked/unticked. FAKE data only.
import asyncio, sys, os, json
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.28.1'
BASE = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:8765/index.html'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
MD = {'fuse': '100', 'loads': [{'k': 'cooking', 'qty': 1, 'value': 7.4, 'name': 'Hob'}, {'k': 'cooking', 'qty': 1, 'value': 3, 'name': 'Oven'},
  {'k': 'cooking', 'qty': 1, 'value': 1, 'name': 'Microwave'}, {'k': 'immersion', 'qty': 2, 'value': 3}, {'k': 'ring', 'qty': 2, 'value': 32}, {'k': 'lighting', 'qty': 2, 'value': 400}]}
OLD = {'fuse': '100', 'loads': [{'k': 'cookerSocket', 'qty': 1}] + MD['loads']}
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []; info = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for (w, hh) in [(1440, 900), (412, 915)]:
            phone = w < 900; tag = 'phone' if phone else 'desk'
            ctx = await b.new_context(viewport={'width': w, 'height': hh}, device_scale_factor=2.6 if phone else 1, is_mobile=phone, has_touch=phone, service_workers='block')
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(BASE + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED)
            await pg.evaluate(f"localStorage.setItem('sparky.md1', JSON.stringify({json.dumps(MD)}))"); await pg.goto(BASE + '#/calc/md'); await pg.reload(); await pg.wait_for_timeout(1000)
            await pg.evaluate("document.querySelectorAll('.syncchip').forEach(e=>e.remove())")
            box = pg.locator('.mdkind[data-kind="cooking"]'); cb = box.locator('.mdccu input')
            await box.scroll_into_view_if_needed(); await pg.evaluate('scrollBy(0,-90)'); await pg.wait_for_timeout(200)
            await pg.screenshot(path=f'{OUT}/v281-{tag}-cooking-unticked.png')
            await cb.evaluate('e=>e.scrollIntoView({block:"center"})'); await pg.wait_for_timeout(150)
            y0 = await pg.evaluate('scrollY'); t0 = await cb.evaluate('e=>e.getBoundingClientRect().top')
            await (cb.tap() if phone else cb.click()); await pg.wait_for_timeout(300)
            info[f'{tag}-tick'] = [y0, await pg.evaluate('scrollY'), round(t0,1), round(await cb.evaluate('e=>e.getBoundingClientRect().top'),1), await cb.is_checked(), await box.locator('.mdkwork').inner_text()]
            if phone:  # box top (working line) at the top, so the tick box is also on screen
                await pg.evaluate("(()=>{const b=document.querySelector('.mdkind[data-kind=cooking] .mdkwork');scrollBy(0,b.getBoundingClientRect().top-140)})()"); await pg.wait_for_timeout(200)
            await pg.screenshot(path=f'{OUT}/v281-{tag}-cooking-ticked.png')
            info[f'{tag}-chips'] = await pg.evaluate("[...document.querySelectorAll('.mdadd button')].map(b=>b.textContent).filter(t=>/socket/i.test(t))")
            await pg.evaluate(f"localStorage.setItem('sparky.md1', JSON.stringify({json.dumps(OLD)}))"); await pg.reload(); await pg.wait_for_timeout(900)
            info[f'{tag}-old'] = await pg.evaluate("[document.querySelectorAll('.mdkind').length, [...document.querySelectorAll('.mdkind')].map(e=>e.dataset.kind), document.querySelector('.mdccu input').checked]")
            await ctx.close()
        await b.close()
    print(json.dumps(info, indent=0)); print('errors:', errs)
asyncio.run(main())
