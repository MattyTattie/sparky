import test from 'node:test'; import assert from 'node:assert';
import { mergeSettings } from '../js/settingsync.js';
const LOGO = 'data:image/png;base64,AAAA';
test('newer Mac details without logo keep the phone logo', () => {
  const phone = { values: { profile: { name: 'A', logo: LOGO } }, stamps: { profile: '2026-01-01' } };
  const mac = { values: { profile: { name: 'A', phone: '1' } }, stamps: { profile: '2026-02-01' } };
  const r = mergeSettings(mac, phone);
  assert.equal(r.values.profile.logo, LOGO); assert.equal(r.values.profile.phone, '1');
  assert.equal(r.take.profile.logo, LOGO); assert.ok(r.push);
  const r2 = mergeSettings(phone, { values: r.values, stamps: r.stamps });
  assert.equal(r2.values.profile.logo, LOGO);
});
test('pre-sync phone (no stamp) logo survives a stamped Mac profile', () => {
  const r = mergeSettings({ values: { profile: { name: 'A' } }, stamps: { profile: '2026-02-01' } }, { values: { profile: { name: 'A', logo: LOGO } }, stamps: {} });
  assert.equal(r.values.profile.logo, LOGO);
});
