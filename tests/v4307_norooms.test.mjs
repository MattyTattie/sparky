// v0.43.7 (test): socket circuits with no rooms, abbreviated names. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import * as W from '../js/wiring.js';
const mk = (desc, points, extra = {}) => ({ num: '6', desc, device: 'rcbo', type: 'B', rating: '32', live: '2.5', cpc: '1.5', points, rcdIdn: '30', rcdType: 'A', ...extra });
const lay = (cs, Wd) => W.layout(W.diagramModel({ type: 'EIC', boards: [{ id: 'b', ref: 'DB1', circuits: cs }] }), { W: Wd, font: 12, screen: true });
const txt = (L) => L.blocks.flatMap((b) => b.shapes.filter((z) => z.t === 'text').map((z) => z.txt));
const crossings = (L) => { let n = 0; for (const b of L.blocks) { const ls = b.shapes.filter((z) => z.t === 'line' && !z.dash && (z.x1 === z.x2 || z.y1 === z.y2));
  const H = ls.filter((z) => z.y1 === z.y2), V = ls.filter((z) => z.x1 === z.x2 && z.y1 !== z.y2);
  for (const h of H) for (const v of V) { const [a, b2] = [Math.min(h.x1, h.x2), Math.max(h.x1, h.x2)], [c, d] = [Math.min(v.y1, v.y2), Math.max(v.y1, v.y2)];
    if (v.x1 > a + 0.5 && v.x1 < b2 - 0.5 && h.y1 > c + 0.5 && h.y1 < d - 0.5) n++; } } return n; };
test('abbreviated socket names are sockets', () => {
  for (const d of ['Downstairs skts', 'Upstairs skt', 'Kitchen sckts', 'Garage socs', 'Sockets']) assert.equal(W.pointKind({ desc: d }), 'socket', d);
  for (const d of ['Downstairs lights', 'Basket heater', 'Cooker']) assert.notEqual(W.pointKind({ desc: d }), 'socket', d);
});
test('socket rings with no rooms draw every socket with socket symbols, no "+ N more", no crossings', () => {
  for (const Wd of [380, 560, 1100]) { const L = lay([mk('Downstairs skts', '14'), { ...mk('Upstairs skts', '12'), num: '7' }], Wd); const t = txt(L);
    assert.ok(!t.some((x) => /more \(/.test(x)), 'no + N more at ' + Wd); assert.ok(t.some((x) => /14 × sockets/.test(x))); assert.ok(t.includes('Twin socket'));
    assert.equal(crossings(L), 0, String(Wd)); }
});
test('non-socket generic points still cap with + N more', () => {
  const t = txt(lay([mk('Misc points', '14', { rating: '16', live: '1.5' })], 560)); assert.ok(t.some((x) => /\+ 4 more \(14 in total\)/.test(x)));
});
test('room editor picks socket mode from the shared pointKind (so "skts" circuits get socket rooms)', async () => {
  const { readFileSync } = await import('node:fs'); const ui = readFileSync(new URL('../js/certui.js', import.meta.url), 'utf8');
  assert.match(ui, /pointKind\(c\) === 'socket' \? roomsEditor\(c, [^;]*'socket'\)/);
  assert.match(ui, /import \{[^}]*\bpointKind\b[^}]*\} from '\.\/wiring\.js'/);
  assert.equal(W.pointKind({ desc: 'Downstairs skts' }), 'socket');
});
