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

// ---------- v0.26: each line's share after diversity, with short working ----------
const fmt = (n) => String(r1(n));
const sumOf = (xs) => xs.reduce((s, x) => s + x, 0);
// The working for a whole group, in figures (e.g. "32 A + 40% of 32 A").
export function groupWork(g, amps) {
  const s = [...amps].sort((a, b) => b - a); const t = sumOf(s); const rest = sumOf(s.slice(1));
  switch (g) {
    case 'sockets': return rest ? `${fmt(s[0])} A + 40% of ${fmt(rest)} A` : `${fmt(s[0] || 0)} A in full`;
    case 'shower': { const r = sumOf(s.slice(2)); return s.length <= 1 ? `${fmt(t)} A in full` : `${fmt(s[0])} A + ${fmt(s[1])} A` + (r ? ` + 25% of ${fmt(r)} A` : ''); }
    case 'cooking': return t <= 10 ? `${fmt(t)} A in full (under 10 A)` : `10 A + 30% of ${fmt(t - 10)} A`;
    case 'heating': return t <= 10 ? `${fmt(t)} A in full (under 10 A)` : `10 A + 50% of ${fmt(t - 10)} A`;
    case 'lighting': return `66% of ${fmt(t)} A`;
    case 'cookerSocket': return `${s.length} × 5 A`;
    default: return 'no diversity';
  }
}
// Per item share within a group, in the same order as amps.
function itemShares(g, amps) {
  const n = amps.length; const order = amps.map((a, i) => i).sort((i, j) => amps[j] - amps[i] || i - j);
  const out = Array(n).fill(0); const t = sumOf(amps);
  if (g === 'sockets') order.forEach((i, rank) => (out[i] = amps[i] * (rank === 0 ? 1 : 0.4)));
  else if (g === 'shower') order.forEach((i, rank) => (out[i] = amps[i] * (rank < 2 ? 1 : 0.25)));
  else if (g === 'lighting') amps.forEach((a, i) => (out[i] = a * 0.66));
  else if (g === 'cooking' || g === 'heating') { const d = t <= 10 ? t : 10 + (g === 'cooking' ? 0.3 : 0.5) * (t - 10); amps.forEach((a, i) => (out[i] = t ? (a * d) / t : 0)); }
  else amps.forEach((a, i) => (out[i] = a));
  return out;
}
const groupOf = (l) => { const d = kind(l.k); return d ? (d.unit === 'each' ? 'cookerSocket' : d.group) : null; };
// loads → { lines: [{ connected, share, text, work, group, combined }], groups: [{ g, label, lines, connected, demand, work }] }
// Line shares add up to the group's figure (cooking and heating are shared out pro rata).
export function maxDemandLines(loads, { u = U } = {}) {
  const items = {}; // group → [{ line, a }]
  (loads || []).forEach((l, li) => {
    const g = groupOf(l); if (!g) return;
    const n = Math.max(0, Math.round(Number(l.qty) || 0)); const a = g === 'cookerSocket' ? 5 : ampsEach(l, u);
    for (let i = 0; i < n; i++) (items[g] ||= []).push({ line: li, a });
  });
  const shares = (loads || []).map(() => 0); const conn = (loads || []).map(() => 0);
  const linesIn = {}; (loads || []).forEach((l, li) => { const g = groupOf(l); if (g) (linesIn[g] ||= []).push(li); });
  const groups = [];
  for (const g of Object.keys(GROUP_LABEL)) {
    const its = items[g] || []; const amps = its.map((x) => x.a); const sh = itemShares(g, amps);
    its.forEach((x, i) => { shares[x.line] += sh[i]; conn[x.line] += x.a; });
    const lines = (linesIn[g] || []).length;
    if (lines) groups.push({ g, label: GROUP_LABEL[g], lines, items: its.length, connected: r1(sumOf(amps)), demand: r1(sumOf(sh)), work: its.length ? groupWork(g, amps) : '' });
  }
  const lines = (loads || []).map((l, li) => {
    const d = kind(l.k); const g = groupOf(l); if (!d) return null;
    const grp = groups.find((x) => x.g === g); const combined = Boolean(grp && grp.lines > 1);
    const qty = Math.max(0, Math.round(Number(l.qty) || 0));
    const text = d.unit === 'each' ? `${qty} × 5 A = ${fmt(conn[li])} A` : `${qty} × ${Number(l.value) || 0} ${d.unit} = ${fmt(conn[li])} A`;
    const work = !qty ? '' : combined ? `share of ${grp.label.toLowerCase()}, ${grp.lines} lines combined` : grp ? grp.work : '';
    return { group: g, combined, connected: r1(conn[li]), share: r1(shares[li]), text, work, full: qty ? `${text} · after diversity ${fmt(shares[li])} A` + (work ? ` (${work})` : '') : `${text} · nothing counted` };
  });
  return { lines, groups };
}

