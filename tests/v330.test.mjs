import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { migrateIntake, INTAKE_SUBS, EICR_ITEMS } from '../js/inspections.js';
const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('v330: old 1.1 value copied to all six intake sub-rows', () => {
  const c = { type: 'EICR', inspections: { '1.1': 'C3', '1.2': 'ok' } };
  migrateIntake(c);
  assert.equal(c.inspections['1.1'], undefined);
  for (const [k] of INTAKE_SUBS) assert.equal(c.inspections[k], 'C3');
  assert.equal(c.inspections['1.2'], 'ok');
});
test('v330: migrate is a no-op when sub keys exist, and for non-EICR', () => {
  const c = { type: 'EICR', inspections: { '1.1': 'C3', '1.1a': 'ok' } };
  migrateIntake(c); assert.equal(c.inspections['1.1a'], 'ok'); assert.equal(c.inspections['1.1b'], undefined);
  const e = { type: 'EIC', inspections: { '1.1': 'ok' } };
  migrateIntake(e); assert.equal(e.inspections['1.1'], 'ok');
});
test('v330: six intake sub-rows and 7.1/8.1 wording', () => {
  assert.equal(INTAKE_SUBS.length, 6);
  const t = (k) => EICR_ITEMS.find((r) => r[0] === k)?.[1] || '';
  assert.match(t('7.1'), /attach to the report/); assert.match(t('8.1'), /attach to the report/);
});
test('v330: PDF labels and A4 wording present', () => {
  const p = src('js/pdf.js');
  for (const s of ["'Report No.'", "'Certificate/Report No.'", 'RA/ZA', 'Attach protective device settings', 'continue on additional page(s) if necessary', 'Adding to an existing installation', 'For ${what} of the installation:', "liab('INSPECTION AND TESTING')"])
    assert.ok(p.includes(s), s);
  assert.ok(src('js/certmodel.js').includes('rcdKa'));
  assert.ok(src('js/certmodel.js').includes('lightning protection system'));
  assert.ok(src('js/guidance.js').includes('bold('));
});
