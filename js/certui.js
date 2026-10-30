// =====================================================================
// certui.js — a certificate: overview, form sections, inspections,
// observations, signatures and the PDF.
// =====================================================================
import { findOldPdf } from './filerules.js';
import * as db from './db.js';
import { h, fill, toast, modal, confirmBox, fmtDate, shareOrDownload, blobToDataUrl, emptyState, icon, withIcon } from './ui.js';
import { route, page, go, render } from './app.js';
import { S, openCert, changed, flush, getProfile, defaultInstruments, defaultInstrumentIds, getInstruments, instrumentsFor, instrumentText, calibrationWarnings, INSTRUMENT_KINDS, saveSetting } from './state.js';
import { calDateFields, CAL_DATE_WARN } from './instruments.js';
import { screenSections, countsToward, pdfFlagsOn } from './certmodel.js';
import { TYPES, newCert, sectionsFor, sectionDone, missingFields, visible, get, set, eicrOverall, blankBond, BOND_LOCATIONS, BOND_PARTS, SOURCE_TYPES, blankSource, sourcesMissing, isNewInstall } from './certmodel.js';
import { INTAKE_NOTE_10, INTAKE_NOTES, INTAKE_NOTIFIED, migrateIntake, EIC_ITEMS, EIC_OUTCOMES, EICR_ITEMS, EICR_OUTCOMES, CODE_TEXT, OBSERVATIONS, OBS_CATS, EIC_HELP, EICR_HELP } from './inspections.js';
import { checkCircuit, isSpare } from './checks.js';
import { CHECK_NOTE } from './limits.js';
import { diagramSvg, diagramInPdf, diagramHasCircuits, SPUR_FEEDS } from './wiring.js';
import { limitOn, limitBar } from './limitbar.js';
import { dangerCodes, noticeForObs, noticesOf, noticeMissing, noticeNo } from './dangermodel.js';

export async function createCert(type, job, cust) {
  const profile = await getProfile();
  const number = (profile.certPrefix || '') + await db.nextNumber(TYPES[type].prefix);
  const c = newCert(type, { job, customer: cust || {}, profile, instruments: await defaultInstruments(), number });
  if (type === 'EICR') c.eicr.overall = '';
  c.instrumentIds = await defaultInstrumentIds(); // v0.26, optional
  await db.put('certs', c); return c;
}

// One form field, wired to autosave. v0.8: showIf/hideIf (see visible()),
// dflt (a tick worked out from the data until you change it), placeholder
// (text or (cert) => text), hint, indent (sits under the tick that opens it).
export function field(cert, fd, onChange) {
  const val = get(cert, fd.k);
  const upd = (v) => { set(cert, fd.k, v); changed(); if (onChange) onChange(fd.k, v, fd); };
  if (!visible(cert, fd)) return null;
  const cls = fd.indent ? ' sub' : '';
  const hintT = typeof fd.hint === 'function' ? fd.hint(cert) : fd.hint; // v0.34: hint can be worked out
  const hint = hintT ? h('div', { class: 'note fhint' }, hintT) : null;
  if (fd.type === 'heading') return h('h3', { class: 'fhead' }, fd.label);
  if (fd.type === 'check') return h('label', { class: 'check' + cls }, h('input', { type: 'checkbox', checked: !!(val == null && fd.dflt ? fd.dflt(cert) : val), onchange: (e) => upd(e.target.checked) }), fd.label);
  if (fd.type === 'chips') {
    const box = h('div', { class: 'chips' });
    const draw = () => fill(box, ...fd.opts.map((o) => h('button', { class: 'chip' + (get(cert, fd.k) === o ? ' on' : ''), onclick: () => { upd(get(cert, fd.k) === o ? '' : o); draw(); } }, o)));
    draw();
    return h('div', { class: 'f' + cls, style: 'margin-bottom:12px' }, h('span', { class: 'note', style: 'display:block;margin-bottom:4px' }, fd.label), box, hint);
  }
  if (fd.type === 'select') return h('label', { class: 'f' + cls }, h('span', {}, fd.label), h('select', { onchange: (e) => upd(e.target.value) }, fd.opts.map((o) => h('option', { selected: o === val ? true : null }, o))), hint);
  const tag = fd.type === 'area' ? 'textarea' : 'input';
  const ph = typeof fd.placeholder === 'function' ? fd.placeholder(cert) : fd.placeholder;
  const ev = fd.redraw === 'blur' ? { oninput: (e) => set(cert, fd.k, e.target.value) || changed(), onchange: (e) => upd(e.target.value) } : { oninput: (e) => upd(e.target.value) };
  const act = fd.action ? h('a', { class: 'btn small fact', href: fd.action.href(cert) }, fd.action.label + ' \u2192') : null;
  return h('label', { class: 'f' + cls }, h('span', {}, fd.label), h(tag, { type: fd.type === 'date' ? 'date' : tag === 'input' ? 'text' : null, inputmode: fd.type === 'num' ? 'decimal' : null, value: val ?? '', placeholder: ph || null, ...ev }), hint, act);
}

