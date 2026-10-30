// v0.38 (prototype): single-line wiring diagram. Fake data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pointKind, pointCount, groupCircuits, diagramModel, layout, diagramSvg, wrapText, textW, diagramInPdf, MAX_SYMBOLS } from '../js/wiring.js';
import { diagramEIC, diagramMW } from './diagram-sample.mjs';
import { sampleEIC, sampleEICR, sampleMW, PROFILE } from './sample-data.mjs';
const require = createRequire(import.meta.url);

test('point symbol follows the circuit type', () => {
  assert.equal(pointKind({ desc: 'Sockets ground floor' }), 'socket');
  assert.equal(pointKind({ desc: 'Ring final' }), 'socket');
  assert.equal(pointKind({ desc: 'Lights upstairs' }), 'light');
  assert.equal(pointKind({ desc: 'Cooker' }), 'cooker');
  assert.equal(pointKind({ desc: 'Electric shower' }), 'shower');
  assert.equal(pointKind({ desc: 'Immersion heater' }), 'appliance');
  assert.equal(pointKind({ desc: 'Garden thing' }), 'point');
});
test('point count: up to 10 symbols, then "+ N more"', () => {
  assert.deepEqual(pointCount({ points: '14' }), { n: 14, shown: MAX_SYMBOLS, more: 4, known: true });
  assert.deepEqual(pointCount({ points: '3' }), { n: 3, shown: 3, more: 0, known: true });
  assert.equal(pointCount({ points: '' }).known, false);
  assert.equal(pointCount({ points: 'N/A' }).known, false);
  const svg = diagramSvg({ ...diagramEIC() });
  assert.match(svg, /\+ 4 more \(14 in total\)/);
});
test('split board: MCBs grouped under their RCDs; RCBOs hang off the bus', () => {
  const g = groupCircuits(diagramEIC().boards[0].circuits);
  assert.equal(g.length, 2); assert.equal(g[0].kind, 'rcd'); assert.equal(g[0].circuits.length, 4); assert.equal(g[1].circuits.length, 4);
  assert.match(g[0].label, /30 mA/); assert.match(g[1].label, /80 A/);
  const r = groupCircuits(sampleEIC().boards[0].circuits);
  assert.ok(r.every((x) => x.kind === 'circuit'));
});
test('EIC/EICR draw every board circuit; Minor Works only its circuit', () => {
  const e = diagramModel(diagramEIC()); assert.equal(e.boards.length, 1); assert.equal(e.supply.earthing, 'TN-C-S (PME)');
  const svg = diagramSvg(diagramEIC());
  for (const t of ['Supply: TN-C-S (PME)', 'Main switch', 'DB1', 'Sockets ground floor', 'Electric shower', 'Cooker']) assert.ok(svg.includes(t), t);
  const m = diagramModel(diagramMW()); assert.equal(m.type, 'MW'); assert.equal(m.boards[0].items.length, 1);
  const ms = diagramSvg(diagramMW()); assert.match(ms, /Kitchen sockets/); assert.doesNotMatch(ms, /Main switch/);
  assert.ok(diagramModel(sampleEICR()).boards[0].items.length >= 8);
});
test('missing values print N/A in light grey; no "…" anywhere', () => {
  const svg = diagramSvg(diagramEIC());
  assert.match(svg, /fill="rgb\(170,170,170\)"[^>]*>N\/A</);
  assert.ok(!svg.includes('…') && !svg.includes('...'));
});
test('long text wraps in full inside its box', () => {
  const long = 'Sockets in the extension, garage, utility room and the garden office at the bottom of the garden';
  const ls = wrapText(long, 120, 12, true);
  assert.ok(ls.length > 2); assert.equal(ls.join(' '), long);
  ls.forEach((l) => assert.ok(textW(l, 12, true) <= 120 || !l.includes(' ')));
  const c = diagramEIC(); c.boards[0].circuits[0].desc = long;
  const L = layout(diagramModel(c), { W: 380, font: 12 });
  for (const b of L.blocks) for (const s of b.shapes) if (s.t === 'text' && s.anchor === 'start') assert.ok(s.x + textW(s.txt, s.size, s.bold) <= 380 + 0.5, s.txt);
  assert.ok(L.blocks.every((b) => b.h > 0));
});
test('PDF: diagram sheet after the schedules (EIC) and after the form (MW), and can be left out', async () => {
  globalThis.jspdf = require('/workspace/sparky-work/npm/package/dist/jspdf.node.min.js');
  const { certificatePdf } = await import('../js/pdf.js');
  const text = async (c) => Buffer.from(await (await certificatePdf(c, { profile: PROFILE })).arrayBuffer()).toString('latin1');
  const pages = async (c) => { const s = await text(c); return (s.match(/\/Type \/Page\b/g) || []).length; };
  const e = diagramEIC(); const n1 = await pages(e);
  e.diagramPdf = false; assert.equal(diagramInPdf(e), false); const n0 = await pages(e);
  assert.ok(n1 >= n0 + 1 && n1 <= n0 + 3, `${n0} -> ${n1}`);
  const m = diagramMW(); const m1 = await pages(m); m.diagramPdf = false; assert.equal(await pages(m), m1 - 1);
  assert.equal(diagramInPdf(sampleMW()), true);
});
