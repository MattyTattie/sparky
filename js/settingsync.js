// =====================================================================
// settingsync.js — v0.26: your details (with logo), saved signature and
// test instruments follow you to every device through Drive sync.
// One small "settings.json" in the "Sparky jobs" folder:
//   { app:'sparky', kind:'settings', format:1, savedAt, device, values:{profile, mysig, instruments}, stamps:{key: iso} }
// Each key is "last save wins" by its stamp (set when you save it).
// An empty device never wins: a blank Mac can't wipe the phone's logo.
// Decisions only here (no Drive, no database), so they can be tested.
// =====================================================================
export const SETTINGS_KEYS = ['profile', 'mysig', 'instruments'];
export const STAMPS = 'sync.settingsStamps';
export const SETTINGS_FILE = 'settings.json';

const filled = (v) => v != null && String(v).trim() !== '';
export function isEmptySetting(k, v) {
  if (v == null) return true;
  if (k === 'mysig') return !filled(v);
  if (k === 'instruments') return !Array.isArray(v) || !v.some((i) => i && (filled(i.make) || filled(i.model) || filled(i.serial)));
  if (k === 'profile') return typeof v !== 'object' || !Object.values(v).some((x) => (typeof x === 'string' ? filled(x) : x != null && x !== false));
  return false;
}
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
// Neither side has a stamp (set up before v0.26): put them together without losing anything.
function combine(k, mine, theirs) {
  if (k === 'profile') { const out = { ...theirs }; for (const [x, v] of Object.entries(mine || {})) if (typeof v === 'string' ? filled(v) : v != null) out[x] = v; return out; }
  if (k === 'instruments') { const key = (i) => i.id || [i.make, i.model, i.serial].join('|'); const out = [...mine]; const have = new Set(mine.map(key)); for (const i of theirs) if (!have.has(key(i))) out.push(i); return out; }
  return mine;
}

// local / remote: { values: {k: v}, stamps: {k: iso} } (remote may be null: no file yet).
// Returns { values, stamps } (what both sides should hold), take: {k: v} to save on
// this device, and push: true when Drive's file needs writing.
export function mergeSettings(local, remote) {
  const L = local || {}, R = remote || {}; const lv = L.values || {}, rv = R.values || {}, ls = L.stamps || {}, rs = R.stamps || {};
  const values = {}, stamps = {}, take = {}; let push = !remote;
  for (const k of SETTINGS_KEYS) {
    const lE = isEmptySetting(k, lv[k]), rE = isEmptySetting(k, rv[k]);
    const a = ls[k] || '', b = rs[k] || '';
    let v, s;
    if (lE && rE) { values[k] = lv[k] ?? null; stamps[k] = a > b ? a : b; continue; } // nothing on either side
    if (rE) { v = lv[k]; s = a; }
    else if (lE) { v = rv[k]; s = b; }
    else if (b > a) { v = rv[k]; s = b; }
    else if (a > b) { v = lv[k]; s = a; }
    else { v = combine(k, lv[k], rv[k]); s = a; }
    values[k] = v; stamps[k] = s;
    if (!same(v, lv[k])) take[k] = v;
    if (!same(v, rv[k]) || (s || '') !== (rs[k] || '')) push = true;
  }
  // Nothing to share at all and no file yet: don't make an empty file.
  if (!remote && SETTINGS_KEYS.every((k) => isEmptySetting(k, values[k]))) push = false;
  return { values, stamps, take, push };
}
