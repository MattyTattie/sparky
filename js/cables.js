// =====================================================================
// cables.js — cable data for the calculators (BS 7671 Appendix 4).
// =====================================================================
// ⚠ Check against your own copy of BS 7671:2018+A4:2026 Appendix 4.
// Copper conductors only. Current ratings are tabulated It (amps) before
// correction factors; volt drop is mV per amp per metre, single-phase.

export const CABLES = {
  te: {
    label: 'Flat twin & earth, 70 °C PVC (6242Y)',
    source: 'Table 4D5 (current, cols 2–7) and volt drop',
    sizes: [1, 1.5, 2.5, 4, 6, 10, 16],
    mvam: { 1: 44, 1.5: 29, 2.5: 18, 4: 11, 6: 7.3, 10: 4.4, 16: 2.8 },
    methods: {
      C: { label: 'Clipped direct (C)', amps: { 1: 16, 1.5: 20, 2.5: 27, 4: 37, 6: 47, 10: 64, 16: 85 } },
      100: { label: 'Clipped to a joist or on the plasterboard, above a ceiling with insulation up to 100 mm (100)', amps: { 1: 13, 1.5: 16, 2.5: 21, 4: 27, 6: 34, 10: 45, 16: 57 } },
      101: { label: 'Clipped to a joist or on the plasterboard, above a ceiling with insulation over 100 mm (101)', amps: { 1: 10.5, 1.5: 13, 2.5: 17, 4: 22, 6: 27, 10: 36, 16: 46 } },
      102: { label: 'In a stud wall with insulation, touching the inner skin (102)', amps: { 1: 13, 1.5: 16, 2.5: 21, 4: 27, 6: 35, 10: 47, 16: 63 } },
      103: { label: 'In a stud wall with insulation, not touching the inner skin (103)', amps: { 1: 8, 1.5: 10, 2.5: 13.5, 4: 17.5, 6: 23.5, 10: 32, 16: 42.5 } },
      A: { label: 'In conduit in an insulated wall (A)', amps: { 1: 11.5, 1.5: 14.5, 2.5: 20, 4: 26, 6: 32, 10: 44, 16: 57 } },
      B: { label: 'In conduit or trunking on a wall (B)', amps: { 1: 13, 1.5: 16.5, 2.5: 23, 4: 30, 6: 38, 10: 52, 16: 69 } },
    },
  },
  swa: {
    label: '2-core SWA, 70 °C PVC',
    source: 'Table 4D4A (current) and 4D4B (volt drop)',
    sizes: [1.5, 2.5, 4, 6, 10, 16, 25, 35],
    mvam: { 1.5: 29, 2.5: 18, 4: 11, 6: 7.3, 10: 4.4, 16: 2.8, 25: 1.75, 35: 1.25 },
    methods: {
      C: { label: 'Clipped direct (C)', amps: { 1.5: 21, 2.5: 28, 4: 38, 6: 49, 10: 67, 16: 89, 25: 118, 35: 145 } },
      D: { label: 'Direct in the ground (D)', amps: { 1.5: 22, 2.5: 29, 4: 37, 6: 46, 10: 60, 16: 78, 25: 99, 35: 119 } },
    },
  },
  swa3: {
    label: '3-core SWA, 70 °C PVC (single-phase: L, N + 3rd core or armour as CPC)',
    source: 'Table 4D4A/4D4B, 2-core single-phase columns (only two cores carry load)',
    note: '⚠ A 3-core cable used single-phase has two loaded cores, so the app uses the Table 4D4A "one two-core cable, single-phase" ratings and the single-phase volt drop. Check against your copy of Appendix 4 or the maker’s data.',
    cores: 3,
    sizes: [1.5, 2.5, 4, 6, 10, 16, 25, 35],
    mvam: { 1.5: 29, 2.5: 18, 4: 11, 6: 7.3, 10: 4.4, 16: 2.8, 25: 1.75, 35: 1.25 },
    methods: {
      C: { label: 'Clipped direct (C)', amps: { 1.5: 21, 2.5: 28, 4: 38, 6: 49, 10: 67, 16: 89, 25: 118, 35: 145 } },
      D: { label: 'Direct in the ground (D)', amps: { 1.5: 22, 2.5: 29, 4: 37, 6: 46, 10: 60, 16: 78, 25: 99, 35: 119 } },
    },
  },
  swa3X: {
    label: '3-core SWA, 90 °C XLPE (6943X) (single-phase: L, N + 3rd core or armour as CPC)',
    source: 'Table 4E4A/4E4B, 2-core single-phase columns (only two cores carry load)',
    note: '⚠ A 3-core cable used single-phase has two loaded cores, so the app uses the Table 4E4A "one two-core cable, single-phase" ratings. Check against your copy of Appendix 4 or the maker’s data.',
    cores: 3,
    sizes: [1.5, 2.5, 4, 6, 10, 16, 25, 35],
    mvam: { 1.5: 31, 2.5: 19, 4: 12, 6: 7.9, 10: 4.7, 16: 2.9, 25: 1.85, 35: 1.35 },
    methods: {
      C: { label: 'Clipped direct (C)', amps: { 1.5: 27, 2.5: 36, 4: 49, 6: 62, 10: 85, 16: 110, 25: 146, 35: 180 } },
      D: { label: 'Direct in the ground (D)', amps: { 1.5: 25, 2.5: 33, 4: 43, 6: 53, 10: 71, 16: 91, 25: 116, 35: 139 } },
    },
  },
  swaX: {
    label: '2-core SWA, 90 °C XLPE (6942X)',
    source: 'Table 4E4A (current) and 4E4B (volt drop)',
    sizes: [1.5, 2.5, 4, 6, 10, 16, 25, 35],
    mvam: { 1.5: 31, 2.5: 19, 4: 12, 6: 7.9, 10: 4.7, 16: 2.9, 25: 1.85, 35: 1.35 },
    methods: {
      C: { label: 'Clipped direct (C)', amps: { 1.5: 27, 2.5: 36, 4: 49, 6: 62, 10: 85, 16: 110, 25: 146, 35: 180 } },
      D: { label: 'Direct in the ground (D)', amps: { 1.5: 25, 2.5: 33, 4: 43, 6: 53, 10: 71, 16: 91, 25: 116, 35: 139 } },
    },
  },
};

