// =====================================================================
// state.js — the job/certificate being worked on, and autosave.
// Every keypress is saved to the phone within half a second, and at once
// when the app is hidden (screen off, switching apps).
// =====================================================================
import * as db from './db.js';
import { debounce } from './ui.js';
import { calibrationState } from './checks.js';

export const S = { cert: null, job: null, dirty: false, onSaved: null };
const now = () => new Date().toISOString();

async function writeCert() {
  if (!S.cert || !S.dirty) return;
  S.dirty = false;
  try { localStorage.removeItem(PENDING); } catch {}
  S.cert.updatedAt = now(); S.cert.version = (S.cert.version || 0) + 1;
  await db.put('certs', S.cert);
  if (S.cert.jobId) await touchJob(S.cert.jobId);
  if (S.onSaved) S.onSaved();
}
const saveSoon = debounce(() => { writeCert().catch((e) => console.error(e)); }, 300);
export function changed() { S.dirty = true; saveSoon(); }
export async function flush() { saveSoon.flush(); await writeCert(); }
// Belt and braces: if the app is closed in the half-second before a save,
// the unsaved certificate is also written (synchronously) to localStorage,
// and put back into the database next time the app opens.
const PENDING = 'sparky.pending';
function stash() { if (S.cert && S.dirty) { try { localStorage.setItem(PENDING, JSON.stringify({ ...S.cert, updatedAt: now() })); } catch {} } }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { stash(); flush(); } });
window.addEventListener('pagehide', () => { stash(); flush(); });
export async function recoverPending() {
  let p = null; try { p = JSON.parse(localStorage.getItem(PENDING) || 'null'); } catch {}
  if (p && p.id) { const cur = await db.get('certs', p.id); if (!cur || (cur.updatedAt || '') < p.updatedAt) { p.version = ((cur && cur.version) || 0) + 1; await db.put('certs', p); if (p.jobId) await touchJob(p.jobId); } }
  try { localStorage.removeItem(PENDING); } catch {}
}

export async function touchJob(jobId) {
  const j = await db.get('jobs', jobId); if (!j) return;
  j.updatedAt = now(); j.version = (j.version || 0) + 1; await db.put('jobs', j);
}
export async function openCert(id) {
  if (S.cert && S.cert.id === id) return S.cert;
  await flush(); S.cert = (await db.get('certs', id)) || null; return S.cert;
}

// ---------- Your details and instruments ----------
export const getProfile = async () => (await db.getMeta('profile')) || {};
export const getInstruments = async () => (await db.getMeta('instruments')) || [];
export const INSTRUMENT_KINDS = [
  ['multi', 'Multifunction tester'], ['continuity', 'Continuity'], ['ir', 'Insulation resistance'],
  ['efli', 'Earth fault loop impedance'], ['rcd', 'RCD tester'], ['electrode', 'Earth electrode resistance'],
];
export const instrumentText = (i) => [i.make, i.model, i.serial ? 's/n ' + i.serial : ''].filter(Boolean).join(' ');
// The instruments box on certificates, from your default kit.
export async function defaultInstruments() {
  const out = {};
  for (const i of await getInstruments()) if (i.inUse !== false) for (const k of i.kinds || []) if (!out[k]) out[k] = instrumentText(i);
  return out;
}
export async function calibrationWarnings() {
  const list = [];
  for (const i of await getInstruments()) {
    if (i.inUse === false) continue;
    const st = calibrationState(i.calDue);
    if (st === 'out') list.push({ level: 'red', text: `${instrumentText(i) || 'Test instrument'}: calibration ran out on ${i.calDue.split('-').reverse().join('/')}.` });
    else if (st === 'soon') list.push({ level: 'amber', text: `${instrumentText(i) || 'Test instrument'}: calibration due ${i.calDue.split('-').reverse().join('/')} (within a month).` });
  }
  return list;
}
