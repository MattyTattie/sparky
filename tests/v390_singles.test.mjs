import test from 'node:test'; import assert from 'node:assert/strict';
import { layout, diagramModel, socketSingles } from '../js/wiring.js';
import { diagramEIC } from './diagram-sample.mjs';
const keyNames = (L) => L.blocks.find((b) => b.kind === 'legend').shapes.filter((z) => z.t === 'text').map((z) => z.txt);
test('sockets draw as twins by default; key shows Twin socket only', () => {
  const c = diagramEIC(); const L = layout(diagramModel(c), { W: 560, font: 11 });
  const k = keyNames(L); assert.ok(k.includes('Twin socket (switched)')); assert.ok(!k.includes('Single socket (switched)'));
  assert.equal(socketSingles(c.boards[0].circuits[0]), 0);
});
test('diagram.singles draws that many singles and adds both to the key', () => {
  const c = diagramEIC(); const ring = c.boards[0].circuits[0]; ring.points = '6'; ring.diagram = { singles: '2' };
  assert.equal(socketSingles(ring), 2);
  const L = layout(diagramModel(c), { W: 560, font: 11 });
  const k = keyNames(L); assert.ok(k.includes('Twin socket (switched)')); assert.ok(k.includes('Single socket (switched)'));
  // v0.43.9: sockets are front-view 13 A faceplates; switched outlets show a rocker each
  const blk = L.blocks.find((b) => b.shapes.some((z) => z.txt && /Sockets ground floor/.test(z.txt)));
  const strokes = blk.shapes.filter((z) => z.t === 'rect' && z.rocker).length;
  assert.equal(strokes, 4 * 2 + 2); // v0.43.9: pictorial faceplates: one rocker per switched outlet (twin = 2)
  ring.diagram = { singles: '99' }; assert.equal(socketSingles(ring), 6);
  const light = c.boards[0].circuits[1]; light.diagram = { singles: '2' }; assert.equal(socketSingles(light), 0);
});
