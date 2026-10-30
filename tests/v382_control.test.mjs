import test from 'node:test';
import assert from 'node:assert/strict';
import { diagramModel, diagramSvg, controlInfo, controlLinks, layout } from '../js/wiring.js';
import { diagramEIC, diagramEICContactors } from './diagram-sample.mjs';

test('no control field: old certs draw as before', () => {
  const svg = diagramSvg(diagramEIC());
  assert.ok(!svg.includes('contactor') && !svg.includes('>KM<') && !svg.includes('3 2"')); // switch rows use a 2 2 dash
  assert.equal(controlInfo({}), null);
  assert.equal(controlInfo({ control: { via: 'none' } }), null);
  assert.equal(controlInfo({ control: { via: 'rubbish' } }), null);
});
test('control notes and tags', () => {
  assert.equal(controlInfo({ control: { via: 'contactor+timeclock' } }).note, 'via contactor, time clock controlled');
  assert.equal(controlInfo({ control: { via: 'contactor+relay' } }).note, 'via contactor, relay controlled');
  assert.equal(controlInfo({ control: { via: 'contactor' } }).tag, 'KM');
  assert.equal(controlInfo({ control: { via: 'timeclock' } }).tag, 'TC');
});
test('links: control circuit knows which contactors it switches', () => {
  const c = diagramEICContactors();
  assert.deepEqual(controlLinks(c.boards[0].circuits), { 10: ['8', '9'] });
  const svg = diagramSvg(c);
  assert.ok(svg.includes('Switches contactor on circuits 8, 9'));
  assert.ok(svg.includes('Coil switched by circuit 10'));
  assert.ok(svg.includes('via contactor, time clock controlled'));
  assert.ok(/>KM1</.test(svg));
  assert.ok(svg.includes('stroke-dasharray'));
});
test('coil not set prints N/A in light grey', () => {
  const c = diagramEICContactors(); c.boards[0].circuits[7].control.controlCircuit = '';
  const svg = diagramSvg(c);
  assert.ok(svg.includes('fill="rgb(170,170,170)" text-anchor="start">Coil supply: N/A'));
});
test('contactor makes the circuit block taller; JSON round-trip keeps it', () => {
  const c = diagramEICContactors();
  const off = JSON.parse(JSON.stringify(c)); for (const x of off.boards[0].circuits) delete x.control;
  assert.ok(layout(diagramModel(c)).height > layout(diagramModel(off)).height);
  assert.deepEqual(JSON.parse(JSON.stringify(c)).boards[0].circuits[7].control, { via: 'contactor+timeclock', controlCircuit: '10' });
});
test('narrow width: long notes wrap in full, no ellipsis', () => {
  const svg = diagramSvg(diagramEICContactors(), { W: 260, font: 12 });
  assert.ok(!svg.includes('\u2026'));
  assert.ok(svg.includes('controlled'));
});
