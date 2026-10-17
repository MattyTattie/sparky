// Board-scan parser and file rules. Word lists are shaped like what the
// reader really returned on a FuseBox RCBO board (no real customer data).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readMarking, readModel, classify, readRow, splitSlots, mergeRows, toCircuit, fixLabel } from '../js/cuscan.js';
import { serialPerKey, findOldPdf } from '../js/filerules.js';

const W = (text, cx, cy = 100, w = 60, h = 30) => ({ text, conf: 80, bbox: { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 } });

test('markings: B6, B32, C16, "B 32", OCR B-as-8 guesses', () => {
  assert.deepEqual(readMarking('B32'), { type: 'B', rating: '32', how: 'marking' });
  assert.equal(readMarking('B 32').rating, '32');
  assert.deepEqual(readMarking('c16'), { type: 'C', rating: '16', how: 'marking' });
  assert.equal(readMarking('B6').rating, '6');
  for (const [t, r] of [['832', '32'], ['86', '6'], ['520', '20'], ['340', '40']]) { const m = readMarking(t); assert.equal(m.rating, r, t); assert.equal(m.guess, true, t); }
  assert.equal(readMarking('Bis').guess, true, 'letters standing in for digits = only a guess');
});
test('markings: junk is not turned into a confident rating', () => {
  for (const t of ['IB', 'DI', '82', '2B', '100A', 'TEST', 'Ld']) assert.equal(readMarking(t), null, t);
  assert.equal(readMarking('B2').guess, true, 'small ratings are flagged');
});
test('FuseBox RTA model codes give rating, curve, mA (with OCR mix-ups)', () => {
  for (const [t, r] of [['RTA063230B', '32'], ['RTA0632308', '32'], ['RTAD620308', '20'], ['RTA0640308', '40'], ['RTAOB40308', '40'], ['RTA064530B', '45'], ['RTA060630B', '6']]) {
    const m = readModel(t); assert.ok(m, t); assert.equal(m.rating, r, t); assert.equal(m.type, 'B'); assert.equal(m.idn, '30'); assert.equal(m.rcbo, true);
  }
  assert.equal(readModel('RTA069930B'), null);
});
test('classify: 30mA, RCBO, main switch, SPD; lowercase junk ignored', () => {
  assert.equal(classify(W('30mA', 0)).kind, 'ma');
  assert.equal(classify(W('RCBO', 0)).kind, 'rcbo');
  assert.equal(classify(W('MAIN', 0)).kind, 'main');
  assert.equal(classify(W('SPD', 0)).kind, 'spd');
  assert.equal(classify(W('ci', 0)), null);
  assert.equal(classify(W('Ld', 0)), null);
});

