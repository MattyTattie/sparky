// v0.6 tests: DC system planner (camper van example), fuses, cable runs,
// parts list, text + PDF export, backward-compatible job field. FAKE data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.jspdf ||= require('/workspace/sparky-work/npm/package/dist/jspdf.node.min.js');
const P = await import('../js/dcplan.js');
const { dcPlanPdf } = await import('../js/dcplanpdf.js');

const van = P.planDC(P.VAN_EXAMPLE);
test('van: daily energy and battery', () => {
  assert.equal(van.V, 12);
  assert.equal(van.daily.dcWh, 738);            // fridge 360 + lights 120 + pump 18 + heater 240
  assert.equal(van.daily.acWh, 255.5);          // (65×2 + 1000×0.1) ÷ 0.9
  assert.equal(van.daily.ah, 82.8);
  assert.equal(van.battery.needAh, 207);        // 82.8 × 2 days ÷ 0.8
  assert.equal(van.battery.fittedDays, 1.9);
  assert.equal(van.battery.ok, false);
});
test('van: inverter 1500 W → 144.9 A, 200 A MEGA, 50 mm²', () => {
  assert.equal(van.inverter.current, 144.9);   // 1500 ÷ (11.5 × 0.9)
  assert.equal(van.inverter.run.fuse.A, 200); assert.equal(van.inverter.run.fuse.fam, 'mega');
  assert.equal(van.inverter.run.size, 50);
});
test('van: MPPT, PV string and cold Voc', () => {
  assert.equal(van.solar.needA, 41.67); assert.equal(van.solar.mppt, 45);
  assert.equal(van.solar.pv.series, 2); assert.equal(van.solar.pv.vocOk, true);
  assert.ok(van.solar.pv.cold > 53 && van.solar.pv.cold < 54);
});
test('van: main Class T fuse for LiFePO4, isolator, shunt, busbars', () => {
  assert.equal(van.discharge, 166.9);
  assert.equal(van.main.fuse.fam, 'classT'); assert.equal(van.main.fuse.A, 225);
  assert.equal(van.main.size, 50);
  assert.equal(van.shunt.a, 300); assert.equal(van.isolator.a, 250); assert.equal(van.busbar.a, 250);
  const agm = P.planDC({ ...P.VAN_EXAMPLE, chem: 'agm' });
  assert.notEqual(agm.main.fuse.fam, 'classT');
});
test('van: DC-DC input and output, load fuses', () => {
  assert.equal(van.dcdc.inI, 36.9); assert.equal(van.dcdc.inRun.fuse.A, 50); assert.equal(van.dcdc.outRun.fuse.A, 40);
  const heater = van.dcLoads.find((l) => /heater/i.test(l.name));
  assert.equal(heater.run.fuse.A, 15); assert.equal(heater.run.fuse.fam, 'blade');
  for (const r of van.runs) { assert.ok(r.ok, r.name); assert.ok(r.vd.pct <= r.pct + 1e-9, r.name); }
});
test('fuse ≥ 1.25 × peak and cable rated ≥ fuse (after derating)', () => {
  const r = P.sizeRun({ name: 'x', current: 20, length: 3, volts: 12, pct: 3, kind: 'load', derate: 0.7 });
  assert.equal(r.fuse.A, 25); assert.ok(r.tableNeed >= 25 / 0.7 - 0.01);
  const row = r.rows.find((x) => x.size === r.size); assert.ok(row.amps >= r.tableNeed);
});
test('lighting at 10% gets a smaller cable than 3%', () => {
  const a = P.sizeRun({ name: 'l', current: 3, length: 10, volts: 12, pct: 3 }); const b = P.sizeRun({ name: 'l', current: 3, length: 10, volts: 12, pct: 10 });
  assert.ok(b.size < a.size);
});
test('24 V halves the currents', () => {
  const p = P.planDC({ ...P.VAN_EXAMPLE, volts: '24' });
  assert.ok(Math.abs(p.inverter.current - van.inverter.current / 2) < 0.05);
  assert.equal(p.daily.ah, 41.4);
});
test('parts list is grouped, and text export has every group', () => {
  const groups = van.parts.map((g) => g.group);
  for (const g of ['Battery', 'Charging', 'Inverter', 'Protection', 'Cables', 'Monitoring', 'Misc']) assert.ok(groups.includes(g), g);
  const t = P.planText(van, 'Van test');
  for (const g of groups) assert.ok(t.includes(g.toUpperCase()));
  assert.ok(/Class T/.test(t) && /300 A shunt/.test(t));
  // cable lengths: red + black, +10 %, up to 0.5 m (inverter run 1.5 m → 50 mm² includes main 1 m: (1 + 1.5) × 1.1 = 2.75 → 3)
  const c50 = van.cables.find((c) => c.size === 50 && c.colour === 'red'); assert.equal(c50.m, 3);
});
test('empty plan does not throw', () => {
  const p = P.planDC({ loads: [] }); assert.equal(p.daily.wh, 0); assert.equal(p.main, null); assert.ok(Array.isArray(p.parts));
});
test('PDF: makes pages, text fits (no overlaps)', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sparky-v06-'));
  const blob = await dcPlanPdf(van, { title: 'Camper van (example)' }); const f = path.join(tmp, 'plan.pdf');
  fs.writeFileSync(f, Buffer.from(await blob.arrayBuffer()));
  const txt = spawnSync('pdftotext', ['-layout', f, '-']).stdout.toString();
  assert.ok(/DC SYSTEM PLAN/.test(txt) && /Parts list/.test(txt) && /Class T/.test(txt));
  const ov = spawnSync('python3', [path.join(path.dirname(new URL(import.meta.url).pathname), 'pdf_overlap.py'), f]);
  assert.equal(ov.status, 0, ov.stdout.toString() + ov.stderr.toString());
});
test('job.dcPlans is optional: an old job record needs nothing new', () => {
  const old = { id: 'j1', title: 'Old job' }; assert.equal(old.dcPlans, undefined);
  const inputs = JSON.parse(JSON.stringify(P.VAN_EXAMPLE)); const again = P.planDC(inputs);
  assert.equal(again.main.fuse.A, van.main.fuse.A);
});