// ---------- Overview ----------
route(/^\/cert\/([^/]+)$/, async (id) => {
  const cert = await openCert(id); if (!cert) return go('#/');
  const job = cert.jobId ? await db.get('jobs', cert.jobId) : null;
  const secs = screenSections(cert.type);
  const counted = secs.filter(countsToward);
  const nFlags = (cert.boards || []).reduce((n, b) => n + b.circuits.filter((c) => checkCircuit(c, { earthing: cert.supply.earthing, zdb: b.zdb }).worst === 'red').length, 0) + (cert.type === 'MW' && checkCircuit(cert.mw.circuit, { earthing: cert.mw.earthing, zdb: cert.mw.zdb }).worst === 'red' ? 1 : 0);
  const done = counted.filter((s) => sectionDone(cert, s)).length;
  const nextSec = secs.find((s) => s.special !== 'sign' && countsToward(s) && !sectionDone(cert, s)) || secs.find((s) => countsToward(s) && !sectionDone(cert, s));
  const secHref = (s) => (s.special === 'boards' ? `#/cert/${id}/boards` : `#/cert/${id}/s/${s.id}`);
  const warns = await calibrationWarnings();
  page(TYPES[cert.type].name, [
    h('div', { class: 'card' },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, h('b', {}, cert.number), cert.status === 'issued' ? h('span', { class: 'pill green' }, 'Issued ' + fmtDate(cert.issuedAt)) : h('span', { class: 'pill' }, 'Draft')),
      h('div', { class: 'note' }, [cert.client.name, (cert.install.address || '').split(/[,\n]/)[0]].filter(Boolean).join(' · ')),
      limitOn() ? limitBar(done, counted.length) : h('div', { class: 'prog', style: 'margin-top:10px' }, h('i', { style: `width:${Math.round((done / counted.length) * 100)}%` })),
      h('div', { class: 'note', style: 'margin-top:4px' }, `${done} of ${counted.length} sections filled in`),
      cert.status !== 'issued' && nextSec ? h('a', { class: 'btn primary', id: 'continuebtn', style: 'display:block;margin-top:10px;text-align:center', href: secHref(nextSec) }, 'Continue: ' + nextSec.title + ' \u203a') : null),
    nFlags ? h('div', { class: 'notice red' }, `${nFlags} circuit(s) have a reading outside the limits. Check the schedule before issuing.`) : null,
    warns.map((w) => h('div', { class: 'notice ' + w.level }, w.text)),
    h('div', { class: 'list' }, secs.map((s) => h('a', { class: 'row', href: s.special === 'boards' ? `#/cert/${id}/boards` : `#/cert/${id}/s/${s.id}` },
      h('span', { class: 'dot ' + (sectionDone(cert, s) ? 'ok' : '') }), h('div', { class: 'main' }, h('div', { class: 't' }, s.title), h('div', { class: 's faint' }, 'On the IET form: section ' + s.form)), h('span', { class: 'go' }, '›'))),
      h('a', { class: 'row', href: `#/cert/${id}/s/instruments` }, h('span', { class: 'dot ' + (Object.values(cert.instruments || {}).some(Boolean) ? 'ok' : '') }), h('div', { class: 'main' }, h('div', { class: 't' }, 'Test instruments'), h('div', { class: 's' }, 'From your settings; change for this certificate')), h('span', { class: 'go' }, '›')),
      h('a', { class: 'row', href: `#/cert/${id}/diagram`, id: 'diagramrow' }, h('span', { class: 'dot ' + (diagramInPdf(cert) ? 'ok' : '') }), h('div', { class: 'main' }, h('div', { class: 't' }, 'Wiring diagram'), h('div', { class: 's' }, 'Drawn from your circuits' + (cert.diagramPdf === false ? ' · not in the PDF' : ''))), h('span', { class: 'go' }, '›')),
      job ? h('a', { class: 'row', href: `#/cert/${id}/photos` }, h('span', { class: 'dot ' + ((cert.photoIds || []).length ? 'ok' : '') }), h('div', { class: 'main' }, h('div', { class: 't' }, 'Photos on the certificate'), h('div', { class: 's' }, `${(cert.photoIds || []).length} chosen`)), h('span', { class: 'go' }, '›')) : null),
    h('div', { class: 'card' }, h('h2', {}, 'PDF'),
      h('p', { class: 'note' }, 'Laid out like the IET forms. Nothing is sent until you pick who it goes to.'),
      h('div', { class: 'btns full' }, h('button', { class: 'btn primary', id: 'sharebtn', onclick: async (e) => { const ok = await makePdf(cert, e.currentTarget, 'share'); if (ok && cert.status !== 'issued') await askIssued(cert); } }, 'Share PDF')),
      h('div', { class: 'btns small3' }, h('button', { class: 'btn small', onclick: (e) => makePdf(cert, e.currentTarget, 'view') }, 'View PDF'),
        h('button', { class: 'btn small', id: 'emailbtn', onclick: async (e) => { const ok = await makePdf(cert, e.currentTarget, 'email'); if (ok && cert.status !== 'issued') await askIssued(cert); } }, withIcon('mail', 'Email')),
        cert.type !== 'MW' ? h('button', { class: 'btn small', onclick: (e) => makeChart(cert, e.currentTarget) }, 'Circuit chart') : null),
      h('p', { class: 'note' }, 'Email opens your own mail app' + (cert.client.email ? ' (to ' + cert.client.email + ')' : '') + '. You press send yourself.' + (pdfFlagsOn(cert) ? ' Readings over the limit show in red (change in Settings).' : '')),
      cert.status !== 'issued' ? h('button', { class: 'btn', onclick: () => askIssued(cert, true) }, 'Mark as issued') : null),
    h('div', { class: 'card', id: 'dangercard' }, h('h2', {}, 'Danger notices'),
      h('p', { class: 'note' }, 'A one-page notice to hand over when you find something dangerous (C1) or potentially dangerous (C2). It prints as its own PDF.'),
      noticesOf(cert).length ? h('div', { class: 'list' }, noticesOf(cert).map((n) => h('a', { class: 'row', href: `#/cert/${id}/danger/${n.id}` }, h('span', { class: 'dot ' + (noticeMissing(n).length ? '' : 'ok') }), h('div', { class: 'main' }, h('div', { class: 't' }, noticeNo(cert, n) + ' · ' + n.items.length + ' item' + (n.items.length === 1 ? '' : 's') + (n.items.length ? ' · ' + [...new Set(n.items.map((i) => i.code))].join('/') : '')), h('div', { class: 's' }, (n.items.map((i) => i.text).filter(Boolean).join('; ') || 'No items yet').slice(0, 80))), h('span', { class: 'go' }, '›')))) : null,
      h('div', { class: 'btns full' }, h('a', { class: 'btn', href: `#/cert/${id}/danger/new` }, '+ New danger notice'))),
    h('div', { class: 'btns full' }, h('button', { class: 'btn warn', onclick: async () => { if (await confirmBox('Delete certificate?', cert.number + ' and the PDFs made from it will be removed from your devices (and from Google Drive, if it was backed up there). PDFs of your other certificates are kept.', 'Delete', 'warn')) { const { deleteCert } = await import('./certdelete.js'); await flush(); const n = await deleteCert(cert); S.cert = null; toast(n ? `Deleted, with ${n} saved PDF${n === 1 ? '' : 's'}` : 'Deleted'); go(job ? '#/job/' + job.id : '#/'); } } }, 'Delete certificate')),
  ], { back: job ? '#/job/' + job.id : '#/', sub: cert.number });
});

