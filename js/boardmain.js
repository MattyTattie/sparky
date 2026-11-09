// =====================================================================
// boardmain.js — v0.45.1: a board's main switch, for the parts list and the
// board photo scan. Pure (no DOM), tested by tests/v451.test.mjs.
// Board 1's main switch is the certificate's "Earthing, bonding and main switch"
// section (cert.parts.ms*). Boards after the first have the same boxes in an
// optional board.main object (same keys: msLocation, msBs, msPoles, msCurrent,
// msVoltage, msIsOcpd, msType, msRating, msKa, msIsRcd, rcdType, rcdIdn, …).
// =====================================================================
import { get, msIsOcpdAt, msIsRcdAt } from './certmodel.js';
import { parseRcdType, formatRcdType, isSType } from './rcdtype.js';
const real = (v) => v != null && String(v).trim() !== '' && !/^n\/?a$/i.test(String(v).trim());
const blank = (v) => v == null || String(v).trim() === '';
// The object and key prefix holding board bi's main switch.
export const mainAt = (cert, bi) => (bi === 0 ? { o: cert, pre: 'parts.' } : { o: (cert.boards || [])[bi] || {}, pre: 'main.' });
export const hasMainSwitch = (o, pre) => ['msBs', 'msCurrent', 'msType', 'msRating', 'rcdIdn'].some((k) => real(get(o, pre + k)));

const POLES = { 1: 'SP', 2: 'DP', 3: 'TP' };
// Parts-list lines for one main switch. A BS EN 60947-3 switch is an isolator: "Main switch: 100 A DP isolator (BS EN 60947-3)".
// v0.47.0: always "Main switch: …" (one wording), and a main switch that is an RCD is ONE line with its
// RCD details ("Main switch: 63 A DP RCD 100 mA Type A S (BS EN 61008)"), not a second "Main RCD" part.
export function mainSwitchParts(o, pre) {
  const g = (k) => get(o, pre + k); const out = [];
  const bs = real(g('msBs')) ? String(g('msBs')).replace(/^\s*(BS\s*)?(EN\s*)?/i, '').trim() : '';
  const isRcd = msIsRcdAt(pre)(o); const rcdBit = isRcd && real(g('rcdIdn')) ? `RCD ${g('rcdIdn')} mA${real(g('rcdType')) ? ' Type ' + showType(g('rcdType')) : ''}` : isRcd ? 'RCD' : '';
  if (real(g('msCurrent')) || bs || rcdBit) {
    const iso = /60947-3/.test(bs) && !msIsOcpdAt(pre)(o) && !isRcd;
    const poles = real(g('msPoles')) ? (POLES[String(g('msPoles')).trim()] || g('msPoles') + '-pole') : '';
    out.push('Main switch: ' + [real(g('msCurrent')) && g('msCurrent') + ' A', poles, iso ? 'isolator' : rcdBit].filter(Boolean).join(' ') + (bs ? ` (BS EN ${bs})` : ''));
  }
  if (msIsOcpdAt(pre)(o) && real(g('msRating'))) out.push(`Main ${real(g('msType')) ? g('msType') : 'breaker'} ${g('msRating')} A`);
  return out;
}
const showType = (t) => { const p = parseRcdType(t); return p.na || p.other || !p.raw ? String(t).trim() : formatRcdType(p.wave, p.s); };

