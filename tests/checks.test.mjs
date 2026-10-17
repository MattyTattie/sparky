import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCircuit, num, calibrationState, isSpare, limitZs } from '../js/checks.js';
import { blankCircuit, applyTemplate, TEMPLATES, copyCircuit, makeSpare } from '../js/templates.js';
import { voltDrop, sizeCable, expectedR1R2 } from '../js/calc.js';

const ring = () => applyTemplate(blankCircuit(1), TEMPLATES[0]);

test('num() reads tester-style values', () => {
  assert.equal(num('0.42'), 0.42); assert.equal(num('>999'), 999); assert.equal(num('≥200'), 200);
  assert.equal(num('N/A'), null); assert.equal(num(''), null); assert.equal(num('0,35'), 0.35); assert.equal(num('LIM'), null);
});

test('Zs: green, amber at 80%, red over the limit', () => {
  const c = ring();
  c.zs = '0.80'; assert.equal(checkCircuit(c).worst, null);
  c.zs = '1.20'; let r = checkCircuit(c); assert.equal(r.flags.zs.level, 'amber'); assert.equal(r.maxZs, 1.37); assert.equal(r.cold, 1.1);
  c.zs = '1.10'; assert.equal(checkCircuit(c).worst, null, 'exactly 80% is fine');
  c.zs = '1.38'; r = checkCircuit(c); assert.equal(r.flags.zs.level, 'red'); assert.match(r.flags.zs.msg, /1\.37/);
});

test('own max Zs (maker data) overrides the table; TT uses Table 41.5', () => {
  const c = ring(); c.maxZsOverride = '2.0'; c.zs = '1.7';
  assert.equal(checkCircuit(c).flags.zs.level, 'amber');
  const t = ring(); t.zs = '40'; assert.equal(limitZs(t, { earthing: 'TT' }).value, 1667);
  assert.equal(checkCircuit(t, { earthing: 'TT' }).worst, null);
});

test('IR below Table 64 minimum is red, below 2 MΩ amber, >999 fine', () => {
  const c = ring(); c.irLE = '0.8'; assert.equal(checkCircuit(c).flags.irLE.level, 'red');
  c.irLE = '1.5'; assert.equal(checkCircuit(c).flags.irLE.level, 'amber');
  c.irLE = '>999'; c.irLL = '>999'; assert.equal(checkCircuit(c).worst, null);
  c.irV = '250'; c.irLE = '0.6'; assert.equal(checkCircuit(c).flags.irLE.level, 'amber');
});

test('RCD times', () => {
  const c = ring(); c.rcdMs = '28'; assert.equal(checkCircuit(c).worst, null);
  c.rcdMs = '320'; assert.equal(checkCircuit(c).flags.rcdMs.level, 'red');
  c.rcdS = true; assert.equal(checkCircuit(c).worst, null);
  c.rcdMs = '90'; assert.equal(checkCircuit(c).flags.rcdMs.level, 'amber');
  c.rcdMs = '510'; assert.equal(checkCircuit(c).flags.rcdMs.level, 'red');
});

test('ring end-to-end readings', () => {
  const c = ring(); c.r1 = '0.50'; c.rn = '0.51'; c.r2 = '0.83'; c.r1r2 = '0.33';
  assert.equal(checkCircuit(c).worst, null);
  c.rn = '0.60'; assert.equal(checkCircuit(c).flags.rn.level, 'amber');
  c.rn = '0.51'; c.r1r2 = '0.45'; assert.equal(checkCircuit(c).flags.r1r2.level, 'amber');
});

test('polarity / test buttons; spare rows are skipped', () => {
  const c = ring(); c.pol = '✗'; assert.equal(checkCircuit(c).flags.pol.level, 'red');
  c.pol = '✓'; c.rcdBtn = '✗'; assert.equal(checkCircuit(c).flags.rcdBtn.level, 'red');
  const s = makeSpare(ring()); assert.ok(isSpare(s)); s.zs = '99'; assert.equal(checkCircuit(s).worst, null);
});

test('copy row keeps details, clears readings', () => {
  const c = ring(); c.zs = '0.5'; c.r1r2 = '0.3';
  const d = copyCircuit(c, 2); assert.equal(d.num, '2'); assert.equal(d.rating, '32'); assert.equal(d.zs, ''); assert.notEqual(d.id, c.id);
});

test('calibration reminders', () => {
  const today = new Date('2026-10-17T12:00:00');
  assert.equal(calibrationState('2026-10-01', today), 'out');
  assert.equal(calibrationState('2026-11-10', today), 'soon');
  assert.equal(calibrationState('2027-06-01', today), 'ok');
  assert.equal(calibrationState('', today), 'unknown');
});

test('volt drop and cable sizing', () => {
  const v = voltDrop({ cable: 'te', size: 2.5, ib: 20, length: 25 });
  assert.equal(v.volts, 9); assert.equal(v.pct, 3.91); assert.equal(v.pass, true);
  assert.equal(voltDrop({ cable: 'te', size: 1.5, ib: 6, length: 40, lighting: true }).volts, 6.96);
  assert.equal(voltDrop({ cable: 'te', size: 1.5, ib: 6, length: 40, lighting: true }).pass, false);
  const s = sizeCable({ cable: 'te', method: 'C', ib: 29, inA: 32, length: 20 });
  assert.equal(s.pick.size, 4, '32 A clipped direct → 4 mm² (37 A), 6.38 V drop');
  const s2 = sizeCable({ cable: 'te', method: '101', ib: 16, inA: 20, length: 10 });
  assert.equal(s2.pick.size, 4, 'in loft insulation 2.5 mm² is only 17 A');
  const s3 = sizeCable({ cable: 'te', method: 'C', ib: 29, inA: 32, length: 45 });
  assert.equal(s3.pick.size, 6, 'long run: volt drop pushes it to 6 mm²');
  assert.equal(sizeCable({ cable: 'te', method: 'C', ib: 40, inA: 32 }).ok, false);
});

test('expected R1+R2', () => {
  assert.equal(expectedR1R2(2.5, 1.5, 10), 0.2);
});
