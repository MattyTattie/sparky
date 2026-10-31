// =====================================================================
// wiring.js — v0.38 (prototype): automatic single-line wiring diagram.
// Drawn only from what the certificate already holds (supply, board,
// protective devices, circuits, number of points). No rooms.
// One layout (plain shapes) feeds two renderers: SVG for the screen and
// jsPDF lines/text for the PDF, so both always match.
// =====================================================================
import { isSpareCircuit } from './templates.js';
import { checkCircuit } from './checks.js';

const NA = 'N/A';
const isNAv = (v) => /^\s*n\s*[\/.]?\s*a\s*\.?\s*$/i.test(String(v ?? ''));
const val = (v) => { const s = String(v ?? '').trim(); return s && !isNAv(s) ? s : ''; };
export const COL = { ink: [20, 20, 20], grey: [110, 110, 110], na: [170, 170, 170], line: [60, 60, 60], brand: [41, 82, 255], fill: [244, 246, 252], red: [200, 30, 30], amber: [196, 120, 0] };
// v0.41 (pro): type of wiring code (schedule column 3) to a short name for the cable label.
export const WIRING_SHORT = { A: 'T&E', B: 'in metal conduit', C: 'in plastic conduit', D: 'in metal trunking', E: 'in plastic trunking', F: 'SWA (PVC)', G: 'SWA (XLPE)', H: 'MICC', O: '' };
// '2.5/1.5mm² T&E · B32' from the schedule (cable, type of wiring, OCPD). '' when there's no cable size.
export function cableLabel(c) {
  if (!c) return '';
  const live = val(c.live), cpc = val(c.cpc); const ty = WIRING_SHORT[String(val(c.wiring)).toUpperCase()] || '';
  const ocpd = [val(c.type) && val(c.type) !== 'adj' ? val(c.type) : '', val(c.rating)].join('');
  const size = live ? `${live}${cpc ? '/' + cpc : ''}mm\u00b2` : '';
  const a = [size, ty].filter(Boolean).join(' ');
  return size ? [a, ocpd].filter(Boolean).join(' \u00b7 ') : '';
}
// v0.41 (pro): which board/circuit a board is supplied from. Never guessed:
// blank or not matching a board on this certificate comes back as a problem.
const OUTBUILDING = /garage|shed|out ?building|garden|workshop|annexe?|cabin|barn|stable|summer ?house|studio|gym|office pod|pod\b/i;
// v0.43.3: how an extra board is supplied (optional board.supplyKind; old text still understood)
export const SUPPLY_KINDS = { tails: 'Meter tail connector block', switchfuse: 'Switch fuse / isolator', submain: 'Sub-main from another board' };
export function supplyKindOf(b) {
  const k = b && b.supplyKind; const t = val(b && b.suppliedFrom).toLowerCase();
  if (SUPPLY_KINDS[k] && !(k !== 'submain' && /(circuit|way|cct)\s*\d/.test(t))) return k; // typed a board + circuit later: that wins
  if (!t) return '';
  if (/henley|meter tail|connector block|\btails?\b/.test(t)) return 'tails';
  if (/switch ?fuse|fused switch|isolator|switch-?disconnector/.test(t)) return 'switchfuse';
  return '';
}
export function feedInfo(boards, bi) {
  const b = boards[bi] || {}; const from = val(b.suppliedFrom);
  if (bi === 0) return { state: 'origin', text: from };
  { const sk = supplyKindOf(b); if (sk === 'tails' || sk === 'switchfuse') return { state: 'origin', text: from || SUPPLY_KINDS[sk], kind: sk }; }
  if (!from) return { state: 'blank', text: '' };
  if (/^(origin|main|supply|meter|cut.?out|intake|incomer)\b/i.test(from)) return { state: 'origin', text: from };
  const m = from.match(/^(.*?)[\s,\-\u2013\u00b7/]*(?:(?:way|circuit|cct|ckt|c)\s*(?:no\.?)?\s*#?\s*(\d+[a-z]?))?\s*$/i);
  const ref = (m ? m[1] : from).trim(); const cn = m && m[2] ? m[2] : '';
  const si = boards.findIndex((x, i) => i !== bi && val(x.ref).toLowerCase() === ref.toLowerCase());
  if (si < 0) return { state: 'mismatch', text: from, why: `\u2018${from}\u2019 doesn\u2019t match a board on this certificate` };
  if (cn && !(boards[si].circuits || []).some((c) => val(c.num).toLowerCase() === cn.toLowerCase())) return { state: 'mismatch', text: from, why: `${val(boards[si].ref)} has no circuit ${cn}` };
  return { state: 'ok', text: from, bi: si, ref: val(boards[si].ref), circuit: cn };
}
export const isOutbuilding = (b) => OUTBUILDING.test(val(b && b.location));
// v0.41 (pro): red problems drawn on the diagram (Zs over max, low IR, slow RCD, polarity).
const RED_FIELDS = { zs: 'Zs', irLL: 'IR L-L', irLE: 'IR L-E', rcdMs: 'RCD time', pol: 'Polarity', rcdBtn: 'RCD button' };
export function diagramFlags(c, ctx = {}) {
  if (!c || isSpareCircuit(c)) return [];
  let r; try { r = checkCircuit(c, ctx); } catch { return []; }
  const out = [];
  for (const [f, name] of Object.entries(RED_FIELDS)) {
    const fl = r.flags[f]; if (!fl || fl.level !== 'red') continue;
    if (f === 'zs') out.push(`Zs ${val(c.zs)} \u03a9 over max ${r.maxZs} \u03a9`);
    else if (f === 'irLL' || f === 'irLE') out.push(`${name} ${val(c[f])} M\u03a9 too low`);
    else if (f === 'rcdMs') out.push(`RCD ${val(c.rcdMs)} ms too slow`);
    else out.push(`${name} failed`);
  }
  return out;
}

export const MAX_SYMBOLS = 10;
export const MAX_SOCKETS = 40;

// ---------- what kind of point a circuit feeds ----------
// v0.43.3: electric heaters / radiators / towel rails (drawing only; pointKind is unchanged)
export const isHeater = (c) => /towel|radiator|\brads?\b|heater|storage heat|panel heat|convector/.test(String((c && c.desc) || '').toLowerCase()) && !/immersion|water/.test(String((c && c.desc) || '').toLowerCase());
export function pointKind(c) {
  const d = String((c && c.desc) || '').toLowerCase();
  if (/socket|ring|s\/o|\bsoc|\bs(?:oc|c)?kts?\b|\bsckt/.test(d)) return 'socket';
  if (/light|lamp|ltg|lighting/.test(d)) return 'light';
  if (/cooker|oven|hob|range/.test(d)) return 'cooker';
  if (/shower/.test(d)) return 'shower';
  if (/intruder|burglar|security alarm|alarm panel|cctv|door ?bell|gate|motor|pump|inverter|battery|solar|\bpv\b|dish ?washer|washing|washer|dryer|fridge|freezer|boiler|underfloor|\bufh\b|air ?con|hot tub|sauna|garage door/.test(d) && !/\bfcu\b|fused|\bspur/.test(d)) return 'appliance'; /* v0.43.1: common fixed loads */
  if (/smoke|heat (alarm|det)|\balarms?\b|detector/.test(d)) return 'alarm';
  if (/immersion|hot water|\bhw\b|\bboost|cylinder/.test(d)) return 'immersion';
  if (/\bev\b|charger|car charg|charge ?point/.test(d)) return 'ev';
  if (/\bfan|extract/.test(d)) return 'fan';
  if (/\bfcu\b|fused|\bspur|towel|\bheaters?\b|radiator|\brads?\b/.test(d)) return 'fcu'; // v0.43: heaters, towel rails, spurs are fed from an FCU
  if (/boiler|heater|heating|ev\b|charger|fan|extract|alarm|smoke|heat det|pump|inverter|garage|sub-?main|towel|spur|fcu|fused/.test(d)) return 'appliance';
  return 'point';
}
export const KIND_NAME = { heater: 'Heater / radiator', socket: 'Socket', light: 'Light', cooker: 'Cooker', shower: 'Shower', alarm: 'Smoke / heat alarm', immersion: 'Immersion heater', ev: 'EV charger', fan: 'Fan', fcu: 'Fused spur (FCU)', appliance: 'Fixed appliance', point: 'Point' };
// Plural words for the "Points:" line.
const KIND_PLURAL = { heater: 'heaters', socket: 'sockets', light: 'lights', cooker: 'cookers', shower: 'showers', alarm: 'alarms', immersion: 'immersions', ev: 'EV chargers', fan: 'fans', fcu: 'FCUs', appliance: 'fixed appliances', point: 'points' };
const KIND_ONE = { heater: 'heater', socket: 'socket', light: 'light', cooker: 'cooker', shower: 'shower', alarm: 'alarm', immersion: 'immersion', ev: 'EV charger', fan: 'fan', fcu: 'FCU', appliance: 'fixed appliance', point: 'point' };
// Optional per-circuit diagram extras: circuit.diagram = { rooms, sw1, sw2, swi }.
// Old certs have none; a lighting circuit then gets one 1-way switch.
const KEY_EXTRA = { ipsock: 'Outdoor socket, weatherproof (IP rated)', fanh: 'Humidistat (%RH) switching a fan', fant: 'Fan timer / overrun (T)', fani: 'Fan isolator', heater: 'Heater / radiator', tailblock: 'Meter tail connector block', swfuse: 'Switch fuse / isolator (supplying a board)', jbsw: 'Switch-fed: JB to switch, looped switch to switch, each to its own lights', socket: 'Twin socket', socket1: 'Socket (single)', rose: 'Ceiling rose (loop-in)', jb: 'Junction box (JB)', strap: '2-way strappers (two wires)', iso: 'Local isolator: double pole switch-disconnector (// = 2 poles)', isofcu: 'Local isolator: fused connection unit (switched shows the blade)', isoccu: 'Cooker control unit: DP switch in a box, with its 13 A socket', dpu: 'DP switch in the ring, spurring an unswitched single socket (washer, dishwasher etc.)', dps: 'DP switch in the ring, spurring a switched single socket', socketsw: 'Switched socket (single)' };
// v0.43 (test): optional local isolator next to the load: circuit.diagram.isolator = { type, rating }.
export const ISOLATORS = { dp20: '20 A DP switch', dp45: '45 A DP switch (cooker / shower)', sfcu: 'Switched FCU', ufcu: 'Unswitched FCU', rotary: 'Rotary isolator', ccu: 'Cooker control unit (CCU)' };
const ISO_SHORT = { dp20: '20A DP', dp45: '45A DP', sfcu: 'SFCU', ufcu: 'FCU', rotary: 'Rotary isolator', ccu: '45A CCU' };
// v0.43.3: points recorded as an FCU / spur on a named load (towel rail, heater...): the FCU is the isolator, the load comes after it
const isTowel = (c) => /towel/i.test(String((c && c.desc) || ''));
export function impliedFcu(c) {
  if ((c && c.diagram && c.diagram.isolator && ISOLATORS[c.diagram.isolator.type]) || pointKind(c) !== 'fcu') return null;
  const d = String((c && c.desc) || '').toLowerCase(); const named = d.replace(/\b(s?fcu|fused|connection|unit|spurs?|switched|unswitched|13 ?a|outlet|flex)\b/g, '').replace(/[^a-z]/g, '');
  if (!named) return null; const sw = /\bsfcu\b|\bswitched\b/.test(d) && !/unswitched/.test(d);
  return { type: sw ? 'sfcu' : 'ufcu', rating: '', fcu: true, ccu: false, switched: sw, label: '13A ' + (sw ? 'SFCU' : 'FCU'), name: ISOLATORS[sw ? 'sfcu' : 'ufcu'], implied: true };
}
export const isoFor = (c) => isolatorOf(c) || impliedFcu(c);
export function loadKind(c, iso = isoFor(c)) { const k0 = pointKind(c);
  if (isHeater(c) && ['fcu', 'appliance', 'point'].includes(k0)) return 'heater';
  return iso && iso.fcu && (k0 === 'fcu' || k0 === 'point') ? 'appliance' : k0; }
export function isolatorOf(c) {
  const i = c && c.diagram && c.diagram.isolator; if (!i || !ISOLATORS[i.type]) return null;
  const rating = val(i.rating).trim(); const fcu = i.type === 'sfcu' || i.type === 'ufcu';
  const ccu = i.type === 'ccu';
  const label = ccu ? (rating ? rating.replace(/\s*CCU$/i, '') + ' CCU' : ISO_SHORT.ccu) : fcu ? (rating ? rating.replace(/\s+/g, '') : '13A') + ' ' + ISO_SHORT[i.type] : (rating ? (/dp/.test(i.type) ? rating + (/DP/i.test(rating) ? '' : ' DP') : rating + ' rotary') : ISO_SHORT[i.type]);
  return { type: i.type, rating, fcu, ccu, switched: i.type !== 'ufcu', label, name: ISOLATORS[i.type] };
}
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
export const roomsOf = (c) => { if (roomListOf(c)) return ''; const v = val(c && c.diagram && c.diagram.rooms); return /[a-z]/i.test(v) ? v : ''; }; /* v0.43.3: old certs stored a room COUNT here */
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
    const out = { i, name: val(r.name), lights: cnt(r.lights), sw1: cnt(r.sw1, 4), sw2pairs, swi, wiring: ROOM_WIRING[r.wiring] ? r.wiring : 'loop-in' };
    if (Array.isArray(r.split)) out.split = r.split; // v0.42: optional lights per switch
    out.fans = cnt(r.fans, 2); out.fanCtl = FAN_CTL[r.fanCtl] ? r.fanCtl : 'humidistat'; /* v0.43.1: optional extractor fan(s) in the room */
    return out;
  });
}
// v0.42 (test): a room's switch groups. Each 1-way switch is a group; each 2-way
// pair (the first with the room's intermediates) is a group. Lights are shared
// out evenly (3 lights, 2 switches -> 2 + 1) unless room.split (optional,
// lights per group) adds up to the room's lights.
export function switchGroups(r) {
  const g = [];
  for (let i = 0; i < (+r.sw1 || 0); i++) g.push({ sw: ['sw1'] });
  for (let p = 0; p < (+r.sw2pairs || 0); p++) g.push({ sw: ['sw2', ...Array(p === 0 ? (+r.swi || 0) : 0).fill('swi'), 'sw2'] });
  const L = +r.lights || 0;
  if (!g.length) return [{ sw: [], lights: L }];
  const sp = r.split;
  if (Array.isArray(sp) && sp.length === g.length && sp.every((n) => Number.isInteger(+n) && +n >= 0) && sp.reduce((a, n) => a + +n, 0) === L) g.forEach((x, i) => { x.lights = +sp[i]; });
  else { const base = Math.floor(L / g.length), extra = L % g.length; g.forEach((x, i) => { x.lights = base + (i < extra ? 1 : 0); }); }
  return g;
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
// v0.43.5: rooms on a socket circuit (ring or radial): the same circuit.diagram.roomList,
// each room { name, sockets (twin, default 2), spurs (optional 0-4), spurKind: 'socket' | 'fcu' }.
export function socketRoomsOf(c) {
  const l = c && c.diagram && c.diagram.roomList;
  if (!Array.isArray(l) || !l.length || pointKind(c) !== 'socket') return null;
  return arrangedOrder(c).map((i) => [l[i], i]).filter(([r]) => r).map(([r, i]) => ({ i, name: val(r.name), sockets: cnt(r.sockets), singles: cnt(r.singles, 10), spurs: cnt(r.spurs, 4), spurKind: r.spurKind === 'fcu' ? 'fcu' : 'socket', dpsw: cnt(r.dpsw, 4), dpsws: cnt(r.dpsws, 4) })); // v0.43.8: DP switches in the ring, each spurring a single socket: dpsw = unswitched socket, dpsws = switched socket
}
export const isRingC = (c) => /\bring\b/i.test(String((c && c.desc) || '')) || (!/radial/i.test(String((c && c.desc) || '')) && String(val(c && c.rating)) === '32' && String(val(c && c.live)) === '2.5');
export const roomSocketTotal = (c) => (socketRoomsOf(c) || []).reduce((a, r) => a + r.sockets + r.singles + r.spurs + r.dpsw + r.dpsws, 0);
export const roomLightTotal = (c) => (roomListOf(c) || []).reduce((a, r) => a + r.lights, 0);
// v0.43.1: optional room fan: room.fans (0-2), room.fanCtl (how it is switched)
export const FAN_CTL = { humidistat: 'Humidistat', timer: 'Timer (overrun)', switch: 'Light switch', isolator: 'Isolator only' };
export const roomFanTotal = (c) => (roomListOf(c) || []).reduce((a, r) => a + (r.fans || 0), 0);
const ptsWord = (t, f) => (f ? `${t} point${t === 1 ? '' : 's'} (${t - f} light${t - f === 1 ? '' : 's'} + ${f} fan${f === 1 ? '' : 's'})` : `${t} light${t === 1 ? '' : 's'}`);
// Screen-only note when the rooms' lights don't add up to Points served.
export const roomPointTotal = (c) => (socketRoomsOf(c) ? roomSocketTotal(c) : roomLightTotal(c) + roomFanTotal(c));
export function roomPointsNote(c) {
  if (socketRoomsOf(c)) { const t = roomSocketTotal(c), pc = pointCount(c), w = `${t} socket${t === 1 ? '' : 's'}`;
    if (!pc.known) return `Rooms add up to ${w}. Points served is not filled in.`;
    return t === pc.n ? '' : `Rooms add up to ${w}, but Points served says ${pc.n}.`; }
  const rl = roomListOf(c); if (!rl) return '';
  const f = roomFanTotal(c); const t = roomLightTotal(c) + f; const pc = pointCount(c);
  if (!pc.known) return `Rooms add up to ${ptsWord(t, f)}. Points served is not filled in.`;
  return t === pc.n ? '' : `Rooms add up to ${ptsWord(t, f)}, but Points served says ${pc.n}.`;
}
// How many symbols to draw: up to MAX_SYMBOLS, then "+ N more".
export function pointCount(c) {
  const n = parseInt(String((c && c.points) ?? '').trim(), 10);
  if (n === 0 && /^0+$/.test(String(c.points).trim())) return { n: 0, shown: 0, more: 0, known: true }; // v0.43.4: a typed 0 is a value, not blank
  if (!Number.isFinite(n) || n <= 0) return { n: 0, shown: 0, more: 0, known: false };
  const shown = Math.min(n, pointKind(c) === 'socket' ? MAX_SOCKETS : MAX_SYMBOLS); // v0.43.7: every socket is drawn (rows wrap); other loads cap at MAX_SYMBOLS
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
  const items = []; let grp = null; const spares = []; const byKey = new Map(); // v0.43.4: one heading per RCD on the board
  for (const c of circuits || []) {
    if (!c) continue;
    if (isSpareCircuit(c)) { spares.push(val(c.num) || '?'); continue; }
    if (isSpd(c)) { grp = null; items.push({ kind: 'circuit', c, spd: spdLabel(c, board) }); continue; }
    if (!isSpareCircuit(c) && !isRcbo(c) && hasRcd(c)) {
      const key = rcdKey(c);
      if (byKey.has(key)) { byKey.get(key).circuits.push(c); continue; }
      grp = { kind: 'rcd', key, label: rcdLabel(c), circuits: [c] }; byKey.set(key, grp); items.push(grp); continue;
    }
    grp = null; items.push({ kind: 'circuit', c });
  }
  // v0.43.4: circuits in way order inside each RCD; RCD groups and lone circuits ordered by their lowest way
  const wn = (c) => { const m = /\d+/.exec(String(val(c.num) ?? '')); return m ? +m[0] : Infinity; };
  const cmp = (a, b) => wn(a) - wn(b) || String(val(a.num)).localeCompare(String(val(b.num)), undefined, { numeric: true });
  for (const it of items) if (it.kind === 'rcd') it.circuits.sort(cmp);
  const first = (it) => (it.kind === 'rcd' ? it.circuits[0] : it.c);
  items.forEach((it, i) => { it._i = i; }); items.sort((a, b) => cmp(first(a), first(b)) || a._i - b._i); items.forEach((it) => delete it._i);
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
// v0.42: how a control circuit drives its contactors (for drawing a time clock / relay)
export function controlVias(circuits, num) {
  const o = { clock: false, relay: false };
  for (const c of circuits || []) { const ci = controlInfo(c); if (ci && ci.from === num) { if (/timeclock/.test(ci.via)) o.clock = true; if (/relay/.test(ci.via)) o.relay = true; } }
  return o;
}
// v0.42: contactor labels per board, in circuit order: { '7': 'KM1', '8': 'KM2' }
export function controlTags(circuits) {
  const m = {}; const n = { KM: 0, TC: 0 };
  for (const c of circuits || []) { const ci = controlInfo(c); if (ci) m[val(c.num) || '?'] = ci.tag + (++n[ci.tag]); }
  return m;
}
export function diagramModel(cert) {
  cert = cert || {}; const sup = cert.supply || {}; const parts = cert.parts || {};
  if (cert.type === 'MW') {
    const M = cert.mw || {};
    return { type: 'MW', supply: { earthing: val(M.earthing), lines: [val(M.zdb) && `Zdb ${val(M.zdb)} Ω`].filter(Boolean) }, main: null,
      boards: [{ ref: val(M.dbRef) || 'DB', location: val(M.dbLocation), from: '', ctx: { earthing: M.earthing, zdb: M.zdb }, items: groupCircuits(M.circuit ? [M.circuit] : [], null).map((it) => (it.kind === 'circuit' && spurInfo(M) ? { ...it, spur: spurInfo(M) } : it)), note: 'Only the circuit covered by this certificate is shown.' }] };
  }
  const ms = [val(parts.msCurrent) && val(parts.msCurrent) + ' A', val(parts.msPoles) && val(parts.msPoles) + '-pole', val(parts.msBs) && 'BS EN ' + val(parts.msBs).replace(/^BS\s*(EN)?\s*/i, '')].filter(Boolean).join(', ');
  // A new cert pre-fills the supply fuse standard (BS 88-3). On its own that's
  // just the default, so the fuse is only shown once a type or rating is in.
  const fuse = (val(sup.spType) || val(sup.spRating)) ? [val(sup.spBs), val(sup.spType), val(sup.spRating) && val(sup.spRating) + ' A'].filter(Boolean).join(' ') : '';
  return {
    type: cert.type,
    supply: { earthing: val(sup.earthing), lines: [[val(sup.conductors), val(sup.u) && val(sup.u) + ' V', val(sup.f) && val(sup.f) + ' Hz'].filter(Boolean).join(', '), [val(sup.ze) && `Ze ${val(sup.ze)} Ω`, val(sup.ipf) && `Ipf ${val(sup.ipf)} kA`].filter(Boolean).join(', '), ].filter(Boolean), fuse },
    main: { label: 'Main switch', detail: ms },
    boards: (cert.boards || []).map((b, bi) => ({ ref: val(b.ref) || 'DB', location: val(b.location), from: val(b.suppliedFrom), items: groupCircuits(b.circuits, b), links: controlLinks(b.circuits), tags: controlTags(b.circuits), bi, src: b.circuits || [],
      feed: feedInfo(cert.boards, bi), raw: { supplyKind: b.supplyKind, suppliedFrom: b.suppliedFrom }, outbuilding: bi > 0 && isOutbuilding(b), ctx: { earthing: sup.earthing, zdb: b.zdb },
      feeds: (cert.boards || []).reduce((m, o, oi) => { const f = oi !== bi && feedInfo(cert.boards, oi); if (f && f.state === 'ok' && f.bi === bi && f.circuit) (m[f.circuit.toLowerCase()] = m[f.circuit.toLowerCase()] || []).push(val(o.ref) + (val(o.location) ? ' (' + val(o.location) + ')' : '')); return m; }, {}) })),
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
  const cable = cableLabel(c);
  const pc = pointCount(c);
  // SPD way: a normal breaker in the box, the SPD drawn as its load
  // The breaker already shows in its box, so no "Breaker:" line. An RCBO's
  // RCD details would be lost, so they get their own "RCD:" line.
  const rcd = isRcbo(c) && (val(c.rcdIdn) || val(c.rcdType)) ? [val(c.rcdIdn) && val(c.rcdIdn) + ' mA', val(c.rcdType) && 'Type ' + val(c.rcdType)].filter(Boolean).join(' ') : '';
  const pre = rcd ? [['RCD', rcd]] : [];
  const rooms = roomsOf(c); const room = rooms ? ' \u00b7 ' + rooms : '';
  if (spd) return { title: `${val(c.num) || '?'}  ${val(c.desc) || 'SPD'}${room}`, spare: false, spd, device, devShort: dev || NA, devKind: kind, rows: [...pre, ['Cable', cable], ['Load', spd]] };
  const k = loadKind(c); const KO = k === 'heater' && isTowel(c) ? 'towel rail' : KIND_ONE[k], KP = k === 'heater' && isTowel(c) ? 'towel rails' : KIND_PLURAL[k]; const si = switchInfo(c);
  return { title: `${val(c.num) || '?'}  ${val(c.desc) || 'No description'}${room}`, spare: false, device, devShort: dev || NA, devKind: kind, noPoints: !pc.known,
    rooms: roomListOf(c), sockRooms: socketRoomsOf(c), roomNote: roomPointsNote(c),
    rows: [...pre, ['Cable', cable], ...((roomListOf(c) || socketRoomsOf(c)) ? [['Rooms', (roomListOf(c) || socketRoomsOf(c)).length + ((roomListOf(c) || socketRoomsOf(c)).length === 1 ? ' room' : ' rooms')]] : []), ['Points', pc.known ? (roomFanTotal(c) && pc.n === roomFanTotal(c) + roomLightTotal(c) ? `${pc.n - roomFanTotal(c)} \u00d7 ${pc.n - roomFanTotal(c) === 1 ? KO : KP} + ${roomFanTotal(c)} \u00d7 fan${roomFanTotal(c) === 1 ? '' : 's'}` : roomFanTotal(c) ? `${pc.n} \u00d7 point${pc.n === 1 ? '' : 's'}` : `${pc.n} \u00d7 ${pc.n === 1 ? KO : KP}`) : ''], ...(si ? [['Switches', si.text]] : [])] };
}

export function layout(model, { W = 380, font = 12, screen = false, cableTable = false, legend = true } = {}) {
  const F = font, small = F * 0.86, lh = (s) => s * 1.3;
  const blocks = []; const cables = []; let ctx = {}; let feeds = {}; let curBoard = '';
  // v0.41: C1, C2… one per cable run, listed in the PDF's cable table
  const cable = (from, to, type, key) => { const label = 'C' + (cables.length + 1); cables.push({ label, from, to, type: type || '' }); if (key) cableOf[key] = cables[cables.length - 1]; return label; }; const cableOf = {};
  const busX = 14, devX = busX + 14, devW = F * 4.6, gap = 8; let ringLegB = null;
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
  // v0.43.3: meter tail connector block: a small block on the tails with two terminals
  const tailBlockSym = (sh, cx, y, s) => { L(sh, cx, y - 4, cx, y, { w: 1.2, color: COL.line }); R(sh, cx - s * 0.75, y, s * 1.5, s * 0.9, { lw: 1.1, fill: [255, 255, 255] }); for (const a of [-0.35, 0.35]) C(sh, cx + a * s, y + s * 0.45, s * 0.16, { lw: 0.9 }); };
  let heatLab = 'Rad'; // v0.43.3: label over the heater symbol (Rail for a towel rail)
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

  const feedCable = (fd, bd) => { const dest = bd.ref + (bd.location ? ' (' + bd.location + ')' : ''); const got = fd.circuit && cableOf[fd.ref.toLowerCase() + '|' + String(fd.circuit).toLowerCase()]; if (got) { got.to += ', on to ' + dest; return got.label; }
    return cable(fd.ref + (fd.circuit ? ' circuit ' + fd.circuit : ''), dest, cableLabel(((model.boards[fd.bi] || {}).src || []).find((c) => val(c.num).toLowerCase() === String(fd.circuit).toLowerCase()))); };
  let links = {}; let tags = {}; let curSrc = []; const bdSrc = () => curSrc; const used = new Set();
  model.boards.forEach((bd, bi) => {
    links = bd.links || {}; tags = bd.tags || {}; ctx = bd.ctx || {}; feeds = bd.feeds || {}; curBoard = bd.ref; curSrc = bd.src || [];
    // board header: v0.43.3 every board starts the same way as the main chain: a boxed heading on the bus.
    // Extra boards first show where they are supplied from (connector block, switch fuse or sub-main link).
    { const sh = []; const bx = devX - 6, bw = W - bx - 4; const tx = bx + 8, tw = bw - 16; let y = 6;
      const title = bd.ref + (bd.location ? ' \u00b7 ' + bd.location : '') + (bd.outbuilding ? ' (outbuilding)' : '');
      const fd = bd.feed; const sk = bi > 0 ? supplyKindOf(bd.raw || {}) || (fd && fd.kind) || '' : '';
      const brk = bi > 0 && fd && (fd.state === 'blank' || fd.state === 'mismatch');
      const busSt = brk ? { w: 2.4, color: COL.amber, dash: [5, 4] } : { w: 2.4, color: COL.brand };
      let top = 0;
      if (bi > 0) { // the source row
        const ok = fd && (fd.state === 'ok' || fd.state === 'origin');
        const cl0 = fd && fd.state === 'ok' ? feedCable(fd, bd) : '';
        let lab; let symH = F * 1.4;
        if (sk === 'tails') { used.add('tailblock'); tailBlockSym(sh, busX, y + 2, F); lab = SUPPLY_KINDS.tails + (fd.text && !/henley|connector block/i.test(fd.text) ? ' (' + fd.text + ')' : ''); top = y + 2; }
        else if (sk === 'switchfuse') { used.add('swfuse'); isoSym(sh, busX, y, symH, true, true); lab = 'Switch fuse / isolator' + (fd.text && !/switch ?fuse|isolator/i.test(fd.text) ? ' (' + fd.text + ')' : ''); top = y; }
        else { lab = fd && fd.state === 'ok' ? `Sub-main from ${fd.ref}${fd.circuit ? ' circuit ' + fd.circuit : ''}${cl0 ? ' by cable ' + cl0 : ''} (see ${fd.ref}${fd.circuit ? ' circuit ' + fd.circuit : ''})` : fd && fd.state === 'origin' ? 'Supplied from: ' + fd.text : !fd || fd.state === 'blank' ? 'Supplied from: not recorded, so the link is drawn dashed' : `Supplied from: ${fd.why}, so the link is drawn dashed`;
          symH = small * 1.2; top = 0; }
        const lh1 = textLines(sh, tx, y - 1, lab, tw, { size: small, color: ok ? COL.grey : COL.amber, bold: !ok });
        y += Math.max(symH, lh1) + 6; }
      let hh = textLines(sh, tx, y + 4, title, tw, { bold: true });
      if (bd.note) hh += textLines(sh, tx, y + 4 + hh, bd.note, tw, { size: small, color: COL.grey });
      const bh = hh + 12; R(sh, bx, y, bw, bh, { fill: COL.fill }); sh.unshift(sh.pop());
      L(sh, busX, y + bh / 2, bx, y + bh / 2);
      const h = y + bh + 6;
      if (bi > 0 && (sk === 'tails' || sk === 'switchfuse')) L(sh, busX, sk === 'tails' ? top + F * 0.9 : top + F * 1.4, busX, h, busSt);
      else L(sh, busX, top, busX, h, busSt);
      if (bi > 0) sh.unshift({ t: 'rect', x: 0, y: 0, w: W, h: 2, lw: 0, color: [255, 255, 255], fill: [225, 228, 240] });
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
  heatLab = 'Rad';
  if (used.size) {
    const sh = []; const y = 10; const order = ['socket', 'socket1', 'ipsock', 'light', 'rose', 'jb', 'jbsw', 'sw1', 'sw2', 'swi', 'strap', 'cooker', 'shower', 'alarm', 'immersion', 'heater', 'ev', 'fan', 'fcu', 'appliance', 'point', 'contactor', 'coil', 'timeclock', 'iso', 'isofcu', 'isoccu', 'dpu', 'dps', 'tailblock', 'swfuse', 'fanh', 'fant', 'fani', 'spd'];
    let hh = textLines(sh, 8, y, 'Key', W - 16, { bold: true });
    const S = F * 1.5; const colW = (W - 16) / 2; let col = 0, rowY = y + hh + 4, rowH = 0;
    for (const k of order.filter((k) => used.has(k))) {
      const x = 8 + col * colW; const name = SWITCH_NAME[k] || KEY_EXTRA[k] || (k === 'contactor' ? 'Contactor contact (KM, normally open)' : k === 'coil' ? 'Contactor coil (A1/A2)' : k === 'timeclock' ? 'Time clock' : k === 'spd' ? 'Surge protection (SPD)' : KIND_NAME[k]);
      if (k === 'contactor') { const yy = rowY + S / 2; rotH(sh, x - S * 0.1, yy, (o) => nocSym(o, x - S * 0.1, yy, S * 1.2)); }
      else if (k === 'coil') { coilSym(sh, x + S * 0.2, rowY + S * 0.1, S * 0.8, S * 0.75); }
      else if (k === 'timeclock') { clockSym(sh, x + S / 2, rowY + S / 2, S * 0.42); }
      else if (k === 'iso') { const yy = rowY + S / 2; rotH(sh, x - S * 0.1, yy, (o) => isoSym(o, x - S * 0.1, yy, S * 1.2, false)); }
      else if (k === 'isoccu') { const yy = rowY + S / 2; rotH(sh, x - S * 0.1, yy, (o) => isoSym(o, x - S * 0.1, yy, S * 1.2, false, true, true)); ccuSock(sh, x - S * 0.1 + S * 0.6, yy + S * 0.36, S * 0.8); }
      else if (k === 'dpu' || k === 'dps') symbol(sh, k, x + S / 2, rowY + S * 1.05, S * 0.75);
      else if (k === 'ipsock') { symbol(sh, 'socket', x + S / 2, rowY + S * 0.3, S); T(sh, x + S * 0.95, rowY + S * 0.85, 'IP', { bold: true, size: small * 0.75, color: COL.brand }); }
      else if (k === 'tailblock') { tailBlockSym(sh, x + S * 0.5, rowY + S * 0.15, S * 0.8); }
      else if (k === 'swfuse') { isoSym(sh, x + S * 0.5, rowY - S * 0.1, S * 1.2, true, true); }
      else if (k === 'isofcu') { const yy = rowY + S / 2; rotH(sh, x - S * 0.1, yy, (o) => isoSym(o, x - S * 0.1, yy, S * 1.2, true, true)); }
      else if (k === 'fanh' || k === 'fant' || k === 'fani') { fanCtlSym(sh, x - S * 0.1, rowY + S / 2, S, k === 'fanh' ? '%RH' : k === 'fant' ? 'T' : 'ISO'); }
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
  // v0.41: what the colours mean. Small on screen (at the top); subtle in the PDF (after the key).
  if (legend) {
    const sh = []; const sz = screen ? small : small * 0.85; const y = 4; let x = 8; const cy = y + sz * 0.9;
    const item = (draw, text, color) => { draw(x, cy); x += F * 1.6; T(sh, x, y + sz * 1.2, text, { size: sz, color }); x += textW(text, sz) + F; };
    const rows = []; let lineY = 0;
    item((x0, yy) => R(sh, x0, yy - sz * 0.6, F * 1.2, sz * 1.2, { color: COL.red, lw: screen ? 2 : 2.8, fill: [255, 255, 255] }), screen ? 'Reading out of limits' : 'Reading out of limits (thick box)', screen ? COL.red : COL.grey);
    item((x0, yy) => L(sh, x0, yy, x0 + F * 1.2, yy, { w: 3, color: COL.amber }), 'Missing info', screen ? COL.amber : COL.grey);
    if (x + textW('Link not recorded', sz) + F * 2 > W) { lineY = sz * 1.8; x = 8; }
    const yy2 = cy + lineY; const x0 = x; L(sh, x0, yy2, x0 + F * 1.2, yy2, { w: 2, color: COL.amber, dash: [4, 2] }); T(sh, x0 + F * 1.6, y + lineY + sz * 1.2, 'Link not recorded', { size: sz, color: screen ? COL.amber : COL.grey });
    void rows;
    const blk = { h: y + lineY + sz * 1.9 + 4, shapes: sh, kind: 'flags' };
    if (screen) blocks.unshift(blk); else { const ki = blocks.findIndex((x) => x.kind === 'legend'); if (ki >= 0) blocks.splice(ki, 0, blk); else blocks.push(blk); }
  }
  // v0.41: cable list (PDF). Lengths aren't on the certificate, so none are shown.
  if (cableTable && cables.length) {
    const cols = [['Cable', 0.12], ['From', 0.28], ['To', 0.34], ['Type / size', 0.26]]; const x0 = 8, tw = W - 16;
    const rowBlock = (cells, bold, first) => { const sh = []; let x = x0; let hmax = 0; const pos = [];
      cells.forEach((t, i) => { const w = tw * cols[i][1]; pos.push(x); hmax = Math.max(hmax, textLines(sh, x + 3, 2, t || NA, w - 6, { size: small, bold: bold || i === 0, color: t ? (i === 0 && !bold ? COL.brand : COL.ink) : COL.na })); x += w; });
      const h = hmax + 7; if (first) sh.unshift({ t: 'rect', x: x0, y: 0, w: tw, h, lw: 0, color: [255, 255, 255], fill: COL.fill });
      L(sh, x0, h, x0 + tw, h, { w: 0.5, color: [200, 200, 210] }); return { h, shapes: sh, kind: 'cables' }; };
    const sh = []; const th = textLines(sh, 8, 10, 'Cable list', W - 16, { bold: true }) + textLines(sh, 8, 10 + lh(F), 'One label per cable run on the drawing. Lengths aren\u2019t recorded on the certificate.', W - 16, { size: small, color: COL.grey });
    sh.unshift({ t: 'rect', x: 0, y: 2, w: W, h: 1, lw: 0, color: [255, 255, 255], fill: [225, 228, 240] });
    blocks.push({ h: th + 16, shapes: sh, kind: 'cables' });
    blocks.push(rowBlock(cols.map((c) => c[0]), true, true));
    for (const c of cables) blocks.push(rowBlock([c.label, c.from, c.to, c.type], false, false));
  }
  return { W, blocks, cables, height: blocks.reduce((a, b) => a + b.h, 0) };

  // which board and circuit a block draws, so the screen can link to its edit screen
  function tag(b, bd, c) { b.ref = { bi: bd.bi ?? 0, ci: bd.src ? bd.src.indexOf(c) : 0, mw: model.type === 'MW' }; return b; }

  function circuitBlock(c, bus, last, outerBus, spd = '', spur = null) {
    const sh = []; const info = circuitLines(c, spd); const y = 8; ringLegB = null;
    const dx = bus + 12; const tx = dx + devW + gap; const tw = W - tx - 6;
    // text
    let hh = textLines(sh, tx, y - 2, info.title, tw, { bold: true, color: info.spare ? COL.na : COL.ink });
    const cl = !info.spare ? cable(curBoard + ' circuit ' + (val(c.num) || '?'), (val(c.desc) || 'circuit') + (roomsOf(c) ? ' (' + roomsOf(c) + ')' : ''), info.rows.find((r) => r[0] === 'Cable')?.[1] || '', curBoard.toLowerCase() + '|' + String(val(c.num)).toLowerCase()) : '';
    for (const [lab, v] of info.rows) hh += kv(sh, tx, y - 2 + hh, lab, lab === 'Cable' && v ? cl + '  ' + v : v, tw);
    const reds = info.spare ? [] : diagramFlags(c, ctx);
    if (reds.length) hh += textLines(sh, tx, y - 2 + hh, 'Check: ' + reds.join('; '), tw, { size: small, bold: true, color: COL.red });
    const fed = !info.spare && feeds[String(val(c.num)).toLowerCase()];
    if (!screen && !info.spare && !info.spd && info.noPoints && !info.rooms && !info.sockRooms && !spur && !fed) hh += textLines(sh, tx, y - 2 + hh, 'Points served not recorded', tw, { size: small, bold: screen, color: COL.amber });
    if (fed) hh += textLines(sh, tx, y - 2 + hh, 'Feeds ' + fed.join(', ') + ' (see ' + fed.map((x) => x.split(' (')[0]).join(', ') + ')', tw, { size: small, bold: true, color: COL.brand });
    // contactor (or time clock) between the breaker and the load
    const fx0 = tx - gap / 2; let feedTop = y + F * 0.6; let kh0 = 0;
    const ctl = info.spare ? null : controlInfo(c);
    // v0.43: non-room circuits run left to right: contactor, isolator, then the load(s)
    const horiz = !info.spare && !info.spd && !info.rooms;
    if (ctl && horiz) used.add('contactor');
    if (ctl && !horiz) { used.add('contactor');
      // v0.42: IEC 60617 normally-open contactor contact, in line with the feed
      const tag = tags[val(c.num) || '?'] || ctl.tag; const ky = y + hh + 6, kh = F * 2.4;
      L(sh, fx0, y + F * 0.6, fx0, ky, { w: 0.9, color: COL.grey });
      nocSym(sh, fx0, ky, kh);
      T(sh, fx0 + F * 0.55, ky + small * 0.9, tag, { bold: true, size: small });
      const nx = fx0 + F * 3.2, nw = W - nx - 6;
      let nh = textLines(sh, nx, ky - 2, ctl.note, nw, { size: small, bold: true });
      const coil = ctl.from ? `Coil switched by circuit ${ctl.from} (see circuit ${ctl.from})` : 'Coil supply: ' + NA;
      const cy0 = Math.max(ky + nh + small * 0.55, ky + kh * 0.75); if (cy0 > ky + nh + small * 0.55) nh = cy0 - ky - small * 0.55;
      L(sh, fx0 + F * 0.3, cy0, nx + F * 1.4, cy0, { w: 1.5, color: COL.brand, dash: [4, 2] });
      nh += textLines(sh, nx + F * 1.6, ky - 2 + nh, coil, nw - F * 1.6, { size: small, color: ctl.from ? COL.brand : COL.na });
      if (!ctl.from && screen) nh += textLines(sh, nx + F * 1.6, ky - 2 + nh, 'Choose which circuit feeds the coil', nw - F * 1.6, { size: small, color: COL.amber });
      const out = ky + Math.max(kh, nh) + 4;
      L(sh, fx0, ky + kh, fx0, out, { w: 0.9, color: COL.grey });
      kh0 = Math.max(kh, nh) + 6; feedTop = out; hh += kh0;
    }
    // v0.43: local isolator (DP switch, FCU, rotary) in line, just before the load
    const iso = info.spare ? null : isoFor(c);
    if (iso && horiz) used.add(iso.ccu ? 'isoccu' : iso.fcu ? 'isofcu' : 'iso');
    if (iso && !horiz) { used.add(iso.ccu ? 'isoccu' : iso.fcu ? 'isofcu' : 'iso');
      const iy = Math.max(feedTop, y + hh) + 4, ih = F * 2.4;
      L(sh, fx0, feedTop, fx0, iy, { w: 0.9, color: COL.grey });
      isoSym(sh, fx0, iy, ih, iso.fcu, iso.switched, iso.ccu); if (iso.ccu) ccuSock(sh, fx0 - ih * 0.62, iy + ih * 0.5, S0());
      const nh = textLines(sh, fx0 + F * 1.3, iy + ih * 0.3 - small, iso.label, W - fx0 - F * 1.3 - 6, { size: small, bold: true });
      const out = iy + Math.max(ih, nh) + 2; L(sh, fx0, iy + ih, fx0, out, { w: 0.9, color: COL.grey });
      hh = out - y + 2; feedTop = out; }
    // this circuit feeds the coil of contactors on other circuits
    const sw = !info.spare && links[val(c.num)];
    if (sw) {
      const lab = 'Switches contactor on circuit' + (sw.length > 1 ? 's ' : ' ') + sw.join(', ') + ' (see circuit' + (sw.length > 1 ? 's ' : ' ') + sw.join(', ') + ')';
      const ly = y - 2 + hh + 2; const lh0 = textLines(sh, tx + F * 1.6, ly, lab, tw - F * 1.6, { size: small, bold: true, color: COL.brand });
      L(sh, tx, ly + small * 0.7, tx + F * 1.4, ly + small * 0.7, { w: 1.5, color: COL.brand, dash: [4, 2] });
      hh += lh0 + 4;
      // v0.42: the coils (A1/A2) this circuit drives, and the time clock / relay before them
      const ci = controlVias(bdSrc(), val(c.num)); let cx = tx + F * 0.4; const cy = y - 2 + hh + 4; const cw = F * 2.2, chh = F * 1.6;
      if (ci.clock) { used.add('timeclock'); clockSym(sh, cx + F * 0.8, cy + chh / 2, F * 0.75); T(sh, cx + F * 0.8, cy + chh + small * 1.1, 'TC', { anchor: 'middle', bold: true, size: small * 0.85 }); L(sh, cx + F * 1.55, cy + chh / 2, cx + F * 2.4, cy + chh / 2, { w: 0.9, color: COL.grey }); cx += F * 2.4; }
      else if (ci.relay) { T(sh, cx, cy + chh / 2 + small * 0.35, 'Relay', { size: small * 0.85, bold: true }); L(sh, cx + F * 2.6, cy + chh / 2, cx + F * 3.2, cy + chh / 2, { w: 0.9, color: COL.grey }); cx += F * 3.2; }
      for (const n of sw) { if (cx + cw + F * 2.5 > W - 6) break; used.add('coil'); coilSym(sh, cx, cy, cw, chh); T(sh, cx + cw / 2 + small * 0.4, cy + chh + small * 1.7, tags[n] || 'KM', { anchor: 'middle', bold: true, size: small * 0.85 }); cx += cw + F * 1.2; }
      hh += chh + small * 2 + 6;
    }
    // points
    const pc0 = pointCount(c); const pc = fed && !ctl && !iso ? { ...pc0, shown: 0, more: 0 } : pc0; /* v0.43.1: a sub-main draws no load, it feeds the board */ const kind0 = pointKind(c); const kind = loadKind(c, iso); void kind0; /* v0.43.3: heaters, radiators, towel rails get the heating-element symbol */ // v0.43.1: the FCU isolator IS the spur, the load is the heater itself
    const sgl = Math.min(socketSingles(c), pc.shown); const kindAt = (i) => (kind === 'socket' && i >= pc.shown - sgl ? 'socket1' : kind);
    let ph = 0;
    if (!info.spare && !info.spd && info.rooms) {
      ph = roomsSection(sh, info, tx, y + hh + 6, tw, feedTop, c);
    } else if (!info.spare && !info.spd && info.sockRooms && !ctl && !iso && !fed) {
      ph = sockRoomsSection(sh, info, tx, y + hh + 6, tw, feedTop, c);
    } else if (!info.spare && !info.spd && horiz && kind === 'socket' && isRingC(c) && pc.shown > 0 && !ctl && !iso && !fed) {
      ph = ringPlain(sh, c, pc, sgl, tx, y + hh + 6, tw, feedTop); // v0.43.5: a ring final as a hairpin: two legs out of the breaker, sockets between, joined after the last
    } else if (horiz && (pc.shown || ctl || iso)) {
      const S = F * 1.5, step = S + 6, lstep = S + 15, gapX = F * 2.3; const per = Math.max(1, Math.floor((tw - 4) / step)); const lab0 = (ctl || iso) ? small * 1.3 + (iso && iso.ccu ? F * 0.5 : 0) : 0; const py = y + hh + 6 + lab0; const fx = tx - gap / 2; const g9 = { w: 1.1, color: COL.line }; // v0.43: run conductor, same weight as the symbols so it reads as one line
      // items along the row: [width, draw(x, cy)]
      const items = []; let coilAt = null;
      if (ctl) { const kw = F * 2.4; items.push([kw + gapX, (x, cy) => { rotH(sh, x, cy, (o) => nocSym(o, x, cy, kw)); T(sh, x + kw / 2, cy - S * 0.55, tags[val(c.num) || '?'] || ctl.tag, { anchor: 'middle', bold: true, size: small }); coilAt = { x: x + kw * 0.5, y: cy }; }, false, kw]); }
      if (iso) { const ih = iso.ccu ? F * 3.2 : F * 2.4; const iw0 = Math.max(ih, textW(iso.label, small, true) + 4); items.push([iw0 + gapX, (x0, cy) => { /* v0.43.3: label centred over its symbol; leads fill the slot */ const pad = (iw0 - ih) / 2, x = x0 + pad; if (pad > 0) { L(sh, x0, cy, x, cy, g9); L(sh, x + ih, cy, x0 + iw0, cy, g9); }
        rotH(sh, x, cy, (o) => isoSym(o, x, cy, ih, iso.fcu, iso.switched, iso.ccu)); if (iso.ccu) ccuSock(sh, x + ih / 2, cy + ih * 0.3, F * 1.5); T(sh, x + ih / 2, cy - Math.max(S * 0.55, iso.ccu ? ih * 0.36 : 0), iso.label, { anchor: 'middle', bold: true, size: small }); }, false, iw0]); }
      heatLab = isTowel(c) ? 'Rail' : 'Rad';
      // v0.43.4: a plain lighting circuit's switch(es) sit in line before its lights (feed -> switch -> lights)
      const si0 = switchInfo(c); const swIn = si0 && si0.list.length && pc.shown && kind === 'light' ? si0.list : [];
      for (const k0 of swIn) items.push([lstep, (x, cy) => { const r = S / 2, ax = x + S / 2 - r * 0.1; /* pivot on the line, lever lifted: an open switch in series */
        symbol(sh, k0, x + S / 2, cy - r * 0.25, S); used.add(k0); L(sh, x, cy, ax - r * 0.2, cy, g9); L(sh, ax + r * 0.62, cy, x + S, cy, g9); }, false, S]);
      const nSw = swIn.length; const ringN = kind === 'socket' ? pc.shown - sgl : pc.shown; // v0.43.4: single sockets hang off the ring as spurs
      for (let i = 0; i < ringN; i++) { const k1 = kindAt(i); items.push([lstep, (x, cy) => { heatLab = isTowel(c) ? 'Rail' : 'Rad'; symbol(sh, k1, x + S / 2, cy, S); used.add(k1); }, true]); }
      const rowsX = []; let x = tx + F * 0.6, row = 0; const maxX = W - 6;
      for (const it of items) { if (x + it[0] > maxX + 6 && x > tx + F * 0.6) { row++; x = tx + F * 0.6; } rowsX.push([x, row]); x += it[0]; }
      const rows = row + 1; const rowH = S + lab0 + 8; let prevEnd = null;
      items.forEach((it, i) => { const [xx, r] = rowsX[i]; const cy = py + r * rowH + S / 2;
        const li = i - (items.length - ringN); const inX = it[2] ? xx + S / 2 - loadR(kindAt(li), S) : xx;
        if (i === 0) { L(sh, fx, feedTop, fx, cy, g9); L(sh, fx, cy, inX, cy, g9); }
        else if (rowsX[i - 1][1] !== r) { const pcy = cy - rowH; L(sh, prevEnd, pcy, prevEnd + 3, pcy, g9); L(sh, prevEnd + 3, pcy, prevEnd + 3, pcy + rowH / 2 + S * 0.2, g9); L(sh, prevEnd + 3, pcy + rowH / 2 + S * 0.2, fx, pcy + rowH / 2 + S * 0.2, g9); L(sh, fx, pcy + rowH / 2 + S * 0.2, fx, cy, g9); L(sh, fx, cy, inX, cy, g9); }
        else L(sh, prevEnd, cy, inX, cy, g9);
        it[1](xx, cy); prevEnd = it[2] ? xx + S / 2 + loadR(kindAt(li), S) : xx + it[3]; });
      ph = 6 + lab0 + rows * rowH - 8 + (iso && iso.ccu ? F * 1.8 : 0);
      if (kind === 'socket' && sgl && items.length) { // spur(s): a branch dropping from the last ring socket, below everything else
        used.add('socket1'); const [lx0, lr] = rowsX[items.length - 1]; const bx = lx0 + S / 2 + loadR('socket', S) + 3; const by = py + lr * rowH + S / 2; // tees off the line just past the last socket
        const sy = py + rows * rowH + 4 + S / 2; const sper = Math.max(1, Math.floor((maxX - tx - F * 0.6) / lstep)); let px = null;
        for (let j = 0; j < sgl; j++) { const rr = Math.floor(j / sper), xx = tx + F * 0.6 + (j % sper) * lstep, cy = sy + rr * rowH, cx = xx + S / 2, rad = loadR('socket1', S);
          if (j === 0) { L(sh, bx, by, bx, cy - rowH / 2 + 2, g9); L(sh, bx, cy - rowH / 2 + 2, cx, cy - rowH / 2 + 2, g9); L(sh, cx, cy - rowH / 2 + 2, cx, cy - S * 0.45, g9); }
          else if (j % sper === 0) { L(sh, px.x, px.y + S * 0.45, px.x, cy - rowH / 2 + 2, g9); L(sh, px.x, cy - rowH / 2 + 2, cx, cy - rowH / 2 + 2, g9); L(sh, cx, cy - rowH / 2 + 2, cx, cy - S * 0.45, g9); }
          else L(sh, px.x + rad, cy, cx - rad, cy, g9);
          symbol(sh, 'socket1', cx, cy, S); px = { x: cx, y: cy }; }
        const srows = Math.ceil(sgl / sper); ph += srows * rowH + 4;
        const lx = tx + F * 0.6 + Math.min(sgl, sper) * lstep; if (lx + textW('Spurs', small) < maxX) T(sh, lx, sy + (srows - 1) * rowH + small * 0.35, sgl === 1 ? 'Spur' : 'Spurs', { size: small, color: COL.grey }); }
      if (ctl) { // coil cross-reference under the row, joined by the dashed mechanical link
        const ty = y + hh + 6 + ph + 2; const nx0 = coilAt ? Math.max(F * 1.6, coilAt.x - tx + 6) : F * 1.6; const coil = ctl.from ? `Coil switched by circuit ${ctl.from} (see circuit ${ctl.from})` : 'Coil supply: ' + NA;
        let nh = textLines(sh, tx + nx0, ty, ctl.note, tw - nx0, { size: small, bold: true });
        if (coilAt) L(sh, coilAt.x, coilAt.y + S * 0.3, coilAt.x, ty + small * 0.6, { w: 1.5, color: COL.brand, dash: [4, 2] }), L(sh, coilAt.x, ty + small * 0.6, tx + nx0 - 3, ty + small * 0.6, { w: 1.5, color: COL.brand, dash: [4, 2] });
        nh += textLines(sh, tx + nx0, ty + nh, coil, tw - nx0, { size: small, color: ctl.from ? COL.brand : COL.na });
        if (!ctl.from && screen) nh += textLines(sh, tx + nx0, ty + nh, 'Choose which circuit feeds the coil', tw - nx0, { size: small, color: COL.amber });
        ph += nh + 4; }
      if (kind !== 'socket') used.add(kind);
      if (pc.more) { ph += textLines(sh, tx, y + hh + 6 + ph, `+ ${pc.more} more (${pc.n} in total)`, tw, { size: small, color: COL.grey }) + 2; }
      // light switches: their own row under the lights, on the same feed
      const si = switchInfo(c);
      if (si && si.list.length && !nSw) {
        const sy = y + hh + 6 + ph + 8; const cy = sy + S / 2; const n = Math.min(si.list.length, per); const rws = Math.ceil(si.list.length / per);
        for (let r = 0; r < rws; r++) {
          const m = Math.min(per, si.list.length - r * per); const cyr = cy + r * (S + 10);
          L(sh, tx - gap / 2, r ? cyr - (S + 10) : sy - 8, tx - gap / 2, cyr, { w: 0.9, color: COL.grey, dash: [2, 2] });
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
    if (screen && !info.spare && !info.spd && info.noPoints && !info.rooms && !info.sockRooms && !fed) ph += textLines(sh, tx, y + hh + (ph ? 6 + ph : 2), 'Add points served to draw sockets/lights', tw, { size: small, color: COL.amber }) + 4;
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
    R(sh, dx, by, devW, bh, reds.length ? { fill: [255, 255, 255], color: COL.red, lw: screen ? 2.4 : 2.8 /* v0.43.1: thick so it still reads in greyscale print */ } : { fill: info.spare ? [248, 248, 248] : [255, 255, 255] }); sh.unshift(sh.pop());
    if (ringLegB != null) { const lx = dx + devW * 0.7; L(sh, lx, by + bh, lx, ringLegB, { w: 1.1, color: COL.line }); } // v0.43.5: the ring's second leg, out of the same breaker
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
    return { h, shapes: sh, kind: 'circuit', reds: reds.length, num: val(c.num), links: [...(ctl && ctl.from ? [ctl.from] : []), ...(sw || [])] };
  }
  // Rooms: the feed runs room to room down the left; each room is a box with
  // its lights, switches and how they're wired. A clear schematic, not to scale.
  // v0.43.5: socket rooms. The ring/radial runs room box to room box in feed order:
  // into each box on the left, through its sockets, out on the right, down the gap and
  // back to a lane left of the boxes for the next room. A ring returns up the right
  // side and over the top to the breaker. Spurs drop off the line before the first socket.
  // v0.43.5: socket rooms, in the lighting-room style. The circuit cable is a
  // vertical lane on the left, outside the boxes; each room hangs off it with one
  // tee into the box's left edge, sockets on the tee (doubles then singles), spurs
  // below. A ring adds a parallel return lane further left; the two legs join at the
  // top (the feed) and below the last room. Nothing on the right, no crossings.
  // v0.43.5: ring final as a hairpin (ladder). Leg A and leg B both leave the
  // breaker output side by side and run in parallel; each socket sits between
  // them (A to its earth bar, its lead down to B); after the last socket the two
  // legs join. Rows that run out of width snake back (alternate direction) with
  // nested U-turns, so no line ever crosses another.
  function hairpin(sh, rows, o) {
    const { S, g, step } = o; const r = S / 2, upT = 0, dnB = 10; const out = []; void r; // sockets sit ON the top leg
    const N = rows.length;
    rows.forEach((row, k) => {
      const dir = k % 2 ? -1 : 1, cy = row.cy, yT = cy - upT, yB = cy + dnB;
      const pos = row.items.map((it, j) => (dir > 0 ? o.xL + j * step : o.xR - j * step));
      const side = (d) => (d > 0 ? o.turnR : o.turnL); // [outer, inner]
      let tIn, bIn; if (k === 0) { tIn = o.startT; bIn = o.startB; } else { const s0 = side(-dir); tIn = s0[1]; bIn = s0[0]; }
      let tOut, bOut;
      if (k === N - 1) { const lastX = pos.length ? pos[pos.length - 1] + dir * (loadR(row.items[pos.length - 1], S) + 12) : (dir > 0 ? Math.max(tIn, bIn) : Math.min(tIn, bIn)) + dir * 14; tOut = bOut = lastX; L(sh, lastX, yT, lastX, yB, g); }
      else { const s1 = side(dir); tOut = s1[0]; bOut = s1[1]; const nx = rows[k + 1]; const nyT = nx.cy - upT, nyB = nx.cy + dnB;
        L(sh, s1[0], yT, s1[0], nyB, g); L(sh, s1[1], yB, s1[1], nyT, g); }
      L(sh, bIn, yB, bOut, yB, g); let px = tIn;
      row.items.forEach((kd, j) => { const cx = pos[j], kr = loadR(kd, S); L(sh, px, yT, cx - dir * kr, yT, g); symbol(sh, kd, cx, cy, S); px = cx + dir * kr; used.add(kd); if (row.tag) row.tag(cx, cy, kd); });
      L(sh, px, yT, tOut, yT, g);
      out.push({ pos, yT, yB, dir });
    });
    return out;
  }

  function HP(S) { return { upT: S / 2 * 1.32 + 4, dnB: 10 }; }
  function spurRow(sh, k, dx, yFrom, sy, step, S, g, n, lab, maxX, tag, minX = 0) {
    used.add(k); const sr = loadR(k, S); L(sh, dx, yFrom, dx, sy, g);
    const need = 6 + n * step + (tag ? 12 : 6) + textW(lab, small); const d = dx + need < maxX || dx - need < minX ? 1 : -1; // branch away from the edge
    let px = dx;
    for (let j = 0; j < n; j++) { const cx = dx + d * (6 + sr + j * step); L(sh, px, sy, cx - d * sr, sy, g); symbol(sh, k, cx, sy, S); if (tag) tag(cx + sr + 1, sy + S * 0.55); px = cx + d * sr; }
    if (d > 0) { const lx = px + (tag ? 12 : 6); if (lx + textW(lab, small) < maxX) T(sh, lx, sy + small * 0.35, lab, { size: small, color: COL.grey }); }
    else { const lx = px - 6 - textW(lab, small); if (lx > minX) T(sh, lx, sy + small * 0.35, lab, { size: small, color: COL.grey }); }
  }
  function ringPlain(sh, c, pc, sgl, tx, top, tw, feedTop) {
    const S = F * 1.5, g = { w: 1.1, color: COL.line }, step = S + 12, fx = tx - gap / 2; const { upT, dnB } = HP(S);
    const ringN = pc.shown - sgl; const xL = tx + 14 + S / 2, xR = W - 16 - S / 2; const per = Math.max(1, Math.floor((xR - xL) / step) + 1);
    const items = Array(ringN).fill('socket'); const rows = []; const pitch = upT + dnB + 10;
    for (let k = 0; k * per < items.length; k++) rows.push({ items: items.slice(k * per, (k + 1) * per), cy: top + 4 + upT + k * pitch });
    const xRr = xL + (per - 1) * step; // right-hand turn sits just past the widest row
    const res = hairpin(sh, rows, { S, g, step, xL, xR: xRr, startT: fx, startB: tx - gap - devW * 0.3, turnL: [tx + 2, tx + 7], turnR: [xRr + S * 0.5 + 12, xRr + S * 0.5 + 7] });
    L(sh, fx, feedTop, fx, res[0].yT, g); ringLegB = res[0].yB; // leg B leaves the breaker's foot (drawn with the breaker)
    let bottom = res[res.length - 1].yB + 4;
    const lr0 = res[res.length - 1], jx = lr0.pos.length ? lr0.pos[lr0.pos.length - 1] + lr0.dir * (loadR('socket', S) + 12) : 0; const spurLab = sgl === 1 ? 'Spur' : 'Spurs';
    if (sgl && lr0.dir > 0 && jx + 10 + sgl * step + 4 + textW(spurLab, small) < W - 6) { // spur(s) teed off the ring on the same row, after the join
      used.add('socket1'); const sr = loadR('socket1', S); let px = jx; C(sh, jx, lr0.yT, 1.6, { fill: COL.line, lw: 0.6 });
      for (let j = 0; j < sgl; j++) { const cx = jx + 10 + sr + j * step; L(sh, px, lr0.yT, cx - sr, lr0.yT, g); symbol(sh, 'socket1', cx, lr0.yT, S); px = cx + sr; }
      T(sh, px + 4, lr0.yT - S * 0.15, spurLab, { size: small, color: COL.grey }); }
    else if (sgl) { const last = res[res.length - 1]; const dx = Math.min(...(last.pos.length ? last.pos : [xL])) - S * 0.2; const sy = last.yB + S * 0.5 + 8; used.add('socket1');
      spurRow(sh, 'socket1', dx, last.yB, sy, step, S, g, sgl, sgl === 1 ? 'Spur' : 'Spurs', W - 6); bottom = sy + S * 0.6; }
    let ph = bottom - top + 2;
    if (pc.more) ph += textLines(sh, tx, top + ph, `+ ${pc.more} more (${pc.n} in total)`, tw, { size: small, color: COL.grey }) + 2;
    return ph;
  }
  // v0.43.5 (Matthew's spec): ring with rooms. Leg 1 runs straight down from the
  // breaker. Leg 2, just right of it, goes in and out of each room: a line into the
  // box at its left with the sockets sitting on it, just past the last socket it
  // drops a little and runs back left out of the box onto leg 2, which carries on
  // to the next room. After the last room the two legs join. Spurs hang below.
  function ringRooms(sh, info, tx, top, tw, feedTop, c) {
    const S = F * 1.5, r0 = S / 2, g = { w: 1.1, color: COL.line }, step = S + 12, fx = tx - gap / 2;
    const bx = tx + 8, bw = tx + tw - bx, ix = bx + 8, iw = bw - 16; const cx0 = ix + S * 0.5 + 4; const rad = loadR('socket', S);
    const per = Math.max(1, Math.floor((bx + bw - 12 - rad - cx0) / step) + 1); const lead = r0 * 0.95, pitch = S + 12;
    let y0 = top; if (screen && info.roomNote) y0 += textLines(sh, tx, y0 - 4, info.roomNote, tw, { size: small, color: COL.na }) + 4;
    used.add('socket'); let legY = feedTop; // where leg 2 picks up again
    info.sockRooms.forEach((r) => {
      const rs = [], ln = []; let ry = y0 + 4;
      ry += textLines(rs, ix, ry, r.name || 'Room ' + (r.i + 1), iw, { bold: true, size: small });
      const ip = /outside|outdoor|garden|exterior|external|patio/i.test(r.name); if (ip) used.add('ipsock');
      const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
      ry += textLines(rs, ix, ry, [pl(r.sockets, 'double'), r.singles ? pl(r.singles, 'single') : '', r.spurs ? pl(r.spurs, 'spur') + (r.spurKind === 'fcu' ? ' (FCU)' : '') : '', r.dpsw ? pl(r.dpsw, 'DP + socket') : '', r.dpsws ? pl(r.dpsws, 'DP + switched socket') : '', ip ? 'outdoor, IP rated' : ''].filter(Boolean).join(' \u00b7 '), iw, { size: small * 0.92, color: COL.grey });
      const items = [...Array(r.sockets).fill('socket'), ...Array(r.singles).fill('socket1'), ...Array(r.dpsw).fill('dpu'), ...Array(r.dpsws).fill('dps')]; if (r.singles) used.add('socket1'); const dpH = r.dpsw || r.dpsws ? S * 0.85 : 0; // v0.43.8: DP stacks stand taller
      // spurs ride on the same row, teed off after the last ring socket, when they fit
      const spurK = r.spurKind === 'fcu' ? 'fcu' : 'socket1'; const spurLab = r.spurs === 1 ? 'Spur' : 'Spurs'; // the symbol says socket or FCU; the room summary says which
      const spurW = r.spurs ? 10 + (r.spurs - 1) * step + 2 * loadR(spurK, S) + (ip && spurK === 'socket1' ? 12 : 4) + textW(spurLab, small) : 0;
      const nRows = Math.max(1, Math.ceil(items.length / per)); let cy = ry + 6 + r0 * 1.45 + dpH; let x = fx; const pitchR = pitch + dpH; let lineY = cy; const yIn = lineY;
      for (let k = 0; k < nRows; k++) { const row = items.slice(k * per, (k + 1) * per); const dir = k % 2 ? -1 : 1; lineY = cy;
        const pos = row.map((_, j) => (dir > 0 ? cx0 + j * step : cx0 + (row.length - 1 - j) * step));
        if (k > 0) { L(ln, x, lineY - pitchR, x, lineY, g); } // drop to the next row
        const end = row.length ? (dir > 0 ? Math.max(...pos) + rad + 8 : Math.min(...pos) - rad - 8) : (dir > 0 ? cx0 + 6 : cx0 - 6);
        // the line runs in one side of each socket and out the other
        let px = x; row.forEach((kd, j) => { const cx = pos[j], kr = loadR(kd, S); L(ln, px, lineY, cx - dir * kr, lineY, g); symbol(rs, kd, cx, cy, S); used.add(kd); if (ip) T(rs, cx + kr + 1, cy + S * 0.35, 'IP', { bold: true, size: small * 0.75, color: COL.brand }); px = cx + dir * kr; });
        L(ln, px, lineY, end, lineY, g); x = end;
        if (k < nRows - 1) cy += pitchR; }
      // back to leg 2: straight on if the last row already runs left, else down a little and back
      let yOut = lineY; const lastDir = (nRows - 1) % 2 ? -1 : 1;
      const spurInline = r.spurs && lastDir > 0 && x + spurW < bx + bw - 6;
      if (spurInline) { // a tee off the ring after its last socket: the branch carries on along the row
        used.add(spurK); const sr = loadR(spurK, S); let px = x; C(ln, x, lineY, 1.6, { fill: COL.line, lw: 0.6 });
        for (let j = 0; j < r.spurs; j++) { const cx = x + 10 + sr + j * step; L(ln, px, lineY, cx - sr, lineY, g); symbol(rs, spurK, cx, cy, S); if (ip && spurK === 'socket1') T(rs, cx + sr + 1, cy + S * 0.35, 'IP', { bold: true, size: small * 0.75, color: COL.brand }); px = cx + sr; }
        T(rs, px + (ip && spurK === 'socket1' ? 12 : 4), cy - S * 0.15, spurLab, { size: small, color: COL.grey }); }
      if (lastDir > 0) { yOut = lineY + 9; L(ln, x, lineY, x, yOut, g); }
      L(ln, x, yOut, fx, yOut, g);
      let bottom = yOut + 4;
      let dpFrom = yOut;
      if (r.spurs && !spurInline) { const k = r.spurKind === 'fcu' ? 'fcu' : 'socket1'; const sy = yOut + S * 0.5 + 8;
        spurRow(ln, k, cx0 - S * 0.2, yOut, sy, step, S, g, r.spurs, (r.spurKind === 'fcu' ? 'FCU spur' : 'Spur') + (r.spurs === 1 ? '' : 's'), bx + bw - 6, ip && k === 'socket1' ? (xx, yy) => T(ln, xx, yy, 'IP', { bold: true, size: small * 0.75, color: COL.brand }) : null, bx + 6);
        bottom = sy + S * 0.6; dpFrom = sy; }
      R(sh, bx, y0, bw, bottom + 4 - y0, { fill: COL.fill, color: [150, 160, 190] }); sh.push(...rs, ...ln);
      L(sh, fx, legY, fx, yIn, g); legY = yOut; // leg 2 into this room; it resumes where the room hands back
      cable('Circuit ' + (val(c.num) || '?'), r.name || 'room', cableLabel(c).split(' \u00b7 ')[0]);
      y0 = bottom + 4 + 10;
    });
    const by = y0 - 4; const l1 = tx - gap - devW * 0.3; L(sh, fx, legY, fx, by, g); L(sh, l1, by, fx, by, g); ringLegB = by; // the legs join after the last room
    return by - top + 4;
  }
  function sockRoomsSection(sh, info, tx, top, tw, feedTop, c) {
    if (isRingC(c)) return ringRooms(sh, info, tx, top, tw, feedTop, c);
    const S = F * 1.5, rad = loadR('socket', S), step = S + 12, rowH = S + 12, fx = tx - gap / 2; const g = { w: 1.1, color: COL.line };
    const ring = isRingC(c); const xi = ring ? fx : tx + 4, bx = tx + 8, bw = tx + tw - bx - (ring ? 18 : 0), xr = bx + bw + 10; /* v0.43.5: a ring is drawn as a closed loop */
    let y0 = top; if (screen && info.roomNote) y0 += textLines(sh, tx, y0 - 4, info.roomNote, tw, { size: small, color: COL.na }) + 4;
    const topY = y0 + 2; y0 += 8; used.add('socket'); let teeY = topY, lastBottom = y0;
    info.sockRooms.forEach((r) => {
      const rs = []; const ix = bx + 8, iw = bw - 16; let ry = y0 + 4;
      ry += textLines(rs, ix, ry, r.name || 'Room ' + (r.i + 1), iw, { bold: true, size: small });
      const ip = /outside|outdoor|garden|exterior|external|patio/i.test(r.name); if (ip) used.add('ipsock'); // outdoor: weatherproof, marked IP
      const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
      const parts = [pl(r.sockets, 'double'), r.singles ? pl(r.singles, 'single') : '', r.spurs ? pl(r.spurs, 'spur') + (r.spurKind === 'fcu' ? ' (FCU)' : '') : '', r.dpsw ? pl(r.dpsw, 'DP + socket') : '', r.dpsws ? pl(r.dpsws, 'DP + switched socket') : '', ip ? 'outdoor, IP rated' : ''].filter(Boolean);
      ry += textLines(rs, ix, ry, parts.join(' \u00b7 '), iw, { size: small * 0.92, color: COL.grey });
      const items = [...Array(r.sockets).fill('socket'), ...Array(r.singles).fill('socket1'), ...Array(r.dpsw).fill('dpu'), ...Array(r.dpsws).fill('dps')]; if (r.singles) used.add('socket1'); const dpH = r.dpsw || r.dpsws ? S * 0.85 : 0; // v0.43.8: DP stacks stand taller
      const cx0 = ix + S * 0.9 + rad; const per = Math.max(1, Math.floor((bx + bw - 10 - rad - cx0) / step) + 1);
      const rowY0 = ry + S * 0.5 + 4 + dpH; let last = null; const rowHr = rowH + dpH;
      const ipTag = (x, y) => { if (ip) T(rs, x, y, 'IP', { bold: true, size: small * 0.75, color: COL.brand }); };
      items.forEach((k, j) => { const cx = cx0 + (j % per) * step, cy = rowY0 + Math.floor(j / per) * rowHr; const kr = loadR(k, S);
        if (!j) L(rs, bx, cy, cx - kr, cy, g);
        else if (j % per === 0) { const wy = dpH ? last.y + 7 : cy - rowH / 2, wx = ix + 2, ex = last.x + last.r + 3; L(rs, last.x + last.r, last.y, ex, last.y, g); L(rs, ex, last.y, ex, wy, g); L(rs, ex, wy, wx, wy, g); L(rs, wx, wy, wx, cy, g); L(rs, wx, cy, cx - kr, cy, g); }
        else L(rs, last.x + last.r, cy, cx - kr, cy, g);
        symbol(rs, k, cx, cy, S); used.add(k); ipTag(cx + kr + 1, cy + S * 0.55); last = { x: cx, y: cy, r: kr }; });
      if (!last) L(rs, bx, rowY0, r.spurs ? cx0 - S * 0.8 : bx + 10, rowY0, g);
      let bottom = (last ? last.y : rowY0) + S * 0.6;
      if (r.spurs) { const k = r.spurKind === 'fcu' ? 'fcu' : 'socket1'; used.add(k); const sr = loadR(k, S); const sy = bottom + S * 0.5 + 6, dx = cx0 - S * 0.8;
        L(rs, dx, last ? last.y : rowY0, dx, sy, g); let px = dx;
        for (let j = 0; j < r.spurs; j++) { const cx = cx0 + j * step; L(rs, px, sy, cx - sr, sy, g); symbol(rs, k, cx, sy, S); if (k === 'socket1') ipTag(cx + sr + 1, sy + S * 0.55); px = cx + sr; }
        const lab = (r.spurKind === 'fcu' ? 'FCU spur' : 'Spur') + (r.spurs === 1 ? '' : 's'); const lx = px + (ip ? 12 : 6); if (lx + textW(lab, small) < bx + bw - 6) T(rs, lx, sy + small * 0.35, lab, { size: small, color: COL.grey });
        bottom = sy + S * 0.6; }
      const bh = bottom - y0 + 6; R(sh, bx, y0, bw, bh, { fill: COL.fill, color: [150, 160, 190] }); sh.push(...rs);
      L(sh, xi, rowY0, bx, rowY0, g); teeY = rowY0; lastBottom = y0 + bh; // the tee
      cable('Circuit ' + (val(c.num) || '?'), r.name || 'room', cableLabel(c).split(' \u00b7 ')[0]);
      y0 += bh + 10;
    });
    if (ring) { // out leg down the left from the breaker, return leg up the right, both landing back on the breaker's feed
      const by = lastBottom + 8; L(sh, fx, feedTop, fx, by, g); L(sh, fx, by, xr, by, g); L(sh, xr, by, xr, topY, g); L(sh, xr, topY, fx, topY, g); C(sh, fx, topY, 1.8, { fill: COL.line, lw: 0.6 }); }
    else { L(sh, fx, feedTop, fx, topY, g); L(sh, fx, topY, xi, topY, g); L(sh, xi, topY, xi, teeY, g); }
    return y0 - top - 2 + (ring ? 8 : 0);
  }
  function roomsSection(sh, info, tx, top, tw, feedTop, c) {
    const S = F * 1.5, step = S + 8, fx = tx - gap / 2, G = { w: 0.9, color: COL.grey };
    const shared = info.rooms.some((r) => r.wiring === 'jb-switch');
    const nSw = info.rooms.filter((r) => r.wiring === 'jb-switch').length; const gut = shared ? Math.max(16, 8 + 5 * nSw) + small * 1.3 : 6; /* v0.43.3: room for cable tags right of the JB lanes */ const bx = tx + gut, bw = tw - gut; let swK = 0; let y0 = top; let lastFeedY = feedTop;
    if (screen && info.roomNote) y0 += textLines(sh, tx, y0 - 4, info.roomNote, tw, { size: small, color: COL.na }) + 4;
    // switch-fed rooms: ONE junction box for the circuit, a separate cable from it to each such room's switch
    let jbX = 0, jbLastY = 0;
    if (shared) { used.add('jb'); used.add('jbsw');
      const jw = S * 1.4, jh = S * 0.9, jy = y0 + 2; jbX = tx + 8;
      L(sh, fx, lastFeedY, fx, jy + jh / 2, { w: 1.2, color: COL.line }); L(sh, fx, jy + jh / 2, tx, jy + jh / 2, { w: 1.2, color: COL.line });
      R(sh, tx, jy, jw, jh, { fill: [255, 255, 255] }); T(sh, tx + jw / 2, jy + jh / 2 + small * 0.35, 'JB', { anchor: 'middle', bold: true, size: small * 0.85 });
      const nh = 0; /* v0.43.3: no explanation sentence; the key explains the JB */
      lastFeedY = jy + jh / 2; jbLastY = jy + jh; y0 = jy + Math.max(jh, nh) + 8; }
    info.rooms.forEach((r) => {
      const rs = []; const ix = bx + 8, iw = bw - 16;
      let ry = y0 + 4;
      const nm = r.name || 'Room ' + (r.i + 1);
      ry += textLines(rs, ix, ry, nm, iw, { bold: true, size: small });
      const how = ROOM_WIRING[r.wiring] || ROOM_WIRING['loop-in'];
      const sws = [r.sw1 && `${r.sw1} \u00d7 1-way`, r.sw2pairs && (r.sw2pairs === 1 ? '2-way' : `${r.sw2pairs} \u00d7 2-way`), r.swi && `${r.swi} \u00d7 intermediate`].filter(Boolean).join(' + ') || 'No switch';
      ry += textLines(rs, ix, ry, `${r.lights} light${r.lights === 1 ? '' : 's'} \u00b7 ${sws} \u00b7 ${how}`, iw, { size: small * 0.92, color: COL.grey });
      if (r.wiring === 'jb-switch') { const fy = jbSwitchRoom(rs, r, ix, iw, ry, S, G); fy.bottom = fanRow(rs, r, ix, iw, fy.bottom, S, G, fy.feedIn, fy.swOut); const bh = fy.bottom - y0 + 6;
        R(sh, bx, y0, bw, bh, { fill: COL.fill, color: [150, 160, 190] }); sh.push(...rs);
        // v0.43: its own cable from the JB to this room (no shared trunk)
        const lx = tx + 3 + (nSw - 1 - swK) * 5; swK++; /* v0.43.1: top room innermost lane, so tails never cross */ L(sh, lx, jbLastY, lx, fy.feedIn, { w: 1.2, color: COL.line }); L(sh, lx, fy.feedIn, fy.swX, fy.feedIn, { w: 1.2, color: COL.line });
        cable('JB, circuit ' + (val(c.num) || '?'), 'switch, ' + nm, cableLabel(c).split(' \u00b7 ')[0]); // v0.43.3: in the cable list only, no tag on the drawing
        y0 += bh + 8; return; }
      // v0.42: each switch (or 2-way pair) controls its own lights; see roomBody
      const jb = r.wiring === 'junction box';
      const fb = roomBody(rs, r, ix, iw, ry, S, G, jb ? 'jb' : 'loop');
      const feedIn = fb.feedIn; const bottom = fanRow(rs, r, ix, iw, fb.bottom, S, G, fb.feedIn, fb.swOut);
      const bh = bottom - y0 + 6;
      R(sh, bx, y0, bw, bh, { fill: COL.fill, color: [150, 160, 190] });
      sh.push(...rs);
      // the circuit feed: down the left, then into this room
      L(sh, fx, lastFeedY, fx, feedIn, { w: 1.2, color: COL.line });
      L(sh, fx, feedIn, jb ? ix : ix, feedIn, { w: 1.2, color: COL.line });
      cable('Circuit ' + (val(c.num) || '?'), nm + (jb ? ' JB' : ' first rose'), cableLabel(c).split(' \u00b7 ')[0]); // v0.43.3: in the cable list only
      lastFeedY = feedIn;
      y0 += bh + 8;
    });
    return y0 - top + 2;
  }
  // Switch-fed room: circuit feed into a JB, a cable from the JB to the first
  // switch, then from that switch to the light(s), light to light.
  // v0.43.1: a room's extractor fan(s): feed -> control -> fan. Light switch: tail from the switched live.
  function fanRow(rs, r, ix, iw, bottom, S, G, feedIn, swOut) {
    if (!r.fans) return bottom;
    const y = bottom + 8 + S / 2; const x0 = ix - 4; /* v0.43.2: in the box margin, clear of the notes, one line from the room feed */ const sw = r.fanCtl === 'switch';
    const ctl = { humidistat: ['fanh', '%RH'], timer: ['fant', 'T'], isolator: ['fani', 'ISO'] }[r.fanCtl];
    // v0.43.3: a light-switch fan's switched live starts at the room's (first) switch, then runs down the margin
    if (sw && swOut) { const dg = { ...G, dash: [2, 2] }; const py = swOut.y + S * 0.62; L(rs, swOut.x, swOut.y + S * 0.45, swOut.x, py, dg); L(rs, swOut.x, py, x0, py, dg); L(rs, x0, py, x0, y, dg); }
    else L(rs, x0, feedIn ?? bottom + 2, x0, y, sw ? { ...G, dash: [2, 2] } : { w: 1.1, color: COL.line });
    let x = x0; const g = { w: 1.1, color: COL.line };
    if (ctl) { used.add(ctl[0]); L(rs, x, y, x + 10, y, g); x += 10; fanCtlSym(rs, x, y, S, ctl[1]); x += S * 1.3; }
    for (let i = 0; i < r.fans; i++) { L(rs, x, y, x + 8, y, sw ? { ...G, dash: [2, 2] } : g); x += 8; symbol(rs, 'fan', x + S / 2, y, S); x += S; }
    used.add('fan');
    const note = sw ? 'Fan from the switched live (runs with the light)' : ctl[0] === 'fanh' ? 'Fan on a humidistat' : ctl[0] === 'fant' ? 'Fan on a timer (overrun)' : 'Fan via isolator';
    const nh = textLines(rs, x + 8, y - small * 0.4, note, ix + iw - x - 10, { size: small * 0.85, color: COL.grey });
    return Math.max(y + S / 2, y - small * 0.4 + nh - 4);
  }
  function fanCtlSym(sh, x, cy, S, lab) { const w = S * 1.3, hgt = S * 0.9; R(sh, x, cy - hgt / 2, w, hgt, { fill: [255, 255, 255] }); T(sh, x + w / 2, cy + small * 0.3, lab, { anchor: 'middle', bold: true, size: small * 0.8 }); }
  function jbSwitchRoom(rs, r, ix, iw, ry, S, G) { return roomBody(rs, r, ix, iw, ry, S, G, 'jb-switch'); }
  // v0.43 (test): one room's lights and switches, drawn as rows. Each 1-way
  // switch, and each 2-way pair (with its intermediates), is a group with its
  // own lights (split evenly unless room.split says otherwise). Each group is
  // one horizontal row: switch(es) on the left, its lights to the right on the
  // same line; lights wrap onto a second line if they run out of width.
  //  - jb-switch: feed from the circuit JB into the first switch, then loops
  //    switch to switch down the left edge.
  //  - loop-in: permanent live loops rose to rose along a line above the row;
  //    the switch wire runs along the row to the lights.
  //  - jb: room JB on the left of the first row; switch drop to each group.
  function roomBody(rs, r, ix, iw, ry, S, G, mode) {
    const groups = switchGroups(r); const sstep = S + 14, step = S + 8, rowH = S + 10;
    const jbW = S * 1.4; const x0 = ix + (mode === 'jb' ? jbW + 12 : 12) + S / 2; const maxX = ix + iw - S / 2 - 2;
    const D = { ...G, dash: [2, 2] };
    let y = ry + (mode === 'loop' ? S * 0.9 + 6 : S * 0.6 + 4); let feedIn = y; const swX = ix + 6; let bottom = y;
    const allLights = groups.reduce((a, g) => a + g.lights, 0);
    if (allLights) used.add('light'); if (mode === 'loop' && allLights) used.add('rose');
    let jbBox = null; let prevY = null; let swOut = null;
    if (mode === 'jb') { used.add('jb'); jbBox = { x: ix, y: y - S * 0.45, w: jbW, h: S * 0.9 }; R(rs, ix, jbBox.y, jbW, jbBox.h, { fill: [255, 255, 255] }); T(rs, ix + jbW / 2, y + small * 0.35, 'JB', { anchor: 'middle', bold: true, size: small * 0.85 }); }
    groups.forEach((g, gi) => {
      const sy = y; const sx = g.sw.map((_, i) => x0 + i * sstep);
      g.sw.forEach((k0, i) => { symbol(rs, k0, sx[i], sy, S); used.add(k0); });
      if (g.sw.length > 1) { used.add('strap');
        for (let j = 1; j < g.sw.length; j++) { const a = sx[j - 1], b = sx[j];
          L(rs, a + S * 0.45, sy - S * 0.08, b - S * 0.45, sy - S * 0.08, { w: 1, color: COL.brand }); L(rs, a + S * 0.45, sy + S * 0.2, b - S * 0.45, sy + S * 0.2, { w: 1, color: COL.brand }); } }
      const outX = sx.length ? sx[sx.length - 1] : null; if (gi === 0 && outX != null) swOut = { x: outX, y: sy };
      let lx0 = outX != null ? outX + sstep : x0; if (lx0 > maxX) lx0 = x0;
      const lper = Math.max(1, Math.floor((maxX - lx0) / step) + 1);
      let lrow = 0; let lastLy = sy;
      if (g.lights && lx0 === x0 && outX != null) lrow = 1; // no room on the switch line: lights start underneath
      const pts = [];
      for (let q = 0; q < g.lights; q++) { const k = lrow + Math.floor(q / lper); pts.push({ x: lx0 + (q % lper) * step, y: sy + k * rowH }); }
      // feed into this row
      if (mode === 'jb-switch' && sx.length) { const fx0 = swX; if (gi === 0) feedIn = sy; else L(rs, fx0, prevY, fx0, sy, { w: 1.2, color: COL.line }); L(rs, fx0, sy, sx[0] - S * 0.45, sy, { w: 1.2, color: COL.line }); prevY = sy; }
      if (mode === 'jb' && sx.length) { const jx = jbBox.x + jbBox.w; if (gi === 0) L(rs, jx, sy, sx[0] - S * 0.45, sy, D); else { const vx = jbBox.x + jbBox.w / 2; L(rs, vx, jbBox.y + jbBox.h, vx, sy, D); L(rs, vx, sy, sx[0] - S * 0.45, sy, D); } }
      if (mode === 'loop' && pts.length) { const wy = pts[0].y - S * 0.9; // permanent live above the lights, roses as dots
        if (gi === 0) { feedIn = wy; L(rs, ix, wy, pts[pts.length - 1].x, wy, G); } else { L(rs, ix + 4, prevY, ix + 4, wy, G); L(rs, ix + 4, wy, pts[Math.min(pts.length, lper) - 1].x, wy, G); }
        prevY = wy;
        for (const pt of pts) if (pt.y === pts[0].y) { L(rs, pt.x, wy, pt.x, pt.y - S * 0.45, G); C(rs, pt.x, wy, S * 0.17, { fill: COL.line, lw: 0.8 }); }
        if (sx.length) L(rs, sx[0], wy, sx[0], sy - S * 0.45, D); }
      if (mode === 'loop' && !pts.length && sx.length) { const wy = sy - S * 0.9; if (gi === 0) { feedIn = wy; L(rs, ix, wy, sx[0], wy, G); } else L(rs, ix + 4, prevY, ix + 4, wy, G); prevY = wy; L(rs, sx[0], wy, sx[0], sy - S * 0.45, D); }
      // switched live along the row from the (far) switch to its lights, light to light
      if (pts.length) {
        if (outX != null) { const first = pts[0]; if (first.y === sy) L(rs, outX + S * 0.45, sy, first.x - S * 0.45, sy, mode === 'jb-switch' ? G : D);
          else { L(rs, outX, sy + S * 0.45, outX, first.y, G); L(rs, outX, first.y, first.x - S * 0.45, first.y, G); } }
        for (let q = 1; q < pts.length; q++) { const a = pts[q - 1], b = pts[q];
          if (a.y === b.y) L(rs, a.x + S * 0.45, a.y, b.x - S * 0.45, b.y, G); else { const ex = lx0 - S * 0.75; L(rs, a.x, a.y + S * 0.45, a.x, a.y + rowH / 2, G); L(rs, a.x, a.y + rowH / 2, ex, a.y + rowH / 2, G); L(rs, ex, a.y + rowH / 2, ex, b.y, G); L(rs, ex, b.y, b.x - S * 0.45, b.y, G); } }
        for (const pt of pts) symbol(rs, 'light', pt.x, pt.y, S);
        lastLy = pts[pts.length - 1].y; }
      bottom = Math.max(sy, lastLy) + S / 2; y = bottom + (mode === 'loop' ? S * 0.9 + 10 : 12) + S / 2;
    });
    if (!groups.some((g) => g.lights)) bottom += textLines(rs, x0, bottom + 2, 'No lights set', iw - (x0 - ix), { size: small, color: COL.na }) + 2;
    // v0.43.3: no wiring explanation sentence in the room box (the key explains the symbols)
    bottom += 4;
    return { bottom, feedIn, swX, swOut };
  }
  // v0.42 IEC 60617 contactor NO contact, vertical, top at (x, y0), height h:
  // fixed contact with a small semicircle, blade hinged at the bottom.
  // v0.43 BS EN 60617 single-line: switch-disconnector (blade, isolating bar at
  // the fixed contact) with two strokes on the lead for 2 poles. FCU: box with
  // the fuse symbol, plus the blade above it when switched.
  // v0.43.1: the CCU's 13 A outlet: a small socket hanging below the CCU box on a short lead
  function S0() { return F * 1.1; }
  function ccuSock(o, cx, top, S) { L(o, cx, top, cx, top + S * 0.18, { w: 0.9 }); symbol(o, 'socket1', cx, top + S * 0.18 + S * 0.42, S * 0.9); }
  function isoSym(o, x, y0, h, fcu = false, switched = true, ccu = false) {
    const g = { w: 1.2, color: COL.line };
    if (ccu) R(o, x - h * 0.3, y0 + h * 0.16, h * 0.6, h * 0.68, { lw: 0.9 });
    if (fcu) { const b = h * 0.55; let t = y0;
      if (switched) { const sb = y0 + h * 0.4; L(o, x, y0, x, y0 + h * 0.1, g); L(o, x, sb, x + h * 0.22, y0 + h * 0.12, g); t = sb; /* v0.43.1: blade on the far side, above the line in a left-to-right run */ } else L(o, x, y0, x, y0 + h * 0.4, g);
      const by = y0 + h * 0.42, bh = h * 0.5, bw = h * 0.5; R(o, x - bw / 2, by, bw, bh, { lw: 1, fill: [255, 255, 255] });
      R(o, x - bw * 0.16, by + bh * 0.15, bw * 0.32, bh * 0.7, { lw: 0.9, fill: [255, 255, 255] }); L(o, x, by + bh * 0.05, x, by + bh * 0.95, { w: 0.9 });
      L(o, x, t, x, by, g); L(o, x, by + bh, x, y0 + h, g); void b; return; }
    const top = y0 + h * 0.3, bot = y0 + h * 0.72;
    L(o, x, y0, x, top, g); L(o, x - h * 0.12, top, x + h * 0.12, top, g); // fixed contact with isolating bar
    L(o, x, bot, x - h * 0.26, top + h * 0.04, g); L(o, x, bot, x, y0 + h, g); // open blade, hinged at the bottom
    for (const d of [-0.06, 0.06]) L(o, x - h * 0.1, y0 + h * (0.86 + d) + h * 0.05, x + h * 0.1, y0 + h * (0.86 + d) - h * 0.05, { w: 1 });
  }
  // v0.43: draw a vertical in-line symbol (top at x,y0) turned to run left to right from (x, y0).
  // v0.43: where a conductor meets a load symbol on its row (half-width from centre)
  function loadR(k, S) { const r = S / 2; return k === 'light' ? r * 0.8 : k === 'fan' ? r * 0.85 : (k === 'socket' || k === 'socket1' || k === 'dpu' || k === 'dps') ? r * 0.75 : k === 'fcu' ? r * 0.85 : k === 'point' ? r * 0.7 : r; }
  function rotH(o, x0, y0, fn) { const tmp = []; fn(tmp); const P = (x, y) => [x0 + (y - y0), y0 - (x - x0)];
    for (const z of tmp) { if (z.t === 'line') { const [a, b] = P(z.x1, z.y1), [c2, d] = P(z.x2, z.y2); o.push({ ...z, x1: a, y1: b, x2: c2, y2: d }); }
      else if (z.t === 'rect') { const [a, b] = P(z.x + z.w, z.y); o.push({ ...z, x: a, y: b, w: z.h, h: z.w }); }
      else if (z.t === 'circle') { const [a, b] = P(z.x != null ? z.x : z.cx, z.y != null ? z.y : z.cy); o.push(z.cx != null ? { ...z, cx: a, cy: b } : { ...z, x: a, y: b }); }
      else o.push(z); } }
  function nocSym(o, x, y0, h) {
    const t = y0 + h * 0.3, b = y0 + h * 0.7, r = h * 0.08, g = { w: 1.2, color: COL.line };
    L(o, x, y0, x, t, g); L(o, x, b, x, y0 + h, g); L(o, x, b, x - h * 0.28, t + h * 0.02, g);
    for (let i = 0; i < 6; i++) { const a1 = Math.PI * i / 6, a2 = Math.PI * (i + 1) / 6; L(o, x - r * Math.cos(a1), t + r * Math.sin(a1), x - r * Math.cos(a2), t + r * Math.sin(a2), g); }
  }
  function coilSym(o, x, y0, w, h) {
    R(o, x, y0, w, h, { fill: [255, 255, 255] });
    T(o, x - 1, y0 - 1, 'A1', { anchor: 'end', size: small * 0.7 }); T(o, x - 1, y0 + h + small * 0.6, 'A2', { anchor: 'end', size: small * 0.7 });
  }
  function clockSym(o, x, y0, r) {
    C(o, x, y0, r, { lw: 1 }); L(o, x, y0, x, y0 - r * 0.7, { w: 1, color: COL.line }); L(o, x, y0, x + r * 0.5, y0, { w: 1, color: COL.line });
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
    else if (kind === 'socket' || kind === 'socket1') { // v0.43 BS EN 60617 11-13-02: socket outlet with protective (earth) contact:
      // dome (semicircle) open side down on its lead, earth contact = straight line across the top of the dome.
      // Twin (multiple outlet, 11-13-03 style) = two short strokes across the lead.
      // v0.43.5: drawn IN the cable: the dome's flat base sits on the line (cy), which runs in one side and out the other; no stem
      const rr = r * 0.75, by = cy - r * 0.45; // v0.43.5: BS EN 60617 layout style: the cable at cy comes up at an angle into the base and back down, a small V
      L(sh, cx - rr, cy, cx, by, { w: 1.1 }); L(sh, cx, by, cx + rr, cy, { w: 1.1 });
      arc(sh, cx, by, rr, Math.PI, 2 * Math.PI, { w: 1.2 });
      L(sh, cx - rr, by, cx + rr, by, { w: 1.1 });
      L(sh, cx - rr * 0.8, by - rr - r * 0.12, cx + rr * 0.8, by - rr - r * 0.12, { w: 1.2 });
      if (kind === 'socket') for (const o of [-0.16, 0.16]) L(sh, cx + r * o - r * 0.1, by - rr * 0.22, cx + r * o + r * 0.1, by - rr * 0.68, { w: 1 }); // twin: two strokes inside the dome
    }
    else if (kind === 'dpu' || kind === 'dps') { // v0.43.8: DP switch IN the cable (same V feed as a socket), a single socket spurred off its top
      const rr = r * 0.75, by = cy - r * 0.45, bw = r * 1.3, bh = r * 0.8, bt = by - bh;
      L(sh, cx - rr, cy, cx - bw * 0.3, by, { w: 1.1 }); L(sh, cx + bw * 0.3, by, cx + rr, cy, { w: 1.1 });
      R(sh, cx - bw / 2, bt, bw, bh, { lw: 1, fill: W0 });
      L(sh, cx - bw * 0.3, by - bh * 0.2, cx + bw * 0.28, bt + bh * 0.2, { w: 1 }); // the blade
      for (const o of [-0.08, 0.08]) L(sh, cx + bw * (o - 0.08), by - bh * 0.32 - bw * o * 0.5, cx + bw * (o + 0.08), by - bh * 0.62 - bw * o * 0.5, { w: 0.9 }); // // = two poles
      const sy = bt - r * 0.35; L(sh, cx, bt, cx, sy, { w: 1.1 }); // the spur up to its socket
      const sr = r * 0.6, sb = sy; arc(sh, cx, sb, sr, Math.PI, 2 * Math.PI, { w: 1.2 }); L(sh, cx - sr, sb, cx + sr, sb, { w: 1.1 }); L(sh, cx - sr * 0.8, sb - sr - r * 0.1, cx + sr * 0.8, sb - sr - r * 0.1, { w: 1.2 });
      if (kind === 'dps') { L(sh, cx + sr * 0.7, sb - sr * 0.7, cx + sr * 1.45, sb - sr * 1.45, { w: 1 }); L(sh, cx + sr * 1.45, sb - sr * 1.45, cx + sr * 1.75, sb - sr * 1.15, { w: 1 }); } // switched: the switch stroke off the dome
    }
    else if (kind === 'socketsw') { symbol(sh, 'socket1', cx, cy, S); const rr = r * 0.75, by = cy - r * 0.45; L(sh, cx + rr * 0.7, by - rr * 0.7, cx + rr * 1.45, by - rr * 1.45, { w: 1 }); L(sh, cx + rr * 1.45, by - rr * 1.45, cx + rr * 1.75, by - rr * 1.15, { w: 1 }); }
    else if (kind === 'cooker') { // cooker: box with four hob rings
      box(sh, cx, cy, r); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C(sh, cx + a * r * 0.45, cy + b * r * 0.45, r * 0.25, { lw: 0.8 }); }
    else if (kind === 'shower') { box(sh, cx, cy, r); L(sh, cx - r * 0.6, cy - r * 0.45, cx + r * 0.6, cy - r * 0.45, { w: 1.3 }); for (const a of [-0.45, 0, 0.45]) L(sh, cx + a * r, cy - r * 0.15, cx + a * r, cy + r * 0.6, { w: 0.8 }); }
    else if (kind === 'alarm') { // fire/smoke detector: box with the detector triangle
      box(sh, cx, cy, r); L(sh, cx - r * 0.6, cy - r * 0.45, cx + r * 0.6, cy - r * 0.45, { w: 1.1 }); L(sh, cx - r * 0.6, cy - r * 0.45, cx, cy + r * 0.6, { w: 1.1 }); L(sh, cx + r * 0.6, cy - r * 0.45, cx, cy + r * 0.6, { w: 1.1 }); }
    else if (kind === 'immersion') { // heating element: box with three diagonal element lines
      box(sh, cx, cy, r); for (const a of [-0.5, 0, 0.5]) L(sh, cx + (a - 0.3) * r, cy + r * 0.6, cx + (a + 0.3) * r, cy - r * 0.6, { w: 1 }); }
    else if (kind === 'heater') { // v0.43.3: heating element (as immersion) with a small 'Rad' label above
      box(sh, cx, cy, r); for (const a of [-0.5, 0, 0.5]) L(sh, cx + (a - 0.3) * r, cy + r * 0.6, cx + (a + 0.3) * r, cy - r * 0.6, { w: 1 });
      T(sh, cx, cy - r - 2, heatLab, { anchor: 'middle', bold: true, size: r * 0.62, color: COL.grey }); }
    else if (kind === 'ev') { box(sh, cx, cy, r); T(sh, cx, cy + r * 0.32, 'EV', { anchor: 'middle', bold: true, size: r * 0.9 }); }
    else if (kind === 'fan') { C(sh, cx, cy, r * 0.85, { fill: W0 }); for (const a of [0, 2.094, 4.189]) L(sh, cx, cy, cx + Math.cos(a) * r * 0.65, cy + Math.sin(a) * r * 0.65, { w: 1.4 }); C(sh, cx, cy, r * 0.15, { fill: COL.line }); }
    else if (kind === 'fcu') { // fused connection unit / spur outlet: box with the fuse symbol (rectangle, line through), flex outlet tail
      box(sh, cx, cy, r * 0.85); R(sh, cx - r * 0.5, cy - r * 0.2, r * 1.0, r * 0.4, { lw: 0.9, fill: W0 }); L(sh, cx - r * 0.75, cy, cx + r * 0.75, cy, { w: 0.9 });
      /* v0.43.3: no flex-outlet tail or dot (it read as a stray end) */ }
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
    if (opts.tap && b.ref) parts.push(`<g class="dgc" role="button" tabindex="0" data-bi="${b.ref.bi}" data-ci="${b.ref.ci}" data-mw="${b.ref.mw ? 1 : ''}" aria-label="Readings for circuit ${esc(b.num || '')}" style="cursor:pointer"><rect x="0" y="${y}" width="${L.W}" height="${b.h}" fill="transparent"/>${g}</g>`);
    else if (href && b.ref) { const u = href(b.ref); parts.push(`<a href="${esc(u)}" class="dgc" aria-label="Edit this circuit"><rect x="0" y="${y}" width="${L.W}" height="${b.h}" fill="transparent"/>${g}</a>`); }
    else parts.push(g);
    y += b.h;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.W} ${Math.ceil(y + 6)}" width="100%" font-family="Arimo, Arial, Helvetica, sans-serif" role="img" aria-label="Single-line wiring diagram">${parts.join('')}</svg>`;
}

// ---------- PDF ----------
// k: pdfkit Kit. Draws the layout block by block, starting a new page
// (via newPage) when a block won't fit. W units map to the content width.
export function drawDiagramPdf(k, cert, newPage, { bottom = 16 } = {}) {
  const L = layout(diagramModel(cert), { W: 560, font: 11, cableTable: true });
  const s = k.cw / L.W; const pt = s / 0.3528; const d = k.doc;
  // draw the shapes of one block whose layout y lies in [y0, y1), shifted up by y0; lines and boxes are clipped
  const draw = (b, y0, y1) => { const ox = k.x0, oy = k.y - y0 * s; const cy = (v) => Math.max(y0, Math.min(y1, v));
    for (const z of b.shapes) {
      if (z.t === 'line') { const lo = Math.min(z.y1, z.y2), hi = Math.max(z.y1, z.y2); if (hi < y0 || lo > y1) continue;
        let { x1, y1: a1, x2, y2: a2 } = z; if (a1 !== a2) { const f = (v) => x1 + (x2 - x1) * ((v - a1) / (a2 - a1)); const n1 = cy(a1), n2 = cy(a2); [x1, x2] = [f(n1), f(n2)]; a1 = n1; a2 = n2; }
        k.line(ox + x1 * s, oy + a1 * s, ox + x2 * s, oy + a2 * s, { w: z.w * s, color: z.color, dash: z.dash ? z.dash.map((v) => v * s) : null }); }
      else if (z.t === 'rect') { if (z.y + z.h < y0 || z.y > y1) continue; const ry = cy(z.y), rh = cy(z.y + z.h) - ry;
        if (!z.lw) { d.setFillColor(...z.fill); d.rect(ox + z.x * s, oy + ry * s, z.w * s, rh * s, 'F'); } else k.rect(ox + z.x * s, oy + ry * s, z.w * s, rh * s, { lw: z.lw * s, color: z.color, fill: z.fill }); }
      else if (z.t === 'circle') { if (z.cy < y0 || z.cy >= y1) continue; d.setDrawColor(...z.color); d.setLineWidth(z.lw * s); if (z.fill) { d.setFillColor(...z.fill); d.circle(ox + z.cx * s, oy + z.cy * s, z.r * s, 'FD'); } else d.circle(ox + z.cx * s, oy + z.cy * s, z.r * s, 'S'); }
      else { if (z.y < y0 || z.y >= y1) continue; k.font(z.size * pt, z.bold, z.color); d.text(String(z.txt), ox + z.x * s, oy + z.y * s, { align: z.anchor === 'middle' ? 'center' : 'left', baseline: 'alphabetic' }); }
    } };
  // v0.43.3: a block taller than a page (a lighting circuit with many rooms) is split at a clear gap, never clipped
  const cutAt = (b, lim) => { const busy = []; for (const z of b.shapes) { if (z.t === 'text') busy.push([z.y - z.size, z.y + z.size * 0.3]); else if (z.t === 'circle') busy.push([z.cy - z.r - 1, z.cy + z.r + 1]); }
    for (let y = lim; y > lim * 0.5; y -= 2) if (!busy.some(([a, c]) => y > a && y < c)) return y; return lim; };
  L.blocks.forEach((b, i) => {
    const nx = L.blocks[i + 1]; /* v0.43.3: keep a board / RCD heading with its first circuit */
    if (!b.ref && nx && nx.ref && b.h < 120 && k.y + (b.h + Math.min(nx.h, 200)) * s > k.H - bottom) newPage();
    const huge = b.h * s > (k.H - bottom) * 0.8; /* taller than a page: split here rather than leave a blank page */
    if (k.y + b.h * s > k.H - bottom && !(huge && k.H - bottom - k.y > 60)) newPage();
    let y0 = 0;
    while ((b.h - y0) * s > k.H - bottom - k.y) { const y1 = cutAt(b, y0 + (k.H - bottom - k.y) / s); if (y1 <= y0 + 10) break; draw(b, y0, y1); y0 = y1; newPage(); }
    draw(b, y0, b.h); k.y += (b.h - y0) * s;
  });
}
// On by default; cert.diagramPdf === false leaves it out of the PDF.
export const diagramInPdf = (cert) => Boolean(cert) && cert.diagramPdf !== false && diagramHasCircuits(cert);
export const diagramHasCircuits = (cert) => (cert && cert.type === 'MW' ? Boolean(cert.mw && cert.mw.circuit && (cert.mw.circuit.desc || cert.mw.circuit.rating)) : (cert && cert.boards || []).some((b) => (b.circuits || []).length));
