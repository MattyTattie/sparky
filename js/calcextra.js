// =====================================================================
// calcextra.js — v0.19 sums for three small calculators: control circuit
// transformer, contactor picker and fault level at a sub-board. Plain JS,
// tested by tests/v19.test.js. Every figure marked TYPICAL is shown in the
// app with "typical, check your books / the maker".
// =====================================================================
import { UO, CMIN } from './limits.js';
import { UL, CU_MOHM_PER_M, CU5_MOHM_PER_M, ARMOUR_MOHM_PER_M, CABLES } from './cables.js';
const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;

// ---------- Control circuit transformer ----------
// Fuse sizes: BS 88 / IEC 60269 R10 series (A). ⚠ TYPICAL rule of thumb: primary fuse time-delay or aM
// about 2 × the primary current to ride the switch-on inrush (often 10–25 × In for a few ms); secondary
// fuse gG just above the secondary full-load current so it protects the winding. Check the maker.
// v0.19.1 check (kept TYPICAL): maker tables put the aM primary fuse at about 2–2.5 × the primary current
// for 250 VA–1 kVA, and 3–5 × for small ones: Birmingham Transformers 400 V table
// (http://www.industrial-transformers.co.uk/wp-content/uploads/2016/03/PRIMARY-protection-FUSE-MCB.pdf),
// Legrand (https://assets.legrand.com/pim/NP-FT-GT/F00870EN-03.pdf). Inrush 25–40 × for a half cycle (Mersen).
export const FUSE_SIZES = [0.5, 1, 1.6, 2, 2.5, 3.15, 4, 5, 6.3, 8, 10, 12, 16, 20, 25, 32, 40, 50, 63];
export const nextFuse = (a) => FUSE_SIZES.find((f) => f >= a - 1e-9) || null;
export function transformer({ va, vp = 400, vs = 230, primaryMult = 2 }) {
  const S = Number(va), P = Number(vp), Sv = Number(vs);
  if (!(S > 0)) return { ok: false, error: 'Enter the transformer VA.' };
  if (!(P > 0) || !(Sv > 0)) return { ok: false, error: 'Enter the primary and secondary voltage.' };
  const ip = S / P, is = S / Sv;
  return { ok: true, ip: r3(ip), is: r3(is), fp: nextFuse(ip * primaryMult), fs: nextFuse(is), primaryMult,
    notes: [`Primary current = ${S} VA ÷ ${P} V = ${r3(ip)} A. Secondary current = ${S} VA ÷ ${Sv} V = ${r3(is)} A.`,
      `Primary fuse: time-delay or aM, about ${primaryMult} × ${r3(ip)} A so it rides the switch-on inrush (typical, check the maker).`,
      'Secondary fuse: gG, the next size at or above the secondary current, so it protects the winding and the control wiring.',
      'Typical figures: the transformer maker\u2019s fuse table takes priority (makers list about 2–2.5 × for 250 VA–1 kVA, and up to 3–5 × for small transformers).'] };
}

// ---------- Contactor picker ----------
// Utilisation categories, IEC / BS EN 60947-4-1 Annex A. mult = margin on the load current; list =
// which line on the side of the contactor you read. v0.19.1: categories match ABB's contactor guide
// (https://library.e.abb.com/public/61931bb764074e4c8b0e82f2f386cf58/1SAC200017M0002_en_C_Contactors%20and%20Overload%20relays%20guide.pdf),
// but no maker publishes these fixed margins: they're rules of thumb. ⚠ TYPICAL margins (AC-4, AC-5, AC-6 especially):
// the maker's figure for that category takes priority.
export const AC_STD = {
  ac1: [16, 20, 25, 32, 40, 45, 50, 63, 80, 100, 125, 160, 200, 250],
  ac3: [6, 9, 12, 18, 25, 32, 38, 40, 50, 65, 80, 95, 115, 150, 185, 225],
};
export const CATS = [
  { k: 'AC-1', label: 'Resistive / heating', list: 'ac1', mult: 1.25, why: 'No inrush. Read the AC-1 (thermal) line; a 25% margin is a typical allowance for heat in an enclosure.' },
  { k: 'AC-3', label: 'Motor, normal start (squirrel cage)', list: 'ac3', mult: 1.0, why: 'Starts, and switches off while running. Read the AC-3 line (amps, or kW at 400 V) and pick one at or above the motor FLC.' },
  { k: 'AC-4', label: 'Motor inching, jogging or plugging', list: 'ac3', mult: 2.0, why: 'Breaks the starting current over and over, so contacts wear fast. Typically about 2 × the AC-3 size: read the maker\u2019s AC-4 figure.', typical: true },
  { k: 'AC-5a', label: 'Discharge or LED lighting', list: 'ac3', mult: 1.5, why: 'Driver and ballast inrush. Typically pick an AC-3 rating about 1.5 × the load, or the maker\u2019s AC-5a / lighting table.', typical: true },
  { k: 'AC-5b', label: 'Filament (incandescent) lighting', list: 'ac3', mult: 1.5, why: 'Cold filaments draw 10–15 × at switch-on. Typically about 1.5 × the load on the AC-3 line: read the maker\u2019s AC-5b figure.', typical: true },
  { k: 'AC-6a', label: 'Transformers', list: 'ac3', mult: 1.5, why: 'Magnetising inrush. Typically about 1.5 × the primary current on the AC-3 line: read the maker\u2019s AC-6a figure.', typical: true },
  { k: 'AC-6b', label: 'Capacitor banks', list: 'ac3', mult: 1.5, why: 'Very high switch-on current. Use capacitor-duty contactors with pre-charge resistors; read the maker\u2019s AC-6b kvar figure.', typical: true },
];
export const catFor = (k) => CATS.find((c) => c.k === k) || CATS[0];
export function contactor({ cat = 'AC-1', load, unit = 'kW', phase = 3, pf = 1, eff = 1, uo = UO, ul = UL }) {
  const c = catFor(cat); const v = Number(load); if (!(v > 0)) return { ok: false, error: 'Enter the load (kW or amps).' };
  const three = Number(phase) === 3; const e = c.k.startsWith('AC-3') || c.k === 'AC-4' ? (Number(eff) || 1) : 1;
  const amps = unit === 'A' ? v : (v * 1000) / ((three ? Math.sqrt(3) * ul : uo) * (Number(pf) || 1) * e);
  const need = amps * c.mult; const list = AC_STD[c.list];
  const size = list.find((x) => x >= need - 1e-9) || null; const next = size ? list[list.indexOf(size) + 1] || null : null;
  return { ok: true, cat: c, amps: r2(amps), need: r2(need), size, next, line: c.list === 'ac1' ? 'AC-1' : 'AC-3',
    how: unit === 'A' ? `${v} A as entered` : `${v} kW ÷ (${three ? '√3 × ' + ul : uo} V × pf ${Number(pf) || 1}${e !== 1 ? ' × efficiency ' + e : ''})` };
}

