// v0.43.8 (test): DP switch in the ring, spurring a single socket (switched or unswitched). Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import * as W from '../js/wiring.js';
const mk = (desc, rooms, extra = {}) => ({ num: '4', desc, device: 'rcbo', type: 'B', rating: '32', live: '2.5', cpc: '1.5', points: '8', rcdIdn: '30', rcdType: 'A', diagram: { roomList: rooms }, ...extra });
const lay = (cs, Wd) => W.layout(W.diagramModel({ type: 'EIC', boards: [{ id: 'b', ref: 'DB1', circuits: cs }] }), { W: Wd, font: 12, screen: true });
const txt = (L) => L.blocks.flatMap((b) => b.shapes.filter((z) => z.t === 'text').map((z) => z.txt));
const crossings = (L) => { let n = 0; for (const b of L.blocks) { const ls = b.shapes.filter((z) => z.t === 'line' && !z.dash && (z.x1 === z.x2 || z.y1 === z.y2));
  const H = ls.filter((z) => z.y1 === z.y2), V = ls.filter((z) => z.x1 === z.x2 && z.y1 !== z.y2);
  for (const h of H) for (const v of V) { const [a, b2] = [Math.min(h.x1, h.x2), Math.max(h.x1, h.x2)], [c, d] = [Math.min(v.y1, v.y2), Math.max(v.y1, v.y2)];
    if (v.x1 > a + 0.5 && v.x1 < b2 - 0.5 && h.y1 > c + 0.5 && h.y1 < d - 0.5) n++; } } return n; };
test('DP switches draw inline in ring and radial rooms, both socket types keyed, no crossings', () => {
  for (const desc of ['Ring final kitchen', 'Radial sockets kitchen']) for (const Wd of [380, 560, 1100]) for (const extra of [{}, { spurs: 2 }, { sockets: 12 }]) {
    const L = lay([mk(desc, [{ name: 'Kitchen', sockets: 3, dpsw: 2, ...extra }, { name: 'Utility', sockets: 1, dpsws: 1 }], desc.includes('Radial') ? { rating: '20' } : {})], Wd); const t = txt(L); const j = t.join(' ');
    assert.match(j, /2 DP \+ sockets/); assert.match(j, /1 DP \+ switched socket/);
    assert.match(j, /spurring an unswitched single socket/); assert.match(j, /spurring a switched single socket/);
    assert.ok(!/…/.test(j)); assert.equal(crossings(L), 0, desc + ' ' + Wd + JSON.stringify(extra)); }
});
test('old certs without DP fields load fine and count unchanged', () => {
  const c = mk('Ring kitchen', [{ name: 'Kitchen', sockets: 2 }]); const r = W.socketRoomsOf(c);
  assert.equal(r[0].dpsw, 0); assert.equal(r[0].dpsws, 0); assert.equal(W.roomSocketTotal(c), 2);
  assert.equal(W.roomSocketTotal(mk('Ring kitchen', [{ name: 'Kitchen', sockets: 2, dpsw: 1, dpsws: 1 }])), 4);
  assert.ok(!/DP switch in the ring/.test(txt(lay([c], 412)).join(' ')));
});
