import test from 'node:test'; import assert from 'node:assert/strict';
import { pointKind } from '../js/wiring.js';
test('common UK fixed loads guess a fixed appliance', () => {
  for (const d of ['Dishwasher', 'Washing machine', 'Tumble dryer', 'Solar PV', 'Battery inverter', 'Gate motor', 'Heat pump', 'Intruder alarm', 'Boiler', 'Underfloor heating']) assert.equal(pointKind({ desc: d }), 'appliance', d);
  assert.equal(pointKind({ desc: 'Smoke alarms' }), 'alarm'); assert.equal(pointKind({ desc: 'Fused spur (FCU) boiler' }), 'fcu'); assert.equal(pointKind({ desc: 'Garage lights' }), 'light');
});
