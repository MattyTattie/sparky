import test from 'node:test';
import assert from 'node:assert/strict';
import { diagramModel, diagramSvg, spurInfo, layout } from '../js/wiring.js';
import { diagramMW, diagramMWSpur } from './diagram-sample.mjs';

test('spur off: MW diagram unchanged, no spur label', () => {
  assert.equal(spurInfo(diagramMW().mw), null);
  assert.ok(!diagramSvg(diagramMW()).includes('Spur added'));
});
test('spur on: label, count and feeds', () => {
  const c = diagramMWSpur();
  assert.equal(spurInfo(c.mw).label, 'Spur added (new): 1 \u00d7 socket');
  c.mw.spur = { on: true, count: '2', feeds: 'fcu' };
  assert.equal(spurInfo(c.mw).label, 'Spur added (new): 2 \u00d7 fused spurs (FCU)');
  c.mw.spur.count = 'x'; assert.equal(spurInfo(c.mw).n, 1);
  c.mw.spur.count = '99'; assert.equal(spurInfo(c.mw).n, 10);
});
test('spur drawn in brand colour beside the ring points, block taller', () => {
  const off = layout(diagramModel(diagramMW())); const on = layout(diagramModel(diagramMWSpur()));
  assert.ok(on.height > off.height);
  const svg = diagramSvg(diagramMWSpur());
  assert.ok(svg.includes('Spur added (new): 1 \u00d7 socket'));
  assert.ok(svg.includes('rgb(41,82,255)'));
});
test('spur ignored on EIC', () => {
  const m = diagramModel({ type: 'EIC', boards: [], mw: { spur: { on: true } } });
  assert.equal(m.boards.length, 0);
});
