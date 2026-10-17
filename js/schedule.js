// =====================================================================
// schedule.js — boards, the schedule of test results and circuits.
// Portrait: a card per circuit, tap to fill it in.
// Landscape: the full schedule as a table, like the paper form.
// =====================================================================
import * as db from './db.js';
import { h, fill, toast, modal, confirmBox, pickFile } from './ui.js';
import { route, page, go, render } from './app.js';
import { openCert, changed, flush } from './state.js';
import { field } from './certui.js';
import { blankBoard } from './certmodel.js';
import { FIELDS, FIELD, TEMPLATES, blankCircuit, applyTemplate, copyCircuit, makeSpare } from './templates.js';
import { checkCircuit, limitZs, isSpare } from './checks.js';
import { DEVICES, deviceById, deviceFromBs, ratingsFor, CHECK_NOTE } from './limits.js';
import { voiceSupported, listen } from './voice.js';

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
    h('div', { class: 'list' }, cert.boards.map((b, i) => h('a', { class: 'row', href: `#/cert/${id}/b/${i}` }, h('div', { class: 'main' }, h('div', { class: 't' }, b.ref || 'Board ' + (i + 1)), h('div', { class: 's' }, `${b.circuits.length} circuits${b.location ? ' · ' + b.location : ''}`)), h('span', { class: 'go' }, '›')))),
    h('div', { class: 'btns full' }, h('button', { class: 'btn primary', onclick: () => addBoard(cert) }, '+ Add board')),
  ], { back: '#/cert/' + id, sub: cert.number });
});
function addBoard(cert) { cert.boards.push(blankBoard(cert.boards.length + 1)); changed(); go(`#/cert/${cert.id}/b/${cert.boards.length - 1}`); }

