// v0.4: adiabatic, sizer, DC, ring check, copy board, reminders.
import test from 'node:test';
import assert from 'node:assert/strict';
import { adiabatic, clearance, sizeCircuit, kFor, cpcAreaFor, designCurrent } from '../js/design.js';
import { coldVoc, dcVoltDrop, pvStringFuse, batteryFuse, pvString, batteryLeads } from '../js/dc.js';
import { ringCheck, checkCircuit, circuitAdiabatic } from '../js/checks.js';
import { copyBoard, copyCircuit, blankCircuit } from '../js/templates.js';
import { blankBoard } from '../js/certmodel.js';
import { afterInterval, suggestFromCerts, nextFor, dueState, dueList, icsFor } from '../js/reminders.js';

test('k values by cable', () => {
  assert.equal(kFor({ cable: 'te' }).k, 115);
  assert.equal(kFor({ cable: 'swa' }).k, 51);
  assert.equal(kFor({ cable: 'swaX' }).k, 46);
  assert.equal(kFor({ cable: 'swa3X', cpcMode: 'core' }).k, 143);
  assert.equal(kFor({ cable: 'singles', separate: true }).k, 143);
  assert.equal(kFor({ cable: 'swa3c' }).k, 115); // circuit-page pick key
  assert.equal(kFor({ cable: 'swa2' }).k, 51);
});
test('adiabatic: B32 at Zs 0.6 needs ~1.05 mm² (0.1 s worst case)', () => {
  const a = adiabatic({ zs: 0.6, device: 'rcbo', type: 'B', rating: 32, k: 115, cpcCsa: 1.5 });
  assert.equal(a.t, 0.1); assert.equal(a.smin, 1.05); assert.equal(a.pass, true);
});
test('adiabatic: capped at class 3 let-through for 6 kA', () => {
  const a = adiabatic({ zs: 0.3, device: 'mcb', type: 'B', rating: 32, k: 115, cpcCsa: 1.5 });
  assert.equal(a.i2t, 45000); assert.equal(a.pass, false);
});
test('adiabatic: Zs over the max cannot clear instantly', () => {
  const a = adiabatic({ zs: 2, device: 'mcb', type: 'B', rating: 32, k: 115, cpcCsa: 1.5 });
  assert.equal(a.ok, false); assert.match(a.error, /too low/);
  const r = adiabatic({ zs: 2, device: 'rcbo', type: 'B', rating: 32, k: 115, cpcCsa: 1.5, rcd: true });
  assert.equal(r.ok, true); assert.equal(r.byRcd, true);
});
test('fuse clearing time between table points, never below 0.1 s', () => {
  const c = clearance({ device: 'bs88-3', type: 'gG', rating: 32, zs: 0.91 }); // right at the 0.4 s limit
  assert.ok(Math.abs(c.t - 0.4) < 0.01, String(c.t));
  const c5 = clearance({ device: 'bs88-3', type: 'gG', rating: 32, zs: 1.6 });
  assert.ok(Math.abs(c5.t - 5) < 0.05, String(c5.t));
  assert.equal(clearance({ device: 'bs88-3', type: 'gG', rating: 32, zs: 0.2 }).t, 0.1);
});
test('armour area for SWA', () => { assert.deepEqual(cpcAreaFor('swa', 4), { cpc: 'armour', area: 21 }); assert.deepEqual(cpcAreaFor('te', 2.5), { cpc: 1.5 }); });

