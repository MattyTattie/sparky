// node --test tests/  — every limit value, printed and checked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_ZS, maxZs, coldLimit, irMinFor, rcdTimeLimit, RCD_ZS, DEVICES, deviceFromBs, ratingsFor, CHECK_NOTE } from '../js/limits.js';

const r2 = (n) => Math.round(n * 100) / 100;

test('lists every max Zs value (for checking against the book)', () => {
  const lines = [];
  for (const [fam, tbl] of Object.entries(MAX_ZS)) {
    lines.push(`## ${fam} — ${tbl.source}`);
    for (const [type, rows] of Object.entries(tbl)) {
      if (type === 'source' || type === 'legacy') continue;
      for (const [a, [t04, t5]] of Object.entries(rows)) lines.push(`${fam} ${type} ${a} A: 0.4 s ${t04 ?? '—'} Ω, 5 s ${t5 ?? '—'} Ω, 80% ${t04 != null ? coldLimit(t04) : '—'} Ω`);
    }
  }
  console.log(lines.join('\n'));
  assert.ok(lines.length > 100);
});

test('Table 41.3 circuit-breakers match Zs = 230 × 0.95 / Ia', () => {
  const k = { B: 5, C: 10, D: 20 };
  for (const t of ['B', 'C', 'D']) {
    for (const [a, [t04, t5]] of Object.entries(MAX_ZS.mcb[t])) {
      assert.equal(t04, r2(218.5 / (k[t] * Number(a))), `${t}${a} 0.4 s`);
      assert.equal(t5, r2(218.5 / ((t === 'D' ? 10 : k[t]) * Number(a))), `${t}${a} 5 s`);
    }
  }
});

test('well-known spot values', () => {
  assert.equal(maxZs({ device: 'mcb', type: 'B', rating: 32 }), 1.37);
  assert.equal(maxZs({ device: 'rcbo', type: 'B', rating: 6 }), 7.28);
  assert.equal(maxZs({ device: 'rcbo', type: 'C', rating: 16 }), 1.37);
  assert.equal(maxZs({ device: 'mcb', type: 'D', rating: 32, time: 5 }), 0.68);
  assert.equal(maxZs({ device: 'bs88-2', rating: 32 }), 0.99);
  assert.equal(maxZs({ device: 'bs88-2', rating: 100, time: 5 }), 0.42);
  assert.equal(maxZs({ device: 'bs88-2', rating: 100 }), null);
  assert.equal(maxZs({ device: 'bs88-3', rating: 45 }), 0.57);
  assert.equal(maxZs({ device: 'bs3036', rating: 30 }), 1.04);
  assert.equal(maxZs({ device: 'bs3036', rating: 30, time: 5 }), 2.51);
  assert.equal(maxZs({ device: 'bs1362', rating: 13 }), 2.3);
  assert.equal(maxZs({ device: 'other', rating: 13 }), null);
  assert.equal(coldLimit(1.37), 1.1);
  assert.equal(RCD_ZS[30], 1667);
});

test('every value is a positive number, and 5 s ≥ 0.4 s', () => {
  for (const [fam, tbl] of Object.entries(MAX_ZS)) for (const [type, rows] of Object.entries(tbl)) {
    if (typeof rows !== 'object') continue;
    for (const [a, [x, y]] of Object.entries(rows)) {
      if (x != null) assert.ok(x > 0, `${fam}${type}${a}`);
      assert.ok(y > 0, `${fam}${type}${a} 5s`);
      if (x != null) assert.ok(y >= x, `${fam}${type}${a} 5s >= 0.4s`);
    }
  }
});

test('values fall as rating rises', () => {
  for (const [fam, tbl] of Object.entries(MAX_ZS)) for (const [type, rows] of Object.entries(tbl)) {
    if (typeof rows !== 'object') continue;
    const vals = Object.entries(rows).sort((a, b) => a[0] - b[0]).map(([, v]) => v[1]);
    for (let i = 1; i < vals.length; i++) assert.ok(vals[i] < vals[i - 1], `${fam} ${type} monotonic`);
  }
});

test('IR minimums (Table 64) and RCD times', () => {
  assert.equal(irMinFor(250), 0.5);
  assert.equal(irMinFor(500), 1.0);
  assert.equal(irMinFor(1000), 1.0);
  assert.deepEqual(rcdTimeLimit(false), { maxMs: 300 });
  assert.deepEqual(rcdTimeLimit(true), { minMs: 130, maxMs: 500 });
});

test('device lookup from the BS (EN) column', () => {
  assert.equal(deviceFromBs('BS EN 61009-1').id, 'rcbo');
  assert.equal(deviceFromBs('60898').id, 'mcb');
  assert.equal(deviceFromBs('1361').id, 'bs88-3');
  assert.equal(deviceFromBs('3036').id, 'bs3036');
  assert.equal(deviceFromBs(''), null);
  assert.deepEqual(ratingsFor('mcb', 'B').slice(0, 3), [3, 6, 10]);
  assert.ok(DEVICES.length >= 7);
  assert.match(CHECK_NOTE, /own copy/);
});
