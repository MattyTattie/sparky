// v20 stress (test): a made-up 4-board, 70-circuit cert lays out cleanly and fast.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as W from '../js/wiring.js';
const cert = JSON.parse(readFileSync(new URL('./stress-cert.json', import.meta.url), 'utf8'));
for (const o of [{ W: 380, font: 12, screen: true }, { W: 560, font: 11, cableTable: true }]) test(`stress cert lays out at W${o.W}`, () => {
  const t0 = performance.now(); const L = W.layout(W.diagramModel(cert), o); const ms = performance.now() - t0;
  assert.ok(ms < 2000, 'layout took ' + ms);
  const txt = L.blocks.flatMap((b) => b.shapes.filter((z) => z.t === 'text').map((z) => z.txt));
  assert.ok(!txt.some((t) => /\u2026|undefined|NaN/.test(t)));
  for (const r of ['DB1', 'DB2', 'DB3', 'DB4']) assert.ok(txt.some((t) => t.includes(r)), r);
  assert.ok(txt.some((t) => /Meter tail connector block/.test(t)));
  assert.ok(txt.some((t) => /\+ 59 more \(99 in total\)/.test(t)));
});
