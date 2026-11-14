// v0.48.0 (local): an FCU / SFCU sitting IN the ring or radial, not spurred off it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layout, diagramModel, addSpur, updateSpur, circuitSpurList, spurLabel, inRingSeq, inRingSpurs, spurInRing, spurAfterOptions,
  roomPointsNote, diagramPointTotal, setPointsToDiagramTotal, drawnPointCount, spurListTotal } from '../js/wiring.js';
import { textSymbolOverlaps, hangingSocketTicks, textBBox } from './shape_overlap.mjs';

const lay = (cs, W = 380) => layout(diagramModel({ type: 'EIC', boards: [{ id: 'b', ref: 'DB1', circuits: cs }] }), { W, font: W > 500 ? 14 : 12, screen: true });
const blocks = (cs, W) => lay(cs, W).blocks.filter((b) => b.kind === 'circuit');
const clean = (cs, label, W = 380) => {
  for (const b of blocks(cs, W)) {
    const sh = b.shapes || [];
    const hits = textSymbolOverlaps(sh);
    assert.equal(hits.length, 0, label + ' W=' + W + ' circuit ' + b.num + ' text on symbol: ' + hits.map((h) => '"' + h.txt + '"').join('; '));
    assert.equal(hangingSocketTicks(sh).length, 0, label + ' W=' + W + ' hanging tick');
  }
};
const ring = (pts = '8') => ({ num: '1', desc: 'Downstairs sockets', ring: true, rating: '32', live: '2.5', cpc: '1.5', points: pts, device: 'mcb', type: 'B', diagram: { spurList: [] } });
const radial = (pts = '4') => ({ num: '2', desc: 'Kitchen sockets', ring: false, rating: '20', live: '2.5', cpc: '1.5', points: pts, device: 'mcb', type: 'B', diagram: { spurList: [] } });
const near = (a, b, e = 0.6) => Math.abs(a - b) < e;
// small square white plates = FCU faceplates (twin/single socket plates are wider)
// (a fixed-appliance box is a white square too, but has no fuse carrier drawn inside)
const fcuPlates = (sh) => sh.filter((z) => z.t === 'rect' && z.fill && z.fill[0] === 255 && Math.abs(z.w - z.h) < 0.5 && z.h > 12 && z.h < 18
  && sh.some((q) => q.t === 'line' && Math.abs(q.y1 - q.y2) < 0.01 && q.y1 > z.y + 1 && q.y1 < z.y + z.h - 1
    && Math.min(q.x1, q.x2) > z.x && Math.max(q.x1, q.x2) < z.x + z.w)); // the fuse carrier

test('FCU in the ring: optional fields, cleaned up when they no longer apply', () => {
  const c = ring();
  const a = addSpur(c, { device: 'fcu', load: 'boiler', place: 'in', after: '3' });
  const b = addSpur(c, { device: 'socket1', place: 'in', after: '2' }); // only an FCU/SFCU can sit in the ring
  const raw = c.diagram.spurList;
  assert.deepEqual({ ...raw[0], id: 'x' }, { id: 'x', device: 'fcu', load: 'boiler', place: 'in', after: '3' });
  assert.equal(raw[1].place, undefined); assert.equal(raw[1].after, undefined);
  assert.equal(spurInRing(circuitSpurList(c)[0]), true);
  assert.equal(spurInRing(circuitSpurList(c)[1]), false);
  updateSpur(c, a, { after: '' }); assert.equal('after' in raw[0], false, 'empty after removed (= at the end)');
  updateSpur(c, a, { after: '0' }); assert.equal(raw[0].after, '0', 'before socket 1 is kept');
  updateSpur(c, a, { place: '' }); assert.equal('place' in raw[0], false); assert.equal('after' in raw[0], false);
  updateSpur(c, a, { place: 'in', after: '2' }); updateSpur(c, a, { device: 'socket1' });
  assert.equal('place' in raw[0], false, 'not an FCU any more: place dropped'); assert.equal('after' in raw[0], false);
  // an old item (no place) is an ordinary spur
  const old = ring(); old.diagram.spurList = [{ id: 'o', device: 'fcu', load: 'boiler' }];
  assert.equal(inRingSpurs(old).length, 0); assert.equal(spurLabel(circuitSpurList(old)[0]), 'Spur: Unswitched FCU \u2192 Boiler');
  void b;
});

