// v0.36.2: DC planner safety fixes (Energy/G99 + shopping reviews). Matthew's 48 V system as the worked case.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import * as D from '../js/dcplan.js';
const base = { volts: '48', chem: 'lifepo4', battKwh: '16.1', bmsA: '200', invW: '10000', invLen: '2', mainLen: '1', loads: [], days: '1' };
const fitted = { ...base, invMaxA: '208', fitFuseA: '300', fitCable: '35', fitPar: '2' };
test('1: design current = min(calculated, inverter max battery current)', () => {
  const a = D.planDC(base), b = D.planDC(fitted);
  assert.equal(a.inverter.current, 241.5); assert.equal(b.inverter.calcCurrent, 241.5); assert.equal(b.inverter.current, 208); assert.ok(b.inverter.capped);
  assert.equal(D.planDC({ ...base, invMaxA: '400' }).inverter.current, 241.5);
  assert.match(b.inverter.why, /max battery current is 208 A/);
});
test('2: BMS warning advises setting the inverter limits, not just a bigger battery', () => {
  const w = D.planDC(fitted).warnings.find((x) => /^BMS/.test(x)); assert.ok(w); assert.match(w, /max charge and discharge current to 200 A or less/); assert.match(w, /battery \/ BMS rated for more/);
});
test('3: DC voltage ratings, checked against the max charge voltage', () => {
  for (const f of Object.values(D.FUSES)) assert.ok(f.dcV > 0 && f.ka > 0, f.label);
  assert.equal(D.maxChargeV('lifepo4', 48), 58.4);
  const p = D.planDC({ ...fitted, fitFuseV: '32', fitIsoV: '48' });
  assert.ok(p.warnings.some((w) => /only DC-rated 32 V, below the battery’s 58.4 V/.test(w)));
  assert.ok(p.warnings.some((w) => /Isolator is only DC-rated 48 V/.test(w)));
  for (const r of p.runs) assert.ok(r.fuse.dcV >= 58.4, r.name + ' fuse DC-rated for 48 V');
  assert.ok(D.planDC({ ...fitted, fitFuseV: '80' }).fit.checks.some((c) => c.ok && /80 V ≥ 58.4 V/.test(c.text)));
});
test('4: no MEGA/ANL main fuse on LFP above ~2 kA fault current', () => {
  const p = D.planDC(base); assert.ok(p.battery.faultKA > 2); assert.ok(['classT', 'nhdc', 'mccb'].includes(p.main.fuse.fam));
  const big = D.planDC({ ...base, volts: '12', battAh: '600', battKwh: '', invW: '3000', invLen: '1' }); // main > 400 A
  assert.ok(big.main.fuse && !['mega', 'anl'].includes(big.main.fuse.fam), big.main.fuse && big.main.fuse.fam);
  assert.match(p.main.why, /not MEGA \/ ANL/);
  const agm = D.planDC({ volts: '12', chem: 'agm', battAh: '100', invW: '1000', invLen: '1', loads: [] }); assert.equal(agm.main.fuse.fam, 'mega');
});
test('5: fitted fuse, isolator and cable: limit <= fuse <= isolator and cable rating', () => {
  const p = D.planDC(fitted); const t = p.fit.checks.map((c) => `${c.ok}|${c.text}`).join('\n');
  assert.match(t, /true\|Fitted 300 A fuse \/ breaker is at least the 200 A/);
  assert.match(t, /false\|Cable 2 × 35 mm² is rated only 299.2 A/); assert.match(t, /e\.g\. 250 A Class T/);
  const iso = D.planDC({ ...fitted, fitIsoA: '250' }); assert.ok(iso.warnings.some((w) => /Isolator 250 A is below the 300 A/.test(w)));
  assert.equal(iso.isolator.a, 300, 'suggestion follows the fitted fuse');
  assert.ok(D.planDC({ ...fitted, fitFuseA: '150' }).warnings.some((w) => /below the 200 A that can flow/.test(w)));
  assert.ok(!D.planDC({ ...fitted, fitFuseA: '250' }).warnings.some((w) => /^Cable/.test(w)), '250 A suits 2 × 35');
});
test('6: parallel conductors, maker minimum, and a 2-per-pole option', () => {
  assert.ok(D.planDC({ ...fitted, makerMin: '95' }).warnings.some((w) => /70 mm² copper\) is under the maker’s 95 mm²/.test(w)));
  assert.ok(D.planDC({ ...fitted, makerMin: '70' }).fit.checks.some((c) => c.ok && /meets the maker/.test(c.text)));
  assert.ok(D.planDC(base).main.par2, 'big single cable also offers 2 per pole');
});
test('7: inverter charge current counts in the C-rate check', () => {
  const w = D.planDC(fitted).warnings.find((x) => /^Charge rate/.test(x)); assert.ok(w); assert.match(w, /inverter charging at 208 A/); assert.match(w, /157 A/);
  assert.ok(!D.planDC({ ...fitted, invChargeA: '150' }).warnings.some((x) => /^Charge rate/.test(x)));
});
test('8: volt drop battery to inverter vs 1-3% and the low-voltage cut-off', () => {
  const p = D.planDC(fitted); assert.ok(p.invDrop && p.invDrop.pct < 1 && p.invDrop.ok);
  const long = D.planDC({ ...fitted, mainLen: '6', invLen: '8', fitCable: '' }); assert.ok(long.invDrop.pct > 0);
  const cut = D.planDC({ ...fitted, invCutV: '45.9' }); assert.ok(cut.warnings.some((w) => /below its 45.9 V low-voltage cut-off/.test(w)));
});
test('9: inverter sizes past 5000 W', () => { assert.ok(D.INVERTER_SIZES.includes(10000) && Math.max(...D.INVERTER_SIZES) >= 12000);
  assert.equal(D.planDC({ volts: '48', loads: [{ name: 'x', ac: true, value: '6000', hours: '1' }] }).inverter.suggest, 8000); });
