// v0.48.2 (local): rooms layouts: an in-ring FCU / SFCU / DP switch sits IN LINE in its room's run, and loads / spurs off
// an upper room's socket go UP inside that room's box (it grows to fit), so nothing crosses. Made-up data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layout, diagramModel, addSpur, updateSpur, spurAfterOptions, spurFromOptions } from '../js/wiring.js';
import { textSymbolOverlaps, hangingSocketTicks, linesThroughPlates, textBBox } from './shape_overlap.mjs';
const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const OPTS = [{ W: 380, font: 12, screen: true }, { W: 1100, font: 14, screen: true }, { W: 560, font: 11 }];
const mk = (num, desc, extra = {}) => ({ num, desc, device: 'mcb', type: 'B', rating: '32', live: '2.5', cpc: '1.5', ...extra });
const cert = (cs) => ({ type: 'EIC', boards: [{ id: 'b', ref: 'DB1', circuits: cs }] });
const circ = (c, o) => layout(diagramModel(c), o).blocks.filter((b) => b.kind === 'circuit');
const near = (a, b, e = 0.6) => Math.abs(a - b) < e;
const hops = (sh) => sh.filter((z) => z.t === 'line' && z.hop);
const white = (z) => z.t === 'rect' && z.fill && z.fill[0] === 255 && z.fill[1] === 255;
const squares = (sh) => sh.filter((z) => white(z) && Math.abs(z.w - z.h) < 0.5 && z.h > 12 && z.h < 22);
const inLine = (sh, p) => { const y = p.y + p.h / 2, L = sh.filter((z) => z.t === 'line' && near(z.y1, y, 0.8) && near(z.y2, y, 0.8));
  return L.some((z) => near(Math.max(z.x1, z.x2), p.x, 1.5)) && L.some((z) => near(Math.min(z.x1, z.x2), p.x + p.w, 1.5)); };
const txt = (sh, re) => sh.find((z) => z.t === 'text' && re.test(z.txt));
const clean = (c, label) => { for (const o of OPTS) for (const b of circ(c, o)) { const sh = b.shapes;
  assert.equal(hops(sh).length, 0, `${label} W=${o.W} c${b.num}: no crossings`);
  assert.equal(textSymbolOverlaps(sh).length, 0, `${label} W=${o.W} c${b.num}: text on a symbol: ` + textSymbolOverlaps(sh).map((h) => h.txt).join('; '));
  assert.equal(hangingSocketTicks(sh).length, 0, `${label} W=${o.W} c${b.num}: tick`);
  assert.equal(linesThroughPlates(sh).length, 0, `${label} W=${o.W} c${b.num}: a cable across a faceplate`);
  const texts = sh.filter((z) => z.t === 'text');
  for (const t of texts) for (const u of texts) { if (u === t) continue; const a = textBBox(t), q = textBBox(u);
    const ix = Math.min(a.x + a.w, q.x + q.w) - Math.max(a.x, q.x), iy = Math.min(a.y + a.h, q.y + q.h) - Math.max(a.y, q.y);
    assert.ok(ix <= 0.5 || iy <= 0.5, `${label} W=${o.W} c${b.num}: "${t.txt}" overlaps "${u.txt}"`); } } };

const ringRooms = () => {
  const a = mk('1', 'Ring final: hall, kitchen, utility', { ring: true, diagram: { roomList: [{ name: 'Hall', sockets: 2 }, { name: 'Kitchen', sockets: 4 }, { name: 'Utility', sockets: 2 }] } });
  addSpur(a, { device: 'fcu', load: 'boiler', place: 'in', after: '1' });
  addSpur(a, { device: 'dp20', load: 'washer', place: 'in', after: '4' });
  updateSpur(a, addSpur(a, { device: 'socket1' }), { from: '2' });
  addSpur(a, { device: 'sfcu', load: 'towel' });
  return a;
};

test('v0.48.2 version and SW cache', () => {
  assert.match(src('js/config.js'), /APP_VERSION = '0\.48\.2 beta'/);
  assert.match(src('sw.js'), /const CACHE = 'sparky-v0\.48\.2'/);
});

test('rooms ring: in-ring FCU and DP sit in line in their own room; loads go up inside it; a spur from an upper room socket comes off that socket', () => {
  const a = ringRooms();
  for (const o of OPTS) {
    const sh = circ(cert([a]), o)[0].shapes;
    const sq = squares(sh).filter((p) => inLine(sh, p));
    assert.ok(sq.length >= 2, `W=${o.W}: FCU and DP plates in line (${sq.length})`);
    const hall = txt(sh, /^Hall$/), kit = txt(sh, /^Kitchen$/), util = txt(sh, /^Utility$/);
    const fcu = txt(sh, /Unswitched FCU in/), dp = txt(sh, /20 A DP switch in/), single = txt(sh, /^Single socket$/), towel = txt(sh, /Towel/);
    assert.ok(fcu.y > hall.y && fcu.y < kit.y, `W=${o.W}: the FCU's label sits in the Hall box`);
    assert.ok(dp.y > kit.y && dp.y < util.y, `W=${o.W}: the DP's label sits in the Kitchen box`);
    assert.ok(single.y > hall.y && single.y < kit.y, `W=${o.W}: the spur from socket 2 comes off the Hall's socket 2`);
    assert.ok(towel.y > util.y, `W=${o.W}: a spur with no socket picked still drops off the last room`);
  }
  clean(cert([a]), 'rooms ring');
});

