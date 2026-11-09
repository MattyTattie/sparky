// parts.js (v0.25): "Parts used" for a job, worked out from its certificates'
// boards and circuits. Pure (no DOM), so it can be tested.
// Spare ways with "No device fitted" (or no device at all) are left out; a
// spare way with a breaker in it still counts (the breaker is a real part).
import { deviceById } from './limits.js';
import { isSpareCircuit } from './templates.js';
import { mainAt, hasMainSwitch, mainSwitchParts } from './boardmain.js';
import { msIsRcdAt, get } from './certmodel.js';
import { showRcdType } from './rcdtype.js';

const real = (v) => v != null && String(v).trim() !== '' && !/^n\/?a$/i.test(String(v).trim());
const hasDevice = (c) => !c.noDevice && (real(c.device) || real(c.bs)) && real(c.rating);

// A plain name for one circuit's protective device (no RCD part for devices that aren't RCDs).
export function partName(c) {
  const d = deviceById(c.device); const kind = d ? d.label.split(' (')[0] : 'BS EN ' + c.bs;
  const tp = /^[BCD123]$/.test(String(c.type || '')) ? c.type : '';
  const rcd = d && d.rcd && real(c.rcdIdn) ? `${c.rcdIdn} mA${real(c.rcdType) ? ' Type ' + c.rcdType : ''}` : '';
  const adj = d && d.adj ? [real(c.im) ? `Im ${c.im} A` : '', real(c.ig) ? `Ig ${c.ig} A` : ''].filter(Boolean).join(', ') : '';
  return [tp ? `${tp}${c.rating} ${kind}` : `${c.rating} A ${kind}`, rcd, adj, real(c.bka) ? c.bka + ' kA' : ''].filter(Boolean).join(' · ');
}
const rcdName = (o) => `RCD ${real(o.rcdRating) ? o.rcdRating + ' A ' : ''}${o.rcdIdn} mA${real(o.rcdType) ? ' Type ' + o.rcdType : ''}${real(o.rcdBs) ? ' (BS EN ' + o.rcdBs + ')' : ''}`;
// v0.47.0: one physical RCD = BS, IΔn, rating and (on a split-load board) which RCD it is (c.rcdNo).
// The type / S isn't part of it: a board RCD 'A S' and a circuit that says 'A' are the same device.
const T = (v) => String(v ?? '').trim();
const sameRcd = (a, b) => T(a.rcdIdn) === T(b.rcdIdn) && (!T(a.rcdRating) || !T(b.rcdRating) || T(a.rcdRating) === T(b.rcdRating)) && (!real(a.rcdBs) || !real(b.rcdBs) || T(a.rcdBs) === T(b.rcdBs));
export const rcdNoOf = (c) => T(c && c.rcdNo);

function add(list, name, circ) { let it = list.find((x) => x.name === name); if (!it) list.push((it = { name, qty: 0, circuits: [] })); it.qty++; if (circ) it.circuits.push(String(circ)); return it; }

