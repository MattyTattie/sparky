// v0.36.3: smaller lithium main fuses (Class T from 15 A, DC MCCB from 16 A); fuse-floor "why" text.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../js/dcplan.js';

test('Class T and DC MCCB small ratings exist, still DC/kA rated', () => {
  assert.equal(D.FUSES.classT.sizes[0], 15); assert.ok(D.FUSES.classT.sizes.includes(30)); assert.ok(D.FUSES.classT.sizes.includes(90));
  assert.equal(D.FUSES.mccb.sizes[0], 16); assert.ok(D.FUSES.classT.ka >= 20 && D.FUSES.mccb.ka >= 20);
});
test('main fuse is the smallest rating >= 1.25 x design current, never MEGA/ANL/MIDI on lithium', () => {
  for (const V of ['12', '24', '48']) for (const invW of ['', '1000', '3000']) {
    const p = D.planDC({ volts: V, battAh: '660', invW });
    const f = p.main.fuse; assert.ok(['classT', 'nhdc', 'mccb'].includes(f.fam));
    assert.ok(f.A >= p.main.need - 1e-9);
    const below = D.FUSES[f.fam].sizes.filter((a) => a < f.A); assert.ok(!below.length || below[below.length - 1] < p.main.need);
    assert.ok(p.main.vd.pct <= p.main.pct + 1e-9);
  }
});
test('12 V vs 48 V now differ; 12 V no-inverter case', () => {
  const a = D.planDC({ volts: '12', battAh: '660' }), b = D.planDC({ volts: '48', battAh: '660' });
  assert.equal(a.main.fuse.A, 30); assert.equal(b.main.fuse.A, 15);
  assert.ok(a.main.size >= a.fuseBox.run.size); assert.ok(a.main.size > b.main.size);
  assert.match(a.main.why, /fuse box feed/); assert.match(b.main.why, /Class T fuses come from 15 A/);
});
test('inverter cases still sized up', () => {
  assert.equal(D.planDC({ volts: '12', invW: '3000' }).main.size, 120);
  const p = D.planDC({ volts: '48', invW: '1000' }); assert.equal(p.main.fuse.A, 40); assert.match(p.main.why, /must carry the 40 A fuse|Class T/);
});
test('v0.36.3b: 6 mm² minimum main battery cable, with why text', () => {
  const b = D.planDC({ volts: '48', battAh: '660' });
  assert.equal(b.main.size, 6); assert.match(b.main.why, /Minimum 6 mm² for a battery main cable; the load alone needs 1.5 mm²/);
  const a = D.planDC({ volts: '12', battAh: '660' }); assert.equal(a.main.size, 10); assert.match(a.main.why, /fuse box feed/);
  for (const V of ['12', '24', '48']) for (const invW of ['', '1000', '3000']) assert.ok(D.planDC({ volts: V, invW, battAh: '660' }).main.size >= 6);
});
test('v0.36.3c: blade fuse box at 12 V only; DC breaker board at 24/48 V', () => {
  const a = D.planDC({ volts: '12', battAh: '660' }); assert.equal(a.fuseBox.label, 'Fuse box'); assert.equal(a.fuseBox.sub, '6-way blade');
  for (const V of ['24', '48']) {
    const p = D.planDC({ volts: V, battAh: '660' });
    assert.equal(p.fuseBox.label, 'DC breaker board'); assert.equal(p.fuseBox.sub, '6-way DC breakers');
    for (const l of p.dcLoads) if (l.run) assert.notEqual(l.run.fuse.fam, 'blade');
    assert.ok(!D.partsList(p).some((r) => /[Bb]lade fuse box/.test(r.item)));
  }
});
