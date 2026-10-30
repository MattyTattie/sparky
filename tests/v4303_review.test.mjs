// v0.43.3 (test): deep-review fixes. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { roomsOf } from '../js/wiring.js';
const src = readFileSync(new URL('../js/wiring.js', import.meta.url), 'utf8');
test('roomsOf ignores a legacy room value with no letters', () => {
  assert.equal(roomsOf({ diagram: { rooms: '5' } }), '');
  assert.equal(roomsOf({ diagram: { rooms: 'Kitchen' } }), 'Kitchen');
});
test('PDF splits a block taller than a page instead of clipping it', () => {
  assert.match(src, /taller than a page/);
  assert.match(src, /cutAt\(b, y0 \+/);
});
test('PDF keeps a board heading with its first circuit', () => {
  assert.match(src, /keep a board \/ RCD heading with its first circuit/);
});
import { layout, diagramModel } from '../js/wiring.js';
import { diagramEICRooms } from './diagram-sample.mjs';
const ui = readFileSync(new URL('../js/certui.js', import.meta.url), 'utf8');
test('rooms menu has Prev / Next circuit, Copy last room, and a Needs attention badge + top link', () => {
  assert.match(ui, /'\\u2039 Prev circuit'/); assert.match(ui, /'Next circuit \\u203a'/);
  assert.match(ui, /'Copy last room'/); assert.match(ui, /issuecount/); assert.match(ui, /id: 'issueslink'/);
  assert.match(ui, /grp\('Fan', mini/); // fan stepper stays visible
});
test('light-switch fan: dashed switched live starts at the switch', () => {
  const c = diagramEICRooms(); const l = c.boards[0].circuits.find((x) => String(x.num) === '2');
  const r = l.diagram.roomList[0]; Object.assign(r, { fans: 1, fanCtl: 'switch', sw1: 1, sw2pairs: 0, swi: 0, wiring: 'loop-in' });
  const L = layout(diagramModel(c), { W: 380, font: 12 }); const sh = L.blocks.flatMap((b) => b.shapes);
  const dashed = sh.filter((z) => z.t === 'line' && z.dash && z.x1 === z.x2 && z.y2 > z.y1);
  assert.ok(dashed.length >= 2);
});
import { supplyKindOf, feedInfo, SUPPLY_KINDS } from '../js/wiring.js';
test('extra board supply kind: optional field, old text understood', () => {
  assert.equal(supplyKindOf({ suppliedFrom: 'Origin (meter tails via Henley blocks)' }), 'tails');
  assert.equal(supplyKindOf({ suppliedFrom: 'Switch fuse by meter' }), 'switchfuse');
  assert.equal(supplyKindOf({ supplyKind: 'tails' }), 'tails');
  assert.equal(supplyKindOf({ supplyKind: 'tails', suppliedFrom: 'DB1 circuit 14' }), '');
  assert.equal(supplyKindOf({ suppliedFrom: 'DB1 circuit 14' }), '');
  const boards = [{ ref: 'DB1', circuits: [{ num: '14' }] }, { ref: 'DB2', supplyKind: 'switchfuse' }];
  assert.equal(feedInfo(boards, 1).state, 'origin');
  assert.equal(SUPPLY_KINDS.tails, 'Meter tail connector block');
});
test('every board starts with a boxed heading; extra-board source drawn with key entries', () => {
  const c = diagramEICRooms(); const b2 = JSON.parse(JSON.stringify(c.boards[0])); b2.ref = 'DB2'; b2.supplyKind = 'tails'; b2.suppliedFrom = ''; c.boards.push(b2);
  const L = layout(diagramModel(c), { W: 380, font: 12 }); const t = L.blocks.flatMap((b) => b.shapes.filter((z) => z.t === 'text').map((z) => z.txt));
  assert.ok(t.filter((x) => x === 'Meter tail connector block').length >= 2); // on the diagram and in the key
  const heads = L.blocks.filter((b) => b.kind === 'board'); assert.ok(heads.every((b) => b.shapes.some((z) => z.t === 'rect' && z.lw !== 0)));
  assert.ok(!t.some((x) => /henley/i.test(x)));
});
test('heaters / radiators / towel rails use the heating-element symbol with Heater / radiator key', () => {
  const c = diagramEICRooms(); c.boards[0].circuits.push({ num: '30', desc: 'Towel rail', points: '1', diagram: { isolator: { type: 'sfcu' } } });
  const L = layout(diagramModel(c), { W: 380, font: 12 }); const t = L.blocks.flatMap((b) => b.shapes.filter((z) => z.t === 'text').map((z) => z.txt));
  assert.ok(t.includes('Rad')); assert.ok(t.includes('Heater / radiator'));
});
import { impliedFcu, loadKind } from '../js/wiring.js';
test('towel rail recorded as FCU points: FCU drawn in line as the isolator, then the rail', () => {
  const c = diagramEICRooms(); c.boards[0].circuits.push({ num: '19', desc: 'Towel rail', points: '1' });
  const tr = c.boards[0].circuits.at(-1);
  assert.equal(impliedFcu(tr).label, '13A FCU'); assert.equal(loadKind(tr), 'heater');
  assert.equal(impliedFcu({ desc: 'FCU spur', points: '1' }), null);
  const L = layout(diagramModel(c), { W: 380, font: 12 }); const t = L.blocks.flatMap((b) => b.shapes.filter((z) => z.t === 'text').map((z) => z.txt));
  assert.ok(t.includes('13A FCU')); assert.ok(t.includes('Rail')); assert.ok(t.some((x) => /1 × towel rail/.test(x)));
});
test('no cable tags (C4, C5...) on the room cables; they stay in the cable list', () => {
  const c = diagramEICRooms(); const l = c.boards[0].circuits.find((x) => String(x.num) === '2'); l.diagram.roomList.forEach((r, i) => { r.wiring = i % 2 ? 'jb-switch' : 'loop-in'; });
  for (const o of [{ W: 380, font: 12 }, { W: 560, font: 11 }]) { const t = layout(diagramModel(c), o).blocks.flatMap((b) => b.shapes.filter((z) => z.t === 'text').map((z) => z.txt));
    assert.ok(!t.some((x) => /^C\d+$/.test(x))); }
});
