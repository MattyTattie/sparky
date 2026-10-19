// v0.7 tests: layout rework. The sums must not move: same planDC results with
// and without the new optional fields; connections + wiring model from the plan.
import test from 'node:test';
import assert from 'node:assert/strict';
const P = await import('../js/dcplan.js');
const W = await import('../js/dcwire.js');

test('planDC: blank mpptA (and v0.6 inputs without it) give identical results', () => {
  const v06 = { ...P.VAN_EXAMPLE }; delete v06.mpptA;
  const a = P.planDC(v06), b = P.planDC({ ...P.VAN_EXAMPLE, mpptA: '' }), c = P.planDC({ ...P.VAN_EXAMPLE, _off: { shoreA: '20' }, _have: { battAh: true } });
  for (const x of [b, c]) { assert.deepEqual(x.runs.map((r) => [r.id, r.size, r.fuse && r.fuse.A]), a.runs.map((r) => [r.id, r.size, r.fuse && r.fuse.A])); assert.equal(x.solar.mppt, 45); assert.deepEqual(x.warnings, a.warnings); }
});
test('planDC: "I already have a 30 A MPPT" is used and flagged', () => {
  const p = P.planDC({ ...P.VAN_EXAMPLE, mpptA: '30' });
  assert.equal(p.solar.mppt, 30); assert.equal(p.solar.mpptPick, 45);
  assert.ok(p.warnings.some((w) => /30 A controller is smaller/.test(w)));
});
test('connections: van example, in order, only kit that is there', () => {
  const p = P.planDC(P.VAN_EXAMPLE); const c = W.connections(p, P.VAN_EXAMPLE);
  assert.deepEqual(c.map((x) => x.id), ['main', 'neg', 'inverter', 'pv', 'mppt', 'dcdcIn', 'dcdcOut', 'fusebox', 'load0', 'load1', 'load2', 'load3', 'ac', 'chassis']);
  assert.equal(c[0].size, 50); assert.match(c[0].fuse.text, /225 A Class T/);
  assert.equal(c[2].fuse.text, '200 A MEGA fuse');
  assert.equal(c[3].size, 4);
  assert.equal(c[5].size, 16); assert.match(c[5].fuse.where, /starter battery/);
  const noSolar = W.connections(P.planDC({ ...P.VAN_EXAMPLE, solarW: '', dcdcA: '', shoreA: '20' }), {});
  assert.ok(!noSolar.some((x) => ['pv', 'mppt', 'dcdcIn'].includes(x.id))); assert.ok(noSolar.some((x) => x.id === 'shore'));
  assert.match(W.connectionText(c[0]), /^Battery \+ → Main fuse → Isolator → \+ busbar: 50 mm² red, 1 m/);
});
test('wiring model + SVG: labels from the plan, text escaped', () => {
  const p = P.planDC({ ...P.VAN_EXAMPLE, loads: [...P.VAN_EXAMPLE.loads, { name: '<b>Tap & go</b>', value: '10', unit: 'W', hours: '1', length: '2' }] });
  const m = W.wiringModel(p, P.VAN_EXAMPLE);
  assert.ok(m.pills.some((x) => x.t === '225 A Class T') === false); // main fuse is a box, not a pill
  assert.ok(m.boxes.some((b) => b.t === 'Main fuse' && b.s[0] === '225 A Class T'));
  assert.ok(m.pills.some((x) => x.t === '200 A MEGA'));
  const svg = W.wiringSvg(m); assert.ok(svg.startsWith('<svg')); assert.ok(!svg.includes('<b>')); assert.ok(svg.includes('&lt;b&gt;'));
});
