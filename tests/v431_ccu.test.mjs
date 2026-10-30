// v0.43.1: cooker control unit as a local isolator. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import { layout, diagramModel, isolatorOf, ISOLATORS } from '../js/wiring.js';
import { diagramEICSwitches } from './diagram-sample.mjs';
test('CCU option, default label and rating override', () => {
  assert.ok(ISOLATORS.ccu);
  assert.equal(isolatorOf({ diagram: { isolator: { type: 'ccu' } } }).label, '45A CCU');
  assert.equal(isolatorOf({ diagram: { isolator: { type: 'ccu', rating: '50A' } } }).label, '50A CCU');
});
for (const [nm, o] of [['screen', { W: 380, font: 12, screen: true }], ['pdf', { W: 560, font: 11 }]]) test('CCU drawn with box, socket and key (' + nm + ')', () => {
  const c = diagramEICSwitches(); const k = c.boards[0].circuits.find((x) => String(x.num) === '3') || c.boards[0].circuits[2];
  k.diagram = { ...(k.diagram || {}), isolator: { type: 'ccu' } };
  const all = layout(diagramModel(c), o).blocks.flatMap((b) => b.shapes); const t = all.filter((z) => z.t === 'text').map((z) => z.txt).join('|');
  assert.match(t, /45A CCU/); assert.match(t, /Cooker control unit/);
});
test('FCU labels short', () => {
  assert.equal(isolatorOf({ diagram: { isolator: { type: 'sfcu', rating: '13 A' } } }).label, '13A SFCU');
  assert.equal(isolatorOf({ diagram: { isolator: { type: 'ufcu' } } }).label, '13A FCU');
});
for (const [nm, o] of [['screen', { W: 380, font: 12, screen: true }], ['pdf', { W: 560, font: 11 }]]) test('radiator + switched FCU: box sits on the conductor, heater load, no stray point (' + nm + ')', () => {
  const c = diagramEICSwitches(); const k = c.boards[0].circuits.find((x) => String(x.num) === '3'); c.boards[0].circuits = [k];
  k.desc = 'Kitchen radiator'; k.points = '1'; k.diagram = { isolator: { type: 'sfcu', rating: '13 A' } };
  const sh = layout(diagramModel(c), o).blocks.flatMap((b) => b.shapes);
  const run = sh.filter((z) => z.t === 'line' && z.y1 === z.y2 && z.w === 1.1); assert.ok(run.length);
  const cy = run[run.length - 1].y1;
  const boxes = sh.filter((z) => z.t === 'rect' && z.lw === 1 && z.y < cy && z.y + z.h > cy);
  assert.ok(boxes.length >= 2, 'FCU box (and heater box) straddle the conductor');
  assert.ok(!sh.some((z) => z.t === 'circle' && Math.abs((z.cy ?? z.y) - cy) < 1 && z.r < 3), 'no point dot on the run');
});