// v0.28: lines grouped by KIND for the screen (all heaters in one box, all cooking lines in one box…).
// Boxes come in order of each kind's first line. connected/share are the sums of that kind's lines;
// rule is the diversity rule of the group the kind belongs to; shared = that group also has other kinds.
export function kindBoxes(loads, opts) {
  const { lines, groups } = maxDemandLines(loads, opts); const boxes = []; const at = {};
  (loads || []).forEach((l, i) => { const d = kind(l.k); if (!d || !lines[i]) return;
    let b = at[l.k]; if (!b) { b = at[l.k] = { k: l.k, label: d.label, idx: [], connected: 0, share: 0, group: lines[i].group }; boxes.push(b); }
    b.idx.push(i); b.connected += lines[i].connected; b.share += lines[i].share; });
  for (const b of boxes) {
    b.connected = r1(b.connected); b.share = r1(b.share);
    const g = groups.find((x) => x.g === b.group);
    b.rule = RULES[b.group] || ''; b.groupLabel = g ? g.label : '';
    b.shared = Boolean(g && boxes.some((o) => o !== b && o.group === b.group));
    b.work = `${fmt(b.connected)} A connected · after diversity ${fmt(b.share)} A` + (b.shared ? ` (share of ${b.groupLabel.toLowerCase()})` : '');
  }
  // v0.28.1: the cooker-unit socket (+5 A) is a tick box inside the Cooking box, not a box of its own.
  // Stored as the existing 'cookerSocket' load line, so old saved data still loads and adds up the same.
  let cook = boxes.find((b) => b.k === 'cooking'); const sock = boxes.find((b) => b.k === 'cookerSocket');
  if (!cook && sock) { // old data: a socket line but no cooking lines yet, so show an empty Cooking box with it ticked
    cook = { k: 'cooking', label: kind('cooking').label, idx: [], connected: 0, share: 0, group: 'cooking', rule: RULES.cooking, groupLabel: GROUP_LABEL.cooking, shared: false, work: '0 A connected · after diversity 0 A' };
    boxes.splice(boxes.indexOf(sock), 0, cook);
  }
  if (cook) {
    const n = ccuSockets(loads); cook.ccu = n; cook.ccuIdx = sock ? sock.idx : [];
    if (n) { const before = cook.share; cook.share = r1(before + 5 * n); cook.connected = r1(cook.connected + 5 * n);
      cook.work += ` + ${n > 1 ? `${n} × 5 A` : '5 A'} CCU socket = ${fmt(cook.share)} A`; }
    if (sock) boxes.splice(boxes.indexOf(sock), 1);
  }
  return boxes;
}

// v0.28.1: how many cooker-unit sockets are counted (+5 A each), and the tick box toggle.
export const ccuSockets = (loads) => (loads || []).filter((l) => l && l.k === 'cookerSocket').reduce((s, l) => s + Math.max(0, Math.round(Number(l.qty) || 0)), 0);
export function setCcuSocket(loads, on) {
  const rest = (loads || []).filter((l) => !(l && l.k === 'cookerSocket'));
  return on ? [...rest, { k: 'cookerSocket', qty: 1 }] : rest;
}
// v0.28.1: old saved data with separate cooker-socket lines → one line at the end (what the tick box writes). Same total.
export function migrateCcu(loads) { const n = ccuSockets(loads); const rest = (loads || []).filter((l) => !(l && l.k === 'cookerSocket')); return n ? [...rest, { k: 'cookerSocket', qty: n }] : rest; }
