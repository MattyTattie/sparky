// =====================================================================
// dcplan.js — DC system planner (camper van, boat, shed, off-grid):
// loads → daily energy → battery; cable, fuse, inverter, MPPT, DC-DC,
// shore charger, shunt, isolator, busbars; and a parts list.
// Plain JS (no DOM), tested by tests/v06.test.mjs.
// =====================================================================
// ⚠ Rules of thumb (1.25 × current for fuses, DoD, charge rates, alternator
// share, fuse and part size ranges) are typical makers' / trade practice,
// written in from memory. They're a guide: the maker's instructions win.
import { DC_AMPS, dcCableSize, pvString, coldVoc, dcVoltDrop } from './dc.js';

const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const num = (v, d = 0) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : d; };
const up = (list, need) => list.find((s) => s >= need - 1e-9) ?? null;
const upHalf = (m) => Math.ceil(m * 2) / 2;

export const SYSTEM_VOLTS = [12, 24, 48];
// Battery chemistries. dod = usable depth of discharge (default), low = lowest
// working voltage per 12 V nominal (used for the inverter's worst-case current),
// chargeC = a sensible max charge current as a fraction of Ah.
export const CHEMS = {
  lifepo4: { label: 'LiFePO4 (lithium)', nom: 12.8, dod: 0.8, low: 11.5, charge: 14.4, vmax: 14.6, chargeC: 0.5, mainFuse: 'classT', iscPerAh: 20 },
  agm: { label: 'AGM', nom: 12, dod: 0.5, low: 11.0, charge: 14.4, vmax: 14.8, chargeC: 0.2, mainFuse: 'mega', iscPerAh: 10 },
  lead: { label: 'Lead-acid (flooded)', nom: 12, dod: 0.5, low: 11.0, charge: 14.4, vmax: 16.0, chargeC: 0.15, mainFuse: 'mega', iscPerAh: 10 },
};
// v0.35: charge profiles per 12 V nominal (× V ÷ 12 for 24 / 48 V). ⚠ Typical makers' figures:
// the battery maker's data sheet wins. tempComp = mV/°C per 12 V (lead batteries only).
export const PROFILES = {
  lifepo4: { name: 'Lithium (LiFePO4)', absorb: [14.2, 14.4], float: [13.4, 13.6], equalise: null, tempComp: 0, absorbTime: 'short: 15–30 min, or end at about 0.05 × Ah (tail current)',
    extra: ['Temperature compensation: OFF (lithium doesn’t need it).', 'Equalise: OFF (never equalise lithium).', 'Don’t charge below 0 °C: use the battery’s low-temperature cut-off, or the charger’s battery temperature sensor.', 'Pick the charger’s lithium / LiFePO4 setting if it has one.'] },
  agm: { name: 'AGM', absorb: [14.4, 14.7], float: [13.5, 13.8], equalise: null, tempComp: -18, absorbTime: 'about 2–4 h, or until the current drops to about 0.02 × Ah',
    extra: ['Temperature compensation: ON, about −18 mV/°C per 12 V (−3 mV/°C per cell). Fit the battery temperature sensor if the charger has one.', 'Equalise: OFF unless the battery maker says otherwise.', 'Pick the charger’s AGM setting.'] },
  lead: { name: 'Lead-acid (flooded)', absorb: [14.4, 14.8], float: [13.2, 13.5], equalise: [15.5, 16.0], tempComp: -18, absorbTime: 'about 2–4 h',
    extra: ['Temperature compensation: ON, about −18 mV/°C per 12 V (−3 mV/°C per cell).', 'Equalise: now and then only (e.g. monthly), battery vented, check the water level after.', 'Pick the charger’s flooded / wet setting.'] },
};
export function chargeProfile(chem, V = 12) {
  const P = PROFILES[chem] || PROFILES.lifepo4; const k = (Number(V) || 12) / 12;
  const rng = (a) => (a ? `${r1(a[0] * k)}–${r1(a[1] * k)} V` : null);
  return { chem, name: P.name, V: Number(V) || 12, absorb: rng(P.absorb), float: rng(P.float), equalise: rng(P.equalise), tempComp: P.tempComp ? r1(P.tempComp * k) : 0, absorbTime: P.absorbTime, extra: P.extra,
    lines: [`Absorption (boost): ${rng(P.absorb)}, ${P.absorbTime}.`, `Float: ${rng(P.float)}.`, ...P.extra] };
}
// v0.35: an alternator should not be asked for more than about half its rating by a DC-DC charger
// (it also runs the engine, lights and fans, and runs hot at full output). ⚠ Rule of thumb.
export const ALT_DEFAULT = 120, ALT_SHARE_WARN = 0.5, ALT_SHARE_ADVISE = 0.25;
// v0.35: smart-alternator (Euro 6) trigger wire: thin signal wire, fused at the feed. ⚠ Typical.
export const TRIGGER = { size: 1, fuse: 3 };
export const PV_LAYOUTS = [['auto', 'Pick for me'], ['series', 'All in series'], ['parallel', 'All in parallel'], ['custom', 'Set the number in series']];
export const INV_EFF = 0.9;
// v0.35: battery energy. kWh = Ah × nominal V ÷ 1000; nominal 12.8 V per 12 V for LiFePO4 (4 cells × 3.2 V), 12 V for lead / AGM.
export const nominalV = (chem, V) => r2(((CHEMS[chem] || CHEMS.lifepo4).nom * (Number(V) || 12)) / 12);
export const kwhOf = (ah, chem, V) => (Number(ah) === 0 ? 0 : Number(ah) > 0 ? r2((Number(ah) * nominalV(chem, V)) / 1000) : null);
export const ahOfKwh = (kwh, chem, V) => (Number(kwh) > 0 ? Math.round((Number(kwh) * 1000) / nominalV(chem, V)) : null);
// Fuse / breaker families and the ratings makers usually sell (A).
// v0.36.2: dcV = typical DC voltage rating, ka = typical DC breaking (interrupting) capacity.
// ⚠ Typical figures: the part's own data sheet wins (some MIDI / MEGA / ANL come in higher-voltage versions).
export const FUSES = {
  blade: { label: 'blade fuse (ATO/ATC)', sizes: [1, 2, 3, 5, 7.5, 10, 15, 20, 25, 30], dcV: 32, ka: 1 },
  midi: { label: 'MIDI fuse', sizes: [30, 40, 50, 60, 70, 80, 100, 125, 150, 175, 200], dcV: 32, ka: 2 },
  mega: { label: 'MEGA fuse', sizes: [40, 60, 80, 100, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500], dcV: 32, ka: 2 },
  anl: { label: 'ANL fuse', sizes: [35, 40, 50, 60, 80, 100, 125, 150, 175, 200, 225, 250, 300, 325, 350, 400, 500], dcV: 32, ka: 2 },
  classT: { label: 'Class T fuse', sizes: [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400], dcV: 160, ka: 20 },
  mcbdc: { label: 'DC MCB (2-pole, DC-rated)', sizes: [1, 2, 3, 4, 6, 10, 13, 16, 20, 25, 32, 40, 50, 63], dcV: 125, ka: 6 },
  nhdc: { label: 'NH DC fuse + holder', sizes: [100, 125, 160, 200, 250, 315, 355, 400, 500], dcV: 250, ka: 50 },
  mccb: { label: 'DC MCCB (DC-rated breaker)', sizes: [16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 320, 400, 500], dcV: 250, ka: 20 },
};
// v0.36.2: isolator switches. ⚠ Typical: many battery switches are 32 or 48 V DC only.
export const ISO_DCV = 48;
export const maxChargeV = (chem, V) => r2(((CHEMS[chem] || CHEMS.lifepo4).vmax * (Number(V) || 12)) / 12);
// Prospective short-circuit current, kA (⚠ rough: about 20 × Ah for LiFePO4, 10 × Ah for lead/AGM).
// The battery maker's figure wins: type it in (battIscKA) if you have it.
export const faultKA = (chem, ah, typed) => (Number(typed) > 0 ? Number(typed) : Number(ah) > 0 ? r1(((CHEMS[chem] || CHEMS.lifepo4).iscPerAh * Number(ah)) / 1000) : null);
// Parallel conductors touching (BS 7671 Table 4C1): 2 or 3 per pole, side by side.
export const PAR_CG = { 1: 1, 2: 0.85, 3: 0.79 };
export const INVERTER_SIZES = [150, 300, 500, 600, 800, 1000, 1200, 1500, 2000, 2500, 3000, 3500, 4000, 5000, 6000, 8000, 10000, 12000, 15000];
export const MPPT_SIZES = [10, 15, 20, 30, 35, 40, 45, 50, 60, 70, 85, 100];
export const DCDC_SIZES = [10, 12, 18, 20, 25, 30, 40, 50, 60];
export const CHARGER_SIZES = [10, 15, 20, 25, 30, 40, 50, 60, 80, 100];
export const SHUNT_SIZES = [100, 300, 500, 1000, 2000];
export const ISOLATOR_SIZES = [100, 150, 250, 300, 350, 500, 600];
export const BUSBAR_SIZES = [100, 150, 250, 300, 600, 1000];
export const BATTERY_AH = [50, 75, 100, 120, 150, 200, 230, 280, 300, 400, 460, 560, 600, 800, 1000];
export const FUSEBOX_WAYS = [4, 6, 8, 10, 12, 16];
// Cable current ratings: two single-core cables, clipped direct, 30 °C (BS 7671 Table 4E1A
// col 6 for 90 °C tri-rated / marine; Table 4D1A col 6 for 70 °C PVC). See dc.js.
export const PLAN_CABLES = {
  tri90: { amps: 'xlpe90', label: 'Tri-rated / marine 90 °C singles', note: 'Rated as BS 7671 Table 4E1A (90 °C thermosetting singles, clipped direct). Tri-rated (BS 6231 type CK) and tinned marine cable: use the maker\u2019s rating if you have it.' },
  pvc70: { amps: 'pvc70', label: '70 °C PVC singles', note: 'Rated as BS 7671 Table 4D1A (70 °C PVC singles, clipped direct).' },
};
// Ambient temperature factors, BS 7671 Table 4B1 (90 °C thermosetting / 70 °C PVC).
export const CA = { 90: { 30: 1, 35: 0.96, 40: 0.91, 45: 0.87, 50: 0.82 }, 70: { 30: 1, 35: 0.94, 40: 0.87, 45: 0.79, 50: 0.71 } };
export const BUNDLE_CG = 0.7; // BS 7671 Table 4C1, bunched, 3 circuits

