// v0.49.0: audit fixes (19 Nov 2026). Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.jspdf ||= require('./jspdf-node.cjs');
const { newCert, blankBoard, normaliseCert, sectionsFor, sectionProgress, sectionDone } = await import('../js/certmodel.js');
const { blankCircuit, applyTemplate, TEMPLATES, outOfWayOrder, sortByWay } = await import('../js/templates.js');
const { settleBoardRcds } = await import('../js/boardrcd.js');
const { fillBoardRcd } = await import('../js/ocpdfill.js');
const { checkCircuit, boardCtx, limitZs, upstreamRcd, cableCheck, isSpare } = await import('../js/checks.js');
const { checkCert, zsMissing, missingZsText } = await import('../js/certcheck.js');
const { partsForJob } = await import('../js/parts.js');
const { inWords } = await import('../js/reminders.js');
const { parseBackup, planRestore, BAD_BACKUP } = await import('../js/backup.js');
const { certificatePdf } = await import('../js/pdf.js');
const { certsOfJob } = await import('../js/jobtable.js');
const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

const T = (n) => { const t = TEMPLATES.find((x) => x.name.startsWith(n)); if (!t) throw new Error('no template ' + n); return t; };
// An RCBO template switched to an MCB (as older versions left it): the RCBO's own RCD values are still in the boxes.
const ckt = (n, tname, extra) => Object.assign(applyTemplate(blankCircuit(n), T(tname)), { device: 'mcb', bs: '60898', type: 'B' }, extra);
function fakeCert() {
  const c = newCert('EIC', {}, {}); c.id = 'cert-490'; c.jobId = 'job-490'; c.number = 'EIC-490';
  c.supply.earthing = 'TN-C-S (PME)';
  const b1 = Object.assign(blankBoard(1), { id: 'b1', ref: 'DB1', rcdBs: '61008', rcdType: 'A', rcdIdn: '30', rcdRating: '63' });
  b1.circuits = [ckt(1, 'Ring final', { desc: 'Ring final: downstairs sockets', ring: true, rating: '32', zs: '0.46', rcdBs: '61008', rcdType: 'A', rcdIdn: '30', rcdRating: '63', autoF: {} }),
    ckt(2, 'Radial 32 A', { desc: 'Kitchen sockets', ring: false, rating: '32', live: '2.5', cpc: '1.5', ref: 'C', cable: 'te', cableSize: '2.5', zs: '0.68' }),
    ckt(3, 'Radial 20 A', { desc: 'Garage sockets', ring: false, rating: '20', zs: '' }),
    ckt(11, 'Radial 20 A', { desc: 'Utility', ring: false, rating: '20', zs: '0.5' }),
    ckt(7, 'Radial 20 A', { desc: 'Lights', ring: false, rating: '20', zs: '0.9' })];
  const b4 = Object.assign(blankBoard(4), { id: 'b4', ref: 'DB4', earthing: 'TT', ra: '45', suppliedFrom: 'DB1 circuit 9' });
  b4.circuits = [ckt(1, 'Radial 20 A', { desc: 'Shed sockets', ring: false, rating: '16', zs: '12.5', rcdMs: '30' })];
  // the sub-main that feeds DB4: an RCBO (30 mA)
  b1.circuits.push(Object.assign(applyTemplate(blankCircuit(9), T('Radial 20 A')), { desc: 'Sub-main to shed', ring: false, rating: '32', live: '6', cpc: '6', zs: '0.4' }));
  c.boards = [b1, b4];
  return normaliseCert(c);
}
const clone = (x) => JSON.parse(JSON.stringify(x));
const rcd4 = (x) => [x.rcdBs, x.rcdRating, x.rcdIdn, x.rcdType].join('/');

