import test from 'node:test';
import assert from 'node:assert/strict';
import { diagramModel, diagramSvg, layout, pointKind, switchInfo, circuitLines, roomsOf } from '../js/wiring.js';
import { diagramEIC, diagramEICExtras, diagramMW } from './diagram-sample.mjs';
const texts = (L) => L.blocks.flatMap((b) => b.shapes.filter((z) => z.t === 'text').map((z) => z.txt));

test('new symbol kinds', () => {
  assert.equal(pointKind({ desc: 'Smoke and heat alarms' }), 'alarm');
  assert.equal(pointKind({ desc: 'Immersion heater' }), 'immersion');
  assert.equal(pointKind({ desc: 'EV charger' }), 'ev');
  assert.equal(pointKind({ desc: 'Bathroom extract fan' }), 'fan');
  assert.equal(pointKind({ desc: 'Fused spur (FCU) boiler' }), 'fcu');
  assert.equal(pointKind({ desc: 'Lights upstairs' }), 'light');
});
test('switches: one 1-way by default, custom counts, none for non-lighting', () => {
  assert.deepEqual(switchInfo({ desc: 'Lights' }).list, ['sw1']);
  assert.equal(switchInfo({ desc: 'Sockets' }), null);
  const s = switchInfo({ desc: 'Lights', diagram: { sw1: '2', sw2: '1', swi: '1' } });
  assert.deepEqual(s.list, ['sw1', 'sw1', 'sw2', 'sw2', 'swi']);
  assert.equal(s.text, '2 \u00d7 1-way, 1 \u00d7 2-way pair, 1 \u00d7 intermediate');
  assert.equal(switchInfo({ desc: 'Lights', diagram: { sw1: '0', sw2: '0', swi: '0' } }).text, 'None');
});
test('rooms beside the name; no Breaker line; RCBO keeps RCD details', () => {
  const l = circuitLines({ num: '2', desc: 'Lights', type: 'B', rating: '6', device: 'rcbo', rcdIdn: '30', rcdType: 'A', diagram: { rooms: 'Kitchen, Hall' } });
  assert.equal(l.title, '2  Lights \u00b7 Kitchen, Hall');
  assert.ok(!l.rows.some(([k]) => k === 'Breaker'));
  assert.deepEqual(l.rows[0], ['RCD', '30 mA Type A']);
  assert.equal(roomsOf({}), '');
});
test('hint shows on screen only, never in the PDF layout', () => {
  const m = diagramModel(diagramEICExtras());
  assert.ok(texts(layout(m, { screen: true })).some((t) => t.startsWith('Add points served')));
  assert.ok(!texts(layout(m, { W: 560, font: 11 })).some((t) => /Add points/.test(t)));
});
test('key lists only symbols used, and is the last block', () => {
  const L = layout(diagramModel(diagramEICExtras()), { W: 560, font: 11 });
  const last = L.blocks[L.blocks.length - 1]; assert.equal(last.kind, 'legend');
  const t = last.shapes.filter((z) => z.t === 'text').map((z) => z.txt).join('|');
  for (const w of ['Key', 'Twin socket (switched)', 'Light', '1-way switch', '2-way switch', 'Intermediate switch', 'Smoke / heat alarm', 'Immersion heater', 'EV charger', 'Fan', 'Contactor']) assert.ok(t.includes(w), w);
  assert.ok(/Fused spur \(FCU\)|fused/.test(t)); // v0.43.3: an FCU on a named load is drawn as its isolator
  const L2 = layout(diagramModel(diagramMW()));
  const t2 = L2.blocks.at(-1).shapes.filter((z) => z.t === 'text').map((z) => z.txt).join('|');
  assert.ok(t2.includes('Twin socket (switched)') && !t2.includes('Light') && !t2.includes('EV'));
});
test('tap to edit: circuit blocks link to their edit screen', () => {
  const svg = diagramSvg(diagramEICExtras(), { href: (r) => `#/cert/x/b/${r.bi}/c/${r.ci}` });
  assert.ok(svg.includes('href="#/cert/x/b/0/c/0"') && svg.includes('href="#/cert/x/b/0/c/12"'));
  assert.ok(!diagramSvg(diagramEIC()).includes('<a '));
  const mw = diagramSvg(diagramMW(), { href: (r) => (r.mw ? 'MWC' : 'X') }); assert.ok(mw.includes('href="MWC"'));
});
test('no ellipsis anywhere', () => {
  assert.ok(!diagramSvg(diagramEICExtras(), { screen: true }).includes('\u2026'));
});
