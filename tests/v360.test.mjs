// v0.36 tests: no '…' anywhere in PDFs (footer, labels, values), every N/A grey,
// old/damaged certificates print, safer restore. FAKE data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.jspdf ||= require('/workspace/sparky-work/npm/package/dist/jspdf.node.min.js');
const { certificatePdf } = await import('../js/pdf.js');
const { isNA, Kit, NA_GREY, VALUE } = await import('../js/pdfkit.js');
const { normaliseCert } = await import('../js/certmodel.js');
const { parseBackup, planRestore, BAD_BACKUP } = await import('../js/backup.js');
const S = await import('./sample-data.mjs');
const { APP_SLUG } = await import('../js/config.js');

const raw = async (b) => Buffer.from(await b.arrayBuffer()).toString('latin1');
const LONG = 'Extremely Long Business Name Electrical Contractors and Sons (Scotland) Limited Trading As Something Even Longer';

test('isNA: whole-value na / n/a / NA / N.A. only', () => {
  for (const v of ['N/A', 'n/a', 'NA', 'na', ' N.A. ', 'n.a', 'N / A', 'n/a ']) assert.equal(isNA(v), true, v);
  for (const v of ['', 'NAN', 'Nail', 'n/a test', 'BS NA', '0.5', 'None', 'A', 'N']) assert.equal(isNA(v), false, v);
});

test('Kit.t prints a typed na as grey "N/A"; other values stay black', () => {
  const { jsPDF } = globalThis.jspdf; const k = new Kit(jsPDF, { orientation: 'p' });
  const calls = []; const orig = k.doc.text.bind(k.doc); const col = k.doc.setTextColor.bind(k.doc); let last;
  k.doc.setTextColor = (...a) => { last = a; return col(...a); };
  k.doc.text = (s, ...r) => { calls.push([s, last]); return orig(s, ...r); };
  k.t('n.a.', 10, 10, { color: VALUE }); k.t('0.62', 10, 20, { color: VALUE }); k.t('na', 10, 30); // a label "na" (not a value) stays as typed
  assert.deepEqual(calls[0], ['N/A', NA_GREY]); assert.deepEqual(calls[1], ['0.62', VALUE]); assert.equal(calls[2][0], 'na');
});

test('PDFs: long business name footer never cut with "…"; typed N/A prints grey', async () => {
  const P = { ...S.PROFILE, business: LONG };
  for (const c of [S.sampleEIC(), S.sampleEICR(), S.sampleMW()]) {
    if (c.boards[0]) { c.boards[0].rcdBs = 'n/a'; c.boards[0].circuits[0].afddBtn = 'NA'; }
    c.mw.circuit.irLE = 'N.A.';
    const b = await certificatePdf(c, { profile: P });
    const s = await raw(b);
    assert.ok(!s.includes('\u2026') && !/\\u2026|…/.test(s));
    fs.writeFileSync(`/tmp/v360-${c.type}.pdf`, Buffer.from(await b.arrayBuffer()));
  }
});

test('field(): very long labels and values are never cut with "…"', async () => {
  const { jsPDF } = globalThis.jspdf; const k = new Kit(jsPDF, { orientation: 'p' });
  const out = []; const orig = k.doc.text.bind(k.doc); k.doc.text = (s, ...r) => { out.push(String(s)); return orig(s, ...r); };
  k.field('A very very long label that will never fit in the space it has been given', 'x', 10, 10, 30);
  k.field('Label', 'A value that is far far too long to fit on one line or even two small lines in a narrow field like this one', 10, 20, 30);
  assert.ok(out.every((s) => !s.includes('\u2026')));
  assert.ok(out.join(' ').includes('narrow'));
});

test('normaliseCert: old/damaged certificates print and keep their values', async () => {
  const cases = [
    { type: 'EIC', id: 'a', number: 'EIC-9' }, { type: 'EICR', id: 'b' }, { type: 'MW', id: 'c' },
    (() => { const c = S.sampleEICR(); delete c.boards[0].circuits; return c; })(),
    (() => { const c = S.sampleEIC(); c.install = null; c.client = null; c.people = null; return c; })(),
    (() => { const c = S.sampleEIC(); c.boards[0].circuits[2] = null; c.observations = [null]; return c; })(),
    (() => { const c = S.sampleMW(); delete c.mw; return c; })(),
    (() => { const c = S.sampleEICR(); c.eicr = 'junk'; c.boards = 'junk'; return c; })(),
  ];
  for (const c of cases) await certificatePdf(c, { profile: {} });
  // every section missing in turn, and null in turn
  for (const mk of [S.sampleEIC, S.sampleEICR, S.sampleMW]) for (const k of Object.keys(mk())) for (const bad of [undefined, null]) {
    const c = mk(); if (bad === undefined) delete c[k]; else c[k] = null; if (k === 'type') continue;
    await certificatePdf(c, { profile: null });
  }
  const c = S.sampleEIC(); const before = JSON.stringify(c); normaliseCert(c); assert.equal(JSON.stringify(c), before, 'a complete cert is untouched');
  const p = S.sampleEIC(); const snap = JSON.stringify(p); await certificatePdf(p, { profile: {} }); assert.equal(JSON.stringify(p), snap, 'printing does not change the saved cert');
});

