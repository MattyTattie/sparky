// =====================================================================
// certui.js — a certificate: overview, form sections, inspections,
// observations, signatures and the PDF.
// =====================================================================
import * as db from './db.js';
import { h, fill, toast, modal, confirmBox, fmtDate, shareOrDownload, blobToDataUrl } from './ui.js';
import { route, page, go, render } from './app.js';
import { S, openCert, changed, flush, getProfile, defaultInstruments, calibrationWarnings, INSTRUMENT_KINDS } from './state.js';
import { TYPES, newCert, sectionsFor, sectionDone, get, set, eicrOverall } from './certmodel.js';
import { EIC_ITEMS, EIC_OUTCOMES, EICR_ITEMS, EICR_OUTCOMES, CODE_TEXT, OBSERVATIONS } from './inspections.js';
import { checkCircuit } from './checks.js';
import { CHECK_NOTE } from './limits.js';

export async function createCert(type, job, cust) {
  const profile = await getProfile();
  const number = (profile.certPrefix || '') + await db.nextNumber(TYPES[type].prefix);
  const c = newCert(type, { job, customer: cust || {}, profile, instruments: await defaultInstruments(), number });
  if (type === 'EICR') c.eicr.overall = '';
  await db.put('certs', c); return c;
}

// One form field, wired to autosave.
export function field(cert, fd, onChange) {
  const val = get(cert, fd.k);
  const upd = (v) => { set(cert, fd.k, v); changed(); if (onChange) onChange(fd.k, v); };
  if (fd.hideIf && get(cert, fd.hideIf)) return null;
  if (fd.type === 'check') return h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!val, onchange: (e) => upd(e.target.checked) }), fd.label);
  if (fd.type === 'chips') {
    const box = h('div', { class: 'chips' });
    const draw = () => fill(box, ...fd.opts.map((o) => h('button', { class: 'chip' + (get(cert, fd.k) === o ? ' on' : ''), onclick: () => { upd(get(cert, fd.k) === o ? '' : o); draw(); } }, o)));
    draw();
    return h('div', { class: 'f', style: 'margin-bottom:12px' }, h('span', { class: 'note', style: 'display:block;margin-bottom:4px' }, fd.label), box, fd.hint ? h('div', { class: 'note' }, fd.hint) : null);
  }
  if (fd.type === 'select') return h('label', { class: 'f' }, h('span', {}, fd.label), h('select', { onchange: (e) => upd(e.target.value) }, fd.opts.map((o) => h('option', { selected: o === val ? true : null }, o))));
  const tag = fd.type === 'area' ? 'textarea' : 'input';
  return h('label', { class: 'f' }, h('span', {}, fd.label), h(tag, { type: fd.type === 'date' ? 'date' : tag === 'input' ? 'text' : null, inputmode: fd.type === 'num' ? 'decimal' : null, value: val ?? '', oninput: (e) => upd(e.target.value) }));
}

