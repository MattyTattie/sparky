// v0.10 tests: spare circuits (auto N/A placeholders, No device fitted, green dot, PDF grey),
// G/J headings, generic device wording. FAKE data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.jspdf ||= require('/workspace/sparky-work/npm/package/dist/jspdf.node.min.js');
const T = await import('../js/templates.js');
const M = await import('../js/certmodel.js');
const P = await import('../js/pdf.js');
const SM = await import('../js/syncmerge.js');
const S = await import('./sample-data.mjs');
const spare = (o = {}) => { const c = T.blankCircuit(3); c.desc = 'spare'; return Object.assign(c, o); };
test('typing spare (any case) makes empty boxes auto N/A, device boxes stay blank', () => {
  for (const d of ['spare', 'SPARE', ' Spare ']) { const c = T.blankCircuit(1); c.desc = d; assert.ok(T.isSpareCircuit(c), d); }
  assert.equal(T.isSpareCircuit({ desc: 'Spare room sockets' }), false);
  const c = spare();
  for (const k of ['wiring', 'ref', 'points', 'live', 'cpc', 'r1r2', 'irLE', 'zs', 'pol', 'remarks']) assert.equal(T.autoNA(c, k), true, k);
  for (const k of ['bs', 'type', 'rating', 'bka', 'maxZs', 'rcdBs', 'rcdType', 'rcdIdn', 'rcdRating']) assert.equal(T.autoNA(c, k), false, k);
  assert.equal(T.autoNA(c, 'num'), false); assert.equal(T.autoNA(c, 'desc'), false);
  c.noDevice = true; for (const k of ['bs', 'type', 'rating', 'bka', 'maxZs', 'rcdIdn']) assert.equal(T.autoNA(c, k), true, k);
});
test('typed values are never overwritten and win over N/A; removing spare gives empties back', () => {
  const c = T.blankCircuit(2); c.live = '2.5'; const was = T.isSpareCircuit(c); c.desc = 'SPARE'; T.descChanged(c, was);
  assert.equal(c.live, '2.5'); assert.equal(T.autoNA(c, 'live'), false); assert.equal(c.irV, ''); assert.equal(T.autoNA(c, 'irV'), true);
  c.bs = '61009'; c.type = 'B'; c.rating = '32'; c.noDevice = false; assert.equal(T.autoNA(c, 'bs'), false);
  c.desc = 'Garage'; T.descChanged(c, true); assert.equal(c.irV, '500'); assert.equal(T.autoNA(c, 'zs'), false); assert.equal(c.zs, '');
  const m = T.makeSpare({ ...T.blankCircuit(4), live: '6' }); assert.equal(m.desc, 'SPARE'); assert.equal(m.live, '6'); assert.equal(m.zs, '');
});
test('spare counts as done for the green dot', () => {
  const cert = S.sampleEIC(); const s = M.sectionsFor('EIC').find((x) => x.special === 'boards');
  cert.boards[0].circuits.push(spare());
  assert.equal(M.sectionDone(cert, s), cert.boards.every((b) => b.circuits.every((c) => T.isSpareCircuit(c) || c.zs)));
  assert.ok(cert.boards[0].circuits.filter((c) => !T.isSpareCircuit(c)).every((c) => c.zs) ? M.sectionDone(cert, s) : true);
});
test('PDF rows: auto N/A marked auto (light grey), typed values plain', () => {
  const cert = S.sampleEIC(); const b = cert.boards[0];
  b.circuits.push(spare({ bs: '61009', type: 'B', rating: '32', rcdIdn: '30' }), spare({ noDevice: true }));
  const rows = P.scheduleRows(cert, b); const a = rows[rows.length - 2], n = rows[rows.length - 1];
  assert.deepEqual(a.zs, { v: 'N/A', auto: true }); assert.equal(a.bs, '61009'); assert.equal(a.rating, '32'); assert.equal(a.bka, ''); assert.equal(a.maxZs, '');
  assert.deepEqual(n.bs, { v: 'N/A', auto: true }); assert.deepEqual(n.maxZs, { v: 'N/A', auto: true });
  const old = { ...T.blankCircuit(9), spare: true, desc: 'SPARE', zs: 'N/A', live: 'N/A' }; b.circuits.push(old); // v0.9 spare (typed N/A)
  const o = P.scheduleRows(cert, b).pop(); assert.equal(o.zs, 'N/A'); assert.deepEqual(o.r1r2, { v: 'N/A', auto: true });
});
test('G/J: IET headings and order', () => {
  const s = M.sectionsFor('EIC').find((x) => x.id === 'parts');
  const hs = s.fields.filter((f) => f.type === 'heading').map((f) => f.label);
  assert.deepEqual(hs, ['Earthing conductor', 'Main protective bonding conductors', 'Bonding of extraneous-conductive-parts']);
  const ks = s.fields.map((f) => f.k);
  assert.ok(ks.indexOf('parts.bondNone') > ks.indexOf('parts._hBond') && ks.indexOf('parts.bondNone') < ks.indexOf('parts.bondMat'));
  assert.ok(ks.indexOf('parts.bondWater') > ks.indexOf('parts._hExt'));
  assert.ok(!s.fields.some((f) => /main earthing/i.test(f.label)));
  const c = S.sampleEIC(); assert.ok(!M.neededFields(c, s).some((f) => f.type === 'heading'));
});
test('conflict copy titles are generic', () => {
  const cp = SM.conflictCopy({ job: { id: 'j', title: 'Job' } }, { newId: () => 'x' + Math.random() });
  assert.match(cp.job.title, /conflict copy from another device/);
});
