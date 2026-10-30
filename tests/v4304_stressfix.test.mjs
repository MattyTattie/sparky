// v0.43.4 (test): stress-test fixes. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import * as W from '../js/wiring.js';
const A = { rcdBs: '61008', rcdType: 'A', rcdIdn: '30', rcdRating: '63' }, B = { ...A, rcdType: 'AC', rcdRating: '80' };
const c = (num, o) => ({ num, desc: 'Sockets ' + num, device: 'mcb', bs: '60898', type: 'B', rating: '32', live: '2.5', cpc: '1.5', points: '2', ...o });
test('circuits group under one heading per RCD on the board, RCBOs stay on their own', () => {
  const g = W.groupCircuits([c('1', A), c('2', B), c('3', A), c('4', { device: 'rcbo', bs: '61009', ...A }), c('5', B)]);
  const r = g.filter((x) => x.kind === 'rcd');
  assert.equal(r.length, 2);
  assert.deepEqual(r[0].circuits.map((x) => x.num), ['1', '3']);
  assert.deepEqual(r[1].circuits.map((x) => x.num), ['2', '5']);
  assert.equal(g.filter((x) => x.kind === 'circuit').length, 1);
});
test('points 0 is a value, blank is still not recorded', () => {
  assert.equal(W.pointCount({ points: '0' }).known, true);
  assert.equal(W.pointCount({ points: '' }).known, false);
});
const cert = (circ) => ({ type: 'EIC', boards: [{ id: 'b', ref: 'DB1', circuits: [circ] }] });
const shapes = (circ) => W.layout(W.diagramModel(cert(circ)), { W: 380, font: 12, screen: true }).blocks.filter((b) => b.kind !== 'flags').flatMap((b) => b.shapes);
test('points 0 shows 0, not N/A', () => {
  const t = shapes(c('1', { points: '0' })).filter((z) => z.t === 'text').map((z) => z.txt);
  assert.ok(t.some((x) => /^0 \u00d7 sockets/.test(x))); assert.ok(!t.some((x) => /Add points served/.test(x)));
});
test('plain lighting circuit draws its switch in line (no dashed drop)', () => {
  const s = shapes(c('1', { desc: 'Lights', rating: '6', live: '1.5', points: '3', diagram: { sw1: '1' } }));
  assert.ok(!s.some((z) => z.t === 'line' && z.dash));
});
test('single sockets are drawn as a spur branch, labelled', () => {
  const s = shapes(c('1', { points: '6', diagram: { singles: '2' } }));
  assert.ok(s.some((z) => z.t === 'text' && z.txt === 'Spurs'));
});
