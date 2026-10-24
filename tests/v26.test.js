// v0.26: saved test equipment, settings sync, job delete across devices, max demand working.
import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_VERSION } from '../js/config.js';
import { maxDemand, maxDemandLines, groupWork, EXAMPLE } from '../js/maxdemand.js';
import { mergeSettings, isEmptySetting } from '../js/settingsync.js';
import { planGone, needsPush } from '../js/syncmerge.js';
import { normInstruments, pickDefaults, instrumentsFor, INSTRUMENT_TAGS } from '../js/instruments.js';
import { mwInstruments } from '../js/pdf.js';

test('v0.26 version', () => assert.match(APP_VERSION, /^0\.2[6-9]\./));

test('max demand: two rings show the working', () => {
  const r = maxDemandLines([{ k: 'ring', qty: 2, value: 32 }]);
  assert.equal(r.lines[0].full, '2 × 32 A = 64 A · after diversity 44.8 A (32 A + 40% of 32 A)');
});
test('max demand: line shares add up to the total, combined groups say so', () => {
  const r = maxDemandLines(EXAMPLE); const sum = r.lines.reduce((s, x) => s + x.share, 0);
  assert.ok(Math.abs(sum - maxDemand(EXAMPLE).total) < 0.3, String(sum));
  const cook = r.groups.find((g) => g.g === 'cooking');
  assert.equal(cook.lines, 2); assert.equal(cook.work, '10 A + 30% of 33.5 A');
  assert.match(r.lines[0].full, /cooking, 2 lines combined/);
  for (const g of r.groups) { const s = r.lines.filter((l) => l.group === g.g).reduce((a, l) => a + l.share, 0); assert.ok(Math.abs(s - g.demand) < 0.15, g.g); }
});
test('max demand: sockets across lines, ring + radials', () => {
  const r = maxDemandLines([{ k: 'ring', qty: 1, value: 32 }, { k: 'radial', qty: 2, value: 16 }]);
  assert.equal(r.lines[0].share, 32); assert.equal(r.lines[1].share, 12.8);
  assert.equal(r.groups[0].work, '32 A + 40% of 32 A');
});
test('max demand: rules unchanged; zero qty; cooker socket; heating under 10 A', () => {
  assert.equal(groupWork('heating', [26.1, 26.1]), '10 A + 50% of 42.2 A');
  const r = maxDemandLines([{ k: 'heater', qty: 0, value: 2 }, { k: 'cookerSocket', qty: 1 }, { k: 'cooking', qty: 1, value: 2 }]);
  assert.match(r.lines[0].full, /nothing counted/);
  assert.equal(r.lines[1].share, 5);
  assert.equal(r.lines[2].share, 8.7);
  assert.equal(maxDemand([{ k: 'heater', qty: 6, value: 2 }]).total, 31.1);
  assert.equal(maxDemand([{ k: 'ring', qty: 2, value: 32 }]).total, 44.8);
});
test('max demand: names are optional and kept', () => {
  const loads = [{ k: 'cooking', qty: 1, value: 7, name: 'Hob' }, { k: 'cooking', qty: 1, value: 3 }];
  assert.equal(maxDemand(loads).total, maxDemand(loads.map(({ name, ...x }) => x)).total);
});

test('instruments: old shapes migrate', () => {
  const L = normInstruments([{ make: 'Megger', model: 'MFT1741', serial: '123' }, { make: 'Kewtech', serial: '9', kinds: 'rcd, ir' }, null]);
  assert.equal(L.length, 2); assert.ok(L[0].id); assert.deepEqual(L[0].kinds, []); assert.deepEqual(L[1].kinds, ['rcd', 'ir']);
  assert.deepEqual(normInstruments(undefined), []);
  assert.ok(INSTRUMENT_TAGS.some(([k]) => k === 'pfc') && INSTRUMENT_TAGS.some(([k]) => k === 'other'));
});
test('instruments: default per test, tagged first', () => {
  const L = [{ id: 'a', make: 'Megger', model: 'MFT', serial: '1', kinds: ['multi', 'continuity', 'ir', 'efli'] }, { id: 'b', make: 'Kew', model: 'RCD', serial: '2', kinds: ['rcd'] }, { id: 'c', make: 'Old', serial: '3', kinds: ['ir'], inUse: false }];
  const d = pickDefaults(L);
  assert.equal(d.ids.rcd, 'b'); assert.equal(d.ids.ir, 'a'); assert.equal(d.text.rcd, 'Kew RCD s/n 2'); assert.equal(d.ids.pfc, undefined);
  assert.deepEqual(instrumentsFor('rcd', L).map((i) => i.id), ['b', 'a', 'c']);
  assert.equal(mwInstruments({ instruments: { multi: 'Megger MFT s/n 1', ir: 'Megger MFT s/n 1', rcd: 'Kew RCD s/n 2' } }), 'Megger MFT s/n 1; Kew RCD s/n 2');
  assert.equal(mwInstruments({}), '');
});

