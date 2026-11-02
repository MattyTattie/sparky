// v0.44.5: Hob, Oven, Combi oven items. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict'; import * as W from '../js/wiring.js';
const mk = (num, desc, extra = {}) => ({ num, desc, device: 'mcb', type: 'B', rating: '32', live: '6.0', cpc: '2.5', points: '3', ...extra });
const lay = (cs, o = { W: 380, font: 12, screen: true }) => W.layout(W.diagramModel({ type: 'EIC', boards: [{ id: 'b', ref: 'DB1', circuits: cs }] }), o);
const texts = (b) => b.shapes.filter((z) => z.t === 'text').map((z) => z.txt);
test('new item kinds are pickable, cooker kept', () => {
  for (const [k, n] of [['hob', 'Hob'], ['oven', 'Oven'], ['combi', 'Combi oven'], ['cooker', 'Cooker']]) assert.equal(W.ITEM_KINDS[k], n);
});
for (const o of [{ W: 380, font: 12, screen: true }, { W: 560, font: 11 }]) test('all three draw on one circuit with labels and key entries (' + (o.screen ? 'screen' : 'pdf') + ')', () => {
  const L = lay([mk('7', 'Kitchen cooking', { diagram: { items: { hob: 1, oven: 1, combi: 1 } } })], o);
  const c = L.blocks.find((b) => b.kind === 'circuit'); const t = texts(c);
  for (const w of ['Hob', 'Oven', 'Combi']) assert.ok(t.includes(w), w);
  const key = texts(L.blocks.find((b) => b.kind === 'legend')).join('|');
  for (const w of ['Hob', 'Oven', 'Combi oven']) assert.ok(key.includes(w), w);
  for (const z of c.shapes) if (z.t === 'rect' || z.t === 'line') assert.ok(Math.max(z.x ?? z.x1, z.x2 ?? 0) <= o.W + 0.5, 'fits width');
});
test('icons render the same size as cooker', () => {
  const sz = (k) => W.iconSvg(k).match(/width="(\d+)"/)[1];
  for (const k of ['hob', 'oven', 'combi']) { assert.equal(sz(k), sz('cooker')); assert.ok(W.iconSvg(k).length > 200, k); assert.notEqual(W.iconSvg(k), W.iconSvg('cooker')); }
  assert.notEqual(W.iconSvg('oven'), W.iconSvg('combi'));
});
test('single oven draws inline, Points names it', () => {
  const t = texts(lay([mk('7', 'Oven', { points: '1', diagram: { items: { oven: 1 } } })]).blocks.find((b) => b.kind === 'circuit'));
  assert.ok(t.some((x) => /1 × oven$/.test(x))); assert.ok(t.includes('Oven'));
});