// Ambient temperature factor Ca (Table 4B1), for 70 °C and 90 °C cables.
// ⚠ Table 4B1 starts at 25 °C. For 20 °C the app uses the 25 °C factor
// (1.03 / 1.02), which errs on the safe side. (IEC 60364-5-52 Table B.52.14
// gives 1.12 / 1.08 at 20 °C if you can justify it; BS 7671 doesn't.)
export const CA = {
  70: { 20: 1.03, 25: 1.03, 30: 1.0, 35: 0.94, 40: 0.87, 45: 0.79, 50: 0.71, 55: 0.61, 60: 0.5 },
  90: { 20: 1.02, 25: 1.02, 30: 1.0, 35: 0.96, 40: 0.91, 45: 0.87, 50: 0.82, 55: 0.76, 60: 0.71 },
};
export const CA_SOURCE = 'BS 7671 Table 4B1 (cables in air, reference 30 °C)';
export const CA_NOTES = { 20: 'Table 4B1 stops at 25 °C, so 20 °C uses the 25 °C factor (on the safe side).' };
export const AMBIENTS = [20, 25, 30, 35, 40, 45, 50, 55, 60];
// Grouping factor Cg, BS 7671 Table 4C1 (v0.22: all rows). Keys kept: 'bunched' = row 1, 'clipped' = row 2,
// so old saved settings land on the same row. Row 1 carries on to 12/16/20 circuits; rows 2–5 make no further
// reduction beyond 9. Row 3 has 0.95 for one circuit (a single cable under a ceiling) but the app only applies
// grouping from 2 circuits up.
export const CG = {
  bunched: { 1: 1.0, 2: 0.8, 3: 0.7, 4: 0.65, 5: 0.6, 6: 0.57, 7: 0.54, 8: 0.52, 9: 0.5, 12: 0.45, 16: 0.41, 20: 0.38 },
  clipped: { 1: 1.0, 2: 0.85, 3: 0.79, 4: 0.75, 5: 0.73, 6: 0.72, 7: 0.72, 8: 0.71, 9: 0.7 },
  ceiling: { 1: 0.95, 2: 0.81, 3: 0.72, 4: 0.68, 5: 0.66, 6: 0.64, 7: 0.63, 8: 0.62, 9: 0.61 },
  tray: { 1: 1.0, 2: 0.88, 3: 0.82, 4: 0.77, 5: 0.75, 6: 0.73, 7: 0.73, 8: 0.72, 9: 0.72 },
  ladder: { 1: 1.0, 2: 0.87, 3: 0.82, 4: 0.8, 5: 0.8, 6: 0.79, 7: 0.79, 8: 0.78, 9: 0.78 },
  spaced: { 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.0, 6: 1.0, 7: 1.0, 8: 1.0, 9: 1.0 },
};
// The 'Grouped how' list, in Table 4C1 order.
export const GROUPINGS = [
  ['bunched', 'Bunched in air, on a surface, embedded or enclosed (Table 4C1, item 1)'],
  ['clipped', 'Single layer on wall, floor or unperforated cable tray (item 2)'],
  ['ceiling', 'Single layer multicore on a ceiling (item 3)'],
  ['tray', 'Single layer multicore on a perforated horizontal or vertical cable tray system (item 4)'],
  ['ladder', 'Single layer multicore on cable ladder system or cleats etc. (item 5)'],
  ['spaced', 'Spaced: horizontal clearance between adjacent cables more than twice their overall diameter (no factor, Cg 1.0)'],
];
// v0.22b: plain words for the More info sheet (same keys as GROUPINGS).
export const GROUP_INFO = {
  bunched: ['The usual one for houses. Cables run together touching: bunched along a void, tied in a bundle, in the same conduit or trunking, or buried together in plaster.', 'Example: three T&E circuits clipped side by side along a joist and touching, or several circuits in one length of trunking.'],
  clipped: ['Cables side by side in one flat layer, touching each other, fixed to a wall, floor or solid (unperforated) tray. Not stacked.', 'Example: a row of SWA cables cleated flat along a wall in a plant room, touching.'],
  ceiling: ['Multicore cables in one flat layer, touching, fixed underneath a ceiling. Heat can\u2019t rise away so easily, so the factors are lower.', 'Example: several SWA cables clipped side by side to the underside of a concrete soffit.'],
  tray: ['Multicore cables in one layer on perforated tray, laid flat or run up a wall. The holes let air move.', 'Example: SWA sub-mains in a single layer on perforated tray across a warehouse.'],
  ladder: ['Multicore cables in one layer on cable ladder, or held off the surface on cleats or brackets, so air gets all round them.', 'Example: big SWA cables on ladder rack in a riser.'],
  spaced: ['The cables are kept apart with a gap of more than twice their own diameter, so they don\u2019t heat each other. No grouping factor needed.', 'Example: two 20 mm SWA cables cleated 50 mm apart along a wall.'],
};

// Cg for a grouping and number of circuits (row 1 steps to 12 / 16 / 20; the others stop at 9).
export function cgFor(grouping, n) {
  const t = CG[grouping] || CG.bunched; const k = Math.max(1, Math.floor(Number(n) || 1));
  if (k <= 9) return t[k] ?? 1;
  // v0.34: between Table 4C1 columns round UP to the next column (10–11 → 12, 13–15 → 16,
  // 17–19 → 20; 20 or more → 20), never down, so the cable is never undersized.
  const keys = Object.keys(t).map(Number).sort((a, b) => a - b);
  const up = keys.find((x) => x >= k);
  return t[up ?? keys[keys.length - 1]];
}
export const CF_BS3036 = 0.725; // Regulation 433.1.202 / Appendix 4 — semi-enclosed fuse
export const CABLE_TEMP = { te: 70, swa: 70, swaX: 90, swa3: 70, swa3X: 90 };
CABLES.swa.cores = 2; CABLES.swaX.cores = 2; CABLES.te.cores = 2;

// ---------- Conductor and armour resistance (for R1+R2) ----------
// Copper conductors, mΩ per metre at 20 °C (BS EN 60228 maxima, as GN3 Table B1 / OSG Table I1).
export const CU_MOHM_PER_M = { 1: 18.1, 1.5: 12.1, 2.5: 7.41, 4: 4.61, 6: 3.08, 10: 1.83, 16: 1.15, 25: 0.727, 35: 0.524 };
// Steel wire armour, mΩ per metre at 20 °C (maximum values). ⚠ Maker's data, not BS 7671:
// BS 5467 XLPE/SWA 600/1000 V, Anixter data sheet (PD313676). PVC/SWA (BS 6346) and other
// makers differ a little: use the figure from YOUR cable's data sheet where you can.
export const ARMOUR_MOHM_PER_M = {
  source: 'Maker’s data (BS 5467 600/1000 V, Anixter data sheet), not BS 7671. Check your cable’s data sheet.',
  2: { 1.5: 10.2, 2.5: 8.8, 4: 7.9, 6: 7.0, 10: 6.0, 16: 3.7, 25: 3.7, 35: 2.6 },
  3: { 1.5: 9.5, 2.5: 8.2, 4: 7.5, 6: 6.7, 10: 4.0, 16: 3.5, 25: 2.5, 35: 2.3 },
};
// Multiplier from 20 °C to normal operating temperature for design Zs (OSG Table I3 / GN3):
// 70 °C thermoplastic 1.20, 90 °C thermosetting 1.28. The app applies the same multiplier to
// armour (steel armour runs cooler than the cores, so this over-estimates it: on the safe side).
export const TEMP_MULT = { 70: 1.2, 90: 1.28, source: 'IET On-Site Guide Table I3 (conductor operating temperature)' };

