// v0.15: Import extra details (merge, never overwrite) and the Test across circuits done-count fix.
import test from 'node:test';
import assert from 'node:assert/strict';
const I = await import('../js/importjob.js');
const L = await import('../js/testlist.js');

const circ = (id, num, desc, more = {}) => ({ id, num, desc, bs: '60898', type: 'B', rating: '32', live: '2.5', cpc: '1.5', r1r2: '', R2: '', zs: '', irV: '500', irLL: '', irLE: '', pol: '', rcdMs: '', rcdBtn: '', rcdIdn: '', ...more });
const localCert = () => ({ id: 'cert1', jobId: 'job1', type: 'EIC', number: 'EIC-9001', updatedAt: '2026-01-01T00:00:00Z', version: 3,
  supply: { earthing: 'TN-C-S', ze: '0.21', otherSources: true, ipf: '' }, otherSources: [],
  boards: [{ id: 'b1', ref: 'DB1', location: 'Hall', zdb: '0.25', circuits: [circ('c1', '1', 'Sockets', { zs: '0.55' }), circ('c2', '2', 'Lights')] }] });

test('readImportFile accepts job.json, backup, {cert} and a bare certificate; rejects others', () => {
  const c = localCert();
  assert.equal(I.readImportFile({ app: 'sparky', job: { title: 'X' }, certs: [c] }).certs.length, 1);
  assert.equal(I.readImportFile(JSON.stringify({ app: 'sparky', jobs: [], certs: [c, c] })).certs.length, 2);
  assert.equal(I.readImportFile({ cert: c }).certs.length, 1);
  assert.equal(I.readImportFile(c).certs.length, 1);
  assert.throws(() => I.readImportFile({ app: 'hearth', certs: [c] }));
  assert.throws(() => I.readImportFile({ app: 'sparky', certs: [] }));
});

test('merge fills empty boxes only, adds new boards/circuits/sources, keeps yours, deletes nothing', () => {
  const local = localCert(); const before = JSON.stringify(local);
  const inc = localCert();
  inc.supply.ze = '0.35'; inc.supply.ipf = '1.8';
  inc.boards[0].circuits[0].zs = '0.99'; inc.boards[0].circuits[1].zs = '0.70';
  inc.boards[0].circuits.splice(0, 1); // file lacks circuit 1: must stay
  inc.boards[0].circuits.push(circ('c3', '3', 'Cooker'));
  inc.boards.push({ id: 'b2', ref: 'DB2', location: 'Garage', circuits: [circ('c9', '1', 'Inverter', { rating: '50', live: '10' })] });
  inc.otherSources = [{ id: 's1', type: 'Battery storage', make: 'Inverter X', kw: '10' }];
  inc.number = 'CHANGED'; inc.type = 'EICR';
  const { merged, ops } = I.mergeCert(local, inc);
  assert.equal(JSON.stringify(local), before, 'original untouched');
  assert.equal(merged.supply.ze, '0.21'); assert.equal(merged.supply.ipf, '1.8');
  assert.equal(merged.number, 'EIC-9001'); assert.equal(merged.type, 'EIC');
  const db1 = merged.boards[0];
  assert.deepEqual(db1.circuits.map((c) => c.num), ['1', '2', '3']);
  assert.equal(db1.circuits[0].zs, '0.55'); assert.equal(db1.circuits[1].zs, '0.70');
  assert.equal(merged.boards[1].ref, 'DB2'); assert.equal(merged.boards[1].circuits[0].rating, '50');
  assert.equal(merged.otherSources[0].make, 'Inverter X');
  const c = I.counts(ops);
  assert.deepEqual(c, { add: 3, fill: 2, skip: 1 });
  const skip = ops.find((o) => o.action === 'skip'); assert.equal(skip.cur, '0.21'); assert.equal(skip.val, '0.35');
  assert.ok(ops.some((o) => o.action === 'add' && I.opLabel(o) === 'Board DB2'));
  assert.ok(ops.some((o) => o.action === 'add' && I.opLabel(o) === 'DB1 › Circuit 3 Cooker'));
});

