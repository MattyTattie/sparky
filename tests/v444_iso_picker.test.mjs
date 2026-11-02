import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../js/certui.js', import.meta.url), 'utf8');
const m = src.match(/export function isoSummary[^\n]+/)[0];
const ISOLATORS = { dp20: '20 A DP switch', sfcu: 'Switched FCU' };
const isoSummary = new Function('ISOLATORS', m.replace('export ', '') + '; return isoSummary;')(ISOLATORS);
test('isolator summary shows type and rating', () => {
  assert.equal(isoSummary({ type: 'sfcu', rating: '13A' }), 'Switched FCU 13A');
  assert.equal(isoSummary({ type: 'dp20' }), '20 A DP switch');
  assert.equal(isoSummary(null), 'None'); assert.equal(isoSummary(''), 'None');
});
test('summary updates live and no duplicate Local isolator label', () => {
  assert.match(src, /isolatorRow\(c, save, \(v\) => \{ isoSum\.textContent = isoSummary\(v\)/);
  assert.doesNotMatch(src, /h\('span', \{\}, 'Local isolator'\), sel/);
});
test('picker tiles have no hard-coded white background; CSS covers both modes', () => {
  assert.doesNotMatch(src, /class: 'tile'[^\n]*background:#fff/);
  assert.match(readFileSync(new URL('../dark.css', import.meta.url), 'utf8'), /html\.dark \.modal\.picker \.tile \{[^}]*color: #fff/);
  assert.match(readFileSync(new URL('../styles.css', import.meta.url), 'utf8'), /\.modal\.picker \.tile \{[^}]*color: #10131a/);
});
import * as W from '../js/wiring.js';
const mk = (num, desc, extra = {}) => ({ num, desc, device: 'mcb', type: 'B', rating: '20', live: '2.5', cpc: '1.5', points: '1', ...extra });
const lay = (cs) => W.layout(W.diagramModel({ type: 'EIC', boards: [{ id: 'b', ref: 'DB1', circuits: cs }] }), { W: 380, font: 12, screen: true });
const txt = (c) => lay([c]).blocks.filter((b) => b.kind === 'circuit').flatMap((b) => b.shapes.filter((z) => z.t === 'text').map((z) => z.txt));
test('name guess becomes real list items', () => {
  assert.deepEqual(W.guessedItems(mk('22', 'Living Room Radiator')), { items: { fcu: 1, heater: 1 }, itemOrder: ['fcu', 'heater'] });
  assert.equal(W.guessedItems(mk('22', 'Living Room Radiator', { diagram: { items: {} } })), null);
});
test('emptied item list draws no guessed load; listed items draw once', () => {
  assert.ok(!txt(mk('22', 'Living Room Radiator', { diagram: { items: {} } })).includes('Rad'));
  assert.equal(txt(mk('22', 'Living Room Radiator', { diagram: { items: { heater: 1 } } })).filter((t) => t === 'Rad').length, 1);
});
test('chosen isolator is drawn', () => {
  assert.ok(txt(mk('22', 'Living Room Radiator', { diagram: { isolator: { type: 'sfcu', rating: '13A' } } })).includes('13A SFCU'));
});
