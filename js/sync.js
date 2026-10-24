// =====================================================================
// sync.js — v0.9: keep jobs the same on all your devices, through
// your own Google Drive (the same "Sparky jobs" folders the backup uses).
//  - Sign in once on each device (Settings → Google Drive).
//  - A change is sent up about 20 s after you stop typing.
//  - Opening the app, coming back to it, or signal coming back fetches
//    anything newer from the other device.
//  - Changed on both devices: the newest is kept and the other is saved
//    as a "conflict copy" job, so nothing is lost.
// Same pattern as Hearth's sync (status listeners, schedule, quiet sign-in).
// =====================================================================
import * as db from './db.js';
import * as G from './gdrive.js';
import * as backup from './backup.js';
import * as presets from './presets.js';
import { S, flush } from './state.js';
import { APP_SLUG } from './config.js';
import { planJob, needsPush, conflictCopy, newestTime, planGone, GONE_CHECK_EVERY, deviceLabel } from './syncmerge.js';
import { SETTINGS_KEYS, STAMPS, SETTINGS_FILE, mergeSettings } from './settingsync.js';

const CONF = 'sync.config'; // { enabled, lastPull, lastSync }
const TOMBS = 'sync.deleted'; // { jobId: deletedAt }
export const CONFLICTS = 'sync.conflicts'; // [{ id, title, copyId, at, seen }]
export const PUSH_DELAY = 20_000;

// ---------- status ----------
// state: 'off' | 'signin' | 'syncing' | 'synced' | 'offline' | 'error'
let status = { state: 'off', message: '', last: null };
const listeners = new Set();
export function onStatus(fn) { listeners.add(fn); fn(status); return () => listeners.delete(fn); }
export const getStatus = () => status;
function setStatus(p) { status = { ...status, ...p }; listeners.forEach((fn) => { try { fn(status); } catch {} }); }
export const getConfig = async () => (await db.getMeta(CONF)) || { enabled: false };
const saveConfig = (c) => db.setMeta(CONF, c);

let started = false; let timer = null; let running = null; let again = false;
export async function init() {
  const c = await getConfig();
  if (!G.isConfigured() || !c.enabled) { tidyLocal(); return setStatus({ state: 'off' }); }
  setStatus({ state: navigator.onLine ? 'synced' : 'offline', last: c.lastSync || null });
  if (!started) {
    started = true;
    addEventListener('online', () => schedule(800));
    addEventListener('offline', () => setStatus({ state: 'offline', message: '' }));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { quietRefresh('visible'); schedule(1500); } else if (timer && pendingPush) syncNow(); });
    addEventListener('focus', () => { quietRefresh('focus'); schedule(1500); });
    db.onPut.add(noteChange);
    addEventListener('sparky:settingschange', () => { if (!inCycle) { pendingPush = true; schedule(PUSH_DELAY); } }); // v0.26
    // v0.25 (as Hearth): quiet Google token refresh on your next tap.
    document.addEventListener('click', refreshOnTap, true);
    // v0.26: a check-in every few minutes while the app is open on screen.
    setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine && !running && !timer) { quietRefresh('tick'); schedule(500); } }, POLL_EVERY);
  }
  if (navigator.onLine) G.warmUp();
  schedule(800); quietRefresh('open'); // v0.26: renew the sign-in straight away on open (doesn't hold the sync up)
}
import { POLL_EVERY } from './syncmerge.js';
export { POLL_EVERY };
// v0.26: renew Google's sign-in quietly as soon as the app opens or comes back
// on screen (not only on your next tap), when it's run out or nearly has.
let lastAutoRefresh = 0; let autoBlocked = false;
export async function quietRefresh(why = '') {
  try {
    if (G.tokenLeft() > REFRESH_EARLY) return false;
    // Some browsers won't let Google's quiet sign-in run without a tap. If it was
    // blocked once, leave it to your next tap (refreshOnTap) for the rest of this visit.
    if (autoBlocked && !(navigator.userActivation && navigator.userActivation.isActive)) return false;
    const c = await getConfig().catch(() => ({}));
    const hint = G.accountHint() || (c.account && c.account.email) || '';
    if (!wantsQuietRefresh({ online: navigator.onLine, tokenLeft: G.tokenLeft(), hint, enabled: c.enabled, configured: G.isConfigured(), sinceLast: Date.now() - lastAutoRefresh })) return false;
    lastAutoRefresh = Date.now();
    await G.refreshSilently(hint);
    if (status.state === 'signin' || status.state === 'error') { setStatus({ state: 'syncing', message: '', resumable: false }); schedule(300); }
    return true;
  } catch (err) { if (err instanceof G.PopupBlockedError) autoBlocked = true; console.info('sync: quiet sign-in (' + why + ') did not work', err && err.message); return false; }
}
// v0.25: Google only gives about an hour's access at a time. When the token
// has run out (or will within 10 minutes) and we know your account, the next
// ordinary tap fetches a new one quietly, then sync carries on. If that
// doesn't work, the usual gentle "Sign in to Google" prompt stays.
import { REFRESH_EARLY, wantsQuietRefresh } from './syncmerge.js';
export { REFRESH_EARLY, wantsQuietRefresh };
const SYNC_BUTTONS = '#syncchip, #sync-signin, #sync-now, #sync-connect';
let lastTapRefresh = 0;
async function refreshOnTap(ev) {
  if (ev.target && ev.target.closest && ev.target.closest(SYNC_BUTTONS)) return;
  if (G.tokenLeft() > REFRESH_EARLY) return;
  const c = await getConfig().catch(() => ({}));
  const hint = G.accountHint() || (c.account && c.account.email) || '';
  if (!wantsQuietRefresh({ online: navigator.onLine, tokenLeft: G.tokenLeft(), hint, enabled: c.enabled, configured: G.isConfigured(), sinceLast: Date.now() - lastTapRefresh })) return;
  lastTapRefresh = Date.now();
  try {
    await G.refreshSilently(hint);
    if (status.state === 'signin' || status.state === 'error') { setStatus({ state: 'syncing', message: '' }); schedule(300); }
  } catch (err) { console.info('sync: quiet sign-in did not work', err && err.message); }
}
let pendingPush = false;
// Any saved job / certificate / photo: send it up after a pause.
function noteChange(store) {
  if (!['jobs', 'certs', 'files', 'customers'].includes(store) || inCycle) return;
  pendingPush = true; schedule(PUSH_DELAY);
}
function schedule(ms) { clearTimeout(timer); timer = setTimeout(() => { timer = null; syncNow().catch(() => {}); }, ms); }

