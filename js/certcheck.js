// =====================================================================
// certcheck.js (v0.46.0) — "Check certificate": the problems on a
// certificate in plain words, grouped, each with a link to fix it.
// Pure (no DOM): used before making a PDF and by the Check certificate
// button. Builds on what the screens already know: missingFields /
// sectionDone (the section dots) and checkCircuit (the red flags).
// Nothing is stored; it only reads the certificate.
// =====================================================================
import { screenSections, sectionDone, missingFields, eicrOverall } from './certmodel.js';
import { checkCircuit, isSpare, boardCtx } from './checks.js';
import { settleBoardRcds } from './boardrcd.js';
import { outOfWayOrder, noWayNumber } from './templates.js';
import { obsSuggestion, hasObsFor } from './obsfrom.js';

const MAX_LIST = 4;
const listOf = (a) => (a.length > MAX_LIST ? a.slice(0, MAX_LIST).join(', ') + ` and ${a.length - MAX_LIST} more` : a.join(', '));
const secHref = (id, s) => (s.special === 'boards' ? `#/cert/${id}/boards` : `#/cert/${id}/s/${s.id}`);

// v0.49.0: ONE wording for a missing reading, used by Check certificate, the boards notice and the board page:
// "DB1 circuit 4: no Zs" / "DB1 circuits 2, 4: no Zs". zsMissing gives the circuit numbers and their indexes
// (for tap-to-jump links to each circuit).
export function zsMissing(b) {
  const out = []; (b && b.circuits || []).forEach((c, ci) => { if (c && !isSpare(c) && !String(c.zs ?? '').trim()) out.push({ num: String(c.num ?? '').trim() || '(row ' + (ci + 1) + ')', ci }); });
  return out;
}
export const missingZsText = (ref, nums) => `${ref || 'Board'} circuit${nums.length === 1 ? '' : 's'} ${listOf(nums)}: no Zs`;
export function checkCert(cert) {
  // v0.49.0: judged on the settled boards (the board RCD on its MCB lines), same as the screens and PDF
  cert = cert || {}; if (Array.isArray(cert.boards)) { cert = { ...cert, boards: structuredClone(cert.boards), parts: structuredClone(cert.parts || {}) }; settleBoardRcds(cert); }
  const id = cert.id;
  const fix = [], missing = [], check = [], look = [];
  // 1. Readings outside the limits (red flags): Zs over max, IR below the minimum, RCD too slow, polarity, test button
  // v0.49.0: amber flags go in "Worth a look" (they don't stop the PDF; reds are "Needs fixing")
  // v0.50.0: each item says which board it's on (bi, for the board filter); on an EICR a red reading carries a
  // suggested observation (obs) to record it, and whether one is already in (obsDone)
  const flagItems = (c, ctx, where, href, bi = -1, b = null) => { const r = checkCircuit(c, ctx); for (const [field, f] of Object.entries(r.flags)) {
    if (f.level === 'red') { const it = { text: `${where}: ${f.msg}`, href, bi };
      if (cert.type === 'EICR' && b) { const o = obsSuggestion({ cert, b, bi, c, field, flag: f }); if (o) { it.obs = o; it.obsDone = hasObsFor(cert, o.src); } }
      fix.push(it); }
    else if (f.level === 'amber') look.push({ text: `${where}: ${f.msg}`, href, bi }); } };
  if (cert.type === 'MW') { const M = cert.mw || {}; if (M.circuit) flagItems(M.circuit, { earthing: M.earthing, zdb: M.zdb }, 'Circuit ' + (M.circuit.num || ''), `#/cert/${id}/mwc`); }
  else (cert.boards || []).forEach((b, bi) => (b.circuits || []).forEach((c, ci) => flagItems(c, boardCtx(cert, b), `${b.ref || 'Board'} circuit ${String(c.num ?? '').trim() || '(no way number, row ' + (ci + 1) + ')'}`, `#/cert/${id}/b/${bi}/c/${ci}`, bi, b)));
  // v0.49.0: circuits out of way-number order (the PDF prints them as entered)
  (cert.boards || []).forEach((b, bi) => { const o = outOfWayOrder(b.circuits); if (o) look.push({ text: `${b.ref || 'Board'}: circuits aren\u2019t in way order (${o.before} comes before ${o.after}). Sort them on the board page.`, href: `#/cert/${id}/b/${bi}`, bi }); });
  // v0.50.0: a circuit with no way number (it can't be sorted, matched to a sub-main or printed in order)
  if (cert.type !== 'MW') (cert.boards || []).forEach((b, bi) => { const nn = noWayNumber(b.circuits); if (nn.length) missing.push({ text: `${b.ref || 'Board'}: ${nn.length === 1 ? 'a circuit has' : nn.length + ' circuits have'} no way number${nn[0].desc ? ' (' + nn.map((x) => x.desc || 'no description').slice(0, 3).join(', ') + (nn.length > 3 ? '\u2026' : '') + ')' : ''}.`, href: `#/cert/${id}/b/${bi}/c/${nn[0].ci}`, bi }); });
  // 2. EICR: the overall assessment against the codes
  if (cert.type === 'EICR') {
    const codes = (cert.observations || []).map((o) => o && o.code);
    const n = (c) => codes.filter((x) => x === c).length;
    const set = ((cert.eicr || {}).overall || '').toUpperCase(); const overall = set || eicrOverall(cert);
    const sum = screenSections('EICR').find((s) => s.id === 'summary'); const sumHref = sum ? secHref(id, sum) : `#/cert/${id}`;
    const obsHref = `#/cert/${id}/s/observations`;
    if (overall === 'SATISFACTORY' && (n('C1') || n('C2'))) fix.push({ text: `Overall assessment is Satisfactory, but there ${n('C1') + n('C2') === 1 ? 'is' : 'are'} ${[n('C1') && n('C1') + ' C1', n('C2') && n('C2') + ' C2'].filter(Boolean).join(' and ')}. It must be Unsatisfactory.`, href: sumHref });
    if (overall === 'SATISFACTORY' && n('FI')) check.push({ text: `${n('FI')} FI (further investigation) with an overall Satisfactory. FI doesn\u2019t change the result on its own, but check nothing needs a C1 or C2.`, href: obsHref });
    if (set === 'UNSATISFACTORY' && !n('C1') && !n('C2')) check.push({ text: 'Overall assessment is set to Unsatisfactory, but there are no C1 or C2 observations.', href: sumHref });
    const noText = (cert.observations || []).filter((o) => o && /^(C1|C2|C3|FI)$/.test(o.code || '') && !String(o.text || '').trim()).length;
    if (noText) check.push({ text: `${noText} observation${noText === 1 ? ' has' : 's have'} a code but no description.`, href: obsHref });
  }
  // 3. Still to fill in (the same rules as the section dots)
  for (const s of screenSections(cert.type)) {
    if (s.special === 'observations') continue;
    if (sectionDone(cert, s)) continue;
    const href = secHref(id, s);
    if (s.special === 'boards') {
      const bs = cert.boards || [];
      if (!bs.some((b) => (b.circuits || []).length)) { missing.push({ text: 'Circuits and test results: no circuits yet.', href }); continue; }
      bs.forEach((b, bi) => { const nz = zsMissing(b);
        if (nz.length) missing.push({ text: missingZsText(b.ref, nz.map((x) => x.num)) + '.', href: `#/cert/${id}/b/${bi}/c/${nz[0].ci}`, bi }); }); // v0.49.0: straight to the first circuit
      continue;
    }
    if (s.special === 'inspections') { const v = Object.values(cert.inspections || {}); const left = v.filter((x) => !x).length; missing.push({ text: `${s.title}: ${v.length ? left + ' of ' + v.length + ' items not ticked' : 'not started'}.`, href }); continue; }
    if (s.special === 'bonding') { missing.push({ text: `${s.title}: add it, or tick N/A.`, href }); continue; }
    const m = missingFields(cert, s).map((x) => x.label);
    if (s.special === 'sign') { if (!(cert.sigs && Object.values(cert.sigs).some((x) => x && x.img))) missing.push({ text: 'Not signed yet.', href }); if (m.length) missing.push({ text: `${s.title}: ${listOf(m)}.`, href }); continue; }
    missing.push({ text: m.length ? `${s.title}: ${listOf(m)}.` : `${s.title}: not finished.`, href });
  }
  const groups = [
    // v0.50.0: an EICR records faults (as observations), it doesn't fix them
    { id: 'fix', title: cert.type === 'EICR' ? 'Outside the limits (record as observations)' : 'Needs fixing', count: cert.type === 'EICR' ? 'outside the limits' : 'to fix', level: 'red', items: fix },
    { id: 'missing', title: 'Still to fill in', count: 'to fill in', level: 'amber', items: missing },
    { id: 'check', title: 'Worth a look', count: 'worth a look', level: 'info', items: [...check, ...look] },
  ].filter((g) => g.items.length);
  return { groups, count: fix.length + missing.length + check.length + look.length, fix: fix.length };
}
