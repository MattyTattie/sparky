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
import { planJob, needsPush, conflictCopy, newestTime } from './syncmerge.js';

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
  if (!G.isConfigured() || !c.enabled) return setStatus({ state: 'off' });
  setStatus({ state: navigator.onLine ? 'synced' : 'offline', last: c.lastSync || null });
  if (!started) {
    started = true;
    addEventListener('online', () => schedule(800));
    addEventListener('offline', () => setStatus({ state: 'offline', message: '' }));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(1500); else if (timer && pendingPush) syncNow(); });
    addEventListener('focus', () => schedule(1500));
    db.onPut.add(noteChange);
  }
  schedule(800);
  if (navigator.onLine) G.warmUp();
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
  } catch (e) { return setStatus({ state: 'signin', message: 'Sign in to Google again to keep syncing. Tap “Sign in to Google” in Settings, or the dot at the top.' }); }
  inCycle = true;
  try {
    await flush(); pendingPush = false;
    const r = await pull(c);
    try { await (await import('./certdelete.js')).flushTrash(); } catch {}
    let sent = 0;
    for (const j of await db.all('jobs')) if (needsPush(j)) { await backup.backupJob(j.id); sent++; }
    c.lastSync = new Date().toISOString(); await saveConfig(c);
    setStatus({ state: 'synced', message: '', last: c.lastSync, pulled: r.pulled, sent, conflicts: r.conflicts });
    if (r.pulled || r.conflicts) dispatchEvent(new CustomEvent('sparky:synced', { detail: r }));
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
  const out = { pulled: 0, conflicts: 0, jobIds: [] };
  for (const f of files) {
    let d; try { d = await G.readJSON(f.id); } catch { continue; }
    if (!d || d.app !== APP_SLUG || !d.job || !d.job.id) continue;
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
  return ({ off: ['Sync off', ''], signin: ['Sign in', 'amber'], syncing: ['Syncing…', 'info'], synced: [t ? 'Synced ' + t : 'Synced', 'green'], offline: ['Offline', 'amber'], error: ['Sync error', 'red'] })[s.state] || ['', ''];
}
