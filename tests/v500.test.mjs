// v0.50.0: Audit 2 fixes and ideas (19 Nov 2026). Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.jspdf ||= require('./jspdf-node.cjs');
const { newCert } = await import('../js/certmodel.js');
const { outOfWayOrder, noWayNumber } = await import('../js/templates.js');
const { settleBoardRcds } = await import('../js/boardrcd.js');
const { checkCircuit, boardCtx, cableCheck, feedOf, upstreamRcd } = await import('../js/checks.js');
const { checkCert } = await import('../js/certcheck.js');
const { partsForBoard, partsForJob } = await import('../js/parts.js');
const { parseFeed } = await import('../js/feed.js');
const { parseWays, rcdForWay, rcdCoverText } = await import('../js/rcdways.js');
const { obsSuggestion, hasObsFor } = await import('../js/obsfrom.js');
const { ocpdShort } = await import('../js/limits.js');
const { layout, diagramModel, feedInfo, boardExtraLines, cableLabel } = await import('../js/wiring.js');
const { certificatePdf } = await import('../js/pdf.js');
const { parseBackup, planRestore } = await import('../js/backup.js');
const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const mcb = (n, x = {}) => ({ num: String(n), desc: 'Circuit ' + n + ' (FAKE)', device: 'mcb', bs: '60898', type: 'B', rating: '16', live: '2.5', cpc: '1.5', wiring: 'A', ref: 'C', zs: '0.5', irLL: '>200', irLE: '>200', pol: '✓', ...x });