// Quick picks: typical 12 V figures (W at the battery; hours = equivalent full-power hours per day).
export const QUICK_LOADS = [
  { key: 'lights', name: 'LED lights', w: 24, hours: 5, length: 4, lighting: true },
  { key: 'fridge', name: 'Compressor fridge', w: 45, peak: 60, hours: 8, length: 3, note: 'Running about a third of the time: 8 h is a warm-day figure.' },
  { key: 'pump', name: 'Water pump', w: 60, hours: 0.3, length: 3 },
  { key: 'sockets', name: 'USB / 12 V sockets', w: 30, peak: 120, hours: 3, length: 3, note: 'Peak 120 W is what a 12 V socket can supply (10 A at 12 V): the fuse and cable are sized for it.' },
  { key: 'heater', name: 'Diesel heater', w: 30, peak: 120, hours: 8, length: 2, note: 'About 30 W running, 100–150 W for the first few minutes (glow plug). Use the heater maker\u2019s fuse.' },
  { key: 'fan', name: 'Roof fan', w: 24, hours: 4, length: 3 },
  { key: 'laptop', name: 'Laptop (230 V via inverter)', ac: true, w: 65, hours: 2 },
  { key: 'kettle', name: 'Low-watt kettle (230 V via inverter)', ac: true, w: 1000, hours: 0.1, note: 'A normal 3 kW kettle won\u2019t run on most van inverters.' },
  { key: 'ac', name: '230 V appliance (via inverter)', ac: true, w: 500, hours: 0.5 },
];
export const quickLoad = (key) => { const q = QUICK_LOADS.find((x) => x.key === key); return q ? { name: q.name, ac: !!q.ac, value: String(q.w), unit: 'W', peak: q.peak ? String(q.peak) : '', hours: String(q.hours), length: q.length ? String(q.length) : '', lighting: !!q.lighting } : null; };

export const PLAN_DEFAULTS = {
  volts: '12', chem: 'lifepo4', dod: '', days: '1', battAh: '', bmsA: '',
  loads: [quickLoad('lights'), quickLoad('fridge'), quickLoad('pump'), quickLoad('sockets')],
  solarW: '', panels: '', pvLayout: '', panelVoc: '', panelVmp: '', panelIsc: '', series: '', coef: '-0.29', tmin: '-10', mpptV: '100', pvLen: '5',
  dcdcA: '', altA: '', vehV: '12', dcdcLen: '5', shoreA: '', smartAlt: '', trigLen: '3',
  invW: '', invLen: '1.5', mpptA: '',
  cable: 'tri90', install: 'clipped', ambient: '30', mainPct: '2', mainLen: '1', fuseBoxLen: '1', chargeLen: '1',
};

// The worked camper-van example (used for the screenshots and tests).
export const VAN_EXAMPLE = {
  ...PLAN_DEFAULTS, volts: '12', chem: 'lifepo4', dod: '80', days: '2', battAh: '200', invHours: '4',
  loads: [quickLoad('fridge'), quickLoad('lights'), quickLoad('pump'), quickLoad('heater'), quickLoad('laptop'), quickLoad('kettle')],
  solarW: '400', panels: '2', panelVoc: '24.3', panelVmp: '20.4', panelIsc: '10.6', series: '', mpptV: '100', pvLen: '5',
  dcdcA: '30', altA: '', dcdcLen: '5', shoreA: '', invW: '1500', invLen: '1.5',
};

// v0.35.1: over-limit text. Never print null / ? : the biggest size listed, or a red warning.
export const MAX_FUSE = Math.max(...Object.values(FUSES).flatMap((f) => f.sizes)); // 500 A
export const MAX_ISO = ISOLATOR_SIZES[ISOLATOR_SIZES.length - 1], MAX_MPPT = MPPT_SIZES[MPPT_SIZES.length - 1], MAX_CABLE = 120;
export const fuseText = (r) => r && r.fuse ? `${r.fuse.A} A ${r.fuse.label}` : `Over ${MAX_FUSE} A: no standard fuse`;
export const sizeText = (r) => r && r.size ? `${r.size} mm²` : r && r.current > 0 && r.length > 0 ? `over ${MAX_CABLE} mm²` : 'add a length';
export const isoText = (a) => a ? `${a} A` : `Over ${MAX_ISO} A: no standard isolator`;
export const ampsOr = (a, list) => a ? `${a} A` : `over ${list[list.length - 1]} A`;
export const mpptText = (s) => s.mppt ? `${s.mppt} A` : `over ${MAX_MPPT} A (use 2 controllers)`;
const UPV = 'go up a voltage (24 or 48 V)';

export function pickFuse(need, fam) {
  const f = FUSES[fam]; if (!f) return null;
  const A = up(f.sizes, need); return A == null ? null : { A, fam, label: f.label, dcV: f.dcV, ka: f.ka };
}
// v0.36.2: the family must be DC-rated above the battery's max charge voltage (vmax) and, for the
// main battery fuse on LiFePO4, break more than the prospective fault current (ka). [family, cap A].
const FAM_ORDER = {
  load: [['blade', 30], ['midi', 200], ['mega', 500], ['mcbdc', 63], ['classT', 400], ['mccb', 500]],
  main: [['mega', 500], ['anl', 500], ['classT', 400], ['nhdc', 500], ['mccb', 500]],
  mainT: [['classT', 400], ['nhdc', 500], ['mccb', 500]],
  other: [['midi', 125], ['mega', 500], ['anl', 500], ['mcbdc', 63], ['classT', 400], ['nhdc', 500], ['mccb', 500]],
};
const famFor = (need, kind, chem, vmax = 0, ka = 0) => {
  const lfp = (CHEMS[chem]?.mainFuse || 'mega') === 'classT';
  const list = kind === 'load' ? FAM_ORDER.load : kind === 'main' ? (lfp ? FAM_ORDER.mainT : FAM_ORDER.main) : FAM_ORDER.other;
  const ok = list.filter(([f]) => FUSES[f].dcV >= vmax - 1e-9 && (kind !== 'main' || !lfp || !ka || FUSES[f].ka >= ka - 1e-9));
  const hit = ok.find(([f, cap]) => need <= cap + 1e-9 && up(FUSES[f].sizes, need) != null);
  return hit ? hit[0] : (ok[ok.length - 1] || list[list.length - 1])[0];
};

