// v0.27: wide-screen layout. The desktop styles only apply at 900px+, and ship offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_VERSION } from '../js/config.js';
const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
test('v0.27 version', () => assert.match(APP_VERSION, /^0\.(2[7-9]|[3-9]\d)\.\d+/));
test('desktop.css is loaded and cached offline', () => {
  assert.match(read('index.html'), /href="desktop\.css"/);
  assert.match(read('sw.js'), /"\.\/desktop\.css"/);
  assert.match(read('build-sw.sh'), /desktop\.css/);
});
test('desktop rules only apply on wide screens (phone layout unchanged)', () => {
  const css = read('desktop.css').replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0, outside = '';
  for (let i = 0; i < css.length; i++) { const ch = css[i]; if (ch === '{') depth++; if (depth === 0) outside += ch; if (ch === '}') depth--; }
  const tops = outside.split(/[{}]/).map((s) => s.trim()).filter(Boolean);
  for (const t of tops) assert.ok(/^@media \((min-width: 900px|max-width: 899px)/.test(t), 'unscoped rule: ' + t);
  assert.ok(!/text-overflow:\s*ellipsis/.test(css));
});
