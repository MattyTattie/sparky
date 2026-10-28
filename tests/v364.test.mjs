// v0.36.4: Limit bar on the certificate screen (fun, switchable, never on PDFs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const store = {}; globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
const src = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
let L = null; try { L = await import('../js/limitbar.js'); } catch {}

test('percent from sections done', { skip: !L && 'ui.js needs a browser' }, () => {
  assert.equal(L.limitPct(0, 10), 0); assert.equal(L.limitPct(5, 10), 50); assert.equal(L.limitPct(10, 10), 100);
  assert.equal(L.limitPct(12, 10), 100); assert.equal(L.limitPct(3, 0), 0);
});
test('switch: on by default, off sticks', { skip: !L && 'ui.js needs a browser' }, () => {
  assert.equal(L.limitOn(), true); L.setLimitOn(false); assert.equal(L.limitOn(), false); assert.equal(store['sparky.limitbar'], 'off'); L.setLimitOn(true); assert.equal(L.limitOn(), true);
});
test('wired into certificate screen + settings, not PDFs', () => {
  assert.match(src('js/certui.js'), /limitOn\(\) \? limitBar\(done, secs\.length\)/);
  assert.match(src('js/app.js'), /id: 'limiton'/);
  for (const f of ['js/pdf.js', 'js/pdfkit.js', 'js/dcplanpdf.js', 'js/dangerpdf.js', 'js/partspdf.js']) assert.ok(!/limitbar|limitBar/.test(src(f)), f);
});
test('reduced motion, version and cache', () => {
  assert.match(src('styles.css'), /prefers-reduced-motion: reduce\) \{ \.limitbar/);
  assert.match(src('js/config.js'), /APP_VERSION = '0\.36\.[45] beta'/);
  assert.match(src('sw.js'), /'sparky-v0\.36\.[45]'/); assert.match(src('sw.js'), /\.\/js\/limitbar\.js/);
});
