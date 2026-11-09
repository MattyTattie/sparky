// =====================================================================
// boardmain.js — v0.45.1: a board's main switch, for the parts list and the
// board photo scan. Pure (no DOM), tested by tests/v451.test.mjs.
// Board 1's main switch is the certificate's "Earthing, bonding and main switch"
// section (cert.parts.ms*). Boards after the first have the same boxes in an
// optional board.main object (same keys: msLocation, msBs, msPoles, msCurrent,
// msVoltage, msIsOcpd, msType, msRating, msKa, msIsRcd, rcdType, rcdIdn, …).
// =====================================================================
import { get, msIsOcpdAt, msIsRcdAt } from './certmodel.js';
const real = (v) => v != null && String(v).trim() !== '' && !/^n\/?a$/i.test(String(v).trim());
const blank = (v) => v == null || String(v).trim() === '';
// The object and key prefix holding board bi's main switch.
export const mainAt = (cert, bi) => (bi === 0 ? { o: cert, pre: 'parts.' } : { o: (cert.boards || [])[bi] || {}, pre: 'main.' });
export const hasMainSwitch = (o, pre) => ['msBs', 'msCurrent', 'msType', 'msRating', 'rcdIdn'].some((k) => real(get(o, pre + k)));

const POLES = { 1: 'SP', 2: 'DP', 3: 'TP' };
// Parts-list lines for one main switch. A BS EN 60947-3 switch is an isolator: "Main switch: 100 A DP isolator (BS EN 60947-3)".
export function mainSwitchParts(o, pre) {
  const g = (k) => get(o, pre + k); const out = [];
  const bs = real(g('msBs')) ? String(g('msBs')).replace(/^\s*(BS\s*)?(EN\s*)?/i, '').trim() : '';
  if (real(g('msCurrent')) || bs) {
    const iso = /60947-3/.test(bs) && !msIsOcpdAt(pre)(o) && !msIsRcdAt(pre)(o);
    if (iso) out.push(`Main switch: ${[real(g('msCurrent')) && g('msCurrent') + ' A', real(g('msPoles')) && (POLES[String(g('msPoles')).trim()] || g('msPoles') + '-pole'), 'isolator'].filter(Boolean).join(' ')} (BS EN ${bs})`);
    else out.push(`Main switch ${real(g('msCurrent')) ? g('msCurrent') + ' A ' : ''}${real(g('msPoles')) ? g('msPoles') + '-pole' : ''}${bs ? ' (BS EN ' + bs + ')' : ''}`.replace(/\s+/g, ' ').trim());
  }
  if (msIsOcpdAt(pre)(o) && real(g('msRating'))) out.push(`Main ${real(g('msType')) ? g('msType') : 'breaker'} ${g('msRating')} A`);
  if (msIsRcdAt(pre)(o) && real(g('rcdIdn'))) out.push(`Main RCD ${g('rcdIdn')} mA${real(g('rcdType')) ? ' Type ' + g('rcdType') : ''}`);
  return out;
}

// v0.45.2: one schedule-header line for a later board's main switch, or null when it isn't filled in.
// [[label, value, fraction, opts], ...] for pdf.js row(); the last box is the breaker / RCD details if ticked, else the location.
export function mainSwitchRow(o, pre, rcdType = (t) => t) {
  if (!hasMainSwitch(o, pre)) return null;
  const g = (k) => (real(get(o, pre + k)) ? String(get(o, pre + k)).trim() : '');
  const extra = [];
  if (msIsOcpdAt(pre)(o)) extra.push([g('msType') || 'Breaker', g('msRating') && g('msRating') + ' A', g('msKa') && g('msKa') + ' kA'].filter(Boolean).join(' '));
  if (msIsRcdAt(pre)(o)) extra.push(['RCD', g('rcdType') && 'Type ' + rcdType(g('rcdType')), g('rcdIdn') && g('rcdIdn') + ' mA', g('rcdDelay') && 'delay ' + g('rcdDelay') + ' ms'].filter(Boolean).join(' '));
  return [['Main switch: BS (EN)', g('msBs'), 0.22], ['Poles', g('msPoles'), 0.1], ['Current', g('msCurrent'), 0.14, { unit: 'A' }], ['Voltage', g('msVoltage'), 0.16, { unit: 'V' }],
    extra.length ? ['If OCPD / RCD:', extra.join(' · '), 0.38] : ['Location:', g('msLocation'), 0.38]];
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
