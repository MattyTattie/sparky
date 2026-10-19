# tests/restore_mock.py — Restore from Drive click-through with a FAKE Google
# (fake sign-in script + fake Drive API). FAKE data only. Desktop 1440x900.
#   python3 -m http.server 8765 &   then   python3 tests/restore_mock.py [chromium|webkit] [scenario]
import asyncio, sys, os, json, re, urllib.parse
SHOTS = os.environ.get('SHOTS')  # set → phone size (412x915) and save the message screenshot there
from playwright.async_api import async_playwright
URL = 'http://localhost:8765/index.html'
ENGINE = sys.argv[1] if len(sys.argv) > 1 else 'chromium'
SCEN = sys.argv[2] if len(sys.argv) > 2 else 'ok'
NOW = '2026-10-18T10:00:00.000Z'
JOB = {'id': 'job-fake-1', 'title': 'Fake rewire', 'siteAddress': '1 Test Lane', 'createdAt': '2026-10-17T07:00:00.000Z', 'updatedAt': NOW, 'version': 9, 'status': 'open'}
CERT = {'id': 'cert-fake-1', 'jobId': 'job-fake-1', 'type': 'EIC', 'number': 'EIC-0001', 'createdAt': '2026-10-17T07:00:00.000Z', 'updatedAt': NOW, 'version': 5, 'boards': []}
FILES = {
  'root1': {'id': 'root1', 'name': 'Sparky jobs', 'mimeType': 'application/vnd.google-apps.folder', 'parents': ['myroot']},
  'fold1': {'id': 'fold1', 'name': '2026-10-17 – Fake rewire', 'mimeType': 'application/vnd.google-apps.folder', 'parents': ['root1'], 'modifiedTime': NOW},
  'json1': {'id': 'json1', 'name': 'job.json', 'mimeType': 'application/json', 'parents': ['fold1'], 'modifiedTime': NOW},
}
if SCEN == 'empty': FILES = {}
DATA = {'json1': {'app': 'sparky', 'format': 1, 'savedAt': NOW, 'job': JOB, 'customer': None, 'certs': [CERT], 'files': []}}
GSI = r'''window.google = { accounts: { oauth2: {
  initTokenClient(cfg) { return { requestAccessToken(opts) {
    window.__gsiCalls = (window.__gsiCalls || 0) + 1;
    const mode = window.__gsiMode || 'ok';
    // Like the real thing: a pop-up, which browsers block unless straight after a tap.
    const w = window.open('about:blank', 'gsi', 'width=400,height=500');
    if (!w || mode === 'blocked') { setTimeout(() => cfg.error_callback && cfg.error_callback({ type: 'popup_failed_to_open' }), 50); return; }
    setTimeout(() => { try { w.close(); } catch {} if (mode === 'never') return; cfg.callback({ access_token: 'FAKE', expires_in: 3600 }); }, 150);
  } }; },
  revoke(t, cb) { cb && cb(); } } } };'''
async def drive(route):
    u = urllib.parse.urlparse(route.request.url); qs = urllib.parse.parse_qs(u.query)
    path = u.path
    if path.endswith('/about'): return await route.fulfill(json={'user': {'displayName': 'Fake', 'emailAddress': 'fake@example.com'}})
    if path.endswith('/files') and route.request.method == 'GET':
        q = qs.get('q', [''])[0]; out = []
        for f in FILES.values():
            m = re.search(r"name = '([^']+)'", q)
            if m and f['name'] != m.group(1): continue
            m = re.search(r"'([^']+)' in parents", q)
            if m and m.group(1) not in f['parents']: continue
            if 'folder' in q and "mimeType = 'application/vnd.google-apps.folder'" in q and f['mimeType'] != 'application/vnd.google-apps.folder': continue
            out.append(f)
        return await route.fulfill(json={'files': out})
    if path.endswith('/files') and route.request.method == 'POST': return await route.fulfill(json={'id': 'newroot', 'name': 'Sparky jobs', 'mimeType': 'application/vnd.google-apps.folder', 'parents': ['myroot']})
    m = re.search(r'/files/([^/]+)$', path)
    if m:
        fid = m.group(1)
        if fid not in FILES: return await route.fulfill(status=404, json={'error': {'message': 'File not found'}})
        if qs.get('alt') == ['media']: return await route.fulfill(json=DATA[fid])
        return await route.fulfill(json={**FILES[fid], 'trashed': False})
    await route.fulfill(status=500, json={'error': {'message': 'mock: unhandled ' + path}})
