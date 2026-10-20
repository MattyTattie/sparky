// =====================================================================
// pdflist.js — v0.17.1: saved PDFs. Pure helpers (tested) for which files
// belong to a certificate, and how the job page lists them.
// =====================================================================
export const isCertPdf = (f) => !!f && (f.kind === 'pdf' || f.kind === 'chart');
// The saved PDFs made from one certificate (cert PDF, charts, danger notices).
export const pdfsOfCert = (files, certId) => (files || []).filter((f) => isCertPdf(f) && f.certId === certId);
// Which document a PDF is: the certificate, its circuit chart, or one of its danger notices.
export const docKey = (f) => `${f.certId || f.id}|${f.kind}|${(/-DN\d+/.exec(f.name || '') || [''])[0]}`;
// Newest first; the newest PDF of each certificate is marked latest.
export function pdfRows(files) {
  const list = (files || []).filter(isCertPdf).slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const seen = new Set();
  return list.map((f) => { const key = docKey(f); const latest = !seen.has(key); seen.add(key); return { f, latest }; });
}
export const madeAt = (iso) => {
  if (!iso) return '';
  const d = new Date(iso); if (isNaN(d)) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};
// v0.17.1: what Sync must not bring back after a certificate is deleted.
export const DELETED = 'sync.deletedItems'; // { certs: { id: at }, files: { id: at } }
export const TRASH_QUEUE = 'sync.trashQueue'; // [driveId] still to move to the Drive bin
export function skipDeleted(d, del) {
  if (!del) return d;
  const c = del.certs || {}; const f = del.files || {};
  return { ...d, certs: (d.certs || []).filter((x) => !c[x.id]), files: (d.files || []).filter((x) => !f[x.id] && !(x.certId && c[x.certId])) };
}
// v0.17.2: saved PDFs whose certificate is gone from this device. Careful on purpose:
//  - only PDFs with a certId (no certId = leave it),
//  - only when this device has certificates at all (empty/unloaded DB = do nothing),
//  - only when the PDF's job is still here (a missing job may not be pulled yet),
//  - never for a certificate Drive still lists in that job (remoteCertIds, if known).
export function findOrphans(files, certs, jobs, { remoteCertIds = null } = {}) {
  const certIds = new Set((certs || []).map((c) => c.id));
  if (!certIds.size) return [];
  const jobIds = new Set((jobs || []).map((j) => j.id));
  return (files || []).filter((f) => isCertPdf(f) && f.certId && !certIds.has(f.certId) && f.jobId && jobIds.has(f.jobId) && !(remoteCertIds && remoteCertIds.has(f.certId)));
}
// When it's safe to look: sync off (this device is the only copy), or right after a sync
// that pulled cleanly and wasn't this device's first.
export const orphanCheckSafe = ({ syncOn, afterSync = false, pulledOk = false, firstSync = true }) => (!syncOn ? true : afterSync && pulledOk && !firstSync);