// ---------- Overview ----------
route(/^\/cert\/([^/]+)$/, async (id) => {
  const cert = await openCert(id); if (!cert) return go('#/');
  const job = cert.jobId ? await db.get('jobs', cert.jobId) : null;
  const secs = sectionsFor(cert.type);
  const nFlags = (cert.boards || []).reduce((n, b) => n + b.circuits.filter((c) => checkCircuit(c, { earthing: cert.supply.earthing, zdb: b.zdb }).worst === 'red').length, 0) + (cert.type === 'MW' && checkCircuit(cert.mw.circuit, { earthing: cert.mw.earthing, zdb: cert.mw.zdb }).worst === 'red' ? 1 : 0);
  const done = secs.filter((s) => sectionDone(cert, s)).length;
  const warns = await calibrationWarnings();
  page(TYPES[cert.type].name, [
    h('div', { class: 'card' },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, h('b', {}, cert.number), cert.status === 'issued' ? h('span', { class: 'pill green' }, 'Issued ' + fmtDate(cert.issuedAt)) : h('span', { class: 'pill' }, 'Draft')),
      h('div', { class: 'note' }, [cert.client.name, (cert.install.address || '').split(/[,\n]/)[0]].filter(Boolean).join(' · ')),
      h('div', { class: 'prog', style: 'margin-top:10px' }, h('i', { style: `width:${Math.round((done / secs.length) * 100)}%` })),
      h('div', { class: 'note', style: 'margin-top:4px' }, `${done} of ${secs.length} sections filled in`)),
    nFlags ? h('div', { class: 'notice red' }, `${nFlags} circuit(s) have a reading outside the limits. Check the schedule before issuing.`) : null,
    warns.map((w) => h('div', { class: 'notice ' + w.level }, w.text)),
    h('div', { class: 'list' }, secs.map((s) => h('a', { class: 'row', href: s.special === 'boards' ? `#/cert/${id}/boards` : `#/cert/${id}/s/${s.id}` },
      h('span', { class: 'dot ' + (sectionDone(cert, s) ? 'ok' : '') }), h('div', { class: 'main' }, h('div', { class: 't' }, s.title), h('div', { class: 's' }, 'Form section ' + s.form)), h('span', { class: 'go' }, '›'))),
      h('a', { class: 'row', href: `#/cert/${id}/s/instruments` }, h('span', { class: 'dot ' + (Object.values(cert.instruments || {}).some(Boolean) ? 'ok' : '') }), h('div', { class: 'main' }, h('div', { class: 't' }, 'Test instruments'), h('div', { class: 's' }, 'From your settings; change for this certificate')), h('span', { class: 'go' }, '›')),
      job ? h('a', { class: 'row', href: `#/cert/${id}/photos` }, h('span', { class: 'dot ' + ((cert.photoIds || []).length ? 'ok' : '') }), h('div', { class: 'main' }, h('div', { class: 't' }, 'Photos on the certificate'), h('div', { class: 's' }, `${(cert.photoIds || []).length} chosen`)), h('span', { class: 'go' }, '›')) : null),
    h('div', { class: 'card' }, h('h2', {}, 'PDF'),
      h('p', { class: 'note' }, 'Makes the certificate as a PDF laid out like the IET model forms, with your logo. Sharing opens your phone\u2019s share menu: you choose the app and who it goes to. Nothing is sent by itself.'),
      h('div', { class: 'btns full' }, h('button', { class: 'btn primary', onclick: (e) => makePdf(cert, e.currentTarget, 'share') }, 'Make PDF and share'), h('button', { class: 'btn', onclick: (e) => makePdf(cert, e.currentTarget, 'view') }, 'Preview'),
        cert.type !== 'MW' ? h('button', { class: 'btn', onclick: (e) => makeChart(cert, e.currentTarget) }, 'Circuit chart') : null),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!cert.pdfFlags, onchange: (e) => { cert.pdfFlags = e.target.checked; changed(); } }), 'Highlight readings over the limit in red on the PDF'),
      cert.status !== 'issued' ? h('button', { class: 'btn', onclick: async () => { if (await confirmBox('Mark as issued?', 'Records today as the issue date. You can still edit it.', 'Mark issued')) { cert.status = 'issued'; cert.issuedAt = new Date().toISOString(); changed(); await flush(); render(); } } }, 'Mark as issued') : null),
    h('div', { class: 'btns full' }, h('button', { class: 'btn warn', onclick: async () => { if (await confirmBox('Delete certificate?', cert.number + ' will be removed from this phone.', 'Delete', 'warn')) { await db.del('certs', id); S.cert = null; go(job ? '#/job/' + job.id : '#/'); } } }, 'Delete certificate')),
  ], { back: job ? '#/job/' + job.id : '#/', sub: cert.number });
});