// A row like the top row of the test board: RCBOs every ~240 px, one unreadable,
// then a two-module main switch whose "100A" and "MAIN SWITCH" land apart, then junk.
const row = () => [
  W('FuseBox', 150), W('TEST', 150, 60), W('B16', 150, 160), W('30mA', 150, 200),
  W('RTA061630B', 390, 230, 120), W('FuseBox', 390), W('B16', 390, 160),
  W('FuseBox', 630), W('TEST', 630, 60), // unreadable way
  W('RTA0632308', 870, 230, 120), W('B32', 870, 160), W('30mA', 870, 200),
  W('RTA064530B', 1110, 230, 120), W('840', 1110, 160), // model says 45, marking guess says 40
  W('100A', 1330, 160), W('FuseBax', 1330), W('MAIN', 1470, 120), W('SWITCH', 1470, 150),
  W('52', 1700, 160),
];
test('row: ways in order, main switch is not a circuit, unread ways flagged not guessed', () => {
  const { ways, board } = readRow(row());
  assert.deepEqual(ways.map((w) => (w.type || '') + (w.rating || '')), ['B16', 'B16', '', 'B32', 'B45']);
  assert.equal(ways[2].sure, false); assert.match(ways[2].why, /Couldn/);
  assert.equal(ways[3].sure, true); assert.equal(ways[3].rcbo, true);
  assert.equal(ways[4].sure, false, 'model and marking disagree → check');
  const main = board.filter((b) => b.kind === 'main'); assert.equal(main.length, 1, 'the two halves of the main switch are joined'); assert.equal(main[0].rating, '100');
  assert.ok(!ways.some((w) => w.rating === '100'), 'old bug: 100A main switch read as a B100 circuit');
  const other = board.find((b) => b.kind === 'other'); assert.ok(other, 'unreadable device right of the main switch is kept out and flagged'); assert.match(other.why, /SPD|isolator/);
});
test('labels: sideways strip words attach to the nearest way and get spell-fixed', () => {
  const { ways } = readRow(row(), [{ text: 'Donnstatrs', cx: 875, order: 0, conf: 80 }, { text: 'skts', cx: 870, order: 1, conf: 80 }, { text: 'Tads', cx: 640, order: 0, conf: 30 }]);
  assert.equal(ways[3].desc, 'Downstairs skts');
  assert.ok(!ways[2].desc, 'low-confidence junk is not used as a description');
  assert.equal(fixLabel('Towel rall'), 'TOWEL RAIL'); assert.equal(fixLabel('Ji oven'), 'OVEN'); assert.equal(fixLabel('Boost hor'), 'BOOST HOT');
});
test('two rows / several photos merge in order and number on', () => {
  const a = { part: 0, ways: [{ type: 'B', rating: '16' }, { type: 'B', rating: '20' }] }, b = { part: 1, ways: [{ type: 'B', rating: '6' }] };
  assert.deepEqual(mergeRows([a, b], { start: 4 }).map((w) => w.num + w.type + w.rating), ['4B16', '5B20', '6B6']);
});
test('split a row into equal slots for typing', () => {
  const s = splitSlots({ x: 100, y: 50, w: 1500, h: 300 }, 15); assert.equal(s.length, 15); assert.equal(s[14].x + s[14].w, 1600); assert.equal(s[3].h, 300);
});
test('toCircuit: RCBO fields filled, MCB left plain', () => {
  const c = toCircuit({ type: 'B', rating: '32', rcbo: true, idn: '30', ka: '6', brand: 'FuseBox RTA RCBO', desc: 'Hob' });
  assert.equal(c.device, 'rcbo'); assert.equal(c.bs, '61009'); assert.equal(c.rcdIdn, '30'); assert.equal(c.rcdRating, '32'); assert.equal(c.bka, '6');
  const m = toCircuit({ type: 'B', rating: '32', rcbo: false }); assert.equal(m.device, 'mcb'); assert.equal(m.rcdIdn, '');
});
test('backup lock: two quick backups never run at the same time, extra calls share one follow-up', async () => {
  let live = 0, maxLive = 0, runs = 0;
  const run = serialPerKey(async () => { live++; runs++; maxLive = Math.max(maxLive, live); await new Promise((r) => setTimeout(r, 30)); live--; return runs; });
  await Promise.all([run('job1'), run('job1'), run('job1'), run('job2')]);
  assert.equal(maxLive, 2, 'job1 and job2 may overlap, but job1 never with itself'); assert.equal(runs, 3, 'job1 once + one follow-up, job2 once');
  assert.equal(run.isRunning('job1'), false);
  let n = 0; const flaky = serialPerKey(async () => { n++; if (n === 1) throw new Error('offline'); return 'ok'; });
  await assert.rejects(flaky('j')); assert.equal(await flaky('j'), 'ok');
});
test('remade PDFs replace the old record (charts per board, old "pdf" charts too)', () => {
  const files = [{ id: 'a', certId: 'c1', kind: 'pdf', name: 'EIC-1.pdf' }, { id: 'b', certId: 'c1', kind: 'pdf', name: 'EIC-1-chart-DB1.pdf' }, { id: 'c', certId: 'c1', kind: 'chart', name: 'EIC-1-chart-DB2.pdf' }];
  assert.equal(findOldPdf(files, 'c1', 'EIC-1.pdf', 'pdf').id, 'a', 'certificate PDF never matches a chart');
  assert.equal(findOldPdf(files.slice(1), 'c1', 'EIC-1.pdf', 'pdf'), undefined);
  assert.equal(findOldPdf(files, 'c1', 'EIC-1-chart-DB1.pdf', 'chart').id, 'b');
  assert.equal(findOldPdf(files, 'c1', 'EIC-1-chart-DB2.pdf', 'chart').id, 'c');
  assert.equal(findOldPdf(files, 'c1', 'EIC-1-chart-DB3.pdf', 'chart'), undefined);
});
