import { test } from 'node:test'; import assert from 'node:assert'; import { readFileSync } from 'node:fs';
const dark = readFileSync(new URL('../dark.css', import.meta.url), 'utf8');
test('v0.18.2 dark keeps section status dot colours', () => {
  const base = dark.indexOf('html.dark .dot {');
  for (const s of ['ok', 'red', 'amber']) { const i = dark.indexOf(`html.dark .dot.${s} {`); assert.ok(i > base, s); }
  assert.match(dark, /html\.dark \.dot\.ok \{ background: var\(--green\)/);
});
