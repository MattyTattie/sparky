import test from 'node:test'; import assert from 'node:assert'; import { readFileSync } from 'node:fs';
import { rcdGroupChanged, spareLine, copyToNextWay, blankCircuit, RESULT_KEYS } from '../js/templates.js';
test('main RCD: N/A fills blanks only, real value clears N/As', () => {
  const b = { rcdBs: 'n/a', rcdType: '', rcdIdn: '30', rcdRating: '' };
  assert.deepEqual(rcdGroupChanged(b, 'rcdBs').sort(), ['rcdRating', 'rcdType']);
  assert.equal(b.rcdIdn, '30'); assert.equal(b.rcdType, 'N/A');
  b.rcdBs = '61008'; rcdGroupChanged(b, 'rcdBs'); assert.equal(b.rcdType, ''); assert.equal(b.rcdRating, ''); assert.equal(b.rcdIdn, '30');
});
test('spare way line', () => {
  assert.equal(spareLine({ rating: '' }), 'Spare way');
  assert.equal(spareLine({ rating: 'N/A', type: 'B' }), 'Spare way');
  assert.equal(spareLine({ rating: '16', type: 'B' }, 'RCBO'), 'Spare way \u00b7 B16 A RCBO');
  assert.equal(spareLine({ noDevice: true, rating: '16' }), 'Spare way \u00b7 no device fitted');
});
test('copy to next way: details only, creates or fills', () => {
  const a = { ...blankCircuit(1), desc: 'Lights', type: 'B', rating: '6', live: '1.5', ref: '101', zs: '0.8', r1r2: '0.5' };
  const list = [a]; const ni = copyToNextWay(list, 0);
  assert.equal(ni, 1); assert.equal(list.length, 2); assert.equal(list[1].num, '2');
  assert.equal(list[1].rating, '6'); assert.equal(list[1].ref, '101'); assert.equal(list[1].desc, ''); assert.equal(list[1].zs, ''); assert.notEqual(list[1].id, a.id);
  list[1].desc = 'Kitchen'; list[1].zs = '1.1'; a.rating = '10'; copyToNextWay(list, 0);
  assert.equal(list.length, 2); assert.equal(list[1].rating, '10'); assert.equal(list[1].desc, 'Kitchen'); assert.equal(list[1].zs, '1.1');
  for (const k of RESULT_KEYS) assert.ok(k in list[1]);
});
test('v0.31 bits are wired in', () => {
  const s = readFileSync('js/schedule.js', 'utf8'); assert.match(s, /Mark spare/); assert.match(s, /Copy to next way/); assert.match(s, /rcdGrid/); assert.match(s, /nextBox/);
  const a = readFileSync('js/app.js', 'utf8'); assert.match(a, /Parts list PDF/); assert.match(a, /Version \$\{APP_VERSION\}/);
  assert.match(readFileSync('js/certui.js', 'utf8'), /Circuit chart PDF/);
});
