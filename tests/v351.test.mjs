// v0.35.1: diagram layout — no pill or box may touch or overlap another, on any leg.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../js/dcplan.js';
import { wiringModel, PILL_GAP } from '../js/dcwire.js';

const rects = (m) => [...m.boxes.map((b) => ({ ...b, what: 'box ' + b.t })), ...m.pills.map((p) => ({ x: p.cx - p.w / 2, y: p.y, w: p.w, h: p.h, what: 'pill ' + p.t }))];
function check(m, name) {
  const R = rects(m); let n = 0;
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
    const a = R[i], b = R[j];
    const gx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)), gy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
    // separated horizontally → fine. Otherwise they share a column and need a vertical gap.
    if (gx >= 4) continue;
    const min = a.what.startsWith('pill') || b.what.startsWith('pill') ? PILL_GAP : 4;
    assert.ok(gy >= min - 0.01, `${name}: "${a.what}" and "${b.what}" are ${gy.toFixed(1)} apart (need ${min})`); n++;
  }
  for (const r of R) assert.ok(r.x >= 0 && r.x + r.w <= m.W && r.y + r.h <= m.H, `${name}: ${r.what} off the diagram`);
  return n;
}
const base = { ...D.PLAN_DEFAULTS, volts: '48', chem: 'lifepo4', dod: '90', battAh: '2400', loads: [], invW: '5000' };
const configs = {
  matthew: base,
  van: D.VAN_EXAMPLE,
  vanBig: { ...D.VAN_EXAMPLE, invW: '3000', solarW: '1200', panels: '6', volts: '12' },
  overLimit: { ...D.VAN_EXAMPLE, volts: '12', solarW: '2000', panels: '10', invW: '5000' },
  longNames: { ...D.VAN_EXAMPLE, loads: (D.VAN_EXAMPLE.loads || []).map((l) => ({ ...l, name: 'A very long load name that goes on and on ' + (l.name || '') })) },
};
for (const V of ['12', '24', '48']) configs['max' + V] = { ...D.VAN_EXAMPLE, volts: V, invW: '5000', solarW: '1600', panels: '8' };
for (const [name, o] of Object.entries(configs)) test(`diagram spacing: ${name}`, () => {
  const p = D.planDC(o); const m = wiringModel(p, o); check(m, name);
});
test('inverter leg: three pills, PILL_GAP apart and clear of the busbar and inverter', () => {
  const p = D.planDC(base); const m = wiringModel(p, base);
  const inv = m.boxes.find((b) => b.t === 'Inverter'); const bus = m.boxes.find((b) => b.kind === 'bus');
  const leg = m.pills.filter((q) => q.cx === inv.x + inv.w / 2 && q.y > bus.y && q.y < inv.y).sort((a, b) => a.y - b.y);
  assert.equal(leg.length, 3);
  assert.ok(leg[0].y - (bus.y + bus.h) >= PILL_GAP); assert.ok(inv.y - (leg[2].y + leg[2].h) >= PILL_GAP);
  for (let i = 1; i < 3; i++) assert.ok(leg[i].y - (leg[i - 1].y + leg[i - 1].h) >= PILL_GAP);
});
