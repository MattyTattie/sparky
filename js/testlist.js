// =====================================================================
// testlist.js (v0.14) — the "Test across circuits" view, plain logic only
// (no DOM, so it can be tested in node). One test at a time, in the order
// you'd go round with the meter: dead tests first, then live tests.
// =====================================================================
import { isSpareCircuit, autoNA } from './templates.js';
import { isRingLike } from './checks.js';

export const TEST_STEPS = [
  { id: 'r1r2', title: 'Continuity: (R1 + R2) / R2', short: 'R1+R2', dead: true, keys: ['r1r2', 'R2'], hint: 'Enter R1+R2, or R2 if you used the wander lead. One is enough.' },
  { id: 'ring', title: 'Ring final circuits: r1, rn, r2', short: 'Ring', dead: true, keys: ['r1', 'rn', 'r2'], only: 'ring', hint: 'End-to-end readings. Only ring final circuits are listed with boxes.' },
  { id: 'ir', title: 'Insulation resistance', short: 'IR', dead: true, keys: ['irV', 'irLL', 'irLE'], hint: 'Test voltage, then Live–Live and Live–Earth in MΩ. Tap >999 for an over-range reading.' },
  { id: 'pol', title: 'Polarity', short: 'Polarity', dead: true, keys: ['pol'], hint: 'Tap ✓ for correct polarity.' },
  { id: 'zs', title: 'Earth fault loop impedance Zs', short: 'Zs', dead: false, keys: ['zs'], hint: 'Measured Zs at the furthest point. The max Zs for each circuit is shown.' },
  { id: 'rcd', title: 'RCD: trip time and test button', short: 'RCD', dead: false, keys: ['rcdMs', 'rcdBtn'], hint: 'Trip time in ms at IΔn, and ✓ when the test button works.' },
];
export const stepById = (id) => TEST_STEPS.find((s) => s.id === id) || TEST_STEPS[0];
export const stepIndex = (id) => Math.max(0, TEST_STEPS.findIndex((s) => s.id === id));
export const prevStep = (id) => TEST_STEPS[stepIndex(id) - 1] || null;
export const nextStep = (id) => TEST_STEPS[stepIndex(id) + 1] || null;

const hasVal = (v) => String(v ?? '').trim() !== '';
const isNA = (v) => /^n\/?a$/i.test(String(v ?? '').trim());
export const hasRcd = (c) => (hasVal(c.rcdIdn) && !isNA(c.rcdIdn)) || c.device === 'rcbo' || /6100[89]|62423/.test(String(c.rcdBs || ''));

// How a circuit shows for a step:
//   { mode: 'skip', why }  greyed out, no boxes (spare way, not a ring)
//   { mode: 'edit', note } boxes shown (note = a gentle hint, e.g. no RCD recorded)
export function rowMode(c, stepId) {
  const s = stepById(stepId);
  if (isSpareCircuit(c)) return { mode: 'skip', why: c.noDevice ? 'Spare way, no device fitted' : 'Spare way' };
  if (s.only === 'ring' && !isRingLike(c)) return { mode: 'skip', why: 'Not a ring final circuit' };
  if (s.id === 'r1r2' && isRingLike(c)) return { mode: 'edit', note: 'Ring: cross-connect line and CPC (figure-of-eight) at the board, then measure at each socket. Record the highest reading.' };
  if (s.id === 'rcd' && !hasRcd(c)) return { mode: 'edit', note: 'No RCD recorded on this circuit. Tap N/A if there isn\u2019t one.' };
  return { mode: 'edit' };
}
// Quick-fill buttons next to a box.
export function quickFor(k) {
  if (k === 'irLL' || k === 'irLE') return ['>999', 'N/A'];
  if (k === 'pol' || k === 'rcdBtn') return ['✓', 'N/A'];
  if (k === 'irV') return ['250', '500'];
  return ['N/A'];
}
// v0.15: is a circuit done for a step? A typed N/A only counts where it's a
// deliberate answer, not where a reading is needed:
//   R1+R2: a real reading in R1+R2 or R2 (N/A in the other is fine).
//   IR: the voltage and at least one real reading (the other may be N/A).
//   RCD: on a circuit with an RCD the trip time must be a real reading;
//        without one, N/A in both is the right answer.
// Auto N/A (spares) still counts as filled.
const real = (v) => hasVal(v) && !isNA(v);
export function stepDone(c, s) {
  if (typeof s === 'string') s = stepById(s);
  const filled = (k) => hasVal(c[k]) || autoNA(c, k);
  if (s.id === 'r1r2') return real(c.r1r2) || real(c.R2);
  if (s.id === 'ir') return filled('irV') && filled('irLL') && filled('irLE') && (real(c.irLL) || real(c.irLE));
  if (s.id === 'rcd' && hasRcd(c)) return real(c.rcdMs) && filled('rcdBtn');
  return s.keys.every(filled);
}
// Count of circuits with every box for the step filled (shown in the header).
export function progress(b, stepId) {
  const s = stepById(stepId); let need = 0, done = 0;
  for (const c of b.circuits) {
    if (rowMode(c, stepId).mode === 'skip') continue; need++;
    const ok = stepDone(c, s);
    if (ok) done++;
  }
  return { need, done };
}
// "Fill all empty" for a step (e.g. polarity ✓ on every circuit). Never overwrites.
export function fillEmpty(b, stepId, k, v) {
  let n = 0;
  for (const c of b.circuits) if (rowMode(c, stepId).mode === 'edit' && !hasVal(c[k])) { c[k] = v; n++; }
  return n;
}
