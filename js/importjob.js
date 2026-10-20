// =====================================================================
// importjob.js (v0.15) — "Import extra details": merge a Sparky job.json /
// backup file / single certificate into certificates already on this device.
// Plain logic only (no DOM), tested in node.
// Rules: only fills EMPTY boxes; adds sources, boards, circuits, bonding and
// observations that aren't there yet (matched by id, then by board ref /
// circuit number / etc.); never deletes or overwrites anything. Anything the
// file has that differs from a box you've already filled is listed as skipped.
// =====================================================================

// Never merged: identity, bookkeeping and things with their own import paths.
const SKIP_TOP = new Set(['jobId', 'number', 'type', 'status', 'amendedTo']);
const SKIP = new Set(['id', 'createdAt', 'updatedAt', 'version', 'imports', 'photoIds', 'sigs',
  'driveFolderId', 'driveJsonId', 'driveId', 'driveVersion', 'backedUpAt', 'backedUpVersion', 'syncSavedAt', 'conflictOf', 'conflictAt']);
// How to match list items that don't share an id.
const MATCH = { boards: 'ref', circuits: 'num', otherSources: 'make', bonding: 'location', observations: 'item' };
const NAMES = { boards: 'Board', circuits: 'Circuit', otherSources: 'Other source', bonding: 'Bonding', observations: 'Observation' };
const SECTIONS = { client: 'Client', install: 'Installation', supply: 'Supply and earthing', parts: 'Particulars', inspections: 'Inspections', comments: 'Comments', eic: 'Design and construction', people: 'People', eicr: 'EICR details', mw: 'Minor works', instruments: 'Instruments', bondingNA: 'No supplementary bonding' };

const FIELDS = { ze: 'Ze', earthing: 'Earthing', desc: 'Description', bs: 'BS EN', rating: 'Rating', bka: 'kA', live: 'Live mm²', cpc: 'CPC mm²', r1r2: 'R1+R2', R2: 'R2', irLL: 'IR L–L', irLE: 'IR L–E', irV: 'IR test V', zs: 'Zs', rcdMs: 'RCD ms', rcdBtn: 'RCD button', rcdIdn: 'RCD IΔn', pol: 'Polarity', ref: 'Ref', location: 'Location', suppliedFrom: 'Supplied from', zdb: 'Zdb', ipf: 'Ipf', make: 'Make and model', kw: 'kW', isolation: 'Isolation', remarks: 'Remarks', notes: 'Notes' };
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
export const isEmpty = (v) => v == null || v === false || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0) || (isObj(v) && Object.keys(v).length === 0);
const clone = (v) => JSON.parse(JSON.stringify(v));
const norm = (v) => String(v ?? '').trim().toLowerCase();
const same = (a, b) => norm(a) === norm(b);

// Accepts: a job.json ({app, job, certs}), a whole backup ({app, jobs, certs}), {cert} or a bare certificate.
export function readImportFile(d) {
  if (typeof d === 'string') d = JSON.parse(d);
  if (!d || typeof d !== 'object') throw new Error('That file isn\u2019t a Sparky file.');
  let certs = null;
  if (Array.isArray(d.certs)) certs = d.certs;
  else if (isObj(d.cert)) certs = [d.cert];
  else if (Array.isArray(d.boards) || d.number) certs = [d];
  if (d.app && d.app !== 'sparky') throw new Error('That file is from a different app.');
  if (!certs || !certs.length) throw new Error('No certificates in that file to take details from.');
  return { certs: certs.filter(isObj), jobTitle: (d.job && d.job.title) || '', ignored: ['files', 'devicePresets', 'customer', 'customers', 'jobs', 'job'].filter((k) => d[k] != null && k !== 'jobs' && k !== 'job') };
}

function itemName(listKey, it, i) {
  const k = MATCH[listKey]; const v = it && k ? it[k] : '';
  if (listKey === 'boards') return v || `DB${i + 1}`;
  if (listKey === 'circuits') return `${v || '?'}${it.desc ? ' ' + it.desc : ''}`;
  return v || it.type || it.text || `#${i + 1}`;
}
function findMatch(listKey, dst, it, used) {
  if (it.id != null) { const i = dst.findIndex((x, j) => !used.has(j) && x && x.id === it.id); if (i >= 0) return i; }
  const k = MATCH[listKey]; if (!k || isEmpty(it[k])) return -1;
  return dst.findIndex((x, j) => !used.has(j) && x && same(x[k], it[k]));
}

