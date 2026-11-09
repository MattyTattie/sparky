// v0.46.0: Check certificate before the PDF, Ring/Radial/Lights quick fill, one RCD trip time for a shared RCD. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sampleEIC, sampleEICR, sampleMW } from './sample-data.mjs';
const { checkCert } = await import('../js/certcheck.js');
const { planQuick, applyQuick, undoQuick } = await import('../js/quickfill.js');
const { rcdGroups, commonTime, planRcdTime, applyRcdTime, undoRcdTime } = await import('../js/rcdreuse.js');
const { isRingCircuit, autoNA } = await import('../js/templates.js');
const src = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const texts = (r) => r.groups.flatMap((g) => g.items.map((i) => i.text));
const allItems = (r) => r.groups.flatMap((g) => g.items);

// ---- 1. Check certificate
test('every problem has a tap-to-go link into this certificate', () => {
  for (const c of [sampleEIC(), sampleEICR(), sampleMW()]) {
    const r = checkCert(c); assert.ok(r.count > 0);
    for (const it of allItems(r)) assert.ok(it.href.startsWith('#/cert/' + c.id + '/'), it.href);
    assert.equal(r.count, allItems(r).length);
  }
});
test('a blank required field shows up under Still to fill in', () => {
  const c = sampleEIC(); const before = checkCert(c).count;
  c.supply.earthing = ''; const r = checkCert(c);
  assert.ok(r.count > before); assert.ok(r.groups.find((g) => g.id === 'missing').items.some((i) => /\/s\/supply$/.test(i.href)));
});
test('Zs over the max is a must-fix with a link to that circuit', () => {
  const c = sampleEIC(); const ci = c.boards[0].circuits.findIndex((x) => x.zs && !x.spare);
  c.boards[0].circuits[ci].zs = '9.99';
  const fix = checkCert(c).groups.find((g) => g.id === 'fix');
  assert.ok(fix && fix.items.some((i) => i.href.endsWith(`/b/0/c/${ci}`) && /Zs/i.test(i.text)), JSON.stringify(fix));
});
test('EICR: Satisfactory with a C2 must be fixed; FI is only worth checking', () => {
  const c = sampleEICR(); c.eicr.overall = 'SATISFACTORY';
  c.observations = [{ id: 'o1', item: '1', text: 'Damaged socket', code: 'C2', reg: '', location: 'Kitchen' }];
  let r = checkCert(c); assert.ok(r.fix >= 1); assert.ok(texts(r).some((t) => /Unsatisfactory/.test(t)));
  c.observations = [{ id: 'o1', item: '1', text: 'Not traced', code: 'FI', reg: '', location: '' }];
  r = checkCert(c); assert.ok(!(r.groups.find((g) => g.id === 'fix') || { items: [] }).items.some((i) => /Unsatisfactory/.test(i.text)));
  assert.ok(r.groups.find((g) => g.id === 'check').items.some((i) => /FI/.test(i.text)));
});
test('checkCert never changes the certificate', () => {
  const c = sampleEICR(); const s = JSON.stringify(c); checkCert(c); assert.equal(JSON.stringify(c), s);
});
test('the PDF goes through the check first and can still be made anyway; Check certificate button exists', () => {
  const s = src('js/certui.js');
  assert.match(s, /async function makePdf[\s\S]{0,80}certCheckDialog\(cert, \{ pdf: true \}\)/);
  assert.match(s, /'Make PDF anyway'/); assert.match(s, /'Check certificate'/);
});

