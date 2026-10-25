// v0.33.1: fill the protective device (OCPD) boxes from the chosen device.
// Only boxes that are blank, or still hold the value the app put there last
// time (remembered in c.autoF), are filled or changed. Anything typed by hand
// is left alone. Max Zs isn't a stored box: it's always worked out from the table.
import { deviceById, deviceFromBs } from './limits.js';

export const DEFAULT_KA = '6';
// Standard breaking capacities (kA) where the product standard sets one.
const KA = { mcb: null, rcbo: null, 'bs88-2': '50', 'bs88-3': '16', bs1362: '6' };
export const FILL_KEYS = ['bs', 'type', 'bka', 'rcdBs', 'rcdType', 'rcdIdn', 'rcdRating'];

// The standard values for this circuit's device (and RCD part for an RCBO).
export function standardFor(c, { ka } = {}) {
  const d = deviceById(c.device) || deviceFromBs(c.bs); if (!d) return {};
  const out = {};
  if (d.bs) out.bs = d.bs;
  if (d.types.length === 1) out.type = d.types[0];
  else if (d.types.length && !d.types.includes(String(c.type || ''))) out.type = d.types[0];
  if (d.id === 'mcb' || d.id === 'rcbo') out.bka = String(ka || DEFAULT_KA);
  else out.bka = KA[d.id] || ''; // no standard figure: take back only an earlier auto value
  const rating = String(c.rating ?? '').trim();
  if (d.rcd) { out.rcdBs = '61009'; out.rcdType = 'A'; out.rcdIdn = '30'; if (rating) out.rcdRating = rating; }
  else for (const k of ['rcdBs', 'rcdType', 'rcdIdn', 'rcdRating']) out[k] = ''; // not an RCBO: take back only what we filled
  return out;
}
const blank = (v) => v == null || String(v).trim() === '';
// Is box k free for the app to fill? Blank, or still exactly what the app put there.
export const isAuto = (c, k) => blank(c[k]) || (c.autoF && k in c.autoF && String(c[k]) === String(c.autoF[k]));
// Apply. Returns the keys changed.
export function autoFillOcpd(c, opts = {}) {
  if (!c || c.noDevice) return [];
  const want = standardFor(c, opts); const changedKeys = []; const af = { ...(c.autoF || {}) };
  for (const k of FILL_KEYS) {
    if (!(k in want)) continue;
    if (!isAuto(c, k)) { delete af[k]; continue; } // typed by hand: never touched
    const v = want[k];
    if (String(c[k] ?? '') !== v) { c[k] = v; changedKeys.push(k); }
    if (v === '') delete af[k]; else af[k] = v;
  }
  c.autoF = af;
  return changedKeys;
}
// A box the user types in is theirs from then on.
export function typed(c, k) { if (c && c.autoF && k in c.autoF) delete c.autoF[k]; }