async function pdfPhotos(cert) {
  const out = [];
  for (const pid of cert.photoIds || []) { const f = await db.get('files', pid); if (f && f.blob) out.push({ dataUrl: await blobToDataUrl(f.blob), caption: f.caption || '' }); }
  return out;
}
export async function savePdf(cert, blob, name, kind = 'pdf') {
  if (!cert.jobId) return;
  const files = await db.byJob('files', cert.jobId);
  // Same certificate + same file name = remake of the same PDF: replace it (and re-send it to Drive) rather than adding another.
  // (Charts used to be stored as kind 'pdf', so match those too.)
  const old = findOldPdf(files, cert.id, name, kind);
  await db.put('files', { ...(old || { id: db.newId(), createdAt: new Date().toISOString() }), jobId: cert.jobId, certId: cert.id, kind, name, blob, createdAt: new Date().toISOString(), version: ((old && old.version) || 0) + 1, driveId: old && old.driveId, driveVersion: old && old.driveVersion });
}
export async function emailFor(cert, blob, name, notice = null) {
  const { emailPdf } = await import('./email.js');
  return emailPdf(cert, blob, name, { notice, profile: await getProfile() });
}
async function askIssued(cert, direct) {
  if (await confirmBox(direct ? 'Mark as issued?' : 'Sent it? Mark as issued?', 'Records today as the issue date. You can still edit it.', 'Mark issued')) { cert.status = 'issued'; cert.issuedAt = new Date().toISOString(); changed(); await flush(); render(); }
}
async function makePdf(cert, btn, how) {
  let ok = false;
  await flush(); const label = btn.textContent; btn.disabled = true; btn.textContent = 'Making PDF…';
  try {
    const { certificatePdf, pdfName } = await import('./pdf.js');
    const blob = await certificatePdf(cert, { profile: await getProfile(), photos: await pdfPhotos(cert) });
    const name = pdfName(cert); await savePdf(cert, blob, name);
    if (how === 'view') (await import('./pdfview.js')).viewPdf(blob, name, { shareText: `${TYPES[cert.type].name} ${cert.number}`, email: () => emailFor(cert, blob, name) });
    else if (how === 'email') await emailFor(cert, blob, name);
    else { const r = await shareOrDownload(blob, name, `${TYPES[cert.type].name} ${cert.number}`); if (r === 'downloaded') toast('Saved to your downloads'); }
    ok = how !== 'view';
  } catch (e) { console.error(e); toast('Couldn\u2019t make the PDF: ' + ((e && e.message) || 'the browser wouldn\u2019t save it (private browsing?)')); }
  btn.disabled = false; btn.textContent = label;
  return ok;
}
async function makeChart(cert, btn) {
  await flush(); btn.disabled = true;
  try {
    const { boardChartPdf, pdfName } = await import('./pdf.js');
    const { viewPdf } = await import('./pdfview.js');
    const how = await modal('Circuit chart PDF', h('p', {}, 'View it here, or share / save it.'), [{ label: 'Close', value: null }, { label: 'View', value: 'view' }, { label: 'Share', value: 'share', cls: 'primary' }]); // v0.31
    if (!how) { btn.disabled = false; return; }
    for (const b of [...cert.boards].reverse()) { const blob = await boardChartPdf(cert, b, await getProfile()); const name = pdfName(cert, '-chart-' + (b.ref || 'DB')); await savePdf(cert, blob, name, 'chart'); if (how === 'view') viewPdf(blob, name); else await shareOrDownload(blob, name, `Circuit chart ${cert.number}`); }
  } catch (e) { toast('Couldn\u2019t make the chart: ' + e.message); }
  btn.disabled = false;
}

// ---------- Photos on the certificate ----------
route(/^\/cert\/([^/]+)\/photos$/, async (id) => {
  const cert = await openCert(id); if (!cert) return go('#/');
  const photos = (await db.byJob('files', cert.jobId)).filter((f) => f.kind === 'photo');
  cert.photoIds = cert.photoIds || [];
  page('Photos on the certificate', [
    h('p', { class: 'note' }, 'Tap the photos to add to the end of the PDF. Add photos on the job page.'),
    photos.length ? h('div', { class: 'photos' }, photos.map((f) => { const img = h('img', { src: URL.createObjectURL(f.blob), style: cert.photoIds.includes(f.id) ? 'outline:4px solid var(--brand)' : 'opacity:.6', onclick: () => { const i = cert.photoIds.indexOf(f.id); if (i >= 0) cert.photoIds.splice(i, 1); else cert.photoIds.push(f.id); changed(); img.style.cssText = cert.photoIds.includes(f.id) ? 'outline:4px solid var(--brand)' : 'opacity:.6'; } }); return img; })) : h('div', { class: 'empty' }, 'No photos on this job yet.'),
  ], { back: '#/cert/' + id });
});

// ---------- v0.38 (prototype): wiring diagram ----------
route(/^\/cert\/([^/]+)\/diagram$/, async (id) => {
  const cert = await openCert(id); if (!cert) return go('#/');
  const box = h('div', { class: 'diagram', style: 'overflow-x:auto;background:#fff;border-radius:8px;color-scheme:light' }); // white paper in dark mode too
  const draw = () => { box.innerHTML = diagramHasCircuits(cert) ? diagramSvg(cert, { W: 380, font: 12 }) : ''; };
  draw();
  const sw = h('button', { class: 'switch' + (cert.diagramPdf !== false ? ' on' : ''), type: 'button', role: 'switch', id: 'diagrampdf', 'aria-label': 'Include in the PDF', 'aria-checked': String(cert.diagramPdf !== false), onclick: () => { cert.diagramPdf = cert.diagramPdf === false; changed(); sw.classList.toggle('on', cert.diagramPdf !== false); sw.setAttribute('aria-checked', String(cert.diagramPdf !== false)); } }, h('span', {}));
  page('Wiring diagram', [
    h('p', { class: 'note' }, cert.type === 'MW' ? 'Drawn from the circuit on this certificate. It fills in as you add the details.' : 'Drawn from the supply, the board and each circuit. It fills in as you add the details. Number of points served sets how many sockets or lights are drawn.'),
    diagramHasCircuits(cert) ? h('div', { class: 'card', style: 'padding:10px 6px' }, box) : emptyState('zap', 'No circuits yet. Add circuits and the diagram draws itself.'),
    cert.type === 'MW' ? spurCard(cert, draw) : null,
    h('div', { class: 'card' }, h('div', { class: 'switchrow', style: 'border-top:0;margin-top:0' }, h('span', {}, 'Include in the PDF (after the schedules)'), sw)),
  ], { back: '#/cert/' + id, sub: cert.number });
});

// Minor works: "Spur added" — draws the new spur(s) off the ring, marked New.
function spurCard(cert, redraw) {
  const box = h('div', { class: 'card', id: 'spurcard' });
  const draw = () => {
    const sp = cert.mw.spur || (cert.mw.spur = { on: false, count: '1', feeds: 'socket' });
    const sw = h('button', { class: 'switch' + (sp.on ? ' on' : ''), type: 'button', role: 'switch', id: 'spuron', 'aria-label': 'Spur added to the ring', 'aria-checked': String(!!sp.on), onclick: () => { sp.on = !sp.on; changed(); redraw(); draw(); } }, h('span', {}));
    const rows = [h('div', { class: 'switchrow', style: 'border-top:0;margin-top:0' }, h('span', {}, 'Work done: spur added to the ring'), sw)];
    if (sp.on) {
      const n = Math.max(1, parseInt(sp.count, 10) || 1);
      const step = (d) => { sp.count = String(Math.max(1, Math.min(10, n + d))); changed(); redraw(); draw(); };
      rows.push(h('div', { class: 'switchrow' }, h('span', {}, 'Number of spurs'),
        h('div', { style: 'display:flex;gap:8px;align-items:center' }, h('button', { class: 'btn', type: 'button', 'aria-label': 'One fewer', onclick: () => step(-1) }, '−'), h('b', { id: 'spurcount', style: 'min-width:1.5em;text-align:center' }, String(n)), h('button', { class: 'btn', type: 'button', 'aria-label': 'One more', onclick: () => step(1) }, '+'))));
      rows.push(h('p', { class: 'note', style: 'margin:10px 0 6px' }, 'What it feeds'),
        h('div', { class: 'chips seg2', role: 'radiogroup', 'aria-label': 'What the spur feeds' }, Object.entries(SPUR_FEEDS).map(([k, t]) => h('button', { class: 'chip' + ((sp.feeds || 'socket') === k ? ' on' : ''), type: 'button', role: 'radio', 'aria-checked': String((sp.feeds || 'socket') === k), onclick: () => { sp.feeds = k; changed(); redraw(); draw(); } }, t))));
    }
    fill(box, rows);
  };
  draw(); return box;
}

