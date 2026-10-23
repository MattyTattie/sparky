// usecore.js — v0.19 "Use on a circuit": the sums, no screen. Works out exactly which circuit boxes
// a calculator result changes, applies them, and puts them back (Undo). Only cable and device boxes
// are ever touched, never test results.
import { CABLE_PICKS, SINGLES_CPC, TAILS_CPC } from './cables.js';
import { deviceById } from './limits.js';

// Calculator cable table (+ CPC choice) → circuit-page cable picker key (or '' to type sizes in).
export function pickFor(cable, cpcMode = 'core') {
  const m = { te: 'te', te3: 'te3', swa: 'swa2', swa4: 'swa4a', swa4X: 'swa4aX', h07: 'h07r3', h073: 'h07r5', tails: 'tails', flex: 'flex', tri: 'tri', tri3: 'tri', sycy: 'sycy', sycy3: 'sycy', singles: 'singles', singles3: 'singles3' };
  if (cable === 'swa3') return cpcMode === 'armour' ? 'swa3a' : 'swa3c';
  if (cable === 'swa3X') return cpcMode === 'armour' ? 'swa3aX' : 'swa3cX';
  return m[cable] || '';
}
// The fields "Use on a circuit" may change. Everything else on the circuit is left alone.
export const USE_FIELDS = ['cable', 'cableSize', 'live', 'cpc', 'wiring', 'device', 'bs', 'type', 'rating', 'im', 'ig', 'tg'];
export const FIELD_NAMES = { cable: 'Cable type', cableSize: 'Cable size', live: 'Live mm² (col 7)', cpc: 'CPC mm² (col 8)', wiring: 'Type of wiring (col 3)', device: 'Protective device', bs: 'BS (EN) (col 8)', type: 'Type / curve (col 9)', rating: 'Rating A (col 10)', im: 'Magnetic trip Im (A)', ig: 'Earth fault setting Ig (A)', tg: 'Earth fault time tg (s)' };
// res = { cable, size, cpc, device, curve, rating, cpcMode } from the calculator answer.
export function newValues(res, circuit = {}) {
  const key = pickFor(res.cable, res.cpcMode); const p = CABLE_PICKS[key];
  const out = {};
  if (p && String(res.size) in p.sizes) {
    const cp = p.sizes[res.size];
    Object.assign(out, { cable: key, cableSize: String(res.size), live: String(res.size), cpc: cp === 'armour' ? 'SWA' : cp === 'none' ? 'N/A' : String(cp) });
    if (!circuit.wiring) out.wiring = p.wiring;
  } else {
    const cpc = res.cpc === 'armour' ? 'SWA' : res.cpc != null ? String(res.cpc) : String(SINGLES_CPC[res.size] ?? TAILS_CPC[res.size] ?? '');
    Object.assign(out, { cable: '', cableSize: '', live: String(res.size), cpc });
  }
  const d = deviceById(res.device);
  if (d) Object.assign(out, { device: d.id, bs: d.bs, type: d.adj ? '' : String(res.curve || ''), rating: String(res.rating) });
  if (d && d.adj && Number(res.im) > 0) out.im = String(res.im); // v0.20: MPCB/MCCB magnetic trip
  if (d && d.adj === 'mccb' && Number(res.ig) > 0) { out.ig = String(res.ig); if (Number(res.tg) > 0) out.tg = String(res.tg); } // v0.25
  return out;
}
// What would change: [{ k, name, from, to }] (only boxes whose value actually changes).
// Plain names for the preview (the picker key "swa4a" → "4-core SWA (armour as CPC)", "mcb" → "MCB").
export function showValue(k, v) {
  if (v === '' || v == null) return '';
  if (k === 'cable') return (CABLE_PICKS[v] || {}).label || String(v);
  if (k === 'device') { const d = deviceById(v); return d ? d.label.split(' (')[0] : String(v); }
  return String(v);
}
export function planUse(circuit, res) {
  const nv = newValues(res, circuit);
  return Object.entries(nv).filter(([k, v]) => String(circuit[k] ?? '') !== String(v)).map(([k, v]) => ({ k, name: FIELD_NAMES[k] || k, from: circuit[k] ?? '', to: v, fromText: showValue(k, circuit[k]), toText: showValue(k, v) }));
}
// Apply; returns an undo snapshot that restores the previous values exactly (missing keys removed).
export function applyUse(circuit, res) {
  const nv = newValues(res, circuit);
  const snap = {}; for (const k of USE_FIELDS) snap[k] = Object.prototype.hasOwnProperty.call(circuit, k) ? { had: true, v: circuit[k] } : { had: false };
  Object.assign(circuit, nv);
  return snap;
}
export function undoUse(circuit, snap) {
  for (const [k, s] of Object.entries(snap)) { if (s.had) circuit[k] = s.v; else delete circuit[k]; }
  return circuit;
}