test('parseBackup: plain message for bad files, nothing thrown raw', () => {
  for (const bad of ['not json', '{', '[]', 'null', '{"app":"sparky","jobs":"x"}', '{"app":"sparky","certs":[{"no":"id"}]}', '{"app":"sparky","files":[{"id":"f","blob":"http://x"}]}', '{"app":"sparky","meta":[]}']) {
    assert.throws(() => parseBackup(bad), (e) => e.message === BAD_BACKUP, bad);
  }
  assert.throws(() => parseBackup('{"app":"other"}'), /isn’t a backup file from this app/);
  assert.equal(parseBackup(JSON.stringify({ app: APP_SLUG, jobs: [] })).app, APP_SLUG);
});

test('planRestore: newest wins, photos only replaced by a HIGHER version, damaged photo aborts everything', async () => {
  const now = '2026-10-27T10:00:00Z', old = '2026-01-01T00:00:00Z';
  const cur = { jobs: { j1: { id: 'j1', updatedAt: now }, j2: { id: 'j2', updatedAt: now } }, files: { f1: { id: 'f1', version: 2 }, f2: { id: 'f2', version: 1 } }, certs: {}, customers: {} };
  const getCur = async (s, id) => (cur[s] || {})[id]; const getMeta = async (k) => (k === 'profile' ? { name: 'me' } : null);
  const d = parseBackup({ app: APP_SLUG, jobs: [{ id: 'j1', updatedAt: old }, { id: 'j2', updatedAt: '2026-12-01' }], certs: [{ id: 'c1', type: 'MW' }],
    files: [{ id: 'f1', version: 2, blob: 'data:text/plain;base64,QQ==' }, { id: 'f2', version: 3, blob: 'data:text/plain;base64,QQ==' }, { id: 'f3', blob: 'data:text/plain;base64,QQ==' }],
    meta: { profile: { name: 'old' }, settings: { a: 1 } } });
  const p = await planRestore(d, { getCur, getMeta, decode: async (u) => u.length });
  const ids = p.writes.map((w) => w.store + ':' + (w.value.id || w.key));
  assert.deepEqual(ids, ['jobs:j2', 'certs:c1', 'files:f2', 'files:f3', 'meta:settings']);
  assert.equal(p.n, 2);
  assert.ok(p.writes.find((w) => w.value.id === 'c1').value.mw.circuit, 'restored certs are normalised');
  const d2 = parseBackup({ app: APP_SLUG, jobs: [{ id: 'j9' }], files: [{ id: 'f9', blob: 'data:x' }] });
  await assert.rejects(planRestore(d2, { getCur, getMeta, decode: async () => { throw new Error('boom'); } }), (e) => e.message === BAD_BACKUP);
});

test('v0.36 wiring: version, cache, update banner, job tags, landscape, check-private', () => {
  const r = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  assert.match(r('js/config.js'), /'0\.3[6789]\.\d beta'/); assert.match(r('sw.js'), /sparky-v0\.3[6789]\.\d/);
  assert.match(r('sw.js'), /e\.data === 'skipWaiting'/);
  assert.match(r('js/main.js'), /Tap to update/); assert.match(r('js/main.js'), /controllerchange/);
  assert.match(r('js/app.js'), /rowtags/); assert.match(r('styles.css'), /orientation: landscape\) and \(max-height: 500px\)/);
  assert.match(r('check-private.sh'), /\/workspace\/sparky-work\/private-patterns\.txt/);
  assert.doesNotMatch(r('js/pdfkit.js'), /…/);
});

test('sw.js and main.js parse', async () => {
  const { spawnSync } = await import('node:child_process');
  for (const f of ['sw.js', 'js/main.js']) assert.equal(spawnSync(process.execPath, ['--check', new URL('../' + f, import.meta.url).pathname]).status, 0, f);
});
