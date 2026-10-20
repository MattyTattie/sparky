// =====================================================================
// schedule.js — boards, the schedule of test results and circuits.
// Portrait: a card per circuit, tap to fill it in.
// Landscape: the full schedule as a table, like the paper form.
// =====================================================================
import * as db from './db.js';
import { h, fill, toast, modal, confirmBox, pickFile, shrinkImage, icon, withIcon } from './ui.js';
import { orderRows, mainSide, mainRow, settleSpdMcb } from './cuscan.js';
import { route, page, go, render } from './app.js';
import { openCert, changed, flush } from './state.js';
import { field, stateLine } from './certui.js';
import { sectionsFor } from './certmodel.js';
const boardsLine = (cert) => { const sec = sectionsFor(cert.type).find((x) => x.special === 'boards'); if (!sec) return null; const [c, t] = stateLine(cert, sec); return h('div', { class: 'notice ' + c + ' secstate' }, t); };
import { blankBoard } from './certmodel.js';
import * as presets from './presets.js';
import { FIELDS, FIELD, TEMPLATES, blankCircuit, applyTemplate, copyCircuit, copyBoard, makeSpare, autoNA, descChanged, laterSequential, deleteCircuitAt } from './templates.js';
import { checkCircuit, limitZs, isSpare } from './checks.js';
import { DEVICES, deviceById, deviceFromBs, ratingsFor, CHECK_NOTE } from './limits.js';
import { voiceSupported, listen } from './voice.js';
import { CABLE_PICKS, WIRING_TYPES, REF_METHODS } from './cables.js';
import { lengthFromR1R2 } from './calc.js';
import { cableCheck, isRingLike, applyCable, ringCheck, circuitAdiabatic } from './checks.js';

const LAND = window.matchMedia('(orientation: landscape) and (min-width: 600px)');
LAND.addEventListener('change', () => { if (/\/b\/\d+$/.test(location.hash)) render(); });
const ctxFor = (cert, b) => ({ earthing: cert.supply.earthing, zdb: b.zdb });
const TESTS = FIELDS.filter((f) => f.test);
const isTick = (k) => FIELD[k] && FIELD[k].tick;

// ---------- Boards list ----------
route(/^\/cert\/([^/]+)\/boards$/, async (id) => {
  const cert = await openCert(id); if (!cert) return go('#/');
  if (cert.boards.length === 1) { history.replaceState(null, '', `#/cert/${id}/b/0`); return render(); }
  page('Boards', [
    boardsLine(cert),
    h('div', { class: 'list' }, cert.boards.map((b, i) => h('a', { class: 'row', href: `#/cert/${id}/b/${i}` }, h('div', { class: 'main' }, h('div', { class: 't' }, b.ref || 'Board ' + (i + 1)), h('div', { class: 's' }, `${b.circuits.length} circuits${b.location ? ' · ' + b.location : ''}`)), h('span', { class: 'go' }, '›')))),
    h('div', { class: 'btns full' }, h('button', { class: 'btn primary', onclick: () => addBoard(cert) }, '+ Add board')),
  ], { back: '#/cert/' + id, sub: cert.number });
});
// Copy a whole board (e.g. a block of identical flats): new ids, readings cleared unless you tick.
export async function copyBoardDialog(cert, b) {
  const ref = h('input', { value: nextRef(cert) });
  const keep = h('input', { type: 'checkbox' }); const keepB = h('input', { type: 'checkbox' });
  const ok = await modal('Copy this board', h('div', {},
    h('p', { class: 'note' }, `Makes a new board with the same ${b.circuits.length} circuit(s): devices, cables and descriptions. Test readings are left blank unless you tick below.`),
    h('label', { class: 'f' }, h('span', {}, 'New board reference'), ref),
    h('label', { class: 'check' }, keep, 'Keep the circuit test results too'),
    h('label', { class: 'check' }, keepB, 'Keep the board\u2019s Zdb, Ipf and confirmations')),
  [{ label: 'Cancel', value: false }, { label: 'Copy board', value: true, cls: 'primary' }]);
  if (!ok) return;
  cert.boards.push(copyBoard(b, { ref: ref.value.trim() || nextRef(cert), keepResults: keep.checked, keepBoardTests: keepB.checked }));
  changed(); toast(`Copied to ${cert.boards[cert.boards.length - 1].ref}`); go(`#/cert/${cert.id}/b/${cert.boards.length - 1}`);
}
const nextRef = (cert) => { let n = cert.boards.length + 1; while (cert.boards.some((x) => x.ref === 'DB' + n)) n++; return 'DB' + n; };
// Copy one circuit: to this board or another one, readings optional.
async function copyCircuitDialog(cert, b, bi, ci, base) {
  const c = b.circuits[ci];
  const keep = h('input', { type: 'checkbox' });
  const to = cert.boards.length > 1 ? h('select', {}, cert.boards.map((x, i) => h('option', { value: i, selected: i === bi ? true : null }, (x.ref || 'Board ' + (i + 1)) + (i === bi ? ' (this board)' : '')))) : null;
  const ok = await modal(`Copy circuit ${c.num}`, h('div', {},
    h('p', { class: 'note' }, 'The copy keeps the device, cable and description. It goes straight after this one (or at the end of the other board).'),
    to ? h('label', { class: 'f' }, h('span', {}, 'Copy to'), to) : null,
    h('label', { class: 'check' }, keep, 'Keep the test results too')),
  [{ label: 'Cancel', value: false }, { label: 'Copy circuit', value: true, cls: 'primary' }]);
  if (!ok) return;
  const tb = to ? +to.value : bi; const tgt = cert.boards[tb];
  if (tb === bi) { b.circuits.splice(ci + 1, 0, copyCircuit(c, b.circuits.length + 1, { keepResults: keep.checked })); renumberIfSequential(b); changed(); toast(keep.checked ? 'Copied with readings' : 'Copied (readings left blank)'); go(`${base}/c/${ci + 1}`); }
  else { tgt.circuits.push(copyCircuit(c, tgt.circuits.length + 1, { keepResults: keep.checked })); changed(); toast(`Copied to ${tgt.ref}`); go(`#/cert/${cert.id}/b/${tb}/c/${tgt.circuits.length - 1}`); }
}
function addBoard(cert) { cert.boards.push(blankBoard(cert.boards.length + 1)); changed(); go(`#/cert/${cert.id}/b/${cert.boards.length - 1}`); }

// ---------- One board ----------
route(/^\/cert\/([^/]+)\/b\/(\d+)$/, async (id, bi) => {
  const cert = await openCert(id); if (!cert) return go('#/');
  const b = cert.boards[+bi]; if (!b) return go('#/cert/' + id);
  const back = cert.boards.length > 1 ? `#/cert/${id}/boards` : '#/cert/' + id;
  const tools = boardTools(cert, b, +bi);
  if (LAND.matches) return page(`${b.ref || 'Board'} · schedule of test results`, [tools, scheduleTable(cert, b, +bi)], { back, wide: true, sub: cert.number });
  page(b.ref || 'Board', [
    boardsLine(cert),
    boardDetails(cert, b),
    h('div', { class: 'note', style: 'margin:4px 0 8px' }, 'Tip: turn the phone sideways to see the whole schedule as a table.'),
    tools,
    circuitCards(cert, b, +bi),
    h('div', { class: 'btns full' }, h('button', { class: 'btn', onclick: () => addBoard(cert) }, '+ Add another board'), h('button', { class: 'btn', onclick: () => copyBoardDialog(cert, b) }, 'Copy this board'), cert.boards.length > 1 ? h('button', { class: 'btn warn', onclick: async () => { if (await confirmBox('Delete this board?', `${b.ref} and its ${b.circuits.length} circuits`, 'Delete', 'warn')) { cert.boards.splice(+bi, 1); changed(); go(`#/cert/${id}/boards`); } } }, 'Delete board') : null),
    h('div', { class: 'notice amber' }, CHECK_NOTE),
  ], { back, sub: cert.number });
});