// ---- 2. Quick fill
const radial = () => ({ num: '3', desc: 'Kitchen sockets', device: 'rcbo', type: 'B', rating: '20', rcdIdn: '30', rcdType: 'A' });
test('Radial fills blanks, unticks ring so r1/rn/r2 show N/A, and undo puts it all back', () => {
  const c = radial(); const before = JSON.stringify(c);
  const plan = planQuick(c, 'radial'); assert.equal(plan.clash.length, 0);
  const u = applyQuick(c, plan);
  assert.equal(c.irV, '500'); assert.equal(c.irLL, '>999'); assert.equal(c.irLE, '>999'); assert.equal(c.pol, '\u2713'); assert.equal(c.rcdBtn, '\u2713');
  assert.equal(c.ring, false); assert.equal(isRingCircuit(c), false); assert.ok(autoNA(c, 'r1'));
  undoQuick(c, u); assert.equal(JSON.stringify(c), before);
});
test('Ring ticks the ring box; Lights is a radial', () => {
  const c = radial(); applyQuick(c, planQuick(c, 'ring')); assert.equal(c.ring, true); assert.equal(isRingCircuit(c), true);
  const l = { num: '1', desc: 'Lights', device: 'mcb', rating: '6' }; applyQuick(l, planQuick(l, 'lights'));
  assert.equal(l.ring, false); assert.equal(l.rcdBtn, 'N/A'); assert.equal(l.rcdMs, 'N/A');
});
test('typed values are never overwritten unless asked', () => {
  const c = { ...radial(), irLE: '200', pol: '\u2713', r1: '0.4' };
  const plan = planQuick(c, 'radial');
  assert.deepEqual(plan.clash.map((x) => x.k), ['irLE']); assert.equal(plan.ringClash, true);
  applyQuick(c, plan); assert.equal(c.irLE, '200'); assert.equal(c.r1, '0.4'); assert.ok(!('ring' in c)); assert.equal(c.irLL, '>999');
  const d = { ...radial(), irLE: '200', r1: '0.4' }; const u = applyQuick(d, planQuick(d, 'radial'), { replace: true });
  assert.equal(d.irLE, '>999'); assert.equal(d.ring, false); undoQuick(d, u); assert.equal(d.irLE, '200'); assert.ok(!('ring' in d));
});
test('the quick fill row is on the circuit Test results', () => {
  assert.match(src('js/schedule.js'), /sect\('Test results', quickFillRow\(c\)/);
});

// ---- 3. Same RCD trip time
const board = () => ({ ref: 'DB1', circuits: [
  { num: '1', desc: 'Lights', device: 'mcb', rating: '6', rcdBs: '61008', rcdType: 'A', rcdIdn: '30', rcdRating: '63' },
  { num: '2', desc: 'Sockets', device: 'mcb', rating: '32', rcdBs: '61008', rcdType: 'A', rcdIdn: '30', rcdRating: '63', rcdMs: '22' },
  { num: '3', desc: 'Cooker', device: 'mcb', rating: '32', rcdBs: '61008', rcdType: 'A', rcdIdn: '30', rcdRating: '63' },
  { num: '4', desc: 'Shower', device: 'rcbo', rating: '40', rcdBs: '61009', rcdType: 'A', rcdIdn: '30', rcdMs: '18' },
] });
test('a shared RCD groups its circuits; RCBOs are left out', () => {
  const g = rcdGroups(board()); assert.equal(g.length, 1); assert.deepEqual(g[0].circuits.map((c) => c.num), ['1', '2', '3']);
});
test('one time fills the blanks, asks before replacing, and can be undone', () => {
  const b = board(); const [g] = rcdGroups(b); assert.equal(commonTime(g.circuits), '');
  const plan = planRcdTime(g.circuits, '24'); assert.deepEqual(plan.clash.map((x) => x.c.num), ['2']);
  const u = applyRcdTime(plan); assert.deepEqual(b.circuits.map((c) => c.rcdMs), ['24', '22', '24', '18']);
  undoRcdTime(u); assert.ok(!('rcdMs' in b.circuits[0])); assert.equal(b.circuits[1].rcdMs, '22');
  applyRcdTime(planRcdTime(g.circuits, '24'), { replace: true }); assert.deepEqual(b.circuits.map((c) => c.rcdMs), ['24', '24', '24', '18']);
});
test('an unticked circuit is left alone', () => {
  const b = board(); const [g] = rcdGroups(b); applyRcdTime(planRcdTime(g.circuits.filter((c) => c.num !== '3'), '25'));
  assert.ok(!('rcdMs' in b.circuits[2])); assert.equal(b.circuits[0].rcdMs, '25');
});
test('the RCD step of Test across circuits shows it', () => {
  assert.match(src('js/testacross.js'), /step\.id === 'rcd' \? rcdReuse\(b/);
});
test('version and cache are 0.46.0, new files cached', () => {
  assert.match(src('js/config.js'), /APP_VERSION = '0\.4[6-9]\.\d beta'/);
  const sw = src('sw.js'); assert.match(sw, /const CACHE = 'sparky-v0\.4[6-9]\.\d'/);
  for (const f of ['certcheck', 'quickfill', 'rcdreuse']) assert.ok(sw.includes(`./js/${f}.js`), f);
});
