import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('wiring diagram row on the job page, card gone from the certificate page', () => {
  const a = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8'); const c = readFileSync(new URL('../js/certui.js', import.meta.url), 'utf8');
  assert.match(a, /id = 'jobdiagram'/); assert.match(a, /'Not drawn'/); assert.match(a, /Which wiring diagram\?/);
  assert.ok(a.indexOf("'Saved PDFs'") < a.indexOf('diagramRow(certs)'));
  assert.ok(!/id: 'diagramrow'/.test(c));
});