test('FCU in the ring: position in the run (after socket N, default the end)', () => {
  const c = ring('4');
  const id = addSpur(c, { device: 'fcu', load: 'boiler', place: 'in', after: '3' });
  const base = ['socket', 'socket', 'socket', 'socket'];
  assert.deepEqual(inRingSeq(c, base).kinds, ['socket', 'socket', 'socket', 'fcuin', 'socket']);
  assert.deepEqual(inRingSeq(c, base).ids, ['', '', '', id, '']);
  updateSpur(c, id, { after: '' }); assert.deepEqual(inRingSeq(c, base).kinds.slice(-1), ['fcuin']);
  updateSpur(c, id, { after: '0' }); assert.deepEqual(inRingSeq(c, base).kinds[0], 'fcuin');
  updateSpur(c, id, { after: '99' }); assert.deepEqual(inRingSeq(c, base).kinds.slice(-1), ['fcuin'], 'clamped to the end');
  // two after the same socket keep their order; neither counts as a socket for the other
  updateSpur(c, id, { after: '1' }); addSpur(c, { device: 'sfcu', load: 'towel', place: 'in', after: '1' });
  assert.deepEqual(inRingSeq(c, base).kinds, ['socket', 'fcuin', 'sfcuin', 'socket', 'socket', 'socket']);
  const opts = spurAfterOptions(c).map((o) => o.label);
  assert.deepEqual(opts, ['At the end', 'Before socket 1', 'After socket 1', 'After socket 2', 'After socket 3', 'After socket 4']);
});

test('FCU in the ring is drawn ON the cable (passes through it) with its load hanging off it', () => {
  for (const [mk, word, after] of [[ring, 'ring', ''], [ring, 'ring', '7'], [radial, 'radial', '2']]) { // a radial ends at its last point, so test one mid-run
    for (const W of [380, 1100, 1440]) {
      const c = mk(); addSpur(c, { device: 'fcu', load: 'boiler', place: 'in', after });
      const sh = blocks([c], W)[0].shapes;
      const plates = fcuPlates(sh);
      assert.equal(plates.length, 1, word + ' W=' + W + ': one FCU plate, got ' + plates.length);
      const p = plates[0], cx = p.x + p.w / 2;
      const lines = sh.filter((z) => z.t === 'line');
      // the run's cable passes over the plate, and drops into its top centre like a socket
      const over = lines.filter((z) => near(z.y1, z.y2) && z.y1 < p.y && p.y - z.y1 < 6 && Math.min(z.x1, z.x2) < cx - 3 && Math.max(z.x1, z.x2) > cx + 3);
      assert.ok(over.length, word + ' W=' + W + ': cable over the FCU');
      const cableY = over[0].y1;
      // cable continues on both sides (it is in the run, not at a spur's end)
      assert.ok(lines.some((z) => near(z.y1, cableY) && near(z.y2, cableY) && Math.max(z.x1, z.x2) <= cx - 3 && Math.max(z.x1, z.x2) > cx - 14), word + ': cable into the FCU from the left');
      assert.ok(lines.some((z) => near(z.y1, cableY) && near(z.y2, cableY) && Math.min(z.x1, z.x2) >= cx + 3 && Math.min(z.x1, z.x2) < cx + 14), word + ': cable out of the FCU to the right');
      assert.ok(lines.some((z) => near(z.x1, cx) && near(z.x2, cx) && near(Math.min(z.y1, z.y2), cableY) && near(Math.max(z.y1, z.y2), p.y)), word + ': drop into the plate top');
      // the load's line leaves the bottom of the FCU plate
      const drop = lines.find((z) => near(z.x1, cx) && near(z.x2, cx) && near(Math.min(z.y1, z.y2), p.y + p.h, 1));
      assert.ok(drop, word + ' W=' + W + ': load line from the FCU plate bottom');
      // its label: to the right of the load, names the ring/radial
      const labs = sh.filter((z) => z.t === 'text' && /in the/.test(z.txt));
      assert.ok(labs.length, word + ': label');
      const lb = textBBox(labs[0]);
      assert.ok(lb.x > cx + 4, word + ': label to the right');
      assert.ok(sh.some((z) => z.t === 'text' && new RegExp('in the ' + word).test(z.txt)) || sh.some((z) => z.t === 'text' && z.txt === word), word + ' named');
      clean([c], word, W);
    }
  }
});

