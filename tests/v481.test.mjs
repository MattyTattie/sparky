// v0.48.1 (local): sockets drawn IN line on the cable; DP switches on the spur list (like FCUs). Made-up data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layout, diagramModel, diagramSvg, addSpur, updateSpur, circuitSpurList, spurLabel, inRingSeq, spurInRing, canSitInRing,
  spurLoadsFor, DP_LOADS, SPUR_DEVICES, spurNeedsLoad, spurSymbolOf, spurLoadKind, roomPointsNote, diagramPointTotal, spurListTotal } from '../js/wiring.js';
import { diagramEIC, diagramMW, diagramMWSpur, diagramEICContactors, diagramEICExtras, diagramEICRooms, diagramEICPro, diagramEICSwitches } from './diagram-sample.mjs';
import { textSymbolOverlaps, hangingSocketTicks, linesThroughPlates, textBBox } from './shape_overlap.mjs';

import { readFileSync } from 'node:fs';
const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
test('v0.48.1 version and SW cache', () => {
  assert.match(src('js/config.js'), /APP_VERSION = '0\.48\.1 beta'/);
  assert.match(src('sw.js'), /const CACHE = 'sparky-v0\.48\.1'/);
});
test('spur editor: It feeds follows the device (DP: every socket type and appliances)', () => {
  const s = src('js/schedule.js');
  assert.match(s, /spurLoadsFor\(s\.device\)\.map/);
  assert.doesNotMatch(s, /SPUR_LOADS\.map/);
});
const OPTS = [{ W: 380, font: 12, screen: true }, { W: 1100, font: 14, screen: true }, { W: 560, font: 11 }];
const mk = (num, desc, extra = {}) => ({ num, desc, device: 'mcb', type: 'B', rating: '32', live: '2.5', cpc: '1.5', ...extra });
const cert = (cs) => ({ type: 'EIC', boards: [{ id: 'b', ref: 'DB1', circuits: cs }] });
const lay = (c, o) => layout(diagramModel(c), o);
const circ = (c, o) => lay(c, o).blocks.filter((b) => b.kind === 'circuit');
const near = (a, b, e = 0.6) => Math.abs(a - b) < e;
const hops = (sh) => sh.filter((z) => z.t === 'line' && z.hop);
const white = (z) => z.t === 'rect' && z.fill && z.fill[0] === 255 && z.fill[1] === 255;
// socket faceplates: white, wider than tall (twin ~2.2:1, single ~1.15:1), the right size
const sockPlates = (sh) => sh.filter((z) => white(z) && z.h > 10 && z.h < 22 && z.w > z.h + 1 && z.w < 42);
const isDpPlate = (sh, p) => sh.some((t) => t.t === 'text' && t.txt === 'DP' && t.x > p.x && t.x < p.x + p.w && t.y > p.y && t.y < p.y + p.h + 1);
const dpPlates = (sh) => sh.filter((z) => white(z) && Math.abs(z.w - z.h) < 0.5 && z.h > 12 && z.h < 22 && isDpPlate(sh, z));
const clean = (c, label) => {
  for (const o of OPTS) for (const b of circ(c, o)) {
    const sh = b.shapes || [];
    assert.equal(textSymbolOverlaps(sh).length, 0, `${label} W=${o.W} c${b.num}: text on a symbol: ` + textSymbolOverlaps(sh).map((h) => h.txt).join('; '));
    assert.equal(hangingSocketTicks(sh).length, 0, `${label} W=${o.W} c${b.num}: tick on a hanging socket`);
    assert.equal(linesThroughPlates(sh).length, 0, `${label} W=${o.W} c${b.num}: a cable runs across a faceplate`);
  }
};
// the cable meets a plate's left and right sides at its mid-height
const inLine = (sh, p) => {
  const y = p.y + p.h / 2, L = sh.filter((z) => z.t === 'line' && near(z.y1, y, 0.8) && near(z.y2, y, 0.8));
  const left = L.some((z) => near(Math.max(z.x1, z.x2), p.x, 1.5) || (Math.min(z.x1, z.x2) < p.x - 1 && Math.max(z.x1, z.x2) >= p.x - 0.6 && Math.max(z.x1, z.x2) <= p.x + 0.6));
  const right = L.some((z) => near(Math.min(z.x1, z.x2), p.x + p.w, 1.5));
  return { left, right };
};