function boardDetails(cert, b) {
  const F = (k, label, type = 'text') => field(b, { k, label, type: type });
  return h('details', { class: 'card', open: !b.zdb ? true : null },
    h('summary', { style: 'font-weight:700' }, 'Board details', b.zdb ? h('span', { class: 'note' }, `  Zdb ${b.zdb} Ω · Ipf ${b.ipf || '–'} kA`) : null),
    h('div', { style: 'margin-top:10px' },
      h('div', { class: 'grid2' }, F('ref', 'DB reference'), F('location', 'Location')),
      F('suppliedFrom', 'Supplied from'),
      h('div', { class: 'grid3' }, F('ocpdBs', 'Supplying device BS (EN)'), F('ocpdType', 'Type'), F('ocpdRating', 'Rating (A)', 'num')),
      h('div', { class: 'grid2' }, F('zdb', 'Zdb (Ω)', 'num'), F('ipf', 'Ipf (kA)', 'num')),
      F('spdDevice', 'SPD protective device (e.g. B32 MCB)'),
      h('div', { class: 'note' }, 'SPD type'), h('div', { class: 'grid2' }, F('spdT1', 'T1', 'check'), F('spdT2', 'T2', 'check'), F('spdT3', 'T3', 'check'), F('spdNA', 'N/A', 'check')),
      h('div', { class: 'grid2' }, F('polOk', 'Correct polarity confirmed', 'check'), F('phaseSeq', 'Phase sequence confirmed', 'check'), F('spdOk', 'SPD operational status confirmed', 'check'), F('spdStatusNA', 'SPD status N/A', 'check')),
      h('div', { class: 'note' }, 'Main RCD of the board (if any)'), h('div', { class: 'grid2' }, F('rcdBs', 'RCD BS (EN)'), F('rcdType', 'RCD type'), F('rcdIdn', 'IΔn (mA)', 'num'), F('rcdRating', 'Rating (A)', 'num'))));
}

function boardTools(cert, b, bi) {
  const bulk = (k, v, label) => h('button', { class: 'btn small', onclick: () => { let n = 0; for (const c of b.circuits) if (!isSpare(c) && !c[k]) { c[k] = v; n++; } changed(); toast(`${label}: filled ${n}`); render(); } }, label);
  return h('div', {},
    b.circuits.length ? h('a', { class: 'btn primary bigtest', href: `#/cert/${cert.id}/b/${bi}/t/r1r2` }, h('span', { class: 'bigtop' }, withIcon('gauge', 'Test across circuits')), h('span', { class: 'bigsub' }, 'One test at a time, every circuit in a list')) : null,
    h('div', { class: 'btns' },
      h('button', { class: 'btn primary small', onclick: () => addCircuit(cert, b, bi) }, '+ Circuit'),
      h('a', { class: 'btn small', href: `#/cert/${cert.id}/b/${bi}/scan` }, 'Scan board'),
      bulk('irLL', '>999', 'IR L-L >999'), bulk('irLE', '>999', 'IR L-E >999'), bulk('pol', '✓', 'Polarity ✓'), bulk('rcdBtn', '✓', 'RCD button ✓'), bulk('afddBtn', 'N/A', 'AFDD N/A'), bulk('irV', '500', 'Test V 500')));
}

async function addCircuit(cert, b, bi, open = true) {
  const n = b.circuits.length + 1;
  const r = await modal('Add a circuit', h('div', {}, h('p', { class: 'note' }, 'Pick a template to fill the circuit details (you can change anything), or start blank.'),
    h('div', { class: 'list' }, TEMPLATES.map((t, i) => h('button', { class: 'row', onclick: () => { document.querySelector('.modal-bg').remove(); done(applyTemplate(blankCircuit(n), t)); } }, h('div', { class: 'main' }, h('div', { class: 't' }, t.name), h('div', { class: 's' }, `${t.type || ''}${t.rating} A ${deviceById(t.device).label.split(' ')[0]} · ${t.live}/${t.cpc || '–'} mm²`)))))),
  [{ label: 'Blank', value: 'blank' }, { label: 'Spare way', value: 'spare' }]);
  if (r === 'blank') done(blankCircuit(n)); else if (r === 'spare') { const c = makeSpare(blankCircuit(n)); descChanged(c, false); done(c); }
  function done(c) { b.circuits.push(c); changed(); if (open && !LAND.matches && !c.spare) go(`#/cert/${cert.id}/b/${bi}/c/${b.circuits.length - 1}`); else render(); }
}

function summary(c, res) {
  const r = (k, label) => h('div', { class: (res.flags[k] || {}).level || '' }, label, h('b', {}, c[k] || '–'));
  return h('div', { class: 'rd' }, r('r1r2', 'R1+R2'), r('irLE', 'IR L-E'), r('zs', 'Zs'), r('rcdMs', 'RCD ms'));
}
// v0.11: select mode on a board — tick circuits, then apply a preset or set boxes on all of them.
const SEL = { board: null, ids: new Set() };
async function applyDialog(cert, b) {
  const picked = b.circuits.filter((c) => SEL.ids.has(c.id)); if (!picked.length) return toast('Tick some circuits first');
  const list = presets.shown(await presets.load());
  let choice = null; const vals = {};
  const chips = h('div', { class: 'chips presets' }, list.map((p) => h('button', { class: 'chip', type: 'button', onclick: (e) => { choice = p; chips.querySelectorAll('.chip').forEach((x) => x.classList.remove('on')); e.currentTarget.classList.add('on'); } }, p.name)));
  const body = h('div', { class: 'applydlg' },
    h('p', { class: 'note' }, `${picked.length} circuit${picked.length > 1 ? 's' : ''} ticked: ${picked.map((c) => c.num).join(', ')}.`),
    h('div', { class: 'phd' }, 'Use a device preset'), list.length ? chips : h('p', { class: 'note' }, 'No presets yet.'),
    h('div', { class: 'phd' }, 'Or set these boxes (blank = leave as it is)'),
    h('div', { class: 'grid2' }, presets.BULK_FIELDS.map(([k, label]) => h('label', { class: 'f' }, h('span', {}, label), h('input', { 'data-k': k, inputmode: ['rating', 'bka', 'rcdIdn', 'rcdRating', 'live', 'cpc'].includes(k) ? 'decimal' : null, oninput: (e) => { vals[k] = e.target.value.trim(); } })))));
  const go1 = await modal('Apply to ticked circuits', body, [{ label: 'Cancel', value: false }, { label: 'Apply', value: true, cls: 'primary' }]);
  if (!go1) return;
  const fields = {};
  if (choice) Object.assign(fields, choice.fields);
  for (const [k, v] of Object.entries(vals)) if (v) fields[k] = v;
  if (!Object.keys(fields).length) return toast('Nothing chosen, nothing changed');
  const clash = picked.map((c) => [c, presets.wouldOverwrite(c, fields)]).filter(([, ks]) => ks.length);
  let mode = 'all';
  if (clash.length) {
    const names = Object.fromEntries(presets.BULK_FIELDS.concat([['device', 'Device'], ['rcdS', 'S-type']]));
    mode = await modal('Overwrite what\u2019s there?', h('div', {}, h('p', {}, `${clash.length} of the ticked circuits already have something different in these boxes:`),
      h('ul', { class: 'clashes' }, clash.slice(0, 8).map(([c, ks]) => h('li', {}, h('b', {}, `${c.num} ${c.desc || ''}: `), ks.map((k) => `${names[k] || k} ${c[k] === true ? 'on' : c[k]} \u2192 ${fields[k] === true ? 'on' : fields[k] === false || fields[k] === '' ? 'blank' : fields[k]}`).join(', '))), clash.length > 8 ? h('li', {}, `…and ${clash.length - 8} more`) : null)),
      [{ label: 'Cancel', value: null }, { label: 'Only fill empty boxes', value: 'empty' }, { label: 'Overwrite', value: 'all', cls: 'warn' }]);
    if (!mode) return;
  }
  const n = presets.bulkApply(picked, fields, mode);
  if (choice) await presets.used(choice.id);
  changed(); SEL.ids.clear(); SEL.board = null;
  toast(`Updated ${n} box${n === 1 ? '' : 'es'} on ${picked.length} circuit${picked.length > 1 ? 's' : ''}`, 3500); render();
}
function selectBar(cert, b) {
  const n = b.circuits.filter((c) => SEL.ids.has(c.id)).length;
  return h('div', { class: 'selbar' },
    h('span', { class: 'seln' }, `${n} ticked`),
    h('button', { class: 'btn small', onclick: () => { b.circuits.forEach((c) => { if (!presets.skipByDefault(c)) SEL.ids.add(c.id); }); render(); } }, 'Select all'),
    n ? h('button', { class: 'btn small', onclick: () => { SEL.ids.clear(); render(); } }, 'Clear') : null,
    h('button', { class: 'btn small primary', disabled: n ? null : true, onclick: () => applyDialog(cert, b) }, 'Apply…'),
    h('button', { class: 'btn small', onclick: () => { SEL.board = null; SEL.ids.clear(); render(); } }, 'Done'));
}
function circuitCards(cert, b, bi) {
  if (!b.circuits.length) return h('div', { class: 'empty' }, 'No circuits yet. Tap “+ Circuit”, or scan the board.');
  if (!b.id) b.id = 'b' + Math.random().toString(36).slice(2, 9);
  b.circuits.forEach((c) => { if (!c.id) c.id = 'c' + Math.random().toString(36).slice(2, 9); });
  const selecting = SEL.board === b.id;
  return h('div', {}, selecting ? selectBar(cert, b) : h('div', { class: 'btns' }, h('button', { class: 'btn small', onclick: () => { SEL.board = b.id; SEL.ids.clear(); render(); } }, 'Select circuits to change together')), b.circuits.map((c, ci) => {
    const res = checkCircuit(c, ctxFor(cert, b));
    const cls = isSpare(c) ? 'spare' : res.worst || (c.zs ? 'ok' : '');
    const dev = isSpare(c) ? (c.noDevice ? 'Spare way · no device fitted' : 'Spare way' + (c.rating && !/n\/?a/i.test(c.rating) ? ` · ${c.type || ''}${c.rating} A` : '')) : `${c.type}${c.rating}${c.rating ? ' A' : ''} ${(deviceById(c.device) || {}).label ? deviceById(c.device).label.split(' ')[0] : c.bs} · ${c.live || '–'}/${c.cpc || '–'} mm²${res.maxZs != null ? ` · max Zs ${res.maxZs}` : ''}`;
    const tick = selecting ? h('input', { type: 'checkbox', class: 'seltick', checked: SEL.ids.has(c.id) ? true : null, 'aria-label': 'Tick circuit ' + c.num, onclick: (e) => e.stopPropagation(), onchange: (e) => { if (e.target.checked) SEL.ids.add(c.id); else SEL.ids.delete(c.id); render(); } }) : null;
    return h(selecting ? 'label' : 'a', { class: 'ccard ' + cls + (selecting ? ' selecting' + (SEL.ids.has(c.id) ? ' ticked' : '') : ''), href: selecting ? null : `#/cert/${cert.id}/b/${bi}/c/${ci}` },
      h('div', { class: 'hd' }, tick, h('span', { class: 'no' }, c.num), h('span', { class: 'ds' }, c.desc || 'No description'), res.worst ? h('span', { class: 'pill ' + res.worst }, res.worst === 'red' ? 'Check' : 'Look') : null),
      h('div', { class: 'dv' }, dev), isSpare(c) ? null : summary(c, res),
      res.worst ? h('div', { class: 'note', style: 'margin-top:4px;color:' + (res.worst === 'red' ? '#c62828' : '#a86a00') }, Object.values(res.flags).find((f) => f.level === res.worst).msg) : null);
  }));
}

