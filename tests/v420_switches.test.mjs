// v0.42 (test): per-switch lights, level 2-way rows, IEC contactor. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import { layout, diagramModel, switchGroups, roomListOf, pointKind, controlTags } from '../js/wiring.js';
import { diagramEICSwitches } from './diagram-sample.mjs';
const texts = (L) => L.blocks.flatMap((b) => b.shapes.filter((z) => z.t === 'text').map((z) => z.txt));
test('lights shared evenly across switches; optional split honoured', () => {
  assert.deepEqual(switchGroups({ lights: 2, sw1: 2 }).map((g) => g.lights), [1, 1]);
  assert.deepEqual(switchGroups({ lights: 3, sw1: 2 }).map((g) => g.lights), [2, 1]);
  assert.deepEqual(switchGroups({ lights: 3, sw1: 2, split: [0, 3] }).map((g) => g.lights), [0, 3]);
  assert.deepEqual(switchGroups({ lights: 3, sw1: 2, split: [1, 1] }).map((g) => g.lights), [2, 1], 'bad split ignored');
  assert.deepEqual(switchGroups({ lights: 3, sw2pairs: 1, swi: 1 })[0].sw, ['sw2', 'swi', 'sw2']);
  assert.deepEqual(switchGroups({ lights: 2 }), [{ sw: [], lights: 2 }]);
});
test('split survives roomListOf', () => {
  const c = diagramEICSwitches(); const l = c.boards[0].circuits.find((x) => String(x.num) === '2');
  l.diagram.roomList[0].split = [1, 1]; assert.deepEqual(roomListOf(l).find((r) => r.name === 'En-suite').split, [1, 1]);
});
test('2-way strappers are level and every room draws', () => {
  const c = diagramEICSwitches(); const L = layout(diagramModel(c), { W: 380, font: 12, screen: true });
  const sh = L.blocks.flatMap((b) => b.shapes);
  const strap = sh.filter((z) => z.t === 'line' && z.w === 1 && z.y1 === z.y2);
  assert.ok(strap.length >= 6); assert.ok(sh.filter((z) => z.t === 'line' && z.w === 1 && z.y1 !== z.y2 && z.x1 !== z.x2 && z.color && String(z.color) === String(strap[0].color)).length === 0, 'no sloped strappers');
  for (const r of ['En-suite', 'Hall', 'Landing', 'Bedroom']) assert.ok(texts(L).some((t) => t.includes(r)), r);
  assert.ok(!texts(L).some((t) => t.includes('\u2026')));
});
test('hot water / boost / HW / cylinder guess immersion', () => {
  for (const d of ['Hot water', 'Boost hot water', 'HW', 'Cylinder']) assert.equal(pointKind({ desc: d }), 'immersion', d);
});
test('IEC contactor: KM1/KM2 labels, coil A1/A2, time clock, on-screen hint only', () => {
  const c = diagramEICSwitches();
  assert.deepEqual(controlTags(c.boards[0].circuits), { 8: 'KM1', 9: 'KM2' });
  const S = texts(layout(diagramModel(c), { W: 380, font: 12, screen: true }));
  for (const t of ['KM1', 'KM2', 'A1', 'A2', 'TC', 'Set the coil circuit in Controlled by']) assert.ok(S.includes(t), t);
  assert.ok(S.some((t) => /Time clock/.test(t)));
  const P = texts(layout(diagramModel(c), { W: 560, font: 11 }));
  assert.ok(!P.includes('Set the coil circuit in Controlled by')); assert.ok(P.some((t) => t.includes('Coil supply: N/A')));
});
