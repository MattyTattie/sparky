// =====================================================================
// dangerui.js — v0.17: the Danger notice form. One notice can cover
// several C1/C2 observations (tick which), each with its own wording and,
// if needed, its own action/remedial; the customer signs once.
// =====================================================================
import * as db from './db.js';
import { h, fill, toast, confirmBox, modal, withIcon } from './ui.js';
import { route, page, go } from './app.js';
import { openCert, changed, flush, getProfile } from './state.js';
import { CODE_TEXT } from './inspections.js';
import { ACTIONS, blankNotice, blankItem, noticesOf, noticeForObs, noticeMissing, noticeNo, openNotices, addObs, removeObs, dangerCodes, itemFromObs } from './dangermodel.js';
import { sigPad, savePdf, emailFor } from './certui.js';

// From an observation's button: already on a notice → open it; open notices → add to one or start new.
async function fromObs(cert, id, obsId) {
  const o = (cert.observations || []).find((x) => x.id === obsId);
  const on = o && noticeForObs(cert, o); if (on) return go(`#/cert/${id}/danger/${on.id}`);
  const open = o ? openNotices(cert) : [];
  let target = 'new';
  if (open.length) {
    target = await modal('Danger notice', h('p', {}, 'Add this observation to a notice you haven\u2019t signed yet, or start a new one?'),
      [...open.map((n) => ({ label: `Add to ${noticeNo(cert, n)} (${n.items.length} item${n.items.length === 1 ? '' : 's'})`, value: n.id, cls: 'primary' })), { label: 'Start a new notice', value: 'new' }, { label: 'Cancel', value: null }]);
    if (!target) return go(`#/cert/${id}/s/observations`);
  }
  let n;
  if (target === 'new') { n = blankNotice(cert, null, db.newId()); if (o && !n.items.some((i) => i.obsId === o.id)) n.items.unshift(itemFromObs(o)); cert.dangerNotices.push(n); }
  else { n = cert.dangerNotices.find((x) => x.id === target); addObs(cert, n, o); }
  changed(); return go(`#/cert/${id}/danger/${n.id}`);
}

