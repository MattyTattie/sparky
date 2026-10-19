// v0.12 tests: delete circuit with renumbering of later sequential circuits. FAKE data only.
import test from 'node:test';
import assert from 'node:assert/strict';
const T = await import('../js/templates.js');
const board = (nums) => ({ circuits: nums.map((n) => Object.assign(T.blankCircuit(1), { num: n, desc: 'C' + n })) });
test('delete middle of 1..5 renumbers 4,5 -> 3,4', () => {
  const b = board(['1', '2', '3', '4', '5']); const r = T.deleteCircuitAt(b, 2);
  assert.equal(r.removed.desc, 'C3'); assert.equal(r.renumbered, 2);
  assert.deepEqual(b.circuits.map((c) => c.num), ['1', '2', '3', '4']); assert.deepEqual(b.circuits.map((c) => c.desc), ['C1', 'C2', 'C4', 'C5']);
});
test('non-sequential later numbers are left alone', () => {
  const b = board(['1', '2', '3', '7', 'L1']); T.deleteCircuitAt(b, 1);
  assert.deepEqual(b.circuits.map((c) => c.num), ['1', '3', '7', 'L1']);
  const b2 = board(['1', '2', '1L', '3']); T.deleteCircuitAt(b2, 0); assert.deepEqual(b2.circuits.map((c) => c.num), ['2', '1L', '3']);
});
test('delete last, and only circuit', () => {
  const b = board(['1', '2']); assert.equal(T.deleteCircuitAt(b, 1).renumbered, 0); assert.deepEqual(b.circuits.map((c) => c.num), ['1']);
  T.deleteCircuitAt(b, 0); assert.equal(b.circuits.length, 0);
});
