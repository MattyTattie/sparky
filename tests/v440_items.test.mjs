// v0.44.0 (test): rooms + any item on every circuit, contactor chain, Shelly, fan drop, IP badge. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import * as W from '../js/wiring.js';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../js/certui.js', import.meta.url), 'utf8');
const UI = await import('data:text/javascript,' + encodeURIComponent(`import { pointKind, ITEM_KINDS } from '${new URL('../js/wiring.js', import.meta.url)}';\n` + src.slice(src.indexOf('export function roomsOnOtherCircuits'), src.indexOf('function roomsEditor'))));
const { defaultRoom, roomIsDefault, cleanItems } = UI;
const mk = (num, desc, extra = {}) => ({ num, desc, device: 'rcbo', type: 'B', rating: '16', live: '2.5', cpc: '1.5', points: '1', rcdIdn: '30', rcdType: 'A', ...extra });
const lay = (cs, w = 380) => W.layout(W.diagramModel({ type: 'EIC', boards: [{ id: 'b', ref: 'DB1', circuits: cs }] }), { W: w, font: 12, screen: true });
const texts = (L) => L.blocks.flatMap((b) => b.shapes.filter((z) => z.t === 'text').map((z) => z.txt));
const crossings = (L) => { let n = 0; for (const b of L.blocks) { const ls = b.shapes.filter((z) => z.t === 'line' && !z.dash && (z.x1 === z.x2 || z.y1 === z.y2));
  const H = ls.filter((z) => z.y1 === z.y2 && z.x1 !== z.x2), V = ls.filter((z) => z.x1 === z.x2 && z.y1 !== z.y2);
  for (const h of H) for (const v of V) { const [a, bb] = [Math.min(h.x1, h.x2), Math.max(h.x1, h.x2)], [c, d] = [Math.min(v.y1, v.y2), Math.max(v.y1, v.y2)];
    if (v.x1 > a + 0.5 && v.x1 < bb - 0.5 && h.y1 > c + 0.5 && h.y1 < d - 0.5) n++; } } return n; };
