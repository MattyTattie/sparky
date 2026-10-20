import { test } from 'node:test'; import assert from 'node:assert'; import { readFileSync } from 'node:fs';
const dark = readFileSync(new URL('../dark.css', import.meta.url), 'utf8');
test('v0.18.1 dark selected chip is filled accent with white text', () => { assert.match(dark, /html\.dark \.chip\.on[^{]*\{[^}]*#4b63ff/); });
test('v0.18.1 sync dot is not darkened by generated rules', () => { assert.doesNotMatch(dark, /\.syncchip i[^{]*\{[^}]*#191d41/); });
