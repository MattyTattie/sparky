# tests/sync_v26.py [SHOTSDIR] — v0.26 on a fake Google Drive (tests/sync_mock.py; nothing goes
# to Google). FAKE data only. Server on :8765. Checks: details/logo/signature/instruments go
# phone → empty Mac (an empty device never wins), newest change wins back again, deleting a job
# bins its Drive folder and takes it off the other device, but a job changed there and not sent
# yet is kept; a glitch is never a delete; "Tap to sync" status. Prints JSON; exit 1 on failure.
import asyncio, sys, os, json, re, urllib.parse
from playwright.async_api import async_playwright
here = os.path.dirname(__file__)
mock = open(os.path.join(here, 'sync_mock.py')).read().split('async def main', 1)[0]
SHOTS = sys.argv[1] if len(sys.argv) > 1 else None
g = {'__name__': 'mock', 'sys': sys}; exec(mock, g)
ORIG = g['drive']; FILES = g['FILES']; FAIL500 = {'on': False}
def gone(f):  # trashed itself or inside a trashed folder
    seen = set()
    while f:
        if f.get('trashed'): return True
        p = (f.get('parents') or [None])[0]
        if p in seen: break
        seen.add(p); f = FILES.get(p)
    return False
async def drive(route):
    r = route.request; u = urllib.parse.urlparse(r.url); qs = urllib.parse.parse_qs(u.query)
    mm = re.search(r'/drive/v3/files/([^/]+)$', u.path)
    if mm and mm.group(1) in FILES:
        f = FILES[mm.group(1)]
        if FAIL500['on'] and r.method == 'GET' and qs.get('alt') != ['media']: return await route.fulfill(status=500, json={'error': {'message': 'mock glitch'}})
        if r.method == 'PATCH' and 'uploadType' not in r.url:
            body = json.loads(r.post_data or '{}')
            if 'trashed' in body: f['trashed'] = bool(body['trashed'])
            return await route.fulfill(json=f)
        if r.method == 'GET' and qs.get('alt') != ['media']: return await route.fulfill(json={**f, 'trashed': gone(f)})
    if u.path.endswith('/files') and r.method == 'GET':  # listing: hide things in binned folders
        saved = {k: v for k, v in FILES.items()}
        for k, v in list(FILES.items()):
            if gone(v): FILES[k] = {**v, 'trashed': True}
        try: return await ORIG(route)
        finally: FILES.clear(); FILES.update(saved)
    return await ORIG(route)
g['drive'] = drive

LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
SET = lambda k, v: f"async () => {{ const s = await import('/js/state.js'); await s.saveSetting({json.dumps(k)}, {json.dumps(v)}); }}"
META = "async () => { const db = await import('/js/db.js'); return { profile: await db.getMeta('profile'), mysig: await db.getMeta('mysig'), instruments: await db.getMeta('instruments') }; }"
SYNC = g['SYNC']; JOBS = g['JOBS']
NOGAP = "async () => { const db = await import('/js/db.js'); const c = await db.getMeta('sync.config'); c.lastGoneCheck = ''; await db.setMeta('sync.config', c); }"
def mkjob(i): return f"""async () => {{ const db = await import('/js/db.js'); const t = new Date().toISOString();
  await db.put('jobs', {{ id: 'job-d{i}', title: 'Fake job {i}', createdAt: t, updatedAt: t, version: 1, status: 'open' }});
  await db.put('certs', {{ id: 'cert-d{i}', jobId: 'job-d{i}', type: 'MW', number: 'MW-00{i}', createdAt: t, updatedAt: t, version: 1, boards: [], photoIds: [] }}); }}"""
