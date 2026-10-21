# tests/screens_v19.py OUTDIR — v0.19 shots: motor VSD (40 A Type C), Type D override note, H07RN-F,
# kW ↔ A, MPCB, MCCB, meter tails, contactor picker, transformer, fault level, Use on a circuit
# (preview + Undo), Settings email line. Mainly dark, a few light. FAKE data (screens.py SEED). Server :8765.
import asyncio, sys, os, json
from playwright.async_api import async_playwright
here = os.path.dirname(__file__)
src = open(os.path.join(here, 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.19'
M = {'phase': '3', 'loadType': 'motor', 'load': '39.69', 'unit': 'A', 'length': '10', 'cable': 'swa4', 'method': 'C', 'device': 'mcb', 'type': 'auto', 'start': 'vsd', 'ze': '0.35'}
SIZE = [
  ('v19-01-motor-vsd-40C', M, None),
  ('v19-02-motor-stardelta-D-picked', {**M, 'start': 'sd', 'type': 'D'}, None),
  ('v19-03-h07rnf', {'phase': '1', 'loadType': 'general', 'load': '16', 'unit': 'A', 'length': '25', 'cable': 'h07', 'method': 'C', 'device': 'mcb', 'type': 'auto'}, None),
  ('v19-04-kw-to-amps-motor', {**M, 'load': '22', 'unit': 'kW', 'pf': '0.85', 'eff': '0.9', 'start': 'dol', 'length': '20'}, "document.querySelector('.convline').scrollIntoView({block:'center'})"),
  ('v19-05-amps-to-kw', {'phase': '1', 'loadType': 'heating', 'load': '31.3', 'unit': 'A', 'length': '12', 'cable': 'te', 'method': 'C', 'device': 'rcbo'}, "document.querySelector('.convline').scrollIntoView({block:'center'})"),
  ('v19-06-mpcb', {'phase': '3', 'loadType': 'motor', 'load': '3.97', 'unit': 'A', 'length': '15', 'cable': 'swa4', 'method': 'C', 'device': 'mpcb', 'start': 'dol'}, None),
  ('v19-07-mccb', {'phase': '3', 'loadType': 'general', 'load': '110', 'unit': 'A', 'length': '30', 'cable': 'swa4X', 'method': 'C', 'device': 'mccb', 'ir': '125', 'im': '625', 'ze': '0.2', 'time': 5}, None),
  ('v19-08-meter-tails', {'phase': '1', 'loadType': 'general', 'load': '80', 'unit': 'A', 'length': '3', 'cable': 'tails', 'method': 'B', 'device': 'bs88-3', 'cutout': '100', 'time': 5}, None),
  ('v19-09-tri-rated-bunched', {'phase': '1', 'loadType': 'general', 'load': '10', 'unit': 'A', 'length': '4', 'cable': 'tri', 'method': 'bunch', 'grouped': '6', 'device': 'mcb'}, None),
]
OTHER = [('v19-10-contactor', '#/calc/contactor', 'contactor1', {'cat': 'AC-1', 'load': '10', 'unit': 'kW', 'phase': '3'}),
  ('v19-11-transformer', '#/calc/xfmr', 'xfmr1', {'va': '250', 'vp': '400', 'vs': '24'}),
  ('v19-12-fault-level', '#/calc/fault', 'fault1', {'phase': '1', 'pfc': '16', 'ze': '0.35', 'cable': 'swa', 'size': '25', 'length': '8', 'ka': '6'}),
  ('v19-13-calculators', '#/calc', None, None)]
async def run(p, scheme, sizes, others, extra):
    b = await p.chromium.launch(); errors = []
    ctx = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.6, is_mobile=True, has_touch=True, service_workers='block', color_scheme=scheme)
    page = await ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e))); page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    await page.goto('http://localhost:8765/index.html#/'); await page.wait_for_timeout(700); await page.evaluate(SEED); await page.reload(); await page.wait_for_timeout(1000)
    for name, v, js in sizes:
        await page.evaluate(f"localStorage.setItem('sparky.size1', JSON.stringify({json.dumps(v)}))")
        await page.evaluate("location.hash = '#/'"); await page.wait_for_timeout(300)
        await page.evaluate("location.hash = '#/calc/size'"); await page.wait_for_timeout(1200)
        if js: await page.evaluate(js); await page.wait_for_timeout(300); await page.screenshot(path=f'{OUT}/{name}-{scheme}.png')
        else: await page.screenshot(path=f'{OUT}/{name}-{scheme}.png')
    for name, h, key, v in others:
        if key: await page.evaluate(f"localStorage.setItem('sparky.{key}', JSON.stringify({json.dumps(v)}))")
        await page.evaluate("location.hash = '#/'"); await page.wait_for_timeout(300)
        await page.evaluate(f"location.hash = '{h}'"); await page.wait_for_timeout(1200)
        await page.screenshot(path=f'{OUT}/{name}-{scheme}.png')
    # breaker card with the MPCB / MCCB settings
    for name, v in [('v19-06b-mpcb-settings', SIZE[5][1]), ('v19-07b-mccb-settings', SIZE[6][1])]:
        if scheme != 'dark': break
        await page.evaluate(f"localStorage.setItem('sparky.size1', JSON.stringify({json.dumps(v)}))")
        await page.evaluate("location.hash = '#/'"); await page.wait_for_timeout(300)
        await page.evaluate("location.hash = '#/calc/size'"); await page.wait_for_timeout(1200)
        await page.evaluate("[...document.querySelectorAll('.icard h2')].pop().scrollIntoView({block:'start'})"); await page.wait_for_timeout(300)
        await page.screenshot(path=f'{OUT}/{name}-{scheme}.png')
    if extra: await extra(page, scheme)
    await b.close(); return errors
async def use_and_settings(page, scheme):
    await page.evaluate("localStorage.setItem('sparky.lastCert', 'cert-eic')")
    await page.evaluate(f"localStorage.setItem('sparky.size1', JSON.stringify({json.dumps(M)}))")
    await page.evaluate("location.hash = '#/'"); await page.wait_for_timeout(300)
    await page.evaluate("location.hash = '#/calc/size'"); await page.wait_for_timeout(1200)
    await page.click('[data-use]'); await page.wait_for_timeout(900)
    await page.screenshot(path=f'{OUT}/v19-14-use-on-circuit-preview-{scheme}.png')
    await page.click('.modal .btn.primary'); await page.wait_for_timeout(700)
    await page.screenshot(path=f'{OUT}/v19-15-use-on-circuit-undo-toast-{scheme}.png')
    await page.click('[data-undo]'); await page.wait_for_timeout(600)
    await page.evaluate("location.hash = '#/settings'"); await page.wait_for_timeout(1200)
    await page.evaluate("document.querySelector('input[type=email]').scrollIntoView({block:'center'})"); await page.wait_for_timeout(300)
    await page.screenshot(path=f'{OUT}/v19-16-settings-email-line-{scheme}.png')
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        e1 = await run(p, 'dark', SIZE, OTHER, use_and_settings)
        e2 = await run(p, 'light', [SIZE[0], SIZE[2]], [OTHER[0], OTHER[2]], use_and_settings)
    print('errors:', e1 + e2)
asyncio.run(main())