test('matching by board ref and circuit number when ids differ; ticks never cleared', () => {
  const local = localCert(); local.boards[0].spdT2 = true;
  const inc = { number: 'EIC-9001', boards: [{ id: 'other', ref: 'db1', spdT2: false, circuits: [{ id: 'zz', num: '2', zs: '0.8' }] }] };
  const plan = I.planImport([local], I.readImportFile(inc));
  assert.equal(plan.items[0].how, 'number');
  const m = plan.items[0].merged;
  assert.equal(m.boards.length, 1); assert.equal(m.boards[0].circuits.length, 2);
  assert.equal(m.boards[0].circuits[1].zs, '0.8'); assert.equal(m.boards[0].circuits[1].id, 'c2');
  assert.equal(m.boards[0].spdT2, true);
});

test('unknown certificates are left out; forceCertId puts a single file cert into this one', () => {
  const local = localCert();
  const inc = { id: 'nope', number: 'EIC-0000', boards: [{ ref: 'DB1', zdb: '', ipf: '2.1', circuits: [] }] };
  assert.deepEqual(I.planImport([local], I.readImportFile(inc)).unmatched, ['EIC-0000']);
  const f = I.planImport([local], I.readImportFile(inc), { forceCertId: 'cert1' });
  assert.equal(f.items[0].how, 'this'); assert.equal(f.items[0].merged.boards[0].ipf, '2.1');
});

test('merging the same file twice adds nothing the second time; finish touches updatedAt', () => {
  const local = localCert(); const inc = localCert(); inc.boards.push({ id: 'b2', ref: 'DB2', circuits: [circ('c9', '1', 'X')] });
  const once = I.mergeCert(local, inc).merged; const twice = I.mergeCert(once, inc);
  assert.equal(twice.ops.filter((o) => o.action !== 'skip').length, 0);
  const done = I.finish(once, '2026-10-20T12:00:00Z');
  assert.equal(done.updatedAt, '2026-10-20T12:00:00Z'); assert.equal(done.version, 4); assert.equal(done.imports.at(-1).kind, 'extra');
});

test('Test across circuits: N/A in R2 with R1+R2 blank is NOT done', () => {
  const b = { circuits: [circ('a', '1', 'Sockets', { R2: 'N/A' }), circ('b', '2', 'Lights', { r1r2: '0.42', R2: 'N/A' }), circ('c', '3', 'Fan', { R2: '0.30', r1r2: 'N/A' }), circ('d', '4', 'X', { r1r2: 'n/a', R2: 'N/A' })] };
  assert.deepEqual(L.progress(b, 'r1r2'), { need: 4, done: 2 });
});

test('Test across circuits: IR and RCD need a real reading where one is due; deliberate N/A still counts', () => {
  const b = { circuits: [
    circ('a', '1', 'A', { irLL: 'N/A', irLE: 'N/A' }), circ('b', '2', 'B', { irLL: 'N/A', irLE: '>999' }), circ('c', '3', 'C', { irLL: '200', irLE: '>999' })] };
  assert.deepEqual(L.progress(b, 'ir'), { need: 3, done: 2 });
  const r = { circuits: [
    circ('a', '1', 'RCBO', { device: 'rcbo', rcdIdn: '30', rcdMs: 'N/A', rcdBtn: '✓' }),
    circ('b', '2', 'RCBO', { device: 'rcbo', rcdIdn: '30', rcdMs: '22', rcdBtn: '✓' }),
    circ('c', '3', 'MCB only', { rcdMs: 'N/A', rcdBtn: 'N/A' })] };
  assert.deepEqual(L.progress(r, 'rcd'), { need: 3, done: 2 });
  const sp = { circuits: [circ('s', '5', 'SPARE', { irV: '' })] };
  assert.deepEqual(L.progress(sp, 'r1r2'), { need: 0, done: 0 });
});
