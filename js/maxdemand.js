// =====================================================================
// maxdemand.js — v0.9: maximum demand with diversity, the way the IET
// On-Site Guide does it for a house (Appendix A, Table A2, from memory:
// ⚠ check against your copy). Plain JS, tested with Node.
// =====================================================================
export const U = 230;
const r1 = (n) => Math.round(n * 10) / 10;

// The kinds of load, how they're entered, and the diversity rule.
//   unit 'kW' (each), 'A' (circuit rating), 'W' (lighting load per circuit)
export const KINDS = [
  { k: 'cooking', label: 'Cooker / hob / oven', unit: 'kW', dflt: 3, group: 'cooking', hint: 'Each appliance\u2019s rating (hob and oven separately is fine).' },
  { k: 'cookerSocket', label: 'Cooker unit with a socket', unit: 'each', dflt: 1, group: 'cookerSocket', hint: 'Adds 5 A per cooker control unit with a socket.' },
  { k: 'immersion', label: 'Immersion heater', unit: 'kW', dflt: 3, group: 'water', hint: 'Thermostatic: no diversity.' },
  { k: 'heater', label: 'Space heater / storage / panel heater', unit: 'kW', dflt: 2, group: 'heating', hint: 'Fixed heating.' },
  { k: 'shower', label: 'Electric shower (instantaneous)', unit: 'kW', dflt: 9.5, group: 'shower', hint: 'Largest two 100%, rest 25%.' },
  { k: 'ring', label: 'Ring final (sockets)', unit: 'A', dflt: 32, group: 'sockets', hint: 'Breaker rating.' },
  { k: 'radial', label: 'Radial (sockets)', unit: 'A', dflt: 20, group: 'sockets', hint: 'Breaker rating.' },
  { k: 'lighting', label: 'Lighting circuit', unit: 'W', dflt: 400, group: 'lighting', hint: 'Lamps actually fitted (about 400 W on a typical LED circuit).' },
  { k: 'ev', label: 'EV charger', unit: 'kW', dflt: 7.4, group: 'ev', hint: 'No diversity unless it has load management.' },
  { k: 'other', label: 'Other fixed appliance', unit: 'kW', dflt: 1, group: 'heating', hint: 'Treated like heating and power.' },
];
export const kind = (k) => KINDS.find((x) => x.k === k);
// One load: { k, qty, value } → amps each.
export const ampsEach = (l, u = U) => { const d = kind(l.k); const v = Number(l.value) || 0; return !d ? 0 : d.unit === 'kW' ? (v * 1000) / u : d.unit === 'W' ? v / u : d.unit === 'A' ? v : 0; };

export const RULES = {
  cooking: '10 A + 30% of the rest',
  cookerSocket: '+5 A for each cooker unit with a socket',
  water: '100% (thermostatic water heating: no diversity)',
  heating: '100% of the first 10 A + 50% of the rest',
  shower: '100% of the largest + 100% of the second + 25% of the rest',
  sockets: '100% of the biggest circuit + 40% of every other',
  lighting: '66% of the total',
  ev: '100% (no diversity)',
};
export const GROUP_LABEL = { cooking: 'Cooking', cookerSocket: 'Cooker socket', water: 'Water heating', heating: 'Heating and power', shower: 'Showers', sockets: 'Socket circuits', lighting: 'Lighting', ev: 'EV charging' };

// The sum. loads: [{ k, qty, value }]. Returns each group's connected and
// after-diversity current, and the total.
export function maxDemand(loads, { u = U } = {}) {
  const each = {}; // group → [amps of each single item]
  for (const l of loads || []) {
    const d = kind(l.k); if (!d) continue;
    const n = Math.max(0, Math.round(Number(l.qty) || 0)); const a = ampsEach(l, u);
    if (d.unit === 'each') { (each.cookerSocket ||= []).push(...Array(n).fill(5)); continue; }
    for (let i = 0; i < n; i++) (each[d.group] ||= []).push(a);
  }
  const sum = (xs) => xs.reduce((s, x) => s + x, 0);
  const desc = (xs) => [...xs].sort((a, b) => b - a);
  const div = {
    cooking: (xs) => { const t = sum(xs); return t <= 10 ? t : 10 + 0.3 * (t - 10); },
    cookerSocket: sum,
    water: sum,
    heating: (xs) => { const t = sum(xs); return t <= 10 ? t : 10 + 0.5 * (t - 10); },
    shower: (xs) => { const s = desc(xs); return (s[0] || 0) + (s[1] || 0) + 0.25 * sum(s.slice(2)); },
    sockets: (xs) => { const s = desc(xs); return (s[0] || 0) + 0.4 * sum(s.slice(1)); },
    lighting: (xs) => 0.66 * sum(xs),
    ev: sum,
  };
  const groups = Object.keys(GROUP_LABEL).filter((g) => each[g] && each[g].length).map((g) => ({ g, label: GROUP_LABEL[g], rule: RULES[g], items: each[g].length, connected: r1(sum(each[g])), demand: r1(div[g](each[g])) }));
  const exact = Object.keys(each).reduce((s, g) => s + div[g](each[g]), 0);
  return { u, groups, connected: r1(groups.reduce((s, x) => s + sum(each[x.g]), 0)), total: r1(exact), totalKVA: r1((exact * u) / 1000) };
}

// The sanity example (Matthew's): hob 7 kW + oven 3 kW, 2 × 3 kW immersions,
// 6 × 2 kW radiators, 2 rings, 2 lighting circuits.
export const EXAMPLE = [
  { k: 'cooking', qty: 1, value: 7, name: 'Hob' }, { k: 'cooking', qty: 1, value: 3, name: 'Oven' },
  { k: 'immersion', qty: 2, value: 3 }, { k: 'heater', qty: 6, value: 2, name: 'Radiators' },
  { k: 'ring', qty: 2, value: 32 }, { k: 'lighting', qty: 2, value: 400 },
];
