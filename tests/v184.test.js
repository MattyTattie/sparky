import { test } from 'node:test'; import assert from 'node:assert';
import { autoNA, isRingCircuit } from '../js/templates.js';
import { stepDone, progress } from '../js/testlist.js';
const radial = { num: '4', desc: 'Cooker', r1: '', rn: '', r2: '', zs: '0.4' };
const ring = { num: '1', desc: 'Sockets', ring: true, r1: '', rn: '', r2: '' };
test('v0.18.4 non-ring circuit: empty r1/rn/r2 are automatic N/A, typed values kept', () => {
  for (const k of ['r1', 'rn', 'r2']) assert.equal(autoNA(radial, k), true);
  assert.equal(autoNA({ ...radial, ring: false, r1: '0.3' }, 'r1'), false);
  assert.equal(autoNA(radial, 'zs'), false); assert.equal(autoNA(radial, 'r1r2'), false);
});
test('v0.18.4 ring circuit still needs real readings', () => {
  for (const k of ['r1', 'rn', 'r2']) assert.equal(autoNA(ring, k), false);
  assert.equal(isRingCircuit({ desc: 'Ring final kitchen' }), true);
  assert.equal(autoNA({ ...radial, ring: true }, 'r1'), false); // marking it a ring clears the auto N/A
  assert.equal(stepDone(ring, 'ring'), false);
  const p = progress({ circuits: [radial, ring] }, 'ring'); assert.deepEqual(p, { need: 1, done: 0 });
});
test('v0.18.4 stored data is untouched (placeholder only)', () => { const c = { ...radial }; autoNA(c, 'r1'); assert.deepEqual(c, radial); });