// One cable run: fuse ≥ 1.25 × peak current, cable rated ≥ fuse (after the heat /
// bundling factors), volt drop at the working current ≤ target. Two-way drop (+ and −).
export function sizeRun({ id, name, intro = null, current, peak, length, volts, pct, kind = 'load', chem = 'lifepo4', cable = 'tri90', derate = 1, minSize = 0, margin = 1.25, fam = null, baseVolts = null, vmax = 0, ka = 0 }) {
  const I = num(current), Ipk = Math.max(I, num(peak, I)); const L = num(length);
  const need = r2(Ipk * margin);
  const f = pickFuse(need, fam || famFor(need, kind, chem, vmax, ka));
  const tbl = PLAN_CABLES[cable] || PLAN_CABLES.tri90;
  const tableNeed = r2((f ? f.A : need) / (derate || 1));
  const sz = I > 0 && L > 0 ? dcCableSize({ current: I, length: L, volts: baseVolts || volts, targetPct: pct, temp: 70, needAmps: tableNeed, cable: tbl.amps, minSize }) : null;
  const pick = sz && sz.pick;
  const why = [];
  why.push(`${intro ?? `${r1(I)} A${Ipk > I ? ` (${r1(Ipk)} A peak)` : ''}.`} Fuse at least 1.25 × ${r1(Ipk)} A = ${r1(need)} A${f ? `, so ${f.A} A ${f.label}` : ', bigger than the fuse sizes listed'}.`);
  if (pick) why.push(`Cable must carry the ${f ? f.A : r1(need)} A fuse${derate < 1 ? ` (÷ ${r2(derate)} for heat/bundling = ${tableNeed} A from the table)` : ''} and drop no more than ${pct}% over ${L} m: ${sz.why.length ? sz.why[sz.why.length - 1] + ', so ' : ''}${pick.size} mm² (${pick.vd.volts} V, ${pick.vd.pct}%).`);
  else if (sz) why.push(`No size up to 120 mm² does it over ${L} m. Shorten the run or split the load.`);
  // v0.36.2: a thick single cable can often be 2 thinner ones per pole (easier to bend and crimp).
  let par2 = null;
  if (pick && pick.size >= 70 && f) {
    const amps = DC_AMPS[tbl.amps] ? DC_AMPS[tbl.amps].amps : DC_AMPS.xlpe90.amps;
    for (const s2 of [16, 25, 35, 50, 70]) { const rate = 2 * amps[s2] * PAR_CG[2] * (derate || 1); const vd2 = dcVoltDrop({ current: I, length: L, csa: 2 * s2, temp: 70, volts: baseVolts || volts }); if (rate >= f.A - 1e-9 && vd2 && vd2.pct <= Number(pct) + 1e-9) { par2 = { size: s2, amps: r1(rate), vd: vd2 }; break; } }
    if (par2) why.push(`Or 2 × ${par2.size} mm² per pole: rated ${par2.amps} A together (× ${PAR_CG[2]} for touching, Table 4C1), drop ${par2.vd.pct}%.`);
  }
  return { id, name, kind, current: r2(I), peak: r2(Ipk), length: L, pct: Number(pct), need, fuse: f, tableNeed, size: pick ? pick.size : null, vd: pick ? pick.vd : null, par2, ok: !!(pick && f), why: why.join(' '), rows: sz ? sz.rows : [] };
}