test('inline sockets: a hairpin ring runs into and out of every socket faceplate; nothing across a face', () => {
  const c = cert([mk('1', 'Downstairs sockets', { ring: true, points: '9' })]);
  for (const o of OPTS) {
    const sh = circ(c, o)[0].shapes; const ps = sockPlates(sh);
    assert.equal(ps.length, 9, 'W=' + o.W);
    for (const p of ps) { const r = inLine(sh, p); assert.ok(r.left && r.right, `W=${o.W}: socket at ${p.x.toFixed(0)},${p.y.toFixed(0)} in line (${JSON.stringify(r)})`); }
    assert.equal(linesThroughPlates(sh).length, 0);
  }
});

test('inline sockets: the last hairpin row sits on the lower leg, so spurs off it drop clear and cross nothing', () => {
  for (const pts of ['4', '9', '12']) {
    const r = mk('1', 'Ring', { ring: true, points: pts, diagram: { spurList: [] } });
    addSpur(r, { device: 'socket1' }); addSpur(r, { device: 'sfcu', load: 'towel' }); addSpur(r, { device: 'dp20', load: 'washer' });
    for (const o of OPTS) {
      const sh = circ(cert([r]), o)[0].shapes;
      assert.equal(hops(sh).length, 0, `${pts} sockets W=${o.W}: no crossings (spurs drop off the bottom row)`);
      const ps = sockPlates(sh); const ringPs = ps.filter((p) => inLine(sh, p).left);
      const lowest = Math.max(...ringPs.map((p) => p.y));
      // every spur's drop starts at the bottom edge of a bottom-row socket
      const drops = sh.filter((z) => z.t === 'line' && near(z.x1, z.x2) && ringPs.some((p) => near(p.y, lowest, 1) && near(Math.min(z.y1, z.y2), p.y + p.h, 0.8) && z.x1 > p.x && z.x1 < p.x + p.w));
      assert.ok(drops.length >= 2, `${pts} W=${o.W}: spur drops leave socket bottoms (${drops.length})`);
    }
    clean(cert([r]), 'ring ' + pts);
  }
});

test('inline sockets: radials, singles, unswitched and outdoor (IP) sockets are in line too', () => {
  const c = cert([
    mk('1', 'Kitchen sockets', { rating: '20', points: '5', diagram: { singles: 2, unsw: 1 } }),
    mk('2', 'Garden sockets', { rating: '20', diagram: { roomList: [{ name: 'Garden', sockets: 2, singles: 1 }] } }),
    mk('3', 'Ring', { ring: true, diagram: { roomList: [{ name: 'Hall', sockets: 2 }, { name: 'Outside', sockets: 1, singles: 1 }] } }),
  ]);
  for (const o of OPTS) for (const b of circ(c, o)) {
    const sh = b.shapes; const ps = sockPlates(sh).filter((p) => !isDpPlate(sh, p));
    assert.ok(ps.length >= 3, 'c' + b.num);
    for (const p of ps) assert.ok(inLine(sh, p).left, `c${b.num} W=${o.W}: cable into socket at ${p.x.toFixed(0)},${p.y.toFixed(0)}`);
    if (b.num !== '1') assert.ok(sh.some((t) => t.t === 'text' && t.txt === 'IP'), 'outdoor badge');
  }
  clean(c, 'radials/rooms');
});

test('inline sockets: rooms ring like Matthew\'s (Hall, Utility DP + switched single, Outside IP) draws clean', () => {
  const c = cert([mk('1', 'Ring final', { ring: true, diagram: { roomList: [{ name: 'Hall', sockets: 2 }, { name: 'Utility', sockets: 1, dpsws: 1 }, { name: 'Outside', sockets: 1 }] } })]);
  for (const o of OPTS) {
    const sh = circ(c, o)[0].shapes;
    const dp = dpPlates(sh); assert.equal(dp.length, 1, 'the old DP + switched socket count still draws its DP');
    const r = inLine(sh, dp[0]); assert.ok(r.left && r.right, 'DP in line');
    assert.equal(hops(sh).length, 0, 'nothing crosses');
  }
  clean(c, 'rooms ring');
});

