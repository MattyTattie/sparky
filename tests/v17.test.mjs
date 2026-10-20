// v0.17 tests: danger notices (data, note on the certificate, one-page PDF) and email text. FAKE data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
globalThis.jspdf ||= createRequire(import.meta.url)('/workspace/sparky-work/npm/package/dist/jspdf.node.min.js');
const S = await import('./sample-data.mjs');
const D = await import('../js/dangermodel.js');
const { dangerPdf } = await import('../js/dangerpdf.js');
const P = await import('../js/pdf.js');

const withNotice = () => {
  const c = S.sampleEICR(); const n = D.blankNotice(c, c.observations[0], 'dn1');
  Object.assign(n, { action: 'isolated', informed: true, remedial: 'Fit 30 mA RCD protection to the circuit', date: '2026-10-20', custName: 'A. N. Example' });
  c.dangerNotices = [n]; return { c, n };
};
const txt = async (blob) => { const f = `/tmp/sparky-v17-${Math.random().toString(36).slice(2)}.pdf`; fs.writeFileSync(f, Buffer.from(await blob.arrayBuffer())); return { f, t: execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' }) }; };

test('blank notice is prefilled from the observation', () => {
  const c = S.sampleEICR(); const n = D.blankNotice(c, c.observations[0]);
  assert.equal(n.obsId, 'o1'); assert.equal(n.code, 'C2'); assert.equal(n.location, 'Circuit 5 (demo)'); assert.match(n.text, /No RCD protection/);
  assert.ok(D.dangerCodes(c.observations[0]) && !D.dangerCodes(c.observations[1]));
});
test('missing list until filled in and signed', () => {
  const { n } = withNotice();
  assert.deepEqual(D.noticeMissing(n), ['Your signature']);
  n.sig = { img: 'x' }; assert.deepEqual(D.noticeMissing(n), []);
  n.action = 'other'; assert.deepEqual(D.noticeMissing(n), ['Details of the action taken']);
});
test('older certificates without dangerNotices still work', () => {
  const c = S.sampleEICR(); delete c.dangerNotices;
  assert.deepEqual(D.noticesOf(c), []); assert.equal(D.noticeFor(c, c.observations[0]), ''); assert.equal(D.withNotices(c, 'Fair'), 'Fair');
});
test('main certificate notes the notice beside the observation; loose notices go in the text', async () => {
  const { c } = withNotice();
  assert.equal(D.noticeFor(c, c.observations[0]), `[Danger notification ${c.number}-DN1 issued 20/10/2026]`);
  const { t } = await txt(await P.certificatePdf(c, { profile: S.PROFILE }));
  assert.match(t.replace(/\s+/g, ' '), /Danger notification \S+-DN1 issued 20\/10\/2026/);
  const mw = S.sampleMW(); mw.dangerNotices = [Object.assign(D.blankNotice(mw, null, 'x'), { text: 'Exposed live conductors at kitchen spur', date: '2026-10-20' })];
  assert.match(D.withNotices(mw, mw.mw.comments), /Danger notification .*-DN1 issued 20\/10\/2026: C1 – Exposed live/);
});
test('danger notice PDF: one page, heading, prefilled details, no overlaps', async () => {
  const { c, n } = withNotice();
  const { f, t } = await txt(await dangerPdf(c, n, S.PROFILE));
  const pages = execFileSync('pdfinfo', [f], { encoding: 'utf8' }).match(/Pages:\s+(\d+)/)[1];
  assert.equal(pages, '1');
  for (const s of ['DANGER NOTIFICATION', 'No RCD protection', 'Circuit 5 (demo)', 'Fit 30 mA RCD', '12 Imaginary Road', 'Electricity at Work Regulations 1989', 'A. N. Example']) assert.ok(t.includes(s), s);
  const out = execFileSync('python3', [new URL('./pdf_overlap.py', import.meta.url).pathname, f], { encoding: 'utf8' });
  assert.match(out, /overlaps: 0/);
});
test('email subject and body', () => {
  const { c, n } = withNotice();
  const e = D.emailParts(c, { profile: S.PROFILE });
  assert.equal(e.subject, `Electrical certificate ${c.number} – 12 Imaginary Road`);
  assert.match(e.body, /^Hello A\. N\. Example,/); assert.match(e.body, /Sam Sparks/);
  assert.match(D.emailParts(c, { notice: n }).subject, /^Danger notification .*-DN1 – 12 Imaginary Road$/);
  assert.match(D.mailtoUrl('a@example.com', e), /^mailto:a@example.com\?subject=Electrical%20certificate/);
});
