// =====================================================================
// templates.js — circuit templates and the blank circuit row.
// =====================================================================
// Column numbers match the IET Generic Schedules (A4:2026): circuit
// details 1–16, test results 17–31.
export const FIELDS = [
  // circuit details
  { k: 'num', col: 1, label: 'Circuit number', short: 'No.' },
  { k: 'desc', col: 2, label: 'Circuit description', short: 'Description' },
  { k: 'wiring', col: 3, label: 'Type of wiring', short: 'Wiring', opts: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'O'] },
  { k: 'ref', col: 4, label: 'Reference method', short: 'Ref' },
  { k: 'points', col: 5, label: 'Number of points served', short: 'Pts', num: true },
  { k: 'live', col: 6, label: 'Live csa (mm²)', short: 'Live', num: true },
  { k: 'cpc', col: 7, label: 'CPC csa (mm²)', short: 'CPC', num: true },
  { k: 'bs', col: 8, label: 'OCPD BS (EN)', short: 'BS (EN)' },
  { k: 'type', col: 9, label: 'OCPD type', short: 'Type' },
  { k: 'rating', col: 10, label: 'OCPD rating (A)', short: 'A', num: true },
  { k: 'bka', col: 11, label: 'Breaking capacity (kA)', short: 'kA', num: true },
  { k: 'maxZs', col: 12, label: 'Maximum permitted Zs (Ω)', short: 'Max Zs' },
  { k: 'rcdBs', col: 13, label: 'RCD BS (EN)', short: 'RCD BS' },
  { k: 'rcdType', col: 14, label: 'RCD type', short: 'RCD type', opts: ['AC', 'A', 'F', 'B', 'S', 'A-S'] },
  { k: 'rcdIdn', col: 15, label: 'RCD IΔn (mA)', short: 'IΔn', num: true },
  { k: 'rcdRating', col: 16, label: 'RCD rating (A)', short: 'RCD A', num: true },
  // test results
  { k: 'r1', col: 18, label: 'Ring r1 (line) Ω', short: 'r1', num: true, test: true },
  { k: 'rn', col: 19, label: 'Ring rn (neutral) Ω', short: 'rn', num: true, test: true },
  { k: 'r2', col: 20, label: 'Ring r2 (CPC) Ω', short: 'r2', num: true, test: true },
  { k: 'r1r2', col: 21, label: '(R1 + R2) Ω', short: 'R1+R2', num: true, test: true },
  { k: 'R2', col: 22, label: 'R2 Ω', short: 'R2', num: true, test: true },
  { k: 'irV', col: 23, label: 'IR test voltage (V)', short: 'V', num: true, test: true },
  { k: 'irLL', col: 24, label: 'IR Live – Live (MΩ)', short: 'L-L', num: true, test: true },
  { k: 'irLE', col: 25, label: 'IR Live – Earth (MΩ)', short: 'L-E', num: true, test: true },
  { k: 'pol', col: 26, label: 'Polarity', short: 'Pol', tick: true, test: true },
  { k: 'zs', col: 27, label: 'Zs maximum measured (Ω)', short: 'Zs', num: true, test: true },
  { k: 'rcdMs', col: 28, label: 'RCD disconnection time (ms)', short: 'ms', num: true, test: true },
  { k: 'rcdBtn', col: 29, label: 'RCD test button', short: 'RCD btn', tick: true, test: true },
  { k: 'afddBtn', col: 30, label: 'AFDD manual test button', short: 'AFDD', tick: true, test: true },
  { k: 'remarks', col: 31, label: 'Remarks', short: 'Remarks', test: true },
];
export const FIELD = Object.fromEntries(FIELDS.map((f) => [f.k, f]));

export function blankCircuit(n = 1) {
  const c = { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), device: 'rcbo', time: 0.4, rcdS: false, spare: false };
  for (const f of FIELDS) c[f.k] = '';
  c.num = String(n);
  c.irV = '500';
  return c;
}