// ---------- One circuit (portrait) ----------
route(/^\/cert\/([^/]+)\/b\/(\d+)\/c\/(\d+)$/, async (id, bi, ci) => {
  const cert = await openCert(id); if (!cert) return go('#/');
  const b = cert.boards[+bi]; const c = b && b.circuits[+ci]; if (!c) return go(`#/cert/${id}/b/${bi}`);
  const base = `#/cert/${id}/b/${bi}`;
  circuitEditor({ cert, c, ctx: () => ctxFor(cert, b), back: base, title: `Circuit ${c.num}`,
    prev: +ci > 0 ? `${base}/c/${+ci - 1}` : null, next: +ci < b.circuits.length - 1 ? `${base}/c/${+ci + 1}` : null,
    extra: [
      h('button', { class: 'btn small', onclick: () => copyCircuitDialog(cert, b, +bi, +ci, base) }, 'Copy circuit'),
      h('button', { class: 'btn small', onclick: async () => { const t = await pickTemplate(); if (t) { Object.assign(c, applyTemplate(c, t)); changed(); render(); } } }, 'Template'),
      h('button', { class: 'btn small', onclick: () => { { const was = isSpare(c); Object.assign(c, makeSpare(c)); descChanged(c, was); } changed(); render(); } }, 'SPARE / N/A'),
      h('button', { class: 'btn small warn', onclick: async () => { if (await askDelete(b, +ci)) go(base); } }, withIcon('trash', 'Delete')),
    ] });
});
route(/^\/cert\/([^/]+)\/mwc$/, async (id) => {
  const cert = await openCert(id); if (!cert) return go('#/');
  circuitEditor({ cert, c: cert.mw.circuit, ctx: () => ({ earthing: cert.mw.earthing, zdb: cert.mw.zdb }), back: `#/cert/${id}/s/mwC`, title: 'Minor works circuit', mw: true,
    extra: [h('button', { class: 'btn small', onclick: async () => { const t = await pickTemplate(); if (t) { Object.assign(cert.mw.circuit, applyTemplate(cert.mw.circuit, t)); changed(); render(); } } }, 'Template')] });
});
// v0.12: confirm then delete one circuit (later sequential numbers move down one).
async function askDelete(b, ci) {
  const c = b.circuits[ci]; const k = laterSequential(b, ci);
  const what = [c.desc, c.zs ? 'its test results' : ''].filter(Boolean).join(' and ');
  const msg = (what ? `This removes ${what}. ` : '') + (k ? `Circuit${k > 1 ? 's' : ''} ${+c.num + 1}${k > 1 ? '\u2013' + (+c.num + k) : ''} will be renumbered down one.` : '');
  if (!(await confirmBox(`Delete circuit ${c.num || ci + 1}?`, msg, 'Delete', 'warn'))) return false;
  deleteCircuitAt(b, ci); changed(); toast(`Circuit ${c.num || ci + 1} deleted`); return true;
}
function renumberIfSequential(b) { if (b.circuits.every((c, i) => !c.num || /^\d+$/.test(c.num))) b.circuits.forEach((c, i) => (c.num = String(i + 1))); }
async function pickTemplate() {
  let chosen = null;
  await modal('Circuit template', h('div', { class: 'list' }, TEMPLATES.map((t) => h('button', { class: 'row', onclick: () => { chosen = t; document.querySelector('.modal-bg').remove(); } }, h('div', { class: 'main' }, h('div', { class: 't' }, t.name))))), [{ label: 'Cancel', value: null }]);
  return chosen;
}