async def main():
    errs = []; out = {'engine': ENGINE, 'scenario': SCEN}
    async with async_playwright() as p:
        b = await getattr(p, ENGINE).launch()
        ctx = await b.new_context(viewport={'width': 412, 'height': 915} if SHOTS else {'width': 1440, 'height': 900}, device_scale_factor=2 if SHOTS else 1, service_workers='block')  # so the fake Google is used (WebKit routes skip SW fetches)
        await ctx.route('https://accounts.google.com/gsi/client*', lambda r: r.fulfill(body=('' if SCEN == 'gsifail' else GSI), content_type='text/javascript', status=(500 if SCEN == 'gsifail' else 200)))
        await ctx.route('https://www.googleapis.com/**', drive)
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        toasts = []
        await pg.expose_function('__toastSeen', lambda t: toasts.append(t))
        await pg.goto(URL + '#/'); await pg.wait_for_timeout(500)
        # This Mac: was connected before (account remembered), token has run out.
        old = {**JOB, 'updatedAt': '2026-10-17T08:00:00.000Z', 'version': 2} if SCEN != 'newer-local' else {**JOB, 'updatedAt': '2026-10-18T12:00:00.000Z', 'version': 12}
        await pg.evaluate('''async ([j, mode]) => { const db = await import('/js/db.js'); await db.put('jobs', j); localStorage.setItem('sparky.ghint', 'fake@example.com'); localStorage.setItem('sparky.gtoken', JSON.stringify({accessToken:'OLD', expiresAt: Date.now()-1000})); }''', [old, SCEN])
        await pg.reload(); await pg.wait_for_timeout(600)
        await pg.evaluate('''(mode) => { window.__gsiMode = mode; new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.classList && n.classList.contains('toast')) window.__toastSeen(n.textContent); }))).observe(document.body, { childList: true }); }''', {'blocked': 'blocked', 'never': 'never'}.get(SCEN, 'ok'))
        await pg.goto(URL + '#/settings'); await pg.wait_for_timeout(700)
        await pg.click('button:has-text("Restore from Drive")'); await pg.wait_for_timeout(14000 if SCEN == 'never' else 1500)
        out['modal'] = await pg.locator('.modal').count() and await pg.locator('.modal').inner_text()
        out['msg1'] = await pg.locator('.drivemsg').inner_text()
        await pg.screenshot(path=f'/tmp/restore-{ENGINE}-{SCEN}-1.png')
        if SHOTS:
            await pg.evaluate("(() => { const m = document.querySelector('.drivemsg'); if (m) { m.scrollIntoView({block: 'center'}); } })()"); await pg.wait_for_timeout(300)
            await pg.screenshot(path=os.path.join(SHOTS, f'v05-restore-{SCEN}.png'))
        if await pg.locator('.modal input[type=checkbox]').count():
            await pg.locator('.modal input[type=checkbox]').first.check(); await pg.wait_for_timeout(200)
            await pg.click('.modal button:has-text("Restore")'); await pg.wait_for_timeout(1500)
            out['after_modal'] = await pg.locator('.modal').count() and await pg.locator('.modal').inner_text()
        out['msg2'] = await pg.locator('.drivemsg').count() and await pg.locator('.drivemsg').inner_text()
        out['gsiCalls'] = await pg.evaluate('window.__gsiCalls || 0')
        out['toasts'] = toasts
        out['local_job'] = await pg.evaluate("async () => { const db = await import('/js/db.js'); const j = await db.get('jobs','job-fake-1'); return j && [j.updatedAt, j.version]; }")
        out['local_cert'] = await pg.evaluate("async () => { const db = await import('/js/db.js'); return !!(await db.get('certs','cert-fake-1')); }")
        out['hash'] = await pg.evaluate('location.hash')
        await pg.screenshot(path=f'/tmp/restore-{ENGINE}-{SCEN}-2.png')
        await b.close()
    print(json.dumps({**out, 'errors': errs}, indent=1))
asyncio.run(main())
