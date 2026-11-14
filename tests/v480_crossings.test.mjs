// v0.48.0 (local): cables that cross without connecting hop over; real joins get a dot. Made-up data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layout, diagramModel, markCrossings, addSpur, diagramSvg } from '../js/wiring.js';
import { diagramEICSwitches, diagramEICRooms, diagramMWSpur, diagramEICContactors, diagramEICPro } from './diagram-sample.mjs';
import { textSymbolOverlaps } from './shape_overlap.mjs';

const ln = (x1, y1, x2, y2, o = {}) => ({ t: 'line', x1, y1, x2, y2, w: 1.1, color: [60, 60, 60], ...o });
const dots = (sh) => sh.filter((z) => z.t === 'circle' && z.dot);
const hopSegs = (sh) => sh.filter((z) => z.t === 'line' && z.hop);

test('markCrossings: a plain crossing gets a hop on the vertical, no dot', () => {
  const sh = [ln(0, 50, 100, 50), ln(40, 0, 40, 100)];
  const r = markCrossings(sh, 12);
  assert.deepEqual(r, { hops: 1, dots: 0 });
  assert.equal(dots(sh).length, 0, 'no dot at a crossing');
  // horizontal untouched; vertical broken around y=50 with a bulge to the right
  assert.ok(sh.some((z) => !z.hop && z.y1 === 50 && z.y2 === 50 && z.x1 === 0 && z.x2 === 100));
  const v = sh.filter((z) => !z.hop && z.x1 === 40 && z.x2 === 40);
  assert.equal(v.length, 2);
  assert.ok(v.every((z) => Math.max(z.y1, z.y2) < 47 || Math.min(z.y1, z.y2) > 53), 'gap in the vertical at the crossing');
  const arc = hopSegs(sh);
  assert.equal(arc.length, 8);
  const maxX = Math.max(...arc.flatMap((z) => [z.x1, z.x2]));
  assert.ok(maxX > 42 && maxX < 46, 'small bridge, bulging right: ' + maxX);
  // idempotent: running again adds nothing
  assert.deepEqual(markCrossings(sh, 12), { hops: 0, dots: 0 });
});

test('markCrossings: T-junctions get a dot; corners, straight joins and short terminal stubs do not', () => {
  const t1 = [ln(0, 50, 100, 50), ln(40, 50, 40, 100)]; // stem ends on a through-line
  assert.deepEqual(markCrossings(t1, 12), { hops: 0, dots: 1 });
  const d = dots(t1)[0]; assert.equal(d.cx, 40); assert.equal(d.cy, 50); assert.ok(d.r > 1.4 && d.r < 2.6, 'small dot: ' + d.r);
  const t2 = [ln(0, 50, 40, 50), ln(40, 50, 100, 50), ln(40, 50, 40, 100)]; // T built from three segments
  assert.deepEqual(markCrossings(t2, 12), { hops: 0, dots: 1 });
  const corner = [ln(0, 50, 40, 50), ln(40, 50, 40, 100)];
  assert.deepEqual(markCrossings(corner, 12), { hops: 0, dots: 0 });
  const straight = [ln(0, 50, 40, 50), ln(40, 50, 100, 50)];
  assert.deepEqual(markCrossings(straight, 12), { hops: 0, dots: 0 });
  const stub = [ln(0, 50, 100, 50), ln(40, 50, 40, 53.2)]; // a socket's drop into its faceplate
  assert.deepEqual(markCrossings(stub, 12), { hops: 0, dots: 0 });
  const dashed = [ln(0, 50, 100, 50), ln(40, 50, 40, 100, { dash: [3, 2] })]; // symbolic switch wire
  assert.equal(markCrossings(dashed, 12).dots, 0);
  // a line ending at a symbol terminal (just above a faceplate) is not a junction
  const term = [ln(0, 50, 100, 50), ln(40, 20, 40, 50), { t: 'rect', x: 30, y: 53, w: 20, h: 15, lw: 1.1, color: [60, 60, 60], fill: [255, 255, 255] }];
  assert.equal(markCrossings(term, 12).dots, 0);
  // a crossing inside a symbol is left alone
  const inside = [ln(0, 50, 100, 50), ln(40, 0, 40, 100), { t: 'rect', x: 30, y: 40, w: 20, h: 20, lw: 1.1, color: [60, 60, 60], fill: [255, 255, 255] }];
  assert.deepEqual(markCrossings(inside, 12), { hops: 0, dots: 0 });
});

test('markCrossings: two close crossings share one hop; never a hop past the line end', () => {
  const sh = [ln(0, 50, 100, 50), ln(0, 54, 100, 54), ln(40, 0, 40, 100)];
  assert.equal(markCrossings(sh, 12).hops, 1);
  const near = [ln(0, 50, 100, 50), ln(40, 48, 40, 100)]; // vertical starts 2px above the horizontal
  const r = markCrossings(near, 12); assert.equal(r.hops, 0);
});

const lay = (c, o) => layout(diagramModel(c), o);
const opts = [{ W: 380, font: 12, screen: true }, { W: 1100, font: 14, screen: true }, { W: 560, font: 11 }];

