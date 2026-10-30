import test from 'node:test';
import assert from 'node:assert/strict';
import { CABLES, CABLE_TEMP, ARMOUR_MOHM_PER_M, ARMOUR_CSA } from '../js/cables.js';
import { APP_VERSION } from '../js/config.js';

test('v0.19.1 checked figures: H07RN-F 4F1A/4F3A, flex 60 °C, armour, 3-phase columns', () => {
  assert.match(APP_VERSION, /^0\.(19\.1|2\d|[34]\d)/);
  assert.equal(CABLES.h07.typical, undefined); assert.equal(CABLES.flex.typical, undefined);
  assert.ok(CABLES.tri.typical && CABLES.sycy.typical);
  assert.deepEqual([4, 25, 95].map((s) => CABLES.h07.methods.C.amps[s]), [30, 97, 192]);
  assert.deepEqual([2.5, 4, 25].map((s) => CABLES.h073.methods.C.amps[s]), [20, 26, 83]);
  assert.equal(CABLES.h073.mvam[95], 0.44); assert.equal(CABLE_TEMP.flex, 60);
  assert.deepEqual([ARMOUR_MOHM_PER_M[2][50], ARMOUR_MOHM_PER_M[3][70], ARMOUR_MOHM_PER_M[4][95]], [2.3, 1.8, 1.1]);
  assert.deepEqual([ARMOUR_CSA[2][95], ARMOUR_CSA[3][95], ARMOUR_CSA[4][70]], [113, 128, 131]);
  assert.equal(CABLES.singles3.mvam[50], 0.85);
  assert.equal(CABLES.tri3.methods.panel.amps[2.5], 28); assert.equal(CABLES.sycy3.methods.C.amps[4], 25);
});
