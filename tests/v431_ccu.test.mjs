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
