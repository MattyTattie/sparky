// v0.47.0: fixes from the 4-board EIC walk-through (fake data only).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkCircuit, limitZs, boardCtx, fmtZs, boardIsTT } from '../js/checks.js';
import { partsForBoard, partsForJob, partsText } from '../js/parts.js';
import { mainSwitchParts, mainSwitchRow, mirrorMainRcd, boardRcdView, liftBoardRcdToMain } from '../js/boardmain.js';
import { TEMPLATES, applyTemplate, blankCircuit, isRingCircuit, autoNA, evMissing, EV_NOTES, GEN_NOTES, addNote, noteDone } from '../js/templates.js';
import { autoFillOcpd, releaseRcboRcd, syncBoardS } from '../js/ocpdfill.js';
import { groupCircuits, diagramModel, isOutbuilding, boardExtraLines, msDetail } from '../js/wiring.js';
import { rcdGroups } from '../js/rcdreuse.js';
import { newCert, normaliseCert, fillPeopleBlanks, sectionsFor, sectionDone } from '../js/certmodel.js';
import { deviceById } from '../js/limits.js';
const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const mcb = (num, o = {}) => ({ num: String(num), desc: 'Lights', device: 'mcb', bs: '60898', type: 'B', rating: '6', bka: '6', ...o });

test('1: a TT board: Table 41.5 for its circuits, RA × IΔn ≤ 50 V, RCD needed; prints and draws', () => {
  const cert = newCert('EIC', {}); cert.supply.earthing = 'TN-C-S (PME)';
  const b = { ref: 'DB4', location: 'Garden office', supplyKind: 'submain', earthing: 'TT', ra: '45', elType: 'Rod', elLocation: 'By the office door', zdb: '45', circuits: [] };
  cert.boards = [{ ref: 'DB1', circuits: [] }, b];
  const ctx = boardCtx(cert, b); assert.equal(ctx.earthing, 'TT'); assert.equal(ctx.ra, '45'); assert.equal(boardIsTT(b), true);
  const c = mcb(1, { device: 'rcbo', bs: '61009', rcdIdn: '30', rcdType: 'A', zs: '45' });
  assert.equal(limitZs(c, ctx).value, 1667); assert.equal(checkCircuit(c, ctx).flags.zs, undefined);
  assert.equal(checkCircuit(c, boardCtx(cert, cert.boards[0])).flags.zs.level, 'red'); // DB1 is still TN-C-S
  const noRcd = mcb(2, { zs: '45', rcdIdn: '' }); assert.equal(checkCircuit(noRcd, ctx).flags.rcdIdn.level, 'amber');
  const hi = { ...c, rcdIdn: '300' }; const ctxHi = { ...ctx, ra: '200' }; assert.equal(checkCircuit(hi, ctxHi).flags.rcdIdn.level, 'red');
  assert.equal(fmtZs(1667), '1667'); assert.equal(fmtZs(1.3667), '1.37');
  assert.match(boardExtraLines(cert, b)[0].text, /^Earthing: TT, RA 45 Ω \(Rod, By the office door\)$/);
  assert.match(src('js/pdf.js'), /'Earthing \(this board\):', 'TT'/);
  // old boards (no earthing field) follow the supply
  assert.equal(boardCtx(cert, { zdb: '0.3' }).earthing, 'TN-C-S (PME)');
});

test('2: two identical RCCBs on a split-load board stay apart with "which RCD" (parts, diagram, reuse RCD times)', () => {
  const r = { rcdBs: '61008', rcdType: 'A', rcdIdn: '30', rcdRating: '63' };
  const b = { ref: 'DB1', circuits: [mcb(1, { ...r, rcdNo: '1' }), mcb(2, { ...r, rcdNo: '1' }), mcb(3, { ...r, rcdNo: '2' }), mcb(4, { ...r, rcdNo: '2' })] };
  const p = partsForBoard(b, { boards: [b], parts: {} }, true, 0);
  const rcds = p.items.filter((i) => i.rcd); assert.equal(rcds.length, 2);
  assert.deepEqual(rcds.map((i) => i.circuits), [['1', '2'], ['3', '4']]);
  assert.match(rcds[0].label, /^RCD 1: /); assert.match(rcds[1].label, /^RCD 2: /);
  assert.equal(partsForJob([{ type: 'EIC', boards: [b], parts: {} }]).totals.find((t) => /^RCD/.test(t.name)).qty, 2);
  assert.equal(groupCircuits(b.circuits, b).filter((x) => x.kind === 'rcd').length, 2);
  assert.equal(rcdGroups(b).length, 2);
  // without the field: one RCD, as before
  const old = { ref: 'DB1', circuits: b.circuits.map(({ rcdNo, ...c }) => c) };
  assert.equal(rcdGroups(old).length, 1);
});

