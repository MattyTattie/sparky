import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s = readFileSync(new URL('../js/certui.js', import.meta.url), 'utf8');
test('diagram warnings open their card; points mismatch has one-tap fixes', async () => {
  assert.match(s, /id: 'diagissues'/); assert.match(s, /openCoil\(c\)/); assert.match(s, /openRooms\(c\)/);
  // run diagramIssues on made-up data with a tiny stand-in for its helpers
  const src = s.slice(s.indexOf('export function diagramIssues'), s.indexOf('// "Controlled by": a folded card'));
  const { roomPointsNote, roomListOf, socketRoomsOf, roomPointTotal } = await import('../js/wiring.js');
  const fn = new Function('roomPointsNote', 'roomListOf', 'isSpareC', 'socketRoomsOf', 'roomPointTotal', src.replace('export ', '') + '; return diagramIssues;')(roomPointsNote, roomListOf, () => false, socketRoomsOf, roomPointTotal);
  const c = { num: '2', desc: 'Lights', points: '8', diagram: { roomList: [{ name: 'Hall', lights: 3, sw1: 1, sw2pairs: 0, swi: 0, wiring: 'loop-in' }, { name: 'Landing', lights: 4, sw1: 1, sw2pairs: 0, swi: 0, wiring: 'loop-in' }] } };
  const k = { num: '8', desc: 'Hot water', control: { via: 'contactor', controlCircuit: '' } };
  const it = fn({ type: 'EIC', boards: [{ circuits: [c, k] }] });
  assert.equal(it.length, 2); const p = it.find((x) => x.kind === 'points');
  assert.deepEqual(p.fixes.map((f) => f.label), ['Set points to 7', 'Add 1 light to Landing']);
  p.fixes[1].apply(); assert.equal(c.diagram.roomList[1].lights, 5);
  p.fixes[0].apply(); assert.equal(c.points, '7');
  assert.ok(it.some((x) => x.kind === 'coil' && x.c === k));
});
