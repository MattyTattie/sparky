// v0.23: the chosen cable's Iz after factors, always shown.
import test from 'node:test';
import assert from 'node:assert/strict';
import { izLine, sizeCable } from '../js/calc.js';
import { sizeCircuit } from '../js/design.js';
import { APP_VERSION } from '../js/config.js';
const sc = (o) => sizeCircuit({ load: '28', unit: 'A', loadType: 'general', length: '20', cable: 'te', method: 'C', ambient: 30, grouped: 1, grouping: 'bunched', ci: 1, ze: 0.35, device: 'mcb', type: 'auto', time: 0.4, phase: 1, ...o });
test('v0.23 version', () => assert.match(APP_VERSION, /^0\.23\.0/));
test('v0.23 izLine words, factors and pass/fail', () => {
  const a = izLine({ size: 4, it: 37, iz: 37, needIz: 32, f: { ca: 1, cg: 1, ci: 1, cf: 1 } });
  assert.equal(a.pass, true); assert.equal(a.text, '4 mm² carries 37 A after factors (Iz = It 37 A × Ca 1 × Cg 1 × Ci 1), needs 32 A (Iz ≥ In).');
  const b = izLine({ size: 2.5, it: 27, iz: 18.9, needIz: 20, f: { ca: 1, cg: 0.7, ci: 1, cf: 1 }, ring: true, inA: 32 });
  assert.equal(b.pass, false); assert.match(b.text, /433\.1\.204: Iz ≥ 20 A; a radial on 32 A would need 32 A/); assert.match(b.text, /too small\.$/);
  assert.match(izLine({ size: 2.5, it: 27, iz: 19.6, needIz: 20, f: { ca: 1, cg: 1, ci: 1, cf: 0.725 } }).text, /Cf 0\.725 \(BS 3036\)/);
});
test('v0.23 Size a cable gives izInfo for the pick (radial, grouped, ring)', () => {
  const r = sc({}); assert.ok(r.izInfo.pass); assert.match(r.izInfo.text, /^\d+(\.\d+)? mm² carries [\d.]+ A after factors \(Iz = It/);
  const g = sc({ grouped: '4', grouping: 'bunched' }); assert.match(g.izInfo.text, /Cg 0\.65/);
  const ring = sc({ loadType: 'ring', load: '20' }); assert.match(ring.izInfo.text, /needs 20 A \(ring final, 433\.1\.204/);
  assert.ok(ring.steps.some((t) => t === ring.izInfo.text), 'the steps use the same words');
});
test('v0.23 Check a circuit rows carry what izLine needs', () => {
  const s = sizeCable({ cable: 'te', method: 'C', ib: 20, inA: 32, length: 20, grouped: 3, grouping: 'bunched', ring: 'spread' });
  const row = s.rows.find((r) => r.size === 2.5);
  const t = izLine({ size: row.size, it: row.it, iz: row.iz, needIz: row.needIz, f: s.factors, ring: row.needIz === 20, inA: 32 });
  assert.equal(row.iz, 18.9); assert.equal(t.pass, false); assert.match(t.text, /Cg 0\.7/);
});
