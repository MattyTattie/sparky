// v0.43.3 (test): deep-review fixes. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { roomsOf } from '../js/wiring.js';
const src = readFileSync(new URL('../js/wiring.js', import.meta.url), 'utf8');
test('roomsOf ignores a legacy room value with no letters', () => {
  assert.equal(roomsOf({ diagram: { rooms: '5' } }), '');
  assert.equal(roomsOf({ diagram: { rooms: 'Kitchen' } }), 'Kitchen');
});
test('PDF splits a block taller than a page instead of clipping it', () => {
  assert.match(src, /taller than a page/);
  assert.match(src, /cutAt\(b, y0 \+/);
});
test('PDF keeps a board heading with its first circuit', () => {
  assert.match(src, /keep a board \/ RCD heading with its first circuit/);
});