async function pdfPhotos(cert) {
  const out = [];
  for (const pid of cert.photoIds || []) { const f = await db.get('files', pid); if (f && f.blob) out.push({ dataUrl: await blobToDataUrl(f.blob), caption: f.caption || '' }); }
  return out;
}
async function savePdf(cert, blob, name, kind = 'pdf') {
  if (!cert.jobId) return;
  const files = await db.byJob('files', cert.jobId);
  const old = files.find((f) => f.kind === kind && f.certId === cert.id && (kind !== 'chart' || f.name === name));
  await db.put('files', { ...(old || { id: db.newId(), createdAt: new Date().toISOString() }), jobId: cert.jobId, certId: cert.id, kind: 'pdf', name, blob, createdAt: new Date().toISOString(), version: ((old && old.version) || 0) + 1, driveId: old && old.driveId, driveVersion: old && old.driveVersion });
}
async function makePdf(cert, btn, how) {
  await flush(); const label = btn.textContent; btn.disabled = true; btn.textContent = 'Making PDF…';
  try {
    const { certificatePdf, pdfName } = await import('./pdf.js');
    const blob = await certificatePdf(cert, { profile: await getProfile(), photos: await pdfPhotos(cert) });
    const name = pdfName(cert); await savePdf(cert, blob, name);
    if (how === 'view') { const u = URL.createObjectURL(blob); window.open(u, '_blank') || shareOrDownload(blob, name); }
    else { const r = await shareOrDownload(blob, name, `${TYPES[cert.type].name} ${cert.number}`); if (r === 'downloaded') toast('Saved to your downloads'); }
  } catch (e) { console.error(e); toast('Couldn\u2019t make the PDF: ' + e.message); }
  btn.disabled = false; btn.textContent = label;
}
async function makeChart(cert, btn) {
  await flush(); btn.disabled = true;
  try {
    const { boardChartPdf, pdfName } = await import('./pdf.js');
    for (const b of cert.boards) { const blob = await boardChartPdf(cert, b, await getProfile()); const name = pdfName(cert, '-chart-' + (b.ref || 'DB')); await savePdf(cert, blob, name, 'chart'); await shareOrDownload(blob, name); }
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
    photos.length ? h('div', { class: 'photos' }, photos.map((f) => { const img = h('img', { src: URL.createObjectURL(f.blob), style: cert.photoIds.includes(f.id) ? 'outline:4px solid #1b3a6b' : 'opacity:.6', onclick: () => { const i = cert.photoIds.indexOf(f.id); if (i >= 0) cert.photoIds.splice(i, 1); else cert.photoIds.push(f.id); changed(); img.style.cssText = cert.photoIds.includes(f.id) ? 'outline:4px solid #1b3a6b' : 'opacity:.6'; } }); return img; })) : h('div', { class: 'empty' }, 'No photos on this job yet.'),
  ], { back: '#/cert/' + id });
});

// ---------- A form section ----------
route(/^\/cert\/([^/]+)\/s\/([^/]+)$/, async (id, sid) => {
  const cert = await openCert(id); if (!cert) return go('#/');
  const secs = sectionsFor(cert.type);
  const i = secs.findIndex((s) => s.id === sid);
  const s = sid === 'instruments' ? { id: 'instruments', title: 'Test instruments', form: '' } : secs[i];
  if (!s) return go('#/cert/' + id);
  const box = h('div');
  const nextBtn = () => { const n = secs[i + 1]; return n ? h('a', { class: 'btn primary', href: n.special === 'boards' ? `#/cert/${id}/boards` : `#/cert/${id}/s/${n.id}` }, 'Next: ' + n.title + ' →') : h('a', { class: 'btn primary', href: '#/cert/' + id }, 'Done'); };
  const draw = () => {
    let content;
    if (s.id === 'instruments') content = instrumentsSection(cert);
    else if (s.special === 'inspections') content = inspectionsSection(cert);
    else if (s.special === 'observations') content = observationsSection(cert, draw);
    else if (s.special === 'sign') content = [h('div', { class: 'card' }, (s.fields || []).map((fd) => field(cert, fd))), signSection(cert, draw)];
    else if (s.special === 'mwcircuit') content = [h('div', { class: 'card' }, s.fields.map((fd) => field(cert, fd))), h('a', { class: 'btn primary', href: `#/cert/${id}/mwc`, style: 'width:100%;margin-bottom:12px' }, 'Circuit details and test results →')];
    else content = h('div', { class: 'card' }, s.fields.map((fd) => field(cert, fd, (k) => { if (k === 'eic.samePerson' || k.startsWith('people.designer')) { if (k === 'eic.samePerson' || get(cert, 'eic.samePerson')) syncPeople(cert); if (k === 'eic.samePerson') draw(); } })));
    fill(box, content, sid === 'summary' && cert.type === 'EICR' ? h('div', { class: 'notice ' + (eicrOverall(cert) === 'SATISFACTORY' ? 'green' : 'red') }, `From your observations: ${eicrOverall(cert)}. ${cert.eicr.overall ? '' : 'Used on the PDF unless you pick one above.'}`) : null,
      h('div', { class: 'stick' }, nextBtn()));
  };
  draw();
  page(s.title, box, { back: '#/cert/' + id, sub: `${cert.number}${s.form ? ' · Section ' + s.form : ''}` });
});
function syncPeople(cert) {
  if (!cert.eic.samePerson) return;
  const d = cert.people.designer; cert.people.constructor = { ...d }; cert.people.inspector = { ...d }; changed();
}

