// =====================================================================
// limits.js — EVERY test limit the app checks against, in ONE place.
// =====================================================================
// Standard: BS 7671:2018+A4:2026 (Amendment 4, the only current version
// since 15 October 2026). Uo = 230 V, Cmin = 0.95 (supply to ESQCR), so
// Uo × Cmin = 218.5 V.
//
// ⚠ CHECK THESE AGAINST YOUR OWN COPY OF THE REGS BEFORE RELYING ON THEM.
// They were typed in from the tables as published, cross-checked against
// two independent online copies of the A4 tables (maxzs.co.uk and
// 18theditionprep.co.uk, Oct 2026) and, for circuit-breakers, against the
// formula Zs = Uo × Cmin / Ia. tests/limits.test.mjs lists every value.
//
// Each table says where it came from (`source`). Nothing else in the app
// hard-codes a limit: change a number here and every check follows.

export const STANDARD = 'BS 7671:2018+A4:2026';
export const UO = 230;
export const CMIN = 0.95;
export const CHECK_NOTE = 'Limits are built in from BS 7671:2018+A4:2026 Tables 41.2–41.5, 64 and Appendix 3/4. Check them against your own copy of the regs before relying on them.';

// ---------- Maximum earth fault loop impedance, Zs (Ω) ----------
// Key: device family -> type -> { rating: [Zs at 0.4 s, Zs at 5 s] }
// null = not tabulated for that time.
export const MAX_ZS = {
  // Table 41.3 — circuit-breakers to BS EN 60898 and the overcurrent
  // characteristics of RCBOs to BS EN 61009-1. Types B and C use the same
  // figure for 0.4 s and 5 s (instantaneous trip 5×In / 10×In). Type D is
  // 20×In for 0.4 s, and Table 41.4 gives 10×In for 5 s.
  mcb: {
    source: 'BS 7671 Table 41.3 (0.4 s & 5 s); Type D 5 s from Table 41.4',
    B: { 3: [14.57, 14.57], 6: [7.28, 7.28], 10: [4.37, 4.37], 16: [2.73, 2.73], 20: [2.19, 2.19], 25: [1.75, 1.75], 32: [1.37, 1.37], 40: [1.09, 1.09], 50: [0.87, 0.87], 63: [0.69, 0.69], 80: [0.55, 0.55], 100: [0.44, 0.44], 125: [0.35, 0.35] },
    C: { 6: [3.64, 3.64], 10: [2.19, 2.19], 16: [1.37, 1.37], 20: [1.09, 1.09], 25: [0.87, 0.87], 32: [0.68, 0.68], 40: [0.55, 0.55], 50: [0.44, 0.44], 63: [0.35, 0.35], 80: [0.27, 0.27], 100: [0.22, 0.22], 125: [0.17, 0.17] },
    D: { 6: [1.82, 3.64], 10: [1.09, 2.19], 16: [0.68, 1.37], 20: [0.55, 1.09], 25: [0.44, 0.87], 32: [0.34, 0.68], 40: [0.27, 0.55], 50: [0.22, 0.44], 63: [0.17, 0.35], 80: [0.14, 0.27], 100: [0.11, 0.22], 125: [0.09, 0.17] },
  },
  // Table 41.2 (0.4 s) and Table 41.4 (5 s) — BS 88-2 fuses, systems E & G (gG/gM).
  'bs88-2': {
    source: 'BS 7671 Table 41.2 (0.4 s) and Table 41.4 (5 s)',
    gG: { 2: [33.1, 44], 4: [15.6, 21], 6: [7.8, 12], 10: [4.65, 6.8], 16: [2.43, 4.0], 20: [1.68, 2.8], 25: [1.29, 2.2], 32: [0.99, 1.7], 40: [0.75, 1.3], 50: [0.57, 0.99], 63: [0.44, 0.78], 80: [null, 0.55], 100: [null, 0.42], 125: [null, 0.32], 160: [null, 0.27], 200: [null, 0.18] },
  },
  // BS 88-3 fuse system C (the old BS 1361 cartridge fuse is now BS 88-3).
  'bs88-3': {
    source: 'BS 7671 Table 41.2 (0.4 s) and Table 41.4 (5 s)',
    gG: { 5: [9.93, 14.6], 16: [2.3, 3.9], 20: [1.93, 3.2], 32: [0.91, 1.6], 45: [0.57, 1.0], 63: [0.36, 0.68], 80: [null, 0.51], 100: [null, 0.38] },
  },
  // BS 3036 semi-enclosed (rewirable) fuses.
  'bs3036': {
    source: 'BS 7671 Table 41.2 (0.4 s) and Table 41.4 (5 s)',
    rewirable: { 5: [9.1, 16.8], 15: [2.43, 5.08], 20: [1.68, 3.64], 30: [1.04, 2.51], 45: [0.56, 1.51], 60: [0.4, 1.07], 100: [null, 0.51] },
  },
  // BS 1362 plug-top / fused spur fuses.
  'bs1362': {
    source: 'BS 7671 Table 41.2 (0.4 s) and Table 41.4 (5 s)',
    plug: { 3: [15.6, 22.0], 13: [2.3, 3.64] },
  },
  // BS 3871 circuit-breakers (withdrawn 1994): NOT in BS 7671 Chapter 41.
  // Figures from the IET On-Site Guide / GN3 style tables as reproduced
  // online (0.1–5 s). Shown with a "not a BS 7671 table" note. Check them.
  'bs3871': {
    source: 'Not in BS 7671 Chapter 41 — legacy table (IET guidance), check before use',
    legacy: true,
    '1': { 5: [8.74, 8.74], 6: [7.28, 7.28], 10: [4.4, 4.4], 15: [2.93, 2.93], 16: [2.76, 2.76], 20: [2.2, 2.2], 25: [1.76, 1.76], 30: [1.47, 1.47], 32: [1.38, 1.38], 40: [1.1, 1.1], 45: [0.98, 0.98], 50: [0.88, 0.88], 63: [0.7, 0.7], 100: [0.44, 0.44] },
    '2': { 5: [5.0, 5.0], 6: [4.2, 4.2], 10: [2.5, 2.5], 15: [1.67, 1.67], 16: [1.58, 1.58], 20: [1.25, 1.25], 25: [1.0, 1.0], 30: [0.83, 0.83], 32: [0.79, 0.79], 40: [0.63, 0.63], 45: [0.56, 0.56], 50: [0.5, 0.5], 63: [0.4, 0.4], 100: [0.25, 0.25] },
    '3': { 5: [3.49, 3.49], 6: [2.91, 2.91], 10: [1.75, 1.75], 15: [1.16, 1.16], 16: [1.09, 1.09], 20: [0.87, 0.87], 25: [0.7, 0.7], 30: [0.58, 0.58], 32: [0.55, 0.55], 40: [0.44, 0.44], 45: [0.38, 0.38], 50: [0.35, 0.35], 63: [0.27, 0.27], 100: [0.17, 0.17] },
  },
};

