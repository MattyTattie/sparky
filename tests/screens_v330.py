# tests/screens_v330.py: v0.33.0 A4 changes + full PDFs. FAKE data only; calibration dates scrubbed before any PDF.
import asyncio, os, json, base64, subprocess
from playwright.async_api import async_playwright
OUT = '/workspace/sparky-shots/v0.33.0'; BASE = 'http://localhost:8765/index.html'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
SCRUB = r"""(async()=>{const db=await import('./js/db.js');
 const ins=(await db.getMeta('instruments'))||[]; ins.forEach(i=>{i.calDue='';}); await db.setMeta('instruments',ins);
 const walk=(o)=>{ if(Array.isArray(o)) return o.map(walk); if(o&&typeof o==='object'){ for(const k of Object.keys(o)){ if(/cal/i.test(k)&&!/local/i.test(k)) o[k]=''; else o[k]=walk(o[k]); } return o; } if(typeof o==='string') return o.replace(/\s*\(cal[^)]*\)/gi,'').replace(/cal(ibration)?\.?\s*(due)?:?\s*\d{4}-\d\d-\d\d/gi,''); return o; };
 for(const id of ['cert-eic','cert-eicr','cert-mw']){ const c=await db.get('certs',id); if(c){ walk(c); await db.put('certs',c);} }
 const e=await db.get('certs','cert-eicr'); if(e){ const I=e.inspections; for(const k of Object.keys(I)) if(/^(C1|C2|C3|FI)$/.test(I[k])) I[k]='\u2713'; I['5.12']='C2'; I['4.10']='C3'; I['5.17']='FI'; e.eicr.intakeNotified='N/A';
 e.observations=[{id:'o1',item:'5.12',code:'C2',text:'Cables concealed in walls less than 50 mm deep, not in a safe zone or mechanically protected, no RCD',reg:'522.6.202; 411.3.3',location:'Kitchen'},{id:'o2',item:'4.10',code:'C3',text:'No RCD six-monthly test notice at consumer unit',reg:'514.12.2',location:'CU'},{id:'o3',item:'5.17',code:'FI',text:'Termination of cables at loft junction box not verified, no access',reg:'526',location:'Loft'}]; const b=e.boards[0]; b.fedBySource=true; b.maxDemand='60'; await db.put('certs',e);}
 const c=await db.get('certs','cert-eic'); c.parts.msIsRcd=true; c.parts.rcdType='A'; c.parts.rcdIdn='100'; c.parts.rcdDelay='0'; c.parts.rcdMs='45'; c.parts.rcdKa='6'; c.parts.mdUnit='A'; await db.put('certs',c);
 return Object.keys(e.inspections).filter(k=>k.startsWith('1.1')); })()"""
PDF = "(async(id)=>{const db=await import('./js/db.js');const p=await import('./js/pdf.js');const c=await db.get('certs',id);const b=await p.certificatePdf(c,{});const a=new Uint8Array(await b.arrayBuffer());let s='';for(const x of a)s+=String.fromCharCode(x);return btoa(s)})"
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []; info = {}
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for (w, hh) in [(1440, 900), (390, 844)]:
            phone = w < 900; tag = 'phone' if phone else 'mac'
            ctx = await br.new_context(viewport={'width': w, 'height': hh}, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone, service_workers='block', color_scheme='dark' if phone else 'light')
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(tag + ': ' + str(e)))
            await pg.goto(BASE + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED); await pg.wait_for_timeout(300); info[tag+'-intake-keys-before']=await pg.evaluate(SCRUB)
            info[tag+'-ids'] = await pg.evaluate("(async()=>{const db=await import('./js/db.js');return (await db.all('certs')).map(c=>c.id+':'+c.type)})()")
            async def at(h):
                await pg.goto(BASE + '#' + h); await pg.reload(); await pg.wait_for_timeout(900)
                await pg.evaluate("document.querySelectorAll('.syncchip').forEach(e=>e.remove()); document.querySelectorAll('details.card').forEach(d=>d.open=true)")
            async def shot(n, sel):
                await pg.evaluate('scrollTo(0, document.body.scrollHeight)'); await pg.wait_for_timeout(150)
                await pg.evaluate(f"(()=>{{const e=[...document.querySelectorAll('*')].find(x=>x.children.length<3&&x.textContent.trim().startsWith({json.dumps(sel)})&&x.offsetParent); if(e) e.scrollIntoView({{block:'center'}}); return !!e}})()")
                await pg.wait_for_timeout(250); await pg.screenshot(path=f'{OUT}/{tag}-{n}.png')
            await at('/cert/cert-eicr/s/inspections'); await shot('1-eicr-intake-subrows', 'Distributor/supplier intake equipment')
            await shot('2-eicr-intake-notified', 'The person ordering')
            info[tag+'-intake-after'] = await pg.evaluate("(async()=>{const db=await import('./js/db.js');const c=await db.get('certs','cert-eicr');return Object.entries(c.inspections).filter(([k])=>k.startsWith('1.1'))})()")
            await at('/cert/cert-eic/s/parts'); await shot('3-eic-rcd-main-switch-kA', 'Breaking capacity (kA)')
            if not phone:
                for cid in ['cert-eic', 'cert-eicr'] + [i.split(':')[0] for i in info[tag+'-ids'] if i.endswith(':MW')][:1]:
                    data = await pg.evaluate(PDF + f"('{cid}')"); f = f'{OUT}/pdf-{cid}.pdf'; open(f, 'wb').write(base64.b64decode(data))
                    subprocess.run(['pdftoppm', '-r', '80', '-png', f, f'{OUT}/pdf-{cid}'])
            await ctx.close()
        await br.close()
    print(json.dumps(info, indent=1)); print('ERRORS', errs)
asyncio.run(main())
