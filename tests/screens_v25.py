# tests/screens_v25.py OUTDIR: v0.25 (Zs Pro). FAKE data only. Server :8765.
import asyncio, sys, os, json, base64, subprocess
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.25'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
U = 'http://localhost:8765/index.html'
EXTRA = r'''async () => {
  const db = await import('/js/db.js'); const P = await import('/js/presets.js');
  const c = await db.get('certs', 'cert-eic');
  const b2 = JSON.parse(JSON.stringify(c.boards[0])); b2.id = 'b-db2'; b2.ref = 'DB2'; b2.location = 'Workshop (fake)'; b2.suppliedFrom = 'DB1';
  b2.circuits = [
    { ...b2.circuits[0], num: '1', desc: 'Workshop machines', device: 'mccb', bs: '60947-2', type: 'adj', rating: '200', im: '2000', ig: '100', tg: '0.2', bka: '25', rcdBs: '', rcdType: '', rcdIdn: '', rcdRating: '', remarks: '' },
    { ...b2.circuits[0], num: '2', desc: 'Compressor', device: 'mccb', bs: '60947-2', type: 'adj', rating: '200', im: '2000', ig: '100', tg: '0.2', bka: '25', rcdBs: '', rcdType: '', rcdIdn: '', rcdRating: '', remarks: '' },
    { ...b2.circuits[0], num: '3', desc: 'Spare', spare: true, noDevice: true, device: '', rating: '', bs: '', type: '' }];
  c.boards.push(b2); await db.put('certs', c);
  const t = (d) => new Date(Date.now() - d * 864e5).toISOString();
  const mk = (f, d) => ({ id: 'p' + Math.random().toString(36).slice(2, 7), key: P.keyOf(P.presetFrom(f)), name: P.nameFor(P.presetFrom(f)), fields: P.presetFrom(f), uses: 9, usedAt: t(d) });
  await P.save([
    mk({ device: 'rcbo', bs: '61009', type: 'B', rating: '32', bka: '6', rcdBs: '61009', rcdType: 'A', rcdIdn: '30', rcdRating: '32' }, 0.1),
    mk({ device: 'mccb', bs: '60947-2', type: 'adj', rating: '200', im: '2000', ig: '100', tg: '0.2', bka: '25', rcdIdn: '30', rcdType: 'A' }, 0.5),
    mk({ device: 'mcb', bs: '60898', type: 'B', rating: '6', bka: '6' }, 3),
    mk({ device: 'rcbo', bs: '61009', type: 'B', rating: '16', bka: '6', rcdBs: '61009', rcdType: 'A', rcdIdn: '30', rcdRating: '16' }, 3)]);
  return true; }'''
SIZE_SPREAD = {'phase': '1', 'loadType': 'general', 'load': '20', 'unit': 'A', 'length': '45', 'cable': 'te', 'method': 'C', 'grouped': '1', 'device': 'mcb', 'type': 'auto', 'ze': '0.35', 'ci': '1', 'ambient': '30', 'spread': True}
SIZE_MCCB = {'phase': '3', 'loadType': 'general', 'load': '160', 'unit': 'A', 'length': '40', 'cable': 'swa', 'method': 'C', 'grouped': '1', 'device': 'mccb', 'type': 'auto', 'ze': '0.2', 'ci': '1', 'ambient': '30', 'im': '1600', 'ig': '200', 'tg': '0.2'}
CHECK_MCCB = {'phase': '3', 'device': 'mccb', 'type': 'adj', 'rating': '200', 'im': '2000', 'ig': '200', 'tg': '0.2', 'ib': '160', 'shape': 'radial', 'length': '40', 'cable': 'swa', 'method': 'C', 'size': '95', 'grouped': '1', 'ci': '1', 'ze': '0.2', 'ambient': '30'}
CHECK_SPREAD = {'phase': '1', 'device': 'mcb', 'type': 'B', 'rating': '20', 'ib': '18', 'shape': 'radial', 'length': '45', 'cable': 'te', 'method': 'C', 'size': '2.5', 'grouped': '1', 'ci': '1', 'ze': '0.35', 'ambient': '30', 'spread': True}
CHECK_FLEX3 = {'phase': '3', 'device': 'mcb', 'type': 'C', 'rating': '16', 'ib': '12', 'shape': 'radial', 'length': '10', 'cable': 'flex', 'method': 'C', 'size': '2.5', 'grouped': '1', 'ci': '1', 'ze': '0.35', 'ambient': '30'}