// Table 41.5 — max Zs where an RCD gives fault protection (TT, 50 V / IΔn).
export const RCD_ZS = { source: 'BS 7671 Table 41.5 (TT, 50 V touch voltage)', 30: 1667, 100: 500, 300: 167, 500: 100 };

// The protective devices the app offers, mapped to the table above.
// bs = what goes in the BS (EN) column of the schedule.
export const DEVICES = [
  { id: 'mcb', label: 'MCB (BS EN 60898)', bs: '60898', table: 'mcb', types: ['B', 'C', 'D'] },
  { id: 'rcbo', label: 'RCBO (BS EN 61009)', bs: '61009', table: 'mcb', types: ['B', 'C', 'D'], rcd: true },
  { id: 'bs88-2', label: 'Fuse BS 88-2 (gG)', bs: '88-2', table: 'bs88-2', types: ['gG'] },
  { id: 'bs88-3', label: 'Fuse BS 88-3 (was BS 1361)', bs: '88-3', table: 'bs88-3', types: ['gG'] },
  { id: 'bs3036', label: 'Rewirable fuse BS 3036', bs: '3036', table: 'bs3036', types: ['rewirable'] },
  { id: 'bs1362', label: 'Plug fuse BS 1362', bs: '1362', table: 'bs1362', types: ['plug'] },
  { id: 'bs3871', label: 'Old MCB BS 3871 (legacy)', bs: '3871', table: 'bs3871', types: ['1', '2', '3'] },
  // v0.19: adjustable breakers. No BS 7671 max Zs table: max Zs = Uo × Cmin ÷ the magnetic trip current.
  { id: 'mpcb', label: 'MPCB motor breaker (BS EN 60947-4-1)', bs: '60947-4-1', table: null, types: ['adj'], adj: 'mpcb' },
  { id: 'mccb', label: 'MCCB (BS EN 60947-2)', bs: '60947-2', table: null, types: ['adj'], adj: 'mccb' },
  { id: 'other', label: 'Other (enter max Zs yourself)', bs: '', table: null, types: [] },
];
export const deviceById = (id) => DEVICES.find((d) => d.id === id) || null;
// Find the device from what's written in the BS (EN) column ("60898", "BS EN 61009-1", "88-3"...).
export function deviceFromBs(bs) {
  const s = String(bs || '').replace(/\s+/g, '').toUpperCase();
  if (!s) return null;
  if (/61009/.test(s)) return deviceById('rcbo');
  if (/60898/.test(s)) return deviceById('mcb');
  if (/88-?2|60269/.test(s)) return deviceById('bs88-2');
  if (/88-?3|1361/.test(s)) return deviceById('bs88-3');
  if (/3036/.test(s)) return deviceById('bs3036');
  if (/1362/.test(s)) return deviceById('bs1362');
  if (/3871/.test(s)) return deviceById('bs3871');
  if (/60947-?4/.test(s)) return deviceById('mpcb');
  if (/60947/.test(s)) return deviceById('mccb');
  return null;
}
export const ratingsFor = (deviceId, type) => {
  const d = deviceById(deviceId); if (!d || !d.table) return [];
  const t = MAX_ZS[d.table][type || d.types[0]]; return t ? Object.keys(t).map(Number).sort((a, b) => a - b) : [];
};

