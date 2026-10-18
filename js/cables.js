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
      100: { label: 'Above a plasterboard ceiling, insulation ≤100 mm (100)', amps: { 1: 13, 1.5: 16, 2.5: 21, 4: 27, 6: 34, 10: 45, 16: 57 } },
      101: { label: 'Above a plasterboard ceiling, insulation >100 mm (101)', amps: { 1: 10.5, 1.5: 13, 2.5: 17, 4: 22, 6: 27, 10: 36, 16: 46 } },
      102: { label: 'In an insulated stud wall, touching inner skin (102)', amps: { 1: 13, 1.5: 16, 2.5: 21, 4: 27, 6: 35, 10: 47, 16: 63 } },
      103: { label: 'In an insulated stud wall, not touching (103)', amps: { 1: 8, 1.5: 10, 2.5: 13.5, 4: 17.5, 6: 23.5, 10: 32, 16: 42.5 } },
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
// Grouping factor Cg (Table 4C1): bunched/enclosed (row 1), and single layer clipped to a wall touching (row 2).
export const CG = {
  bunched: { 1: 1.0, 2: 0.8, 3: 0.7, 4: 0.65, 5: 0.6, 6: 0.57, 7: 0.54, 8: 0.52, 9: 0.5 },
  clipped: { 1: 1.0, 2: 0.85, 3: 0.79, 4: 0.75, 5: 0.73, 6: 0.72, 7: 0.72, 8: 0.71, 9: 0.7 },
};
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
  ['E', 'Multicore in free air / on perforated tray'],
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
    A: { label: 'In conduit in an insulated wall (A)', amps: { 1: 11, 1.5: 14.5, 2.5: 19.5, 4: 26, 6: 34, 10: 46, 16: 61, 25: 80, 35: 99 } },
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

// Thermal insulation factor Ci (Table 52.2 for short lengths; 0.5 for 0.5 m or more).
export const CI_OPTIONS = [
  ['1', 'None (Ci 1.0)'],
  ['0.88', 'Through insulation for 50 mm (Ci 0.88)'],
  ['0.78', 'Through insulation for 100 mm (Ci 0.78)'],
  ['0.63', 'Through insulation for 200 mm (Ci 0.63)'],
  ['0.51', 'Through insulation for 400 mm (Ci 0.51)'],
  ['0.5', 'Totally surrounded for 0.5 m or more (Ci 0.5)'],
];
