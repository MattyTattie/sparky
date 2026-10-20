// =====================================================================
// dangermodel.js — v0.17 danger notices: the data, kept on the certificate
// as cert.dangerNotices[] (optional; older backups simply don't have it).
// Pure functions only (no screen code), so the tests can use them.
// =====================================================================
export const ACTIONS = [
  ['isolated', 'Isolated: the danger was isolated and left disconnected'],
  ['madeSafe', 'Made safe: temporary measures taken to remove the immediate danger'],
  ['refused', 'Isolation refused: the person responsible did not allow isolation'],
  ['other', 'Other (see details)'],
];
export const actionText = (a) => (ACTIONS.find(([k]) => k === a) || [, ''])[1];
const today = () => new Date().toISOString().slice(0, 10);
const firstLine = (s) => String(s || '').split(/[,\n]/)[0].trim();
const dmy = (d) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : d || '');

export const dangerCodes = (o) => !!o && (o.code === 'C1' || o.code === 'C2');

// A new notice, filled in from the certificate (and the observation, if there is one).
export function blankNotice(cert, obs = null, id = 'dn' + Date.now().toString(36)) {
  return {
    id, obsId: obs ? obs.id : '', code: obs ? obs.code : 'C1',
    text: obs ? obs.text || '' : '', location: obs ? obs.location || '' : '', reg: obs ? obs.reg || '' : '',
    action: '', actionOther: '', informed: false, remedial: '',
    date: today(), sig: null, custName: '', custSig: null,
  };
}
export const noticesOf = (cert) => (Array.isArray(cert && cert.dangerNotices) ? cert.dangerNotices : []);
export const noticeForObs = (cert, o) => noticesOf(cert).find((n) => n.obsId && o && n.obsId === o.id) || null;
export const noticeNo = (cert, n) => `${cert.number || cert.type}-DN${noticesOf(cert).indexOf(n) + 1 || 1}`;

// The note printed on the main certificate beside an observation.
export function noticeFor(cert, o) {
  const n = noticeForObs(cert, o); if (!n) return '';
  return `[Danger notification ${noticeNo(cert, n)} issued ${dmy(n.date)}]`;
}
// Notices that aren't tied to an observation get a line added to the comments / general condition.
export function withNotices(cert, text) {
  const ids = new Set((cert.observations || []).map((o) => o.id));
  const loose = noticesOf(cert).filter((n) => !n.obsId || !ids.has(n.obsId));
  const lines = loose.map((n) => `Danger notification ${noticeNo(cert, n)} issued ${dmy(n.date)}: ${n.code} – ${n.text || 'see notice'}${n.location ? ' (' + n.location + ')' : ''}.`);
  return [text || '', ...lines].filter(Boolean).join('\n');
}
// What's still missing before the notice is ready to hand over.
export function noticeMissing(n) {
  const m = [];
  if (!String(n.text || '').trim()) m.push('Description of the danger');
  if (!n.action) m.push('Action taken');
  if (n.action === 'other' && !String(n.actionOther || '').trim()) m.push('Details of the action taken');
  if (!String(n.remedial || '').trim()) m.push('Recommended remedial action');
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
      ? `Please find attached the danger notification (${no}) for ${addr || 'the installation'}. It explains the dangerous condition found and the action recommended. Please arrange for the remedial work to be done as soon as possible.`
      : `Please find attached your electrical certificate (${no}) for ${addr || 'the installation'}. Please keep it somewhere safe with your property documents.`,
    '', 'If you have any questions, just get in touch.', '', 'Kind regards,', from, profile.business && profile.business !== from ? profile.business : '', profile.phone || '',
  ].filter((l, i, a) => l !== '' || (a[i - 1] !== '' && i > 0)).join('\n').trim();
  return { subject, body };
}
export const mailtoUrl = (to, { subject, body }) => `mailto:${encodeURIComponent(to || '').replace(/%40/g, '@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
