// v0.30: Reference section data, cable fixes and version.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REF, refById } from '../js/refdata.js';
import { CABLES } from '../js/cables.js';

const row = (id, key, ti = 0) => refById(id).tables[ti].rows.find((r) => r[0] === key);

test('all eight reference topics exist with plain text and More info', () => {
  assert.deepEqual(REF.map((r) => r.id), ['ground', 'bonding', 'ir', 'disc', 'r1r2', 'rcd', 'special', 'ip']);
  for (const r of REF) { assert.ok(r.plain.length > 20, r.id); assert.ok(r.more.length >= 1, r.id); assert.ok(r.tables || r.cards, r.id); }
});
test('no ellipsis anywhere in reference text', () => {
  assert.ok(!/\u2026|\.\.\./.test(JSON.stringify(REF)));
});
test('rows match their headers', () => {
  for (const r of REF) for (const t of r.tables || []) for (const x of t.rows) assert.equal(x.length, t.head.length, r.id + ' ' + x[0]);
});
test('Table 4B2 ground factors', () => {
  assert.deepEqual(row('ground', '20').slice(1), ['1.00', '1.00']);
  assert.deepEqual(row('ground', '10').slice(1), ['1.10', '1.07']);
  assert.deepEqual(row('ground', '60').slice(1), ['0.45', '0.65']);
  assert.deepEqual(row('ground', '80').slice(1), ['\u2014', '0.38']);
});
test('Table 54.8 bonding', () => {
  assert.equal(row('bonding', '35 mm\u00b2 or less')[1], '10 mm\u00b2');
  assert.equal(row('bonding', 'over 35 up to 50 mm\u00b2')[1], '16 mm\u00b2');
  assert.equal(row('bonding', 'over 50 up to 95 mm\u00b2')[1], '25 mm\u00b2');
});
test('insulation resistance is Table 64 with the right minimums', () => {
  assert.match(refById('ir').table, /Table 64/);
  assert.deepEqual(row('ir', 'SELV and PELV').slice(1), ['250 V', '0.5 M\u03a9']);
  assert.deepEqual(row('ir', 'Above 500 V').slice(1), ['1000 V', '1.0 M\u03a9']);
});
test('disconnection times, 63 A sockets / 32 A fixed', () => {
  assert.deepEqual(row('disc', 'TN (TN-S, TN-C-S)').slice(1), ['0.4 s', '5 s']);
  assert.deepEqual(row('disc', 'TT').slice(1), ['0.2 s', '1 s']);
  assert.match(refById('disc').tables[0].head[1], /63 A.*32 A/);
});
test('R1+R2 per metre and the 1.20 hot column agree', () => {
  assert.equal(row('r1r2', '2.5 / 1.5')[1], '19.51');
  for (const x of refById('r1r2').tables[0].rows) assert.ok(Math.abs(parseFloat(x[1]) * 1.2 - parseFloat(x[2])) < 0.011, x[0]);
});
test('RCD trip times and pool zone 1 is 2 m', () => {
  assert.equal(row('rcd', '1 \u00d7 I\u0394n', 2)[1], '300 ms');
  assert.equal(row('rcd', '5 \u00d7 I\u0394n', 2)[1], '40 ms');
  const pool = refById('special').cards.find((c) => /pools/.test(c.t)).lines.join(' ');
  assert.match(pool, /Zone 1: 2 m/); assert.match(pool, /IPX2 indoors/);
  assert.match(refById('rcd').more.join(' '), /must be fitted/);
});
test('T&E method A 2.5 mm² is 20 A (Table 4D5); 4E1A 2.5 mm² stays 26/31/34 A', () => {
  assert.equal(CABLES.te.methods.A.amps[2.5], 20);
  const s = CABLES.singlesX.methods; assert.deepEqual([s.A.amps[2.5], s.B.amps[2.5], s.C.amps[2.5]], [26, 31, 34]);
});
test('version 0.30.0 and reference files are cached offline', () => {
  assert.match(readFileSync('js/config.js', 'utf8'), /0\.30\.[01]/);
  const sw = readFileSync('sw.js', 'utf8'); assert.match(sw, /sparky-v0\.30\.[01]/); assert.match(sw, /refui\.js/); assert.match(sw, /refdata\.js/);
  assert.match(readFileSync('js/main.js', 'utf8'), /refui\.js/);
});

