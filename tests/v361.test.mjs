// v0.36.1: a waiting service worker never took over on TWA/Mac, so 0.35.3 users were stuck.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const r = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
test('new worker takes over on install (no waiting forever)', () => {
  assert.match(r('sw.js'), /addEventListener\('install'[^\n]*\.then\(\(\) => self\.skipWaiting\(\)\)/);
});
test('one-off self-heal reload for pages left on 0.35.x or older', () => {
  const s = r('sw.js'); assert.match(s, /clients\.matchAll\(\{ type: 'window' \}\)/); assert.match(s, /c\.navigate\(c\.url\)/);
  const re = /^sparky-v0\.(\d|[12]\d|3[0-5])\./;
  for (const k of ['sparky-v0.35.3', 'sparky-v0.9.1', 'sparky-v0.20.0']) assert.ok(re.test(k), k);
  for (const k of ['sparky-v0.36.0', 'sparky-v0.36.1', 'sparky-v0.40.0']) assert.ok(!re.test(k), k);
  assert.ok(s.includes(re.source.replace(/\\/g, '\\\\').replace(/\\\\/g, '\\')) || s.includes('3[0-5])'));
});
test('every file in the SW list exists (one 404 breaks the install)', () => {
  const m = r('sw.js').match(/FILES\s*=\s*\[([\s\S]*?)\]/); const f = [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]);
  assert.ok(f.length > 50); for (const x of f) assert.ok(fs.existsSync(new URL('../' + x.replace(/^\.\//, ''), import.meta.url)) || x === './', x);
});
test('page no longer reloads by itself after an install; it offers the banner', () => {
  const s = r('js/main.js'); assert.doesNotMatch(s, /updatefound/); assert.match(s, /controllerchange/); assert.match(s, /hadCtl/);
});
