// v0.18 tests: job "Next step", PDF logo keeps its shape, dark theme file. FAKE data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
globalThis.jspdf ||= createRequire(import.meta.url)('/workspace/sparky-work/npm/package/dist/jspdf.node.min.js');
const S = await import('./sample-data.mjs');
const { nextStep, certProgress } = await import('../js/jobnext.js');
const { Kit, loadJsPDF } = await import('../js/pdfkit.js');
const P = await import('../js/pdf.js');
const { LOGOS } = await import('./logos.mjs');

test('next step: no certificates → add one', () => {
  const n = nextStep([]); assert.equal(n.kind, 'start'); assert.equal(n.href, null); assert.match(n.label, /Add certificate/);
});
test('next step: draft with work left → continue at the first unfinished section', () => {
  const c = S.sampleEICR(); c.id = 'x'; c.status = 'draft'; c.sigs = {};
  const n = nextStep([c]);
  assert.ok(['continue', 'sign', 'send'].includes(n.kind));
  if (n.kind === 'continue') { assert.match(n.label, /^Continue EICR-/); assert.match(n.href, /^#\/cert\/x\/(s\/|boards)/); }
  const p = certProgress(c); assert.ok(p.total > 0 && p.done <= p.total);
});
test('next step: everything but signatures → Sign & send', () => {
  const c = S.sampleEICR(); c.id = 'y'; c.status = 'draft'; c.sigs = {};
  const p = certProgress(c);
  if (p.left.every((s) => s.special === 'sign')) { const n = nextStep([c]); assert.equal(n.kind, 'sign'); assert.match(n.label, /^Sign & send/); }
});
test('next step: all issued → open the latest', () => {
  const a = S.sampleEIC(); a.id = 'a'; a.status = 'issued'; a.issuedAt = '2026-10-01';
  const b = S.sampleMW(); b.id = 'b'; b.status = 'issued'; b.issuedAt = '2026-10-10';
  const n = nextStep([a, b]); assert.equal(n.kind, 'done'); assert.equal(n.href, '#/cert/b');
});
test('newest draft wins over older ones', () => {
  const a = S.sampleEIC(); a.id = 'a'; a.status = 'draft'; a.updatedAt = '2026-10-01';
  const b = S.sampleEICR(); b.id = 'b'; b.status = 'draft'; b.updatedAt = '2026-10-19';
  assert.equal(nextStep([a, b]).cert.id, 'b');
});
test('logo fitted inside 22x11 keeping its shape', async () => {
  const { jsPDF } = await loadJsPDF(); const k = new Kit(jsPDF);
  const near = (a, b) => Math.abs(a - b) < 0.01;
  let d = k.imageContain(LOGOS.sq, 10, 10, 22, 11, 'PNG'); assert.ok(near(d.w, 11) && near(d.h, 11));
  d = k.imageContain(LOGOS.wide, 10, 10, 22, 11, 'PNG'); assert.ok(near(d.w, 22) && near(d.h, 5.5));
  d = k.imageContain(LOGOS.tall, 10, 10, 22, 11, 'PNG'); assert.ok(near(d.h, 11) && near(d.w, 11 / 3));
});
test('certificate PDF with a square logo still builds', async () => {
  const b = await P.certificatePdf(S.sampleEIC(), { profile: { ...S.PROFILE, logo: LOGOS.sq } });
  assert.ok(b.size > 10000);
});
test('dark theme: generated, keeps signatures/PDF pages white, follows the system', () => {
  const css = fs.readFileSync(new URL('../dark.css', import.meta.url), 'utf8');
  assert.match(css, /html\.dark \.sigpad[^{]*\{[^}]*background: #fff/);
  assert.match(css, /html\.dark \.pdfpage \{ background: #fff/);
  const js = fs.readFileSync(new URL('../js/theme.js', import.meta.url), 'utf8');
  assert.match(js, /prefers-color-scheme: dark/); assert.match(js, /'system'/);
  const idx = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(idx.indexOf('dark.css') > idx.indexOf('styles.css'));
});