// maxZs({ device:'mcb', type:'B', rating:32, time:0.4 }) -> 1.37 (or null)
export function maxZs({ device, type, rating, time = 0.4 } = {}) {
  const d = deviceById(device); if (!d || !d.table) return null;
  const tbl = MAX_ZS[d.table]; const t = tbl[type || d.types[0]]; if (!t) return null;
  const row = t[Number(rating)]; if (!row) return null;
  return Number(time) >= 5 ? row[1] : row[0];
}
export function maxZsSource(device) { const d = deviceById(device); return d && d.table ? MAX_ZS[d.table].source : ''; }
export const isLegacyTable = (device) => { const d = deviceById(device); return !!(d && d.table && MAX_ZS[d.table].legacy); };

// The rule of thumb for readings taken cold (BS 7671 Appendix 3 / GN3):
// measured Zs should not be more than 80% of the tabulated figure.
export const RULE_OF_THUMB = 0.8;
export const coldLimit = (z) => (z == null ? null : Math.round(z * RULE_OF_THUMB * 100) / 100);

// ---------- Insulation resistance (Table 64) ----------
export const IR_TABLE = {
  source: 'BS 7671 Table 64',
  rows: [
    { circuit: 'SELV and PELV', testV: 250, minMOhm: 0.5 },
    { circuit: 'Up to and including 500 V (incl. FELV)', testV: 500, minMOhm: 1.0 },
    { circuit: 'Above 500 V', testV: 1000, minMOhm: 1.0 },
  ],
  // Not a regulation: GN3 suggests looking into readings below 2 MΩ as a
  // possible sign of a latent defect. Shown amber only.
  adviseBelow: 2.0,
};
export function irMinFor(testV) {
  const v = Number(testV) || 500;
  const r = IR_TABLE.rows.find((x) => x.testV === v);
  return r ? r.minMOhm : 1.0;
}

// ---------- RCD operating times at IΔn (Regulation 643.7 / Table 3A) ----------
export const RCD_TIMES = {
  source: 'BS 7671 Appendix 3 Table 3A (BS EN 61008-1 / 61009-1 / 62423)',
  general: { maxMs: 300 },          // non-delay ("general") type
  S: { minMs: 130, maxMs: 500 },    // time-delayed S type
};
export function rcdTimeLimit(isS) { return isS ? RCD_TIMES.S : RCD_TIMES.general; }