// ---------- A form section ----------
route(/^\/cert\/([^/]+)\/s\/([^/]+)$/, async (id, sid) => {
  const cert = await openCert(id); if (!cert) return go('#/');
  const secs = sectionsFor(cert.type);
  const i = secs.findIndex((s) => s.id === sid);
  const s = sid === 'instruments' ? { id: 'instruments', title: 'Test instruments', form: '' } : secs[i];
  if (!s) return go('#/cert/' + id);
  // v0.29: the circuits section has its own page; an old or typed link goes there instead of crashing.
  if (s.special === 'boards') return go(`#/cert/${id}/boards`);
  const box = h('div');
  const href = (n) => (n.special === 'boards' ? `#/cert/${id}/boards` : `#/cert/${id}/s/${n.id}`);
  // v0.8: Back and Next side by side (no Back on the first section).
  const nextBtn = () => { const n = secs[i + 1]; const p = i > 0 ? secs[i - 1] : null;
    return h('div', { class: 'secnav' + (p ? '' : ' one') }, p ? h('a', { class: 'btn back', href: href(p), title: p.title }, '← Back') : null,
      n ? h('a', { class: 'btn primary', href: href(n), title: n.title }, h('span', { class: 'lbl' }, 'Next: ' + n.title), h('span', {}, ' →')) : h('a', { class: 'btn primary', href: '#/cert/' + id }, 'Done')); };
  const draw = () => {
    let content;
    if (s.id === 'instruments') content = instrumentsSection(cert);
    else if (s.special === 'inspections') content = [stateBox(cert, s), inspectionsSection(cert)];
    else if (s.special === 'observations') content = [stateBox(cert, s), observationsSection(cert, draw)];
    else if (s.special === 'bonding') content = [stateBox(cert, s), bondingSection(cert, draw)];
    else if (s.special === 'sign') content = [stateBox(cert, s), h('div', { class: 'card' }, (s.fields || []).map((fd) => field(cert, fd))), signSection(cert, draw)];
    else if (s.special === 'mwcircuit') content = [stateBox(cert, s), h('div', { class: 'card' }, s.fields.map((fd) => field(cert, fd, () => refreshState()))), h('a', { class: 'btn primary', href: `#/cert/${id}/mwc`, style: 'width:100%;margin-bottom:12px' }, 'Circuit details and test results →')];
    else {
      content = [h('div', { class: 'notice ' + stateLine(cert, s)[0] + ' secstate' }, stateLine(cert, s)[1]),
        h('div', { class: 'card' }, s.fields.map((fd) => field(cert, fd, (k, v, d) => { if (k === 'comments') { const el = document.getElementById('movedesc'); if (el) fill(el, moveToDescription(cert, draw)); } if (k === 'eic.samePerson' || k.startsWith('people.designer')) { if (k === 'eic.samePerson' || get(cert, 'eic.samePerson')) syncPeople(cert); if (k === 'eic.samePerson') return draw(); } if (d.redraw) draw(); else refreshState(); }))),
        s.id === 'supply' && get(cert, 'supply.otherSources') ? sourcesSection(cert, draw) : null,
        s.id === 'comments' ? h('div', { id: 'movedesc' }, moveToDescription(cert, draw)) : null];
    }
    fill(box, content, sid === 'summary' && cert.type === 'EICR' ? h('div', { class: 'notice ' + (eicrOverall(cert) === 'SATISFACTORY' ? 'green' : 'red') }, `From your observations: ${eicrOverall(cert)}. ${cert.eicr.overall ? '' : 'Used on the PDF unless you pick one above.'}`) : null,
      h('div', { class: 'stick' }, nextBtn()));
  };
  // update the 'still to fill' line as you type, without redrawing the inputs
  const refreshState = () => { const el = box.querySelector('.secstate'); if (!el) return; const [c, t] = stateLine(cert, s); el.className = 'notice ' + c + ' secstate'; el.textContent = t; };
  // v0.12: special sections change through their own buttons: re-check the line after any tap or typing.
  const later = () => setTimeout(refreshState, 60); box.addEventListener('click', later); box.addEventListener('input', later); box.addEventListener('change', later);
  draw();
  page(s.title, box, { back: '#/cert/' + id, sub: `${cert.number}${s.form ? ' · Section ' + s.form : ''}` });
});
// v0.8/v0.12: the line at the top of a section: complete, or what's still to fill in.
export const DONE_TEXT = 'Section complete \u2713';
const list = (xs, n = 8) => (xs.length > n ? xs.slice(0, n).join(', ') + ` and ${xs.length - n} more` : xs.join(', '));
export function stateLine(cert, s) {
  if (sectionDone(cert, s)) return ['green', DONE_TEXT];
  if (s.special === 'inspections') { const v = Object.values(cert.inspections || {}); const left = v.filter((x) => !x).length; return ['info', v.length ? `Still to fill in: ${left} of ${v.length} inspection items.` : 'Still to fill in: the inspection items.']; }
  if (s.special === 'boards') {
    const bs = cert.boards || []; if (!bs.some((b) => b.circuits.length)) return ['info', 'Still to fill in: add the circuits.'];
    const miss = bs.flatMap((b) => b.circuits.filter((c) => !isSpare(c) && !c.zs).map((c) => (bs.length > 1 ? `${b.ref || 'DB'} ` : '') + c.num));
    return ['info', `Still to fill in: Zs on circuit${miss.length > 1 ? 's' : ''} ${list(miss)}.`];
  }
  if (s.special === 'bonding') return ['info', 'Still to fill in: add the supplementary bonding, or tick N/A.'];
  if (s.special === 'sign') return ['info', 'Still to fill in: a signature.'];
  if (s.special === 'mwcircuit') { const c = cert.mw.circuit; const m = [!c.desc && 'circuit description', !c.zs && 'Zs', ...missingFields(cert, { ...s, special: null }).map((x) => x.label)].filter(Boolean); return ['info', `Still to fill in: ${list(m)}.`]; }
  const miss = missingFields(cert, s);
  if (s.id === 'supply') { const all = [...miss.map((x) => x.label.replace(/\s*\([^)]*\)$/, '')), ...sourcesMissing(cert)]; if (all.length) return ['info', `Still to fill in: ${list(all)}.`]; }
  if (miss.length) return ['info', `Still to fill in: ${list(miss.map((x) => x.label.replace(/\s*\([^)]*\)$/, '')))}.`];
  return ['info', 'Still to fill in: tick each service you bonded (it needs a size), or tick \u201cNone needed\u201d.'];
}
const stateBox = (cert, s) => { const [c, t] = stateLine(cert, s); return h('div', { class: 'notice ' + c + ' secstate' }, t); };
function syncPeople(cert) {
  if (!cert.eic.samePerson) return;
  const d = cert.people.designer; cert.people.constructor = { ...d }; cert.people.inspector = { ...d }; changed();
}

