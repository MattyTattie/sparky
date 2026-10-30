import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s = readFileSync(new URL('../js/certui.js', import.meta.url), 'utf8');
test('tick-list replaces the one-at-a-time picker', () => {
  assert.ok(!/Add next room/.test(s)); assert.match(s, /class: 'roomtick'/);
  for (const r of ['Living room', 'Dining room', 'Hall', 'Landing', 'Stairs', 'Bedroom 1', 'Bathroom', 'WC', 'Utility', 'Garage', 'Loft']) assert.ok(s.includes(`'${r}'`), r);
  assert.match(s, /'2-way \+ int'/); assert.match(s, /'on circuit ' \+ elsewhere/);
});
test('helpers keep the roomList format', async () => {
  globalThis.window = globalThis.window || undefined;
  const src = s.slice(s.indexOf('export function roomsOnOtherCircuits'), s.indexOf('function roomsEditor'));
  const m = await import('data:text/javascript,' + encodeURIComponent(src));
  assert.deepEqual(Object.keys(m.defaultRoom('Hall')).sort(), ['lights', 'name', 'sw1', 'sw2pairs', 'swi', 'wiring']);
  assert.equal(m.defaultRoom('Hall', 'jb-switch').wiring, 'jb-switch');
  assert.ok(m.roomIsDefault({ name: 'Hall', lights: 1, sw1: 1, sw2pairs: 0, swi: 0, wiring: 'loop-in' }));
  assert.ok(!m.roomIsDefault({ name: 'Hall', lights: 3, sw1: 1, sw2pairs: 0, swi: 0, wiring: 'loop-in' }));
  const a = { num: 1, diagram: { roomList: [{ name: 'Kitchen' }] } }, b = { num: 2, diagram: { roomList: [{ name: 'Hall' }] } };
  assert.deepEqual(m.roomsOnOtherCircuits([a, b], a), { Hall: '2' });
});
