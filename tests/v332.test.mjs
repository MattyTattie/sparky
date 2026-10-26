import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../js/schedule.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
test('v332: circuit number cell is a button that opens the way', () => {
  assert.match(src, /if \(f\.k === 'num'\) \{[^\n]*openWayButton\(cert, bi, ci, c\)/);
  assert.match(src, /function openWayButton[\s\S]{0,400}type: 'button', class: 'wayopen'[\s\S]{0,400}go\(wayHref\(cert\.id, bi, ci\)\)/);
  assert.match(src, /export function wayHref\(certId, bi, ci\) \{ return `#\/cert\/\$\{certId\}\/b\/\$\{bi\}\/c\/\$\{ci\}`; \}/);
});
test('v332: other boxes stay inputs; Enter-to-next-box ignores buttons', () => {
  assert.match(src, /const i = h\('input', \{ value: c\[f\.k\]/);
  assert.match(src, /t\.tagName === 'INPUT' \|\| t\.tagName === 'SELECT'/);
});
test('v332: table scroll is saved before opening and restored once', () => {
  assert.match(src, /saveTableScroll\(`\$\{cert\.id\}\/\$\{bi\}`/);
  assert.match(src, /restoreTableScroll\(`\$\{cert\.id\}\/\$\{bi\}`, wrap\)/);
  assert.match(src, /TABLE_SCROLL\.delete\(key\)/);
});
test('v332: visible affordance (pointer, underline, chevron, hover)', () => {
  assert.match(css, /button\.wayopen \{[^}]*cursor: pointer/);
  assert.match(css, /button\.wayopen \.wn \{[^}]*text-decoration: underline/);
  assert.match(css, /button\.wayopen:hover/);
  assert.match(src, /class: 'wc', 'aria-hidden': 'true' \}, '›'/);
});
test('v332: version 0.33.2', () => {
  assert.match(readFileSync(new URL('../js/config.js', import.meta.url), 'utf8'), /APP_VERSION = '0\.3[345]\.[02] beta'/);
  assert.match(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), /sparky-v0\.3[345]\.[02]/);
});