// ---------- Circuit page pickers ----------
// Type of wiring, column 3 of the IET schedule of circuit details (codes as printed on the form).
export const WIRING_TYPES = [
  ['A', 'Thermoplastic (PVC) insulated and sheathed cables (e.g. T&E)'],
  ['B', 'Thermoplastic cables in metallic conduit'],
  ['C', 'Thermoplastic cables in non-metallic conduit'],
  ['D', 'Thermoplastic cables in metallic trunking'],
  ['E', 'Thermoplastic cables in non-metallic trunking'],
  ['F', 'Thermoplastic SWA cables'],
  ['G', 'Thermosetting (XLPE) SWA cables'],
  ['H', 'Mineral-insulated cables'],
  ['O', 'Other (state in remarks)'],
];
// Reference (installation) methods, column 4 — BS 7671 Appendix 4 Table 4A2 and the
// T&E methods 100–103 of Table 4D5. Short plain descriptions; see the table for the full text.
export const REF_METHODS = [
  ['A', 'In conduit in a thermally insulated wall'],
  ['B', 'In conduit or trunking on a wall'],
  ['C', 'Clipped direct (or in plaster / masonry, no insulation)'],
  ['D1', 'In a duct in the ground'],
  ['D2', 'Direct in the ground'],
  ['E', 'Multicore in free air / on a perforated tray'],
  ['F', 'Single-core in free air, touching'],
  ['G', 'Single-core in free air, spaced'],
  ['100', 'T&E above a plasterboard ceiling, insulation up to 100 mm'],
  ['101', 'T&E above a plasterboard ceiling, insulation over 100 mm'],
  ['102', 'T&E in an insulated stud wall, touching the inner skin'],
  ['103', 'T&E in an insulated stud wall, not touching the inner skin'],
];
// Cable picker on the circuit page: type + size → live and CPC csa.
// cpc: 'core' = a core the same size as live; 'armour' = the steel armour.
export const CABLE_PICKS = {
  te: { label: 'Twin & earth (6242Y)', calc: 'te', wiring: 'A', source: 'BS 6004 / maker data (e.g. Prysmian 6242Y)',
    sizes: { 1: 1, 1.5: 1, 2.5: 1.5, 4: 1.5, 6: 2.5, 10: 4, 16: 6 } },
  te3: { label: '3-core & earth (6243Y)', calc: 'te', wiring: 'A', source: 'BS 6004 / maker data',
    sizes: { 1: 1, 1.5: 1, 2.5: 1 },
    warn: { 2.5: '⚠ Makers’ data disagree on the CPC in 2.5 mm² 6243Y (1.0 or 1.5 mm²). The app fills 1.0 (the worse case). Check the print on the cable.' } },
  swa2: { label: '2-core SWA (armour as CPC)', calc: 'swa', wiring: 'F', cores: 2, cpc: 'armour', sizes: { 1.5: 'armour', 2.5: 'armour', 4: 'armour', 6: 'armour', 10: 'armour', 16: 'armour', 25: 'armour', 35: 'armour' } },
  swa3c: { label: '3-core SWA (3rd core as CPC)', calc: 'swa3', wiring: 'F', cores: 3, cpc: 'core', sizes: { 1.5: 1.5, 2.5: 2.5, 4: 4, 6: 6, 10: 10, 16: 16, 25: 25, 35: 35 } },
  swa3a: { label: '3-core SWA (armour as CPC)', calc: 'swa3', wiring: 'F', cores: 3, cpc: 'armour', sizes: { 1.5: 'armour', 2.5: 'armour', 4: 'armour', 6: 'armour', 10: 'armour', 16: 'armour', 25: 'armour', 35: 'armour' } },
  swa3cX: { label: '3-core XLPE SWA 6943X (3rd core as CPC)', calc: 'swa3X', wiring: 'G', cores: 3, cpc: 'core', sizes: { 1.5: 1.5, 2.5: 2.5, 4: 4, 6: 6, 10: 10, 16: 16, 25: 25, 35: 35 } },
  swa3aX: { label: '3-core XLPE SWA 6943X (armour as CPC)', calc: 'swa3X', wiring: 'G', cores: 3, cpc: 'armour', sizes: { 1.5: 'armour', 2.5: 'armour', 4: 'armour', 6: 'armour', 10: 'armour', 16: 'armour', 25: 'armour', 35: 'armour' } },
};

// ---------- v0.4 additions ----------
// Single-core 70 °C PVC (6491X) in conduit / trunking or clipped, two cables
// single-phase a.c. or d.c. Table 4D1A columns 2, 4 and 6 (checked against published
// copies, Oct 2026). Volt drop Table 4D1B single-phase; 25/35 mm² use the impedance z
// (1.80 / 1.30) — ⚠ from memory, check against your copy.
CABLES.singles = {
  label: 'Singles 70 °C PVC (6491X) in conduit / trunking',
  source: 'Table 4D1A (current, 2 cables 1-phase a.c./d.c.) and 4D1B (volt drop)',
  note: '⚠ Singles: Table 4D1A current ratings; volt drop from Table 4D1B (25/35 mm² use 1.80 / 1.30 mV/A/m, check against your copy). CPC is a separate single in the same conduit (Table 54.7 size, k 115 as it\u2019s bunched).',
  cores: 2,
  sizes: [1, 1.5, 2.5, 4, 6, 10, 16, 25, 35],
  mvam: { 1: 44, 1.5: 29, 2.5: 18, 4: 11, 6: 7.3, 10: 4.4, 16: 2.8, 25: 1.8, 35: 1.3 },
  methods: {
    A: { label: 'In conduit in an insulated wall (A)', amps: { 1: 11, 1.5: 14.5, 2.5: 20, 4: 26, 6: 34, 10: 46, 16: 61, 25: 80, 35: 99 } },
    B: { label: 'In conduit or trunking on a wall (B)', amps: { 1: 13.5, 1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 76, 25: 101, 35: 125 } },
    C: { label: 'Clipped direct (C)', amps: { 1: 15.5, 1.5: 20, 2.5: 27, 4: 37, 6: 47, 10: 65, 16: 87, 25: 114, 35: 141 } },
  },
};
CABLE_TEMP.singles = 70;
// 6243Y (3-core & earth) uses the T&E table (two loaded cores).
CABLES.te3 = { ...CABLES.te, label: '3-core & earth, 70 °C PVC (6243Y)', sizes: [1, 1.5, 2.5], note: '⚠ 6243Y is rated with the Table 4D5 T&E figures (two loaded cores on a single-phase circuit). Makers differ on the 2.5 mm² CPC (1.0 or 1.5); the app uses 1.0.' };
CABLE_TEMP.te3 = 70; CABLES.te3.cores = 2;

// Separate CPC for singles (Table 54.7: same as live up to 16 mm², 16 mm² for 25 and 35).
export const SINGLES_CPC = { 1: 1, 1.5: 1.5, 2.5: 2.5, 4: 4, 6: 6, 10: 10, 16: 16, 25: 16, 35: 16 };

// Steel wire armour cross-section, mm² (for the adiabatic check when the armour is the CPC).
// ⚠ Maker's data (BS 5467 600/1000 V XLPE/SWA, e.g. Prysmian / Anixter sheets), NOT BS 7671.
// PVC/SWA (BS 6346) is close but not identical. Use your cable's data sheet where you can.
export const ARMOUR_CSA = {
  source: 'Maker’s data (BS 5467 XLPE/SWA 600/1000 V), not BS 7671. Check your cable’s data sheet.',
  2: { 1.5: 16, 2.5: 17, 4: 21, 6: 23, 10: 26, 16: 31, 25: 42, 35: 46 },
  3: { 1.5: 17, 2.5: 19, 4: 23, 6: 24, 10: 29, 16: 33, 25: 46, 35: 52 },
};

// k for the adiabatic equation S = √(I²t) / k (Regulation 543.1.3).
//  Table 54.2: separate insulated CPC, not in a cable or bunched — 70 °C PVC 143, 90 °C XLPE 176.
//  Table 54.3: CPC as a core in a cable or bunched with cables — 70 °C PVC 115, 90 °C XLPE 143.
//  Table 54.4: steel armour as CPC — 70 °C PVC cable 51, 90 °C XLPE cable 46.
export const K_VALUES = {
  source: 'BS 7671 Tables 54.2, 54.3 and 54.4 (copper conductors; steel armour)',
  core70: { k: 115, label: 'Copper core in a 70 °C PVC cable, or bunched (Table 54.3)' },
  core90: { k: 143, label: 'Copper core in a 90 °C XLPE cable (Table 54.3)' },
  sep70: { k: 143, label: 'Separate PVC-insulated copper CPC, not bunched (Table 54.2)' },
  sep90: { k: 176, label: 'Separate XLPE-insulated copper CPC, not bunched (Table 54.2)' },
  armour70: { k: 51, label: 'Steel armour of a 70 °C PVC SWA cable (Table 54.4)' },
  armour90: { k: 46, label: 'Steel armour of a 90 °C XLPE SWA cable (Table 54.4)' },
};

// v0.34: methods whose ratings already allow for thermal insulation (A = conduit in an
// insulated wall; 100–103 = T&E in insulated ceilings/walls, Table 4D5). Ci isn't applied on top.
export const INSULATED_METHOD_NOTE = 'This method already allows for thermal insulation';
export function methodHasInsulation(method) { return /^(A|10[0-3])$/.test(String(method || '')); }
export function effectiveCi(method, ci) { return methodHasInsulation(method) ? 1 : Number(ci) || 1; }
// Thermal insulation factor Ci (Table 52.2 for short lengths; 0.5 for 0.5 m or more).
export const CI_OPTIONS = [
  ['1', 'None (Ci 1.0)'],
  ['0.88', 'Through insulation for 50 mm (Ci 0.88)'],
  ['0.78', 'Through insulation for 100 mm (Ci 0.78)'],
  ['0.63', 'Through insulation for 200 mm (Ci 0.63)'],
  ['0.51', 'Through insulation for 400 mm (Ci 0.51)'],
  ['0.5', 'Totally surrounded for 0.5 m or more (Ci 0.5)'],
];