test('sizer: 20 A at 32 m on T&E: 2.5 fails volt drop, so 4 mm²', () => {
  const r = sizeCircuit({ load: 20, unit: 'A', length: 32, cable: 'te', method: 'C' });
  assert.equal(r.inA, 20); assert.equal(r.pick.size, 4);
  assert.match(r.steps.join(' '), /2\.5 fails on volt drop at 32 m .*so 4 mm²/);
});
test('sizer: 9.5 kW shower → 50 A, 10 mm² (6 mm² fails on current)', () => {
  const r = sizeCircuit({ load: 9.5, unit: 'kW', length: 12, cable: 'te', method: 'C', loadType: 'heating' });
  assert.equal(r.ib, 41.3); assert.equal(r.inA, 50); assert.equal(r.pick.size, 10);
  assert.match(r.steps.join(' '), /6 fails on current/);
});
test('sizer: motor suggests Type C', () => {
  const r = sizeCircuit({ load: 2.2, unit: 'kW', pf: 0.8, length: 15, loadType: 'motor' });
  assert.equal(r.curve, 'C'); assert.equal(r.inA, 20); // v0.18.5: 8 × 11.96 A DOL start must stay under 5 × In
});
test('sizer: ring final 2.5 mm² on 32 A', () => {
  const r = sizeCircuit({ load: 26, unit: 'A', length: 60, loadType: 'ring' });
  assert.equal(r.inA, 32); assert.equal(r.pick.size, 2.5); assert.equal(r.pick.cur.needIz, 20);
  assert.equal(r.pick.z.r20, Math.round(((7.41 + 12.1) * 60 / 1000 / 4) * 1000) / 1000);
});
test('sizer: lighting uses 3%', () => { const r = sizeCircuit({ load: 4, unit: 'A', length: 40, loadType: 'lighting', cable: 'te', method: '101' }); assert.equal(r.limit, 3); assert.ok(r.pick); });
test('sizer: thermal insulation pushes the size up', () => {
  const a = sizeCircuit({ load: 32, unit: 'A', length: 5, cable: 'te', method: 'C' });
  const b = sizeCircuit({ load: 32, unit: 'A', length: 5, cable: 'te', method: 'C', ci: 0.5 });
  assert.ok(b.pick.size > a.pick.size);
});
test('sizer: SWA armour CPC gets the adiabatic check', () => {
  const r = sizeCircuit({ load: 32, unit: 'A', length: 30, cable: 'swa', method: 'D', device: 'mcb', type: 'C' });
  assert.ok(r.pick); assert.equal(r.pick.adi.armour, true); assert.equal(r.k.k, 51);
});
test('designCurrent', () => { assert.equal(designCurrent({ load: 7.4, unit: 'kW' }), 32.17); assert.equal(designCurrent({ load: '' }), null); });

test('DC volt drop is two-way at temperature', () => {
  const v = dcVoltDrop({ current: 100, length: 2, csa: 35, temp: 20, volts: 48 });
  assert.equal(v.volts, Math.round(100 * 2 * 2 * 0.017241 / 35 * 100) / 100);
});
test('cold Voc', () => { assert.equal(coldVoc({ n: 10, voc: 49.5, coefPct: -0.27, tmin: -10 }), 541.78); });
test('PV string fuse: 1 string none, 3 strings fused 1.5–2.4 × Isc', () => {
  assert.equal(pvStringFuse({ isc: 13.9, strings: 1 }).needed, false);
  const f = pvStringFuse({ isc: 13.9, strings: 3, maxSeriesFuse: 25 }); assert.equal(f.needed, true); assert.equal(f.fuse, 25);
  assert.equal(pvStringFuse({ isc: 13.9, strings: 3, maxSeriesFuse: 20 }).fuse, null);
});
test('PV string over the inverter max', () => { const r = pvString({ n: 12, voc: 49.5, vmp: 41.6, isc: 13.9, imp: 13.2, invMax: 600, length: 20 }); assert.equal(r.vocOk, false); });
test('battery: 5 kW at 51.2 V → 150 A fuse, 35 mm²', () => {
  assert.deepEqual(batteryFuse({ current: 100 }), { need: 125, fuse: 125 });
  const r = batteryLeads({ volts: 51.2, kw: 5, length: 2, targetPct: 1 }); assert.equal(r.fuse.fuse, 150); assert.equal(r.size.pick.size, 35);
});

