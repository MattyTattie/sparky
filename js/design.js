// =====================================================================
// design.js — v0.4 sums: the adiabatic check (543.1.3) and the cable &
// breaker sizer (load + length → breaker and the smallest cable that
// passes current, volt drop, Zs and adiabatic). Plain JS, tested by
// tests/design.test.mjs. Every table comes from cables.js / limits.js.
// =====================================================================
import { CABLES, CABLE_PICKS, CABLE_TEMP, CG, CF_BS3036, SINGLES_CPC, ARMOUR_CSA, K_VALUES, UL } from './cables.js';
import { UO, CMIN, MAX_ZS, deviceById, ratingsFor, maxZs, INSTANT_MULT, MCB_INSTANT_T, MCB_CLASS3_I2T, RCD_TIMES } from './limits.js';
import { ambientFactor, r1r2At20, RING_DIVISOR } from './calc.js';
import { TEMP_MULT } from './cables.js';

const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;
const fmt = (n) => String(r2(n));

// ---------- k and CPC area ----------
// kind: 'te' | 'te3' | 'singles' | 'swa' | 'swaX' | 'swa3' | 'swa3X' (calc tables) or a CABLE_PICKS key.
export function kFor({ cable, cpcMode = 'core', separate = false }) {
  const pick = CABLE_PICKS[cable];
  const calc = pick ? pick.calc : cable;
  const armour = cpcMode === 'armour' || (pick && pick.cpc === 'armour') || calc === 'swa' || calc === 'swaX' || calc === 'swa4' || calc === 'swa4X';
  const hot = (CABLE_TEMP[calc] || 70) === 90;
  if (armour) return { key: hot ? 'armour90' : 'armour70', ...K_VALUES[hot ? 'armour90' : 'armour70'], armour: true };
  if (separate) return { key: hot ? 'sep90' : 'sep70', ...K_VALUES[hot ? 'sep90' : 'sep70'] };
  return { key: hot ? 'core90' : 'core70', ...K_VALUES[hot ? 'core90' : 'core70'] };
}
// CPC area for a cable table + live size: number (mm²) or { armour, area }.
export function cpcAreaFor(cable, size, cpcMode = 'core') {
  const c = CABLES[cable]; if (!c) return null;
  if (cable === 'te' || cable === 'te3') return { cpc: (cable === 'te3' ? CABLE_PICKS.te3 : CABLE_PICKS.te).sizes[size] ?? null };
  if (cable === 'singles' || cable === 'singles3') return { cpc: SINGLES_CPC[size] ?? null };
  if (c.cores === 4) { const a = ARMOUR_CSA[4][size]; return { cpc: 'armour', area: a ?? null }; }
  if (c.cores === 2 || cpcMode === 'armour') { const a = (ARMOUR_CSA[c.cores || 2] || ARMOUR_CSA[2])[size]; return { cpc: 'armour', area: a ?? null }; }
  return { cpc: Number(size) };
}