// v0.26: pick a saved instrument for each box (or type it in). Prints the make,
// model and serial in the form's instrument boxes. Calibration dates aren't printed.
function instrumentsSection(cert) {
  cert.instruments = cert.instruments || {};
  const box = h('div');
  getInstruments().then((list) => {
    cert.instrumentIds = cert.instrumentIds || {};
    const typed = (k) => !cert.instrumentIds[k] && cert.instruments[k] && !list.some((i) => instrumentText(i) === cert.instruments[k]);
    const rowFor = ([k, label]) => {
      const opts = instrumentsFor(k, list);
      const cur = cert.instrumentIds[k] && opts.some((i) => i.id === cert.instrumentIds[k]) ? cert.instrumentIds[k] : (opts.find((i) => instrumentText(i) === cert.instruments[k]) || {}).id || (typed(k) ? '__typed' : '');
      const text = h('div');
      const drawText = (v) => fill(text, v === '__typed' ? field(cert, { k: 'instruments.' + k, label: 'Serial / asset no. (typed)', type: 'text' }) : null);
      const sel = h('select', { 'aria-label': label, onchange: (e) => {
        const v = e.target.value; const i = list.find((x) => x.id === v);
        if (v === '__typed') { cert.instrumentIds[k] = ''; } else { cert.instrumentIds[k] = v || ''; cert.instruments[k] = i ? instrumentText(i) : ''; }
        changed(); drawText(v);
      } },
        h('option', { value: '' }, 'Not used'),
        opts.map((i) => h('option', { value: i.id, selected: i.id === cur }, (instrumentText(i) || 'Unnamed instrument') + ((i.kinds || []).includes(k) ? '' : ' (not tagged for this)'))),
        h('option', { value: '__typed', selected: cur === '__typed' }, 'Type it in\u2026'));
      drawText(cur);
      return h('label', { class: 'f' }, h('span', {}, label), sel, text);
    };
    fill(box, list.length ? null : h('div', { class: 'notice info' }, 'No saved instruments yet. Add them in Settings and pick them here, or type them in.'),
      INSTRUMENT_KINDS.map((kl) => list.length ? rowFor(kl) : field(cert, { k: 'instruments.' + kl[0], label: kl[1], type: 'text' })));
  });
  // v0.29: gentle warning if a calibration date looks typed in (it would print on the cert).
  const calWarn = h('div', { class: 'notice amber calwarn', role: 'status' });
  const showCal = () => { const bad = calDateFields(cert.instruments).length > 0; calWarn.textContent = bad ? CAL_DATE_WARN : ''; calWarn.hidden = !bad; };
  showCal(); box.addEventListener('input', showCal); box.addEventListener('change', showCal);
  return h('div', { class: 'card' }, h('p', { class: 'note' }, 'Pick the instrument for each test. It prints the make, model and serial on the schedule of test results.'),
    box, calWarn,
    h('button', { class: 'btn small', onclick: async () => { cert.instruments = await defaultInstruments(); cert.instrumentIds = await defaultInstrumentIds(); changed(); render(); } }, 'Reset to my default instruments'),
    h('details', { class: 'more' }, h('summary', {}, 'More info'), h('p', { class: 'note' }, 'Each list shows the instruments you\u2019ve tagged for that test first. Tag them in Settings \u2192 Test instruments. A multifunction tester counts for continuity, insulation, loop and RCD. Calibration dates stay in the app and aren\u2019t printed.')));
}

// ---------- Schedule of inspections ----------
function inspectionsSection(cert) {
  const items = cert.type === 'EIC' ? EIC_ITEMS : EICR_ITEMS;
  const outs = cert.type === 'EIC' ? EIC_OUTCOMES : EICR_OUTCOMES;
  const list = h('div', { class: 'card' });
  migrateIntake(cert); // v0.33: old single 1.1 outcome → the six sub-rows (saved with the next change)
  const R = cert.eicr || (cert.eicr = {});
  const notified = () => h('div', { class: 'ins' }, h('span', { class: 'num' }, ''), h('div', { class: 'txt' }, INTAKE_NOTIFIED, h('div', { class: 'chips', style: 'margin-top:6px' }, ['Y', 'N/A'].map((o) => h('button', { class: 'chip ' + (o === 'N/A' ? 'na' : '') + (R.intakeNotified === o ? ' on' : ''), onclick: () => { R.intakeNotified = R.intakeNotified === o ? '' : o; changed(); draw(); } }, o)))));
  const draw = () => fill(list, 
    h('p', { class: 'note' }, cert.type === 'EIC' ? 'Tick or N/A each item. A ✓ means inspected and satisfactory.' : 'Outcome for each item: ✓ acceptable, C1/C2/C3 (code), FI further investigation, N/V not verified, LIM limitation, N/A not applicable. Codes C1, C2, C3 or FI need an observation too.'),
    h('div', { class: 'btns' }, h('button', { class: 'btn small', onclick: () => { for (const k of Object.keys(cert.inspections)) if (!cert.inspections[k]) cert.inspections[k] = '✓'; changed(); draw(); } }, 'Tick all the blanks'), h('button', { class: 'btn small', onclick: () => { for (const k of Object.keys(cert.inspections)) cert.inspections[k] = ''; changed(); draw(); } }, 'Clear all')),
    ...items.map(([n, text, head, o4]) => head === 'sub' ? h('div', { class: 'ins subhead' }, h('span', { class: 'num' }, n), h('div', { class: 'txt' }, h('b', {}, text))) : head ? h('div', { class: 'ins head' }, n + '  ' + text, n === '1.0' && cert.type === 'EICR' ? h('div', { class: 'help', style: 'font-weight:400' }, INTAKE_NOTE_10) : null) : [h('div', { class: 'ins' }, h('span', { class: 'num' }, o4 && 'label' in o4 ? o4.label : n), h('div', { class: 'txt' }, text, helpLine(cert, n), h('div', { class: 'chips', style: 'margin-top:6px' }, outs.map((o) => h('button', { class: 'chip ' + o.toLowerCase().replace('/', '') + (cert.inspections[n] === o ? ' on' : ''), onclick: async () => {
      cert.inspections[n] = cert.inspections[n] === o ? '' : o; changed(); draw();
      if (cert.type === 'EICR' && /^(C1|C2|C3|FI)$/.test(o) && cert.inspections[n] === o && !cert.observations.some((x) => x.item === n.replace(/[a-f]$/, ''))) {
        if (await confirmBox('Add an observation?', `Item ${n.replace(/[a-f]$/, '')} is ${o}. Add it to the observations list now?`, 'Add observation')) { cert.observations.push({ id: db.newId(), item: n.replace(/[a-f]$/, ''), text: (/^1\.1[a-f]$/.test(n) ? 'Distributor/supplier intake equipment: ' + text.replace(/^\u2013 /, '') : text).replace(/\s*\([^)]*\)\s*$/, ''), code: o, reg: (/\(([^)]*)\)\s*$/.exec(text) || [])[1] || '', location: '' }); changed(); toast('Added to observations'); }
      }
    } }, o))))), n === '1.1f' ? [h('div', { class: 'help', style: 'margin:4px 0 8px 34px' }, INTAKE_NOTES.join(' ')), notified()] : null]));
  draw(); return list;
}

