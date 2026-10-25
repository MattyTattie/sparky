# tests/screens_v331.py: v0.33.1 OCPD auto-fill + test-results description column. FAKE data only; no calibration dates.
# usage: python3 tests/screens_v331.py before|after   (before = main served on :8766, after = this branch on :8765)
import asyncio, os, sys, json, base64, subprocess
from playwright.async_api import async_playwright
WHEN = sys.argv[1]; OUT = '/workspace/sparky-shots/v0.33.1'
BASE = ('http://localhost:8766' if WHEN == 'before' else 'http://localhost:8765') + '/index.html'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
LONG = 'Long remark test: kitchen ring feeds the fridge-freezer, dishwasher and washing machine; electronic equipment unplugged before insulation resistance testing, L-E tested at 250 V on the boiler spur with the controls disconnected; customer to arrange access to the loft junction box for the next visit; see observations 5.12 and 5.17 for the cables in the kitchen wall and the loft.'
PREP = r"""(async(LONG)=>{const db=await import('./js/db.js');
 const ins=(await db.getMeta('instruments'))||[]; ins.forEach(i=>{i.calDue='';}); await db.setMeta('instruments',ins);
 const walk=(o)=>{ if(Array.isArray(o)) return o.map(walk); if(o&&typeof o==='object'){ for(const k of Object.keys(o)){ if(/cal/i.test(k)&&!/local/i.test(k)) o[k]=''; else o[k]=walk(o[k]); } return o; } if(typeof o==='string') return o.replace(/\s*\(cal[^)]*\)/gi,'').replace(/cal(ibration)?\.?\s*(due)?:?\s*\d{4}-\d\d-\d\d/gi,''); return o; };
 const e=await db.get('certs','cert-eicr'); walk(e); const b=e.boards[0];
 b.circuits[0].remarks='Over 80% of max Zs, re-test hot'; b.circuits[1].remarks=LONG;
 const t=await import('./js/templates.js'); const n=t.blankCircuit(b.circuits.length+1); n.device=''; n.desc='Garage sockets (new way)'; b.circuits.push(n);
 await db.put('certs',e);
 const c2=await db.get('certs','cert-eic'); if(c2){ walk(c2); const b2=c2.boards[0]; if(b2.circuits[0]) b2.circuits[0].remarks='Over 80% of max Zs, re-test hot'; if(b2.circuits[1]) b2.circuits[1].remarks=LONG; await db.put('certs',c2); }
 return b.circuits.length-1; })"""
PDF = "(async(id)=>{const db=await import('./js/db.js');const p=await import('./js/pdf.js');const c=await db.get('certs',id);const b=await p.certificatePdf(c,{});const a=new Uint8Array(await b.arrayBuffer());let s='';for(const x of a)s+=String.fromCharCode(x);return btoa(s)})"
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []; info = {}
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for (w, hh) in [(1440, 900), (390, 844)]:
            phone = w < 900; tag = ('phone' if phone else 'mac') + '-' + WHEN
            ctx = await br.new_context(viewport={'width': w, 'height': hh}, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone, service_workers='block', color_scheme='dark' if phone else 'light')
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(tag + ': ' + str(e)))
            await pg.goto(BASE + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED); await pg.wait_for_timeout(300)
            ci = await pg.evaluate(PREP + '(' + json.dumps(LONG) + ')')
            await pg.goto(BASE + f'#/cert/cert-eicr/b/0/c/{ci}'); await pg.reload(); await pg.wait_for_timeout(1000)
            await pg.evaluate("document.querySelectorAll('.syncchip').forEach(e=>e.remove())")
            sel = pg.locator('label.f:has-text("Protective device") select').first
            await sel.select_option('rcbo'); await pg.wait_for_timeout(300)
            await pg.locator('.chips .chip', has_text='C').first.click() if False else None
            await pg.locator('button.chip:text-is("32")').first.click(); await pg.wait_for_timeout(400)
            async def shot(n, text):
                await pg.evaluate(f"(()=>{{const e=[...document.querySelectorAll('*')].find(x=>x.children.length<3&&x.textContent.trim().startsWith({json.dumps(text)})&&x.offsetParent); if(e) e.scrollIntoView({{block:'start'}}); scrollBy(0,-90)}})()")
                await pg.wait_for_timeout(250); await pg.screenshot(path=f'{OUT}/{tag}-{n}.png')
            await shot('1-device-rcbo-B32', 'Protective device'); await shot('2-ocpd-boxes', 'OCPD BS (EN)'); await shot('3-rcd-boxes', 'RCD (if any)')
            info[tag] = await pg.evaluate(f"(async()=>{{const db=await import('./js/db.js');const c=(await db.get('certs','cert-eicr')).boards[0].circuits[{ci}];return ['device','bs','type','rating','bka','rcdBs','rcdType','rcdIdn','rcdRating'].map(k=>k+'='+(c[k]??''))}})()")
            if not phone:
                data = await pg.evaluate(PDF + "('cert-eicr')"); f = f'{OUT}/pdf-eicr-{WHEN}.pdf'; open(f, 'wb').write(base64.b64decode(data))
                subprocess.run(['pdftoppm', '-r', '80', '-png', f, f'{OUT}/pdf-eicr-{WHEN}'])
                data = await pg.evaluate(PDF + "('cert-eic')"); f = f'{OUT}/pdf-eic-{WHEN}.pdf'; open(f, 'wb').write(base64.b64decode(data))
                subprocess.run(['pdftoppm', '-r', '80', '-png', f, f'{OUT}/pdf-eic-{WHEN}'])
            await ctx.close()
        await br.close()
    print(json.dumps(info, indent=1)); print('ERRORS', errs)
asyncio.run(main())
