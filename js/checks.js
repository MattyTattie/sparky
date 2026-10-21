// =====================================================================
// checks.js — live red/amber flags for a row of the schedule.
// =====================================================================
// Plain JS (no browser needed), tested by tests/checks.test.mjs.
// Every limit comes from limits.js.
import { CABLES, CABLE_PICKS, CU_MOHM_PER_M, ARMOUR_CSA } from './cables.js';
import { maxZsForTrip } from './limits.js';
import { adiabatic, kFor } from './design.js';
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

import { isSpareCircuit, isRingCircuit } from './templates.js';
export const isSpare = isSpareCircuit;

// The max Zs used for a circuit: your own figure (e.g. from the maker's
// data) wins; otherwise the BS 7671 table; on TT with an RCD, Table 41.5.
export function limitZs(c, ctx = {}) {
  const own = num(c.maxZsOverride);
  if (own != null) return { value: own, source: 'Entered by you (state source in Remarks)' };
  // v0.20: MPCB / MCCB: max Zs from the magnetic trip setting (optional field c.im, amps).
  if ((deviceById(c.device) || {}).adj && num(c.im) > 0) return { value: maxZsForTrip(num(c.im)), source: `Uo × Cmin ÷ magnetic trip ${num(c.im)} A (maker\u2019s setting)` };
  if (ctx.earthing === 'TT' && (c.rcdIdn || (deviceById(c.device) || {}).rcd)) {
    const idn = Number(c.rcdIdn) || 30;
    if (RCD_ZS[idn]) return { value: RCD_ZS[idn], source: RCD_ZS.source, tt: true };
  }
  const v = maxZs({ device: c.device, type: c.type, rating: c.rating, time: c.time || 0.4 });
  return v == null ? { value: null, source: '' } : { value: v, source: 'BS 7671 Table 41.' + (Number(c.time) >= 5 ? '4' : (c.device === 'mcb' || c.device === 'rcbo' ? '3' : '2')) + (isLegacyTable(c.device) ? ' (legacy table — check)' : '') };
}

// ---- Cable vs device (Appendix 4 tabulated ratings, before correction factors) ----
const hasVal = (v) => v != null && String(v).trim() !== '' && !/^n\/?a$/i.test(String(v).trim());
export const isRingLike = isRingCircuit;
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
  c.live = String(c.cableSize); c.cpc = cp === 'armour' ? 'SWA' : cp === 'none' ? 'N/A' : String(cp); // v0.19: 'none' = 2-core flex (Class II)
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

  // --- Adiabatic check of the CPC (543.1.3), from the measured Zs
  const ad = circuitAdiabatic(c, ctx);
  if (ad && ad.ok && ad.pass === false) put('cpc', 'amber', `Adiabatic: at Zs ${zs} Ω the CPC needs about ${ad.smin} mm² (√(I²t) ÷ k, k ${ad.k}); it\u2019s ${ad.cpc} mm²${ad.armourNote || ''}. This is a worst case: the maker\u2019s let-through (I²t) figure is usually much lower, so check that.`);

  // --- Zs should be about Ze/Zdb + (R1+R2)
  const r1r2 = num(c.r1r2), zdb = num(ctx.zdb);
  if (zs != null && r1r2 != null && zdb != null && zs + 0.05 < zdb + r1r2 - 0.25) put('zs', 'amber', `Zs looks low compared with Zdb + (R1+R2) = ${(zdb + r1r2).toFixed(2)} Ω. Worth a re-test.`);

  const levels = Object.values(flags).map((f) => f.level);
  const worst = levels.includes('red') ? 'red' : levels.includes('amber') ? 'amber' : null;
  return { flags, worst, maxZs: lim.value, maxZsSource: lim.source, cold: lim.value != null && !lim.tt ? coldLimit(lim.value) : null };
}

// Adiabatic check for a circuit row: uses the measured Zs, the device and the CPC.
export function circuitAdiabatic(c, ctx = {}) {
  if (!c || isSpare(c)) return null;
  const zs = num(c.zs); const In = num(c.rating);
  if (zs == null || In == null || !c.device) return null;
  const pick = CABLE_PICKS[c.cable];
  const isArmour = (pick && pick.cpc === 'armour') || /^swa$/i.test(String(c.cpc || '').trim());
  let area = num(c.cpc); let armourNote = '';
  const t = cableTable(c) || (String(c.wiring).toUpperCase() === 'G' ? 'swaX' : 'te');
  if (isArmour) {
    const cores = (pick && pick.cores) || (pick && CABLES[pick.calc] && CABLES[pick.calc].cores) || (CABLES[t] && CABLES[t].cores) || 2;
    area = (ARMOUR_CSA[cores] || ARMOUR_CSA[2])[num(c.live)] ?? null; armourNote = ' (armour area from maker\u2019s data)';
  }
  if (area == null) return null;
  const k = kFor({ cable: pick ? c.cable : t, cpcMode: isArmour ? 'armour' : 'core' });
  const rcd = !!(c.rcdIdn && num(c.rcdIdn)) || !!(deviceById(c.device) || {}).rcd;
  const r = adiabatic({ zs, device: c.device, type: c.type, rating: In, k: k.k, cpcCsa: area, rcd, rcdS: !!c.rcdS, bka: num(c.bka) || 6, time: c.time || 0.4, imag: (deviceById(c.device) || {}).adj && num(c.im) > 0 ? num(c.im) : null });
  return { ...r, cpc: area, kLabel: k.label, armourNote };
}

