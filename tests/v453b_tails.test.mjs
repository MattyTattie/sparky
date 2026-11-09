// v0.45.3: DB1 can be fed via a meter tail connector block (board 1 supplyKind 'tails'), only when tapped. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs';
const { diagramSvg, diagramModel } = await import('../js/wiring.js');
const src = (f) => fs.readFileSync(new URL('../js/' + f, import.meta.url), 'utf8');
const texts = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
const cert = (db1 = {}, db2 = { supplyKind: 'tails', suppliedFrom: 'Meter tail connector block' }) => ({ type: 'EIC', supply: { earthing: 'TN-C-S (PME)' }, parts: { msCurrent: '100', msPoles: '2', msBs: '60947-3' },
  boards: [{ ref: 'DB1', suppliedFrom: 'Origin', circuits: [{ num: '1', desc: 'Sockets', device: 'rcbo', type: 'B', rating: '32' }], ...db1 }, { ref: 'DB2', circuits: [{ num: '1', desc: 'Inverter', device: 'mcb', type: 'B', rating: '50' }], ...db2 }] });

test('off by default and never guessed from DB1\u2019s text', () => {
  for (const db1 of [{}, { suppliedFrom: 'Meter tails via Henley block' }, { suppliedFrom: 'Meter tail connector block' }]) {
    const t = texts(diagramSvg(cert(db1))); const i = t.indexOf('Meter');
    assert.match(t[i + 2] || '', /^DB1/, JSON.stringify(db1)); assert.ok(!t.some((s) => /feeds DB1|same block as DB1/.test(s)));
    assert.equal(diagramModel(cert(db1)).boards[0].viaTails, false);
  }
});
test('tapped: connector block drawn between Meter and DB1, in the key, and DB2 on tails says it is the same block', () => {
  const t = texts(diagramSvg(cert({ supplyKind: 'tails' })));
  const i = t.indexOf('Meter'); assert.equal(t[i + 2], 'Meter tail connector block: feeds DB1 and DB2'); assert.match(t[i + 3], /^DB1/);
  assert.ok(t.includes('Meter tail connector block (the same block as DB1)'));
  assert.equal(t.filter((s) => s === 'Meter tail connector block').length, 1, 'key entry');
});
test('tapped with no other board on tails: plain label, still in the key', () => {
  const t = texts(diagramSvg(cert({ supplyKind: 'tails' }, { suppliedFrom: 'DB1 circuit 1' })));
  assert.equal(t.filter((s) => s === 'Meter tail connector block').length, 2); assert.ok(!t.some((s) => /same block as DB1|feeds DB1/.test(s)));
});
test('three boards on one block read as a list', () => {
  const c = cert({ supplyKind: 'tails' }); c.boards.push({ ref: 'DB3', supplyKind: 'tails', circuits: [] });
  assert.ok(texts(diagramSvg(c)).includes('Meter tail connector block: feeds DB1, DB2 and DB3'));
});
test('DB1 board details: Meter / Meter via connector block chips; off removes the key; text box untouched', () => {
  const s = src('schedule.js');
  assert.match(s, /cert\.boards\.indexOf\(b\) > 0 \? supplyChips\(cert, b\) : db1SupplyChips\(b\)/);
  assert.match(s, /chip\(false, 'Meter'\), chip\(true, 'Meter via connector block'\)/);
  assert.match(s, /if \(v\) b\.supplyKind = 'tails'; else delete b\.supplyKind;/);
});
