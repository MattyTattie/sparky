// v0.44.1 (test): Controllers list on control circuits. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import * as W from '../js/wiring.js';
import { readFileSync } from 'node:fs';
const mk = (num, desc, extra = {}) => ({ num, desc, device: 'mcb', type: 'B', rating: '16', live: '2.5', cpc: '1.5', points: '1', ...extra });
const lay = (cs, w = 380) => W.layout(W.diagramModel({ type: 'EIC', boards: [{ id: 'b', ref: 'DB1', circuits: cs }] }), { W: w, font: 12, screen: true });
const crossings = (L) => { let n = 0; for (const b of L.blocks) { const ls = b.shapes.filter((z) => z.t === 'line' && !z.dash && (z.x1 === z.x2 || z.y1 === z.y2));
  const H = ls.filter((z) => z.y1 === z.y2 && z.x1 !== z.x2), V = ls.filter((z) => z.x1 === z.x2 && z.y1 !== z.y2);
  for (const h of H) for (const v of V) { const [a, bb] = [Math.min(h.x1, h.x2), Math.max(h.x1, h.x2)], [c, d] = [Math.min(v.y1, v.y2), Math.max(v.y1, v.y2)];
    if (v.x1 > a + 0.5 && v.x1 < bb - 0.5 && h.y1 > c + 0.5 && h.y1 < d - 0.5) n++; } } return n; };
const house = () => [mk('3', 'Immersion', { rating: '16' }), mk('4', 'Radiators'), mk('6', 'Control circuit', { rating: '6', diagram: { controllers: [
  { type: 'shelly', contactors: [{ circuits: ['3'], label: 'Hot water' }] }, { type: 'hive', contactors: [{ circuits: ['4'] }] }] } })];
test('Shelly and Hive each get their own branch with their own contactor', () => {
  const L = lay(house()); const blk = L.blocks.find((b) => b.num === '6'); const T = blk.shapes.filter((z) => z.t === 'text');
  const at = (t) => T.find((z) => z.txt === t); for (const t of ['Shelly', 'Hive', 'KM1', 'KM2']) assert.ok(at(t), t);
  assert.ok(at('Shelly').y < at('Hive').y && at('KM1').y < at('KM2').y); assert.ok(at('KM1').x > at('Shelly').x);
  const all = T.map((z) => z.txt).join(' '); assert.match(all, /Switches/); assert.match(all, /Hot water/); assert.ok(!all.includes('\u2026'));
  assert.equal(crossings(L), 0);
  const boxes = blk.shapes.filter((z) => z.t === 'rect' && z.h > 10 && z.w < 40); assert.equal(new Set(boxes.map((b) => Math.round(b.w) + 'x' + Math.round(b.h))).size, 1, 'same size');
  const r3 = L.blocks.find((b) => b.num === '3').shapes.filter((z) => z.t === 'text').map((z) => z.txt).join(' '); assert.match(r3, /Switched by contactor KM1 \(see control circuit 6\)/);
});
test('key has Hive and contactor; several contactors per controller', () => {
  const cs = house(); cs[2].diagram.controllers[1].contactors.push({ circuits: [], label: 'Towel rails' });
  const L = lay(cs); const key = L.blocks.find((b) => b.kind === 'legend').shapes.filter((z) => z.t === 'text').map((z) => z.txt).join(' ');
  assert.match(key, /Hive heating controller/); assert.match(key, /Contactor/); assert.match(key, /Shelly/);
  assert.ok(L.blocks.find((b) => b.num === '6').shapes.some((z) => z.t === 'text' && z.txt === 'KM3')); assert.equal(crossings(L), 0);
});
test('migration: old Shelly/km items and Controlled-by links kept', () => {
  const cs = [mk('7', 'Hot water', { control: { via: 'contactor', controlCircuit: '9' } }), mk('9', 'Control', { diagram: { items: { shelly: 1, km: 1, fan: 1 } } })];
  const list = W.controllersOf(cs[1], cs); assert.equal(list.length, 1); assert.equal(list[0].type, 'shelly'); assert.deepEqual(list[0].contactors.map((x) => x.circuits), [['7'], []]);
  W.migrateControllers(cs[1], cs); assert.deepEqual(cs[1].diagram.items, { fan: 1 }); assert.equal(cs[1].diagram.controllers.length, 1);
  assert.ok(W.isControlCircuit(mk('5', 'Time clock control'), [])); assert.ok(!W.isControlCircuit(mk('5', 'Sockets'), []));
  assert.deepEqual(W.controllersOf({ diagram: { controllers: [{ type: 'bogus', contactors: 'x' }, null] } }, []), [{ type: 'other', name: '', contactors: [] }]);
});
test('editor: add controller picker, remove buttons, tick boxes, items hidden on control circuits', () => {
  const src = readFileSync(new URL('../js/certui.js', import.meta.url), 'utf8');
  assert.match(src, /\+ Add controller/); assert.match(src, /Remove controller/); assert.match(src, /Remove contactor/); assert.match(src, /\+ Add contactor/);
  assert.match(src, /ctlC \? null : itemsEditor/); assert.deepEqual(Object.keys(W.CONTROLLER_KINDS).slice(0, 4), ['hive', 'shelly', 'timeclock', 'other']);
});
