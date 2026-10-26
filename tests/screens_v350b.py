# tests/screens_v350b.py: v0.35.0 QA shots: switches on/off (light/dark, phone/mac), seeded presets, Section I hint. FAKE data only.
import asyncio, os, json, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/index.html'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/workspace/sparky-shots/v0.35.0'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
PRESETS = [
 {'id':'pa','name':'','fields':{'device':'mcb','bs':'60898','type':'B','rating':'50','bka':'6','rcdBs':'61008','rcdType':'A','rcdIdn':'300','rcdS':True},'usedAt':'2026-10-20T10:00:00Z'},
 {'id':'pb','name':'','fields':{'device':'rcbo','bs':'61009','type':'B','rating':'32','bka':'6','rcdType':'A','rcdIdn':'30'},'usedAt':'2026-10-19T10:00:00Z'},
 {'id':'pc','name':'','fields':{'device':'mcb','bs':'60898','type':'B','rating':'45','bka':'6'},'usedAt':'2026-10-18T10:00:00Z'},
 {'id':'pd','name':'','fields':{'device':'rcbo','bs':'61009','type':'C','rating':'16','bka':'10','rcdType':'A-S','rcdIdn':'100','rcdS':True},'usedAt':'2026-10-17T10:00:00Z'},
]
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for (w, hh) in [(1440, 900), (412, 915)]:
            phone = w < 900; tag = 'phone' if phone else 'mac'
            ctx = await br.new_context(viewport={'width': w, 'height': hh}, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone, service_workers='block')
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(tag + ': ' + str(e)))
            await pg.goto(BASE + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED); await pg.wait_for_timeout(300)
            await pg.evaluate("(async(L)=>{const P=await import('./js/presets.js'); L.forEach(x=>x.name=P.nameFor(P.clean(x.fields))); await P.save(L); const e=await (await import('./js/db.js')).get('certs','cert-eic'); e.install.extentType='New installation'; e.comments=''; await (await import('./js/db.js')).put('certs',e);})(" + json.dumps(PRESETS) + ")")
            for theme in ['light', 'dark']:
                await pg.evaluate(f"localStorage.setItem('sparky.theme','{theme}')")
                for state, vals in [('on', {}), ('off', {'solarW': '', 'panels': '', 'dcdcA': '', 'shoreA': ''})]:
                    if state == 'on': vals = {'shoreA': '20'}
                    await pg.evaluate(f"(async()=>{{const D=await import('./js/dcplan.js'); localStorage.setItem('sparky.dcplan1', JSON.stringify({{...D.VAN_EXAMPLE, ...{json.dumps(vals)}}})); localStorage.setItem('sparky.dcstep','charging');}})()")
                    await pg.goto(BASE + '#/calc/dc/plan/charging'); await pg.reload(); await pg.wait_for_timeout(900)
                    n = await pg.evaluate("[...document.querySelectorAll('.switch')].map(s=>{const a=getComputedStyle(s,'::after');return (s.querySelectorAll('span').length)+(a.content!=='none'&&a.display!=='none'?1:0)}).join(',')")
                    if any(x != '1' for x in n.split(',')): errs.append(f'{tag} {theme} {state} knobs {n}')
                    await pg.screenshot(path=f'{OUT}/{tag}-16-switches-{state}-{theme}.png')
                await pg.goto(BASE + '#/settings'); await pg.reload(); await pg.wait_for_timeout(900)
                n = await pg.evaluate("[...document.querySelectorAll('.switch')].map(s=>{const a=getComputedStyle(s,'::after');return (s.querySelectorAll('span').length)+(a.content!=='none'&&a.display!=='none'?1:0)}).join(',')")
                if n and any(x != '1' for x in n.split(',')): errs.append(f'{tag} {theme} settings knobs {n}')
                l = pg.locator('.switchrow').first
                if await l.count(): await l.scroll_into_view_if_needed(); await l.screenshot(path=f'{OUT}/{tag}-16-sync-switch-{theme}.png')
            await pg.evaluate("localStorage.setItem('sparky.theme','light')")
            await pg.goto(BASE + '#/settings/presets'); await pg.reload(); await pg.wait_for_timeout(1000); await pg.screenshot(path=f'{OUT}/{tag}-02-preset-labels.png', full_page=True)
            await pg.goto(BASE + '#/cert/cert-eic/s/comments'); await pg.reload(); await pg.wait_for_timeout(1200)
            await pg.screenshot(path=f'{OUT}/{tag}-01-section-i-hint.png')
            t = await pg.evaluate("document.body.innerText")
            if 'Section B, Description and extent' not in t: errs.append(tag + ' section I hint missing')
        await br.close()
    print('errors:', errs)
asyncio.run(main())
