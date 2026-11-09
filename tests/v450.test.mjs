// v0.45.0: TT with "N/A" in the RCD boxes, ">"/"<" readings, diagram off by default, quieter screens. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkCircuit, limitZs } from '../js/checks.js';
import { diagramInPdf } from '../js/wiring.js';
const src = (f) => readFileSync(new URL('../js/' + f, import.meta.url), 'utf8');
const base = { num: '1', desc: 'Sockets', device: 'mcb', type: 'B', rating: '32', live: '2.5', cpc: '1.5' };

test('TT: "N/A" in the RCD boxes means no RCD, so the Table 41.3 max Zs applies (not 1667 Ω)', () => {
  for (const na of ['N/A', 'n/a', '-', '']) {
    const c = { ...base, rcdIdn: na, rcdType: na, zs: '45' };
    const lim = limitZs(c, { earthing: 'TT' });
    assert.equal(lim.value, 1.37, `rcdIdn ${JSON.stringify(na)}`); assert.ok(!lim.tt);
    assert.equal(checkCircuit(c, { earthing: 'TT' }).flags.zs.level, 'red');
  }
});
test('TT: a real RCD still gets the 50 V / IΔn figure', () => {
  assert.equal(limitZs({ ...base, rcdIdn: '30' }, { earthing: 'TT' }).value, 1667);
  assert.equal(limitZs({ ...base, rcdIdn: '100' }, { earthing: 'TT' }).value, 500);
  assert.equal(limitZs({ ...base, device: 'rcbo', rcdIdn: 'N/A' }, { earthing: 'TT' }).value, 1667); // RCBO is an RCD whatever the box says
  assert.equal(checkCircuit({ ...base, rcdIdn: '30', zs: '45' }, { earthing: 'TT' }).flags.zs, undefined);
});
test('RCD time ">300" (tester gave up) is red; "<300" and in-limit times are fine', () => {
  const f = (c) => checkCircuit({ ...base, device: 'rcbo', rcdIdn: '30', ...c }).flags.rcdMs;
  assert.equal(f({ rcdMs: '>300' }).level, 'red'); assert.match(f({ rcdMs: '>300' }).msg, /Over 300 ms/);
  assert.equal(f({ rcdMs: '>500', rcdS: true }).level, 'red');
  assert.equal(f({ rcdMs: '>200' }), undefined, '>200 is under the 300 ms limit, so not a fail');
  assert.equal(f({ rcdMs: '<300' }), undefined); assert.equal(f({ rcdMs: '24' }), undefined);
  assert.equal(f({ rcdMs: '320' }).level, 'red');
});
test('IR "<1" at 500 V (and "<0.5" at 250 V) is red, not amber; ">999" is fine', () => {
  const f = (c) => checkCircuit({ ...base, ...c }).flags.irLE;
  assert.equal(f({ irLE: '<1' }).level, 'red'); assert.match(f({ irLE: '<1' }).msg, /^Under 1 MΩ/);
  assert.equal(f({ irV: '250', irLE: '<0.5' }).level, 'red');
  assert.equal(f({ irLE: '0.8' }).level, 'red');
  assert.equal(f({ irLE: '<1.5' }).level, 'amber'); // under 1.5 could still be 1.2 MΩ: worth a look, not a fail
  assert.equal(f({ irLE: '>999' }), undefined);
});
test('wiring diagram: off in the PDF unless ticked on (existing jobs follow the new default)', () => {
  const c = { type: 'EIC', supply: {}, parts: {}, boards: [{ ref: 'DB1', circuits: [{ num: '1', desc: 'Lights', device: 'mcb', type: 'B', rating: '6' }] }] };
  assert.equal(diagramInPdf(c), false);
  assert.equal(diagramInPdf({ ...c, diagramPdf: false }), false);
  assert.equal(diagramInPdf({ ...c, diagramPdf: true }), true);
  assert.equal(diagramInPdf({ ...c, diagramPdf: true, boards: [{ ref: 'DB1', circuits: [] }] }), false);
  assert.match(src('certui.js'), /Add the wiring diagram to the PDF/);
});
test('cert page: one Share PDF button (Email merged in), Test across button, tidy wording', async () => {
  const s = src('certui.js');
  assert.doesNotMatch(s, /id: 'emailbtn'/); assert.match(s, /id: 'sharebtn'/); assert.match(s, /id: 'testacrossbtn'/);
  assert.match(s, /id: 'continuebtn', style: 'display:flex/);
  assert.doesNotMatch(s, /circuit\(s\) have/);
  const { formRef } = await import('../js/certmodel.js');
  assert.equal(formRef('Schedules'), 'schedules'); assert.equal(formRef('Schedule'), 'schedule'); assert.equal(formRef('A / B'), 'section A / B');
});
test('circuit page: presets saved quietly on a real leave; one S-type control; rarely used bits folded', () => {
  const s = src('schedule.js');
  assert.doesNotMatch(s, /as a device preset`, 3500/); assert.match(s, /function leaveCircuit\(now\)/); assert.match(s, /L\.hash === now/);
  assert.match(s, /\\u2713 Saved as a preset/);
  assert.doesNotMatch(s, /Time-delayed \(S-type\) RCD/); assert.match(s, /c\.rcdS = isSType\(v\)/);
  assert.match(s, /class: 'more circmore'/); assert.match(s, /class: 'more devmore'/); assert.match(s, /afddmore/);
  assert.match(s, /Fill the empty boxes on every circuit/);
});
test('jobs page has no second Settings gear; new job folds phone, email and notes', () => {
  const s = src('app.js');
  assert.doesNotMatch(s, /'aria-label': 'Settings', onclick: \(\) => go\('#\/settings'\)/);
  assert.match(s, /More details: phone, email, notes/);
});
test('Drive bin queue: one flush at a time, and ids added meanwhile are kept', () => {
  const s = src('certdelete.js');
  assert.match(s, /flushing\.then\(flushOnce, flushOnce\)/); assert.match(s, /editQueue\(\(now\) => now\.filter\(\(id\) => !done\.has\(id\)\)\)/); assert.match(src('jobdelete.js'), /queueTrash\(\[job\.driveFolderId\]\)/);
});