def pdf_png(b64, name, first=None, last=None):
    pdf = f'{OUT}/{name}.pdf'; open(pdf, 'wb').write(base64.b64decode(b64))
    args = ['pdftoppm', '-png', '-r', '110'] + (['-f', str(first), '-l', str(last)] if first else []) + [pdf, f'{OUT}/{name}']
    subprocess.run(args, check=True); os.remove(pdf)

async def main():
    os.makedirs(OUT, exist_ok=True); errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for scheme in ['light', 'dark']:
            ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.6, is_mobile=True, has_touch=True, service_workers='block', color_scheme=scheme)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            shot = lambda n, **k: pg.screenshot(path=f'{OUT}/v25-{n}-{scheme}.png', **k)
            async def go(route, wait=900): await pg.goto(U + '#/calc'); await pg.wait_for_timeout(150); await pg.goto(U + route); await pg.wait_for_timeout(wait)
            # first run: no jobs
            await pg.goto(U + '#/'); await pg.wait_for_timeout(900); await shot('firstrun')
            await pg.locator('a.newphone-link').click(); await pg.wait_for_timeout(1200); await shot('settings-restore')
            await pg.evaluate(SEED); await pg.evaluate(EXTRA); await pg.reload(); await pg.wait_for_timeout(900)
            await go('#/'); await shot('home')
            await go('#/settings/presets'); await shot('presets')
            await go('#/job/job-demo'); await shot('job')
            await go('#/job/job-demo/parts'); await shot('parts'); await shot('parts-full', full_page=True)
            for key, route, v, n in [('size1', '#/calc/size', SIZE_SPREAD, 'size-spread'), ('size1', '#/calc/size', SIZE_MCCB, 'size-mccb'),
                                     ('calc2', '#/calc/check', CHECK_SPREAD, 'check-spread'), ('calc2', '#/calc/check', CHECK_MCCB, 'check-mccb'), ('calc2', '#/calc/check', CHECK_FLEX3, 'check-flex3')]:
                await pg.evaluate(f"localStorage.setItem('sparky.{key}', JSON.stringify({json.dumps(v)}))")
                await go(route); await shot(n)
                lsig = pg.locator('details:has(summary:has-text("LSIG")), details#size-lsig').first
                if await lsig.count():
                    if not await lsig.evaluate('d => d.open'): await lsig.locator('summary').first.click()
                    await lsig.scroll_into_view_if_needed(); await pg.wait_for_timeout(300); await shot(n + '-lsig')
                ans = pg.locator('.ans, .result, .card.res').first
                if await ans.count(): await ans.scroll_into_view_if_needed(); await pg.wait_for_timeout(300); await shot(n + '-answer')
                for m in await pg.locator('details.izmore > summary').all():
                    try: await m.click()
                    except Exception: pass
                await pg.wait_for_timeout(300); await shot(n + '-full', full_page=True)
                ir = pg.locator('button.sym[data-sym="Ir"]').first
                if n == 'check-mccb' and await ir.count():
                    await ir.scroll_into_view_if_needed(); await ir.click(); await pg.wait_for_timeout(400); await shot('ir-popup')
            await go('#/calc/symbols'); await shot('symbols')
            sy = pg.locator('.symrow:has(b.symk:text-is("Ir"))').first
            if await sy.count(): await sy.scroll_into_view_if_needed(); await pg.wait_for_timeout(300); await shot('symbols-ir')
            if scheme == 'light':
                b64 = await pg.evaluate("""async () => { const db = await import('/js/db.js'); const { partsForJob } = await import('/js/parts.js'); const { partsPdf } = await import('/js/partspdf.js');
                  const certs = await db.byJob('certs', 'job-demo'); const job = await db.get('jobs', 'job-demo'); const res = partsForJob(certs);
                  const blob = await partsPdf(res, { title: job.title + ' (' + res.from.join(', ') + ')', profile: await db.getMeta('profile') });
                  const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (const x of buf) s += String.fromCharCode(x); return btoa(s); }""")
                pdf_png(b64, 'v25-parts-pdf')
                b64 = await pg.evaluate("""async () => { const db = await import('/js/db.js'); const { certificatePdf } = await import('/js/pdf.js');
                  const c = await db.get('certs', 'cert-eic'); const blob = await certificatePdf(c, { profile: await db.getMeta('profile') });
                  const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (const x of buf) s += String.fromCharCode(x); return btoa(s); }""")
                pdf_png(b64, 'v25-cert-pdf')
            await ctx.close()
        await b.close()
    print('errors:', errs)
asyncio.run(main())
