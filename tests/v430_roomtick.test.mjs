import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s = readFileSync(new URL('../js/certui.js', import.meta.url), 'utf8');
test('tick-list replaces the one-at-a-time picker', () => {
  assert.ok(!/Add next room/.test(s)); assert.match(s, /class: 'roomtick'/);
  for (const r of ['Living room', 'Dining room', 'Hall', 'Landing', 'Stairs', 'Bedroom 1', 'Bathroom', 'WC', 'Utility', 'Garage', 'Loft']) assert.ok(s.includes(`'${r}'`), r);
  assert.match(s, /'2W\+int'/); assert.match(s, /JB\\u2192sw/); assert.match(s, /'on circuit ' \+ elsewhere/);
});
test('helpers keep the roomList format', async () => {
  globalThis.window = globalThis.window || undefined;
  const src = s.slice(s.indexOf('export function roomsOnOtherCircuits'), s.indexOf('function roomsEditor'));
  const m = await import('data:text/javascript,' + encodeURIComponent(`import { pointKind } from '${new URL('../js/wiring.js', import.meta.url)}';\n` + src));
  assert.deepEqual(Object.keys(m.defaultRoom('Hall')).sort(), ['lights', 'name', 'sw1', 'sw2pairs', 'swi', 'wiring']);
  assert.equal(m.defaultRoom('Hall', 'jb-switch').wiring, 'jb-switch');
  assert.ok(m.roomIsDefault({ name: 'Hall', lights: 1, sw1: 1, sw2pairs: 0, swi: 0, wiring: 'loop-in' }));
  assert.ok(!m.roomIsDefault({ name: 'Hall', lights: 3, sw1: 1, sw2pairs: 0, swi: 0, wiring: 'loop-in' }));
  const a = { num: 1, diagram: { roomList: [{ name: 'Kitchen' }] } }, b = { num: 2, diagram: { roomList: [{ name: 'Hall' }] } };
  assert.deepEqual(m.roomsOnOtherCircuits([a, b], a), { Hall: '2' });
});
test('v0.43.2: junk room names (old room counts like "5") are ignored', async () => {
  const src = s.slice(s.indexOf('export function roomsOnOtherCircuits'), s.indexOf('function roomsEditor'));
  const m = await import('data:text/javascript,' + encodeURIComponent(`import { pointKind } from '${new URL('../js/wiring.js', import.meta.url)}';\n` + src));
  assert.ok(!m.isRoomName('5')); assert.ok(!m.isRoomName(' ')); assert.ok(m.isRoomName('Bedroom 1'));
  assert.deepEqual(m.roomsOnOtherCircuits([{ num: 1, diagram: { roomList: [{ name: '5' }, { name: 'Hall' }] } }], null), { Hall: '1' });
  assert.match(s, /Show' : 'Hide'|'Hide' : 'Show'/); assert.match(s, /rooms on other circuits \(/);
  assert.match(s, /choose which circuit feeds the contactor coil/);
});