test('FCU in the ring: clean at 380/1100/1440 alongside ordinary spurs, upper row, SFCU, no load, before socket 1', () => {
  const cases = [];
  { const c = ring(); addSpur(c, { device: 'fcu', load: 'boiler', place: 'in', after: '3' }); addSpur(c, { device: 'socket1' }); cases.push(['upper-row FCU + spur', c]); }
  { const c = ring(); addSpur(c, { device: 'fcu', load: 'boiler', place: 'in', after: '7' }); addSpur(c, { device: 'socket1' }); addSpur(c, { device: 'sfcu', load: 'towel' }); cases.push(['lower-row FCU + 2 spurs', c]); }
  { const c = ring('6'); addSpur(c, { device: 'sfcu', load: 'towel', place: 'in' }); cases.push(['SFCU at end', c]); }
  { const c = ring('6'); addSpur(c, { device: 'sfcu', place: 'in', after: '0' }); cases.push(['SFCU, no load, before 1', c]); }
  { const c = ring('10'); addSpur(c, { device: 'fcu', load: 'boiler', place: 'in', after: '2' }); addSpur(c, { device: 'sfcu', load: 'hood', place: 'in', after: '8' }); addSpur(c, { device: 'socket1', from: 'jb' }); cases.push(['two in the ring + JB spur', c]); }
  { const c = radial(); addSpur(c, { device: 'sfcu', load: 'hood', place: 'in', after: '2' }); addSpur(c, { device: 'socket1' }); cases.push(['radial', c]); }
  { const c = radial('8'); addSpur(c, { device: 'fcu', load: 'other', other: 'Gate motor', place: 'in', after: '1' }); cases.push(['radial other', c]); }
  for (const [label, c] of cases) for (const W of [380, 1100, 1440]) clean([c], label, W);
  // in a ring no JB is drawn just because of an in-ring FCU
  const c0 = ring(); addSpur(c0, { device: 'fcu', load: 'boiler', place: 'in' });
  const sh0 = blocks([c0], 380)[0].shapes;
  assert.ok(!sh0.some((z) => z.t === 'text' && z.txt === 'JB'), 'no JB for an in-ring FCU');
});

test('FCU in the ring: points counted once, note says where it is', () => {
  const c = ring('8');
  addSpur(c, { device: 'fcu', load: 'boiler', place: 'in', after: '3' });
  addSpur(c, { device: 'socket1' });
  assert.equal(spurListTotal(c), 2);
  assert.equal(diagramPointTotal(c), 10);
  assert.equal(roomPointsNote(c), 'Points served: 8 + 1 spur + 1 FCU in the ring = 10?');
  setPointsToDiagramTotal(c);
  assert.equal(c.points, '10'); assert.equal(roomPointsNote(c), '');
  assert.equal(drawnPointCount(c).shown, 8, 'still 8 sockets drawn; the FCU is drawn once, in the ring');
  const sh = blocks([c], 380)[0].shapes;
  assert.equal(fcuPlates(sh).length, 1, 'one FCU, not one in the ring and one on a spur');
  const r = radial('4'); addSpur(r, { device: 'sfcu', load: 'hood', place: 'in' });
  assert.equal(roomPointsNote(r), 'Points served: 4 + 1 FCU in the radial = 5?');
  assert.equal(spurLabel(circuitSpurList(r)[0], r), 'Switched FCU in the radial \u2192 Cooker hood');
});

test('FCU in the ring on a layout without a drawn run falls back to a spur off its socket', () => {
  const c = { num: '5', desc: 'Ring', ring: true, rating: '32', live: '2.5', points: '6', device: 'mcb', type: 'B', diagram: { rooms: 'Lounge 3, Hall 3', spurList: [] } };
  addSpur(c, { device: 'fcu', load: 'boiler', place: 'in', after: '2' });
  for (const W of [380, 1100]) {
    const sh = blocks([c], W)[0].shapes;
    assert.equal(fcuPlates(sh).length, 1, 'still drawn once');
    assert.ok(sh.some((z) => z.t === 'text' && /FCU in the/.test(z.txt)), 'labelled');
    clean([c], 'rooms fallback', W);
  }
});

test('spur editor offers Where / Position for an FCU only', () => {
  const s = readFileSync(new URL('../js/schedule.js', import.meta.url), 'utf8');
  assert.match(s, /'Spur off a socket\/JB'/);
  assert.match(s, /isRingC\(c\) \? 'In the ring' : 'In the radial'/);
  assert.match(s, /s\.device === 'fcu' \|\| s\.device === 'sfcu' \? h\('label'[^\n]*'Where'/);
  assert.match(s, /spurInRing\(s\) \? h\('label'[^\n]*'Position'/);
});