export function planDC(o0 = {}) {
  const o = { ...PLAN_DEFAULTS, ...o0 };
  const V = [12, 24, 48].includes(num(o.volts)) ? num(o.volts) : 12;
  const chem = CHEMS[o.chem] ? o.chem : 'lifepo4'; const C = CHEMS[chem];
  const dod = Math.min(1, Math.max(0.1, num(o.dod, C.dod * 100) / 100));
  const days = Math.max(0.25, num(o.days, 1));
  const cab = PLAN_CABLES[o.cable] ? o.cable : 'tri90'; const tcab = cab === 'pvc70' ? 70 : 90;
  const amb = Number(o.ambient) || 30; const ca = CA[tcab][amb] ?? 1; const cg = o.install === 'bundled' ? BUNDLE_CG : 1;
  const derate = r2(ca * cg);
  const mainPct = num(o.mainPct, 2);
  const vmax = maxChargeV(chem, V);
  const common = { volts: V, chem, cable: cab, derate, vmax };
  const warnings = []; const notes = [];

  // ---- loads ----
  const loads = (o.loads || []).filter((l) => l && (num(l.value) > 0)).map((l, i) => {
    const ac = !!l.ac; const val = num(l.value); const unitA = !ac && l.unit === 'A';
    const w = unitA ? val * V : val; const hours = num(l.hours);
    const pkW = num(l.peak) > 0 ? (unitA ? num(l.peak) * V : num(l.peak)) : w;
    const wh = ac ? (w * hours) / INV_EFF : w * hours;
    const out = { i, name: l.name || `Load ${i + 1}`, ac, w: r1(w), peakW: r1(pkW), hours, wh: r1(wh), ah: r2(wh / V), lighting: !!l.lighting };
    if (!ac) {
      out.current = r2(w / V); out.peak = r2(pkW / V);
      out.run = num(l.length) > 0 ? sizeRun({ ...common, id: 'load' + i, name: out.name, current: out.current, peak: out.peak, length: l.length, pct: l.lighting ? 10 : 3, kind: 'load', fam: V > 12 && Math.max(num(out.current), num(out.peak)) * 1.25 <= 63 ? 'mcbdc' : null }) : null;
    }
    return out;
  });
  const dcLoads = loads.filter((l) => !l.ac), acLoads = loads.filter((l) => l.ac);
  const dcWh = dcLoads.reduce((a, l) => a + l.wh, 0), acWh = acLoads.reduce((a, l) => a + l.wh, 0);
  // v0.35: energy through the inverter. AC loads (already ÷ 90%), or a typed kWh a day of 230 V use (÷ 90%),
  // plus the inverter's own idle (no-load) draw while it is switched on. The inverter RATING is never daily use.
  const acW0 = acLoads.reduce((a, l) => a + l.w, 0);
  const invW0 = num(o.invW) || (acW0 ? up(INVERTER_SIZES, acW0 * 1.25) : 0) || 0;
  const acKwhWh = num(o.acKwh) > 0 ? (num(o.acKwh) * 1000) / INV_EFF : 0;
  const idleW = invW0 ? (num(o.invIdle) > 0 ? num(o.invIdle) : Math.max(8, Math.round(invW0 * 0.008))) : 0;
  const idleH = invW0 ? (o.invHours !== undefined && o.invHours !== '' ? Math.min(24, Math.max(0, num(o.invHours))) : 24) : 0;
  const idleWh = idleW * idleH;
  const invNoUse = !!invW0 && !acWh && !acKwhWh;
  const acAll = acWh + acKwhWh + idleWh, tot = dcWh + acAll;
  const daily = { wh: r1(tot), dcWh: r1(dcWh), acWh: r1(acAll), acLoadsWh: r1(acWh), acKwhWh: r1(acKwhWh), idleW, idleH, idleWh: r1(idleWh), invNoUse, ah: r1(tot / V) };

  // ---- battery ----
  const needAh = r1((daily.ah * days) / dod);
  // v0.35: battery size can be typed in kWh (battKwh) instead of Ah.
  const fitted = num(o.battAh) || (num(o.battKwh) ? ahOfKwh(o.battKwh, chem, V) : 0);
  const battery = { chem, label: C.label, dod, days, needAh, suggestAh: up(BATTERY_AH, needAh), fittedAh: fitted || null,
    noLoads: !(daily.ah > 0) || (!dcWh && invNoUse), invNoUse, fittedDays: fitted && daily.ah ? r1((fitted * dod) / daily.ah) : null, ok: fitted ? fitted >= needAh - 0.05 : null };
  battery.vmax = vmax; battery.faultKA = faultKA(chem, fitted || battery.suggestAh || needAh, o.battIscKA); battery.faultTyped = num(o.battIscKA) > 0;
  battery.nomV = nominalV(chem, V); battery.kwh = kwhOf(fitted || battery.suggestAh || needAh, chem, V); battery.needKwh = kwhOf(needAh, chem, V); battery.suggestKwh = battery.suggestAh ? kwhOf(battery.suggestAh, chem, V) : null;
  battery.why = `${daily.wh} Wh a day ÷ ${V} V = ${daily.ah} Ah a day. × ${days} day${days === 1 ? '' : 's'} with no charging ÷ ${Math.round(dod * 100)}% usable = ${needAh} Ah at ${V} V (${battery.needKwh} kWh at ${battery.nomV} V nominal).` +
    (invNoUse && !dcWh ? ' Add what the inverter runs (or kWh a day) to see how long the battery lasts.' : !(daily.ah > 0) ? ' No loads entered yet. Add loads to see how long it lasts.' : fitted ? ` Your ${fitted} Ah (${kwhOf(fitted, chem, V)} kWh) gives about ${battery.fittedDays} day${battery.fittedDays === 1 ? '' : 's'}${battery.ok ? '.' : ' — a bit short of what you asked for.'}` : ` Nearest common size: ${battery.suggestAh ? battery.suggestAh + ' Ah (' + kwhOf(battery.suggestAh, chem, V) + ' kWh)' : 'over ' + BATTERY_AH[BATTERY_AH.length - 1] + ' Ah'}.`);

  // ---- inverter ----
  const acW = acLoads.reduce((a, l) => a + l.w, 0);
  const invSuggest = acW ? up(INVERTER_SIZES, acW * 1.25) : null;
  const invW = num(o.invW) || invSuggest || 0;
  let inverter = null;
  if (invW) {
    const vlow = (C.low * V) / 12;
    // Design current = W ÷ (low battery V × 90% efficiency), capped at the inverter's own max battery current if typed.
    const Icalc = r1(invW / (vlow * INV_EFF)); const invMaxA = num(o.invMaxA);
    const I = invMaxA > 0 ? Math.min(Icalc, invMaxA) : Icalc;
    const run = sizeRun({ ...common, id: 'inverter', name: 'Inverter', current: I, length: o.invLen, pct: mainPct, kind: 'inverter' });
    const isoA = run.fuse ? up(ISOLATOR_SIZES, run.fuse.A) : null;
    inverter = { isoA, w: invW, acW: r1(acW), suggest: invSuggest, current: I, calcCurrent: Icalc, maxA: invMaxA || null, capped: invMaxA > 0 && invMaxA < Icalc, vlow: r2(vlow), run, small: acW && invW < acW * 1.25,
      why: `${acW ? `The 230 V loads add up to ${r1(acW)} W; with 25% headroom that\u2019s ${r1(acW * 1.25)} W, so ${invSuggest ?? 'over 5000'} W.` : 'No 230 V loads listed.'}${num(o.invW) ? ` You\u2019ve set ${invW} W.` : ''} DC current at full output: ${invW} W ÷ (${r2(vlow)} V low battery × ${INV_EFF} efficiency) = ${Icalc} A.${invMaxA > 0 ? (invMaxA < Icalc ? ` Your inverter\u2019s max battery current is ${invMaxA} A, so it can\u2019t draw more: design current ${I} A.` : ` Its max battery current (${invMaxA} A) is above that, so ${I} A it is.`) : ' Type the inverter\u2019s max battery current (data sheet) to use that instead if it\u2019s lower.'} The cable and fuse are sized for the inverter\u2019s full rating, not just today\u2019s loads.`,
      surge: 'Motors, pumps, compressors and some chargers take 2–3 × their running power for a moment: check the inverter\u2019s peak (surge) rating covers it. Use a pure sine wave inverter.' };
    if (inverter.small) warnings.push(`Inverter ${invW} W is less than the 230 V loads + 25% (${r1(acW * 1.25)} W).`);
  }

  // ---- solar / MPPT ----
  const solarW = num(o.solarW); let solar = null;
  if (solarW) {
    const minA = r1(solarW / V); const needA = r2((solarW / V) * 1.25);
    // v0.7: optional "I already have one" controller size (blank = pick one, as before).
    const mpptHave = num(o.mpptA); const mpptPick = up(MPPT_SIZES, needA);
    const mppt = mpptHave || mpptPick;
    if (mpptHave && mpptHave < needA) warnings.push(`Solar: your ${mpptHave} A controller is smaller than the ${needA} A worked out (solar W ÷ battery V × 1.25). It will clip on the best days; ${mpptPick ?? 'a bigger'} A would catch it all.`);
    const panels = Math.max(1, Math.round(num(o.panels, 1)));
    const voc = num(o.panelVoc), vmp = num(o.panelVmp), isc = num(o.panelIsc); const mpptV = num(o.mpptV, 100);
    // v0.35: layout choice. Old plans (no pvLayout) keep working: a typed series count = 'custom'.
    const layout = ['auto', 'series', 'parallel', 'custom'].includes(o.pvLayout) ? o.pvLayout : (num(o.series) ? 'custom' : 'auto');
    let series = layout === 'series' ? panels : layout === 'parallel' ? 1 : layout === 'custom' ? Math.round(num(o.series)) : 0; let pv = null; let seriesAuto = false;
    if (series > panels) series = panels;
    if (voc) {
      if (!series) { seriesAuto = true; series = 1; for (let s = panels; s >= 1; s--) { const cv = coldVoc({ n: s, voc, coefPct: o.coef, tmin: o.tmin }); if (panels % s === 0 && cv <= mpptV * 0.95) { series = s; break; } } }
      const strings = Math.max(1, Math.round(panels / series));
      pv = { series, strings, seriesAuto, ...pvString({ n: series, voc, vmp: vmp || voc * 0.82, isc: isc || null, imp: isc ? isc * 0.94 : null, coefPct: o.coef, tmin: o.tmin, invMax: mpptV, length: o.pvLen, targetPct: 3, temp: 70, strings, cable: 'xlpe90' }) };
      pv.hotVmpLow = vmp ? r1(series * vmp * (1 + (-0.35 / 100) * (70 - 25))) : null;
      pv.vmpOk = pv.hotVmpLow ? pv.hotVmpLow >= (C.charge * V) / 12 + 5 : null;
      pv.layout = layout;
      // v0.35: with strings in parallel the cable from the join (combiner) to the controller carries
      // every string, so size it for strings × Imp (and 1.25 × strings × Isc), not one string.
      if (strings > 1 && pv.vstring && isc) {
        const iw = isc * 0.94 * strings; pv.cableAmps = r2(1.25 * isc * strings);
        const need = pv.fuse && pv.fuse.needed && pv.fuse.fuse ? Math.max(pv.cableAmps, pv.fuse.fuse) : pv.cableAmps;
        pv.size = dcCableSize({ current: iw, length: o.pvLen, volts: pv.vstring, targetPct: 3, temp: 70, needAmps: need, cable: 'xlpe90', minSize: 4 }); pv.needAmps = need; pv.combined = true;
      }
      if (pv.vocOk === false) warnings.push(`Solar: cold-morning Voc ${pv.cold} V is over the controller\u2019s ${mpptV} V.`);
      else if (pv.near) notes.push(`Solar: cold-morning Voc ${pv.cold} V is within 5% of the controller\u2019s ${mpptV} V. Leave more margin if the site gets colder than ${o.tmin} °C.`);
      if (pv.vmpOk === false) warnings.push('Solar: the string voltage on a hot day may be too close to the battery voltage for the MPPT to charge well. Put more panels in series (if the cold Voc allows).');
    }
    const run = sizeRun({ ...common, id: 'mppt', name: 'MPPT to battery', current: mppt || needA, length: o.chargeLen, pct: mainPct, kind: 'charge' });
    // v0.35: PV cable volt drop, panels → controller, shown next to its size.
    const pvPick = pv && pv.size && pv.size.pick;
    const pvDrop = pvPick ? { size: pvPick.size, volts: pvPick.vd.volts, pct: pvPick.vd.pct, limit: 3, vstring: pv.vstring, current: r2(pv.strings * (isc ? isc * 0.94 : 0)), combined: !!pv.combined } : null;
    solar = { w: solarW, minA, needA, mppt, mpptPick, mpptHave: mpptHave || null, mpptV, panels, pv, run, pvDrop, layout,
      summerWh: Math.round(solarW * 4 * 0.8), winterWh: Math.round(solarW * 0.7 * 0.8),
      why: `${solarW} W ÷ ${V} V = ${minA} A; × 1.25 margin = ${needA} A, so a ${mpptPick ?? 'over 100'} A controller${mpptHave ? ` (you\u2019ve set ${mpptHave} A)` : ''}.${up(MPPT_SIZES, minA) && up(MPPT_SIZES, minA) !== mpptPick ? ` (A ${up(MPPT_SIZES, minA)} A one would work but clip on the best days.)` : ''}` };
  }

  // ---- DC-DC (alternator) ----
  const dcdcA = num(o.dcdcA); const altA = num(o.altA); const vehV = num(o.vehV, 12);
  const battAhForCharge = fitted || battery.suggestAh || needAh;
  const battLimit = battAhForCharge * C.chargeC;
  const altLimit = (altA || ALT_DEFAULT) * ALT_SHARE_ADVISE;
  const dcdcSuggest = [...DCDC_SIZES].reverse().find((s) => s <= Math.min(battLimit, altLimit)) || DCDC_SIZES[0];
  let dcdc = null;
  if (dcdcA) {
    const inI = r1((dcdcA * (C.charge * V) / 12) / (vehV * (13 / 12) * INV_EFF));
    const inRun = sizeRun({ ...common, id: 'dcdcIn', name: 'Starter battery to DC-DC', current: inI, length: o.dcdcLen, volts: vehV, pct: 5, kind: 'charge' });
    const outRun = sizeRun({ ...common, id: 'dcdcOut', name: 'DC-DC to battery', current: dcdcA, length: o.chargeLen, pct: mainPct, kind: 'charge' });
    const altRated = altA || ALT_DEFAULT; const altShare = r2(inI / altRated);
    const altBad = altShare > ALT_SHARE_WARN + 1e-9;
    if (altBad) warnings.push(`DC-DC: it draws about ${inI} A from the alternator, ${Math.round(altShare * 100)}% of its ${altA ? altA + ' A' : 'assumed ' + ALT_DEFAULT + ' A'} rating (over half).`);
    else if (altShare > ALT_SHARE_ADVISE + 1e-9) notes.push(`DC-DC: it draws about ${inI} A, ${Math.round(altShare * 100)}% of the ${altA ? altA + ' A' : 'assumed ' + ALT_DEFAULT + ' A'} alternator. That\u2019s OK for most vans, but check the alternator\u2019s rating on its label or the handbook.`);
    const smart = !!o.smartAlt && o.smartAlt !== '0';
    const trigger = smart ? { size: TRIGGER.size, fuse: pickFuse(TRIGGER.fuse, 'blade'), length: num(o.trigLen, 3),
      why: 'Euro 6 (and most newer) vans have a smart alternator: its voltage drops while you drive, so the DC-DC charger can\u2019t tell the engine is running from the voltage alone. Run a thin wire from an ignition-switched live (or the alternator D+ terminal) to the charger\u2019s ignition / trigger input, fused at the feed end. Turn on the charger\u2019s smart-alternator mode.' } : null;
    dcdc = { a: dcdcA, inI, inRun, outRun, suggest: dcdcSuggest, altRated, altAssumed: !altA, altShare, altBad, smart, trigger, tooBig: dcdcA > Math.min(battLimit, altLimit) + 1e-9 || altBad,
      why: `About ${inI} A from the starter battery to give ${dcdcA} A at ${r1((C.charge * V) / 12)} V (${INV_EFF * 100}% efficient, ${vehV} V side at about ${r1(vehV * 13 / 12)} V running). Fuse it at both ends. Input cable sized for 5% drop (the charger makes the voltage back up; check the maker\u2019s cable table).` };
  }
  const dcdcAdvice = `Suggested DC-DC: ${dcdcSuggest} A — no more than about ${Math.round(C.chargeC * 100)}% of the battery (${Math.round(battLimit)} A) and about a quarter of the alternator (${altA ? altA + ' A' : 'assumed 120 A'}) = ${r1(altLimit)} A. Euro 6 vans with a smart alternator need a DC-DC with a smart-alternator / ignition wire input.`;

  // ---- shore (mains) charger ----
  const shoreA = num(o.shoreA); let shore = null;
  const shoreSuggest = up(CHARGER_SIZES, battAhForCharge * Math.min(C.chargeC, 0.2)) || CHARGER_SIZES[0];
  if (shoreA) shore = { a: shoreA, suggest: shoreSuggest, run: sizeRun({ ...common, id: 'shore', name: 'Mains charger to battery', current: shoreA, length: o.chargeLen, pct: mainPct, kind: 'charge' }) };

  // ---- fuse box for the DC loads ----
  let fuseBox = null;
  if (dcLoads.length) {
    const I = r2(dcLoads.reduce((a, l) => a + l.peak, 0));
    const run = sizeRun({ ...common, id: 'fusebox', name: V > 12 ? 'Busbar to DC breaker board' : 'Busbar to fuse box', current: I, length: o.fuseBoxLen, pct: 1, kind: 'charge' });
    // v0.36.3c: blade fuse boxes are 12 V only; at 24 / 48 V it's a DC breaker board.
    const breakers = V > 12; const ways = up(FUSEBOX_WAYS, dcLoads.length + 2) || dcLoads.length + 2;
    fuseBox = { current: I, ways, run, breakers, label: breakers ? 'DC breaker board' : 'Fuse box', sub: breakers ? `${ways}-way DC breakers` : `${ways}-way blade`,
      why: `${breakers ? `Blade fuse boxes are for 12 V only, so at ${V} V use a DC breaker board (DC-rated, 2-pole MCBs). ` : ''}All the DC loads on at once (peaks): ${I} A. Feed sized for 1% so the loads get most of their volt-drop budget.` };
  }

  // ---- main battery cable, fuse, isolator, shunt, busbars ----
  const discharge = r1((inverter ? inverter.current : 0) + dcLoads.reduce((a, l) => a + l.peak, 0));
  const invChargeA = inverter ? (num(o.invChargeA) || inverter.maxA || 0) : 0; // hybrid / inverter-charger: its max battery current charges too
  const charge = r2((solar ? solar.mppt || solar.needA : 0) + (dcdc ? dcdc.a : 0) + (shore ? shore.a : 0) + invChargeA);
  const Imain = Math.max(discharge, charge);
  const intro = `Biggest current: ${discharge >= charge ? `everything on at once = ${discharge} A (${inverter ? 'inverter' : ''}${inverter && dcLoads.length ? ' + ' : ''}${dcLoads.length ? 'DC loads' : ''})` : `all chargers at once = ${charge} A`}.`;
  // v0.36.3: with small fuses now allowed, keep the main cable at least as thick as the fuse box feed it supplies.
  // v0.36.3b: never under 10 mm² for the battery main (was 6) (Matthew's choice), nor under the fuse box feed.
  const MAIN_MIN = 10; const feedMin = fuseBox && fuseBox.run && fuseBox.run.size ? fuseBox.run.size : 0;
  const mainMin = Math.max(MAIN_MIN, feedMin);
  const main = Imain ? sizeRun({ ...common, id: 'main', name: 'Battery to busbar (main)', intro, current: Imain, length: o.mainLen, pct: mainPct, kind: 'main', minSize: mainMin, ka: chem === 'lifepo4' ? battery.faultKA || 0 : 0 }) : null;
  if (main) main.why = main.why +
    (chem === 'lifepo4' ? ` Lithium batteries can give a huge short-circuit current (about ${battery.faultKA ?? '?'} kA here${battery.faultTyped ? ', your figure' : ', ⚠ a rough 20 × Ah estimate'}), so the main protection must break more than that: Class T, an NH DC fuse or a DC MCCB, not MEGA / ANL (about 2 kA). It must also be DC-rated above ${vmax} V (the battery\u2019s max charge voltage). Fit it as close to the battery positive as you can.` : ' Check the fuse\u2019s breaking capacity is above the battery\u2019s short-circuit current. Fit it as close to the battery positive as you can.');
  const mainFuseA = main && main.fuse ? main.fuse.A : Imain * 1.25;
  // v0.36.3: say so when the fuse, not the current or volt drop, sets the main cable size.
  if (main && main.fuse && main.size) {
    const byLoad = dcCableSize({ current: Imain, length: num(o.mainLen), volts: V, targetPct: mainPct, temp: 70, needAmps: r2(Imain * 1.25 / (derate || 1)), cable: (PLAN_CABLES[cab] || PLAN_CABLES.tri90).amps });
    const loadSize = byLoad && byLoad.pick ? byLoad.pick.size : 0;
    if (loadSize && loadSize < main.size) main.why += mainMin >= main.size && feedMin < main.size ? ` Minimum ${MAIN_MIN} mm² for a battery main cable; the load alone needs ${loadSize} mm².` : mainMin >= main.size ? ` Kept at ${main.size} mm², the same as the ${fuseBox.breakers ? 'DC breaker board' : 'fuse box'} feed it supplies (the load alone would need about ${loadSize} mm²).` : ` The cable is ${main.size} mm² because it must carry the ${main.fuse.A} A fuse, not the ${r1(Imain)} A load (the load alone would need about ${loadSize} mm²).`;
    if (main.fuse.fam === 'classT' && main.fuse.A < 100) main.why += ` Class T fuses come from 15 A (e.g. Bussmann JJN, 160 V DC, 20 kA). Under 100 A they use a different, smaller holder, so match the holder to the fuse.`;
  }
  const shunt = Imain ? { a: up(SHUNT_SIZES, mainFuseA), why: `At least the main fuse (${mainFuseA} A), so ${up(SHUNT_SIZES, mainFuseA)} A. It goes in the battery negative: nothing else on the battery negative, everything else on the negative busbar side.` } : null;
  const fitFuseA = num(o.fitFuseA); const protA = fitFuseA || mainFuseA;
  const isolator = Imain ? { a: up(ISOLATOR_SIZES, protA), dcV: vmax, poles: V >= 48 ? 2 : 1, why: `Continuous rating at least the ${fitFuseA ? 'fitted' : 'main'} fuse or breaker (${protA} A), so it can\u2019t be overloaded while the fuse holds. DC-rated above ${vmax} V (the battery\u2019s max charge voltage)${V >= 48 ? ', double-pole (breaks + and −)' : '; double-pole breaks + and − (single-pole on the positive is usual in vans)'}. After the main fuse.` } : null;
  const posStuds = [inverter, solar, dcdc, shore, fuseBox].filter(Boolean).length + 1;
  const busbar = Imain ? { a: up(BUSBAR_SIZES, mainFuseA), pos: posStuds, neg: posStuds + 1, why: `Rated at least the main fuse (${mainFuseA} A). ${posStuds} studs on the positive (main feed + ${posStuds - 1} circuits), ${posStuds + 1} on the negative (+ the chassis bond), plus spares.` } : null;
  const bmsA = num(o.bmsA);
  const invLimit = inverter ? inverter.current : 0;
  if (bmsA && (discharge > bmsA || invLimit > bmsA || invChargeA > bmsA)) warnings.push(`BMS: the battery\u2019s BMS is rated ${bmsA} A but ${discharge > bmsA ? `everything on at once is ${discharge} A` : `the inverter can draw ${Math.max(invLimit, invChargeA)} A`}. Set the inverter\u2019s max charge and discharge current to ${bmsA} A or less (in its battery settings)${solar || dcdc || shore ? ', keep all chargers together under it,' : ''} or fit a battery / BMS rated for more. Otherwise the BMS will cut out under load.`);
  else if (!bmsA && discharge) notes.push(`Check the battery\u2019s BMS continuous discharge rating is at least ${Math.ceil(discharge)} A (everything on at once).`);
  const chargeTotal = charge; const chargeMax = r1(battAhForCharge * C.chargeC);
  if (chargeTotal > chargeMax) warnings.push(`Charge rate: all chargers at once${invChargeA ? ` (including the inverter charging at ${invChargeA} A)` : ''} = ${chargeTotal} A, more than about ${C.chargeC} C for this battery (${chargeMax} A): set the charge current limits lower, or check the battery\u2019s max charge current.`);
  if (battery.ok === false) warnings.push(`Battery: ${fitted} Ah is short of the ${needAh} Ah worked out for ${days} day${days === 1 ? '' : 's'}.`);
  if (chem === 'lifepo4') notes.push('LiFePO4 must not be charged below 0 °C unless it has a built-in heater or low-temperature cut-off: worth it in a van used in winter.');
  const chassis = { size: dcdc && dcdc.inRun.size ? Math.max(dcdc.inRun.size, 16) : 16,
    why: dcdc ? 'The negative busbar is bonded to the vehicle chassis at a clean, bare, protected point. The alternator current comes back through it, so it\u2019s at least the size of the DC-DC input cable (16 mm² minimum here).' : 'Bond the negative busbar to the vehicle chassis at one clean point (16 mm² here; use the size the DC-DC or inverter maker asks for).' };

  // ---- v0.36.2: fitted kit check (all optional) ----
  const fit = { fuseA: fitFuseA || null, fuseV: num(o.fitFuseV) || null, fuseKA: num(o.fitFuseKA) || null, isoA: num(o.fitIsoA) || null, isoV: num(o.fitIsoV) || null, cable: num(o.fitCable) || null, par: Math.max(1, Math.min(3, Math.round(num(o.fitPar, 1)))), makerMin: num(o.makerMin) || null, breaker: !!o.battBreaker && o.battBreaker !== '0', checks: [] };
  const chk = (ok, text) => { fit.checks.push({ ok, text }); if (ok === false) warnings.push(text); };
  if (main) {
    const lim = bmsA ? Math.min(Imain, bmsA) : Imain; const isoA = fit.isoA || (isolator && isolator.a);
    const amps = (DC_AMPS[PLAN_CABLES[cab].amps] || DC_AMPS.xlpe90).amps;
    const cabRate = fit.cable && amps[fit.cable] ? r1(amps[fit.cable] * fit.par * (PAR_CG[fit.par] || 1) * derate) : null;
    const cabText = fit.cable ? `${fit.par > 1 ? fit.par + ' × ' : ''}${fit.cable} mm²` : null;
    if (fit.fuseA) {
      chk(fit.fuseA >= lim - 1e-9, fit.fuseA >= lim - 1e-9 ? `Fitted ${fit.fuseA} A ${fit.breaker ? 'battery breaker' : 'fuse / breaker'} is at least the ${r1(lim)} A that can flow${bmsA && bmsA < Imain ? ' (BMS limit)' : ''}.` : `Fitted ${fit.fuseA} A main fuse / breaker is below the ${r1(lim)} A that can flow: it will blow or trip. Fit a bigger one, or set the inverter limit lower.`);
      if (isoA) chk(fit.fuseA <= isoA + 1e-9, fit.fuseA <= isoA + 1e-9 ? `Isolator ${isoA} A ≥ the ${fit.fuseA} A fuse / breaker.` : `Isolator ${isoA} A is below the ${fit.fuseA} A fuse / breaker: the isolator could overload before the fuse acts. Fit an isolator rated ${up(ISOLATOR_SIZES, fit.fuseA) ?? 'over ' + MAX_ISO} A or more, or a smaller fuse (not below ${r1(lim)} A).`);
      if (cabRate) chk(fit.fuseA <= cabRate + 1e-9, fit.fuseA <= cabRate + 1e-9 ? `Cable ${cabText} is rated ${cabRate} A ≥ the ${fit.fuseA} A fuse / breaker.` : `Cable ${cabText} is rated only ${cabRate} A${fit.par > 1 ? ` (${fit.par} × ${amps[fit.cable]} A × ${PAR_CG[fit.par]} for touching${derate < 1 ? ` × ${derate}` : ''})` : ''}, below the ${fit.fuseA} A fuse / breaker: the fuse wouldn\u2019t protect it. Fit a smaller fuse or breaker (${r1(lim)}–${Math.floor(cabRate)} A${(() => { const f = main.fuse && FUSES[main.fuse.fam]; const ok = f ? f.sizes.filter((x) => x >= lim - 1e-9 && x <= cabRate + 1e-9) : []; return ok.length ? `, e.g. ${ok[ok.length - 1]} A ${f.label}` : ''; })()}) or bigger cable.`);
      if (fit.fuseV) chk(fit.fuseV >= vmax - 1e-9, fit.fuseV >= vmax - 1e-9 ? `Fuse / breaker DC rating ${fit.fuseV} V ≥ ${vmax} V max charge voltage.` : `Fuse / breaker is only DC-rated ${fit.fuseV} V, below the battery\u2019s ${vmax} V max charge voltage: it may not break the arc. Fit one DC-rated above ${vmax} V.`);
      else fit.checks.push({ ok: null, text: `Check the fuse / breaker is DC-rated above ${vmax} V (on its label or data sheet).` });
      if (chem === 'lifepo4' && battery.faultKA) { if (fit.fuseKA) chk(fit.fuseKA >= battery.faultKA - 1e-9, fit.fuseKA >= battery.faultKA - 1e-9 ? `Breaking capacity ${fit.fuseKA} kA ≥ about ${battery.faultKA} kA fault current.` : `Breaking capacity ${fit.fuseKA} kA is below the battery\u2019s fault current (about ${battery.faultKA} kA): use Class T, NH DC or a DC MCCB rated for it.`);
        else fit.checks.push({ ok: null, text: `Check its DC breaking capacity is above about ${battery.faultKA} kA (the battery\u2019s fault current).` }); }
    }
    if (fit.isoV) chk(fit.isoV >= vmax - 1e-9, fit.isoV >= vmax - 1e-9 ? `Isolator DC rating ${fit.isoV} V ≥ ${vmax} V.` : `Isolator is only DC-rated ${fit.isoV} V, below the battery\u2019s ${vmax} V max charge voltage. Fit one DC-rated above ${vmax} V.`);
    else if (vmax > ISO_DCV) fit.checks.push({ ok: null, text: `Many battery isolators are only 32 or 48 V DC: yours must be DC-rated above ${vmax} V.` });
    if (fit.cable && fit.makerMin) chk(fit.cable * fit.par >= fit.makerMin - 1e-9, fit.cable * fit.par >= fit.makerMin - 1e-9 ? `${cabText} (${fit.cable * fit.par} mm² copper) meets the maker\u2019s ${fit.makerMin} mm² minimum.` : `${cabText} (${fit.cable * fit.par} mm² copper) is under the maker\u2019s ${fit.makerMin} mm² minimum.`);
    if (fit.cable && !amps[fit.cable]) chk(false, `Cable ${fit.cable} mm² isn\u2019t a standard size Zs Pro knows (${Object.keys(amps).join(', ')} mm²).`);
    fit.cableRate = cabRate; fit.cableText = cabText;
  }
  // ---- v0.36.2: volt drop battery → inverter (main + inverter cable) at the design current ----
  let invDrop = null;
  if (inverter && main && num(o.mainLen) > 0 && num(o.invLen) > 0) {
    const mcsa = fit.cable && fit.cable * fit.par || main.size, icsa = inverter.run.size;
    if (mcsa && icsa) {
      const a = dcVoltDrop({ current: inverter.current, length: o.mainLen, csa: mcsa, temp: 70, volts: V }), b = dcVoltDrop({ current: inverter.current, length: o.invLen, csa: icsa, temp: 70, volts: V });
      const volts = r2(a.volts + b.volts), pct = r2((volts / V) * 100); const cut = num(o.invCutV) || null; const atInv = r2(inverter.vlow - volts);
      invDrop = { volts, pct, cut, atInv, ok: pct <= 3 + 1e-9 && (!cut || atInv >= cut) };
      if (pct > 3) warnings.push(`Volt drop battery to inverter: ${volts} V (${pct}%) at ${inverter.current} A, over the usual 1–3%: the inverter will hit its low-voltage cut-off early. Use thicker or shorter cable.`);
      else if (cut && atInv < cut) warnings.push(`Volt drop battery to inverter: ${volts} V at ${inverter.current} A. With the battery at ${inverter.vlow} V the inverter sees ${atInv} V, below its ${cut} V low-voltage cut-off: thicker or shorter cable, or set the cut-off lower if the battery maker allows.`);
      else notes.push(`Volt drop battery to inverter: ${volts} V (${pct}%) at ${inverter.current} A, within the usual 1–3%${cut ? `; the inverter sees ${atInv} V at a ${inverter.vlow} V battery, above its ${cut} V cut-off` : ''}.`);
    }
  }
  if (chem === 'lifepo4' && main && main.fuse && ['mega', 'anl', 'midi'].includes(main.fuse.fam) && battery.faultKA > 2) warnings.push(`Main fuse: a ${main.fuse.label} breaks only about 2 kA, less than this battery\u2019s fault current (about ${battery.faultKA} kA). Use Class T, NH DC or a DC MCCB.`);
  for (const r of [main, inverter && inverter.run].filter(Boolean)) if (r.fuse && r.fuse.dcV < vmax) warnings.push(`${r.name}: a ${r.fuse.label} is DC-rated about ${r.fuse.dcV} V, below the ${vmax} V max charge voltage.`);

  // ---- runs, cables and the parts list ----
  const runs = [main, fuseBox && fuseBox.run, inverter && inverter.run, solar && solar.run, dcdc && dcdc.inRun, dcdc && dcdc.outRun, shore && shore.run, ...dcLoads.map((l) => l.run)].filter(Boolean);
  // v0.35.1: over-limit setups (e.g. 12 V + 5000 W inverter) say so, in red, instead of a blank size.
  const fix = inverter ? `${UPV} or fit a smaller inverter` : UPV;
  for (const r of runs) {
    if (!r.fuse && r.need > MAX_FUSE) warnings.push(`${r.name}: ${r.need} A is over ${MAX_FUSE} A, no standard fuse: ${fix}.`);
    else if (!r.size && r.current > 0 && r.length > 0) warnings.push(`${r.name}: ${r.current} A needs more than ${MAX_CABLE} mm² cable: ${fix}, or shorten the run.`);
  }
  if (isolator && !isolator.a) warnings.push(`Isolator: ${r1(mainFuseA)} A is over ${MAX_ISO} A, no standard isolator: ${fix}.`);
  if (shunt && !shunt.a) warnings.push(`Shunt: ${r1(mainFuseA)} A is over the biggest ${SHUNT_SIZES[SHUNT_SIZES.length - 1]} A shunt: ${fix}.`);
  if (busbar && !busbar.a) warnings.push(`Busbar: ${r1(mainFuseA)} A is over the biggest ${BUSBAR_SIZES[BUSBAR_SIZES.length - 1]} A busbar: ${fix}.`);
  if (solar && !solar.mppt) warnings.push(`Solar: ${solar.needA} A is over the biggest ${MAX_MPPT} A controller: use 2 controllers (split the panels) or ${UPV}.`);
  const profile = chargeProfile(chem, V);
  const plan = { fit, invDrop, vmax, invChargeA, lugStud: String(o.lugStud || '').trim(), profile, V, vehV, chem, cable: cab, cableLabel: PLAN_CABLES[cab].label, derate, ca, cg, ambient: amb, mainPct, loads, dcLoads, acLoads, daily, battery, inverter, solar, dcdc, dcdcAdvice, shore, shoreSuggest, fuseBox, discharge, charge, main, shunt, isolator, busbar, chassis, runs, warnings, notes };
  plan.cables = cableList(plan); plan.parts = partsList(plan, o);
  return plan;
}