import { CABLE_PICKS, METHODS_FOR_PICK } from '../js/cables.js';
import { cableCheck, cableTable } from '../js/checks.js';
import { kFor } from '../js/design.js';
test('FP200 and mineral insulated are gone from data, pickers and method mapping', () => {
  for (const k of ['micL', 'micH', 'fp200']) assert.equal(CABLES[k], undefined);
  for (const k of ['micL3', 'micH3', 'fp200']) { assert.equal(CABLE_PICKS[k], undefined); assert.equal(METHODS_FOR_PICK(k), null); }
  assert.ok(!Object.values(CABLE_PICKS).some((p) => /FP200|[Mm]ineral/.test(p.label)));
  assert.ok(!/FP200|[Mm]ineral/.test(JSON.stringify(REF)));
});
test('old circuits with those cable ids still load: no rating check, no throw', () => {
  for (const [cable, wiring] of [['micL3', 'H'], ['micH3', 'H'], ['fp200', 'O']]) {
    const c = { cable, wiring, cableSize: '1.5', live: '1.5', cpc: '1.5', ref: 'C', rating: '10', type: 'B' };
    assert.equal(cableTable(c), null); assert.equal(cableCheck(c), null);
    assert.doesNotThrow(() => kFor({ cable }));
  }
});

import { OBSERVATIONS } from '../js/inspections.js';
import { maxDemand, kindBoxes, kind } from '../js/maxdemand.js';
test('BPG4: no RCD on ordinary sockets is C3; outdoor sockets stay C2', () => {
  const o = OBSERVATIONS.filter((x) => x.reg === '411.3.3' && x.cat === 'RCD protection');
  assert.ok(o.some((x) => x.code === 'C3' && /up to 32 A/.test(x.text)));
  assert.ok(o.some((x) => x.code === 'C2' && /outdoors/.test(x.text) && !/unlikely/.test(x.text)));
  assert.ok(!o.some((x) => x.code === 'C2' && /up to 32 A/.test(x.text)));
});
test('storage heaters and heat pumps are 100%, space heaters still 10 A + 50%', () => {
  const amps = (kw) => (kw * 1000) / 230;
  const st = maxDemand([{ k: 'storage', qty: 3, value: 3.4 }]); const hp = maxDemand([{ k: 'heatpump', qty: 1, value: 5 }]);
  const sp = maxDemand([{ k: 'heater', qty: 3, value: 3.4 }]);
  const tot = (r) => r.groups.reduce((s, g) => s + g.demand, 0);
  assert.ok(Math.abs(tot(st) - 3 * amps(3.4)) < 0.2); assert.ok(Math.abs(tot(hp) - amps(5)) < 0.2);
  assert.ok(tot(sp) < 3 * amps(3.4) - 5);
  assert.equal(kind('storage').group, 'storage'); assert.equal(kind('heatpump').group, 'heatpump');
  const b = kindBoxes([{ k: 'storage', qty: 2, value: 3.4 }, { k: 'heatpump', qty: 1, value: 5 }, { k: 'heater', qty: 1, value: 2 }]);
  assert.equal(b.length, 3); for (const x of b) assert.ok(x.rule);
});
test('old saved max-demand data (heater kind) still loads the same', () => {
  const r = maxDemand([{ k: 'heater', qty: 2, value: 3 }, { k: 'ring', qty: 2, value: 32 }]);
  assert.ok(r.groups.some((g) => g.g === 'heating'));
});