// Ring final circuit: the full end-to-end check, shown on the circuit page when "Ring final" is ticked.
// GN3 rules of thumb: r1 and rn within 0.05 Ω; r2 ≈ r1 × (live csa ÷ CPC csa), 1.67 for 2.5/1.5;
// (R1+R2) at each socket ≈ (r1 + r2) ÷ 4. Volt drop: OSG assumption of 20 A at the far point
// plus 12 A spread round the ring (32 A ring), over the loop length worked out from r1.
export const RING_VD_ASSUME = { farA: 20, spreadA: 12, source: 'IET On-Site Guide assumption for ring final circuits (20 A at the furthest point, the rest spread evenly)' };
export function ringCheck(c, ctx = {}) {
  const r1 = num(c.r1), rn = num(c.rn), r2 = num(c.r2), r1r2 = num(c.r1r2), zs = num(c.zs);
  const live = num(c.live), cpc = num(c.cpc);
  const items = [];
  const ok = (pass, text, sub) => items.push({ pass, text, sub });
  if (r1 == null && rn == null && r2 == null) return { items, empty: true };
  if (r1 != null && rn != null) { const d = Math.abs(r1 - rn); ok(d <= RING.endToEndMatch + 1e-9, `r1 ${r1} Ω and rn ${rn} Ω differ by ${d.toFixed(2)} Ω`, `Should be within ${RING.endToEndMatch} Ω (line and neutral are the same size).`); }
  else ok(null, 'Enter r1 and rn to compare line and neutral end-to-end.');
  const ratio = live && cpc ? live / cpc : 2.5 / 1.5;
  if (r1 != null && r2 != null) {
    const exp = r1 * ratio; const off = Math.abs(r2 - exp);
    ok(off <= RING.endToEndMatch + 0.05 * exp, `r2 ${r2} Ω, expected about ${exp.toFixed(2)} Ω (r1 × ${ratio.toFixed(2)})`, `For ${live || 2.5}/${cpc || 1.5} mm² the CPC end-to-end should be ${ratio.toFixed(2)} × r1${live && cpc ? '' : ' (2.5/1.5 assumed)'}; measured ratio ${(r2 / r1).toFixed(2)}.`);
    const expR = (r1 + r2) / 4;
    if (r1r2 != null) ok(Math.abs(r1r2 - expR) <= RING.r1r2Match + 1e-9, `R1+R2 ${r1r2} Ω, expected about ${expR.toFixed(2)} Ω ((r1 + r2) ÷ 4)`, 'Take the highest reading from the cross-connected test at each socket. Much higher means a socket is spurred or a joint is poor.');
    else ok(null, `Expected R1+R2 at each socket: about ${expR.toFixed(2)} Ω ((r1 + r2) ÷ 4)`, 'With L and CPC cross-connected at the board, every socket should read about the same.');
  }
  if (r1 != null && rn != null) items.push({ pass: null, text: `Expected L–N at each socket: about ${((r1 + rn) / 4).toFixed(2)} Ω ((r1 + rn) ÷ 4)` });
  const per = live ? CU_MOHM_PER_M[live] : null;
  if (r1 != null && per) {
    const L = Math.round((r1 / per) * 1000);
    const mv = (CABLES.te.mvam || {})[live];
    if (mv) { const v = (mv * (RING_VD_ASSUME.farA * L / 4 + RING_VD_ASSUME.spreadA * L / 8)) / 1000; const pct = (v / 230) * 100; ok(pct <= 5, `Ring about ${L} m round (from r1). Volt drop about ${v.toFixed(1)} V (${pct.toFixed(1)}%), limit 5%`, `${RING_VD_ASSUME.source}; ${mv} mV/A/m. Add the drop of any sub-main.`); }
  }
  const zdb = num(ctx.zdb);
  if (r1 != null && r2 != null && zdb != null) {
    const ez = zdb + (r1 + r2) / 4; const lim = limitZs(c, ctx);
    items.push({ pass: zs != null ? Math.abs(zs - ez) <= 0.25 : null, text: `Expected Zs about ${ez.toFixed(2)} Ω (Zdb ${zdb} + (r1 + r2) ÷ 4)${zs != null ? `, measured ${zs} Ω` : ''}`, sub: lim.value != null ? `Max Zs ${lim.value} Ω (${lim.source}).` : '' });
  }
  return { items, ratio };
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
