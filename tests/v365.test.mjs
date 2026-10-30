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
  assert.match(src('js/config.js'), /APP_VERSION = '0\.3(6\.5|[78]\.\d) beta'/); assert.match(src('sw.js'), /'sparky-v0\.3(6\.5|[78]\.\d)'/);
});

test('v0.36.5b: FF7-measured 8-colour, 0.267s stepped cycle', () => {
  const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /animation: lb-cycle \.267s steps\(1, end\) infinite/);
  assert.match(css, /87\.5% \{ background-color: #91e5e4; \}/);
});