// Switch on from Settings (inside the tap, so Google's window can open).
export async function connect() {
  await G.getToken({ interactive: true, email: G.accountHint(), choose: !G.accountHint() });
  try { const me = await G.whoAmI(); G.rememberAccount(me && me.emailAddress); } catch {}
  const c = await getConfig(); c.enabled = true; await saveConfig(c);
  await init(); return syncNow({ interactive: true });
}
export async function disconnect() { const c = await getConfig(); c.enabled = false; await saveConfig(c); clearTimeout(timer); setStatus({ state: 'off', message: '' }); }
export async function recordDelete(jobId) { const t = (await db.getMeta(TOMBS)) || {}; t[jobId] = new Date().toISOString(); await db.setMeta(TOMBS, t); }

// v0.17.2: sync off, so this device is the only copy: tidy orphan PDFs once at start.
let tidied = false;
function tidyLocal() { if (tidied) return; tidied = true; import('./certdelete.js').then((m) => m.cleanOrphans({ syncOn: false })).then((n) => { if (n) dispatchEvent(new CustomEvent('sparky:synced', { detail: { orphans: n } })); }).catch(() => {}); }
// One sync at a time; a change during a sync means one more round after.
export function syncNow({ interactive = false } = {}) {
  if (running) { again = true; return running; }
  running = (async () => { try { do { again = false; await cycle(interactive); } while (again); } finally { running = null; } })();
  return running;
}
let inCycle = false;
async function cycle(interactive) {
  const c = await getConfig(); if (!c.enabled || !G.isConfigured()) return;
  if (!navigator.onLine) return setStatus({ state: 'offline', message: '' });
  setStatus({ state: 'syncing', message: '' });
  try {
    await G.getToken({ interactive });
  } catch (e) { const known = Boolean(G.accountHint()); return setStatus({ state: 'signin', resumable: known, message: known ? 'Google needs a quick check that it\u2019s still you. It happens by itself on your next tap; nothing to do.' : 'Sign in to Google again to keep syncing. Tap “Sign in to Google” in Settings, or the dot at the top.' }); }
  inCycle = true;
  try {
    await flush(); pendingPush = false;
    const firstSync = !c.lastPull; // v0.17.2: no orphan tidy on a device's first sync
    const r = await pull(c);
    try { await (await import('./certdelete.js')).flushTrash(); } catch {}
    try { r.gone = await checkGone(c); } catch (e) { console.info('sync: gone check skipped', e && e.message); } // v0.26
    try { r.settings = await syncSettings(); } catch (e) { if (e instanceof G.AuthError || e instanceof G.OfflineError) throw e; console.info('sync: settings not synced', e && e.message); } // v0.26
    let sent = 0;
    for (const j of await db.all('jobs')) if (needsPush(j)) { await backup.backupJob(j.id); sent++; }
    c.lastSync = new Date().toISOString(); await saveConfig(c);
    try { const { cleanOrphans } = await import('./certdelete.js'); const n = await cleanOrphans({ syncOn: true, afterSync: true, pulledOk: !r.incomplete, firstSync, remoteCertIds: r.remoteCertIds }); if (n) dispatchEvent(new CustomEvent('sparky:synced', { detail: { orphans: n } })); } catch {}
    setStatus({ state: 'synced', message: '', last: c.lastSync, pulled: r.pulled, sent, conflicts: r.conflicts });
    if (r.pulled || r.conflicts || r.gone || r.settings) dispatchEvent(new CustomEvent('sparky:synced', { detail: r }));
  } catch (e) {
    const off = e instanceof G.OfflineError || !navigator.onLine;
    const auth = e instanceof G.AuthError;
    setStatus({ state: off ? 'offline' : auth ? 'signin' : 'error', message: off ? 'No signal. Changes are safe on this device and will go up when you\u2019re back online.' : auth ? 'Sign in to Google again to keep syncing. Tap “Sign in to Google” in Settings, or the dot at the top.' : 'Sync didn\u2019t work: ' + ((e && e.message) || e) + '. Your jobs are safe on this device; it will try again.' });
  } finally { inCycle = false; }
  // edits made while syncing go up in the next round
  try { if ((await db.all('jobs')).some(needsPush)) { pendingPush = true; schedule(PUSH_DELAY); } } catch {}
}

