// parts.js (v0.25): "Parts used" for a job, worked out from its certificates'
// boards and circuits. Pure (no DOM), so it can be tested.
// Spare ways with "No device fitted" (or no device at all) are left out; a
// spare way with a breaker in it still counts (the breaker is a real part).
import { deviceById } from './limits.js';
import { isSpareCircuit } from './templates.js';
import { msIsRcd, msIsOcpd } from './certmodel.js';

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

function add(list, name, circ) { let it = list.find((x) => x.name === name); if (!it) list.push((it = { name, qty: 0, circuits: [] })); it.qty++; if (circ) it.circuits.push(String(circ)); return it; }

export function partsForBoard(b, cert, first = false) {
  const items = []; const fitted = [];
  const circuits = b.circuits || [];
  for (const c of circuits) {
    if (isSpareCircuit(c) && !hasDevice(c)) continue;
    if (!hasDevice(c)) continue;
    fitted.push(c); add(items, partName(c), c.num);
  }
  items.sort((a, z) => z.qty - a.qty || a.name.localeCompare(z.name, 'en', { numeric: true }));
  const extras = [];
  if (first && cert && cert.parts) {
    const p = cert.parts;
    if (real(p.msCurrent) || real(p.msBs)) extras.push({ name: `Main switch ${real(p.msCurrent) ? p.msCurrent + ' A ' : ''}${real(p.msPoles) ? p.msPoles + '-pole' : ''}${real(p.msBs) ? ' (BS EN ' + p.msBs + ')' : ''}`.replace(/\s+/g, ' ').trim(), qty: 1, circuits: [] });
    if (msIsOcpd(cert) && real(p.msRating)) extras.push({ name: `Main ${real(p.msType) ? p.msType : 'breaker'} ${p.msRating} A`, qty: 1, circuits: [] });
    if (msIsRcd(cert) && real(p.rcdIdn)) extras.push({ name: `Main RCD ${p.rcdIdn} mA${real(p.rcdType) ? ' Type ' + p.rcdType : ''}`, qty: 1, circuits: [] });
  }
  const spd = ['spdT1', 'spdT2', 'spdT3'].filter((k) => b[k]).map((k) => k.slice(-1));
  if (spd.length && !b.spdNA) extras.push({ name: `SPD Type ${spd.join('+')}`, qty: 1, circuits: [] });
  // RCDs feeding groups of MCBs: one per different RCD found on the circuits (or the board's own RCD).
  const rcds = [];
  if (real(b.rcdIdn)) add(rcds, rcdName(b));
  for (const c of fitted) {
    const d = deviceById(c.device); if (d && (d.rcd || d.adj)) continue;
    if (!real(c.rcdIdn)) continue;
    const n = rcdName(c); const it = rcds.find((x) => x.name === n) || add(rcds, n); if (!it.circuits.includes(String(c.num))) it.circuits.push(String(c.num));
  }
  rcds.forEach((r) => (r.qty = 1, r.rcd = true));
  const spares = circuits.filter((c) => isSpareCircuit(c) && !hasDevice(c)).length;
  return { ref: b.ref || 'Board', location: b.location || '', ways: circuits.length, spares, items: [...extras, ...rcds, ...items] };
}

// Which certificates count: the EICs (new work). If there are none, the EICRs.
export function certsForParts(certs) {
  const live = (certs || []).filter((c) => c && c.type !== 'MW' && (c.boards || []).length);
  const eic = live.filter((c) => c.type === 'EIC');
  return eic.length ? eic : live;
}

export function partsForJob(certs) {
  const use = certsForParts(certs);
  const boards = use.flatMap((c) => (c.boards || []).map((b, i) => ({ ...partsForBoard(b, c, i === 0), cert: c.number || c.type })));
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
    for (const it of b.items) L.push(`  ${it.qty} × ${it.name}`);
    L.push('');
  }
  if (res.boards.length > 1) { L.push('Total'); for (const t of res.totals) L.push(`  ${t.qty} × ${t.name}`); }
  return L.join('\n').trim();
}