// ---------- How long the device takes to clear a fault ----------
// Returns { t, i2t, how, trips } for an earth fault current (A).
// iTrip is the current that must flow to trip in time = Uo × Cmin / Zs; the
// energy uses Uo / Zs (the usual GN6 / OSG method).
export function clearance({ device, type, rating, zs, uo = UO, rcd = false, rcdS = false, bka = 6, time = 0.4 }) {
  const Z = Number(zs); const In = Number(rating);
  if (!(Z > 0)) return { ok: false, error: 'Need Zs' };
  const ifault = uo / Z; const imin = (uo * CMIN) / Z;
  const d = deviceById(device); const tbl = d && d.table && MAX_ZS[d.table];
  const row = tbl && tbl[type] && tbl[type][In];
  const rcdT = (rcdS ? RCD_TIMES.S.maxMs : RCD_TIMES.general.maxMs) / 1000;
  const viaRcd = (why) => ({ ok: true, ifault: r2(ifault), t: rcdT, i2t: ifault * ifault * rcdT, how: `${why} The RCD clears it within ${rcdT * 1000} ms (Table 3A).`, byRcd: true });
  if (!row) return rcd ? viaRcd('No table for this device.') : { ok: false, ifault: r2(ifault), error: 'No max Zs table for this device and rating, so the clearing time isn\u2019t known. Use the maker\u2019s time/current curve.' };
  const ia04 = row[0] ? (uo * CMIN) / row[0] : null, ia5 = row[1] ? (uo * CMIN) / row[1] : null;
  const isCb = d.table === 'mcb' || d.table === 'bs3871';
  if (isCb) {
    if (ia04 && imin >= ia04 - 1e-9) {
      let i2t = ifault * ifault * MCB_INSTANT_T; let capped = false;
      const cls = In <= 16 ? MCB_CLASS3_I2T.upTo16 : In <= 32 ? MCB_CLASS3_I2T.upTo32 : null;
      if (cls && ['B', 'C'].includes(type)) { const ka = Number(bka) || 6; const key = Object.keys(cls).map(Number).sort((a, b) => a - b).find((x) => x >= ka * 1000) || Math.max(...Object.keys(cls).map(Number)); if (cls[key] < i2t) { i2t = cls[key]; capped = true; } }
      return { ok: true, ifault: r2(ifault), t: MCB_INSTANT_T, i2t, capped, how: `Trips instantly (${INSTANT_MULT[type] ? INSTANT_MULT[type] + ' × In' : 'magnetic trip'}), in under ${MCB_INSTANT_T} s; the app uses ${MCB_INSTANT_T} s${capped ? ', capped at the class 3 let-through for ' + (Number(bka) || 6) + ' kA (' + i2t + ' A²s)' : ''}.` };
    }
    if (ia5 && imin >= ia5 - 1e-9 && Number(time) >= 5) return { ok: true, ifault: r2(ifault), t: 5, i2t: ifault * ifault * 5, how: 'Within 5 s (Table 41.4); the app uses 5 s.' };
    return rcd ? viaRcd('Too little fault current to trip the breaker instantly.') : { ok: false, ifault: r2(ifault), error: `Fault current ${Math.round(imin)} A (with Cmin) is too low to trip the breaker instantly (needs ${Math.round(ia04 || ia5)} A). Zs is over the limit.` };
  }
  // Fuses: a straight line on log-log paper through the 0.4 s and 5 s points of the table,
  // never quicker than 0.1 s (the tables don't go faster; on the safe side).
  const slope = ia04 && ia5 ? Math.log(5 / 0.4) / Math.log(ia5 / ia04) : -4.5;
  const [iRef, tRef] = ia04 ? [ia04, 0.4] : [ia5, 5];
  if (imin < (ia5 || ia04) - 1e-9) return rcd ? viaRcd('Too little fault current to blow the fuse in 5 s.') : { ok: false, ifault: r2(ifault), error: `Fault current ${Math.round(imin)} A is too low for the fuse to blow in time. Zs is over the limit.` };
  let t = tRef * Math.pow(imin / iRef, slope); t = Math.min(5, Math.max(0.1, t));
  return { ok: true, ifault: r2(ifault), t: r3(t), i2t: ifault * ifault * t, how: `Fuse time read off a line through the table's 0.4 s and 5 s points: about ${r2(t)} s (never less than 0.1 s, on the safe side).${ia04 && ia5 ? '' : ' Only one table point, so a typical fuse slope is assumed.'}` };
}

// S = √(I²t) / k  (543.1.3)
export function adiabatic({ zs, device, type, rating, k = 115, cpcCsa, rcd = false, rcdS = false, bka = 6, time = 0.4, uo = UO }) {
  const cl = clearance({ device, type, rating, zs, uo, rcd, rcdS, bka, time });
  if (!cl.ok) return { ok: false, ...cl };
  const smin = Math.sqrt(cl.i2t) / Number(k);
  const have = Number(cpcCsa);
  return { ok: true, ...cl, k: Number(k), smin: r2(smin), cpc: have || null, pass: have ? have >= smin - 1e-9 : null, i2t: Math.round(cl.i2t) };
}

// ---------- Cable & breaker sizer ----------
export const LOAD_TYPES = [
  ['general', 'General / sockets radial'],
  ['ring', 'Socket ring final'],
  ['lighting', 'Lighting'],
  ['heating', 'Heating / shower / cooker (resistive)'],
  ['motor', 'Motor / pump / compressor (inrush)'],
  ['ev', 'EV charger'],
];
// v0.5: phase 3 → balanced three-phase load, Ib = P ÷ (√3 × UL × pf) per line.
export function designCurrent({ load, unit = 'A', pf = 1, uo = UO, phase = 1, ul = UL }) {
  const v = Number(load); if (!(v > 0)) return null;
  if (unit !== 'kW') return r2(v);
  return Number(phase) === 3 ? r2((v * 1000) / (Math.sqrt(3) * ul * (Number(pf) || 1))) : r2((v * 1000) / (uo * (Number(pf) || 1)));
}

