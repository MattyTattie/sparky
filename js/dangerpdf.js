// =====================================================================
// dangerpdf.js — v0.17: the one-page Danger Notification PDF, in the same
// style as the certificates (brand strip, boxed sections, black values).
// Wording is kept general: it refers to BS 7671 and the Electricity at
// Work Regulations 1989 without quoting regulation numbers.
// =====================================================================
import { Kit, loadJsPDF, VALUE, GREY, INK, RED } from './pdfkit.js';
import { brandStrip, row, checks, textBlock, sig, fmtDate } from './pdf.js';
import { TYPES } from './certmodel.js';
import { CODE_TEXT } from './inspections.js';
import { ACTIONS, noticeNo } from './dangermodel.js';

const joinAddr = (a, pc) => [String(a || '').trim(), String(pc || '').trim()].filter(Boolean).join('\n');

export async function dangerPdf(cert, n, profile = {}) {
  const { jsPDF } = await loadJsPDF();
  const no = noticeNo(cert, n);
  const k = new Kit(jsPDF, { orientation: 'p', footer: 'Danger notification issued with ' + ((TYPES[cert.type] || {}).name || 'certificate') + ' ' + (cert.number || '') + (profile.business ? '.  Issued by ' + profile.business + '.' : '.') });
  brandStrip(k, profile, 'DANGER NOTIFICATION', no, 'Notification of a dangerous or potentially dangerous condition found in the electrical installation at the address below.');
  // red warning band
  k.rect(k.x0, k.y, k.cw, 9, { lw: 0.4, color: RED, fill: [252, 236, 236] });
  k.t('IMPORTANT – PLEASE READ. This notice concerns your safety.', k.x0 + 3, k.y + 5.8, { size: 9.5, bold: true, color: RED });
  k.y += 11;
  k.section('1. DETAILS OF THE INSTALLATION', (k, x, w) => {
    row(k, x, w, [['Client / person responsible:', cert.client && cert.client.name, 0.5], ['Related certificate/report No.:', cert.number, 0.5]]);
    row(k, x, w, [['Installation address:', joinAddr(cert.install && cert.install.address, cert.install && cert.install.postcode), 1]]);
    if (cert.install && cert.install.occupier) row(k, x, w, [['Occupier:', cert.install.occupier, 1]]);
  });
  k.section('2. DANGEROUS CONDITION FOUND', (k, x, w) => {
    checks(k, x, [['C1 – ' + CODE_TEXT.C1, n.code === 'C1'], ['C2 – ' + CODE_TEXT.C2, n.code === 'C2']], { size: 7.2 });
    textBlock(k, x, w, 'Description of the danger:', n.text, { minLines: 3 });
    row(k, x, w, [['Location / circuit:', n.location, 0.65], ['BS 7671 regulation(s):', n.reg, 0.35]]);
  });
  k.section('3. ACTION TAKEN', (k, x, w) => {
    ACTIONS.forEach(([key, label]) => { const yy = k.y + 3.4; k.cb(x, yy, n.action === key, label, { size: 7.5 }); k.y += 4.6; });
    if (n.action === 'other' || n.actionOther) textBlock(k, x, w, 'Details:', n.actionOther, { minLines: 1 });
    checks(k, x, [['The person responsible for the installation has been informed of the danger', !!n.informed]]);
  });
  k.section('4. RECOMMENDED REMEDIAL ACTION', (k, x, w) => textBlock(k, x, w, '', n.remedial, { minLines: 3 }));
  k.section('5. ADVICE TO THE PERSON RESPONSIBLE', (k, x, w) => {
    const ps = [
      'During the inspection and testing of the electrical installation, the condition described above was found. It does not comply with the requirements of BS 7671 (Requirements for Electrical Installations) and is considered dangerous (C1) or potentially dangerous (C2) to persons or livestock.',
      n.action === 'isolated' ? 'The affected part of the installation has been isolated. Do not reconnect or use it until the remedial work has been carried out by a competent person.'
        : n.action === 'refused' ? 'Isolation was recommended but was not permitted. Continuing to use the affected part of the installation is at the risk of the person responsible.'
          : 'Do not use or interfere with the affected part of the installation until the remedial work has been carried out by a competent person.',
      'Remedial work should be carried out by a competent person as a matter of urgency. The duty holder is responsible for ensuring that electrical systems are maintained so as to prevent danger (Electricity at Work Regulations 1989, where they apply).',
    ];
    ps.forEach((s) => { k.y += k.para(s, x, k.y + 3, w, { size: 7.4, gap: 1 }); });
    k.y += 1;
  });
  k.section('6. ISSUED BY', (k, x, w) => {
    row(k, x, w, [['Name:', (cert.people && (cert.people.inspector || cert.people.installer || cert.people.mw || {}).name) || profile.name, 0.5], ['For/on behalf of:', profile.business, 0.5]]);
    k.y += 8; sig(k, x, k.y, w * 0.6 - 3, n.sig); k.field('Date:', fmtDate(n.date), x + w * 0.6, k.y, w * 0.4); k.y += 3;
  });
  k.section('7. RECEIVED BY (CLIENT / PERSON RESPONSIBLE)', (k, x, w) => {
    k.y += k.para('I confirm that I have received this notification and understand the danger described above.', x, k.y + 3, w, { size: 7.2 });
    row(k, x, w, [['Name:', n.custName, 1]]);
    k.y += 8; sig(k, x, k.y, w * 0.6 - 3, n.custSig); k.field('Date:', n.custSig ? fmtDate(n.date) : '', x + w * 0.6, k.y, w * 0.4); k.y += 3;
  }, { note: '(optional)' });
  k.footers(no);
  return k.blob();
}
export const dangerName = (cert, n) => `${noticeNo(cert, n)} ${String((cert.install && cert.install.address) || '').split(/[,\n]/)[0].trim()}`.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') + '.pdf';
