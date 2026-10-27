import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { maxZs } from '../js/limits.js';
import * as D from '../js/dcplan.js';
import { wiringModel, wiringSvg } from '../js/dcwire.js';
test('45 A MCB Zs from 230×0.95/Ia', () => {
  const z = (c) => maxZs({ device: 'mcb', type: c, rating: 45 });
  if (maxZs) { assert.equal(z('B'), 0.97); assert.equal(z('C'), 0.49); assert.equal(z('D'), 0.24); }
});
test('kWh = Ah × nominal V / 1000', () => {
  assert.equal(D.kwhOf(200, 'lifepo4', 12), 2.56);
  assert.equal(D.kwhOf(100, 'agm', 12), 1.2);
  assert.equal(D.kwhOf(100, 'lifepo4', 24), 2.56);
  assert.equal(D.ahOfKwh(2.56, 'lifepo4', 12), 200);
});
test('battery typed in kWh', () => {
  const p = D.planDC({ ...D.VAN_EXAMPLE, battAh: '', battKwh: '2.56', chem: 'lifepo4', volts: '12' });
  assert.equal(p.battery.fittedAh, 200); assert.equal(p.battery.kwh, 2.56);
});
test('diagram: kWh, layout, no ellipsis, red when cold Voc over', () => {
  const p = D.planDC({ ...D.VAN_EXAMPLE });
  const svg = wiringSvg(wiringModel(p));
  assert.match(svg, /kWh/); assert.doesNotMatch(svg, /…/);
  const bad = D.planDC({ ...D.VAN_EXAMPLE, panels: '4', pvLayout: 'series' });
  const m = wiringModel(bad);
  assert.ok(m.boxes.some((b) => b.bad)); assert.ok(m.pills.some((q) => q.bad));
});
test('switch CSS has one knob', () => {
  const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /button\.switch::after\s*\{\s*content:\s*none/);
});
test('charge profile follows battery type', () => {
  const a = D.chargeProfile('lifepo4', 12), b = D.chargeProfile('agm', 24);
  assert.ok(a && b); assert.notDeepEqual(a, b);
});
test('no loads: no null / NaN / Infinity anywhere', async () => {
  const { planText } = D;
  for (const v of [{ ...D.PLAN_DEFAULTS, volts: '48', chem: 'lifepo4', battAh: '2400', loads: [] }, { ...D.PLAN_DEFAULTS, loads: [] }, { ...D.VAN_EXAMPLE }, { ...D.VAN_EXAMPLE, loads: [], solarW: '' }]) {
    const p = D.planDC(v);
    const txt = [p.battery.why, JSON.stringify(p.warnings), JSON.stringify(D.partsList ? D.partsList(p) : p.parts), planText ? planText(p) : '', wiringSvg(wiringModel(p))].join(' ');
    assert.doesNotMatch(txt, /\bnull\b|NaN|Infinity|undefined/, txt.match(/.{40}(null|NaN|Infinity|undefined).{20}/)?.[0]);
  }
  const p = D.planDC({ ...D.PLAN_DEFAULTS, volts: '48', battAh: '2400', loads: [] });
  assert.equal(p.battery.noLoads, true); assert.match(p.battery.why, /No loads entered yet/);
});
test('inverter only: rating is not daily use; idle + kWh a day count', () => {
  const base = { ...D.PLAN_DEFAULTS, volts: '48', chem: 'lifepo4', battAh: '2400', loads: [], invW: '5000' };
  let p = D.planDC(base);
  assert.equal(p.daily.invNoUse, true); assert.equal(p.daily.idleW, 40); assert.equal(p.daily.idleWh, 960);
  assert.ok(p.daily.wh < 5000); assert.match(p.battery.why, /Add what the inverter runs/);
  p = D.planDC({ ...base, acKwh: '3.6', invIdle: '30', invHours: '10' });
  // 3600 / 0.9 = 4000 Wh + 30 W × 10 h = 300 Wh → 4300 Wh, 89.6 Ah at 48 V
  assert.equal(p.daily.wh, 4300); assert.equal(p.daily.ah, 89.6); assert.equal(p.daily.invNoUse, false);
  assert.equal(p.battery.fittedDays, Math.round((2400 * 0.8 / 89.6) * 10) / 10);
  assert.doesNotMatch(p.battery.why, /null|NaN|Infinity/);
});
test('v0.35 QA: MPPT "would clip" note only when a smaller size exists', async () => {
  const D = await import('../js/dcplan.js');
  const w = (V) => D.planDC({ ...D.VAN_EXAMPLE, volts: String(V), solarW: '500', panels: '10' }).solar;
  assert.equal(w(12).mppt, 60); assert.match(w(12).why, /A 45 A one would work/);
  assert.equal(w(24).mppt, 30); assert.doesNotMatch(w(24).why, /would work/);
  assert.equal(w(48).mppt, 15); assert.doesNotMatch(w(48).why, /would work/);
});

test('v0.35 QA: MCB presets never show an RCD; RCBO ones do; Size-for-me kWh is the suggested size', async () => {
  const P = await import('../js/presets.js'); const D = await import('../js/dcplan.js');
  assert.equal(P.ownRcd({ device: 'mcb', bs: '60898', rcdIdn: '300' }), false);
  assert.equal(P.ownRcd({ device: 'rcbo', bs: '61009', rcdIdn: '30' }), true);
  assert.equal(P.nameFor({ device: 'mcb', bs: '60898', type: 'B', rating: '50', bka: '6', rcdIdn: '300', rcdType: 'A-S', rcdS: true }), 'B50 MCB · 6 kA');
  const b = D.planDC({ ...D.VAN_EXAMPLE }).battery;
  if (b.suggestAh) assert.equal(b.suggestKwh, Math.round(b.suggestAh * b.nomV / 10) / 100);
});

test('v0.35: MCB preset leaves RCD boxes alone, RCBO preset fills them', async () => {
  const P = await import('../js/presets.js');
  const c = { rcdBs: '61008', rcdType: 'A', rcdIdn: '30', rcdRating: '63', rcdS: false };
  const ch = P.applyPreset(c, { fields: { device: 'mcb', bs: '60898', type: 'B', rating: '32', bka: '6', rcdBs: '', rcdType: '', rcdIdn: '', rcdRating: '', rcdS: false } });
  assert.equal(c.rcdIdn, '30'); assert.equal(c.rcdBs, '61008'); assert.equal(c.rating, '32');
  assert.ok(!ch.some((k) => k.startsWith('rcd')));
  const d = {};
  P.applyPreset(d, { fields: { device: 'rcbo', bs: '61009', type: 'B', rating: '32', bka: '6', rcdBs: '61009', rcdType: 'A', rcdIdn: '30', rcdRating: '32', rcdS: false } });
  assert.equal(d.rcdIdn, '30'); assert.equal(d.rcdType, 'A'); assert.equal(d.rcdBs, '61009');
});
