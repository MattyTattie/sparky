// =====================================================================
// diagrampro.js — v0.41 (test): wiring diagram extras that aren't drawing.
// Readings popup data, saved diagram templates (kept in app settings, never
// in the certificate) and the tidy-up of manual room layouts.
// =====================================================================
import { checkCircuit } from './checks.js';
import { arrangedOrder } from './wiring.js';

const v = (x) => { const s = String(x ?? '').trim(); return s && !/^n\/?a$/i.test(s) ? s : ''; };

// Readings popup: one row per reading, with the limit and a red/amber level.
export function circuitReadings(c, ctx = {}) {
  let r = { flags: {}, maxZs: null };
  try { r = checkCircuit(c || {}, ctx); } catch { /* old data: just show the numbers */ }
  const f = r.flags || {}; const lv = (k) => (f[k] ? f[k].level : null);
  const worst = (...ks) => (ks.some((k) => lv(k) === 'red') ? 'red' : ks.some((k) => lv(k) === 'amber') ? 'amber' : null);
  c = c || {};
  return [
    { label: 'Zs', value: v(c.zs) ? v(c.zs) + ' \u03a9' : '', note: r.maxZs != null ? `max ${r.maxZs} \u03a9` : '', level: lv('zs') },
    { label: 'R1+R2', value: v(c.r1r2) ? v(c.r1r2) + ' \u03a9' : (v(c.R2) ? 'R2 ' + v(c.R2) + ' \u03a9' : ''), note: '', level: lv('r1r2') },
    { label: 'IR L-L / L-E', value: v(c.irLL) || v(c.irLE) ? `${v(c.irLL) || 'N/A'} / ${v(c.irLE) || 'N/A'} M\u03a9` : '', note: v(c.irV) ? `at ${v(c.irV)} V` : '', level: worst('irLL', 'irLE') },
    { label: 'RCD time', value: v(c.rcdMs) ? v(c.rcdMs) + ' ms' : '', note: '', level: worst('rcdMs', 'rcdBtn') },
    { label: 'Polarity', value: v(c.pol), note: '', level: lv('pol') },
  ];
}

// Saved diagram templates. Stored under the settings key 'diagramTemplates'.
export const TEMPLATE_KEY = 'diagramTemplates';
export const BUILTIN_TEMPLATES = [
  { name: 'JB to each switch', builtin: true, wiring: 'jb-switch', room: { lights: 1, sw1: 1, sw2pairs: 0, swi: 0 } },
];
const ROOM_KEYS = ['name', 'lights', 'sw1', 'sw2pairs', 'swi', 'wiring'];
const WIRINGS = ['loop-in', 'junction box', 'jb-switch'];
export function makeTemplate(c, name) {
  const d = (c && c.diagram) || {}; const rooms = Array.isArray(d.roomList) ? d.roomList : [];
  const order = arrangedOrder(c);
  const t = { name: String(name || '').trim() || 'My template', rooms: order.map((i) => Object.fromEntries(ROOM_KEYS.filter((k) => rooms[i] && rooms[i][k] !== undefined).map((k) => [k, rooms[i][k]]))) };
  const w = rooms.map((r) => r && r.wiring).filter(Boolean); if (w.length) t.wiring = w.sort((a, b) => w.filter((x) => x === b).length - w.filter((x) => x === a).length)[0];
  if (rooms[0]) t.room = { lights: +rooms[0].lights || 1, sw1: +rooms[0].sw1 || 0, sw2pairs: +rooms[0].sw2pairs || 0, swi: +rooms[0].swi || 0 };
  for (const k of ['sw1', 'sw2', 'swi']) if (d[k] !== undefined && d[k] !== '') (t.sw = t.sw || {})[k] = d[k];
  if (c && c.control && c.control.via && c.control.via !== 'none') t.control = { via: c.control.via }; // which circuit feeds the coil is job-specific, so not kept
  return t;
}
// Returns a new diagram object for the circuit (and control). Never touches readings.
export function applyTemplate(c, t) {
  const d = { ...((c && c.diagram) || {}) }; const cur = Array.isArray(d.roomList) ? d.roomList : [];
  const wiring = WIRINGS.includes(t.wiring) ? t.wiring : null;
  if (cur.length) d.roomList = cur.map((r) => ({ ...r, ...(wiring ? { wiring } : {}) }));
  else if (Array.isArray(t.rooms) && t.rooms.length) { d.roomList = t.rooms.map((r) => ({ name: '', lights: 1, sw1: 1, sw2pairs: 0, swi: 0, wiring: 'loop-in', ...r, ...(wiring && !r.wiring ? { wiring } : {}) })); delete d.layout; }
  else if (t.room) d.roomList = [{ name: '', lights: 1, sw1: 1, sw2pairs: 0, swi: 0, ...t.room, wiring: wiring || 'loop-in' }];
  if (t.sw) Object.assign(d, t.sw);
  const control = t.control ? { ...((c && c.control) || {}), via: t.control.via } : (c && c.control);
  return { diagram: d, control };
}
// The next room added copies the last room's switch and wiring (so a JB-to-switch job stays that way).
export function nextRoom(list) {
  const last = (list || [])[list.length - 1];
  if (!last) return { name: '', lights: 1, sw1: 1, sw2pairs: 0, swi: 0, wiring: 'loop-in' };
  return { name: '', lights: 1, sw1: +last.sw1 || 0, sw2pairs: +last.sw2pairs || 0, swi: +last.swi || 0, wiring: last.wiring || 'loop-in' };
}
// Tidy up: every circuit's manual room order cleaned (bad or duplicate slots
// dropped) and snapped back into neat slots; resetOrder also puts the rooms
// back in the order they were added. Returns how many circuits changed.
export function tidyLayouts(cert, { resetOrder = false } = {}) {
  const all = cert.type === 'MW' ? [cert.mw && cert.mw.circuit].filter(Boolean) : (cert.boards || []).flatMap((b) => b.circuits || []);
  let n = 0;
  for (const c of all) {
    const d = c.diagram; if (!d || !d.layout) continue;
    const o = arrangedOrder(c); const plain = o.every((x, i) => x === i);
    const nd = { ...d };
    if (resetOrder || plain) delete nd.layout; else nd.layout = { order: o };
    if (JSON.stringify(nd) !== JSON.stringify(d)) { c.diagram = nd; n++; }
  }
  return n;
}
