// v0.35.2: MCB / fuse lines take their RCD boxes from the board's main RCD. FAKE data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { autoFillOcpd, typed, fillBoardRcd } from '../js/ocpdfill.js';
import { applyPreset, releaseUpstreamRcd } from '../js/presets.js';
import { blankCircuit } from '../js/templates.js';
import { blankBoard } from '../js/certmodel.js';

const C = (o) => Object.assign(blankCircuit(1), { device: '', bs: '' }, o);
const db2 = () => Object.assign(blankBoard(2), { rcdBs: '61008', rcdType: 'S', rcdIdn: '300', rcdRating: '100' });
const rcd = (c) => [c.rcdBs, c.rcdType, c.rcdIdn, c.rcdRating];

test('v352: board RCD goes onto MCB and fuse lines', () => {
  const b = db2(); b.circuits = [C({ device: 'mcb', type: 'B', rating: '32' }), C({ device: 'bs88-3', bs: '88-3', type: 'gG', rating: '20' })];
  assert.equal(fillBoardRcd(b), 2);
  for (const c of b.circuits) assert.deepEqual(rcd(c), ['61008', 'S', '300', '100']);
});
test('v352: RCBO lines keep their own RCD', () => {
  const b = db2(); const r = C({ device: 'rcbo', type: 'B', rating: '16' }); b.circuits = [r]; fillBoardRcd(b);
  assert.deepEqual(rcd(r), ['61009', 'A', '30', '16']);
});
test('v352: hand edits stick; auto boxes follow a board change', () => {
  const b = db2(); const m = C({ device: 'mcb', type: 'B', rating: '6' }); const n = C({ device: 'mcb', type: 'B', rating: '10' }); b.circuits = [m, n]; fillBoardRcd(b);
  m.rcdIdn = '100'; typed(m, 'rcdIdn');
  b.rcdIdn = '30'; b.rcdType = 'A'; fillBoardRcd(b);
  assert.equal(m.rcdIdn, '100'); assert.equal(m.rcdType, 'A'); assert.equal(n.rcdIdn, '30');
});
test('v352: board with no RCD (N/A) gives N/A; blank board leaves lines blank', () => {
  const b = Object.assign(blankBoard(1), { rcdBs: 'N/A', rcdType: 'N/A', rcdIdn: 'N/A', rcdRating: 'N/A' }); const m = C({ device: 'mcb', type: 'C', rating: '20' }); b.circuits = [m]; fillBoardRcd(b);
  assert.deepEqual(rcd(m), ['N/A', 'N/A', 'N/A', 'N/A']);
  const e = blankBoard(1); const x = C({ device: 'mcb', type: 'C', rating: '20' }); e.circuits = [x]; fillBoardRcd(e);
  assert.deepEqual(rcd(x), ['', '', '', '']);
  // RCD taken off the board later: auto boxes are taken back
  const d = db2(); const y = C({ device: 'mcb', type: 'B', rating: '32' }); d.circuits = [y]; fillBoardRcd(d);
  Object.assign(d, { rcdBs: '', rcdType: '', rcdIdn: '', rcdRating: '' }); fillBoardRcd(d); assert.deepEqual(rcd(y), ['', '', '', '']);
});
test('v352: MCB preset tap puts the board RCD in, not the preset\u2019s stored upstream RCD', () => {
  const b = db2(); const c = C({}); b.circuits = [c];
  const p = { fields: { device: 'mcb', bs: '60898', type: 'B', rating: '32', bka: '6', rcdBs: '61008', rcdType: 'A', rcdIdn: '30', rcdRating: '63' } };
  Object.assign(c, { rcdBs: '61008', rcdType: 'A', rcdIdn: '30', rcdRating: '63' }); // filled by an older version from this preset
  applyPreset(c, p); releaseUpstreamRcd(c, p.fields); autoFillOcpd(c, { board: b });
  assert.deepEqual(rcd(c), ['61008', 'S', '300', '100']);
  const r = C({}); b.circuits.push(r); applyPreset(r, { fields: { device: 'rcbo', bs: '61009', type: 'B', rating: '20', bka: '6', rcdBs: '61009', rcdType: 'A', rcdIdn: '30', rcdRating: '20' } }); autoFillOcpd(r, { board: b });
  assert.deepEqual(rcd(r), ['61009', 'A', '30', '20']);
});
test('v352: old saved job (no autoF, typed RCD) loads and keeps its values', () => {
  const old = JSON.parse(JSON.stringify({ ref: 'DB1', rcdBs: '61008', rcdType: 'AC', rcdIdn: '30', rcdRating: '80', circuits: [{ num: '1', desc: 'Lights', device: 'mcb', bs: '60898', type: 'B', rating: '6', rcdBs: '61008', rcdType: 'A', rcdIdn: '30', rcdRating: '63' }, { num: '2', desc: 'Sockets', device: 'mcb', bs: '60898', type: 'B', rating: '32' }] }));
  assert.doesNotThrow(() => fillBoardRcd(old));
  assert.deepEqual(rcd(old.circuits[0]), ['61008', 'A', '30', '63']);
  assert.deepEqual(rcd(old.circuits[1]), ['61008', 'AC', '30', '80']);
});
test('v352: app wiring and version', () => {
  const s = readFileSync(new URL('../js/schedule.js', import.meta.url), 'utf8');
  assert.match(s, /fillBoardRcd\(b, isSpare\)\) changed\(\)/); assert.match(s, /releaseUpstreamRcd/); assert.doesNotMatch(s, /autoFill0\(c\)/);
  assert.match(readFileSync(new URL('../js/config.js', import.meta.url), 'utf8'), /'0\.3(5\.[23]|[678]\.\d) beta'/);
  assert.match(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), /sparky-v0\.3(5\.[23]|[678]\.\d)/);
});
