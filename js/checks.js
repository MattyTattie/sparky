// =====================================================================
// checks.js — live red/amber flags for a row of the schedule.
// =====================================================================
// Plain JS (no browser needed), tested by tests/checks.test.mjs.
// Every limit comes from limits.js.
import { CABLES, CABLE_PICKS } from './cables.js';
import { maxZs, coldLimit, irMinFor, IR_TABLE, rcdTimeLimit, RING, RCD_ZS, deviceById, isLegacyTable, RULE_OF_THUMB } from './limits.js';

// "0.42" -> 0.42, ">999" -> 999, "≥200" -> 200, "N/A" / "" / "LIM" -> null
export function num(v) {
  if (v == null) return null;
  const s = String(v).trim().replace(',', '.');
  if (!s || /^(n\/?a|lim|n\/?v|-|—)$/i.test(s)) return null;
  const m = /^[<>≥≤+]*\s*(-?\d*\.?\d+)/.exec(s);
  return m ? Number(m[1]) : null;
}
const isGreater = (v) => /^\s*[>≥]/.test(String(v || ''));

export const isSpare = (c) => !!(c && (c.spare || /^(spare|n\/?a)$/i.test(String(c.desc || '').trim())));

// The max Zs used for a circuit: your own figure (e.g. from the maker's
// data) wins; otherwise the BS 7671 table; on TT with an RCD, Table 41.5.
export function limitZs(c, ctx = {}) {
  const own = num(c.maxZsOverride);
  if (own != null) return { value: own, source: 'Entered by you (state source in Remarks)' };
  if (ctx.earthing === 'TT' && (c.rcdIdn || (deviceById(c.device) || {}).rcd)) {
    const idn = Number(c.rcdIdn) || 30;
    if (RCD_ZS[idn]) return { value: RCD_ZS[idn], source: RCD_ZS.source, tt: true };
  }
  const v = maxZs({ device: c.device, type: c.type, rating: c.rating, time: c.time || 0.4 });
  return v == null ? { value: null, source: '' } : { value: v, source: 'BS 7671 Table 41.' + (Number(c.time) >= 5 ? '4' : (c.device === 'mcb' || c.device === 'rcbo' ? '3' : '2')) + (isLegacyTable(c.device) ? ' (legacy table — check)' : '') };
}

// ---- Cable vs device (Appendix 4 tabulated ratings, before correction factors) ----
const hasVal = (v) => v != null && String(v).trim() !== '' && !/^n\/?a$/i.test(String(v).trim());
export const isRingLike = (c) => c.ring === true || (c.ring !== false && (['r1', 'rn', 'r2'].some((k) => hasVal(c[k])) || /\bring\b/i.test(c.desc || '')));
const SOCKETY = /sock|skt|ring/i;
export function cableTable(c) {
  const p = CABLE_PICKS[c.cable]; if (p) return p.calc;
  const w = String(c.wiring || '').toUpperCase();
  if (w === 'A' || (!w && num(c.cpc) != null && num(c.cpc) < num(c.live))) return 'te';
  if (w === 'F') return 'swa'; if (w === 'G') return 'swaX';
  return null;
}
export function cableCheck(c) {
  const live = num(c.live), In = num(c.rating); const t = cableTable(c);
  if (live == null || !t) return null;
  const ref = String(c.ref || '').toUpperCase().replace(/^D[12]$/, 'D');
  const tbl = CABLES[t]; const m = tbl && tbl.methods[ref];
  if (!m) return ref ? { level: null, msg: `No current rating in the app for ${tbl ? tbl.label.split(',')[0] : 'this cable'} with reference method ${c.ref}. Check Appendix 4.` } : null;
  const it = m.amps[live]; if (it == null) return null;
  const src = `${tbl.source.split(' (')[0].split(' and')[0]}, method ${c.ref}`;
  const base = `Cable rating ${it} A (${src}), before correction factors.`;
  if (In == null) return { level: null, msg: base, it };
  if (In <= it) return { level: null, msg: base, it };
  const ringOk = live >= 2.5 && (isRingLike(c) || (c.ring !== false && live === 2.5 && [30, 32].includes(In) && SOCKETY.test(c.desc || ''))) && [30, 32].includes(In) && it >= 20;
  if (ringOk) return { level: null, msg: `${base} ${In} A on ${live} mm² is OK as a ring final (Regulation 433.1.204, Iz ≥ 20 A); a ${live} mm² radial can\u2019t be on ${In} A.`, it };
  return { level: 'amber', msg: `The device (${In} A) is bigger than the cable\u2019s rating (${it} A, ${src}, before correction factors). Check the cable size or the device.`, it };
}
// Cable picker on the circuit page → live and CPC columns.
export function applyCable(c) {
  const p = CABLE_PICKS[c.cable]; if (!p || c.cableSize === '' || c.cableSize == null) return c;
  const cp = p.sizes[c.cableSize]; if (cp === undefined) return c;
  c.live = String(c.cableSize); c.cpc = cp === 'armour' ? 'SWA' : String(cp);
  return c;
}

