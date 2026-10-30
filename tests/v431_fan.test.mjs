import test from 'node:test'; import assert from 'node:assert/strict';
import { roomListOf, roomPointsNote, layout, diagramModel } from '../js/wiring.js';
import { diagramEICSwitches } from './diagram-sample.mjs';
const mk = (ctl) => { const c = diagramEICSwitches(); const x = c.boards[0].circuits.find((k) => k.diagram && k.diagram.roomList); x.diagram.roomList[0].fans = 1; x.diagram.roomList[0].fanCtl = ctl; return [c, x]; };
const texts = (L) => L.blocks.flatMap((b) => b.shapes.filter((z) => z.t === 'text').map((z) => z.txt));
test('room fan: optional fields read, old rooms have none', () => {
  const [, x] = mk('humidistat'); const rl = roomListOf(x); assert.equal(rl[0].fans, 1); assert.equal(rl[0].fanCtl, 'humidistat'); assert.equal(rl[1].fans, 0);
});
test('fans count as points served', () => {
  const [, x] = mk('humidistat'); x.points = '8'; assert.match(roomPointsNote(x), /9 points \(8 lights \+ 1 fan\)/); x.points = '9'; assert.equal(roomPointsNote(x), '');
});
test('humidistat fan drawn with %RH box and key entry', () => {
  const [c] = mk('humidistat'); const t = texts(layout(diagramModel(c), { W: 560, font: 11 }));
  assert.ok(t.includes('%RH')); assert.ok(t.some((s) => /Humidistat \(%RH\)/.test(s))); assert.ok(t.includes('Fan'));
});
test('light-switch fan has no control box', () => {
  const [c] = mk('switch'); const t = texts(layout(diagramModel(c), { W: 560, font: 11 }));
  assert.ok(!t.includes('%RH')); assert.ok(t.some((s) => /switched live/.test(s)));
});
