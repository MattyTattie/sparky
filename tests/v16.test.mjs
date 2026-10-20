// v0.16 tests: schedule page order board by board, multi-line addresses in the PDF. FAKE data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const P = await import('../js/pdf.js');
const S = await import('./sample-data.mjs');
const V = await import('./pdf_v16.mjs');

test('schedules go board by board: all DB1, then all DB2', () => {
  const c = V.twoBoards(S.sampleEIC());
  const order = P.scheduleOrder(c).map((g) => `${g.b.ref}:${g.kind}${g.part}`);
  assert.deepEqual(order, ['DB1:cd1', 'DB1:tr1', 'DB2:cd1', 'DB2:cd2', 'DB2:tr1', 'DB2:tr2']);
});
test('one board: same pages as before', () => {
  assert.deepEqual(P.scheduleOrder(S.sampleEIC()).map((g) => g.kind), ['cd', 'tr']);
});
test('multi-line addresses wrap and push the postcode down (no overlaps, EIC/EICR/MW)', async () => {
  const dir = fs.mkdtempSync('/tmp/sparky-v16-');
  const files = [];
  for (const [n, b] of Object.entries(await V.v16Pdfs())) { const f = `${dir}/${n}.pdf`; fs.writeFileSync(f, Buffer.from(await b.arrayBuffer())); files.push(f); }
  const out = execFileSync('python3', [new URL('./pdf_overlap.py', import.meta.url).pathname, ...files], { encoding: 'utf8' });
  assert.match(out, /overlaps: 0/);
  const txt = execFileSync('pdftotext', ['-layout', files[0], '-'], { encoding: 'utf8' });
  assert.ok(txt.includes('Sample Industrial Estate') && txt.includes('Long Lane Road'), 'every address line printed');
});