export function partsForBoard(b, cert, first = false, bi = first ? 0 : -1) {
  const items = []; const fitted = [];
  const circuits = b.circuits || [];
  for (const c of circuits) {
    if (isSpareCircuit(c) && !hasDevice(c)) continue;
    if (!hasDevice(c)) continue;
    fitted.push(c); add(items, partName(c), c.num);
  }
  items.sort((a, z) => z.qty - a.qty || a.name.localeCompare(z.name, 'en', { numeric: true }));
  const extras = [];
  // v0.45.1: every board's main switch: board 1 from the certificate's main switch section, later boards from their own (same boxes)
  let noMain = false;
  if (cert && bi >= 0) {
    const { o, pre } = mainAt(cert, bi);
    for (const name of mainSwitchParts(o, pre)) extras.push({ name, qty: 1, circuits: [] });
    noMain = !hasMainSwitch(o, pre);
  }
  const spd = ['spdT1', 'spdT2', 'spdT3'].filter((k) => b[k]).map((k) => k.slice(-1));
  if (spd.length && !b.spdNA) extras.push({ name: `SPD Type ${spd.join('+')}`, qty: 1, circuits: [] });
  // v0.47.0: the SPD's own protective device, when one is entered
  if (!b.spdNA && real(b.spdDevice)) extras.push({ name: `SPD protective device: ${T(b.spdDevice)}`, qty: 1, circuits: [] });
  // v0.47.0: the meter tail connector block, listed once, on the first board fed from it
  if (cert && b.supplyKind === 'tails') {
    const fed = (cert.boards || []).filter((x) => x && x.supplyKind === 'tails');
    if (fed[0] === b) extras.push({ name: 'Meter tail connector block', label: `Meter tail connector block${fed.length > 1 ? ' (feeds ' + fed.map((x) => x.ref || 'board').join(', ') + ')' : ''}`, qty: 1, circuits: [] });
  }
  // RCDs feeding groups of MCBs: one per different RCD (BS, IΔn, rating, which RCD), or the board's own RCD.
  // A main switch that is an RCD is already listed as the main switch: its circuits are listed under it.
  const rcds = [];
  const mainRcd = cert && bi >= 0 && (() => { const { o, pre } = mainAt(cert, bi); return msIsRcdAt(pre)(o) && real(get(o, pre + 'rcdIdn')) ? { rcdIdn: get(o, pre + 'rcdIdn'), rcdRating: get(o, pre + 'msCurrent'), rcdBs: String(get(o, pre + 'msBs') || '').replace(/^\s*(BS\s*)?(EN\s*)?/i, '') } : null; })();
  const msItem = mainRcd ? extras.find((x) => /^Main switch/.test(x.name)) : null;
  if (msItem) msItem.rcd = true;
  const boardRcd = !mainRcd && real(b.rcdIdn) ? { name: rcdName({ ...b, rcdType: showRcdType(b.rcdType) }), qty: 1, circuits: [], rcd: true, key: b, no: '' } : null;
  if (boardRcd) rcds.push(boardRcd);
  for (const c of fitted) {
    const d = deviceById(c.device); if (d && (d.rcd || d.adj)) continue;
    if (!real(c.rcdIdn)) continue;
    const no = rcdNoOf(c); const num = String(c.num);
    if (msItem && sameRcd(c, mainRcd) && (!no || no === '1')) { if (!msItem.circuits.includes(num)) msItem.circuits.push(num); continue; }
    if (boardRcd && sameRcd(c, b) && (!no || no === '1')) { if (!boardRcd.circuits.includes(num)) boardRcd.circuits.push(num); continue; }
    let it = rcds.find((x) => x !== boardRcd && x.no === no && sameRcd(x.key, c));
    if (!it) rcds.push((it = { name: rcdName({ ...c, rcdType: showRcdType(c.rcdType) }), qty: 1, circuits: [], rcd: true, key: c, no }));
    if (!it.circuits.includes(num)) it.circuits.push(num);
  }
  // split-load: two of the same RCD on one board are told apart as RCD 1 / RCD 2
  const dup = (it) => rcds.filter((x) => x.name === it.name).length > 1;
  rcds.forEach((r, i) => { if (r.no || dup(r)) r.label = `RCD ${r.no || (r === boardRcd ? '1' : String(i + 1))}: ` + r.name.replace(/^RCD /, ''); });
  rcds.forEach((r) => { delete r.key; delete r.no; });
  const spares = circuits.filter((c) => isSpareCircuit(c) && !hasDevice(c)).length;
  return { ref: b.ref || 'Board', location: b.location || '', ways: circuits.length, spares, noMain, items: [...extras, ...rcds, ...items] };
}

// Which certificates count: the EICs (new work). If there are none, the EICRs.
export function certsForParts(certs) {
  const live = (certs || []).filter((c) => c && c.type !== 'MW' && (c.boards || []).length);
  const eic = live.filter((c) => c.type === 'EIC');
  return eic.length ? eic : live;
}

export function partsForJob(certs) {
  const use = certsForParts(certs);
  const boards = use.flatMap((c) => (c.boards || []).map((b, i) => ({ ...partsForBoard(b, c, i === 0, i), cert: c.number || c.type, certId: c.id, bi: i })));
  const totals = [];
  for (const b of boards) for (const it of b.items) { const t = totals.find((x) => x.name === it.name); if (t) t.qty += it.qty; else totals.push({ name: it.name, qty: it.qty }); }
  totals.sort((a, z) => z.qty - a.qty || a.name.localeCompare(z.name, 'en', { numeric: true }));
  return { boards, totals, from: use.map((c) => c.number || c.type), type: use[0] ? use[0].type : '' };
}

// Plain text, for Share / copy.
export function partsText(res, title = '') {
  const L = [];
  if (title) L.push('Parts used: ' + title, '');
  for (const b of res.boards) {
    L.push(`${b.ref}${b.location ? ' (' + b.location + ')' : ''}: ${b.ways} way(s)${b.spares ? `, ${b.spares} spare` : ''}`);
    for (const it of b.items) L.push(`  ${it.qty} × ${it.label || it.name}${it.circuits && it.circuits.length ? ` (${it.rcd ? 'covers' : it.circuits.length === 1 ? 'circuit' : 'circuits'} ${it.circuits.join(', ')})` : ''}`);
    L.push('');
  }
  if (res.boards.length > 1) { L.push('Total'); for (const t of res.totals) L.push(`  ${t.qty} × ${t.name}`); }
  return L.join('\n').trim();
}
