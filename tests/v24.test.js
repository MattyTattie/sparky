// v0.24: plainer green/red boxes; "(CCC)" kept on one line; breaker named in its own line.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { izLine, sizeCable } from '../js/calc.js';
import { sizeCircuit } from '../js/design.js';
import { APP_VERSION } from '../js/config.js';
const sc = (o) => sizeCircuit({ load: '28', unit: 'A', loadType: 'general', length: '20', cable: 'te', method: 'C', ambient: 30, grouped: 1, grouping: 'bunched', ci: 1, ze: 0.35, device: 'mcb', type: 'auto', time: 0.4, phase: 1, ...o });
const src = (f) => fs.readFileSync(new URL('../js/' + f, import.meta.url), 'utf8');
test('v0.24 version', () => assert.match(APP_VERSION, /^0\.(2[4-9]|[34]\d)\./));
test('v0.24 izLine short text; rule + workings in detail', () => {
  const a = izLine({ size: 4, it: 37, iz: 24.05, needIz: 32, f: { ca: 1, cg: 0.65, ci: 1, cf: 1 }, inA: 32 });
  assert.equal(a.pass, false);
  assert.equal(a.text, '4 mm² CCC after factors: 24.05 A, too small');
  assert.equal(a.detail, 'A 32 A breaker needs a CCC of at least 32 A. CCC (Iz) = It 37 A × Ca 1 × Cg 0.65 × Ci 1 = 24.05 A. Needs Iz ≥ In (Regulation 433.1.1): 24.05 A against 32 A.');
  const b = izLine({ size: 1.5, it: 16.64, iz: 16.64, needIz: 16, f: {}, inA: 16 });
  assert.equal(b.text, '1.5 mm² CCC after factors: 16.64 A');
  const ring = izLine({ size: 2.5, it: 27, iz: 27, needIz: 20, f: {}, ring: true, inA: 32 });
  assert.match(ring.detail, /^A ring on a 32 A breaker needs a CCC of at least 20 A\. .*433\.1\.204/);
  assert.match(izLine({ size: 2.5, it: 27, iz: 19.6, needIz: 20, f: { cf: 0.725 } }).detail, /Cf 0\.725/);
});
test('v0.24 Size a cable: izInfo + plain fail reason', () => {
  const r = sc({ grouped: '4', grouping: 'bunched' });
  assert.match(r.izInfo.text, /^\d+ mm² CCC after factors: [\d.]+ A$/);
  assert.match(r.izInfo.detail, /Cg 0\.65/);
  const last = r.reasons[r.reasons.length - 1];
  assert.match(last.why.join('. '), /^\d+ mm² CCC after factors: [\d.]+ A, too small/);
  const ring = sc({ loadType: 'ring', load: '20' }); assert.ok(ring.steps.includes(ring.izInfo.text));
});
test('v0.24 Check a circuit row text', () => {
  const s = sizeCable({ cable: 'te', method: 'C', ib: 20, inA: 32, length: 20, grouped: 3, grouping: 'bunched', ring: 'spread' });
  const row = s.rows.find((r) => r.size === 2.5);
  const t = izLine({ size: row.size, it: row.it, iz: row.iz, needIz: row.needIz, f: s.factors, ring: row.needIz === 20, inA: 32 });
  assert.equal(t.text, '2.5 mm² CCC after factors: 18.9 A, too small'); assert.match(t.detail, /Cg 0\.7/);
});
test('v0.24 answer cards: breaker lines, red fail box after green, nowrap (CCC)', () => {
  const s = src('calcsize.js');
  assert.match(s, /ccc\(r\.izInfo, 'Recommended breaker: ' \+ brkName\), why \? h\('div', \{ class: 'ans-why bad' \}/);
  assert.match(src('calcui.js'), /ccc\(izInfo\(row\), 'Breaker: ' \+ devName/);
  assert.match(src('symbols.js'), /symnw/);
  assert.match(fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8'), /\.symnw \{ white-space: nowrap; \}/);
});
test('v0.24 CCC pop-up names Iz', async () => {
  const { SYMBOLS } = await import('../js/symdata.js'); assert.ok(JSON.stringify(SYMBOLS).includes('Current-carrying capacity (Iz)'));
});
