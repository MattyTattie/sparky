# tests/screens_v320.py: v0.32.0 A4 changes + full PDFs. FAKE data only; calibration dates scrubbed before any PDF.
import asyncio, os, json, base64, subprocess
from playwright.async_api import async_playwright
OUT = '/workspace/sparky-shots/v0.32.0'; BASE = 'http://localhost:8765/index.html'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
SCRUB = r"""(async()=>{const db=await import('./js/db.js');
 const ins=(await db.getMeta('instruments'))||[]; ins.forEach(i=>{i.calDue='';}); await db.setMeta('instruments',ins);
 const walk=(o)=>{ if(Array.isArray(o)) return o.map(walk); if(o&&typeof o==='object'){ for(const k of Object.keys(o)){ if(/cal/i.test(k)&&!/local/i.test(k)) o[k]=''; else o[k]=walk(o[k]); } return o; } if(typeof o==='string') return o.replace(/\s*\(cal[^)]*\)/gi,'').replace(/cal(ibration)?\.?\s*(due)?:?\s*\d{4}-\d\d-\d\d/gi,''); return o; };
 for(const id of ['cert-eic','cert-eicr','cert-mw']){ const c=await db.get('certs',id); if(c){ walk(c); await db.put('certs',c);} }
 const e=await db.get('certs','cert-eicr'); if(e){ e.observations=[{id:'o1',item:'4.4',code:'C2',text:'No RCD protection to socket-outlets for general use',reg:'411.3.3',location:'Kitchen'},{id:'o2',item:'5.12',code:'C3',text:'Cable not adequately supported in loft',reg:'522.8.5',location:'Loft'},{id:'o3',item:'6.1',code:'FI',text:'Circuit 7 destination unknown',reg:'',location:'CU'}]; const b=e.boards[0]; b.fedBySource=true; b.maxDemand='60'; await db.put('certs',e);} })()"""
PDF = "(async(id)=>{const db=await import('./js/db.js');const p=await import('./js/pdf.js');const c=await db.get('certs',id);const b=await p.certificatePdf(c,{});const a=new Uint8Array(await b.arrayBuffer());let s='';for(const x of a)s+=String.fromCharCode(x);return btoa(s)})"
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []; info = {}
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for (w, hh) in [(1440, 900), (390, 844)]:
            phone = w < 900; tag = 'phone' if phone else 'mac'
            ctx = await br.new_context(viewport={'width': w, 'height': hh}, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone, service_workers='block', color_scheme='dark' if phone else 'light')
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(tag + ': ' + str(e)))
            await pg.goto(BASE + '#/'); await pg.wait_for_timeout(700); await pg.evaluate(SEED); await pg.wait_for_timeout(300); await pg.evaluate(SCRUB)
            info[tag+'-ids'] = await pg.evaluate("(async()=>{const db=await import('./js/db.js');return (await db.all('certs')).map(c=>c.id+':'+c.type)})()")
            async def at(h):
                await pg.goto(BASE + '#' + h); await pg.reload(); await pg.wait_for_timeout(900)
                await pg.evaluate("document.querySelectorAll('.syncchip').forEach(e=>e.remove()); document.querySelectorAll('details.card').forEach(d=>d.open=true)")
            async def shot(n, sel):
                await pg.evaluate('scrollTo(0, document.body.scrollHeight)'); await pg.wait_for_timeout(150)
                await pg.evaluate(f"(()=>{{const e=[...document.querySelectorAll('*')].find(x=>x.children.length<3&&x.textContent.trim().startsWith({json.dumps(sel)})&&x.offsetParent); if(e) e.scrollIntoView({{block:'center'}}); return !!e}})()")
                await pg.wait_for_timeout(250); await pg.screenshot(path=f'{OUT}/{tag}-{n}.png')
            await at('/cert/cert-eicr/s/observations'); await shot('1-eicr-observations-split', 'C1 and C2 observations')
            await at('/cert/cert-eicr/b/0'); await shot('2-board-bidi-reminder', 'Bidirectional devices')
            await pg.locator('button:text-is("Add note")').first.click(); await pg.wait_for_timeout(400); await shot('3-board-bidi-note-added', 'Bidirectional devices')
            info[tag+'-general'] = await pg.evaluate("(async()=>{const db=await import('./js/db.js');return (await db.get('certs','cert-eicr')).eicr.general})()")
            await shot('4-board-max-demand', 'Max demand')
            await at('/cert/cert-eic/b/0/c/0'); await shot('5-eic-circuit-afdd', 'AFDD (if any)')
            if not phone:
                for cid in ['cert-eic', 'cert-eicr'] + [i.split(':')[0] for i in info[tag+'-ids'] if i.endswith(':MW')][:1]:
                    data = await pg.evaluate(PDF + f"('{cid}')"); f = f'{OUT}/pdf-{cid}.pdf'; open(f, 'wb').write(base64.b64decode(data))
                    subprocess.run(['pdftoppm', '-r', '80', '-png', f, f'{OUT}/pdf-{cid}'])
            await ctx.close()
        await br.close()
    print(json.dumps(info, indent=1)); print('ERRORS', errs)
asyncio.run(main())
