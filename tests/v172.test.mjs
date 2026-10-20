// v0.17.2 tests: orphan saved PDFs (certificate gone) are found only when it's safe. FAKE data only.
import test from 'node:test';
import assert from 'node:assert/strict';
const L = await import('../js/pdflist.js');
const jobs = [{ id: 'j1' }];
const certs = [{ id: 'c1', jobId: 'j1' }];
const files = [
  { id: 'keep', jobId: 'j1', certId: 'c1', kind: 'pdf', name: 'EIC-0001.pdf' },
  { id: 'orphan', jobId: 'j1', certId: 'gone', kind: 'pdf', name: 'EICR-0002.pdf' },
  { id: 'orphanChart', jobId: 'j1', certId: 'gone', kind: 'chart', name: 'EICR-0002-chart.pdf' },
  { id: 'noCert', jobId: 'j1', kind: 'pdf', name: 'old.pdf' },
  { id: 'photo', jobId: 'j1', certId: 'gone', kind: 'photo', name: 'p.jpg' },
  { id: 'otherJob', jobId: 'j-not-here', certId: 'gone2', kind: 'pdf', name: 'x.pdf' },
];
const ids = (l) => l.map((f) => f.id);
test('orphans: PDFs of a certificate that is not on this device', () => {
  assert.deepEqual(ids(L.findOrphans(files, certs, jobs)), ['orphan', 'orphanChart']);
});
test('PDFs with no certId, photos and kept certificates are left alone', () => {
  const o = ids(L.findOrphans(files, certs, jobs));
  for (const k of ['keep', 'noCert', 'photo']) assert.ok(!o.includes(k), k);
});
test('empty or unloaded database: nothing is deleted', () => {
  assert.deepEqual(L.findOrphans(files, [], jobs), []);
  assert.deepEqual(L.findOrphans(files, undefined, undefined), []);
});
test('job not on this device yet: its PDFs are left alone', () => {
  assert.ok(!ids(L.findOrphans(files, certs, jobs)).includes('otherJob'));
});
test('certificate Drive still has (not pulled yet): left alone', () => {
  assert.deepEqual(L.findOrphans(files, certs, jobs, { remoteCertIds: new Set(['gone']) }), []);
});
test('when it is safe to look', () => {
  assert.equal(L.orphanCheckSafe({ syncOn: false }), true, 'sync off: this device is the only copy');
  assert.equal(L.orphanCheckSafe({ syncOn: true }), false, 'sync on, at start: wait for sync');
  assert.equal(L.orphanCheckSafe({ syncOn: true, afterSync: true, pulledOk: true, firstSync: true }), false, 'first sync');
  assert.equal(L.orphanCheckSafe({ syncOn: true, afterSync: true, pulledOk: false, firstSync: false }), false, 'a job.json could not be read');
  assert.equal(L.orphanCheckSafe({ syncOn: true, afterSync: true, pulledOk: true, firstSync: false }), true);
});