test('HIGH: board RCD settles on load: MCB lines show the real board RCD (61008 63 A), no phantom 61009', () => {
  const c = fakeCert(); assert.equal(rcd4(c.boards[0].circuits[1]), '61009/32/30/A', 'starts with the RCBO leftovers');
  const n = settleBoardRcds(c); assert.ok(n > 0);
  for (const x of c.boards[0].circuits.slice(1, 5)) assert.equal(rcd4(x), '61008/63/30/A', 'circuit ' + x.num);
  assert.equal(rcd4(c.boards[0].circuits[5]), '61009/32/30/A', 'the RCBO sub-main keeps its own RCD');
  assert.equal(settleBoardRcds(c), 0, 'idempotent');
});
test('HIGH: settled = what opening the schedule used to do; verdicts, Check certificate and parts list do not depend on it', () => {
  const unopened = fakeCert(); const opened = fakeCert();
  for (const b of opened.boards) fillBoardRcd(b, isSpare); // what the schedule route did on view
  const s = (c) => JSON.stringify(checkCert(c));
  assert.equal(s(unopened), s(opened));
  const pa = JSON.stringify(partsForJob([unopened])), pb = JSON.stringify(partsForJob([opened])); assert.equal(pa, pb);
  assert.doesNotMatch(pa, /RCD 32 A 30 mA Type A \(BS EN 61009\)/);
  assert.match(pa, /RCD 63 A 30 mA Type A \(BS EN 61008\)/);
  // checkCert / parts never change the certificate passed in
  assert.equal(rcd4(unopened.boards[0].circuits[1]), '61009/32/30/A');
});
test('HIGH: TT board: leftover RCBO values no longer give a false pass; the red flag says what to do', () => {
  const c = fakeCert(); settleBoardRcds(c); const b = c.boards[1]; const x = b.circuits[0];
  assert.equal(rcd4(x), '///', 'no board RCD: the RCBO leftovers are blanked');
  const r = checkCircuit(x, boardCtx(c, b)); assert.equal(r.worst, 'red'); assert.match(r.flags.zs.msg, /2\.73/); assert.match(r.flags.zs.msg, /RCD upstream/);
  // same verdict in Check certificate whether or not settled first
  assert.match(JSON.stringify(checkCert(fakeCert())), /DB4 circuit 1: Zs 12\.5 Ω is over the maximum 2\.73 Ω/);
});
test('TT board with its own RCD: Table 41.5 for its MCB lines', () => {
  const c = fakeCert(); Object.assign(c.boards[1], { rcdBs: '61008', rcdType: 'A', rcdIdn: '30', rcdRating: '40' }); settleBoardRcds(c);
  const b = c.boards[1]; const l = limitZs(b.circuits[0], boardCtx(c, b)); assert.equal(l.value, 1667); assert.equal(checkCircuit(b.circuits[0], boardCtx(c, b)).worst, null);
});
test('TT sub-board fed through an upstream RCD (b.upRcd): the feeding RCBO counts, Table 41.5', () => {
  const c = fakeCert(); settleBoardRcds(c); const b = c.boards[1]; b.upRcd = true;
  const up = upstreamRcd(c, b); assert.equal(up.rcdIdn, '30'); assert.equal(up.where, 'DB1 circuit 9');
  const l = limitZs(b.circuits[0], boardCtx(c, b)); assert.equal(l.value, 1667); assert.match(l.source, /RCD upstream in DB1 circuit 9/);
  assert.equal(checkCircuit(b.circuits[0], boardCtx(c, b)).worst, null);
  // RA × IΔn still checked: 45 Ω × 30 mA = 1.35 V, fine; 2000 Ω × 30 mA = 60 V, red
  b.ra = '2000'; assert.match(checkCircuit(b.circuits[0], boardCtx(c, b)).flags.rcdIdn.msg, /over 50 V/);
  // feeding circuit with no RCD and a feeding board with none: nothing upstream
  const c2 = fakeCert(); c2.boards[0].rcdIdn = ''; c2.boards[0].circuits[5] = Object.assign(c2.boards[0].circuits[5], { device: 'mcb', bs: '60898', rcdBs: 'N/A', rcdIdn: 'N/A', rcdType: 'N/A', rcdRating: 'N/A', autoF: {} });
  c2.boards[1].upRcd = true; assert.equal(upstreamRcd(c2, c2.boards[1]), null);
  // not ticked: nothing
  assert.equal(upstreamRcd(fakeCert(), fakeCert().boards[1]), null);
});
test('typed by hand is never changed: a second RCD typed on a split board, or 61009 on an MCB with no board RCD', () => {
  const c = fakeCert(); const x = c.boards[0].circuits[2]; Object.assign(x, { rcdBs: '61008', rcdRating: '40', rcdIdn: '30', rcdType: 'AC', autoF: {} });
  settleBoardRcds(c); assert.equal(rcd4(x), '61008/40/30/AC');
  const d = fakeCert(); d.boards[0].rcdIdn = ''; d.boards[0].rcdBs = ''; d.boards[0].rcdRating = ''; d.boards[0].rcdType = '';
  const y = d.boards[0].circuits[1]; y.autoF = {}; settleBoardRcds(d); assert.equal(rcd4(y), '61009/32/30/A');
});
test('overload: B32 on 2.5 mm² radial is a fault (Reg 433.1.1), listed under Needs fixing', () => {
  const k = { desc: 'Kitchen sockets', ring: false, rating: '32', live: '2.5', cpc: '1.5', ref: 'C', cable: 'te', cableSize: '2.5', device: 'mcb', type: 'B' };
  const r = cableCheck(k); assert.equal(r.level, 'red'); assert.match(r.msg, /433\.1\.1/);
  const cc = checkCert(fakeCert()); const fix = cc.groups.find((g) => g.id === 'fix');
  assert.ok(fix.items.some((i) => /DB1 circuit 2: .*433\.1\.1/.test(i.text)));
  assert.equal(cableCheck({ ...k, ring: true, desc: 'Ring final' }).level, null, 'a ring on 2.5 mm² is still fine');
});
test('Check certificate: one wording for missing readings, tap goes to the circuit; amber flags under Worth a look', () => {
  const c = fakeCert(); const cc = checkCert(c);
  const miss = cc.groups.find((g) => g.id === 'missing'); const it = miss.items.find((i) => /no Zs/.test(i.text));
  assert.equal(it.text, 'DB1 circuit 3: no Zs.'); assert.equal(it.href, '#/cert/cert-490/b/0/c/2');
  assert.equal(missingZsText('DB2', ['1', '3']), 'DB2 circuits 1, 3: no Zs');
  assert.deepEqual(zsMissing(c.boards[0]).map((x) => x.num), ['3']);
  const look = cc.groups.find((g) => g.id === 'check'); assert.equal(look.title, 'Worth a look');
  assert.ok(look.items.some((i) => /way order \(11 comes before 7\)/.test(i.text)));
  assert.match(read('js/certui.js'), /missingZsText\(b\.ref \|\| 'DB', m\.map/);
  assert.match(read('js/schedule.js'), /boardLine\(cert, \+bi\)/);
});
test('way order: spotted and sorted only on request', () => {
  const cs = [{ num: '1' }, { num: '11' }, { num: '7' }, { num: '8' }];
  assert.deepEqual(outOfWayOrder(cs), { before: '11', after: '7' }); assert.equal(cs[1].num, '11', 'not changed by looking');
  sortByWay(cs); assert.deepEqual(cs.map((x) => x.num), ['1', '7', '8', '11']); assert.equal(outOfWayOrder(cs), null);
  const ph = [{ num: '1L1' }, { num: '1L2' }, { num: '2' }]; sortByWay(ph); assert.deepEqual(ph.map((x) => x.num), ['1L1', '1L2', '2']);
});
test('progress counts what is filled in inside sections', () => {
  const c = fakeCert(); c.client.name = 'A. N. Example (FAKE)';
  const s = sectionsFor('EIC').find((x) => x.id === 'client'); const p = sectionProgress(c, s);
  assert.ok(p > 0 && p < 1, String(p)); assert.equal(sectionDone(c, s), false);
  const bs = sectionsFor('EIC').find((x) => x.special === 'boards'); assert.ok(Math.abs(sectionProgress(c, bs) - 6 / 7) < 0.01);
});
test('next inspection in words', () => {
  assert.equal(inWords(3653), 'in 10 years'); assert.equal(inWords(1826), 'in 5 years'); assert.equal(inWords(250), 'in 8 months'); assert.equal(inWords(0), 'today'); assert.equal(inWords(-60), '9 weeks ago');
  assert.doesNotMatch(read('js/app.js'), /in \$\{st\.days\} days/);
});
test('one bad-backup message; an old backup still loads; the new optional fields restore', async () => {
  assert.throws(() => parseBackup('{"app":"other"}'), (e) => e.message === BAD_BACKUP);
  assert.throws(() => parseBackup('not json'), (e) => e.message === BAD_BACKUP);
  const old = { app: 'sparky', format: 1, jobs: [{ id: 'j1', title: 'FAKE' }], customers: [], certs: [{ id: 'c-old', type: 'EIC', jobId: 'j1', boards: [{ ref: 'DB1', circuits: [{ num: '1', device: 'mcb', rating: '16' }] }] }], files: [], meta: {} };
  const p = await planRestore(parseBackup(JSON.stringify(old)), { getCur: async () => null, getMeta: async () => null, decode: async () => 1 });
  assert.ok(p.writes.some((w) => w.store === 'certs' && w.value.id === 'c-old'));
  const c = fakeCert(); c.boards[1].upRcd = true; const nb = { app: 'sparky', format: 1, jobs: [], customers: [], certs: [c], files: [], meta: {} };
  const p2 = await planRestore(parseBackup(JSON.stringify(nb)), { getCur: async () => null, getMeta: async () => null, decode: async () => 1 });
  assert.equal(p2.writes.find((w) => w.value.id === 'cert-490').value.boards[1].upRcd, true);
});
test('same certificate order on home, job page and table (oldest first)', () => {
  const cs = [{ id: 'c', jobId: 'j', type: 'EICR', createdAt: '2026-11-19T10:02' }, { id: 'a', jobId: 'j', type: 'MW', createdAt: '2026-11-19T10:03' }, { id: 'b', jobId: 'j', type: 'EIC', createdAt: '2026-11-19T10:01' }];
  assert.deepEqual(certsOfJob(cs, 'j').map((c) => c.type), ['EIC', 'EICR', 'MW']);
  assert.match(read('js/jobtable.js'), /const n = certsOfJob\(certs, j\.id\)/);
});
test('PDF prints the settled RCD (61008 63 A) on MCB rows, whether or not the board was opened', async () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'v490-')), 'c.pdf'); fs.writeFileSync(f, Buffer.from(await (await certificatePdf(fakeCert())).arrayBuffer()));
  const txt = spawnSync('pdftotext', ['-layout', f, '-']).stdout.toString();
  const row2 = txt.split('\n').find((l) => /Kitchen sockets/.test(l) && /60898/.test(l)); assert.ok(row2, 'kitchen row');
  assert.match(row2, /61008/); assert.doesNotMatch(row2, /61009/);
  assert.match(txt, /RCD upstream|TT/);
});
test('screens: spare with no device shows N/A; not-found page; settings cards; tap targets; version', () => {
  const sch = read('js/schedule.js'); assert.match(sch, /'N\/A \(no device fitted\)'/);
  const app = read('js/app.js'); assert.match(app, /export function notFound/); assert.match(app, /notFound\('page'\)/); assert.match(app, /h\('h2', \{\}, 'Test instruments'\), h\('p'/); assert.match(app, /None yet\. A device you fill in on a circuit/); assert.match(app, /settings\/presets\/add/);
  assert.match(app, /chips seg2 oneline/); assert.match(app, /h\('span', \{\}, 'Due soon'\)/); assert.doesNotMatch(app, /Re-tests? due/);
  for (const f of ['testacross', 'dangerui', 'importui', 'schedule', 'certui']) assert.doesNotMatch(read(`js/${f}.js`), /if \(!cert\) return go\('#\/'\)/, f);
  const css = read('styles.css'); assert.match(css, /\.linkbtn::after \{[^}]*height: 44px/); assert.match(css, /\.btn\.small, \.btn\.tiny, \.btn\.fact \{ min-height: 44px; \}/);
  assert.match(read('js/config.js'), /APP_VERSION = '0\.49\.0 beta'/); assert.match(read('sw.js'), /'sparky-v0\.49\.0'/); assert.match(read('sw.js'), /\.\/js\/boardrcd\.js/);
  assert.match(read('js/db.js'), /settleBoardRcds/); assert.match(read('js/db.js'), /const DB_NAME = 'sparky-certs';/);
});
test('RCD upstream: a feeding circuit that is not on the board gives nothing; "DB1" alone uses DB1\u2019s own RCD', () => {
  const c = fakeCert(); const b = c.boards[1]; b.upRcd = true;
  b.suppliedFrom = 'DB1 circuit 10'; assert.equal(upstreamRcd(c, b), null);
  b.suppliedFrom = 'DB1'; const up = upstreamRcd(c, b); assert.equal(up.rcdIdn, '30'); assert.equal(up.where, 'DB1');
});
