import test from 'node:test'; import assert from 'node:assert'; import { readFileSync } from 'node:fs';
import { spdGroupChanged } from '../js/templates.js';
const blank = () => ({ spdDevice: '', spdT1: false, spdT2: false, spdT3: false, spdNA: false, spdOk: false, spdStatusNA: false });
test('SPD status N/A ticks type N/A and fills blank device', () => {
  const b = blank(); b.spdStatusNA = true;
  assert.deepEqual(spdGroupChanged(b, 'spdStatusNA').sort(), ['spdDevice', 'spdNA']);
  assert.equal(b.spdNA, true); assert.equal(b.spdDevice, 'N/A');
});
test('N/A never overwrites a typed device or user ticks', () => {
  const b = blank(); b.spdDevice = 'B32 MCB'; b.spdT2 = true; b.spdStatusNA = true;
  spdGroupChanged(b, 'spdStatusNA');
  assert.equal(b.spdDevice, 'B32 MCB'); assert.equal(b.spdT2, true); assert.equal(b.spdStatusNA, true);
});
test('typed n/a in device ticks both N/As', () => {
  const b = blank(); b.spdDevice = 'n/a'; spdGroupChanged(b, 'spdDevice');
  assert.equal(b.spdNA, true); assert.equal(b.spdStatusNA, true);
});
test('a real value clears the N/As', () => {
  for (const [k, v] of [['spdT2', true], ['spdOk', true], ['spdDevice', 'B32 MCB']]) {
    const b = blank(); b.spdStatusNA = true; spdGroupChanged(b, 'spdStatusNA');
    b[k] = v; spdGroupChanged(b, k);
    assert.equal(b.spdNA, false); assert.equal(b.spdStatusNA, false);
    assert.equal(b.spdDevice, k === 'spdDevice' ? 'B32 MCB' : '');
  }
});
test('unticking does nothing to the others', () => {
  const b = blank(); b.spdNA = true; b.spdStatusNA = true; b.spdDevice = 'N/A';
  b.spdNA = false; assert.deepEqual(spdGroupChanged(b, 'spdNA'), []);
});
test('version 0.31.2 and tick boxes do not shrink', () => {
  assert.match(readFileSync(new URL('../js/config.js', import.meta.url), 'utf8'), /APP_VERSION = '0\.31\.2/);
  assert.match(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), /sparky-v0\.31\.2/);
  assert.match(readFileSync(new URL('../styles.css', import.meta.url), 'utf8'), /\.check input \{ flex-shrink: 0; \}/);
});
import { SPD_HIDE } from '../js/templates.js';
test('type N/A: N/As the boxes below, untick undoes only its own N/As', () => {
  const b = blank(); b.spdOk = true; b.spdT2 = true; b.spdNA = true; spdGroupChanged(b, 'spdNA');
  assert.equal(b.spdStatusNA, true); assert.equal(b.spdDevice, 'N/A'); assert.equal(b.spdOk, false); assert.equal(b.spdT2, false);
  b.spdNA = false; spdGroupChanged(b, 'spdNA');
  assert.equal(b.spdStatusNA, false); assert.equal(b.spdDevice, ''); assert.equal(b.spdAuto, undefined);
  assert.deepEqual(SPD_HIDE, ['spdDevice', 'spdOk', 'spdStatusNA']);
});
test('untick type N/A keeps hand-set status N/A and typed device', () => {
  const b = blank(); b.spdStatusNA = true; b.spdDevice = 'B32 MCB'; b.spdNA = true; spdGroupChanged(b, 'spdNA');
  b.spdNA = false; spdGroupChanged(b, 'spdNA');
  assert.equal(b.spdStatusNA, true); assert.equal(b.spdDevice, 'B32 MCB');
});
import { spdHidden } from '../js/templates.js';
test('status N/A alone cascades but does not hide; type N/A by hand hides', () => {
  const a = blank(); a.spdStatusNA = true; spdGroupChanged(a, 'spdStatusNA'); assert.equal(a.spdNA, true); assert.equal(spdHidden(a), false);
  const b = blank(); b.spdNA = true; spdGroupChanged(b, 'spdNA'); assert.equal(spdHidden(b), true);
});
