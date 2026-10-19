// v0.11 tests: device presets (remember, name, apply only device boxes, merge for sync/backup,
// deleted stay deleted) and apply-to-several (overwrite vs only-empty, spare no-device skipped). FAKE data only.
import test from 'node:test';
import assert from 'node:assert/strict';
const P = await import('../js/presets.js');
const T = await import('../js/templates.js');
const rcbo = (o = {}) => Object.assign(T.blankCircuit(1), { desc: 'Sockets', device: 'rcbo', bs: '61009', type: 'B', rating: '32', bka: '6', rcdBs: '61009', rcdType: 'A', rcdIdn: '30', rcdRating: '32', live: '2.5', cpc: '1.5', zs: '0.41', r1r2: '0.21' }, o);
test('presetFrom / nameFor / remember', () => {
  assert.equal(P.presetFrom(T.blankCircuit(1)), null);
  assert.equal(P.presetFrom({ ...rcbo(), rating: 'N/A' }), null);
  const f = P.presetFrom(rcbo()); assert.equal(f.live, undefined); assert.equal(f.zs, undefined);
  assert.equal(P.nameFor(f), 'B32 RCBO · 30 mA Type A · 6 kA');
  const l = []; let r = P.remember(l, rcbo()); assert.ok(r.added); r = P.remember(l, rcbo({ desc: 'other', live: '4' })); assert.equal(r.added, false); assert.equal(l.length, 1);
  P.remember(l, rcbo({ device: 'mcb', bs: '60898', rcdBs: '', rcdType: '', rcdIdn: '', rcdRating: '', rating: '6' })); assert.equal(l.length, 2);
  l[0].deleted = true; assert.equal(P.remember(l, rcbo()).added, false); assert.equal(P.shown(l).length, 1);
});
test('applyPreset fills only device boxes, never cable or readings', () => {
  const l = []; P.remember(l, rcbo()); const c = Object.assign(T.blankCircuit(2), { live: '1.5', cpc: '1.0', zs: '0.9', r1r2: '0.5' });
  const ch = P.applyPreset(c, l[0]);
  assert.ok(ch.includes('rating')); assert.equal(c.rating, '32'); assert.equal(c.rcdIdn, '30');
  assert.equal(c.live, '1.5'); assert.equal(c.cpc, '1.0'); assert.equal(c.zs, '0.9'); assert.equal(c.r1r2, '0.5');
  assert.deepEqual(P.applyPreset(c, l[0]), []);
});
test('shown: most used first; merge keeps newest edit and highest uses', () => {
  const a = [{ id: 'a', name: 'X', fields: P.presetFrom(rcbo()), uses: 2, updatedAt: '2026-10-19T10:00:00Z' }, { id: 'b', name: 'Y', fields: P.presetFrom(rcbo({ rating: '6' })), uses: 9, updatedAt: '2026-10-19T10:00:00Z' }];
  assert.deepEqual(P.shown(a).map((p) => p.id), ['b', 'a']);
  const other = [{ id: 'z', name: 'Renamed', fields: P.presetFrom(rcbo()), uses: 5, updatedAt: '2026-10-19T11:00:00Z' }, { id: 'q', name: 'Gone', fields: P.presetFrom(rcbo({ rating: '6' })), deleted: true, uses: 1, updatedAt: '2026-10-19T12:00:00Z' }];
  const m = P.mergePresets(a, other);
  assert.equal(m.length, 2); const x = m.find((p) => p.id === 'a'); assert.equal(x.name, 'Renamed'); assert.equal(x.uses, 5);
  assert.equal(m.find((p) => p.id === 'b').deleted, true); assert.equal(P.shown(m).length, 1);
});
test('bulk: overwrite vs only-empty, wouldOverwrite lists clashes, spares without a device skipped by default', () => {
  const cs = [Object.assign(T.blankCircuit(1), { rating: '20', bs: '61009' }), T.blankCircuit(2), Object.assign(T.blankCircuit(3), { desc: 'SPARE', noDevice: true })];
  const fields = { rating: '32', bka: '6', live: '2.5' };
  assert.deepEqual(P.wouldOverwrite(cs[0], fields), ['rating']); assert.deepEqual(P.wouldOverwrite(cs[1], fields), []);
  assert.deepEqual(cs.map(P.skipByDefault), [false, false, true]);
  const e = cs.slice(0, 2).map((c) => ({ ...c }));
  P.bulkApply(e, fields, 'empty'); assert.equal(e[0].rating, '20'); assert.equal(e[0].bka, '6'); assert.equal(e[1].rating, '32');
  P.bulkApply(e, fields, 'all'); assert.equal(e[0].rating, '32');
  const d = [T.blankCircuit(4)]; P.bulkApply(d, { bs: '60898' }); assert.equal(d[0].device, 'mcb');
});
