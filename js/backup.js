// =====================================================================
// backup.js — never lose a job: a backup file on the phone, and a copy of
// every job in its own Google Drive folder (optional).
// =====================================================================
import * as db from './db.js';
import * as G from './gdrive.js';
import { DRIVE_ROOT, APP_SLUG } from './config.js';

const toB64 = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(blob); });
const fromB64 = async (u) => (await fetch(u)).blob();

// ---------- Whole-phone backup file ----------
export async function exportAll() {
  const out = { app: APP_SLUG, format: 1, exportedAt: new Date().toISOString(), jobs: await db.all('jobs'), customers: await db.all('customers'), certs: await db.all('certs'), files: [], meta: {} };
  for (const f of await db.all('files')) out.files.push({ ...f, blob: await toB64(f.blob) });
  for (const k of ['profile', 'instruments', 'settings']) out.meta[k] = await db.getMeta(k);
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
  for (const [k, v] of Object.entries(d.meta || {})) if (v != null && (await db.getMeta(k)) == null) await db.setMeta(k, v);
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

export async function backupJob(jobId, { onStep } = {}) {
  const job = await db.get('jobs', jobId); if (!job) return;
  const customer = job.customerId ? await db.get('customers', job.customerId) : null;
  const certs = await db.byJob('certs', jobId);
  const files = await db.byJob('files', jobId);
  const root = await rootFolder();
  let folder = job.driveFolderId;
  if (folder) { try { const m = await G.getMeta(folder); if (m.trashed) folder = null; } catch (e) { if (e instanceof G.NotFoundError) folder = null; else throw e; } }
  if (!folder) { folder = (await G.createFolder(jobFolderName(job, customer), root)).id; job.driveFolderId = folder; }
  // Files (photos, PDFs) go up once each; PDFs are re-sent when remade.
  let i = 0;
  for (const f of files) {
    i++; if (onStep) onStep(`Uploading ${i} of ${files.length}`);
    if (f.driveId && f.driveVersion === (f.version || 1)) continue;
    const meta = f.driveId ? await G.writeBlob(f.driveId, f.blob, f.blob.type || 'application/octet-stream') : await G.uploadNewBlob(f.name || f.id, folder, f.blob, f.blob.type || 'application/octet-stream', { sparky: f.kind || 'file' });
    f.driveId = (meta && meta.id) || f.driveId; f.driveVersion = f.version || 1; await db.put('files', f);
  }
  const data = { app: APP_SLUG, format: 1, savedAt: new Date().toISOString(), job, customer, certs, files: files.map(({ blob, ...rest }) => rest) };
  if (job.driveJsonId) { try { await G.writeJSON(job.driveJsonId, data); } catch (e) { if (e instanceof G.NotFoundError) job.driveJsonId = null; else throw e; } }
  if (!job.driveJsonId) job.driveJsonId = (await G.createJSON('job.json', folder, data)).id;
  job.backedUpAt = new Date().toISOString(); job.backedUpVersion = job.version || 0;
  await db.put('jobs', job);
  return job.backedUpAt;
}

// Jobs this app has saved to Drive (for a new phone). Reads each job.json.
export async function listDriveJobs() {
  const root = await rootFolder();
  const folders = await G.list(`'${root}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  return folders.map((f) => ({ id: f.id, name: f.name, modified: f.modifiedTime }));
}
export async function restoreDriveJob(folderId) {
  const files = await G.list(`'${folderId}' in parents and trashed = false`);
  const j = files.find((f) => f.name === 'job.json'); if (!j) throw new Error('No job.json in that folder');
  const d = await G.readJSON(j.id);
  if (d.customer) { const c = await db.get('customers', d.customer.id); if (!c) await db.put('customers', d.customer); }
  await db.put('jobs', { ...d.job, driveFolderId: folderId, driveJsonId: j.id });
  for (const c of d.certs || []) { const cur = await db.get('certs', c.id); if (!cur || cur.updatedAt <= c.updatedAt) await db.put('certs', c); }
  for (const f of d.files || []) if (f.driveId && !(await db.get('files', f.id))) { try { await db.put('files', { ...f, blob: await G.readBlob(f.driveId) }); } catch {} }
  return d.job;
}