test('ring check: good ring passes', () => {
  const c = { ...blankCircuit(1), ring: true, live: '2.5', cpc: '1.5', r1: '0.52', rn: '0.52', r2: '0.86', r1r2: '0.35', device: 'rcbo', type: 'B', rating: '32', zs: '0.6' };
  const r = ringCheck(c, { zdb: '0.24' });
  assert.ok(r.items.filter((i) => i.pass === false).length === 0, JSON.stringify(r.items));
  assert.ok(r.items.some((i) => /about 70 m round/.test(i.text)));
});
test('ring check: broken neutral and spurred socket flagged', () => {
  const c = { ...blankCircuit(1), ring: true, live: '2.5', cpc: '1.5', r1: '0.52', rn: '0.70', r2: '0.86', r1r2: '0.55' };
  const bad = ringCheck(c).items.filter((i) => i.pass === false).map((i) => i.text).join(' | ');
  assert.match(bad, /r1 0.52 Ω and rn 0.7 Ω/); assert.match(bad, /R1\+R2 0.55/);
});
test('circuit adiabatic flag on the CPC', () => {
  const c = { ...blankCircuit(1), cable: 'te', cableSize: '2.5', live: '2.5', cpc: '1.5', device: 'mcb', type: 'B', rating: '20', zs: '0.25' };
  assert.equal(circuitAdiabatic(c).pass, false);
  assert.equal(checkCircuit(c).flags.cpc.level, 'amber');
  c.zs = '0.7'; assert.equal(checkCircuit(c).flags.cpc, undefined);
});

test('copy board: new ids, readings cleared by default', () => {
  const b = blankBoard(1); b.zdb = '0.24'; b.circuits = [Object.assign(blankCircuit(1), { desc: 'Sockets', zs: '0.6', r1r2: '0.3' }), Object.assign(blankCircuit(2), { desc: 'Lights', zs: '1.2' })];
  const n = copyBoard(b, { ref: 'DB2' });
  assert.notEqual(n.id, b.id); assert.equal(n.ref, 'DB2'); assert.equal(n.zdb, '');
  assert.equal(n.circuits.length, 2); assert.equal(n.circuits[0].desc, 'Sockets'); assert.equal(n.circuits[0].zs, '');
  assert.notEqual(n.circuits[0].id, b.circuits[0].id); assert.notEqual(n.circuits[0].id, n.circuits[1].id);
  const k = copyBoard(b, { keepResults: true, keepBoardTests: true }); assert.equal(k.circuits[0].zs, '0.6'); assert.equal(k.zdb, '0.24');
  assert.equal(b.circuits[0].zs, '0.6'); // original untouched
  assert.equal(copyCircuit(b.circuits[0], 3, { keepResults: true }).r1r2, '0.3');
});

test('reminders', () => {
  assert.equal(afterInterval('2026-10-18', '5 years'), '2031-10-18');
  assert.equal(afterInterval('2026-10-18', '6 months'), '2027-04-18');
  const certs = [{ jobId: 'j', type: 'EICR', number: 'EICR-1', createdAt: '2026-10-01', eicr: { nextDate: '2026-12-01' } }];
  assert.equal(suggestFromCerts(certs).date, '2026-12-01');
  assert.equal(nextFor({ nextInspection: '2027-01-02' }, certs).date, '2027-01-02');
  assert.equal(dueState('2026-12-01', new Date('2026-10-18T12:00')).state, 'soon');
  assert.equal(dueState('2026-10-01', new Date('2026-10-18T12:00')).state, 'overdue');
  assert.equal(dueList([{ id: 'j' }, { id: 'k', remindOff: true, nextInspection: '2026-10-20' }], certs, new Date('2026-10-18T12:00')).length, 1);
  const ics = icsFor({ uid: 'j', date: '2026-12-01', title: 'Inspection due', now: new Date('2026-10-18T12:00:00Z') });
  assert.match(ics, /DTSTART;VALUE=DATE:20261201\r\n/); assert.match(ics, /TRIGGER:-P30D/);
});
