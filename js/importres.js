// =====================================================================
// importres.js — bring earlier test results (a "results file") into a
// certificate WITHOUT losing anything already there.
//  - Circuits are matched on circuit number + description. A match fills
//    in only the blank boxes; anything you already have is kept, and any
//    difference is listed so you can choose.
//  - Circuits in the file that aren't on the certificate are added.
//  - Nothing is ever deleted: no circuits, no photos, no readings.
// File format (JSON, see HOW-IT-WORKS.md):
//  { app: 'sparky', kind: 'results', format: 1, source: '…',
//    cert: { supply: {…}, parts: {…}, install: {…}, eic: {…}, comments: '…' },
//    board: { spdT2: true, …, circuits: [ { num, desc, wiring, ref, live, cpc, bs, type, rating, … } ] } }
// =====================================================================
import { FIELDS } from './templates.js';

export const RESULTS_KIND = 'results';
const CIRCUIT_KEYS = FIELDS.map((f) => f.k).filter((k) => k !== 'num');
// Certificate-level fields a results file may carry (never names, addresses or signatures).
export const CERT_FIELDS = {
  'install.description': 'Description of installation', 'install.extent': 'Extent covered', 'install.extentType': 'Type of work',
  'supply.earthing': 'Earthing arrangement', 'supply.conductors': 'Live conductors', 'supply.acdc': 'AC/DC', 'supply.u': 'Nominal voltage', 'supply.f': 'Frequency',
  'supply.ipf': 'Ipf (kA)', 'supply.ze': 'Ze (Ω)', 'supply.polarity': 'Supply polarity confirmed', 'supply.spBs': 'Supply fuse BS (EN)', 'supply.spType': 'Supply fuse type', 'supply.spRating': 'Supply fuse rating (A)', 'supply.spKa': 'Supply fuse kA',
  'parts.means': 'Means of earthing', 'parts.maxDemand': 'Maximum demand', 'parts.mdUnit': 'Max demand unit',
  'parts.ecMat': 'Earthing conductor material', 'parts.ecCsa': 'Earthing conductor csa', 'parts.ecOk': 'Earthing conductor verified',
  'parts.bondMat': 'Bonding material', 'parts.bondCsa': 'Bonding csa', 'parts.bondOk': 'Bonding verified',
  'parts.bondWater': 'Bonded to water', 'parts.bondGas': 'Bonded to gas', 'parts.bondOil': 'Bonded to oil', 'parts.bondSteel': 'Bonded to steel', 'parts.bondLightning': 'Bonded to lightning protection', 'parts.bondOther': 'Bonded to other',
  'parts.msBs': 'Main switch BS (EN)', 'parts.msPoles': 'Main switch poles', 'parts.msCurrent': 'Main switch current (A)', 'parts.msVoltage': 'Main switch voltage (V)', 'parts.msType': 'Main switch device type', 'parts.msRating': 'Main switch rating (A)', 'parts.msKa': 'Main switch kA',
  'parts.rcdType': 'Main switch RCD type', 'parts.rcdIdn': 'Main switch IΔn',
  'eic.designDepartures': 'Design departures', 'eic.exceptions': 'Permitted exceptions', 'eic.constructionDepartures': 'Construction departures', 'eic.inspectionDepartures': 'Inspection departures', 'eic.nextInterval': 'Next inspection',
  comments: 'Comments',
};
export const BOARD_FIELDS = { location: 'Board location', suppliedFrom: 'Supplied from', spdT1: 'SPD T1', spdT2: 'SPD T2', spdT3: 'SPD T3', spdNA: 'SPD N/A', rcdBs: 'Board RCD BS', rcdType: 'Board RCD type', rcdRating: 'Board RCD rating', rcdIdn: 'Board RCD IΔn', zdb: 'Zdb (Ω)', ipf: 'Ipf at board (kA)', polOk: 'Polarity confirmed', spdOk: 'SPD status confirmed' };

const getp = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setp = (o, p, v) => { const ks = p.split('.'); let a = o; for (const k of ks.slice(0, -1)) { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; a = a[k]; } a[ks[ks.length - 1]] = v; };
const blank = (v) => v == null || v === '' || v === false;
const norm = (v) => { const s = String(v ?? '').trim(); const n = Number(s.replace(/^[>≥<]/, '')); return s !== '' && !isNaN(n) && /^[>≥<]?[0-9.]+$/.test(s) ? s[0].replace(/[0-9.]/, '') + n : s.toLowerCase().replace(/\s+/g, ' ').replace(/^bs ?(en )?/, '').replace(/-1$/, ''); };
const same = (a, b) => norm(a) === norm(b);