test('settings sync: an empty device never wipes a filled one', () => {
  const phone = { values: { profile: { name: 'M', logo: 'data:x' }, mysig: 'data:sig', instruments: [{ id: 'a', make: 'Megger' }] }, stamps: { profile: '2026-10-20' } };
  const mac = { values: { profile: {}, mysig: null, instruments: [] }, stamps: { profile: '2026-10-24', mysig: '2026-10-24' } };
  const first = mergeSettings(phone, null); assert.equal(first.push, true);
  const remote = { values: first.values, stamps: first.stamps };
  const r = mergeSettings(mac, remote);
  assert.deepEqual(r.take.profile, phone.values.profile); assert.equal(r.take.mysig, 'data:sig'); assert.equal(r.take.instruments.length, 1);
  assert.ok(isEmptySetting('profile', {}) && isEmptySetting('instruments', [{ make: '' }]) && !isEmptySetting('mysig', 'x'));
});
test('settings sync: newest stamp wins per key', () => {
  const local = { values: { profile: { name: 'New' }, mysig: 'old', instruments: [] }, stamps: { profile: '2026-10-24T10:00', mysig: '2026-10-01' } };
  const remote = { values: { profile: { name: 'Old' }, mysig: 'newsig', instruments: [] }, stamps: { profile: '2026-10-23', mysig: '2026-10-22' } };
  const r = mergeSettings(local, remote);
  assert.equal(r.values.profile.name, 'New'); assert.equal(r.take.mysig, 'newsig'); assert.equal(r.push, true); assert.equal(r.take.profile, undefined);
});
test('settings sync: no stamps on either side merges without losing anything', () => {
  const r = mergeSettings({ values: { profile: { name: 'M', phone: '' } , instruments: [{ id: 'a', make: 'X' }] }, stamps: {} }, { values: { profile: { name: 'Old', company: 'Co' }, instruments: [{ id: 'b', make: 'Y' }] }, stamps: {} });
  assert.deepEqual(r.values.profile, { name: 'M', company: 'Co' }); assert.equal(r.values.instruments.length, 2);
  const same = mergeSettings({ values: r.values, stamps: r.stamps }, { values: r.values, stamps: r.stamps });
  assert.equal(same.push, false); assert.deepEqual(same.take, {});
  assert.equal(mergeSettings({ values: {}, stamps: {} }, null).push, false); // no empty file made
});

test('job deleted on another device', () => {
  const synced = { id: 'j', driveFolderId: 'f', driveJsonId: 'x', version: 3, backedUpVersion: 3 };
  assert.equal(planGone(synced, 'trashed'), 'delete');
  assert.equal(planGone(synced, 'missing'), 'delete');
  assert.equal(planGone(synced, 'error'), 'keep'); // a hiccup is never a delete
  assert.equal(planGone(synced, 'ok'), 'keep');
  assert.equal(planGone({ ...synced, version: 4 }, 'trashed'), 'keep-unsynced'); // changed here: keep it
  assert.equal(planGone({ id: 'n', version: 1 }, 'missing'), 'keep'); // never been on Drive
  assert.equal(needsPush({ ...synced, version: 4 }), true);
});

test('quiet sign-in renewal on open, and the 5-minute check-in', async () => {
  const { wantsQuietRefresh, POLL_EVERY } = await import('../js/syncmerge.js');
  assert.equal(POLL_EVERY, 300_000);
  assert.equal(wantsQuietRefresh({ online: true, enabled: true, hint: 'a@b', tokenLeft: 0 }), true);
  assert.equal(wantsQuietRefresh({ online: true, enabled: true, hint: 'a@b', tokenLeft: 30 * 60_000 }), false);
  assert.equal(wantsQuietRefresh({ online: false, enabled: true, hint: 'a@b', tokenLeft: 0 }), false);
  assert.equal(wantsQuietRefresh({ online: true, enabled: true, hint: '', tokenLeft: 0 }), false);
  assert.equal(wantsQuietRefresh({ online: true, enabled: true, hint: 'a@b', tokenLeft: 0, sinceLast: 1000 }), false);
});
