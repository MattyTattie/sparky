# tests/screens_v29.py OUTDIR: v0.29.0 shots, phone + desktop. FAKE data only.
import asyncio, sys, os, json
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.29.0'
BASE = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:8765/index.html'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
UNLAB = """(()=>{const bad=[];document.querySelectorAll('main input:not([type=hidden]):not([type=checkbox]):not([type=radio]), main select, main textarea').forEach(e=>{const ok=e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||[...(e.labels||[])].some(l=>l.control===e&&l.textContent.trim());if(!ok)bad.push(e.outerHTML.slice(0,80))});return bad})()"""
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []; info = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for (w, hh) in [(1440, 900), (412, 915)]:
            phone = w < 900; tag = 'phone' if phone else 'desk'
            ctx = await b.new_context(viewport={'width': w, 'height': hh}, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone, service_workers='block')
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(tag + ': ' + str(e)))
            await pg.goto(BASE + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED)
            async def at(h, wait=900):
                await pg.goto(BASE + '#' + h); await pg.reload(); await pg.wait_for_timeout(wait)
                await pg.evaluate("document.querySelectorAll('.syncchip').forEach(e=>e.remove())")
            async def shot(name, full=False): await pg.screenshot(path=f'{OUT}/{tag}-{name}.png', full_page=full)
            async def scrollto(sel, off=90):
                await pg.locator(sel).first.scroll_into_view_if_needed(); await pg.evaluate(f'scrollBy(0,-{off})'); await pg.wait_for_timeout(200)
            # 4. jobs list with calibration warning
            await at('/'); await shot('01-jobs-cal-warning')
            # 1. Settings instruments, a date typed in
            await at('/settings')
            inp = pg.locator('.card input[type=text]').filter(has=pg.locator('xpath=self::*')).first
            mk = pg.locator('label.f:has(span:text-is("Model")) input').first
            await mk.scroll_into_view_if_needed(); await mk.fill('MFT1741+ cal 03/2027'); await pg.wait_for_timeout(300)
            info[tag + '-settings-focus'] = await pg.evaluate("document.activeElement && document.activeElement.value")
            await pg.locator('.calwarn:not([hidden])').first.evaluate('e=>e.scrollIntoView({block:"center"})'); await pg.wait_for_timeout(200); await shot('02-settings-cal-date-warning')
            # cert instruments section
            await at('/cert/cert-eic/s/instruments')
            ti = pg.locator('main input[type=text], main textarea').first
            if await ti.count():
                await ti.scroll_into_view_if_needed(); await ti.fill('Megger MFT1741 calibrated Jan 2026'); await pg.wait_for_timeout(300)
                info[tag + '-cert-calwarn'] = await pg.locator('.calwarn').first.is_visible()
            await shot('03-cert-instruments-cal-warning', full=True)
            # boards redirect
            await at('/cert/cert-eic/s/boards'); info[tag + '-boards-redirect'] = await pg.evaluate('location.hash'); await shot('04-boards-link-redirect')
            # EICR title / supply Next button / jobs wrap
            await at('/cert/cert-eicr'); await shot('05-eicr-title-wraps')
            await at('/cert/cert-eic/s/supply'); info[tag + '-supply-unlabelled'] = await pg.evaluate(UNLAB)
            await pg.evaluate('scrollTo(0, document.body.scrollHeight)'); await pg.wait_for_timeout(300); await shot('06-supply-next-wraps')
            # schedule (desktop full width) / board page with fault link
            await at('/cert/cert-eic/b/0', 1200); info[tag + '-board-unlabelled'] = await pg.evaluate(UNLAB); await shot('07-board-schedule', full=not phone)
            if not phone:
                info['desk-sched-width'] = await pg.evaluate("[document.querySelector('table.sched')?.getBoundingClientRect().width, document.querySelector('main').getBoundingClientRect().width]")
                info['desk-bs-cut'] = await pg.evaluate("[...document.querySelectorAll('td[data-k=bs] input, td[data-k=rcdBs] input')].filter(i=>i.scrollWidth>i.clientWidth+1).length")
            # circuit page: term-link tap areas outlined
            await at('/cert/cert-eic/b/0/c/0', 1100); info[tag + '-circuit-unlabelled'] = await pg.evaluate(UNLAB)
            info[tag + '-circuit-names'] = await pg.evaluate("[...document.querySelectorAll('main input[aria-label]')].slice(0,8).map(e=>e.getAttribute('aria-label'))")
            await pg.add_style_tag(content='.sym::after{outline:2px dashed #d00}')
            info[tag + '-sym-hit'] = await pg.evaluate("(()=>{const s=document.querySelector('.sym');if(!s)return null;const c=getComputedStyle(s,'::after');return [c.height,c.width]})()")
            await scrollto('.sym', 200); await shot('08-term-link-tap-area-outlined')
            # ref method list for SWA
            await pg.goto(BASE + '#/cert/cert-eic/b/0/c/0'); await pg.wait_for_timeout(300)
            sel = pg.locator('select[data-k=ref]').first
            info[tag + '-ref-options-before'] = await sel.evaluate("s=>[...s.options].map(o=>o.textContent)")
            await pg.locator('select[aria-label="Cable type"]').first.select_option('swa2'); await pg.wait_for_timeout(400)
            info[tag + '-ref-options-swa2'] = await pg.locator('select[data-k=ref]').first.evaluate("s=>[...s.options].map(o=>o.textContent)")
            await scrollto('select[data-k=ref]', 300); await shot('09-circuit-swa-ref-methods')
            # fault level: blank, filled, from board with Use button
            await pg.evaluate("localStorage.removeItem('sparky.fault1')")
            await at('/calc/fault'); info[tag + '-fault-unlabelled'] = await pg.evaluate(UNLAB); await shot('10-fault-blank', full=True)
            await pg.evaluate("localStorage.setItem('sparky.fault1', JSON.stringify({phase:'1',pfc:'16',ze:'0.35',cable:'swa',size:'16',length:'20',ka:'6'}))")
            await at('/calc/fault'); await shot('11-fault-filled', full=True)
            await at('/calc/fault/cert-eic/0'); await shot('12-fault-from-board', full=True)
            btn = pg.locator('button:has-text("as Ipf on")').first
            if await btn.count():
                await btn.click(); await pg.wait_for_timeout(1200); info[tag + '-after-use'] = [await pg.evaluate('location.hash'), await pg.evaluate("(document.querySelector('details.card summary')||{}).textContent")]
                await shot('13-board-after-use-on-cert')
            # cable calc with new methods
            await pg.evaluate("localStorage.setItem('sparky.size1', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('sparky.size1')||'{}'),{cable:'swaX',method:'D2'})))")
            await at('/calc/size'); await scrollto('[data-card=cable]', 80); await shot('14-size-calc-xlpe-swa-D2')
            info[tag + '-calc-unlabelled'] = await pg.evaluate(UNLAB)
            await ctx.close()
        await b.close()
    print(json.dumps(info, indent=0, ensure_ascii=False)); print('errors:', errs)
asyncio.run(main())