// ---------- v0.5: three-phase (400 V, balanced loads) ----------
// Used by the sizer when "3-phase" is picked. Ratings are the "one three-core or
// four-core cable, three-phase a.c." columns; volt drop is the three-phase mV/A/m
// (line-to-line, so the % is taken of 400 V). ⚠ Typed in from memory of Appendix 4:
// check every figure against your copy before relying on it (see HANDOFF "v0.5 values").
export const UL = 400;
CABLES.swa4 = {
  label: '4-core SWA, 70 °C PVC (3-phase, armour as CPC)', phase: 3, cores: 4,
  source: 'Table 4D4A (3/4-core, three-phase columns) and 4D4B (three-phase volt drop)',
  note: '⚠ 3-phase figures from memory of Table 4D4A/4D4B; armour resistance and area are typical maker’s figures (BS 6346/BS 5467). Check your copy and the cable data sheet.',
  sizes: [1.5, 2.5, 4, 6, 10, 16, 25, 35],
  mvam: { 1.5: 25, 2.5: 15, 4: 9.5, 6: 6.4, 10: 3.8, 16: 2.4, 25: 1.5, 35: 1.1 },
  methods: {
    C: { label: 'Clipped direct (C)', amps: { 1.5: 18, 2.5: 25, 4: 33, 6: 42, 10: 58, 16: 77, 25: 102, 35: 125 } },
    D: { label: 'Direct in the ground (D)', amps: { 1.5: 18, 2.5: 24, 4: 30, 6: 38, 10: 50, 16: 64, 25: 82, 35: 98 } },
  },
};
CABLES.swa4X = {
  label: '4-core SWA, 90 °C XLPE (6944X) (3-phase, armour as CPC)', phase: 3, cores: 4,
  source: 'Table 4E4A (3/4-core, three-phase columns) and 4E4B (three-phase volt drop)',
  note: '⚠ 3-phase figures from memory of Table 4E4A/4E4B; armour resistance and area are typical maker’s figures (BS 5467). Check your copy and the cable data sheet.',
  sizes: [1.5, 2.5, 4, 6, 10, 16, 25, 35],
  mvam: { 1.5: 27, 2.5: 16, 4: 10, 6: 6.8, 10: 4.0, 16: 2.5, 25: 1.65, 35: 1.15 },
  methods: {
    C: { label: 'Clipped direct (C)', amps: { 1.5: 23, 2.5: 31, 4: 42, 6: 53, 10: 73, 16: 94, 25: 124, 35: 154 } },
    D: { label: 'Direct in the ground (D)', amps: { 1.5: 21, 2.5: 28, 4: 36, 6: 44, 10: 58, 16: 75, 25: 96, 35: 115 } },
  },
};
// Singles three-phase: Table 4D1A "three or four cables, three-phase" columns 3, 5 and 7;
// volt drop = the single-phase Table 4D1B figure × √3/2 (that's how the three-phase column
// is derived), rounded.
CABLES.singles3 = {
  label: 'Singles 70 °C PVC (6491X), 3-phase (separate CPC)', phase: 3, cores: 4,
  source: 'Table 4D1A (three or four cables, three-phase) and 4D1B (three-phase volt drop)',
  note: '⚠ 3-phase figures from memory of Table 4D1A; volt drop is the single-phase figure × 0.866. CPC is a separate single in the same conduit (Table 54.7 size, k 115).',
  sizes: [1, 1.5, 2.5, 4, 6, 10, 16, 25, 35],
  mvam: { 1: 38, 1.5: 25, 2.5: 15, 4: 9.5, 6: 6.4, 10: 3.8, 16: 2.4, 25: 1.55, 35: 1.15 },
  methods: {
    A: { label: 'In conduit in an insulated wall (A)', amps: { 1: 10.5, 1.5: 13.5, 2.5: 18, 4: 24, 6: 31, 10: 42, 16: 56, 25: 73, 35: 89 } },
    B: { label: 'In conduit or trunking on a wall (B)', amps: { 1: 12, 1.5: 15.5, 2.5: 21, 4: 28, 6: 36, 10: 50, 16: 68, 25: 89, 35: 110 } },
    C: { label: 'Clipped direct (C)', amps: { 1: 14, 1.5: 18, 2.5: 25, 4: 33, 6: 43, 10: 59, 16: 79, 25: 104, 35: 129 } },
  },
};
CABLE_TEMP.swa4 = 70; CABLE_TEMP.swa4X = 90; CABLE_TEMP.singles3 = 70;
// 4-core SWA armour (typical maker's figures, ⚠ check the data sheet).
ARMOUR_CSA[4] = { 1.5: 18, 2.5: 20, 4: 24, 6: 35, 10: 40, 16: 46, 25: 62, 35: 68 };
ARMOUR_MOHM_PER_M[4] = { 1.5: 9.5, 2.5: 7.9, 4: 6.8, 6: 4.0, 10: 3.6, 16: 3.2, 25: 2.3, 35: 2.0 };
export const THREE_PHASE_CABLES = ['swa4', 'swa4X', 'singles3'];