function instrumentsSection(cert) {
  cert.instruments = cert.instruments || {};
  return h('div', { class: 'card' }, h('p', { class: 'note' }, 'Serial and/or asset numbers, as printed on the schedule of test results. Change your default kit in Settings.'),
    INSTRUMENT_KINDS.map(([k, label]) => field(cert, { k: 'instruments.' + k, label, type: 'text' })),
    h('button', { class: 'btn small', onclick: async () => { cert.instruments = await defaultInstruments(); changed(); render(); } }, 'Reset to my default instruments'));
}

// ---------- Schedule of inspections ----------
function inspectionsSection(cert) {
  const items = cert.type === 'EIC' ? EIC_ITEMS : EICR_ITEMS;
  const outs = cert.type === 'EIC' ? EIC_OUTCOMES : EICR_OUTCOMES;
  const list = h('div', { class: 'card' });
  const draw = () => fill(list, 
    h('p', { class: 'note' }, cert.type === 'EIC' ? 'Tick or N/A each item. A ✓ means inspected and satisfactory.' : 'Outcome for each item: ✓ acceptable, C1/C2/C3 (code), FI further investigation, N/V not verified, LIM limitation, N/A not applicable. Codes C1, C2, C3 or FI need an observation too.'),
    h('div', { class: 'btns' }, h('button', { class: 'btn small', onclick: () => { for (const k of Object.keys(cert.inspections)) if (!cert.inspections[k]) cert.inspections[k] = '✓'; changed(); draw(); } }, 'Tick all the blanks'), h('button', { class: 'btn small', onclick: () => { for (const k of Object.keys(cert.inspections)) cert.inspections[k] = ''; changed(); draw(); } }, 'Clear all')),
    ...items.map(([n, text, head]) => head ? h('div', { class: 'ins head' }, n + '  ' + text) : h('div', { class: 'ins' }, h('span', { class: 'num' }, n), h('div', { class: 'txt' }, text, h('div', { class: 'chips', style: 'margin-top:6px' }, outs.map((o) => h('button', { class: 'chip ' + o.toLowerCase().replace('/', '') + (cert.inspections[n] === o ? ' on' : ''), onclick: async () => {
      cert.inspections[n] = cert.inspections[n] === o ? '' : o; changed(); draw();
      if (cert.type === 'EICR' && /^(C1|C2|C3|FI)$/.test(o) && cert.inspections[n] === o && !cert.observations.some((x) => x.item === n)) {
        if (await confirmBox('Add an observation?', `Item ${n} is ${o}. Add it to the observations list now?`, 'Add observation')) { cert.observations.push({ id: db.newId(), item: n, text: text.replace(/\s*\([^)]*\)\s*$/, ''), code: o, reg: (/\(([^)]*)\)\s*$/.exec(text) || [])[1] || '', location: '' }); changed(); toast('Added to observations'); }
      }
    } }, o)))))));
  draw(); return list;
}