test('10 + shopping: 70 °C note, isolator line, lugs, battery breaker, reels', () => {
  assert.match(fs.readFileSync(new URL('../js/calcdcplan.js', import.meta.url), 'utf8'), /copper at 70 °C \(fixed/);
  const items = D.planDC(fitted).parts.flatMap((g) => g.items.map((i) => i.item));
  assert.ok(items.some((i) => /^Battery isolator switch, double-pole, DC-rated ≥ 58.4 V/.test(i)));
  assert.ok(items.some((i) => /match your terminals \(M8\/M10 common\)/.test(i)));
  assert.ok(D.planDC({ ...fitted, lugStud: 'M10' }).parts.flatMap((g) => g.items.map((i) => i.item)).some((i) => /mm², M10 stud/.test(i)));
  const br = D.planDC({ ...fitted, battBreaker: '1' }).parts.flatMap((g) => g.items.map((i) => i.item));
  assert.ok(br.some((i) => /breaker supplied with the battery \(300 A\)/.test(i))); assert.ok(!br.some((i) => /main battery fuse/.test(i)));
  assert.ok(D.planDC(fitted).parts.find((g) => g.group === 'Cables').items[0].why.includes('10 m reels'));
});
test('old saved plans (no new keys) still work the same', () => {
  const v = D.planDC(D.VAN_EXAMPLE); assert.equal(v.inverter.run.fuse.fam, 'mega'); assert.equal(v.main.fuse.fam, 'classT'); assert.equal(v.fit.checks.length, 0);
});
test('red banners for unsafe protection', async () => {
  const src = fs.readFileSync(new URL('../js/calcdcplan.js', import.meta.url), 'utf8');
  const re = new RegExp(src.match(/isRed = \(w\) => \/(.+)\/\.test/)[1]);
  const w = D.planDC({ ...fitted, fitFuseV: '32' }).warnings;
  assert.ok(w.filter((x) => re.test(x)).length >= 2); assert.ok(!re.test(w.find((x) => /^BMS/.test(x))));
});
