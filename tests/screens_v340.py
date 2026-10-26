# tests/screens_v340.py: v0.34.0 calc fixes, Ci greyed, BS 3036 ring, bidirectional remarks, copy board to another job, Section I, Esc. FAKE data only; no calibration dates.
import asyncio, os, json
from playwright.async_api import async_playwright
OUT = '/workspace/sparky-shots/v0.34.0'; BASE = 'http://localhost:8765/index.html'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
PREP = r"""(async()=>{const db=await import('./js/db.js');
 const ins=(await db.getMeta('instruments'))||[]; ins.forEach(i=>{i.calDue='';}); await db.setMeta('instruments',ins);
 const e=await db.get('certs','cert-eic'); e.boards[0].fedBySource=true; e.install.extentType='New installation'; e.comments='';
 e.boards[0].circuits.forEach(c=>{ c.remarks=(c.remarks||'').replace(/;?\s*Devices[^;]*530\.3\.201[^;]*/,''); });
 await db.put('certs',e); return 1; })"""
CALCS = [  # (name, route, storage key, values)
 ('calc-a-16A-m100-10grouped', '#/calc/size', 'sparky.size1', {'load': '16', 'unit': 'A', 'length': '10', 'method': '100', 'grouped': '10', 'device': 'rcbo', 'type': 'B'}),
 ('calc-b-20A-m102-10m', '#/calc/size', 'sparky.size1', {'load': '20', 'unit': 'A', 'length': '10', 'method': '102', 'grouped': '1', 'ci': '0.5', 'device': 'rcbo', 'type': 'B'}),
 ('calc-c-30A-bs3036-ring', '#/calc/size', 'sparky.size1', {'load': '20', 'unit': 'A', 'loadType': 'ring', 'length': '40', 'method': 'C', 'grouped': '1', 'ci': '1', 'device': 'bs3036', 'type': 'auto'}),
 ('check-ci-greyed-m102', '#/calc/check', 'sparky.calc2', {'rating': '20', 'ib': '20', 'length': '10', 'method': '102', 'ci': '0.5', 'size': 'auto'}),
 ('check-30A-bs3036-ring', '#/calc/check', 'sparky.calc2', {'device': 'bs3036', 'rating': '30', 'ib': '20', 'shape': 'ring-spread', 'length': '30', 'method': 'C', 'size': '2.5'}),
]
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []; info = {}
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for (w, hh) in [(1440, 900), (412, 915)]:
            phone = w < 900; tag = 'phone' if phone else 'mac'
            ctx = await br.new_context(viewport={'width': w, 'height': hh}, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone, service_workers='block')
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(tag + ': ' + str(e)))
            await pg.goto(BASE + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED); await pg.wait_for_timeout(300)
            await pg.evaluate(PREP)
            clean = "document.querySelectorAll('.syncchip').forEach(e=>e.remove())"
            for (name, route, key, vals) in CALCS:
                await pg.evaluate(f"localStorage.setItem('{key}', JSON.stringify({json.dumps(vals)}))")
                await pg.goto(BASE + route); await pg.reload(); await pg.wait_for_timeout(1000); await pg.evaluate(clean)
                info[f'{tag}-{name}'] = await pg.evaluate("(()=>{const r=document.querySelector('.res, .result, .answer'); return (r?r.innerText:document.body.innerText).slice(0,160).replace(/\\s+/g,' ');})()")
                await pg.screenshot(path=f'{OUT}/{tag}-{name}.png', full_page=True)
                await pg.evaluate("[...document.querySelectorAll('details, .more, summary')].forEach(d=>{ if(d.tagName==='DETAILS') d.open=true; })")
                mo = pg.locator('text=/Using: .*method/')
                if await mo.count() and not await pg.locator('[data-cinote]').count(): await mo.first.click(); await pg.wait_for_timeout(300)
                n = pg.locator('[data-cinote]')
                if await n.count():
                    await n.first.scroll_into_view_if_needed(); await pg.wait_for_timeout(200)
                    await pg.screenshot(path=f'{OUT}/{tag}-{name}-cinote.png')
            # bidirectional: note -> circuit remarks
            await pg.goto(BASE + '#/cert/cert-eic/b/0'); await pg.reload(); await pg.wait_for_timeout(1200); await pg.evaluate(clean)
            await pg.evaluate("document.querySelectorAll('details.card').forEach(d=>d.open=true)")
            bb = pg.get_by_role('button', name='Add note')
            if await bb.count():
                await bb.first.scroll_into_view_if_needed(); await pg.screenshot(path=f'{OUT}/{tag}-bidi-1-before.png')
                await bb.first.click(); await pg.wait_for_timeout(700); await pg.evaluate("document.querySelectorAll('details.card').forEach(d=>d.open=true)"); await pg.evaluate(clean)
                await pg.screenshot(path=f'{OUT}/{tag}-bidi-2-after.png')
                info[tag + '-bidi-remarks'] = await pg.evaluate("(async()=>{const db=await import('./js/db.js'); const e=await db.get('certs','cert-eic'); return [e.comments, e.boards[0].circuits.map(c=>c.remarks).filter(r=>/530/.test(r||'')).length];})()")
            # copy to another job
            cb = pg.get_by_role('button', name='Copy to another job')
            await cb.scroll_into_view_if_needed(); await cb.click(); await pg.wait_for_timeout(600)
            await pg.screenshot(path=f'{OUT}/{tag}-copyjob-1-dialog.png')
            await pg.keyboard.press('Escape') if not phone else None
            await pg.wait_for_timeout(400)
            if not phone:
                info['mac-esc-closed-dialog'] = await pg.evaluate("!document.querySelector('.modal-bg')")
                await pg.screenshot(path=f'{OUT}/{tag}-esc-closed.png')
                await cb.click(); await pg.wait_for_timeout(600)
            ok = pg.locator('.modal-bg button.primary').first
            await ok.click(); await pg.wait_for_timeout(900); await pg.evaluate(clean)
            await pg.screenshot(path=f'{OUT}/{tag}-copyjob-2-done.png')
            mb = pg.locator('.modal-bg button').last
            if await mb.count(): await mb.click(); await pg.wait_for_timeout(300)
            info[tag + '-eicr-boards'] = await pg.evaluate("(async()=>{const db=await import('./js/db.js'); const e=await db.get('certs','cert-eicr'); return e.boards.map(b=>b.ref+':'+b.circuits.length);})()")
            # Section I on a new installation
            await pg.goto(BASE + '#/cert/cert-eic/s/comments'); await pg.reload(); await pg.wait_for_timeout(1000); await pg.evaluate(clean)
            await pg.screenshot(path=f'{OUT}/{tag}-sectionI-1-newinstall.png', full_page=True)
            ta = pg.locator('textarea').first
            await ta.fill('New consumer unit and circuits; outbuilding supply added.'); await pg.wait_for_timeout(500)
            await ta.blur(); await pg.wait_for_timeout(500)
            await pg.screenshot(path=f'{OUT}/{tag}-sectionI-2-move-button.png', full_page=True)
            mv = pg.get_by_role('button', name='Move')
            if await mv.count(): await mv.first.click(); await pg.wait_for_timeout(600); await pg.screenshot(path=f'{OUT}/{tag}-sectionI-3-moved.png', full_page=True)
            await pg.goto(BASE + '#/cert/cert-eic/s/client'); await pg.reload(); await pg.wait_for_timeout(1000); await pg.evaluate(clean)
            await pg.screenshot(path=f'{OUT}/{tag}-pg1-description.png', full_page=True)
            await ctx.close()
        await br.close()
    print(json.dumps(info, indent=1)); print('ERRORS', errs)
asyncio.run(main())
