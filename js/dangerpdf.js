// =====================================================================
// dangerpdf.js — v0.17: the Danger Notification PDF, in the same style as
// the certificates. One notice can list several items (a table that runs
// onto a continuation page with its heading repeated). Wording is kept
// general: BS 7671 and the Electricity at Work Regulations 1989, without
// quoting regulation numbers.
// =====================================================================
import { Kit, loadJsPDF, VALUE, GREY, INK, RED } from './pdfkit.js';
import { brandStrip, contTitle, row, checks, textBlock, sig, fmtDate } from './pdf.js';
import { TYPES } from './certmodel.js';
import { CODE_TEXT } from './inspections.js';
import { ACTIONS, SHORT, noticeNo, migrateNotice, itemAction, itemRemedial } from './dangermodel.js';

const joinAddr = (a, pc) => [String(a || '').trim(), String(pc || '').trim()].filter(Boolean).join('\n');

function itemsTable(k, n, no) {
  const x = k.x0; const w = k.cw;
  const cols = [['No.', 9], ['Code', 12], ['Dangerous condition found, location (regulation)', 0], ['Action taken', 34], ['Recommended remedial action', 58]];
  const fixed = cols.reduce((s, c) => s + c[1], 0); cols[2][1] = w - fixed;
  const xs = []; let cx = x; for (const c of cols) { xs.push(cx); cx += c[1]; }
  const bottom = k.H - k.M - 8;
  const head = (cont) => {
    k.t('2. DANGEROUS CONDITION(S) FOUND' + (cont ? ' (continued)' : ''), x + 1.8, k.y + 3.6, { size: 8.5, bold: true }); k.y += 5;
    k.rect(x, k.y, w, 6, { lw: 0.35, color: INK, fill: [238, 238, 238] });
    cols.forEach(([t, cw], i) => k.t(t, xs[i] + 1.5, k.y + 4, { size: 6.8, bold: true, maxW: cw - 2 }));
    k.y += 6;
  };
  const cells = (it) => {
    const a = itemAction(n, it); const shared = !it.action;
    const act = a.action ? (shared ? 'As section 3' : SHORT[a.action] + (a.action === 'other' && a.other ? ': ' + a.other : '')) : '';
    const rem = String(it.remedial || '').trim() ? it.remedial : (itemRemedial(n, it) ? 'As section 4' : '');
    const desc = [it.text, it.location ? 'Location: ' + it.location : '', it.reg ? '(Reg. ' + it.reg + ')' : ''].filter(Boolean).join('\n');
    return [desc, act, rem].map((s, j) => String(s || '').split('\n').flatMap((p) => k.wrap(p, cols[j + 2][1] - 3, 7.8)));
  };
  head(false);
  const items = n.items.length ? n.items : [{}];
  items.forEach((it, i) => {
    const c = it.text !== undefined ? cells(it) : [[], [], []];
    const h = Math.max(7, Math.max(...c.map((l) => l.length)) * 3.4 + 2.6);
    if (k.y + h > bottom) { k.addPage('p'); contTitle(k, 'DANGER NOTIFICATION (continued)', no); head(true); }
    k.rect(x, k.y, w, h, { lw: 0.2 }); xs.slice(1).forEach((xx) => k.line(xx, k.y, xx, k.y + h));
    if (it.text !== undefined) {
      k.t(String(i + 1), xs[0] + cols[0][1] / 2, k.y + 4.2, { size: 8, color: VALUE, align: 'center' });
      k.t(it.code, xs[1] + cols[1][1] / 2, k.y + 4.2, { size: 9, bold: true, color: RED, align: 'center' });
      c.forEach((ls, j) => ls.forEach((s, m) => k.t(s, xs[j + 2] + 1.5, k.y + 4 + m * 3.4, { size: 7.8, color: VALUE })));
    }
    k.y += h;
  });
  k.y += 1; k.y += k.para(`C1 – ${CODE_TEXT.C1}.   C2 – ${CODE_TEXT.C2}.`, x, k.y + 2.5, w, { size: 6.6, color: GREY }); k.y += 1.5;
}

