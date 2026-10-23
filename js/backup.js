// =====================================================================
// backup.js — never lose a job: a backup file on the phone, and a copy of
// every job in its own Google Drive folder (optional).
// =====================================================================
import { serialPerKey } from './filerules.js';
import * as db from './db.js';
import * as G from './gdrive.js';
import { DRIVE_ROOT, APP_SLUG } from './config.js';
import { deviceLabel } from './syncmerge.js';
import * as presets from './presets.js';
import { skipDeleted, DELETED } from './pdflist.js';

const toB64 = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(blob); });
const fromB64 = async (u) => (await fetch(u)).blob();

// ---------- Whole-phone backup file ----------
export async function exportAll() {
  const out = { app: APP_SLUG, format: 1, exportedAt: new Date().toISOString(), jobs: await db.all('jobs'), customers: await db.all('customers'), certs: await db.all('certs'), files: [], meta: {} };
  for (const f of await db.all('files')) out.files.push({ ...f, blob: await toB64(f.blob) });
  for (const k of ['profile', 'instruments', 'settings', presets.KEY]) out.meta[k] = await db.getMeta(k); // v0.11: devicePresets (optional)
  return new Blob([JSON.stringify(out)], { type: 'application/json' });
}
// Restores without deleting anything: same id = replaced, newest wins.
export async function importAll(json) {
  const d = typeof json === 'string' ? JSON.parse(json) : json;
  if (!d || d.app !== APP_SLUG) throw new Error('That isn\u2019t a backup file from this app.');
  let n = 0;
  for (const s of ['customers', 'jobs', 'certs']) for (const v of d[s] || []) {
    const cur = await db.get(s, v.id);
    if (!cur || (v.updatedAt || '') >= (cur.updatedAt || '')) { await db.put(s, v); n++; }
  }
  for (const f of d.files || []) if (!(await db.get('files', f.id))) await db.put('files', { ...f, blob: await fromB64(f.blob) });
  for (const [k, v] of Object.entries(d.meta || {})) { if (k === presets.KEY) { if (v && v.list) await presets.mergeIn(v.list); continue; } if (v != null && (await db.getMeta(k)) == null) await db.setMeta(k, v); }
  return n;
}

