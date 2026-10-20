import { test } from 'node:test'; import assert from 'node:assert';
import { sizeCircuit, loadAdvice } from '../js/design.js';
const his = { load: 3.97, unit: 'A', loadType: 'motor', phase: 3, length: 15, cable: 'swa4', method: 'C', device: 'mcb' };
test('v0.18.5 motor: auto picks Type C with the C max Zs, overload advice uses Ib', () => {
  const r = sizeCircuit({ ...his, type: 'auto' }); assert.equal(r.curve, 'C');
  assert.ok(r.advice.some((a) => /starter overload to the motor nameplate FLC \(about 3\.97 A\), trip class 10/.test(a.text)));
});
test('v0.18.5 motor on a Type B (user override) warns about starting', () => {
  const r = sizeCircuit({ ...his, type: 'B' }); assert.equal(r.curve, 'B');
  assert.ok(r.advice.some((a) => a.level === 'warn' && /Type B for a motor/.test(a.text)));
});
test('v0.18.5 tight motor rating warns, D accepted, other loads advised', () => {
  assert.ok(loadAdvice({ loadType: 'motor', curve: 'C', inA: 6, ib: 5.5, device: 'mcb' }).some((a) => a.level === 'warn'));
  assert.equal(sizeCircuit({ ...his, type: 'D' }).curve, 'D');
  assert.ok(loadAdvice({ loadType: 'ev', curve: 'B', inA: 32, ib: 32, device: 'rcbo' }).some((a) => /Type A with DC fault protection/.test(a.text)));
  assert.ok(loadAdvice({ loadType: 'lighting', curve: 'B', inA: 6, ib: 2, device: 'mcb' }).length);
  assert.equal(loadAdvice({ loadType: 'heating', curve: 'B', inA: 32, ib: 30, device: 'mcb', auto: true }).length, 0);
});