// v0.11: leaving a circuit page remembers its device combination as a preset (if new).
let leaving = null;
addEventListener('hashchange', async () => {
  const c = leaving; leaving = null; if (!c) return;
  const l = await presets.load(); const r = presets.remember(l, c);
  if (r.added) { await presets.save(l); toast(`Saved \u201c${r.preset.name}\u201d as a device preset`, 3500); }
});
function presetPicker(c, after) {
  const box = h('div', { class: 'presetbox' });
  const draw = async () => {
    const list = presets.shown(await presets.load()); const cur = presets.presetFrom(c); const k = cur && presets.keyOf(cur);
    const match = k && list.find((p) => presets.keyOf(p.fields) === k);
    fill(box, h('div', { class: 'phd' }, h('span', {}, 'Device presets'), list.length ? h('a', { href: '#/settings/presets', class: 'note' }, 'Manage') : null),
      list.length ? h('div', { class: 'chips presets' }, list.slice(0, 12).map((p) => h('button', { class: 'chip' + (match && match.id === p.id ? ' on' : ''), type: 'button', title: 'Fill the device boxes', onclick: async () => {
        const ch = presets.applyPreset(c, p); await presets.used(p.id); changed(); toast(ch.length ? `Filled the device from \u201c${p.name}\u201d (cable and readings left alone)` : 'Already set like that'); after(); } }, p.name)))
        : h('p', { class: 'note' }, 'Fill in a device below and it\u2019s remembered here for next time.'),
      cur && !match ? h('button', { class: 'btn small savepreset', type: 'button', onclick: async () => { const l = await presets.load(); const r = presets.remember(l, c); if (r.deleted) { const p = l.find((x) => presets.keyOf(x.fields) === k); Object.assign(p, { deleted: false, updatedAt: new Date().toISOString(), uses: 1 }); } await presets.save(l); toast('Saved as a device preset'); draw(); } }, '+ Save as preset: ' + presets.nameFor(cur)) : null);
  };
  draw(); box.redraw = draw; return box;
}
function circuitEditor({ cert, c, ctx, back, title, prev, next, extra = [], mw = false }) {
  leaving = c;
  const pBox = presetPicker(c, () => render());
  const flagEls = {}; const inputs = {};
  const noDevBox = h('div');
  const limBox = h('div', { class: 'limit' });
  let updHint = () => {};
  const refresh = () => {
    updHint();
    const res = checkCircuit(c, ctx());
    for (const [k, el] of Object.entries(flagEls)) {
      const f = res.flags[k]; el.wrap.className = 'fld ' + (f ? f.level : ''); el.msg.textContent = f ? f.msg : '';
    }
    const lim = limitZs(c, ctx());
    document.querySelectorAll('select[data-k]').forEach((sel) => { const o = sel.querySelector('.pick0'); if (o) o.textContent = autoNA(c, sel.dataset.k) ? 'N/A' : '— pick —'; sel.classList.toggle('autona', autoNA(c, sel.dataset.k)); });
    for (const [k, el] of Object.entries(inputs)) { const na = autoNA(c, k); el.placeholder = na ? 'N/A' : ''; el.classList.toggle('autona', na); }
    fill(noDevBox, isSpare(c) ? h('label', { class: 'check nodev' }, h('input', { type: 'checkbox', checked: !!c.noDevice, onchange: (e) => { c.noDevice = e.target.checked; changed(); refresh(); } }), 'No device fitted (device boxes show N/A too)') : null);
    if (pBox.redraw) pBox.redraw();
    fill(limBox, isSpare(c) ? 'Spare way: no limits apply.' : lim.value != null ? h('span', {}, 'Max Zs ', h('b', {}, lim.value.toFixed(2) + ' Ω'), res.cold != null ? ` · 80% (cold reading) ${res.cold.toFixed(2)} Ω` : '', h('br'), h('span', { class: 'note' }, lim.source)) : 'Pick the device and rating to see the maximum Zs.');
  };
  const inp = (k, opts = {}) => {
    const fd = FIELD[k] || { label: opts.label, k };
    const input = h('input', { value: c[k] ?? '', inputmode: fd.num ? 'decimal' : null, oninput: (e) => { const was = isSpare(c); c[k] = e.target.value; if (k === 'desc' && descChanged(c, was) && inputs.irV) inputs.irV.value = c.irV ?? ''; changed(); refresh(); } });
    inputs[k] = input;
    const quick = [];
    if (k === 'irLL' || k === 'irLE') quick.push('>999');
    if (isTick(k)) quick.push('✓', '✗');
    if (fd.test || ['rcdBs', 'rcdType', 'rcdIdn', 'rcdRating', 'bka', 'points'].includes(k)) quick.push('N/A');
    const msg = h('div', { class: 'msg' });
    const wrap = h('div', { class: 'fld' }, h('div', { class: 'lab' }, h('span', {}, opts.label || fd.label), fd.col ? h('span', { class: 'col' }, 'col ' + fd.col) : null),
      h('div', { class: 'inrow' }, input, quick.map((q) => h('button', { class: 'q', onclick: () => { c[k] = c[k] === q ? '' : q; input.value = c[k]; changed(); refresh(); } }, q))), msg);
    flagEls[k] = { wrap, msg }; return wrap;
  };
  // Device chooser: fills BS (EN), offers types and ratings from the tables.
  const devBox = h('div');
  const drawDev = () => {
    const d = deviceById(c.device) || deviceFromBs(c.bs);
    if (d && c.device !== d.id) c.device = d.id;
    const ratings = d ? ratingsFor(d.id, c.type) : [];
    fill(devBox, 
      h('label', { class: 'f' }, h('span', {}, 'Protective device'), h('select', { onchange: (e) => { const nd = deviceById(e.target.value); c.device = nd.id; c.bs = nd.bs; c.type = nd.types[0] && nd.types.length === 1 ? nd.types[0] : (nd.types.includes(c.type) ? c.type : nd.types[0] || ''); if (nd.rcd) { c.rcdBs = '61009'; c.rcdIdn = c.rcdIdn && c.rcdIdn !== 'N/A' ? c.rcdIdn : '30'; c.rcdType = c.rcdType && c.rcdType !== 'N/A' ? c.rcdType : 'A'; c.rcdRating = c.rating; } changed(); drawDev(); refresh(); } },
        h('option', { value: '' }, '— pick —'), DEVICES.map((x) => h('option', { value: x.id, selected: d && d.id === x.id ? true : null }, x.label)))),
      d && d.types.length > 1 ? h('div', { class: 'f', style: 'margin-bottom:10px' }, h('span', { class: 'note' }, 'Type (col 9)'), h('div', { class: 'chips' }, d.types.map((t) => h('button', { class: 'chip' + (c.type === t ? ' on' : ''), onclick: () => { c.type = t; changed(); drawDev(); refresh(); } }, t)))) : null,
      ratings.length ? h('div', { class: 'f', style: 'margin-bottom:10px' }, h('span', { class: 'note' }, 'Rating, A (col 10)'), h('div', { class: 'chips' }, ratings.map((r) => h('button', { class: 'chip' + (String(c.rating) === String(r) ? ' on' : ''), onclick: () => { c.rating = String(r); if (d.rcd) c.rcdRating = String(r); changed(); drawDev(); refresh(); } }, r)))) : inp('rating'),
      h('div', { class: 'grid2' }, inp('bs'), inp('bka')),
      h('div', { class: 'f', style: 'margin-bottom:10px' }, h('span', { class: 'note' }, 'Disconnection time'), h('div', { class: 'chips' }, [0.4, 5].map((t) => h('button', { class: 'chip' + (Number(c.time || 0.4) === t ? ' on' : ''), onclick: () => { c.time = t; changed(); drawDev(); refresh(); } }, t + ' s' + (t === 5 ? ' (distribution / >63 A)' : ' (final ≤63 A)'))))),
      limBox,
      h('label', { class: 'f' }, h('span', {}, 'Your own max Zs (e.g. maker\u2019s figure) — leave blank to use the table'), h('input', { inputmode: 'decimal', value: c.maxZsOverride || '', oninput: (e) => { c.maxZsOverride = e.target.value; changed(); refresh(); } })));
  };
  drawDev();
  // Cable: type + size fill live and CPC; wiring type (col 3) and reference method (col 4) as drop-downs.
  const cableBox = h('div');
  const drawCable = () => {
    const pick = CABLE_PICKS[c.cable];
    const size = pick && c.cableSize != null ? String(c.cableSize) : '';
    const codeSel = (k, list, label, col) => {
      const known = list.some(([code]) => code === String(c[k] || ''));
      return h('div', { class: 'fld' }, h('div', { class: 'lab' }, h('span', {}, label), h('span', { class: 'col' }, 'col ' + col)),
        h('select', { 'aria-label': label, 'data-k': k, onchange: (e) => { c[k] = e.target.value === '__other' ? (known ? '' : c[k]) : e.target.value; changed(); drawCable(); refresh(); } },
          h('option', { value: '', class: 'pick0' }, autoNA(c, k) ? 'N/A' : '— pick —'), list.map(([code, name]) => h('option', { value: code, selected: String(c[k] || '') === code ? true : null }, `${code} – ${name}`)),
          !known && c[k] ? h('option', { value: c[k], selected: true }, `${c[k]} (as entered)`) : null));
    };
    const hintBox = h('div');
    updHint = () => {
    const hint = [];
    if (pick && pick.warn && pick.warn[size]) hint.push(h('div', { class: 'notice amber' }, pick.warn[size]));
    if (pick && pick.cpc === 'armour') hint.push(h('p', { class: 'note' }, '⚠ CPC is the steel armour: R1+R2 uses maker’s armour resistance (check your cable’s data sheet), and the armour must pass the adiabatic check (543.1.3).'));
    const cab = cableCheck(c);
    if (cab && cab.msg && !cab.level) hint.push(h('p', { class: 'note' }, cab.msg));
    const len = lengthFromR1R2({ r1r2: c.r1r2, live: Number(c.live), cpc: pick && pick.cpc === 'armour' ? 'armour' : Number(c.cpc), cores: pick && pick.cores });
    if (len && !isRingLike(c)) hint.push(h('p', { class: 'note' }, `Your R1+R2 of ${c.r1r2} Ω is about ${len} m of this cable (at 20 °C).`));
    const ad = circuitAdiabatic(c, ctx());
    if (ad && ad.ok) hint.push(h('div', { class: 'resline ' + (ad.pass ? 'ok' : ad.pass === false ? 'bad' : 'na') }, h('b', {}, ad.pass ? '✓' : ad.pass === false ? '!' : '–'),
      h('div', {}, h('div', {}, `Adiabatic (543.1.3): CPC needs ${ad.smin} mm², it\u2019s ${ad.cpc} mm²`), h('div', { class: 'note' }, `Fault ${Math.round(ad.ifault)} A at Zs ${c.zs} Ω. ${ad.how} k ${ad.k} (${ad.kLabel}). S = √(${ad.i2t} A²s) ÷ ${ad.k}.${ad.armourNote || ''}`))));
    else if (ad && !ad.ok && ad.error && /Zs/.test(ad.error) && !/Need/.test(ad.error)) hint.push(h('p', { class: 'note' }, 'Adiabatic: ' + ad.error));
    fill(hintBox, hint);
    drawRing();
    };
    updHint();
    fill(cableBox,
      h('div', { class: 'grid2' },
        h('label', { class: 'f' }, h('span', {}, 'Cable'), h('select', { 'aria-label': 'Cable type', onchange: (e) => { c.cable = e.target.value; const p = CABLE_PICKS[c.cable]; if (p && !(String(c.cableSize) in p.sizes)) c.cableSize = ''; if (p && (!c.wiring || WIRING_TYPES.some(([w]) => w === c.wiring))) c.wiring = p.wiring; applyCable(c); changed(); drawCable(); refresh(); } },
          h('option', { value: '' }, '— type in sizes below —'), Object.entries(CABLE_PICKS).map(([k, p]) => h('option', { value: k, selected: c.cable === k ? true : null }, p.label)))),
        pick ? h('label', { class: 'f' }, h('span', {}, 'Size'), h('select', { 'aria-label': 'Cable size', onchange: (e) => { c.cableSize = e.target.value; applyCable(c); changed(); drawCable(); refresh(); } },
          h('option', { value: '' }, '— size —'), Object.entries(pick.sizes).map(([sz, cp]) => h('option', { value: sz, selected: size === sz ? true : null }, `${sz} mm²` + (cp === 'armour' ? ' + armour' : ` / ${cp} mm² CPC`))))) : h('span')),
      h('div', { class: 'grid2' }, inp('live'), inp('cpc')),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: isRingLike(c), onchange: (e) => { c.ring = e.target.checked; changed(); drawCable(); refresh(); } }), 'Ring final circuit', h('span', { class: 'note' }, ' (shows the ring tests)')),
      codeSel('wiring', WIRING_TYPES, 'Type of wiring', 3), codeSel('ref', REF_METHODS, 'Reference method', 4),
      hintBox);
  };
  // Ring final: r1 / rn / r2 boxes and the end-to-end check, only when ticked.
  const ringInputs = h('div', { class: 'grid3' }, inp('r1'), inp('rn'), inp('r2'));
  const ringBox = h('div');
  function drawRing() {
    const on = isRingLike(c);
    ringInputs.style.display = on ? '' : 'none';
    const hidden = !on && ['r1', 'rn', 'r2'].some((k) => String(c[k] || '').trim());
    if (!on) { fill(ringBox, hidden ? h('p', { class: 'note' }, `Ring readings hidden (r1 ${c.r1 || '–'}, rn ${c.rn || '–'}, r2 ${c.r2 || '–'}). Tick “Ring final circuit” to see them.`)
      : h('div', { class: 'grid3 ringna' }, ['r1', 'rn', 'r2'].map((k) => h('label', { class: 'f' }, h('span', {}, FIELD[k].short), h('input', { class: 'autona', placeholder: 'N/A', disabled: true, 'aria-label': FIELD[k].short + ': N/A, not a ring' })))),
        hidden ? null : h('p', { class: 'note' }, 'Not a ring final circuit, so r1, rn and r2 show and print N/A. Tick “Ring final circuit” to fill them in.')); return; }
    const rc = ringCheck(c, ctx());
    fill(ringBox, h('div', { class: 'ringchk' }, h('div', { class: 'ringhd' }, 'Ring final check'),
      rc.empty ? h('p', { class: 'note' }, 'Enter the end-to-end readings r1, rn and r2 and the app checks the ring.') :
      rc.items.map((it) => h('div', { class: 'resline ' + (it.pass === true ? 'ok' : it.pass === false ? 'bad' : 'na') }, h('b', {}, it.pass === true ? '✓' : it.pass === false ? '!' : '•'), h('div', {}, h('div', {}, it.text), it.sub ? h('div', { class: 'note' }, it.sub) : null))),
      h('p', { class: 'note' }, 'Rules of thumb from IET Guidance Note 3, not regulations.')));
  }
  drawCable();
  let rec = null;
  const mic = voiceSupported() ? h('button', { class: 'btn small', onclick: (e) => {
    const btn = e.currentTarget; if (rec) { rec.stop(); return; }
    btn.textContent = '● Listening…';
    rec = listen({ onResult: (said, vals) => {
      const keys = Object.keys(vals).filter((k) => !k.startsWith('_'));
      for (const k of keys) c[k] = vals[k];
      if (keys.length) { changed(); toast(`Heard “${said}” → ${keys.map((k) => (FIELD[k] ? FIELD[k].short : k) + ' ' + vals[k]).join(', ')}`, 4000); render(); }
      else toast(`Heard “${said}” — didn\u2019t spot a reading. Try “Zs nought point four two”.`, 4000);
      if (vals._next && next) go(next);
    }, onEnd: () => { rec = null; btn.textContent = 'Say readings'; }, onError: (err) => toast(err.message) });
  } }, 'Say readings') : null;
  const sect = (t, ...kids) => h('div', { class: 'card' }, h('h2', {}, t), kids);
  page(title, [
    h('div', { class: 'btns' }, extra, mic),
    mic ? h('p', { class: 'note voicenote' }, 'Voice entry uses Google\u2019s speech service: what you say is sent to Google to turn it into text. Typing never leaves this device.') : null,
    // v0.14: the RCD boxes (cols 13-16) sit with the protective device, before the cable.
    sect('Circuit details', h('div', { class: 'grid2' }, inp('num'), inp('points')), inp('desc'), noDevBox, pBox, devBox,
      h('div', { class: 'rcdgrp' }, h('div', { class: 'phd' }, h('span', {}, 'RCD (if any)')),
        h('div', { class: 'grid2' }, inp('rcdBs'), inp('rcdType'), inp('rcdIdn'), inp('rcdRating')),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!c.rcdS, onchange: (e) => { c.rcdS = e.target.checked; changed(); refresh(); } }), 'Time-delayed (S-type) RCD')),
      h('div', { class: 'phd cablehd' }, h('span', {}, 'Cable and wiring')),
      cableBox),
    sect('Test results',
      ringInputs, h('div', { class: 'grid2' }, inp('r1r2'), inp('R2')), ringBox,
      inp('irV'), inp('irLL'), inp('irLE'), inp('pol'), inp('zs'), inp('rcdMs'), inp('rcdBtn'), inp('afddBtn'), inp('remarks')),
    h('div', { class: 'stick' }, prev ? h('a', { class: 'btn', href: prev }, '← Previous') : null, h('a', { class: 'btn', href: back }, 'All circuits'), next ? h('a', { class: 'btn primary', href: next }, 'Next →') : null),
  ], { back, sub: c.desc || '' });
  refresh();
}

