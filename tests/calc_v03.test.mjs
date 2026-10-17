// v0.3 calculator and circuit-page cable data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CA, CABLE_PICKS, WIRING_TYPES, REF_METHODS, ARMOUR_MOHM_PER_M, CABLES } from '../js/cables.js';
import { voltDrop, sizeCable, designZs, r1r2At20, lengthFromR1R2, ambientFactor } from '../js/calc.js';
import { cableCheck, applyCable, checkCircuit } from '../js/checks.js';

test('ambient factors: Table 4B1 values, 20 °C uses the 25 °C factor (safe side)', () => {
  assert.equal(CA[70][25], 1.03); assert.equal(CA[90][25], 1.02); assert.equal(CA[70][40], 0.87); assert.equal(CA[90][50], 0.82);
  assert.equal(CA[70][20], 1.03); assert.equal(CA[90][20], 1.02);
  assert.match(ambientFactor('te', 20).note, /25 °C/);
});
test('T&E 6242Y live/CPC pairs', () => {
  assert.deepEqual(CABLE_PICKS.te.sizes, { 1: 1, 1.5: 1, 2.5: 1.5, 4: 1.5, 6: 2.5, 10: 4, 16: 6 });
});
test('6243Y: 1.0/1.0 and 1.5/1.0; 2.5 flagged as unsure', () => {
  assert.equal(CABLE_PICKS.te3.sizes[1], 1); assert.equal(CABLE_PICKS.te3.sizes[1.5], 1);
  assert.match(CABLE_PICKS.te3.warn[2.5], /disagree/);
});
test('wiring codes A–H, O and reference methods incl. 100–103', () => {
  assert.deepEqual(WIRING_TYPES.map((w) => w[0]), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'O']);
  for (const m of ['A', 'B', 'C', 'D1', 'D2', 'E', 'F', 'G', '100', '101', '102', '103']) assert.ok(REF_METHODS.some((r) => r[0] === m), m);
});
test('ring volt drop: ¼ (load at far point) or ⅛ (spread) of a radial the loop length', () => {
  const rad = voltDrop({ cable: 'te', size: 2.5, ib: 32, length: 60 });
  const pt = voltDrop({ cable: 'te', size: 2.5, ib: 32, length: 60, ring: 'point' });
  const sp = voltDrop({ cable: 'te', size: 2.5, ib: 32, length: 60, ring: 'spread' });
  assert.equal(rad.volts, 34.56); assert.equal(pt.volts, 8.64); assert.equal(sp.volts, 4.32); assert.equal(pt.pass, true);
});
test('sizing: 2.5 T&E ring on 32 A passes (433.1.204); a 2.5 radial on 32 A doesn\u2019t', () => {
  const ring = sizeCable({ cable: 'te', method: 'C', ib: 26, inA: 32, length: 60, ring: 'spread' });
  assert.equal(ring.needIz, 20); assert.equal(ring.pick.size, 2.5);
  const rad = sizeCable({ cable: 'te', method: 'C', ib: 26, inA: 32, length: 20 });
  assert.equal(rad.rows.find((r) => r.size === 2.5).currentOk, false); assert.equal(rad.pick.size, 4);
  const buried = sizeCable({ cable: 'swa3', method: 'D', ib: 20, inA: 32, length: 30, ambient: 40 });
  assert.equal(buried.factors.ca, 1); assert.match(buried.caNote, /ground/);
});
test('design Zs and expected R1+R2 (T&E, 3rd core, armour)', () => {
  const z = designZs({ ze: 0.35, cable: 'te', live: 2.5, cpc: 1.5, length: 20, device: 'rcbo', type: 'B', rating: 32 });
  assert.equal(z.r20, 0.39); assert.equal(z.mult, 1.2); assert.equal(z.zs, 0.82); assert.equal(z.max, 1.37); assert.equal(z.pass, true);
  assert.equal(r1r2At20({ live: 2.5, cpc: 2.5, length: 10, cores: 3 }), 0.148);
  assert.equal(r1r2At20({ live: 4, cpc: 'armour', length: 30, cores: 3 }), 0.363);
  assert.equal(r1r2At20({ live: 2.5, cpc: 1.5, length: 60, ring: true }), 0.293);
  const x = designZs({ ze: 0.8, cable: 'swa3X', live: 4, cpc: 'armour', length: 30, device: 'mcb', type: 'B', rating: 32 });
  assert.equal(x.mult, 1.28); assert.equal(x.armour, true); assert.match(x.note, /adiabatic/);
  assert.equal(ARMOUR_MOHM_PER_M[3][2.5], 8.2); assert.match(ARMOUR_MOHM_PER_M.source, /not BS 7671/);
  assert.equal(lengthFromR1R2({ r1r2: '0.39', live: 2.5, cpc: 1.5 }), 20);
});
test('3-core SWA in the calculator', () => {
  assert.equal(CABLES.swa3.cores, 3); assert.equal(CABLES.swa3.methods.C.amps[4], 38); assert.match(CABLES.swa3.note, /two loaded cores/);
});
test('circuit check: device bigger than the cable rating (e.g. B32 on 2.5 T&E clipped) → amber, but rings are fine', () => {
  const spd = { desc: 'SPD', wiring: 'A', ref: 'C', live: '2.5', cpc: '1.5', rating: '32', device: 'mcb', type: 'B' };
  assert.equal(cableCheck(spd).level, 'amber'); assert.equal(checkCircuit(spd).flags.live.level, 'amber');
  assert.equal(cableCheck({ ...spd, desc: 'Downstairs sockets' }).level, null);
  assert.equal(cableCheck({ ...spd, desc: 'Kitchen', r1: '0.52' }).level, null);
  assert.equal(cableCheck({ ...spd, rating: '16', ref: '103' }).level, 'amber', '13.5 A in an insulated stud wall');
  assert.equal(cableCheck({ ...spd, rating: '20' }).level, null);
});
test('cable picker fills live and CPC', () => {
  assert.deepEqual((({ live, cpc }) => ({ live, cpc }))(applyCable({ cable: 'te', cableSize: '6' })), { live: '6', cpc: '2.5' });
  assert.equal(applyCable({ cable: 'swa3a', cableSize: '4' }).cpc, 'SWA');
  assert.equal(applyCable({ cable: 'swa3c', cableSize: '4' }).cpc, '4');
});
