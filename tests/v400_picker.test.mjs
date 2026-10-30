// v0.40 (test): room picker + switch-fed (JB to switch) rooms. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layout, diagramModel, roomListOf, ROOM_WIRING, arrangedOrder } from '../js/wiring.js';
import { diagramEICRooms } from './diagram-sample.mjs';
const texts = (L) => L.blocks.flatMap((b) => b.shapes.filter((z) => z.t === 'text').map((z) => z.txt));
test('jb-switch is a stored wiring value and survives roomListOf', () => {
  assert.ok(ROOM_WIRING['jb-switch']);
  const c = diagramEICRooms(); const l = c.boards[0].circuits.find((x) => String(x.num) === '2');
  l.diagram.roomList[0].wiring = 'jb-switch';
  assert.equal(roomListOf(l)[0].wiring, 'jb-switch');
  l.diagram.roomList[0].wiring = 'nonsense'; assert.equal(roomListOf(l)[0].wiring, 'loop-in');
});
test('switch-fed room draws JB, switch, lights and adds the key entry', () => {
  const c = diagramEICRooms(); const l = c.boards[0].circuits.find((x) => String(x.num) === '2');
  l.diagram.roomList.forEach((r) => { r.wiring = 'jb-switch'; });
  const L = layout(diagramModel(c), { W: 380, font: 12 }); const t = texts(L);
  assert.ok(t.includes('JB'));
  assert.ok(t.some((x) => /Cable from the circuit JB loops switch to switch/.test(x)));
  assert.ok(t.some((x) => /Switch-fed: JB to switch/.test(x)));
  assert.ok(t.some((x) => /strappers/.test(x)));
});
test('picker: circuit dropdown, room tick-list', () => {
  const s = readFileSync(new URL('../js/certui.js', import.meta.url), 'utf8');
  assert.match(s, /id: 'extrascircuit'/);
  for (const r of ['Kitchen', 'Bedroom 4', 'En-suite', 'Loft', 'Outside']) assert.ok(s.includes(`'${r}'`), r);
  assert.match(s, /Other\\u2026/); assert.match(s, /type: 'checkbox'/); assert.match(s, /'on circuit '/); assert.match(s, /On this circuit \(feed order\)/);
});
test('jb-switch rooms share ONE junction box; other rooms still daisy-chain', () => {
  const c = diagramEICRooms(); const l = c.boards[0].circuits.find((x) => String(x.num) === '2');
  l.diagram.roomList[0].wiring = 'jb-switch'; l.diagram.roomList[1].wiring = 'jb-switch';
  const L = layout(diagramModel(c), { W: 380, font: 12 });
  const blk = L.blocks.find((b) => b.shapes.some((z) => z.txt === 'Kitchen'));
  assert.equal(blk.shapes.filter((z) => z.t === 'text' && z.txt === 'JB').length, 2); // shared JB + the bathroom's own JB
});
test('arrange: optional diagram.layout.order reorders room boxes; reset = remove it', () => {
  const c = diagramEICRooms(); const l = c.boards[0].circuits.find((x) => String(x.num) === '2');
  const before = roomListOf(l).map((r) => r.name);
  l.diagram.layout = { order: [2, 0, 1] };
  assert.deepEqual(roomListOf(l).map((r) => r.name), [before[2], before[0], before[1]]);
  const L = layout(diagramModel(c), { W: 380, font: 12 }); const t = texts(L);
  assert.ok(t.indexOf(before[2]) < t.indexOf(before[0]));
  l.diagram.layout = { order: [9, 1, 1] }; assert.deepEqual(arrangedOrder(l), [1, 0, 2]);
  delete l.diagram.layout; assert.deepEqual(roomListOf(l).map((r) => r.name), before);
});
