// v0.35.3: schedule boxes grow to fit their text. FAKE data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { neededWidth, FIT_SLACK } from '../js/fitbox.js';

test('v353: width covers text + padding + border + slack', () => {
  assert.equal(neededWidth(30.2, { padL: 4, padR: 4, bordL: 1, bordR: 1 }), Math.ceil(30.2 + 10 + FIT_SLACK));
});
test('v353: never smaller than the normal box', () => {
  assert.equal(neededWidth(5, { base: 52 }), 52);
});
test('v353: schedule table is wired to auto-fit; no clipping ellipsis', () => {
  const s = readFileSync(new URL('../js/schedule.js', import.meta.url), 'utf8');
  assert.match(s, /autoFitTable\(tbl\)/);
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8') + readFileSync(new URL('../desktop.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /table\.sched[^{]*\{[^}]*text-overflow:\s*ellipsis/);
});
test('v353: version and cache bumped', () => {
  assert.match(readFileSync(new URL('../js/config.js', import.meta.url), 'utf8'), /0\.3(5\.3|[6789]\.\d) beta/);
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /sparky-v0\.3(5\.3|[6789]\.\d)/); assert.match(sw, /js\/fitbox\.js/);
});