// Descriptions: "Downstairs skts" ~ "Downstairs sockets", "Bedroom" ~ "Bedroom 2 radiator".
const SYN = { skts: 'sockets', skt: 'sockets', socket: 'sockets', lts: 'lights', lighting: 'lights', light: 'lights', ltg: 'lights', rad: 'radiator', rads: 'radiator', radiators: 'radiator', hw: 'hot water', ckr: 'cooker', dstairs: 'downstairs', ustairs: 'upstairs' };
export const descWords = (d) => String(d || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean).flatMap((w) => (SYN[w] || w).split(' '));
export const isSpareDesc = (d) => /^\s*(spare|n\/?a|-|)\s*$/i.test(String(d || ''));
// 'same' | 'part' (one is a shorter form of the other) | 'blank' | 'different'
export function compareDesc(a, b) {
  if (isSpareDesc(a) || isSpareDesc(b)) return isSpareDesc(a) && isSpareDesc(b) && !blank(a) && !blank(b) ? 'same' : 'blank';
  const x = descWords(a), y = descWords(b);
  if (x.join(' ') === y.join(' ')) return 'same';
  const [s, l] = x.length <= y.length ? [x, y] : [y, x];
  return s.every((w) => l.includes(w)) ? 'part' : 'different';
}

export function checkResultsFile(d) {
  if (!d || typeof d !== 'object') throw new Error('That file isn\u2019t a results file.');
  if (d.app !== 'sparky' || d.kind !== RESULTS_KIND) throw new Error('That isn\u2019t a Zs Pro results file. (A whole backup file goes in Settings → Restore from file.)');
  if (Number(d.format) > 1) throw new Error('This results file is from a newer version of the app. Update the app first.');
  if (!d.board || !Array.isArray(d.board.circuits)) throw new Error('The results file has no circuits.');
  return d;
}

const fieldChange = (k, label, cur, val) => {
  if (val == null || val === '' || val === false) return null; // the file says nothing
  if (blank(cur)) return { k, label, cur, val, action: 'fill' };
  if (same(cur, val)) return null;
  return { k, label, cur, val, action: 'differs' };
};