test('inline sockets: on a rooms ring with spurs, the last room\'s sockets sit on the way back so the drops cross nothing', () => {
  const r = mk('1', 'Ring', { ring: true, diagram: { roomList: [{ name: 'Hall', sockets: 2 }, { name: 'Utility', sockets: 2 }], spurList: [] } });
  addSpur(r, { device: 'dp20', load: 'socket1', place: 'in', after: '3' }); addSpur(r, { device: 'socket1' });
  for (const o of OPTS) assert.equal(hops(circ(cert([r]), o)[0].shapes).length, 0, 'W=' + o.W);
  clean(cert([r]), 'rooms ring + spurs');
});

test('DP switch on the spur list: devices, what it feeds (every socket type or an appliance), optional fields', () => {
  assert.ok(SPUR_DEVICES.some(([k]) => k === 'dp20') && SPUR_DEVICES.some(([k]) => k === 'dp45'));
  assert.ok(spurNeedsLoad('dp20') && spurNeedsLoad('dp45') && canSitInRing('dp20') && canSitInRing('dp45') && !canSitInRing('socket1'));
  const keys = spurLoadsFor('dp20').map(([k]) => k);
  for (const k of ['socket1', 'socket1u', 'socket', 'socketu', 'ipsock1', 'ipsock', 'washer', 'dishwasher', 'boiler', 'cooker', 'other']) assert.ok(keys.includes(k), k);
  assert.deepEqual(spurLoadsFor('dp45'), DP_LOADS);
  assert.ok(!spurLoadsFor('fcu').some(([k]) => k === 'socket1'), 'an FCU list is unchanged');
  const c = mk('1', 'Ring', { ring: true, points: '6', diagram: { spurList: [] } });
  const id = addSpur(c, { device: 'dp20', load: 'socket1', place: 'in', after: '2' });
  assert.deepEqual({ ...c.diagram.spurList[0], id: 'x' }, { id: 'x', device: 'dp20', load: 'socket1', place: 'in', after: '2' });
  assert.equal(spurInRing(circuitSpurList(c)[0]), true);
  assert.deepEqual(inRingSeq(c, Array(6).fill('socket')).kinds, ['socket', 'socket', 'dpin', 'socket', 'socket', 'socket', 'socket']);
  assert.equal(spurLabel(circuitSpurList(c)[0], c), '20 A DP switch in the ring \u2192 Single socket (switched)');
  assert.equal(spurSymbolOf(circuitSpurList(c)[0]), 'dpsw'); assert.equal(spurLoadKind(circuitSpurList(c)[0]), 'socket1');
  updateSpur(c, id, { load: 'ipsock' }); assert.equal(spurLoadKind(circuitSpurList(c)[0]), 'socket');
  updateSpur(c, id, { load: 'cooker' }); assert.equal(spurLoadKind(circuitSpurList(c)[0]), 'cooker');
  updateSpur(c, id, { load: 'washer' }); assert.equal(spurLoadKind(circuitSpurList(c)[0]), 'appliance');
  updateSpur(c, id, { place: '' }); assert.equal(spurLabel(circuitSpurList(c)[0], c), 'Spur: 20 A DP switch \u2192 Washing machine');
  assert.equal('after' in c.diagram.spurList[0], false);
  // switching device: a load the new device can't feed is dropped; one it can is kept
  updateSpur(c, id, { device: 'dp45', load: 'socketu' }); updateSpur(c, id, { device: 'fcu' }); assert.equal('load' in c.diagram.spurList[0], false, 'an FCU does not feed a socket');
  updateSpur(c, id, { load: 'boiler' }); updateSpur(c, id, { device: 'dp20' }); assert.equal(c.diagram.spurList[0].load, 'boiler', 'both feed a boiler');
  updateSpur(c, id, { device: 'socket1' }); assert.equal('load' in c.diagram.spurList[0], false);
});

