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
// Made-up EIC: two immersion heaters on contactors whose coils are fed
// from a time clock / relay control circuit (way 9).
export function diagramEICContactors() {
  const c = diagramEIC();
  c.number = 'EIC-DIAG-03';
  const b = c.boards[0];
  b.circuits = b.circuits.filter((x) => x.num !== 8 && x.num !== '8');
  b.circuits.push(
    mcb(8, 'Immersion', RCD2, { desc: 'Immersion heater (top)', points: '1', control: { via: 'contactor+timeclock', controlCircuit: '10' } }),
    mcb(9, 'Immersion', RCD2, { desc: 'Immersion heater (bottom)', points: '1', control: { via: 'contactor+relay', controlCircuit: '10' } }),
    mcb(10, 'Lighting', RCD2, { desc: 'Time clock and relay (control)', points: '1', type: 'B', rating: '6', live: '1.5', cpc: '1.0' }),
  );
  return c;
}
// Made-up EIC showing switches, rooms, the new symbols and a circuit with no points.
export function diagramEICExtras() {
  const c = diagramEICContactors();
  c.number = 'EIC-DIAG-04';
  const b = c.boards[0];
  const by = (n) => b.circuits.find((x) => String(x.num) === String(n));
  by(1).diagram = { rooms: 'Kitchen, Living room, Hall' };
  by(2).diagram = { rooms: 'Kitchen, Hall, Stairs', sw1: '2', sw2: '1', swi: '1' };
  by(6).diagram = { rooms: 'Bedrooms 1 to 3, Landing' };
  by(5).points = '';
  b.circuits.push(
    Object.assign(applyTemplate(blankCircuit(11), T('Radial')), { device: 'rcbo', bs: '61009', rcdIdn: '30', rcdType: 'A', desc: 'EV charger (driveway)', points: '1', type: 'B', rating: '32', live: '6.0', cpc: '6.0' }),
    Object.assign(applyTemplate(blankCircuit(12), T('Lighting')), { device: 'rcbo', bs: '61009', rcdIdn: '30', rcdType: 'A', desc: 'Bathroom extract fan', points: '2', type: 'B', rating: '6', diagram: { rooms: 'Bathroom, En-suite' } }),
    Object.assign(applyTemplate(blankCircuit(13), T('Radial')), { device: 'rcbo', bs: '61009', rcdIdn: '30', rcdType: 'A', desc: 'Fused spur (FCU) boiler', points: '1', type: 'B', rating: '16' }),
  );
  return c;
}
// v0.39 (test): made-up lighting circuit with rooms, each drawn in its own box.
export function diagramEICRooms() {
  const c = diagramEIC();
  c.number = 'EIC-DIAG-05';
  const b = c.boards[0];
  const l = b.circuits.find((x) => String(x.num) === '2');
  l.points = '8';
  l.diagram = { roomList: [
    { name: 'Kitchen', lights: 4, sw1: 1, sw2pairs: 0, swi: 0, wiring: 'loop-in' },
    { name: 'Hall / Stairs / Landing', lights: 3, sw1: 0, sw2pairs: 1, swi: 1, wiring: 'loop-in' },
    { name: 'Bathroom (pull cord)', lights: 1, sw1: 1, sw2pairs: 0, swi: 0, wiring: 'junction box' },
  ] };
  return c;
}
// v0.41 (test): made-up EIC for the 'pro' diagram: a garage sub-board fed from
// DB1 circuit 11, a loft board with no 'Supplied from', readings out of limits,
// a circuit with no points and the contactor pair from above.
export function diagramEICPro() {
  const c = diagramEICContactors();
  c.number = 'EIC-DIAG-06';
  const b = c.boards[0];
  const by = (n) => b.circuits.find((x) => String(x.num) === String(n));
  for (const x of b.circuits) { x.wiring = x.wiring || 'A'; x.zs = '0.45'; x.r1r2 = '0.24'; x.irLL = '>200'; x.irLE = '>200'; x.pol = '\u2713'; }
  by(1).zs = '2.10'; // over the 1.37 Ω max for a B32
  by(5).irLE = '0.5'; by(5).irLL = '>200';
  by(1).rcdMs = '450';
  by(3).points = '';
  by(2).points = '6';
  by(2).diagram = { roomList: [
    { name: 'Kitchen', lights: 4, sw1: 1, sw2pairs: 0, swi: 0, wiring: 'jb-switch' },
    { name: 'Hall', lights: 2, sw1: 0, sw2pairs: 1, swi: 0, wiring: 'jb-switch' },
  ] };
  b.circuits.push(mcb(11, 'Radial 32', RCD2, { desc: 'Garage sub-main', points: '1', live: '6', cpc: '2.5', wiring: 'G' }));
  const g = blankBoard(2); Object.assign(g, { ref: 'DB2', location: 'Garage', suppliedFrom: 'DB1 circuit 11' });
  g.circuits = [mcb(1, 'Ring final', RCD1, { desc: 'Garage sockets', points: '4', wiring: 'B' }), mcb(2, 'Lighting', RCD1, { desc: 'Garage lights', points: '2', wiring: 'B' })];
  const l = blankBoard(3); Object.assign(l, { ref: 'DB3', location: 'Loft', suppliedFrom: '' });
  l.circuits = [mcb(1, 'Lighting', RCD1, { desc: 'Loft lights', points: '2', wiring: 'A' })];
  c.boards.push(g, l);
  return c;
}
// v0.42 (test): made-up EIC for per-switch lights, level 2-way rows and the
// IEC contactor: an en-suite with 2 lights on 2 x 1-way, a 2-way hall, a 2-way
// + intermediate landing, hot water / boost through contactors on a time clock.
export function diagramEICSwitches() {
  const c = diagramEICContactors();
  c.number = 'EIC-DIAG-07';
  const b = c.boards[0];
  const l = b.circuits.find((x) => String(x.num) === '2');
  l.points = '8';
  l.diagram = { roomList: [
    { name: 'En-suite', lights: 2, sw1: 2, sw2pairs: 0, swi: 0, wiring: 'jb-switch' },
    { name: 'Hall', lights: 2, sw1: 0, sw2pairs: 1, swi: 0, wiring: 'loop-in' },
    { name: 'Landing', lights: 3, sw1: 0, sw2pairs: 1, swi: 1, wiring: 'jb-switch' },
    { name: 'Bedroom', lights: 1, sw1: 1, sw2pairs: 0, swi: 0, wiring: 'junction box' },
  ] };
  const h8 = b.circuits.find((x) => String(x.num) === '8'); h8.desc = 'Hot water';
  const h9 = b.circuits.find((x) => String(x.num) === '9'); h9.desc = 'Boost hot water'; h9.control = { via: 'contactor' };
  return c;
}
