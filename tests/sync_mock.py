# tests/sync_mock.py — v0.9 automatic sync, phone + Mac against ONE fake Google
# Drive (in this script; nothing goes to Google). FAKE data only.
#   python3 -m http.server 8765 &   then   python3 tests/sync_mock.py [shotsdir]
# Checks: first push, pull to the other device (job, certificate, photo),
# edit → other device, both edited → newest kept + conflict copy on both,
# delete stays deleted, offline/sign-in status. Prints JSON; exit 1 on failure.
import asyncio, sys, os, json, re, urllib.parse, itertools, datetime, base64
from playwright.async_api import async_playwright
URL = 'http://localhost:8765/index.html'
SHOTS = sys.argv[1] if len(sys.argv) > 1 else None
FILES = {}; BLOBS = {}; ids = itertools.count(1); tick = itertools.count(1)
def now(): return (datetime.datetime(2026, 10, 19, 12, 0, 0) + datetime.timedelta(seconds=next(tick))).strftime('%Y-%m-%dT%H:%M:%S.000Z')
GSI = r'''window.google = { accounts: { oauth2: { initTokenClient(cfg) { return { requestAccessToken() { setTimeout(() => cfg.callback({ access_token: 'FAKE', expires_in: 3600 }), 50); } }; }, revoke(t, cb) { cb && cb(); } } } };'''
OFFLINE = {'on': False}
async def drive(route):
    if OFFLINE['on']: return await route.abort()
    r = route.request; u = urllib.parse.urlparse(r.url); qs = urllib.parse.parse_qs(u.query); path = u.path; m = r.method
    if path.endswith('/about'): return await route.fulfill(json={'user': {'displayName': 'Fake', 'emailAddress': 'fake@example.com'}})
    if path.endswith('/files') and m == 'GET':
        q = qs.get('q', [''])[0]; out = []
        for f in FILES.values():
            if f.get('trashed'): continue
            mm = re.search(r"name = '([^']+)'", q)
            if mm and f['name'] != mm.group(1): continue
            mm = re.search(r"'([^']+)' in parents", q)
            if mm and mm.group(1) not in f.get('parents', []): continue
            mm = re.search(r"mimeType = '([^']+)'", q)
            if mm and f['mimeType'] != mm.group(1): continue
            mm = re.search(r"modifiedTime > '([^']+)'", q)
            if mm and not f['modifiedTime'] > mm.group(1): continue
            out.append(f)
        return await route.fulfill(json={'files': out})
    if path.endswith('/files') and m == 'POST':
        if 'uploadType=resumable' in r.url: return await route.fulfill(status=200, body='{}', content_type='application/json')  # no Location → simple upload
        meta = json.loads(r.post_data or '{}'); fid = 'f%d' % next(ids)
        FILES[fid] = {'id': fid, 'name': meta.get('name'), 'mimeType': meta.get('mimeType', 'application/octet-stream'), 'parents': meta.get('parents', ['myroot']), 'modifiedTime': now(), 'trashed': False}
        return await route.fulfill(json=FILES[fid])
    mm = re.search(r'/files/([^/]+)$', path)
    if mm:
        fid = mm.group(1)
        if fid not in FILES: return await route.fulfill(status=404, json={'error': {'message': 'File not found'}})
        if m == 'PATCH':
            if 'uploadType=resumable' in r.url: return await route.fulfill(status=200, body='{}', content_type='application/json')
            BLOBS[fid] = r.post_data_buffer or b''; FILES[fid]['modifiedTime'] = now(); FILES[fid]['size'] = str(len(BLOBS[fid]))
            return await route.fulfill(json=FILES[fid])
        if qs.get('alt') == ['media']: return await route.fulfill(body=BLOBS.get(fid, b''), content_type=FILES[fid]['mimeType'])
        return await route.fulfill(json=FILES[fid])
    await route.fulfill(status=500, json={'error': {'message': 'mock: unhandled ' + path}})

