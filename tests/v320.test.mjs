import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { circuitFedBySource, boardFedBySource, bidiTarget, addBidiNote, hasBidiNote, BIDI_NOTE } from '../js/templates.js';
import { AFDD_KEYS, PRESET_KEYS, keyOf } from '../js/presets.js';
const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('v0.32: battery / PV / generator detection', () => {
  assert.ok(circuitFedBySource({ desc: 'Battery / inverter AC' }));
  assert.ok(circuitFedBySource({ desc: 'Solar PV' }));
  assert.ok(!circuitFedBySource({ desc: 'Kitchen sockets' }));
  assert.ok(boardFedBySource({ fedBySource: true, circuits: [] }));
  assert.ok(boardFedBySource({ circuits: [{ desc: 'Generator changeover' }] }));
  assert.ok(!boardFedBySource({ circuits: [{ desc: 'Lights' }] }));
  assert.ok(!boardFedBySource({}));
});
test('v0.32: bidi note goes to the right comments box and never duplicates', () => {
  assert.equal(bidiTarget({ type: 'EIC' }), 'comments');
  assert.equal(bidiTarget({ type: 'EICR' }), 'eicr.general');
  assert.equal(bidiTarget({ type: 'MW' }), 'mw.comments');
  assert.equal(addBidiNote(''), BIDI_NOTE);
  const once = addBidiNote('Existing');
  assert.ok(once.startsWith('Existing\n') && hasBidiNote(once));
  assert.equal(addBidiNote(once), once);
});
test('v0.32: AFDD preset keys are optional and keep old preset keys', () => {
  assert.deepEqual(AFDD_KEYS, ['afddBs', 'afddType', 'afddRating']);
  assert.ok(AFDD_KEYS.every((k) => PRESET_KEYS.includes(k)));
  const f = { bs: '61009', type: 'B', rating: '32' };
  assert.equal(keyOf({ ...f, afddBs: '', afddRating: '' }), keyOf(f));
  assert.notEqual(keyOf({ ...f, afddBs: '62606', afddRating: '32' }), keyOf(f));
});
test('v0.32: screen and PDF wiring', () => {
  const s = src('js/schedule.js');
  for (const k of ['afddBs', 'afddType', 'afddRating', 'fedBySource', 'maxDemand', 'Add note']) assert.ok(s.includes(k), k);
  assert.ok(src('js/certui.js').includes('C3 and FI observations'));
  assert.ok(src('js/pdf.js').includes('Maximum demand (this board)'));
  assert.ok(src('js/pdf.js').includes('C3 and FI OBSERVATION'));
});
