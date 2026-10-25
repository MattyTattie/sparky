import test from 'node:test'; import assert from 'node:assert';
import { findRoot, sweepStrays } from '../js/driveroot.js';
const OPT = { name: 'Zs Pro', legacy: 'Sparky jobs' };
function mockG(files) {
  const F = Object.fromEntries(files.map((f) => [f.id, { trashed: false, parents: [], mimeType: 'application/vnd.google-apps.folder', ...f }]));
  let n = 0; const calls = [];
  return { F, calls,
    async list(q) { let m = q.match(/^name = '(.*)' and mimeType/); if (m) return Object.values(F).filter((f) => !f.trashed && f.name === m[1] && f.mimeType.includes('folder'));
      m = q.match(/^'(.*)' in parents/); return Object.values(F).filter((f) => !f.trashed && f.parents.includes(m[1])); },
    async createFolder(name) { const id = 'new' + (++n); F[id] = { id, name, trashed: false, parents: [], mimeType: 'application/vnd.google-apps.folder' }; calls.push('create'); return F[id]; },
    async rename(id, name) { F[id].name = name; calls.push('rename ' + id); return F[id]; },
    async move(id, to, from) { F[id].parents = F[id].parents.filter((p) => p !== from).concat(to); calls.push('move ' + id); },
    async trash(id) { F[id].trashed = true; calls.push('trash ' + id); } };
}
const job = (id, p) => ({ id, name: 'job ' + id, parents: [p] });
test('old folder is renamed, same id, nothing created', async () => {
  const G = mockG([{ id: 'old', name: 'Sparky jobs' }, job('j1', 'old')]);
  assert.equal(await findRoot(G, OPT), 'old'); assert.equal(G.F.old.name, 'Zs Pro'); assert.ok(!G.calls.includes('create'));
});
test('new folder used as-is', async () => {
  const G = mockG([{ id: 'z', name: 'Zs Pro' }]); assert.equal(await findRoot(G, OPT), 'z'); assert.deepEqual(G.calls, []);
});
test('nothing found -> create Zs Pro', async () => {
  const G = mockG([]); const id = await findRoot(G, OPT); assert.equal(G.F[id].name, 'Zs Pro');
});
test('stray Sparky jobs from old device is merged into Zs Pro and binned', async () => {
  const G = mockG([{ id: 'z', name: 'Zs Pro' }, job('j1', 'z'), { id: 'old2', name: 'Sparky jobs' }, job('j2', 'old2')]);
  assert.equal(await findRoot(G, OPT), 'z'); assert.deepEqual(G.F.j2.parents, ['z']); assert.equal(G.F.old2.trashed, true); assert.equal(G.F.j1.parents[0], 'z');
});
test('two Zs Pro folders: fuller one wins, other emptied in', async () => {
  const G = mockG([{ id: 'a', name: 'Zs Pro', createdTime: '2026-01-01' }, { id: 'b', name: 'Zs Pro', createdTime: '2025-01-01' }, job('j1', 'a'), job('j2', 'a'), job('j3', 'b')]);
  assert.equal(await findRoot(G, OPT), 'a'); assert.deepEqual(G.F.j3.parents, ['a']); assert.equal(G.F.b.trashed, true);
});
test('several old folders: fullest renamed, rest merged', async () => {
  const G = mockG([{ id: 'e', name: 'Sparky jobs' }, { id: 'f', name: 'Sparky jobs' }, job('j1', 'f')]);
  assert.equal(await findRoot(G, OPT), 'f'); assert.equal(G.F.f.name, 'Zs Pro'); assert.equal(G.F.e.trashed, true);
});
test('sweepStrays with cached id moves stray contents, never deletes jobs', async () => {
  const G = mockG([{ id: 'z', name: 'Zs Pro' }, { id: 's', name: 'Sparky jobs' }, job('j9', 's')]);
  assert.equal(await sweepStrays(G, 'z', OPT), 1); assert.deepEqual(G.F.j9.parents, ['z']); assert.equal(G.F.j9.trashed, false);
  assert.equal(await sweepStrays(G, 'z', OPT), 0);
});
