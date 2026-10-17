import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSpeech } from '../js/voice.js';
import { readDevice, proposeCircuits } from '../js/cuscan.js';

test('voice: common phrases', () => {
  assert.deepEqual(parseSpeech('zs 0.42'), { zs: '0.42' });
  assert.deepEqual(parseSpeech('Zs nought point four two'), { zs: '0.42' });
  assert.equal(parseSpeech('R1 plus R2 0.31').r1r2, '0.31');
  assert.equal(parseSpeech('RCD 23 milliseconds').rcdMs, '23');
  assert.equal(parseSpeech('live to earth greater than 999').irLE, '>999');
  assert.equal(parseSpeech('polarity ok').pol, '✓');
  const many = parseSpeech('r1 plus r2 0.35 zs 0.62 rcd 22');
  assert.deepEqual([many.r1r2, many.zs, many.rcdMs], ['0.35', '0.62', '22']);
  assert.equal(parseSpeech('next circuit')._next, true);
});

test('scan: device markings', () => {
  assert.deepEqual(readDevice('B32'), { type: 'B', rating: '32' });
  assert.deepEqual(readDevice('C 16'), { type: 'C', rating: '16' });
  assert.deepEqual(readDevice('32B'), { type: 'B', rating: '32' });
  assert.deepEqual(readDevice('B6'), { type: 'B', rating: '6' });
  assert.deepEqual(readDevice('40A'), { type: '', rating: '40' });
  assert.equal(readDevice('B33'), null); assert.equal(readDevice('Sockets'), null);
});

test('scan: words become circuits left to right, with nearby labels', () => {
  const W = (text, x, y) => ({ text, bbox: { x0: x, y0: y, x1: x + 40, y1: y + 20 } });
  const out = proposeCircuits([W('B6', 300, 100), W('B32', 100, 100), W('B40', 500, 100), W('Lights', 290, 160), W('Sockets', 95, 160), W('Shower', 495, 160)]);
  assert.deepEqual(out.map((c) => [c.num, c.type + c.rating, c.desc]), [['1', 'B32', 'Sockets'], ['2', 'B6', 'Lights'], ['3', 'B40', 'Shower']]);
});
