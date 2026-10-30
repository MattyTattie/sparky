import test from 'node:test';
import assert from 'node:assert/strict';
import { diagramModel, diagramSvg, layout, roomListOf, roomPointsNote, switchInfo, circuitLines, roomsOf } from '../js/wiring.js';
import { diagramEIC, diagramEICRooms, diagramEICExtras } from './diagram-sample.mjs';
const texts = (L) => L.blocks.flatMap((b) => b.shapes.filter((z) => z.t === 'text').map((z) => z.txt));
const lightC = (c) => c.boards[0].circuits.find((x) => String(x.num) === '2');
test('roomList only on lighting circuits; normalised', () => {
  const c = lightC(diagramEICRooms()); const rl = roomListOf(c);
  assert.equal(rl.length, 3); assert.equal(rl[2].wiring, 'junction box'); assert.equal(rl[1].swi, 1);
  assert.equal(roomListOf({ desc: 'Sockets', diagram: { roomList: [{ name: 'X', lights: 2 }] } }), null);
  assert.equal(roomListOf({ desc: 'Lights' }), null);
  assert.equal(roomListOf({ desc: 'Lights', diagram: { roomList: [{ name: 'A', lights: '99', swi: 3 }] } })[0].lights, 10);
  assert.equal(roomListOf({ desc: 'Lights', diagram: { roomList: [{ name: 'A', swi: 3 }] } })[0].swi, 0); // intermediate needs a 2-way pair
});
test('roomList takes over from the rooms text and switch counts', () => {
  const c = { desc: 'Lights', diagram: { rooms: 'Old text', sw1: '3', roomList: [{ name: 'Kitchen', lights: 2, sw1: 1 }, { name: 'Hall', lights: 1, sw2pairs: 1, swi: 1 }] } };
  assert.equal(roomsOf(c), '');
  assert.equal(switchInfo(c).text, '1 \u00d7 1-way, 1 \u00d7 2-way pair, 1 \u00d7 intermediate');
  assert.ok(!circuitLines(c).title.includes('Old text'));
  // old certs unaffected
  assert.equal(roomsOf({ desc: 'Lights', diagram: { rooms: 'Kitchen' } }), 'Kitchen');
  assert.deepEqual(switchInfo({ desc: 'Lights' }).list, ['sw1']);
});
test('points mismatch note: screen only', () => {
  const cert = diagramEICRooms(); const c = lightC(cert);
  assert.equal(roomPointsNote(c), '');
  c.points = '9'; assert.match(roomPointsNote(c), /add up to 8 lights, but Points served says 9/);
  const m = diagramModel(cert);
  assert.ok(texts(layout(m, { screen: true })).some((t) => /add up to/.test(t)));
  assert.ok(!texts(layout(m, { W: 560, font: 11 })).some((t) => /add up to/.test(t)));
});
test('each room drawn in a labelled box with its lights, switches and wiring', () => {
  const L = layout(diagramModel(diagramEICRooms()), { W: 560, font: 11 });
  const t = texts(L);
  for (const w of ['Kitchen', 'Hall / Stairs / Landing', 'Bathroom (pull cord)', 'JB']) assert.ok(t.includes(w), w);
  assert.ok(t.some((x) => /4 lights .* 1-way .* Loop-in/.test(x)));
  const blk = L.blocks.find((b) => b.shapes.some((z) => z.txt === 'Kitchen'));
  const boxes = blk.shapes.filter((z) => z.t === 'rect' && z.fill === undefined || (z.t === 'rect' && z.fill && z.fill.join() === '244,246,252'));
  assert.ok(boxes.length >= 3);
  const lights = blk.shapes.filter((z) => z.t === 'circle' && z.fill && z.fill.join() === '255,255,255');
  assert.equal(lights.length, 8);
  // strappers: blue lines in the Hall box
  assert.ok(blk.shapes.filter((z) => z.t === 'line' && z.color.join() === '41,82,255').length >= 4);
});
test('key adds ceiling rose, JB and strappers', () => {
  const L = layout(diagramModel(diagramEICRooms()), { W: 560, font: 11 });
  const k = L.blocks.at(-1).shapes.filter((z) => z.t === 'text').map((z) => z.txt).join('|');
  for (const w of ['Ceiling rose', 'Junction box (JB)', '2-way strappers', 'Intermediate switch']) assert.ok(k.includes(w), w);
  const k2 = layout(diagramModel(diagramEICExtras()), { W: 560, font: 11 }).blocks.at(-1).shapes.filter((z) => z.t === 'text').map((z) => z.txt).join('|');
  assert.ok(!k2.includes('Junction box'));
});
test('old certs draw exactly as before; no ellipsis; long names wrap', () => {
  assert.equal(diagramSvg(diagramEIC()), diagramSvg(diagramEIC()));
  const cert = diagramEICRooms(); lightC(cert).diagram.roomList[0].name = 'Kitchen and dining room extension at the back of the house by the garden doors';
  const svg = diagramSvg(cert, { screen: true });
  assert.ok(!svg.includes('\u2026')); assert.ok(svg.includes('garden doors'));
});
