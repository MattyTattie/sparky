// =====================================================================
// calc.js — the sums behind the calculators. Plain JS, tested with Node.
// =====================================================================
import { CABLES, CA, CG, CF_BS3036, CABLE_TEMP } from './cables.js';
import { UO, VOLT_DROP } from './limits.js';

const r2 = (n) => Math.round(n * 100) / 100;

// Volt drop: mV/A/m × Ib × L / 1000 (Appendix 4 section 6.1).
export function voltDrop({ cable = 'te', size, ib, length, lighting = false, uo = UO }) {
  const c = CABLES[cable]; if (!c) throw new Error('Unknown cable');
  const mv = c.mvam[size]; if (mv == null) return { ok: false, error: 'No volt drop figure for that size' };
  const v = (mv * Number(ib) * Number(length)) / 1000;
  const pct = (v / uo) * 100;
  const limitPct = lighting ? VOLT_DROP.lightingPct : VOLT_DROP.otherPct;
  return { ok: true, mvam: mv, volts: r2(v), pct: r2(pct), limitPct, limitV: r2((uo * limitPct) / 100), pass: pct <= limitPct };
}

// Cable sizing, the simple route: In ≥ Ib, then It ≥ In / (Ca × Cg × Ci × Cf),
// then check volt drop. Returns the smallest size that passes both.
export function sizeCable({ cable = 'te', method = 'C', ib, inA, length, ambient = 30, grouped = 1, grouping = 'bunched', insulationCi = 1, bs3036 = false, lighting = false }) {
  const c = CABLES[cable]; const m = c && c.methods[method];
  if (!m) return { ok: false, error: 'Pick a cable and installation method' };
  if (!(Number(inA) >= Number(ib))) return { ok: false, error: 'The device rating (In) must be at least the design current (Ib).' };
  const temp = CABLE_TEMP[cable] || 70;
  const ca = CA[temp][ambient] ?? 1;
  const cg = (CG[grouping] || CG.bunched)[Math.min(9, Math.max(1, Number(grouped) || 1))] ?? 1;
  const ci = Number(insulationCi) || 1;
  const cf = bs3036 ? CF_BS3036 : 1;
  const factor = ca * cg * ci * cf;
  const needIt = Number(inA) / factor;
  const rows = c.sizes.map((s) => {
    const it = m.amps[s];
    const vd = length ? voltDrop({ cable, size: s, ib, length, lighting }) : null;
    return { size: s, it, iz: it == null ? null : r2(it * factor), currentOk: it != null && it >= needIt, vd };
  });
  const pick = rows.find((r) => r.currentOk && (!r.vd || r.vd.pass)) || null;
  return { ok: true, factors: { ca, cg, ci, cf, total: r2(factor) }, needIt: r2(needIt), rows, pick,
    assumptions: [
      'Copper cable, single-phase 230 V, from the tables in BS 7671 Appendix 4.',
      'Overload protection by the device (In ≥ Ib, It ≥ In ÷ correction factors).',
      'Volt drop at the design current Ib against 3% for lighting or 5% for other uses, from the origin. If the board is a sub-main, add its own drop.',
      'Doesn\u2019t check fault protection (Zs), short-circuit withstand or harmonics. Always check against the regs.',
    ] };
}

// Expected (R1+R2) from cable resistances (Ω per metre at 20 °C, GN3 Table B1-ish).
export const MOHM_PER_M = { 1: 18.1, 1.5: 12.1, 2.5: 7.41, 4: 4.61, 6: 3.08, 10: 1.83, 16: 1.15 };
export function expectedR1R2(live, cpc, length) {
  const a = MOHM_PER_M[live], b = MOHM_PER_M[cpc];
  if (a == null || b == null || !length) return null;
  return r2(((a + b) * Number(length)) / 1000);
}