// ---------- Landscape: the whole schedule as a table ----------
function scheduleTable(cert, b, bi) {
  const cols = FIELDS.filter((f) => f.k !== 'maxZs');
  const head = h('tr', {}, h('th', { class: 'sl' }, h('span', { class: 'n' }, '1'), 'No.'), h('th', { class: 'sl2' }, h('span', { class: 'n' }, '2'), 'Description'),
    cols.slice(2).map((f) => [h('th', {}, h('span', { class: 'n' }, f.col), f.short), f.k === 'bka' ? h('th', {}, h('span', { class: 'n' }, '12'), 'Max Zs') : null]), h('th', {}, ''));
  const body = h('tbody');
  b.circuits.forEach((c, ci) => {
    const cells = {}; let maxCell; let td0 = null;
    const upd = () => {
      const res = checkCircuit(c, ctxFor(cert, b));
      for (const [k, td] of Object.entries(cells)) { const f = res.flags[k]; td.className = (k === 'desc' ? 'desc sl2 ' : k === 'num' ? 'sl ' : '') + (f ? f.level : ''); td.title = f ? f.msg : ''; }
      const lim = limitZs(c, ctxFor(cert, b)); maxCell.firstChild.placeholder = isSpare(c) ? (autoNA(c, 'maxZs') ? 'N/A' : '') : lim.value != null ? lim.value.toFixed(2) : '?';
      maxCell.firstChild.classList.toggle('autona', autoNA(c, 'maxZs'));
      for (const [k, td] of Object.entries(cells)) { const el = td.firstChild; const na = autoNA(c, k); el.placeholder = na ? 'N/A' : ''; el.classList.toggle('autona', na); if (k === 'irV' && document.activeElement !== el) el.value = c.irV ?? ''; }
      td0 && td0.classList.toggle('spare', isSpare(c));
    };
    const cell = (f) => {
      const i = h('input', { value: c[f.k] ?? '', inputmode: f.num ? 'decimal' : null, 'aria-label': `Circuit ${c.num} ${f.label}`, oninput: (e) => { const was = isSpare(c); c[f.k] = e.target.value; if (f.k === 'desc') descChanged(c, was); if (f.k === 'bs') { const d = deviceFromBs(c.bs); if (d) c.device = d.id; } changed(); upd(); }, ondblclick: isTick(f.k) ? (e) => { c[f.k] = c[f.k] === '✓' ? '' : '✓'; e.target.value = c[f.k]; changed(); upd(); } : null });
      const td = h('td', { class: f.k === 'desc' ? 'desc sl2' : f.k === 'num' ? 'sl' : '', style: f.k === 'desc' ? 'min-width:150px' : f.k === 'remarks' ? 'min-width:160px' : 'min-width:' + (f.tick ? 40 : 52) + 'px' }, i);
      cells[f.k] = td; return td;
    };
    maxCell = h('td', { class: 'calc', title: 'From the BS 7671 tables. Type your own figure to override.' }, h('input', { value: c.maxZsOverride || '', inputmode: 'decimal', style: 'color:var(--brand);font-weight:600', oninput: (e) => { c.maxZsOverride = e.target.value; changed(); upd(); } }));
    body.append(td0 = h('tr', { class: isSpare(c) ? 'spare' : '' }, cols.map((f) => [cell(f), f.k === 'bka' ? maxCell : null]),
      h('td', { class: 'act' }, h('button', { title: 'Open', onclick: () => go(`#/cert/${cert.id}/b/${bi}/c/${ci}`) }, '✎'), h('button', { title: 'Copy row', onclick: () => { b.circuits.splice(ci + 1, 0, copyCircuit(c, b.circuits.length + 1)); renumberIfSequential(b); changed(); render(); } }, '⧉'), h('button', { title: 'Spare', onclick: () => { { const was = isSpare(c); Object.assign(c, makeSpare(c)); descChanged(c, was); } changed(); render(); } }, '∅'), h('button', { title: 'Delete circuit', class: 'del', onclick: async () => { if (await askDelete(b, ci)) render(); } }, icon('trash', { size: 16 })))));
    upd();
  });
  return h('div', {}, h('div', { class: 'tablewrap' }, h('table', { class: 'sched' }, h('thead', {}, head), body)),
    h('p', { class: 'note' }, `Zdb ${b.zdb || '–'} Ω · Ipf ${b.ipf || '–'} kA · Earthing ${cert.supply.earthing}. Red = over the limit, amber = worth a look (hold a finger on a cell to see why). Double-tap a tick column for ✓. `, CHECK_NOTE));
}

