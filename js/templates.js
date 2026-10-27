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
  { k: 'rcdType', col: 14, label: 'RCD type', short: 'RCD type', opts: ['AC', 'A', 'F', 'B', 'AC S', 'A S', 'F S', 'B S'] },
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
  T('Sub-main / outbuilding (SWA)', { desc: 'Sub-main to garage', wiring: 'F', ref: 'D1', live: '6', cpc: '6', device: 'mcb', bs: '60898', type: 'C', rating: '32', bka: '6', time: 5, points: '1' }),
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
// v0.34: copy a board, with its circuits and readings, into another certificate (another job).
// Gets the next free DB ref in the target; new ids so nothing is shared with the original.
export function boardRefFor(cert) { let n = (cert.boards || []).length + 1; while ((cert.boards || []).some((x) => x.ref === 'DB' + n)) n++; return 'DB' + n; }
export function copyBoardToCert(target, b, { keepResults = true, keepBoardTests = true, ref = '' } = {}) {
  target.boards = target.boards || [];
  const same = (target.boards || []).some((x) => x.ref === b.ref);
  const nb = copyBoard(b, { ref: ref || (b.ref && !same ? b.ref : boardRefFor(target)), keepResults, keepBoardTests });
  target.boards.push(nb); return nb;
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
// v0.18.4: a circuit that isn't a ring final: empty r1 / rn / r2 boxes are an automatic N/A too.
// (Same rule as checks.js isRingLike: ticked ring, any real ring reading, or "ring" in the description.)
export const RING_KEYS = ['r1', 'rn', 'r2'];
const realV = (v) => v != null && String(v).trim() !== '' && !/^n\/?a$/i.test(String(v).trim());
export const isRingCircuit = (c) => !!c && (c.ring === true || (c.ring !== false && (RING_KEYS.some((k) => realV(c[k])) || /\bring\b/i.test(c.desc || ''))));
export function autoNA(c, k) {
  if (RING_KEYS.includes(k) && !isSpareCircuit(c) && !isRingCircuit(c)) return blankV(c[k]);
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

// v0.12: delete circuit ci from board b. If the circuits after it are numbered in
// sequence straight on from it (e.g. delete 3 of 1,2,3,4,5) they move down one (4->3, 5->4).
// Returns { removed, renumbered } where renumbered is how many later circuits changed number.
export function laterSequential(b, ci) {
  const c = b.circuits[ci]; if (!c || !/^\d+$/.test(String(c.num || '').trim())) return 0;
  const n = +c.num; const rest = b.circuits.slice(ci + 1);
  return rest.length && rest.every((x, i) => String(x.num || '').trim() === String(n + 1 + i)) ? rest.length : 0;
}
export function deleteCircuitAt(b, ci) {
  const k = laterSequential(b, ci); const [removed] = b.circuits.splice(ci, 1);
  if (k) b.circuits.slice(ci).forEach((x) => (x.num = String(+x.num - 1)));
  return { removed, renumbered: k };
}

// v0.31: board main RCD boxes. N/A in one fills the other BLANK ones with N/A;
// a real value typed later clears the N/As (typed values are never touched).
export const RCD_GROUP = ['rcdBs', 'rcdType', 'rcdIdn', 'rcdRating'];
const isNA = (v) => /^\s*n\/?a\s*$/i.test(String(v ?? ''));
export function rcdGroupChanged(o, k, keys = RCD_GROUP) {
  const v = String(o[k] ?? '').trim(); const out = [];
  if (isNA(v)) { for (const x of keys) if (x !== k && !String(o[x] ?? '').trim()) { o[x] = 'N/A'; out.push(x); } }
  else if (v) { for (const x of keys) if (x !== k && isNA(o[x])) { o[x] = ''; out.push(x); } }
  return out;
}
// v0.31.2/0.31.3: board SPD boxes.
// - SPD type N/A and T1/T2/T3 are mutually exclusive (T1+T2 etc. can still combine).
//   Type N/A = no SPD fitted: clears T1-T3, status confirmed and Not operational, fills a
//   BLANK device box with N/A, and keeps the old spdStatusNA field in step (the PDF's
//   status N/A tick). Unticking it undoes only the N/As it filled itself (optional spdAuto).
// - "SPD operational status confirmed" and "Not operational" (optional spdNotOp) are
//   mutually exclusive. Typed values are never overwritten.
// Old certs that have both T2 and N/A show as saved; the rules apply on the next change.
export const SPD_GROUP = ['spdDevice', 'spdT1', 'spdT2', 'spdT3', 'spdNA', 'spdOk', 'spdNotOp'];
const TS = ['spdT1', 'spdT2', 'spdT3'];
export function spdGroupChanged(o, k) {
  const v = o[k]; const out = []; const auto = new Set(o.spdAuto || []);
  const set = (x, val) => { if (o[x] !== val) { o[x] = val; out.push(x); } };
  const naOff = () => { set('spdNA', false); set('spdStatusNA', false); if (auto.has('spdDevice') && isNA(o.spdDevice)) set('spdDevice', ''); auto.clear(); };
  const naOn = () => {
    set('spdNA', true); set('spdStatusNA', true);
    for (const x of [...TS, 'spdOk', 'spdNotOp']) if (o[x]) set(x, false);
    if (!String(o.spdDevice ?? '').trim()) { set('spdDevice', 'N/A'); auto.add('spdDevice'); }
  };
  if (k === 'spdNA') { if (v === true) naOn(); else naOff(); }
  else if (k === 'spdDevice') { if (isNA(v)) { auto.delete('spdDevice'); naOn(); } else if (String(v ?? '').trim()) naOff(); }
  else if (v === true) {
    if (o.spdNA || o.spdStatusNA) naOff();
    if (k === 'spdOk') set('spdNotOp', false);
    if (k === 'spdNotOp') set('spdOk', false);
  }
  if (auto.size) o.spdAuto = [...auto]; else delete o.spdAuto;
  return out;
}
// Type N/A hides the SPD boxes below it ("No SPD fitted").
export const SPD_HIDE = ['spdDevice', 'spdOk', 'spdNotOp'];
export const spdHidden = (o) => !!o.spdNA;
// v0.31.3: "Not operational" adds one observation (code C2 to start, Matthew can change it);
// unticking removes it again only if it hasn't been edited.
export const SPD_OBS_TEXT = 'SPD status indicator shows the SPD is not operational / has operated; replacement required';
// v0.31.4: only on certs with an observations section (EICR). EIC/MW: the tick is hidden and nothing is added or removed.
export function spdObservation(cert, b, newId = () => 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), hasObs = true) {
  if (!hasObs) return null;
  const list = cert.observations || (cert.observations = []);
  const mine = list.find((o) => o.id && o.id === b.spdObsId);
  if (b.spdNotOp) {
    if (mine) return null;
    const ob = { id: newId(), item: '4.19', text: SPD_OBS_TEXT, code: 'C2', reg: '651.4', location: b.ref ? 'Board ' + b.ref : '' };
    list.push(ob); b.spdObsId = ob.id; return 'added';
  }
  if (mine && mine.text === SPD_OBS_TEXT && mine.code === 'C2') { list.splice(list.indexOf(mine), 1); delete b.spdObsId; return 'removed'; }
  if (b.spdObsId) delete b.spdObsId;
  return null;
}
// v0.31: spare way line on the circuit card: the full device if one is picked, else just "Spare way".
export function spareLine(c, deviceLabel = '') {
  if (c.noDevice) return 'Spare way \u00b7 no device fitted';
  const r = String(c.rating ?? '').trim();
  if (!r || isNA(r)) return 'Spare way';
  return 'Spare way \u00b7 ' + `${c.type || ''}${r} A${deviceLabel ? ' ' + deviceLabel : ''}`;
}
// v0.31: "Copy to next way": the circuit details (device, cable, method...), not
// the number, description or any test result. Fills the next way, or makes one.
export const COPY_SKIP = ['id', 'num', 'desc', 'spare', 'noDevice'];
export function copyToNextWay(circuits, ci) {
  const c = circuits[ci]; if (!c) return null;
  let n = circuits[ci + 1];
  if (!n) { n = blankCircuit((parseInt(c.num, 10) || ci + 1) + 1); circuits.splice(ci + 1, 0, n); }
  for (const [k, v] of Object.entries(c)) if (!COPY_SKIP.includes(k) && !RESULT_KEYS.includes(k)) n[k] = JSON.parse(JSON.stringify(v ?? null));
  return ci + 1;
}

// v0.32: bidirectional devices (BS 7671 A4: 530.3.201). A board or circuit fed by a
// battery, PV or generator gets a reminder; the note is only added when tapped.
export const BIDI_NOTE = 'Protective devices on circuits fed by a battery, PV or generator confirmed suitable for bidirectional operation (Regulation 530.3.201).';
const SRC_RE = /\b(battery|batteries|inverter|pv|solar|generator|gen board|v2g)\b/i;
export const circuitFedBySource = (c) => !!c && (c.fedBySource === true || SRC_RE.test(String(c.desc || '')));
export const boardFedBySource = (b) => !!b && (b.fedBySource === true || (b.circuits || []).some(circuitFedBySource));
export function bidiTarget(cert) { return cert.type === 'MW' ? 'mw.comments' : cert.type === 'EICR' ? 'eicr.general' : 'comments'; }
export function hasBidiNote(text) { return /530\.3\.201|bidirectional/i.test(String(text || '')); }
// v0.34: on an EIC / EICR the note goes in the Remarks of the affected circuits, not the comments.
// Affected = circuits fed by a source; if none are but the board is ticked "fed by", every
// circuit on the board except spares. The Minor Works form keeps its comments box.
export const BIDI_REMARK = 'Devices confirmed suitable for bidirectional operation (Reg 530.3.201).';
export function bidiCircuits(b) {
  const list = (b && b.circuits) || [];
  const fed = list.filter(circuitFedBySource);
  return fed.length ? fed : b && b.fedBySource ? list.filter((c) => !isSpareCircuit(c)) : [];
}
export function addBidiRemark(c) { const t = String(c.remarks || '').trim(); if (!hasBidiNote(t)) c.remarks = (t ? t + '; ' : '') + BIDI_REMARK; return c; }
export const bidiRemarksDone = (list) => list.length > 0 && list.every((c) => hasBidiNote(c.remarks));
export function addBidiNote(text) { const t = String(text || '').trim(); return hasBidiNote(t) ? t : (t ? t + '\n' : '') + BIDI_NOTE; }
