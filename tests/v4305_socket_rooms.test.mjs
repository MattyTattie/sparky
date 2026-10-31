// v0.43.5 (test): rooms on socket circuits. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as W from '../js/wiring.js';
const ui = readFileSync(new URL('../js/certui.js', import.meta.url), 'utf8');
const ring = { num: '1', desc: 'Ring kitchen', device: 'mcb', type: 'B', rating: '32', live: '2.5', cpc: '1.5', points: '7',
  diagram: { roomList: [{ name: 'Kitchen', sockets: 3, spurs: 1, spurKind: 'fcu' }, { name: 'Outside', sockets: 2, spurs: 1 }] } };
const lay = (c) => W.layout(W.diagramModel({ type: 'EIC', boards: [{ id: 'b', ref: 'DB1', circuits: [c] }] }), { W: 380, font: 12, screen: true });
const txt = (L) => L.blocks.flatMap((b) => b.shapes.filter((z) => z.t === 'text').map((z) => z.txt));
test('socket rooms read from roomList; lighting rooms untouched', () => {
  const r = W.socketRoomsOf(ring); assert.equal(r.length, 2); assert.equal(r[0].spurKind, 'fcu');
  assert.equal(W.roomListOf(ring), null); assert.equal(W.roomSocketTotal(ring), 7); assert.equal(W.roomPointsNote(ring), '');
  assert.match(W.roomPointsNote({ ...ring, points: '9' }), /Rooms add up to 7 sockets, but Points served says 9/);
  assert.ok(W.isRingC(ring)); assert.ok(!W.isRingC({ desc: 'Radial sockets', rating: '20', live: '2.5' }));
});
test('socket rooms draw room boxes, spurs and IP-marked outdoor sockets', () => {
  const t = txt(lay(ring));
  for (const s of ['Kitchen', 'Outside', 'FCU spur', 'Spur', 'IP', 'weatherproof (IP rated)']) assert.ok(t.includes(s) || t.some((x) => x.includes(s)), s);
  assert.ok(t.some((x) => /outdoor, IP rated/.test(x)));
});
test('old socket circuit without rooms draws as before', () => {
  const t = txt(lay({ ...ring, diagram: undefined })); assert.ok(!t.includes('Kitchen')); assert.ok(!t.includes('IP'));
});
test('rooms editor has a socket mode with doubles, spurs and copy last room', () => {
  assert.match(ui, /mode === 'socket' \? \{ name, sockets: 2 \}/);
  assert.match(ui, /grp\('Doubles'/); assert.match(ui, /grp\('Spurs'/);
  assert.match(ui, /roomsOnOtherCircuits\(all, c\), 'socket'\)/); assert.match(ui, /'Outside'\]/);
});
test('singles per room count towards points and draw as single sockets on the ring', () => {
  const c = { ...ring, diagram: { roomList: [{ name: 'Kitchen', sockets: 2, singles: 3 }, { name: 'Hall', sockets: 1, singles: 99 }] } };
  const r = W.socketRoomsOf(c); assert.equal(r[0].singles, 3); assert.equal(r[1].singles, 10); assert.equal(W.roomSocketTotal(c), 16);
  const L = lay(c); const t = txt(L); assert.ok(t.some((x) => /2 doubles \u00b7 3 singles/.test(x)));
  assert.ok(L.blocks.some((b) => b.shapes.some((z) => z.k === 'socket1' || z.sym === 'socket1' || JSON.stringify(z).includes('socket1'))) || t.includes('Socket (single)'));
  assert.match(ui, /grp\('Singles'/); assert.match(ui, /\['sockets', 'singles', 'spurs', 'spurKind'\]/);
});
test('a ring with rooms is a closed loop: out leg left, return right of the boxes, back to the feed', () => {
  const L = lay(ring); const isRoom = (z) => z.t === 'rect' && String(z.color) === '150,160,190';
  const sh = L.blocks.find((b) => b.shapes.some(isRoom)).shapes; const boxes = sh.filter(isRoom);
  const right = Math.max(...boxes.map((b) => b.x + b.w)), left = Math.min(...boxes.map((b) => b.x)), lines = sh.filter((z) => z.t === 'line');
  assert.ok(new Set(boxes.map((b) => b.w)).size === 1, 'room boxes same width');
  const ret = lines.filter((z) => z.x1 === z.x2 && z.x1 > right + 4); assert.equal(ret.length, 1, 'one return leg on the right');
  assert.ok(!lines.some((z) => Math.max(z.x1, z.x2) > ret[0].x1 + 0.5), 'nothing beyond the return');
  assert.ok(lines.some((z) => z.y1 === z.y2 && Math.min(z.x1, z.x2) < left && Math.max(z.x1, z.x2) >= ret[0].x1 && z.y1 < Math.min(...boxes.map((b) => b.y))), 'top: return lands back on the feed');
  assert.ok(sh.some((z) => z.t === 'circle' || z.t === 'circ'), 'junction dot');
});
test('a plain ring draws its return leg back to the breaker; a radial does not', () => {
  const plain = { ...ring, diagram: undefined, points: '4' };
  const n = (c) => lay(c).blocks.flatMap((b) => b.shapes).filter((z) => z.t === 'line').length;
  assert.equal(n(plain) - n({ ...plain, desc: 'Radial sockets', rating: '20' }), 3);
});
