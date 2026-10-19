// =====================================================================
// syncmerge.js — v0.9 automatic sync between devices: the decisions only
// (no Drive, no database), so they can be tested on their own.
// Each job is one job.json in Drive (written by backup.js). A device
// remembers, per job, the savedAt of the job.json it last sent or took in
// (job.syncSavedAt, optional) and whether it has changed the job since
// (job.version > job.backedUpVersion).
// =====================================================================

// What to do with one job.json from Drive.
//   'pull'  take Drive's copy (it's new here, or only Drive changed)
//   'keep'  nothing to take (this device's copy is the same or only this device changed)
//   'skip'  deleted on this device, and not changed in Drive since
//   'conflict-remote' both changed, Drive's is newer: take it, keep this device's as a conflict copy
//   'conflict-local'  both changed, this device's is newer: keep it, save Drive's as a conflict copy
export function planJob(local, remote, { deletedAt = '' } = {}) {
  const rj = remote && remote.job; if (!rj || !rj.id) return 'skip';
  const rUpd = rj.updatedAt || '', rSaved = remote.savedAt || '';
  if (!local) return deletedAt && rUpd <= deletedAt ? 'skip' : 'pull';
  const base = local.syncSavedAt || '';
  const remoteChanged = rSaved > base && rUpd !== (local.updatedAt || '');
  const localChanged = (local.version || 0) > (local.backedUpVersion || 0);
  if (!remoteChanged) return 'keep';
  if (!localChanged) return 'pull';
  return rUpd > (local.updatedAt || '') ? 'conflict-remote' : 'conflict-local';
}

// Jobs this device should send up: changed since they were last sent.
export const needsPush = (job) => Boolean(job) && (job.version || 0) > (job.backedUpVersion || 0);

// A copy of a whole job (job + certificates + files) under new ids, so the
// losing side of a conflict is kept, never thrown away.
export function conflictCopy({ job, certs = [], files = [] }, { newId, label = 'other device', when = new Date() } = {}) {
  const ids = new Map(); const nid = (old) => { if (!ids.has(old)) ids.set(old, newId()); return ids.get(old); };
  const stamp = when.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const jid = newId(); const now = when.toISOString();
  const strip = { driveFolderId: null, driveJsonId: null, backedUpAt: null, backedUpVersion: 0, syncSavedAt: null };
  const nj = { ...job, ...strip, id: jid, title: `${job.title || 'Job'} (conflict copy from ${label}, ${stamp})`, conflictOf: job.id, conflictAt: now, updatedAt: now, version: 1 };
  const nc = certs.map((c) => ({ ...c, id: nid(c.id), jobId: jid }));
  const nf = files.map((f) => ({ ...f, id: newId(), jobId: jid, certId: f.certId ? nid(f.certId) : f.certId, driveId: null, driveVersion: null }));
  for (const c of nc) c.photoIds = (c.photoIds || []).map((p) => { const i = files.findIndex((f) => f.id === p); return i >= 0 ? nf[i].id : p; });
  return { job: nj, certs: nc, files: nf };
}

// The device name used in a conflict copy's title.
export const deviceLabel = (ua = (globalThis.navigator && navigator.userAgent) || '') => (/Android/i.test(ua) ? 'phone' : /iPhone|iPad/i.test(ua) ? 'iPhone' : /Macintosh|Mac OS/i.test(ua) ? 'Mac' : /Windows/i.test(ua) ? 'PC' : 'other device');

// Newest modifiedTime seen, so the next pull only asks Drive for newer job.json files.
export const newestTime = (files, prev = '') => files.reduce((m, f) => (f.modifiedTime && f.modifiedTime > m ? f.modifiedTime : m), prev);
