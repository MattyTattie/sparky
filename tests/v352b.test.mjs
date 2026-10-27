import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import { parseRcdType, formatRcdType, showRcdType, isSType } from '../js/rcdtype.js';
import { autoFillOcpd, fillBoardRcd, typed } from '../js/ocpdfill.js';
import { nameFor } from '../js/presets.js';
import { FIELD } from '../js/templates.js';
const mcb = (x = {}) => ({ device: 'mcb', bs: '60898', type: 'B', rating: '32', ...x });
const board = (t) => ({ rcdBs: '61008', rcdType: t, rcdIdn: '300', rcdRating: '100', circuits: [] });
test('v352b: type parse / format', () => {
  assert.deepEqual([parseRcdType('A S').wave, parseRcdType('A S').s], ['A', true]);
  for (const [i, o] of [['A-S', 'A S'], ['as', 'A S'], ['Type A S', 'A S'], ['S', 'S'], ['AC', 'AC'], ['b s', 'B S'], ['N/A', 'N/A'], ['', ''], ['Type 2', 'Type 2']]) assert.equal(showRcdType(i), o, i);
  assert.equal(formatRcdType('F', true), 'F S'); assert.equal(formatRcdType('', true), 'S'); assert.equal(formatRcdType('A', false), 'A');
  assert.ok(isSType('S') && isSType('A-S') && !isSType('A') && !isSType('N/A') && !isSType(''));
});
test('v352b: S board fills MCB line with A S and the S tick; RCBO untouched', () => {
  const b = board('A S'); const c = mcb(); const r = { device: 'rcbo', bs: '61009', type: 'B', rating: '20', rcdBs: '61009', rcdType: 'A', rcdIdn: '30', rcdRating: '20' }; b.circuits = [c, r];
  fillBoardRcd(b);
  assert.equal(c.rcdType, 'A S'); assert.equal(c.rcdS, true); assert.equal(r.rcdType, 'A'); assert.ok(!r.rcdS);
  b.rcdType = 'A'; fillBoardRcd(b); assert.equal(c.rcdType, 'A'); assert.equal(c.rcdS, false);
  b.rcdType = 'A-S'; fillBoardRcd(b); assert.equal(c.rcdType, 'A S'); assert.equal(c.rcdS, true);
});
test('v352b: hand-set S tick and typed type stick', () => {
  const b = board('A S'); const c = mcb(); b.circuits = [c]; fillBoardRcd(b);
  c.rcdS = false; typed(c, 'rcdS'); fillBoardRcd(b); assert.equal(c.rcdS, false);
  b.rcdType = 'A'; const d = mcb({ rcdS: true }); b.circuits.push(d); fillBoardRcd(b); assert.equal(d.rcdS, true, 'old hand tick kept');
  const e = mcb({ rcdType: 'B' }); b.rcdType = 'A S'; b.circuits.push(e); fillBoardRcd(b); assert.equal(e.rcdType, 'B');
});
test('v352b: old job with board type S alone loads, keeps S and ticks', () => {
  const old = JSON.parse(JSON.stringify(board('S'))); old.circuits = [mcb()];
  assert.doesNotThrow(() => fillBoardRcd(old)); assert.equal(old.rcdType, 'S'); assert.equal(old.circuits[0].rcdType, 'S'); assert.equal(old.circuits[0].rcdS, true);
  const na = board('N/A'); na.circuits = [mcb()]; fillBoardRcd(na); assert.equal(na.circuits[0].rcdType, 'N/A'); assert.ok(!na.circuits[0].rcdS);
});
test('v352b: options, preset names, PDF wiring', () => {
  assert.deepEqual(FIELD.rcdType.opts, ['AC', 'A', 'F', 'B', 'AC S', 'A S', 'F S', 'B S']);
  assert.equal(nameFor({ device: 'rcbo', bs: '61009', type: 'B', rating: '32', rcdIdn: '30', rcdType: 'A-S', rcdS: true }), 'B32 RCBO · 30 mA Type A S');
  assert.equal(nameFor({ device: 'rcbo', bs: '61009', type: 'B', rating: '32', rcdIdn: '30', rcdType: 'A', rcdS: true }), 'B32 RCBO · 30 mA Type A S');
  const p = readFileSync(new URL('../js/pdf.js', import.meta.url), 'utf8'); assert.match(p, /r\.rcdType = showRcdType\(r\.rcdType\)/); assert.match(p, /showRcdType\(b\.rcdType\)/);
  const s = readFileSync(new URL('../js/schedule.js', import.meta.url), 'utf8'); assert.match(s, /rcdTypeChips\(\(\) => b\.rcdType/); assert.match(s, /typed\(c, 'rcdS'\)/);
});
