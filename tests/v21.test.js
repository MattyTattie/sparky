// v0.21: calculator cards in the order an engineer works a design (checked in the source, card keys in order).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { APP_VERSION } from '../js/config.js';
import { sizeCircuit } from '../js/design.js';
const keys = (file, from, to) => { let s = fs.readFileSync(new URL('../js/' + file, import.meta.url), 'utf8'); const a = from ? s.indexOf(from) : 0; s = s.slice(a, to ? s.indexOf(to, a + 1) : undefined); return [...s.matchAll(/key: '(\w+)' \}\)/g)].map((m) => m[1]); };
test('v0.21 version', () => assert.match(APP_VERSION, /^0\.2[1-9]\./));
test('v0.21 card order per calculator', () => {
  assert.deepEqual(keys('calcsize.js', "route(/^\\/calc\\/size", 'const draw = ()'), ['supply', 'breaker', 'cable', 'earth']);
  assert.deepEqual(keys('calcui.js', "route(/^\\/calc\\/check", 'const draw = ()'), ['supply', 'breaker', 'cable', 'earth']);
  assert.deepEqual(keys('calcui.js', "route(/^\\/calc\\/ring", 'route(/^\\/calc\\/symbols'), ['cable', 'ends', 'cross']);
  assert.deepEqual(keys('calcmore.js', "screen('xfmr'", "screen('contactor'"), ['supply', 'xfmr']);
  assert.deepEqual(keys('calcmore.js', "screen('contactor'", "screen('fault'"), ['load', 'category', 'coil']);
  assert.deepEqual(keys('calcmore.js', "screen('fault'"), ['origin', 'run', 'device']);
  assert.deepEqual(keys('calcdc.js', "route(/^\\/calc\\/dc\\/pv"), ['panels', 'run', 'battery']);
  const plan = fs.readFileSync(new URL('../js/calcdcplan.js', import.meta.url), 'utf8');
  assert.ok(plan.indexOf("icard('Battery'") > plan.indexOf('loads: (p) =>') && plan.indexOf("icard('Battery'") < plan.indexOf('charging: (p) =>'), 'battery card sits after the loads');
});
test('v0.21 Size a cable steps go Ib -> In -> Iz -> VD -> Zs -> adiabatic', () => {
  for (const o of [{ load: '20', unit: 'A', loadType: 'general' }, { load: '20', unit: 'A', loadType: 'ring' }, { load: '90', unit: 'A', loadType: 'general', device: 'mccb', cable: 'swa3X', ze: 0.1, im: '1000' }, { load: '10', unit: 'A', loadType: 'motor', start: 'dol' }]) {
    const r = sizeCircuit({ length: '20', cable: 'te', method: 'C', ambient: 30, grouped: 1, grouping: 'bunched', ci: 1, ze: 0.35, device: 'rcbo', type: 'auto', time: 0.4, phase: 1, ...o });
    assert.equal(r.ok, true); const st = r.steps;
    assert.match(st[0], /^Design current Ib/);
    const at = (re) => st.findIndex((t) => re.test(t));
    const iz = at(/CCC after factors: /), vd = at(/^Volt drop/), zs = at(/^Zs /), ad = at(/^Adiabatic/);
    assert.ok(iz > 0 && iz < vd && vd < zs && zs < ad, st.join(' | '));
    assert.ok(st.slice(1, iz).length >= 1, 'a breaker step sits between Ib and Iz');
  }
});