// ---------- Scan the consumer unit (one or more photos) ----------
// 1. Add photos in board order (a two-row board: one photo per row is fine, or
//    one photo with a box drawn round each row). 2. Optionally draw a box round
//    each row of breakers. 3. Read. 4. Check every way next to its own crop of
//    the photo, fix anything flagged, then add. The photos are kept with the job.
route(/^\/cert\/([^/]+)\/b\/(\d+)\/scan$/, async (id, bi) => {
  const cert = await openCert(id); if (!cert) return go('#/');
  const b = cert.boards[+bi];
  const box = h('div');
  const status = h('div', { class: 'note' });
  const parts = []; // { file, url, bmp, rects: [] }
  let rows = null; const numOpts = { order: 'main', dir: 'ltr', manual: null };
  const ocr = () => import('./ocr.js');
  const addPhotos = async (capture) => {
    const fs = await pickFile({ accept: 'image/*', capture, multiple: !capture }); if (!fs || !fs.length) return;
    const { loadPhoto } = await ocr();
    for (const f of fs) parts.push({ file: f, url: URL.createObjectURL(f), bmp: await loadPhoto(f), rects: [] });
    rows = null; drawStart();
  };
  // Thumbnail of a photo with its boxes drawn on.
  const thumb = (p, maxW = 600) => {
    const s = Math.min(1, maxW / p.bmp.width); const c = h('canvas', { width: Math.round(p.bmp.width * s), height: Math.round(p.bmp.height * s), class: 'scanthumb' });
    const g = c.getContext('2d'); g.drawImage(p.bmp, 0, 0, c.width, c.height);
    g.lineWidth = 3; g.font = 'bold 22px sans-serif';
    (p.rects.length ? p.rects : p.autoRects || []).forEach((r, i) => { g.strokeStyle = p.rects.length ? '#ffb300' : '#4fc3f7'; g.strokeRect(r.x * s, r.y * s, r.w * s, r.h * s); g.fillStyle = g.strokeStyle; g.fillText(String(i + 1), r.x * s + 6, r.y * s + 24); });
    return c;
  };
  const drawStart = () => fill(box,
    h('div', { class: 'card' },
      h('p', {}, 'Photograph the consumer unit with the cover on, as straight-on as you can. For a two-row board take one photo per row (or one photo and draw a box round each row). Get close enough that B32 / C16 and the model numbers are sharp.'),
      h('p', { class: 'note' }, 'Read on this device, no internet needed. The photos are saved with this job (and go to Drive with its backup). You check every way before anything is added.'),
      h('div', { class: 'btns full' }, h('button', { class: 'btn primary', onclick: () => addPhotos(true) }, parts.length ? '+ Take another photo' : 'Take photo'), h('button', { class: 'btn', onclick: () => addPhotos(false) }, 'From gallery'))),
    parts.map((p, i) => h('div', { class: 'card scanpart' },
      h('div', { class: 'rowhead' }, h('b', {}, `Photo ${i + 1}`), h('span', { class: 'note' }, p.rects.length ? ` · ${p.rects.length} row box(es)` : ' · whole photo (rows found automatically)')),
      thumb(p),
      h('div', { class: 'btns' },
        h('button', { class: 'btn small primary', onclick: () => cropper(p) }, p.rects.length ? 'Edit row boxes' : 'Draw row boxes'),
        i > 0 ? h('button', { class: 'btn small', onclick: () => { parts.splice(i - 1, 0, parts.splice(i, 1)[0]); drawStart(); } }, '↑ Earlier') : null,
        h('button', { class: 'btn small warn', onclick: () => { parts.splice(i, 1); drawStart(); } }, 'Remove')))),
    parts.length ? h('div', { class: 'stick' }, h('button', { class: 'btn primary', onclick: read }, `Read ${parts.length} photo(s)`)) : null,
    status);

  // Draw boxes round rows of breakers. Drag on the photo; each box = one row, in order.
  const cropper = (p) => {
    const W = Math.min(window.innerWidth - 24, 1200); let zoom = 1;
    const cv = h('canvas', { class: 'cropcv' }); const wrap = h('div', { class: 'cropwrap' }, cv);
    let drag = null;
    const scale = () => (W * zoom) / p.bmp.width;
    const paint = () => {
      const s = scale(); cv.width = Math.round(p.bmp.width * s); cv.height = Math.round(p.bmp.height * s);
      const g = cv.getContext('2d'); g.drawImage(p.bmp, 0, 0, cv.width, cv.height); g.lineWidth = 3; g.font = 'bold 22px sans-serif';
      p.rects.forEach((r, i) => { g.strokeStyle = g.fillStyle = '#ffb300'; g.strokeRect(r.x * s, r.y * s, r.w * s, r.h * s); g.fillText(`Row ${i + 1}`, r.x * s + 6, r.y * s + 24); });
      if (drag) { g.strokeStyle = '#4fc3f7'; g.setLineDash([8, 6]); g.strokeRect(Math.min(drag.x0, drag.x1), Math.min(drag.y0, drag.y1), Math.abs(drag.x1 - drag.x0), Math.abs(drag.y1 - drag.y0)); g.setLineDash([]); }
    };
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', (e) => { if (!drawMode) return; e.preventDefault(); cv.setPointerCapture(e.pointerId); const [x, y] = pos(e); drag = { x0: x, y0: y, x1: x, y1: y }; });
    cv.addEventListener('pointermove', (e) => { if (!drag) return; const [x, y] = pos(e); drag.x1 = x; drag.y1 = y; paint(); });
    cv.addEventListener('pointerup', () => {
      if (!drag) return; const s = scale(); const r = { x: Math.min(drag.x0, drag.x1) / s, y: Math.min(drag.y0, drag.y1) / s, w: Math.abs(drag.x1 - drag.x0) / s, h: Math.abs(drag.y1 - drag.y0) / s }; drag = null;
      if (r.w > 40 && r.h > 20) p.rects.push(r); paint(); info();
    });
    let drawMode = true; const modeBtn = h('button', { class: 'btn small' });
    const setMode = (m) => { drawMode = m; cv.style.touchAction = m ? 'none' : 'auto'; modeBtn.textContent = m ? '✋ Move/scroll' : '✏️ Draw'; };
    modeBtn.onclick = () => setMode(!drawMode); setMode(true);
    const infoEl = h('p', { class: 'note' }); const info = () => (infoEl.textContent = p.rects.length ? `${p.rects.length} row box(es). Rows are read in the order you drew them.` : 'Drag a box round the first row of breakers (just the breakers; the labels underneath are read automatically).');
    fill(box, h('div', { class: 'card' }, infoEl,
      h('div', { class: 'btns' }, modeBtn,
        h('button', { class: 'btn small', onclick: () => { zoom = zoom === 1 ? 2 : zoom === 2 ? 3 : 1; paint(); } }, 'Zoom'),
        h('button', { class: 'btn small', onclick: () => { p.rects.pop(); paint(); info(); } }, 'Undo'),
        h('button', { class: 'btn small', onclick: () => { p.rects = []; paint(); info(); } }, 'Clear'))),
      wrap,
      h('div', { class: 'stick' }, h('button', { class: 'btn primary', onclick: () => { rows = null; drawStart(); } }, 'Done')));
    paint(); info();
  };

  async function read() {
    const { readBoard } = await ocr();
    fill(box, h('div', { class: 'card' }, h('p', {}, 'Reading the board… this can take a minute for a big board.'), status));
    try {
      rows = await readBoard(parts, (f, msg) => (status.textContent = `${msg} ${Math.round(f * 100)}%`));
      status.textContent = ''; settleSpdMcb(rows);
      for (const r of rows) { r.ways.forEach((w) => (w.keep = !w.maybeSpd)); placeCrops(r); }
      review();
    } catch (e) { status.textContent = 'Couldn\u2019t read the photos: ' + e.message; drawStart(); }
  }
  // Each way gets its own slice of the photo (breaker + the label strip below).
  const placeCrops = (r) => {
    const ws = r.ways, R = r.rect; const pitch = r.pitch || R.w / Math.max(1, ws.length);
    ws.forEach((w, i) => {
      if (w.crop) return;
      const left = i ? (ws[i - 1].cx + w.cx) / 2 : w.cx - pitch / 2, right = i < ws.length - 1 ? (ws[i + 1].cx + w.cx) / 2 : w.cx + pitch / 2;
      const lb = r.labelRects && r.labelRects.length ? Math.max(...r.labelRects.map((x) => x.y + x.h)) - R.y : 0;
      w.crop = { x: Math.max(0, left), y: R.y, w: Math.max(10, right - left), h: Math.max(R.h * 1.9, lb + pitch * 0.1) };
    });
    for (const o of r.board) if (!o.crop) { const ww = pitch * (o.wide ? 2 : 1); o.crop = { x: Math.max(0, o.cx - ww / 2), y: R.y, w: ww, h: R.h * 1.4 }; }
  };
  const cropImg = (p, c) => { const bm = p.bmp; const r = { x: c.x, y: c.y, w: Math.min(c.w, bm.width - c.x), h: Math.min(c.h, bm.height - c.y) }; const s = Math.min(1, 170 / r.h); const cv = h('canvas', { width: Math.max(1, Math.round(r.w * s)), height: Math.max(1, Math.round(r.h * s)), class: 'waycrop' }); cv.getContext('2d').drawImage(bm, r.x, r.y, r.w, r.h, 0, 0, cv.width, cv.height); cv.onclick = () => modal('Close-up', (() => { const z = Math.min(2, (window.innerWidth - 60) / r.w, 520 / r.h); const big = h('canvas', { width: Math.round(r.w * z), height: Math.round(r.h * z), style: 'max-width:100%' }); big.getContext('2d').drawImage(bm, r.x, r.y, r.w, r.h, 0, 0, big.width, big.height); return big; })(), [{ label: 'Close', value: true }]); return cv; };
  const blankWay = (crop) => ({ kind: 'way', type: 'B', rating: '', rcbo: false, idn: '', desc: '', sure: false, why: 'Type it in', keep: true, crop });

  // v0.13: show / redraw the box the labels are read from (green), with each sticker found (dashed).
  function labelBoxEditor(r) {
    const p = parts[r.part]; const R = r.rect; const lb0 = r.labelBox || { x: R.x, y: R.y + R.h, w: R.w, h: R.h * 2 };
    const view = { x: Math.max(0, Math.min(R.x, lb0.x) - 20), y: Math.max(0, Math.min(R.y, lb0.y) - 20) };
    view.w = Math.min(p.bmp.width - view.x, Math.max(R.x + R.w, lb0.x + lb0.w) - view.x + 40); view.h = Math.min(p.bmp.height - view.y, Math.max(R.y + R.h, lb0.y + lb0.h) - view.y + R.h);
    const W = Math.min(window.innerWidth - 24, 1200); const s = W / view.w;
    const cv = h('canvas', { class: 'cropcv', width: Math.round(view.w * s), height: Math.round(view.h * s), style: 'touch-action:none;max-width:100%' });
    let lbox = { ...lb0 }, drag = null, moved = false;
    const T = (q) => [(q.x - view.x) * s, (q.y - view.y) * s, q.w * s, q.h * s];
    const paint = () => { const g = cv.getContext('2d'); g.drawImage(p.bmp, view.x, view.y, view.w, view.h, 0, 0, cv.width, cv.height);
      g.lineWidth = 3; g.strokeStyle = '#4fc3f7'; g.strokeRect(...T(R)); g.strokeStyle = '#22c55e'; g.lineWidth = 4; g.strokeRect(...T(lbox));
      if (!moved) { g.setLineDash([6, 4]); g.lineWidth = 2; g.strokeStyle = '#16a34a'; (r.labelRects || []).forEach((q) => g.strokeRect(...T(q))); g.setLineDash([]); }
      if (drag) { g.strokeStyle = '#ffb300'; g.setLineDash([8, 6]); g.strokeRect(Math.min(drag.x0, drag.x1), Math.min(drag.y0, drag.y1), Math.abs(drag.x1 - drag.x0), Math.abs(drag.y1 - drag.y0)); g.setLineDash([]); } };
    const pos = (e) => { const b2 = cv.getBoundingClientRect(); return [(e.clientX - b2.left) * (cv.width / b2.width), (e.clientY - b2.top) * (cv.height / b2.height)]; };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); const [x, y] = pos(e); drag = { x0: x, y0: y, x1: x, y1: y }; });
    cv.addEventListener('pointermove', (e) => { if (!drag) return; const [x, y] = pos(e); drag.x1 = x; drag.y1 = y; paint(); });
    cv.addEventListener('pointerup', () => { if (!drag) return; const q = { x: view.x + Math.min(drag.x0, drag.x1) / s, y: view.y + Math.min(drag.y0, drag.y1) / s, w: Math.abs(drag.x1 - drag.x0) / s, h: Math.abs(drag.y1 - drag.y0) / s }; drag = null; if (q.w > 40 && q.h > 20) { lbox = q; moved = true; } paint(); });
    const st = h('p', { class: 'note' });
    fill(box, h('div', { class: 'card' }, h('p', {}, 'Green box = where the labels are read from (blue = the breakers, dashed = each sticker found). If it missed the stickers, drag a new box round all of them (above or below the breakers), then tap Read labels.'), st),
      h('div', { class: 'cropwrap' }, cv),
      h('div', { class: 'stick' }, h('button', { class: 'btn', onclick: () => review() }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => {
        st.textContent = 'Reading labels\u2026'; const { relabelRow } = await ocr(); const n = await relabelRow(p.bmp, r, lbox); r.ways.forEach((w) => (w.crop = null)); placeCrops(r); toast(`${n} label(s) found`); review(); } }, 'Read labels')));
    paint();
  }
  function review() {
    const total = () => rows.reduce((n, r) => n + r.ways.filter((w) => w.keep).length, 0);
    let n0 = b.circuits.length;
    const seq = orderRows(rows, numOpts);
    const side = mainSide(rows);
    const numbering = rows.length ? h('div', { class: 'card' },
      h('b', {}, 'Numbering (all rows go on this board)'),
      h('p', { class: 'note' }, `Circuit ${n0 + 1} = ${numOpts.dir === 'main' ? 'the breaker next to the main switch' : 'the left-hand breaker'} on ${rows.length > 1 ? 'the first row below' : 'this row'}, then on along the row${rows.length > 1 ? ' and on to the next row' : ''}.`),
      h('div', { class: 'chips' }, h('button', { class: 'chip' + (numOpts.dir === 'main' ? ' on' : ''), onclick: () => { numOpts.dir = 'main'; review(); } }, side === 'right' ? 'From the main switch (right to left)' : 'From the main switch'),
        h('button', { class: 'chip' + (numOpts.dir === 'ltr' ? ' on' : ''), onclick: () => { numOpts.dir = 'ltr'; review(); } }, 'Left to right')),
      rows.length > 1 ? h('div', { class: 'list' }, seq.map((x, k) => h('div', { class: 'row' }, h('div', { class: 'main' }, h('div', { class: 't' }, `${k + 1}. Photo ${x.row.part + 1}${parts[x.row.part].rects.length > 1 || (parts[x.row.part].autoRects || []).length > 1 ? ' row ' + (x.row.row + 1) : ''}${mainRow(rows) === x.row ? ' (main switch row)' : ''}`)),
        k > 0 ? h('button', { class: 'btn tiny', onclick: () => { const m = seq.map((y) => rows.indexOf(y.row)); [m[k - 1], m[k]] = [m[k], m[k - 1]]; numOpts.manual = m; review(); } }, '\u2191 Earlier') : null))) : null) : null;
    const wayCard = (r, w, i) => {
      const p = parts[r.part]; const num = ++n0;
      return h('div', { class: 'card waycard' + (w.keep ? '' : ' off') + (w.sure ? '' : ' unsure') },
        w.crop ? cropImg(p, w.crop) : null,
        h('div', { class: 'wayform' },
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: w.keep, onchange: (e) => { w.keep = e.target.checked; review(); } }), h('b', {}, `Circuit ${w.keep ? num : '–'}`),
            w.sure ? h('span', { class: 'note' }, ' ✓ ' + (w.why || '')) : h('span', { class: 'flag' }, ' check: ' + (w.why || 'not sure'))),
          h('div', { class: 'chips' }, ['B', 'C', 'D'].map((t) => h('button', { class: 'chip' + (w.type === t ? ' on' : ''), onclick: () => { w.type = t; w.sure = true; review(); } }, t)),
            h('input', { class: 'rating', value: w.rating, inputmode: 'numeric', placeholder: 'A', 'aria-label': 'Rating A', oninput: (e) => { w.rating = e.target.value.replace(/\D/g, ''); w.sure = true; } }), h('span', {}, 'A'),
            h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!w.rcbo, onchange: (e) => { w.rcbo = e.target.checked; if (w.rcbo && !w.idn) w.idn = '30'; review(); } }), 'RCBO'),
            w.rcbo ? h('select', { onchange: (e) => (w.idn = e.target.value) }, ['10', '30', '100', '300'].map((v) => h('option', { value: v, selected: (w.idn || '30') === v ? true : null }, v + 'mA'))) : null),
          h('input', { value: w.desc || '', placeholder: 'Description (e.g. Downstairs sockets)', oninput: (e) => { w.desc = e.target.value; w.descTyped = true; } }),
          w.labelFrom === 'sticker' && w.desc ? h('span', { class: 'note' }, 'Label read from the sticker') : null,
          h('div', { class: 'btns' }, h('button', { class: 'btn tiny', onclick: () => { const c = w.crop ? { ...w.crop, x: w.crop.x + w.crop.w / 2 } : null; r.ways.splice(i + 1, 0, blankWay(c)); review(); } }, '+ way after'))));
    };
    fill(box,
      h('div', { class: 'notice amber' }, `Check every way against its photo (tap a photo to zoom). Flagged ones weren\u2019t clear. Nothing is added until you tap “Add”.`),
      numbering,
      seq.map(({ row: r, ways: wsq }) => h('div', {},
        h('h2', { class: 'sec' }, `Photo ${r.part + 1}${parts[r.part].rects.length > 1 || (parts[r.part].autoRects || []).length > 1 ? ' · row ' + (r.row + 1) : ''}: ${r.ways.length} way(s)`),
        !r.ways.length ? h('div', { class: 'notice red' }, 'No breaker markings could be read here. Split the row into ways below and type them in next to each photo slice.') : null,
        h('div', { class: 'btns' }, h('button', { class: 'btn small', onclick: async () => {
          const inp = h('input', { inputmode: 'numeric', value: String(r.ways.length || 12) });
          const v = await modal('How many ways in this row?', inp, [{ label: 'Cancel', value: false }, { label: 'Split', value: true, cls: 'primary' }]);
          const nn = parseInt(inp.value, 10); if (!v || !(nn > 0 && nn <= 40)) return;
          const { splitSlots } = await import('./cuscan.js');
          const old = r.ways; r.ways = splitSlots(r.rect, nn).map((c) => { const cx = c.x + c.w / 2; const hit = old.find((w) => w.cx >= c.x && w.cx < c.x + c.w); return hit ? { ...hit, crop: { ...c, h: r.rect.h * 1.9 } } : { ...blankWay({ ...c, h: r.rect.h * 1.9 }), cx }; }); review();
        } }, 'Split into N equal ways'), r.ways.length ? h('button', { class: 'btn small', onclick: () => labelBoxEditor(r) }, r.labelRects && r.labelRects.length ? `Labels: ${r.labelRects.length} found \u00b7 adjust box` : 'No labels found \u00b7 draw label box') : null),
        wsq.map(({ w, i }) => wayCard(r, w, i)),
        r.board.map((o, oi) => h('div', { class: 'card waycard board' + (o.kind === 'other' ? ' unsure' : '') },
          o.crop ? cropImg(parts[r.part], o.crop) : null,
          h('div', { class: 'wayform' },
            h('b', {}, o.kind === 'main' ? 'Not a circuit: main switch' + (o.rating ? ` (${o.rating}A)` : '') : o.kind === 'spd' ? 'Not a circuit: surge protector (SPD)' : o.kind === 'spdmcb' ? `Not a circuit: ${(o.type || 'B') + (o.rating || '')} MCB protecting the SPD` : 'Not added: unknown device'),
            h('span', { class: o.kind === 'other' || o.kind === 'spd' && o.why && /looks like/.test(o.why) ? 'flag' : 'note' }, (o.kind === 'other' || /looks like/.test(o.why || '') ? 'check: ' : '') + (o.why || '')),
            h('div', { class: 'btns' }, h('button', { class: 'btn tiny', onclick: () => { r.board.splice(oi, 1); const w = { ...o, kind: 'way', type: 'B', rating: '', rcbo: false, sure: false, why: 'You said this is a circuit: type it in', keep: true }; const at = r.ways.findIndex((x) => x.cx > o.cx); r.ways.splice(at < 0 ? r.ways.length : at, 0, w); review(); } }, 'It\u2019s a circuit'))))))),
      h('div', { class: 'stick' }, h('button', { class: 'btn', onclick: () => drawStart() }, 'Back to photos'), h('button', { class: 'btn primary', disabled: !total(), onclick: add }, `Add ${total()} circuit(s)`)));
  }

  async function add() {
    const { toCircuit } = await import('./cuscan.js');
    let n = b.circuits.length, added = 0;
    for (const { row: r, ways: wsq } of orderRows(rows, numOpts)) for (const { w } of wsq) { if (!w.keep) continue; const c = blankCircuit(++n); w.num = String(n); Object.assign(c, toCircuit(w)); if (/spare/i.test(w.desc || '')) { const was = isSpare(c); Object.assign(c, makeSpare(c)); descChanged(c, was); } b.circuits.push(c); added++; }
    // Keep the photos with the job (they go to Drive with the job's backup).
    if (cert.jobId) {
      for (const [i, p] of parts.entries()) {
        if (p.savedId) continue;
        const blob = await shrinkImage(p.file, 3000, 0.85);
        const fid = db.newId(); await db.put('files', { id: fid, jobId: cert.jobId, kind: 'photo', name: `board-${(b.ref || 'DB').replace(/[^\w-]+/g, '')}-${i + 1}-${Date.now()}.jpg`, blob, caption: `Consumer unit ${b.ref || ''} photo ${i + 1}`.replace(/\s+/g, ' '), createdAt: new Date().toISOString(), version: 1, source: 'scan' });
        p.savedId = fid;
      }
    }
    const sm = rows.flatMap((r) => r.ways).find((w) => w.spd && w.keep); if (sm && !b.spdDevice) b.spdDevice = `${sm.type || 'B'}${sm.rating || ''} MCB (circuit ${sm.num || ''})`.replace(' (circuit )', '');
    changed(); await flush();
    toast(`Added ${added} circuit(s)${cert.jobId ? ' · photos saved with the job' : ''}`); go(`#/cert/${id}/b/${bi}`);
  }
  drawStart();
  page('Scan consumer unit', box, { back: `#/cert/${id}/b/${bi}`, sub: b.ref });
});