// v0.8: the small "what to check" line under an inspection item (screen only).
function helpLine(cert, n) {
  const x = cert.type === 'EIC' ? EIC_HELP[n] : EICR_HELP[n] && [EICR_HELP[n]];
  if (!x) return null;
  return h('div', { class: 'help' }, x[0], x[1] ? [' ', h('span', { class: 'reg' }, '(' + x[1] + ')')] : null);
}

// ---------- Other sources of supply (v0.14) ----------
function sourcesSection(cert, redraw) {
  cert.otherSources = cert.otherSources || [];
  const list = cert.otherSources;
  const inp = (o, k, label, attrs = {}) => h('label', { class: 'f' }, h('span', {}, label), h('input', { value: o[k] || '', oninput: (e) => { o[k] = e.target.value; changed(); }, ...attrs }));
  const area = (o, k, label, ph) => h('label', { class: 'f' }, h('span', {}, label), h('textarea', { rows: 2, value: o[k] || '', placeholder: ph, oninput: (e) => { o[k] = e.target.value; changed(); } }));
  const add = () => { list.push(blankSource(db.newId())); changed(); redraw(); };
  const card = (o, i) => h('div', { class: 'card srccard' },
    h('div', { class: 'cardhd' }, h('b', {}, 'Source ' + (i + 1)), h('button', { class: 'btn small warn', onclick: async () => { if (await confirmBox('Remove this source?', [o.type, o.make].filter(Boolean).join(' \u00b7 ') || 'Source ' + (i + 1), 'Remove', 'warn')) { list.splice(i, 1); changed(); redraw(); } } }, withIcon('trash', 'Remove'))),
    h('div', { class: 'f' }, h('span', { class: 'note' }, 'Type of source'), h('div', { class: 'chips' }, SOURCE_TYPES.map((t) => h('button', { class: 'chip' + (o.type === t ? ' on' : ''), type: 'button', onclick: () => { o.type = o.type === t ? '' : t; changed(); redraw(); } }, t)))),
    o.type === 'Other' ? inp(o, 'typeOther', 'Describe the source', { placeholder: 'e.g. wind turbine' }) : null,
    inp(o, 'make', 'Make and model', { placeholder: 'e.g. GivEnergy 5 kW hybrid' }),
    h('div', { class: 'grid2' }, inp(o, 'kw', 'Rating (kW)', { inputmode: 'decimal', placeholder: 'e.g. 5' }), inp(o, 'ref', 'G98 / G99 notification ref', { placeholder: 'DNO ref, if any' })),
    area(o, 'isolation', 'Means of isolation and where it is', 'e.g. AC isolator next to the consumer unit, DC isolator on the inverter'),
    area(o, 'notes', 'Notes (optional)', 'e.g. battery in garage, labels fitted at the CU and meter (514.15)'));
  return h('div', {},
    h('h2', { class: 'sec' }, 'Other sources of supply'),
    h('p', { class: 'note' }, 'Each source (battery, solar inverter, generator) prints on its own continuation sheet with the certificate number.'),
    list.length ? list.map(card) : emptyState('zap', 'No other sources recorded yet.', null),
    h('div', { class: 'btns full' }, h('button', { class: list.length ? 'btn' : 'btn primary', onclick: add }, list.length ? '+ Add another source' : '+ Add a source')));
}

// ---------- Supplementary bonding (v0.5) ----------
function bondingSection(cert, redraw) {
  cert.bonding = cert.bonding || [];
  const list = cert.bonding;
  const inp = (o, k, label, attrs = {}) => h('label', { class: 'f' }, h('span', {}, label), h('input', { value: o[k] || '', oninput: (e) => { o[k] = e.target.value; changed(); }, ...attrs }));
  const card = (o, i) => {
    const partsBox = h('div', { class: 'chips small' });
    const drawParts = () => { const have = (o.parts || '').split(/\s*,\s*/).filter(Boolean); fill(partsBox, BOND_PARTS.map((p) => h('button', { class: 'chip' + (have.includes(p) ? ' on' : ''), onclick: () => { const s = new Set(have); if (s.has(p)) s.delete(p); else s.add(p); o.parts = [...s].join(', '); changed(); drawParts(); partsIn.value = o.parts; } }, p))); };
    const partsIn = h('textarea', { value: o.parts || '', rows: 2, oninput: (e) => { o.parts = e.target.value; changed(); drawParts(); } });
    drawParts();
    const r = parseFloat(o.reading);
    return h('div', { class: 'card' },
      h('div', { class: 'cardhd' }, h('b', {}, 'Bonding ' + (i + 1)), h('button', { class: 'btn small warn', onclick: async () => { if (await confirmBox('Remove this bonding entry?', o.location || 'Bonding ' + (i + 1), 'Remove', 'warn')) { list.splice(i, 1); changed(); redraw(); } } }, 'Remove')),
      h('label', { class: 'f' }, h('span', {}, 'Location'), h('select', { onchange: (e) => { o.location = e.target.value === 'Other' ? '' : e.target.value; changed(); redraw(); } }, h('option', { value: '' }, '— pick —'), BOND_LOCATIONS.map((l) => h('option', { value: l, selected: o.location === l ? true : null }, l)))),
      BOND_LOCATIONS.includes(o.location) ? null : inp(o, 'location', 'Location (type it)', { placeholder: 'e.g. Bathroom, first floor' }),
      h('div', { class: 'f' }, h('span', { class: 'note' }, 'Parts bonded (tap to add, or type)'), partsBox), h('label', { class: 'f' }, partsIn),
      h('div', { class: 'grid3' },
        h('label', { class: 'f' }, h('span', {}, 'Conductor csa'), h('select', { onchange: (e) => { o.csa = e.target.value; changed(); } }, ['2.5', '4', '6', '10', '16'].map((v) => h('option', { value: v, selected: o.csa === v ? true : null }, v + ' mm²')))),
        inp(o, 'material', 'Material'),
        inp(o, 'reading', 'Continuity (Ω)', { inputmode: 'decimal', placeholder: 'e.g. 0.03' })),
      !isNaN(r) && r > 0.5 ? h('div', { class: 'notice amber' }, `${r} Ω is high for a bonding conductor. Good joints usually read well under 0.1 Ω: check the clamps and connections.`) : null,
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!o.verified, onchange: (e) => { o.verified = e.target.checked; changed(); } }), 'Connection / continuity verified'));
  };
  return h('div', {},
    h('p', { class: 'note' }, 'Record supplementary protective bonding (Regulation 415.2 / Section 701). It prints on its own schedule after the test results, with the certificate number on every page.'),
    h('label', { class: 'check card' }, h('input', { type: 'checkbox', checked: !!cert.bondingNA, onchange: (e) => { cert.bondingNA = e.target.checked; changed(); redraw(); } }), 'No supplementary bonding installed / needed (prints N/A)'),
    cert.bondingNA ? null : [
      list.length ? list.map(card) : emptyState('link', 'No supplementary bonding recorded yet.', h('button', { class: 'btn primary', onclick: () => { list.push(blankBond(db.newId())); changed(); redraw(); } }, '+ Add bonding')),
      list.length ? h('div', { class: 'btns full' }, h('button', { class: 'btn primary', onclick: () => { list.push({ ...blankBond(db.newId()), location: (list[list.length - 1] || {}).location || '' }); changed(); redraw(); } }, '+ Add another')) : null,
      h('p', { class: 'note' }, 'Limit for RCD-protected circuits (415.2.2): R ≤ 50 V ÷ IΔn, e.g. 1667 Ω for 30 mA. In practice a sound bond reads a few hundredths of an ohm.')]);
}

