// v0.44.3 (test): key labels line up; compact boxed editors. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import * as W from '../js/wiring.js'; import { readFileSync } from 'node:fs';
const mk = (num, desc, extra = {}) => ({ num, desc, device: 'mcb', type: 'B', rating: '16', live: '2.5', cpc: '1.5', points: '1', ...extra });
test('key labels start at the same x in each column', () => {
  const cs = [mk('1', 'Sockets', { points: '4' }), mk('2', 'Lights', { points: '3' }), mk('3', 'Immersion'), mk('6', 'Control', { diagram: { chain: [{ k: 'shelly' }, { k: 'km', circuits: ['3'] }, { k: 'hive' }] } })];
  const L = W.layout(W.diagramModel({ type: 'EIC', boards: [{ id: 'b', ref: 'DB1', circuits: cs }] }), { W: 380, font: 12, screen: true });
  const key = L.blocks.find((b) => b.kind === 'legend'); const xs = new Set(key.shapes.filter((z) => z.t === 'text' && z.size < 12 && z.anchor === 'start' && z.x > 20).map((z) => Math.round(z.x)));
  assert.ok(xs.size <= 2, 'two label columns: ' + [...xs]);
});
test('control editor: one box per controller with its contactors, inline arrows', () => {
  const src = readFileSync(new URL('../js/certui.js', import.meta.url), 'utf8');
  assert.match(src, /const kmRow = /); assert.match(src, /\+ Add contactor to /); assert.match(src, /const tinyBtn = /); assert.doesNotMatch(src, /class: 'moverow'/);
});