// Work out what an import would do. Doesn't change anything.
export function planImport(cert, data, boardIndex = 0) {
  checkResultsFile(data);
  const board = cert.boards[boardIndex];
  if (!board) throw new Error('No board on this certificate.');
  const certChanges = [];
  for (const [p, label] of Object.entries(CERT_FIELDS)) { const c = fieldChange(p, label, getp(cert, p), getp(data.cert || {}, p)); if (c) certChanges.push(c); }
  const boardChanges = [];
  for (const [k, label] of Object.entries(BOARD_FIELDS)) { const c = fieldChange(k, label, board[k], (data.board || {})[k]); if (c) boardChanges.push(c); }
  const used = new Set(); const circuits = [];
  for (const fc of data.board.circuits) {
    const num = String(fc.num ?? '').trim();
    // Same number AND nothing contradicting it: description not different, and device rating/curve the same where both are known.
    const devOk = (c) => (blank(c.rating) || blank(fc.rating) || same(c.rating, fc.rating)) && (blank(c.type) || blank(fc.type) || same(c.type, fc.type));
    let match = board.circuits.find((c) => !used.has(c.id) && String(c.num).trim() === num && compareDesc(c.desc, fc.desc) !== 'different' && devOk(c));
    let how = match ? 'number' : '';
    if (!match && !isSpareDesc(fc.desc)) {
      const cands = board.circuits.filter((c) => !used.has(c.id) && !isSpareDesc(c.desc) && compareDesc(c.desc, fc.desc) === 'same' && devOk(c));
      if (cands.length === 1) { match = cands[0]; how = 'description'; }
    }
    const clash = !match && board.circuits.find((c) => !used.has(c.id) && String(c.num).trim() === num);
    if (match) used.add(match.id);
    const target = match || null;
    const changes = [];
    for (const k of CIRCUIT_KEYS) {
      if (k === 'desc') {
        if (!target) continue;
        const r = compareDesc(target.desc, fc.desc);
        if (blank(target.desc) && !blank(fc.desc)) changes.push({ k, label: 'Description', cur: '', val: fc.desc, action: 'fill' });
        else if (r === 'part' && descWords(fc.desc).length > descWords(target.desc).length) changes.push({ k, label: 'Description', cur: target.desc, val: fc.desc, action: 'fill', note: 'fuller description' });
        else if (r === 'blank' && isSpareDesc(target.desc) && !isSpareDesc(fc.desc)) changes.push({ k, label: 'Description', cur: target.desc, val: fc.desc, action: 'differs' });
        continue;
      }
      if (!target) continue;
      const lab = (FIELDS.find((f) => f.k === k) || {}).label || k;
      const c = fieldChange(k, lab, target[k], fc[k]); if (c) changes.push(c);
    }
    circuits.push({ num, desc: fc.desc || '', file: fc, targetId: target ? target.id : null, how: target ? how : clash ? 'clash' : 'new', clashWith: clash ? { id: clash.id, desc: clash.desc } : null, changes });
  }
  const untouched = board.circuits.filter((c) => !used.has(c.id)).map((c) => ({ num: c.num, desc: c.desc }));
  const count = (a) => a.reduce((n, x) => n + x.changes.filter((c) => c.action === 'fill').length, 0);
  return { certChanges, boardChanges, circuits, untouched, summary: {
    matched: circuits.filter((c) => c.targetId).length, added: circuits.filter((c) => c.how === 'new').length, clashes: circuits.filter((c) => c.how === 'clash').length,
    fills: certChanges.filter((c) => c.action === 'fill').length + boardChanges.filter((c) => c.action === 'fill').length + count(circuits),
    differs: [...certChanges, ...boardChanges, ...circuits.flatMap((c) => c.changes)].filter((c) => c.action === 'differs').length } };
}

// Do it. opts.takeFile: Set of change ids ("cert:path", "board:key", "c:<num>:key")
// where you chose the file's value over yours; opts.clash: 'add' | 'skip' for
// circuits whose number is taken by a different circuit. Returns counts.
export function applyImport(cert, plan, { takeFile = new Set(), clash = 'skip', makeCircuit, boardIndex = 0 } = {}) {
  const board = cert.boards[boardIndex]; let filled = 0, replaced = 0, added = 0;
  for (const c of plan.certChanges) if (c.action === 'fill' || takeFile.has('cert:' + c.k)) { setp(cert, c.k, c.val); c.action === 'fill' ? filled++ : replaced++; }
  for (const c of plan.boardChanges) if (c.action === 'fill' || takeFile.has('board:' + c.k)) { board[c.k] = c.val; c.action === 'fill' ? filled++ : replaced++; }
  for (const pc of plan.circuits) {
    if (pc.targetId) {
      const t = board.circuits.find((c) => c.id === pc.targetId); if (!t) continue;
      for (const ch of pc.changes) if (ch.action === 'fill' || takeFile.has(`c:${pc.num}:${ch.k}`)) { t[ch.k] = ch.val; ch.action === 'fill' ? filled++ : replaced++; if (ch.k === 'bs' && pc.file.device) t.device = pc.file.device; }
      if (t.spare && pc.changes.some((ch) => ch.k === 'desc' && takeFile.has(`c:${pc.num}:desc`))) t.spare = false;
    } else if (pc.how === 'new' || (pc.how === 'clash' && clash === 'add')) {
      const c = makeCircuit(pc.num);
      for (const k of CIRCUIT_KEYS) if (pc.file[k] != null && pc.file[k] !== '') c[k] = pc.file[k];
      if (pc.file.device) c.device = pc.file.device;
      if (pc.how === 'clash') c.remarks = [c.remarks, `Imported: number ${pc.num} was already used`].filter(Boolean).join('; ');
      board.circuits.push(c); added++;
    }
  }
  // Keep circuits in number order (numbers like "1", "2", "10", "L1" sort sensibly); nothing removed.
  board.circuits.sort((a, b) => String(a.num).localeCompare(String(b.num), 'en', { numeric: true }));
  cert.imports = [...(cert.imports || []), { at: new Date().toISOString(), filled, replaced, added }];
  return { filled, replaced, added };
}
