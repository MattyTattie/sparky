// =====================================================================
// certui.js — a certificate: overview, form sections, inspections,
// observations, signatures and the PDF.
// =====================================================================
import { findOldPdf } from './filerules.js';
import * as db from './db.js';
import { h, fill, toast, modal, confirmBox, fmtDate, shareOrDownload, blobToDataUrl, emptyState, icon, withIcon } from './ui.js';
import { route, page, go, render } from './app.js';
import { S, openCert, changed, flush, getProfile, defaultInstruments, calibrationWarnings, INSTRUMENT_KINDS } from './state.js';
import { TYPES, newCert, sectionsFor, sectionDone, missingFields, visible, get, set, eicrOverall, blankBond, BOND_LOCATIONS, BOND_PARTS, SOURCE_TYPES, blankSource, sourcesMissing } from './certmodel.js';
import { EIC_ITEMS, EIC_OUTCOMES, EICR_ITEMS, EICR_OUTCOMES, CODE_TEXT, OBSERVATIONS, OBS_CATS, EIC_HELP, EICR_HELP } from './inspections.js';
import { checkCircuit, isSpare } from './checks.js';
import { CHECK_NOTE } from './limits.js';

export async function createCert(type, job, cust) {
  const profile = await getProfile();
  const number = (profile.certPrefix || '') + await db.nextNumber(TYPES[type].prefix);
  const c = newCert(type, { job, customer: cust || {}, profile, instruments: await defaultInstruments(), number });
  if (type === 'EICR') c.eicr.overall = '';
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
  const hint = fd.hint ? h('div', { class: 'note fhint' }, fd.hint) : null;
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
      h('p', { class: 'note' }, 'Makes the certificate as a PDF laid out like the IET model forms, with your logo. “View PDF” shows it here first so you can check it before printing or sharing. Sharing opens your phone\u2019s share menu: you choose the app and who it goes to. Nothing is sent by itself.'),
      h('div', { class: 'btns full' }, h('button', { class: 'btn primary', onclick: (e) => makePdf(cert, e.currentTarget, 'share') }, 'Make PDF and share'), h('button', { class: 'btn', onclick: (e) => makePdf(cert, e.currentTarget, 'view') }, 'View PDF'),
        cert.type !== 'MW' ? h('button', { class: 'btn', onclick: (e) => makeChart(cert, e.currentTarget) }, 'Circuit chart') : null),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!cert.pdfFlags, onchange: (e) => { cert.pdfFlags = e.target.checked; changed(); } }), 'Highlight readings over the limit in red on the PDF'),
      cert.status !== 'issued' ? h('button', { class: 'btn', onclick: async () => { if (await confirmBox('Mark as issued?', 'Records today as the issue date. You can still edit it.', 'Mark issued')) { cert.status = 'issued'; cert.issuedAt = new Date().toISOString(); changed(); await flush(); render(); } } }, 'Mark as issued') : null),
    h('div', { class: 'btns full' }, h('button', { class: 'btn warn', onclick: async () => { if (await confirmBox('Delete certificate?', cert.number + ' will be removed from this device.', 'Delete', 'warn')) { await db.del('certs', id); S.cert = null; go(job ? '#/job/' + job.id : '#/'); } } }, 'Delete certificate')),
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
async function makePdf(cert, btn, how) {
  await flush(); const label = btn.textContent; btn.disabled = true; btn.textContent = 'Making PDF…';
  try {
    const { certificatePdf, pdfName } = await import('./pdf.js');
    const blob = await certificatePdf(cert, { profile: await getProfile(), photos: await pdfPhotos(cert) });
    const name = pdfName(cert); await savePdf(cert, blob, name);
    if (how === 'view') (await import('./pdfview.js')).viewPdf(blob, name, { shareText: `${TYPES[cert.type].name} ${cert.number}` });
    else { const r = await shareOrDownload(blob, name, `${TYPES[cert.type].name} ${cert.number}`); if (r === 'downloaded') toast('Saved to your downloads'); }
  } catch (e) { console.error(e); toast('Couldn\u2019t make the PDF: ' + ((e && e.message) || 'the browser wouldn\u2019t save it (private browsing?)')); }
  btn.disabled = false; btn.textContent = label;
}
async function makeChart(cert, btn) {
  await flush(); btn.disabled = true;
  try {
    const { boardChartPdf, pdfName } = await import('./pdf.js');
    const { viewPdf } = await import('./pdfview.js');
    for (const b of [...cert.boards].reverse()) { const blob = await boardChartPdf(cert, b, await getProfile()); const name = pdfName(cert, '-chart-' + (b.ref || 'DB')); await savePdf(cert, blob, name, 'chart'); viewPdf(blob, name); }
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

// ---------- A form section ----------
route(/^\/cert\/([^/]+)\/s\/([^/]+)$/, async (id, sid) => {
  const cert = await openCert(id); if (!cert) return go('#/');
  const secs = sectionsFor(cert.type);
  const i = secs.findIndex((s) => s.id === sid);
  const s = sid === 'instruments' ? { id: 'instruments', title: 'Test instruments', form: '' } : secs[i];
  if (!s) return go('#/cert/' + id);
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
        h('div', { class: 'card' }, s.fields.map((fd) => field(cert, fd, (k, v, d) => { if (k === 'eic.samePerson' || k.startsWith('people.designer')) { if (k === 'eic.samePerson' || get(cert, 'eic.samePerson')) syncPeople(cert); if (k === 'eic.samePerson') return draw(); } if (d.redraw) draw(); else refreshState(); }))),
        s.id === 'supply' && get(cert, 'supply.otherSources') ? sourcesSection(cert, draw) : null];
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
    ...items.map(([n, text, head]) => head ? h('div', { class: 'ins head' }, n + '  ' + text) : h('div', { class: 'ins' }, h('span', { class: 'num' }, n), h('div', { class: 'txt' }, text, helpLine(cert, n), h('div', { class: 'chips', style: 'margin-top:6px' }, outs.map((o) => h('button', { class: 'chip ' + o.toLowerCase().replace('/', '') + (cert.inspections[n] === o ? ' on' : ''), onclick: async () => {
      cert.inspections[n] = cert.inspections[n] === o ? '' : o; changed(); draw();
      if (cert.type === 'EICR' && /^(C1|C2|C3|FI)$/.test(o) && cert.inspections[n] === o && !cert.observations.some((x) => x.item === n)) {
        if (await confirmBox('Add an observation?', `Item ${n} is ${o}. Add it to the observations list now?`, 'Add observation')) { cert.observations.push({ id: db.newId(), item: n, text: text.replace(/\s*\([^)]*\)\s*$/, ''), code: o, reg: (/\(([^)]*)\)\s*$/.exec(text) || [])[1] || '', location: '' }); changed(); toast('Added to observations'); }
      }
    } }, o)))))));
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
      h('div', { class: 'btns' }, h('button', { class: 'btn tiny', onclick: () => pick(o) }, 'Use wording from the library')),
      h('label', { class: 'f' }, h('span', {}, 'Location / circuit'), h('input', { value: o.location || '', oninput: (e) => { o.location = e.target.value; changed(); } })),
      h('div', { class: 'grid2' }, h('label', { class: 'f' }, h('span', {}, 'Regulation(s)'), h('input', { value: o.reg || '', oninput: (e) => { o.reg = e.target.value; changed(); } })), h('div', {}, h('span', { class: 'note' }, 'Code'), codeChips)),
      o.item ? h('div', { class: 'note' }, 'From schedule item ' + o.item) : null);
  };
  const pick = async (replace = null) => { const o = await pickObservation(); if (!o) return; if (replace) { Object.assign(replace, { text: o.text, code: o.code, reg: o.reg }); changed(); redraw(); } else add(o); };
  const add = (o) => { obs.push({ id: db.newId(), text: o.text, code: o.code, reg: o.reg, location: '' }); changed(); redraw(); };
  const counts = ['C1', 'C2', 'C3', 'FI'].map((c) => `${c}: ${obs.filter((o) => o.code === c).length}`).join('  ·  ');
  return h('div', {},
    h('div', { class: 'notice ' + (eicrOverall(cert) === 'SATISFACTORY' ? 'green' : 'red') }, `${counts}. Overall: ${eicrOverall(cert)}.`),
    obs.length ? obs.map(card) : emptyState('clipboard', 'No observations. If there are none, the PDF says so.'),
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
            if (keep.checked) { try { await db.setMeta('mysig', img); } catch (e) { toast('Signed, but couldn\u2019t save it for next time'); } }
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
