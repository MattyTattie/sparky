// v0.5 tests: three-phase sizer, PDF layout (no overlaps, no mid-word breaks,
// grouped schedules, continuation sheets), supplementary bonding. FAKE data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.jspdf ||= require('/workspace/sparky-work/npm/package/dist/jspdf.node.min.js');
const { designCurrent, sizeCircuit } = await import('../js/design.js');
const { Kit } = await import('../js/pdfkit.js');
const { certificatePdf, scheduleSheets, bondRows, PER_SHEET } = await import('../js/pdf.js');
const { sectionsFor, sectionDone } = await import('../js/certmodel.js');
const S = await import('./sample-data.mjs');
const { stressify } = await import('./stress_pdf.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sparky-v05-'));
const save = async (name, blob) => { const f = path.join(tmp, name); fs.writeFileSync(f, Buffer.from(await blob.arrayBuffer())); return f; };
const pageTitles = (f) => { const n = Number(/Pages:\s+(\d+)/.exec(spawnSync('pdfinfo', [f]).stdout.toString())[1]); return Array.from({ length: n }, (_, i) => spawnSync('pdftotext', ['-f', String(i + 1), '-l', String(i + 1), '-layout', f, '-']).stdout.toString()); };

test('3-phase: Ib = P / (√3 × 400 × pf)', () => {
  assert.equal(designCurrent({ load: 22, unit: 'kW', phase: 3 }), 31.75);
  assert.equal(designCurrent({ load: 11, unit: 'kW', pf: 0.85, phase: 3 }), 18.68);
  assert.equal(designCurrent({ load: 16, unit: 'A', phase: 3 }), 16);
  assert.equal(designCurrent({ load: 4.6, unit: 'kW' }), 20); // single-phase unchanged
});
test('3-phase sizer: 22 kW at 40 m on 4-core SWA → 32 A TP, 4 mm²; volt drop is % of 400 V', () => {
  const r = sizeCircuit({ load: 22, unit: 'kW', length: 40, cable: 'swa4', method: 'C', phase: 3, device: 'mcb', ze: 0.35 });
  assert.ok(r.ok); assert.equal(r.phase, 3); assert.equal(r.inA, 32); assert.equal(r.pick.size, 4); assert.equal(r.vref, 400);
  assert.equal(r.pick.vd.volts, Math.round(9.5 * 31.75 * 40 / 10) / 100);
  assert.ok(r.pick.z.zs > 0.35 && r.pick.adi.ok, 'Zs and adiabatic are worked out phase–earth');
  assert.match(r.steps[0], /√3 × 400 V/);
});
test('3-phase sizer refuses single-phase cables and rings (and vice versa)', () => {
  assert.equal(sizeCircuit({ load: 10, unit: 'kW', length: 10, cable: 'te', phase: 3 }).ok, false);
  assert.equal(sizeCircuit({ load: 10, unit: 'kW', length: 10, cable: 'swa4', loadType: 'ring', phase: 3 }).ok, false);
  assert.equal(sizeCircuit({ load: 10, unit: 'A', length: 10, cable: 'swa4', method: 'C' }).ok, false);
  const one = sizeCircuit({ load: 20, unit: 'A', length: 32, cable: 'te', method: 'C' });
  assert.equal(one.pick.size, 4); assert.equal(one.phase, 1); // v0.4 result unchanged
});
test('PDF wrap never breaks inside a word', () => {
  const k = new Kit(globalThis.jspdf.jsPDF);
  assert.deepEqual(k.wrap('Switch-disconnector', 20, 8.5), ['Switch-', 'disconnector']);
  assert.deepEqual(k.wrap('ALEXANDER MACKENZIE', 25, 8.5), ['ALEXANDER', 'MACKENZIE']);
  for (const l of k.wrap('Hot and cold water pipes, Central heating pipes, Radiator / towel rail', 30, 8)) assert.ok(k.tw(l, 8) <= 30.01, l);
});
test('PDF field: a long value in a narrow one-line field shrinks, keeps whole words, stays one line', () => {
  const k = new Kit(globalThis.jspdf.jsPDF);
  assert.equal(k.field('Device type MCCB / ACB / Fuse(s) / other', 'Switch-disconnector', 10, 50, 60, { unit: '' }), 0);
  assert.equal(k.field('Name (IN BLOCK CAPITALS):', 'ALEXANDER MACKENZIE', 10, 60, 76), 0);
  assert.ok(k.field('Address:', 'A very long address line that will need to wrap onto a second line inside a narrow box', 10, 70, 60, { grow: true }) > 0);
});
test('PDF: schedules grouped (all circuit details, then all test results), labelled sheets', async () => {
  const c = stressify(S.sampleEIC(), 40);
  assert.equal(scheduleSheets(c).length, Math.ceil(40 / PER_SHEET));
  const pages = pageTitles(await save('eic.pdf', await certificatePdf(c, { profile: S.PROFILE })));
  const kinds = pages.map((t) => (/SCHEDULE OF CIRCUIT DETAILS/.test(t) ? 'D' : /SCHEDULE OF TEST RESULTS/.test(t) ? 'T' : /SUPPLEMENTARY BONDING/.test(t) ? 'B' : '-')).join('');
  assert.match(kinds, /^-+DDDT{3,}B-{1,2}$/); // v0.34.0: a long Section I adds its continuation sheet after the schedules // v0.33.1: long remarks grow rows; overflow rows go to a '(continued)' sheet
  assert.equal(pages.filter((t) => /SCHEDULE OF TEST RESULTS/.test(t) && !/continued/.test(t)).length, 3);
  const d2 = pages.find((t) => /CIRCUIT DETAILS/.test(t) && /Sheet 2 of 3/.test(t));
  assert.ok(d2 && /DB-GARAGE-SUB-1/.test(d2) && /continuation/.test(d2) && /EIC-000123-LONG/.test(d2));
  pages.forEach((t, i) => assert.match(t, new RegExp(`Page ${i + 1} of ${pages.length}`)));
});
test('PDF: no words overlap or leave the page (EIC, EICR with 30 observations, MW; long values)', async () => {
  const files = [
    await save('s-eic.pdf', await certificatePdf(stressify(S.sampleEIC(), 40), { profile: S.PROFILE })),
    await save('s-eicr.pdf', await certificatePdf(stressify(S.sampleEICR(), 40, 30), { profile: S.PROFILE })),
    await save('s-mw.pdf', await certificatePdf(stressify(S.sampleMW(), 1), { profile: S.PROFILE })),
    await save('eic.pdf', await certificatePdf(S.sampleEIC(), { profile: S.PROFILE })),
    await save('eicr.pdf', await certificatePdf(S.sampleEICR(), { profile: S.PROFILE })),
  ];
  const r = spawnSync('python3', [new URL('./pdf_overlap.py', import.meta.url).pathname, ...files]);
  assert.equal(r.status, 0, r.stdout.toString().slice(-2000));
});
test('PDF: observations flow onto continuation pages', async () => {
  const pages = pageTitles(await save('obs.pdf', await certificatePdf(stressify(S.sampleEICR(), 4, 30), { profile: S.PROFILE })));
  assert.ok(pages.filter((t) => /SECTION K: OBSERVATIONS \(continued\)/.test(t)).length >= 1);
  const all = pages.join('\n'); for (let i = 1; i <= 30; i++) assert.match(all, new RegExp(`Observation ${i}:`));
});
test('Supplementary bonding: optional, filtered, section done rules', () => {
  const c = S.sampleEIC();
  assert.deepEqual(bondRows(c), []); // old certificates have no bonding field
  assert.ok(sectionsFor('EIC').some((s) => s.id === 'bonding') && sectionsFor('EICR').some((s) => s.id === 'bonding') && !sectionsFor('MW').some((s) => s.id === 'bonding'));
  const sec = sectionsFor('EIC').find((s) => s.id === 'bonding');
  assert.equal(sectionDone(c, sec), false);
  c.bonding = [{ id: 'b', location: 'Bathroom', parts: 'Pipes', csa: '4', reading: '0.03', verified: true }, { id: 'e', location: '', parts: '', reading: '' }];
  assert.equal(bondRows(c).length, 1); assert.equal(sectionDone(c, sec), true);
  c.bondingNA = true; assert.deepEqual(bondRows(c), []); assert.equal(sectionDone(c, sec), true);
});