route(/^\/cert\/([^/]+)\/danger\/([^/]+)$/, async (id, nid) => {
  const cert = await openCert(id); if (!cert) return go('#/');
  if (!Array.isArray(cert.dangerNotices)) cert.dangerNotices = [];
  noticesOf(cert); // migrate older single-item notices
  if (nid.startsWith('obs-')) return fromObs(cert, id, nid.slice(4));
  let n = cert.dangerNotices.find((x) => x.id === nid);
  if (!n) { n = blankNotice(cert, null, db.newId()); cert.dangerNotices.push(n); changed(); return go(`#/cert/${id}/danger/${n.id}`); }
  const back = `#/cert/${id}`;
  const status = h('div');
  const showStatus = () => { const m = noticeMissing(n); fill(status, h('div', { class: 'notice ' + (m.length ? 'amber' : 'green') }, m.length ? 'Still to do: ' + m.join(', ') + '.' : 'Ready to hand over. Make the PDF below.')); };
  const bind = (obj, k) => ({ value: obj[k] || '', oninput: (e) => { obj[k] = e.target.value; changed(); showStatus(); } });
  const actionPick = (obj, name, { allowShared = false } = {}) => {
    const box = h('div');
    const other = () => h('label', { class: 'f sub' }, h('span', {}, 'Details of the action taken'), h('textarea', bind(obj, 'actionOther')));
    const opts = allowShared ? [['', 'Same as the whole notice'], ...ACTIONS] : ACTIONS;
    const draw = () => fill(box, opts.map(([k, label]) => h('label', { class: 'check radio' }, h('input', { type: 'radio', name, checked: (obj.action || '') === k, onchange: () => { obj.action = k; changed(); draw(); showStatus(); } }), label)), obj.action === 'other' ? other() : null);
    draw(); return box;
  };

  // ----- items -----
  const itemsBox = h('div');
  const pickBox = h('div');
  const drawPick = () => {
    const obs = (cert.observations || []).filter(dangerCodes);
    fill(pickBox, obs.length ? h('div', { class: 'card', id: 'dnpick' }, h('h2', {}, 'Which observations go on this notice'),
      obs.map((o) => { const other = noticeForObs(cert, o); const mine = other === n;
        return h('label', { class: 'check' + (other && !mine ? ' dim' : '') }, h('input', { type: 'checkbox', checked: mine, disabled: other && !mine ? true : null, onchange: (e) => { if (e.target.checked) addObs(cert, n, o); else removeObs(n, o.id); changed(); drawItems(); drawPick(); showStatus(); } }),
          h('span', {}, h('b', { class: 'code ' + o.code.toLowerCase() }, o.code), ' ', o.text || '(no text)', o.location ? h('span', { class: 'note' }, ' · ' + o.location) : null, other && !mine ? h('span', { class: 'note' }, ' · on ' + noticeNo(cert, other)) : null)); })) : null);
  };
  const itemCard = (it, i) => {
    const chips = h('div', { class: 'chips' });
    const dc = () => fill(chips, ['C1', 'C2'].map((c) => h('button', { class: 'chip ' + c.toLowerCase() + (it.code === c ? ' on' : ''), onclick: () => { it.code = c; changed(); dc(); } }, c)));
    dc();
    const own = !!(it.action || String(it.remedial || '').trim());
    return h('div', { class: 'card dnitem' },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, h('b', {}, 'Item ' + (i + 1)), chips),
      h('label', { class: 'f' }, h('span', {}, 'Description of the danger'), h('textarea', bind(it, 'text'))),
      h('div', { class: 'grid2' }, h('label', { class: 'f' }, h('span', {}, 'Location / circuit'), h('input', bind(it, 'location'))), h('label', { class: 'f' }, h('span', {}, 'Regulation(s)'), h('input', bind(it, 'reg')))),
      h('details', { class: 'dnown', open: own ? true : null }, h('summary', {}, 'Different action or remedial for this item'),
        actionPick(it, 'act-' + it.id, { allowShared: true }),
        h('label', { class: 'f' }, h('span', {}, 'Remedial action for this item (leave blank to use the shared one)'), h('textarea', bind(it, 'remedial')))),
      h('div', { class: 'btns' }, it.obsId ? h('span', { class: 'note' }, 'From the observations. Changes here only change the notice.') : null,
        h('button', { class: 'btn tiny warn', onclick: () => { n.items.splice(i, 1); changed(); drawItems(); drawPick(); showStatus(); } }, 'Take off this notice')));
  };
  const drawItems = () => fill(itemsBox, n.items.length ? n.items.map(itemCard) : h('div', { class: 'notice amber' }, 'No items yet. Tick an observation above or add one.'),
    h('div', { class: 'btns full' }, h('button', { class: 'btn', onclick: () => { n.items.push(blankItem()); changed(); drawItems(); showStatus(); } }, '+ Add an item that isn\u2019t an observation')));

  const sigBox = (key, label) => { const box = h('div', { class: 'card sigcard' }); const draw = () => fill(box, h('b', {}, label),
    n[key] && n[key].img ? h('img', { class: 'sigimg', src: n[key].img, alt: 'Signature' }) : h('p', { class: 'note' }, 'Not signed yet.'),
    h('div', { class: 'btns' }, h('button', { class: 'btn primary small', onclick: async () => { const img = await sigPad(); if (img) { n[key] = { img, date: new Date().toISOString().slice(0, 10) }; changed(); draw(); showStatus(); } } }, n[key] && n[key].img ? 'Sign again' : 'Sign'),
      n[key] && n[key].img ? h('button', { class: 'btn small warn', onclick: () => { n[key] = null; changed(); draw(); showStatus(); } }, 'Clear') : null));
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
  drawPick(); drawItems(); showStatus();
  page('Danger notice', [
    h('div', { class: 'notice red dnhead' }, withIcon('alert', h('b', {}, noticeNo(cert, n))), h('div', { class: 'note' }, 'For ' + cert.number + (cert.install.address ? ' · ' + String(cert.install.address).split(/[,\n]/)[0] : ''))),
    status, pickBox,
    h('h3', { class: 'fhead' }, 'Items on this notice'), itemsBox,
    h('div', { class: 'card' }, h('h2', {}, 'Action taken'), h('p', { class: 'note' }, 'Applies to every item, unless you set a different one on the item.'), actionPick(n, 'dnact'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!n.informed, onchange: (e) => { n.informed = e.target.checked; changed(); } }), 'The customer / person responsible has been told about the danger(s)')),
    h('div', { class: 'card' }, h('h2', {}, 'Recommended remedial action'),
      h('label', { class: 'f' }, h('span', {}, 'What needs doing (all items, unless set on the item)'), h('textarea', { ...bind(n, 'remedial'), placeholder: 'e.g. Replace damaged accessories and re-test the affected circuits' })),
      h('label', { class: 'f' }, h('span', {}, 'Date'), h('input', { type: 'date', ...bind(n, 'date') })),
      h('p', { class: 'note' }, 'C1: ' + CODE_TEXT.C1 + '. C2: ' + CODE_TEXT.C2 + '.')),
    sigBox('sig', 'Your signature'),
    h('div', { class: 'card' }, h('h2', {}, 'Customer (optional)'), h('p', { class: 'note' }, 'If they\u2019re there, they sign once for the whole notice.'),
      h('label', { class: 'f' }, h('span', {}, 'Name'), h('input', bind(n, 'custName')))),
    sigBox('custSig', 'Customer signature'),
    h('div', { class: 'card' }, h('h2', {}, 'PDF'), h('p', { class: 'note' }, 'Separate from the certificate, which notes that it was issued. Email opens your own mail app with it attached; nothing is sent until you press send.'),
      h('div', { class: 'btns full' }, h('button', { class: 'btn primary', onclick: (e) => pdf(e.currentTarget, 'view') }, 'View PDF'), h('button', { class: 'btn', id: 'dnemail', onclick: (e) => pdf(e.currentTarget, 'email') }, withIcon('mail', 'Email to customer')))),
    h('div', { class: 'btns full' }, h('button', { class: 'btn warn', onclick: async () => { if (await confirmBox('Delete danger notice?', noticeNo(cert, n) + ' will be removed. The observations stay.', 'Delete', 'warn')) { cert.dangerNotices.splice(cert.dangerNotices.indexOf(n), 1); changed(); await flush(); go(back); } } }, 'Delete danger notice')),
  ], { back, sub: cert.number });
});
