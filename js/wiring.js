// =====================================================================
// wiring.js — v0.38 (prototype): automatic single-line wiring diagram.
// Drawn only from what the certificate already holds (supply, board,
// protective devices, circuits, number of points). No rooms.
// One layout (plain shapes) feeds two renderers: SVG for the screen and
// jsPDF lines/text for the PDF, so both always match.
// =====================================================================
import { isSpareCircuit } from './templates.js';

const NA = 'N/A';
const isNAv = (v) => /^\s*n\s*[\/.]?\s*a\s*\.?\s*$/i.test(String(v ?? ''));
const val = (v) => { const s = String(v ?? '').trim(); return s && !isNAv(s) ? s : ''; };
export const COL = { ink: [20, 20, 20], grey: [110, 110, 110], na: [170, 170, 170], line: [60, 60, 60], brand: [41, 82, 255], fill: [244, 246, 252] };
export const MAX_SYMBOLS = 10;

// ---------- what kind of point a circuit feeds ----------
export function pointKind(c) {
  const d = String((c && c.desc) || '').toLowerCase();
  if (/socket|ring|s\/o|\bsoc/.test(d)) return 'socket';
  if (/light|lamp|ltg|lighting/.test(d)) return 'light';
  if (/cooker|oven|hob|range/.test(d)) return 'cooker';
  if (/shower/.test(d)) return 'shower';
  if (/smoke|heat (alarm|det)|\balarms?\b|detector/.test(d)) return 'alarm';
  if (/immersion/.test(d)) return 'immersion';
  if (/\bev\b|charger|car charg|charge ?point/.test(d)) return 'ev';
  if (/\bfan|extract/.test(d)) return 'fan';
  if (/\bfcu\b|fused spur|fused conn/.test(d)) return 'fcu';
  if (/boiler|heater|heating|ev\b|charger|fan|extract|alarm|smoke|heat det|pump|inverter|garage|sub-?main|towel|spur|fcu|fused/.test(d)) return 'appliance';
  return 'point';
}
export const KIND_NAME = { socket: 'Socket', light: 'Light', cooker: 'Cooker', shower: 'Shower', alarm: 'Smoke / heat alarm', immersion: 'Immersion heater', ev: 'EV charger', fan: 'Fan', fcu: 'Fused spur (FCU)', appliance: 'Fixed appliance', point: 'Point' };
// Plural words for the "Points:" line.
const KIND_PLURAL = { socket: 'sockets', light: 'lights', cooker: 'cookers', shower: 'showers', alarm: 'alarms', immersion: 'immersions', ev: 'EV chargers', fan: 'fans', fcu: 'FCUs', appliance: 'fixed appliances', point: 'points' };
const KIND_ONE = { socket: 'socket', light: 'light', cooker: 'cooker', shower: 'shower', alarm: 'alarm', immersion: 'immersion', ev: 'EV charger', fan: 'fan', fcu: 'FCU', appliance: 'fixed appliance', point: 'point' };
// Optional per-circuit diagram extras: circuit.diagram = { rooms, sw1, sw2, swi }.
// Old certs have none; a lighting circuit then gets one 1-way switch.
const KEY_EXTRA = { jbsw: 'Switch-fed: JB to switch, then to the lights', socket: 'Twin socket', socket1: 'Socket (single)', rose: 'Ceiling rose (loop-in)', jb: 'Junction box (JB)', strap: '2-way strappers (two wires)' };
export const SWITCH_NAME = { sw1: '1-way switch', sw2: '2-way switch', swi: 'Intermediate switch' };
const num0 = (v) => { const n = parseInt(String(v ?? ''), 10); return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_SYMBOLS) : 0; };
export function switchInfo(c) {
  if (pointKind(c) !== 'light') return null;
  const d = (c && c.diagram) || {};
  const rl = roomListOf(c);
  if (rl) {
    const sw1 = rl.reduce((a, r) => a + r.sw1, 0), sw2 = rl.reduce((a, r) => a + r.sw2pairs, 0), swi = rl.reduce((a, r) => a + r.swi, 0);
    const words = [sw1 && `${sw1} \u00d7 1-way`, sw2 && `${sw2} \u00d7 2-way pair`, swi && `${swi} \u00d7 intermediate`].filter(Boolean);
    return { list: [], text: words.length ? words.join(', ') : 'None', set: true, rooms: true };
  }
  const set = ['sw1', 'sw2', 'swi'].some((k) => d[k] !== undefined && d[k] !== '');
  const sw1 = set ? num0(d.sw1) : 1, sw2 = set ? num0(d.sw2) : 0, swi = set ? num0(d.swi) : 0;
  const list = [...Array(sw1).fill('sw1'), ...Array(sw2 * 2).fill('sw2'), ...Array(swi).fill('swi')];
  const words = [sw1 && `${sw1} \u00d7 1-way`, sw2 && `${sw2} \u00d7 2-way pair`, swi && `${swi} \u00d7 intermediate`].filter(Boolean);
  return { list, text: words.length ? words.join(', ') : 'None', set };
}
// Sockets draw as twins by default; circuit.diagram.singles (optional, 0 by
// default) says how many of the points served are single sockets.
export function socketSingles(c) {
  if (pointKind(c) !== 'socket') return 0;
  const n = parseInt(String((c && c.diagram && c.diagram.singles) ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const pc = pointCount(c); return pc.known ? Math.min(n, pc.n) : n;
}
export const roomsOf = (c) => (roomListOf(c) ? '' : val(c && c.diagram && c.diagram.rooms));
// v0.39 (test): rooms on a lighting circuit, each drawn in its own box.
// circuit.diagram.roomList = [{ name, lights, sw1, sw2pairs, swi, wiring }]
// (optional; when present it takes over from the rooms text and switch counts).
export const ROOM_WIRING = { 'loop-in': 'Loop-in at ceiling rose', 'junction box': 'Junction box', 'jb-switch': 'JB to switch, then to the lights' };
const cnt = (v, max = MAX_SYMBOLS) => { const n = parseInt(String(v ?? ''), 10); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0; };
export function roomListOf(c) {
  const l = c && c.diagram && c.diagram.roomList;
  if (!Array.isArray(l) || !l.length || pointKind(c) !== 'light') return null;
  return arrangedOrder(c).map((i) => [l[i], i]).filter(([r]) => r).map(([r, i]) => {
    const sw2pairs = cnt(r.sw2pairs, 3); const swi = sw2pairs ? cnt(r.swi, 4) : 0;
    return { i, name: val(r.name), lights: cnt(r.lights), sw1: cnt(r.sw1, 4), sw2pairs, swi, wiring: ROOM_WIRING[r.wiring] ? r.wiring : 'loop-in' };
  });
}
// v0.40 (test): optional circuit.diagram.layout = { order: [roomList index, ...] }
// set in Arrange mode. Missing/stale -> the normal order. Screen and PDF both use it.
export function arrangedOrder(c) {
  const l = (c && c.diagram && Array.isArray(c.diagram.roomList)) ? c.diagram.roomList : [];
  const o = c && c.diagram && c.diagram.layout && Array.isArray(c.diagram.layout.order) ? c.diagram.layout.order : null;
  const all = l.map((_, i) => i);
  if (!o) return all;
  const seen = new Set(); const out = [];
  for (const v of o) { const i = parseInt(v, 10); if (Number.isInteger(i) && i >= 0 && i < l.length && !seen.has(i)) { seen.add(i); out.push(i); } }
  return [...out, ...all.filter((i) => !seen.has(i))];
}
export const roomLightTotal = (c) => (roomListOf(c) || []).reduce((a, r) => a + r.lights, 0);
// Screen-only note when the rooms' lights don't add up to Points served.
export function roomPointsNote(c) {
  const rl = roomListOf(c); if (!rl) return '';
  const t = roomLightTotal(c); const pc = pointCount(c);
  if (!pc.known) return `Rooms add up to ${t} light${t === 1 ? '' : 's'}. Points served is not filled in.`;
  return t === pc.n ? '' : `Rooms add up to ${t} light${t === 1 ? '' : 's'}, but Points served says ${pc.n}.`;
}
// How many symbols to draw: up to MAX_SYMBOLS, then "+ N more".
export function pointCount(c) {
  const n = parseInt(String((c && c.points) ?? '').trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return { n: 0, shown: 0, more: 0, known: false };
  const shown = Math.min(n, MAX_SYMBOLS);
  return { n, shown, more: n - shown, known: true };
}

// ---------- the model ----------
const isRcbo = (c) => c.device === 'rcbo' || /61009|62423.*rcbo/i.test(String(c.bs || ''));
const hasRcd = (c) => Boolean(val(c.rcdIdn) || val(c.rcdType));
const rcdKey = (c) => [val(c.rcdBs), val(c.rcdType), val(c.rcdIdn), val(c.rcdRating)].join('|');
export function rcdLabel(c) {
  const p = [val(c.rcdIdn) && val(c.rcdIdn) + ' mA', val(c.rcdType) && 'Type ' + val(c.rcdType), val(c.rcdRating) && val(c.rcdRating) + ' A'].filter(Boolean);
  return 'RCD' + (p.length ? ' ' + p.join(', ') : '');
}
// Circuits on MCBs that share the same RCD (same RCD details, next to each
// other on the schedule) hang off one RCD; RCBOs and plain MCBs hang off the bus.
// Spare ways are listed once, in one line: "Spare: 1, 4, 5, 9–14".
export function spareRanges(nums) {
  const ints = []; const other = [];
  for (const n of nums) { const s = String(n ?? '').trim(); if (/^\d+$/.test(s)) ints.push(+s); else if (s) other.push(s); }
  const u = [...new Set(ints)].sort((a, b) => a - b); const out = [];
  for (let i = 0; i < u.length; i++) { let j = i; while (j + 1 < u.length && u[j + 1] === u[j] + 1) j++; out.push(j > i + 1 ? `${u[i]}\u2013${u[j]}` : j === i + 1 ? `${u[i]}, ${u[j]}` : `${u[i]}`); i = j; }
  return [...out, ...other].join(', ');
}
// A surge protection device way: by its description, or the board's SPD
// Type 2 tick together with a way described as SPD/surge.
export const isSpd = (c) => !!c && !isSpareCircuit(c) && /\bspd\b|surge/i.test(String(c.desc || ''));
export function spdLabel(c, board) {
  const m = /type\s*([123](?:\s*[+&\/]\s*[123])?)|\bT([123])\b/i.exec(String(c.desc || ''));
  const t = m ? (m[1] || m[2]).replace(/\s+/g, '') : board ? (board.spdT1 ? '1' : board.spdT2 ? '2' : board.spdT3 ? '3' : '') : '';
  return 'SPD' + (t ? ' Type ' + t : '');
}
export function groupCircuits(circuits, board = null) {
  const items = []; let grp = null; const spares = [];
  for (const c of circuits || []) {
    if (!c) continue;
    if (isSpareCircuit(c)) { spares.push(val(c.num) || '?'); continue; }
    if (isSpd(c)) { grp = null; items.push({ kind: 'circuit', c, spd: spdLabel(c, board) }); continue; }
    if (!isSpareCircuit(c) && !isRcbo(c) && hasRcd(c)) {
      const key = rcdKey(c);
      if (grp && grp.key === key) { grp.circuits.push(c); continue; }
      grp = { kind: 'rcd', key, label: rcdLabel(c), circuits: [c] }; items.push(grp); continue;
    }
    grp = null; items.push({ kind: 'circuit', c });
  }
  if (spares.length) items.push({ kind: 'spares', text: 'Spare: ' + spareRanges(spares), count: spares.length });
  return items;
}
// Minor works "Spur added": cert.mw.spur = { on, count, feeds: 'socket' | 'fcu' }.
export const SPUR_FEEDS = { socket: 'Socket', fcu: 'Fused spur (FCU)' };
export function spurInfo(M) {
  const sp = M && M.spur; if (!sp || !sp.on) return null;
  const n = Math.max(1, Math.min(MAX_SYMBOLS, parseInt(String(sp.count ?? '1'), 10) || 1));
  const feeds = sp.feeds === 'fcu' ? 'fcu' : 'socket';
  const what = feeds === 'fcu' ? (n === 1 ? 'fused spur (FCU)' : 'fused spurs (FCU)') : (n === 1 ? 'socket' : 'sockets');
  return { n, feeds, kind: feeds === 'fcu' ? 'appliance' : 'socket', label: `Spur added (new): ${n} \u00d7 ${what}` };
}
// "Controlled by": circuit.control = { via, controlCircuit } (optional, new
// field only; old certs without it draw exactly as before).
export const CONTROL_VIA = { none: 'Direct (no control)', contactor: 'Contactor', 'contactor+timeclock': 'Contactor on a time clock', 'contactor+relay': 'Contactor on a relay', timeclock: 'Time clock' };
const VIA_NOTE = { contactor: 'via contactor', 'contactor+timeclock': 'via contactor, time clock controlled', 'contactor+relay': 'via contactor, relay controlled', timeclock: 'via time clock' };
export function controlInfo(c) {
  const k = c && c.control; const via = k && VIA_NOTE[k.via] ? k.via : '';
  if (!via) return null;
  return { via, note: VIA_NOTE[via], tag: via === 'timeclock' ? 'TC' : 'KM', from: val(k.controlCircuit) };
}
// which circuits each control circuit switches: { '9': ['7', '8'] }
export function controlLinks(circuits) {
  const m = {};
  for (const c of circuits || []) { const ci = controlInfo(c); if (ci && ci.from) (m[ci.from] ||= []).push(val(c.num) || '?'); }
  return m;
}
export function diagramModel(cert) {
  cert = cert || {}; const sup = cert.supply || {}; const parts = cert.parts || {};
  if (cert.type === 'MW') {
    const M = cert.mw || {};
    return { type: 'MW', supply: { earthing: val(M.earthing), lines: [val(M.zdb) && `Zdb ${val(M.zdb)} Ω`].filter(Boolean) }, main: null,
      boards: [{ ref: val(M.dbRef) || 'DB', location: val(M.dbLocation), from: '', items: groupCircuits(M.circuit ? [M.circuit] : [], null).map((it) => (it.kind === 'circuit' && spurInfo(M) ? { ...it, spur: spurInfo(M) } : it)), note: 'Only the circuit covered by this certificate is shown.' }] };
  }
  const ms = [val(parts.msCurrent) && val(parts.msCurrent) + ' A', val(parts.msPoles) && val(parts.msPoles) + '-pole', val(parts.msBs) && 'BS EN ' + val(parts.msBs).replace(/^BS\s*(EN)?\s*/i, '')].filter(Boolean).join(', ');
  // A new cert pre-fills the supply fuse standard (BS 88-3). On its own that's
  // just the default, so the fuse is only shown once a type or rating is in.
  const fuse = (val(sup.spType) || val(sup.spRating)) ? [val(sup.spBs), val(sup.spType), val(sup.spRating) && val(sup.spRating) + ' A'].filter(Boolean).join(' ') : '';
  return {
    type: cert.type,
    supply: { earthing: val(sup.earthing), lines: [[val(sup.conductors), val(sup.u) && val(sup.u) + ' V', val(sup.f) && val(sup.f) + ' Hz'].filter(Boolean).join(', '), [val(sup.ze) && `Ze ${val(sup.ze)} Ω`, val(sup.ipf) && `Ipf ${val(sup.ipf)} kA`].filter(Boolean).join(', '), ].filter(Boolean), fuse },
    main: { label: 'Main switch', detail: ms },
    boards: (cert.boards || []).map((b, bi) => ({ ref: val(b.ref) || 'DB', location: val(b.location), from: val(b.suppliedFrom), items: groupCircuits(b.circuits, b), links: controlLinks(b.circuits), bi, src: b.circuits || [] })),
  };
}

// ---------- text measuring (Arial/Arimo, a little generous so text never overflows) ----------
const NARROW = /[iljI.,:;'!|() ]/; const WIDE = /[MWmw@%]/;
export function textW(s, size, bold = false) {
  let w = 0; for (const ch of String(s)) w += NARROW.test(ch) ? 0.3 : WIDE.test(ch) ? 0.86 : /[A-Z0-9]/.test(ch) ? 0.67 : 0.56;
  return w * size * (bold ? 1.07 : 1);
}
// Wraps in full on spaces. Never cuts text short, never adds "…".
export function wrapText(s, w, size, bold = false) {
  const out = [];
  for (const para of String(s ?? '').split(/\r?\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = '';
    for (const wd of words) {
      const glue = line ? ' ' : '';
      if (!line || textW(line + glue + wd, size, bold) <= w) { line += glue + wd; continue; }
      out.push(line); line = wd;
    }
    // a single word wider than the box: break it (last resort, nothing is lost)
    const pieces = [];
    while (line && textW(line, size, bold) > w && line.length > 1) { let n = line.length - 1; while (n > 1 && textW(line.slice(0, n), size, bold) > w) n--; pieces.push(line.slice(0, n)); line = line.slice(n); }
    out.push(...pieces, line);
  }
  return out;
}

// ---------- layout ----------
// Units are abstract; `W` is the drawing width. Returns blocks stacked
// top to bottom: { h, shapes }. Shapes: line, rect, circle, text.
export function circuitLines(c, spd = '') {
  if (isSpareCircuit(c)) return { title: `${val(c.num) || '?'}  SPARE`, rows: [], spare: true };
  const dev = [val(c.type) && val(c.type) !== 'adj' ? val(c.type) : '', val(c.rating)].join('') ;
  const kind = isRcbo(c) ? 'RCBO' : c.device === 'mcb' ? 'MCB' : val(c.bs) ? 'BS ' + val(c.bs) : '';
  const device = [dev, kind].filter(Boolean).join(' ') + (isRcbo(c) && val(c.rcdIdn) ? `, ${val(c.rcdIdn)} mA` + (val(c.rcdType) ? ' Type ' + val(c.rcdType) : '') : '');
  const cable = val(c.live) ? `${val(c.live)}${val(c.cpc) ? ' / ' + val(c.cpc) : ''} mm²` : '';
  const pc = pointCount(c);
  // SPD way: a normal breaker in the box, the SPD drawn as its load
  // The breaker already shows in its box, so no "Breaker:" line. An RCBO's
  // RCD details would be lost, so they get their own "RCD:" line.
  const rcd = isRcbo(c) && (val(c.rcdIdn) || val(c.rcdType)) ? [val(c.rcdIdn) && val(c.rcdIdn) + ' mA', val(c.rcdType) && 'Type ' + val(c.rcdType)].filter(Boolean).join(' ') : '';
  const pre = rcd ? [['RCD', rcd]] : [];
  const rooms = roomsOf(c); const room = rooms ? ' \u00b7 ' + rooms : '';
  if (spd) return { title: `${val(c.num) || '?'}  ${val(c.desc) || 'SPD'}${room}`, spare: false, spd, device, devShort: dev || NA, devKind: kind, rows: [...pre, ['Cable', cable], ['Load', spd]] };
  const k = pointKind(c); const si = switchInfo(c);
  return { title: `${val(c.num) || '?'}  ${val(c.desc) || 'No description'}${room}`, spare: false, device, devShort: dev || NA, devKind: kind, noPoints: !pc.known,
    rooms: roomListOf(c), roomNote: roomPointsNote(c),
    rows: [...pre, ['Cable', cable], ...(roomListOf(c) ? [['Rooms', roomListOf(c).length + (roomListOf(c).length === 1 ? ' room' : ' rooms')]] : []), ['Points', pc.known ? `${pc.n} \u00d7 ${pc.n === 1 ? KIND_ONE[k] : KIND_PLURAL[k]}` : ''], ...(si ? [['Switches', si.text]] : [])] };
}

export function layout(model, { W = 380, font = 12, screen = false } = {}) {
  const F = font, small = F * 0.86, lh = (s) => s * 1.3;
  const blocks = [];
  const busX = 14, devX = busX + 14, devW = F * 4.6, gap = 8;
  const T = (sh, x, y, txt, o = {}) => sh.push({ t: 'text', x, y, txt, size: o.size || F, bold: !!o.bold, color: o.color || COL.ink, anchor: o.anchor || 'start' });
  const L = (sh, x1, y1, x2, y2, o = {}) => sh.push({ t: 'line', x1, y1, x2, y2, w: o.w || 1.2, color: o.color || COL.line, ...(o.dash ? { dash: o.dash } : {}) });
  const R = (sh, x, y, w, h, o = {}) => sh.push({ t: 'rect', x, y, w, h, lw: o.lw || 1.2, color: o.color || COL.line, fill: o.fill || null });
  const C = (sh, cx, cy, r, o = {}) => sh.push({ t: 'circle', cx, cy, r, lw: o.lw || 1.1, color: o.color || COL.line, fill: o.fill || null });
  const textLines = (sh, x, y, text, w, o = {}) => { const s = o.size || F; const ls = wrapText(text, w, s, o.bold); ls.forEach((l, i) => T(sh, x, y + s + i * lh(s), l, o)); return ls.length * lh(s); };
  // label + value; a missing value prints N/A in light grey
  const kv = (sh, x, y, label, v, w) => { const lab = label + ': '; const lw = Math.max(textW(lab, small), textW('Cable: ', small)); T(sh, x, y + small, lab, { size: small, color: COL.grey }); return textLines(sh, x + lw, y, v || NA, w - lw, { size: small, color: v ? COL.ink : COL.na }); };

  // head box (supply / meter / main switch)
  const chainBox = (title, lines, { earth = '' } = {}) => {
    const sh = []; const bx = devX - 6, bw = W - bx - 4; let y = 6;
    const tx = bx + 8, tw = bw - 16 - (earth ? F * 3 : 0);
    let hh = textLines(sh, tx, y + 4, title, tw, { bold: true });
    for (const l of lines) hh += textLines(sh, tx, y + 4 + hh, l.text, tw, { size: small, color: l.na ? COL.na : COL.grey });
    const h = hh + 12;
    R(sh, bx, y, bw, h, { fill: COL.fill });
    sh.unshift(sh.pop());
    if (earth) earthSym(sh, bx + bw - F * 1.6, y + 6, F);
    L(sh, busX, y + h / 2, bx, y + h / 2);
    return { sh, h: y + h, mid: y + h / 2 };
  };
  const earthSym = (sh, x, y, s) => { L(sh, x, y, x, y + s * 0.6); L(sh, x - s * 0.6, y + s * 0.6, x + s * 0.6, y + s * 0.6); L(sh, x - s * 0.4, y + s * 0.85, x + s * 0.4, y + s * 0.85); L(sh, x - s * 0.2, y + s * 1.1, x + s * 0.2, y + s * 1.1); };

  const head = [];
  if (model.type !== 'MW') {
    const e = model.supply.earthing;
    head.push(chainBox('Supply' + (e ? ': ' + e : ''), [...model.supply.lines.map((t) => ({ text: t })), { text: 'Supply fuse: ' + (model.supply.fuse || NA), na: !model.supply.fuse }, ...(e ? [] : [{ text: 'Earthing: ' + NA, na: true }])], { earth: e || ' ' }));
    head.push(chainBox('Meter', [{ text: 'kWh meter (supplier\u2019s)' }]));
    head.push(chainBox(model.main.label, [{ text: model.main.detail || NA, na: !model.main.detail }]));
  } else {
    const e = model.supply.earthing;
    head.push(chainBox('Earthing: ' + (e || NA), model.supply.lines.map((t) => ({ text: t })), { earth: ' ' }));
  }
  head.forEach((b, i) => { // bus runs down through the chain
    // same weight and colour as the board bus, so the chain reads as one line
    L(b.sh, busX, i > 0 ? 0 : b.mid, busX, b.h, { w: 2.4, color: COL.brand });
    blocks.push({ h: b.h, shapes: b.sh, kind: 'head' });
  });

  let links = {}; const used = new Set();
  model.boards.forEach((bd, bi) => {
    links = bd.links || {};
    // board header bar
    { const sh = []; const y = 8; const tx = devX; const title = bd.ref + (bd.location ? ' \u00b7 ' + bd.location : '');
      let hh = textLines(sh, tx, y + 3, title, W - tx - 8, { bold: true, color: COL.brand });
      if (bd.from && bi > 0) hh += textLines(sh, tx, y + 3 + hh, 'Supplied from: ' + bd.from, W - tx - 8, { size: small, color: COL.grey });
      if (bd.note) hh += textLines(sh, tx, y + 3 + hh, bd.note, W - tx - 8, { size: small, color: COL.grey });
      const h = y + hh + 10;
      L(sh, busX, 0, busX, h, { w: 2.4, color: COL.brand }); L(sh, devX - 6, y - 2, devX - 6, y + hh + 6, { w: 3, color: COL.brand });
      if (bi > 0) sh.push({ t: 'rect', x: 0, y: 0, w: W, h: 2, lw: 0, color: [255, 255, 255], fill: [225, 228, 240] });
      blocks.push({ h, shapes: sh, kind: 'board' }); }
    const items = bd.items;
    if (!items.length) { const sh = []; const h = textLines(sh, devX, 4, 'No circuits yet.', W - devX - 8, { color: COL.na }) + 10; blocks.push({ h, shapes: sh, kind: 'empty' }); }
    items.forEach((it, ii) => {
      const lastMain = items.slice(ii + 1).every((x) => x.kind === 'spares');
      if (it.kind === 'spares') {
        const sh = []; const y = 6; const tx = devX;
        const hh = textLines(sh, tx, y, it.text, W - tx - 8, { size: small, color: COL.grey });
        const h = y + hh + 8;
        blocks.push({ h, shapes: sh, kind: 'spares' });
      } else if (it.kind === 'circuit') blocks.push(tag(circuitBlock(it.c, busX, lastMain, null, it.spd, it.spur), bd, it.c));
      else {
        // RCD box on the main bus, its own bus below
        const sh = []; const y = 6; const subX = devX + 10; const bw = W - devX - 8;
        const hh = textLines(sh, devX + 8, y + 4, it.label, bw - 16, { bold: true });
        const h = hh + 12;
        R(sh, devX, y, bw, h, { fill: [255, 255, 255] }); sh.unshift(sh.pop());
        L(sh, busX, y + h / 2, devX, y + h / 2); L(sh, busX, 0, busX, lastMain ? y + h / 2 : y + h + 6, { w: 2.4, color: COL.brand });
        L(sh, subX, y + h, subX, y + h + 6);
        blocks.push({ h: y + h + 6, shapes: sh, kind: 'rcd' });
        it.circuits.forEach((c, ci) => blocks.push(tag(circuitBlock(c, subX, ci === it.circuits.length - 1, lastMain ? null : busX), bd, c)));
      }
    });
  });
  // key: only the symbols this diagram uses
  if (used.size) {
    const sh = []; const y = 10; const order = ['socket', 'socket1', 'light', 'rose', 'jb', 'jbsw', 'sw1', 'sw2', 'swi', 'strap', 'cooker', 'shower', 'alarm', 'immersion', 'ev', 'fan', 'fcu', 'appliance', 'point', 'contactor', 'spd'];
    let hh = textLines(sh, 8, y, 'Key', W - 16, { bold: true });
    const S = F * 1.5; const colW = (W - 16) / 2; let col = 0, rowY = y + hh + 4, rowH = 0;
    for (const k of order.filter((k) => used.has(k))) {
      const x = 8 + col * colW; const name = SWITCH_NAME[k] || KEY_EXTRA[k] || (k === 'contactor' ? 'Contactor (KM) / time clock (TC)' : k === 'spd' ? 'Surge protection (SPD)' : KIND_NAME[k]);
      if (k === 'contactor') { const kw = S * 1.5, kh = S, kx = x - S * 0.15, ky = rowY; R(sh, kx, ky, kw, kh, { fill: [255, 255, 255] }); const ccx = kx + kw * 0.3, cT = ky + kh * 0.22, cB = ky + kh * 0.78; L(sh, ccx, ky, ccx, cT); L(sh, ccx, cB, ccx, ky + kh); L(sh, ccx, cB, ccx - S * 0.3, cT + S * 0.05); T(sh, kx + kw * 0.7, ky + kh / 2 + small * 0.3, 'KM', { anchor: 'middle', bold: true, size: small * 0.8 }); }
      else if (k === 'spd') { spdSym(sh, x + S / 2, rowY - 2, F * 0.75); }
      else if (k === 'rose') { L(sh, x + S / 2 - S * 0.6, rowY + S / 2, x + S / 2 + S * 0.6, rowY + S / 2, { w: 0.9, color: COL.grey }); C(sh, x + S / 2, rowY + S / 2, S * 0.17, { fill: COL.line, lw: 0.8 }); }
      else if (k === 'jb') { R(sh, x - S * 0.2, rowY + S * 0.05, S * 1.4, S * 0.9, { fill: [255, 255, 255] }); T(sh, x + S * 0.5, rowY + S * 0.5 + small * 0.3, 'JB', { anchor: 'middle', bold: true, size: small * 0.85 }); }
      else if (k === 'jbsw') { const yy = rowY + S / 2; R(sh, x - S * 0.2, yy - S * 0.3, S * 0.7, S * 0.6, { fill: [255, 255, 255] }); L(sh, x + S * 0.5, yy, x + S * 0.75, yy, { w: 0.9, color: COL.grey }); symbol(sh, 'sw1', x + S * 1.05, yy, S * 0.7); }
      else if (k === 'strap') { L(sh, x - S * 0.1, rowY + S * 0.38, x + S * 1.1, rowY + S * 0.38, { w: 1, color: COL.brand }); L(sh, x - S * 0.1, rowY + S * 0.66, x + S * 1.1, rowY + S * 0.66, { w: 1, color: COL.brand }); }
      else symbol(sh, k, x + S / 2, rowY + S / 2, S);
      const th = textLines(sh, x + S + 8, rowY + S / 2 - small * 0.95, name, colW - S - 14, { size: small });
      rowH = Math.max(rowH, S, th + (S / 2 - small * 0.95) ); col++;
      if (col === 2) { col = 0; rowY += rowH + 8; rowH = 0; }
    }
    const h = rowY + (col ? rowH + 8 : 0) + 4;
    sh.unshift({ t: 'rect', x: 0, y: 2, w: W, h: 1, lw: 0, color: [255, 255, 255], fill: [225, 228, 240] });
    blocks.push({ h, shapes: sh, kind: 'legend' });
  }
  return { W, blocks, height: blocks.reduce((a, b) => a + b.h, 0) };

  // which board and circuit a block draws, so the screen can link to its edit screen
  function tag(b, bd, c) { b.ref = { bi: bd.bi ?? 0, ci: bd.src ? bd.src.indexOf(c) : 0, mw: model.type === 'MW' }; return b; }

  function circuitBlock(c, bus, last, outerBus, spd = '', spur = null) {
    const sh = []; const info = circuitLines(c, spd); const y = 8;
    const dx = bus + 12; const tx = dx + devW + gap; const tw = W - tx - 6;
    // text
    let hh = textLines(sh, tx, y - 2, info.title, tw, { bold: true, color: info.spare ? COL.na : COL.ink });
    for (const [lab, v] of info.rows) hh += kv(sh, tx, y - 2 + hh, lab, v, tw);
    // contactor (or time clock) between the breaker and the load
    const fx0 = tx - gap / 2; let feedTop = y + F * 0.6; let kh0 = 0;
    const ctl = info.spare ? null : controlInfo(c);
    if (ctl) { used.add('contactor');
      const kw = F * 2.6, kh = F * 1.9, ky = y + hh + 6, kx = tx;
      R(sh, kx, ky, kw, kh, { fill: [255, 255, 255] });
      // normally-open contact: two stubs and a slanted blade
      const cx = kx + kw * 0.32, cyT = ky + kh * 0.22, cyB = ky + kh * 0.78;
      L(sh, cx, ky, cx, cyT); L(sh, cx, cyB, cx, ky + kh); L(sh, cx, cyB, cx - F * 0.45, cyT + F * 0.1);
      T(sh, kx + kw * 0.7, ky + kh / 2 + F * 0.35, ctl.tag, { anchor: 'middle', bold: true, size: small });
      L(sh, fx0, y + F * 0.6, fx0, ky + kh / 2, { w: 0.9, color: COL.grey }); L(sh, fx0, ky + kh / 2, kx, ky + kh / 2, { w: 0.9, color: COL.grey });
      const nx = kx + kw + 6, nw = W - nx - 6;
      let nh = textLines(sh, nx, ky - 2, ctl.note, nw, { size: small, bold: true });
      const coil = ctl.from ? 'Coil switched by circuit ' + ctl.from : 'Coil supply: ' + NA;
      const cy0 = ky + nh + small * 0.55;
      L(sh, kx + kw, cy0, nx + F * 1.4, cy0, { w: 1.1, color: COL.brand, dash: [3, 2] });
      nh += textLines(sh, nx + F * 1.6, ky - 2 + nh, coil, nw - F * 1.6, { size: small, color: ctl.from ? COL.brand : COL.na });
      kh0 = Math.max(kh, nh) + 6;
      // out of the contactor, down to the load
      const out = ky + Math.max(kh, nh) + 4;
      L(sh, kx + kw * 0.32, ky + kh, kx + kw * 0.32, out, { w: 0.9, color: COL.grey }); L(sh, fx0, out, kx + kw * 0.32, out, { w: 0.9, color: COL.grey });
      feedTop = out; hh += kh0;
    }
    // this circuit feeds the coil of contactors on other circuits
    const sw = !info.spare && links[val(c.num)];
    if (sw) {
      const lab = 'Switches contactor on circuit' + (sw.length > 1 ? 's ' : ' ') + sw.join(', ');
      const ly = y - 2 + hh + 2; const lh0 = textLines(sh, tx + F * 1.6, ly, lab, tw - F * 1.6, { size: small, bold: true, color: COL.brand });
      L(sh, tx, ly + small * 0.7, tx + F * 1.4, ly + small * 0.7, { w: 1.1, color: COL.brand, dash: [3, 2] });
      hh += lh0 + 4;
    }
    // points
    const pc = pointCount(c); const kind = pointKind(c);
    const sgl = Math.min(socketSingles(c), pc.shown); const kindAt = (i) => (kind === 'socket' && i >= pc.shown - sgl ? 'socket1' : kind);
    let ph = 0;
    if (!info.spare && !info.spd && info.rooms) {
      ph = roomsSection(sh, info, tx, y + hh + 6, tw, feedTop, c);
    } else if (!info.spare && !info.spd && pc.shown) {
      const S = F * 1.5, step = S + 6; const per = Math.max(1, Math.floor((tw - 4) / step));
      const rows = Math.ceil(pc.shown / per); const py = y + hh + 6;
      for (let r = 0; r < rows; r++) {
        const n = Math.min(per, pc.shown - r * per); const cy = py + r * (S + 10) + S / 2;
        L(sh, tx - gap / 2, cy, tx + (n - 1) * step + S / 2, cy, { w: 0.9, color: COL.grey });
        if (r === 0) L(sh, tx - gap / 2, feedTop, tx - gap / 2, cy, { w: 0.9, color: COL.grey }); else L(sh, tx - gap / 2, cy - (S + 10), tx - gap / 2, cy, { w: 0.9, color: COL.grey });
        for (let i = 0; i < n; i++) { const k1 = kindAt(r * per + i); symbol(sh, k1, tx + i * step + S / 2, cy, S); used.add(k1); }
      }
      if (kind !== 'socket') used.add(kind);
      ph = 6 + rows * (S + 10) - 10;
      if (pc.more) { ph += textLines(sh, tx, py + ph, `+ ${pc.more} more (${pc.n} in total)`, tw, { size: small, color: COL.grey }) + 2; }
      // light switches: their own row under the lights, on the same feed
      const si = switchInfo(c);
      if (si && si.list.length) {
        const sy = py + ph + 8; const cy = sy + S / 2; const n = Math.min(si.list.length, per); const rws = Math.ceil(si.list.length / per);
        for (let r = 0; r < rws; r++) {
          const m = Math.min(per, si.list.length - r * per); const cyr = cy + r * (S + 10);
          L(sh, tx - gap / 2, r ? cyr - (S + 10) : py + (rows - 1) * (S + 10) + S / 2, tx - gap / 2, cyr, { w: 0.9, color: COL.grey, dash: [2, 2] });
          L(sh, tx - gap / 2, cyr, tx + (m - 1) * step + S / 2, cyr, { w: 0.9, color: COL.grey, dash: [2, 2] });
          for (let i = 0; i < m; i++) { const k0 = si.list[r * per + i]; symbol(sh, k0, tx + i * step + S / 2, cyr, S); used.add(k0); }
        }
        void n; ph += 8 + rws * (S + 10) - 10;
      }
    } else if (info.spd) { used.add('spd'); // SPD as the load: arrow to earth, its type label beside it
      const S = F * 1.5, py = y + hh + 6, cx = tx + S / 2, t = py, a = F * 0.9;
      L(sh, tx - gap / 2, y + F * 0.6, tx - gap / 2, t + F * 0.3, { w: 0.9, color: COL.grey }); L(sh, tx - gap / 2, t + F * 0.3, cx, t + F * 0.3, { w: 0.9, color: COL.grey });
      void a; const sh0 = spdSym(sh, cx, t, F);
      T(sh, cx + S, t + F * 1.1, info.spd, { bold: true, size: small });
      ph = sh0 + 6;
    }
    if (screen && !info.spare && !info.spd && info.noPoints && !info.rooms) ph += textLines(sh, tx, y + hh + 2, 'Add points served to draw sockets/lights', tw, { size: small, color: COL.na }) + 4;
    // minor works: new spur(s) branching off the ring, in bold brand colour
    if (spur && !info.spare && !info.spd) {
      const fx = tx - gap / 2, S = F * 1.5, step = S + 6;
      const top = y + hh + ph + 8;
      const lab = textLines(sh, tx, top, spur.label, tw, { bold: true, color: COL.brand });
      const per = Math.max(1, Math.floor((tw - 4) / step)); const rows = Math.ceil(spur.n / per);
      const sy = top + lab + 4; let lastCy = 0;
      for (let r = 0; r < rows; r++) {
        const n = Math.min(per, spur.n - r * per); const cy = sy + r * (S + 10) + S / 2; lastCy = cy;
        L(sh, fx, cy, tx + (n - 1) * step + S / 2, cy, { w: 2.2, color: COL.brand });
        used.add(spur.kind === 'appliance' ? 'fcu' : spur.kind);
        for (let i = 0; i < n; i++) { const k0 = sh.length; symbol(sh, spur.kind === 'appliance' ? 'fcu' : spur.kind, tx + i * step + S / 2, cy, S); for (let j = k0; j < sh.length; j++) { sh[j].color = COL.brand; if (sh[j].t === 'line') sh[j].w = 1.6; else sh[j].lw = 1.6; } }
      }
      L(sh, fx, pc.shown ? y + hh + 6 + S / 2 : feedTop, fx, lastCy, { w: 2.2, color: COL.brand });
      ph += 8 + lab + 4 + rows * (S + 10) - 10;
    }
    // device box
    const bh = F * 3.2; const by = y;
    R(sh, dx, by, devW, bh, { fill: info.spare ? [248, 248, 248] : [255, 255, 255] }); sh.unshift(sh.pop());
    if (info.spare) T(sh, dx + devW / 2, by + bh / 2 + F * 0.35, 'Spare', { anchor: 'middle', color: COL.na, size: small });
    else {
      const d1 = wrapText(info.devShort, devW - 6, F, true); const d2 = info.devKind ? wrapText(info.devKind, devW - 6, small * 0.92) : [];
      d1.forEach((l, i) => T(sh, dx + devW / 2, by + F * 1.15 + i * lh(F), l, { anchor: 'middle', bold: true, color: info.devShort === NA ? COL.na : COL.ink }));
      d2.forEach((l, i) => T(sh, dx + devW / 2, by + F * 1.15 + d1.length * lh(F) + i * lh(small * 0.92), l, { anchor: 'middle', size: small * 0.92, color: COL.grey }));
    }
    L(sh, dx + devW, by + F * 0.6, tx - gap / 2, by + F * 0.6);
    const h = Math.max(bh + 8, hh + ph + 6) + 10;
    // bus: from the top down to this branch, and on if more follow
    L(sh, bus, 0, bus, last ? by + bh / 2 : h, { w: 2.4, color: COL.brand });
    L(sh, bus, by + bh / 2, dx, by + bh / 2);
    if (outerBus != null) L(sh, outerBus, 0, outerBus, h, { w: 2.4, color: COL.brand });
    return { h, shapes: sh, kind: 'circuit' };
  }
  // Rooms: the feed runs room to room down the left; each room is a box with
  // its lights, switches and how they're wired. A clear schematic, not to scale.
  function roomsSection(sh, info, tx, top, tw, feedTop, c) {
    const S = F * 1.5, step = S + 8, fx = tx - gap / 2, G = { w: 0.9, color: COL.grey };
    const shared = info.rooms.some((r) => r.wiring === 'jb-switch');
    const bx = tx + (shared ? 16 : 6), bw = tw - (shared ? 16 : 6); let y0 = top; let lastFeedY = feedTop;
    if (screen && info.roomNote) y0 += textLines(sh, tx, y0 - 4, info.roomNote, tw, { size: small, color: COL.na }) + 4;
    // switch-fed rooms: ONE junction box for the circuit, a separate cable from it to each such room's switch
    let jbX = 0, jbLastY = 0;
    if (shared) { used.add('jb'); used.add('jbsw');
      const jw = S * 1.4, jh = S * 0.9, jy = y0 + 2; jbX = tx + 8;
      L(sh, fx, lastFeedY, fx, jy + jh / 2, { w: 1.2, color: COL.line }); L(sh, fx, jy + jh / 2, tx, jy + jh / 2, { w: 1.2, color: COL.line });
      R(sh, tx, jy, jw, jh, { fill: [255, 255, 255] }); T(sh, tx + jw / 2, jy + jh / 2 + small * 0.35, 'JB', { anchor: 'middle', bold: true, size: small * 0.85 });
      const nh = textLines(sh, tx + jw + 8, jy - 2, 'Junction box: a cable to the switch in each switch-fed room', tw - jw - 8, { size: small * 0.9, color: COL.grey });
      lastFeedY = jy + jh / 2; jbLastY = jy + jh; y0 = jy + Math.max(jh, nh) + 8; }
    info.rooms.forEach((r) => {
      const rs = []; const ix = bx + 8, iw = bw - 16;
      let ry = y0 + 4;
      const nm = r.name || 'Room ' + (r.i + 1);
      ry += textLines(rs, ix, ry, nm, iw, { bold: true, size: small });
      const how = ROOM_WIRING[r.wiring] || ROOM_WIRING['loop-in'];
      const sws = [r.sw1 && `${r.sw1} \u00d7 1-way`, r.sw2pairs && (r.sw2pairs === 1 ? '2-way' : `${r.sw2pairs} \u00d7 2-way`), r.swi && `${r.swi} \u00d7 intermediate`].filter(Boolean).join(' + ') || 'No switch';
      ry += textLines(rs, ix, ry, `${r.lights} light${r.lights === 1 ? '' : 's'} \u00b7 ${sws} \u00b7 ${how}`, iw, { size: small * 0.92, color: COL.grey });
      if (r.wiring === 'jb-switch') { const fy = jbSwitchRoom(rs, r, ix, iw, ry, S, G); const bh = fy.bottom - y0 + 6;
        R(sh, bx, y0, bw, bh, { fill: COL.fill, color: [150, 160, 190] }); sh.push(...rs);
        L(sh, jbX, jbLastY, jbX, fy.feedIn, { w: 1.2, color: COL.line }); L(sh, jbX, fy.feedIn, fy.swX, fy.feedIn, { w: 1.2, color: COL.line });
        jbLastY = fy.feedIn; y0 += bh + 8; return; }
      // wire row: JB (if any) then the lights hanging off it
      const jb = r.wiring === 'junction box';
      const jbW = S * 1.4; const lx0 = ix + (jb ? jbW + 10 : 10);
      const per = Math.max(1, Math.floor((ix + iw - lx0) / step));
      const wy = ry + 10; let feedIn = wy; let dropX = 0; let dropY = 0;
      if (jb) { used.add('jb'); R(rs, ix, wy - S * 0.45, jbW, S * 0.9, { fill: [255, 255, 255] }); T(rs, ix + jbW / 2, wy + small * 0.35, 'JB', { anchor: 'middle', bold: true, size: small * 0.85 }); dropX = ix + jbW / 2; dropY = wy + S * 0.45; }
      let bottom = wy + S * 0.45;
      if (r.lights) {
        used.add('light'); if (!jb) used.add('rose');
        const rows = Math.ceil(r.lights / per);
        for (let k = 0; k < rows; k++) {
          const n = Math.min(per, r.lights - k * per); const wyk = wy + k * (S * 2 + 6);
          const x1 = lx0 + S / 2, x2 = lx0 + (n - 1) * step + S / 2;
          if (jb) { // separate feeds from the JB to each light
            for (let i = 0; i < n; i++) { const lx = lx0 + i * step + S / 2; L(rs, ix + jbW, wy, lx, wy + S * 0.9 + k * (S * 2 + 6) - S * 0.45 - 1, G); }
          } else { // loop-in: rose to rose along the wire
            L(rs, k ? x1 : ix, wyk, x2, wyk, G);
            if (k) L(rs, lx0 + (per - 1) * step + S / 2, wyk - (S * 2 + 6), x1, wyk, G);
          }
          for (let i = 0; i < n; i++) {
            const lx = lx0 + i * step + S / 2;
            if (!jb) { L(rs, lx, wyk, lx, wyk + S * 0.45, G); C(rs, lx, wyk, S * 0.17, { fill: COL.line, lw: 0.8 }); }
            symbol(rs, 'light', lx, wyk + S * 0.9, S);
          }
          bottom = wyk + S * 0.9 + S / 2;
        }
        if (!jb) { dropX = lx0 + S / 2; dropY = wy; }
      } else { bottom = Math.max(bottom, wy + small) ; textLines(rs, lx0, wy - small * 0.9, 'No lights set', iw - (lx0 - ix), { size: small, color: COL.na }); if (!jb) { dropX = ix + 4; dropY = wy; } }
      // switches: drop from the first rose (or the JB) to the switch row
      const list = [...Array(r.sw1).fill('sw1')]; const groups = [];
      for (let i = 0; i < r.sw2pairs; i++) groups.push(['sw2', ...Array(i === 0 ? r.swi : 0).fill('swi'), 'sw2']);
      const nSw = list.length + groups.reduce((a, g) => a + g.length, 0);
      if (nSw) {
        const sy = bottom + 14 + S / 2; const sstep = S + 14; let sx = ix + 10 + S / 2;
        const positions = [];
        for (const k0 of list) { positions.push([k0, sx]); sx += sstep; }
        for (const g of groups) { g.forEach((k0) => { positions.push([k0, sx]); sx += sstep; }); }
        // wrap if wider than the box
        const maxX = ix + iw - S / 2; let rowY = sy; let firstRow = true; const placed = [];
        let shift = 0;
        for (const [k0, x] of positions) { let px = x - shift; if (px > maxX) { shift = x - (ix + 10 + S / 2); px = x - shift; rowY += S + 16; firstRow = false; } placed.push([k0, px, rowY]); }
        void firstRow;
        // switch drop (dashed: switch line)
        const first = placed[0];
        const dx0 = jb ? dropX : ix + 3; if (!jb) L(rs, dropX, dropY, dx0, dropY + S * 0.35, { ...G, dash: [2, 2] });
        L(rs, dx0, jb ? dropY : dropY + S * 0.35, dx0, first[2] - S * 0.8, { ...G, dash: [2, 2] }); L(rs, dx0, first[2] - S * 0.8, first[1], first[2] - S * 0.8, { ...G, dash: [2, 2] }); L(rs, first[1], first[2] - S * 0.8, first[1], first[2] - S * 0.4, { ...G, dash: [2, 2] });
        // 1-way switches all on the same switch drop
        let prev = null;
        placed.forEach(([k0, px, py], idx) => {
          if (k0 === 'sw1' && prev && prev[0] === 'sw1') L(rs, prev[1], py - S * 0.8, px, py - S * 0.8, { ...G, dash: [2, 2] });
          if (k0 === 'sw1' && idx > 0) L(rs, px, py - S * 0.8, px, py - S * 0.4, { ...G, dash: [2, 2] });
          prev = [k0, px, py];
        });
        // 2-way: strappers (two lines) between the pair, through any intermediates
        let gi = list.length;
        for (const g of groups) {
          const seg = placed.slice(gi, gi + g.length); gi += g.length;
          if (list.length && seg[0] === placed[list.length]) L(rs, placed[list.length - 1][1], seg[0][2] - S * 0.8, seg[0][1], seg[0][2] - S * 0.8, { ...G, dash: [2, 2] });
          if (list.length || seg !== placed.slice(0, g.length)) L(rs, seg[0][1], seg[0][2] - S * 0.8, seg[0][1], seg[0][2] - S * 0.4, { ...G, dash: [2, 2] });
          used.add('strap');
          for (let j = 1; j < seg.length; j++) {
            const a = seg[j - 1], b = seg[j];
            if (a[2] === b[2]) { L(rs, a[1] + S * 0.45, a[2] - S * 0.08, b[1] - S * 0.45, b[2] - S * 0.08, { w: 1, color: COL.brand }); L(rs, a[1] + S * 0.45, a[2] + S * 0.2, b[1] - S * 0.45, b[2] + S * 0.2, { w: 1, color: COL.brand }); }
            else { // pair wrapped onto a new row: strappers go down and round
              const ex = ix + iw - 2; L(rs, a[1] + S * 0.45, a[2] - S * 0.08, ex, a[2] - S * 0.08, { w: 1, color: COL.brand }); L(rs, a[1] + S * 0.45, a[2] + S * 0.2, ex - 4, a[2] + S * 0.2, { w: 1, color: COL.brand });
              L(rs, ex, a[2] - S * 0.08, ex, b[2] - S * 0.08, { w: 1, color: COL.brand }); L(rs, ex - 4, a[2] + S * 0.2, ex - 4, b[2] + S * 0.2, { w: 1, color: COL.brand });
              L(rs, ex, b[2] - S * 0.08, b[1] + S * 0.45, b[2] - S * 0.08, { w: 1, color: COL.brand }); L(rs, ex - 4, b[2] + S * 0.2, b[1] + S * 0.45, b[2] + S * 0.2, { w: 1, color: COL.brand });
            }
          }
          // switched live back up to the lights from the far 2-way
          void 0;
        }
        for (const [k0, px, py] of placed) { symbol(rs, k0, px, py, S); used.add(k0); }
        bottom = placed[placed.length - 1][2] + S / 2 + 2;
        const lab = jb ? 'Switch drop from the JB' : 'Switch drop from the first ceiling rose';
        bottom += textLines(rs, ix, bottom + 2, lab + (groups.length ? '; blue lines are the 2-way strappers' : ''), iw, { size: small * 0.85, color: COL.grey }) + 2;
      }
      const bh = bottom - y0 + 6;
      R(sh, bx, y0, bw, bh, { fill: COL.fill, color: [150, 160, 190] });
      sh.push(...rs);
      // the circuit feed: down the left, then into this room
      L(sh, fx, lastFeedY, fx, feedIn, { w: 1.2, color: COL.line });
      L(sh, fx, feedIn, jb ? ix : ix, feedIn, { w: 1.2, color: COL.line });
      lastFeedY = feedIn;
      y0 += bh + 8;
    });
    return y0 - top + 2;
  }
  // Switch-fed room: circuit feed into a JB, a cable from the JB to the first
  // switch, then from that switch to the light(s), light to light.
  function jbSwitchRoom(rs, r, ix, iw, ry, S, G) {
    const jbW = 0, wy = ry + 10 + S * 0.2, sstep = S + 14;
    const list = [...Array(r.sw1).fill('sw1')]; for (let i = 0; i < r.sw2pairs; i++) list.push('sw2', ...Array(i === 0 ? r.swi : 0).fill('swi'), 'sw2');
    const x0 = ix + jbW + 10 + S / 2; const per = Math.max(1, Math.floor((ix + iw - x0 + S / 2) / sstep));
    const placed = list.map((k0, i) => [k0, x0 + (i % per) * sstep, wy + Math.floor(i / per) * (S + 16)]);
    let bottom = wy + S * 0.45;
    let srcX = ix + 10, srcY = wy; // where the cable to the lights starts
    if (placed.length) {
      const f = placed[0];
      // more 1-way switches share the same feed from the first
      placed.forEach(([k0, px, py], i) => { if (i && k0 === 'sw1' && placed[i - 1][0] === 'sw1' && py === placed[i - 1][2]) L(rs, placed[i - 1][1] + S * 0.45, py + S * 0.3, px - S * 0.45, py + S * 0.3, { ...G, dash: [2, 2] }); });
      // strappers between each 2-way pair (through intermediates)
      let i = r.sw1;
      for (let g = 0; g < r.sw2pairs; g++) { const len = 2 + (g === 0 ? r.swi : 0); const seg = placed.slice(i, i + len); i += len; used.add('strap');
        if (r.sw1 && g === 0) L(rs, placed[r.sw1 - 1][1] + S * 0.45, placed[r.sw1 - 1][2] + S * 0.3, seg[0][1] - S * 0.45, seg[0][2] + S * 0.3, { ...G, dash: [2, 2] });
        for (let j = 1; j < seg.length; j++) { const a = seg[j - 1], b = seg[j]; L(rs, a[1] + S * 0.45, a[2] - S * 0.08, b[1] - S * 0.45, b[2] - S * 0.08, { w: 1, color: COL.brand }); L(rs, a[1] + S * 0.45, a[2] + S * 0.2, b[1] - S * 0.45, b[2] + S * 0.2, { w: 1, color: COL.brand }); } }
      for (const [k0, px, py] of placed) { symbol(rs, k0, px, py, S); used.add(k0); }
      bottom = placed[placed.length - 1][2] + S / 2; srcX = f[1]; srcY = f[2] + S * 0.45;
    }
    if (r.lights) { used.add('light');
      const lx0 = x0, step = S + 8, lper = Math.max(1, Math.floor((ix + iw - lx0 + S / 2) / step));
      const rows = Math.ceil(r.lights / lper); const ly0 = bottom + S * 0.9;
      L(rs, srcX, srcY, srcX, ly0 - S * 0.4, G); // switch (or JB) down to the first light
      for (let k = 0; k < rows; k++) { const n = Math.min(lper, r.lights - k * lper); const ly = ly0 + k * (S + 10);
        L(rs, lx0, ly, lx0 + (n - 1) * step, ly, G); if (k) L(rs, lx0, ly - (S + 10), lx0, ly, G);
        for (let q = 0; q < n; q++) symbol(rs, 'light', lx0 + q * step, ly, S); }
      bottom = ly0 + (rows - 1) * (S + 10) + S / 2;
    } else bottom += textLines(rs, x0, bottom + 4, 'No lights set', iw - (x0 - ix), { size: small, color: COL.na }) + 4;
    bottom += textLines(rs, ix, bottom + 4, 'Cable from the circuit JB to the switch, switch to the lights' + (r.sw2pairs ? '; blue lines are the 2-way strappers' : ''), iw, { size: small * 0.85, color: COL.grey }) + 4;
    return { bottom, feedIn: wy, swX: placed.length ? placed[0][1] - S * 0.45 : srcX };
  }
  // Point symbols, after BS EN 60617 / usual UK drawing style.
  // Only lines, rects, circles and text, so SVG and jsPDF match exactly.
  function arc(sh, cx, cy, r, a0, a1, o = {}) { const n = 12; for (let i = 0; i < n; i++) { const p = a0 + (a1 - a0) * i / n, q = a0 + (a1 - a0) * (i + 1) / n; L(sh, cx + Math.cos(p) * r, cy + Math.sin(p) * r, cx + Math.cos(q) * r, cy + Math.sin(q) * r, { w: o.w || 1.1, color: o.color }); } }
  function box(sh, cx, cy, r) { R(sh, cx - r, cy - r, r * 2, r * 2, { lw: 1, fill: [255, 255, 255] }); }
  function swLever(sh, ax, ay, dx, dy, r) { // lever from the switch circle with a short end tick
    const ex = ax + dx * r, ey = ay + dy * r; L(sh, ax + dx * r * 0.24, ay + dy * r * 0.24, ex, ey, { w: 1.2 }); L(sh, ex, ey, ex + dy * r * 0.3, ey - dx * r * 0.3, { w: 1.2 }); }
  function symbol(sh, kind, cx, cy, S) {
    const r = S / 2; const W0 = [255, 255, 255];
    if (kind === 'light') { // outlet for lighting: circle with a cross
      C(sh, cx, cy, r * 0.8, { fill: W0 }); const d = r * 0.8 * 0.707; L(sh, cx - d, cy - d, cx + d, cy + d, { w: 1 }); L(sh, cx - d, cy + d, cx + d, cy - d, { w: 1 }); }
    else if (kind === 'socket' || kind === 'socket1') { // socket outlet: semicircle on a bar; twin (the default) gets a second bar
      const by = cy + r * 0.3; C(sh, cx, by, r * 0.85, { fill: W0, lw: 0 }); sh[sh.length - 1].color = W0;
      arc(sh, cx, by, r * 0.85, Math.PI, 2 * Math.PI, { w: 1.2 });
      L(sh, cx - r * 0.95, by, cx + r * 0.95, by, { w: 1.4 });
      if (kind === 'socket') L(sh, cx - r * 0.95, by + r * 0.22, cx + r * 0.95, by + r * 0.22, { w: 1.4 });
    }
    else if (kind === 'cooker') { // cooker: box with four hob rings
      box(sh, cx, cy, r); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C(sh, cx + a * r * 0.45, cy + b * r * 0.45, r * 0.25, { lw: 0.8 }); }
    else if (kind === 'shower') { box(sh, cx, cy, r); L(sh, cx - r * 0.6, cy - r * 0.45, cx + r * 0.6, cy - r * 0.45, { w: 1.3 }); for (const a of [-0.45, 0, 0.45]) L(sh, cx + a * r, cy - r * 0.15, cx + a * r, cy + r * 0.6, { w: 0.8 }); }
    else if (kind === 'alarm') { // fire/smoke detector: box with the detector triangle
      box(sh, cx, cy, r); L(sh, cx - r * 0.6, cy - r * 0.45, cx + r * 0.6, cy - r * 0.45, { w: 1.1 }); L(sh, cx - r * 0.6, cy - r * 0.45, cx, cy + r * 0.6, { w: 1.1 }); L(sh, cx + r * 0.6, cy - r * 0.45, cx, cy + r * 0.6, { w: 1.1 }); }
    else if (kind === 'immersion') { // heating element: box with three diagonal element lines
      box(sh, cx, cy, r); for (const a of [-0.5, 0, 0.5]) L(sh, cx + (a - 0.3) * r, cy + r * 0.6, cx + (a + 0.3) * r, cy - r * 0.6, { w: 1 }); }
    else if (kind === 'ev') { box(sh, cx, cy, r); T(sh, cx, cy + r * 0.32, 'EV', { anchor: 'middle', bold: true, size: r * 0.9 }); }
    else if (kind === 'fan') { C(sh, cx, cy, r * 0.85, { fill: W0 }); for (const a of [0, 2.094, 4.189]) L(sh, cx, cy, cx + Math.cos(a) * r * 0.65, cy + Math.sin(a) * r * 0.65, { w: 1.4 }); C(sh, cx, cy, r * 0.15, { fill: COL.line }); }
    else if (kind === 'fcu') { // fused connection unit: box with the fuse symbol (small rectangle, line through)
      box(sh, cx, cy, r); R(sh, cx - r * 0.55, cy - r * 0.22, r * 1.1, r * 0.44, { lw: 0.9, fill: W0 }); L(sh, cx - r * 0.85, cy, cx + r * 0.85, cy, { w: 0.9 }); }
    else if (kind === 'sw1' || kind === 'sw2' || kind === 'swi') { // switch: small open circle with lever(s)
      const ax = cx - r * 0.1, ay = cy + r * 0.25; const s2 = 0.707;
      swLever(sh, ax, ay, s2, -s2, r * 0.85);
      if (kind !== 'sw1') swLever(sh, ax, ay, -s2, s2, r * 0.85);
      if (kind === 'swi') { swLever(sh, ax, ay, -s2, -s2, r * 0.85); swLever(sh, ax, ay, s2, s2, r * 0.85); }
      C(sh, ax, ay, r * 0.2, { lw: 1.1 }); }
    else if (kind === 'appliance') { box(sh, cx, cy, r); L(sh, cx - r, cy + r, cx + r, cy - r, { w: 1 }); }
    else { C(sh, cx, cy, r * 0.7, { fill: W0 }); C(sh, cx, cy, r * 0.18, { fill: COL.line }); }
  }
  // Surge protective device: line down into a box with an arrow, then earth.
  function spdSym(sh, cx, top, F0) {
    const bw = F0 * 0.8, bh = F0 * 1.0, by = top + F0 * 0.3;
    L(sh, cx, top, cx, by); R(sh, cx - bw / 2, by, bw, bh, { lw: 1.1, fill: [255, 255, 255] });
    L(sh, cx, by + bh * 0.15, cx, by + bh * 0.85, { w: 1 }); L(sh, cx - bw * 0.25, by + bh * 0.55, cx, by + bh * 0.85, { w: 1 }); L(sh, cx + bw * 0.25, by + bh * 0.55, cx, by + bh * 0.85, { w: 1 });
    L(sh, cx, by + bh, cx, by + bh + F0 * 0.2); earthSym(sh, cx, by + bh + F0 * 0.2, F0 * 0.6);
    return F0 * 0.3 + bh + F0 * 0.2 + F0 * 0.6 * 1.1;
  }
}

// ---------- SVG (screen) ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rgb = (c) => `rgb(${c.join(',')})`;
export function shapesSvg(shapes, dy = 0) {
  return shapes.map((s) => {
    if (s.t === 'line') return `<line x1="${s.x1}" y1="${s.y1 + dy}" x2="${s.x2}" y2="${s.y2 + dy}" stroke="${rgb(s.color)}" stroke-width="${s.w}" stroke-linecap="round"${s.dash ? ` stroke-dasharray="${s.dash.join(' ')}"` : ''}/>`;
    if (s.t === 'rect') return `<rect x="${s.x}" y="${s.y + dy}" width="${s.w}" height="${s.h}" rx="${s.lw ? 3 : 0}" fill="${s.fill ? rgb(s.fill) : 'none'}" stroke="${s.lw ? rgb(s.color) : 'none'}" stroke-width="${s.lw}"/>`;
    if (s.t === 'circle') return `<circle cx="${s.cx}" cy="${s.cy + dy}" r="${s.r}" fill="${s.fill ? rgb(s.fill) : 'none'}" stroke="${rgb(s.color)}" stroke-width="${s.lw}"/>`;
    return `<text x="${s.x}" y="${s.y + dy}" font-size="${s.size}" font-weight="${s.bold ? 700 : 400}" fill="${rgb(s.color)}" text-anchor="${s.anchor}">${esc(s.txt)}</text>`;
  }).join('');
}
export function diagramSvg(cert, opts = {}) {
  const L = layout(diagramModel(cert), opts); let y = 0; const parts = [];
  const href = opts.href || null;
  for (const b of L.blocks) {
    const g = shapesSvg(b.shapes, y);
    if (href && b.ref) { const u = href(b.ref); parts.push(`<a href="${esc(u)}" class="dgc" aria-label="Edit this circuit"><rect x="0" y="${y}" width="${L.W}" height="${b.h}" fill="transparent"/>${g}</a>`); }
    else parts.push(g);
    y += b.h;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.W} ${Math.ceil(y + 6)}" width="100%" font-family="Arimo, Arial, Helvetica, sans-serif" role="img" aria-label="Single-line wiring diagram">${parts.join('')}</svg>`;
}

// ---------- PDF ----------
// k: pdfkit Kit. Draws the layout block by block, starting a new page
// (via newPage) when a block won't fit. W units map to the content width.
export function drawDiagramPdf(k, cert, newPage) {
  const L = layout(diagramModel(cert), { W: 560, font: 11 });
  const s = k.cw / L.W; const pt = s / 0.3528; const d = k.doc;
  for (const b of L.blocks) {
    if (k.y + b.h * s > k.H - 16) newPage();
    const ox = k.x0, oy = k.y;
    for (const z of b.shapes) {
      if (z.t === 'line') k.line(ox + z.x1 * s, oy + z.y1 * s, ox + z.x2 * s, oy + z.y2 * s, { w: z.w * s, color: z.color, dash: z.dash ? z.dash.map((v) => v * s) : null });
      else if (z.t === 'rect') { if (!z.lw) { d.setFillColor(...z.fill); d.rect(ox + z.x * s, oy + z.y * s, z.w * s, z.h * s, 'F'); } else k.rect(ox + z.x * s, oy + z.y * s, z.w * s, z.h * s, { lw: z.lw * s, color: z.color, fill: z.fill }); }
      else if (z.t === 'circle') { d.setDrawColor(...z.color); d.setLineWidth(z.lw * s); if (z.fill) { d.setFillColor(...z.fill); d.circle(ox + z.cx * s, oy + z.cy * s, z.r * s, 'FD'); } else d.circle(ox + z.cx * s, oy + z.cy * s, z.r * s, 'S'); }
      else { k.font(z.size * pt, z.bold, z.color); d.text(String(z.txt), ox + z.x * s, oy + z.y * s, { align: z.anchor === 'middle' ? 'center' : 'left', baseline: 'alphabetic' }); }
    }
    k.y += b.h * s;
  }
}
// On by default; cert.diagramPdf === false leaves it out of the PDF.
export const diagramInPdf = (cert) => Boolean(cert) && cert.diagramPdf !== false && diagramHasCircuits(cert);
export const diagramHasCircuits = (cert) => (cert && cert.type === 'MW' ? Boolean(cert.mw && cert.mw.circuit && (cert.mw.circuit.desc || cert.mw.circuit.rating)) : (cert && cert.boards || []).some((b) => (b.circuits || []).length));
