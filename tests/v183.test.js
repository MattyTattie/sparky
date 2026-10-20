import { test } from 'node:test'; import assert from 'node:assert'; import { readFileSync } from 'node:fs';
const dark = readFileSync(new URL('../dark.css', import.meta.url), 'utf8');
test('v0.18.3 every dark rule that sets a gradient on gradient-text keeps background-clip:text', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const clipped = [...css.matchAll(/([^{}]+)\{[^}]*background-clip:\s*text/g)].map(m => m[1].trim());
  assert.ok(clipped.includes('.stat b'));
  for (const sel of clipped) for (const m of dark.matchAll(new RegExp('html\\.dark ' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}', 'g')))
    if (/background/.test(m[1].replace(/background-clip/g, ''))) assert.match(m[1], /background-clip:\s*text/, sel);
});
