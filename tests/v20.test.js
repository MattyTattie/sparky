import test from 'node:test';
import assert from 'node:assert/strict';
import { designZs, r1r2At20, lengthFromR1R2 } from '../js/calc.js';
import { cpcAreaFor } from '../js/design.js';
import { limitZs, circuitAdiabatic } from '../js/checks.js';
import { devName, deviceById } from '../js/limits.js';
import { CABLES } from '../js/cables.js';

test('v0.20 flex/rubber R1+R2 uses class 5 copper in Zs and length checks', () => {
  const z = designZs({ ze: 0.35, cable: 'flex', live: 0.75, cpc: 0.75, length: 2, device: 'bs1362', type: 'plug', rating: 13 });
  assert.equal(z.ok, true); assert.equal(z.r20, r1r2At20({ live: 0.75, cpc: 0.75, length: 2, rTable: 'cu5' }));
  assert.equal(lengthFromR1R2({ r1r2: 0.104, live: 0.75, cpc: 0.75, rTable: 'cu5' }), 2);
  const h = designZs({ ze: 0.35, cable: 'h07', live: 2.5, cpc: 2.5, length: 10, device: 'mcb', type: 'B', rating: 16 });
  assert.ok(Math.abs(h.r20 - 0.16) < 0.001);
});
test('v0.20 tri-rated and tails are not armoured', () => {
  assert.equal(cpcAreaFor('tri', 2.5).cpc, 2.5);
  assert.equal(cpcAreaFor('tails', 25).cpc, 16);
  assert.equal(cpcAreaFor('singles', 95).cpc, 50);
  for (const k of ['te3', 'singles', 'tails', 'h07', 'flex', 'tri', 'sycy']) assert.ok(CABLES[k], k);
});
test('v0.20 MPCB/MCCB on the circuit page: max Zs and adiabatic from Im', () => {
  const c = { device: 'mccb', type: 'adj', rating: '100', im: '1000', zs: '0.2', live: '25', cpc: '16', cable: 'swa3c', cableSize: '25' };
  const l = limitZs(c); assert.equal(l.value, 0.22);
  const a = circuitAdiabatic(c); assert.equal(a.ok, true); assert.equal(a.pass, true);
  assert.equal(limitZs({ device: 'mccb', type: 'adj', rating: '100' }).value, null); // old records unchanged
});
test('v0.20 device names: no "Type plug"', () => {
  assert.equal(devName(deviceById('bs1362'), 'plug', 13), '13 A plug fuse (BS 1362)');
  assert.equal(devName(deviceById('mcb'), 'B', 32), 'B32 MCB');
  assert.equal(devName(deviceById('bs88-3'), 'gG', 60), '60 A Fuse BS 88-3');
});
test('v0.20 symbols list covers the asked-for set and the tap pattern', async () => {
  const { SYM, SYM_RE } = await import('../js/symdata.js');
  for (const s of ['Ib', 'In', 'Iz', 'It', 'I2', 'Ca', 'Cg', 'Ci', 'Cc', 'Cf', 'Ze', 'Zs', 'R1', 'R2', 'R1+R2', 'Rn', 'PFC', 'PSCC', 'PEFC', 'U0', 'Uo', 'k', 'S', 't', 'IΔn', 'Ir', 'Isd', 'tsd', 'Ii', 'Im', 'tr', 'Icu', 'Ics', 'Icw', 'Ue', 'Ui', 'Uimp', 'AC-1', 'AC-3']) assert.ok(SYM[s], s);
  const m = (t) => [...t.matchAll(SYM_RE)].map((x) => x[0]);
  assert.deepEqual(m('Load / design current (Ib)'), ['Ib']);
  assert.deepEqual(m('In conduit, It is fine'), []);
  assert.deepEqual(m('Rating (In), In ≥ Ib, R1+R2 and Zs'), ['In', 'In', 'Ib', 'R1+R2', 'Zs']);
});
test('v0.20 preset names and PDF type for adjustable breakers', async () => {
  const { nameFor } = await import('../js/presets.js');
  assert.equal(nameFor({ device: 'mccb', type: 'adj', rating: '32', rcdIdn: '', rcdType: '', bka: '' }), '32 A MCCB');
  assert.equal(nameFor({ device: 'mcb', type: 'B', rating: '32', rcdIdn: '', rcdType: '', bka: '6' }), 'B32 MCB · 6 kA');
});
