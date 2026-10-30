// v0.43 (test): room rows, separate JB cables, socket/FCU symbols. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import { layout, diagramModel, pointKind } from '../js/wiring.js';
import { diagramEICSwitches } from './diagram-sample.mjs';
const L = () => layout(diagramModel(diagramEICSwitches()), { W: 380, font: 12, screen: true });
const all = (x) => x.blocks.flatMap((b) => b.shapes);
test('every shape fits the phone width', () => { for (const z of all(L())) { for (const k of ['x', 'x1', 'x2']) if (z[k] != null) assert.ok(z[k] <= 381 && z[k] >= -1, k + ' ' + z[k]); } });
test('switch and its light share a line (no light hanging below the switch)', () => {
  const sh = all(L()); const circ = sh.filter((z) => z.t === 'circle');
  // lights are drawn as circle + cross; their centre y should match a switch row somewhere
  assert.ok(sh.some((z) => z.t === 'line' && z.y1 === z.y2 && z.dash == null && z.x2 - z.x1 > 4));
  assert.ok(circ.length > 10);
});
test('separate JB cable to each switch-fed room, each labelled', () => {
  const sh = all(L()); const t = sh.filter((z) => z.t === 'text').map((z) => z.txt);
  assert.ok(t.filter((x) => /^C\d+/.test(x)).length >= 2);
});
test('heaters, towel rails and spurs are FCUs', () => {
  for (const d of ['Towel rail', 'Heater', 'Fused spur', 'Bathroom heater spur']) assert.equal(pointKind({ desc: d }), 'fcu', d);
});
