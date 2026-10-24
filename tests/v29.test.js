// v0.29.0: calibration-date warning, tap areas, wider desktop schedule, labels for screen readers,
// audit fixes, T&E method A 2.5 mm² = 18.5 A, fault-level tidy-up and more reference methods.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_VERSION } from '../js/config.js';
import { looksLikeCalDate, calDateFields } from '../js/instruments.js';
import { CABLES, CABLE_PICKS, REF_METHODS, METHODS_FOR_PICK } from '../js/cables.js';
import { faultLevel } from '../js/calcextra.js';
import { cableCheck } from '../js/checks.js';
const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('version 0.29.0', () => { assert.match(APP_VERSION, /^0\.29\.0/); assert.match(read('sw.js'), /sparky-v0\.29\.0/); assert.match(read('sw.js'), /"\.\/js\/a11y\.js"/); });
test('calibration date typed into instrument text is spotted', () => {
  for (const t of ['MFT1741 cal. 2026-03-01', 'cal due 03/26', '12/03/2026', 'Mar 2026', 'calibrated Jan 26']) assert.equal(looksLikeCalDate(t), true, t);
  for (const t of ['', 'Megger MFT1741+', 'Kewtech tester', 's/n 101/2345', 'Fluke 1664FC s/n AB1234', 'Model 2021']) assert.equal(looksLikeCalDate(t), false, t);
  assert.deepEqual(calDateFields({ a: 'Megger', b: 'cal 01/27' }), ['b']);
  assert.match(read('js/app.js'), /calwarn/); assert.match(read('js/certui.js'), /calwarn/);
});
test('term links get a 44px tap area on phones', () => assert.match(read('styles.css'), /\.sym::after \{[^}]*height: 44px/));
test('no CSS ellipsis anywhere; desktop schedule full width', () => {
  for (const f of ['styles.css', 'desktop.css', 'dark.css']) assert.ok(!/text-overflow:\s*ellipsis/.test(read(f)), f);
  assert.match(read('desktop.css'), /main\.wide table\.sched \{ width: 100%/);
});
test('boards section link redirects', () => assert.match(read('js/certui.js'), /s\.special === 'boards'\) return go\(`#\/cert\/\$\{id\}\/boards`\)/));
test('screen-reader labels pass runs on every render', () => { assert.match(read('js/app.js'), /labelInputs\(root\)/); assert.match(read('js/a11y.js'), /aria-label/); });
test('T&E method A 2.5 mm² is 18.5 A, 102 stays 21 A', () => { assert.equal(CABLES.te.methods.A.amps[2.5], 18.5); assert.equal(CABLES.te.methods[102].amps[2.5], 21); });
test('fault level: blank start, working in ohms, larger of PSCC and PEFC', () => {
  assert.match(read('js/calcmore.js'), /FL_DEFAULTS = \{ phase: '1', pfc: '', ze: ''/);
  const r = faultLevel({ pfc: 16, ze: 0.35, cable: 'swa', size: 16, length: 20, armour: true, deviceKa: 6 });
  assert.equal(r.ok, true); assert.equal(r.worst, Math.max(r.pscc, r.pefc)); assert.ok(r.r1rn > 0 && r.r1r2 > 0 && r.zeSub > 0.35);
  assert.equal(r.which, r.pefc > r.pscc ? 'PEFC' : 'PSCC');
  assert.match(read('js/calcmore.js'), /breakers: \$\{r\.pass \? 'OK'/); assert.match(read('js/calcmore.js'), /as Ipf on/);
  assert.equal(faultLevel({ pfc: '', ze: '' }).ok, false);
});
test('new reference methods from Appendix 4', () => {
  assert.equal(CABLES.swa.methods.E.amps[2.5], 31); assert.equal(CABLES.swa.methods.D2.amps[16], 83); assert.equal(CABLES.swa.methods.D.amps[16], 78);
  assert.equal(CABLES.swaX.methods.E.amps[2.5], 39); assert.equal(CABLES.swaX.methods.D2.amps[16], 100);
  assert.equal(CABLES.swa4.methods.E.amps[16], 83); assert.equal(CABLES.swa4X.methods.D2.amps[25], 107);
  assert.equal(CABLES.singles.methods.F.amps[25], 131); assert.equal(CABLES.singles.methods.G.amps[35], 181); assert.equal(CABLES.tails.methods.F.amps[25], 131);
  assert.equal(CABLES.singlesX.methods.C.amps[1.5], 25); assert.equal(CABLES.singles.methods.A.amps[2.5], 20);
  for (const k of ['micL', 'micH', 'fp200']) { assert.equal(CABLES[k].typical, true); assert.ok(CABLE_PICKS[Object.keys(CABLE_PICKS).find((p) => CABLE_PICKS[p].calc === k)]); }
  for (const c of ['swa', 'swaX', 'swa4', 'swa4X', 'singles', 'singlesX', 'tails', 'micL', 'micH', 'fp200'].map((k) => CABLES[k])) for (const m of Object.values(c.methods)) for (const s of Object.keys(m.amps)) assert.ok(c.sizes.map(String).includes(s));
});
test('cert schedule lists only methods that suit the cable', () => {
  assert.deepEqual(METHODS_FOR_PICK('swa2').map(([k]) => k), ['C', 'D1', 'D2', 'E']);
  assert.ok(METHODS_FOR_PICK('te').every(([k]) => !['D1', 'D2', 'E', 'F', 'G'].includes(k)));
  assert.equal(METHODS_FOR_PICK(''), null);
  assert.ok(REF_METHODS.some(([k]) => k === 'D1') && REF_METHODS.some(([k]) => k === 'D2'));
  assert.match(read('js/schedule.js'), /codeSel\('ref', refMethodsFor\(c\)/);
});
test('D1 and D2 give their own ratings; old D still works', () => {
  const base = { cable: 'swa2', live: '16', rating: '63', wiring: 'F' };
  assert.match(cableCheck({ ...base, ref: 'D1' }).msg, /78 A/); assert.match(cableCheck({ ...base, ref: 'D2' }).msg, /83 A/); assert.match(cableCheck({ ...base, ref: 'D' }).msg, /78 A/);
});
