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

const threeObs = (c) => { c.observations.push({ id: 'o4', text: 'Exposed live conductors at damaged socket', code: 'C1', reg: '416.1', location: 'Kitchen' }, { id: 'o5', text: 'Bonding to gas missing', code: 'C2', reg: '411.3.1.2', location: 'Meter cupboard' }); return c; };
const withNotice = () => {
  const c = threeObs(S.sampleEICR()); const n = D.blankNotice(c, null, 'dn1');
  Object.assign(n, { action: 'isolated', informed: true, remedial: 'Fit 30 mA RCD protection to the circuit', date: '2026-10-20', custName: 'A. N. Example' });
  c.dangerNotices = [n]; return { c, n };
};
const txt = async (blob) => { const f = `/tmp/sparky-v17-${Math.random().toString(36).slice(2)}.pdf`; fs.writeFileSync(f, Buffer.from(await blob.arrayBuffer())); return { f, t: execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' '), pages: +execFileSync('pdfinfo', [f], { encoding: 'utf8' }).match(/Pages:\s+(\d+)/)[1] }; };
const overlaps = (f) => execFileSync('python3', [new URL('./pdf_overlap.py', import.meta.url).pathname, f], { encoding: 'utf8' });

test('new notice takes all C1/C2 observations not already on a notice', () => {
  const { c, n } = withNotice();
  assert.deepEqual(n.items.map((i) => i.obsId), ['o1', 'o4', 'o5']);
  assert.equal(n.items[0].location, 'Circuit 5 (demo)'); assert.equal(n.items[1].code, 'C1');
  assert.deepEqual(D.freeDangerObs(c), []);
  assert.equal(D.noticeForObs(c, c.observations[3]), n);
  assert.deepEqual(D.blankNotice(c).items, [], 'second notice: nothing left to take');
  assert.ok(D.dangerCodes(c.observations[0]) && !D.dangerCodes(c.observations[1]));
});
test('open notices, add and remove observations', () => {
  const c = threeObs(S.sampleEICR()); const n = D.blankNotice(c, c.observations[0], 'a'); c.dangerNotices = [n];
  assert.equal(D.openNotices(c).length, 1); D.addObs(c, n, c.observations[3]); D.addObs(c, n, c.observations[3]);
  assert.equal(n.items.length, 2); D.removeObs(n, 'o1'); assert.deepEqual(n.items.map((i) => i.obsId), ['o4']);
  n.sig = { img: 'x' }; assert.equal(D.openNotices(c).length, 0);
});
test('older single-item notice shape migrates on read', () => {
  const c = S.sampleEICR();
  c.dangerNotices = [{ id: 'old', obsId: 'o1', code: 'C2', text: 'Old text', location: 'Loc', reg: '1.2', action: 'isolated', remedial: 'Fix', date: '2026-10-20', sig: null }];
  const [n] = D.noticesOf(c);
  assert.equal(n.items.length, 1); assert.equal(n.items[0].obsId, 'o1'); assert.equal(n.items[0].text, 'Old text'); assert.equal(n.text, undefined);
  assert.equal(n.action, 'isolated'); assert.equal(D.noticeForObs(c, c.observations[0]), n);
  D.migrateNotice(n); assert.equal(n.items.length, 1, 'safe to run twice');
});
test('per-item action and remedial override the shared ones; missing list', () => {
  const { n } = withNotice();
  assert.deepEqual(D.noticeMissing(n), ['Your signature']);
  n.sig = { img: 'x' }; assert.deepEqual(D.noticeMissing(n), []);
  n.items[1].action = 'other'; assert.deepEqual(D.noticeMissing(n), ['Details of the action taken']);
  n.items[1].actionOther = 'Shrouded'; n.items[1].remedial = 'Replace socket';
  assert.equal(D.itemAction(n, n.items[1]).action, 'other'); assert.equal(D.itemAction(n, n.items[0]).action, 'isolated');
  assert.equal(D.itemRemedial(n, n.items[1]), 'Replace socket'); assert.match(D.itemRemedial(n, n.items[0]), /RCD/);
  n.remedial = ''; assert.deepEqual(D.noticeMissing(n), ['Recommended remedial action']);
});
test('older certificates without dangerNotices still work', () => {
  const c = S.sampleEICR(); delete c.dangerNotices;
  assert.deepEqual(D.noticesOf(c), []); assert.equal(D.noticeFor(c, c.observations[0]), ''); assert.equal(D.withNotices(c, 'Fair'), 'Fair');
});
test('main certificate notes the notice beside each observation; loose items go in the text', async () => {
  const { c } = withNotice();
  assert.equal(D.noticeFor(c, c.observations[3]), `[Danger notification ${c.number}-DN1 issued 20/10/2026]`);
  const { t } = await txt(await P.certificatePdf(c, { profile: S.PROFILE }));
  assert.equal((t.replace(/\s+/g, ' ').match(/Danger notification \S+-DN1/g) || []).length, 3);
  const mw = S.sampleMW(); const n = D.blankNotice(mw, null, 'x'); n.items.push({ ...D.blankItem(), text: 'Exposed live conductors at kitchen spur' }); n.date = '2026-10-20'; mw.dangerNotices = [n];
  assert.match(D.withNotices(mw, mw.mw.comments), /Danger notification .*-DN1 issued 20\/10\/2026: C1 – Exposed live/);
});
test('danger notice PDF: 3 items on one page, table, prefilled details, no overlaps', async () => {
  const { c, n } = withNotice(); n.items[1].action = 'madeSafe'; n.items[1].remedial = 'Replace the damaged socket-outlet';
  const { f, t, pages } = await txt(await dangerPdf(c, n, S.PROFILE));
  assert.equal(pages, 1);
  for (const s of ['DANGER NOTIFICATION', '3 items', 'No RCD protection', 'Exposed live conductors', 'Bonding to gas missing', 'Made safe', 'As section 3', 'As section 4', 'Replace the damaged', '12 Imaginary Road', 'Electricity at Work Regulations 1989', 'A. N. Example', 'REMEDIAL WORK COMPLETED']) assert.ok(t.includes(s), s);
  assert.match(overlaps(f), /overlaps: 0/);
});
test('danger notice PDF: many items run onto a continuation page cleanly', async () => {
  const { c, n } = withNotice();
  for (let i = 0; i < 14; i++) n.items.push({ ...D.blankItem(), code: i % 2 ? 'C2' : 'C1', text: `Demo defect number ${i + 4} with a longer description so that the row wraps over two lines`, location: 'Circuit ' + (i + 1) });
  const { f, t, pages } = await txt(await dangerPdf(c, n, S.PROFILE));
  assert.ok(pages >= 2); assert.ok(t.includes('(continued)')); assert.ok(t.includes('Demo defect number 17'));
  assert.match(overlaps(f), /overlaps: 0/);
});
test('email subject and body', () => {
  const { c, n } = withNotice();
  const e = D.emailParts(c, { profile: S.PROFILE });
  assert.equal(e.subject, `Electrical certificate ${c.number} – 12 Imaginary Road`);
  assert.match(e.body, /^Hello A\. N\. Example,/); assert.match(e.body, /Sam Sparks/);
  assert.match(D.emailParts(c, { notice: n }).subject, /^Danger notification .*-DN1 – 12 Imaginary Road$/);
  assert.match(D.mailtoUrl('a@example.com', e), /^mailto:a@example.com\?subject=Electrical%20certificate/);
});