export function sizeCircuit(o) {
  const {
    load, unit = 'kW', pf = 1, loadType = 'general', length, cable = 'te', cpcMode = 'core', method = 'C',
    ambient = 30, grouped = 1, grouping = 'bunched', ci = 1, ze = 0.35, device = 'rcbo', type = 'auto', time = 0.4,
    vdPct = null, ringLoad = 'spread', bka = 6, separateCpc = false, uo = UO, phase = 1, ul = UL,
  } = o;
  const three = Number(phase) === 3;
  if (three && !(CABLES[cable] && CABLES[cable].phase === 3)) return { ok: false, error: 'Pick a three-phase cable (4-core SWA or singles).' };
  if (!three && CABLES[cable] && CABLES[cable].phase === 3) return { ok: false, error: 'That cable is for three-phase. Pick a single-phase cable or switch to 3-phase.' };
  if (three && loadType === 'ring') return { ok: false, error: 'Ring finals are single-phase. Pick another load type for 3-phase.' };
  const ib = designCurrent({ load, unit, pf, uo, phase, ul });
  const vref = three ? ul : uo; // volt drop % is of 400 V line voltage on 3-phase
  if (ib == null) return { ok: false, error: 'Enter the load (kW or amps).' };
  const L = Number(length);
  if (!(L > 0)) return { ok: false, error: 'Enter the length of the cable run.' };
  const cab = CABLES[cable]; const m = cab && cab.methods[method];
  if (!m) return { ok: false, error: 'Pick a cable and how it\u2019s installed.' };
  const ring = loadType === 'ring' ? ringLoad : false;
  const d = deviceById(device) || deviceById('rcbo');
  const curve = type === 'auto' ? (d.types.includes('B') ? (loadType === 'motor' ? 'C' : 'B') : d.types[0]) : type;
  const steps = [];
  if (type === 'auto' && loadType === 'motor' && curve === 'C') steps.push('Type C suggested: motors and pumps draw a big starting current that can trip a Type B. A Type C has a lower max Zs, so it\u2019s checked against that.');
  const ratings = ratingsFor(d.id, curve).map(Number).sort((a, b) => a - b);
  let inA;
  if (ring) {
    inA = ratings.includes(32) ? 32 : ratings.includes(30) ? 30 : null;
    if (!inA) return { ok: false, error: 'A ring final needs a 30 or 32 A device.' };
    if (ib > inA) return { ok: false, error: `${ib} A is more than a ${inA} A ring can supply. Split the load.` };
    steps.push(`Ring final: ${inA} A device (Regulation 433.1.204 / Appendix 15, up to 100 m² floor area).`);
  } else {
    inA = ratings.find((r) => r >= ib - 1e-9);
    if (!inA) return { ok: false, ib, error: `No ${d.label.split(' (')[0]} ${curve} rating is big enough for ${ib} A.` };
    steps.push(`Design current Ib = ${ib} A${three ? ' per phase' : ''}${unit === 'kW' ? (three ? ` (${load} kW ÷ (√3 × ${ul} V${Number(pf) !== 1 ? ' × pf ' + pf : ''}))` : ` (${load} kW ÷ ${uo} V${Number(pf) !== 1 ? ' ÷ pf ' + pf : ''})`) : ''}, so the next breaker size up is ${inA} A${three ? ' triple-pole' : ''} (In ≥ Ib).`);
  }
  const limit = vdPct != null && vdPct !== '' ? Number(vdPct) : loadType === 'lighting' ? 3 : 5;
  // correction factors
  let { ca, note: caNote } = ambientFactor(cable, ambient);
  if (/^D/.test(method)) { ca = 1; caNote = 'Buried: air-temperature factor not used.'; }
  const cg = (CG[grouping] || CG.bunched)[Math.min(9, Math.max(1, Number(grouped) || 1))] ?? 1;
  const cf = device === 'bs3036' ? CF_BS3036 : 1;
  const factor = ca * cg * (Number(ci) || 1) * cf;
  const ringRule = (s) => ring && [30, 32].includes(inA) && s >= 2.5;
  const needIz = (s) => (ringRule(s) ? 20 : inA);
  const max = maxZs({ device: d.id, type: curve, rating: inA, time });
  const temp = CABLE_TEMP[cable] || 70; const mult = TEMP_MULT[temp] || 1.2;
  const k = kFor({ cable, cpcMode, separate: separateCpc });
  const div = ring ? RING_DIVISOR[ring] || 4 : 1;
  const rows = cab.sizes.filter((s) => !ring || s >= 2.5).map((s) => {
    const it = m.amps[s]; const needIt = needIz(s) / factor;
    const cur = { pass: it != null && it >= needIt - 1e-9, it: it ?? null, iz: it == null ? null : r2(it * factor), needIz: needIz(s), needIt: r2(needIt) };
    const mv = cab.mvam[s]; const v = (mv * ib * L) / 1000 / div; const pct = (v / vref) * 100;
    const vd = { pass: pct <= limit + 1e-9, volts: r2(v), pct: r2(pct), limit, mvam: mv, div };
    const cp = cpcAreaFor(cable, s, cpcMode);
    const r20 = cp && cp.cpc != null ? r1r2At20({ live: s, cpc: cp.cpc, length: L, cores: cab.cores || 2, ring: !!ring }) : null;
    const zs = r20 == null ? null : r2(Number(ze) + r20 * mult);
    const z = { pass: zs != null && max != null ? zs <= max + 1e-9 : null, zs, max, r20, rHot: r20 == null ? null : r3(r20 * mult) };
    const area = cp ? (cp.cpc === 'armour' ? cp.area : cp.cpc) : null;
    const ad = zs ? adiabatic({ zs, device: d.id, type: curve, rating: inA, k: k.k, cpcCsa: area, rcd: !!d.rcd, bka, time }) : { ok: false };
    const adi = { pass: ad.ok ? ad.pass : null, ...ad, area, armour: cp && cp.cpc === 'armour' };
    const ok = cur.pass && vd.pass && z.pass !== false && adi.pass !== false;
    return { size: s, cpc: cp ? cp.cpc : null, cur, vd, z, adi, ok };
  });
  const pick = rows.find((r) => r.ok) || null;
  // plain-words reasons for every size that was too small
  const why = (r) => {
    const out = [];
    if (!r.cur.pass) out.push(r.cur.it == null ? `${r.size} mm² isn\u2019t rated for this method` : `${r.size} fails on current: after factors it carries ${r.cur.iz} A, needs ${r.cur.needIz} A`);
    if (!r.vd.pass) out.push(`${r.size} fails on volt drop at ${L} m (${r.vd.pct}%, limit ${limit}%)`);
    if (r.z.pass === false) out.push(`${r.size} fails on Zs (${r.z.zs} Ω, max ${r.z.max} Ω)`);
    if (r.adi.pass === false) out.push(`${r.size} fails the adiabatic check (CPC needs ${r.adi.smin} mm², ${r.adi.armour ? 'armour is ' : 'it has '}${r.adi.area} mm²)`);
    return out;
  };
  const upto = pick ? rows.slice(0, rows.indexOf(pick)) : rows;
  const reasons = upto.map((r) => ({ size: r.size, why: why(r) }));
  if (pick) {
    const last = reasons[reasons.length - 1];
    steps.push(last ? `${last.why.join('; ')}, so ${pick.size} mm².` : `${pick.size} mm² is the smallest in the table and passes everything.`);
  } else {
    const big = rows[rows.length - 1];
    steps.push(`No size in this table passes. Biggest (${big.size} mm²): ${why(big).join('; ') || 'check the inputs'}.`);
    if (big.z.pass === false) steps.push('Zs is too high at every size: try a smaller breaker, a lower Ze, or RCD fault protection (check Chapter 41).');
  }
  const notes = [
    three ? `Three-phase ${ul} V, balanced load, copper cables. Ib = P ÷ (√3 × ${ul} V × pf). Volt drop uses the three-phase mV/A/m and is a % of ${ul} V. Zs and the adiabatic check are phase to earth at Uo ${uo} V, using one phase conductor and the CPC${cab.cores === 4 && /swa/.test(cable) ? ' (the armour)' : ''}. Neutral current taken as nil (balanced, no harmonics).` : 'Single-phase 230 V, copper cables, BS 7671 Appendix 4 tables. Check against your own copy.',
    `Current: In ≥ Ib, then tabulated It ≥ In ÷ (Ca ${ca} × Cg ${cg} × Ci ${Number(ci) || 1}${cf !== 1 ? ' × 0.725 BS 3036' : ''}) = ÷ ${r2(factor)}.${caNote ? ' ' + caNote : ''}`,
    ring ? `Ring: Iz ≥ 20 A on 2.5 mm² or bigger (433.1.204); volt drop and R1+R2 use the ring\u2019s loop length ÷ ${div === 8 ? '8 (load spread round the ring)' : '4 (load at the far point)'} for volt drop and ÷ 4 for R1+R2.` : null,
    `Volt drop at Ib against ${limit}% of ${vref} V from the board. If it\u2019s a sub-board, add the sub-main\u2019s drop.`,
    `Zs = Ze ${ze} Ω + (R1+R2) at 20 °C × ${mult} for a hot cable (${TEMP_MULT.source}).`,
    `Adiabatic (543.1.3): S = √(I²t) ÷ k, k = ${k.k} (${k.label}). I = ${uo} V ÷ Zs at the end of the run.`,
    k.armour ? `⚠ Armour area: ${ARMOUR_CSA.source}` : null,
    three ? '⚠ Three-phase tables typed in from memory of Appendix 4 (and maker\u2019s armour data): check them. Doesn\u2019t check diversity, unbalance, harmonics (triplen currents in the neutral) or the cable\u2019s short-circuit rating.' : 'Doesn\u2019t check diversity, harmonics or the cable\u2019s short-circuit rating at the origin.',
  ].filter(Boolean);
  return { ok: true, phase: three ? 3 : 1, vref, ib, inA, curve, device: d.id, limit, factors: { ca, cg, ci: Number(ci) || 1, cf, total: r2(factor) }, rows, pick, reasons, steps, notes, max, k, ring };
}
