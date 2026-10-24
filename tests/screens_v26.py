# tests/screens_v26.py OUTDIR: v0.26 shots. FAKE data only. Server :8765.
# Saved test equipment, certificate pick-list, Max demand (names, per-line working, − / +
# with the scroll position checked), PDF instrument sections (EIC schedule + Minor Works).
import asyncio, sys, os, json, base64, subprocess
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.26'
SEED = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split("SEED = r'''", 1)[1].split("'''", 1)[0]
U = 'http://localhost:8765/index.html'
INS = r'''async () => { const db = await import('/js/db.js');
  await db.setMeta('instruments', [
    { id: 'i1', make: 'Megger', model: 'MFT1741+ (sample)', serial: '000123', calDue: '2027-03-01', kinds: ['multi', 'continuity', 'ir', 'efli', 'pfc'], inUse: true },
    { id: 'i2', make: 'Kewtech', model: 'KT-RCD (sample)', serial: 'K-0042', calDue: '2027-01-15', kinds: ['rcd'], inUse: true },
    { id: 'i3', make: 'Fluke', model: '1664 FC (sample)', serial: 'F-7781', calDue: '', kinds: ['electrode', 'other'], inUse: true }]);
  for (const id of ['cert-eic', 'cert-mw']) { const c = await db.get('certs', id); if (!c) continue;
    c.instrumentIds = { multi: 'i1', continuity: 'i1', ir: 'i1', efli: 'i1', rcd: 'i2', electrode: 'i3' };
    c.instruments = { multi: 'Megger MFT1741+ (sample) s/n 000123', continuity: 'Megger MFT1741+ (sample) s/n 000123', ir: 'Megger MFT1741+ (sample) s/n 000123', efli: 'Megger MFT1741+ (sample) s/n 000123', rcd: 'Kewtech KT-RCD (sample) s/n K-0042', electrode: id === 'cert-eic' ? 'Fluke 1664 FC (sample) s/n F-7781' : '' };
    await db.put('certs', c); }
  return true; }'''
MD = {'fuse': '100', 'loads': [
  {'k': 'cooking', 'qty': 1, 'value': 7.4, 'name': 'Hob'}, {'k': 'cooking', 'qty': 1, 'value': 3, 'name': 'Oven'}, {'k': 'cooking', 'qty': 1, 'value': 3, 'name': 'Combi microwave'},
  {'k': 'cookerSocket', 'qty': 1, 'value': 0, 'name': 'CCU'}, {'k': 'immersion', 'qty': 1, 'value': 3},
  {'k': 'heater', 'qty': 1, 'value': 2, 'name': 'Lounge panel'}, {'k': 'heater', 'qty': 3, 'value': 1.5, 'name': 'Bedroom panels'},
  {'k': 'ring', 'qty': 2, 'value': 32}, {'k': 'radial', 'qty': 1, 'value': 20, 'name': 'Garage'}, {'k': 'lighting', 'qty': 2, 'value': 400}]}
def pdf_png(b64, name):
    pdf = f'{OUT}/{name}.pdf'; open(pdf, 'wb').write(base64.b64decode(b64))
    subprocess.run(['pdftoppm', '-png', '-r', '110', pdf, f'{OUT}/{name}'], check=True); os.remove(pdf)
PDF = """async (id) => { const db = await import('/js/db.js'); const { certificatePdf } = await import('/js/pdf.js');
  const c = await db.get('certs', id); const blob = await certificatePdf(c, { profile: await db.getMeta('profile') });
  const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (const x of buf) s += String.fromCharCode(x); return btoa(s); }"""
async def main():
    os.makedirs(OUT, exist_ok=True); errs = []; checks = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for scheme in ['light', 'dark']:
            ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.6, is_mobile=True, has_touch=True, service_workers='block', color_scheme=scheme)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            shot = lambda n, **k: pg.screenshot(path=f'{OUT}/v26-{n}-{scheme}.png', **k)
            async def go(route, wait=900): await pg.goto(U + '#/calc'); await pg.wait_for_timeout(150); await pg.goto(U + route); await pg.wait_for_timeout(wait)
            await pg.goto(U + '#/'); await pg.wait_for_timeout(700)
            await pg.evaluate(SEED); await pg.evaluate(INS); await pg.reload(); await pg.wait_for_timeout(700)
            # Settings → test instruments
            await go('#/settings'); h = pg.locator('h2.sec:has-text("Test instruments")'); await h.scroll_into_view_if_needed(); await pg.evaluate('window.scrollBy(0, -10)'); await pg.wait_for_timeout(300); await shot('settings-instruments')
            await pg.evaluate('window.scrollBy(0, 700)'); await pg.wait_for_timeout(200); await shot('settings-instruments-2')
            # Certificate pick-lists
            await go('#/cert/cert-eic/s/instruments', 1200); await shot('cert-instruments-eic')
            await pg.locator('details.more summary').first.click(); await pg.wait_for_timeout(200); await shot('cert-instruments-eic-moreinfo', full_page=True)
            await go('#/cert/cert-mw/s/instruments', 1200); await shot('cert-instruments-mw')
            # Typed fallback
            await pg.locator('select[aria-label="Earth electrode resistance"]').select_option('__typed'); await pg.wait_for_timeout(300); await shot('cert-instruments-typed', full_page=True)
            # Max demand
            await pg.evaluate(f"localStorage.setItem('sparky.md1', JSON.stringify({json.dumps(MD)}))")
            await go('#/calc/md', 1000); await shot('md-top')
            rows = pg.locator('.mdrow'); await rows.nth(7).scroll_into_view_if_needed(); await pg.evaluate('window.scrollBy(0, 120)'); await pg.wait_for_timeout(300); await shot('md-rings')
            # − / + : scroll position must not move
            plus = rows.nth(7).locator('button[aria-label="One more"]'); y0 = await pg.evaluate('scrollY'); top0 = await plus.evaluate('e => e.getBoundingClientRect().top')
            before = await rows.nth(7).locator('.mdwork').inner_text()
            await plus.click(); await pg.wait_for_timeout(300)
            y1 = await pg.evaluate('scrollY'); top1 = await plus.evaluate('e => e.getBoundingClientRect().top'); after = await rows.nth(7).locator('.mdwork').inner_text()
            await shot('md-after-plus')
            minus = rows.nth(7).locator('button[aria-label="One fewer"]')
            for _ in range(5): await minus.click()
            await pg.wait_for_timeout(200); y2 = await pg.evaluate('scrollY'); zero = await rows.nth(7).locator('input[aria-label="How many"]').input_value()
            await plus.click(); await plus.click(); await pg.wait_for_timeout(200)
            checks[scheme] = {'scrollY': [y0, y1, y2], 'buttonTop': [round(top0, 1), round(top1, 1)], 'before': before, 'after': after, 'min0': zero,
                              'sameRowNode': await pg.evaluate("document.querySelectorAll('.mdrow').length")}
            await go('#/calc/md', 1000); w = pg.locator('details:has(summary:has-text("How it worked it out"))').first; await w.scroll_into_view_if_needed(); await pg.wait_for_timeout(300); await shot('md-working')
            await shot('md-full', full_page=True)
            if scheme == 'light':
                pdf_png(await pg.evaluate(PDF, 'cert-eic'), 'v26-eic-pdf')
                pdf_png(await pg.evaluate(PDF, 'cert-mw'), 'v26-mw-pdf')
            await ctx.close()
        await b.close()
    print(json.dumps(checks, indent=1)); print('errors:', errs)
asyncio.run(main())
