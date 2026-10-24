// =====================================================================
// jobdelete.js — v0.26: delete a whole job. On this device it goes at
// once; its Drive folder goes to Drive's bin (kept 30 days) when there's
// signal (queued like deleted PDFs, see certdelete.js), and your other
// devices remove it on their next sync (sync.js, syncmerge.planGone).
// =====================================================================
import * as db from './db.js';
import { TRASH_QUEUE } from './pdflist.js';

const TOMBS = 'sync.deleted';
// Only this device: the job, its certificates and files, plus a note so sync won't bring it back.
export async function deleteJobHere(id) {
  for (const c of await db.byJob('certs', id)) await db.del('certs', c.id);
  for (const f of await db.byJob('files', id)) await db.del('files', f.id);
  await db.del('jobs', id);
  const t = (await db.getMeta(TOMBS)) || {}; t[id] = new Date().toISOString(); await db.setMeta(TOMBS, t);
}
export async function deleteJob(job) {
  await deleteJobHere(job.id);
  if (job.driveFolderId) {
    const q = (await db.getMeta(TRASH_QUEUE)) || [];
    if (!q.includes(job.driveFolderId)) q.push(job.driveFolderId);
    await db.setMeta(TRASH_QUEUE, q);
    import('./certdelete.js').then((m) => m.flushTrash()).catch(() => {});
  }
}