// ---------- Fault level (PSCC / PEFC) at a sub-board ----------
// From the origin: Zsource = Uo ÷ PSCC (L–N) and Ze (or Uo ÷ PEFC). Far end, with the cable at 20 °C
// (the cold cable gives the highest fault current, the safe side for kA ratings):
//   PSCC (L–N) = Uo ÷ (Zsource + (R phase + R neutral) × L),  PEFC = Uo ÷ (Ze + R1+R2 × L).
// Three-phase symmetrical fault ≈ 2 × L–N PSCC at the origin (GN3 rule of thumb, on the safe side; see
// https://www.kewtechcorp.com/news/the-measurement-of-prospective-fault-current/), then
//   Ik3 = Uo ÷ (Uo ÷ Ik3 origin + R phase × L). Resistance only: reactance ignored (on the safe side
// for small cables; above about 35 mm² reactance matters, so it's flagged).
export const KA_RATINGS = [3, 4.5, 6, 10, 15, 16, 25, 36, 50];
export function faultLevel({ pfc, ze = null, pefc = null, phase = 1, cable = 'swa', size, length, cpc = null, armour = false, deviceKa = 6, uo = UO }) {
  const P = Number(pfc) * 1000; const L = Number(length); const S = Number(size);
  if (!(P > 0)) return { ok: false, error: 'Enter the PFC at the origin (kA).' };
  if (!(L >= 0) || !(S > 0)) return { ok: false, error: 'Enter the cable size and length.' };
  const cab = CABLES[cable] || {}; const R = cab.rTable === 'cu5' ? CU5_MOHM_PER_M : CU_MOHM_PER_M;
  const rL = R[S]; if (rL == null) return { ok: false, error: 'No resistance figure for that size.' };
  const three = Number(phase) === 3;
  const zsrc = uo / P;
  const zE = Number(ze) > 0 ? Number(ze) : Number(pefc) > 0 ? uo / (Number(pefc) * 1000) : null;
  const rC = armour ? (ARMOUR_MOHM_PER_M[cab.cores || 3] || ARMOUR_MOHM_PER_M[3])[S] : R[Number(cpc) || S];
  const pscc1 = uo / (zsrc + (2 * rL * L) / 1000);
  const ik3o = three ? 2 * P : null; const pscc3 = three ? uo / (uo / ik3o + (rL * L) / 1000) : null;
  const pefc2 = zE != null && rC != null ? uo / (zE + ((rL + rC) * L) / 1000) : null;
  const worst = Math.max(three ? pscc3 : pscc1, pefc2 || 0);
  const ka = Number(deviceKa) || 6;
  return { ok: true, pscc: r2((three ? pscc3 : pscc1) / 1000), pscc1: r2(pscc1 / 1000), pefc: pefc2 == null ? null : r2(pefc2 / 1000), worst: r2(worst / 1000), ka, pass: worst / 1000 <= ka + 1e-9,
    origin3: ik3o ? r2(ik3o / 1000) : null, big: S > 35,
    steps: [`Source impedance (L–N) = ${uo} V ÷ ${Number(pfc)} kA = ${r3(zsrc)} Ω.`,
      three ? `Three-phase fault at the origin ≈ 2 × ${Number(pfc)} kA = ${r2(ik3o / 1000)} kA (rule of thumb). At the far end: ${uo} V ÷ (${r3(uo / ik3o)} Ω + ${rL} mΩ/m × ${L} m) = ${r2(pscc3 / 1000)} kA.`
        : `At the far end (L–N): ${uo} V ÷ (${r3(zsrc)} Ω + 2 × ${rL} mΩ/m × ${L} m) = ${r2(pscc1 / 1000)} kA.`,
      pefc2 != null ? `Earth fault: ${uo} V ÷ (Ze ${r3(zE)} Ω + (${rL} + ${rC}) mΩ/m × ${L} m) = ${r2(pefc2 / 1000)} kA.` : 'Put in Ze (or the PEFC) to get the earth fault current too.',
      'Cable resistance at 20 °C (cold, so the highest fault current), reactance ignored.'] };
}
