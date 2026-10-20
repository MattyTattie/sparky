// =====================================================================
// dangermodel.js — v0.17 danger notices: the data, kept on the certificate
// as cert.dangerNotices[] (optional; older backups simply don't have it).
// One notice can cover several C1/C2 items (n.items[]); each item can have
// its own action/remedial, otherwise the shared ones on the notice apply.
// Pure functions only (no screen code), so the tests can use them.
// =====================================================================
export const ACTIONS = [
  ['isolated', 'Isolated: the danger was isolated and left disconnected'],
  ['madeSafe', 'Made safe: temporary measures taken to remove the immediate danger'],
  ['refused', 'Isolation refused: the person responsible did not allow isolation'],
  ['other', 'Other (see details)'],
];
export const SHORT = { isolated: 'Isolated', madeSafe: 'Made safe', refused: 'Isolation refused', other: 'Other' };
export const actionText = (a) => (ACTIONS.find(([k]) => k === a) || [, ''])[1];
const today = () => new Date().toISOString().slice(0, 10);
const firstLine = (s) => String(s || '').split(/[,\n]/)[0].trim();
const dmy = (d) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : d || '');
const rid = () => 'i' + Math.random().toString(36).slice(2, 9);

export const dangerCodes = (o) => !!o && (o.code === 'C1' || o.code === 'C2');
export const itemFromObs = (o) => ({ id: rid(), obsId: o.id || '', code: o.code === 'C2' ? 'C2' : 'C1', text: o.text || '', location: o.location || '', reg: o.reg || '', action: '', actionOther: '', remedial: '' });
export const blankItem = () => ({ id: rid(), obsId: '', code: 'C1', text: '', location: '', reg: '', action: '', actionOther: '', remedial: '' });

// Older single-item notices (text/code/obsId on the notice itself) become one item. Safe to run again.
export function migrateNotice(n) {
  if (!n || Array.isArray(n.items)) return n;
  n.items = (n.obsId || n.text || n.location) ? [{ ...blankItem(), obsId: n.obsId || '', code: n.code === 'C2' ? 'C2' : 'C1', text: n.text || '', location: n.location || '', reg: n.reg || '' }] : [];
  for (const k of ['obsId', 'code', 'text', 'location', 'reg']) delete n[k];
  return n;
}
export const noticesOf = (cert) => (Array.isArray(cert && cert.dangerNotices) ? cert.dangerNotices.map(migrateNotice) : []);
export const noticeForObs = (cert, o) => (o && o.id ? noticesOf(cert).find((n) => n.items.some((i) => i.obsId === o.id)) || null : null);
export const noticeNo = (cert, n) => `${cert.number || cert.type}-DN${noticesOf(cert).indexOf(n) + 1 || 1}`;
// "Open" = not signed yet, so more items can still go on it.
export const openNotices = (cert) => noticesOf(cert).filter((n) => !(n.sig && n.sig.img));
// C1/C2 observations not already on any notice.
export const freeDangerObs = (cert) => (cert.observations || []).filter((o) => dangerCodes(o) && !noticeForObs(cert, o));

// A new notice. Default items: the given observation(s), or all C1/C2 not already on a notice.
export function blankNotice(cert, obs = null, id = 'dn' + Date.now().toString(36)) {
  const list = obs ? (Array.isArray(obs) ? obs : [obs]) : freeDangerObs(cert);
  return { id, items: list.map(itemFromObs), action: '', actionOther: '', informed: false, remedial: '', date: today(), sig: null, custName: '', custSig: null };
}
export function addObs(cert, n, o) { if (!n.items.some((i) => i.obsId === o.id)) n.items.push(itemFromObs(o)); return n; }
export function removeObs(n, obsId) { n.items = n.items.filter((i) => i.obsId !== obsId); return n; }
// Action / remedial for an item (its own, or the notice's shared one).
export const itemAction = (n, i) => (i.action ? { action: i.action, other: i.actionOther } : { action: n.action, other: n.actionOther });
export const itemRemedial = (n, i) => String(i.remedial || '').trim() || String(n.remedial || '').trim();
export const itemsDiffer = (n) => n.items.some((i) => i.action || String(i.remedial || '').trim());

// The note printed on the main certificate beside an observation.
export function noticeFor(cert, o) {
  const n = noticeForObs(cert, o); if (!n) return '';
  return `[Danger notification ${noticeNo(cert, n)} issued ${dmy(n.date)}]`;
}
// Items not tied to an observation on this certificate get a line in the comments / general condition.
export function withNotices(cert, text) {
  const ids = new Set((cert.observations || []).map((o) => o.id));
  const lines = [];
  for (const n of noticesOf(cert)) for (const i of n.items) if (!i.obsId || !ids.has(i.obsId)) lines.push(`Danger notification ${noticeNo(cert, n)} issued ${dmy(n.date)}: ${i.code} – ${i.text || 'see notice'}${i.location ? ' (' + i.location + ')' : ''}.`);
  return [text || '', ...lines].filter(Boolean).join('\n');
}
// What's still missing before the notice is ready to hand over.
export function noticeMissing(n) {
  migrateNotice(n); const m = [];
  if (!n.items.length) m.push('At least one item');
  if (n.items.some((i) => !String(i.text || '').trim())) m.push('Description of each danger');
  if (n.items.some((i) => !itemAction(n, i).action)) m.push('Action taken');
  if (n.items.some((i) => itemAction(n, i).action === 'other' && !String(itemAction(n, i).other || '').trim())) m.push('Details of the action taken');
  if (n.items.some((i) => !itemRemedial(n, i))) m.push('Recommended remedial action');
  if (!n.sig || !n.sig.img) m.push('Your signature');
  return m;
}
// Email subject and body for a certificate or notice (nothing is sent by the app).
export function emailParts(cert, { notice = null, profile = {} } = {}) {
  const addr = firstLine(cert.install && cert.install.address) || firstLine(cert.client && cert.client.address);
  const what = notice ? 'Danger notification' : 'Electrical certificate';
  const no = notice ? noticeNo(cert, notice) : cert.number || cert.type;
  const subject = `${what} ${no}${addr ? ' – ' + addr : ''}`;
  const name = String((cert.client && cert.client.name) || '').trim();
  const from = profile.name || profile.business || '';
  const body = [
    name ? `Hello ${name},` : 'Hello,', '',
    notice
      ? `Please find attached the danger notification (${no}) for ${addr || 'the installation'}. It explains the dangerous condition${notice.items && notice.items.length > 1 ? 's' : ''} found and the action recommended. Please arrange for the remedial work to be done as soon as possible.`
      : `Please find attached your electrical certificate (${no}) for ${addr || 'the installation'}. Please keep it somewhere safe with your property documents.`,
    '', 'If you have any questions, just get in touch.', '', 'Kind regards,', from, profile.business && profile.business !== from ? profile.business : '', profile.phone || '',
  ].filter((l, i, a) => l !== '' || (a[i - 1] !== '' && i > 0)).join('\n').trim();
  return { subject, body };
}
export const mailtoUrl = (to, { subject, body }) => `mailto:${encodeURIComponent(to || '').replace(/%40/g, '@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
