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
export const CA = {
  70: { 25: 1.03, 30: 1.0, 35: 0.94, 40: 0.87, 45: 0.79, 50: 0.71 },
  90: { 25: 1.02, 30: 1.0, 35: 0.96, 40: 0.91, 45: 0.87, 50: 0.82 },
};
// Grouping factor Cg (Table 4C1): bunched/enclosed (row 1), and single layer clipped to a wall touching (row 2).
export const CG = {
  bunched: { 1: 1.0, 2: 0.8, 3: 0.7, 4: 0.65, 5: 0.6, 6: 0.57, 7: 0.54, 8: 0.52, 9: 0.5 },
  clipped: { 1: 1.0, 2: 0.85, 3: 0.79, 4: 0.75, 5: 0.73, 6: 0.72, 7: 0.72, 8: 0.71, 9: 0.7 },
};
export const CF_BS3036 = 0.725; // Regulation 433.1.202 / Appendix 4 — semi-enclosed fuse
export const CABLE_TEMP = { te: 70, swa: 70, swaX: 90 };
