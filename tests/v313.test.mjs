import test from 'node:test'; import assert from 'node:assert'; import { readFileSync } from 'node:fs';
import { spdGroupChanged, spdHidden, spdObservation, SPD_HIDE, SPD_OBS_TEXT } from '../js/templates.js';
const blank = () => ({ ref: 'DB1', spdDevice: '', spdT1: false, spdT2: false, spdT3: false, spdNA: false, spdOk: false, spdStatusNA: false });
const tick = (b, k, v = true) => { b[k] = v; return spdGroupChanged(b, k); };
test('type N/A clears T1-T3 and status, fills blank device, hides boxes', () => {
  const b = blank(); b.spdT1 = b.spdT2 = true; b.spdOk = true; tick(b, 'spdNA');
  assert.equal(b.spdT1, false); assert.equal(b.spdT2, false); assert.equal(b.spdOk, false);
  assert.equal(b.spdStatusNA, true); assert.equal(b.spdDevice, 'N/A'); assert.equal(spdHidden(b), true);
  assert.deepEqual(SPD_HIDE, ['spdDevice', 'spdOk', 'spdNotOp']);
});
test('ticking a T clears N/A (the T2 + N/A bug); Ts combine', () => {
  const b = blank(); tick(b, 'spdNA'); tick(b, 'spdT2');
  assert.equal(b.spdNA, false); assert.equal(b.spdStatusNA, false); assert.equal(b.spdDevice, ''); assert.equal(spdHidden(b), false);
  tick(b, 'spdT1'); assert.equal(b.spdT1 && b.spdT2, true);
});
test('old cert with T2 + N/A + status N/A: shown as saved, fixed on the next change', () => {
  const b = { ...blank(), spdT2: true, spdNA: true, spdStatusNA: true };
  assert.equal(b.spdT2 && b.spdNA, true); // untouched until changed
  tick(b, 'spdT2'); assert.equal(b.spdNA, false); assert.equal(b.spdStatusNA, false); assert.equal(b.spdT2, true);
});
test('untick type N/A keeps a typed device', () => {
  const b = blank(); b.spdDevice = 'B32 MCB'; tick(b, 'spdNA'); assert.equal(b.spdDevice, 'B32 MCB');
  tick(b, 'spdNA', false); assert.equal(b.spdDevice, 'B32 MCB'); assert.equal(b.spdStatusNA, false);
});
test('typed N/A device = type N/A; real device clears it', () => {
  const b = blank(); b.spdT2 = true; b.spdDevice = 'n/a'; spdGroupChanged(b, 'spdDevice');
  assert.equal(b.spdNA, true); assert.equal(b.spdT2, false);
  b.spdDevice = 'B32 MCB'; spdGroupChanged(b, 'spdDevice'); assert.equal(b.spdNA, false);
});
test('status confirmed and Not operational are exclusive', () => {
  const b = blank(); tick(b, 'spdOk'); tick(b, 'spdNotOp'); assert.equal(b.spdOk, false);
  tick(b, 'spdOk'); assert.equal(b.spdNotOp, false);
});
test('Not operational adds one C2 observation; untick removes it unless edited', () => {
  const cert = { observations: [] }; const b = blank(); let n = 0; const id = () => 'x' + ++n;
  tick(b, 'spdNotOp'); assert.equal(spdObservation(cert, b, id), 'added'); assert.equal(spdObservation(cert, b, id), null);
  assert.equal(cert.observations.length, 1);
  assert.deepEqual(cert.observations[0], { id: 'x1', item: '4.19', text: SPD_OBS_TEXT, code: 'C2', reg: '651.4', location: 'Board DB1' });
  tick(b, 'spdNotOp', false); assert.equal(spdObservation(cert, b, id), 'removed'); assert.equal(cert.observations.length, 0);
  tick(b, 'spdNotOp'); spdObservation(cert, b, id); cert.observations[0].code = 'C3';
  tick(b, 'spdNotOp', false); spdObservation(cert, b, id); assert.equal(cert.observations.length, 1);
});
test('PDF status N/A tick follows type N/A (old spdStatusNA still prints)', () => {
  assert.match(readFileSync(new URL('../js/pdf.js', import.meta.url), 'utf8'), /\['N\/A', !!\(b\.spdNA \|\| b\.spdStatusNA\)\]\], \{ label: 'SPD:' \}/);
});
test('version 0.33.x and tick boxes do not shrink', () => {
  assert.match(readFileSync(new URL('../js/config.js', import.meta.url), 'utf8'), /APP_VERSION = '0\.3[3-6]\.[0-5]/);
  assert.match(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), /sparky-v0\.3[3-6]\.[0-5]/);
  assert.match(readFileSync(new URL('../styles.css', import.meta.url), 'utf8'), /\.check input \{ flex-shrink: 0; \}/);
});
test('v0.31.4: no auto observation on certs without an observations section', () => {
  const cert = { type: 'EIC', observations: [{ id: 'old', text: 'kept' }] }; const b = { ...blank(), spdNotOp: true };
  assert.equal(spdObservation(cert, b, () => 'n', false), null); assert.deepEqual(cert.observations, [{ id: 'old', text: 'kept' }]);
  b.spdNotOp = false; assert.equal(spdObservation(cert, b, () => 'n', false), null); assert.equal(cert.observations.length, 1);
});
test('v0.31.4: Not operational tick only shown when the cert type has observations', async () => {
  const { sectionsFor } = await import('../js/certmodel.js');
  const has = (t) => sectionsFor(t).some((x) => x.special === 'observations');
  assert.equal(has('EICR'), true); assert.equal(has('EIC'), false); assert.equal(has('MW'), false);
  assert.match(readFileSync(new URL('../js/schedule.js', import.meta.url), 'utf8'), /hasObs \? S\('spdNotOp', 'Not operational', 'check'\) : null/);
});