// Cable shopping list: red + black for each run, length × 1.1, rounded up to 0.5 m.
export function cableList(p) {
  const out = []; const add = (type, size, colour, m, run) => { const k = `${type}|${size}|${colour}`; const e = out.find((x) => x.k === k); if (e) { e.m += m; e.runs.push(run); } else out.push({ k, type, size, colour, m, runs: [run] }); };
  for (const r of p.runs) if (r.size && r.length) { const m = r.length; add(p.cableLabel, r.size, 'red', m, r.name); add(p.cableLabel, r.size, 'black', m, r.name); }
  if (p.chassis) add(p.cableLabel, p.chassis.size, 'black', 0.5, 'Chassis bond');
  return out.map((e) => ({ ...e, m: upHalf(e.m * 1.1) }));
}

export function partsList(p, o = {}) {
  const G = { Battery: [], Charging: [], Inverter: [], Protection: [], Cables: [], Monitoring: [], Misc: [] };
  const add = (g, item, qty = 1, why = '') => G[g].push({ item, qty, why });
  const b = p.battery;
  add('Battery', `${b.label} battery, ${p.V} V ${b.fittedAh || b.suggestAh || b.needAh} Ah (${b.kwh} kWh)`, 1, b.why);
  if (p.chem !== 'lifepo4') add('Battery', 'Battery box with a vent to outside (lead/AGM give off gas when charging)', 1);
  else add('Battery', 'Battery strap / secure mounting (and low-temperature charge protection for winter)', 1);
  if (p.solar) {
    const s = p.solar; const pv = s.pv;
    add('Charging', `Solar panels, ${s.w} W total${s.panels > 1 ? ` (${s.panels} panels${pv ? `, ${pv.series} in series × ${pv.strings} string${pv.strings > 1 ? 's' : ''}` : ''})` : ''}`, 1, `About ${s.summerWh} Wh on a good summer day, ${s.winterWh} Wh in winter (UK, flat panels: ⚠ rough).`);
    add('Charging', `MPPT solar charge controller ${s.mpptV} V / ${mpptText(s)} (${p.V} V battery)`, 1, s.why + (pv && pv.cold ? ` Cold-morning Voc ${pv.cold} V ${pv.vocOk ? '≤' : '>'} ${s.mpptV} V.` : ''));
    add('Charging', `PV isolator, DC-rated ≥ ${pv && pv.cold ? Math.ceil(pv.cold) : s.mpptV} V and ≥ ${pv && pv.cableAmps ? Math.ceil(pv.cableAmps * Math.max(1, pv.strings)) + ' A' : 'the panels\u2019 short-circuit current'}`, 1, 'Lets you switch the panels off before working on the controller.');
    add('Charging', 'MC4 connectors (pairs) and a roof cable entry gland', pv ? Math.max(2, pv.strings * 2) : 2);
    if (pv && pv.fuse && pv.fuse.needed && pv.fuse.fuse) add('Protection', `${pv.fuse.fuse} A gPV string fuses + holders (+ and −)`, pv.strings * 2, pv.fuse.why);
  }
  if (p.dcdc) { add('Charging', `DC-DC (battery-to-battery) charger ${p.dcdc.a} A, ${p.vehV} → ${p.V} V${p.dcdc.smart ? ', with a smart-alternator / ignition trigger input' : ''}`, 1, p.dcdcAdvice);
    if (p.dcdc.trigger) { const t = p.dcdc.trigger; add('Charging', `Ignition / D+ trigger wire, ${t.size} mm² (red or another colour you\u2019ll recognise)`, `${upHalf(t.length * 1.1)} m`, t.why);
      add('Protection', `${t.fuse.A} A ${t.fuse.label} + add-a-fuse tap or in-line holder — trigger wire, at the ignition feed`, 1, t.why); } }
  else add('Charging', `Optional: DC-DC charger about ${p.dcdcAdvice.match(/DC-DC: (\d+)/)[1]} A to charge from the engine`, 1, p.dcdcAdvice);
  if (p.shore) add('Charging', `Mains (shore) battery charger ${p.shore.a} A`, 1, `Typical: about ${p.shoreSuggest} A for this battery. The 230 V hook-up side (inlet, RCD, consumer unit) is BS 7671 Section 721 work.`);
  if (p.inverter) {
    add('Inverter', `Pure sine inverter ${p.inverter.w} W continuous, ${p.V} V input`, 1, p.inverter.why + ' ' + p.inverter.surge);
    if (p.inverter.isoA) add('Protection', `Inverter DC isolator, ${p.V >= 48 ? 'double-pole, ' : ''}DC-rated ≥ ${p.vmax} V and ${p.inverter.isoA} A continuous`, 1, 'Lets you isolate the inverter from the busbar. At least the inverter fuse rating, and DC-rated above the battery\u2019s max charge voltage.');
    add('Inverter', '230 V outlets on the inverter output with RCD protection, earthed to the maker\u2019s instructions', 1, 'Follow the inverter maker\u2019s neutral–earth / RCD instructions.');
  }
  const fuseLine = (r, where) => r && r.fuse ? add('Protection', `${r.fuse.A} A ${r.fuse.label} + holder — ${where}`, 1, r.why) : null;
  if (p.main && p.fit && p.fit.breaker) add('Protection', `Main protection: the breaker supplied with the battery${p.fit.fuseA ? ` (${p.fit.fuseA} A)` : ''}, so no separate main fuse`, 1, `Check it is DC-rated above ${p.vmax} V and breaks more than about ${p.battery.faultKA ?? '?'} kA. If not, add a ${p.main.fuse ? p.main.fuse.A + ' A ' + p.main.fuse.label : 'Class T fuse'} at the battery positive.`);
  else if (p.main) fuseLine(p.main, `main battery fuse, at the battery positive, DC-rated ≥ ${p.vmax} V`);
  if (p.isolator) add('Protection', `Battery isolator switch, ${p.isolator.poles === 2 ? 'double-pole' : 'single- or double-pole'}, DC-rated ≥ ${p.isolator.dcV} V and ${isoText(p.fit && p.fit.isoA || p.isolator.a)} continuous`, 1, p.isolator.why);
  if (p.busbar) { add('Protection', `Positive busbar / fuse distribution ≥ ${ampsOr(p.busbar.a, BUSBAR_SIZES)}, ${p.busbar.pos}+ studs`, 1, p.busbar.why); add('Protection', `Negative busbar ≥ ${ampsOr(p.busbar.a, BUSBAR_SIZES)}, ${p.busbar.neg}+ studs`, 1, p.busbar.why); }
  if (p.inverter) fuseLine(p.inverter.run, 'inverter');
  if (p.solar) fuseLine(p.solar.run, 'MPPT to battery');
  if (p.dcdc) { if (p.dcdc.inRun.fuse) add('Protection', `${p.dcdc.inRun.fuse.A} A ${p.dcdc.inRun.fuse.label} + holder — DC-DC input, at the starter battery`, 1, p.dcdc.inRun.why); fuseLine(p.dcdc.outRun, 'DC-DC output, at the busbar'); }
  if (p.shore) fuseLine(p.shore.run, 'mains charger');
  if (p.fuseBox) {
    fuseLine(p.fuseBox.run, `feed to the ${p.fuseBox.breakers ? 'DC breaker board' : 'fuse box'}`);
    add('Protection', `${p.fuseBox.breakers ? 'DC breaker board (DC-rated 2-pole MCBs)' : 'Blade fuse box'}, ${p.fuseBox.ways}-way, rated ≥ ${p.fuseBox.run.fuse ? p.fuseBox.run.fuse.A : Math.ceil(p.fuseBox.current * 1.25)} A, with a negative bus`, 1, p.fuseBox.why);
    for (const l of p.dcLoads) if (l.run && l.run.fuse) add('Protection', `${l.run.fuse.A} A ${l.run.fuse.label} — ${l.name}`, 1, l.run.why);
  }
  for (const c of p.cables) add('Cables', `${c.size} mm² ${c.colour}, ${c.type}`, `${c.m} m`, c.runs.join(', ') + '. Big cable is often sold by the metre or in 10 m reels: a reel can work out cheaper.');
  if (p.solar) add('Cables', `${p.solar.pv && p.solar.pv.size && p.solar.pv.size.pick ? p.solar.pv.size.pick.size : 4} mm² solar PV cable (H1Z2Z2-K), red + black`, `${upHalf(num(o.pvLen, 5) * 1.1)} m each`, p.solar.pv && p.solar.pv.size && p.solar.pv.size.pick ? `Panels to the controller: drop ${p.solar.pv.size.pick.vd.pct}% at ${p.solar.pv.vstring} V.` : 'Enter the panel figures to size it; 4 mm² suits most van roofs.');
  if (p.shunt) add('Monitoring', `Battery monitor with ${ampsOr(p.shunt.a, SHUNT_SIZES)} shunt`, 1, p.shunt.why);
  // lugs: 2 conductors × 2 ends per run, plus the extra joints on the main run (fuse, isolator, shunt).
  const lugs = {};
  for (const r of p.runs) if (r.size) lugs[r.size] = (lugs[r.size] || 0) + 4 + (r.id === 'main' ? 6 : 0);
  if (p.chassis) lugs[p.chassis.size] = (lugs[p.chassis.size] || 0) + 2;
  Object.keys(lugs).map(Number).sort((a, b) => b - a).forEach((s) => add('Misc', s >= 6 ? `Tinned copper tube lugs, ${s} mm², ${p.lugStud ? p.lugStud + ' stud' : 'match your terminals (M8/M10 common)'}` : `Crimp ring terminals / bootlace ferrules, ${s} mm²`, lugs[s], 'About 2 per cable end: buy a few spare. Crimp with the right die (hydraulic or hammer crimper for big lugs).'));
  add('Misc', 'Adhesive-lined heat-shrink, red and black, to suit the lugs', 1);
  add('Misc', 'Rubber grommets / cable glands wherever cable goes through metal', 1);
  add('Misc', 'P-clips, cable ties and split conduit to support and protect the runs', 1);
  add('Misc', `Chassis bond: ${p.chassis.size} mm² black, negative busbar to chassis`, 1, p.chassis.why);
  return Object.entries(G).filter(([, v]) => v.length).map(([group, items]) => ({ group, items }));
}

