// =====================================================================
// calc.js — the sums behind the calculators. Plain JS, tested with Node.
// =====================================================================
import { CABLES, CA, CA_NOTES, CG, CF_BS3036, CABLE_TEMP, CU_MOHM_PER_M, ARMOUR_MOHM_PER_M, TEMP_MULT, CU5_MOHM_PER_M } from './cables.js';
import { UO, VOLT_DROP, maxZs } from './limits.js';

const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;

// Ring final circuits: the two legs share the current.
//  'point'  = whole load at the far point of the ring: ¼ of the drop of a radial the length of the ring.
//  'spread' = load spread evenly round the ring: ⅛.
export const RING_DIVISOR = { point: 4, spread: 8 };

// Volt drop: mV/A/m × Ib × L / 1000 (Appendix 4 section 6.1); ring: ÷ 4 or ÷ 8 of the loop length.
export function voltDrop({ cable = 'te', size, ib, length, lighting = false, uo = UO, ring = false }) {
  const c = CABLES[cable]; if (!c) throw new Error('Unknown cable');
  const mv = c.mvam[size]; if (mv == null) return { ok: false, error: 'No volt drop figure for that size' };
  const div = ring ? RING_DIVISOR[ring] || 4 : 1;
  const v = (mv * Number(ib) * Number(length)) / 1000 / div;
  const pct = (v / uo) * 100;
  const limitPct = lighting ? VOLT_DROP.lightingPct : VOLT_DROP.otherPct;
  return { ok: true, mvam: mv, divisor: div, volts: r2(v), pct: r2(pct), limitPct, limitV: r2((uo * limitPct) / 100), pass: pct <= limitPct };
}

export function ambientFactor(cable, ambient) {
  const temp = CABLE_TEMP[cable] || 70;
  return { ca: CA[temp][ambient] ?? 1, note: CA_NOTES[ambient] || '' };
}

// Cable sizing, the simple route: In ≥ Ib, then It ≥ In / (Ca × Cg × Ci × Cf),
// then volt drop. Ring finals (433.1.204): 2.5 mm² on a 30/32 A device only
// needs Iz ≥ 20 A; anything else is treated like a radial.
// v0.9: uo = 400 (line voltage) for a three-phase cable: volt drop % of 400 V.
export function sizeCable({ cable = 'te', method = 'C', ib, inA, length, ambient = 30, grouped = 1, grouping = 'bunched', insulationCi = 1, bs3036 = false, lighting = false, ring = false, uo = UO }) {
  const c = CABLES[cable]; const m = c && c.methods[method];
  if (!m) return { ok: false, error: 'Pick a cable and installation method' };
  if (!(Number(inA) >= Number(ib))) return { ok: false, error: 'The device rating (In) must be at least the design current (Ib).' };
  let { ca, note: caNote } = ambientFactor(cable, ambient);
  if (/^D/.test(method)) { ca = 1; caNote = 'Buried (method D): the tables assume 20 °C ground; the air-temperature factor isn\u2019t used. Check ground temperature and soil (Tables 4B2, 4B3).'; }
  const cg = (CG[grouping] || CG.bunched)[Math.min(9, Math.max(1, Number(grouped) || 1))] ?? 1;
  const ci = Number(insulationCi) || 1;
  const cf = bs3036 ? CF_BS3036 : 1;
  const factor = ca * cg * ci * cf;
  // 433.1.204 is written for 2.5 mm² copper rings on 30/32 A; anything else needs Iz ≥ In like a radial.
  const ringRule = (s) => ring && [30, 32].includes(Number(inA)) && s >= 2.5;
  const needFor = (s) => (ringRule(s) ? 20 : Number(inA));
  const rows = c.sizes.map((s) => {
    const it = m.amps[s];
    const vd = length ? voltDrop({ cable, size: s, ib, length, lighting, ring, uo }) : null;
    return { size: s, it, iz: it == null ? null : r2(it * factor), needIz: needFor(s), needIt: r2(needFor(s) / factor), currentOk: it != null && it >= needFor(s) / factor, vd };
  });
  const needIz = ring && [30, 32].includes(Number(inA)) ? 20 : Number(inA);
  const needIt = needIz / factor;
  const pick = rows.find((r) => r.currentOk && (!r.vd || r.vd.pass)) || null;
  return { ok: true, factors: { ca, cg, ci, cf, total: r2(factor) }, needIz: r2(needIz), needIt: r2(needIt), rows, pick, caNote,
    assumptions: [
      c.phase === 3 ? `Copper cable, three-phase ${uo} V balanced load (Ib per phase), BS 7671 Appendix 4 three-phase columns. Volt drop is a % of ${uo} V. Zs is phase to earth (Uo 230 V). ⚠ Three-phase figures typed in from memory: check them against your copy of Appendix 4.` : 'Copper cable, single-phase 230 V, from the tables in BS 7671 Appendix 4.',
      ring ? 'Ring final: with 2.5 mm² or bigger on a 30/32 A device, Iz must be at least 20 A (Regulation 433.1.204); anything else is sized like a radial (Iz ≥ In). Volt drop over the ring\u2019s total loop length, ÷ ' + (RING_DIVISOR[ring] || 4) + '.'
        : 'Overload protection by the device (In ≥ Ib, It ≥ In ÷ correction factors).',
      'Volt drop at the design current Ib against 3% for lighting or 5% for other uses, from the origin. If the board is a sub-main, add its own drop.',
      'Doesn\u2019t check short-circuit withstand, the adiabatic CPC check (543.1.3) or harmonics. Always check against the regs.',
    ] };
}

