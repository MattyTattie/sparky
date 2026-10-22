// v0.23: the chosen cable's Iz after factors, always shown.
import test from 'node:test';
import assert from 'node:assert/strict';
import { izLine, sizeCable } from '../js/calc.js';
import { sizeCircuit } from '../js/design.js';
import { APP_VERSION } from '../js/config.js';
const sc = (o) => sizeCircuit({ load: '28', unit: 'A', loadType: 'general', length: '20', cable: 'te', method: 'C', ambient: 30, grouped: 1, grouping: 'bunched', ci: 1, ze: 0.35, device: 'mcb', type: 'auto', time: 0.4, phase: 1, ...o });
test('v0.23 version', () => assert.match(APP_VERSION, /^0\.23\.0/));
test('v0.23b izLine plain words (CCC) + workings', () => {
  const a = izLine({ size: 4, it: 37, iz: 24.05, needIz: 32, f: { ca: 1, cg: 0.65, ci: 1, cf: 1 }, inA: 32 });
  assert.equal(a.pass, false);
  assert.equal(a.text, '4 mm² can carry 24.05 A after factors. A 32 A breaker needs at least 32 A current-carrying capacity (CCC), so it\u2019s too small ✗');
  assert.equal(a.detail, 'CCC (Iz) = It 37 A × Ca 1 × Cg 0.65 × Ci 1 = 24.05 A. Needs Iz ≥ In (Regulation 433.1.1): 24.05 A against 32 A.');
  const b = izLine({ size: 2.5, it: 27, iz: 27, needIz: 20, f: { ca: 1, cg: 1, ci: 1, cf: 1 }, ring: true, inA: 32 });
  assert.equal(b.text, '2.5 mm² can carry 27 A after factors. A ring on a 32 A breaker needs at least 20 A current-carrying capacity (CCC), so it passes ✓');
  assert.match(b.detail, /433\.1\.204/);
  assert.match(izLine({ size: 2.5, it: 27, iz: 19.6, needIz: 20, f: { cf: 0.725 } }).detail, /Cf 0\.725/);
});
test('v0.23b Size a cable gives izInfo for the pick (radial, grouped, ring); CCC symbol', async () => {
  const r = sc({}); assert.ok(r.izInfo.pass); assert.match(r.izInfo.text, /can carry [\d.]+ A after factors\. A \d+ A breaker needs/);
  assert.match(sc({ grouped: '4', grouping: 'bunched' }).izInfo.detail, /Cg 0\.65/);
  const ring = sc({ loadType: 'ring', load: '20' }); assert.match(ring.izInfo.text, /A ring on a 32 A breaker needs at least 20 A/);
  assert.ok(ring.steps.includes(ring.izInfo.text));
  const { SYM, SYM_RE } = await import('../js/symdata.js'); assert.match(SYM.CCC.desc, /Iz/);
  assert.deepEqual([...'current-carrying capacity (CCC)'.matchAll(SYM_RE)].map((m) => m[0]), ['CCC']);
});
test('v0.23 Check a circuit rows carry what izLine needs', () => {
  const s = sizeCable({ cable: 'te', method: 'C', ib: 20, inA: 32, length: 20, grouped: 3, grouping: 'bunched', ring: 'spread' });
  const row = s.rows.find((r) => r.size === 2.5);
  const t = izLine({ size: row.size, it: row.it, iz: row.iz, needIz: row.needIz, f: s.factors, ring: row.needIz === 20, inA: 32 });
  assert.equal(row.iz, 18.9); assert.equal(t.pass, false); assert.match(t.detail, /Cg 0\.7/); assert.match(t.text, /too small ✗$/);
});

test('v0.23b Size a cable summary Current line uses CCC wording', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../js/calcsize.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /Current: carries/); assert.match(src, /'Current: ' \+ r\.izInfo\.text/);
});

test('v0.23b failing-size reason uses CCC wording', () => {
  const r = sc({ grouped: '4', grouping: 'bunched' });
  assert.match(r.steps.join(' '), /mm² can only carry [\d.]+ A after factors, but needs at least 32 A current-carrying capacity \(CCC\)(; [^,]+)?, so \d+ mm²\./);
  assert.doesNotMatch(r.steps.join(' '), /fails on current/);
});

test('v0.23b fail explanation box is styled red', async () => {
  const fs = await import('node:fs');
  assert.match(fs.readFileSync(new URL('../js/calcsize.js', import.meta.url), 'utf8'), /'ans-why' \+ \(\/can only carry/);
  assert.match(fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8'), /\.ans-why\.bad \{[^}]*--redbg/);
});
