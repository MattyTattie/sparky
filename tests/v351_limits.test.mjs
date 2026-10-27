// v0.35.1: over-limit setups (e.g. 12 V + 5000 W inverter) never print null / ? / undefined / NaN
// in the diagram, results text, parts list or PDFs: either the right size or a clear red warning.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as D from '../js/dcplan.js';
import { wiringModel, connections, connectionText } from '../js/dcwire.js';
globalThis.jspdf ||= createRequire(import.meta.url)('/workspace/sparky-work/npm/package/dist/jspdf.node.min.js');
const { dcPlanPdf, dcPartsPdf } = await import('../js/dcplanpdf.js');
const { Kit } = await import('../js/pdfkit.js');

const BAD = /\bnull\b|\bundefined\b|\bNaN\b|\?|\bInfinity\b/;
export const SETUPS = [];
for (const volts of ['12', '24', '48']) for (const invW of [500, 1000, 2000, 3000, 5000, 7500, 10000])
  for (const extra of [{}, { loads: [], solarW: '', dcdcA: '' }, { solarW: '1600', panels: '8', pvLayout: 'parallel', dcdcA: '60', shoreA: '100' }])
    SETUPS.push({ ...D.VAN_EXAMPLE, volts, invW, _have: { invW: true }, ...extra });

export function texts(v) {
  const p = D.planDC(v); const m = wiringModel(p, v); const out = [];
  for (const b of m.boxes) out.push(b.t, ...(b.s || []));
  for (const q of m.pills) out.push(q.t);
  for (const l of m.notes || []) out.push(typeof l === 'string' ? l : l.t || '');
  for (const c of connections(p, v)) out.push(connectionText(c));
  for (const g of D.partsList(p, v)) for (const it of g.items) out.push(it.item, it.why || '');
  out.push(D.planText(p), ...p.warnings, ...p.notes);
  return { p, out: out.filter((s) => typeof s === 'string') };
}
const ok = (s) => !BAD.test(s.replace(/\?\s*$/, '').replace(/https?:\S+/g, ''));

test('no null / ? / NaN in diagram, results text or parts list, 12/24/48 V × 500–10000 W', () => {
  const bad = new Set(); for (const v of SETUPS) { const { out } = texts(v); for (const s of out) if (!ok(s)) bad.add(`${v.volts} V ${v.invW} W: "${s}"`); }
  assert.equal(bad.size, 0, [...bad].slice(0, 40).join('\n'));
});
test('over-limit main run gets a red warning, not a blank size', () => {
  const v = { ...D.VAN_EXAMPLE, volts: '12', invW: '5000', _have: { invW: true } }; const p = D.planDC(v);
  assert.ok(!p.main.fuse); assert.ok(p.warnings.some((w) => /no standard fuse/i.test(w) && /go up a voltage/i.test(w)), p.warnings.join('|'));
  const m = wiringModel(p, v); const fb = m.boxes.find((b) => b.t === 'Main fuse'); assert.ok(fb.bad && /^Over \d+ A/.test(fb.s[0]), JSON.stringify(fb));
  assert.ok(m.boxes.find((b) => b.t === 'Isolator').bad);
  const p48 = D.planDC({ ...v, volts: '48' }); assert.ok(p48.main.fuse && p48.isolator.a, 'a size exists at 48 V');
});
test('PDF text has no null / ? / NaN on over-limit setups', async () => {
  const got = []; const J = Kit.prototype; const orig = J.t;
  J.t = function (t, ...a) { got.push(...[].concat(t)); return orig.call(this, t, ...a); };
  try {
    for (const v of SETUPS.filter((s, i) => i % 3 === 0)) { got.length = 0; const p = D.planDC(v); await dcPlanPdf(p, { inputs: v }); await dcPartsPdf(p, {}); for (const s of got) assert.ok(ok(String(s)), `PDF ${v.volts} V ${v.invW} W: "${s}"`); }
  } finally { J.t = orig; }
});
