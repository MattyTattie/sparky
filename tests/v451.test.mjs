// v0.45.1: main switch for boards after the first (same boxes as DB1), in the parts list and from the photo scan. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { partsForJob, partsForBoard } from '../js/parts.js';
import { mainSwitchFields, sectionsFor } from '../js/certmodel.js';
import { mainFromScan, mainSwitchParts, hasMainSwitch } from '../js/boardmain.js';
const src = (f) => readFileSync(new URL('../js/' + f, import.meta.url), 'utf8');
const cert = () => ({ id: 'c1', type: 'EIC', number: 'EIC-T1',
  parts: { msBs: '60947-3', msPoles: '2', msCurrent: '100', msVoltage: '230' },
  boards: [
    { ref: 'DB1', spdT2: true, circuits: [{ num: '1', device: 'rcbo', type: 'B', rating: '32', rcdIdn: '30', rcdType: 'A' }] },
    { ref: 'DB2', location: 'Generation CU', spdT2: true, rcdBs: '61008', rcdType: 'A-S', rcdIdn: '300', rcdRating: '63',
      circuits: [{ num: '1', device: 'mcb', bs: '60898', type: 'B', rating: '50', bka: '6', rcdBs: '61008', rcdType: 'A-S', rcdIdn: '300', rcdRating: '63' }] },
  ] });

test('DB2 has the same main switch boxes as DB1 (board.main instead of cert.parts)', () => {
  const db1 = sectionsFor('EIC').find((s) => s.id === 'parts').fields.filter((f) => /^parts\.(ms|rcd)/.test(f.k));
  const db2 = mainSwitchFields('main.');
  assert.deepEqual(db2.map((f) => f.k.replace('main.', '')), db1.map((f) => f.k.replace('parts.', '')));
  assert.deepEqual(db2.map((f) => f.label), db1.map((f) => f.label));
  assert.match(src('schedule.js'), /cert\.boards\.indexOf\(b\) > 0 \? boardMainSwitch\(cert, b(?:, \(\) => rcdBox\.redraw\(\))?\) : msPointer\(cert\)/);
});
test('parts list: DB2 with no main switch gets the hint flag; filled in, it lists isolator, SPD, RCD, MCB', () => {
  const c = cert();
  let r = partsForJob([c]);
  assert.equal(r.boards[1].noMain, true); assert.equal(r.boards[0].noMain, false);
  assert.deepEqual(r.boards[1].items.map((i) => i.name), ['SPD Type 2', 'RCD 63 A 300 mA Type A S (BS EN 61008)', 'B50 MCB · 6 kA']);
  c.boards[1].main = { msBs: '60947-3', msPoles: '2', msCurrent: '100', msVoltage: '230/400' };
  r = partsForJob([c]);
  assert.equal(r.boards[1].noMain, false);
  assert.deepEqual(r.boards[1].items.map((i) => i.name), ['Main switch: 100 A DP isolator (BS EN 60947-3)', 'SPD Type 2', 'RCD 63 A 300 mA Type A S (BS EN 61008)', 'B50 MCB · 6 kA']);
  assert.equal(r.boards[0].items[0].name, 'Main switch: 100 A DP isolator (BS EN 60947-3)');
  assert.equal(r.boards[1].certId, 'c1'); assert.equal(r.boards[1].bi, 1);
  assert.equal(r.totals.find((t) => /isolator/.test(t.name)).qty, 2);
});
test('main switch naming: breaker / RCD main switches and non-isolator standards keep the old wording', () => {
  assert.deepEqual(mainSwitchParts({ main: { msBs: '60947-2', msCurrent: '100', msPoles: '4' } }, 'main.'), ['Main switch: 100 A 4-pole (BS EN 60947-2)']);
  assert.deepEqual(mainSwitchParts({ main: { msBs: '61008', msCurrent: '100', msPoles: '2', msIsRcd: true, rcdIdn: '100', rcdType: 'S' } }, 'main.'), ['Main switch: 100 A DP RCD 100 mA Type S (BS EN 61008)'] /* v0.47.0: one line */);
  assert.deepEqual(mainSwitchParts({ parts: { msIsOcpd: true, msType: 'MCCB', msRating: '125' } }, 'parts.'), ['Main MCCB 125 A']);
  assert.equal(hasMainSwitch({ main: { msLocation: 'Cupboard' } }, 'main.'), false);
  assert.deepEqual(partsForBoard({ ref: 'DB1', circuits: [] }, { boards: [{}], parts: {} }, true).noMain, true);
});
test('photo scan: the main switch it reads fills the blank rating (board 1 → certificate section, later boards → board.main), never overwrites', () => {
  const c = cert(); c.parts.msCurrent = '';
  assert.deepEqual(mainFromScan(c, 1, { kind: 'main', rating: '100' }), ['main.msCurrent']); assert.equal(c.boards[1].main.msCurrent, '100');
  assert.deepEqual(mainFromScan(c, 0, { kind: 'main', rating: '80' }), ['parts.msCurrent']); assert.equal(c.parts.msCurrent, '80');
  c.boards[1].main.msCurrent = '63'; assert.deepEqual(mainFromScan(c, 1, { rating: '100' }), []); assert.equal(c.boards[1].main.msCurrent, '63');
  assert.deepEqual(mainFromScan(c, 1, { rating: '' }), []);
  assert.match(src('schedule.js'), /o\.kind === 'main' && o\.rating\); if \(ms\) mainFromScan\(cert, \+bi, ms\)/);
});
test('parts screen shows where to add a missing main switch', () => {
  assert.match(src('app.js'), /No main switch listed: add it in /); assert.match(src('app.js'), /\\u2019s board details/);
  assert.doesNotMatch(src('schedule.js') + src('boardmain.js'), /Garo/); // the one-tap fill was dropped
});
