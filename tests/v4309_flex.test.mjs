// v0.43.9 (test): FCU / SFCU flex outlet only when described; one FCU key entry. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import * as W from '../js/wiring.js';
const mk = (num, desc, extra = {}) => ({ num, desc, device: 'rcbo', type: 'B', rating: '16', live: '2.5', cpc: '1.5', points: '1', rcdIdn: '30', rcdType: 'A', ...extra });
const lay = (cs) => W.layout(W.diagramModel({ type: 'EIC', boards: [{ id: 'b', ref: 'DB1', circuits: cs }] }), { W: 380, font: 12, screen: true });
const key = (L) => L.blocks.find((b) => b.kind === 'legend').shapes.filter((z) => z.t === 'text').map((z) => z.txt).join(' ');
test('flex outlet drawn only when the description says flex; key names it only then', () => {
  assert.equal(W.isoFor(mk('1', 'Towel rail', { diagram: { isolator: { type: 'sfcu' } } })).flex, false);
  assert.equal(W.isoFor(mk('1', 'Towel rail FCU flex', { diagram: { isolator: { type: 'sfcu' } } })).flex, true);
  const k1 = key(lay([mk('1', 'Boiler', { diagram: { isolator: { type: 'ufcu' } } })]));
  assert.match(k1, /Unswitched fused connection unit \(FCU\)/); assert.ok(!/flex outlet/.test(k1));
  const k2 = key(lay([mk('1', 'Boiler flex', { diagram: { isolator: { type: 'ufcu' } } }), mk('2', 'Towel rail', { diagram: { isolator: { type: 'sfcu' } } })]));
  assert.match(k2, /\(FCU\) with flex outlet/); assert.match(k2, /Switched fused connection unit \(SFCU\)/);
});
