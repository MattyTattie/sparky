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

const MAX_LIST = 4;
const listOf = (a) => (a.length > MAX_LIST ? a.slice(0, MAX_LIST).join(', ') + ` and ${a.length - MAX_LIST} more` : a.join(', '));
const secHref = (id, s) => (s.special === 'boards' ? `#/cert/${id}/boards` : `#/cert/${id}/s/${s.id}`);

export function checkCert(cert) {
  cert = cert || {}; const id = cert.id;
  const fix = [], missing = [], check = [];
  // 1. Readings outside the limits (red flags): Zs over max, IR below the minimum, RCD too slow, polarity, test button
  const flagItems = (c, ctx, where, href) => { const r = checkCircuit(c, ctx); for (const f of Object.values(r.flags)) if (f.level === 'red') fix.push({ text: `${where}: ${f.msg}`, href }); };
  if (cert.type === 'MW') { const M = cert.mw || {}; if (M.circuit) flagItems(M.circuit, { earthing: M.earthing, zdb: M.zdb }, 'Circuit ' + (M.circuit.num || ''), `#/cert/${id}/mwc`); }
  else (cert.boards || []).forEach((b, bi) => (b.circuits || []).forEach((c, ci) => flagItems(c, boardCtx(cert, b), `${b.ref || 'Board'} circuit ${c.num || ci + 1}`, `#/cert/${id}/b/${bi}/c/${ci}`)));
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
      bs.forEach((b, bi) => { const nz = (b.circuits || []).filter((c) => !isSpare(c) && !String(c.zs || '').trim()).map((c, i) => c.num || String(i + 1));
        if (nz.length) missing.push({ text: `${b.ref || 'Board'}: no Zs on circuit${nz.length === 1 ? '' : 's'} ${listOf(nz)}.`, href: `#/cert/${id}/b/${bi}` }); });
      continue;
    }
    if (s.special === 'inspections') { const v = Object.values(cert.inspections || {}); const left = v.filter((x) => !x).length; missing.push({ text: `${s.title}: ${v.length ? left + ' of ' + v.length + ' items not ticked' : 'not started'}.`, href }); continue; }
    if (s.special === 'bonding') { missing.push({ text: `${s.title}: add it, or tick N/A.`, href }); continue; }
    const m = missingFields(cert, s).map((x) => x.label);
    if (s.special === 'sign') { if (!(cert.sigs && Object.values(cert.sigs).some((x) => x && x.img))) missing.push({ text: 'Not signed yet.', href }); if (m.length) missing.push({ text: `${s.title}: ${listOf(m)}.`, href }); continue; }
    missing.push({ text: m.length ? `${s.title}: ${listOf(m)}.` : `${s.title}: not finished.`, href });
  }
  const groups = [
    { id: 'fix', title: 'Needs fixing', level: 'red', items: fix },
    { id: 'missing', title: 'Still to fill in', level: 'amber', items: missing },
    { id: 'check', title: 'Worth checking', level: 'info', items: check },
  ].filter((g) => g.items.length);
  return { groups, count: fix.length + missing.length + check.length, fix: fix.length };
}