function mergeObj(dst, src, path, ops) {
  for (const k of Object.keys(src)) {
    if (SKIP.has(k) || (!path.length && SKIP_TOP.has(k))) continue;
    const sv = src[k]; const dv = dst[k]; const p = [...path, k];
    if (Array.isArray(sv)) mergeArr(dst, k, sv, p, ops);
    else if (isObj(sv)) {
      if (isObj(dv)) mergeObj(dv, sv, p, ops);
      else if (isEmpty(dv)) { if (!isEmpty(sv)) { dst[k] = clone(sv); ops.push({ action: 'fill', path: p, val: sv }); } }
      else ops.push({ action: 'skip', path: p, cur: dv, val: sv });
    } else {
      if (isEmpty(sv)) continue;
      if (isEmpty(dv)) { dst[k] = sv; ops.push({ action: 'fill', path: p, val: sv }); }
      else if (!same(dv, sv)) ops.push({ action: 'skip', path: p, cur: dv, val: sv });
    }
  }
}
function mergeArr(dst, k, sv, path, ops) {
  if (!sv.length) return;
  if (!Array.isArray(dst[k])) {
    if (!isEmpty(dst[k])) { ops.push({ action: 'skip', path, cur: dst[k], val: sv }); return; }
    dst[k] = [];
  }
  const d = dst[k];
  if (!sv.every(isObj)) { // plain list (e.g. ticks): only if ours is empty
    if (!d.length) { dst[k] = clone(sv); ops.push({ action: 'fill', path, val: sv.join(', ') }); }
    else if (JSON.stringify(d) !== JSON.stringify(sv)) ops.push({ action: 'skip', path, cur: d.join(', '), val: sv.join(', ') });
    return;
  }
  const used = new Set();
  sv.forEach((it, i) => {
    const j = findMatch(k, d, it, used);
    if (j < 0) {
      const add = clone(it);
      if (add.id != null && d.some((x) => x && x.id === add.id)) delete add.id; // never two with one id
      d.push(add); used.add(d.length - 1);
      ops.push({ action: 'add', path: [...path, itemName(k, it, i)], list: k, item: add });
    } else { used.add(j); mergeObj(d[j], it, [...path, itemName(k, d[j], j)], ops); }
  });
}

// Plan (and do, on a copy) the merge of one incoming certificate into a local one.
export function mergeCert(local, incoming) {
  const merged = clone(local); const ops = [];
  mergeObj(merged, incoming, [], ops);
  return { merged, ops };
}

// Find which local certificate each incoming one goes into: id, then number.
// forceCertId: on a certificate's own page, a single incoming cert goes into it.
export function planImport(localCerts, file, { forceCertId = null } = {}) {
  const items = []; const unmatched = [];
  const pick = (c) => localCerts.find((l) => l.id === c.id) || (c.number ? localCerts.find((l) => same(l.number, c.number)) : null);
  let incoming = file.certs;
  if (forceCertId) {
    const target = localCerts.find((l) => l.id === forceCertId);
    const m = incoming.filter((c) => pick(c) && pick(c).id === forceCertId);
    const use = m[0] || (incoming.length === 1 ? incoming[0] : null);
    if (!target || !use) return { items, unmatched: incoming.map((c) => c.number || c.id || '?') };
    incoming = [use];
    const { merged, ops } = mergeCert(target, use);
    items.push({ local: target, incoming: use, merged, ops, how: pick(use) && pick(use).id === forceCertId ? (use.id === target.id ? 'id' : 'number') : 'this' });
    return { items, unmatched };
  }
  for (const c of incoming) {
    const l = pick(c);
    if (!l) { unmatched.push(c.number || c.id || '?'); continue; }
    const { merged, ops } = mergeCert(l, c);
    items.push({ local: l, incoming: c, merged, ops, how: l.id === c.id ? 'id' : 'number' });
  }
  return { items, unmatched };
}
export const counts = (ops) => ({ add: ops.filter((o) => o.action === 'add').length, fill: ops.filter((o) => o.action === 'fill').length, skip: ops.filter((o) => o.action === 'skip').length });

// Ready to save: touch updatedAt / version so it syncs.
export function finish(merged, when = new Date().toISOString()) {
  merged.updatedAt = when; merged.version = (merged.version || 0) + 1;
  (merged.imports = Array.isArray(merged.imports) ? merged.imports : []).push({ kind: 'extra', at: when });
  return merged;
}

// Plain words for one change, e.g. "DB2 › Circuit 1 Battery inverter (AC)".
export function opLabel(o) {
  const out = []; let prevList = null;
  o.path.forEach((seg, i) => {
    if (NAMES[seg] && i === o.path.length - 1 && o.action !== 'add') { out.push(seg === 'otherSources' ? 'Other sources of supply' : NAMES[seg]); return; }
    if (NAMES[seg]) { prevList = seg; return; }
    if (prevList) { out.push(prevList === 'boards' ? seg : `${NAMES[prevList]} ${seg}`); prevList = null; return; }
    out.push(SECTIONS[seg] || FIELDS[seg] || seg);
  });
  if (o.action === 'add' && o.list) { const last = out.pop() || ''; out.push(o.list === 'boards' ? `Board ${last}` : last); }
  return out.join(' › ');
}
export function addDetail(o) {
  if (o.list === 'boards') { const n = (o.item.circuits || []).length; return `${n} circuit${n === 1 ? '' : 's'}${o.item.location ? ' · ' + o.item.location : ''}`; }
  if (o.list === 'circuits') return [o.item.bs && 'BS EN ' + o.item.bs, (o.item.type || '') + (o.item.rating || ''), o.item.live && o.item.live + ' mm²'].filter(Boolean).join(' · ');
  if (o.list === 'otherSources') return [o.item.type, o.item.kw && o.item.kw + ' kW'].filter(Boolean).join(' · ');
  return '';
}
