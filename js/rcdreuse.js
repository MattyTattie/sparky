// =====================================================================
// rcdreuse.js (v0.46.0) — enter an RCD's trip time once and put it on
// every circuit that RCD protects (RCBOs stay per circuit). Groups come
// from the same rule the wiring diagram uses (same BS, type, IΔn, rating;
// a board with two identical RCDs gives one group, so circuits can be
// unticked). Typed times are only replaced if you agree. Pure (no DOM).
// =====================================================================
import { groupCircuits } from './wiring.js';

const blank = (v) => v == null || String(v).trim() === '';
// Shared RCDs on a board: [{ key, label, circuits: [circuit objects] }] (2 or more circuits, RCBOs excluded)
export const rcdGroups = (b) => groupCircuits((b && b.circuits) || [], b).filter((it) => it.kind === 'rcd' && it.circuits.length >= 2).map((it) => ({ key: it.key, label: it.label, circuits: it.circuits }));
// The time already common to all of them ('' if none or they differ)
export function commonTime(circuits) { const v = [...new Set(circuits.map((c) => String(c.rcdMs ?? '').trim()))]; return v.length === 1 ? v[0] : ''; }
export function planRcdTime(circuits, ms) {
  ms = String(ms ?? '').trim(); const set = [], clash = [];
  for (const c of circuits) { if (blank(c.rcdMs)) set.push(c); else if (String(c.rcdMs).trim() !== ms) clash.push({ c, from: String(c.rcdMs).trim() }); }
  return { ms, set, clash };
}
// Returns the undo list [[circuit, previous value or undefined], ...]
export function applyRcdTime(plan, { replace = false } = {}) {
  const undo = [];
  for (const c of [...plan.set, ...(replace ? plan.clash.map((x) => x.c) : [])]) { undo.push([c, Object.prototype.hasOwnProperty.call(c, 'rcdMs') ? c.rcdMs : undefined]); c.rcdMs = plan.ms; }
  return undo;
}
export const undoRcdTime = (undo) => { for (const [c, v] of undo) { if (v === undefined) delete c.rcdMs; else c.rcdMs = v; } };
