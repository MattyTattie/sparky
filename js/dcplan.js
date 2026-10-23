// =====================================================================
// dcplan.js — DC system planner (camper van, boat, shed, off-grid):
// loads → daily energy → battery; cable, fuse, inverter, MPPT, DC-DC,
// shore charger, shunt, isolator, busbars; and a parts list.
// Plain JS (no DOM), tested by tests/v06.test.mjs.
// =====================================================================
// ⚠ Rules of thumb (1.25 × current for fuses, DoD, charge rates, alternator
// share, fuse and part size ranges) are typical makers' / trade practice,
// written in from memory. They're a guide: the maker's instructions win.
import { DC_AMPS, dcCableSize, pvString, coldVoc } from './dc.js';

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
  lifepo4: { label: 'LiFePO4 (lithium)', dod: 0.8, low: 11.5, charge: 14.4, chargeC: 0.5, mainFuse: 'classT' },
  agm: { label: 'AGM', dod: 0.5, low: 11.0, charge: 14.4, chargeC: 0.2, mainFuse: 'mega' },
  lead: { label: 'Lead-acid (flooded)', dod: 0.5, low: 11.0, charge: 14.4, chargeC: 0.15, mainFuse: 'mega' },
};
export const INV_EFF = 0.9;
// Fuse families and the ratings makers usually sell (A). ⚠ Typical ranges.
export const FUSES = {
  blade: { label: 'blade fuse (ATO/ATC)', sizes: [1, 2, 3, 5, 7.5, 10, 15, 20, 25, 30] },
  midi: { label: 'MIDI fuse', sizes: [30, 40, 50, 60, 70, 80, 100, 125, 150, 175, 200] },
  mega: { label: 'MEGA fuse', sizes: [40, 60, 80, 100, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500] },
  anl: { label: 'ANL fuse', sizes: [35, 40, 50, 60, 80, 100, 125, 150, 175, 200, 225, 250, 300, 325, 350, 400, 500] },
  classT: { label: 'Class T fuse', sizes: [100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400] },
};
export const INVERTER_SIZES = [150, 300, 500, 600, 800, 1000, 1200, 1500, 2000, 2500, 3000, 3500, 4000, 5000];
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
  solarW: '', panels: '', panelVoc: '', panelVmp: '', panelIsc: '', series: '', coef: '-0.29', tmin: '-10', mpptV: '100', pvLen: '5',
  dcdcA: '', altA: '', vehV: '12', dcdcLen: '5', shoreA: '',
  invW: '', invLen: '1.5', mpptA: '',
  cable: 'tri90', install: 'clipped', ambient: '30', mainPct: '2', mainLen: '1', fuseBoxLen: '1', chargeLen: '1',
};

// The worked camper-van example (used for the screenshots and tests).
export const VAN_EXAMPLE = {
  ...PLAN_DEFAULTS, volts: '12', chem: 'lifepo4', dod: '80', days: '2', battAh: '200',
  loads: [quickLoad('fridge'), quickLoad('lights'), quickLoad('pump'), quickLoad('heater'), quickLoad('laptop'), quickLoad('kettle')],
  solarW: '400', panels: '2', panelVoc: '24.3', panelVmp: '20.4', panelIsc: '10.6', series: '', mpptV: '100', pvLen: '5',
  dcdcA: '30', altA: '', dcdcLen: '5', shoreA: '', invW: '1500', invLen: '1.5',
};

export function pickFuse(need, fam) {
  const f = FUSES[fam]; if (!f) return null;
  const A = up(f.sizes, need); return A == null ? null : { A, fam, label: f.label };
}
const famFor = (need, kind, chem) => {
  if (kind === 'load') return need <= 30 ? 'blade' : need <= 200 ? 'midi' : 'mega';
  if (kind === 'main') { const m = CHEMS[chem]?.mainFuse || 'mega'; if (m === 'classT' && need <= 400) return 'classT'; return need <= 500 ? 'mega' : 'anl'; }
  return need <= 125 ? 'midi' : need <= 500 ? 'mega' : 'anl';
};