// v0.45.2: one schedule-header line for a later board's main switch, or null when it isn't filled in.
// [[label, value, fraction, opts], ...] for pdf.js row(); the last box is the breaker / RCD details if ticked, else the location.
export function mainSwitchRow(o, pre, rcdType = (t) => t) {
  if (!hasMainSwitch(o, pre)) return null;
  const g = (k) => (real(get(o, pre + k)) ? String(get(o, pre + k)).trim() : '');
  const extra = [];
  if (msIsOcpdAt(pre)(o)) extra.push([g('msType') || 'Breaker', g('msRating') && g('msRating') + ' A', g('msKa') && g('msKa') + ' kA'].filter(Boolean).join(' '));
  // v0.47.0: type (with S), IΔn and delay; the location is kept too (it used to drop off when an RCD was ticked)
  if (msIsRcdAt(pre)(o)) extra.push(['RCD', g('rcdType') && 'Type ' + rcdType(g('rcdType')), g('rcdIdn') && g('rcdIdn') + ' mA', g('rcdDelay') && g('rcdDelay') !== '0' ? 'delay ' + g('rcdDelay') + ' ms' : (isSType(g('rcdType')) ? 'time-delayed' : '')].filter(Boolean).join(' '));
  if (extra.length && g('msLocation')) extra.push('at ' + g('msLocation'));
  return [['Main switch: BS (EN)', g('msBs'), 0.22], ['Poles', g('msPoles'), 0.1], ['Current', g('msCurrent'), 0.14, { unit: 'A' }], ['Voltage', g('msVoltage'), 0.16, { unit: 'V' }],
    extra.length ? ['If OCPD / RCD:', extra.join(' · '), 0.38] : ['Location:', g('msLocation'), 0.38]];
}
// v0.47.0: when a board's main switch is an RCD, its RCD boxes ARE the board's RCD. One set of boxes is
// shown (the main switch's); the board's rcdBs / rcdType / rcdIdn / rcdRating are kept in step from them so
// the circuits, the parts list and the checks all see it. Fills only; returns the board keys changed.
export function mirrorMainRcd(cert, bi) {
  const b = (cert.boards || [])[bi]; if (!b) return [];
  const { o, pre } = mainAt(cert, bi); if (!msIsRcdAt(pre)(o)) return [];
  const g = (k) => String(get(o, pre + k) ?? '').trim();
  const want = { rcdBs: g('msBs').replace(/^\s*(BS\s*)?(EN\s*)?/i, ''), rcdType: g('rcdType'), rcdIdn: g('rcdIdn'), rcdRating: g('msCurrent') };
  const out = [];
  for (const [k, v] of Object.entries(want)) if (v && String(b[k] ?? '').trim() !== v) { b[k] = v; out.push(k); }
  return out;
}
// Old jobs: an RCD main switch whose details went in the board's RCD boxes instead: copy them up (blanks only).
export function liftBoardRcdToMain(cert, bi) {
  const b = (cert.boards || [])[bi]; if (!b) return [];
  const { o, pre } = mainAt(cert, bi); if (!msIsRcdAt(pre)(o)) return [];
  const obj = pre === 'parts.' ? (o.parts = o.parts || {}) : (o.main = o.main || {}); const out = [];
  const map = { rcdType: 'rcdType', rcdIdn: 'rcdIdn' };
  for (const [bk, mk] of Object.entries(map)) if (real(b[bk]) && blank(obj[mk])) { obj[mk] = String(b[bk]).trim(); out.push(mk); }
  return out;
}
// DB1's board details: a short summary of the certificate's main switch ('' when not filled in).
export const mainSummary = (o, pre) => mainSwitchParts(o, pre).map((s) => s.replace(/^Main switch:?\s*/, '')).filter(Boolean).join(' · ');

// Board photo scan: the main switch it spotted (e.g. "100A") goes into the blank rating box.
export function mainFromScan(cert, bi, found) {
  const rating = String((found && found.rating) || '').trim(); if (!rating) return [];
  const { o, pre } = mainAt(cert, bi);
  if (!blank(get(o, pre + 'msCurrent'))) return [];
  const obj = pre === 'parts.' ? (o.parts = o.parts || {}) : (o.main = o.main || {});
  obj.msCurrent = rating; return [pre + 'msCurrent'];
}
// v0.47.0: what to print / check as a board's RCD: the board's own boxes, with an RCD main switch's
// details filling any blanks (older jobs kept them only under the main switch). Doesn't change the cert.
export function boardRcdView(cert, bi) {
  const b = (cert.boards || [])[bi] || {}; const out = { rcdBs: b.rcdBs, rcdType: b.rcdType, rcdIdn: b.rcdIdn, rcdRating: b.rcdRating };
  const { o, pre } = mainAt(cert, bi); if (!msIsRcdAt(pre)(o)) return out;
  const g = (k) => String(get(o, pre + k) ?? '').trim();
  const from = { rcdBs: g('msBs').replace(/^\s*(BS\s*)?(EN\s*)?/i, ''), rcdType: g('rcdType'), rcdIdn: g('rcdIdn'), rcdRating: g('msCurrent') };
  for (const k of Object.keys(out)) if (blank(out[k]) && from[k]) out[k] = from[k];
  return out;
}