// ---------- Faults ----------
test('BS 3036 rewirable: In ≤ 0.725 × Iz on the schedule (433.1.202), same as the calculator', () => {
  const c = mcb(12, { device: 'bs3036', bs: '3036', type: '', rating: '20' });
  const r = cableCheck(c); assert.equal(r.level, 'red'); assert.equal(r.reg, '433.1.202'); assert.match(r.msg, /0\.725/);
  assert.equal(cableCheck(mcb(1, { device: 'bs3036', bs: '3036', type: '', rating: '15' })).level !== 'red', true);
  assert.equal(checkCircuit(c, {}).flags.live.level, 'red'); assert.equal(checkCircuit(c, {}).flags.live.reg, '433.1.202');
  assert.equal(ocpdShort(c, true), '20 A'); assert.equal(ocpdShort(mcb(1, { rating: '32' }), true), 'B32 A'); assert.equal(cableLabel(c), '2.5/1.5mm\u00b2 T&E \u00b7 20 A');
});
test('ring final on 2.5 mm² method 103: the ring rule (Iz ≥ 20 A, 433.1.204)', () => {
  const c = mcb(3, { desc: 'Ring sockets (FAKE)', rating: '32', live: '2.5', ref: '103' });
  const r = cableCheck(c); assert.equal(r.level, 'red'); assert.equal(r.reg, '433.1.204'); assert.match(r.msg, /ring final/i); assert.match(r.msg, /20 A/);
});
test('Supplied from: one reader for checks, diagram and board page ("DB1/9", "DB 1 - 9", "Circuit 9 of DB1")', () => {
  const B = [{ ref: 'DB1', circuits: [mcb(9, { device: 'rcbo', bs: '61009', rcdIdn: '30' })] }, { ref: 'DB2', circuits: [] }];
  for (const s of ['DB1 circuit 9', 'DB1/9', 'DB1 - 9', 'DB1 – 9', 'DB 1 way 9', 'Circuit 9 of DB1', 'db1 c9', 'DB1: 9']) { const f = parseFeed(s, B, 1); assert.ok(f, s); assert.equal(f.bi, 0, s); assert.equal(f.circuitNum, '9', s); }
  assert.equal(parseFeed('DB 1', B, 1).circuitNum, ''); assert.equal(parseFeed('Main CU', B, 1), null); assert.equal(parseFeed('DB2', B, 1), null, 'never its own feed');
  const cert = { boards: B, supply: { earthing: 'TT' } }; B[1].suppliedFrom = 'DB1/9'; B[1].upRcd = true;
  assert.equal(feedOf(cert, B[1]).circuit.num, '9'); assert.equal(upstreamRcd(cert, B[1]).rcdIdn, '30'); assert.equal(feedInfo(B, 1).state, 'ok');
  assert.doesNotMatch(read('js/wiring.js'), /\(\?:way\|circuit\|cct\|ckt\|c\)\\s\*\(\?:no/); // the old duplicate regex is gone
  assert.match(read('js/schedule.js'), /Which board and circuit feed it/);
});
test('missing way number: its own item, not "( comes before 3)"', () => {
  const cs = [mcb('', { desc: 'Unnumbered (FAKE)' }), mcb(3), mcb(1)];
  assert.deepEqual(outOfWayOrder(cs), { before: '3', after: '1' }); assert.equal(outOfWayOrder([mcb(''), mcb(1), mcb(2)]), null);
  assert.deepEqual(noWayNumber(cs), [{ ci: 0, desc: 'Unnumbered (FAKE)' }]);
  const cert = newCert('EIC', {}); cert.boards = [{ ref: 'DB1', circuits: cs }];
  const miss = checkCert(cert).groups.find((g) => g.id === 'missing'); assert.ok(miss.items.some((i) => /DB1: a circuit has no way number/.test(i.text)));
});

// ---------- Split-load / dual RCD ----------
const splitCert = () => { const r = { rcdBs: '61008', rcdType: 'A', rcdIdn: '30', rcdRating: '63' };
  const c = newCert('EIC', {}); c.supply.earthing = 'TN-C-S (PME)';
  c.boards = [{ ref: 'DB1', ...r, rcdWays: '1-3', rcd2: { ...r, ways: '4-5' }, circuits: [mcb(1), mcb(2), mcb(4), mcb(5), mcb(6, { desc: 'Smoke alarms (non-RCD side, FAKE)' }), mcb(7, { device: 'rcbo', bs: '61009', rating: '32' })] }]; return c; };
test('RCD covers ways: the right RCD on each way, N/A on the non-RCD side, rcdNo 1/2; typed boxes never changed', () => {
  assert.equal(parseWays('1-6, 9')('9'), true); assert.equal(parseWays('1 to 4')('3'), true); assert.equal(parseWays('x'), null);
  const c = splitCert(); const b = c.boards[0]; b.circuits[1].rcdIdn = '100'; b.circuits[1].autoF = {}; // way 2 typed by hand
  settleBoardRcds(c); const by = (n) => b.circuits.find((x) => x.num === String(n));
  assert.equal(by(1).rcdIdn, '30'); assert.equal(by(1).rcdNo, '1'); assert.equal(by(2).rcdIdn, '100');
  assert.equal(by(4).rcdNo, '2'); assert.equal(by(6).rcdIdn, 'N/A'); assert.equal(by(6).rcdBs, 'N/A'); assert.equal(by(7).rcdBs, '61009');
  assert.equal(settleBoardRcds(c), 0, 'idempotent');
  assert.equal(rcdForWay(b, '6').which, 'none'); assert.match(rcdCoverText(b), /RCD 1 covers ways 1-3; RCD 2 covers ways 4-5/);
  // remove the split: way 6 goes back to the board RCD (it was auto)
  delete b.rcdWays; delete b.rcd2; settleBoardRcds(c); assert.equal(by(6).rcdIdn, '30'); assert.equal(by(1).rcdNo ?? '', '');
});
test('RCD covers ways: verdicts (TT), parts list (RCD 1 / RCD 2), PDF and diagram', async () => {
  const c = splitCert(); c.supply.earthing = 'TT'; settleBoardRcds(c); const b = c.boards[0];
  const ctx = boardCtx(c, b); const z = (n) => { const x = b.circuits.find((q) => q.num === String(n)); x.zs = '50'; return checkCircuit(x, ctx).flags.zs; };
  assert.equal(z(1), undefined); assert.equal(z(4), undefined); assert.equal(z(6).level, 'red', 'no RCD on way 6, so Table 41.3');
  const p = partsForBoard(b, c, true, 0); const rcds = p.items.filter((i) => i.rcd).map((i) => (i.label || i.name) + ' | ' + i.circuits.join(','));
  assert.deepEqual(rcds, ['RCD 1: 63 A 30 mA Type A (BS EN 61008) | 1,2', 'RCD 2: 63 A 30 mA Type A (BS EN 61008) | 4,5']);
  assert.ok(boardExtraLines(c, b).some((l) => /RCD 2 covers ways 4-5/.test(l.text)));
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'v500-')), 'c.pdf'); fs.writeFileSync(f, Buffer.from(await (await certificatePdf(c)).arrayBuffer()));
  const txt = spawnSync('pdftotext', ['-layout', f, '-']).stdout.toString();
  assert.match(txt, /RCD 2:/); assert.match(txt.replace(/\s+/g, ' '), /RCD ways: RCD 1 covers ways 1-3; RCD 2 covers ways 4-5; no RCD on way 6/, txt.split('\n').filter((l) => /RCD ways/.test(l)).join('|'));
});

