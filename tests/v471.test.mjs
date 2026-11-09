// v0.47.1: board photo scan: sideways photos, Garo RCCB (DCCB) / isolator / SPD naming.
import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, readRow } from '../js/cuscan.js';
import { scanBoardExtras, mainFromScan } from '../js/boardmain.js';
import { turnRect, turnScore } from '../js/ocr.js';
import { fillBoardRcd } from '../js/ocpdfill.js';
import { readFileSync } from 'node:fs';
const W = (t, x, y = 100, conf = 90) => ({ text: t, conf, bbox: { x0: x - 20, x1: x + 20, y0: y, y1: y + 30 } });
// Matthew's DB2: Garo 100A isolator | Garo DCCB 63A 300mA RCCB | Garo DCB B50 MCB | Garo SPD
const garo = [W('GARO', 100), W('100A', 100, 150), W('ISOLATOR', 100, 200), W('IEC', 80, 250), W('60947-3', 120, 250), W('AC-22A', 100, 290),
  W('GARO', 300), W('DCCB', 300, 140), W('63A', 300, 180), W('300mA', 300, 220), W('IEC/EN', 280, 260), W('61008-1', 320, 260), W('Inc', 280, 300), W('6000A', 320, 300),
  W('GARO', 450), W('DCB', 450, 140), W('B50', 450, 180), W('230V', 450, 220), W('6000', 450, 260),
  W('GARO', 550), W('SPD', 550, 140), W('Uc', 540, 180), W('275V', 560, 180), W('Imax', 540, 220), W('40kA', 560, 220), W('61643-11', 550, 260)];
