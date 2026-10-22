// v0.23: the chosen cable's Iz after factors, always shown.
import test from 'node:test';
import assert from 'node:assert/strict';
import { izLine, sizeCable } from '../js/calc.js';
import { sizeCircuit } from '../js/design.js';
import { APP_VERSION } from '../js/config.js';
const sc = (o) => sizeCircuit({ load: '28', unit: 'A', loadType: 'general', length: '20', cable: 'te', method: 'C', ambient: 30, grouped: 1, grouping: 'bunched', ci: 1, ze: 0.35, device: 'mcb', type: 'auto', time: 0.4, phase: 1, ...o });
test('v0.23 version', () => assert.match(APP_VERSION, /^0\.2[3-9]\./));
