// v0.43 (test): optional local isolator. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import { layout, diagramModel, isolatorOf, ISOLATORS } from '../js/wiring.js';
import { diagramEICSwitches } from './diagram-sample.mjs';
const texts = (L) => L.blocks.flatMap((b) => b.shapes.filter((z) => z.t === 'text').map((z) => z.txt));
test('isolatorOf: types, rating, none', () => {
  assert.equal(isolatorOf({}), null); assert.equal(isolatorOf({ diagram: { isolator: { type: 'bogus' } } }), null);
  assert.equal(isolatorOf({ diagram: { isolator: { type: 'dp20' } } }).label, '20A DP');
  assert.equal(isolatorOf({ diagram: { isolator: { type: 'dp45', rating: '50A' } } }).label, '50A DP');
  assert.equal(isolatorOf({ diagram: { isolator: { type: 'sfcu', rating: '13A' } } }).label, 'Switched FCU 13A');
  assert.equal(isolatorOf({ diagram: { isolator: { type: 'ufcu' } } }).switched, false);
  assert.equal(Object.keys(ISOLATORS).length, 5);
});
test('immersion with contactor and 20A DP draws label, key, screen and PDF', () => {
  const c = diagramEICSwitches(); const hw = c.boards[0].circuits.find((x) => /^Hot water/.test(x.desc));
  hw.diagram = { ...(hw.diagram || {}), isolator: { type: 'dp20' } };
  for (const o of [{ W: 380, font: 12, screen: true }, { W: 560, font: 11 }]) {
    const t = texts(layout(diagramModel(c), o));
    assert.ok(t.includes('20A DP')); assert.ok(t.some((x) => /^Local isolator/.test(x))); assert.ok(t.includes('KM1'));
  }
  const before = JSON.stringify(diagramEICSwitches()); assert.ok(!before.includes('isolator'), 'sample unchanged');
});
