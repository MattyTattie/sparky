// v0.17.1 tests: saved PDFs list, deleting a certificate's PDFs, dates not split when wrapped. FAKE data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
globalThis.jspdf ||= createRequire(import.meta.url)('/workspace/sparky-work/npm/package/dist/jspdf.node.min.js');
const L = await import('../js/pdflist.js');
const { Kit, loadJsPDF } = await import('../js/pdfkit.js');

const F = [
  { id: 'a', certId: 'c1', kind: 'pdf', name: 'EIC-0001-12-Imaginary-Road.pdf', createdAt: '2026-10-18T16:40:00Z' },
  { id: 'b', certId: 'c1', kind: 'pdf', name: 'EIC-0001-12-Imaginary-Road.pdf', createdAt: '2026-10-20T09:12:00Z' },
  { id: 'c', certId: 'c1', kind: 'chart', name: 'EIC-0001-chart-DB1.pdf', createdAt: '2026-10-19T10:00:00Z' },
  { id: 'd', certId: 'c2', kind: 'pdf', name: 'MW-0003.pdf', createdAt: '2026-10-02T11:05:00Z' },
  { id: 'e', kind: 'photo', name: 'photo.jpg', createdAt: '2026-10-21T10:00:00Z' },
];
test('PDFs of one certificate (photos and other certificates left alone)', () => {
  assert.deepEqual(L.pdfsOfCert(F, 'c1').map((f) => f.id), ['a', 'b', 'c']);
  assert.deepEqual(L.pdfsOfCert(F, 'c2').map((f) => f.id), ['d']);
});
test('list newest first, newest per certificate marked Latest', () => {
  const r = L.pdfRows(F);
  assert.deepEqual(r.map((x) => x.f.id), ['b', 'c', 'a', 'd']);
  assert.deepEqual(r.map((x) => x.latest), [true, true, false, true]);
});
test('danger notice PDFs count as their own document', () => {
  const r = L.pdfRows([...F, { id: 'n', certId: 'c1', kind: 'pdf', name: 'EIC-0001-DN1-12-Imaginary-Road.pdf', createdAt: '2026-10-01T10:00:00Z' }]);
  assert.equal(r.find((x) => x.f.id === 'n').latest, true);
});
test('date and time made', () => {
  const s = L.madeAt('2026-10-20T09:12:00Z');
  assert.match(s, /20 Oct 2026, \d{2}:\d{2}/); assert.equal(L.madeAt(''), '');
});
test('sync does not bring back a deleted certificate or its PDFs', () => {
  const d = { job: { id: 'j' }, certs: [{ id: 'c1' }, { id: 'c2' }], files: F };
  const out = L.skipDeleted(d, { certs: { c1: 'x' }, files: {} });
  assert.deepEqual(out.certs.map((c) => c.id), ['c2']);
  assert.deepEqual(out.files.map((f) => f.id), ['d', 'e']);
  assert.equal(L.skipDeleted(d, null), d);
});
test('a date is never split across lines when text wraps', async () => {
  const { jsPDF } = await loadJsPDF(); const k = new Kit(jsPDF);
  for (let w = 40; w < 120; w += 3) {
    const ls = k.wrap('Bonding to gas missing — Meter cupboard (Reg. 411.3.1.2) [Danger notification EICR-0001-DN1 issued 20/10/2026]', w, 8);
    assert.ok(ls.some((l) => l.includes('20/10/2026')), 'width ' + w + ': ' + JSON.stringify(ls));
  }
});
