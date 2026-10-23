// v0.25: half-length VD, Ig max Zs, parts used, preset compatibility.
import test from 'node:test';
import assert from 'node:assert/strict';
import { voltDrop } from '../js/calc.js';
import { limitZs } from '../js/checks.js';
import { maxZsForTrip } from '../js/limits.js';
import { partsForJob, partsForBoard, partName } from '../js/parts.js';
import { presetFrom, keyOf, mergePresets, applyPreset, PRESET_KEYS } from '../js/presets.js';
import { adjRemark } from '../js/pdf.js';
import { APP_NAME, DRIVE_ROOT } from '../js/config.js';

test('name changes, Drive folder does not', () => { assert.equal(APP_NAME, 'Zs Pro'); assert.equal(DRIVE_ROOT, 'Sparky jobs'); });

test('load spread evenly halves the volt drop on a radial', () => {
  const a = voltDrop({ size: '2.5', ib: 20, length: 30 });
  const b = voltDrop({ size: '2.5', ib: 20, length: 30, spread: true });
  const pct = (r) => r.volts;
  assert.ok(Math.abs(pct(b) * 2 - pct(a)) < 0.02 && b.divisor === 2, JSON.stringify([a, b]));
  assert.equal(b.spread, true);
  const ring = voltDrop({ size: '2.5', ib: 20, length: 30, ring: true, spread: true });
  assert.equal(ring.spread, false);
});

test('MCCB with Ig: max Zs from Ig', () => {
  const c = { device: 'mccb', rating: '200', im: '2000', ig: '100', zs: '0.5' };
  const r = limitZs(c, { uo: 230 });
  const v = r && (r.max ?? r.maxZs ?? r.value);
  assert.ok(Math.abs(v - maxZsForTrip(100)) < 0.01, JSON.stringify(r));
  const r2 = limitZs({ device: 'mccb', rating: '200', im: '2000' }, { uo: 230 });
  assert.ok(Math.abs((r2.max ?? r2.maxZs ?? r2.value) - maxZsForTrip(2000)) < 0.01);
});

test('parts used: grouped, spares with no device left out', () => {
  const b = { ref: 'DB1', location: 'Garage', spdT2: true, circuits: [
    { num: '1', desc: 'Sockets', device: 'rcbo', bs: '61009', type: 'B', rating: '32', rcdIdn: '30', rcdType: 'A', bka: '6' },
    { num: '2', desc: 'Sockets', device: 'rcbo', bs: '61009', type: 'B', rating: '32', rcdIdn: '30', rcdType: 'A', bka: '6' },
    { num: '3', desc: 'Lights', device: 'mcb', bs: '60898', type: 'B', rating: '6', bka: '6', rcdIdn: '30', rcdType: 'A', rcdRating: '63' },
    { num: '4', desc: 'Spare', noDevice: true },
    { num: '5', desc: 'Spare', device: 'mcb', bs: '60898', type: 'B', rating: '16', bka: '6' }] };
  const r = partsForBoard(b, null, false);
  const q = Object.fromEntries(r.items.map((i) => [i.name, i.qty]));
  assert.equal(q['B32 RCBO · 30 mA Type A · 6 kA'], 2);
  assert.equal(q['B6 MCB · 6 kA'], 1);
  assert.equal(q['B16 MCB · 6 kA'], 1);
  assert.equal(q['SPD Type 2'], 1);
  assert.ok(r.items.some((i) => i.rcd && /63 A 30 mA/.test(i.name)));
  assert.equal(r.spares, 1); assert.equal(r.ways, 5);
  const job = partsForJob([{ type: 'EIC', number: 'EIC-1', boards: [b, { ref: 'DB2', circuits: [b.circuits[0]] }] }, { type: 'EICR', number: 'R-1', boards: [b] }]);
  assert.deepEqual(job.from, ['EIC-1']);
  assert.equal(job.totals.find((t) => t.name.startsWith('B32 RCBO')).qty, 3);
  assert.match(partName({ device: 'mccb', rating: '200', im: '2000' }), /200 A MCCB · Im 2000 A/);
});

test('presets: old keys unchanged, Im/Ig/tg kept, no RCD on MCCB', () => {
  const mcb = { device: 'mcb', bs: '60898', type: 'B', rating: '6', bka: '6', rcdBs: '', rcdType: '', rcdIdn: '', rcdRating: '', rcdS: false };
  const p = presetFrom(mcb);
  assert.ok(!('im' in p) || !p.im);
  assert.equal(keyOf(p), keyOf({ ...p, im: '', ig: '', tg: '' })); assert.ok(!/undefined/.test(keyOf(p)));
  const m = presetFrom({ device: 'mccb', bs: '60947-2', type: 'adj', rating: '200', im: '2000', ig: '100', tg: '0.2', rcdIdn: '30', rcdType: 'A', rcdBs: '61008', rcdRating: '250' });
  assert.equal(m.im, '2000'); assert.equal(m.ig, '100'); assert.equal(m.tg, '0.2');
  assert.equal(m.rcdIdn || '', ''); assert.equal(m.rcdType || '', ''); assert.equal(m.rcdBs || '', '');
  assert.notEqual(keyOf(m), keyOf(presetFrom({ device: 'mccb', bs: '60947-2', type: 'adj', rating: '200' })));
  const c = { rcdIdn: '30', rcdType: 'A' }; applyPreset(c, { fields: m });
  assert.equal(c.rcdIdn, '30'); assert.equal(c.ig, '100');
  assert.ok(PRESET_KEYS.includes('ig') && PRESET_KEYS.includes('tg') && PRESET_KEYS.includes('im'));
  const merged = mergePresets([{ id: 'a', key: keyOf(p), fields: p, usedAt: '2026-01-01' }], [{ id: 'b', key: keyOf(m), fields: { ...m, rcdIdn: '30' }, usedAt: '2026-02-01' }]);
  const mm = (merged.list || merged).find((x) => x.fields.device === 'mccb');
  assert.equal(mm.fields.rcdIdn || '', '');
});

test('cert remarks carry the MCCB settings', () => {
  assert.equal(adjRemark({ device: 'mccb', rating: '200', im: '2000', ig: '100', tg: '0.2' }), 'MCCB Ir 200 A, Im 2000 A, Ig 100 A, tg 0.2 s');
  assert.equal(adjRemark({ device: 'mcb', rating: '6' }), '');
});

