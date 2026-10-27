// =====================================================================
// presets.js — v0.11: protective device presets for circuits.
// A preset is just the device boxes (BS EN, type/curve, rating, kA, RCD
// BS/type/IΔn/rating, S-type). Filling a new combination on a circuit
// remembers it; tapping a preset fills only those boxes (never the cable
// or the test results). Kept in this device's settings (meta
// 'devicePresets'), in the backup file, and carried with jobs in sync.
// Deleted presets are kept as { deleted: true } so sync doesn't bring
// them back. No customer data in here.
// =====================================================================
import * as db from './db.js';
import { deviceById, deviceFromBs } from './limits.js';
import { isSpareCircuit as isSpare } from './templates.js';

export const BASE_KEYS = ['device', 'bs', 'type', 'rating', 'bka', 'rcdBs', 'rcdType', 'rcdIdn', 'rcdRating', 'rcdS'];
// v0.25: MCCB/MPCB settings (Im, and Ig/tg on LSIG MCCBs) added at the end. Additive only:
// a preset without them has the same key as before, so old and new presets still merge.
export const EXTRA_KEYS = ['im', 'ig', 'tg'];
// v0.32: optional AFDD boxes (BS EN, type, rating). Additive like EXTRA_KEYS: old presets keep their key.
export const AFDD_KEYS = ['afddBs', 'afddType', 'afddRating'];
export const PRESET_KEYS = [...BASE_KEYS, ...EXTRA_KEYS, ...AFDD_KEYS];
export const RCD_KEYS = ['rcdBs', 'rcdType', 'rcdIdn', 'rcdRating', 'rcdS'];
// v0.25: MCCBs/MPCBs have no RCD of their own: their presets never keep RCD boxes
// (before v0.25 a board's RCD details could leak into an MCCB preset).
const isAdj = (f) => !!(deviceById(f && f.device) || {}).adj;
export function clean(f = {}) {
  const out = { ...f };
  if (isAdj(out)) { for (const k of RCD_KEYS) if (k in out) out[k] = k === 'rcdS' ? false : ''; }
  else for (const k of EXTRA_KEYS) if (k in out) out[k] = '';
  if ((deviceById(out.device) || {}).adj !== 'mccb') { if ('ig' in out) out.ig = ''; if ('tg' in out) out.tg = ''; }
  return out;
}
const val = (v) => (v == null ? '' : typeof v === 'boolean' ? v : String(v).trim());
const real = (v) => v != null && v !== '' && v !== false && !/^n\/?a$/i.test(String(v));

// The device boxes of a circuit, or null if there isn't enough to be worth keeping
// (needs a rating and a BS number or device; N/A boxes don't count).
export function presetFrom(c) {
  if (!c) return null;
  const f = {}; for (const k of PRESET_KEYS) f[k] = val(c[k]);
  if (!real(f.rating) || !(real(f.bs) || f.device)) return null;
  for (const k of PRESET_KEYS) if (typeof f[k] === 'string' && /^n\/?a$/i.test(f[k])) f[k] = '';
  return clean(f);
}
export const keyOf = (f0) => { const f = clean(f0 || {});
  const base = BASE_KEYS.map((k) => (k === 'rcdS' ? (f[k] ? 'S' : '') : String(f[k] ?? '').toUpperCase())).join('|');
  const extra = EXTRA_KEYS.map((k) => String(f[k] ?? '').trim());
  const afdd = AFDD_KEYS.map((k) => String(f[k] ?? '').trim().toUpperCase());
  return (extra.some(Boolean) ? base + '|' + extra.join('|') : base) + (afdd.some(Boolean) ? '|AFDD|' + afdd.join('|') : ''); };
