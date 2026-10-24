// refdata.js — v0.30: quick reference tables (BS 7671:2018+A4:2026). Pure data, no DOM.
// Every figure was cross-checked against 18theditionprep.co.uk/quick-reference and at least one
// other source (IET, NAPIT, BEAMA, Eland Cables, 2391prep). See /workspace notes crosscheck.md.
// Where sources disagreed, the BS 7671 wording is used and the More info says so.
export const REF = [
  {
    id: 'ground', title: 'Ground temperature factors', table: 'Table 4B2', ic: 'gauge',
    plain: 'For cables buried in the ground (methods D1 and D2). Ratings assume 20 \u00b0C ground, so warmer ground means a lower rating. Multiply the rating by the factor.',
    tables: [{ head: ['Ground temp (\u00b0C)', '70 \u00b0C PVC', '90 \u00b0C XLPE'], rows: [
      ['10', '1.10', '1.07'], ['15', '1.05', '1.04'], ['20', '1.00', '1.00'], ['25', '0.95', '0.96'], ['30', '0.89', '0.93'], ['35', '0.84', '0.89'],
      ['40', '0.77', '0.85'], ['45', '0.71', '0.80'], ['50', '0.63', '0.76'], ['55', '0.55', '0.71'], ['60', '0.45', '0.65'], ['65', '\u2014', '0.60'],
      ['70', '\u2014', '0.53'], ['75', '\u2014', '0.46'], ['80', '\u2014', '0.38']] }],
    more: ['Use this instead of the air temperature factor (Table 4B1) for buried cables. A dash means the cable must not be used at that temperature.',
      'The buried ratings also assume soil thermal resistivity of 2.5 K\u00b7m/W and about 0.7 m deep. Other soils use Table 4B3.'],
  },
  {
    id: 'bonding', title: 'Main bonding sizes', table: 'Table 54.8 and Reg 544.1.1', ic: 'link',
    plain: 'Size of the main protective bonding to gas, water and other services. On PME (TN-C-S) it goes by the size of the supply neutral (PEN).',
    tables: [{ caption: 'PME (TN-C-S) supplies', head: ['Supply neutral (PEN), copper', 'Main bonding, copper'], rows: [
      ['35 mm\u00b2 or less', '10 mm\u00b2'], ['over 35 up to 50 mm\u00b2', '16 mm\u00b2'], ['over 50 up to 95 mm\u00b2', '25 mm\u00b2'], ['over 95 up to 150 mm\u00b2', '35 mm\u00b2'], ['over 150 mm\u00b2', '50 mm\u00b2']] }],
    more: ['Not PME (TN-S or TT): at least half the size of the earthing conductor, never less than 6 mm\u00b2, and it need not be more than 25 mm\u00b2 (Reg 544.1.1).',
      'The network operator can ask for bigger. A typical house on a 25 mm\u00b2 service with PME needs 10 mm\u00b2 bonds.',
      'Supplementary bonding (Reg 544.2): 2.5 mm\u00b2 if sheathed or protected, 4 mm\u00b2 if not.'],
  },
  {
    id: 'ir', title: 'Minimum insulation resistance', table: 'Table 64 (Reg 643.3)', ic: 'gauge',
    plain: 'The lowest insulation resistance reading allowed, and the test voltage to use.',
    tables: [{ head: ['Circuit', 'Test voltage (DC)', 'Minimum'], rows: [
      ['SELV and PELV', '250 V', '0.5 M\u03a9'], ['Up to 500 V (normal 230 V and 400 V circuits)', '500 V', '1.0 M\u03a9'], ['Above 500 V', '1000 V', '1.0 M\u03a9']] }],
    more: ['Test line to neutral, and lines and neutral to earth. Disconnect or switch off anything that could be damaged or give a false reading (SPDs, dimmers, electronics).',
      'If an SPD or similar can\u2019t be disconnected, that circuit can be tested at 250 V, but it still needs at least 1 M\u03a9.',
      'A reading that passes but is much lower than you\u2019d expect (e.g. under 2 M\u03a9 on a new circuit) is worth a look.',
      'Some guides call this Table 61; in BS 7671:2018 it is Table 64.'],
  },
  {
    id: 'disc', title: 'Disconnection times', table: 'Table 41.1 (U\u2080 230 V)', ic: 'zap',
    plain: 'How fast the breaker, fuse or RCD must cut off an earth fault.',
    tables: [{ head: ['System', 'Final circuits up to 63 A with sockets, or up to 32 A fixed only', 'Distribution circuits and bigger final circuits'], rows: [
      ['TN (TN-S, TN-C-S)', '0.4 s', '5 s'], ['TT', '0.2 s', '1 s']] }],
    more: ['TN: Zs \u00d7 Ia \u2264 U\u2080 (Reg 411.4.4). TT with an RCD: RA \u00d7 I\u0394n \u2264 50 V (Reg 411.5.3).',
      'TT where an overcurrent device does the disconnecting and all extraneous parts are bonded: the TN times can be used.',
      'Some quick guides just say \u201cup to 32 A\u201d for the 0.4 s column; BS 7671 says 63 A for circuits with sockets and 32 A for fixed equipment only.'],
  },
  {
    id: 'r1r2', title: 'R1+R2 per metre', table: 'GN3 Table I1 / Appendix I', ic: 'layers',
    plain: 'Resistance of line plus CPC per metre of copper cable at 20 \u00b0C. Multiply by the length, then by 1.20 for a 70 \u00b0C PVC cable when it\u2019s working hot.',
    tables: [{ head: ['Line / CPC (mm\u00b2)', 'm\u03a9 per metre at 20 \u00b0C', '\u00d7 1.20 (hot)'], rows: [
      ['1.0 / 1.0', '36.20', '43.44'], ['1.5 / 1.0', '30.20', '36.24'], ['1.5 / 1.5', '24.20', '29.04'], ['2.5 / 1.5', '19.51', '23.41'], ['2.5 / 2.5', '14.82', '17.78'],
      ['4.0 / 1.5', '16.71', '20.05'], ['4.0 / 2.5', '12.02', '14.42'], ['4.0 / 4.0', '9.22', '11.06'], ['6.0 / 2.5', '10.49', '12.59'], ['6.0 / 6.0', '6.16', '7.39'],
      ['10 / 4.0', '6.44', '7.73'], ['10 / 10', '3.66', '4.39'], ['16 / 6.0', '4.23', '5.08'], ['16 / 16', '2.30', '2.76']] }],
    more: ['Example: 20 m of 2.5/1.5 T&E \u2192 20 \u00d7 19.51 \u00f7 1000 = 0.39 \u03a9 cold, \u00d7 1.20 = 0.47 \u03a9 hot.',
      'The 1.20 comes from 1 + 0.004 \u00d7 (70 \u2212 20). For checking a test reading against max Zs, use the 80% rule of thumb instead.',
      'Single-conductor figures (m\u03a9/m): 1.0 = 18.10, 1.5 = 12.10, 2.5 = 7.41, 4 = 4.61, 6 = 3.08, 10 = 1.83, 16 = 1.15.'],
  },
  {
    id: 'rcd', title: 'RCDs: types and where needed', table: 'Regs 411.3.3, 411.3.4, 522.6.202, 531.3, 421.1.7', ic: 'alert',
    plain: 'Where you need 30 mA RCD protection, which type to fit, and how fast it must trip.',
    tables: [
      { caption: 'Where a 30 mA RCD is needed', head: ['Where', 'Reg'], rows: [
        ['Socket-outlets up to 32 A (a documented risk assessment can omit it, not in dwellings)', '411.3.3'], ['Mobile equipment up to 32 A used outdoors', '411.3.3'],
        ['Lighting circuits in dwellings', '411.3.4'], ['Cables in walls under 50 mm deep with no earthed metal covering', '522.6.202'],
        ['All circuits in a bathroom or shower room', '701.411.3.3'], ['TT systems: RCD normally used for fault protection', '411.5.2']] },
      { caption: 'Types', head: ['Type', 'Detects', 'Typical use'], rows: [
        ['AC', 'AC only', 'Simple resistive loads. Being phased out for most circuits.'], ['A', 'AC and pulsating DC', 'General use, most modern loads, EV chargers with built-in 6 mA DC detection'],
        ['F', 'As A, plus mixed frequencies', 'Single-phase inverter drives, washing machines, heat pumps'], ['B', 'As F, plus smooth DC', 'Three-phase drives, some EV chargers and PV inverters']] },
      { caption: 'Trip times (general type, BS EN 61008 / 61009)', head: ['Test current', 'Must trip within'], rows: [['1 \u00d7 I\u0394n', '300 ms'], ['5 \u00d7 I\u0394n', '40 ms']] }],
    more: ['BS 7671 now only asks for the test at 1 \u00d7 I\u0394n; the 5 \u00d7 test is useful for fault-finding. Time-delayed (S type) RCDs: 130\u2013500 ms at 1 \u00d7, 50\u2013150 ms at 5 \u00d7.',
      'AFDDs (Reg 421.1.7): must be fitted on single-phase socket circuits up to 32 A in high-rise residential buildings, HMOs, purpose-built student accommodation and care homes. Recommended everywhere else.'],
  },
  {
    id: 'special', title: 'Special locations', table: 'BS 7671 Part 7', ic: 'info',
    plain: 'Quick notes for bathrooms, swimming pools, EV charge points and building sites.',
    cards: [
      { t: 'Bathrooms (Section 701)', lines: ['Zone 0: inside the bath or shower tray. SELV 12 V AC only, IPX7.', 'Zone 1: above zone 0 up to 2.25 m. IPX4 (IPX5 if cleaned with jets). Fixed equipment suitable for zone 1, e.g. shower, extractor.',
        'Zone 2: 0.6 m out from zone 1, up to 2.25 m. IPX4. No sockets (shaver units to BS EN 61558-2-5 are OK).', 'All circuits in the room need 30 mA RCD protection. Sockets other than shaver units must be 2.5 m from zone 1.'] },
      { t: 'Swimming pools (Section 702)', lines: ['Zone 0: inside the pool. SELV 12 V AC only, IPX8.', 'Zone 1: 2 m out from the edge, up to 2.5 m high. SELV 25 V AC or pool equipment, IPX4 (IPX5 if cleaned with jets).',
        'Zone 2: a further 1.5 m beyond zone 1. IPX2 indoors, IPX4 outdoors (IPX5 with jets). Sockets need 30 mA RCD, SELV or separation.', 'Supplementary bonding of everything in zones 0, 1 and 2.'] },
      { t: 'EV charge points (Section 722)', lines: ['Its own dedicated circuit. 30 mA RCD, Type A only if the charger has built-in DC detection (6 mA RDC-DD), otherwise Type B.',
        'PME: don\u2019t extend PME to an outdoor charger unless one of the 722.411.4.1 options is met (e.g. an earth electrode / TT, or a charger with open-PEN protection).'] },
      { t: 'Construction sites (Section 704)', lines: ['Portable tools: 110 V centre-tapped earth (reduced low voltage) preferred.', 'Sockets up to 32 A on 230 V: 30 mA RCD.',
        'Inspect and test site installations at least every 3 months (GN3 recommendation).'] }],
    more: ['These are summaries only. Read the full section for anything unusual.', 'Zone sizes for bathrooms and pools stop at fixed walls or partitions.'],
  },
  {
    id: 'ip', title: 'IP codes', table: 'BS EN 60529', ic: 'info',
    plain: 'IP + two digits. The first is protection from solids (fingers, tools, dust), the second from water. X means not tested.',
    tables: [
      { caption: 'First digit: solids', head: ['Digit', 'Protected against'], rows: [['0', 'Nothing'], ['1', 'Objects over 50 mm (back of hand)'], ['2', 'Objects over 12.5 mm (fingers)'], ['3', 'Objects over 2.5 mm (tools, thick wires)'], ['4', 'Objects over 1 mm (thin wires)'], ['5', 'Dust protected'], ['6', 'Dust tight']] },
      { caption: 'Second digit: water', head: ['Digit', 'Protected against'], rows: [['0', 'Nothing'], ['1', 'Dripping water'], ['2', 'Dripping water, tilted up to 15\u00b0'], ['3', 'Spraying water (up to 60\u00b0 from vertical)'], ['4', 'Splashing water, any direction'], ['5', 'Water jets'], ['6', 'Powerful water jets'], ['7', 'Temporary immersion'], ['8', 'Continuous immersion']] },
      { caption: 'Common ratings', head: ['Rating', 'Typical use'], rows: [['IP2X / IPXXB', 'Inside consumer units and enclosures (finger-safe)'], ['IP4X / IPXXD', 'Top surfaces of enclosures you can reach'], ['IPX4', 'Bathroom zones 1 and 2, outdoor sockets in use'], ['IPX5', 'Where water jets are used for cleaning'], ['IP65 / IP66', 'Outdoor lights, hose-down areas'], ['IPX7 / IPX8', 'Bath zone 0 / pool zone 0']] }],
    more: ['A letter after the digits (A\u2013D) means extra protection against access to live parts, e.g. IPXXB = finger-safe.'],
  },
];
export const refById = (id) => REF.find((r) => r.id === id) || null;
