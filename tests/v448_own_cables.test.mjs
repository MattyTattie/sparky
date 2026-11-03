// v0.44.8: each string and the battery has its own cable from the inverter (no shared bus). Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict'; import * as W from '../js/wiring.js';
const mk = (d) => ({ num: '21', desc: 'Solar PV', device: 'mcb', type: 'B', rating: '32', live: '6.0', cpc: '2.5', points: '1', diagram: { items: d } });
for (const o of [{ W: 380, font: 12, screen: true }, { W: 560, font: 11 }]) for (const n of [2, 3]) test(`${n} strings + battery: ${n + 1} separate cables (${o.screen ? 'screen' : 'pdf'})`, () => {
  const c = W.layout(W.diagramModel({ type: 'EIC', boards: [{ id: 'b', ref: 'DB1', circuits: [mk({ aciso: 1, hybinv: 1, dciso: n, pvarray: n, battery: 1 })] }] }), o).blocks.find((b) => b.kind === 'circuit');
  const ln = c.shapes.filter((z) => z.t === 'line' && z.w === 1.1);
  const V = ln.filter((z) => Math.abs(z.x1 - z.x2) < 0.01 && Math.abs(z.y1 - z.y2) > 6);
  const by = {}; for (const v of V) (by[Math.min(v.y1, v.y2).toFixed(1)] ||= []).push(v); const drops = Object.values(by).sort((a, b) => b.length - a.length)[0];
  assert.equal(new Set(drops.map((v) => v.x1.toFixed(2))).size, n + 1, 'one drop per branch, each at its own point');
  const dx = drops.map((v) => v.x1), dy0 = Math.min(...drops.map((v) => Math.min(v.y1, v.y2))); assert.ok(!c.shapes.some((z) => z.t === 'circle' && z.fill && z.r < 2.5 && z.cx >= Math.min(...dx) - 3 && z.cx <= Math.max(...dx) + 60 && z.cy > dy0), 'no junction dots');
  const H = ln.filter((z) => Math.abs(z.y1 - z.y2) < 0.01 && Math.abs(z.x1 - z.x2) > 6); const inn = (v, a, b) => v > Math.min(a, b) + 0.5 && v < Math.max(a, b) - 0.5;
  for (const h of H) for (const v of V) assert.ok(!(inn(v.x1, h.x1, h.x2) && inn(h.y1, v.y1, v.y2)), 'crossing');
});