// v0.17: a "Danger notice" button on C1/C2 observations (or "View danger notice" once there is one).
function dangerBtn(cert, o) {
  if (!dangerCodes(o)) return null;
  if (!o.id) { o.id = db.newId(); changed(); }
  const n = noticeForObs(cert, o);
  return h('div', { class: 'dnrow' }, h('a', { class: 'btn small danger', href: `#/cert/${cert.id}/danger/${n ? n.id : 'obs-' + o.id}`, onclick: n ? null : async (e) => { e.preventDefault(); await flush(); (await import('./dangerui.js')).startFromObs(cert, o); } }, withIcon('alert', n ? 'View danger notice' : 'Danger notice')),
    h('span', { class: 'note' }, n ? noticeNo(cert, n) + (n.items.length > 1 ? ` (${n.items.length} items)` : '') + ' · ' + (noticeMissing(n).length ? 'started, not finished' : 'issued ' + fmtDate(n.date)) : 'Fill in and hand over a danger notification'));
}

// ---------- Observations (EICR) ----------
function observationsSection(cert, redraw) {
  const obs = cert.observations;
  const card = (o, i) => {
    const codeChips = h('div', { class: 'chips' });
    const dc = () => fill(codeChips, ...['C1', 'C2', 'C3', 'FI'].map((c) => h('button', { class: 'chip ' + c.toLowerCase() + (o.code === c ? ' on' : ''), onclick: () => { const was = dangerCodes(o); o.code = c; changed(); if (was !== dangerCodes(o)) redraw(); else dc(); } }, c)));
    dc();
    return h('div', { class: 'card' },
      h('div', { style: 'display:flex;justify-content:space-between' }, h('b', {}, 'Observation ' + (i + 1)), h('button', { class: 'btn small warn', onclick: async () => { if (await confirmBox('Remove observation?', o.text, 'Remove', 'warn')) { obs.splice(i, 1); changed(); redraw(); } } }, 'Remove')),
      h('label', { class: 'f' }, h('span', {}, 'Observation'), h('textarea', { value: o.text, oninput: (e) => { o.text = e.target.value; changed(); } })),
      h('div', { class: 'btns' }, h('button', { class: 'btn tiny', onclick: () => pick(o) }, 'Use wording from the library')),
      h('label', { class: 'f' }, h('span', {}, 'Location / circuit'), h('input', { value: o.location || '', oninput: (e) => { o.location = e.target.value; changed(); } })),
      h('div', { class: 'grid2' }, h('label', { class: 'f' }, h('span', {}, 'Regulation(s)'), h('input', { value: o.reg || '', oninput: (e) => { o.reg = e.target.value; changed(); } })), h('div', {}, h('span', { class: 'note' }, 'Code'), codeChips)),
      o.item ? h('div', { class: 'note' }, 'From schedule item ' + o.item) : null,
      dangerBtn(cert, o));
  };
  const pick = async (replace = null) => { const o = await pickObservation(); if (!o) return; if (replace) { Object.assign(replace, { text: o.text, code: o.code, reg: o.reg }); changed(); redraw(); } else add(o); };
  const add = (o) => { obs.push({ id: db.newId(), text: o.text, code: o.code, reg: o.reg, location: '' }); changed(); redraw(); };
  const counts = ['C1', 'C2', 'C3', 'FI'].map((c) => `${c}: ${obs.filter((o) => o.code === c).length}`).join('  ·  ');
  return h('div', {},
    h('div', { class: 'notice ' + (eicrOverall(cert) === 'SATISFACTORY' ? 'green' : 'red') }, `${counts}. Overall: ${eicrOverall(cert)}.`),
    // v0.32: split like the A4 form: C1 and C2 first, then C3 and FI.
    obs.length ? [[['C1', 'C2'], 'C1 and C2 observations'], [['C3', 'FI'], 'C3 and FI observations']].map(([codes, t]) => { const l = obs.map((o, i) => [o, i]).filter(([o]) => codes.includes(o.code) || (codes[0] === 'C3' && !['C1', 'C2'].includes(o.code))); return l.length ? [h('div', { class: 'obsgrp-h' }, t), l.map(([o, i]) => card(o, i))] : null; }) : emptyState('clipboard', 'No observations. If there are none, the PDF says so.'),
    h('div', { class: 'btns full' }, h('button', { class: 'btn primary', onclick: () => pick() }, '+ Add from library'), h('button', { class: 'btn', onclick: () => add({ text: '', code: 'C3', reg: '' }) }, '+ Write my own')),
    h('details', { class: 'card' }, h('summary', {}, 'What the codes mean'), Object.entries(CODE_TEXT).map(([k, v]) => h('p', {}, h('b', {}, k + ': '), v))));
}

// The observation codes library: filter by code, search, grouped by where it is. Resolves the chosen one (or null).
export async function pickObservation() {
  let chosen = null; let code = '';
  const q = h('input', { type: 'search', placeholder: 'Search, e.g. bonding, RCD, bathroom' });
  const chips = h('div', { class: 'chips small', style: 'margin:8px 0' });
  const list = h('div');
  const colour = (c) => (c === 'C1' || c === 'C2' ? 'red' : c === 'C3' ? '' : 'amber');
  const draw = () => {
    fill(chips, [['', 'All'], ['C1', 'C1'], ['C2', 'C2'], ['C3', 'C3'], ['FI', 'FI']].map(([v, t]) => h('button', { class: 'chip ' + v.toLowerCase() + (code === v ? ' on' : ''), onclick: () => { code = v; draw(); } }, t + (v ? ` · ${OBSERVATIONS.filter((o) => o.code === v).length}` : ''))));
    const qq = q.value.trim().toLowerCase();
    const shown = OBSERVATIONS.filter((o) => (!code || o.code === code) && (!qq || (o.text + ' ' + o.reg + ' ' + o.cat).toLowerCase().includes(qq)));
    fill(list, shown.length ? OBS_CATS.map((cat) => { const os = shown.filter((o) => o.cat === cat); return os.length ? [h('div', { class: 'obscat' }, cat), h('div', { class: 'list' }, os.map((o) => h('button', { class: 'row', onclick: () => { chosen = o; document.querySelector('.modal-bg').remove(); done(); } }, h('span', { class: 'pill ' + colour(o.code) }, o.code), h('div', { class: 'main' }, h('div', { style: 'white-space:normal' }, o.text), h('div', { class: 's' }, 'Reg ' + o.reg)))))] : null; }) : h('div', { class: 'empty' }, 'Nothing matches. Write your own instead.'));
  };
  q.oninput = draw; draw();
  let done = () => {};
  const p = new Promise((res) => { done = () => res(chosen); });
  modal('Observation codes library', h('div', {}, h('p', { class: 'note' }, `${OBSERVATIONS.length} common defects. Tap one to add it. The code and regulation are suggestions: change them to suit what you found.`), q, chips, list), [{ label: 'Cancel', value: null }]).then(() => done());
  return p;
}

