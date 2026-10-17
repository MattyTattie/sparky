# tests/flow.py — clicks through: new job -> EIC -> add circuit from a
# template -> enter readings -> reload (autosave) -> scan a fake CU photo.
import asyncio, os, json, sys
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots'
CU = '''<html><body style="margin:0;background:#ddd;font-family:Arial">
<div style="display:flex;gap:6px;padding:30px;background:#f4f4f4;width:900px">
''' + ''.join(f'<div style="width:80px;height:160px;background:#fff;border:2px solid #333;text-align:center;padding-top:20px"><div style="font-size:30px;font-weight:bold">{d}</div><div style="margin-top:60px;font-size:18px">{l}</div></div>' for d, l in [('B32', 'Sockets'), ('B32', 'Kitchen'), ('B6', 'Lights'), ('B40', 'Shower'), ('B16', 'Immersion'), ('B6', 'Smoke')]) + '</div></body></html>'
async def main():
    errs = []; out = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg0 = await b.new_page(viewport={'width': 960, 'height': 240}); await pg0.set_content(CU); await pg0.screenshot(path='/tmp/fake-cu.png'); await pg0.close()
        ctx = await b.new_context(viewport={'width': 412, 'height': 915}, is_mobile=True, has_touch=True)
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto('http://localhost:8765/index.html#/'); await pg.wait_for_timeout(600)
        await pg.click('text=+ New job'); await pg.wait_for_timeout(300)
        await pg.locator('label.f', has_text='What').locator('input').fill('Flow test job')
        await pg.locator('label.f', has_text='Name').first.locator('input').fill('C. Testcase (fake)')
        await pg.locator('label.f', has_text='Address').first.locator('textarea').fill('9 Nowhere Close, Fakeville')
        await pg.click('text=Create job'); await pg.wait_for_timeout(500)
        out['job_page'] = await pg.locator('header h1').inner_text()
        await pg.click('text=+ EIC'); await pg.wait_for_timeout(500)
        out['cert_title'] = await pg.locator('header h1').inner_text()
        await pg.click('text=Circuits and test results'); await pg.wait_for_timeout(400)
        await pg.click('text=+ Circuit'); await pg.wait_for_timeout(300)
        await pg.click('text=Ring final (sockets)'); await pg.wait_for_timeout(500)
        await pg.locator('.fld', has_text='Zs maximum measured').locator('input').fill('1.30')
        await pg.wait_for_timeout(300)
        out['zs_flag'] = await pg.locator('.fld', has_text='Zs maximum measured').locator('.msg').inner_text()
        await pg.locator('.fld', has_text='IR Live – Earth').locator('input').fill('0.5')
        await pg.wait_for_timeout(300)
        out['ir_flag'] = await pg.locator('.fld', has_text='IR Live – Earth').locator('.msg').inner_text()
        await pg.locator('.fld', has_text='RCD disconnection').locator('input').fill('320'); await pg.wait_for_timeout(300)
        out['rcd_flag'] = await pg.locator('.fld', has_text='RCD disconnection').locator('.msg').inner_text()
        await pg.reload(); await pg.wait_for_timeout(700)
        out['after_quick_reload_zs'] = await pg.locator('.fld', has_text='Zs maximum measured').locator('input').input_value()
        # OCR on a fake consumer unit
        res = await pg.evaluate('''async () => { const r = await fetch('/fake-cu.png'); return r.ok; }''')
        import shutil; shutil.copy('/tmp/fake-cu.png', 'tests/fake-cu.png')
        ocr = await pg.evaluate('''async () => { const { readBoardPhoto } = await import('/js/ocr.js'); const bl = await (await fetch('/tests/fake-cu.png')).blob(); const r = await readBoardPhoto(bl); return r.circuits.map(c => [c.num, c.type + c.rating, c.desc]); }''')
        out['ocr'] = ocr
        await ctx.close(); await b.close()
    os.remove('tests/fake-cu.png')
    print(json.dumps({'errors': errs, **out}, indent=1))
asyncio.run(main())