test('3: the parts list counts one RCD once (board RCD = circuit RCD; RCD main switch)', () => {
  const b2 = { ref: 'DB2', rcdBs: '61008', rcdType: 'A S', rcdIdn: '300', rcdRating: '63', circuits: [mcb(1, { desc: 'Inverter AC', rating: '32', rcdBs: '61008', rcdType: 'A', rcdIdn: '300', rcdRating: '63' })] };
  const cert = { type: 'EIC', parts: {}, boards: [{ ref: 'DB1', circuits: [] }, b2] };
  const rc = partsForBoard(b2, cert, false, 1).items.filter((i) => i.rcd);
  assert.equal(rc.length, 1); assert.deepEqual(rc[0].circuits, ['1']); assert.match(rc[0].name, /Type A S/);
  const b4 = { ref: 'DB4', main: { msBs: '61008', msPoles: '2', msCurrent: '63', msIsRcd: true, rcdType: 'A S', rcdIdn: '100', msLocation: 'Office wall' }, circuits: [mcb(1, { rcdBs: '61008', rcdType: 'A S', rcdIdn: '100', rcdRating: '63' })] };
  cert.boards.push(b4); mirrorMainRcd(cert, 2);
  const it = partsForBoard(b4, cert, false, 2).items;
  assert.deepEqual(it.filter((i) => /RCD/.test(i.name)).map((i) => i.name), ['Main switch: 63 A DP RCD 100 mA Type A S (BS EN 61008)']);
  assert.ok(!it.some((i) => /^Main RCD/.test(i.name)));
});