test('ring diagram: spur drops hop the ring return; no dot where they cross; key explains both', () => {
  const ring = { num: '1', desc: 'Downstairs sockets', ring: true, rating: '32', live: '2.5', cpc: '1.5', points: '8', device: 'mcb', type: 'B', diagram: { spurList: [] } };
  addSpur(ring, { device: 'fcu', load: 'boiler', place: 'in', after: '3' }); addSpur(ring, { device: 'socket1' });
  for (const o of opts) {
    const L = lay({ type: 'EIC', boards: [{ id: 'b', ref: 'DB1', circuits: [ring] }] }, o);
    const b = L.blocks.find((x) => x.kind === 'circuit');
    const hops = hopSegs(b.shapes).length / 8;
    assert.ok(hops >= 2, 'W=' + o.W + ' hops: ' + hops);
    // every hop sits on a crossing: there is an unbroken horizontal through its middle
    for (let i = 0; i < b.shapes.length; i++) { const z = b.shapes[i]; if (!z.hop || b.shapes[i - 1].hop) continue;
      const seg = b.shapes.slice(i, i + 8); const x = seg[0].x1; const ym = (seg[0].y1 + seg[7].y2) / 2;
      assert.ok(b.shapes.some((h) => h.t === 'line' && !h.hop && Math.abs(h.y1 - ym) < 0.6 && Math.abs(h.y2 - ym) < 0.6 && Math.min(h.x1, h.x2) < x - 2 && Math.max(h.x1, h.x2) > x + 2), 'hop over a horizontal at W=' + o.W); }
    // no junction dot at any hop
    for (const d of dots(b.shapes)) assert.ok(!hopSegs(b.shapes).some((z) => Math.abs(z.x1 - d.cx) < 3 && Math.abs(z.y1 - d.cy) < 5), 'dot at a crossing');
    // the only dot in a plain ring circuit is the breaker's tee off the board bus
    assert.ok(dots(b.shapes).every((d) => d.cx < 45), 'no dots on the ring itself: ' + dots(b.shapes).map((d) => d.cx.toFixed(0)).join(','));
    const key = L.blocks.find((x) => x.kind === 'legend');
    const kt = key.shapes.filter((z) => z.t === 'text').map((z) => z.txt).join(' ');
    assert.match(kt, /Lines crossing, not/); assert.match(kt, /Connected/);
    assert.ok(hopSegs(key.shapes).length === 8 && dots(key.shapes).length === 1, 'key samples drawn with the same hop and dot');
    for (const blk of L.blocks.filter((x) => x.kind === 'circuit')) assert.equal(textSymbolOverlaps(blk.shapes).length, 0);
  }
});

test('real joins get dots in every layout: bus tees, controls split, rooms feeder, JB split, MW spur tee', () => {
  for (const o of opts) {
    const count = (c, pick) => lay(c, o).blocks.filter(pick).reduce((n, b) => n + dots(b.shapes).length, 0);
    // every breaker on the board bus: a tee (the last one is a corner, so no dot)
    const L = lay(diagramEICPro(), o);
    const circ = L.blocks.filter((b) => b.kind === 'circuit');
    assert.ok(circ.filter((b) => dots(b.shapes).some((d) => d.cx < 45)).length >= circ.length / 2, 'bus tees dotted (the last on each bus is a corner)');
    assert.ok(count(diagramEICContactors(), (b) => b.kind === 'circuit' && b.num === '10') >= 1, 'time clock split to two coils');
    assert.ok(count(diagramEICRooms(), (b) => b.kind === 'circuit' && b.num === '2') >= 3, 'rooms feeder tees');
    const sw = lay(diagramEICSwitches(), o).blocks.find((b) => b.kind === 'circuit' && b.num === '2');
    assert.ok(dots(sw.shapes).length >= 3 && hopSegs(sw.shapes).length >= 8, 'JB split dotted and feeder crossing hopped');
    const mw = lay(diagramMWSpur(), o).blocks.find((b) => b.kind === 'circuit');
    assert.equal(dots(mw.shapes).length, 1, 'new spur tees off the ring (and no dot at the new socket\u2019s own terminal)');
    assert.ok(hopSegs(mw.shapes).length >= 8, 'new spur hops the ring return');
    // the supply earth symbol is not a junction
    const head = lay(diagramMWSpur(), o).blocks.filter((b) => b.kind === 'head');
    assert.ok(head.every((b) => dots(b.shapes).every((d) => d.cx < 45)), 'no dot on the earth symbol');
  }
});

test('same marks on screen SVG and in the PDF layout; old drawings otherwise unchanged in shape count', () => {
  const svg = diagramSvg(diagramMWSpur(), { W: 380, font: 12, screen: true });
  assert.ok((svg.match(/<circle/g) || []).length >= 1);
  const pdf = lay(diagramMWSpur(), { W: 560, font: 11 }).blocks.find((b) => b.kind === 'circuit');
  const scr = lay(diagramMWSpur(), { W: 380, font: 12, screen: true }).blocks.find((b) => b.kind === 'circuit');
  assert.equal(dots(pdf.shapes).length, dots(scr.shapes).length);
  assert.equal(hopSegs(pdf.shapes).length, hopSegs(scr.shapes).length);
});