// =====================================================================
// v0.19 additions. Every figure marked TYPICAL below is shown in the app
// with "typical, check your books" (see TYPICAL_NOTE).
// =====================================================================
export const TYPICAL_NOTE = 'Typical figures: check your books (BS 7671 Appendix 4) or the cable maker\u2019s data.';
const ext = (tbl, add) => { for (const [k, v] of Object.entries(add)) tbl[k] = v; };
const addSizes = (c, mv, amps) => { c.sizes = [...c.sizes, 50, 70, 95]; ext(c.mvam, mv); for (const [m, a] of Object.entries(amps)) ext(c.methods[m].amps, a); c.big = true; };
// 50, 70 and 95 mm² (stop at 95). Current: Table 4D4A / 4E4A (SWA), 4D1A (singles).
// Volt drop: Tables 4D4B / 4E4B / 4D1B, the z (impedance) column above 35 mm².
// v0.19.1: checked against published copies of BS 7671 (Oct 2026), all within 5%:
//  4D4A/4D4B: https://www.elandcables.com/media/of4pe0xx/table-4d4a-and-4d4b.pdf (D = column D1, ducts)
//  4E4A/4E4B: https://intrelec.co.uk/2020/10/21/swa-cable-sizing-charts/ and Anixter BS 5467 sheet https://objects.eanixter.com/PD372902-AN.PDF
//  4D1A/4D1B: https://www.elandcables.com/media/vyrp3kxq/table-4d1a-and-4d1b.pdf and https://www.ukcables.co.uk/wp-content/uploads/2025/03/6491X_UK-CABLES-DATA-SHEETS-.pdf
//  Singles 3-phase volt drop changed 0.87/0.62 -> 0.85/0.61 (4D1B col 6 z).
addSizes(CABLES.swa, { 50: 0.94, 70: 0.65, 95: 0.5 }, { C: { 50: 175, 70: 222, 95: 269 }, D: { 50: 140, 70: 173, 95: 204 } });
addSizes(CABLES.swa3, { 50: 0.94, 70: 0.65, 95: 0.5 }, { C: { 50: 175, 70: 222, 95: 269 }, D: { 50: 140, 70: 173, 95: 204 } });
addSizes(CABLES.swaX, { 50: 1.0, 70: 0.71, 95: 0.53 }, { C: { 50: 219, 70: 279, 95: 338 }, D: { 50: 164, 70: 203, 95: 239 } });
addSizes(CABLES.swa3X, { 50: 1.0, 70: 0.71, 95: 0.53 }, { C: { 50: 219, 70: 279, 95: 338 }, D: { 50: 164, 70: 203, 95: 239 } });
addSizes(CABLES.swa4, { 50: 0.81, 70: 0.57, 95: 0.43 }, { C: { 50: 151, 70: 192, 95: 232 }, D: { 50: 116, 70: 143, 95: 169 } });
addSizes(CABLES.swa4X, { 50: 0.87, 70: 0.61, 95: 0.45 }, { C: { 50: 187, 70: 238, 95: 289 }, D: { 50: 135, 70: 167, 95: 197 } });
addSizes(CABLES.singles, { 50: 1.0, 70: 0.72, 95: 0.56 }, { A: { 50: 119, 70: 151, 95: 182 }, B: { 50: 151, 70: 192, 95: 232 }, C: { 50: 182, 70: 234, 95: 284 } });
addSizes(CABLES.singles3, { 50: 0.85, 70: 0.61, 95: 0.48 }, { A: { 50: 108, 70: 136, 95: 164 }, B: { 50: 134, 70: 171, 95: 207 }, C: { 50: 167, 70: 214, 95: 261 } });
// Copper class 2 conductors, BS EN 60228 Table 1 maxima at 20 °C (matches Prysmian 6491X sheet
// https://datasheet.prysmian.com/pdf/datasheet/en-GB/312411/GB00_6491X).
ext(CU_MOHM_PER_M, { 50: 0.387, 70: 0.268, 95: 0.193 });
// Table 54.7: CPC S/2 above 35 mm².
ext(SINGLES_CPC, { 50: 25, 70: 35, 95: 50 });
// Armour 50–95 mm², v0.19.1 corrected to maker's data (BS 5467 XLPE/SWA 600/1000 V):
//  resistance = BS 5467 Table F.2 maxima at 20 °C, shaped conductors, as in Anixter p.20•31
//  https://objects.eanixter.com/PD372902-AN.PDF (was 2.0/1.4/1.2, 1.9/1.3/1.1, 1.7/1.2/0.98: too low);
//  gross armour area = Anixter p.20•33 and Dungannon https://www.dungannonelectrical.co.uk/pdf/cable/SWA.pdf
//  (was 62/70/98, 68/78/113, 77/90/128). PVC/SWA (BS 6346) can differ slightly: check the drum sheet.
ext(ARMOUR_MOHM_PER_M[2], { 50: 2.3, 70: 2.0, 95: 1.4 }); ext(ARMOUR_MOHM_PER_M[3], { 50: 2.0, 70: 1.8, 95: 1.3 }); ext(ARMOUR_MOHM_PER_M[4], { 50: 1.8, 70: 1.2, 95: 1.1 });
ext(ARMOUR_CSA[2], { 50: 68, 70: 80, 95: 113 }); ext(ARMOUR_CSA[3], { 50: 78, 70: 90, 95: 128 }); ext(ARMOUR_CSA[4], { 50: 90, 70: 131, 95: 147 });
for (const k of ['swa2', 'swa3a', 'swa3aX']) ext(CABLE_PICKS[k].sizes, { 50: 'armour', 70: 'armour', 95: 'armour' });
for (const k of ['swa3c', 'swa3cX']) ext(CABLE_PICKS[k].sizes, { 50: 50, 70: 70, 95: 95 });
CABLE_PICKS.swa4a = { label: '4-core SWA (armour as CPC)', calc: 'swa4', wiring: 'F', cores: 4, cpc: 'armour', sizes: Object.fromEntries(CABLES.swa4.sizes.map((s) => [s, 'armour'])) };
CABLE_PICKS.swa4aX = { label: '4-core XLPE SWA 6944X (armour as CPC)', calc: 'swa4X', wiring: 'G', cores: 4, cpc: 'armour', sizes: Object.fromEntries(CABLES.swa4X.sizes.map((s) => [s, 'armour'])) };

// Fine-stranded (class 5) copper, BS EN 60228 Table 3 maxima at 20 °C, mΩ/m. Used for flexes.
export const CU5_MOHM_PER_M = { 0.5: 39.0, 0.75: 26.0, 1: 19.5, 1.25: 15.6, 1.5: 13.3, 2.5: 7.98, 4: 4.95, 6: 3.3, 10: 1.91, 16: 1.21, 25: 0.78, 35: 0.554, 50: 0.386, 70: 0.272, 95: 0.206 };
// Ambient factor for 60 °C rubber (Table 4B1, 60 °C column) and the hot-resistance multiplier.
CA[60] = { 20: 1.04, 25: 1.04, 30: 1.0, 35: 0.91, 40: 0.82, 45: 0.71, 50: 0.58, 55: 0.41, 60: 0.01 };
TEMP_MULT[60] = 1.16; // (234.5 + 60) ÷ (234.5 + 20)
// k (Table 54.3): 60 °C thermosetting (rubber) core 141; 90 °C thermoplastic core 100 (BS 7671 Table 54.3).
K_VALUES.core60 = { k: 141, label: 'Copper core in a 60 °C rubber cable (Table 54.3)' };
K_VALUES.core90tp = { k: 100, label: 'Copper core, 90 °C thermoplastic, bunched (Table 54.3)' };
// Three-phase version of a single-phase table (TYPICAL: ratings × ampF, volt drop × √3/2).
const three = (c, label, ampF, extra = {}) => ({ ...c, ...extra, label, phase: 3, cores: c.cores, mvam: Object.fromEntries(Object.entries(c.mvam).map(([s, v]) => [s, Math.round(v * 0.866 * 100) / 100])),
  methods: Object.fromEntries(Object.entries(c.methods).map(([m, x]) => [m, { ...x, amps: Object.fromEntries(Object.entries(x.amps).map(([s, a]) => [s, Math.round(a * ampF * 2) / 2])) }])) });

// 1. H07RN-F heavy rubber flex (60 °C). v0.19.1: CORRECTED (v0.19 ratings were 10–25% too high).
//  4–95 mm²: BS 7671 Table 4F1A (free air, may rest on a surface; one column only) and 4F1B, as
//  reproduced by UK Cables https://www.ukcables.co.uk/wp-content/uploads/2025/03/H07RN-F-SINGLE-MULTICORE_UK-CABLES-DATA-SHEETS-.pdf
//  and Multicomp/Farnell https://www.farnell.com/datasheets/2922063.pdf
//  1–2.5 mm²: Table 4F3A / 4F3B (60 °C flexible cords), same two sheets.
//  4F1A gives no two-core figure above 25 mm², so 35–95 mm² single-phase uses the 3/4/5-core figure
//  (on the safe side), and single-phase volt drop above 25 mm² = three-phase z × 2/√3.
//  One core is the CPC (same size as the live).
const RN_SIZES = [1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95];
const RN1 = { 1: 10, 1.5: 16, 2.5: 25, 4: 30, 6: 39, 10: 51, 16: 73, 25: 97, 35: 102, 50: 124, 70: 158, 95: 192 };
const RN3 = { 1: 10, 1.5: 16, 2.5: 20, 4: 26, 6: 34, 10: 47, 16: 63, 25: 83, 35: 102, 50: 124, 70: 158, 95: 192 };
CABLES.h07 = {
  label: 'H07RN-F rubber flex, 60 °C (3-core: L, N, E)', cores: 3, cpcCore: true, rTable: 'cu5',
  source: 'Table 4F1A / 4F1B (4 mm² up) and 4F3A / 4F3B (1–2.5 mm²), 60 °C rubber flexible cables',
  note: 'H07RN-F: Table 4F1A / 4F3A ratings (free air or resting on a surface). One core is the CPC. 35–95 mm² use the three-core figure. Reduce the rating if it\u2019s on a drum or coiled up. Rubber runs at 60 °C, so hot rooms derate it hard.',
  sizes: RN_SIZES,
  mvam: { 1: 46, 1.5: 32, 2.5: 19, 4: 12, 6: 7.8, 10: 4.6, 16: 2.9, 25: 1.85, 35: 1.33, 50: 0.97, 70: 0.67, 95: 0.51 },
  methods: {
    C: { label: 'In free air or resting on a surface', amps: RN1 },
    E: { label: 'On a perforated tray (same as free air, Table 4F1A)', amps: { ...RN1 } },
  },
};
CABLES.h073 = { ...CABLES.h07, label: 'H07RN-F rubber flex, 60 °C, 3-phase (4/5-core, a core as CPC)', phase: 3, cores: 3,
  mvam: { 1: 40, 1.5: 27, 2.5: 16, 4: 10, 6: 6.7, 10: 4.0, 16: 2.5, 25: 1.55, 35: 1.15, 50: 0.84, 70: 0.58, 95: 0.44 },
  methods: { C: { label: 'In free air or resting on a surface', amps: RN3 }, E: { label: 'On a perforated tray (same as free air, Table 4F1A)', amps: { ...RN3 } } } };
