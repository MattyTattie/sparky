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
  if (/immersion|boiler|heater|heating|ev\b|charger|fan|extract|alarm|smoke|heat det|pump|inverter|garage|sub-?main|towel|spur|fcu|fused/.test(d)) return 'appliance';
  return 'point';
}
export const KIND_NAME = { socket: 'Socket', light: 'Light', cooker: 'Cooker', shower: 'Shower', appliance: 'Fixed appliance', point: 'Point' };
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
    boards: (cert.boards || []).map((b) => ({ ref: val(b.ref) || 'DB', location: val(b.location), from: val(b.suppliedFrom), items: groupCircuits(b.circuits, b), links: controlLinks(b.circuits) })),
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
  if (spd) return { title: `${val(c.num) || '?'}  ${val(c.desc) || 'SPD'}`, spare: false, spd, devShort: dev || NA, devKind: kind, rows: [['Breaker', device], ['Cable', cable], ['Load', spd]] };
  return { title: `${val(c.num) || '?'}  ${val(c.desc) || 'No description'}`, spare: false, devShort: dev || NA, devKind: kind,
    rows: [['Breaker', device], ['Cable', cable], ['Points', pc.known ? `${pc.n} \u00d7 ${KIND_NAME[pointKind(c)].toLowerCase()}${pc.n === 1 ? '' : 's'}` : '']] };
}