TOKEN = "localStorage.setItem('sparky.ghint', 'fake@example.com'); localStorage.setItem('sparky.gtoken', JSON.stringify({ accessToken: 'FAKE', expiresAt: Date.now() + 3600e3 }));"
async def device(b, name, mobile):
    ctx = await b.new_context(viewport={'width': 412, 'height': 915} if mobile else {'width': 1280, 'height': 820}, device_scale_factor=2, is_mobile=mobile, has_touch=mobile, service_workers='block',
        user_agent=('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Mobile Safari/537.36' if mobile else 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Safari/537.36'))
    await ctx.route('https://accounts.google.com/gsi/client*', lambda r: r.fulfill(body=GSI, content_type='text/javascript'))
    await ctx.route('https://www.googleapis.com/**', drive)
    pg = await ctx.new_page(); pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append(f'{name}: {e}'))
    await pg.goto(URL + '#/'); await pg.wait_for_timeout(500)
    return pg
SYNC = "async () => { const s = await import('/js/sync.js'); await s.syncNow(); return s.getStatus(); }"
JOBS = "async () => { const db = await import('/js/db.js'); return (await db.all('jobs')).map((j) => ({ id: j.id, title: j.title, notes: j.notes || '', v: j.version, b: j.backedUpVersion })).sort((a, b) => a.title.localeCompare(b.title)); }"
def edit(field, val): return f"async () => {{ const db = await import('/js/db.js'); const j = await db.get('jobs', 'job-s1'); j.{field} = {json.dumps(val)}; j.updatedAt = new Date().toISOString(); j.version = (j.version || 0) + 1; await db.put('jobs', j); }}"
async def main():
    res = {}; fails = []
    def check(c, msg):
        if not c: fails.append(msg)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        phone = await device(b, 'phone', True); mac = await device(b, 'mac', False)
        # Phone: one job with a certificate (signature inside) and a photo; sync switched on.
        await phone.evaluate("""async () => { const db = await import('/js/db.js'); const t = new Date().toISOString();
          await db.put('customers', { id: 'cust-s1', name: 'A. N. Example', address: '12 Imaginary Road', postcode: 'ZZ9 9ZZ', updatedAt: t });
          await db.put('jobs', { id: 'job-s1', customerId: 'cust-s1', title: 'Fake CU change', siteAddress: '12 Imaginary Road', createdAt: t, updatedAt: t, version: 1, status: 'open' });
          await db.put('certs', { id: 'cert-s1', jobId: 'job-s1', type: 'EIC', number: 'EIC-0001', createdAt: t, updatedAt: t, version: 1, sigs: { designer: { img: 'data:image/png;base64,iVBORw0KGgo=', date: '2026-10-19' } }, boards: [], photoIds: [] });
          const c = document.createElement('canvas'); c.width = 8; c.height = 8; const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
          await db.put('files', { id: 'file-s1', jobId: 'job-s1', kind: 'photo', name: 'photo-1.png', blob, version: 1, createdAt: t });
          await db.setMeta('sync.config', { enabled: true }); }""")
        for pg in (phone, mac): await pg.evaluate(f"() => {{ {TOKEN} }}")
        await mac.evaluate("async () => { const db = await import('/js/db.js'); await db.setMeta('sync.config', { enabled: true }); }")
        await phone.reload(); await phone.wait_for_timeout(2500)  # sync on open
        res['1_phone_status'] = (await phone.evaluate("async () => (await import('/js/sync.js')).getStatus()"))['state']
        res['1_drive'] = sorted(f['name'] for f in FILES.values())
        check('job.json' in res['1_drive'] and 'photo-1.png' in res['1_drive'], 'phone did not push job.json + photo')
        await mac.reload(); await mac.wait_for_timeout(2500)
        res['2_mac_jobs'] = await mac.evaluate(JOBS)
        res['2_mac_has'] = await mac.evaluate("async () => { const db = await import('/js/db.js'); const c = await db.get('certs', 'cert-s1'); const f = await db.get('files', 'file-s1'); return { cert: !!c, sig: !!(c && c.sigs && c.sigs.designer.img), photo: !!(f && f.blob && f.blob.size), customer: !!(await db.get('customers', 'cust-s1')) }; }")
        check(res['2_mac_jobs'] and res['2_mac_jobs'][0]['title'] == 'Fake CU change' and all(res['2_mac_has'].values()), 'mac did not get job/cert/signature/photo/customer')
        if SHOTS: await mac.evaluate("location.hash = '#/'"); await mac.wait_for_timeout(600); await mac.screenshot(path=os.path.join(SHOTS, 'v09-sync-03-mac-after-pull.png'))
        # Mac edits → phone gets it
        await mac.evaluate(edit('title', 'Fake CU change + garage')); await mac.evaluate(SYNC)
        await phone.evaluate(SYNC); res['3_phone_jobs'] = await phone.evaluate(JOBS)
        check(res['3_phone_jobs'][0]['title'] == 'Fake CU change + garage', 'edit on mac did not reach phone')
        check(not any(f['name'] == 'job.json' and f['id'] != [x for x in FILES.values() if x['name'] == 'job.json'][0]['id'] for f in FILES.values()), 'second job.json made for same job')
        # Pushes from the debounce: a change, then wait (PUSH_DELAY shortened via the module for the test)
        # Both edit before syncing: phone first, Mac later (newer) → phone keeps Mac's, saves its own as a conflict copy
        await phone.evaluate(edit('notes', 'Phone note: RCD tripping'))
        await mac.wait_for_timeout(1200); await mac.evaluate(edit('notes', 'Mac note: quote sent')); await mac.evaluate(SYNC)
        st = await phone.evaluate(SYNC); res['4_phone_status'] = st
        res['4_phone_jobs'] = await phone.evaluate(JOBS)
        await mac.evaluate(SYNC); res['4_mac_jobs'] = await mac.evaluate(JOBS)
        for k in ('4_phone_jobs', '4_mac_jobs'):
            js = res[k]; check(len(js) == 2 and any('conflict copy from this device' in j['title'] and j['notes'] == 'Phone note: RCD tripping' for j in js) and any(j['id'] == 'job-s1' and j['notes'] == 'Mac note: quote sent' for j in js), f'{k}: conflict not kept on both sides')
        res['4_copy_cert'] = await mac.evaluate("async () => { const db = await import('/js/db.js'); const j = (await db.all('jobs')).find((x) => x.conflictOf); return j ? (await db.byJob('certs', j.id)).length + ' cert(s), ' + (await db.byJob('files', j.id)).length + ' file(s)' : 'none'; }")
        check(res['4_copy_cert'] == '1 cert(s), 1 file(s)', 'conflict copy missing its certificate/photo')
        if SHOTS:
            await phone.evaluate("location.hash = '#/'"); await phone.wait_for_timeout(800); await phone.screenshot(path=os.path.join(SHOTS, 'v09-sync-01-phone-home-conflict.png'))
        # The other way: Mac's copy older than the phone's → Mac keeps its own, saves Drive's as a copy
        await mac.evaluate(edit('notes', 'Mac 2')); await phone.wait_for_timeout(1200); await phone.evaluate(edit('notes', 'Phone 2')); await phone.evaluate(SYNC)
        await mac.evaluate(SYNC); res['5_mac_jobs'] = await mac.evaluate(JOBS)
        check(any(j['id'] == 'job-s1' and j['notes'] == 'Phone 2' for j in res['5_mac_jobs']) and any(j['notes'] == 'Mac 2' and 'conflict copy' in j['title'] for j in res['5_mac_jobs']), 'conflict (Drive newer on mac) not handled')
        await phone.evaluate(SYNC); n_phone = len(await phone.evaluate(JOBS)); n_mac = len(res['5_mac_jobs']); check(n_phone == n_mac == 3, f'job counts differ phone {n_phone} mac {n_mac}')
        # Delete on the phone: stays deleted after the next pull
        await phone.evaluate("async () => { const db = await import('/js/db.js'); const s = await import('/js/sync.js'); const j = (await db.all('jobs')).find((x) => x.title.includes('Mac 2') || x.notes === 'Mac 2'); await db.del('jobs', j.id); await s.recordDelete(j.id); }")
        await phone.evaluate("async () => { const db = await import('/js/db.js'); const c = await db.getMeta('sync.config'); c.lastPull = ''; await db.setMeta('sync.config', c); }")
        await phone.evaluate(SYNC); res['6_phone_jobs'] = len(await phone.evaluate(JOBS)); check(res['6_phone_jobs'] == 2, 'deleted job came back')
        # Debounced push: a change on its own goes up after PUSH_DELAY (20 s)
        before = [f['modifiedTime'] for f in FILES.values() if f['name'] == 'job.json']
        await phone.evaluate(edit('notes', 'Phone 3 (debounced)')); await phone.wait_for_timeout(23000)
        res['7_debounced'] = await phone.evaluate("async () => { const db = await import('/js/db.js'); const j = await db.get('jobs', 'job-s1'); return j.version === j.backedUpVersion; }")
        check(res['7_debounced'], 'debounced push did not happen')
        # Offline, then sign-in needed
        OFFLINE['on'] = True; await phone.evaluate(edit('notes', 'offline edit')); st = await phone.evaluate(SYNC); res['8_offline'] = st; OFFLINE['on'] = False
        check(st['state'] == 'offline', 'offline not shown')
        if SHOTS:
            await phone.evaluate("location.hash = '#/settings'"); await phone.wait_for_timeout(900)
            await phone.evaluate("document.getElementById('drive').scrollIntoView({ block: 'start' }); window.scrollBy(0, -80)"); await phone.wait_for_timeout(300)
            await phone.screenshot(path=os.path.join(SHOTS, 'v09-sync-04-settings-offline.png'))
        await phone.evaluate("() => localStorage.removeItem('sparky.gtoken')"); await phone.evaluate("() => localStorage.removeItem('sparky.ghint')")
        st = await phone.evaluate(SYNC); res['9_signin'] = st['state']; check(st['state'] == 'signin', 'sign-in state not shown')
        if SHOTS:
            await phone.wait_for_timeout(500); await phone.evaluate("document.getElementById('drive').scrollIntoView({ block: 'start' }); window.scrollBy(0, -80)"); await phone.wait_for_timeout(300)
            await phone.screenshot(path=os.path.join(SHOTS, 'v09-sync-05-settings-signin.png'))
        await phone.evaluate(f"() => {{ {TOKEN} }}"); st = await phone.evaluate(SYNC); res['10_back'] = st['state']; check(st['state'] == 'synced', 'did not recover after sign-in')
        if SHOTS:
            await phone.evaluate("location.hash = '#/settings'"); await phone.wait_for_timeout(800)
            await phone.evaluate("document.getElementById('drive').scrollIntoView({ block: 'start' }); window.scrollBy(0, -80)"); await phone.wait_for_timeout(300)
            await phone.screenshot(path=os.path.join(SHOTS, 'v09-sync-02-settings-synced.png'))
        res['errors'] = phone.errs + mac.errs; check(not res['errors'], 'page errors')
        await b.close()
    res['fails'] = fails
    print(json.dumps(res, indent=1, default=str)); sys.exit(1 if fails else 0)
asyncio.run(main())