CABLE_TEMP.h07 = 60; CABLE_TEMP.h073 = 60;
const sameCore = (sizes) => Object.fromEntries(sizes.map((s) => [s, s]));
CABLE_PICKS.h07r2 = { label: 'H07RN-F rubber flex 2-core (no CPC, Class II only)', calc: 'h07', wiring: 'O', cpc: 'none', sizes: Object.fromEntries(RN_SIZES.map((s) => [s, 'none'])) };
CABLE_PICKS.h07r3 = { label: 'H07RN-F rubber flex 3-core (core as CPC)', calc: 'h07', wiring: 'O', cpc: 'core', sizes: sameCore(RN_SIZES) };
CABLE_PICKS.h07r4 = { label: 'H07RN-F rubber flex 4-core, 3-phase (core as CPC)', calc: 'h073', wiring: 'O', cpc: 'core', sizes: sameCore(RN_SIZES) };
CABLE_PICKS.h07r5 = { label: 'H07RN-F rubber flex 5-core, 3-phase + N (core as CPC)', calc: 'h073', wiring: 'O', cpc: 'core', sizes: sameCore(RN_SIZES) };

// 9. Meter tails 6181Y (70 °C single-core, double insulated): Table 4D1A ratings (single-core 70 °C
// thermoplastic, with or without sheath), Table 4D1B volt drop. Earth is a separate 16 mm² (Table 54.7).
CABLES.tails = {
  label: 'Meter tails 6181Y, 70 °C (separate earth)', cores: 2, tails: true,
  source: 'Table 4D1A (current) and 4D1B (volt drop), single-core 70 °C thermoplastic',
  note: 'Meter tails: the app also checks the tails\u2019 rating against the cutout (supplier\u2019s) fuse. Most DNOs want 25 mm² for a 100 A fuse and tails kept short; check the DNO\u2019s rules.',
  sizes: [16, 25, 35],
  mvam: { 16: 2.8, 25: 1.8, 35: 1.3 },
  methods: {
    C: { label: 'Clipped direct (C)', amps: { 16: 87, 25: 114, 35: 141 } },
    B: { label: 'In conduit or trunking on a wall (B)', amps: { 16: 76, 25: 101, 35: 125 } },
    A: { label: 'In conduit in an insulated wall (A)', amps: { 16: 61, 25: 80, 35: 99 } },
  },
};
CABLE_TEMP.tails = 70;
export const TAILS_CPC = { 16: 16, 25: 16, 35: 16 };
export const CUTOUT_FUSES = [60, 80, 100];
CABLE_PICKS.tails = { label: 'Meter tails 6181Y (16 mm² earth)', calc: 'tails', wiring: 'O', cpc: 'sep', sizes: TAILS_CPC };

// 10. PVC flex 3183Y (70 °C, 3-core with earth): Table 4F3A (flexible cords) current and
// Table 4F3B volt drop, single-phase. v0.19.1: confirmed against
// https://www.cse-distributors.co.uk/cable/technical-tables-useful-info/table-4f3a.html and .../table-4f3b.html
// (also https://www.farnell.com/datasheets/1661791.pdf for 3183Y). ⚠ 4F3A/4F3B are 60 °C tables.
const FLEX_SIZES = [0.5, 0.75, 1, 1.25, 1.5, 2.5, 4];
CABLES.flex = {
  label: 'PVC flex 3183Y, rated at 60 °C (3-core: L, N, E)', cores: 3, cpcCore: true, rTable: 'cu5',
  source: 'Table 4F3A (flexible cords, current) and 4F3B (volt drop)',
  note: '3183Y: Table 4F3A ratings, 4F3B volt drop. For appliances and pendants: the flex is usually protected by the plug or spur fuse.',
  sizes: FLEX_SIZES,
  mvam: { 0.5: 93, 0.75: 62, 1: 46, 1.25: 37, 1.5: 32, 2.5: 19, 4: 12 },
  methods: { C: { label: 'In free air (flexible cord)', amps: { 0.5: 3, 0.75: 6, 1: 10, 1.25: 13, 1.5: 16, 2.5: 25, 4: 32 } } },
};
CABLE_TEMP.flex = 60; // v0.19.1: Table 4F3A is a 60 °C table, so use the 60 °C Ca (was 70).
CABLE_PICKS.flex = { label: 'PVC flex 3183Y (core as CPC)', calc: 'flex', wiring: 'O', cpc: 'core', sizes: sameCore(FLEX_SIZES) };

// 12. Tri-rated panel wire (BS 6231 / H07V2-K, 90 °C thermoplastic, single-core). Table 4E1A
// (90 °C single-core) method B ratings used for panel trunking. v0.19.1: 1–16 mm² confirmed against
// https://www.cse-distributors.co.uk/cable/technical-tables-useful-info/table-4e1a.html (cols 4 and 5) and
// volt drop against .../table-4e1b.html. ⚠ 0.5 / 0.75 mm² are NOT in BS 7671: 9 / 12 A are kept as a
// cautious figure (CSE quote about 11 / 14 A in free air, single cable:
// https://www.cse-distributors.co.uk/tri-rated-panel-cable/tri-rated-cable-sizes-current-ratings.html).
// Grouping (Table 4C1, bunched) always applies in a panel. Terminals are often only rated 70 °C
// (Regulation 512.1.5): check the equipment before running at 90 °C.
const TRI_SIZES = [0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10, 16];
CABLES.tri = {
  label: 'Tri-rated panel wire (BS 6231 / H07V2-K), 90 °C', cores: 2, cpcCore: true, rTable: 'cu5', typical: true, panel: true,
  source: 'Table 4E1A (90 °C single-core, method B) and maker\u2019s tri-rated data',
  note: '⚠ Tri-rated: 1–16 mm² from Table 4E1A (method B); 0.5 and 0.75 mm² aren\u2019t in BS 7671, so those are typical, check the maker\u2019s data. Grouping is applied (bunched). Many terminals are only rated 70 °C (512.1.5): if so, use the 70 °C figures.',
  sizes: TRI_SIZES,
  mvam: { 0.5: 93, 0.75: 62, 1: 46, 1.5: 31, 2.5: 19, 4: 12, 6: 7.9, 10: 4.7, 16: 2.9 },
  methods: {
    panel: { label: 'In panel trunking', amps: { 0.5: 9, 0.75: 12, 1: 17, 1.5: 23, 2.5: 31, 4: 42, 6: 54, 10: 75, 16: 100 } },
    bunch: { label: 'Bunched in a panel', bunched: true, amps: { 0.5: 9, 0.75: 12, 1: 17, 1.5: 23, 2.5: 31, 4: 42, 6: 54, 10: 75, 16: 100 } },
  },
};
// 3-phase: Table 4E1A col 5 and 4E1B col 6 (0.5 / 0.75 mm² scaled, typical).
CABLES.tri3 = three(CABLES.tri, 'Tri-rated panel wire, 90 °C, 3-phase', 0.88, { cores: 4 });
for (const m of ['panel', 'bunch']) ext(CABLES.tri3.methods[m].amps, { 1: 15, 1.5: 20, 2.5: 28, 4: 37, 6: 48, 10: 66, 16: 88 });
ext(CABLES.tri3.mvam, { 1: 40, 1.5: 27, 2.5: 16, 4: 10, 6: 6.8, 10: 4.0, 16: 2.5 });
CABLE_TEMP.tri = 90; CABLE_TEMP.tri3 = 90;
CABLE_PICKS.tri = { label: 'Tri-rated panel wire (separate CPC, same size)', calc: 'tri', wiring: 'O', cpc: 'core', sizes: sameCore(TRI_SIZES) };