test('DP switch: points count once each, in or off the ring, no double counting', () => {
  const c = mk('1', 'Ring', { ring: true, points: '6', diagram: { spurList: [] } });
  addSpur(c, { device: 'dp20', load: 'socket', place: 'in' }); addSpur(c, { device: 'fcu', load: 'boiler', place: 'in' }); addSpur(c, { device: 'dp45', load: 'cooker' });
  assert.equal(spurListTotal(c), 3); assert.equal(diagramPointTotal(c), 9);
  assert.equal(roomPointsNote(c), 'Points served: 6 + 1 spur + 1 FCU + 1 DP switch in the ring = 9?');
  const r = mk('2', 'Kitchen', { rating: '20', points: '3', diagram: { spurList: [] } });
  addSpur(r, { device: 'dp20', load: 'washer', place: 'in' }); addSpur(r, { device: 'dp20', load: 'dishwasher', place: 'in' });
  assert.equal(roomPointsNote(r), 'Points served: 3 + 2 DP switches in the radial = 5?');
});

test('DP switch drawn: in line in the ring with what it feeds hanging off its bottom; spurred off a socket too', () => {
  for (const [load, wantSock, ip] of [['socket1', true, false], ['socketu', true, false], ['ipsock1', true, true], ['washer', false, false], ['cooker', false, false]]) {
    for (const place of ['in', '']) {
      const c = mk('1', 'Ring', { ring: true, points: '6', diagram: { spurList: [] } }); addSpur(c, { device: 'dp20', load, place, after: '3' });
      for (const o of OPTS) {
        const L = lay(cert([c]), o); const sh = L.blocks.find((b) => b.kind === 'circuit').shapes;
        const dp = dpPlates(sh); assert.equal(dp.length, 1, `${load}/${place || 'spur'} W=${o.W}: one DP plate`);
        const p = dp[0], cx = p.x + p.w / 2;
        if (place) { const r = inLine(sh, p); assert.ok(r.left && r.right, `${load} W=${o.W}: DP in line in the ring`); }
        else assert.ok(sh.some((z) => z.t === 'line' && near(z.x1, cx) && near(z.x2, cx) && near(Math.max(z.y1, z.y2), p.y)), `${load} W=${o.W}: spur drop into the DP's top`);
        // v0.48.1: off the bottom row the load drops down; off an upper row (in-ring DP after socket 3) it goes UP
        const fromBot = sh.find((z) => z.t === 'line' && near(z.x1, cx) && near(z.x2, cx) && near(Math.min(z.y1, z.y2), p.y + p.h, 0.8));
        const fromTop = place && sh.find((z) => z.t === 'line' && near(z.x1, cx) && near(z.x2, cx) && near(Math.max(z.y1, z.y2), p.y, 0.8));
        assert.ok(fromBot || fromTop, `${load}/${place || 'spur'} W=${o.W}: the load's line leaves the DP's bottom (or top, going up)`);
        assert.equal(hops(sh).length, 0, `${load}/${place || 'spur'} W=${o.W}: nothing crosses`);
        if (wantSock) {
          const off = sockPlates(sh).filter((q) => !inLine(sh, q).left && q.x < cx && q.x + q.w > cx);
          assert.equal(off.length, 1, `${load} W=${o.W}: one socket off the DP`); const q = off[0];
          if (fromBot && !fromTop) assert.ok(q.y > p.y + p.h && sh.some((z) => z.t === 'line' && near(z.x1, cx) && near(Math.max(z.y1, z.y2), q.y, 0.8)), 'hangs below, fed into its top');
          else assert.ok(q.y + q.h < p.y && sh.some((z) => z.t === 'line' && near(z.x1, cx) && near(Math.min(z.y1, z.y2), q.y + q.h, 0.8)), 'stands above, fed into its bottom'); }
        assert.equal(sh.some((t) => t.t === 'text' && t.txt === 'IP'), ip, `${load}: IP badge only for an outdoor socket`);
        assert.ok(sh.some((t) => t.t === 'text' && /20 A DP switch/.test(t.txt)), 'labelled');
        const kt = L.blocks.find((b) => b.kind === 'legend').shapes.filter((z) => z.t === 'text').map((z) => z.txt).join(' ');
        assert.match(kt, /DP switch \(20 A \/ 45 A\)/); assert.doesNotMatch(kt, /Local switch \/ isolator/);
      }
      clean(cert([c]), `DP ${load} ${place || 'spur'}`);
    }
  }
});

