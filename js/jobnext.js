// =====================================================================
// jobnext.js — v0.18: the job page's "Next step" (pure, tested).
// Looks at the job's certificates and says what to do next, with one button.
// =====================================================================
import { screenSections, countsToward, sectionDone, TYPES } from './certmodel.js';
import { isSpare } from './checks.js';

const circuitsLeft = (cert) => (cert.boards || []).reduce((n, b) => n + (b.circuits || []).filter((c) => !isSpare(c) && !c.zs).length, 0);
const certHref = (c, s) => (!s ? `#/cert/${c.id}` : s.special === 'boards' ? `#/cert/${c.id}/boards` : `#/cert/${c.id}/s/${s.id}`);

export function certProgress(cert) {
  const secs = screenSections(cert.type).filter(countsToward);
  const left = secs.filter((s) => !sectionDone(cert, s));
  return { done: secs.length - left.length, total: secs.length, left, circuits: cert.type === 'MW' ? 0 : circuitsLeft(cert) };
}
// { kind, title, sub, label, href, cert, pct }
export function nextStep(certs) {
  const list = (certs || []).slice();
  if (!list.length) return { kind: 'start', title: 'Start a certificate', sub: 'Pick EIC, EICR or Minor Works.', label: 'Add certificate…', href: null, pct: 0 };
  const drafts = list.filter((c) => c.status !== 'issued').sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  if (!drafts.length) {
    const last = list.slice().sort((a, b) => String(b.issuedAt || b.updatedAt || '').localeCompare(String(a.issuedAt || a.updatedAt || '')))[0];
    return { kind: 'done', title: 'All certificates issued', sub: `${last.number} issued. Send it again or add another certificate.`, label: `Open ${last.number}`, href: certHref(last), cert: last, pct: 100 };
  }
  const c = drafts[0]; const p = certProgress(c);
  const pct = Math.round((p.done / p.total) * 100);
  const sub = `${p.done} of ${p.total} sections${p.circuits ? ` · ${p.circuits} circuit${p.circuits === 1 ? '' : 's'} left` : ''}`;
  const work = p.left.filter((s) => s.special !== 'sign');
  if (work.length) {
    const s = work[0];
    const title = s.special === 'boards' ? 'Finish circuits and test results' : `Finish ${s.title.charAt(0).toLowerCase() + s.title.slice(1)}`;
    return { kind: 'continue', title, sub, label: `Continue ${c.number}`, href: certHref(c, s), cert: c, pct };
  }
  if (p.left.length) { const s = p.left[0]; return { kind: 'sign', title: 'Ready to sign', sub, label: `Sign & send ${c.number}`, href: certHref(c, s), cert: c, pct }; }
  return { kind: 'send', title: `${(TYPES[c.type] || {}).name || 'Certificate'} ready`, sub: 'Everything is filled in. Make the PDF and send it.', label: `Sign & send ${c.number}`, href: certHref(c), cert: c, pct: 100 };
}