// 13. SY / CY control cable (70 °C PVC multicore, braid or screen), rated to Table 4F3A flexible
// cords. v0.19.1: a stockist's SY sheet uses 4F3A too
// (https://allenbros.co.uk/storage/shop/products/files/SY%20Current%20Rating.pdf) and the single-phase
// figures match https://www.cse-distributors.co.uk/cable/technical-tables-useful-info/table-4f3a.html.
// 3-phase now uses the 4F3A three-phase column (was single-phase × 0.85). Kept TYPICAL: SY/CY makers
// don't all publish ratings, and multicores with more loaded cores need derating.
const SY_SIZES = [0.5, 0.75, 1, 1.5, 2.5, 4];
CABLES.sycy = {
  label: 'SY / CY control cable, 70 °C (a core as CPC)', cores: 3, cpcCore: true, rTable: 'cu5', typical: true,
  source: 'Maker\u2019s data (typical), rated like Table 4F3A flexible cords',
  note: '⚠ SY / CY ratings are typical, check maker data. The braid (SY) or screen (CY) isn\u2019t used as the CPC here: a core is.',
  sizes: SY_SIZES,
  mvam: { 0.5: 93, 0.75: 62, 1: 46, 1.5: 32, 2.5: 19, 4: 12 },
  methods: { C: { label: 'Clipped direct or in free air (C)', amps: { 0.5: 3, 0.75: 6, 1: 10, 1.5: 16, 2.5: 25, 4: 32 } } },
};
CABLES.sycy3 = three(CABLES.sycy, 'SY / CY control cable, 70 °C, 3-phase (a core as CPC)', 0.85, { cores: 5 });
ext(CABLES.sycy3.methods.C.amps, { 0.5: 3, 0.75: 6, 1: 10, 1.5: 16, 2.5: 20, 4: 25 }); ext(CABLES.sycy3.mvam, { 0.5: 80, 0.75: 54, 1: 40, 1.5: 27, 2.5: 16, 4: 10 });
CABLE_TEMP.sycy = 70; CABLE_TEMP.sycy3 = 70;
CABLE_PICKS.sycy = { label: 'SY / CY control cable (core as CPC)', calc: 'sycy', wiring: 'O', cpc: 'core', sizes: sameCore(SY_SIZES) };
THREE_PHASE_CABLES.push('h073', 'tri3', 'sycy3');

// v0.20: singles on the circuit page picker (separate CPC to Table 54.7). Wiring code left for you to pick
// (B/C/D/E depend on conduit or trunking, metal or plastic).
CABLE_PICKS.singles = { label: 'Singles 6491X in conduit / trunking (separate CPC)', calc: 'singles', wiring: '', cpc: 'sep', sizes: { ...SINGLES_CPC } };
CABLE_PICKS.singles3 = { label: 'Singles 6491X, 3-phase (separate CPC)', calc: 'singles3', wiring: '', cpc: 'sep', sizes: { ...SINGLES_CPC } };


// =====================================================================
// v0.29: more reference methods. Sources (published copies of BS 7671:2018 tables, Eland Cables):
//  4D4A https://www.elandcables.com/media/of4pe0xx/table-4d4a-and-4d4b.pdf
//  4E4A https://www.elandcables.com/media/cnwh0k2l/table-4e4a-and-4e4b.pdf
//  4D1A https://www.elandcables.com/media/vyrp3kxq/table-4d1a-and-4d1b.pdf
//  4E1A https://www.elandcables.com/media/ehkk3rg2/table-4e1a-and-4e1b.pdf
// v0.30: FP200 and mineral insulated removed (not used). Old saved ids load as plain text, no rating check.
// The old key D stays as D1 (in a duct) so saved calcs and certs keep working; D2 = direct in the ground.
// =====================================================================
const only = (cab, amps) => Object.fromEntries(Object.entries(amps).filter(([sz]) => cab.sizes.map(String).includes(String(sz))));
const addM = (key, m, label, amps, extra = {}) => { const cab = CABLES[key]; cab.methods[m] = { label, amps: only(cab, amps), ...extra }; };
const LBL = {
  D1: 'Reference Method D1: in a duct in the ground',
  D2: 'Reference Method D2: direct in the ground (no duct)',
  E: 'Reference Method E: multicore in free air or on a perforated tray',
  F: 'Reference Method F: single-core cables touching, in free air or on a perforated tray',
  G: 'Reference Method G: single-core cables spaced by one diameter, in free air',
};
// 4D4A (70 °C SWA): col 4 / 5 = E, col 8 / 9 = D2.
const D4A_E1 = { 1.5: 22, 2.5: 31, 4: 41, 6: 53, 10: 72, 16: 97, 25: 128, 35: 157, 50: 190, 70: 241, 95: 291 };
const D4A_E3 = { 1.5: 19, 2.5: 26, 4: 35, 6: 45, 10: 62, 16: 83, 25: 110, 35: 135, 50: 163, 70: 207, 95: 251 };
const D4A_D21 = { 1.5: 22, 2.5: 28, 4: 38, 6: 48, 10: 64, 16: 83, 25: 110, 35: 132, 50: 156, 70: 192, 95: 230 };
const D4A_D23 = { 1.5: 19, 2.5: 24, 4: 33, 6: 41, 10: 54, 16: 70, 25: 92, 35: 110, 50: 130, 70: 162, 95: 193 };
// 4E4A (90 °C XLPE SWA): col 4 / 5 = E, col 8 / 9 = D2.
const E4A_E1 = { 1.5: 29, 2.5: 39, 4: 52, 6: 66, 10: 90, 16: 115, 25: 152, 35: 188, 50: 228, 70: 291, 95: 354 };
const E4A_E3 = { 1.5: 25, 2.5: 33, 4: 44, 6: 56, 10: 78, 16: 99, 25: 131, 35: 162, 50: 197, 70: 251, 95: 304 };
const E4A_D21 = { 1.5: 27, 2.5: 35, 4: 46, 6: 58, 10: 77, 16: 100, 25: 129, 35: 155, 50: 183, 70: 225, 95: 270 };
const E4A_D23 = { 1.5: 23, 2.5: 30, 4: 39, 6: 49, 10: 65, 16: 84, 25: 107, 35: 129, 50: 153, 70: 188, 95: 226 };
for (const k of ['swa', 'swa3']) { addM(k, 'E', LBL.E, D4A_E1); addM(k, 'D2', LBL.D2, D4A_D21); }
for (const k of ['swaX', 'swa3X']) { addM(k, 'E', LBL.E, E4A_E1); addM(k, 'D2', LBL.D2, E4A_D21); }
addM('swa4', 'E', LBL.E, D4A_E3); addM('swa4', 'D2', LBL.D2, D4A_D23);
addM('swa4X', 'E', LBL.E, E4A_E3); addM('swa4X', 'D2', LBL.D2, E4A_D23);
for (const k of ['swa', 'swa3', 'swaX', 'swa3X', 'swa4', 'swa4X']) if (CABLES[k].methods.D) CABLES[k].methods.D.label = LBL.D1;
// 4D1A (70 °C singles, incl. 6181Y tails): F = col 8 (2 cables 1-phase, touching) / col 9 (3 cables flat, 3-phase);
// G = col 11 (spaced, horizontal). BS 7671 only tabulates F and G from 25 mm².
addM('singles', 'F', LBL.F, { 25: 131, 35: 162, 50: 196, 70: 251, 95: 304 }); addM('singles', 'G', LBL.G, { 25: 146, 35: 181, 50: 219, 70: 281, 95: 341 });
addM('tails', 'F', LBL.F, { 25: 131, 35: 162 }); addM('tails', 'G', LBL.G, { 25: 146, 35: 181 });
if (CABLES.singles3) { addM('singles3', 'F', LBL.F, { 25: 114, 35: 143, 50: 174, 70: 225, 95: 275 }); addM('singles3', 'G', LBL.G, { 25: 146, 35: 181, 50: 219, 70: 281, 95: 341 }); }
// 4E1A (90 °C XLPE singles, e.g. 6491B / tri-rated in conduit). 2 cables, single-phase.
CABLES.singlesX = {
  label: 'Singles 90 °C XLPE (e.g. 6491B) in conduit / trunking', cores: 2,
  source: 'Table 4E1A (current, 2 cables 1-phase) and 4E1B (volt drop)',
  note: 'XLPE singles: Table 4E1A (90 °C). Only use the 90 °C ratings where the breakers and accessories are rated for it (Reg 512.1.5); most are 70 °C, so use the 70 °C singles figures instead.',
  sizes: [1, 1.5, 2.5, 4, 6, 10, 16, 25, 35],
  mvam: { 1: 46, 1.5: 31, 2.5: 19, 4: 12, 6: 7.9, 10: 4.7, 16: 2.9, 25: 1.9, 35: 1.35 },
  methods: {
    A: { label: 'Reference Method A: enclosed in conduit in a thermally insulating wall', amps: { 1: 14, 1.5: 19, 2.5: 26, 4: 35, 6: 45, 10: 61, 16: 81, 25: 106, 35: 131 } },
    B: { label: 'Reference Method B: enclosed in conduit on a wall or in trunking', amps: { 1: 17, 1.5: 23, 2.5: 31, 4: 42, 6: 54, 10: 75, 16: 100, 25: 133, 35: 164 } },
    C: { label: 'Reference Method C: clipped direct', amps: { 1: 19, 1.5: 25, 2.5: 34, 4: 46, 6: 59, 10: 81, 16: 109, 25: 143, 35: 176 } },
    F: { label: LBL.F, amps: { 25: 161, 35: 200 } },
    G: { label: LBL.G, amps: { 25: 182, 35: 226 } },
  },
};
CABLE_TEMP.singlesX = 90;
CABLE_PICKS.singlesX = { label: 'Singles 90 \u00b0C XLPE in conduit / trunking (separate CPC)', calc: 'singlesX', wiring: '', cpc: 'sep', sizes: { ...SINGLES_CPC } };

