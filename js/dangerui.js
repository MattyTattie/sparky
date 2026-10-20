// =====================================================================
// dangerui.js — v0.17: the Danger notice form (from a C1/C2 observation,
// or a new one from the certificate page), its PDF and "Email to customer".
// =====================================================================
import * as db from './db.js';
import { h, fill, toast, confirmBox, withIcon } from './ui.js';
import { route, page, go } from './app.js';
import { openCert, changed, flush, getProfile } from './state.js';
import { CODE_TEXT } from './inspections.js';
import { ACTIONS, blankNotice, noticesOf, noticeForObs, noticeMissing, noticeNo } from './dangermodel.js';
import { sigPad, savePdf, emailFor } from './certui.js';

route(/^\/cert\/([^/]+)\/danger\/([^/]+)$/, async (id, nid) => {
  const cert = await openCert(id); if (!cert) return go('#/');
  if (!Array.isArray(cert.dangerNotices)) cert.dangerNotices = [];
  let n = cert.dangerNotices.find((x) => x.id === nid);
  if (!n) {
    const obs = nid.startsWith('obs-') ? (cert.observations || []).find((o) => o.id === nid.slice(4)) : null;
    n = (obs && noticeForObs(cert, obs)) || null;
    if (!n) { n = blankNotice(cert, obs, db.newId()); cert.dangerNotices.push(n); changed(); }
    return go(`#/cert/${id}/danger/${n.id}`);
  }
  const back = n.obsId ? `#/cert/${id}/s/observations` : `#/cert/${id}`;
  const status = h('div');
  const showStatus = () => { const m = noticeMissing(n); fill(status, h('div', { class: 'notice ' + (m.length ? 'amber' : 'green') }, m.length ? 'Still to do: ' + m.join(', ') + '.' : 'Ready to hand over. Make the PDF below.')); };
  const upd = (k) => (e) => { n[k] = e.target.value; changed(); showStatus(); };
  const codeChips = h('div', { class: 'chips' });
  const dc = () => fill(codeChips, ['C1', 'C2'].map((c) => h('button', { class: 'chip ' + c.toLowerCase() + (n.code === c ? ' on' : ''), onclick: () => { n.code = c; changed(); dc(); } }, c)));
  dc();
  const acts = h('div');
  const other = h('label', { class: 'f sub' }, h('span', {}, 'Details of the action taken'), h('textarea', { value: n.actionOther || '', oninput: upd('actionOther') }));
  const da = () => { fill(acts, ACTIONS.map(([k, label]) => h('label', { class: 'check radio' }, h('input', { type: 'radio', name: 'dnact', checked: n.action === k, onchange: () => { n.action = k; changed(); da(); showStatus(); } }), label)), n.action === 'other' || n.actionOther ? other : null); };
  da();
  const sigBox = (key, label, onClear) => { const box = h('div', { class: 'card sigcard' }); const draw = () => fill(box, h('b', {}, label),
    n[key] && n[key].img ? h('img', { class: 'sigimg', src: n[key].img, alt: 'Signature' }) : h('p', { class: 'note' }, 'Not signed yet.'),
    h('div', { class: 'btns' }, h('button', { class: 'btn primary small', onclick: async () => { const img = await sigPad(); if (img) { n[key] = { img, date: new Date().toISOString().slice(0, 10) }; changed(); draw(); showStatus(); } } }, n[key] && n[key].img ? 'Sign again' : 'Sign'),
      n[key] && n[key].img ? h('button', { class: 'btn small warn', onclick: () => { n[key] = null; changed(); draw(); showStatus(); if (onClear) onClear(); } }, 'Clear') : null));
    draw(); return box; };
  const pdf = async (btn, how) => {
    await flush(); const label = btn.textContent; btn.disabled = true; btn.textContent = 'Making PDF…';
    try {
      const { dangerPdf, dangerName } = await import('./dangerpdf.js');
      const blob = await dangerPdf(cert, n, await getProfile()); const name = dangerName(cert, n);
      await savePdf(cert, blob, name, 'pdf');
      if (how === 'view') (await import('./pdfview.js')).viewPdf(blob, name, { shareText: 'Danger notification ' + noticeNo(cert, n), email: () => emailFor(cert, blob, name, n) });
      else await emailFor(cert, blob, name, n);
    } catch (e) { console.error(e); toast('Couldn\u2019t make the PDF: ' + ((e && e.message) || 'unknown error')); }
    btn.disabled = false; btn.textContent = label;
  };
  showStatus();
  page('Danger notice', [
    h('div', { class: 'notice red dnhead' }, withIcon('alert', h('b', {}, noticeNo(cert, n))), h('div', { class: 'note' }, 'For ' + cert.number + (cert.install.address ? ' · ' + String(cert.install.address).split(/[,\n]/)[0] : ''))),
    status,
    h('div', { class: 'card' }, h('h2', {}, 'The danger'),
      h('div', {}, h('span', { class: 'note' }, 'Code'), codeChips), h('p', { class: 'note' }, 'C1: ' + CODE_TEXT.C1 + '. C2: ' + CODE_TEXT.C2 + '.'),
      h('label', { class: 'f' }, h('span', {}, 'Description of the danger'), h('textarea', { value: n.text, oninput: upd('text') })),
      h('label', { class: 'f' }, h('span', {}, 'Location / circuit'), h('input', { value: n.location || '', oninput: upd('location') })),
      h('label', { class: 'f' }, h('span', {}, 'Regulation(s) (optional)'), h('input', { value: n.reg || '', oninput: upd('reg') })),
      n.obsId ? h('p', { class: 'note' }, 'Filled in from the observation. Changes here only change the notice.') : null),
    h('div', { class: 'card' }, h('h2', {}, 'Action taken'), acts,
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!n.informed, onchange: (e) => { n.informed = e.target.checked; changed(); } }), 'The customer / person responsible has been told about the danger')),
    h('div', { class: 'card' }, h('h2', {}, 'Recommended remedial action'),
      h('label', { class: 'f' }, h('span', {}, 'What needs doing'), h('textarea', { value: n.remedial || '', placeholder: 'e.g. Replace damaged accessory and re-test the circuit', oninput: upd('remedial') })),
      h('label', { class: 'f' }, h('span', {}, 'Date'), h('input', { type: 'date', value: n.date || '', oninput: upd('date') }))),
    sigBox('sig', 'Your signature'),
    h('div', { class: 'card' }, h('h2', {}, 'Customer (optional)'), h('p', { class: 'note' }, 'If they\u2019re there, they can sign on the screen to say they got it.'),
      h('label', { class: 'f' }, h('span', {}, 'Name'), h('input', { value: n.custName || '', oninput: upd('custName') }))),
    sigBox('custSig', 'Customer signature'),
    h('div', { class: 'card' }, h('h2', {}, 'PDF'), h('p', { class: 'note' }, 'A one-page notice, separate from the certificate. The certificate notes that it was issued. Email opens your own mail app with it attached; nothing is sent until you press send.'),
      h('div', { class: 'btns full' }, h('button', { class: 'btn primary', onclick: (e) => pdf(e.currentTarget, 'view') }, 'View PDF'), h('button', { class: 'btn', id: 'dnemail', onclick: (e) => pdf(e.currentTarget, 'email') }, withIcon('mail', 'Email to customer')))),
    h('div', { class: 'btns full' }, h('button', { class: 'btn warn', onclick: async () => { if (await confirmBox('Delete danger notice?', noticeNo(cert, n) + ' will be removed.', 'Delete', 'warn')) { cert.dangerNotices.splice(cert.dangerNotices.indexOf(n), 1); changed(); await flush(); go(back); } } }, 'Delete danger notice')),
  ], { back, sub: cert.number });
});
