// v0.14 tests: test-across-circuits logic, other sources of supply (status + PDF). FAKE data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const T = await import('../js/templates.js');
const L = await import('../js/testlist.js');
const M = await import('../js/certmodel.js');
const S = await import('./sample-data.mjs');
const circ = (o) => Object.assign(T.blankCircuit(1), o);

test('steps go dead tests then live tests, with prev/next', () => {
  const ids = L.TEST_STEPS.map((s) => s.id);
  assert.deepEqual(ids, ['r1r2', 'ring', 'ir', 'pol', 'zs', 'rcd']);
  const firstLive = L.TEST_STEPS.findIndex((s) => !s.dead); assert.ok(L.TEST_STEPS.slice(firstLive).every((s) => !s.dead));
  assert.equal(L.prevStep('r1r2'), null); assert.equal(L.nextStep('r1r2').id, 'ring'); assert.equal(L.nextStep('rcd'), null);
  assert.equal(L.stepById('nonsense').id, 'r1r2');
});
test('spares and non-rings are skipped, RCD hint when none recorded', () => {
  const spare = circ({ desc: 'Spare' }); T.descChanged(spare, false);
  assert.equal(L.rowMode(spare, 'zs').mode, 'skip');
  assert.equal(L.rowMode(circ({ desc: 'Lights', ring: false }), 'ring').mode, 'skip');
  assert.equal(L.rowMode(circ({ desc: 'Sockets', ring: true }), 'ring').mode, 'edit');
  const noRcd = circ({ desc: 'Cooker', device: 'mcb', rcdIdn: '', rcdBs: '' });
  assert.ok(L.rowMode(noRcd, 'rcd').note);
  assert.ok(!L.rowMode(circ({ desc: 'Sockets', device: 'rcbo', rcdIdn: '30' }), 'rcd').note);
});
test('progress and fill-empty never overwrite', () => {
  const b = { circuits: [circ({ desc: 'A', pol: '✓' }), circ({ desc: 'B' }), circ({ desc: 'C', pol: '✗' })] };
  assert.deepEqual(L.progress(b, 'pol'), { need: 3, done: 2 });
  assert.equal(L.fillEmpty(b, 'pol', 'pol', '✓'), 1);
  assert.equal(b.circuits[2].pol, '✗');
  b.circuits[1].R2 = '0.3'; assert.equal(L.progress(b, 'r1r2').done, 1);
});
test('other sources: optional, status, PDF continuation sheet', async () => {
  const c = S.sampleEIC();
  const sup = M.sectionsFor('EIC').find((s) => s.id === 'supply');
  assert.deepEqual(M.sourcesMissing(c), []); // not ticked: nothing needed (old certificates)
  c.supply.otherSources = true;
  assert.deepEqual(M.sourcesMissing(c), ['the other source details']);
  assert.equal(M.sectionDone(c, sup), false);
  c.otherSources = [{ ...M.blankSource('s1'), type: 'PV inverter', make: 'Example 3.6 kW' }];
  assert.deepEqual(M.sourcesMissing(c), ['rating kW']);
  c.otherSources[0].kw = '3.6';
  assert.deepEqual(M.sourcesMissing(c), []);
  globalThis.jspdf = require('/workspace/sparky-work/npm/package/dist/jspdf.node.min.js');
  const P = await import('../js/pdf.js');
  c.otherSources.push({ ...M.blankSource('s2'), type: 'Battery storage', kw: '5', isolation: 'Isolator beside the battery' });
  assert.equal(P.sourceSheetCount(c), 1);
  const blob = await P.certificatePdf(c, { profile: S.PROFILE });
  assert.ok(blob.size > 1000);
  c.supply.otherSources = false; assert.equal(P.sourceSheetCount(c), 0); // unticked: not printed
});