test('4: an RCD main switch: one set of boxes, S chip, prints type / S / IΔn and location; diagram says it', () => {
  const cert = { type: 'EIC', parts: {}, boards: [{ ref: 'DB1', circuits: [] }, { ref: 'DB4', main: { msBs: '61008', msPoles: '2', msCurrent: '63', msIsRcd: true, rcdType: 'A S', rcdIdn: '100', msLocation: 'Office wall' }, circuits: [] }] };
  assert.deepEqual(mirrorMainRcd(cert, 1).sort(), ['rcdBs', 'rcdIdn', 'rcdRating', 'rcdType']);
  assert.equal(cert.boards[1].rcdIdn, '100'); assert.equal(cert.boards[1].rcdType, 'A S');
  const row = mainSwitchRow(cert.boards[1], 'main.'); assert.equal(row[4][1], 'RCD Type A S 100 mA time-delayed · at Office wall');
  assert.match(msDetail(cert.boards[1].main), /RCD 100 mA Type A S/);
  assert.match(src('js/certmodel.js'), /'rcdtype', \{ showIf: isRcd/);
  assert.match(src('js/schedule.js'), /the main switch is this board\\u2019s RCD/);
  // older job: details only in the board's RCD boxes: copied up into the main switch, blanks only
  const o = { type: 'EIC', parts: {}, boards: [{}, { rcdType: 'A', rcdIdn: '100', main: { msIsRcd: true, msBs: '61008' }, circuits: [] }] };
  assert.deepEqual(liftBoardRcdToMain(o, 1), ['rcdType', 'rcdIdn']); assert.equal(boardRcdView(o, 1).rcdIdn, '100');
});

test('5: the ring final template is a ring, with the cable picked', () => {
  const t = TEMPLATES.find((x) => /^Ring final/.test(x.name)); const c = applyTemplate(blankCircuit(1), t);
  assert.equal(c.ring, true); assert.equal(c.desc, 'Ring final: sockets'); assert.equal(c.cable, 'te'); assert.equal(c.cableSize, '2.5');
  assert.equal(isRingCircuit(c), true); assert.equal(autoNA(c, 'r1'), false);
});

test('6: RCBO -> MCB: the RCBO\u2019s RCD details go (board RCD fills them, or blank)', () => {
  const t = TEMPLATES.find((x) => /^Ring final/.test(x.name));
  const board = { rcdBs: '61008', rcdType: 'A', rcdIdn: '30', rcdRating: '63' };
  const c = applyTemplate(blankCircuit(1), t); c.device = 'mcb'; c.bs = '60898'; autoFillOcpd(c, { board });
  assert.equal(c.rcdBs, '61008'); assert.equal(c.rcdRating, '63');
  // an older circuit (no autoF record): released by releaseRcboRcd
  const o = { device: 'rcbo', bs: '61009', type: 'B', rating: '32', rcdBs: '61009', rcdType: 'A', rcdIdn: '30', rcdRating: '32' };
  releaseRcboRcd(o, deviceById('rcbo'), deviceById('mcb')); o.device = 'mcb'; o.bs = '60898'; autoFillOcpd(o, { board: {} });
  assert.equal(o.rcdBs, ''); assert.equal(o.rcdRating, '');
  // typed RCCB details are kept
  const k = { device: 'rcbo', rating: '32', rcdBs: '61008', rcdIdn: '30', rcdRating: '63' }; assert.deepEqual(releaseRcboRcd(k, deviceById('rcbo'), deviceById('mcb')), []);
});

test('7: the board RCD\u2019s S carries down; amber if it differs; S trip window used', () => {
  const b = { rcdBs: '61008', rcdType: 'A S', rcdIdn: '300', rcdRating: '63', circuits: [mcb(1, { rcdBs: '61008', rcdType: 'A', rcdIdn: '300', rcdRating: '63', rcdMs: '200' })] };
  const ctx = boardCtx({ supply: { earthing: 'TN-C-S (PME)' } }, b);
  assert.equal(checkCircuit(b.circuits[0], ctx).flags.rcdType.level, 'amber');
  assert.equal(syncBoardS(b), 1); assert.equal(b.circuits[0].rcdType, 'A S'); assert.equal(b.circuits[0].rcdS, true);
  assert.equal(checkCircuit(b.circuits[0], ctx).flags.rcdType, undefined);
  assert.equal(checkCircuit(b.circuits[0], ctx).flags.rcdMs, undefined); // 200 ms is fine for an S-type (130–500)
  assert.equal(checkCircuit({ ...b.circuits[0], rcdMs: '100' }, ctx).flags.rcdMs.level, 'amber');
});

test('8: chips work like radio buttons (no clear on a second tap)', () => {
  const s = src('js/certui.js');
  assert.match(s, /if \(get\(cert, fd\.k\) === o\) return; upd\(o\);/);
  assert.doesNotMatch(s, /upd\(get\(cert, fd\.k\) === o \? '' : o\)/);
});

test('9: generation: printed on the board, drawn on the diagram, battery prompts', () => {
  const cert = newCert('EIC', {}); cert.otherSources = [{ type: 'PV inverter' }, { type: 'Battery storage' }];
  cert.boards = [{ ref: 'DB1', circuits: [] }, { ref: 'DB2', fedBySource: true, circuits: [mcb(1, { desc: 'Inverter AC' })] }];
  const ex = boardExtraLines(cert, cert.boards[1]); assert.match(ex[0].text, /^Fed by: PV inverter \+ Battery storage \(circuit 1\)/);
  assert.match(src('js/pdf.js'), /'Fed by:'/);
  assert.match(src('js/wiring.js'), /'Source: ' \+ \(model\.sources/);
  const c = { remarks: '' }; addNote(c, GEN_NOTES[0]); assert.match(c.remarks, /570\.6\.2\.2/); addNote(c, GEN_NOTES[0]); assert.equal(c.remarks.match(/570\.6\.2\.2/g).length, 1);
});

test('10: EV charger prompts (722) and the amber check', () => {
  const ev = { num: '1', desc: 'EV charger', device: 'rcbo', bs: '61009', type: 'B', rating: '32', rcdIdn: '30', rcdType: 'A', remarks: '' };
  assert.deepEqual(evMissing(ev, 'TN-C-S (PME)'), ['dc', 'pen']);
  assert.equal(checkCircuit(ev, { earthing: 'TN-C-S (PME)' }).flags.remarks.level, 'amber');
  addNote(ev, EV_NOTES[0]); addNote(ev, EV_NOTES[2]);
  assert.deepEqual(evMissing(ev, 'TN-C-S (PME)'), []); assert.equal(checkCircuit(ev, { earthing: 'TN-C-S (PME)' }).flags.remarks, undefined);
  assert.deepEqual(evMissing({ ...ev, remarks: '', rcdType: 'B' }, 'TT'), []);
});

test('11: Settings filled in later: "Use my details" fills blanks only', () => {
  const c = newCert('EIC', {}); c.people.inspector.name = 'Typed Name';
  const n = fillPeopleBlanks(c, { name: 'Jo Fakesparks', business: 'Fake Electrical Ltd (test)', address1: '1 Test St' });
  assert.ok(n > 0); assert.equal(c.people.designer.name, 'Jo Fakesparks'); assert.equal(c.people.inspector.name, 'Typed Name'); assert.equal(c.people.inspector.for, 'Fake Electrical Ltd (test)');
  assert.equal(fillPeopleBlanks(c, { name: 'Jo Fakesparks', business: 'Fake Electrical Ltd (test)', address1: '1 Test St' }), 0);
});

test('12: parts list: the SPD\u2019s MCB and the meter tail connector block (once)', () => {
  const cert = { type: 'EIC', parts: {}, boards: [{ ref: 'DB1', supplyKind: 'tails', spdT2: true, spdDevice: 'B32 MCB', circuits: [] }, { ref: 'DB2', supplyKind: 'tails', circuits: [] }] };
  const r = partsForJob([cert]);
  assert.ok(r.boards[0].items.some((i) => i.name === 'SPD protective device: B32 MCB'));
  const cb = r.boards[0].items.find((i) => i.name === 'Meter tail connector block'); assert.equal(cb.label, 'Meter tail connector block (feeds DB1, DB2)');
  assert.ok(!r.boards[1].items.some((i) => /connector block/.test(i.name)));
  assert.doesNotMatch(partsText(r), /Henley/i);
});

test('13: the page 1 signature is capped to the signature line', () => {
  assert.match(src('js/pdf.js'), /sig\(k, x, y, w \* 0\.30, s, 'Signature', 5\.4\)/);
  assert.match(src('js/pdf.js'), /getImageProperties/);
});

test('14: own max Zs prints as typed; table figures 2 dp (whole ohms from 100)', () => {
  assert.match(src('js/pdf.js'), /own \? own : \(lim\.value != null \? fmtZs\(lim\.value\)/);
});

test('15: "(outbuilding)" only for a board fed by a sub-main (or TT), not a garage wall on the tails', () => {
  assert.equal(isOutbuilding({ location: 'Garage wall, generation CU', supplyKind: 'tails' }), false);
  assert.equal(isOutbuilding({ location: 'Garage', supplyKind: 'submain' }), true);
  assert.equal(isOutbuilding({ location: 'Garden office', earthing: 'TT' }), true);
  assert.equal(isOutbuilding({ location: 'Kitchen', supplyKind: 'submain' }), false);
});

test('16: a board with no circuits isn\u2019t "complete"', () => {
  const c = newCert('EIC', {}); c.boards = [{ ref: 'DB1', circuits: [{ num: '1', desc: 'Lights', zs: '0.5' }] }, { ref: 'DB2', circuits: [] }];
  assert.equal(sectionDone(c, { special: 'boards' }), false);
  c.boards.pop(); assert.equal(sectionDone(c, { special: 'boards' }), true);
});

test('17: parts wording: "Circuit 8" (one), "Main switch:" every time', () => {
  assert.match(src('js/app.js'), /it\.circuits\.length === 1 \? 'Circuit ' : 'Circuits '/);
  assert.deepEqual(mainSwitchParts({ main: { msBs: '60947-2', msCurrent: '100', msPoles: '2' } }, 'main.'), ['Main switch: 100 A DP (BS EN 60947-2)']);
});

test('18: section letters for this certificate type only', () => {
  const eic = sectionsFor('EIC'); assert.equal(eic.find((s) => s.id === 'supply').form, 'F'); assert.equal(eic.find((s) => s.id === 'parts').form, 'G');
  const eicr = sectionsFor('EICR'); assert.equal(eicr.find((s) => s.id === 'supply').form, 'I'); assert.equal(eicr.find((s) => s.id === 'parts').form, 'J');
});

test('19: DB1 distribution circuit OCPD prints N/A when blank', () => {
  assert.match(src('js/pdf.js'), /naO\(b\.ocpdBs\)/);
});

test('old v0.46.0 jobs: no new fields needed, nothing renamed', () => {
  const c = normaliseCert(JSON.parse(JSON.stringify({ ...newCert('EIC', {}), boards: [{ ref: 'DB1', rcdIdn: '30', circuits: [mcb(1, { rcdIdn: '30' })] }] })));
  assert.equal(boardCtx(c, c.boards[0]).earthing, 'TN-C-S (PME)');
  assert.equal(diagramModel(c).boards.length, 1);
  assert.match(src('js/config.js'), /APP_VERSION = '0\.47\.0 beta'/); assert.match(src('sw.js'), /const CACHE = 'sparky-v0\.47\.0'/);
});
