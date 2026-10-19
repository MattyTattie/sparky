// v0.13 tests: label stickers under the breakers (tidy text, match each sticker to its breaker even when the
// sticker row looks narrower than the breaker row in the photo), plus the old label path still works. FAKE data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stickerText, matchStickers, readRow, attachLabels, isLabelWord } from '../js/cuscan.js';
const W = (text, cx, cy = 100, w = 60, h = 30) => ({ text, conf: 85, bbox: { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 } });
test('stickerText: fixes and tidies, keeps "2", drops stray digits and junk', () => {
  assert.equal(stickerText('BEDROOM 2 RADIATOR'), 'Bedroom 2 radiator');
  assert.equal(stickerText('3 KICHEN RADIATOR'), 'Kitchen radiator');
  assert.equal(stickerText('| TONEL RAIL'), 'Towel rail');
  assert.equal(stickerText('BEDROON 3 RADIATOR |'), 'Bedroom 3 radiator');
  assert.equal(stickerText('|| 1 ;'), null);
  assert.equal(stickerText('HOB'), 'Hob');
  assert.ok(isLabelWord('downstairs')); assert.ok(!isLabelWord('xyzq'));
});
test('matchStickers: plain nearest, one sticker per breaker, empties allowed', () => {
  const ways = [100, 200, 300, 400, 500];
  assert.deepEqual(matchStickers(ways, [105, 290, 510], 100, 300), [0, 2, 4]);
  assert.deepEqual(matchStickers(ways, [], 100, 300), []);
});
test('matchStickers: sticker row narrower than breaker row (breakers stand out from the cover)', () => {
  // 15 breakers at pitch 230; stickers on the cover appear scaled by 0.907 about x=1937 (as on a real photo)
  const ways = Array.from({ length: 15 }, (_, i) => 174 + i * 230); const want = [0, 1, 3, 8, 10, 11, 12, 13];
  const st = want.map((i) => 1937 + (ways[i] - 1937) * 0.907 + (i % 2 ? 12 : -9));
  assert.deepEqual(matchStickers(ways, st, 230, 2040), want);
  // nearest-centre alone would have got the first two wrong
  const nearest = st.map((x) => ways.reduce((b, w, i) => (Math.abs(w - x) < Math.abs(ways[b] - x) ? i : b), 0));
  assert.notDeepEqual(nearest, want);
});
test('attachLabels with sticker words: whole sticker goes to one way, typed descs kept', () => {
  const row = readRow(['B6', 'B6', 'B16', 'B16'].flatMap((m, i) => [W(m, 100 + i * 100), W('RTA06' + (m === 'B6' ? '06' : '16') + '30B', 100 + i * 100, 80)]));
  assert.equal(row.ways.length, 4);
  row.ways[3].desc = 'Mine'; row.ways[3].descTyped = true;
  const sw = [{ text: 'UPSTAIRS', cx: 205, sticker: 1, order: 0 }, { text: 'LIGHTS', cx: 205, sticker: 1, order: 1 }, { text: 'HOB', cx: 395, sticker: 2, order: 2 }];
  attachLabels(row.ways, sw, { centre: 250 });
  assert.equal(row.ways[1].desc, 'Upstairs lights'); assert.equal(row.ways[1].labelFrom, 'sticker');
  assert.equal(row.ways[3].desc, 'Mine'); assert.equal(row.ways[0].desc || '', '');
});
import { orderRows, numberBoard } from '../js/cuscan.js';
test('two rows of one board: main-switch row first, left to right by default; SPD MCB not a circuit', () => {
  const ways = (ms, x0 = 100) => ms.map((m, i) => [W(m, x0 + i * 100), W('RTA06' + m.slice(1).padStart(2, '0') + '30B', x0 + i * 100, 80), W('30mA', x0 + i * 100, 140)]).flat();
  const top = { ...readRow(ways(['B6', 'B6', 'B16'])), part: 0 };
  const bot = { ...readRow([...ways(['B16', 'B20', 'B32']), W('B32', 400), W('100A', 520), W('MAIN', 520, 60), W('SWITCH', 520, 80)]), part: 1 };
  assert.equal(bot.ways.length, 3); assert.ok(bot.board.some((o) => o.kind === 'spdmcb' && o.rating === '32'));
  const n = numberBoard([top, bot], { order: 'main', dir: 'ltr' });
  assert.deepEqual(n.map((w) => w.num + w.type + w.rating), ['1B16', '2B20', '3B32', '4B6', '5B6', '6B16']);
  const m = numberBoard([top, bot], { order: 'main', dir: 'main' }); assert.equal(m[0].rating, '32', 'from the main switch end = right to left here');
  assert.equal(orderRows([top, bot], { manual: [0, 1] })[0].row, top);
});
import { settleSpdMcb, toCircuit } from '../js/cuscan.js';
test('SPD MCB only on the main-switch row', () => {
  const a = { part: 0, ways: [{ cx: 100 }], board: [{ kind: 'main', cx: 300, items: [] }, { kind: 'spdmcb', cx: 200, rating: '16' }] };
  const b = { part: 1, ways: [{ cx: 100 }], board: [{ kind: 'main', cx: 300, items: [{ text: 'MAIN' }] }, { kind: 'spdmcb', cx: 200, type: 'B', rating: '32' }] };
  settleSpdMcb([a, b]);
  assert.equal(b.board.filter((o) => o.kind === 'spdmcb').length, 0); assert.equal(a.ways.length, 2); assert.equal(a.ways[1].rating, '16');
  const spd = b.ways[1]; assert.equal(spd.desc, 'SPD'); assert.equal(spd.spd, true);
  const c = toCircuit(spd); assert.equal(c.device, 'mcb'); assert.equal(c.rating, '32'); assert.equal(c.bs, '60898'); assert.equal(c.rcdIdn, 'N/A'); assert.equal(c.rcdBtn, 'N/A');
});
