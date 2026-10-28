// v0.36.5: FF7-style gauge + Settings preview.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
test('colour cycle, reduced motion, print hidden', () => {
  const css = src('styles.css');
  assert.match(css, /@keyframes lb-cycle/); assert.match(css, /\.limitbar\.full \.lb-track i \{ animation: lb-cycle/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.limitbar/); assert.match(css, /@media print \{ \.limitbar \{ display: none/);
});
test('settings preview + version', () => {
  assert.match(src('js/limitbar.js'), /export function limitDemo/); assert.match(src('js/app.js'), /limitDemo\(\)/);
  assert.match(src('js/config.js'), /APP_VERSION = '0\.36\.5 beta'/); assert.match(src('sw.js'), /'sparky-v0\.36\.5'/);
});
