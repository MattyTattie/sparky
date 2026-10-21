import test from 'node:test';
import assert from 'node:assert/strict';
import { sizeCircuit } from '../js/design.js';
import { r1r2At20 } from '../js/calc.js';

const ring = (o = {}) => sizeCircuit({ load: '20', unit: 'A', pf: '1', loadType: 'ring', length: '10', cable: 'te', cpcMode: 'core', method: 'C', ambient: 30, grouped: 1, grouping: 'bunched', ci: 1, ze: 0.35, device: 'mcb', type: 'B', time: 0.4, ringLoad: 'spread', phase: 1, ...o });

test('v0.19.1: exact case, 32 A B ring, Ib 20 A, 10 m flat T&E gives 2.5/1.5', () => {
  const r = ring();
  assert.equal(r.ok, true); assert.equal(r.inA, 32);
  assert.equal(r.pick.size, 2.5); assert.equal(r.pick.cpc, 1.5);
  assert.equal(r.pick.adi.pass, true);
  assert.ok(r.pick.adi.smin <= 1.5);
});

test('v0.19.1: ring 2.5/1.5 on 32 A B, C and RCBO for normal lengths', () => {
  for (const [device, type] of [['mcb', 'B'], ['mcb', 'C'], ['rcbo', 'B'], ['rcbo', 'C']])
    for (const length of ['5', '10', '30', '50']) {
      const r = ring({ device, type, length });
      assert.equal(r.pick && r.pick.size, 2.5, `${device} ${type} ${length} m`);
    }
});

test('v0.19.1: ring uses ring values for R1+R2, Zs and volt drop', () => {
  const r = ring({ length: '40' });
  const row = r.rows.find((x) => x.size === 2.5);
  const full = r1r2At20({ live: 2.5, cpc: 1.5, length: 40 });
  assert.equal(row.z.r20, r1r2At20({ live: 2.5, cpc: 1.5, length: 40, ring: true }));
  assert.ok(Math.abs(row.z.r20 - full / 4) < 0.002);
  assert.ok(Math.abs(row.z.zs - (0.35 + row.z.rHot)) < 0.011);
  const radial = sizeCircuit({ load: '20', unit: 'A', pf: '1', loadType: 'general', length: '40', cable: 'te', method: 'C', ambient: 30, grouped: 1, ci: 1, ze: 0.35, device: 'mcb', type: 'B', time: 0.4, phase: 1 }).rows.find((x) => x.size === 2.5);
  assert.ok(row.vd.pct <= radial.vd.pct / 4 + 0.01);
  const pt = ring({ length: '40', ringLoad: 'point' }).rows.find((x) => x.size === 2.5);
  assert.ok(Math.abs(pt.vd.pct - radial.vd.pct / 4) < 0.02);
  // adiabatic uses the ring Zs
  assert.ok(Math.abs(row.adi.ifault - 230 / row.z.zs) < 1);
});

test('v0.19.1: class 3 cap read at the fault current, not the full kA', () => {
  const row = ring().rows.find((x) => x.size === 2.5);
  assert.equal(row.adi.i2t, 18000);
  assert.match(row.adi.how, /up to 3 kA/);
});

test('v0.19.1: long C ring still fails honestly on Zs', () => {
  const row = ring({ type: 'C', length: '70' }).rows.find((x) => x.size === 2.5);
  assert.equal(row.z.pass, false);
});
test('v0.19.1: class 3 at 6 kA still applies to big fault currents', () => {
  const row = ring({ ze: 0.02, length: '2' }).rows.find((x) => x.size === 2.5);
  assert.ok(row.adi.i2t > 18000);
});