// ---------- One board ----------
route(/^\/cert\/([^/]+)\/b\/(\d+)$/, async (id, bi) => {
  const cert = await openCert(id); if (!cert) return go('#/');
  const b = cert.boards[+bi]; if (!b) return go('#/cert/' + id);
  const back = cert.boards.length > 1 ? `#/cert/${id}/boards` : '#/cert/' + id;
  const tools = boardTools(cert, b, +bi);
  if (LAND.matches) return page(`${b.ref || 'Board'} · schedule of test results`, [tools, scheduleTable(cert, b, +bi)], { back, wide: true, sub: cert.number });
  page(b.ref || 'Board', [
    boardDetails(cert, b),
    h('div', { class: 'note', style: 'margin:4px 0 8px' }, 'Tip: turn the phone sideways to see the whole schedule as a table.'),
    tools,
    circuitCards(cert, b, +bi),
    h('div', { class: 'btns full' }, h('button', { class: 'btn', onclick: () => addBoard(cert) }, '+ Add another board'), cert.boards.length > 1 ? h('button', { class: 'btn warn', onclick: async () => { if (await confirmBox('Delete this board?', `${b.ref} and its ${b.circuits.length} circuits`, 'Delete', 'warn')) { cert.boards.splice(+bi, 1); changed(); go(`#/cert/${id}/boards`); } } }, 'Delete board') : null),
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
      h('div', { class: 'note' }, 'SPD type'), h('div', { class: 'grid2' }, F('spdT1', 'T1', 'check'), F('spdT2', 'T2', 'check'), F('spdT3', 'T3', 'check'), F('spdNA', 'N/A', 'check')),
      h('div', { class: 'grid2' }, F('polOk', 'Correct polarity confirmed', 'check'), F('phaseSeq', 'Phase sequence confirmed', 'check'), F('spdOk', 'SPD operational status confirmed', 'check'), F('spdStatusNA', 'SPD status N/A', 'check')),
      h('div', { class: 'note' }, 'Main RCD of the board (if any)'), h('div', { class: 'grid2' }, F('rcdBs', 'RCD BS (EN)'), F('rcdType', 'RCD type'), F('rcdIdn', 'IΔn (mA)', 'num'), F('rcdRating', 'Rating (A)', 'num'))));
}

function boardTools(cert, b, bi) {
  const bulk = (k, v, label) => h('button', { class: 'btn small', onclick: () => { let n = 0; for (const c of b.circuits) if (!isSpare(c) && !c[k]) { c[k] = v; n++; } changed(); toast(`${label}: filled ${n}`); render(); } }, label);
  return h('div', {},
    h('div', { class: 'btns' },
      h('button', { class: 'btn primary small', onclick: () => addCircuit(cert, b, bi) }, '+ Circuit'),
      h('a', { class: 'btn small', href: `#/cert/${cert.id}/b/${bi}/scan` }, '📷 Scan board'),
      bulk('irLL', '>999', 'IR L-L >999'), bulk('irLE', '>999', 'IR L-E >999'), bulk('pol', '✓', 'Polarity ✓'), bulk('rcdBtn', '✓', 'RCD button ✓'), bulk('afddBtn', 'N/A', 'AFDD N/A'), bulk('irV', '500', 'Test V 500')));
}

async function addCircuit(cert, b, bi, open = true) {
  const n = b.circuits.length + 1;
  const r = await modal('Add a circuit', h('div', {}, h('p', { class: 'note' }, 'Pick a template to fill the circuit details (you can change anything), or start blank.'),
    h('div', { class: 'list' }, TEMPLATES.map((t, i) => h('button', { class: 'row', onclick: () => { document.querySelector('.modal-bg').remove(); done(applyTemplate(blankCircuit(n), t)); } }, h('div', { class: 'main' }, h('div', { class: 't' }, t.name), h('div', { class: 's' }, `${t.type || ''}${t.rating} A ${deviceById(t.device).label.split(' ')[0]} · ${t.live}/${t.cpc || '–'} mm²`)))))),
  [{ label: 'Blank', value: 'blank' }, { label: 'Spare way', value: 'spare' }]);
  if (r === 'blank') done(blankCircuit(n)); else if (r === 'spare') done(makeSpare(blankCircuit(n)));
  function done(c) { b.circuits.push(c); changed(); if (open && !LAND.matches && !c.spare) go(`#/cert/${cert.id}/b/${bi}/c/${b.circuits.length - 1}`); else render(); }
}

function summary(c, res) {
  const r = (k, label) => h('div', { class: (res.flags[k] || {}).level || '' }, label, h('b', {}, c[k] || '–'));
  return h('div', { class: 'rd' }, r('r1r2', 'R1+R2'), r('irLE', 'IR L-E'), r('zs', 'Zs'), r('rcdMs', 'RCD ms'));
}
function circuitCards(cert, b, bi) {
  if (!b.circuits.length) return h('div', { class: 'empty' }, 'No circuits yet. Tap “+ Circuit”, or scan the board.');
  return h('div', {}, b.circuits.map((c, ci) => {
    const res = checkCircuit(c, ctxFor(cert, b));
    const cls = isSpare(c) ? 'spare' : res.worst || (c.zs ? 'ok' : '');
    const dev = isSpare(c) ? 'Spare way' : `${c.type}${c.rating}${c.rating ? ' A' : ''} ${(deviceById(c.device) || {}).label ? deviceById(c.device).label.split(' ')[0] : c.bs} · ${c.live || '–'}/${c.cpc || '–'} mm²${res.maxZs != null ? ` · max Zs ${res.maxZs}` : ''}`;
    return h('a', { class: 'ccard ' + cls, href: `#/cert/${cert.id}/b/${bi}/c/${ci}` },
      h('div', { class: 'hd' }, h('span', { class: 'no' }, c.num), h('span', { class: 'ds' }, c.desc || 'No description'), res.worst ? h('span', { class: 'pill ' + res.worst }, res.worst === 'red' ? 'Check' : 'Look') : null),
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
      h('button', { class: 'btn small', onclick: () => { b.circuits.splice(+ci + 1, 0, copyCircuit(c, b.circuits.length + 1)); renumberIfSequential(b); changed(); toast('Copied (readings left blank)'); go(`${base}/c/${+ci + 1}`); } }, 'Copy row'),
      h('button', { class: 'btn small', onclick: async () => { const t = await pickTemplate(); if (t) { Object.assign(c, applyTemplate(c, t)); changed(); render(); } } }, 'Template'),
      h('button', { class: 'btn small', onclick: () => { Object.assign(c, makeSpare(c)); changed(); render(); } }, 'SPARE / N/A'),
      h('button', { class: 'btn small warn', onclick: async () => { if (await confirmBox('Delete circuit?', `${c.num} ${c.desc}`, 'Delete', 'warn')) { b.circuits.splice(+ci, 1); changed(); go(base); } } }, 'Delete'),
    ] });
});
route(/^\/cert\/([^/]+)\/mwc$/, async (id) => {
  const cert = await openCert(id); if (!cert) return go('#/');
  circuitEditor({ cert, c: cert.mw.circuit, ctx: () => ({ earthing: cert.mw.earthing, zdb: cert.mw.zdb }), back: `#/cert/${id}/s/mwC`, title: 'Minor works circuit', mw: true,
    extra: [h('button', { class: 'btn small', onclick: async () => { const t = await pickTemplate(); if (t) { Object.assign(cert.mw.circuit, applyTemplate(cert.mw.circuit, t)); changed(); render(); } } }, 'Template')] });
});
function renumberIfSequential(b) { if (b.circuits.every((c, i) => !c.num || /^\d+$/.test(c.num))) b.circuits.forEach((c, i) => (c.num = String(i + 1))); }
async function pickTemplate() {
  let chosen = null;
  await modal('Circuit template', h('div', { class: 'list' }, TEMPLATES.map((t) => h('button', { class: 'row', onclick: () => { chosen = t; document.querySelector('.modal-bg').remove(); } }, h('div', { class: 'main' }, h('div', { class: 't' }, t.name))))), [{ label: 'Cancel', value: null }]);
  return chosen;
}

function circuitEditor({ cert, c, ctx, back, title, prev, next, extra = [], mw = false }) {
  const flagEls = {};
  const limBox = h('div', { class: 'limit' });
  const refresh = () => {
    const res = checkCircuit(c, ctx());
    for (const [k, el] of Object.entries(flagEls)) {
      const f = res.flags[k]; el.wrap.className = 'fld ' + (f ? f.level : ''); el.msg.textContent = f ? f.msg : '';
    }
    const lim = limitZs(c, ctx());
    fill(limBox, isSpare(c) ? 'Spare way: no limits apply.' : lim.value != null ? h('span', {}, 'Max Zs ', h('b', {}, lim.value.toFixed(2) + ' Ω'), res.cold != null ? ` · 80% (cold reading) ${res.cold.toFixed(2)} Ω` : '', h('br'), h('span', { class: 'note' }, lim.source)) : 'Pick the device and rating to see the maximum Zs.');
  };
  const inp = (k, opts = {}) => {
    const fd = FIELD[k] || { label: opts.label, k };
    const input = h('input', { value: c[k] ?? '', inputmode: fd.num ? 'decimal' : null, oninput: (e) => { c[k] = e.target.value; changed(); refresh(); } });
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
    }, onEnd: () => { rec = null; btn.textContent = '🎤 Say readings'; }, onError: (err) => toast(err.message) });
  } }, '🎤 Say readings') : null;
  const sect = (t, ...kids) => h('div', { class: 'card' }, h('h2', {}, t), kids);
  page(title, [
    h('div', { class: 'btns' }, extra, mic),
    sect('Circuit details', h('div', { class: 'grid2' }, inp('num'), inp('points')), inp('desc'), devBox,
      h('div', { class: 'grid3' }, inp('live'), inp('cpc'), inp('ref')), inp('wiring', { label: 'Type of wiring (A–H, O)' }),
      h('div', { class: 'grid2' }, inp('rcdBs'), inp('rcdType'), inp('rcdIdn'), inp('rcdRating')),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!c.rcdS, onchange: (e) => { c.rcdS = e.target.checked; changed(); refresh(); } }), 'Time-delayed (S-type) RCD')),
    sect('Test results',
      h('div', { class: 'grid3' }, inp('r1'), inp('rn'), inp('r2')), h('div', { class: 'grid2' }, inp('r1r2'), inp('R2')),
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
    const cells = {}; let maxCell;
    const upd = () => {
      const res = checkCircuit(c, ctxFor(cert, b));
      for (const [k, td] of Object.entries(cells)) { const f = res.flags[k]; td.className = (k === 'desc' ? 'desc sl2 ' : k === 'num' ? 'sl ' : '') + (f ? f.level : ''); td.title = f ? f.msg : ''; }
      const lim = limitZs(c, ctxFor(cert, b)); maxCell.firstChild.placeholder = isSpare(c) ? 'N/A' : lim.value != null ? lim.value.toFixed(2) : '?';
    };
    const cell = (f) => {
      const i = h('input', { value: c[f.k] ?? '', inputmode: f.num ? 'decimal' : null, 'aria-label': `Circuit ${c.num} ${f.label}`, oninput: (e) => { c[f.k] = e.target.value; if (f.k === 'bs') { const d = deviceFromBs(c.bs); if (d) c.device = d.id; } changed(); upd(); }, ondblclick: isTick(f.k) ? (e) => { c[f.k] = c[f.k] === '✓' ? '' : '✓'; e.target.value = c[f.k]; changed(); upd(); } : null });
      const td = h('td', { class: f.k === 'desc' ? 'desc sl2' : f.k === 'num' ? 'sl' : '', style: f.k === 'desc' ? 'min-width:150px' : f.k === 'remarks' ? 'min-width:160px' : 'min-width:' + (f.tick ? 40 : 52) + 'px' }, i);
      cells[f.k] = td; return td;
    };
    maxCell = h('td', { class: 'calc', title: 'From the BS 7671 tables. Type your own figure to override.' }, h('input', { value: c.maxZsOverride || '', inputmode: 'decimal', style: 'color:#1b3a6b;font-weight:600', oninput: (e) => { c.maxZsOverride = e.target.value; changed(); upd(); } }));
    body.append(h('tr', { class: isSpare(c) ? 'spare' : '' }, cols.map((f) => [cell(f), f.k === 'bka' ? maxCell : null]),
      h('td', { class: 'act' }, h('button', { title: 'Open', onclick: () => go(`#/cert/${cert.id}/b/${bi}/c/${ci}`) }, '✎'), h('button', { title: 'Copy row', onclick: () => { b.circuits.splice(ci + 1, 0, copyCircuit(c, b.circuits.length + 1)); renumberIfSequential(b); changed(); render(); } }, '⧉'), h('button', { title: 'Spare', onclick: () => { Object.assign(c, makeSpare(c)); changed(); render(); } }, '∅'))));
    upd();
  });
  return h('div', {}, h('div', { class: 'tablewrap' }, h('table', { class: 'sched' }, h('thead', {}, head), body)),
    h('p', { class: 'note' }, `Zdb ${b.zdb || '–'} Ω · Ipf ${b.ipf || '–'} kA · Earthing ${cert.supply.earthing}. Red = over the limit, amber = worth a look (hold a finger on a cell to see why). Double-tap a tick column for ✓. `, CHECK_NOTE));
}