// One cable run: fuse ≥ 1.25 × peak current, cable rated ≥ fuse (after the heat /
// bundling factors), volt drop at the working current ≤ target. Two-way drop (+ and −).
export function sizeRun({ id, name, intro = null, current, peak, length, volts, pct, kind = 'load', chem = 'lifepo4', cable = 'tri90', derate = 1, minSize = 0, margin = 1.25, fam = null, baseVolts = null }) {
  const I = num(current), Ipk = Math.max(I, num(peak, I)); const L = num(length);
  const need = r2(Ipk * margin);
  const f = pickFuse(need, fam || famFor(need, kind, chem));
  const tbl = PLAN_CABLES[cable] || PLAN_CABLES.tri90;
  const tableNeed = r2((f ? f.A : need) / (derate || 1));
  const sz = I > 0 && L > 0 ? dcCableSize({ current: I, length: L, volts: baseVolts || volts, targetPct: pct, temp: 70, needAmps: tableNeed, cable: tbl.amps, minSize }) : null;
  const pick = sz && sz.pick;
  const why = [];
  why.push(`${intro ?? `${r1(I)} A${Ipk > I ? ` (${r1(Ipk)} A peak)` : ''}.`} Fuse at least 1.25 × ${r1(Ipk)} A = ${r1(need)} A${f ? `, so ${f.A} A ${f.label}` : ', bigger than the fuse sizes listed'}.`);
  if (pick) why.push(`Cable must carry the ${f ? f.A : r1(need)} A fuse${derate < 1 ? ` (÷ ${r2(derate)} for heat/bundling = ${tableNeed} A from the table)` : ''} and drop no more than ${pct}% over ${L} m: ${sz.why.length ? sz.why[sz.why.length - 1] + ', so ' : ''}${pick.size} mm² (${pick.vd.volts} V, ${pick.vd.pct}%).`);
  else if (sz) why.push(`No size up to 120 mm² does it over ${L} m. Shorten the run or split the load.`);
  return { id, name, kind, current: r2(I), peak: r2(Ipk), length: L, pct: Number(pct), need, fuse: f, tableNeed, size: pick ? pick.size : null, vd: pick ? pick.vd : null, ok: !!(pick && f), why: why.join(' '), rows: sz ? sz.rows : [] };
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
  const common = { volts: V, chem, cable: cab, derate };
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
      out.run = num(l.length) > 0 ? sizeRun({ ...common, id: 'load' + i, name: out.name, current: out.current, peak: out.peak, length: l.length, pct: l.lighting ? 10 : 3, kind: 'load' }) : null;
    }
    return out;
  });
  const dcLoads = loads.filter((l) => !l.ac), acLoads = loads.filter((l) => l.ac);
  const dcWh = dcLoads.reduce((a, l) => a + l.wh, 0), acWh = acLoads.reduce((a, l) => a + l.wh, 0);
  const daily = { wh: r1(dcWh + acWh), dcWh: r1(dcWh), acWh: r1(acWh), ah: r1((dcWh + acWh) / V) };

  // ---- battery ----
  const needAh = r1((daily.ah * days) / dod);
  const fitted = num(o.battAh);
  const battery = { chem, label: C.label, dod, days, needAh, suggestAh: up(BATTERY_AH, needAh), fittedAh: fitted || null,
    fittedDays: fitted && daily.ah ? r1((fitted * dod) / daily.ah) : null, ok: fitted ? fitted >= needAh - 0.05 : null };
  battery.why = `${daily.wh} Wh a day ÷ ${V} V = ${daily.ah} Ah a day. × ${days} day${days === 1 ? '' : 's'} with no charging ÷ ${Math.round(dod * 100)}% usable = ${needAh} Ah at ${V} V.` +
    (fitted ? ` Your ${fitted} Ah gives about ${battery.fittedDays} day${battery.fittedDays === 1 ? '' : 's'}${battery.ok ? '.' : ' — a bit short of what you asked for.'}` : ` Nearest common size: ${battery.suggestAh ?? 'over ' + BATTERY_AH[BATTERY_AH.length - 1]} Ah.`);

  // ---- inverter ----
  const acW = acLoads.reduce((a, l) => a + l.w, 0);
  const invSuggest = acW ? up(INVERTER_SIZES, acW * 1.25) : null;
  const invW = num(o.invW) || invSuggest || 0;
  let inverter = null;
  if (invW) {
    const vlow = (C.low * V) / 12;
    const I = r1(invW / (vlow * INV_EFF));
    const run = sizeRun({ ...common, id: 'inverter', name: 'Inverter', current: I, length: o.invLen, pct: mainPct, kind: 'inverter' });
    inverter = { w: invW, acW: r1(acW), suggest: invSuggest, current: I, vlow: r2(vlow), run, small: acW && invW < acW * 1.25,
      why: `${acW ? `The 230 V loads add up to ${r1(acW)} W; with 25% headroom that\u2019s ${r1(acW * 1.25)} W, so ${invSuggest ?? 'over 5000'} W.` : 'No 230 V loads listed.'}${num(o.invW) ? ` You\u2019ve set ${invW} W.` : ''} DC current at full output: ${invW} W ÷ (${r2(vlow)} V low battery × ${INV_EFF} efficiency) = ${I} A. The cable and fuse are sized for the inverter\u2019s full rating, not just today\u2019s loads.`,
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
    let series = Math.round(num(o.series)); let pv = null; let seriesAuto = false;
    if (voc) {
      if (!series) { seriesAuto = true; series = 1; for (let s = panels; s >= 1; s--) { const cv = coldVoc({ n: s, voc, coefPct: o.coef, tmin: o.tmin }); if (panels % s === 0 && cv <= mpptV * 0.95) { series = s; break; } } }
      const strings = Math.max(1, Math.round(panels / series));
      pv = { series, strings, seriesAuto, ...pvString({ n: series, voc, vmp: vmp || voc * 0.82, isc: isc || null, imp: isc ? isc * 0.94 : null, coefPct: o.coef, tmin: o.tmin, invMax: mpptV, length: o.pvLen, targetPct: 3, temp: 70, strings, cable: 'xlpe90' }) };
      pv.hotVmpLow = vmp ? r1(series * vmp * (1 + (-0.35 / 100) * (70 - 25))) : null;
      pv.vmpOk = pv.hotVmpLow ? pv.hotVmpLow >= (C.charge * V) / 12 + 5 : null;
      if (pv.vocOk === false) warnings.push(`Solar: cold-morning Voc ${pv.cold} V is over the controller\u2019s ${mpptV} V.`);
      if (pv.vmpOk === false) warnings.push('Solar: the string voltage on a hot day may be too close to the battery voltage for the MPPT to charge well. Put more panels in series (if the cold Voc allows).');
    }
    const run = sizeRun({ ...common, id: 'mppt', name: 'MPPT to battery', current: mppt || needA, length: o.chargeLen, pct: mainPct, kind: 'charge' });
    solar = { w: solarW, minA, needA, mppt, mpptPick, mpptHave: mpptHave || null, mpptV, panels, pv, run,
      summerWh: Math.round(solarW * 4 * 0.8), winterWh: Math.round(solarW * 0.7 * 0.8),
      why: `${solarW} W ÷ ${V} V = ${minA} A; × 1.25 margin = ${needA} A, so a ${mpptPick ?? 'over 100'} A controller${mpptHave ? ` (you\u2019ve set ${mpptHave} A)` : ''}. (A ${up(MPPT_SIZES, minA)} A one would work but clip on the best days.)` };
  }

  // ---- DC-DC (alternator) ----
  const dcdcA = num(o.dcdcA); const altA = num(o.altA); const vehV = num(o.vehV, 12);
  const battAhForCharge = fitted || battery.suggestAh || needAh;
  const battLimit = battAhForCharge * C.chargeC;
  const altLimit = (altA || 120) * 0.25;
  const dcdcSuggest = [...DCDC_SIZES].reverse().find((s) => s <= Math.min(battLimit, altLimit)) || DCDC_SIZES[0];
  let dcdc = null;
  if (dcdcA) {
    const inI = r1((dcdcA * (C.charge * V) / 12) / (vehV * (13 / 12) * INV_EFF));
    const inRun = sizeRun({ ...common, id: 'dcdcIn', name: 'Starter battery to DC-DC', current: inI, length: o.dcdcLen, volts: vehV, pct: 5, kind: 'charge' });
    const outRun = sizeRun({ ...common, id: 'dcdcOut', name: 'DC-DC to battery', current: dcdcA, length: o.chargeLen, pct: mainPct, kind: 'charge' });
    dcdc = { a: dcdcA, inI, inRun, outRun, suggest: dcdcSuggest, tooBig: dcdcA > Math.min(battLimit, altLimit) + 1e-9,
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
    const run = sizeRun({ ...common, id: 'fusebox', name: 'Busbar to fuse box', current: I, length: o.fuseBoxLen, pct: 1, kind: 'charge' });
    fuseBox = { current: I, ways: up(FUSEBOX_WAYS, dcLoads.length + 2) || dcLoads.length + 2, run,
      why: `All the DC loads on at once (peaks): ${I} A. Feed sized for 1% so the loads get most of their volt-drop budget.` };
  }

  // ---- main battery cable, fuse, isolator, shunt, busbars ----
  const discharge = r1((inverter ? inverter.current : 0) + dcLoads.reduce((a, l) => a + l.peak, 0));
  const charge = r2((solar ? solar.mppt || solar.needA : 0) + (dcdc ? dcdc.a : 0) + (shore ? shore.a : 0));
  const Imain = Math.max(discharge, charge);
  const intro = `Biggest current: ${discharge >= charge ? `everything on at once = ${discharge} A (${inverter ? 'inverter' : ''}${inverter && dcLoads.length ? ' + ' : ''}${dcLoads.length ? 'DC loads' : ''})` : `all chargers at once = ${charge} A`}.`;
  const main = Imain ? sizeRun({ ...common, id: 'main', name: 'Battery to busbar (main)', intro, current: Imain, length: o.mainLen, pct: mainPct, kind: 'main' }) : null;
  if (main) main.why = main.why +
    (chem === 'lifepo4' ? ' Lithium batteries can give a huge short-circuit current (often well over 10 kA), so the main fuse is Class T: high breaking capacity. Fit it as close to the battery positive as you can.' : ' Check the fuse\u2019s breaking capacity is above the battery\u2019s short-circuit current. Fit it as close to the battery positive as you can.');
  const mainFuseA = main && main.fuse ? main.fuse.A : Imain * 1.25;
  const shunt = Imain ? { a: up(SHUNT_SIZES, mainFuseA), why: `At least the main fuse (${mainFuseA} A), so ${up(SHUNT_SIZES, mainFuseA)} A. It goes in the battery negative: nothing else on the battery negative, everything else on the negative busbar side.` } : null;
  const isolator = Imain ? { a: up(ISOLATOR_SIZES, mainFuseA), why: `Continuous rating at least the main fuse (${mainFuseA} A). DC-rated, after the main fuse.` } : null;
  const posStuds = [inverter, solar, dcdc, shore, fuseBox].filter(Boolean).length + 1;
  const busbar = Imain ? { a: up(BUSBAR_SIZES, mainFuseA), pos: posStuds, neg: posStuds + 1, why: `Rated at least the main fuse (${mainFuseA} A). ${posStuds} studs on the positive (main feed + ${posStuds - 1} circuits), ${posStuds + 1} on the negative (+ the chassis bond), plus spares.` } : null;
  const bmsA = num(o.bmsA);
  if (bmsA && discharge > bmsA) warnings.push(`Everything on at once (${discharge} A) is more than the battery\u2019s BMS rating (${bmsA} A).`);
  else if (!bmsA && discharge) notes.push(`Check the battery\u2019s BMS continuous discharge rating is at least ${Math.ceil(discharge)} A (everything on at once).`);
  const chargeTotal = charge; const chargeMax = r1(battAhForCharge * C.chargeC);
  if (chargeTotal > chargeMax) warnings.push(`All chargers at once (${chargeTotal} A) is more than about ${Math.round(C.chargeC * 100)}% of the battery (${chargeMax} A): check the battery\u2019s max charge current.`);
  if (battery.ok === false) warnings.push(`Battery: ${fitted} Ah is short of the ${needAh} Ah worked out for ${days} day${days === 1 ? '' : 's'}.`);
  if (chem === 'lifepo4') notes.push('LiFePO4 must not be charged below 0 °C unless it has a built-in heater or low-temperature cut-off: worth it in a van used in winter.');
  const chassis = { size: dcdc && dcdc.inRun.size ? Math.max(dcdc.inRun.size, 16) : 16,
    why: dcdc ? 'The negative busbar is bonded to the vehicle chassis at a clean, bare, protected point. The alternator current comes back through it, so it\u2019s at least the size of the DC-DC input cable (16 mm² minimum here).' : 'Bond the negative busbar to the vehicle chassis at one clean point (16 mm² here; use the size the DC-DC or inverter maker asks for).' };

  // ---- runs, cables and the parts list ----
  const runs = [main, fuseBox && fuseBox.run, inverter && inverter.run, solar && solar.run, dcdc && dcdc.inRun, dcdc && dcdc.outRun, shore && shore.run, ...dcLoads.map((l) => l.run)].filter(Boolean);
  const plan = { V, vehV, chem, cable: cab, cableLabel: PLAN_CABLES[cab].label, derate, ca, cg, ambient: amb, mainPct, loads, dcLoads, acLoads, daily, battery, inverter, solar, dcdc, dcdcAdvice, shore, shoreSuggest, fuseBox, discharge, charge, main, shunt, isolator, busbar, chassis, runs, warnings, notes };
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
  add('Battery', `${b.label} battery, ${p.V} V ${b.fittedAh || b.suggestAh || b.needAh} Ah`, 1, b.why);
  if (p.chem !== 'lifepo4') add('Battery', 'Battery box with a vent to outside (lead/AGM give off gas when charging)', 1);
  else add('Battery', 'Battery strap / secure mounting (and low-temperature charge protection for winter)', 1);
  if (p.solar) {
    const s = p.solar; const pv = s.pv;
    add('Charging', `Solar panels, ${s.w} W total${s.panels > 1 ? ` (${s.panels} panels${pv ? `, ${pv.series} in series × ${pv.strings} string${pv.strings > 1 ? 's' : ''}` : ''})` : ''}`, 1, `About ${s.summerWh} Wh on a good summer day, ${s.winterWh} Wh in winter (UK, flat panels: ⚠ rough).`);
    add('Charging', `MPPT solar charge controller ${s.mpptV} V / ${s.mppt ?? '?'} A (${p.V} V battery)`, 1, s.why + (pv && pv.cold ? ` Cold-morning Voc ${pv.cold} V ${pv.vocOk ? '≤' : '>'} ${s.mpptV} V.` : ''));
    add('Charging', `PV isolator, DC-rated ≥ ${pv && pv.cold ? Math.ceil(pv.cold) : s.mpptV} V and ≥ ${pv && pv.cableAmps ? Math.ceil(pv.cableAmps * Math.max(1, pv.strings)) : '?'} A`, 1, 'Lets you switch the panels off before working on the controller.');
    add('Charging', 'MC4 connectors (pairs) and a roof cable entry gland', pv ? Math.max(2, pv.strings * 2) : 2);
    if (pv && pv.fuse && pv.fuse.needed && pv.fuse.fuse) add('Protection', `${pv.fuse.fuse} A gPV string fuses + holders (+ and −)`, pv.strings * 2, pv.fuse.why);
  }
  if (p.dcdc) add('Charging', `DC-DC (battery-to-battery) charger ${p.dcdc.a} A, ${p.vehV} → ${p.V} V`, 1, p.dcdcAdvice);
  else add('Charging', `Optional: DC-DC charger about ${p.dcdcAdvice.match(/DC-DC: (\d+)/)[1]} A to charge from the engine`, 1, p.dcdcAdvice);
  if (p.shore) add('Charging', `Mains (shore) battery charger ${p.shore.a} A`, 1, `Typical: about ${p.shoreSuggest} A for this battery. The 230 V hook-up side (inlet, RCD, consumer unit) is BS 7671 Section 721 work.`);
  if (p.inverter) {
    add('Inverter', `Pure sine inverter ${p.inverter.w} W continuous, ${p.V} V input`, 1, p.inverter.why + ' ' + p.inverter.surge);
    add('Inverter', '230 V outlets on the inverter output with RCD protection, earthed to the maker\u2019s instructions', 1, 'Follow the inverter maker\u2019s neutral–earth / RCD instructions.');
  }
  const fuseLine = (r, where) => r && r.fuse ? add('Protection', `${r.fuse.A} A ${r.fuse.label} + holder — ${where}`, 1, r.why) : null;
  if (p.main) fuseLine(p.main, 'main battery fuse, at the battery positive');
  if (p.isolator) add('Protection', `Battery isolator switch, DC-rated ${p.isolator.a} A continuous`, 1, p.isolator.why);
  if (p.busbar) { add('Protection', `Positive busbar / fuse distribution ≥ ${p.busbar.a} A, ${p.busbar.pos}+ studs`, 1, p.busbar.why); add('Protection', `Negative busbar ≥ ${p.busbar.a} A, ${p.busbar.neg}+ studs`, 1, p.busbar.why); }
  if (p.inverter) fuseLine(p.inverter.run, 'inverter');
  if (p.solar) fuseLine(p.solar.run, 'MPPT to battery');
  if (p.dcdc) { if (p.dcdc.inRun.fuse) add('Protection', `${p.dcdc.inRun.fuse.A} A ${p.dcdc.inRun.fuse.label} + holder — DC-DC input, at the starter battery`, 1, p.dcdc.inRun.why); fuseLine(p.dcdc.outRun, 'DC-DC output, at the busbar'); }
  if (p.shore) fuseLine(p.shore.run, 'mains charger');
  if (p.fuseBox) {
    fuseLine(p.fuseBox.run, 'feed to the fuse box');
    add('Protection', `Blade fuse box, ${p.fuseBox.ways}-way, rated ≥ ${p.fuseBox.run.fuse ? p.fuseBox.run.fuse.A : Math.ceil(p.fuseBox.current * 1.25)} A, with a negative bus`, 1, p.fuseBox.why);
    for (const l of p.dcLoads) if (l.run && l.run.fuse) add('Protection', `${l.run.fuse.A} A ${l.run.fuse.label} — ${l.name}`, 1, l.run.why);
  }
  for (const c of p.cables) add('Cables', `${c.size} mm² ${c.colour}, ${c.type}`, `${c.m} m`, c.runs.join(', '));
  if (p.solar) add('Cables', `${p.solar.pv && p.solar.pv.size && p.solar.pv.size.pick ? p.solar.pv.size.pick.size : 4} mm² solar PV cable (H1Z2Z2-K), red + black`, `${upHalf(num(o.pvLen, 5) * 1.1)} m each`, p.solar.pv && p.solar.pv.size && p.solar.pv.size.pick ? `Panels to the controller: drop ${p.solar.pv.size.pick.vd.pct}% at ${p.solar.pv.vstring} V.` : 'Enter the panel figures to size it; 4 mm² suits most van roofs.');
  if (p.shunt) add('Monitoring', `Battery monitor with ${p.shunt.a} A shunt`, 1, p.shunt.why);
  // lugs: 2 conductors × 2 ends per run, plus the extra joints on the main run (fuse, isolator, shunt).
  const lugs = {};
  for (const r of p.runs) if (r.size) lugs[r.size] = (lugs[r.size] || 0) + 4 + (r.id === 'main' ? 6 : 0);
  if (p.chassis) lugs[p.chassis.size] = (lugs[p.chassis.size] || 0) + 2;
  Object.keys(lugs).map(Number).sort((a, b) => b - a).forEach((s) => add('Misc', s >= 6 ? `Tinned copper tube lugs, ${s} mm² (stud size to suit, often M8)` : `Crimp ring terminals / bootlace ferrules, ${s} mm²`, lugs[s], 'About 2 per cable end: buy a few spare. Crimp with the right die (hydraulic or hammer crimper for big lugs).'));
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
  if (p.solar) L.push(`Solar: ${p.solar.w} W → MPPT ${p.solar.mpptV} V / ${p.solar.mppt} A`);
  if (p.main) L.push(`Main fuse: ${p.main.fuse ? p.main.fuse.A + ' A ' + p.main.fuse.label : '?'}, main cable ${p.main.size ?? '?'} mm²`);
  for (const w of p.warnings) L.push('⚠ ' + w);
  L.push('', 'PARTS LIST');
  for (const g of p.parts) { L.push('', g.group.toUpperCase()); for (const it of g.items) L.push(`- ${it.item}${typeof it.qty === 'string' ? `: ${it.qty}` : it.qty !== 1 ? `  × ${it.qty}` : ''}`); }
  L.push('', 'CABLE RUNS (current, fuse, cable, volt drop)');
  for (const r of p.runs) L.push(`- ${r.name}: ${r.current} A${r.peak > r.current ? ` (${r.peak} A peak)` : ''}, ${r.fuse ? r.fuse.A + ' A ' + r.fuse.label : 'fuse ?'}, ${r.size ?? '?'} mm² × ${r.length} m, drop ${r.vd ? r.vd.pct + '%' : '?'} (≤ ${r.pct}%)`);
  L.push('', 'NOTES'); for (const n of [...p.notes, ...SAFETY]) L.push('- ' + n);
  return L.join('\n');
}