// v0.35: does this preset's device have an RCD of its own (RCBO etc.)?
export const ownRcd = (f = {}) => { const d = deviceById(f.device) || deviceFromBs(f.bs); return !!(d && d.rcd); };
// e.g. "B32 RCBO · 30 mA Type A · 6 kA"
export function nameFor(f) {
  const d = deviceById(f.device); const kind = d ? d.label.split(' (')[0] : f.bs ? 'BS EN ' + f.bs : 'Device';
  // v0.35: only an RCBO (or a device that is itself an RCD) shows RCD details; a plain MCB/fuse
  // never shows the upstream RCCB's. No doubled S when the type already says S (e.g. 'A-S').
  const dd = d || deviceFromBs(f.bs); const ownRcd = !!(dd && dd.rcd);
  const rt = real(f.rcdType) ? String(f.rcdType).trim() : ''; const sTyped = /(^|[-\s])S$/i.test(rt);
  const rcd = ownRcd && real(f.rcdIdn) ? `${f.rcdIdn} mA${rt ? ' Type ' + rt : ''}${f.rcdS && !sTyped ? ' S' : ''}` : '';
  const tp = /^[BCD123]$/.test(String(f.type || '')) ? f.type : ''; // v0.20: no 'adj32 MCCB' / 'plug13'
  const adj = d && d.adj ? [real(f.im) ? `Im ${f.im} A` : '', real(f.ig) ? `Ig ${f.ig} A${real(f.tg) ? ', tg ' + f.tg + ' s' : ''}` : ''].filter(Boolean).join(', ') : '';
  return [tp ? `${tp}${f.rating} ${kind}` : `${f.rating} A ${kind}`, d && d.adj ? '' : rcd, adj, real(f.bka) ? f.bka + ' kA' : '', real(f.afddBs) || real(f.afddRating) ? 'AFDD' + (real(f.afddRating) ? ' ' + f.afddRating + ' A' : '') : ''].filter(Boolean).join(' · ');
}
// Fill a circuit's device boxes from a preset. Returns the keys changed.
export function applyPreset(c, p) {
  const out = [];
  const f = clean(p.fields || {}); const adj = isAdj(f); const keepRcd = adj || !ownRcd(f);
  for (const k of PRESET_KEYS) {
    if (keepRcd && RCD_KEYS.includes(k)) continue; // v0.25 MCCB / v0.35 MCB, fuse etc.: only a device with its own RCD (RCBO) fills the RCD boxes
    if ((EXTRA_KEYS.includes(k) || AFDD_KEYS.includes(k)) && !(k in f)) continue; // older presets: don't blank Im/Ig/tg/AFDD
    const v = k === 'rcdS' ? !!f[k] : f[k] ?? ''; if ((c[k] ?? (k === 'rcdS' ? false : '')) !== v) { c[k] = v; out.push(k); } }
  return out;
}
// v0.35.2: an MCB / fuse preset: RCD boxes still holding that preset's stored upstream RCD
// (filled by an older version) are handed back to the app, so the board's RCD goes in.
export function releaseUpstreamRcd(c, f = {}) {
  for (const k of ['rcdBs', 'rcdType', 'rcdIdn', 'rcdRating']) {
    const v = String(c[k] ?? '').trim(); if (v && v === String(f[k] ?? '').trim()) { c.autoF = c.autoF || {}; c.autoF[k] = c[k]; }
  }
}
// Which device boxes would change (and already hold something) — for "are you sure".
export function wouldOverwrite(c, fields) {
  return Object.keys(fields).filter((k) => { const cur = c[k]; const nv = fields[k]; const has = typeof cur === 'boolean' ? cur : String(cur ?? '').trim() !== ''; return has && String(cur) !== String(nv); });
}
// v0.25: most recently used first, then by name (the "used N×" count isn't shown any more).
export const shown = (list) => (list || []).filter((p) => !p.deleted).sort((a, b) => String(b.usedAt || '').localeCompare(String(a.usedAt || '')) || String(a.name || '').localeCompare(String(b.name || '')));
// Two lists → one: same combination = one preset; newest edit wins (name, deleted), uses = the higher.
export function mergePresets(a = [], b = []) {
  const m = new Map();
  for (const p of [...a, ...b]) {
    const k = keyOf(p.fields || {}); const cur = m.get(k);
    if (!cur) { m.set(k, { ...p, fields: clean(p.fields || {}) }); continue; }
    const newer = String(p.updatedAt || '') > String(cur.updatedAt || '') ? p : cur;
    m.set(k, { ...newer, fields: clean(newer.fields || {}), id: cur.id, uses: Math.max(cur.uses || 0, p.uses || 0), usedAt: [cur.usedAt, p.usedAt].filter(Boolean).sort().pop() || null });
  }
  return [...m.values()];
}
// Remember a circuit's combination if it's new. Returns { preset, added }.
export function remember(list, c, { now = new Date().toISOString(), newId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) } = {}) {
  const f = presetFrom(c); if (!f) return { preset: null, added: false };
  const k = keyOf(f); const found = list.find((p) => keyOf(p.fields) === k);
  if (found) { if (found.deleted) return { preset: null, added: false, deleted: true }; return { preset: found, added: false }; }
  const p = { id: newId(), name: nameFor(f), fields: f, uses: 1, usedAt: now, createdAt: now, updatedAt: now };
  list.push(p); return { preset: p, added: true };
}

// ---------- stored on this device ----------
export const KEY = 'devicePresets';
export const load = async () => (((await db.getMeta(KEY)) || { list: [] }).list || []).map((p) => (p && p.fields ? { ...p, fields: clean(p.fields), name: p.fields && isAdj(p.fields) && /mA/.test(p.name || '') ? nameFor(clean(p.fields)) : p.name } : p));
export const save = (list) => db.setMeta(KEY, { list, updatedAt: new Date().toISOString() });
export async function mergeIn(list) { if (!Array.isArray(list) || !list.length) return; await save(mergePresets(await load(), list)); }
export async function used(id) { const l = await load(); const p = l.find((x) => x.id === id); if (p) { p.uses = (p.uses || 0) + 1; p.usedAt = new Date().toISOString(); await save(l); } }

// ---------- v0.11: several circuits at once ----------
export const skipByDefault = (c) => isSpare(c) && !!c.noDevice; // spares with "No device fitted": only if you tick them yourself
export const BULK_FIELDS = [['bs', 'OCPD BS (EN)'], ['type', 'Type / curve'], ['rating', 'Rating (A)'], ['bka', 'kA'], ['rcdBs', 'RCD BS (EN)'], ['rcdType', 'RCD type'], ['rcdIdn', 'RCD IΔn (mA)'], ['rcdRating', 'RCD rating (A)'], ['wiring', 'Type of wiring'], ['ref', 'Reference method'], ['live', 'Live csa (mm²)'], ['cpc', 'CPC csa (mm²)']];
// Put fields on circuits. mode 'all' overwrites, 'empty' only fills blank boxes. Returns boxes changed.
export function bulkApply(circuits, fields, mode = 'all') {
  let n = 0;
  for (const c of circuits) for (const [k, v] of Object.entries(fields)) {
    const cur = c[k]; const empty = typeof cur === 'boolean' ? !cur : String(cur ?? '').trim() === '';
    if (mode === 'empty' && !empty) continue;
    if (String(cur ?? '') !== String(v)) { c[k] = v; n++; }
    if (k === 'bs') { const d = deviceFromBs(v); if (d) c.device = d.id; }
  }
  return n;
}