// Fetch newer job.json files from Drive and merge them in.
export async function pull(c = null) {
  c = c || await getConfig();
  const q = `name = 'job.json' and trashed = false and mimeType = 'application/json'` + (c.lastPull ? ` and modifiedTime > '${c.lastPull}'` : '');
  const files = await G.list(q);
  const tombs = (await db.getMeta(TOMBS)) || {};
  const out = { pulled: 0, conflicts: 0, jobIds: [], remoteCertIds: new Set(), incomplete: false };
  for (const f of files) {
    let d; try { d = await G.readJSON(f.id); } catch { out.incomplete = true; continue; }
    if (!d || d.app !== APP_SLUG || !d.job || !d.job.id) continue;
    for (const rc of d.certs || []) if (rc && rc.id) out.remoteCertIds.add(rc.id); // v0.17.2: never treat these as orphans
    if (Array.isArray(d.devicePresets)) { try { await presets.mergeIn(d.devicePresets); } catch {} } // v0.11
    const local = await db.get('jobs', d.job.id);
    const plan = planJob(local, d, { deletedAt: tombs[d.job.id] || '' });
    const folder = (f.parents || [])[0] || d.job.driveFolderId;
    if (plan === 'pull') { await take(d, folder, f.id); out.pulled++; out.jobIds.push(d.job.id); }
    else if (plan === 'conflict-remote') { // Drive's is newer: keep this device's as a copy first
      await saveCopy({ job: local, certs: await db.byJob('certs', local.id), files: await db.byJob('files', local.id) }, 'this device');
      await take(d, folder, f.id, true); out.pulled++; out.conflicts++; out.jobIds.push(d.job.id);
    } else if (plan === 'conflict-local') { // this device's is newer: keep Drive's as a copy
      const remoteFiles = [];
      for (const m of d.files || []) { const here = await db.get('files', m.id); let blob = here && here.blob; if (!blob && m.driveId) { try { blob = await G.readBlob(m.driveId); } catch {} } if (blob) remoteFiles.push({ ...m, blob }); }
      await saveCopy({ job: d.job, certs: d.certs || [], files: remoteFiles }, 'another device');
      const j = await db.get('jobs', local.id); j.syncSavedAt = d.savedAt; j.driveJsonId = f.id; await db.put('jobs', j); // so the next push replaces Drive's copy
      out.conflicts++;
    }
  }
  c.lastPull = newestTime(files, c.lastPull || ''); await saveConfig(c);
  return out;
}
// v0.26: jobs deleted on another device. Their Drive folder (and so job.json)
// is in the bin or gone. Only a clear "binned" or "not found" counts; any
// other error or no signal is left alone. A job changed here and not sent yet
// is kept (and sent up again as a new folder), never deleted.
async function checkGone(c) {
  const now = Date.now();
  if (c.lastGoneCheck && now - Date.parse(c.lastGoneCheck) < GONE_CHECK_EVERY) return 0;
  let n = 0;
  for (const j of await db.all('jobs')) {
    if (!j.driveFolderId || !j.driveJsonId) continue;
    let remote = 'ok';
    try { const m = await G.getMeta(j.driveJsonId); remote = m && m.trashed ? 'trashed' : 'ok'; }
    catch (e) { if (e instanceof G.NotFoundError) remote = 'missing'; else if (e instanceof G.AuthError || e instanceof G.OfflineError) throw e; else remote = 'error'; }
    const now2 = await db.get('jobs', j.id); // re-read: you may have changed it meanwhile
    const plan = planGone(now2, remote);
    if (plan === 'delete') { await (await import('./jobdelete.js')).deleteJobHere(j.id); n++; }
    else if (plan === 'keep-unsynced') { now2.driveFolderId = null; now2.driveJsonId = null; now2.updatedAt = new Date().toISOString(); now2.version = (now2.version || 0) + 1; await db.put('jobs', now2); } // newer than the delete, so it comes back on the other devices too
  }
  c.lastGoneCheck = new Date().toISOString(); await saveConfig(c);
  return n;
}
// v0.26: your details, signature and instruments (see settingsync.js).
async function syncSettings() {
  const root = await backup.rootFolder();
  let id = await db.getMeta('drive.settingsJson'); let remote = null;
  if (id) { try { const m = await G.getMeta(id); if (m.trashed) id = null; else remote = await G.readJSON(id); } catch (e) { if (e instanceof G.NotFoundError) id = null; else throw e; } }
  if (!id) { const f = await G.list(`name = '${SETTINGS_FILE}' and '${root}' in parents and trashed = false`); if (f.length) { id = f[0].id; remote = await G.readJSON(id); } }
  if (remote && (remote.app !== APP_SLUG || remote.kind !== 'settings')) remote = null;
  const values = {}; for (const k of SETTINGS_KEYS) values[k] = await db.getMeta(k);
  const r = mergeSettings({ values, stamps: (await db.getMeta(STAMPS)) || {} }, remote);
  const took = Object.keys(r.take);
  for (const k of took) await db.setMeta(k, r.take[k]);
  await db.setMeta(STAMPS, r.stamps);
  if (r.push) {
    const doc = { app: APP_SLUG, kind: 'settings', format: 1, savedAt: new Date().toISOString(), device: deviceLabel(), values: r.values, stamps: r.stamps };
    if (id) await G.writeJSON(id, doc); else id = (await G.createJSON(SETTINGS_FILE, root, doc)).id;
  }
  if (id) await db.setMeta('drive.settingsJson', id);
  if (took.length) dispatchEvent(new CustomEvent('sparky:settings', { detail: { took } }));
  return took.length;
}
async function take(d, folder, jsonId, force = false) {
  const { changedCerts } = await backup.applyRemote(d, folder, jsonId, { onlyIfNewer: false, force });
  // The certificate open on screen: show Drive's version (it wasn't changed here).
  if (S.cert && changedCerts.includes(S.cert.id) && !S.dirty) Object.assign(S.cert, await db.get('certs', S.cert.id));
}
async function saveCopy(src, label) {
  const cp = conflictCopy(src, { newId: db.newId, label });
  for (const c of cp.certs) await db.put('certs', c);
  for (const f of cp.files) if (f.blob) await db.put('files', f);
  await db.put('jobs', cp.job);
  const list = (await db.getMeta(CONFLICTS)) || [];
  list.push({ id: src.job.id, title: src.job.title || 'Job', copyId: cp.job.id, copyTitle: cp.job.title, at: new Date().toISOString(), seen: false });
  await db.setMeta(CONFLICTS, list.slice(-20));
}
export const conflictsToShow = async () => ((await db.getMeta(CONFLICTS)) || []).filter((x) => !x.seen);
export async function dismissConflicts() { const l = (await db.getMeta(CONFLICTS)) || []; l.forEach((x) => (x.seen = true)); await db.setMeta(CONFLICTS, l); }

// For the screen: a short word and colour for each state.
export function statusText(s = status) {
  const t = s.last ? new Date(s.last).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
  return ({ off: ['Sync off', ''], signin: s.resumable ? ['Tap to sync', 'info'] : ['Sign in', 'amber'], syncing: ['Syncing…', 'info'], synced: [t ? 'Synced ' + t : 'Synced', 'green'], offline: ['Offline', 'amber'], error: ['Sync error', 'red'] })[s.state] || ['', ''];
}
