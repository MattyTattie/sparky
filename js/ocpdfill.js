// v0.33.1: fill the protective device (OCPD) boxes from the chosen device.
// Only boxes that are blank, or still hold the value the app put there last
// time (remembered in c.autoF), are filled or changed. Anything typed by hand
// is left alone. Max Zs isn't a stored box: it's always worked out from the table.
import { deviceById, deviceFromBs } from './limits.js';
import { isSType, showRcdType, parseRcdType as _p, formatRcdType as _f } from './rcdtype.js';

export const DEFAULT_KA = '6';
// Standard breaking capacities (kA) where the product standard sets one.
const KA = { mcb: null, rcbo: null, 'bs88-2': '50', 'bs88-3': '16', bs1362: '6' };
const RCD4 = ['rcdBs', 'rcdType', 'rcdIdn', 'rcdRating'];
export const FILL_KEYS = ['bs', 'type', 'bka', 'rcdBs', 'rcdType', 'rcdIdn', 'rcdRating'];

// The standard values for this circuit's device (and RCD part for an RCBO).
export function standardFor(c, { ka, board } = {}) {
  const d = deviceById(c.device) || deviceFromBs(c.bs); if (!d) return {};
  const out = {};
  if (d.bs) out.bs = d.bs;
  if (d.types.length === 1) out.type = d.types[0];
  else if (d.types.length && !d.types.includes(String(c.type || ''))) out.type = d.types[0];
  if (d.id === 'mcb' || d.id === 'rcbo') out.bka = String(ka || DEFAULT_KA);
  else out.bka = KA[d.id] || ''; // no standard figure: take back only an earlier auto value
  const rating = String(c.rating ?? '').trim();
  if (d.rcd) { out.rcdBs = '61009'; out.rcdType = 'A'; out.rcdIdn = '30'; if (rating) out.rcdRating = rating; }
  else { for (const k of RCD4) out[k] = board ? String(board[k] ?? '').trim() : ''; if (board) { out.rcdType = showRcdType(out.rcdType); out.rcdS = isSType(out.rcdType); } } // v0.35.2: not an RCBO: the board's main RCD (or N/A); no board: take back only what we filled
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
  // v0.35.2: the S-type tick follows the board's RCD unless ticked/unticked by hand
  if ('rcdS' in want && !(c.handF && c.handF.rcdS) && (!c.rcdS || af.rcdS === true)) {
    if (!!c.rcdS !== want.rcdS) { c.rcdS = want.rcdS; changedKeys.push('rcdS'); }
    if (want.rcdS) af.rcdS = true; else delete af.rcdS;
  }
  c.autoF = af;
  return changedKeys;
}
// A box the user types in is theirs from then on.
export function typed(c, k) { if (c && c.autoF && k in c.autoF) delete c.autoF[k]; if (c && k === 'rcdS') c.handF = { ...(c.handF || {}), rcdS: true }; }
// v0.35.2: every MCB / fuse line on a board picks up the board's main RCD (auto boxes only).
// Returns how many circuits changed.
export function fillBoardRcd(b, isSpare = () => false) {
  let n = 0; for (const c of (b && b.circuits) || []) if (!isSpare(c) && autoFillOcpd(c, { board: b }).length) n++;
  return n;
}

// v0.47.0: RCBO -> MCB (or fuse). An RCBO's own RCD values (61009, its rating, Type A 30 mA) left in the
// boxes are stale for an MCB: let the app replace them (with the board's RCD, or blank). Values that
// don't look like the RCBO's own are left alone. Returns the keys released.
export function releaseRcboRcd(c, oldDev, newDev) {
  if (!c || !oldDev || !oldDev.rcd || !newDev || newDev.rcd) return [];
  const own = { rcdBs: ['61009', '62423'], rcdType: ['A', 'AC', 'F', 'B'], rcdIdn: ['30'], rcdRating: [String(c.rating ?? '').trim()] };
  if (String(c.rcdBs ?? '').trim() && !own.rcdBs.includes(String(c.rcdBs).trim())) return []; // a real RCCB number was typed: theirs
  const af = { ...(c.autoF || {}) }; const out = [];
  for (const k of RCD4) { const v = String(c[k] ?? '').trim(); if (v && own[k].includes(v) && !(k in af && String(af[k]) === v)) { af[k] = v; out.push(k); } }
  c.autoF = af; return out;
}
// Does the board have its own RCD (a real IΔn)?
export const boardHasRcd = (b) => { const v = String((b && b.rcdIdn) ?? '').trim(); return !!v && !/^n\/?a$/i.test(v); };
const realS = (v) => String(v ?? '').trim();
// v0.47.0: the board RCD's S (time delay) carries down to the circuits that are on it: MCB / fuse lines
// whose RCD boxes match the board's (BS, IΔn, rating; S ignored). Returns how many changed.
export function syncBoardS(b) {
  if (!boardHasRcd(b)) return 0; const s = isSType(b.rcdType); let n = 0;
  for (const c of (b && b.circuits) || []) {
    const d = deviceById(c.device) || deviceFromBs(c.bs); if (c.noDevice || (d && d.rcd)) continue;
    if (realS(c.rcdIdn) !== realS(b.rcdIdn) || (realS(c.rcdRating) && realS(b.rcdRating) && realS(c.rcdRating) !== realS(b.rcdRating))) continue;
    if (realS(c.rcdBs) && realS(b.rcdBs) && realS(c.rcdBs) !== realS(b.rcdBs)) continue;
    const want = s ? formatS(c.rcdType || b.rcdType, true) : formatS(c.rcdType, false);
    if (!!c.rcdS !== s || realS(c.rcdType) !== want) { c.rcdS = s; if (realS(c.rcdType) || s) c.rcdType = want; n++; }
  }
  return n;
}
const formatS = (t, s) => { const p = _p(t); return _f(p.wave, s); };
// The board RCD a circuit is on, when its RCD boxes match the board's (else null).
export function onBoardRcd(c, b) {
  if (!boardHasRcd(b) || !c) return false;
  const d = deviceById(c.device) || deviceFromBs(c.bs); if (d && d.rcd) return false;
  return realS(c.rcdIdn) === realS(b.rcdIdn) && (!realS(c.rcdRating) || !realS(b.rcdRating) || realS(c.rcdRating) === realS(b.rcdRating));
}
