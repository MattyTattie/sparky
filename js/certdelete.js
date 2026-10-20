// =====================================================================
// certdelete.js — v0.17.1: deleting a certificate also deletes the PDFs
// made from it (this device, and the copies this app put in Drive, which go
// to Drive's bin). Sync is told so it doesn't bring them back.
// =====================================================================
import * as db from './db.js';
import * as G from './gdrive.js';
import { touchJob } from './state.js';
import { pdfsOfCert, DELETED, TRASH_QUEUE, findOrphans, orphanCheckSafe } from './pdflist.js';

export async function deleteCert(cert) {
  const files = cert.jobId ? pdfsOfCert(await db.byJob('files', cert.jobId), cert.id) : [];
  await db.del('certs', cert.id);
  await removePdfs(files, [cert.id]);
  if (cert.jobId) await touchJob(cert.jobId); // job.json goes up again without them
  return files.length;
}
// Delete saved PDFs (this device + Drive copies to the bin) and tell Sync not to bring them back.
async function removePdfs(files, certIds = []) {
  const at = new Date().toISOString();
  const del = (await db.getMeta(DELETED)) || { certs: {}, files: {} };
  del.certs = del.certs || {}; del.files = del.files || {};
  for (const id of certIds) del.certs[id] = at;
  const queue = (await db.getMeta(TRASH_QUEUE)) || [];
  for (const f of files) { del.files[f.id] = at; if (f.driveId) queue.push(f.driveId); await db.del('files', f.id); }
  await db.setMeta(DELETED, del); await db.setMeta(TRASH_QUEUE, queue);
  flushTrash().catch(() => {});
}
// v0.17.2: tidy saved PDFs left behind by certificates deleted before v0.17.1 (orphans).
// Only when it's safe (see orphanCheckSafe / findOrphans). Returns how many went.
export async function cleanOrphans(when) {
  if (!orphanCheckSafe(when)) return 0;
  const [files, certs, jobs] = await Promise.all([db.all('files'), db.all('certs'), db.all('jobs')]);
  const orphans = findOrphans(files, certs, jobs, { remoteCertIds: when.remoteCertIds || null });
  if (!orphans.length) return 0;
  await removePdfs(orphans);
  for (const j of new Set(orphans.map((f) => f.jobId))) await touchJob(j);
  return orphans.length;
}
// Move queued Drive copies to the bin (when signed in; otherwise next sync).
export async function flushTrash() {
  const queue = (await db.getMeta(TRASH_QUEUE)) || [];
  if (!queue.length || !G.isConfigured() || !G.hasToken() || !navigator.onLine) return 0;
  const left = [];
  for (const id of queue) { try { await G.trash(id); } catch (e) { if (!(e instanceof G.NotFoundError)) left.push(id); } }
  await db.setMeta(TRASH_QUEUE, left);
  return queue.length - left.length;
}
