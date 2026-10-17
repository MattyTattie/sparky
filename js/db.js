// =====================================================================
// db.js — everything is saved on the phone first, in IndexedDB.
// =====================================================================
// Stores: jobs, customers, certs, files (photos, logo, PDFs as Blobs), meta.
// Every change is written straight away (autosave): nothing waits for a
// Save button, so closing the app or losing signal never loses a reading.
// NEVER rename DB_NAME or the stores (old data would vanish from view).
const DB_NAME = 'sparky-certs';
const DB_VERSION = 1;
export const STORES = ['jobs', 'customers', 'certs', 'files', 'meta'];
let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const s of ['jobs', 'customers', 'certs', 'files']) if (!db.objectStoreNames.contains(s)) {
        const st = db.createObjectStore(s, { keyPath: 'id' });
        if (s === 'certs' || s === 'files') st.createIndex('jobId', 'jobId');
      }
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode); const s = t.objectStore(store);
    let out; const q = fn(s); if (q) q.onsuccess = () => (out = q.result);
    t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('aborted'));
  });
}
export const all = (s) => tx(s, 'readonly', (st) => st.getAll());
export const get = (s, id) => tx(s, 'readonly', (st) => st.get(id));
export const put = (s, v) => tx(s, 'readwrite', (st) => st.put(v));
export const del = (s, id) => tx(s, 'readwrite', (st) => st.delete(id));
export const byJob = (s, jobId) => tx(s, 'readonly', (st) => st.index('jobId').getAll(jobId));
export const getMeta = (k) => tx('meta', 'readonly', (st) => st.get(k));
export const setMeta = (k, v) => tx('meta', 'readwrite', (st) => st.put(v, k));
export function newId() { return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
export async function persist() { try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch {} return false; }
// Next certificate number, e.g. EIC-0007 (counter per type, kept on the phone).
export async function nextNumber(prefix) {
  const k = 'counter.' + prefix; const n = ((await getMeta(k)) || 0) + 1; await setMeta(k, n);
  return `${prefix}-${String(n).padStart(4, '0')}`;
}
