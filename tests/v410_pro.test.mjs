// v0.41 (test): diagram 'pro' items 1-9.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { diagramModel, diagramSvg, layout, cableLabel, feedInfo, diagramFlags, circuitLines } from '../js/wiring.js';
import { circuitReadings, makeTemplate, applyTemplate, nextRoom, tidyLayouts, BUILTIN_TEMPLATES } from '../js/diagrampro.js';
import { diagramEIC, diagramEICPro, diagramEICRooms, diagramMW } from './diagram-sample.mjs';
const texts = (L) => L.blocks.flatMap((b) => b.shapes).filter((z) => z.t === 'text').map((z) => z.txt).join('|');

test('1: cable size, type and breaker on every circuit', () => {
  assert.equal(cableLabel({ live: '2.5', cpc: '1.5', wiring: 'A', type: 'B', rating: '32' }), '2.5/1.5mm\u00b2 T&E \u00b7 B32');
  assert.equal(cableLabel({ live: '6', cpc: '2.5', wiring: 'G', type: 'C', rating: '40' }), '6/2.5mm\u00b2 SWA (XLPE) \u00b7 C40');
  assert.equal(cableLabel({ live: '', type: 'B', rating: '6' }), '');
  const t = texts(layout(diagramModel(diagramEICPro()), { W: 560, font: 11 }));
  assert.ok(t.includes('2.5/1.5mm\u00b2 T&E \u00b7 B32'));
  assert.equal(circuitLines({ num: 1, desc: 'x', live: '', type: 'B', rating: '6' }).rows.find((r) => r[0] === 'Cable')[1], '');
});
test('2: sub-boards from Supplied from; blank or mismatched never guessed', () => {
  const c = diagramEICPro();
  assert.deepEqual(feedInfo(c.boards, 1), { state: 'ok', text: 'DB1 circuit 11', bi: 0, ref: 'DB1', circuit: '11' });
  assert.equal(feedInfo(c.boards, 2).state, 'blank');
  c.boards[2].suppliedFrom = 'DB9'; assert.equal(feedInfo(c.boards, 2).state, 'mismatch');
  c.boards[2].suppliedFrom = 'DB1 way 99'; assert.equal(feedInfo(c.boards, 2).state, 'mismatch');
  c.boards[2].suppliedFrom = 'db1, way 3'; assert.equal(feedInfo(c.boards, 2).state, 'ok');
  c.boards[2].suppliedFrom = 'Origin'; assert.equal(feedInfo(c.boards, 2).state, 'origin');
  const L = layout(diagramModel(diagramEICPro()), { W: 560, font: 11 }); const t = texts(L);
  assert.ok(t.includes('DB2 \u00b7 Garage (outbuilding)'));
  assert.ok(t.includes('Feeds DB2 (Garage) (see DB2)')); assert.ok(t.includes('by cable C13'));
  assert.ok(/not recorded, so the link is/.test(t));
  const loft = L.blocks.filter((b) => b.kind === 'board')[2];
  assert.ok(loft.shapes.some((z) => z.t === 'line' && z.dash && z.color.join() === '196,120,0'));
  const garage = L.blocks.filter((b) => b.kind === 'board')[1];
  assert.ok(!garage.shapes.some((z) => z.t === 'line' && z.dash));
});
test('3: red flags from the limit checks, amber for missing points, legend', () => {
  const c = diagramEICPro(); const b = c.boards[0]; const by = (n) => b.circuits.find((x) => String(x.num) === String(n));
  assert.deepEqual(diagramFlags(by(1), { earthing: 'TN-C-S (PME)' }), ['Zs 2.10 \u03a9 over max 1.37 \u03a9', 'RCD 450 ms too slow']);
  assert.deepEqual(diagramFlags(by(5)), ['IR L-E 0.5 M\u03a9 too low']);
  assert.deepEqual(diagramFlags(by(2)), []);
  const scr = layout(diagramModel(c), { W: 380, font: 12, screen: true });
  assert.equal(scr.blocks[0].kind, 'flags');
  const pdf = layout(diagramModel(c), { W: 560, font: 11 }); const t = texts(pdf);
  assert.ok(t.includes('Points served not recorded') && t.includes('Reading out of limits') && t.includes('Link not recorded'));
  const red = pdf.blocks.find((x) => x.reds); assert.ok(red.shapes.some((z) => z.t === 'rect' && z.color.join() === '200,30,30'));
  assert.equal(pdf.blocks.at(-1).kind, 'legend'); // the key is still last without the cable table
});
test('4: on screen each circuit is a tappable group, not a link', () => {
  const svg = diagramSvg(diagramEICPro(), { W: 380, font: 12, screen: true, tap: true });
  assert.ok(svg.includes('class="dgc" role="button"') && svg.includes('data-bi="1"') && !svg.includes('<a href'));
  const r = circuitReadings({ zs: '2.10', type: 'B', rating: '32', device: 'mcb', irLL: '>200', irLE: '0.5', rcdMs: '20', pol: '\u2713' }, {});
  assert.deepEqual(r.map((x) => x.label), ['Zs', 'R1+R2', 'IR L-L / L-E', 'RCD time', 'Polarity']);
  assert.equal(r[0].level, 'red'); assert.equal(r[2].level, 'red'); assert.equal(r[1].value, ''); assert.equal(r[3].level, null);
});
test('5: cable labels C1… and a cable table in the PDF layout only', () => {
  const L = layout(diagramModel(diagramEICPro()), { W: 560, font: 11, cableTable: true });
  assert.equal(L.cables[0].label, 'C1'); assert.ok(L.cables.every((c, i) => c.label === 'C' + (i + 1)));
  const sub = L.cables.find((c) => c.from === 'DB1 circuit 11'); assert.ok(sub.to.includes('DB2 (Garage)'));
  assert.ok(!L.cables.some((c) => c.from === 'DB1 circuit 11' && c !== sub), 'the sub-main is one cable, not two');
  assert.ok(L.cables.some((c) => c.from === 'JB, circuit 2' && c.to === 'switch, Kitchen'));
  const t = texts(L); assert.ok(t.includes('Cable list') && t.includes('Type / size'));
  assert.ok(!/\d\s?m\b(?!m)/.test(L.cables.map((c) => c.type).join(' ')), 'no lengths');
  assert.ok(!texts(layout(diagramModel(diagramEICPro()), { W: 560, font: 11 })).includes('Cable list'));
});
test('6: templates save rooms/wiring/switches/control, apply, built-in JB to each switch', () => {
  const c = diagramEICRooms().boards[0].circuits.find((x) => String(x.num) === '2');
  c.control = { via: 'contactor', controlCircuit: '10' };
  const t = makeTemplate(c, 'Mine'); assert.equal(t.name, 'Mine'); assert.equal(t.rooms.length, 3); assert.equal(t.control.via, 'contactor'); assert.equal(t.control.controlCircuit, undefined);
  assert.ok(!('zs' in t) && !JSON.stringify(t).includes('r1r2'));
  const blank = { num: 6, diagram: undefined };
  const r = applyTemplate(blank, t); assert.equal(r.diagram.roomList.length, 3); assert.equal(r.control.via, 'contactor');
  const jb = BUILTIN_TEMPLATES.find((x) => x.name === 'JB to each switch');
  const r2 = applyTemplate(c, jb); assert.ok(r2.diagram.roomList.every((x) => x.wiring === 'jb-switch')); assert.equal(r2.diagram.roomList[0].name, 'Kitchen');
  assert.deepEqual(applyTemplate({}, jb).diagram.roomList, [{ name: '', lights: 1, sw1: 1, sw2pairs: 0, swi: 0, wiring: 'jb-switch' }]);
  assert.equal(nextRoom([{ wiring: 'jb-switch', sw1: 0, sw2pairs: 1, swi: 0 }]).wiring, 'jb-switch');
  assert.equal(nextRoom([]).wiring, 'loop-in');
});
test('7: PDF title block on each diagram sheet', async () => {
  const require = createRequire(import.meta.url);
  let jsp; try { jsp = require('/workspace/sparky-work/npm/package/dist/jspdf.node.min.js'); } catch { return; }
  globalThis.jspdf = jsp;
  const { diagramTitleInfo } = await import('../js/pdf.js');
  const c = diagramEICPro(); c.people = { inspector: { name: 'A. Sample' } }; c.sigs = { inspector: { date: '2026-10-30' } };
  assert.deepEqual(diagramTitleInfo(c, {}), { address: '7 Pretend Lane, Nowhereville, ZZ0 0ZZ', date: '30/10/2026', drawnBy: 'A. Sample', rev: 'A' });
  c.diagramRev = 'B'; assert.equal(diagramTitleInfo(c, {}).rev, 'B');
});
test('8: tidy up keeps the order unless asked, drops bad slots', () => {
  const c = diagramEICRooms(); const l = c.boards[0].circuits.find((x) => String(x.num) === '2');
  l.diagram.layout = { order: [2, 2, 0, 9, 1], x: 5 };
  assert.equal(tidyLayouts(c), 1); assert.deepEqual(l.diagram.layout, { order: [2, 0, 1] });
  assert.equal(tidyLayouts(c), 0);
  assert.equal(tidyLayouts(c, { resetOrder: true }), 1); assert.equal(l.diagram.layout, undefined);
  assert.equal(tidyLayouts(diagramMW()), 0);
});
test('9: contactor cross-references both ways', () => {
  const t = texts(layout(diagramModel(diagramEICPro()), { W: 560, font: 11 }));
  assert.ok(t.includes('Coil switched by circuit 10 (see circuit 10)'));
  assert.ok(/Switches contactor on circuits 8, 9 \(see/.test(t));
  const L = layout(diagramModel(diagramEICPro()), { W: 380, screen: true });
  const k8 = L.blocks.find((b) => b.num === '8'); assert.deepEqual(k8.links, ['10']);
});
test('old certs: no new fields needed, older diagram still draws', () => {
  const c = diagramEIC(); const before = JSON.stringify(c); assert.ok(diagramSvg(c).startsWith('<svg'));
  layout(diagramModel(c), { W: 560, font: 11, cableTable: true }); assert.equal(JSON.stringify(c), before, 'drawing never writes to the certificate');
});
