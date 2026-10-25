import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { autoFillOcpd, typed, standardFor } from '../js/ocpdfill.js';
import { blankCircuit, copyToNextWay } from '../js/templates.js';

const fresh = (o = {}) => Object.assign(blankCircuit(1), { device: '', bs: '' }, o);
test('v331: MCB fills BS, kA 6, no RCD boxes', () => {
  const c = fresh({ device: 'mcb', type: 'B', rating: '32' }); autoFillOcpd(c);
  assert.equal(c.bs, '60898'); assert.equal(c.bka, '6'); assert.equal(c.rcdBs, ''); assert.equal(c.type, 'B');
});
test('v331: RCBO fills OCPD and RCD boxes; rating change follows', () => {
  const c = fresh({ device: 'rcbo', type: 'C', rating: '16' }); autoFillOcpd(c);
  assert.deepEqual([c.bs, c.type, c.bka, c.rcdBs, c.rcdType, c.rcdIdn, c.rcdRating], ['61009', 'C', '6', '61009', 'A', '30', '16']);
  c.rating = '20'; autoFillOcpd(c); assert.equal(c.rcdRating, '20');
});
test('v331: typed values are never overwritten', () => {
  const c = fresh({ device: 'rcbo', type: 'B', rating: '32', bka: '10', rcdType: 'F' }); autoFillOcpd(c);
  assert.equal(c.bka, '10'); assert.equal(c.rcdType, 'F'); assert.equal(c.rcdIdn, '30');
  c.rcdIdn = '100'; typed(c, 'rcdIdn'); autoFillOcpd(c); assert.equal(c.rcdIdn, '100');
  c.bka = 'N/A'; typed(c, 'bka'); autoFillOcpd(c); assert.equal(c.bka, 'N/A');
});
test('v331: changing device updates only auto values', () => {
  const c = fresh({ device: 'rcbo', type: 'B', rating: '32' }); autoFillOcpd(c);
  c.rcdType = 'F'; typed(c, 'rcdType');
  c.device = 'mcb'; c.bs = '60898'; autoFillOcpd(c);
  assert.equal(c.rcdBs, ''); assert.equal(c.rcdIdn, ''); assert.equal(c.rcdRating, ''); assert.equal(c.rcdType, 'F');
  c.device = 'bs88-3'; c.bs = '88-3'; c.type = 'gG'; autoFillOcpd(c); assert.equal(c.bka, '16');
  c.device = 'bs3036'; c.bs = '3036'; c.type = 'rewirable'; autoFillOcpd(c); assert.equal(c.bka, '');
});
test('v331: kA default can come from options; no device fitted is skipped', () => {
  assert.equal(standardFor(fresh({ device: 'mcb', type: 'B' }), { ka: '10' }).bka, '10');
  const c = fresh({ device: 'mcb', noDevice: true }); assert.deepEqual(autoFillOcpd(c), []); assert.equal(c.bka, '');
});
test('v331: old circuits without autoF keep their values', () => {
  const c = fresh({ device: 'rcbo', type: 'B', rating: '32', bka: '10', rcdBs: '61009', rcdType: 'AC', rcdIdn: '30', rcdRating: '32' });
  autoFillOcpd(c); assert.equal(c.rcdType, 'AC'); assert.equal(c.bka, '10');
});
test('v331: copy to next way carries the auto marks', () => {
  const c = fresh({ device: 'rcbo', type: 'B', rating: '32' }); autoFillOcpd(c);
  const list = [c]; copyToNextWay(list, 0); list[1].rating = '16'; autoFillOcpd(list[1]); assert.equal(list[1].rcdRating, '16');
});
test('v331: editor wiring present', () => {
  const s = readFileSync(new URL('../js/schedule.js', import.meta.url), 'utf8');
  assert.ok((s.match(/autoFillOcpd\(c\)/g) || []).length >= 4); assert.ok(s.includes("typed(c, f.k)"));
});
test('v331: test results page has a description column and never uses an ellipsis in table cells', () => {
  const s = readFileSync(new URL('../js/pdf.js', import.meta.url), 'utf8');
  assert.match(s, /\{ k: 'desc', label: 'Circuit description', n: '', w: 30, left: true \}/);
  const tg = s.slice(s.indexOf('function tableGrid'), s.indexOf('function boardHeaderDetails'));
  assert.ok(!tg.includes('…') && !tg.includes('ellipsis'));
});
