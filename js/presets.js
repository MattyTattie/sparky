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

export const PRESET_KEYS = ['device', 'bs', 'type', 'rating', 'bka', 'rcdBs', 'rcdType', 'rcdIdn', 'rcdRating', 'rcdS'];
const val = (v) => (v == null ? '' : typeof v === 'boolean' ? v : String(v).trim());
const real = (v) => v !== '' && v !== false && !/^n\/?a$/i.test(String(v));

// The device boxes of a circuit, or null if there isn't enough to be worth keeping
// (needs a rating and a BS number or device; N/A boxes don't count).
export function presetFrom(c) {
  if (!c) return null;
  const f = {}; for (const k of PRESET_KEYS) f[k] = val(c[k]);
  if (!real(f.rating) || !(real(f.bs) || f.device)) return null;
  for (const k of PRESET_KEYS) if (typeof f[k] === 'string' && /^n\/?a$/i.test(f[k])) f[k] = '';
  return f;
}
export const keyOf = (f) => PRESET_KEYS.map((k) => (k === 'rcdS' ? (f[k] ? 'S' : '') : String(f[k] ?? '').toUpperCase())).join('|');
// e.g. "B32 RCBO · 30 mA Type A · 6 kA"
export function nameFor(f) {
  const d = deviceById(f.device); const kind = d ? d.label.split(' (')[0] : f.bs ? 'BS EN ' + f.bs : 'Device';
  const rcd = real(f.rcdIdn) ? `${f.rcdIdn} mA${real(f.rcdType) ? ' Type ' + f.rcdType : ''}${f.rcdS ? ' S' : ''}` : '';
  return [`${f.type || ''}${f.rating} ${kind}`, rcd, real(f.bka) ? f.bka + ' kA' : ''].filter(Boolean).join(' · ');
}
// Fill a circuit's device boxes from a preset. Returns the keys changed.
export function applyPreset(c, p) {
  const out = [];
  for (const k of PRESET_KEYS) { const v = k === 'rcdS' ? !!p.fields[k] : p.fields[k] ?? ''; if ((c[k] ?? (k === 'rcdS' ? false : '')) !== v) { c[k] = v; out.push(k); } }
  return out;
}
// Which device boxes would change (and already hold something) — for "are you sure".
export function wouldOverwrite(c, fields) {
  return Object.keys(fields).filter((k) => { const cur = c[k]; const nv = fields[k]; const has = typeof cur === 'boolean' ? cur : String(cur ?? '').trim() !== ''; return has && String(cur) !== String(nv); });
}
export const shown = (list) => (list || []).filter((p) => !p.deleted).sort((a, b) => (b.uses || 0) - (a.uses || 0) || String(b.usedAt || '').localeCompare(String(a.usedAt || '')) || a.name.localeCompare(b.name));
// Two lists → one: same combination = one preset; newest edit wins (name, deleted), uses = the higher.
export function mergePresets(a = [], b = []) {
  const m = new Map();
  for (const p of [...a, ...b]) {
    const k = keyOf(p.fields || {}); const cur = m.get(k);
    if (!cur) { m.set(k, { ...p }); continue; }
    const newer = String(p.updatedAt || '') > String(cur.updatedAt || '') ? p : cur;
    m.set(k, { ...newer, id: cur.id, uses: Math.max(cur.uses || 0, p.uses || 0), usedAt: [cur.usedAt, p.usedAt].filter(Boolean).sort().pop() || null });
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
export const load = async () => ((await db.getMeta(KEY)) || { list: [] }).list || [];
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