async def main():
    res = {}; fails = []
    def check(c, msg):
        if not c: fails.append(msg)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        phone = await g['device'](b, 'phone', True); mac = await g['device'](b, 'mac', False)
        for pg in (phone, mac):
            await pg.evaluate(f"() => {{ {g['TOKEN']} }}")
            await pg.evaluate("async () => { const db = await import('/js/db.js'); await db.setMeta('sync.config', { enabled: true }); }")
        # 1. Phone has your details, logo, signature and instruments; the Mac has none (and blank details saved later).
        await phone.evaluate(SET('profile', {'name': 'Sam Sample', 'company': 'Fake Electrical Ltd', 'logo': LOGO}))
        await phone.evaluate(SET('mysig', LOGO))
        await phone.evaluate(SET('instruments', [{'id': 'i1', 'make': 'Megger', 'model': 'MFT1741+ (sample)', 'serial': '000123', 'kinds': ['multi', 'continuity', 'ir', 'efli', 'rcd'], 'inUse': True}]))
        await phone.evaluate(mkjob(1)); await phone.evaluate(mkjob(2))
        await phone.evaluate(SYNC)
        res['1_drive'] = sorted(f['name'] for f in FILES.values() if f['name'].endswith('.json'))
        check('settings.json' in res['1_drive'], 'no settings.json on Drive')
        await mac.evaluate(SET('profile', {}))  # newer stamp, but empty: must not win
        await mac.evaluate(SYNC); m = await mac.evaluate(META); res['2_mac'] = {k: bool(v) for k, v in m.items()}
        check(m['profile'] and m['profile'].get('logo') == LOGO and m['mysig'] == LOGO and m['instruments'] and m['instruments'][0]['serial'] == '000123', 'mac did not get details/logo/signature/instruments')
        check(len(await mac.evaluate(JOBS)) == 2, 'mac did not get the two jobs')
        # 2. Change on the Mac → phone (newest wins)
        await mac.wait_for_timeout(50)
        await mac.evaluate(SET('instruments', [{'id': 'i1', 'make': 'Megger', 'model': 'MFT1741+ (sample)', 'serial': '000123', 'kinds': ['multi'], 'inUse': True}, {'id': 'i2', 'make': 'Kewtech', 'model': 'KT (sample)', 'serial': 'K-42', 'kinds': ['rcd'], 'inUse': True}]))
        await mac.evaluate(SYNC); await phone.evaluate(SYNC); m = await phone.evaluate(META)
        res['3_phone_instruments'] = len(m['instruments'] or []); check(res['3_phone_instruments'] == 2, 'Mac instrument change did not reach the phone')
        check(m['profile'].get('name') == 'Sam Sample', 'phone details lost')
        # 3. A Drive glitch is never a delete
        jid = (await mac.evaluate("async () => (await (await import('/js/db.js')).get('jobs', 'job-d1'))"))['driveJsonId']
        FAIL500['on'] = True; await mac.evaluate(NOGAP); await mac.evaluate(SYNC); FAIL500['on'] = False
        check(len(await mac.evaluate(JOBS)) == 2, 'a Drive error deleted a job')
        # 4. Mac changes job 2 (not sent yet); phone deletes job 1 and job 2
        await mac.evaluate("async () => { const db = await import('/js/db.js'); const j = await db.get('jobs', 'job-d2'); j.notes = 'Mac edit, not sent'; j.updatedAt = new Date().toISOString(); j.version++; await db.put('jobs', j); }")
        await phone.evaluate("async () => { const db = await import('/js/db.js'); const { deleteJob } = await import('/js/jobdelete.js'); for (const id of ['job-d1', 'job-d2']) await deleteJob(await db.get('jobs', id)); }")
        await phone.evaluate(SYNC)
        folders = [f for f in FILES.values() if f['mimeType'] == 'application/vnd.google-apps.folder' and f['name'] != 'Sparky jobs']
        res['4_binned_folders'] = sum(1 for f in folders if f.get('trashed')); check(res['4_binned_folders'] == 2, 'job folders not binned on Drive')
        check(len(await phone.evaluate(JOBS)) == 0, 'phone still has deleted jobs')
        await mac.evaluate(NOGAP); await mac.evaluate(SYNC); mj = await mac.evaluate(JOBS); res['5_mac_jobs'] = mj
        check(len(mj) == 1 and mj[0]['id'] == 'job-d2' and mj[0]['notes'] == 'Mac edit, not sent', 'mac: deleted job not removed, or changed job not kept')
        res['5_mac_certs'] = await mac.evaluate("async () => (await (await import('/js/db.js')).all('certs')).map((c) => c.id)")
        check(res['5_mac_certs'] == ['cert-d2'], 'deleted job left its certificate behind')
        # the kept job goes up again as a new folder, and comes back to the phone
        await mac.evaluate(SYNC); await phone.evaluate(SYNC); pj = await phone.evaluate(JOBS)
        res['5b_phone'] = pj; res['5b_mac'] = await mac.evaluate("async () => { const db = await import('/js/db.js'); return [await db.get('jobs','job-d2'), await db.getMeta('sync.deleted')]; }"); res['5b_ph'] = await phone.evaluate("async () => { const db = await import('/js/db.js'); return [await db.getMeta('sync.deleted'), await db.getMeta('sync.config')]; }"); res['5b_files'] = [f for f in FILES.values() if f['name']=='job.json']
        check(len(pj) == 1 and pj[0]['notes'] == 'Mac edit, not sent', 'kept job did not go back up')
        # 5. Status: Google wants a renewal, account known → "Tap to sync"
        await phone.evaluate("() => { localStorage.removeItem('sparky.gtoken'); Object.defineProperty(navigator, 'userActivation', { value: { isActive: false, hasBeenActive: false }, configurable: true }); }")
        st = await phone.evaluate("async () => { const s = await import('/js/sync.js'); await s.syncNow(); return [s.getStatus(), s.statusText()]; }")
        res['6_status'] = st[1]; check(st[0]['state'] == 'signin' and st[1][0] == 'Tap to sync', 'renewal status wrong')
        if SHOTS:
            os.makedirs(SHOTS, exist_ok=True)
            await phone.evaluate("location.hash = '#/settings'"); await phone.wait_for_timeout(900)
            await phone.evaluate("document.getElementById('drive').scrollIntoView({ block: 'start' }); window.scrollBy(0, -80)"); await phone.wait_for_timeout(300)
            await phone.screenshot(path=os.path.join(SHOTS, 'v26-sync-tap-to-sync.png'))
            await phone.evaluate(f"() => {{ {g['TOKEN']} }}"); await phone.evaluate(SYNC)
            await phone.evaluate("location.hash = '#/'"); await phone.wait_for_timeout(200); await phone.evaluate("location.hash = '#/settings'"); await phone.wait_for_timeout(900)
            await phone.evaluate("document.getElementById('drive').scrollIntoView({ block: 'start' }); window.scrollBy(0, -80)"); await phone.wait_for_timeout(300)
            await phone.screenshot(path=os.path.join(SHOTS, 'v26-sync-synced.png'))
            await mac.evaluate("location.hash = '#/settings'"); await mac.wait_for_timeout(900); await mac.screenshot(path=os.path.join(SHOTS, 'v26-sync-mac-settings-arrived.png'))
        res['errors'] = phone.errs + mac.errs; check(not res['errors'], 'page errors')
        await b.close()
    res['fails'] = fails
    print(json.dumps(res, indent=1)); sys.exit(1 if fails else 0)
asyncio.run(main())
