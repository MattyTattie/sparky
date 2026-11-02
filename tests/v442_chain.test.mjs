// v0.44.2 (test): control circuit = one ordered list; simple per-room lists. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import * as W from '../js/wiring.js';
const mk = (num, desc, extra = {}) => ({ num, desc, device: 'mcb', type: 'B', rating: '16', live: '2.5', cpc: '1.5', points: '1', ...extra });
const lay = (cs) => W.layout(W.diagramModel({ type: 'EIC', boards: [{ id: 'b', ref: 'DB1', circuits: cs }] }), { W: 380, font: 12, screen: true });
const txt = (L, n) => L.blocks.find((b) => b.num === n).shapes.filter((z) => z.t === 'text');
const chain = (list) => [mk('3', 'Immersion'), mk('4', 'Radiators'), mk('6', 'Control', { rating: '6', diagram: { chain: list } })];
test('diagram draws the chain in exactly the list order', () => {
  const a = [{ k: 'sfcu' }, { k: 'shelly' }, { k: 'km', circuits: ['3'] }, { k: 'hive' }, { k: 'km', circuits: ['4'] }];
  const T1 = txt(lay(chain(a)), '6'); const y = (T, t) => T.find((z) => z.txt === t).y;
  assert.ok(y(T1, 'Shelly') < y(T1, 'Hive'));
  const b = [{ k: 'hive' }, { k: 'km', circuits: ['4'] }, { k: 'sfcu' }, { k: 'shelly' }, { k: 'km', circuits: ['3'] }];
  const T2 = txt(lay(chain(b)), '6'); assert.ok(y(T2, 'Hive') < y(T2, 'Shelly'), 'SFCU and controllers move freely');
  assert.ok(!T2.map((z) => z.txt).join(' ').includes('\u2026'));
});
test('migration from v0.44.1 controllers + SFCU item: SFCU first by default, clears old links', () => {
  const cs = [mk('7', 'Hot water', { control: { via: 'contactor', controlCircuit: '9' } }), mk('9', 'Control', { diagram: { items: { sfcu: 1, fan: 1 }, controllers: [{ type: 'shelly', contactors: [{ circuits: ['7'], label: 'HW' }] }] } })];
  const l = W.migrateChain(cs[1], cs); assert.deepEqual(l.map((x) => x.k), ['sfcu', 'shelly', 'km']); assert.equal(l[2].label, 'HW');
  assert.deepEqual(cs[1].diagram.items, { fan: 1 }); assert.equal(cs[1].diagram.controllers, undefined); assert.equal(cs[0].control, undefined);
  assert.ok(W.isControlCircuit(cs[1], cs));
});
test('KM numbers are counted across the whole board and match the diagram', () => {
  const cs = [mk('1', 'Control A', { diagram: { chain: [{ k: 'shelly' }, { k: 'km', circuits: ['5'] }] } }), mk('2', 'Control B', { diagram: { chain: [{ k: 'hive' }, { k: 'km', circuits: ['6'] }, { k: 'km', circuits: [] }] } }), mk('5', 'HW'), mk('6', 'Rads')];
  const n = W.kmNumbers(cs); assert.deepEqual(n.km, { '1:1': 'KM1', '2:1': 'KM2', '2:2': 'KM3' }); assert.equal(n.m['6'], 'KM2'); assert.equal(n.by['6'], '2');
  const L = lay(cs); assert.ok(txt(L, '2').some((z) => z.txt === 'KM3')); assert.match(txt(L, '6').map((z) => z.txt).join(' '), /KM2/);
});
test('removing a contactor clears the Controlled-by marking', () => {
  const cs = chain([{ k: 'shelly' }]); const L = lay(cs); assert.doesNotMatch(txt(L, '3').map((z) => z.txt).join(' '), /KM\d/);
});
test('itemOrder is respected; iconSvg returns svg', () => {
  assert.deepEqual(W.itemsOf({ items: { fan: 1, cooker: 2 }, itemOrder: ['cooker', 'fan'] }).map((x) => x[0]), ['cooker', 'fan']);
  for (const k of ['sfcu', 'shelly', 'hive', 'km', 'light']) assert.match(W.iconSvg(k), /^<svg/);
});