// Templates fill the circuit-details side only; test readings stay blank.
const T = (name, o) => ({ name, ...o });
export const TEMPLATES = [
  T('Ring final (sockets)', { desc: 'Sockets', wiring: 'A', ref: 'C', live: '2.5', cpc: '1.5', device: 'rcbo', bs: '61009', type: 'B', rating: '32', bka: '6', rcdBs: '61009', rcdType: 'A', rcdIdn: '30', rcdRating: '32' }),
  T('Radial 20 A (sockets)', { desc: 'Sockets radial', wiring: 'A', ref: 'C', live: '2.5', cpc: '1.5', device: 'rcbo', bs: '61009', type: 'B', rating: '20', bka: '6', rcdBs: '61009', rcdType: 'A', rcdIdn: '30', rcdRating: '20' }),
  T('Radial 32 A, 4 mm²', { desc: 'Sockets radial', wiring: 'A', ref: 'C', live: '4', cpc: '1.5', device: 'rcbo', bs: '61009', type: 'B', rating: '32', bka: '6', rcdBs: '61009', rcdType: 'A', rcdIdn: '30', rcdRating: '32' }),
  T('Lighting', { desc: 'Lights', wiring: 'A', ref: '101', live: '1.5', cpc: '1.0', device: 'rcbo', bs: '61009', type: 'B', rating: '6', bka: '6', rcdBs: '61009', rcdType: 'A', rcdIdn: '30', rcdRating: '6' }),
  T('Cooker', { desc: 'Cooker', wiring: 'A', ref: 'C', live: '6', cpc: '2.5', device: 'rcbo', bs: '61009', type: 'B', rating: '32', bka: '6', points: '1', rcdBs: '61009', rcdType: 'A', rcdIdn: '30', rcdRating: '32' }),
  T('Electric shower', { desc: 'Shower', wiring: 'A', ref: 'C', live: '10', cpc: '4', device: 'rcbo', bs: '61009', type: 'B', rating: '40', bka: '6', points: '1', rcdBs: '61009', rcdType: 'A', rcdIdn: '30', rcdRating: '40' }),
  T('Immersion heater', { desc: 'Immersion', wiring: 'A', ref: 'C', live: '2.5', cpc: '1.5', device: 'rcbo', bs: '61009', type: 'B', rating: '16', bka: '6', points: '1', rcdBs: '61009', rcdType: 'A', rcdIdn: '30', rcdRating: '16' }),
  T('Smoke / heat alarms', { desc: 'Smoke alarms', wiring: 'A', ref: 'C', live: '1.5', cpc: '1.0', device: 'rcbo', bs: '61009', type: 'B', rating: '6', bka: '6', rcdBs: '61009', rcdType: 'A', rcdIdn: '30', rcdRating: '6' }),
  T('Boiler / heating controls', { desc: 'Boiler', wiring: 'A', ref: 'C', live: '1.5', cpc: '1.0', device: 'rcbo', bs: '61009', type: 'B', rating: '6', bka: '6', points: '1', rcdBs: '61009', rcdType: 'A', rcdIdn: '30', rcdRating: '6' }),
  T('EV charger (32 A)', { desc: 'EV charger', wiring: 'F', ref: 'C', live: '6', cpc: '6', device: 'rcbo', bs: '61009', type: 'B', rating: '32', bka: '6', points: '1', rcdBs: '61009', rcdType: 'A', rcdIdn: '30', rcdRating: '32' }),
  T('Sub-main / outbuilding (SWA)', { desc: 'Sub-main to garage', wiring: 'F', ref: 'D', live: '6', cpc: '6', device: 'mcb', bs: '60898', type: 'C', rating: '32', bka: '6', time: 5, points: '1' }),
  T('Battery / inverter AC', { desc: 'Inverter AC', wiring: 'F', ref: 'C', live: '6', cpc: '6', device: 'mcb', bs: '60898', type: 'B', rating: '32', bka: '6', points: '1' }),
];
export function applyTemplate(c, t) {
  const { name, ...vals } = t;
  return { ...c, ...vals, spare: false };
}
export const RESULT_KEYS = ['r1', 'rn', 'r2', 'r1r2', 'R2', 'irLL', 'irLE', 'pol', 'zs', 'rcdMs', 'rcdBtn', 'afddBtn', 'remarks'];
const newCircuitId = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export function copyCircuit(c, nextNum, { keepResults = false } = {}) {
  const out = { ...JSON.parse(JSON.stringify(c)), id: newCircuitId(), num: String(nextNum) };
  // a copied row keeps the circuit details; readings only if asked
  if (!keepResults) for (const k of RESULT_KEYS) out[k] = '';
  return out;
}
// Copy a whole board: new ids for the board and every circuit; readings cleared unless asked.
export function copyBoard(b, { ref = '', keepResults = false, keepBoardTests = false } = {}) {
  const nb = JSON.parse(JSON.stringify(b));
  nb.id = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  nb.ref = ref || ((b.ref || 'DB') + ' (copy)');
  if (!keepBoardTests) { nb.zdb = ''; nb.ipf = ''; nb.polOk = false; nb.phaseSeq = false; nb.spdOk = false; }
  nb.circuits = (b.circuits || []).map((c) => copyCircuit(c, c.num, { keepResults }));
  return nb;
}
// v0.10: a spare is just "SPARE" in the description. Nothing typed is
// overwritten: empty boxes SHOW a grey N/A (a placeholder, see autoNA) and
// print it in lighter grey. Take "spare" out and the boxes are empty again.
export function makeSpare(c) { return { ...c, desc: 'SPARE' }; }
export const SPARE_RE = /^\s*spare\s*$/i;
export const isSpareCircuit = (c) => !!(c && (c.spare || SPARE_RE.test(String(c.desc || '')) || /^\s*n\/?a\s*$/i.test(String(c.desc || ''))));
// Protective device boxes: left blank for a spare (a spare way usually still
// has its breaker) unless "No device fitted" (c.noDevice) is ticked.
export const DEVICE_KEYS = ['bs', 'type', 'rating', 'bka', 'maxZs', 'rcdBs', 'rcdType', 'rcdIdn', 'rcdRating'];
const blankV = (v) => v == null || String(v).trim() === '';
// Is box k of circuit c an automatic N/A? (irV's 500 V default counts as empty on a spare.)
export function autoNA(c, k) {
  if (!isSpareCircuit(c) || k === 'num' || k === 'desc') return false;
  if (DEVICE_KEYS.includes(k) && !c.noDevice) return false;
  if (k === 'maxZs') return blankV(c.maxZsOverride);
  return blankV(c[k]) || (k === 'irV' && String(c[k]) === '500');
}

// v0.10: typing in the description: spare on/off. The 500 V IR default is cleared on a spare (shows N/A) and put back after.
export function descChanged(c, wasSpare) {
  if (c.spare && !SPARE_RE.test(String(c.desc || ''))) c.spare = false;
  const now = isSpareCircuit(c);
  if (!wasSpare && isSpareCircuit(c) && String(c.irV) === '500') c.irV = '';
  if (wasSpare && !isSpareCircuit(c) && !String(c.irV || '').trim()) c.irV = '500';
  return now !== wasSpare;
}
