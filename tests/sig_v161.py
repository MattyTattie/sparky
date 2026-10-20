# tests/sig_v161.py OUTDIR PREFIX — signature pad: draw, Clear, Use this (with/without save), touch + mouse. FAKE data. Server :8765.
import asyncio, sys, os, json
from playwright.async_api import async_playwright
here = os.path.dirname(__file__)
src = open(os.path.join(here, 'screens.py')).read(); SEED = src.split("SEED = r'''", 1)[1].split("'''", 1)[0]
OUT, PRE = sys.argv[1], sys.argv[2]
URL = 'http://localhost:8765/index.html'
INK = "() => { const c=document.querySelector('.modal canvas.sigpad'); if(!c) return -1; const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for(let i=3;i<d.length;i+=4) if(d[i]>10) n++; return n; }"
async def stroke(page, touch):
    box = await page.locator('.modal canvas.sigpad').bounding_box()
    pts = [(box['x']+30+i*12, box['y']+90+((-1)**i)*30) for i in range(20)]
    if touch:
        cdp = await page.context.new_cdp_session(page)
        tp = lambda x,y: [{'x':x,'y':y,'id':1}]
        await cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':tp(*pts[0])})
        for x,y in pts[1:]: await cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':tp(x,y)})
        await cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
    else:
        await page.mouse.move(*pts[0]); await page.mouse.down()
        for x,y in pts[1:]: await page.mouse.move(x,y)
        await page.mouse.up()
    await page.wait_for_timeout(150)
async def tap(page, text, touch):
    l = page.locator(f'.modal button:has-text("{text}")').first
    if touch: await l.tap()
    else: await l.click()
    await page.wait_for_timeout(400)
async def run(b, touch, res):
    kw = dict(viewport={'width': 412, 'height': 915}, device_scale_factor=2.625, is_mobile=True, has_touch=True) if touch else dict(viewport={'width': 900, 'height': 1000})
    ctx = await b.new_context(service_workers='block', **kw); page = await ctx.new_page(); errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    await page.goto(URL + '#/'); await page.wait_for_timeout(800); await page.evaluate(SEED); await page.reload(); await page.wait_for_timeout(1200)
    cid = await page.evaluate("async () => (await (await import('/js/db.js')).all('certs')).find(c=>c.type==='EIC').id")
    await page.evaluate("async () => { const db = await import('/js/db.js'); await db.setMeta('mysig', null); }")
    sid = await page.evaluate("async () => { const m = await import('/js/certui.js').catch(()=>null); return null; }")
    await page.evaluate(f"location.hash = '#/cert/{cid}/s/sign'"); await page.wait_for_timeout(1000)
    mode = 'touch' if touch else 'mouse'; r = {}
    signb = page.locator('main button:has-text("Sign")').first
    await (signb.tap() if touch else signb.click()); await page.wait_for_timeout(500)
    await stroke(page, touch); r['inkAfterDraw'] = await page.evaluate(INK)
    await page.screenshot(path=f'{OUT}/{PRE}-{mode}-1-drawn.png'); 
    await tap(page, 'Clear', touch); r['inkAfterClear'] = await page.evaluate(INK); r['modalOpenAfterClear'] = await page.locator('.modal').count()
    await page.screenshot(path=f'{OUT}/{PRE}-{mode}-2-after-clear.png')
    await stroke(page, touch)
    # first sign WITHOUT save tick (touch) / WITH save tick (mouse)
    keep = page.locator('.modal input[type=checkbox]')
    if await keep.count():
        want = not touch
        if await keep.is_checked() != want: await (keep.tap() if touch else keep.click())
        r['tickBeforeUse'] = await keep.is_checked()
    await tap(page, 'Use this', touch)
    r['modalClosedAfterUse'] = await page.locator('.modal').count() == 0
    r['sigImgs'] = await page.locator('main img.sigimg').count()
    r['savedSig'] = await page.evaluate("async () => !!(await (await import('/js/db.js')).getMeta('mysig'))")
    await page.screenshot(path=f'{OUT}/{PRE}-{mode}-3-signed-card.png', full_page=True)
    stored = await page.evaluate(f"async () => {{ const c = await (await import('/js/db.js')).get('certs','{cid}'); return Object.keys(c.sigs||{{}}).filter(k=>c.sigs[k].img); }}")
    r['storedSigs'] = stored
    if not touch:
        sa = page.locator('main button:has-text("Sign again")').first; await sa.click(); await page.wait_for_timeout(500)
        r['savedButtonShown'] = await page.locator('.modal button:has-text("Use my saved signature")').count()
        if r['savedButtonShown']: await tap(page, 'Use my saved signature', False)
        r['sigImgsAfterSaved'] = await page.locator('main img.sigimg').count()
    try:
        b64 = await page.evaluate(f"""async () => {{ const c = await (await import('/js/db.js')).get('certs','{cid}'); const pdf = await import('/js/pdf.js');
          const prof = await (await import('/js/db.js')).getMeta('profile').catch(()=>null);
          const blob = await pdf.certificatePdf(c, {{ profile: prof || {{}} }}); const buf = new Uint8Array(await blob.arrayBuffer()); let s=''; for (const x of buf) s+=String.fromCharCode(x); return btoa(s); }}""")
        import base64; open(f'{OUT}/{PRE}-{mode}.pdf','wb').write(base64.b64decode(b64)); r['pdf'] = f'{OUT}/{PRE}-{mode}.pdf'
    except Exception as e: r['pdfError'] = str(e)[:300]
    r['errors'] = errs; res[mode] = r
    await ctx.close()
async def main():
    os.makedirs(OUT, exist_ok=True); res = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for t in (True, False): await run(b, t, res)
        await b.close()
    print(json.dumps(res, indent=1))
asyncio.run(main())