// ---------- One Drive folder per job ----------
// Sparky jobs / <job folder> / job.json + photos + certificate PDFs
async function rootFolder() {
  let id = await db.getMeta('drive.root');
  if (id) { try { const m = await G.getMeta(id); if (!m.trashed) return id; } catch (e) { if (!(e instanceof G.NotFoundError)) throw e; } }
  const found = await G.list(`name = '${DRIVE_ROOT}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  id = found.length ? found[0].id : (await G.createFolder(DRIVE_ROOT)).id;
  await db.setMeta('drive.root', id); return id;
}
export const jobFolderName = (job, customer) => [job.createdAt ? job.createdAt.slice(0, 10) : '', customer && customer.name, (job.siteAddress || '').split(/[,\n]/)[0], job.title].filter(Boolean).join(' – ').replace(/[\\/]/g, '-').slice(0, 120);

// One backup per job at a time (see filerules.serialPerKey). Before this, two
// quick backups could both see "not uploaded yet" and both upload a file.
export const backupJob = serialPerKey((jobId, opts = {}) => backupJobNow(jobId, opts));
export const backupRunning = (jobId) => backupJob.isRunning(jobId);
async function backupJobNow(jobId, { onStep } = {}) {
  const job = await db.get('jobs', jobId); if (!job) return;
  const startVersion = job.version || 0; // v0.9: edits made while uploading stay "changed since"
  const customer = job.customerId ? await db.get('customers', job.customerId) : null;
  const certs = await db.byJob('certs', jobId);
  const files = await db.byJob('files', jobId);
  const root = await rootFolder();
  let folder = job.driveFolderId;
  if (folder) { try { const m = await G.getMeta(folder); if (m.trashed) folder = null; } catch (e) { if (e instanceof G.NotFoundError) folder = null; else throw e; } }
  if (!folder) { folder = (await G.createFolder(jobFolderName(job, customer), root)).id; job.driveFolderId = folder; }
  // Files (photos, PDFs) go up once each; PDFs are re-sent when remade.
  let i = 0;
  for (const f0 of files) {
    const f = (await db.get('files', f0.id)) || f0; files[i] = f;
    i++; if (onStep) onStep(`Uploading ${i} of ${files.length}`);
    if (f.driveId && f.driveVersion === (f.version || 1)) continue;
    const meta = f.driveId ? await G.writeBlob(f.driveId, f.blob, f.blob.type || 'application/octet-stream') : await G.uploadNewBlob(f.name || f.id, folder, f.blob, f.blob.type || 'application/octet-stream', { sparky: f.kind || 'file' });
    f.driveId = (meta && meta.id) || f.driveId; f.driveVersion = f.version || 1; await db.put('files', f);
  }
  // v0.9: device (optional) names who saved it, for conflict copies.
  const data = { app: APP_SLUG, format: 1, savedAt: new Date().toISOString(), device: deviceLabel(), devicePresets: await presets.load(), job, customer, certs, files: files.map(({ blob, ...rest }) => rest) };
  if (job.driveJsonId) { try { await G.writeJSON(job.driveJsonId, data); } catch (e) { if (e instanceof G.NotFoundError) job.driveJsonId = null; else throw e; } }
  if (!job.driveJsonId) job.driveJsonId = (await G.createJSON('job.json', folder, data)).id;
  // v0.9: re-read the job so a change made during the upload isn't overwritten.
  const now = (await db.get('jobs', jobId)) || job;
  Object.assign(now, { driveFolderId: job.driveFolderId, driveJsonId: job.driveJsonId, backedUpAt: new Date().toISOString(), backedUpVersion: startVersion, syncSavedAt: data.savedAt });
  await db.put('jobs', now);
  return now.backedUpAt;
}

// Jobs this app has saved to Drive (for a new phone). Reads each job.json.
export async function listDriveJobs() {
  const root = await rootFolder();
  const folders = await G.list(`'${root}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  return folders.map((f) => ({ id: f.id, name: f.name, modified: f.modifiedTime }));
}
export async function restoreDriveJob(folderId) {
  const files = await G.list(`'${folderId}' in parents and trashed = false`);
  const j = files.find((f) => f.name === 'job.json'); if (!j) throw new Error('No job.json data file in that Drive folder (the backup didn\u2019t finish). Back it up again on the other device.');
  const d = await G.readJSON(j.id);
  if (!d || d.app !== APP_SLUG || !d.job || !d.job.id) throw new Error('The job.json in that folder isn\u2019t a Zs Pro backup the app can read.');
  // Don't overwrite a newer copy of the job already on this device.
  await applyRemote(d, folderId, j.id, { onlyIfNewer: true });
  return d.job;
}
// Put a job.json from Drive into this device (restore and v0.9 sync).
// Customers and certificates are only replaced by newer ones; files are
// downloaded when missing or changed. Nothing on this device is deleted.
export async function applyRemote(d, folderId, jsonId, { onlyIfNewer = false, force = false } = {}) {
  d = skipDeleted(d, await db.getMeta(DELETED)); // v0.17.1: deleted certificates and their PDFs stay deleted
  if (Array.isArray(d.devicePresets)) await presets.mergeIn(d.devicePresets); // v0.11, optional
  if (d.customer && d.customer.id) { const c = await db.get('customers', d.customer.id); if (!c || (c.updatedAt || '') < (d.customer.updatedAt || '')) await db.put('customers', d.customer); }
  const curJob = await db.get('jobs', d.job.id);
  if (!onlyIfNewer || !curJob || (curJob.updatedAt || '') <= (d.job.updatedAt || '')) {
    const v = Math.max((curJob && curJob.version) || 0, d.job.version || 0);
    await db.put('jobs', { ...d.job, driveFolderId: folderId, driveJsonId: jsonId, version: v, backedUpVersion: v, backedUpAt: d.savedAt || d.job.backedUpAt || null, syncSavedAt: d.savedAt || null });
  }
  const changedCerts = [];
  for (const c of d.certs || []) { const cur = await db.get('certs', c.id); if (!cur || force || (cur.updatedAt || '') < (c.updatedAt || '')) { await db.put('certs', c); changedCerts.push(c.id); } }
  for (const f of d.files || []) {
    if (!f.driveId) continue;
    const cur = await db.get('files', f.id);
    if (cur && (cur.version || 1) >= (f.version || 1)) continue;
    try { await db.put('files', { ...f, blob: await G.readBlob(f.driveId) }); } catch {}
  }
  return { changedCerts };
}