export const SAFETY = [
  'This is a guide to help plan and price a system, not a design certificate. Follow the battery, charger, inverter and fuse makers\u2019 instructions: where they differ, theirs win.',
  'Fuse every positive cable at the end it\u2019s fed from (the battery or busbar), and fuse the main battery cable as close to the battery as you can. Fuses must be DC-rated with enough breaking capacity.',
  'Motor caravans: BS EN 1648-2 covers the 12 V d.c. installation. Caravans: BS EN 1648-1. The 230 V hook-up and installation in caravans and motor caravans: BS 7671 Section 721. Boats: BS EN ISO 10133 (d.c.) and BS EN ISO 13297 (a.c.).',
  'Volt drop: 3% for most loads, 10% for lighting and other non-critical loads (the usual marine rule); the battery-to-busbar run adds to every circuit, so keep it short.',
];

// Plain-text version (to share or paste into a quote).
export function planText(p, title = 'DC system plan') {
  const L = [];
  L.push(title.toUpperCase(), `${p.V} V ${p.battery.label} system. Made with Zs Pro.`, '');
  L.push(`Daily use: ${p.daily.wh} Wh (${p.daily.ah} Ah at ${p.V} V)`, `Battery: ${p.battery.why}`);
  if (p.inverter) L.push(`Inverter: ${p.inverter.w} W, ${p.inverter.current} A DC at full output`);
  if (p.solar) L.push(`Solar: ${p.solar.w} W → MPPT ${p.solar.mpptV} V / ${mpptText(p.solar)}`);
  if (p.main) L.push(`Main fuse: ${fuseText(p.main)}, main cable ${sizeText(p.main)}`);
  for (const w of p.warnings) L.push('⚠ ' + w);
  if (p.profile) { L.push('', `CHARGER SETTINGS (${p.profile.name}, ${p.V} V)`); for (const l of p.profile.lines) L.push('- ' + l); }
  L.push('', 'PARTS LIST');
  for (const g of p.parts) { L.push('', g.group.toUpperCase()); for (const it of g.items) L.push(`- ${it.item}${typeof it.qty === 'string' ? `: ${it.qty}` : it.qty !== 1 ? `  × ${it.qty}` : ''}`); }
  L.push('', 'CABLE RUNS (current, fuse, cable, volt drop)');
  for (const r of p.runs) L.push(`- ${r.name}: ${r.current} A${r.peak > r.current ? ` (${r.peak} A peak)` : ''}, ${fuseText(r)}, ${sizeText(r)} × ${r.length} m, drop ${r.vd ? r.vd.pct + '%' : 'not worked out'} (≤ ${r.pct}%)`);
  L.push('', 'NOTES'); for (const n of [...p.notes, ...SAFETY]) L.push('- ' + n);
  return L.join('\n');
}
