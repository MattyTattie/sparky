// v0.45.2: a later board's main switch on its schedule header; DB1's board details point to the certificate's main switch. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.jspdf ||= require('./jspdf-node.cjs');
const { certificatePdf } = await import('../js/pdf.js');
const S = await import('./sample-data.mjs');
const { mainSwitchRow, mainSummary } = await import('../js/boardmain.js');
const src = (f) => fs.readFileSync(new URL('../js/' + f, import.meta.url), 'utf8');
const db2 = (main) => ({ id: 'b2', ref: 'DB2', location: 'Generation CU', suppliedFrom: 'Meter tails', spdT2: true, rcdBs: '61008', rcdType: 'A-S', rcdIdn: '300', rcdRating: '63', ...(main ? { main } : {}),
  circuits: [{ id: 'g1', num: '1', desc: 'Battery inverter', device: 'mcb', bs: '60898', type: 'B', rating: '50', bka: '6', live: '10', cpc: '10' }] });
const ISO = { msLocation: 'In the generation CU', msBs: '60947-3', msPoles: '2', msCurrent: '100', msVoltage: '230/400', msIsOcpd: false, msIsRcd: false };
async function pdfText(c) {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'v452-')), 'c.pdf'); fs.writeFileSync(f, Buffer.from(await (await certificatePdf(c, { profile: S.PROFILE })).arrayBuffer()));
  return spawnSync('pdftotext', ['-layout', f, '-']).stdout.toString().split('\f');
}
const withDb2 = (mk, main) => { const c = mk(); c.boards = [c.boards[0], db2(main)]; return c; };

test('mainSwitchRow: null when blank; BS, poles, current, voltage + location; breaker / RCD details when ticked', () => {
  assert.equal(mainSwitchRow({}, 'main.'), null); assert.equal(mainSwitchRow({ main: { msLocation: 'Cupboard' } }, 'main.'), null);
  const r = mainSwitchRow({ main: ISO }, 'main.');
  assert.deepEqual(r.map((x) => x[1]), ['60947-3', '2', '100', '230/400', 'In the generation CU']);
  assert.ok(Math.abs(r.reduce((a, x) => a + x[2], 0) - 1) < 1e-9);
  const o = mainSwitchRow({ main: { ...ISO, msIsOcpd: true, msType: 'MCCB', msRating: '125', msKa: '25' } }, 'main.'); assert.equal(o[4][0], 'If OCPD / RCD:'); assert.equal(o[4][1], 'MCCB 125 A 25 kA');
  const d = mainSwitchRow({ main: { ...ISO, msBs: '61008', msIsRcd: true, rcdType: 'A-S', rcdIdn: '100', rcdDelay: '200' } }, 'main.', (t) => t.replace('-', ' ')); assert.equal(d[4][1], 'RCD Type A S 100 mA delay 200 ms');
});
for (const [name, mk] of [['EIC', S.sampleEIC], ['EICR', S.sampleEICR]]) {
  test(`${name}: DB2's main switch prints on its circuit details header only when filled in`, async () => {
    const pages = await pdfText(withDb2(mk, ISO));
    const det = pages.find((p) => /DB\/CU: DB2/.test(p) && /SCHEDULE OF CIRCUIT DETAILS/.test(p)); assert.ok(det);
    assert.match(det, /Main switch: BS \(EN\)\s+60947-3/); assert.match(det, /230\/400/); assert.match(det, /In the generation CU/);
    const res = pages.find((p) => /DB\/CU: DB2/.test(p) && /SCHEDULE OF TEST RESULTS/.test(p)); assert.doesNotMatch(res, /Main switch: BS/);
    const db1 = pages.filter((p) => /SCHEDULE OF CIRCUIT DETAILS/.test(p) && !/DB\/CU: DB2/.test(p)); assert.ok(db1.length); for (const p of db1) assert.doesNotMatch(p, /Main switch: BS/);
    const none = await pdfText(withDb2(mk, null)); assert.doesNotMatch(none.join('\f'), /Main switch: BS \(EN\)/);
  });
}
test('board 1 never prints a board.main line (its main switch is the certificate one); old certificates unchanged', async () => {
  const c = S.sampleEIC(); c.boards[0].main = ISO; assert.doesNotMatch((await pdfText(c)).join('\f'), /Main switch: BS \(EN\)/);
});
test('DB1 board details: pointer to Earthing, bonding and main switch, with a summary', () => {
  assert.match(src('schedule.js'), /cert\.boards\.indexOf\(b\) > 0 \? boardMainSwitch\(b\) : msPointer\(cert\)/);
  assert.match(src('schedule.js'), /#\/cert\/\$\{cert\.id\}\/s\/parts/);
  assert.equal(mainSummary({ parts: { msBs: '60947-3', msPoles: '2', msCurrent: '100' } }, 'parts.'), '100 A DP isolator (BS EN 60947-3)');
  assert.equal(mainSummary({ parts: {} }, 'parts.'), '');
  assert.equal(mainSummary({ parts: { msBs: '60947-2', msCurrent: '100', msIsOcpd: true, msType: 'MCCB', msRating: '100' } }, 'parts.'), '100 A (BS EN 60947-2) · Main MCCB 100 A');
});
