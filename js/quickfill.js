// =====================================================================
// quickfill.js (v0.46.0) — Ring / Radial / Lights quick fill on a
// circuit's test results. Fills the usual "nothing found" answers
// (IR >999 at 500 V, polarity ✓, test buttons) and sets the ring tick, so
// r1/rn/r2 show N/A on a radial (as they already do when it isn't a ring).
// Only empty boxes are filled unless you agree to replace typed ones, and
// every fill can be undone. Pure (no DOM); same circuit keys as before.
// =====================================================================
import { hasRcd } from './testlist.js';
import { isRingCircuit } from './templates.js';

export const QUICK = { ring: 'Ring', radial: 'Radial', lights: 'Lights' };
const blank = (v) => v == null || String(v).trim() === '';
const hasAfdd = (c) => ['afddBs', 'afddType', 'afddRating'].some((k) => !blank(c[k]));

// What a quick fill would set on circuit c: { set: {k: v} (empty boxes), clash: [{k, from, to}] (typed boxes that differ), ring }
export function planQuick(c, kind) {
  if (!QUICK[kind]) throw new Error('Unknown quick fill ' + kind);
  const want = { irV: '500', irLL: '>999', irLE: '>999', pol: '\u2713', R2: 'N/A' };
  if (hasRcd(c)) want.rcdBtn = '\u2713'; else { want.rcdBtn = 'N/A'; want.rcdMs = 'N/A'; }
  if (!hasAfdd(c)) want.afddBtn = 'N/A';
  const set = {}; const clash = [];
  for (const [k, v] of Object.entries(want)) {
    if (blank(c[k])) set[k] = v;
    else if (String(c[k]).trim() !== v) clash.push({ k, from: String(c[k]).trim(), to: v });
  }
  const ring = kind === 'ring';
  const ringNow = isRingCircuit(c);
  // the ring tick: a typed ring reading or an explicit tick the other way counts as typed
  let ringSet = null, ringClash = false;
  if (ringNow !== ring) { if (c.ring === !ring || (!ring && ['r1', 'rn', 'r2'].some((k) => !blank(c[k])))) ringClash = true; else ringSet = ring; }
  else if (c.ring !== ring) ringSet = ring; // make it explicit, so the guess from the description can't flip it later
  return { kind, set, clash, ring, ringSet, ringClash };
}
// Apply a plan. replace: also overwrite the typed boxes in plan.clash (and the ring tick). Returns the undo snapshot.
export function applyQuick(c, plan, { replace = false } = {}) {
  const undo = { vals: {}, ring: Object.prototype.hasOwnProperty.call(c, 'ring') ? c.ring : undefined, hadRing: Object.prototype.hasOwnProperty.call(c, 'ring') };
  const put = (k, v) => { if (!(k in undo.vals)) undo.vals[k] = Object.prototype.hasOwnProperty.call(c, k) ? c[k] : undefined; c[k] = v; };
  for (const [k, v] of Object.entries(plan.set)) put(k, v);
  if (replace) for (const x of plan.clash) put(x.k, x.to);
  if (plan.ringSet != null || (replace && plan.ringClash)) c.ring = plan.ring;
  undo.n = Object.keys(undo.vals).length;
  return undo;
}
export function undoQuick(c, undo) {
  for (const [k, v] of Object.entries(undo.vals)) { if (v === undefined) delete c[k]; else c[k] = v; }
  if (undo.hadRing) c.ring = undo.ring; else delete c.ring;
}
