// v0.22: full Table 4C1 grouping rows; blank / 1 circuit = not grouped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CG, GROUPINGS, cgFor, CABLES } from '../js/cables.js';
import { sizeCable } from '../js/calc.js';
import { sizeCircuit } from '../js/design.js';
import { APP_VERSION } from '../js/config.js';
const sc = (o) => sizeCircuit({ load: '20', unit: 'A', loadType: 'general', length: '20', cable: 'te', method: 'C', ambient: 30, ci: 1, ze: 0.35, device: 'mcb', type: 'auto', time: 0.4, phase: 1, ...o });
test('v0.22 version', () => assert.match(APP_VERSION, /^0\.(2[2-9]|[34]\d)\./));
test('v0.22 Table 4C1 rows and factors', () => {
  assert.deepEqual(GROUPINGS.map(([k]) => k), ['bunched', 'clipped', 'ceiling', 'tray', 'ladder', 'spaced']);
  assert.equal(cgFor('bunched', 2), 0.8); assert.equal(cgFor('bunched', 9), 0.5); assert.equal(cgFor('bunched', 14), 0.41); assert.equal(cgFor('bunched', 25), 0.38);
  assert.equal(cgFor('clipped', 3), 0.79); assert.equal(cgFor('clipped', 15), 0.7);
  assert.equal(cgFor('ceiling', 4), 0.68); assert.equal(cgFor('tray', 2), 0.88); assert.equal(cgFor('ladder', 6), 0.79); assert.equal(cgFor('spaced', 9), 1);
  assert.equal(cgFor('nonsense', 2), 0.8, 'unknown falls back to bunched');
  for (const k of Object.keys(CG)) for (let n = 2; n <= 9; n++) assert.ok(CG[k][n] <= CG[k][n - 1], `${k} ${n} never goes up`);
});
test('v0.22 blank or 1 circuit = not grouped; old saved values keep their row', () => {
  const base = { cable: 'te', method: 'C', ib: 20, inA: 20, length: 20 };
  for (const g of ['', 0, 1, '1']) assert.equal(sizeCable({ ...base, grouped: g, grouping: 'ceiling' }).factors.cg, 1);
  assert.equal(sizeCable({ ...base, grouped: 3, grouping: 'clipped' }).factors.cg, 0.79);
  assert.equal(sizeCable({ ...base, grouped: 3, grouping: 'bunched' }).factors.cg, 0.7);
  assert.equal(sc({ grouped: '', grouping: 'tray' }).factors.cg, 1);
  assert.equal(sc({ grouped: '4', grouping: 'ladder' }).factors.cg, 0.8);
});
test('v0.22 T&E methods 100–103 use the Table 4D5 wording', () => {
  for (const m of ['100', '101', '102', '103']) assert.match(CABLES.te.methods[m].label, new RegExp(`^Installation Method ${m}: `));
  assert.match(CABLES.te.methods[100].label, /wooden joist.*not exceeding 100 mm/);
  assert.match(CABLES.te.methods.C.label, /^Reference Method C: clipped direct/);
});
test('v0.22b regs wording for Grouped how, and More info for every option and method', async () => {
  const { GROUP_INFO, METHOD_INFO, JOIST_HINT } = await import('../js/cables.js');
  assert.equal(GROUPINGS[0][1].split(' (')[0], 'Bunched in air, on a surface, embedded or enclosed');
  assert.match(GROUPINGS[1][1], /^Single layer on wall, floor or unperforated cable tray/);
  assert.match(GROUPINGS[3][1], /^Single layer multicore on a perforated horizontal or vertical cable tray system/);
  assert.match(GROUPINGS[4][1], /^Single layer multicore on cable ladder system or cleats etc\./);
  for (const [k] of GROUPINGS) assert.equal(GROUP_INFO[k].length, 2, k);
  for (const c of Object.values(CABLES)) for (const k of Object.keys(c.methods)) assert.ok(METHOD_INFO[k], `More info for method ${k} (${c.label})`);
  assert.match(JOIST_HINT, /joist holes/);
});
