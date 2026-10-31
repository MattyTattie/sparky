// =====================================================================
// certui.js — a certificate: overview, form sections, inspections,
// observations, signatures and the PDF.
// =====================================================================
import { findOldPdf } from './filerules.js';
import * as db from './db.js';
import { isSpareCircuit as isSpareC } from './templates.js';
import { h, fill, toast, modal, confirmBox, fmtDate, shareOrDownload, blobToDataUrl, emptyState, icon, withIcon } from './ui.js';
import { route, page, go, render } from './app.js';
import { S, openCert, changed, flush, getProfile, defaultInstruments, defaultInstrumentIds, getInstruments, instrumentsFor, instrumentText, calibrationWarnings, INSTRUMENT_KINDS, saveSetting } from './state.js';
import { calDateFields, CAL_DATE_WARN } from './instruments.js';
import { screenSections, countsToward, pdfFlagsOn } from './certmodel.js';
import { TYPES, newCert, sectionsFor, sectionDone, missingFields, visible, get, set, eicrOverall, blankBond, BOND_LOCATIONS, BOND_PARTS, SOURCE_TYPES, blankSource, sourcesMissing, isNewInstall } from './certmodel.js';
import { INTAKE_NOTE_10, INTAKE_NOTES, INTAKE_NOTIFIED, migrateIntake, EIC_ITEMS, EIC_OUTCOMES, EICR_ITEMS, EICR_OUTCOMES, CODE_TEXT, OBSERVATIONS, OBS_CATS, EIC_HELP, EICR_HELP } from './inspections.js';
import { checkCircuit, isSpare } from './checks.js';
import { CHECK_NOTE } from './limits.js';
import { diagramSvg, diagramInPdf, diagramHasCircuits, SPUR_FEEDS, CONTROL_VIA, switchInfo, roomListOf, roomPointsNote, socketRoomsOf, roomPointTotal, pointKind, socketSingles, arrangedOrder, feedInfo, ISOLATORS } from './wiring.js';
import { limitOn, limitBar } from './limitbar.js';
import { circuitReadings, makeTemplate, applyTemplate, nextRoom, tidyLayouts, BUILTIN_TEMPLATES, TEMPLATE_KEY } from './diagrampro.js';
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
  const href = (r) => (r.mw ? `#/cert/${id}/mwc` : `#/cert/${id}/b/${r.bi}/c/${r.ci}`);
  const draw = () => { box.innerHTML = diagramHasCircuits(cert) ? diagramSvg(cert, { W: diagW(), font: diagW() > 600 ? 14 : 12, screen: true, tap: true }) : ''; };
  /* v0.43.1: desktop draws at the real width (1 unit = 1px) instead of a stretched phone column */
  function diagW() { const w = box.clientWidth || 0; return w > 460 ? Math.min(1100, Math.round(w)) : 380; }
  let rzT = 0; let lastW = box.clientWidth; window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { if (!box.isConnected) return; if (Math.abs(box.clientWidth - lastW) > 40) { lastW = box.clientWidth; draw(); } }, 200); });
  setTimeout(() => { if (box.isConnected && box.clientWidth > 460) { lastW = box.clientWidth; draw(); } }, 0);
  draw();
  // v0.41 (test): tap a circuit (or a room box in it) for its readings, then Edit
  const openReadings = async (bi, ci, mw) => {
    const b = mw ? null : (cert.boards || [])[bi]; const c = mw ? cert.mw.circuit : b && b.circuits[ci]; if (!c) return;
    const ctx = mw ? { earthing: cert.mw.earthing, zdb: cert.mw.zdb } : { earthing: cert.supply.earthing, zdb: b.zdb };
    const COLR = { red: '#c81e1e', amber: '#b86e00' };
    const rows = circuitReadings(c, ctx).map((r) => h('div', { class: 'rdrow', style: 'display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)' },
      h('span', { style: 'color:#6b7280' }, r.label), h('span', { style: 'text-align:right;white-space:normal;word-break:break-word' }, h('b', { style: r.value ? (r.level ? 'color:' + COLR[r.level] : '') : 'color:#aaa' }, r.value || 'N/A'), r.note ? h('span', { class: 'note', style: 'display:block;margin:0' }, r.note) : null)));
    const ctl = c.control && c.control.controlCircuit; const sw = (b ? b.circuits : []).filter((x) => x.control && String(x.control.controlCircuit) === String(c.num)).map((x) => x.num);
    const fed = mw ? [] : (cert.boards || []).filter((o, oi) => { const f = oi !== bi && feedInfo(cert.boards, oi); return f && f.state === 'ok' && f.bi === bi && String(f.circuit).toLowerCase() === String(c.num).toLowerCase(); });
    const jumps = [...(ctl ? [String(ctl)] : []), ...sw.map(String)];
    const v = await modal(`Circuit ${c.num || '?'}  ${c.desc || ''}`, h('div', {}, ...rows, fed.length ? h('p', { class: 'note', style: 'margin:8px 0 0' }, 'Feeds ' + fed.map((o) => o.ref).join(', ')) : null),
      [{ label: 'Close', value: null }, ...jumps.map((n) => ({ label: 'See circuit ' + n, value: 'go:' + n })), { label: 'Edit', value: 'edit', cls: 'primary' }]);
    if (v === 'edit') go(href({ bi, ci, mw }));
    else if (v && v.startsWith('go:')) { const n = v.slice(3); const tj = (b ? b.circuits : []).findIndex((x) => String(x.num) === n); const g = box.querySelector(`.dgc[data-bi="${bi}"][data-ci="${tj}"]`); if (g) { g.scrollIntoView({ block: 'center' }); openReadings(bi, tj, false); } }
  };
  // v0.43.1: warnings jump to the card that fixes them, on that circuit
  const circ = (bi, ci, mw) => (mw ? cert.mw.circuit : ((cert.boards || [])[bi] || { circuits: [] }).circuits[ci]);
  const openFold = (sel) => { const d = document.querySelector(sel + ' details'); if (d) d.open = true; return d; };
  const openCoil = (c) => { openFold('#controlcard'); const s = [...document.querySelectorAll('#controlrows select')].find((x) => x.getAttribute('aria-label') === 'Coil fed from, circuit ' + (c.num || '')) || [...document.querySelectorAll('#controlrows select')].find((x) => x.getAttribute('aria-label') === 'Controlled by, circuit ' + (c.num || ''));
    if (s) { s.scrollIntoView({ block: 'center' }); s.focus(); s.style.outline = '3px solid var(--brand,#2952ff)'; setTimeout(() => { s.style.outline = ''; }, 2500); } };
  const openRooms = (c) => { openFold('#extrascard'); const pk = document.querySelector('#extrascircuit');
    if (pk) { const o = [...pk.options].find((x) => x.textContent.trim().startsWith(String(c.num || '') + ' ')); if (o && pk.value !== o.value) { pk.value = o.value; pk.dispatchEvent(new Event('change')); } }
    setTimeout(() => { const r = document.querySelector('#extrascard .roomsed') || pk; if (r) r.scrollIntoView({ block: 'start' }); }, 50); };
  const WARN = /^(Choose which circuit feeds|Rooms add up|Coil supply)/;
  box.addEventListener('click', (e) => { const g = e.target.closest('.dgc'); if (!g) return;
    const t = e.target.closest('text'); const txt = t ? t.textContent : '';
    if (WARN.test(txt)) { const c = circ(+g.dataset.bi, +g.dataset.ci, !!g.dataset.mw); if (c) { if (/^Rooms/.test(txt)) openRooms(c); else openCoil(c); return; } }
    openReadings(+g.dataset.bi, +g.dataset.ci, !!g.dataset.mw); });
  // v0.43.1: "Needs attention" card: each problem opens its fix; points mismatches get one-tap fixes
  const issuesBox = h('div', { id: 'diagissues' }); const topIssues = h('div', { id: 'diagissuestop' });
  const drawIssues = () => { const items = diagramIssues(cert);
    // v0.43.3: count badge, and a small link at the top of the page that scrolls down to the card
    fill(topIssues, items.length ? [h('button', { type: 'button', class: 'linkbtn', id: 'issueslink', style: 'background:none;border:0;padding:6px 0;min-height:40px;color:#b45309;font-weight:700;font-size:14px;text-align:left', onclick: () => issuesBox.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, `\u26a0 ${items.length} need${items.length === 1 ? 's' : ''} attention \u203a`)] : []);
    fill(issuesBox, items.length ? [h('div', { class: 'card', style: 'padding:10px 12px' }, h('b', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:4px' }, 'Needs attention', h('span', { class: 'fbadge issuecount' }, String(items.length))),
      ...items.map((it) => h('div', { class: 'issue', style: 'border-top:1px solid var(--line);padding:8px 0' },
        h('button', { type: 'button', class: 'btn ghost issuego', style: 'width:100%;min-height:44px;white-space:normal;text-align:left;justify-content:space-between;display:flex;gap:8px', onclick: () => (it.kind === 'coil' ? openCoil(it.c) : openRooms(it.c)) }, h('span', {}, `Circuit ${it.c.num || '?'}: ${it.text}`), h('span', { 'aria-hidden': 'true' }, '\u203a')),
        it.fixes.length ? h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;margin-top:6px' }, it.fixes.map((f) => h('button', { type: 'button', class: 'btn issuefix', style: 'flex:1 1 auto;min-height:44px;white-space:normal', onclick: () => { f.apply(); changed(); refresh(); toast('Done'); } }, f.label))) : null)))] : []); };
  let extrasEl = null; const refresh = () => { draw(); drawIssues(); if (extrasEl) { const n = extrasCard(cert, () => { draw(); drawIssues(); }); const wasOpen = extrasEl.querySelector('details') && extrasEl.querySelector('details').open; if (wasOpen && n.querySelector('details')) n.querySelector('details').open = true; extrasEl.replaceWith(n); extrasEl = n; } };
  drawIssues();
  box.addEventListener('keydown', (e) => { if (e.key !== 'Enter') return; const g = e.target.closest('.dgc'); if (g) openReadings(+g.dataset.bi, +g.dataset.ci, !!g.dataset.mw); });
  const tidy = async () => {
    const cb = h('input', { type: 'checkbox', id: 'tidyreset' });
    const ok = await modal('Tidy up the diagram', h('div', {}, h('p', {}, 'Puts every room box back into neat slots and clears any odd moves. Your room order is kept.'), h('label', { style: 'display:flex;gap:10px;align-items:center' }, cb, h('span', {}, 'Also put rooms back in the order they were added'))), [{ label: 'Cancel', value: false }, { label: 'Tidy up', value: true, cls: 'primary' }]);
    if (!ok) return; const n = tidyLayouts(cert, { resetOrder: cb.checked }); if (n) changed(); draw(); toast(n ? `Tidied ${n} circuit${n === 1 ? '' : 's'}` : 'Already tidy');
  };
  const sw = h('button', { class: 'switch' + (cert.diagramPdf !== false ? ' on' : ''), type: 'button', role: 'switch', id: 'diagrampdf', 'aria-label': 'Include in the PDF', 'aria-checked': String(cert.diagramPdf !== false), onclick: () => { cert.diagramPdf = cert.diagramPdf === false; changed(); sw.classList.toggle('on', cert.diagramPdf !== false); sw.setAttribute('aria-checked', String(cert.diagramPdf !== false)); } }, h('span', {}));
  page('Wiring diagram', [
    h('p', { class: 'note' }, cert.type === 'MW' ? 'Drawn from the circuit on this certificate. It fills in as you add the details.' : 'Drawn from the supply, the board and each circuit. It fills in as you add the details. Number of points served sets how many sockets or lights are drawn.'),
    topIssues,
    diagramHasCircuits(cert) ? h('div', { class: 'card', style: 'padding:10px 6px' }, box) : emptyState('zap', 'No circuits yet. Add circuits and the diagram draws itself.'),
    issuesBox,
    cert.type === 'MW' ? spurCard(cert, draw) : null,
    diagramHasCircuits(cert) ? h('div', { style: 'display:flex;gap:8px;align-items:center;margin:-4px 4px 10px' }, h('p', { class: 'note', style: 'margin:0;flex:1' }, 'Tap a circuit or room for its readings.'), h('button', { class: 'btn ghost', type: 'button', id: 'tidybtn', style: 'min-height:44px;white-space:normal', onclick: tidy }, 'Tidy up')) : null,
    diagramHasCircuits(cert) ? (extrasEl = extrasCard(cert, () => { draw(); drawIssues(); })) : null,
    diagramHasCircuits(cert) ? controlCard(cert, () => { draw(); drawIssues(); }) : null,
    h('div', { class: 'card' }, h('div', { class: 'switchrow', style: 'border-top:0;margin-top:0' }, h('span', {}, 'Include in the PDF (after the schedules)'), sw)),
  ], { back: '#/cert/' + id, sub: cert.number });
});

// v0.43.1: problems on the diagram, each tied to its circuit, with one-tap fixes for points.
export function diagramIssues(cert) {
  const all = cert.type === 'MW' ? (cert.mw && cert.mw.circuit ? [cert.mw.circuit] : []) : (cert.boards || []).flatMap((b) => b.circuits || []);
  const out = [];
  for (const c of all) { if (!c || isSpareC(c)) continue;
    const k = c.control; if (k && k.via && k.via !== 'none' && !String(k.controlCircuit || '').trim()) out.push({ c, kind: 'coil', text: 'choose which circuit feeds the contactor coil', fixes: [] });
    const note = roomPointsNote(c); if (!note) continue;
    const sock = !!socketRoomsOf(c); const t = roomPointTotal(c); const n = parseInt(String(c.points ?? ''), 10);
    const fixes = [{ label: `Set points to ${t}`, apply: () => { c.points = String(t); } }];
    const raw = c.diagram && Array.isArray(c.diagram.roomList) ? c.diagram.roomList : []; const last = raw[raw.length - 1];
    if (Number.isFinite(n) && n > t && last) { const d = n - t; const f = sock ? 'sockets' : 'lights', w = sock ? 'socket' : 'light'; fixes.push({ label: `Add ${d} ${w}${d === 1 ? '' : 's'} to ${last.name || 'the last room'}`, apply: () => { last[f] = Math.min(sock ? 20 : 10, (+last[f] || 0) + d); } }); }
    out.push({ c, kind: 'points', text: note, fixes });
  }
  return out;
}

// "Controlled by": a folded card, one pick per circuit. Only circuits
// switched through a contactor or time clock need touching. Saves an
// optional circuit.control; nothing else in the cert changes.
function controlCard(cert, redraw) {
  const all = cert.type === 'MW' ? (cert.mw.circuit ? [cert.mw.circuit] : []) : (cert.boards || []).flatMap((b) => b.circuits || []);
  const live = all.filter((c) => c && !isSpareC(c));
  const name = (c) => `${c.num || '?'}  ${c.desc || 'No description'}`;
  const set = cert.type === 'MW' ? 0 : live.filter((c) => c.control && c.control.via && c.control.via !== 'none').length;
  const body = h('div', { id: 'controlrows' });
  const draw = () => {
    fill(body, [h('p', { class: 'note', style: 'margin:4px 0 8px' }, 'For loads switched through a contactor, e.g. an immersion on a time clock. Pick what switches it and which circuit feeds the coil.'),
      ...live.map((c) => {
        const k = c.control || {}; const via = CONTROL_VIA[k.via] ? k.via : 'none';
        const upd = (patch) => { c.control = { via, controlCircuit: k.controlCircuit || '', ...patch }; if (c.control.via === 'none') delete c.control; changed(); redraw(); draw(); };
        const row = [h('label', { class: 'f' }, h('span', {}, name(c)), h('select', { 'aria-label': 'Controlled by, circuit ' + (c.num || ''), onchange: (e) => upd({ via: e.target.value }) }, Object.entries(CONTROL_VIA).map(([v, t]) => h('option', { value: v, selected: v === via ? true : null }, t))))];
        if (via !== 'none' && cert.type !== 'MW') row.push(h('label', { class: 'f' }, h('span', {}, 'Coil fed from'), h('select', { 'aria-label': 'Coil fed from, circuit ' + (c.num || ''), onchange: (e) => upd({ controlCircuit: e.target.value }) }, [h('option', { value: '' }, 'Not set'), ...coilOrder(live.filter((o) => o !== c)).map((o) => h('option', { value: String(o.num), selected: String(k.controlCircuit || '') === String(o.num) ? true : null }, name(o)))])));
        else if (via !== 'none') row.push(h('label', { class: 'f' }, h('span', {}, 'Coil fed from circuit'), h('input', { value: k.controlCircuit || '', inputmode: 'numeric', onchange: (e) => upd({ controlCircuit: e.target.value.trim() }) })));
        return h('div', { style: 'border-top:1px solid var(--line);padding-top:6px' }, row);
      })]);
  };
  draw();
  return h('div', { class: 'card', id: 'controlcard' }, h('details', { class: 'fold' }, h('summary', {}, h('span', { class: 'foldt' }, 'Controlled by', h('span', { class: 'folds' }, 'Contactors, time clocks, relays')), set ? h('span', { class: 'fbadge' }, `${set} set`) : null, h('span', { class: 'foldic' }, '›')), h('div', { class: 'foldin' }, body)));
}

// Control / time clock / relay circuits first in the "Coil fed from" list.
const CTRL_RE = /control|clock|timer|time ?switch|relay|contactor|\bcoil/i;
function coilOrder(list) { return [...list.filter((o) => CTRL_RE.test(o.desc || '')), ...list.filter((o) => !CTRL_RE.test(o.desc || ''))]; }

// "Switches and rooms": a folded card. v0.40 (test): pick one circuit at the
// top (defaults to the first lighting circuit) instead of a list of every
// circuit. Saves the same optional circuit.diagram fields as before.
const pickedCircuit = new Map(); // cert id -> chosen circuit index (this session)
export const COMMON_ROOMS = ['Kitchen', 'Living room', 'Dining room', 'Hall', 'Stairs', 'Landing', 'Bedroom 1', 'Bedroom 2', 'Bedroom 3', 'Bedroom 4', 'Bedroom 5', 'Bathroom', 'En-suite', 'WC', 'Utility', 'Garage', 'Loft', 'Porch', 'Conservatory', 'Outside'];
// Room names already used on other circuits of this job (roomList names and the rooms text).
export function jobRoomNames(all, except) {
  const out = [];
  for (const c of all) {
    if (!c || c === except || !c.diagram) continue;
    for (const r of (Array.isArray(c.diagram.roomList) ? c.diagram.roomList : [])) if (r && r.name) out.push(String(r.name).trim());
    if (c.diagram.rooms) out.push(...String(c.diagram.rooms).split(/,|\band\b/).map((x) => x.trim()));
  }
  /* v0.43.2: old certs keep a room COUNT in diagram.rooms ("5"); only real names count */
  for (let i = out.length - 1; i >= 0; i--) if (!isRoomName(out[i])) out.splice(i, 1);
  return [...new Set(out.filter(Boolean))];
}
function extrasCard(cert, redraw) {
  const all = cert.type === 'MW' ? (cert.mw.circuit ? [cert.mw.circuit] : []) : (cert.boards || []).flatMap((b) => b.circuits || []);
  const live = all.filter((c) => c && !isSpareC(c));
  const name = (c) => `${c.num || '?'}  ${c.desc || 'No description'}`;
  const nset = live.filter((c) => c.diagram && (c.diagram.rooms || (c.diagram.roomList || []).length || ['sw1', 'sw2', 'swi', 'singles', 'isolator'].some((k) => c.diagram[k] !== undefined && c.diagram[k] !== ''))).length;
  const body = h('div', { id: 'extrasrows' });
  const save = (c, k, v) => { const d = { ...(c.diagram || {}) }; if (v === '' || v == null) delete d[k]; else d[k] = v; if (Object.keys(d).length) c.diagram = d; else delete c.diagram; changed(); redraw(); };
  const key = cert.id || 'x';
  if (!pickedCircuit.has(key) || !live[pickedCircuit.get(key)]) { const li = live.findIndex((c) => switchInfo(c) !== null); pickedCircuit.set(key, li >= 0 ? li : 0); }
  const one = h('div', { id: 'extrasone' }); let arranging = false;
  const drawOne = () => {
    const c = live[pickedCircuit.get(key)]; if (!c) { fill(one, []); return; }
    const d = c.diagram || {}; const isLight = switchInfo(c) !== null;
    const si = isLight ? switchInfo(c) : null;
    const ins = {}; const cur = { sw1: si ? String(si.list.filter((x) => x === 'sw1').length) : '1', sw2: si ? String(si.list.filter((x) => x === 'sw2').length / 2) : '0', swi: si ? String(si.list.filter((x) => x === 'swi').length) : '0' };
    const numIn = (k, label) => h('label', { class: 'f', style: 'flex:1;min-width:0' }, h('span', {}, label), ins[k] = h('input', { type: 'number', min: '0', max: '10', inputmode: 'numeric', 'aria-label': label + ', circuit ' + (c.num || ''), value: cur[k], onchange: () => { for (const o of ['sw1', 'sw2', 'swi']) { const n = Math.max(0, Math.min(10, parseInt(ins[o].value, 10) || 0)); ins[o].value = String(n); save(c, o, String(n)); } } }));
    fill(one, [h('b', { class: 'pickname', style: 'display:block;margin:8px 0 4px;word-break:break-word;white-space:normal' }, name(c)),
      isLight && arranging ? arrangeRooms(c, redraw, () => { arranging = false; drawOne(); }) : null,
      isLight && !arranging ? roomsEditor(c, redraw, () => jobRoomNames(all, c), () => roomsOnOtherCircuits(all, c)) : null,
      isLight && !arranging ? templateRow(c, redraw, drawOne) : null,
      isLight && !arranging && (d.roomList || []).length > 1 ? h('button', { class: 'btn ghost', type: 'button', id: 'arrangebtn', style: 'width:100%;min-height:48px;margin-top:4px', onclick: () => { arranging = true; drawOne(); } }, 'Arrange room boxes') : null,
      isLight && !roomListOf(c) ? h('details', { class: 'fold', style: 'margin-top:6px' }, h('summary', {}, h('span', { class: 'foldt' }, 'Or just set switch counts', h('span', { class: 'folds' }, 'Without rooms')), h('span', { class: 'foldic' }, '\u203a')),
        h('div', { class: 'foldin' }, h('label', { class: 'f' }, h('span', {}, 'Rooms (text)'), h('input', { placeholder: 'e.g. Kitchen, Hall', 'aria-label': 'Rooms, circuit ' + (c.num || ''), value: d.rooms || '', onchange: (e) => save(c, 'rooms', e.target.value.trim()) })),
          h('div', { style: 'display:flex;gap:8px' }, numIn('sw1', '1-way'), numIn('sw2', '2-way pairs'), numIn('swi', 'Intermediate')))) : null,
      pointKind(c) === 'socket' ? roomsEditor(c, redraw, () => jobRoomNames(all, c), () => roomsOnOtherCircuits(all, c), 'socket') : null, // v0.43.5: rooms on rings and radials
      !isLight && (pointKind(c) !== 'socket' || (d.rooms && !socketRoomsOf(c))) ? h('label', { class: 'f' }, h('span', {}, 'Rooms'), h('input', { placeholder: 'e.g. Kitchen, Hall', 'aria-label': 'Rooms, circuit ' + (c.num || ''), value: d.rooms || '', onchange: (e) => save(c, 'rooms', e.target.value.trim()) })) : null,
      pointKind(c) === 'socket' && !socketRoomsOf(c) ? singlesRow(c, save) : null,
      isolatorRow(c, save)]);
  };
  const pick = h('select', { id: 'extrascircuit', 'aria-label': 'Circuit', style: 'width:100%;white-space:normal', onchange: (e) => { pickedCircuit.set(key, +e.target.value); arranging = false; drawOne(); } },
    live.map((c, i) => h('option', { value: String(i), selected: i === pickedCircuit.get(key) ? true : null }, name(c) + (c.diagram && (c.diagram.roomList || []).length ? ` (${c.diagram.roomList.length} room${c.diagram.roomList.length === 1 ? '' : 's'})` : ''))));
  // v0.43.3: step to the previous / next circuit without the dropdown; from a lighting circuit it skips to the next lighting one
  const stepTo = (dir) => { const cur = pickedCircuit.get(key) || 0; const light = pointKind(live[cur]) === 'light';
    for (let j = cur + dir; j >= 0 && j < live.length; j += dir) if (!light || pointKind(live[j]) === 'light') { pickedCircuit.set(key, j); pick.value = String(j); arranging = false; drawOne(); syncNav(); return; }
    toast(dir > 0 ? 'That\u2019s the last one' : 'That\u2019s the first one'); };
  const navB = (t, dir, id) => h('button', { class: 'btn ghost', type: 'button', id, style: 'flex:1;min-height:44px', onclick: () => stepTo(dir) }, t);
  const navRow = h('div', { class: 'circnav', style: 'display:flex;gap:8px;margin:-2px 0 6px' }, navB('\u2039 Prev circuit', -1, 'circprev'), navB('Next circuit \u203a', 1, 'circnext'));
  const syncNav = () => {}; pick.addEventListener('change', syncNav);
  drawOne();
  fill(body, [h('p', { class: 'note', style: 'margin:4px 0 8px' }, 'Optional. Pick a circuit, then add its rooms. Lighting circuits get one 1-way switch unless you set them here.'),
    h('label', { class: 'f' }, h('span', {}, 'Circuit'), pick), navRow, one]);
  return h('div', { class: 'card', id: 'extrascard' }, h('details', { class: 'fold' }, h('summary', {}, h('span', { class: 'foldt' }, 'Switches and rooms', h('span', { class: 'folds' }, 'Light switches, rooms, sockets, isolators')), nset ? h('span', { class: 'fbadge' }, `${nset} set`) : null, h('span', { class: 'foldic' }, '\u203a')), h('div', { class: 'foldin' }, body)));
}

// v0.41 (test): saved diagram templates (app settings, not the certificate).
function templateRow(c, redraw, again) {
  const mine = async () => (await db.getMeta(TEMPLATE_KEY)) || [];
  const saveT = async () => {
    const inp = h('input', { id: 'tplname', placeholder: 'e.g. My usual lighting', value: c.desc ? c.desc : '' });
    const ok = await modal('Save as my template', h('div', {}, h('p', { class: 'note' }, 'Saves these rooms, switches, wiring method and control (not readings) on this phone, to use on other jobs.'), h('label', { class: 'f' }, h('span', {}, 'Template name'), inp)), [{ label: 'Cancel', value: false }, { label: 'Save', value: true, cls: 'primary' }]);
    if (!ok) return; const t = makeTemplate(c, inp.value); const list = (await mine()).filter((x) => x.name !== t.name); list.push(t); await saveSetting(TEMPLATE_KEY, list); toast('Template saved');
  };
  const applyT = async () => {
    const list = [...BUILTIN_TEMPLATES, ...(await mine())];
    const v = await modal('Apply template', h('p', { class: 'note' }, (c.diagram && (c.diagram.roomList || []).length) ? 'Your rooms stay; their wiring method and the control change to the template\u2019s.' : 'Adds the template\u2019s rooms to this circuit.'),
      [...list.map((t, i) => ({ label: t.name + (t.builtin ? ' (built in)' : ''), value: String(i) })), { label: 'Cancel', value: null }]);
    if (v == null) return; const r = applyTemplate(c, list[+v]); c.diagram = r.diagram; if (r.control) c.control = r.control; changed(); redraw(); again(); toast('Template applied');
  };
  return h('div', { class: 'tplrow', style: 'display:flex;gap:8px;flex-wrap:wrap;margin:6px 0' },
    h('button', { class: 'btn ghost', type: 'button', id: 'tplsave', style: 'flex:1 1 auto;min-height:48px;white-space:normal', onclick: saveT }, 'Save as my template'),
    h('button', { class: 'btn ghost', type: 'button', id: 'tplapply', style: 'flex:1 1 auto;min-height:48px;white-space:normal', onclick: applyT }, 'Apply template'));
}

// v0.39 (test): "Rooms on this circuit" for a lighting circuit. Saves an
// optional circuit.diagram.roomList; with rooms set, the diagram draws each
// room in its own box and the plain rooms text / switch counts step aside.
// Sockets: twins by default; a −/+ count of how many are singles.
function singlesRow(c, save) {
  const max = Math.max(0, parseInt(c.points, 10) || 10);
  const out = h('span', { class: 'stepval', id: 'singles-' + (c.num || ''), style: 'min-width:1.6em;text-align:center;font-weight:700' }, String(socketSingles(c)));
  const st = (dv) => () => { const n = Math.max(0, Math.min(max, (parseInt(out.textContent, 10) || 0) + dv)); out.textContent = String(n); save(c, 'singles', n ? String(n) : ''); };
  return h('div', { class: 'singlesrow', style: 'margin-top:6px' },
    h('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:8px' }, h('span', {}, 'Single sockets'),
      h('div', { class: 'rstep', style: 'display:flex;align-items:center;gap:6px' }, h('button', { class: 'stepbtn', type: 'button', 'aria-label': 'Single sockets, one fewer', onclick: st(-1) }, '\u2212'), out, h('button', { class: 'stepbtn', type: 'button', 'aria-label': 'Single sockets, one more', onclick: st(1) }, '+'))),
    h('p', { class: 'note', style: 'margin:2px 0 0' }, 'Sockets draw as twins. Set how many are singles.'));
}
// v0.43 (test): optional local isolator by the load (circuit.diagram.isolator = { type, rating }).
function isolatorRow(c, save) {
  const cur = (c.diagram && c.diagram.isolator) || {};
  const sel = h('select', { id: 'isotype-' + (c.num || ''), 'aria-label': 'Local isolator, circuit ' + (c.num || ''), style: 'width:100%;white-space:normal', onchange: () => put() },
    [h('option', { value: '' }, 'None'), ...Object.entries(ISOLATORS).map(([k, v]) => h('option', { value: k, selected: cur.type === k ? true : null }, v))]);
  const rt = h('input', { id: 'isorating-' + (c.num || ''), placeholder: 'Rating (optional), e.g. 20A', 'aria-label': 'Isolator rating, circuit ' + (c.num || ''), value: cur.rating || '', onchange: () => put() });
  const put = () => save(c, 'isolator', sel.value ? { type: sel.value, ...(rt.value.trim() ? { rating: rt.value.trim() } : {}) } : '');
  return h('div', { class: 'isorow', style: 'margin-top:8px' }, h('label', { class: 'f' }, h('span', {}, 'Local isolator'), sel), h('label', { class: 'f' }, h('span', {}, 'Isolator rating'), rt),
    h('p', { class: 'note', style: 'margin:2px 0 0' }, 'The switch by the load, e.g. a 20 A DP switch next to an immersion. Drawn just before the load.'));
}
const SW_KIND = { sw1: '1-way', sw2: '2-way', sw2i: '2-way + intermediate', none: 'No switch' };
const swKind = (r) => (+r.sw2pairs > 0 ? (+r.swi > 0 ? 'sw2i' : 'sw2') : +r.sw1 > 0 ? 'sw1' : 'none');
// v0.40 (test): Arrange mode. Drag a room box by its handle (touch or mouse);
// it clicks into the nearest slot. Saves circuit.diagram.layout.order only;
// the diagram (screen and PDF) redraws the feed and cables in the new order.
function arrangeRooms(c, redraw, done) {
  const box = h('div', { class: 'arrange', style: 'margin:8px 0' });
  const names = () => (c.diagram.roomList || []).map((r, i) => (r && r.name) || 'Room ' + (i + 1));
  const setOrder = (o) => { const d = { ...(c.diagram || {}) }; const plain = o.every((v, i) => v === i); if (plain) delete d.layout; else d.layout = { ...(d.layout || {}), order: o }; c.diagram = d; changed(); redraw(); };
  const draw = () => {
    const o = arrangedOrder(c); const nm = names();
    const slots = o.map((ri, pos) => {
      const r = c.diagram.roomList[ri] || {};
      const card = h('div', { class: 'arrslot', 'data-pos': String(pos), style: 'display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:10px;padding:10px;margin:0 0 8px;background:var(--card,#fff);touch-action:none;user-select:none' },
        h('span', { class: 'arrhandle', 'aria-hidden': 'true', style: 'font-size:22px;line-height:1;color:#7a8190;cursor:grab;padding:4px 6px' }, '☰'),
        h('span', { style: 'flex:1;min-width:0;white-space:normal;word-break:break-word' }, h('b', {}, `${pos + 1}. ${nm[ri]}`), h('span', { class: 'note', style: 'display:block;margin:0' }, `${+r.lights || 0} light${+r.lights === 1 ? '' : 's'}`)),
        h('button', { class: 'stepbtn', type: 'button', 'aria-label': 'Move ' + nm[ri] + ' up', disabled: pos === 0 ? true : null, style: 'border-radius:10px', onclick: () => { const n = [...o]; [n[pos - 1], n[pos]] = [n[pos], n[pos - 1]]; setOrder(n); draw(); } }, '↑'),
        h('button', { class: 'stepbtn', type: 'button', 'aria-label': 'Move ' + nm[ri] + ' down', disabled: pos === o.length - 1 ? true : null, style: 'border-radius:10px', onclick: () => { const n = [...o]; [n[pos + 1], n[pos]] = [n[pos], n[pos + 1]]; setOrder(n); draw(); } }, '↓'));
      // drag: follow the finger, then click into the nearest slot
      card.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return; e.preventDefault();
        const y0 = e.clientY; const cards = [...box.querySelectorAll('.arrslot')]; const hgt = card.getBoundingClientRect().height + 8;
        card.setPointerCapture(e.pointerId); card.style.boxShadow = '0 6px 18px rgba(0,0,0,.18)'; card.style.position = 'relative'; card.style.zIndex = '2';
        let to = pos;
        const mv = (ev) => { const dy = ev.clientY - y0; card.style.transform = `translateY(${dy}px)`; to = Math.max(0, Math.min(o.length - 1, pos + Math.round(dy / hgt)));
          cards.forEach((k, j) => { if (k === card) return; k.style.transform = j > pos && j <= to ? `translateY(${-hgt}px)` : j < pos && j >= to ? `translateY(${hgt}px)` : ''; k.style.transition = 'transform .12s'; }); };
        const up = () => { card.removeEventListener('pointermove', mv); card.removeEventListener('pointerup', up); card.removeEventListener('pointercancel', up);
          if (to !== pos) { const n = [...o]; const [m] = n.splice(pos, 1); n.splice(to, 0, m); setOrder(n); } draw(); };
        card.addEventListener('pointermove', mv); card.addEventListener('pointerup', up); card.addEventListener('pointercancel', up);
      });
      return card;
    });
    fill(box, [h('b', { style: 'display:block;margin:4px 0 2px' }, 'Arrange room boxes'),
      h('p', { class: 'note', style: 'margin:0 0 8px' }, 'Drag a box by ☰ (or use the arrows). It clicks into place, and the diagram and PDF follow, with the cables redrawn.'),
      ...slots,
      h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
        h('button', { class: 'btn ghost', type: 'button', id: 'resetlayout', style: 'flex:1 1 auto;min-height:48px', onclick: () => { const d = { ...(c.diagram || {}) }; delete d.layout; c.diagram = d; changed(); redraw(); draw(); } }, 'Reset layout'),
        h('button', { class: 'btn', type: 'button', id: 'arrangedone', style: 'flex:1 1 auto;min-height:48px', onclick: done }, 'Done'))]);
  };
  draw();
  return box;
}
// Simple tap-to-choose buttons (wrap onto new lines, no truncation).
const segs = (opts, cur, label, onpick) => h('div', { class: 'segs', role: 'group', 'aria-label': label, style: 'display:flex;flex-wrap:wrap;gap:6px' },
  opts.map(([v, t]) => h('button', { type: 'button', class: 'btn ghost seg' + (v === cur ? ' on' : ''), 'aria-pressed': String(v === cur), style: 'flex:1 1 auto;min-height:44px;padding:8px 10px;white-space:normal' + (v === cur ? ';background:var(--brand,#2952ff);border-color:var(--brand,#2952ff);color:#fff' : ''), onclick: () => onpick(v) }, t)));
// v0.43 (test): one tick-list of rooms. Ticking adds the room to
// circuit.diagram.roomList (same format: name, lights, sw1, sw2pairs, swi,
// wiring); each ticked room gets a compact row; unticking removes it.
export const TICK_ROOMS = ['Kitchen', 'Living room', 'Dining room', 'Hall', 'Landing', 'Stairs', 'Bedroom 1', 'Bedroom 2', 'Bedroom 3', 'Bedroom 4', 'Bathroom', 'En-suite', 'WC', 'Utility', 'Garage', 'Loft', 'Outside'];
// name -> circuit number, for rooms on OTHER lighting circuits of this job
export function roomsOnOtherCircuits(all, except) {
  const m = {};
  for (const x of all) { if (!x || x === except || !x.diagram || !Array.isArray(x.diagram.roomList) || (except && pointKind(x) !== pointKind(except))) continue; // v0.43.5: only circuits of the same kind (lights / sockets)
    for (const r of x.diagram.roomList) if (r && isRoomName(r.name) && !m[String(r.name).trim()]) m[String(r.name).trim()] = String(x.num || '?'); }
  return m;
}
export const isRoomName = (n) => { const t = String(n ?? '').trim(); return t.length > 0 && t.length <= 40 && /[a-z]/i.test(t); };
export function defaultRoom(name, wiring = 'loop-in', mode = 'light') { return mode === 'socket' ? { name, sockets: 2 } : { name, lights: 1, sw1: 1, sw2pairs: 0, swi: 0, wiring }; }
export function roomIsDefault(r, wiring = 'loop-in', mode = 'light') { if (mode === 'socket') return String(r.sockets ?? '') === '2' && !(+r.spurs > 0) && !(+r.singles > 0) && !(+r.dpsw > 0) && !(+r.dpsws > 0); const d = defaultRoom(r.name, wiring); return !(+r.fans > 0) && ['lights', 'sw1', 'sw2pairs', 'swi', 'wiring'].every((k) => String(r[k] ?? '') === String(d[k])); }
function roomsEditor(c, redraw, usedNames = () => [], otherMap = () => ({}), mode = 'light') {
  const box = h('div', { class: 'roomsed', style: 'margin:8px 0 4px' });
  const list = () => (c.diagram && Array.isArray(c.diagram.roomList) ? c.diagram.roomList : []);
  const store = (l) => { const d = { ...(c.diagram || {}) }; if (l.length) d.roomList = l; else delete d.roomList; if (Object.keys(d).length) c.diagram = d; else delete c.diagram; changed(); redraw(); };
  const defW = () => { const l = list(); return (l[0] && l[0].wiring) || 'loop-in'; };
  const stepper = (val, label, onset, min = 0, max = 10) => { const out = h('span', { class: 'stepval', style: 'min-width:1.6em;text-align:center;font-weight:700' }, String(val));
    const st = (dv) => () => { const n = Math.max(min, Math.min(max, (parseInt(out.textContent, 10) || 0) + dv)); out.textContent = String(n); onset(n); };
    return h('div', { class: 'rstep', style: 'display:flex;align-items:center;gap:6px' }, h('button', { class: 'stepbtn', type: 'button', style: 'min-width:44px;min-height:44px', 'aria-label': label + ', one fewer', onclick: st(-1) }, '\u2212'), out, h('button', { class: 'stepbtn', type: 'button', style: 'min-width:44px;min-height:44px', 'aria-label': label + ', one more', onclick: st(1) }, '+')); };
  const chipCss = (on) => 'flex:1 1 auto;min-height:44px;padding:6px 10px;white-space:normal' + (on ? ';background:var(--brand,#2952ff);border-color:var(--brand,#2952ff);color:#fff' : '');
  let typing = false; let showOther = false;
  const draw = () => {
    const l = list(); const names = l.map((r) => r.name); const other = otherMap();
    const job = [...new Set([...usedNames(), ...Object.keys(other)])].filter((n) => n && !TICK_ROOMS.includes(n));
    const extra = names.filter((n) => n && !TICK_ROOMS.includes(n) && !job.includes(n));
    const tick = async (n) => { const i = names.indexOf(n);
      if (i < 0) { store([...list(), defaultRoom(n, defW(), mode)]); draw(); return; }
      const r = l[i]; if (!roomIsDefault(r, defW(), mode)) { const ok = await modal('Remove ' + n + '?', h('p', { class: 'note' }, mode === 'socket' ? 'Its sockets, spurs and DP switches will be cleared.' : 'Its lights, switches and wiring will be cleared.'), [{ label: 'Keep', value: false }, { label: 'Remove', value: true, cls: 'primary' }]); if (!ok) return; }
      store(list().filter((x) => x.name !== n)); draw(); };
    const seg1 = (opts, cur, label, pick) => h('div', { class: 'seg1', role: 'group', 'aria-label': label, style: 'display:flex;align-items:stretch;margin-top:6px;padding:0;border:1px solid var(--line);border-radius:10px;overflow:hidden' },
      opts.map(([v, t, aria], j) => h('button', { type: 'button', class: 'segb' + (v === cur ? ' on' : ''), 'aria-pressed': String(v === cur), 'aria-label': aria || t, style: 'flex:1 1 0;min-width:0;min-height:40px;padding:4px 2px;font-size:14px;font-weight:600;white-space:normal;line-height:1.1;border:0;' + (j ? 'border-left:1px solid var(--line);' : '') + (v === cur ? 'background:var(--brand,#2952ff);color:#fff' : 'background:transparent;color:inherit'), onclick: () => pick(v) }, t)));
    const mini = (val, label, onset, min, max) => { const out = h('span', { class: 'stepval', style: 'min-width:1.4em;text-align:center;font-weight:700' }, String(val));
      const st = (dv) => () => { const n = Math.max(min, Math.min(max, (parseInt(out.textContent, 10) || 0) + dv)); out.textContent = String(n); onset(n); };
      const b = (t, dv, a) => h('button', { class: 'stepbtn', type: 'button', style: 'width:40px;height:40px;min-width:40px;padding:0', 'aria-label': label + ', one ' + a, onclick: st(dv) }, t);
      return h('div', { class: 'rstep', style: 'display:flex;align-items:center;gap:4px' }, b('\u2212', -1, 'fewer'), out, b('+', 1, 'more')); };
    const roomRow = (r) => { const i = list().findIndex((x) => x.name === r.name);
      const upd = (patch, again = false) => { const nl = list().map((x, j) => (j === i ? { ...x, ...patch } : x)); store(nl); if (again) draw(); };
      if (mode === 'socket') { const grp = (t, el) => h('div', { style: 'display:flex;align-items:center;gap:3px;min-width:0' }, h('span', { style: 'font-size:13px' }, t), el); // v0.43.5: sockets (doubles) and optional spurs
        return h('div', { class: 'roomrow sockrow', style: 'border:1px solid var(--line);border-radius:10px;padding:6px 8px;margin:0 0 8px' },
          h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center;justify-content:space-between' },
            h('div', { style: 'display:flex;gap:6px;align-items:center;flex-wrap:nowrap;max-width:100%' }, grp('Doubles', mini(+r.sockets || 0, r.name + ' double sockets', (n) => upd({ sockets: n }), 0, 20)),
            grp('Singles', mini(+r.singles || 0, r.name + ' single sockets', (n) => upd({ singles: n }), 0, 10))),
            grp('Spurs', mini(+r.spurs || 0, r.name + ' spurs', (n) => upd({ spurs: n, ...(n && !r.spurKind ? { spurKind: 'socket' } : {}) }, true), 0, 4)),
            grp('DP + skt', mini(+r.dpsw || 0, r.name + ' DP switch with unswitched socket', (n) => upd({ dpsw: n }), 0, 4)),
            grp('DP + sw skt', mini(+r.dpsws || 0, r.name + ' DP switch with switched socket', (n) => upd({ dpsws: n }), 0, 4)),
            i > 0 ? h('button', { type: 'button', class: 'linkbtn copylast', 'aria-label': 'Copy last room into ' + r.name, style: 'background:none;border:0;padding:8px 2px;min-height:40px;color:var(--brand,#2952ff);font-weight:600;font-size:14px', onclick: () => { const p = list()[i - 1]; const cp = {}; for (const f of ['sockets', 'singles', 'spurs', 'spurKind', 'dpsw', 'dpsws']) cp[f] = p[f]; upd(cp, true); toast('Copied from ' + p.name); } }, 'Copy last room') : null),
          +r.spurs > 0 ? seg1([['socket', 'Single socket'], ['fcu', 'FCU', 'Fused spur (FCU)']], r.spurKind === 'fcu' ? 'fcu' : 'socket', r.name + ' spur type', (v) => upd({ spurKind: v }, true)) : null); }
      const k = swKind(r);
      const swCount = k === 'sw1' ? ['1-way', '1-way switches', +r.sw1 || 1, (n) => upd({ sw1: n }), 1, 4] : k === 'sw2' ? ['Pairs', '2-way pairs', +r.sw2pairs || 1, (n) => upd({ sw2pairs: n }), 1, 3] : k === 'sw2i' ? ['Int', 'Intermediates', +r.swi || 1, (n) => upd({ swi: n }), 1, 4] : null;
      const grp = (t, el) => h('div', { style: 'display:flex;align-items:center;gap:6px' }, h('span', { style: 'font-size:14px' }, t), el);
      return h('div', { class: 'roomrow', style: 'border:1px solid var(--line);border-radius:10px;padding:6px 8px;margin:0 0 8px' },
        h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center;justify-content:space-between' },
          grp('Lights', mini(+r.lights || 0, r.name + ' lights', (n) => upd({ lights: n }), 0, 10)),
          swCount ? grp(swCount[0], mini(swCount[2], r.name + ' ' + swCount[1], swCount[3], swCount[4], swCount[5])) : null,
          grp('Fan', mini(+r.fans || 0, r.name + ' fans', (n) => upd({ fans: n, ...(n && !r.fanCtl ? { fanCtl: 'humidistat' } : {}) }, true), 0, 2)),
          // v0.43.3: one tap to repeat the room above (lights, switches, wiring, fan); the name stays
          i > 0 ? h('button', { type: 'button', class: 'linkbtn copylast', 'aria-label': 'Copy last room into ' + r.name, style: 'background:none;border:0;padding:8px 2px;min-height:40px;color:var(--brand,#2952ff);font-weight:600;font-size:14px', onclick: () => { const p = list()[i - 1]; const cp = {}; for (const f of ['lights', 'sw1', 'sw2pairs', 'swi', 'wiring', 'fans', 'fanCtl', 'split']) if (p[f] !== undefined) cp[f] = Array.isArray(p[f]) ? [...p[f]] : p[f]; else cp[f] = undefined; upd(cp, true); toast('Copied from ' + p.name); } }, 'Copy last room') : null),
        seg1([['sw1', '1-way'], ['sw2', '2-way'], ['sw2i', '2W+int', '2-way + intermediate'], ['none', 'None']], k, r.name + ' switch type', (v) => upd(v === 'sw1' ? { sw1: Math.max(1, +r.sw1 || 1), sw2pairs: 0, swi: 0 } : v === 'sw2' ? { sw1: 0, sw2pairs: Math.max(1, +r.sw2pairs || 1), swi: 0 } : v === 'sw2i' ? { sw1: 0, sw2pairs: Math.max(1, +r.sw2pairs || 1), swi: Math.max(1, +r.swi || 1) } : { sw1: 0, sw2pairs: 0, swi: 0 }, true)),
        seg1([['loop-in', 'Loop-in'], ['junction box', 'JB', 'Junction box'], ['jb-switch', 'JB\u2192sw', 'JB to switch']], ['junction box', 'jb-switch'].includes(r.wiring) ? r.wiring : 'loop-in', r.name + ' wiring', (v) => upd({ wiring: v }, true)),
        +r.fans > 0 ? seg1([['humidistat', 'Humidistat'], ['timer', 'Timer', 'Timer (overrun)'], ['switch', 'Light sw', 'Light switch'], ['isolator', 'Isolator', 'Isolator only']], r.fanCtl || 'humidistat', r.name + ' fan control', (v) => upd({ fanCtl: v }, true)) : null); };
    const tickRow = (n) => { const on = names.includes(n); const elsewhere = other[n];
      return [h('label', { class: 'roomtick', style: 'display:flex;align-items:center;gap:10px;min-height:48px;padding:4px 2px;border-top:1px solid var(--line)' + (elsewhere && !on ? ';color:#9aa0aa' : '') },
        h('input', { type: 'checkbox', checked: on ? true : null, 'aria-label': n, style: 'width:24px;height:24px;flex:none', onchange: (e) => { e.target.checked = on; tick(n); } }),
        h('span', { style: 'flex:1;white-space:normal;word-break:break-word' + (on ? ';font-weight:700' : '') }, n),
        elsewhere ? h('span', { class: 'note', style: 'margin:0;white-space:normal;text-align:right' }, 'on circuit ' + elsewhere) : null),
      on ? roomRow(l[names.indexOf(n)]) : null]; };
    const all0 = [...new Set([...names, ...job, ...extra, ...TICK_ROOMS])].filter(isRoomName);
    const here = names.filter(isRoomName); const free = all0.filter((n) => !names.includes(n) && !other[n]); const busy = all0.filter((n) => !names.includes(n) && other[n]);
    const note = roomPointsNote(c);
    fill(box, [h('b', { style: 'display:block;margin:6px 0 2px' }, 'Rooms'),
      h('p', { class: 'note', style: 'margin:0 0 6px' }, 'Tick each room. The feed runs room to room in the order ticked.'),
      ...(here.length ? [h('div', { class: 'note onthis', style: 'margin:6px 0 2px;font-weight:700;color:inherit' }, 'On this circuit (feed order)'), ...here.flatMap(tickRow)] : [h('p', { class: 'note', style: 'margin:6px 0' }, 'No rooms ticked yet.')]),
      h('div', { class: 'note', style: 'margin:10px 0 2px;font-weight:700' }, 'Add a room'),
      ...free.flatMap(tickRow),
      busy.length ? h('button', { class: 'btn ghost showother', type: 'button', 'aria-expanded': String(showOther), style: 'width:100%;min-height:44px;margin-top:6px;white-space:normal', onclick: () => { showOther = !showOther; draw(); } }, (showOther ? 'Hide' : 'Show') + ` rooms on other circuits (${busy.length})`) : null,
      ...(showOther ? busy.flatMap(tickRow) : []),
      typing ? h('label', { class: 'f', style: 'margin-top:6px' }, h('span', {}, 'Room name'), h('input', { class: 'roomother', placeholder: 'Type the room name', 'aria-label': 'Room name', onchange: (e) => { const n = e.target.value.trim(); typing = false; if (n && !list().some((x) => x.name === n)) store([...list(), defaultRoom(n, defW(), mode)]); draw(); } }))
        : h('button', { class: 'btn ghost', type: 'button', id: 'roomother-' + (c.num || ''), style: 'width:100%;min-height:48px;margin-top:6px', onclick: () => { typing = true; draw(); const t = box.querySelector('.roomother'); if (t) t.focus(); } }, 'Other\u2026'),
      h('p', { class: 'note roomsnote', style: 'margin:6px 0;color:#9aa0aa' + (note ? '' : ';display:none') }, note)]);
  };
  draw();
  return box;
}

// Minor works: "Spur added\" — draws the new spur(s) off the ring, marked New.
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
