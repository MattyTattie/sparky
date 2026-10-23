// Importing earlier results: merge by circuit, never lose anything. Made-up data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planImport, applyImport, compareDesc, checkResultsFile } from '../js/importres.js';
import { blankCircuit } from '../js/templates.js';
import { newCert } from '../js/certmodel.js';

const C = (num, o = {}) => Object.assign(blankCircuit(num), o);
const file = (circuits, extra = {}) => ({ app: 'sparky', kind: 'results', format: 1, source: 'test', cert: { supply: { earthing: 'TN-C-S (PME)', ze: '0.21' }, parts: { bondWater: true, bondGas: false, ecCsa: '16' } }, board: { spdT2: true, circuits }, ...extra });
const certWith = (circuits) => { const c = newCert('EIC'); c.boards[0].circuits = circuits; c.photoIds = ['p1', 'p2']; return c; };

test('descriptions: shorthand and partial scan labels match, different ones don\u2019t', () => {
  assert.equal(compareDesc('Downstairs skts', 'Downstairs sockets'), 'same');
  assert.equal(compareDesc('Bedroom', 'Bedroom 2 radiator'), 'part');
  assert.equal(compareDesc('', 'Hob'), 'blank');
  assert.equal(compareDesc('Spare', 'SPARE'), 'same');
  assert.equal(compareDesc('Hob', 'Oven'), 'different');
});
test('file checks', () => {
  assert.throws(() => checkResultsFile({ app: 'sparky', format: 1, jobs: [] }), /results file/);
  assert.throws(() => checkResultsFile({ app: 'other', kind: 'results' }), /Zs Pro|Sparky/);
  assert.throws(() => checkResultsFile({ app: 'sparky', kind: 'results', format: 9, board: { circuits: [] } }), /newer/);
});
test('merge: fills blanks, keeps yours, adds missing, removes nothing, photos untouched', () => {
  const cert = certWith([
    C(1, { desc: 'Oven', type: 'B', rating: '16', zs: '0.55' }),          // scanned + a reading already taken
    C(2, { desc: '', type: 'B', rating: '16' }),                         // scanned, no label
    C(3, { desc: 'Hob', type: 'B', rating: '32', live: '10' }),          // you put 10 mm²; file says 6
    C(9, { desc: 'Garage', type: 'C', rating: '20' }),                   // not in the file
  ]);
  const ids = cert.boards[0].circuits.map((c) => c.id);
  const data = file([
    { num: '1', desc: 'Oven', type: 'B', rating: '16', live: '2.5', cpc: '1.5', zs: '0.70', irLL: '>999' },
    { num: '2', desc: 'Combi oven', type: 'B', rating: '16', live: '2.5', cpc: '1.5' },
    { num: '3', desc: 'Hob', type: 'B', rating: '32', live: '6', cpc: '2.5' },
    { num: '4', desc: 'Spare', type: 'B', rating: '20', device: 'rcbo' },
  ]);
  const plan = planImport(cert, data);
  assert.equal(plan.summary.matched, 3); assert.equal(plan.summary.added, 1);
  assert.deepEqual(plan.untouched.map((u) => u.num), ['9']);
  const zs = plan.circuits[0].changes.find((c) => c.k === 'zs'); assert.equal(zs.action, 'differs');
  const r = applyImport(cert, plan, { makeCircuit: (n) => blankCircuit(n) });
  const cs = cert.boards[0].circuits; const by = (n) => cs.find((c) => c.num === n);
  assert.equal(cs.length, 5, 'nothing removed, one added');
  for (const id of ids) assert.ok(cs.some((c) => c.id === id), 'every original circuit is still there');
  assert.equal(by('1').zs, '0.55', 'your reading kept'); assert.equal(by('1').live, '2.5'); assert.equal(by('1').irLL, '>999');
  assert.equal(by('2').desc, 'Combi oven', 'blank description filled');
  assert.equal(by('3').live, '10', 'your value kept'); assert.equal(by('3').cpc, '2.5', 'blank filled');
  assert.equal(by('4').desc, 'Spare'); assert.equal(by('9').desc, 'Garage');
  assert.deepEqual(cs.map((c) => c.num), ['1', '2', '3', '4', '9'], 'kept in number order');
  assert.deepEqual(cert.photoIds, ['p1', 'p2']);
  assert.equal(cert.supply.ze, '0.21', 'blank Ze filled'); assert.equal(cert.parts.bondWater, true); assert.equal(cert.parts.bondGas, false);
  assert.equal(cert.boards[0].spdT2, true); assert.ok(r.filled > 5); assert.equal(r.replaced, 0);
});
test('merge: ticked differences take the file value', () => {
  const cert = certWith([C(1, { desc: 'Oven', rating: '16', type: 'B', zs: '0.55' })]);
  const plan = planImport(cert, file([{ num: '1', desc: 'Oven', type: 'B', rating: '16', zs: '0.70' }]));
  applyImport(cert, plan, { takeFile: new Set(['c:1:zs']), makeCircuit: blankCircuit });
  assert.equal(cert.boards[0].circuits[0].zs, '0.70');
});
test('number taken by a different circuit is not merged into it (description or rating disagree)', () => {
  const cert = certWith([C(1, { desc: 'Hob', type: 'B', rating: '32' }), C(2, { desc: '', type: 'B', rating: '100' })]);
  const plan = planImport(cert, file([{ num: '1', desc: 'Oven', type: 'B', rating: '16' }, { num: '2', desc: 'Lights', type: 'B', rating: '6' }]));
  assert.deepEqual(plan.circuits.map((c) => c.how), ['clash', 'clash']);
  applyImport(cert, plan, { makeCircuit: blankCircuit });
  assert.equal(cert.boards[0].circuits.length, 2, 'skipped by default'); assert.equal(cert.boards[0].circuits[0].desc, 'Hob');
  const plan2 = planImport(cert, file([{ num: '1', desc: 'Oven', type: 'B', rating: '16' }]));
  applyImport(cert, plan2, { clash: 'add', makeCircuit: blankCircuit });
  assert.equal(cert.boards[0].circuits.length, 3); assert.match(cert.boards[0].circuits.find((c) => c.desc === 'Oven').remarks, /already used/);
});
test('matched by description when numbering differs', () => {
  const cert = certWith([C(5, { desc: 'Downstairs skts', type: 'B', rating: '32' })]);
  const plan = planImport(cert, file([{ num: '6', desc: 'Downstairs sockets', type: 'B', rating: '32', live: '2.5' }]));
  assert.equal(plan.circuits[0].how, 'description');
  applyImport(cert, plan, { makeCircuit: blankCircuit });
  assert.equal(cert.boards[0].circuits.length, 1); assert.equal(cert.boards[0].circuits[0].live, '2.5'); assert.equal(cert.boards[0].circuits[0].num, '5', 'your numbering kept');
});
test('importing the same file twice changes nothing the second time', () => {
  const cert = certWith([C(1, { desc: 'Oven', type: 'B', rating: '16' })]);
  const data = file([{ num: '1', desc: 'Oven', type: 'B', rating: '16', live: '2.5' }, { num: '2', desc: 'Hob', type: 'B', rating: '32' }]);
  applyImport(cert, planImport(cert, data), { makeCircuit: blankCircuit });
  const snap = JSON.stringify(cert.boards); const p2 = planImport(cert, data);
  assert.equal(p2.summary.fills, 0); assert.equal(p2.summary.added, 0);
  applyImport(cert, p2, { makeCircuit: blankCircuit }); assert.equal(JSON.stringify(cert.boards), snap);
});
