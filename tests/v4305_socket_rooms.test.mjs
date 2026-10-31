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
  assert.match(ui, /grp\('Doubles'/); assert.match(ui, /grp\('Spurs'/); assert.match(ui, /\['sockets', 'spurs', 'spurKind'\]/);
  assert.match(ui, /roomsOnOtherCircuits\(all, c\), 'socket'\)/); assert.match(ui, /'Outside'\]/);
});
