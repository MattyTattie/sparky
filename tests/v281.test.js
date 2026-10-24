// v0.28.1: cooker control unit socket is a tick box in the Cooking box (+5 A after diversity).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_VERSION } from '../js/config.js';
import { maxDemand, kindBoxes, ccuSockets, setCcuSocket, migrateCcu } from '../js/maxdemand.js';
const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const C = [{ k: 'cooking', qty: 1, value: 7, name: 'Hob' }, { k: 'cooking', qty: 1, value: 3 }];
test('version 0.28.1', () => { assert.match(APP_VERSION, /^0\.28\.1/); assert.match(read('sw.js'), /sparky-v0\.28\.1/); });
test('tick adds 5 A after diversity, shown in the cooking box', () => {
  const off = maxDemand(C).total; const L = setCcuSocket(C, true);
  assert.equal(ccuSockets(L), 1); assert.equal(Math.round((maxDemand(L).total - off) * 10) / 10, 5);
  const b = kindBoxes(L); assert.equal(b.length, 1); assert.equal(b[0].k, 'cooking'); assert.equal(b[0].ccu, 1);
  assert.match(b[0].work, /\+ 5 A CCU socket/);
  assert.deepEqual(setCcuSocket(L, false), C); assert.equal(kindBoxes(C)[0].ccu, 0);
});
test('ticking twice does not double up', () => assert.equal(ccuSockets(setCcuSocket(setCcuSocket(C, true), true)), 1));
test('old data with separate socket lines migrates, same total, no separate box', () => {
  const old = [{ k: 'cookerSocket', qty: 1 }, ...C, { k: 'cookerSocket', qty: 1 }];
  const m = migrateCcu(old); assert.equal(m.filter((l) => l.k === 'cookerSocket').length, 1);
  assert.equal(maxDemand(m).total, maxDemand(old).total);
  assert.ok(!kindBoxes(m).some((b) => b.k === 'cookerSocket'));
  const only = kindBoxes([{ k: 'cookerSocket', qty: 1 }]); assert.equal(only[0].k, 'cooking'); assert.equal(only[0].ccu, 1);
  assert.deepEqual(migrateCcu(C), C); assert.deepEqual(migrateCcu(undefined), []);
});
test('no separate add chip; tick box text in full', () => {
  const s = read('js/calcmd.js'); assert.match(s, /d\.k !== 'cookerSocket'/); assert.match(s, /CCU has a socket \(\+5 A\)/);
  assert.ok(!/text-overflow:\s*ellipsis/.test(read('styles.css').split('v0.28.1')[1]));
});