// ---------- Ring final circuit end-to-end checks (GN3 rule of thumb) ----------
export const RING = {
  source: 'IET Guidance Note 3 (rule of thumb, not a regulation)',
  endToEndMatch: 0.05,   // r1 and rn within 0.05 Ω of each other
  r1r2Match: 0.05,       // (R1+R2) within 0.05 Ω of (r1+r2)/4
};

// ---------- Volt drop limits (Appendix 4 section 6.4, Table 4Ab) ----------
export const VOLT_DROP = { source: 'BS 7671 Appendix 4, Table 4Ab (public LV supply)', lightingPct: 3, otherPct: 5 };

// ---------- Adiabatic check helpers (v0.4) ----------
// Circuit-breakers: instantaneous trip at 5 × In (B), 10 × In (C), 20 × In (D), within 0.1 s
// (BS EN 60898-1 / 61009-1). The app uses 0.1 s as the worst case in that region.
export const INSTANT_MULT = { B: 5, C: 10, D: 20 };
export const MCB_INSTANT_T = 0.1;
// ⚠ Energy limiting class 3 maximum let-through I²t (A²s), BS EN 60898-1 Annex ZA, Types B and C,
// by breaking capacity (A). Typed in for the app; check against the standard or the maker's data
// (most makers' real let-through is well below these). Used only to cap the 0.1 s worst case.
export const MCB_CLASS3_I2T = {
  source: 'BS EN 60898-1 Annex ZA, energy limiting class 3 (check with maker’s data)',
  upTo16: { 3000: 15000, 4500: 25000, 6000: 35000, 10000: 70000 },
  upTo32: { 3000: 18000, 4500: 32000, 6000: 45000, 10000: 90000 },
};

// ---------- v0.19: MPCB and MCCB (adjustable) ----------
// Max Zs for a device with a magnetic trip current Im: Zs ≤ Uo × Cmin ÷ Im (the same way Table 41.3 is
// worked out for circuit-breakers). ⚠ TYPICAL: MPCB magnetic trip about 13 × the top of the dial range
// (e.g. ABB MS132, Schneider GV2, Eaton PKZM0), check the maker.
// v0.19.1 check (kept TYPICAL): Siemens 3RV2 instantaneous release 13 × In (catalogue IC 10,
// https://www.energeia.gr/images/products/documents/catalogs/sie-sirius3rv2motorstarterprotector-circuitbreakers.pdf);
// Schneider GV2ME fixed magnetic trip is about 12–14 × the range top (e.g. 4–6.3 A → 78 A, 24–32 A → 416 A;
// GV2ME01 only ~9 ×), https://www.electrocentr.com.ua/files/documentation/SE/motor-control/cb/TeSys_GV_cat_2017_en.pdf;
// ABB MS132 12.5 × up to 6.3 A, 15 × above (https://library.e.abb.com/public/65a7bfff98c1f020c1257b04002a355b/2CDC131021D0201.pdf).
// Ranges up to 32 A follow GV2 / MS132; 30–40 A and up are GV3-style and not checked.
export const MPCB_MAG_MULT = 13;
// Typical MPCB dial ranges (A). Pick the smallest range that has the FLC in it.
export const MPCB_RANGES = [[0.1, 0.16], [0.16, 0.25], [0.25, 0.4], [0.4, 0.63], [0.63, 1], [1, 1.6], [1.6, 2.5], [2.5, 4], [4, 6.3], [6.3, 10], [9, 14], [13, 18], [17, 23], [20, 25], [24, 32], [30, 40], [37, 50], [48, 65], [63, 80], [80, 100]];
export const mpcbRange = (flc) => MPCB_RANGES.find(([a, b]) => flc <= b + 1e-9 && flc >= a - 1e-9) || MPCB_RANGES.find(([, b]) => flc <= b) || null;
export const MCCB_FRAMES = [16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 320, 400, 630];
export const maxZsForTrip = (im, uo = UO) => (Number(im) > 0 ? Math.round(((uo * CMIN) / Number(im)) * 100) / 100 : null);