test('rooms ring: items at the start, at the end and in a two-row room; SFCU + DP spur device going up', () => {
  const b = mk('2', 'Ring final: rooms, end items', { ring: true, diagram: { roomList: [{ name: 'Lounge', sockets: 3 }, { name: 'Garage', sockets: 2 }] } });
  addSpur(b, { device: 'sfcu', load: 'heater', place: 'in', after: '3' }); addSpur(b, { device: 'dp45', load: 'cooker', place: 'in' });
  updateSpur(b, addSpur(b, { device: 'dp20', load: 'ipsock1' }), { from: '1' });
  const d = mk('3', 'Ring final: big kitchen', { ring: true, diagram: { roomList: [{ name: 'Kitchen', sockets: 7 }, { name: 'Outside', sockets: 1 }] } });
  addSpur(d, { device: 'dp20', load: 'socket1u', place: 'in', after: '5' }); updateSpur(d, addSpur(d, { device: 'fcu', load: 'hood' }), { from: '6' });
  addSpur(d, { device: 'fcu', load: 'boiler', place: 'in', after: '0' });
  clean(cert([b, d]), 'rooms ring 2');
  for (const o of OPTS) { const sh = circ(cert([d]), o)[0].shapes; const out = txt(sh, /^Outside$/);
    for (const re of [/Unswitched FCU in/, /20 A DP switch in/, /Cooker hood|hood/]) assert.ok(txt(sh, re).y < out.y, `W=${o.W}: ${re} inside the Kitchen box`);
    assert.ok(squares(sh).filter((p) => inLine(sh, p)).length >= 2, `W=${o.W}: in line`); }
});

test('radial rooms: in-radial DP and SFCU in line; spur from an upper room socket goes up there', () => {
  const a = mk('4', 'Kitchen radial sockets', { ring: false, rating: '20', diagram: { roomList: [{ name: 'Kitchen', sockets: 5 }, { name: 'Utility', sockets: 2, dpsw: 1 }] } });
  addSpur(a, { device: 'dp45', load: 'cooker', place: 'in', after: '2' }); updateSpur(a, addSpur(a, { device: 'fcu', load: 'hood' }), { from: '5' });
  addSpur(a, { device: 'sfcu', load: 'towel', place: 'in', after: '6' }); addSpur(a, { device: 'socket1' });
  clean(cert([a]), 'radial rooms');
  for (const o of OPTS) { const sh = circ(cert([a]), o)[0].shapes; const ut = txt(sh, /^Utility$/);
    assert.ok(txt(sh, /45 A DP switch in/).y < ut.y && txt(sh, /hood/).y < ut.y, `W=${o.W}: Kitchen items in the Kitchen box`);
    assert.ok(squares(sh).filter((p) => inLine(sh, p)).length >= 2, `W=${o.W}: in line`); }
});

test('rooms: socket numbers match the editor (a DP + socket counts), and old data still draws', () => {
  const a = mk('5', 'Ring', { ring: true, diagram: { roomList: [{ name: 'Utility', sockets: 1, dpsws: 1 }, { name: 'Hall', sockets: 2 }] } });
  addSpur(a, { device: 'fcu', load: 'boiler', place: 'in', after: '2' }); // after the DP + switched socket: still in the Utility
  assert.equal(spurAfterOptions(a).length, 2 + 4); assert.equal(spurFromOptions(a).filter((x) => /^\d+$/.test(x.value)).length, 4);
  for (const o of OPTS) { const sh = circ(cert([a]), o)[0].shapes; assert.ok(txt(sh, /Unswitched FCU in/).y < txt(sh, /^Hall$/).y, `W=${o.W}: in the Utility box`); }
  clean(cert([a]), 'numbering');
  // old data: an FCU spur with no place, rooms with DP counts and room spurs: as before (a spur, drawn clear)
  const old = mk('6', 'Ring', { ring: true, diagram: { roomList: [{ name: 'Kitchen', sockets: 3, spurs: 1, spurKind: 'fcu' }, { name: 'Utility', sockets: 1, dpsw: 1 }], spurList: [{ id: 'sx', device: 'fcu', load: 'boiler' }] } });
  for (const o of OPTS) { const sh = circ(cert([old]), o)[0].shapes; const t = sh.filter((z) => z.t === 'text').map((z) => z.txt).join('|');
    assert.match(t, /Unswitched FCU/); assert.doesNotMatch(t, /in the ring/); assert.equal(hops(sh).length, 0, 'W=' + o.W); }
});