test('itemsOf / itemRoomsOf: rooms on any circuit, items clamped', () => {
  assert.deepEqual(W.itemsOf({ items: { shelly: 1, km: '2', bogus: 3, fan: 0 } }), [['km', 2], ['shelly', 1]]);
  const c = mk('4', 'Kitchen radiator', { diagram: { roomList: [{ name: 'Kitchen', items: { heater: 2, sfcu: 1 } }, { name: 'Hall' }] } });
  const r = W.itemRoomsOf(c); assert.equal(r.length, 2); assert.deepEqual(r[0].items, [['sfcu', 1], ['heater', 2]]);
  assert.equal(W.itemRoomsOf(mk('1', 'Lights', { diagram: { roomList: [{ name: 'Hall' }] } })), null, 'lighting keeps its own rooms');
  assert.deepEqual(cleanItems({ km: 12, light: -1, x: 2 }), { km: 10 });
  assert.deepEqual(defaultRoom('Hall', 'loop-in', 'other'), { name: 'Hall' });
  assert.equal(roomIsDefault({ name: 'Hall', items: { fan: 1 } }, 'loop-in', 'other'), false);
  assert.equal(roomIsDefault({ name: 'Hall', lights: 1, sw1: 1, sw2pairs: 0, swi: 0, wiring: 'loop-in', items: { shelly: 1 } }), false);
});
test('item rooms draw on a radiator circuit, every item in the key, no crossings', () => {
  const L = lay([mk('4', 'Radiators', { diagram: { roomList: [{ name: 'Kitchen', items: { heater: 2, sfcu: 1 } }, { name: 'Garden', items: { socket1: 1, light: 1 } }] } })]);
  const T = texts(L); for (const t of ['Kitchen', 'Garden', 'IP']) assert.ok(T.some((x) => x.includes(t)), t);
  const key = L.blocks.find((b) => b.kind === 'legend'); const kt = key.shapes.filter((z) => z.t === 'text').map((z) => z.txt).join(' ');
  assert.match(kt, /SFCU/); assert.match(kt, /Heater/); assert.equal(crossings(L), 0); assert.ok(!T.some((t) => t.includes('\u2026')));
});
test('control circuit (v0.44.1): old Shelly item + links become Shelly -> KM1, KM2 branch, same size boxes', () => {
  const cs = [mk('7', 'Immersion top', { control: { via: 'contactor', controlCircuit: '9' } }), mk('8', 'Immersion bottom', { control: { via: 'contactor', controlCircuit: '9' } }),
    mk('9', 'Control circuit', { points: '2', rating: '6', live: '1.5', cpc: '1.0', diagram: { items: { shelly: 1 } } })];
  const L = lay(cs); const blk = L.blocks.find((b) => b.num === '9'); const T = blk.shapes.filter((z) => z.t === 'text').map((z) => z.txt);
  for (const t of ['Shelly', 'KM1', 'KM2']) assert.ok(T.includes(t), t);
  const at = (t) => blk.shapes.find((z) => z.t === 'text' && z.txt === t); assert.ok(at('Shelly').x < at('KM1').x && at('KM1').y < at('KM2').y, 'Shelly then KM1 over KM2');
  const boxes = blk.shapes.filter((z) => z.t === 'rect' && z.h > 10 && z.w < 40); const sz = new Set(boxes.map((b) => Math.round(b.w) + 'x' + Math.round(b.h))); assert.equal(sz.size, 1, 'same size');
  assert.equal(crossings(L), 0);
});
test('editor: room tick boxes for every circuit kind, add-item picker on every room and circuit', () => {
  assert.match(src, /roomsEditor\(c, redraw, [^\n]*'other'\)/); assert.match(src, /'\+ Add an item\\u2026'/); assert.match(src, /Other items on this circuit/);
  assert.equal((src.match(/itemsEditor\(r\.items, r\.name, setItems\)/g) || []).length, 3, 'light, socket and other rooms');
});
test('any item on any circuit: extras on a lighting room and a socket room', () => {
  const L = lay([mk('1', 'Lights', { rating: '6', live: '1.5', points: '2', diagram: { roomList: [{ name: 'Hall', lights: 2, sw1: 1, items: { alarm: 1 } }] } }),
    mk('2', 'Sockets radial', { rating: '20', points: '2', diagram: { roomList: [{ name: 'Kitchen', sockets: 2, items: { fcu: 1, km: 1 } }] } })]);
  const used = L.blocks.find((b) => b.kind === 'legend').shapes.filter((z) => z.t === 'text').map((z) => z.txt).join(' ');
  assert.match(used, /alarm/i); assert.match(used, /Contactor/); assert.equal(crossings(L), 0);
});
test('humidistat fan in a switch-fed room with no lights drops straight down its lane', () => {
  const L = lay([mk('3', 'Lights', { rating: '6', live: '1.5', points: '3', diagram: { roomList: [{ name: 'Bath', lights: 2, sw1: 1, wiring: 'jb-switch' }, { name: 'WC', lights: 0, sw1: 0, wiring: 'jb-switch', fans: 1, fanCtl: 'humidistat' }] } })]);
  const sh = L.blocks.find((b) => b.num === '3').shapes; const rh = sh.find((z) => z.t === 'text' && z.txt === '%RH');
  const fy = rh.y - 12 * 0.3 * 0.8 * 0 ; void fy;
  // the lane comes down to the fan's row: a vertical line ends level with the %RH box centre, then one horizontal into it
  const box = sh.find((z) => z.t === 'rect' && Math.abs(z.x + z.w / 2 - rh.x) < 0.6); const cy = box.y + box.h / 2;
  assert.ok(sh.some((z) => z.t === 'line' && z.x1 === z.x2 && Math.abs(Math.max(z.y1, z.y2) - cy) < 0.6 && z.x1 < box.x), 'vertical lane ends at the fan row');
  assert.equal(crossings(L), 0);
});
test('IP badge sits on the outdoor socket plate (white on blue)', () => {
  const L = lay([mk('5', 'Sockets radial', { rating: '20', points: '1', diagram: { roomList: [{ name: 'Garden', sockets: 1 }] } })]);
  const sh = L.blocks.flatMap((b) => b.shapes); const t = sh.find((z) => z.t === 'text' && z.txt === 'IP');
  assert.deepEqual(t.color, [255, 255, 255]); assert.ok(sh.some((z) => z.t === 'rect' && String(z.fill) === String(W.COL.brand) && t.x > z.x && t.x < z.x + z.w));
});