test('Garo words: DCCB / 61008 = RCCB, 60947 = main switch, 61643 / Imax = SPD, GARO / DCB = breaker face', () => {
  assert.equal(classify(W('DCCB', 0)).kind, 'rccb'); assert.equal(classify(W('RCCB', 0)).kind, 'rccb');
  assert.equal(classify(W('61008-1', 0)).kind, 'rccb'); assert.equal(classify(W('IEC/EN61008-1', 0)).kind, 'rccb');
  assert.equal(classify(W('60947-3', 0)).kind, 'main'); assert.equal(classify(W('61643-11', 0)).kind, 'spd'); assert.equal(classify(W('Imax', 0)).kind, 'spd');
  assert.equal(classify(W('GARO', 0)).kind, 'face'); assert.equal(classify(W('DCB', 0)).kind, 'face');
  assert.equal(classify(W('B50', 0)).rating, '50');
});
test('Garo DB2 row: 100A isolator is the main switch, 63A 300mA RCCB is not a circuit or a main switch, B50 is the one circuit, SPD Type 2', () => {
  const r = readRow(garo);
  assert.deepEqual(r.ways.map((w) => [w.type + w.rating, w.rcbo]), [['B50', false]]);
  const k = Object.fromEntries(r.board.map((o) => [o.kind, o]));
  assert.equal(k.main.rating, '100'); assert.equal(k.main.bs, '60947-3');
  assert.equal(k.rccb.rating, '63'); assert.equal(k.rccb.idn, '300'); assert.match(k.rccb.why, /RCCB 63A 300mA/);
  assert.equal(k.spd.t2, true);
});
test('before v0.47.1 the 63A RCCB was swallowed into the main switch: now kept apart', () => {
  const r = readRow(garo.filter((w) => !/DCCB|61008/.test(w.text))); // no RCCB word read: the mA + 63A still mark it out
  assert.ok(r.board.some((o) => o.kind === 'rccb' && o.rating === '63' && o.idn === '300'));
  assert.equal(r.board.filter((o) => o.kind === 'main').length, 1);
});
test('RCBOs (curve marking + mA) are still circuits, a plain 100A isolator still the main switch', () => {
  const r = readRow([W('B32', 100), W('30mA', 100, 150), W('B16', 200), W('30mA', 200, 150), W('B6', 300), W('30mA', 300, 150), W('100A', 450), W('MAIN', 450, 150), W('SWITCH', 450, 190)]);
  assert.deepEqual(r.ways.map((w) => [w.type + w.rating, w.rcbo, w.idn]), [['B32', true, '30'], ['B16', true, '30'], ['B6', true, '30']]);
  assert.deepEqual(r.board.map((o) => [o.kind, o.rating]), [['main', '100']]);
});
test('scan fills the board RCD from the RCCB (blanks only) and its MCB circuits pick it up; SPD T2 ticked only if none ticked', () => {
  const b = { rcdBs: '', rcdType: '', rcdRating: '', rcdIdn: '', spdT1: false, spdT2: false, spdT3: false, spdNA: false, circuits: [{ num: '1', device: 'mcb', bs: '60898', type: 'B', rating: '50', rcdBs: '', rcdType: '', rcdIdn: '', rcdRating: '' }] };
  const found = readRow(garo).board;
  assert.deepEqual(scanBoardExtras(b, found).sort(), ['rcdBs', 'rcdIdn', 'rcdRating', 'spdT2']);
  assert.equal(b.rcdBs, '61008'); assert.equal(b.rcdRating, '63'); assert.equal(b.rcdIdn, '300'); assert.equal(b.spdT2, true);
  fillBoardRcd(b); assert.equal(b.circuits[0].rcdIdn, '300'); assert.equal(b.circuits[0].rcdBs, '61008');
  const b2 = { rcdIdn: '30', spdT1: true }; assert.deepEqual(scanBoardExtras(b2, found), []); assert.equal(b2.rcdIdn, '30'); assert.equal(b2.spdT2, undefined);
});
test('main switch from the scan: 100A + BS 60947-3 into blank boxes only (DB2+ board.main)', () => {
  const cert = { parts: {}, boards: [{}, { main: {} }] };
  mainFromScan(cert, 1, { rating: '100', bs: '60947-3' }); assert.equal(cert.boards[1].main.msCurrent, '100'); assert.equal(cert.boards[1].main.msBs, '60947-3');
  const c2 = { parts: {}, boards: [{}, { main: { msCurrent: '80', msBs: '60947-3' } }] }; assert.deepEqual(mainFromScan(c2, 1, { rating: '100', bs: '60947-3' }), []);
});
test('turnRect: a box on a sideways photo lands on the same spot of the turned photo', () => {
  const r = { x: 100, y: 200, w: 50, h: 400 }, Wd = 3000, H = 4000;
  assert.deepEqual(turnRect(r, 90, Wd, H), { x: H - 200 - 400, y: 100, w: 400, h: 50 });
  assert.deepEqual(turnRect(r, -90, Wd, H), { x: 200, y: Wd - 100 - 50, w: 400, h: 50 });
});
test('turnScore counts breaker text the scanner understands (sideways reads score ~0)', () => {
  assert.ok(turnScore(garo) >= 8); assert.equal(turnScore([W('OOJ', 0), W('VC6', 1), W('xx', 2)]), 0); assert.equal(turnScore([W('B32', 0, 0, 20)]), 0);
});
test('scan screen: sideways photos turned upright, Turn button, RCCB card, board extras on add; version 0.47.1', () => {
  const sch = readFileSync(new URL('../js/schedule.js', import.meta.url), 'utf8'), ocr = readFileSync(new URL('../js/ocr.js', import.meta.url), 'utf8');
  assert.match(ocr, /uprightPhoto\(p\.bmp/); assert.match(ocr, /turnBitmap\(p\.bmp, deg\)/);
  assert.match(sch, /'Turn \\u21bb'/); assert.match(sch, /Not a circuit: RCCB/); assert.match(sch, /scanBoardExtras\(b, rows\.flatMap/); assert.match(sch, /turned upright to read it/);
  assert.match(readFileSync(new URL('../js/config.js', import.meta.url), 'utf8'), /0\.47\.1 beta/);
  assert.match(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), /sparky-v0\.47\.1/);
});