export async function dangerPdf(cert, n, profile = {}) {
  migrateNotice(n);
  const { jsPDF } = await loadJsPDF();
  const no = noticeNo(cert, n);
  const k = new Kit(jsPDF, { orientation: 'p', footer: 'Danger notification issued with ' + ((TYPES[cert.type] || {}).name || 'certificate') + ' ' + (cert.number || '') + (profile.business ? '.  Issued by ' + profile.business + '.' : '.') });
  brandStrip(k, profile, 'DANGER NOTIFICATION', no, 'Notification of dangerous or potentially dangerous conditions found in the electrical installation at the address below.');
  k.rect(k.x0, k.y, k.cw, 9, { lw: 0.4, color: RED, fill: [252, 236, 236] });
  k.t('IMPORTANT – PLEASE READ. This notice concerns your safety.', k.x0 + 3, k.y + 5.8, { size: 9.5, bold: true, color: RED });
  k.t(`${n.items.length} item${n.items.length === 1 ? '' : 's'}`, k.x1 - 3, k.y + 5.8, { size: 8.5, bold: true, color: RED, align: 'right' });
  k.y += 11;
  k.section('1. DETAILS OF THE INSTALLATION', (k, x, w) => {
    row(k, x, w, [['Client / person responsible:', cert.client && cert.client.name, 0.5], ['Related certificate/report No.:', cert.number, 0.5]]);
    row(k, x, w, [['Installation address:', joinAddr(cert.install && cert.install.address, cert.install && cert.install.postcode), 0.65], ['Occupier:', cert.install && cert.install.occupier, 0.35]]);
  });
  itemsTable(k, n, no);
  const sharedAct = !n.items.length || n.items.some((i) => !i.action);
  const sharedRem = !n.items.length || n.items.some((i) => !String(i.remedial || '').trim());
  k.section('3. ACTION TAKEN', (k, x, w) => {
    if (sharedAct) {
      ACTIONS.forEach(([key, label], j) => { const yy = k.y + 3.4; k.cb(x + (j % 2) * w / 2, yy, n.action === key, label, { size: 7.2 }); if (j % 2) k.y += 4.6; });
      if (n.action === 'other' || n.actionOther) textBlock(k, x, w, 'Details:', n.actionOther, { minLines: 1 });
    } else k.y += k.para('The action taken for each item is shown in the table above.', x, k.y + 3, w, { size: 7.4 });
    checks(k, x, [['The person responsible for the installation has been informed of the danger(s)', !!n.informed]]);
  }, { note: sharedAct && n.items.some((i) => i.action) ? '(where the table says "As section 3")' : '' });
  k.section('4. RECOMMENDED REMEDIAL ACTION', (k, x, w) => {
    if (sharedRem) textBlock(k, x, w, '', n.remedial, { minLines: 2 });
    else k.y += k.para('The recommended remedial action for each item is shown in the table above.', x, k.y + 3, w, { size: 7.4 });
  }, { note: sharedRem && n.items.some((i) => String(i.remedial || '').trim()) ? '(where the table says "As section 4")' : '' });
  k.section('5. ADVICE TO THE PERSON RESPONSIBLE', (k, x, w) => {
    const acts = new Set(n.items.map((i) => itemAction(n, i).action));
    const ps = [
      'During the inspection and testing of the electrical installation, the condition(s) listed above were found. They do not comply with the requirements of BS 7671 (Requirements for Electrical Installations) and are considered dangerous (C1) or potentially dangerous (C2) to persons or livestock.',
      acts.has('isolated') ? 'Where a part of the installation has been isolated, do not reconnect or use it until the remedial work has been carried out by a competent person.' : '',
      acts.has('refused') ? 'Where isolation was recommended but not permitted, continuing to use the affected part of the installation is at the risk of the person responsible.' : '',
      'Do not use or interfere with any affected part of the installation until the remedial work has been carried out. Remedial work should be carried out by a competent person as a matter of urgency. The duty holder is responsible for ensuring that electrical systems are maintained so as to prevent danger (Electricity at Work Regulations 1989, where they apply).',
    ].filter(Boolean);
    ps.forEach((s) => { k.y += k.para(s, x, k.y + 3, w, { size: 7.2, gap: 0.8 }); });
    k.y += 1;
  });
  const issued = (cert.people && (cert.people.inspector || cert.people.installer || cert.people.mw || {}).name) || profile.name;
  k.section('6. ISSUED BY', (k, x, w) => {
    row(k, x, w, [['Name:', issued, 0.5], ['For/on behalf of:', profile.business, 0.5]]);
    k.y += 8; sig(k, x, k.y, w * 0.6 - 3, n.sig); k.field('Date:', fmtDate(n.date), x + w * 0.6, k.y, w * 0.4); k.y += 3;
  });
  k.section('7. RECEIVED BY (CLIENT / PERSON RESPONSIBLE)', (k, x, w) => {
    k.y += k.para('I confirm that I have received this notification and understand the danger(s) described above.', x, k.y + 3, w, { size: 7.2 });
    row(k, x, w, [['Name:', n.custName, 1]]);
    k.y += 8; sig(k, x, k.y, w * 0.6 - 3, n.custSig); k.field('Date:', n.custSig ? fmtDate(n.date) : '', x + w * 0.6, k.y, w * 0.4); k.y += 3;
  }, { note: '(optional)' });
  // Uses the space at the bottom: a record for when the work is done (filled in by hand later).
  k.section('8. REMEDIAL WORK COMPLETED', (k, x, w) => {
    k.y += k.para('To be completed when the remedial work has been carried out. Keep this notice with your certificate or report.', x, k.y + 3, w, { size: 7, color: GREY });
    row(k, x, w, [['Item No(s).:', '', 0.3], ['Work carried out by:', '', 0.7]]);
    row(k, x, w, [['Certificate issued for the work (No.):', '', 0.6], ['Date:', '', 0.4]]);
    k.y += 7; sig(k, x, k.y, w * 0.6 - 3, null); k.y += 2;
  }, { note: '(to be filled in later)' });
  k.footers(no);
  return k.blob();
}
export const dangerName = (cert, n) => `${noticeNo(cert, n)} ${String((cert.install && cert.install.address) || '').split(/[,\n]/)[0].trim()}`.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') + '.pdf';