// ---------- Continuity ----------
test('one item for one cause: TT "needs an RCD" isn\'t repeated when the red Zs says it', () => {
  const c = newCert('EIC', {}); c.supply.earthing = 'TT'; c.boards = [{ ref: 'DB4', circuits: [mcb(1, { zs: '45' })] }];
  const r = checkCert(c); const all = r.groups.flatMap((g) => g.items.map((i) => i.text)).filter((t) => /DB4 circuit 1/.test(t));
  assert.equal(all.length, 1, all.join(' | ')); assert.match(all[0], /On TT the circuit needs an RCD/);
});
test('diagram: cables numbered by way (C5 = circuit 5), PFC (not Ipf)', () => {
  const c = newCert('EIC', {}); c.supply.ipf = '1.6'; c.boards = [{ ref: 'DB1', circuits: [mcb(5), mcb(11), mcb(4)] }];
  const L = layout(diagramModel(c), { W: 560, font: 11, cableTable: true }); assert.deepEqual(L.cables.map((x) => x.label).sort(), ['C11', 'C4', 'C5']); assert.ok(L.cables.every((x) => x.from === 'DB1 circuit ' + x.label.slice(1)));
  const t = JSON.stringify(L.blocks); assert.match(t, /PFC 1\.6 kA/); assert.doesNotMatch(t, /Ipf 1\.6/);
});
test('board page: no green tick while a circuit is red; mouse buttons 36px, touch 44px', () => {
  const s = read('js/schedule.js'); assert.match(s, /every circuit has a Zs and nothing is over the limits \\u2713/); assert.match(s, /outside the limits \(red below\)/);
  const d = read('desktop.css'); assert.match(d, /\(pointer: fine\) \{\n  body\.desk \.btn \{ min-height: 36px/); assert.match(d, /@media \(pointer: coarse\) \{\n  body\.desk \.btn, body\.desk \.btn\.small, body\.desk \.chip \{ min-height: 44px; \}/);
});
test('Check certificate: count line, board filter, Fix next, pre-PDF title doesn\'t clash with "Worth a look"', () => {
  const u = read('js/certui.js'); assert.match(u, /'Before the PDF goes out'/); assert.doesNotMatch(u, /Worth a look before the PDF goes out/);
  assert.match(u, /Fix next/); assert.match(u, /ccfilter/); assert.match(u, /setTopBar\(walkBar\)/);
  const c = newCert('EIC', {}); c.boards = [{ ref: 'DB1', circuits: [mcb(1, { zs: '' })] }, { ref: 'DB2', circuits: [mcb(1, { zs: '9' })] }];
  const r = checkCert(c); const its = r.groups.flatMap((g) => g.items); assert.ok(its.filter((i) => /^DB2/.test(i.text)).every((i) => i.bi === 1)); assert.ok(its.filter((i) => /^DB1 circuit/.test(i.text)).every((i) => i.bi === 0));
  assert.deepEqual(r.groups.map((g) => g.count), r.groups.map((g) => ({ fix: 'to fix', missing: 'to fill in', check: 'worth a look' })[g.id]));
});

// ---------- EICR: record, don't fix ----------
test('EICR: red readings are "outside the limits", each with a suggested observation (no duplicates)', () => {
  const c = newCert('EICR', {}); c.boards = [{ ref: 'DB1', circuits: [mcb(5, { desc: 'Kitchen sockets (FAKE)', rating: '32', zs: '2.1' }), mcb(6, { pol: '✗' })] }];
  let r = checkCert(c); const fix = r.groups.find((g) => g.id === 'fix'); assert.match(fix.title, /record as observations/); assert.equal(fix.count, 'outside the limits');
  const zs = fix.items.find((i) => /circuit 5/.test(i.text)); assert.equal(zs.obs.code, 'C2'); assert.equal(zs.obs.reg, '411.4.4'); assert.equal(zs.obs.location, 'DB1 circuit 5'); assert.match(zs.obs.text, /Kitchen sockets/); assert.equal(zs.obsDone, false);
  assert.equal(fix.items.find((i) => /circuit 6/.test(i.text)).obs.code, 'C1');
  c.observations = [{ id: 'o1', text: zs.obs.text, code: 'C2', reg: zs.obs.reg, location: zs.obs.location, src: zs.obs.src }];
  r = checkCert(c); assert.equal(r.groups.find((g) => g.id === 'fix').items.find((i) => /circuit 5/.test(i.text)).obsDone, true); assert.ok(hasObsFor(c, '0/5/zs'));
  const u = read('js/certui.js'); assert.match(u, /Record each one as an observation/); assert.match(u, /Add as observation/);
  assert.match(read('js/schedule.js'), /On an EICR, record it as an observation/);
  const eic = newCert('EIC', {}); eic.boards = c.boards; assert.equal(checkCert(eic).groups.find((g) => g.id === 'fix').items[0].obs, undefined);
  assert.equal(obsSuggestion({ cert: c, b: c.boards[0], bi: 0, c: c.boards[0].circuits[0], field: 'nope', flag: { msg: 'x' } }), null);
});

// ---------- Not found ----------
test('bad links say not found: board / circuit out of range, MW board link, bad Max demand id', () => {
  const s = read('js/schedule.js'); assert.match(s, /notFound\('board', \{ back: '#\/cert\/' \+ id/); assert.match(s, /notFound\('circuit'/); assert.doesNotMatch(s, /if \(!c\) return go\(`#\/cert\/\$\{id\}\/b\/\$\{bi\}`\)/); assert.doesNotMatch(s, /if \(!b\) return go\('#\/cert\/' \+ id\)/);
  assert.doesNotMatch(read('js/testacross.js'), /if \(!b\) return go\('#\/cert\/' \+ id\)/);
  assert.match(read('js/calcmd.js'), /if \(certId && !cert\) return notFound\('certificate'\)/);
});

// ---------- Lighten ----------
test('service worker: vendor in its own cache that survives releases; one Tesseract build; background fill', () => {
  const sw = read('sw.js'); assert.match(sw, /const VENDOR_CACHE = 'sparky-vendor-\d+'/); assert.match(sw, /k !== CACHE && k !== VENDOR_CACHE/);
  const files = sw.slice(sw.indexOf('const FILES'), sw.indexOf('const VENDOR = ['));
  assert.doesNotMatch(files, /vendor\/|fonts\//, 'vendor files are not in the app list'); assert.match(sw.slice(sw.indexOf('const VENDOR = [')), /tesseract-core-simd-lstm\.wasm/);
  assert.match(sw, /WebAssembly\.validate/); assert.match(sw, /'fillVendor'/); assert.match(read('js/main.js'), /postMessage\('fillVendor'\)/);
  for (const f of fs.readdirSync(new URL('../js/', import.meta.url))) if (f.endsWith('.js')) assert.ok(files.includes(`"./js/${f}"`), f + ' cached');
  assert.match(read('build-sw.sh'), /VENDOR/);
});
test('screens load on demand (offline still works: all precached); the font is woff2', () => {
  const m = read('js/main.js'); assert.doesNotMatch(m, /^import '\.\/certui\.js';/m); assert.match(m, /setLazyScreens/);
  const a = read('js/app.js'); assert.match(a, /await loadScreens\(\)/);
  assert.match(read('styles.css'), /url\(fonts\/inter-latin\.woff2\) format\('woff2'\)/); assert.ok(fs.existsSync(new URL('../fonts/inter-latin.woff2', import.meta.url)));
});

// ---------- Backups both ways ----------
test('backups: only optional fields added (rcdWays, rcd2, obs.src); a v0.50 backup reads in the v0.49 format', async () => {
  const c = splitCert(); c.observations = [{ id: 'o1', text: 'FAKE', code: 'C2', reg: '', location: '', src: '0/5/zs' }];
  const bk = { app: 'sparky', format: 1, jobs: [], customers: [], certs: [c], files: [], meta: {} };
  const p = await planRestore(parseBackup(JSON.stringify(bk)), { getCur: async () => null, getMeta: async () => null, decode: async () => 1 });
  const w = p.writes.find((x) => x.store === 'certs').value; assert.equal(w.boards[0].rcdWays, '1-3'); assert.equal(w.boards[0].rcd2.ways, '4-5'); assert.equal(w.observations[0].src, '0/5/zs');
  assert.match(read('js/db.js'), /sparky-certs/);
});

test('board page, PDF and diagram share one RCD-cover sentence (incl. ways on no RCD)', async () => {
  const { rcdCoverFull } = await import('../js/rcdways.js');
  const c = splitCert(); const b = c.boards[0];
  const t = rcdCoverFull(b); assert.match(t, /RCD 1 covers ways 1-3; RCD 2 covers ways 4-5/);
  for (const f of ['js/schedule.js', 'js/pdf.js', 'js/wiring.js']) assert.match(read(f), /rcdCoverFull\(b, isSpare(Circuit)?\)/, f);
});
test('offline: Settings says whether board scan and View PDF are ready; scan error explains the one-off download', () => {
  assert.match(read('js/app.js'), /function offlineLine\(\)/); assert.match(read('js/app.js'), /sparky-vendor-1/);
  assert.match(read('js/schedule.js'), /Board scan downloads in the background the first time the app is online/);
});
