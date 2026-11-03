// v0.44.6: Immersion/Cooker/Shower labels; Hybrid inverter, DC/AC rotary isolators, PV array items. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict'; import * as W from '../js/wiring.js';
const mk = (num, desc, extra = {}) => ({ num, desc, device: 'mcb', type: 'B', rating: '32', live: '6.0', cpc: '2.5', points: '3', ...extra });
const lay = (cs, o = { W: 380, font: 12, screen: true }) => W.layout(W.diagramModel({ type: 'EIC', boards: [{ id: 'b', ref: 'DB1', circuits: cs }] }), o);
const texts = (b) => b.shapes.filter((z) => z.t === 'text').map((z) => z.txt);
const NEW = [['hybinv', 'Hybrid inverter', 'Inverter'], ['dciso', 'DC rotary isolator', 'DC iso'], ['aciso', 'AC rotary isolator', 'AC iso'], ['pvarray', 'PV panels (PV array)', 'PV']];
test('new kinds pickable', () => { for (const [k, n] of NEW) assert.equal(W.ITEM_KINDS[k], n); });
for (const o of [{ W: 380, font: 12, screen: true }, { W: 560, font: 11 }]) {
  test('solar items draw labelled, in key (' + (o.screen ? 'screen' : 'pdf') + ')', () => {
    const L = lay([mk('21', 'Solar PV', { diagram: { items: { pvarray: 1, dciso: 1, hybinv: 1, aciso: 1 } } })], o);
    const t = texts(L.blocks.find((b) => b.kind === 'circuit')); for (const [, , l] of NEW) assert.ok(t.includes(l), l);
    assert.ok(t.includes('DC') && t.includes('AC'));
    const key = texts(L.blocks.find((b) => b.kind === 'legend')).join('|'); for (const [, n] of NEW) assert.ok(key.includes(n), n);
    for (const z of L.blocks.flatMap((b) => b.shapes)) if (z.t === 'text') assert.ok(!String(z.txt).includes('\u2026'), 'no ellipsis');
  });
  test('immersion, cooker, shower labelled (' + (o.screen ? 'screen' : 'pdf') + ')', () => {
    for (const [k, l] of [['immersion', 'Immersion'], ['cooker', 'Cooker'], ['shower', 'Shower']]) {
      const t = texts(lay([mk('11', 'Hot water', { diagram: { items: { [k]: 2 } } })], o).blocks.find((b) => b.kind === 'circuit'));
      assert.ok(t.includes(l), l);
    }
  });
}
test('not guessed from names', () => {
  const t = texts(lay([mk('21', 'Solar PV inverter isolator')]).blocks.find((b) => b.kind === 'circuit'));
  for (const [, , l] of NEW) assert.ok(!t.includes(l), l);
});
test('icons same size, distinct', () => {
  const sz = (k) => W.iconSvg(k).match(/width="(\d+)"/)[1];
  for (const [k] of NEW) assert.equal(sz(k), sz('cooker'));
  assert.notEqual(W.iconSvg('dciso'), W.iconSvg('aciso'));
});
test('room summaries never show 0 counts', () => {
  for (const o of [{ W: 380, font: 12, screen: true }, { W: 560, font: 11 }]) {
    const L = lay([mk('3', 'Ring upstairs', { diagram: { roomList: [{ name: 'Hall', sockets: 0, singles: 1 }, { name: 'Landing', sockets: 0 }, { name: 'Bed', sockets: 2, unsw: 1 }] } })], o);
    const t = texts(L.blocks.find((b) => b.kind === 'circuit'));
    assert.ok(!t.some((x) => /(^|\D)0 (double|single|spur|unswitched|DP|×)/.test(x)), t.join('|'));
    assert.ok(t.some((x) => /^1 single socket( |$)/.test(x)));
  }
});
test('lighting room summaries never show 0 lights', () => {
  const L = lay([mk('5', 'Upstairs lights', { diagram: { roomList: [{ name: 'WC', lights: 0, sw1: 0, wiring: 'jb-switch', fans: 1, fanCtl: 'humidistat' }, { name: 'Landing', lights: 2, sw1: 1 }] } })]);
  const t = texts(L.blocks.find((b) => b.kind === 'circuit'));
  assert.ok(!t.some((x) => /(^|\D)0 lights?/.test(x)), t.join('|')); assert.ok(t.some((x) => /^2 lights/.test(x)));
});