// ---------- Signatures ----------
function signRoles(cert) {
  if (cert.type === 'EIC') return cert.eic.samePerson ? [['designer', 'Designer, constructor and inspector (you)', cert.people.designer.name]] : [['designer', 'Designer', cert.people.designer.name], ['constructor', 'Constructor', cert.people.constructor.name], ['inspector', 'Inspection and testing', cert.people.inspector.name]].concat(cert.people.designer2.name ? [['designer2', 'Designer No 2', cert.people.designer2.name]] : []);
  if (cert.type === 'EICR') return [['inspector', 'Inspected and tested by', cert.people.inspector.name], ['authoriser', 'Report authorised for issue by', cert.eicr.authoriser.name]];
  return [['mw', 'Signed', cert.people.inspector.name]];
}
function signSection(cert, redraw) {
  cert.sigs = cert.sigs || {};
  return h('div', {}, signRoles(cert).map(([role, label, name]) => {
    const s = cert.sigs[role];
    return h('div', { class: 'card' }, h('h2', {}, label), name ? h('div', {}, name) : null,
      s && s.img ? [h('img', { class: 'sigimg', src: s.img }), h('label', { class: 'f' }, h('span', {}, 'Date'), h('input', { type: 'date', value: s.date || '', oninput: (e) => { s.date = e.target.value; changed(); } }))] : h('p', { class: 'note' }, 'Not signed yet.'),
      h('div', { class: 'btns' }, h('button', { class: 'btn primary small', onclick: async () => { const img = await sigPad(); if (img) { cert.sigs[role] = { img, date: new Date().toISOString().slice(0, 10) }; changed(); redraw(); } } }, s && s.img ? 'Sign again' : 'Sign'),
        s && s.img ? h('button', { class: 'btn small warn', onclick: () => { delete cert.sigs[role]; changed(); redraw(); } }, 'Clear') : null));
  }));
}
// Signature pad: draw with a finger, or reuse the signature you saved.
// v0.16.1: one sheet that stays open. Clear really wipes the pad (it used to close and
// reopen the sheet with the old ink still showing, and then "Use this" thought nothing was
// drawn and silently reopened it). "Use this" checks the actual ink on the pad.
export async function sigPad() {
  let saved = null; try { saved = await db.getMeta('mysig'); } catch (e) { saved = null; }
  const cv = h('canvas', { class: 'sigpad' });
  const keep = h('input', { type: 'checkbox', checked: !saved });
  let g = null, last = null;
  const setup = () => {
    const r = cv.getBoundingClientRect(); if (!r.width) return false;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.lineWidth = 2.4; g.lineCap = g.lineJoin = 'round'; g.strokeStyle = '#0d2a5c'; return true;
  };
  const pt = (e) => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  cv.onpointerdown = (e) => { if (!g && !setup()) return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) {} last = pt(e); g.beginPath(); g.arc(last[0], last[1], 1.2, 0, 7); g.fillStyle = g.strokeStyle; g.fill(); };
  cv.onpointermove = (e) => { if (!last) return; const p = pt(e); g.beginPath(); g.moveTo(...last); g.lineTo(...p); g.stroke(); last = p; };
  cv.onpointerup = cv.onpointercancel = cv.onlostpointercapture = () => { last = null; };
  const hasInk = () => { if (!g) return false; const d = g.getImageData(0, 0, cv.width, cv.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) return true; return false; };
  return new Promise((res) => {
    let done = false;
    const close = (v) => { if (done) return; done = true; bg.remove(); res(v); };
    // Android Chrome sometimes drops the "click" for a tap that comes straight after a
    // finger stroke on the pad, so touch taps fire on pointerup; the click is the fallback
    // for mouse and keyboard. Each tap runs once.
    let lastTap = 0;
    const btn = (label, cls, fn) => { let down = null; const run = () => { const t = Date.now(); if (t - lastTap < 400) return; lastTap = t; fn(); };
      return h('button', { type: 'button', class: 'btn ' + cls,
        onpointerdown: (e) => { down = e.pointerType !== 'mouse' ? e.pointerId : null; },
        onpointerup: (e) => { if (down !== null && e.pointerId === down) { down = null; e.preventDefault(); run(); } },
        onpointercancel: () => { down = null; },
        onclick: (e) => { e.preventDefault(); e.stopPropagation(); run(); } }, label); };
    const bg = h('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) close(null); } },
      h('div', { class: 'modal', role: 'dialog' }, h('h3', {}, 'Sign here'), cv, h('label', { class: 'check' }, keep, 'Save as my signature for next time'),
        h('div', { class: 'btns full' },
          btn('Cancel', '', () => close(null)),
          saved ? btn('Use my saved signature', 'primary', () => close(saved)) : null,
          btn('Clear', '', () => { if (g) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.restore(); } last = null; }),
          btn('Use this', 'primary', async () => {
            if (!hasInk()) { toast('Draw your signature first'); return; }
            const img = trimCanvas(cv);
            if (keep.checked) { try { await saveSetting('mysig', img); } catch (e) { toast('Signed, but couldn\u2019t save it for next time'); } }
            close(img);
          }))));
    document.body.append(bg);
    requestAnimationFrame(() => setup()); setTimeout(() => { if (!g) setup(); }, 300);
  });
}
function trimCanvas(cv) {
  const g = cv.getContext('2d'); const { width: w, height: hh } = cv; const d = g.getImageData(0, 0, w, hh).data;
  let x0 = w, y0 = hh, x1 = 0, y1 = 0;
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const out = document.createElement('canvas'); const pw = Math.max(1, x1 - x0 + 8), ph = Math.max(1, y1 - y0 + 8);
  out.width = pw; out.height = ph; out.getContext('2d').drawImage(cv, x0 - 4, y0 - 4, pw, ph, 0, 0, pw, ph);
  return out.toDataURL('image/png');
}

// v0.34: on a new installation, the description of the work belongs in Section B.
// If it's been typed in Section I, one tap moves it to the description of installation.
function moveToDescription(cert, draw) {
  if (!isNewInstall(cert) || !String(cert.comments || '').trim()) return null;
  return h('div', { class: 'notice amber' },
    h('div', {}, 'This is a new installation, so Section I (comments on the existing installation) would normally be N/A. If this describes the work, it belongs in Section B, Description and extent of the installation.'),
    h('button', { class: 'btn small', style: 'margin-top:8px', onclick: () => { const d = String(get(cert, 'install.description') || '').trim(); set(cert, 'install.description', (d ? d + '\n' : '') + String(cert.comments).trim()); cert.comments = ''; changed(); toast('Moved to Section B, Description and extent of the installation'); draw(); } }, 'Move to Section B, Description and extent'));
}
