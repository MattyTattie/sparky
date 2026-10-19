// v0.9 tests: sync decisions + conflict copies, maximum demand (OSG diversity),
// 3-phase in Check it (sizeCable with 400 V), backup format still readable. FAKE data only.
import test from 'node:test';
import assert from 'node:assert/strict';
const M = await import('../js/syncmerge.js');
const MD = await import('../js/maxdemand.js');
const C = await import('../js/calc.js');
const D = await import('../js/design.js');

const job = (o = {}) => ({ id: 'j1', title: 'Job', updatedAt: '2026-10-19T10:00:00Z', version: 3, backedUpVersion: 3, syncSavedAt: '2026-10-19T10:00:05Z', ...o });
const remote = (o = {}, savedAt = '2026-10-19T11:00:05Z') => ({ savedAt, job: job({ updatedAt: '2026-10-19T11:00:00Z', ...o }) });
test('planJob: new, unchanged, only one side changed, both changed', () => {
  assert.equal(M.planJob(null, remote()), 'pull');
  assert.equal(M.planJob(job(), { savedAt: '2026-10-19T10:00:05Z', job: job() }), 'keep');
  assert.equal(M.planJob(job(), remote()), 'pull');
  assert.equal(M.planJob(job({ version: 4, updatedAt: '2026-10-19T10:30:00Z' }), { savedAt: '2026-10-19T10:00:05Z', job: job() }), 'keep'); // only here: push later
  assert.equal(M.planJob(job({ version: 4, updatedAt: '2026-10-19T10:30:00Z' }), remote()), 'conflict-remote');
  assert.equal(M.planJob(job({ version: 4, updatedAt: '2026-10-19T12:00:00Z' }), remote()), 'conflict-local');
});
test('planJob: deleted here stays deleted unless changed in Drive after', () => {
  assert.equal(M.planJob(null, remote(), { deletedAt: '2026-10-19T12:00:00Z' }), 'skip');
  assert.equal(M.planJob(null, remote(), { deletedAt: '2026-10-19T10:30:00Z' }), 'pull');
});
test('planJob: jobs backed up before v0.9 (no syncSavedAt)', () => {
  const old = job({ syncSavedAt: undefined });
  assert.equal(M.planJob(old, { savedAt: '2026-10-19T10:00:05Z', job: job() }), 'keep'); // same updatedAt
  assert.equal(M.planJob(old, remote()), 'pull');
});
test('needsPush and conflictCopy keep everything under new ids', () => {
  assert.equal(M.needsPush(job()), false); assert.equal(M.needsPush(job({ version: 4 })), true);
  let n = 0; const newId = () => 'n' + ++n;
  const src = { job: job({ driveFolderId: 'F', driveJsonId: 'J' }), certs: [{ id: 'c1', jobId: 'j1', photoIds: ['f1'] }], files: [{ id: 'f1', jobId: 'j1', certId: 'c1', driveId: 'D', blob: 'x' }] };
  const cp = M.conflictCopy(src, { newId, label: 'phone', when: new Date('2026-10-19T17:40:00Z') });
  assert.notEqual(cp.job.id, 'j1'); assert.match(cp.job.title, /^Job \(conflict copy from phone, 19 Oct, /); assert.equal(cp.job.conflictOf, 'j1');
  assert.equal(cp.job.driveFolderId, null); assert.equal(cp.job.driveJsonId, null); assert.ok(M.needsPush(cp.job));
  assert.equal(cp.certs[0].jobId, cp.job.id); assert.notEqual(cp.certs[0].id, 'c1');
  assert.equal(cp.files[0].jobId, cp.job.id); assert.equal(cp.files[0].certId, cp.certs[0].id); assert.equal(cp.files[0].driveId, null); assert.equal(cp.files[0].blob, 'x');
  assert.deepEqual(cp.certs[0].photoIds, [cp.files[0].id]);
  assert.equal(src.job.id, 'j1'); // original untouched
  assert.equal(M.deviceLabel('Mozilla/5.0 (Linux; Android 14; Pixel 7)'), 'phone'); assert.equal(M.deviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6)'), 'Mac');
});
test('max demand: Matthew\u2019s example house is about 124 A by the book', () => {
  const r = MD.maxDemand(MD.EXAMPLE);
  assert.ok(Math.abs(r.total - 124) < 1.5, String(r.total));
  const g = Object.fromEntries(r.groups.map((x) => [x.g, x.demand]));
  assert.equal(g.cooking, 20); assert.equal(g.water, 26.1); assert.equal(g.heating, 31.1); assert.equal(g.sockets, 44.8); assert.equal(g.lighting, 2.3);
});
test('max demand: showers, cooker socket, EV, small loads under 10 A', () => {
  const r = MD.maxDemand([{ k: 'shower', qty: 3, value: 9.2 }, { k: 'cookerSocket', qty: 1 }, { k: 'ev', qty: 1, value: 7.4 }, { k: 'heater', qty: 1, value: 1.5 }]);
  const g = Object.fromEntries(r.groups.map((x) => [x.g, x.demand]));
  assert.equal(g.shower, Math.round((40 + 40 + 10) * 10) / 10); assert.equal(g.cookerSocket, 5); assert.equal(g.ev, 32.2); assert.equal(g.heating, 6.5);
  assert.equal(MD.maxDemand([]).total, 0);
});
test('Check it 3-phase: volt drop is a % of 400 V and matches the sizer', () => {
  const s3 = C.sizeCable({ cable: 'swa4', method: 'C', ib: 24, inA: 32, length: 35, uo: 400 });
  const r4 = s3.rows.find((r) => r.size === 4);
  assert.equal(r4.vd.volts, Math.round(9.5 * 24 * 35 / 10) / 100); assert.equal(r4.vd.pct, Math.round((9.5 * 24 * 35 / 1000 / 400) * 10000) / 100);
  assert.match(s3.assumptions[0], /three-phase 400 V/);
  const sz = D.sizeCircuit({ phase: 3, load: 24, unit: 'A', length: 35, cable: 'swa4', method: 'C', device: 'mcb', type: 'C', ze: 0.35 });
  if (sz.ok && sz.pick) assert.equal(sz.pick.size, s3.pick.size);
  const s1 = C.sizeCable({ cable: 'te', method: 'C', ib: 20, inA: 32, length: 25 }); assert.match(s1.assumptions[0], /single-phase 230 V/); // unchanged
});
