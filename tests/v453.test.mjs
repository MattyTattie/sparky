// v0.45.3: the wiring diagram draws each board's main switch inside its board block (no separate box between Meter and DB1). Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
const { diagramModel, diagramSvg, boardMainLine, msDetail } = await import('../js/wiring.js');
const cert = () => ({ type: 'EIC', supply: { earthing: 'TN-C-S (PME)' }, parts: { msBs: '60947-3', msPoles: '2', msCurrent: '100' },
  boards: [{ ref: 'DB1', location: 'Hall', circuits: [{ num: '1', desc: 'Sockets', device: 'rcbo', type: 'B', rating: '32' }] },
    { ref: 'DB2', location: 'Generation CU', supplyKind: 'tails', suppliedFrom: 'Meter tail connector block', main: { msBs: '60947-3', msPoles: '2', msCurrent: '100', msVoltage: '230/400' }, circuits: [{ num: '1', desc: 'Inverter', device: 'mcb', type: 'B', rating: '50' }] },
    { ref: 'DB3', location: 'Loft', supplyKind: 'tails', suppliedFrom: 'Meter tail connector block', circuits: [{ num: '1', desc: 'Lights', device: 'mcb', type: 'B', rating: '6' }] }] });
const texts = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
test('msDetail / boardMainLine', () => {
  assert.equal(msDetail({ msCurrent: '100', msPoles: '2', msBs: 'BS EN 60947-3' }), '100 A, 2-pole, BS EN 60947-3');
  assert.equal(msDetail({}), ''); assert.equal(msDetail(null), '');
  const c = cert();
  assert.deepEqual(boardMainLine(c, 0), { text: 'Main switch: 100 A, 2-pole, BS EN 60947-3', na: false });
  assert.deepEqual(boardMainLine(c, 1), { text: 'Main switch: 100 A, 2-pole, BS EN 60947-3', na: false });
  assert.equal(boardMainLine(c, 2), null);
  c.parts = {}; assert.deepEqual(boardMainLine(c, 0), { text: 'Main switch: not recorded', na: true });
});
test('no separate Main switch box; the line sits inside DB1 and DB2, not DB3 (blank)', () => {
  const t = texts(diagramSvg(cert()));
  assert.ok(!t.includes('Main switch'), 'old chain box title gone');
  const i1 = t.findIndex((s) => s.startsWith('DB1')), i2 = t.findIndex((s) => s.startsWith('DB2')), i3 = t.findIndex((s) => s.startsWith('DB3'));
  assert.equal(t[i1 + 1], 'Main switch: 100 A, 2-pole, BS EN 60947-3');
  assert.equal(t[i2 + 1], 'Main switch: 100 A, 2-pole, BS EN 60947-3');
  assert.ok(!/^Main switch/.test(t[i3 + 1] || ''));
  assert.equal(t.filter((s) => s.startsWith('Main switch:')).length, 2);
  const m = diagramModel(cert()); assert.equal(m.boards[2].main, null); assert.equal(m.boards[0].main.na, false);
});
test('a sub-main board keeps "Main switch: isolator" only when its own main switch is blank', () => {
  const c = cert(); c.boards[2] = { ref: 'DB3', location: 'Garage', suppliedFrom: 'DB1 circuit 1', supplyKind: 'submain', circuits: [{ num: '1', desc: 'Garage', device: 'mcb', type: 'B', rating: '16' }] };
  assert.match(diagramSvg(c), /Main switch: isolator/);
  c.boards[2].main = { msCurrent: '63', msPoles: '2', msBs: '60947-3' }; const s = diagramSvg(c);
  assert.doesNotMatch(s, /Main switch: isolator/); assert.match(s, /Main switch: 63 A, 2-pole, BS EN 60947-3/);
});
test('Minor Works diagram has no main switch line', () => {
  assert.doesNotMatch(diagramSvg({ type: 'MW', mw: { dbRef: 'DB1', circuit: { num: '1', desc: 'Kitchen sockets', device: 'rcbo', type: 'B', rating: '32' } } }), /Main switch/);
});
