# tests/screens_v352.py: v0.35.2 — MCB lines show the board's RCD (DB with a 300 mA S-type RCCB). FAKE data only; no calibration dates.
import asyncio, os, sys, json, base64, subprocess
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.35.2'
BASE = 'http://localhost:8765/index.html'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
PREP = r"""(async()=>{const db=await import('./js/db.js');
 const ins=(await db.getMeta('instruments'))||[]; ins.forEach(i=>{i.calDue='';}); await db.setMeta('instruments',ins);
 const walk=(o)=>{ if(Array.isArray(o)) return o.map(walk); if(o&&typeof o==='object'){ for(const k of Object.keys(o)){ if(/cal/i.test(k)&&!/local/i.test(k)) o[k]=''; else o[k]=walk(o[k]); } return o; } if(typeof o==='string') return o.replace(/\s*\(cal[^)]*\)/gi,''); return o; };
 const e=await db.get('certs','cert-eicr'); walk(e); const b=e.boards[0];
 Object.assign(b,{ref:'DB2',rcdBs:'61008',rcdType:'S',rcdIdn:'300',rcdRating:'100'});
 const R=['rcdBs','rcdType','rcdIdn','rcdRating'];
 b.circuits.forEach((c,i)=>{ delete c.autoF; if(i===2){Object.assign(c,{device:'rcbo',bs:'61009',type:'B',rating:'32',bka:'6',rcdBs:'61009',rcdType:'A',rcdIdn:'30',rcdRating:'32'});} else { R.forEach(k=>c[k]=''); if(i<2) Object.assign(c,{device:'mcb',bs:'60898',type:'B'}); } });
 await db.put('certs',e); return b.circuits.map(c=>c.desc+':'+c.device); })"""
PDF = "(async(id)=>{const db=await import('./js/db.js');const p=await import('./js/pdf.js');const c=await db.get('certs',id);const b=await p.certificatePdf(c,{});const a=new Uint8Array(await b.arrayBuffer());let s='';for(const x of a)s+=String.fromCharCode(x);return btoa(s)})"
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []; info = {}
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for (w, hh, scheme) in [(412, 915, 'dark'), (412, 915, 'light'), (1440, 900, 'light')]:
            phone = w < 900; tag = ('phone' if phone else 'mac') + '-' + scheme
            ctx = await br.new_context(viewport={'width': w, 'height': hh}, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone, service_workers='block', color_scheme=scheme)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(tag + ': ' + str(e)))
            await pg.goto(BASE + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED); await pg.wait_for_timeout(300)
            info['seed'] = await pg.evaluate(PREP)
            await pg.goto(BASE + '#/cert/cert-eicr/b/0'); await pg.reload(); await pg.wait_for_timeout(1200)
            await pg.evaluate("document.querySelectorAll('.syncchip').forEach(e=>e.remove())")
            await pg.evaluate("(()=>{document.querySelector('details.card').open=true; const e=[...document.querySelectorAll('.note')].find(x=>x.textContent.startsWith('Main RCD of the board')); e.scrollIntoView({block:'center'});})()"); await pg.wait_for_timeout(250)
            await pg.screenshot(path=f'{OUT}/{tag}-1-board-rcd-300mA-S.png')
            if phone:
                await pg.evaluate("(()=>{const e=document.querySelector('.ccard'); e.scrollIntoView({block:'start'}); scrollBy(0,-70);})()"); await pg.wait_for_timeout(250)
                await pg.screenshot(path=f'{OUT}/{tag}-2-circuit-list.png')
                for ci, nm in [(0, 'mcb-line'), (2, 'rcbo-line')]:
                    await pg.goto(BASE + f'#/cert/cert-eicr/b/0/c/{ci}'); await pg.wait_for_timeout(900)
                    await pg.evaluate("document.querySelectorAll('.syncchip').forEach(e=>e.remove())")
                    await pg.evaluate("(()=>{const e=document.querySelector('.rcdgrp'); e.scrollIntoView({block:'start'}); scrollBy(0,-160);})()"); await pg.wait_for_timeout(250)
                    await pg.wait_for_timeout(3000); await pg.evaluate("document.querySelectorAll('.toast').forEach(e=>e.remove())"); await pg.screenshot(path=f'{OUT}/{tag}-3-{nm}-rcd-boxes.png')
            else:
                t = pg.locator('table').first; await t.scroll_into_view_if_needed(); await pg.wait_for_timeout(250)
                await pg.screenshot(path=f'{OUT}/{tag}-2-schedule-table.png')
            info[tag] = await pg.evaluate("(async()=>{const db=await import('./js/db.js');return (await db.get('certs','cert-eicr')).boards[0].circuits.map(c=>[c.num,c.device,c.rcdBs,c.rcdType,c.rcdIdn,c.rcdRating].join('|'))})()")
            if not phone:
                data = await pg.evaluate(PDF + "('cert-eicr')"); f = f'{OUT}/pdf-eicr.pdf'; open(f, 'wb').write(base64.b64decode(data))
                subprocess.run(['pdftoppm', '-r', '110', '-f', '5', '-l', '6', '-png', f, f'{OUT}/pdf-eicr'])
            await ctx.close()
        await br.close()
    print(json.dumps(info, indent=1)); print('ERRORS', errs)
asyncio.run(main())
