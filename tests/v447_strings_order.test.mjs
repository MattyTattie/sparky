// v0.44.7: solar items land in wiring order; DC isolators are parallel strings (MPPTs) off the inverter. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import * as W from '../js/wiring.js';
const mk = (num, desc, extra = {}) => ({ num, desc, device: 'mcb', type: 'B', rating: '32', live: '6.0', cpc: '2.5', points: '1', ...extra });
const lay = (cs, o) => W.layout(W.diagramModel({ type: 'EIC', boards: [{ id: 'b', ref: 'DB1', circuits: cs }] }), o);
const texts = (b) => b.shapes.filter((z) => z.t === 'text').map((z) => z.txt);
test('insertKind: AC iso, inverter, DC iso, PV from the board, whatever order they are added', () => {
  let ks = []; for (const k of ['pvarray', 'dciso', 'hybinv', 'aciso']) ks = W.insertKind(ks, k);
  assert.deepEqual(ks, ['aciso', 'hybinv', 'dciso', 'pvarray']);
  assert.deepEqual(W.insertKind(['pvarray', 'aciso'], 'hybinv'), ['pvarray', 'aciso', 'hybinv'], 'never moves what is placed');
  assert.deepEqual(W.insertKind(['socket', 'hybinv'], 'aciso'), ['socket', 'aciso', 'hybinv']);
  assert.deepEqual(W.insertKind(['hybinv'], 'battery'), ['hybinv', 'battery']);
  assert.deepEqual(W.insertKind(['aciso'], 'fan'), ['aciso', 'fan']);
});
const crossFree = (c) => { const ln = c.shapes.filter((z) => z.t === 'line' && z.w === 1.1); const H = ln.filter((z) => Math.abs(z.y1 - z.y2) < 0.01 && Math.abs(z.x1 - z.x2) > 6), V = ln.filter((z) => Math.abs(z.x1 - z.x2) < 0.01 && Math.abs(z.y1 - z.y2) > 6);
  const inn = (v, a, b) => v > Math.min(a, b) + 0.5 && v < Math.max(a, b) - 0.5; for (const h of H) for (const v of V) assert.ok(!(inn(v.x1, h.x1, h.x2) && inn(h.y1, v.y1, v.y2)), 'crossing'); };
const noOverlap = (c) => { const tz = c.shapes.filter((z) => z.t === 'text' && /^(PV|DC iso|AC iso|Inverter|Battery|MPPT \d)$/.test(z.txt)).map((z) => { const w = W.textW(z.txt, z.size, z.bold); const l = z.anchor === 'middle' ? z.x - w / 2 : z.anchor === 'end' ? z.x - w : z.x; return [l, z.y - z.size * 0.8, l + w, z.y]; });
  for (let i = 0; i < tz.length; i++) for (let j = i + 1; j < tz.length; j++) { const a = tz[i], b = tz[j]; assert.ok(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1], 'labels overlap'); } };
for (const o of [{ W: 380, font: 12, screen: true }, { W: 560, font: 11 }]) for (const n of [2, 3]) test(`${n} strings, each DC iso to its own PV, parallel, battery off the inverter (${o.screen ? 'screen' : 'pdf'})`, () => {
  const c = lay([mk('21', 'Solar PV', { diagram: { items: { aciso: 1, hybinv: 1, dciso: n, pvarray: n, battery: 1 } } })], o).blocks.find((b) => b.kind === 'circuit');
  const t = texts(c); for (let j = 1; j <= n; j++) assert.ok(t.includes('MPPT ' + j)); assert.ok(!t.includes('MPPT ' + (n + 1)));
  assert.equal(t.filter((x) => x === 'DC iso').length, n); assert.equal(t.filter((x) => x === 'PV').length, n);
  const y = (lab) => c.shapes.filter((z) => z.t === 'text' && z.txt === lab).map((z) => Math.round(z.y)); const dy = y('DC iso'), py = y('PV');
  assert.equal(new Set(dy).size, n, 'one DC iso per string row, not in series'); assert.deepEqual([...dy].sort(), [...py].sort(), 'each PV sits on its DC iso row');
  crossFree(c); noOverlap(c);
});
test('unequal counts: 2 DC iso, 3 PV -> extra PV on the last string; 4 DC iso caps at 3 strings', () => {
  const c = lay([mk('21', 'Solar PV', { diagram: { items: { hybinv: 1, dciso: 2, pvarray: 3 } } })], { W: 380, font: 12, screen: true }).blocks.find((b) => b.kind === 'circuit');
  assert.equal(texts(c).filter((x) => x === 'PV').length, 3); crossFree(c); noOverlap(c);
  const c4 = lay([mk('21', 'Solar PV', { diagram: { items: { hybinv: 1, dciso: 4, pvarray: 4 } } })], { W: 380, font: 12, screen: true }).blocks.find((b) => b.kind === 'circuit');
  assert.ok(!texts(c4).includes('MPPT 4'));
});
test('editor: fixed control slots (blank where an arrow cannot go) and a grip for dragging', () => {
  const src = fs.readFileSync(new URL('../js/certui.js', import.meta.url), 'utf8');
  assert.match(src, /onUp \? tinyBtn\('\\u2191'[^)]*\)[^:]*: slot\(\)/); assert.match(src, /onDown \? tinyBtn\('\\u2193'[^)]*\)[^:]*: slot\(\)/);
  assert.match(src, /class: 'idrag'/); assert.match(src, /pointercancel/); assert.doesNotMatch(src.slice(src.indexOf('function itemLine'), src.indexOf('function dragItems')), /draggable/);
});