export function layout(model, { W = 380, font = 12 } = {}) {
  const F = font, small = F * 0.86, lh = (s) => s * 1.3;
  const blocks = [];
  const busX = 14, devX = busX + 14, devW = F * 4.6, gap = 8;
  const T = (sh, x, y, txt, o = {}) => sh.push({ t: 'text', x, y, txt, size: o.size || F, bold: !!o.bold, color: o.color || COL.ink, anchor: o.anchor || 'start' });
  const L = (sh, x1, y1, x2, y2, o = {}) => sh.push({ t: 'line', x1, y1, x2, y2, w: o.w || 1.2, color: o.color || COL.line, ...(o.dash ? { dash: o.dash } : {}) });
  const R = (sh, x, y, w, h, o = {}) => sh.push({ t: 'rect', x, y, w, h, lw: o.lw || 1.2, color: o.color || COL.line, fill: o.fill || null });
  const C = (sh, cx, cy, r, o = {}) => sh.push({ t: 'circle', cx, cy, r, lw: o.lw || 1.1, color: o.color || COL.line, fill: o.fill || null });
  const textLines = (sh, x, y, text, w, o = {}) => { const s = o.size || F; const ls = wrapText(text, w, s, o.bold); ls.forEach((l, i) => T(sh, x, y + s + i * lh(s), l, o)); return ls.length * lh(s); };
  // label + value; a missing value prints N/A in light grey
  const kv = (sh, x, y, label, v, w) => { const lab = label + ': '; const lw = textW(lab, small); T(sh, x, y + small, lab, { size: small, color: COL.grey }); return textLines(sh, x + lw, y, v || NA, w - lw, { size: small, color: v ? COL.ink : COL.na }); };

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

  let links = {};
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
      } else if (it.kind === 'circuit') blocks.push(circuitBlock(it.c, busX, lastMain, null, it.spd, it.spur));
      else {
        // RCD box on the main bus, its own bus below
        const sh = []; const y = 6; const subX = devX + 10; const bw = W - devX - 8;
        const hh = textLines(sh, devX + 8, y + 4, it.label, bw - 16, { bold: true });
        const h = hh + 12;
        R(sh, devX, y, bw, h, { fill: [255, 255, 255] }); sh.unshift(sh.pop());
        L(sh, busX, y + h / 2, devX, y + h / 2); L(sh, busX, 0, busX, lastMain ? y + h / 2 : y + h + 6, { w: 2.4, color: COL.brand });
        L(sh, subX, y + h, subX, y + h + 6);
        blocks.push({ h: y + h + 6, shapes: sh, kind: 'rcd' });
        it.circuits.forEach((c, ci) => blocks.push(circuitBlock(c, subX, ci === it.circuits.length - 1, lastMain ? null : busX)));
      }
    });
  });
  return { W, blocks, height: blocks.reduce((a, b) => a + b.h, 0) };

  function circuitBlock(c, bus, last, outerBus, spd = '', spur = null) {
    const sh = []; const info = circuitLines(c, spd); const y = 8;
    const dx = bus + 12; const tx = dx + devW + gap; const tw = W - tx - 6;
    // text
    let hh = textLines(sh, tx, y - 2, info.title, tw, { bold: true, color: info.spare ? COL.na : COL.ink });
    for (const [lab, v] of info.rows) hh += kv(sh, tx, y - 2 + hh, lab, v, tw);
    // contactor (or time clock) between the breaker and the load
    const fx0 = tx - gap / 2; let feedTop = y + F * 0.6; let kh0 = 0;
    const ctl = info.spare ? null : controlInfo(c);
    if (ctl) {
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
    let ph = 0;
    if (!info.spare && !info.spd && pc.shown) {
      const S = F * 1.5, step = S + 6; const per = Math.max(1, Math.floor((tw - 4) / step));
      const rows = Math.ceil(pc.shown / per); const py = y + hh + 6;
      for (let r = 0; r < rows; r++) {
        const n = Math.min(per, pc.shown - r * per); const cy = py + r * (S + 10) + S / 2;
        L(sh, tx - gap / 2, cy, tx + (n - 1) * step + S / 2, cy, { w: 0.9, color: COL.grey });
        if (r === 0) L(sh, tx - gap / 2, feedTop, tx - gap / 2, cy, { w: 0.9, color: COL.grey }); else L(sh, tx - gap / 2, cy - (S + 10), tx - gap / 2, cy, { w: 0.9, color: COL.grey });
        for (let i = 0; i < n; i++) symbol(sh, kind, tx + i * step + S / 2, cy, S);
      }
      ph = 6 + rows * (S + 10) - 10;
      if (pc.more) { ph += textLines(sh, tx, py + ph, `+ ${pc.more} more (${pc.n} in total)`, tw, { size: small, color: COL.grey }) + 2; }
    } else if (info.spd) { // SPD as the load: arrow to earth, its type label beside it
      const S = F * 1.5, py = y + hh + 6, cx = tx + S / 2, t = py, a = F * 0.9;
      L(sh, tx - gap / 2, y + F * 0.6, tx - gap / 2, t + F * 0.3, { w: 0.9, color: COL.grey }); L(sh, tx - gap / 2, t + F * 0.3, cx, t + F * 0.3, { w: 0.9, color: COL.grey });
      L(sh, cx, t, cx, t + a); L(sh, cx - F * 0.3, t + a - F * 0.35, cx, t + a); L(sh, cx + F * 0.3, t + a - F * 0.35, cx, t + a);
      earthSym(sh, cx, t + a, F * 0.7);
      T(sh, cx + S, t + F * 1.1, info.spd, { bold: true, size: small });
      ph = a + F * 1.3 + 6;
    }
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
        for (let i = 0; i < n; i++) { const k0 = sh.length; symbol(sh, spur.kind, tx + i * step + S / 2, cy, S); for (let j = k0; j < sh.length; j++) { sh[j].color = COL.brand; if (sh[j].t === 'line') sh[j].w = 1.6; else sh[j].lw = 1.6; } }
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
  function symbol(sh, kind, cx, cy, S) {
    const r = S / 2;
    if (kind === 'light') { C(sh, cx, cy, r * 0.8, { fill: [255, 255, 255] }); const d = r * 0.8 * 0.707; L(sh, cx - d, cy - d, cx + d, cy + d, { w: 1 }); L(sh, cx - d, cy + d, cx + d, cy - d, { w: 1 }); }
    else if (kind === 'socket') { R(sh, cx - r, cy - r * 0.75, S, r * 1.5, { lw: 1, fill: [255, 255, 255] }); L(sh, cx - r * 0.45, cy - r * 0.35, cx - r * 0.45, cy + r * 0.05, { w: 1.3 }); L(sh, cx + r * 0.45, cy - r * 0.35, cx + r * 0.45, cy + r * 0.05, { w: 1.3 }); L(sh, cx, cy + r * 0.15, cx, cy + r * 0.5, { w: 1.3 }); }
    else if (kind === 'cooker') { R(sh, cx - r, cy - r, S, S, { lw: 1, fill: [255, 255, 255] }); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C(sh, cx + a * r * 0.45, cy + b * r * 0.45, r * 0.25, { lw: 0.8 }); }
    else if (kind === 'shower') { R(sh, cx - r, cy - r, S, S, { lw: 1, fill: [255, 255, 255] }); L(sh, cx - r * 0.6, cy - r * 0.45, cx + r * 0.6, cy - r * 0.45, { w: 1.3 }); for (const a of [-0.45, 0, 0.45]) L(sh, cx + a * r, cy - r * 0.15, cx + a * r, cy + r * 0.6, { w: 0.8 }); }
    else if (kind === 'appliance') { R(sh, cx - r, cy - r, S, S, { lw: 1, fill: [255, 255, 255] }); L(sh, cx - r, cy + r, cx + r, cy - r, { w: 1 }); }
    else { C(sh, cx, cy, r * 0.7, { fill: [255, 255, 255] }); C(sh, cx, cy, r * 0.18, { fill: COL.line }); }
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
  for (const b of L.blocks) { parts.push(shapesSvg(b.shapes, y)); y += b.h; }
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
