import { test } from 'node:test'; import assert from 'node:assert';
import { sizeCircuit, designCurrent, kwFromAmps, convertLine, kFor, adjSettings } from '../js/design.js';
import { CABLES, CABLE_PICKS, THREE_PHASE_CABLES, CU_MOHM_PER_M, ARMOUR_MOHM_PER_M, ARMOUR_CSA, SINGLES_CPC } from '../js/cables.js';
import { deviceById, deviceFromBs, maxZsForTrip, mpcbRange } from '../js/limits.js';
import { applyCable } from '../js/checks.js';
import { transformer, contactor, faultLevel } from '../js/calcextra.js';
import { planUse, applyUse, undoUse, pickFor } from '../js/usecore.js';

test('v0.19 #1 H07RN-F: 1–95 mm², calc + picker, core as CPC, k 141', () => {
  for (const k of ['h07', 'h073']) { assert.deepEqual(CABLES[k].sizes, [1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95]); for (const s of CABLES[k].sizes) { assert.ok(CABLES[k].mvam[s] > 0); assert.ok(CABLES[k].methods.C.amps[s] > 0); } }
  assert.ok(THREE_PHASE_CABLES.includes('h073'));
  for (const k of ['h07r2', 'h07r3', 'h07r4', 'h07r5']) assert.ok(CABLE_PICKS[k]);
  const r = sizeCircuit({ load: 16, unit: 'A', length: 25, cable: 'h07', method: 'C', device: 'mcb' });
  assert.ok(r.ok && r.pick); assert.equal(r.pick.cpc, r.pick.size); assert.equal(r.k.k, 141);
  assert.ok(r.notes.some((n) => /check your books/.test(n)));
  const c = { cable: 'h07r2', cableSize: '2.5' }; applyCable(c); assert.equal(c.cpc, 'N/A');
});
test('v0.19 #2 SWA and singles go to 95 mm² (and stop there)', () => {
  for (const k of ['swa', 'swa3', 'swaX', 'swa3X', 'swa4', 'swa4X', 'singles', 'singles3']) {
    assert.deepEqual(CABLES[k].sizes.slice(-3), [50, 70, 95]); assert.equal(Math.max(...CABLES[k].sizes), 95);
    for (const s of [50, 70, 95]) { assert.ok(CABLES[k].mvam[s] > 0); for (const m of Object.values(CABLES[k].methods)) assert.ok(m.amps[s] > 0); }
  }
  for (const s of [50, 70, 95]) { assert.ok(CU_MOHM_PER_M[s]); for (const n of [2, 3, 4]) { assert.ok(ARMOUR_MOHM_PER_M[n][s]); assert.ok(ARMOUR_CSA[n][s]); } }
  assert.equal(SINGLES_CPC[95], 50); assert.equal(CABLE_PICKS.swa3c.sizes[95], 95);
  // 120 A 3-phase over 60 m on 4-core SWA used to give up at 35 mm²: now it finds a bigger size.
  const r = sizeCircuit({ load: 110, unit: 'A', phase: 3, length: 60, cable: 'swa4X', method: 'C', device: 'mccb', ir: 125, im: 625, ze: 0.2, time: 5 });
  assert.ok(r.ok && r.pick && r.pick.size >= 50);
});
test('v0.19 #3 kW ↔ amps with pf and motor efficiency', () => {
  assert.equal(designCurrent({ load: 22, unit: 'kW', pf: 1, phase: 3 }), 31.75);
  assert.equal(designCurrent({ load: 22, unit: 'kW', pf: 0.85, phase: 3 }), 37.36);
  assert.equal(designCurrent({ load: 7.2, unit: 'kW', pf: 1, phase: 1 }), 31.3);
  assert.equal(designCurrent({ load: 2.2, unit: 'kW', pf: 0.85, phase: 3, eff: 0.85 }), 4.4);
  assert.equal(kwFromAmps({ amps: 31.3, pf: 1, phase: 1 }), 7.2);
  assert.match(convertLine({ load: 22, unit: 'kW', pf: 0.85, phase: 3 }), /37\.36 A per phase/);
  assert.match(convertLine({ load: 4.39, unit: 'A', pf: 0.85, phase: 3, eff: 0.85, motor: true }), /kW output.*nameplate full-load current/);
  // efficiency only applies to motors in the sizer
  assert.equal(sizeCircuit({ load: 2.2, unit: 'kW', pf: 0.85, phase: 3, eff: 0.85, loadType: 'motor', length: 15, cable: 'swa4', method: 'C', device: 'mcb' }).ib, 4.4);
  assert.equal(sizeCircuit({ load: 2.2, unit: 'kW', pf: 0.85, phase: 3, eff: 0.85, loadType: 'general', length: 15, cable: 'swa4', method: 'C', device: 'mcb' }).ib, 3.74);
});
test('v0.19 #4 MPCB: dial at FLC, magnetic ≈ 13 × range top, start and Zs checked against it', () => {
  assert.ok(deviceById('mpcb')); assert.equal(deviceFromBs('60947-4-1').id, 'mpcb');
  assert.deepEqual(mpcbRange(3.97), [2.5, 4]);
  const r = sizeCircuit({ load: 3.97, unit: 'A', loadType: 'motor', phase: 3, length: 15, cable: 'swa4', method: 'C', device: 'mpcb' });
  assert.ok(r.ok && r.pick); assert.equal(r.inA, 3.97); assert.equal(r.max, maxZsForTrip(52)); assert.match(r.adjLabel, /MPCB 2\.5–4 A/);
  assert.ok(r.advice.some((a) => /below the 52 A magnetic trip/.test(a.text)));
  assert.ok(adjSettings({ load: 3.97, unit: 'A', loadType: 'motor', start: 'dol', magMult: 7 }, deviceById('mpcb')).advice.some((a) => a.level === 'warn'));
});
test('v0.19 #5 soft start / VSD / star-delta: Auto picks Type C, wording matches the curve', () => {
  for (const start of ['vsd', 'sd']) {
    const r = sizeCircuit({ load: 39.69, unit: 'A', loadType: 'motor', phase: 3, length: 10, cable: 'swa4', method: 'C', device: 'mcb', type: 'auto', start });
    assert.equal(r.curve, 'C'); assert.equal(r.inA, 40);
    assert.ok(!r.advice.some((a) => /check with Type D/.test(a.text)));
  }
  const d = sizeCircuit({ load: 39.69, unit: 'A', loadType: 'motor', phase: 3, length: 10, cable: 'swa4', method: 'C', device: 'mcb', type: 'D', start: 'vsd', ze: 0.1 });
  assert.equal(d.curve, 'D'); assert.ok(!d.advice.some((a) => /check with Type D/.test(a.text))); assert.ok(d.advice.some((a) => /40 A Type C would do/.test(a.text)));
  const dol = sizeCircuit({ load: 3.97, unit: 'A', loadType: 'motor', phase: 3, length: 15, cable: 'swa4', method: 'C', device: 'mcb', type: 'auto' });
  assert.ok(dol.advice.some((a) => /check with Type D/.test(a.text)) && dol.curve === 'C');
});
test('v0.19 #6 wording says mm²', () => {
  const r = sizeCircuit({ load: 39.69, unit: 'A', loadType: 'motor', phase: 3, length: 10, cable: 'swa4', method: 'C', device: 'mcb', type: 'C', start: 'vsd', ze: 0.45 });
  assert.match(r.steps.join(' '), /\d mm² fails on Zs \(/);
  assert.ok(!/\b\d+(\.\d+)? fails/.test(r.steps.join(' ')));
});
test('v0.19 #7 Settings: email on its own line under phone', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.ok(src.includes("txt('phone', 'Phone', 'tel'), txt('email', 'Email', 'email'), // v0.19"));
  assert.ok(!src.includes("txt('regNo'") || !/grid2' \}, txt\('phone', 'Phone', 'tel'\), txt\('email', 'Email', 'email'\)\),\n\s+txt\('regNo'/.test(src));
});
test('v0.19 #8 Use on a circuit: preview, only cable/device boxes, exact undo', () => {
  const c = { id: 'c1', num: '3', desc: 'Garage', cable: 'te', cableSize: '2.5', live: '2.5', cpc: '1.5', device: 'rcbo', bs: '61009', type: 'B', rating: '32', zs: '0.62', r1r2: '0.3', ir: '>299' };
  const before = JSON.parse(JSON.stringify(c));
  const res = { cable: 'swa4', size: 6, cpc: 'armour', device: 'mcb', curve: 'C', rating: 40 };
  const plan = planUse(c, res); const ks = plan.map((p) => p.k);
  assert.deepEqual(ks.sort(), ['bs', 'cable', 'cableSize', 'cpc', 'device', 'live', 'rating', 'type', 'wiring'].sort());
  assert.ok(plan.find((p) => p.k === 'cable').toText.includes('4-core SWA'));
  const snap = applyUse(c, res);
  assert.equal(c.cable, 'swa4a'); assert.equal(c.cpc, 'SWA'); assert.equal(c.rating, '40'); assert.equal(c.type, 'C'); assert.equal(c.zs, '0.62'); assert.equal(c.r1r2, '0.3');
  undoUse(c, snap); assert.deepEqual(c, before);
  const blank = { id: 'n' }; const s2 = applyUse(blank, { cable: 'singles', size: 25, cpc: 16, device: 'mccb', curve: '', rating: 125 });
  assert.equal(blank.cpc, '16'); assert.equal(blank.type, ''); undoUse(blank, s2); assert.deepEqual(blank, { id: 'n' });
  assert.equal(pickFor('swa3', 'armour'), 'swa3a'); assert.equal(pickFor('h07'), 'h07r3');
});
test('v0.19 #9 meter tails vs the cutout fuse', () => {
  assert.deepEqual(CABLES.tails.sizes, [16, 25, 35]);
  const ok = sizeCircuit({ load: 80, unit: 'A', length: 3, cable: 'tails', method: 'B', device: 'bs88-3', cutout: 100, time: 5 });
  assert.equal(ok.pick.size, 25); assert.ok(ok.advice[0].text.includes('at least the 100 A cutout'));
  const bad = sizeCircuit({ load: 60, unit: 'A', length: 3, cable: 'tails', method: 'A', device: 'bs88-3', cutout: 100, time: 5 });
  assert.equal(bad.pick.size, 25); assert.equal(bad.advice[0].level, 'warn'); // 25 mm² method A carries 80 A < 100 A cutout
});
test('v0.19 #10 PVC flex 3183Y 0.5–4 mm²', () => {
  assert.deepEqual(CABLES.flex.sizes, [0.5, 0.75, 1, 1.25, 1.5, 2.5, 4]); assert.ok(CABLE_PICKS.flex);
  const r = sizeCircuit({ load: 10, unit: 'A', length: 2, cable: 'flex', method: 'C', device: 'bs88-2' });
  assert.ok(r.ok && r.pick && r.pick.size >= 1);
});
test('v0.19 #11 MCCB: Ir and Im typed in, Zs against Im', () => {
  assert.equal(maxZsForTrip(1250), 0.17); assert.equal(maxZsForTrip(625), 0.35);
  const r = sizeCircuit({ load: 110, unit: 'A', phase: 3, length: 30, cable: 'swa4X', method: 'C', device: 'mccb', ir: 125, im: 625, ze: 0.2, time: 5 });
  assert.equal(r.inA, 125); assert.equal(r.max, 0.35); assert.ok(r.pick); assert.match(r.adjLabel, /Ir 125 A, Im 625 A/);
  assert.ok(!sizeCircuit({ load: 110, unit: 'A', phase: 3, length: 30, cable: 'swa4X', method: 'C', device: 'mccb', ir: 100, im: 1000 }).ok);
  assert.equal(deviceFromBs('BS EN 60947-2').id, 'mccb');
});
test('v0.19 #12 tri-rated panel wire: panel methods, grouping applied, k 100', () => {
  assert.ok(CABLES.tri.methods.panel && CABLES.tri.methods.bunch);
  const a = sizeCircuit({ load: 10, unit: 'A', length: 4, cable: 'tri', method: 'bunch', grouped: 6, grouping: 'clipped', device: 'mcb' });
  assert.equal(a.factors.cg, 0.57); assert.equal(a.k.k, 100);
  const b = sizeCircuit({ load: 10, unit: 'A', length: 4, cable: 'tri', method: 'panel', grouped: 1, device: 'mcb' });
  assert.equal(b.factors.cg, 1); assert.ok(a.pick.size >= b.pick.size);
});
test('v0.19 #13 SY/CY control cable flagged typical', () => {
  assert.ok(CABLES.sycy.typical && /check maker data/.test(CABLES.sycy.note)); assert.ok(CABLE_PICKS.sycy); assert.ok(THREE_PHASE_CABLES.includes('sycy3'));
});
test('v0.19 #14 control transformer', () => {
  const r = transformer({ va: 250, vp: 400, vs: 24 });
  assert.equal(r.ip, 0.625); assert.equal(r.is, 10.417); assert.equal(r.fp, 1.6); assert.equal(r.fs, 12);
  assert.equal(transformer({ va: 100, vp: 230, vs: 110 }).fp, 1);
  assert.ok(!transformer({ va: 0 }).ok);
});
test('v0.19 #15 contactor picker', () => {
  const h = contactor({ cat: 'AC-1', load: 10, unit: 'kW', phase: 3 });
  assert.equal(h.amps, 14.43); assert.equal(h.size, 20); assert.equal(h.next, 25); assert.equal(h.line, 'AC-1');
  assert.equal(contactor({ cat: 'AC-1', load: 10, unit: 'kW', phase: 1 }).size, 63);
  const m = contactor({ cat: 'AC-3', load: 7.5, unit: 'kW', phase: 3, pf: 0.85, eff: 0.88 }); assert.equal(m.line, 'AC-3'); assert.equal(m.size, 18);
  assert.ok(contactor({ cat: 'AC-4', load: 10, unit: 'A' }).size >= 25);
  for (const k of ['AC-5a', 'AC-5b', 'AC-6a', 'AC-6b']) assert.ok(contactor({ cat: k, load: 5, unit: 'A' }).ok);
});
test('v0.19 #16 fault level at a sub-board', () => {
  const r = faultLevel({ pfc: 16, ze: 0.35, phase: 1, cable: 'swa', size: 16, length: 20, armour: true, deviceKa: 6 });
  assert.equal(r.pscc, 3.81); assert.equal(r.pefc, 0.51); assert.ok(r.pass);
  const n = faultLevel({ pfc: 16, phase: 1, cable: 'swa', size: 25, length: 8, deviceKa: 6 }); assert.ok(!n.pass);
  const t = faultLevel({ pfc: 10, phase: 3, cable: 'swa4', size: 35, length: 30, armour: true, deviceKa: 10 }); assert.ok(t.pscc > 0 && t.origin3 === 20);
  assert.ok(faultLevel({ pfc: 16, phase: 1, cable: 'swa', size: 95, length: 5 }).big);
});