// ---------- Scan a consumer unit photo ----------
route(/^\/cert\/([^/]+)\/b\/(\d+)\/scan$/, async (id, bi) => {
  const cert = await openCert(id); if (!cert) return go('#/');
  const b = cert.boards[+bi];
  const box = h('div');
  const status = h('div', { class: 'note' });
  const start = async (capture) => {
    const [f] = await pickFile({ accept: 'image/*', capture }); if (!f) return;
    status.textContent = 'Loading the reader…';
    try {
      const { readBoardPhoto } = await import('./ocr.js');
      const { circuits, text } = await readBoardPhoto(f, (p, msg) => (status.textContent = `${msg} ${Math.round(p * 100)}%`));
      status.textContent = '';
      review(circuits, text, URL.createObjectURL(f));
    } catch (e) { status.textContent = 'Couldn\u2019t read the photo: ' + e.message; }
  };
  const review = (rows, text, img) => {
    rows.forEach((r) => (r.keep = true));
    const draw = () => fill(box, 
      h('img', { src: img, style: 'width:100%;border-radius:10px;margin-bottom:8px' }),
      rows.length ? h('div', { class: 'notice amber' }, `Found ${rows.length} device(s). Check every row: the reader can get things wrong. Nothing is added until you tap “Add”.`) : h('div', { class: 'notice red' }, 'No breaker markings (like B32 or C16) found. Try a closer, straight-on photo with good light.'),
      rows.map((r, i) => h('div', { class: 'card', style: r.keep ? '' : 'opacity:.5' },
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: r.keep, onchange: (e) => { r.keep = e.target.checked; draw(); } }), h('b', {}, `Way ${i + 1}`), h('span', { class: 'note' }, ` read as “${r.source}”`)),
        h('div', { class: 'grid3' }, h('label', { class: 'f' }, h('span', {}, 'Description'), h('input', { value: r.desc, oninput: (e) => (r.desc = e.target.value) })),
          h('label', { class: 'f' }, h('span', {}, 'Type'), h('select', { onchange: (e) => (r.type = e.target.value) }, ['B', 'C', 'D'].map((t) => h('option', { selected: r.type === t ? true : null }, t)))),
          h('label', { class: 'f' }, h('span', {}, 'Rating A'), h('input', { value: r.rating, inputmode: 'numeric', oninput: (e) => (r.rating = e.target.value) }))),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: r.device === 'rcbo', onchange: (e) => { r.device = e.target.checked ? 'rcbo' : 'mcb'; r.bs = e.target.checked ? '61009' : '60898'; } }), 'RCBO'))),
      text ? h('details', { class: 'card' }, h('summary', {}, 'Text the reader saw'), h('pre', { style: 'white-space:pre-wrap;font-size:12px' }, text)) : null,
      h('div', { class: 'stick' }, h('button', { class: 'btn', onclick: () => start(true) }, 'Retake'), h('button', { class: 'btn primary', disabled: !rows.some((r) => r.keep), onclick: () => {
        const add = rows.filter((r) => r.keep); let n = b.circuits.length;
        for (const r of add) { const c = blankCircuit(++n); Object.assign(c, { desc: r.desc, type: r.type, rating: r.rating, device: r.device, bs: r.bs, time: 0.4 }); if (r.device === 'rcbo') Object.assign(c, { rcdBs: '61009', rcdIdn: '30', rcdType: 'A', rcdRating: r.rating }); if (/spare/i.test(r.desc)) Object.assign(c, makeSpare(c)); b.circuits.push(c); }
        changed(); toast(`Added ${add.length} circuit(s)`); go(`#/cert/${id}/b/${bi}`);
      } }, `Add ${rows.filter((r) => r.keep).length} circuit(s)`)));
    draw();
  };
  fill(box, h('div', { class: 'card' }, h('p', {}, 'Take a photo of the consumer unit with the cover on, straight on, so the breaker markings (B32, C16…) and the labels are readable.'),
    h('p', { class: 'note' }, 'The photo is read on this phone (no internet needed) and isn\u2019t saved. You check every circuit before anything is added.'),
    h('div', { class: 'btns full' }, h('button', { class: 'btn primary', onclick: () => start(true) }, 'Take photo'), h('button', { class: 'btn', onclick: () => start(false) }, 'From gallery')), status));
  page('Scan consumer unit', box, { back: `#/cert/${id}/b/${bi}`, sub: b.ref });
});
