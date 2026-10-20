// =====================================================================
// certdelete.js — v0.17.1: deleting a certificate also deletes the PDFs
// made from it (this device, and the copies this app put in Drive, which go
// to Drive's bin). Sync is told so it doesn't bring them back.
// =====================================================================
import * as db from './db.js';
import * as G from './gdrive.js';
import { touchJob } from './state.js';
import { pdfsOfCert, DELETED, TRASH_QUEUE } from './pdflist.js';

export async function deleteCert(cert) {
  const files = cert.jobId ? pdfsOfCert(await db.byJob('files', cert.jobId), cert.id) : [];
  const at = new Date().toISOString();
  const del = (await db.getMeta(DELETED)) || { certs: {}, files: {} };
  del.certs = del.certs || {}; del.files = del.files || {};
  del.certs[cert.id] = at;
  const queue = (await db.getMeta(TRASH_QUEUE)) || [];
  for (const f of files) { del.files[f.id] = at; if (f.driveId) queue.push(f.driveId); await db.del('files', f.id); }
  await db.setMeta(DELETED, del); await db.setMeta(TRASH_QUEUE, queue);
  await db.del('certs', cert.id);
  if (cert.jobId) await touchJob(cert.jobId); // job.json goes up again without them
  flushTrash().catch(() => {});
  return files.length;
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