// ---------- Observations (EICR) ----------
function observationsSection(cert, redraw) {
  const obs = cert.observations;
  const card = (o, i) => {
    const codeChips = h('div', { class: 'chips' });
    const dc = () => fill(codeChips, ...['C1', 'C2', 'C3', 'FI'].map((c) => h('button', { class: 'chip ' + c.toLowerCase() + (o.code === c ? ' on' : ''), onclick: () => { o.code = c; changed(); dc(); } }, c)));
    dc();
    return h('div', { class: 'card' },
      h('div', { style: 'display:flex;justify-content:space-between' }, h('b', {}, 'Observation ' + (i + 1)), h('button', { class: 'btn small warn', onclick: async () => { if (await confirmBox('Remove observation?', o.text, 'Remove', 'warn')) { obs.splice(i, 1); changed(); redraw(); } } }, 'Remove')),
      h('label', { class: 'f' }, h('span', {}, 'Observation'), h('textarea', { value: o.text, oninput: (e) => { o.text = e.target.value; changed(); } })),
      h('label', { class: 'f' }, h('span', {}, 'Location / circuit'), h('input', { value: o.location || '', oninput: (e) => { o.location = e.target.value; changed(); } })),
      h('div', { class: 'grid2' }, h('label', { class: 'f' }, h('span', {}, 'Regulation(s)'), h('input', { value: o.reg || '', oninput: (e) => { o.reg = e.target.value; changed(); } })), h('div', {}, h('span', { class: 'note' }, 'Code'), codeChips)),
      o.item ? h('div', { class: 'note' }, 'From schedule item ' + o.item) : null);
  };
  const pick = async () => {
    const q = h('input', { type: 'search', placeholder: 'Search common defects' });
    const list = h('div', { class: 'list' });
    let chosen = null;
    const draw = () => fill(list, ...OBSERVATIONS.filter((o) => !q.value || o.text.toLowerCase().includes(q.value.toLowerCase())).map((o) => h('button', { class: 'row', onclick: () => { chosen = o; document.querySelector('.modal-bg').remove(); add(o); } }, h('span', { class: 'pill ' + (o.code === 'C1' || o.code === 'C2' ? 'red' : o.code === 'C3' ? '' : 'amber') }, o.code), h('div', { class: 'main' }, h('div', { style: 'white-space:normal' }, o.text), h('div', { class: 's' }, 'Reg ' + o.reg)))));
    q.oninput = draw; draw();
    await modal('Pick an observation', h('div', {}, h('p', { class: 'note' }, 'Code and regulation are suggestions. Change them to suit what you found.'), q, h('div', { style: 'height:8px' }), list), [{ label: 'Write my own', value: 'own' }]).then((r) => { if (r === 'own' && !chosen) add({ text: '', code: 'C3', reg: '' }); });
  };
  const add = (o) => { obs.push({ id: db.newId(), text: o.text, code: o.code, reg: o.reg, location: '' }); changed(); redraw(); };
  const counts = ['C1', 'C2', 'C3', 'FI'].map((c) => `${c}: ${obs.filter((o) => o.code === c).length}`).join('  ·  ');
  return h('div', {},
    h('div', { class: 'notice ' + (eicrOverall(cert) === 'SATISFACTORY' ? 'green' : 'red') }, `${counts}. Overall: ${eicrOverall(cert)}.`),
    obs.length ? obs.map(card) : h('div', { class: 'empty' }, 'No observations. If there are none, the PDF says so.'),
    h('div', { class: 'btns full' }, h('button', { class: 'btn primary', onclick: pick }, '+ Add observation')),
    h('details', { class: 'card' }, h('summary', {}, 'What the codes mean'), Object.entries(CODE_TEXT).map(([k, v]) => h('p', {}, h('b', {}, k + ': '), v))));
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
export async function sigPad() {
  const saved = await db.getMeta('mysig');
  const cv = h('canvas', { class: 'sigpad' }); let drawn = false;
  const keep = h('input', { type: 'checkbox', checked: !saved });
  setTimeout(() => {
    const r = cv.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    cv.width = r.width * dpr; cv.height = r.height * dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr); g.lineWidth = 2.4; g.lineCap = g.lineJoin = 'round'; g.strokeStyle = '#0d2a5c';
    let last = null;
    const pt = (e) => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); last = pt(e); };
    cv.onpointermove = (e) => { if (!last) return; const p = pt(e); g.beginPath(); g.moveTo(...last); g.lineTo(...p); g.stroke(); last = p; drawn = true; };
    cv.onpointerup = () => (last = null);
  }, 60);
  const btns = [{ label: 'Cancel', value: null }, { label: 'Clear', value: 'clear' }, { label: 'Use this', value: 'ok', cls: 'primary' }];
  if (saved) btns.splice(1, 0, { label: 'Use my saved signature', value: 'saved', cls: 'primary' });
  for (;;) {
    const r = await modal('Sign here', h('div', {}, cv, h('label', { class: 'check' }, keep, 'Save as my signature for next time')), btns);
    if (r === 'saved') return saved;
    if (r === 'clear') { drawn = false; continue; }
    if (r !== 'ok') return null;
    if (!drawn) { toast('Draw your signature first'); continue; }
    const img = trimCanvas(cv);
    if (keep.checked) await db.setMeta('mysig', img);
    return img;
  }
}
function trimCanvas(cv) {
  const g = cv.getContext('2d'); const { width: w, height: hh } = cv; const d = g.getImageData(0, 0, w, hh).data;
  let x0 = w, y0 = hh, x1 = 0, y1 = 0;
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const out = document.createElement('canvas'); const pw = Math.max(1, x1 - x0 + 8), ph = Math.max(1, y1 - y0 + 8);
  out.width = pw; out.height = ph; out.getContext('2d').drawImage(cv, x0 - 4, y0 - 4, pw, ph, 0, 0, pw, ph);
  return out.toDataURL('image/png');
}