// Which reference methods (cert column 4) suit a picked cable. No pick = the full list.
export const METHODS_FOR_PICK = (pickKey) => {
  const p = CABLE_PICKS[pickKey]; const cab = p && CABLES[p.calc];
  if (!cab) return null;
  const keys = new Set(Object.keys(cab.methods).map((k) => (k === 'D' ? 'D1' : k)));
  // Singles in conduit are A/B; clipped is C. Methods in the data, plus their cert codes.
  return REF_METHODS.filter(([k]) => keys.has(k));
};

// v0.22b: installation method wording as BS 7671 Table 4A2 / 4D5 / 4F1A (labels only, ratings unchanged).
const METHOD_WORDING = {
  'Clipped direct (C)': 'Reference Method C: clipped direct',
  'Direct in the ground (D)': 'Reference Method D: in the ground, direct or in a duct',
  'In conduit or trunking on a wall (B)': 'Reference Method B: enclosed in conduit on a wall or in trunking',
  'In conduit in an insulated wall (A)': 'Reference Method A: enclosed in conduit in a thermally insulating wall',
  'Clipped direct or in free air (C)': 'Reference Method C: clipped direct (or in free air)',
  'On a perforated tray (same as free air, Table 4F1A)': 'Reference Method E: on a perforated cable tray (free air, Table 4F1A)',
  'In free air or resting on a surface': 'In free air, or resting on a surface (Table 4F1A)',
  'In free air (flexible cord)': 'In free air (flexible cord, Table 4F3A)',
};
const TE_WORDING = {
  100: 'Installation Method 100: clipped direct to a wooden joist, or touching the plasterboard ceiling surface, above a plasterboard ceiling with thermal insulation not exceeding 100 mm in thickness',
  101: 'Installation Method 101: clipped direct to a wooden joist, or touching the plasterboard ceiling surface, above a plasterboard ceiling with thermal insulation exceeding 100 mm in thickness',
  102: 'Installation Method 102: in a stud wall with thermal insulation, with the cable touching the inner wall surface',
  103: 'Installation Method 103: in a stud wall with thermal insulation, with the cable not touching the inner wall surface',
};
for (const c of Object.values(CABLES)) for (const [k, m] of Object.entries(c.methods || {})) {
  if (TE_WORDING[k]) m.label = TE_WORDING[k]; else if (METHOD_WORDING[m.label]) m.label = METHOD_WORDING[m.label];
}
// Plain words for the More info sheet, by method key.
export const METHOD_INFO = {
  A: ['In conduit buried in, or behind, an insulated wall. Insulation on one side traps the heat.', 'Example: singles in conduit in a timber-frame wall full of insulation.'],
  B: ['In conduit or trunking fixed to the surface of a wall, or in trunking. Not in insulation.', 'Example: T&E in mini-trunking along a skirting, or singles in steel conduit on a garage wall.'],
  C: ['Clipped straight to a wall or ceiling, or buried in plaster or masonry with no insulation round it. The best-cooled everyday method.', 'Example: T&E clipped along a garage wall, or chased into a brick wall and plastered over.'],
  D: ['In a duct in the ground (D1).', 'Example: SWA to a garden office, pulled through a duct under the lawn.'],
  D1: ['In a duct in the ground. Ducts trap heat, so this is lower than direct in the ground.', 'Example: SWA to a garden office, pulled through a duct under the lawn.'],
  D2: ['Laid straight in the trench and backfilled, no duct.', 'Example: SWA buried direct across a field to a stable block.'],
  F: ['Single-core cables touching each other, in free air or on a perforated tray.', 'Example: meter tails or singles run together on open tray.'],
  G: ['Single-core cables spaced apart by at least one cable diameter, in free air.', 'Example: big singles on cleats with a gap between them.'],
  E: ['Multicore cable in free air, or on perforated tray, with air round it.', 'Example: a rubber flex run across open tray, or hanging free.'],
  100: ['T&E in a loft or ceiling void, fixed to a joist or lying on the plasterboard, with loft insulation over it up to 100 mm deep.', 'Example: a lighting circuit clipped to the joists with 100 mm of quilt laid on top.'],
  101: ['As 100, but with loft insulation deeper than 100 mm over it (most modern lofts: 250–300 mm).', 'Example: a shower cable across the loft under 270 mm of insulation.'],
  102: ['T&E in an insulated stud wall, touching the back of the plasterboard (the inner wall surface).', 'Example: a socket drop down a stud filled with insulation, cable pressed against the board.'],
  103: ['T&E in an insulated stud wall, NOT touching the board: fully surrounded by insulation. Lowest rating of all.', 'Example: a cable running through the middle of a wall full of mineral wool.'],
  panel: ['Tri-rated wire laid in slotted panel trunking inside an enclosure.', 'Example: control wiring in a motor control panel.'],
  bunch: ['Tri-rated wire bunched or tied together inside a panel. The bunched grouping factor is used.', 'Example: a loom of control wires tied together.'],
};
export const JOIST_HINT = 'Cables just passing through the same joist holes don\u2019t count as grouped; cables bunched together along the void do.';
