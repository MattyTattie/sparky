// v0.38: made-up sample data for the wiring diagram (tests and screenshots).
// Fake people and places only — never real customer data.
import { newCert, blankBoard } from '../js/certmodel.js';
import { blankCircuit, applyTemplate, TEMPLATES, makeSpare } from '../js/templates.js';
const T = (name) => TEMPLATES.find((t) => t.name.startsWith(name));
const job = { id: 'job-diagram', siteAddress: '7 Pretend Lane, Nowhereville', sitePostcode: 'ZZ0 0ZZ' };
const customer = { name: 'Sample Customer (fake)' };
const RCD1 = { rcdBs: '61008', rcdType: 'A', rcdIdn: '30', rcdRating: '63' };
const RCD2 = { rcdBs: '61008', rcdType: 'A', rcdIdn: '30', rcdRating: '80' };
// a split-load board: MCBs on two 30 mA RCDs (no RCBOs)
const mcb = (n, tname, rcd, extra) => Object.assign(applyTemplate(blankCircuit(n), T(tname)), { device: 'mcb', bs: '60898' }, rcd, extra);
export function diagramEIC() {
  const c = newCert('EIC', { job, customer, number: 'EIC-DIAG-01' });
  Object.assign(c.supply, { earthing: 'TN-C-S (PME)', ze: '0.21', ipf: '1.8', spBs: 'BS 88-3', spType: 'gG', spRating: '100' });
  Object.assign(c.parts, { msCurrent: '100', msPoles: '2', msBs: '60947-3' });
  const b = blankBoard(1); Object.assign(b, { location: 'Hall cupboard' });
  b.circuits = [
    mcb(1, 'Ring final', RCD1, { desc: 'Sockets ground floor', points: '14' }),
    mcb(2, 'Lighting', RCD1, { desc: 'Lights ground floor', points: '9' }),
    mcb(3, 'Cooker', RCD1, { desc: 'Cooker', points: '1' }),
    mcb(4, 'Smoke', RCD1, { desc: 'Smoke and heat alarms', points: '5' }),
    mcb(5, 'Ring final', RCD2, { desc: 'Sockets first floor', points: '11' }),
    mcb(6, 'Lighting', RCD2, { desc: 'Lights first floor', points: '7' }),
    mcb(7, 'Electric shower', RCD2, { desc: 'Electric shower', points: '1' }),
    mcb(8, 'Immersion', RCD2, { desc: 'Immersion heater', points: '1', live: '' }),
  ];
  c.boards = [b];
  return c;
}
export function diagramMW() {
  const c = newCert('MW', { job, customer, number: 'MW-DIAG-01' });
  Object.assign(c.mw, { description: 'Added two double sockets to the kitchen ring', earthing: 'TN-C-S (PME)', zdb: '0.24', dbRef: 'DB1', dbLocation: 'Hall cupboard, 10-way RCBO board' });
  c.mw.circuit = Object.assign(applyTemplate(blankCircuit(4), T('Ring final')), { desc: 'Kitchen sockets (ring)', points: '8' });
  return c;
}
// Made-up minor works: one new socket spurred off an existing kitchen ring.
export function diagramMWSpur() {
  const c = diagramMW();
  c.number = 'MW-DIAG-02';
  c.mw.description = 'Spur added to the kitchen ring for a new double socket';
  c.mw.circuit.points = '8';
  c.mw.spur = { on: true, count: '1', feeds: 'socket' };
  return c;
}
