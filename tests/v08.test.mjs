// v0.8 tests: section G/J conditional boxes (electrode, RCD / OCPD main switch,
// per-service bonding sizes), green dots that respect hidden/optional fields,
// old jobs keep their values, PDF prints N/A with no overlaps. FAKE data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.jspdf ||= require('/workspace/sparky-work/npm/package/dist/jspdf.node.min.js');
const M = await import('../js/certmodel.js');
const { certificatePdf } = await import('../js/pdf.js');
const { EIC_ITEMS, EICR_ITEMS, EIC_HELP, EICR_HELP } = await import('../js/inspections.js');
const S = await import('./sample-data.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sparky-v08-'));
const parts = (t) => M.sectionsFor(t).find((s) => s.id === 'parts');
const fillParts = (c) => Object.assign(c.parts, { maxDemand: '60', msLocation: 'Hall cupboard', bondWater: true });

test('electrode boxes only show (and are only needed) with an installation earth electrode', () => {
  const c = M.newCert('EIC'); fillParts(c); const s = parts('EIC');
  const el = s.fields.find((x) => x.k === 'parts.elRa');
  assert.equal(M.visible(c, el), false); assert.equal(M.sectionDone(c, s), true);
  c.parts.means = 'Installation earth electrode';
  assert.equal(M.visible(c, el), true); assert.equal(M.sectionDone(c, s), false);
  assert.deepEqual(M.missingFields(c, s).map((x) => x.k), ['parts.elType', 'parts.elLocation', 'parts.elRa']);
  Object.assign(c.parts, { elType: 'Rod', elLocation: 'Front garden', elRa: '21' }); assert.equal(M.sectionDone(c, s), true);
});
test('bonding: a service, or "none", is needed; per-service csa falls back to the main csa', () => {
  const c = M.newCert('EIC'); fillParts(c); c.parts.bondWater = false; const s = parts('EIC');
  assert.equal(M.sectionDone(c, s), false);
  c.parts.bondNone = true; assert.equal(M.sectionDone(c, s), true);
  c.parts.bondNone = false; c.parts.bondGas = true; assert.equal(M.bondCsaFor(c, 'Gas'), '10');
  c.parts.bondGasCsa = '16'; assert.equal(M.bondCsaFor(c, 'Gas'), '16');
  c.parts.bondCsa = ''; c.parts.bondWater = true; assert.equal(M.sectionDone(c, s), false); // water has no size now
  c.parts.bondWaterCsa = '10'; assert.equal(M.sectionDone(c, s), false); // main csa itself still asked for
  c.parts.bondCsa = '10'; assert.equal(M.sectionDone(c, s), true);
});
test('RCD / OCPD ticks: old jobs with values count as ticked; boxes needed only when ticked', () => {
  const c = M.newCert('EIC'); fillParts(c); const s = parts('EIC');
  assert.equal(M.msIsRcd(c), false); assert.equal(M.msIsOcpd(c), false);
  const old = M.newCert('EIC'); Object.assign(old.parts, { rcdType: 'A', rcdIdn: '100', msType: 'Fuse' }); delete old.parts.msIsRcd;
  assert.equal(M.msIsRcd(old), true); assert.equal(M.msIsOcpd(old), true);
  c.parts.msIsRcd = true; assert.equal(M.sectionDone(c, s), false);
  Object.assign(c.parts, { rcdType: 'S type A', rcdIdn: '100', rcdDelay: '0', rcdMs: '160' }); assert.equal(M.sectionDone(c, s), true);
  old.parts.msIsRcd = false; assert.equal(M.msIsRcd(old), false); assert.equal(old.parts.rcdType, 'A'); // untick keeps the data
});
test('green dots: not just the first three boxes; optional ones never needed', () => {
  const c = M.newCert('EIC'); const sup = M.sectionsFor('EIC').find((s) => s.id === 'supply');
  assert.equal(M.sectionDone(c, sup), false); // Ipf, Ze, rating, kA blank
  Object.assign(c.supply, { ipf: '1.2', ze: '0.21', spRating: '100', spKa: '33' }); assert.equal(M.sectionDone(c, sup), true); // spType optional
  const des = M.sectionsFor('EIC').find((s) => s.id === 'design');
  c.eic.designDepartures = ''; c.eic.exceptions = ''; assert.equal(M.sectionDone(c, des), true);
  const ppl = M.sectionsFor('EIC').find((s) => s.id === 'people');
  Object.assign(c.people.designer, { name: 'Sam', for: 'Example', address: '1 Sample St' }); assert.equal(M.sectionDone(c, ppl), true);
  c.eic.samePerson = false; assert.equal(M.sectionDone(c, ppl), false);
  const r = M.newCert('EICR'); const inst = M.sectionsFor('EICR').find((s) => s.id === 'install');
  Object.assign(r.install, { address: '12 Imaginary Road' }); r.eicr.wiringAge = '20';
  assert.equal(M.sectionDone(r, inst), true);
  r.eicr.alterations = 'Yes'; assert.equal(M.sectionDone(r, inst), false); r.eicr.alterAge = '5'; assert.equal(M.sectionDone(r, inst), true);
  const ext = M.sectionsFor('EICR').find((s) => s.id === 'extent'); assert.equal(M.sectionDone(r, ext), false); r.eicr.extent = 'Whole house'; assert.equal(M.sectionDone(r, ext), true);
  const mw = M.newCert('MW'); const a = M.sectionsFor('MW')[0]; Object.assign(mw.client, { name: 'A' }); mw.install.address = 'x'; mw.mw.description = 'Added socket'; mw.mw.departures = ''; assert.equal(M.sectionDone(mw, a), true);
});
test('backup: a v0.7 certificate (no new fields) loads and prints', async () => {
  const c = S.sampleEIC(); for (const k of ['msIsRcd', 'msIsOcpd', 'bondNone', 'bondWaterCsa']) delete c.parts[k];
  const json = JSON.parse(JSON.stringify(c)); assert.ok(M.sectionsFor('EIC').every((s) => typeof M.sectionDone(json, s) !== 'undefined'));
  const b = await certificatePdf(json, { profile: S.PROFILE }); assert.ok(b.size > 1000);
});
test('PDF G/J: N/A for electrode, OCPD, RCD; each service with its own size; no overlaps', async () => {
  const files = [];
  for (const [name, mod] of [
    ['dist', (c) => Object.assign(c.parts, { bondWater: true, bondGas: true, bondGasCsa: '16', bondOther: 'Oil tank pipe', bondOtherCsa: '10' })],
    ['electrode-rcd', (c) => Object.assign(c.parts, { means: 'Installation earth electrode', elType: 'Rod', elLocation: 'Rear garden by back door', elRa: '21', msIsRcd: true, rcdType: 'S type A', rcdIdn: '100', rcdDelay: '0', rcdMs: '160', msIsOcpd: true, msType: 'MCCB', msRating: '100', msKa: '25', bondWater: true, bondGas: true, bondOil: true, bondSteel: true, bondLightning: true, bondWaterCsa: '10', bondGasCsa: '10', bondOilCsa: '16', bondSteelCsa: '25', bondLightningCsa: '16' })],
    ['none', (c) => Object.assign(c.parts, { bondNone: true, bondWater: false, bondGas: false })]]) {
    for (const t of ['EIC', 'EICR']) {
      const c = t === 'EIC' ? S.sampleEIC() : S.sampleEICR(); mod(c);
      const f = path.join(tmp, `${t}-${name}.pdf`); fs.writeFileSync(f, Buffer.from(await (await certificatePdf(c, { profile: S.PROFILE })).arrayBuffer())); files.push(f);
      const txt = spawnSync('pdftotext', ['-layout', f, '-']).stdout.toString();
      const g = txt.slice(txt.indexOf('PARTICULARS OF INSTALLATION'), txt.indexOf('PARTICULARS OF INSTALLATION') + 3000);
      if (name === 'dist') { assert.match(g, /Type \(rod\(s\), tape etc\)\s+N\/A/); assert.match(g, /gas installation pipes\s+16 mm²/); assert.match(g, /oil installation pipes\s+N\/A/); assert.match(g, /10 \/ 16/); assert.match(g, /Device type MCCB.*N\/A/); assert.match(g, /RCD Type.*N\/A/); }
      if (name === 'electrode-rcd') { assert.match(g, /structural steel\s+25 mm²/); assert.doesNotMatch(g.split('Main switch')[1].slice(0, 600), /N\/A/); }
      if (name === 'none') assert.match(g, /bonding\s+Material\s+N\/A/);
    }
  }
  const r = spawnSync('python3', [path.join(path.dirname(new URL(import.meta.url).pathname), 'pdf_overlap.py'), ...files]);
  assert.equal(r.status, 0, r.stdout.toString());
  console.log('pdfs in', tmp);
});
test('inspection help: every EIC item has a line; EICR items all covered', () => {
  for (const [n] of EIC_ITEMS) assert.ok(EIC_HELP[n] && EIC_HELP[n][0].length > 20, n);
  for (const [n, , head] of EICR_ITEMS) if (!head) assert.ok(EICR_HELP[n], n);
});
