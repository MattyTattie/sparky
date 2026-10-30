// v0.43.1: JB-to-switch lanes nest so no cable tail crosses another room's drop. Made-up data.
import test from 'node:test'; import assert from 'node:assert/strict';
import { layout, diagramModel } from '../js/wiring.js';
import { diagramEICSwitches } from './diagram-sample.mjs';
const rooms = [['Landing', 1, 0, 1], ['Bedroom 1', 2, 1, 0], ['En-suite', 2, 2, 0], ['Bathroom', 1, 1, 0]].map(([name, lights, sw1, sw2pairs]) => ({ name, lights, sw1, sw2pairs, swi: 0, wiring: 'jb-switch' }));
const cert = () => { const c = diagramEICSwitches(); const l = c.boards[0].circuits.find((x) => String(x.num) === '2'); c.boards[0].circuits = [l]; l.diagram = { roomList: rooms }; return c; };
for (const [nm, o] of [['screen', { W: 380, font: 12, screen: true }], ['pdf', { W: 560, font: 11 }]]) test('no lane crossings (' + nm + ')', () => {
  const sh = layout(diagramModel(cert()), o).blocks.flatMap((b) => b.shapes).filter((z) => z.t === 'line' && z.w === 1.2);
  const v = sh.filter((z) => z.x1 === z.x2 && Math.abs(z.y2 - z.y1) > 1);
  const lanes = v.filter((z) => sh.some((hz) => hz.y1 === hz.y2 && hz.x1 === z.x1 && Math.abs(hz.y1 - Math.max(z.y1, z.y2)) < 0.01));
  assert.ok(lanes.length >= 4, 'lanes ' + lanes.length);
  for (const ln of lanes) { const y = Math.max(ln.y1, ln.y2); const tail = sh.find((hz) => hz.y1 === hz.y2 && hz.x1 === ln.x1 && Math.abs(hz.y1 - y) < 0.01);
    for (const o2 of lanes) { if (o2 === ln) continue; const lo = Math.min(o2.y1, o2.y2), hi = Math.max(o2.y1, o2.y2);
      const xa = Math.min(tail.x1, tail.x2), xb = Math.max(tail.x1, tail.x2);
      assert.ok(!(o2.x1 > xa && o2.x1 < xb && y > lo && y < hi), `tail at y=${y} crosses lane x=${o2.x1}`); } }
});
