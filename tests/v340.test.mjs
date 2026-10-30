// v0.34.0: calc fixes (Cg round-up, Ci on A/100-103, BS 3036 ring), Section I/J, bidirectional remarks, copy board to another job, Esc.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { cgFor, CABLES, methodHasInsulation, effectiveCi } from '../js/cables.js';
import { sizeCable } from '../js/calc.js';
import { sizeCircuit } from '../js/design.js';
import { bidiCircuits, addBidiRemark, bidiRemarksDone, hasBidiNote, copyBoardToCert } from '../js/templates.js';
import { isNewInstall, SECTION_I_NA, sectionsFor } from '../js/certmodel.js';
import * as S from './sample-data.mjs';
const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('v340: Cg between Table 4C1 columns rounds UP', () => {
  for (const [n, v] of [[9, 0.5], [10, 0.45], [11, 0.45], [12, 0.45], [13, 0.41], [15, 0.41], [16, 0.41], [17, 0.38], [19, 0.38], [20, 0.38], [30, 0.38]]) assert.equal(cgFor('bunched', n), v, 'n=' + n);
  assert.equal(cgFor('clipped', 15), 0.7); // only 1-9 in that row: 9+ stays the last column
});
test('v340: worked example 16 A, method 100, 10 circuits -> 10 mm2 (both calculators)', () => {
  const a = sizeCable({ cable: 'te', method: '100', ib: 16, inA: 16, length: 10, grouped: 10 });
  assert.equal(a.factors.cg, 0.45); assert.equal(a.pick.size, 10);
  const b = sizeCircuit({ load: 16, unit: 'A', length: 10, cable: 'te', method: '100', grouped: 10, device: 'rcbo', type: 'B' });
  assert.equal(b.factors.cg, 0.45); assert.equal(b.pick.size, 10);
});
test('v340: Ci not applied for methods A and 100-103; still applied otherwise', () => {
  for (const m of ['A', '100', '101', '102', '103']) assert.ok(methodHasInsulation(m), m);
  for (const m of ['B', 'C', 'E', 'D1']) assert.ok(!methodHasInsulation(m), m);
  assert.equal(effectiveCi('102', 0.5), 1); assert.equal(effectiveCi('C', 0.5), 0.5);
  const a = sizeCable({ cable: 'te', method: '102', ib: 20, inA: 20, length: 10, insulationCi: 0.5 });
  assert.equal(a.factors.ci, 1); assert.equal(a.pick.size, 2.5);
  const b = sizeCircuit({ load: 20, unit: 'A', length: 10, cable: 'te', method: '102', ci: 0.5, device: 'rcbo', type: 'B' });
  assert.equal(b.factors.ci, 1); assert.equal(b.pick.size, 2.5);
  const c = sizeCable({ cable: 'te', method: 'C', ib: 20, inA: 20, length: 10, insulationCi: 0.5 });
  assert.equal(c.factors.ci, 0.5); assert.ok(c.pick.size > 2.5);
  const d = sizeCable({ cable: 'singles', method: 'A', ib: 16, inA: 16, length: 10, insulationCi: 0.5 });
  assert.equal(d.factors.ci, 1);
});
test('v340: 2.5 mm2 ring on a 30 A BS 3036 passes (433.1.204, no 0.725 on top)', () => {
  const a = sizeCable({ cable: 'te', method: 'C', ib: 20, inA: 30, length: 40, bs3036: true, ring: 'point' });
  assert.equal(a.pick.size, 2.5); assert.equal(a.rows.find((r) => r.size === 2.5).iz, 27);
  const b = sizeCircuit({ load: 20, unit: 'A', loadType: 'ring', length: 40, cable: 'te', method: 'C', device: 'bs3036', type: 'auto' });
  assert.equal(b.inA, 30); assert.equal(b.pick.size, 2.5);
  // a radial on a BS 3036 still gets the 0.725
  const r = sizeCable({ cable: 'te', method: 'C', ib: 20, inA: 30, length: 10, bs3036: true });
  assert.equal(r.factors.cf, 0.725); assert.ok(r.pick.size > 2.5);
});
test('v340: singles method A 2.5 mm2 stays 20 A (Table 4D1A col 2)', () => { assert.equal(CABLES.singles.methods.A.amps[2.5], 20); });
test('v340: Ci picker greyed with the note in both calculators', () => {
  assert.match(src('js/calckit.js'), /export function ciPick[\s\S]{0,300}disabled: off, naText: 'N\/A \(Ci not used\)'/);
  assert.match(src('js/cables.js'), /INSULATED_METHOD_NOTE = 'This method already allows for thermal insulation'/);
  assert.match(src('js/calcui.js'), /ciPick\(v, set,/); assert.match(src('js/calcsize.js'), /ciPick\(v, set, CI_OPTIONS\)/);
});
test('v340: bidirectional note goes into the affected circuits\u2019 Remarks', () => {
  const b = S.board(); b.circuits[2].desc = 'Battery inverter';
  let list = bidiCircuits(b); assert.deepEqual(list.map((c) => c.num), [b.circuits[2].num]);
  list.forEach(addBidiRemark); assert.ok(hasBidiNote(b.circuits[2].remarks)); assert.ok(bidiRemarksDone(list));
  addBidiRemark(b.circuits[2]); assert.equal((b.circuits[2].remarks.match(/530\.3\.201/g) || []).length, 1);
  const b2 = S.board(); b2.fedBySource = true; list = bidiCircuits(b2);
  assert.equal(list.length, b2.circuits.length - 1); // not the spare
  b2.circuits[1].remarks = 'Existing remark'; addBidiRemark(b2.circuits[1]); assert.match(b2.circuits[1].remarks, /^Existing remark; Devices/);
  assert.match(src('js/schedule.js'), /cert\.type !== 'MW' && targets/);
});
test('v340: copy a board with circuits and readings to another certificate', () => {
  const from = S.sampleEIC(); const to = S.sampleEICR(); const n0 = to.boards.length;
  const nb = copyBoardToCert(to, from.boards[0]);
  assert.equal(to.boards.length, n0 + 1); assert.notEqual(nb.id, from.boards[0].id);
  assert.equal(nb.ref, 'DB' + (n0 + 1)); // DB1 already used there
  assert.equal(nb.circuits.length, from.boards[0].circuits.length);
  assert.equal(nb.circuits[0].zs, from.boards[0].circuits[0].zs); assert.equal(nb.zdb, from.boards[0].zdb);
  nb.circuits[0].zs = '9'; assert.notEqual(from.boards[0].circuits[0].zs, '9');
  const empty = { boards: [] }; assert.equal(copyBoardToCert(empty, from.boards[0]).ref, from.boards[0].ref);
});
test('v340: Section I on a new installation', () => {
  const c = S.sampleEIC(); assert.ok(!isNewInstall(c)); c.install.extentType = 'New installation'; assert.ok(isNewInstall(c));
  assert.equal(SECTION_I_NA, 'N/A \u2013 new installation');
  const fd = sectionsFor('EIC').find((s) => s.id === 'comments').fields[0]; assert.equal(fd.placeholder(c), SECTION_I_NA);
});
test('v340: Esc closes the top overlay (backnav)', () => {
  const s = src('js/backnav.js'); assert.match(s, /e\.key !== 'Escape'/); assert.match(s, /closeEl\(top\)/);
});
test('v340: version', () => { assert.match(src('js/config.js'), /APP_VERSION = '0\.3[4-7]\.[0-5] beta'/); assert.match(src('sw.js'), /sparky-v0\.3[4-7]\.[0-5]/); });

// PDF: real render with the Node jsPDF build, read back with pdftotext.
const JSPDF = '/workspace/sparky-work/npm/package/dist/jspdf.node.min.js';
async function pdfPages(cert) {
  globalThis.jspdf = createRequire(import.meta.url)(JSPDF);
  const { certificatePdf } = await import('../js/pdf.js');
  const b = await certificatePdf(cert, { profile: S.PROFILE });
  const d = mkdtempSync('/tmp/v340-'); writeFileSync(d + '/c.pdf', Buffer.from(await b.arrayBuffer()));
  return execFileSync('pdftotext', ['-layout', d + '/c.pdf', '-'], { encoding: 'utf8' }).split('\f');
}
test('v340: PDF new install prints N/A in Section I; J on page 2', async () => {
  const c = S.sampleEIC(); c.install.extentType = 'New installation'; c.comments = '';
  const p = await pdfPages(c);
  assert.match(p[1], /SECTION I[\s\S]*N\/A – new installation[\s\S]*SECTION J/);
});
test('v340: PDF short comment stays; long comment moves wholly to a continuation sheet', async () => {
  const c = S.sampleEIC(); c.comments = 'Existing bonding to gas checked and found satisfactory.';
  let p = await pdfPages(c);
  assert.match(p[1], /Existing bonding to gas checked/); assert.ok(!/COMMENTS ON EXISTING INSTALLATION \(continuation/.test(p.join('')));
  const long = Array.from({ length: 14 }, (_, i) => `Comment line ${i + 1}: existing circuits on the old board were inspected and the readings are recorded on the schedules, see remarks.`).join(' ');
  c.comments = long; p = await pdfPages(c);
  assert.match(p[1], /See continuation sheet/); assert.match(p[1], /SECTION J/); assert.ok(!/Comment line 1:/.test(p[1]));
  const cont = p.findIndex((t) => /COMMENTS ON EXISTING INSTALLATION \(continuation sheet\)/.test(t));
  assert.ok(cont > 1); assert.match(p[cont], /Comment line 1:/); assert.match(p.slice(cont).join(''), /Comment line 14:/);
  assert.match(p[1], /Section I comments/);
});
test('v340: continuation sheet wraps inside the page (wrapped on the portrait page, not the landscape schedule)', async () => {
  globalThis.jspdf = createRequire(import.meta.url)(JSPDF);
  const { certificatePdf } = await import('../js/pdf.js');
  const c = S.sampleEIC(); c.comments = Array.from({ length: 12 }, (_, i) => `Item ${i + 1}: existing circuit wiring on the old board was inspected where accessible; insulation resistance readings are recorded on the schedule and no damage was seen.`).join('\n');
  const d = mkdtempSync('/tmp/v340w-'); writeFileSync(d + '/c.pdf', Buffer.from(await (await certificatePdf(c, { profile: S.PROFILE })).arrayBuffer()));
  const html = execFileSync('pdftotext', ['-bbox', d + '/c.pdf', '-'], { encoding: 'utf8' });
  const pages = html.split('<page ').slice(1).filter((p) => /continuation&#32;sheet|continuation sheet/.test(p) || /COMMENTS/.test(p) && /Item/.test(p));
  assert.ok(pages.length);
  for (const p of pages) { const W = +p.match(/width="([\d.]+)"/)[1]; for (const m of p.matchAll(/xMax="([\d.]+)"/g)) assert.ok(+m[1] < W - 20, 'word past the right margin'); }
});