// Expected (R1+R2) at 20 °C, Ω — what you'd measure. cpc = csa number, or 'armour'.
// Ring: end-to-end (r1 + r2) ÷ 4 at any socket on a sound ring, using the loop length.
export const MOHM_PER_M = CU_MOHM_PER_M;
export function r1r2At20({ live, cpc, length, cores = 2, ring = false, rTable = null }) {
  const R = rTable === 'cu5' ? CU5_MOHM_PER_M : CU_MOHM_PER_M; // v0.19: fine-stranded flexes (class 5)
  const a = R[live];
  const b = cpc === 'armour' ? (ARMOUR_MOHM_PER_M[cores] || ARMOUR_MOHM_PER_M[3])[live] : R[cpc];
  if (a == null || b == null || !Number(length)) return null;
  const r = ((a + b) * Number(length)) / 1000;
  return r3(ring ? r / 4 : r);
}
export function expectedR1R2(live, cpc, length) { const v = r1r2At20({ live, cpc, length }); return v == null ? null : r2(v); }

// Design check of Zs: Ze + (R1+R2) × temperature multiplier, against the BS 7671 max Zs for the device.
export function designZs({ ze, cable = 'te', live, cpc, length, ring = false, device, type, rating, time = 0.4 }) {
  const c = CABLES[cable] || {}; const temp = CABLE_TEMP[cable] || 70;
  const r20 = r1r2At20({ live, cpc, length, cores: c.cores || 2, ring, rTable: c.rTable || null }); // v0.20: flexes use class 5 copper
  const max = maxZs({ device, type, rating, time });
  if (r20 == null) return { ok: false, max, error: 'Need cable sizes and a length' };
  const mult = TEMP_MULT[temp] || 1.2;
  const rHot = r3(r20 * mult);
  const zs = ze === '' || ze == null || isNaN(Number(ze)) ? null : r2(Number(ze) + rHot);
  return { ok: true, r20, mult, rHot, zs, max, pass: zs == null || max == null ? null : zs <= max,
    armour: cpc === 'armour', note: cpc === 'armour' ? 'Armour resistance from maker\u2019s data (check your cable); the armour must also pass the adiabatic check (543.1.3).' : '' };
}
// Length of cable a measured R1+R2 corresponds to (a sanity check on the circuit page).
export function lengthFromR1R2({ r1r2, live, cpc, cores = 2, rTable = null }) {
  const per = r1r2At20({ live, cpc, length: 1000, cores, rTable }); const v = Number(String(r1r2).replace(/^[<>]/, ''));
  if (per == null || !v) return null; return Math.round((v / per) * 1000);
}