test('old data still draws: room DP counts, spur lists without the new fields, every sample fixture', () => {
  // old dpsw / dpsws room counts: DP in line, its socket up and over
  const c = cert([mk('1', 'Garage sockets', { rating: '20', diagram: { roomList: [{ name: 'Garage', sockets: 1, dpsw: 1, dpsws: 1 }] } })]);
  for (const o of OPTS) assert.equal(dpPlates(circ(c, o)[0].shapes).length, 2);
  clean(c, 'old DP counts');
  const old = mk('2', 'Ring', { ring: true, points: '5', diagram: { spurList: [{ id: 'o1', device: 'fcu', load: 'boiler' }, { id: 'o2', device: 'socket1', from: '2' }] } });
  assert.equal(circuitSpurList(old).every((s) => !s.place), true);
  clean(cert([old]), 'old spur list');
  for (const [name, f] of Object.entries({ diagramEIC, diagramMW, diagramMWSpur, diagramEICContactors, diagramEICExtras, diagramEICRooms, diagramEICPro, diagramEICSwitches })) {
    const cr = f();
    for (const o of OPTS) {
      for (const b of lay(cr, o).blocks.filter((x) => x.kind === 'circuit')) {
        assert.equal(linesThroughPlates(b.shapes).length, 0, `${name} W=${o.W} c${b.num}: cable across a faceplate`);
        assert.equal(textSymbolOverlaps(b.shapes).length, 0, `${name} W=${o.W} c${b.num}: text on symbol`);
      }
      assert.match(diagramSvg(cr, o), /^<svg/);
    }
  }
});

test('upper hairpin rows: loads and spurs go UP above their row; zero hops; labels clear of the title and the plates', () => {
  const r = mk('1', 'Ring final: downstairs sockets', { ring: true, points: '8', diagram: { spurList: [] } });
  addSpur(r, { device: 'fcu', load: 'boiler', place: 'in', after: '6' }); addSpur(r, { device: 'dp20', load: 'socket1u', place: 'in', after: '2' });
  addSpur(r, { device: 'socket1' }); addSpur(r, { device: 'sfcu', load: 'towel' });
  const r2 = mk('2', 'Ring big', { ring: true, points: '14', diagram: { spurList: [] } }); // three rows: a middle row too
  addSpur(r2, { device: 'dp45', load: 'washer', place: 'in', after: '1' }); updateSpur(r2, addSpur(r2, { device: 'socket1' }), { from: '6' }); addSpur(r2, { device: 'sfcu', load: 'heater', place: 'in', after: '7' }); updateSpur(r2, addSpur(r2, { device: 'dp20', load: 'ipsock1' }), { from: '12' });
  for (const c of [r, r2]) for (const o of OPTS) {
    const sh = circ(cert([c]), o)[0].shapes;
    assert.equal(hops(sh).length, 0, `c${c.num} W=${o.W}: no crossings`);
    const texts = sh.filter((z) => z.t === 'text');
    const lab = texts.filter((t) => /in the ring|\u2192|Single socket/.test(t.txt));
    for (const t of lab) for (const u of texts) { if (u === t) continue; const a = textBBox(t), b = textBBox(u);
      const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      assert.ok(ix <= 0.5 || iy <= 0.5, `c${c.num} W=${o.W}: "${t.txt}" overlaps "${u.txt}"`); }
  }
  clean(cert([r, r2]), 'up spurs');
  // the in-ring DP on the top row at 380: its socket stands above the ring
  const sh = circ(cert([r]), OPTS[0])[0].shapes; const dp = dpPlates(sh)[0];
  assert.ok(sockPlates(sh).some((q) => q.y + q.h < dp.y && q.x < dp.x + dp.w && q.x + q.w > dp.x), 'DP load above its row');
});