export function checkCircuit(c, ctx = {}) {
  const flags = {};
  const put = (field, level, msg) => { if (!flags[field] || flags[field].level === 'amber') flags[field] = { level, msg }; };
  if (!c || isSpare(c)) return { flags, worst: null, maxZs: null };

  // --- Zs
  const lim = limitZs(c, ctx);
  const zs = num(c.zs);
  if (zs != null && lim.value != null) {
    if (zs > lim.value) put('zs', 'red', `Zs ${zs} Ω is over the maximum ${lim.value} Ω (${lim.source}).`);
    else if (!lim.tt && zs > coldLimit(lim.value)) put('zs', 'amber', `Zs ${zs} Ω is over ${Math.round(RULE_OF_THUMB * 100)}% of the maximum (${coldLimit(lim.value)} Ω). Readings taken cold may be over the limit when the cable is hot.`);
  } else if (zs != null && lim.value == null && c.device && c.device !== 'other') {
    put('zs', 'amber', 'No table figure for this device and rating. Enter the max Zs yourself (maker\u2019s data) and note the source in Remarks.');
  }

  // --- Insulation resistance (Table 64)
  const testV = Number(c.irV) || 500;
  const min = irMinFor(testV);
  for (const f of ['irLL', 'irLE']) {
    const v = num(c[f]); if (v == null) continue;
    if (v < min) put(f, 'red', `${v} MΩ is below the ${min} MΩ minimum at ${testV} V (${IR_TABLE.source}).`);
    else if (!isGreater(c[f]) && v < IR_TABLE.adviseBelow) put(f, 'amber', `Below ${IR_TABLE.adviseBelow} MΩ. Not a fail, but worth looking into (GN3 rule of thumb).`);
  }
  if (c.irV && ![250, 500, 1000].includes(testV)) put('irV', 'amber', 'Table 64 test voltages are 250 V, 500 V or 1000 V.');

  // --- Cable vs device rating
  const cab = cableCheck(c); if (cab && cab.level) put('live', cab.level, cab.msg);

  // --- Polarity
  if (/^(x|✗|✘|fail|no)$/i.test(String(c.pol || '').trim())) put('pol', 'red', 'Incorrect polarity. An \u2018X\u2019 can\u2019t go on a schedule issued with an EIC.');

  // --- RCD time at IΔn
  const ms = num(c.rcdMs);
  if (ms != null) {
    const t = rcdTimeLimit(!!c.rcdS);
    if (ms > t.maxMs) put('rcdMs', 'red', `${ms} ms is over the ${t.maxMs} ms limit for ${c.rcdS ? 'an S-type' : 'a general'} RCD at IΔn.`);
    else if (t.minMs && ms < t.minMs) put('rcdMs', 'amber', `${ms} ms is faster than the ${t.minMs} ms an S-type should take. Is it really an S-type?`);
  }
  for (const f of ['rcdBtn', 'afddBtn']) if (/^(x|✗|✘|fail|no)$/i.test(String(c[f] || '').trim())) put(f, 'red', 'Test button did not work.');

  // --- Ring final circuit end-to-end readings (rule of thumb)
  const r1 = num(c.r1), rn = num(c.rn), r2 = num(c.r2);
  if (r1 != null && rn != null && Math.abs(r1 - rn) > RING.endToEndMatch + 1e-9) put('rn', 'amber', `r1 and rn differ by ${(Math.abs(r1 - rn)).toFixed(2)} Ω (should be within ${RING.endToEndMatch} Ω).`);
  if (r1 != null && r2 != null) {
    const ratio = (num(c.live) && num(c.cpc)) ? num(c.live) / num(c.cpc) : 1;
    const expect = r1 * ratio;
    if (Math.abs(r2 - expect) > RING.endToEndMatch + 0.05 * expect) put('r2', 'amber', `r2 ${r2} Ω doesn\u2019t match r1 × ${ratio.toFixed(2)} (≈${expect.toFixed(2)} Ω) for these cable sizes.`);
    const r1r2 = num(c.r1r2);
    if (r1r2 != null && Math.abs(r1r2 - (r1 + r2) / 4) > RING.r1r2Match + 1e-9) put('r1r2', 'amber', `(R1+R2) ${r1r2} Ω should be about (r1+r2)÷4 = ${((r1 + r2) / 4).toFixed(2)} Ω.`);
  }

  // --- Zs should be about Ze/Zdb + (R1+R2)
  const r1r2 = num(c.r1r2), zdb = num(ctx.zdb);
  if (zs != null && r1r2 != null && zdb != null && zs + 0.05 < zdb + r1r2 - 0.25) put('zs', 'amber', `Zs looks low compared with Zdb + (R1+R2) = ${(zdb + r1r2).toFixed(2)} Ω. Worth a re-test.`);

  const levels = Object.values(flags).map((f) => f.level);
  const worst = levels.includes('red') ? 'red' : levels.includes('amber') ? 'amber' : null;
  return { flags, worst, maxZs: lim.value, maxZsSource: lim.source, cold: lim.value != null && !lim.tt ? coldLimit(lim.value) : null };
}

// Instrument calibration: 'ok' | 'soon' (within 31 days) | 'out' | 'unknown'
export function calibrationState(dueDate, today = new Date()) {
  if (!dueDate) return 'unknown';
  const d = new Date(dueDate + 'T23:59:59');
  if (isNaN(d)) return 'unknown';
  const days = (d - today) / 86400000;
  if (days < 0) return 'out';
  if (days <= 31) return 'soon';
  return 'ok';
}
