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
  for (const s of ['Kitchen', 'Outside', 'FCU', 'Spur', 'IP', 'weatherproof (IP rated)']) assert.ok(t.includes(s) || t.some((x) => x.includes(s)), s);
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
  assert.match(ui, /grp\('Singles'/); assert.match(ui, /\['sockets', 'singles', 'spurs', 'spurKind', 'commando', 'commandoA'\]/);
});
const crossings = (L) => { let n = 0; for (const b of L.blocks) { const ls = b.shapes.filter((z) => z.t === 'line' && !z.dash && (z.x1 === z.x2 || z.y1 === z.y2));
  for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) { const p = ls[i], q = ls[j]; const h = p.y1 === p.y2 && p.x1 !== p.x2 ? p : q.y1 === q.y2 && q.x1 !== q.x2 ? q : null, v = p.x1 === p.x2 && p !== h ? p : q.x1 === q.x2 && q !== h ? q : null; if (!h || !v) continue;
    const x = v.x1, y = h.y1, e = 0.6; if (x > Math.min(h.x1, h.x2) + e && x < Math.max(h.x1, h.x2) - e && y > Math.min(v.y1, v.y2) + e && y < Math.max(v.y1, v.y2) - e) n++; } } return n; };
const big = { ...ring, diagram: { roomList: [{ name: 'Bedroom 1', sockets: 9, spurs: 1 }, { name: 'Landing', sockets: 0 }, { name: 'Outside', sockets: 2, singles: 1, spurs: 2 }, { name: 'Bedroom 2', sockets: 1 }] } };
test('ring finals are a hairpin: two legs out of the breaker, sockets between, joined after the last; no crossings', () => {
  for (const c of [ring, big, { ...ring, diagram: undefined, points: '4' }, { ...ring, diagram: { singles: 2 }, points: '14' }])
    for (const Wd of [380, 560, 1100]) { const L = W.layout(W.diagramModel({ type: 'EIC', boards: [{ id: 'b', ref: 'DB1', circuits: [c] }] }), { W: Wd, font: 12, screen: Wd < 600 });
      assert.equal(crossings(L), 0, c.desc + ' ' + Wd);
      const sh = L.blocks.flatMap((b) => b.shapes); const dev = sh.find((z) => z.t === 'rect' && z.h > 20 && z.w < 80 && z.x < 60);
      assert.ok(sh.some((z) => z.t === 'line' && z.x1 === z.x2 && Math.abs(Math.min(z.y1, z.y2) - (dev.y + dev.h)) < 0.5 && z.x1 > dev.x && z.x1 < dev.x + dev.w), 'leg B leaves the breaker'); }
});
test('a radial has no second leg', () => {
  const L = lay({ ...ring, desc: 'Radial sockets', rating: '20', live: '2.5', diagram: undefined, points: '4' }); const sh = L.blocks.flatMap((b) => b.shapes);
  const dev = sh.find((z) => z.t === 'rect' && z.h > 20 && z.w < 80 && z.x < 60);
  assert.ok(!sh.some((z) => z.t === 'line' && z.x1 === z.x2 && Math.abs(Math.min(z.y1, z.y2) - (dev.y + dev.h)) < 0.5 && z.x1 > dev.x && z.x1 < dev.x + dev.w));
});
test('ring with rooms: leg 2 goes in and out of each room at its left; boxes aligned; return stops just past the last socket', () => {
  const L = lay(big); const isRoom = (z) => z.t === 'rect' && String(z.color) === '150,160,190';
  const sh = L.blocks.find((b) => b.shapes.some(isRoom)).shapes; const boxes = sh.filter(isRoom);
  assert.equal(new Set(boxes.map((b) => b.x + '/' + b.w)).size, 1);
  const right = boxes[0].x + boxes[0].w; const lines = sh.filter((z) => z.t === 'line' && z.y1 === z.y2);
  assert.ok(!lines.some((z) => Math.max(z.x1, z.x2) > right - 8), 'no line runs to the box right edge');
  const left = boxes[0].x; const crossLeft = lines.filter((z) => Math.min(z.x1, z.x2) < left && Math.max(z.x1, z.x2) > left);
  assert.equal(crossLeft.length, 2 * boxes.length, 'one line in and one back out per room');
});

test('v29: sockets sit on the ring line (no stems) and a spur tees off on the same row when it fits', () => {
  const L = W.layout(W.diagramModel({ type: 'EIC', boards: [{ id: 'b', ref: 'DB1', circuits: [ring] }] }), { W: 700, font: 12, screen: true });
  const sh = L.blocks.flatMap((b) => b.shapes); const sp = sh.find((z) => z.t === 'text' && z.txt === 'Spur');
  const ky = sh.find((z) => z.t === 'text' && z.txt === 'Kitchen').y; const sp1 = sh.filter((z) => z.t === 'text' && z.txt === 'Spur' && z.y > ky)[0];
  assert.ok(sp && sp1);
  const lines = sh.filter((z) => z.t === 'line' && z.y1 === z.y2 && z.y1 > ky && z.y1 < sp1.y + 20);
  const rowY = Math.min(...lines.map((z) => z.y1)); assert.ok(Math.abs(sp1.y - rowY) < 12, 'spur label on the socket row');
  assert.equal(crossings(L), 0);
});

test('v0.43.6 commando sockets: optional per room, 16 A default, count towards points, key and tag drawn', () => {
  assert.equal(W.socketRoomsOf(ring)[0].commando, 0); // old rooms unchanged
  const c = { ...ring, diagram: { roomList: [{ name: 'Workshop', sockets: 2, commando: 2 }, { name: 'Garden', sockets: 1, commando: 1, commandoA: '32' }] } };
  const r = W.socketRoomsOf(c); assert.equal(r[0].commandoA, '16'); assert.equal(r[1].commandoA, '32');
  assert.equal(W.roomSocketTotal(c), 6);
  for (const Wd of [380, 560, 1100]) { const L = W.layout(W.diagramModel({ type: 'EIC', boards: [{ id: 'b', ref: 'DB1', circuits: [c] }] }), { W: Wd, font: 12, screen: true });
    const t = txt(L); assert.equal(t.filter((x) => x === '16A').length, 3); assert.equal(t.filter((x) => x === '32A').length, 2); const j = t.join(' ');
    assert.match(j, /Industrial socket BS EN\s60309, 16 A \(blue, 230 V\)/); assert.match(j, /Industrial socket BS EN\s60309, 32 A \(blue, 230 V\)/);
    assert.ok(t.some((x) => /2 commandos \(16 A\)/.test(x))); assert.equal(crossings(L), 0, String(Wd)); }
  assert.match(ui, /grp\('Commando'/); assert.match(ui, /'commando', 'commandoA'\]/);
});
