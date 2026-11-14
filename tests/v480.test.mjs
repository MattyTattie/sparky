// v0.48.0: 10 Nov niggles + 13 Nov calculator/diagram audit (local build, not published).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CA, CI_OPTIONS } from '../js/cables.js';
import { lengthFromR1R2, dec, sizeCable, ambientFactor } from '../js/calc.js';
import { cableCheck } from '../js/checks.js';
import { adiabatic } from '../js/design.js';
import { isRingCircuit, autoNA, applyNoDevice, blankCircuit, NODEV_KEYS, DEVICE_KEYS, RESULT_KEYS } from '../js/templates.js';
import { clean, keyOf, nameFor, mergePresets, distinguishName, presetFrom, shown } from '../js/presets.js';
import { isRingC, noGuessLoad, pointKind, forgiveDesc, namedLoadKind, listedItems, circuitSpurList, addSpur, removeSpur, updateSpur, spurLabel, spurSymbolOf, spurLoadKind, spurListTotal, diagramPointTotal, diagramMainPoints, drawnPointCount, setPointsToDiagramTotal, roomPointsNote, layout, diagramModel, SPUR_DEVICES, SPUR_LOADS, spurFromOptions, spurSocketCount } from '../js/wiring.js';
import { textSymbolOverlaps, hangingSocketTicks, textBBox } from './shape_overlap.mjs';

const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

// (version/SW cache check moved to tests/v481.test.mjs)

test('Table 4B1: 90 °C Ca at 25 °C is 1.04 (20 °C uses the same column)', () => {
  assert.equal(CA[90][25], 1.04);
  assert.equal(CA[90][20], 1.04);
  assert.equal(CA[70][25], 1.03);
  const { ca } = ambientFactor('swaX', 25);
  assert.equal(ca, 1.04);
  // √((90-25)/(90-30)) ≈ 1.0408, book 1.04
  assert.ok(Math.abs(Math.sqrt((90 - 25) / (90 - 30)) - 1.04) < 0.002);
});

test('lengthFromR1R2 is ring-aware and accepts commas', () => {
  assert.equal(lengthFromR1R2({ r1r2: 0.195, live: 2.5, cpc: 1.5 }), 10);
  assert.equal(lengthFromR1R2({ r1r2: 0.195, live: 2.5, cpc: 1.5, ring: true }), 40);
  assert.equal(lengthFromR1R2({ r1r2: '0,195', live: 2.5, cpc: 1.5 }), 10);
  assert.equal(lengthFromR1R2({ r1r2: '0,195', live: 2.5, cpc: 1.5, ring: true }), 40);
});

test('dec() accepts comma decimals', () => {
  assert.equal(dec('9,5'), 9.5);
  assert.equal(dec('0,35'), 0.35);
  assert.equal(dec('32'), 32);
  assert.ok(Number.isNaN(dec('')));
  assert.equal(dec(1.04), 1.04);
});

test('isRingC uses the same rule as the Ring final circuit tick', () => {
  const kitchenOff = { desc: 'Kitchen sockets', rating: '32', live: '2.5', ring: false };
  const upstairsOn = { desc: 'Upstairs sockets', rating: '32', live: '4', ring: true };
  assert.equal(isRingCircuit(kitchenOff), false);
  assert.equal(isRingC(kitchenOff), false);
  assert.equal(isRingCircuit(upstairsOn), true);
  assert.equal(isRingC(upstairsOn), true);
  // tick off is definitive even if the name says ring
  assert.equal(isRingC({ desc: 'Ring kitchen', ring: false, r1: '0.5' }), false);
  // name still counts when the tick has never been set
  assert.equal(isRingC({ desc: 'Ring kitchen' }), true);
});

test('cableCheck applies optional Ca / Cg / Ci; no factors keeps the old It wording', () => {
  const base = { desc: 'Utility', rating: '32', live: '6', ref: 'C', cable: 'te', cableSize: '6' };
  const plain = cableCheck(base);
  assert.equal(plain.level, null);
  assert.match(plain.msg, /before correction factors/);
  assert.equal(plain.it, 47);
  const hot = cableCheck({ ...base, ambient: 55 });
  assert.equal(hot.level, 'amber');
  assert.equal(hot.ca, 0.61);
  assert.ok(Math.abs(hot.iz - 28.67) < 0.02);
  assert.match(hot.msg, /Iz \(28\.67 A/);
  // ring 433.1.204 still compares Iz ≥ 20
  const ring = cableCheck({ desc: 'Sockets', rating: '32', live: '2.5', ref: 'C', cable: 'te', cableSize: '2.5', ring: true, ambient: 30 });
  assert.equal(ring.level, null);
});

test('forgiving name-based load symbols; noGuessLoad only when the user has an item list', () => {
  assert.equal(pointKind({ desc: 'showr' }), 'shower');
  assert.equal(pointKind({ desc: 'Elec shower 9.5kW' }), 'shower');
  assert.equal(pointKind({ desc: 'En-suite shower 9.5kW' }), 'shower');
  assert.equal(pointKind({ desc: 'cookr' }), 'cooker');
  assert.equal(pointKind({ desc: 'COOKER' }), 'cooker');
  assert.equal(pointKind({ desc: 'imm' }), 'immersion');
  assert.equal(pointKind({ desc: 'Immersion' }), 'immersion');
  assert.equal(pointKind({ desc: 'EV' }), 'ev');
  assert.equal(pointKind({ desc: 'car charger' }), 'ev');
  assert.equal(pointKind({ desc: 'charge point on the drive' }), 'ev');
  assert.equal(noGuessLoad({ desc: 'Cooker', points: '1' }), false);
  assert.equal(namedLoadKind({ desc: 'Shower 9.5 kW' }), 'shower');
  assert.equal(namedLoadKind({ desc: 'EV charger' }), 'ev');
  // user-set item list is respected: no guess
  const listed = { desc: 'Cooker', diagram: { items: {} } };
  assert.equal(listedItems(listed), true);
  assert.equal(noGuessLoad(listed), true);
  assert.equal(namedLoadKind(listed), null);
});

test('No device fitted N/As the whole row, still editable; leftover B/3 looks like N/A', () => {
  const c = blankCircuit(2);
  c.desc = 'SPARE'; c.spare = true; c.type = 'B'; c.rating = '3'; c.irV = '500'; c.bs = '60898';
  applyNoDevice(c, true);
  assert.equal(c.noDevice, true);
  assert.equal(c.type, 'N/A');
  assert.equal(c.rating, 'N/A');
  assert.equal(c.irV, 'N/A');
  assert.equal(c.zs, 'N/A');
  assert.ok(c.noDevAuto);
  assert.equal(c.noDevAuto.type, 'B');
  // hand-edit a box
  c.remarks = 'empty way';
  applyNoDevice(c, false);
  assert.equal(c.noDevice, false);
  assert.equal(c.type, 'B');
  assert.equal(c.rating, '3');
  assert.equal(c.irV, '500');
  assert.equal(c.remarks, 'empty way'); // not in NODEV_KEYS restore-from-N/A only
  // leftover on an old cert (already ticked, no noDevAuto)
  const old = { noDevice: true, spare: true, desc: 'SPARE', type: 'B', rating: '3', irV: '500', zs: '' };
  assert.equal(autoNA(old, 'type'), true);
  assert.equal(autoNA(old, 'rating'), true);
  assert.equal(autoNA(old, 'irV'), true);
  assert.equal(autoNA(old, 'zs'), true);
  // a hand-set value on an old cert is left alone
  const hand = { noDevice: true, spare: true, type: 'C', rating: '32' };
  assert.equal(autoNA(hand, 'type'), false);
  assert.equal(autoNA(hand, 'rating'), false);
});

test('preset clean strips leftover RCD from MCBs so identical B50 chips merge; distinguishName labels leftovers', () => {
  const a = { device: 'mcb', bs: '60898', type: 'B', rating: '50', bka: '6', rcdBs: '61008', rcdType: 'A', rcdIdn: '30', rcdRating: '63', rcdS: false };
  const b = { device: 'mcb', bs: '60898', type: 'B', rating: '50', bka: '6', rcdBs: '61008', rcdType: 'A-S', rcdIdn: '300', rcdRating: '63', rcdS: true };
  assert.equal(keyOf(a), keyOf(b));
  assert.equal(nameFor(clean(a)), nameFor(clean(b)));
  assert.match(nameFor(clean(a)), /B50 MCB/);
  assert.doesNotMatch(nameFor(clean(a)), /mA/);
  const list = mergePresets(
    [{ id: 'p1', name: nameFor(a), fields: a, uses: 1 }],
    [{ id: 'p2', name: nameFor(b), fields: b, uses: 2 }],
  );
  assert.equal(list.length, 1);
  // two same-name chips that still differ (e.g. kA) get a label
  const d = distinguishName([
    { id: 'x', name: 'B50 MCB · 6 kA', fields: { device: 'mcb', bs: '60898', type: 'B', rating: '50', bka: '6' } },
    { id: 'y', name: 'B50 MCB · 6 kA', fields: { device: 'mcb', bs: '60898', type: 'B', rating: '50', bka: '10' } },
  ]);
  assert.ok(d[0].name !== d[1].name);
  assert.match(d[0].name + d[1].name, /kA/);
  // noDevice: presetFrom is null once rating is N/A
  assert.equal(presetFrom({ device: 'mcb', bs: '60898', type: 'B', rating: 'N/A' }), null);
});

test('maker I²t is used when given, otherwise the conservative default', () => {
  const base = { zs: 0.8, device: 'mcb', type: 'B', rating: 20, k: 115, cpcCsa: 1.5, time: 0.4 };
  const def = adiabatic(base);
  assert.equal(def.ok, true);
  const mine = adiabatic({ ...base, makerI2t: 2000 });
  assert.equal(mine.ok, true);
  assert.equal(mine.maker, true);
  assert.ok(mine.i2t === 2000 || mine.i2t === Math.round(2000));
  assert.match(mine.how, /maker/);
  assert.ok(mine.smin < def.smin);
});

test('spurs: each is its own item with a chosen device and load; points hint does not write points', () => {
  const c = { desc: 'Kitchen sockets', ring: true, live: '2.5', rating: '32', points: '' };
  assert.equal(spurListTotal(c), 0);
  addSpur(c, { device: 'fcu', load: 'boiler' });
  addSpur(c, { device: 'socket1' });
  addSpur(c, { device: 'sfcu', load: 'towel' });
  assert.equal(circuitSpurList(c).length, 3);
  assert.match(spurLabel(circuitSpurList(c)[0]), /FCU/);
  assert.match(spurLabel(circuitSpurList(c)[0]), /Boiler/);
  assert.equal(spurSymbolOf(circuitSpurList(c)[1]), 'socket1');
  assert.equal(c.points, ''); // never auto-written
  const note = roomPointsNote(c);
  assert.match(note, /3 spurs/i);
  assert.match(note, /empty/i);
  assert.equal(c.points, ''); // never auto-written
  c.points = '4';
  const note2 = roomPointsNote(c);
  assert.match(note2, /4 \+ 3 spurs = 7/);
  assert.equal(diagramPointTotal(c), 7);
  assert.equal(diagramMainPoints(c), 4);
  assert.equal(c.diagram.pointsIncludeSpurs, undefined);
  setPointsToDiagramTotal(c);
  assert.equal(c.points, '7');
  assert.equal(c.diagram.pointsIncludeSpurs, true);
  assert.equal(roomPointsNote(c), ''); // consistent: 4 main + 3 spurs = 7
  assert.equal(drawnPointCount(c).n, 4); // ring still draws the original 4, not 7
  assert.equal(diagramMainPoints(c), 4);
  assert.equal(diagramPointTotal(c), 7);
  const id = circuitSpurList(c)[1].id;
  updateSpur(c, id, { device: 'socket' });
  assert.equal(circuitSpurList(c)[1].device, 'socket');
  removeSpur(c, id);
  assert.equal(circuitSpurList(c).length, 2);
  const remaining = circuitSpurList(c)[0].id;
  updateSpur(c, remaining, { from: '2' });
  assert.equal(circuitSpurList(c)[0].from, '2');
  updateSpur(c, remaining, { from: 'jb' });
  assert.equal(circuitSpurList(c)[0].from, 'jb');
  updateSpur(c, remaining, { from: '' });
  assert.equal(circuitSpurList(c)[0].from, '');
  assert.equal('from' in (c.diagram.spurList[0]), false); // empty from is omitted
  // old backups without spurList still load (no field)
  assert.equal(circuitSpurList({ desc: 'Sockets' }).length, 0);
  const opts = spurFromOptions({ desc: 'Kitchen sockets', points: '4', ring: false });
  assert.equal(spurSocketCount({ desc: 'Kitchen sockets', points: '4' }), 4);
  assert.equal(opts[0].value, '');
  assert.ok(opts.some((o) => o.value === '1' && o.label === 'Socket 1'));
  assert.ok(opts.some((o) => o.value === 'jb'));
  assert.equal(spurFromOptions({ desc: 'Boiler FCUs', points: '3' })[0].label, 'Junction box (default)');
});

test('spur rows: device + load, no stray Rail/Rad caption on the row above', () => {
  const lay = (cs) => layout(diagramModel({ type: 'EIC', boards: [{ id: 'b', ref: 'DB1', circuits: cs }] }), { W: 380, font: 12, screen: true });
  const shapesOf = (cs) => lay(cs).blocks.flatMap((b) => b.shapes);
  const kitchen = {
    num: '2', desc: 'Kitchen sockets', ring: false, rating: '32', live: '2.5', cpc: '1.5',
    cable: 'te', cableSize: '2.5', points: '4', device: 'mcb', bs: '60898', type: 'B', wiring: 'C',
    diagram: { spurList: [] },
  };
  addSpur(kitchen, { device: 'socket1' });
  addSpur(kitchen, { device: 'sfcu', load: 'towel' });
  assert.equal(spurSymbolOf(circuitSpurList(kitchen)[1]), 'sfcu');
  assert.equal(spurLoadKind(circuitSpurList(kitchen)[1]), 'heater');
  const circ = lay([kitchen]).blocks.filter((b) => b.kind === 'circuit' || /Kitchen/.test((b.title || '') + (b.ref || '')));
  const texts = (circ.length ? circ : lay([kitchen]).blocks).flatMap((b) => b.shapes).filter((z) => z.t === 'text');
  const labs = texts.map((z) => z.txt);
  const joined = labs.join(' ');
  assert.ok(/Single\s+socket/.test(joined), joined);
  assert.ok(/Switched/.test(joined) && /FCU/.test(joined) && /Towel/.test(joined), joined);
  assert.equal(labs.filter((s) => s === 'Rail' || s === 'Rad').length, 0, 'stray Rail/Rad: ' + labs.join(' | '));
  const combos = [];
  for (const [dev] of SPUR_DEVICES) {
    if (dev === 'fcu' || dev === 'sfcu') {
      for (const [load] of SPUR_LOADS) combos.push({ device: dev, load });
      combos.push({ device: dev, load: '' });
    } else combos.push({ device: dev, load: '' });
  }
  const c2 = { num: '3', desc: 'All spur combos sockets', ring: true, rating: '32', live: '2.5', points: '6', diagram: { spurList: [] } };
  for (const row of combos) addSpur(c2, row);
  const t2 = lay([c2]).blocks.filter((b) => b.kind !== 'legend' && b.kind !== 'flags' && b.kind !== 'key').flatMap((b) => b.shapes).filter((z) => z.t === 'text').map((z) => z.txt);
  assert.equal(t2.filter((s) => s === 'Rail' || s === 'Rad').length, 0, t2.join(' | '));
  const squash = (s) => String(s).replace(/\s+/g, '');
  const hasWrapped = (texts, lab) => {
    const want = squash(lab);
    if (texts.some((x) => squash(x) === want)) return true;
    for (let i = 0; i < texts.length; i++) {
      let acc = '';
      for (let j = i; j < Math.min(i + 10, texts.length); j++) {
        acc += squash(texts[j]);
        if (acc === want) return true;
        if (acc.length > want.length) break;
      }
    }
    return false;
  };
  for (const s of circuitSpurList(c2)) {
    const lab = spurLabel(s).replace(/^Spur:\s*/, '');
    assert.ok(hasWrapped(t2, lab), 'missing label: ' + lab + ' in ' + t2.join(' | '));
  }
  const sockLab = texts.find((z) => z.txt === 'Single' || z.txt === 'Single socket');
  const towelLab = texts.find((z) => /Towel/.test(z.txt));
  assert.ok(sockLab && towelLab, 'expected both row labels in ' + joined);
  // two spurs on a 4-socket radial sit under different sockets (spread), so x differs
  assert.ok(Math.abs(towelLab.x - sockLab.x) > 20, `expected different sockets: socket x=${sockLab.x} towel x=${towelLab.x}`);
  assert.match(src('js/schedule.js'), /spurFromOptions/);
  assert.match(src('js/schedule.js'), /'From'/);
});

test('spur lines start at a socket (or a JB when there are no sockets)', () => {
  const lay = (cs, W = 380) => layout(diagramModel({ type: 'EIC', boards: [{ id: 'b', ref: 'DB1', circuits: cs }] }), { W, font: 12, screen: true });
  const circ = (cs, W) => lay(cs, W).blocks.filter((b) => b.kind === 'circuit').flatMap((b) => b.shapes);
  const plates = (sh) => sh.filter((z) => z.t === 'rect' && z.fill && z.fill[0] === 255 && z.h > 12 && z.h < 22 && z.w > 14 && z.y > 50);
  const drops = (sh) => sh.filter((z) => z.t === 'line' && Math.abs(z.x1 - z.x2) < 0.6 && Math.abs(z.y1 - z.y2) > 12);
  const startsAt = (drop, ports, tol = 3.5) => {
    const x = drop.x1, top = Math.min(drop.y1, drop.y2);
    return ports.some((p) => Math.abs(p.x - x) < tol && Math.abs(p.bot - top) < tol);
  };

  const kitchen = {
    num: '2', desc: 'Kitchen sockets', ring: false, rating: '32', live: '2.5', cpc: '1.5',
    points: '4', device: 'mcb', bs: '60898', type: 'B', diagram: { spurList: [] },
  };
  addSpur(kitchen, { device: 'socket1' });
  addSpur(kitchen, { device: 'sfcu', load: 'towel' });
  const checkFromSockets = (cs, label, W = 380) => {
    const sh = circ(cs, W);
    const pl = plates(sh);
    assert.ok(pl.length >= 2, label + ': expected socket plates, got ' + pl.length);
    const minY = Math.min(...pl.map((p) => p.y));
    // main ring/radial plates (not the spur devices below)
    const main = pl.filter((p) => p.y < minY + 25 || (p.w > 24 && p.y < minY + 80));
    const ports = main.map((p) => ({ x: p.x + p.w / 2, bot: p.y + p.h, y: p.y }));
    const ys = ports.map((p) => p.y);
    const bottomRow = Math.max(...ys);
    const preferred = ports.filter((p) => p.y > bottomRow - 8);
    const spurDrops = drops(sh).filter((d) => Math.min(d.y1, d.y2) >= Math.min(...ports.map((p) => p.bot)) - 1);
    const fromSock = spurDrops.filter((d) => startsAt(d, ports));
    assert.ok(fromSock.length >= Math.min(circuitSpurList(cs).length, preferred.length || ports.length),
      label + ': drops should start at a socket plate. drops=' + spurDrops.map((d) => `(${d.x1.toFixed(1)},${Math.min(d.y1, d.y2).toFixed(1)})`).join(' ')
      + ' ports=' + ports.map((p) => `(${p.x.toFixed(1)},${p.bot.toFixed(1)})`).join(' '));
    // the left feeder must not be the thing the spur hangs off
    const feedX = Math.min(...sh.filter((z) => z.t === 'line').map((z) => Math.min(z.x1, z.x2)));
    const feederToSpur = drops(sh).filter((d) => Math.abs(d.x1 - feedX) < 2 && Math.max(d.y1, d.y2) > Math.max(...ports.map((p) => p.bot)) + 8);
    assert.equal(feederToSpur.length, 0, label + ': spur must not drop from the left feeder at x=' + feedX);
    return { sh, ports, fromSock };
  };
  checkFromSockets([kitchen], 'kitchen radial 390', 380);
  checkFromSockets([kitchen], 'kitchen radial 1440', 1440);

  const ring = {
    num: '4', desc: 'Upstairs sockets', ring: true, rating: '32', live: '4', cpc: '1.5',
    points: '6', device: 'mcb', bs: '60898', type: 'B', diagram: { spurList: [] },
  };
  addSpur(ring, { device: 'fcu', load: 'other', other: 'Boiler' });
  checkFromSockets([ring], 'upstairs ring 390', 380);
  checkFromSockets([ring], 'upstairs ring 1440', 1440);

  // more spurs than sockets: extras stack on a socket, still from that plate
  const hall = {
    num: '9', desc: 'Hall sockets', ring: false, rating: '32', live: '2.5', points: '2',
    device: 'mcb', bs: '60898', type: 'B', diagram: { spurList: [] },
  };
  addSpur(hall, { device: 'socket1' });
  addSpur(hall, { device: 'socket' });
  addSpur(hall, { device: 'sfcu', load: 'towel' });
  const hallR = checkFromSockets([hall], '2 sockets 3 spurs');
  // at least one socket has a drop (the stack shares that origin)
  assert.ok(hallR.fromSock.length >= 2, 'stack still starts at sockets');

  // optional From: socket 3
  const k2 = { ...kitchen, diagram: { spurList: [] } };
  addSpur(k2, { device: 'socket1' });
  const id = addSpur(k2, { device: 'sfcu', load: 'towel' });
  updateSpur(k2, id, { from: '3' });
  const sh2 = circ([k2], 380);
  const pl2 = plates(sh2).sort((a, b) => a.x - b.x || a.y - b.y);
  const main2 = (() => { const top = Math.min(...pl2.map((p) => p.y)); return pl2.filter((p) => p.y < top + 8); })();
  assert.ok(main2.length >= 3, 'kitchen has 4 sockets');
  const sock3 = main2[2];
  const d3 = drops(sh2).filter((d) => startsAt(d, [{ x: sock3.x + sock3.w / 2, bot: sock3.y + sock3.h }]));
  assert.ok(d3.length >= 1, 'from=3 should drop from the third socket at x=' + (sock3.x + sock3.w / 2).toFixed(1));

  // no socket items: a radial of FCUs takes the spur from a JB on the cable
  const fcu = {
    num: '8', desc: 'Boiler FCUs', ring: false, rating: '16', live: '2.5', points: '3',
    device: 'mcb', bs: '60898', type: 'B', diagram: { spurList: [] },
  };
  addSpur(fcu, { device: 'sfcu', load: 'heater' });
  const shF = circ([fcu], 380);
  const jb = shF.filter((z) => z.t === 'text' && z.txt === 'JB');
  assert.ok(jb.length >= 1, 'expected a JB symbol, texts=' + shF.filter((z) => z.t === 'text').map((z) => z.txt).join(' | '));
  const jbX = jb[0].x;
  const fromJb = drops(shF).filter((d) => Math.abs(d.x1 - jbX) < 3 && Math.max(d.y1, d.y2) > jb[0].y + 4);
  assert.ok(fromJb.length >= 1, 'spur should drop from the JB at x=' + jbX.toFixed(1));
});

test('spur labels sit clear of symbols and hanging sockets have no through-cable tick', () => {
  const lay = (cs, W = 380) => layout(diagramModel({ type: 'EIC', boards: [{ id: 'b', ref: 'DB1', circuits: cs }] }), { W, font: 12, screen: true });
  const allShapes = (cs, W) => lay(cs, W).blocks.filter((b) => b.kind === 'circuit').flatMap((b) => b.shapes || []);
  // block shapes use block-local y, so check one circuit block at a time
  const clean = (cs, label, W = 380) => {
    for (const b of lay(cs, W).blocks.filter((x) => x.kind === 'circuit')) {
      const sh = b.shapes || [];
      const hits = textSymbolOverlaps(sh);
      assert.equal(hits.length, 0, label + ' W=' + W + ' circuit ' + b.num + ' text on symbol: ' + hits.map((h) => '"' + h.txt + '" area=' + h.area.toFixed(1)).join('; '));
      const ticks = hangingSocketTicks(sh);
      assert.equal(ticks.length, 0, label + ' W=' + W + ' circuit ' + b.num + ' hanging through-cable tick at cy=' + ticks.map((t) => t.cy.toFixed(1)).join(','));
    }
  };

  const kitchen = {
    num: '2', desc: 'Kitchen sockets', ring: false, rating: '32', live: '2.5', cpc: '1.5',
    points: '4', device: 'mcb', bs: '60898', type: 'B', diagram: { spurList: [] },
  };
  addSpur(kitchen, { device: 'socket1' });
  addSpur(kitchen, { device: 'sfcu', load: 'towel' });
  for (const W of [380, 1100, 1440]) clean([kitchen], 'kitchen', W);
  // "Single" sits below the hanging single-socket plate, not through it
  const shK = allShapes([kitchen], 380);
  const spurPlate = shK.filter((z) => z.t === 'rect' && z.fill && z.fill[0] === 255 && z.w > 16 && z.w < 25 && z.h > 12 && z.h < 22 && z.y > 100)[0]; // single-socket plate (FCU plates are narrower)
  assert.ok(spurPlate, 'expected a hanging single-socket plate');
  const single = shK.filter((z) => z.t === 'text' && (z.txt === 'Single' || z.txt === 'Single socket')).map(textBBox);
  assert.ok(single.length, 'expected a Single socket label');
  for (const b of single) {
    // to the right of the faceplate, level with it (not drawn through it)
    assert.ok(b.x >= spurPlate.x + spurPlate.w + 3, '"Single" starts at x=' + b.x.toFixed(1) + ' but plate right edge is ' + (spurPlate.x + spurPlate.w).toFixed(1));
    const mid = b.y + b.h / 2;
    assert.ok(mid > spurPlate.y - 2 && mid < spurPlate.y + spurPlate.h + 2, 'label should sit level with its faceplate');
  }
  // the checker itself catches a label drawn through a faceplate (the bug Matthew saw)
  const bad = [...shK, { t: 'text', x: spurPlate.x + spurPlate.w / 2, y: spurPlate.y + spurPlate.h * 0.8, txt: 'Single', size: 9.3, anchor: 'middle' }];
  assert.ok(textSymbolOverlaps(bad).some((h) => h.txt === 'Single'), 'checker must flag text over a symbol');
  // an upper-row ring socket picked by hand routes down the channel between columns, clear of the lower sockets
  const r2 = { num: '1', desc: 'Downstairs sockets', ring: true, rating: '32', live: '2.5', points: '8', device: 'mcb', type: 'B', diagram: { spurList: [] } };
  const sid = addSpur(r2, { device: 'fcu', load: 'boiler' }); updateSpur(r2, sid, { from: '2' });
  clean([r2], 'ring from upper-row socket 2', 380);

  const ring = {
    num: '4', desc: 'Upstairs sockets', ring: true, rating: '32', live: '4', cpc: '1.5',
    points: '6', device: 'mcb', bs: '60898', type: 'B', diagram: { spurList: [] },
  };
  addSpur(ring, { device: 'fcu', load: 'other', other: 'Boiler' });
  for (const W of [380, 1440]) clean([ring], 'ring', W);

  const hall = {
    num: '9', desc: 'Hall sockets', ring: false, rating: '32', live: '2.5', points: '2',
    device: 'mcb', bs: '60898', type: 'B', diagram: { spurList: [] },
  };
  addSpur(hall, { device: 'socket1' });
  addSpur(hall, { device: 'socket' });
  addSpur(hall, { device: 'sfcu', load: 'towel' });
  for (const W of [380, 1440]) clean([hall], 'stack', W);

  const fcu = {
    num: '8', desc: 'Boiler FCUs', ring: false, rating: '16', live: '2.5', points: '3',
    device: 'mcb', bs: '60898', type: 'B', diagram: { spurList: [] },
  };
  addSpur(fcu, { device: 'sfcu', load: 'heater' });
  for (const W of [380, 1440]) clean([fcu], 'JB fallback', W);

  // every device × load combo, including stacked on a 6-socket ring
  const combos = { num: '3', desc: 'All spur combos sockets', ring: true, rating: '32', live: '2.5', points: '6', diagram: { spurList: [] } };
  for (const [dev] of SPUR_DEVICES) {
    if (dev === 'fcu' || dev === 'sfcu') {
      for (const [load] of SPUR_LOADS) addSpur(combos, { device: dev, load });
      addSpur(combos, { device: dev, load: '' });
    } else addSpur(combos, { device: dev, load: '' });
  }
  for (const W of [380, 1440]) clean([combos], 'all combos', W);

  // the four-DB sample that we screenshot: downstairs ring + kitchen two spurs
  const down = {
    num: '1', desc: 'Ring final: downstairs sockets', ring: true, rating: '32', live: '2.5', cpc: '1.5',
    points: '8', device: 'mcb', bs: '60898', type: 'B', diagram: { spurList: [] },
  };
  addSpur(down, { device: 'fcu', load: 'boiler' });
  for (const W of [380, 1100, 1440]) clean([down, kitchen], 'screenshot sample', W);
});

test('Check calculator has full Table 52.2 Ci and Use on a circuit; Size accepts commas via dec', () => {
  const ui = src('js/calcui.js');
  assert.match(ui, /CI_OPTIONS/);
  assert.match(ui, /Use on a circuit/);
  assert.match(ui, /makerI2t/);
  assert.match(ui, /from '\.\/usecircuit\.js'/);
  assert.ok(CI_OPTIONS.some(([k]) => k === '0.78'));
  assert.ok(CI_OPTIONS.some(([k]) => k === '0.88'));
  const size = src('js/calcsize.js');
  assert.match(size, /i2t/);
  // comma wrapping CSS
  assert.match(src('styles.css'), /\.chips\.seg2 \.chip[^}]*white-space:\s*nowrap/);
  // sticky reserved space
  assert.match(src('styles.css'), /circuitnav/);
  assert.match(src('js/schedule.js'), /circuit-scroll/);
  assert.match(src('styles.css'), /body\.circedit/);
  assert.match(src('js/app.js'), /circedit/);
  assert.match(src('js/schedule.js'), /applyNoDevice/);
  assert.match(src('js/certui.js'), /Share as PNG/);
  assert.match(src('js/wiring.js'), /' \(circuit ' \+ circ/);
});

test('sizeCable at 55 °C still steps a 32 A load from 6 mm² up (Ca 0.61)', () => {
  const r = sizeCable({ cable: 'te', method: 'C', ib: 32, inA: 32, length: 20, ambient: 55 });
  assert.ok(r.ok);
  const six = r.rows.find((x) => x.size === 6);
  assert.ok(six);
  assert.ok(Math.abs(six.iz - 28.67) < 0.02);
  assert.equal(six.currentOk, false);
  assert.ok(r.pick && r.pick.size >= 10);
});

test('old backups still load: new fields are optional', async () => {
  const { parseBackup, planRestore } = await import('../js/backup.js');
  const { APP_SLUG } = await import('../js/config.js');
  const { normaliseCert } = await import('../js/certmodel.js');
  const { isRingC, namedLoadKind, circuitSpurList, noGuessLoad } = await import('../js/wiring.js');
  const { autoNA } = await import('../js/templates.js');
  const { cableCheck } = await import('../js/checks.js');
  // A v0.18-shaped backup: no ambient, no spurList, no noDevAuto, no i2t.
  const raw = {
    app: APP_SLUG,
    jobs: [{ id: 'j-old', title: 'Old job (fake)', updatedAt: '2025-01-01T00:00:00.000Z' }],
    customers: [{ id: 'cu-old', name: 'A. Sample (FAKE)' }],
    certs: [{
      id: 'c-old', type: 'EIC', jobId: 'j-old', number: 'EIC-OLD-1',
      boards: [{ id: 'b1', ref: 'DB1', circuits: [
        { id: 'c1', num: '1', desc: 'Kitchen sockets', device: 'mcb', bs: '60898', type: 'B', rating: '32', live: '2.5', cpc: '1.5', ring: false, points: '4' },
        { id: 'c2', num: '2', desc: 'Cooker', device: 'rcbo', type: 'B', rating: '32', live: '6', cpc: '2.5', points: '1' },
        { id: 'c3', num: '3', desc: 'SPARE', spare: true, noDevice: true, type: 'B', rating: '3', irV: '500' },
      ] }],
    }],
  };
  const d = parseBackup(JSON.stringify(raw));
  assert.equal(d.app, APP_SLUG);
  assert.equal(d.certs.length, 1);
  const cert = normaliseCert(d.certs[0]);
  const [k, cook, spare] = cert.boards[0].circuits;
  assert.equal(isRingC(k), false, 'tick off is a radial, even on 32 A 2.5 mm\u00b2');
  assert.equal(namedLoadKind(cook), 'cooker');
  assert.equal(noGuessLoad(cook), false);
  assert.equal(circuitSpurList(k).length, 0);
  assert.equal(k.ambient, undefined);
  assert.equal(cableCheck({ ...k, ref: 'C', cable: 'te' }).level, 'amber'); // 32 A on 2.5 radial
  assert.equal(autoNA(spare, 'type'), true);
  assert.equal(autoNA(spare, 'rating'), true);
  const p = await planRestore(d, { getCur: async () => null, getMeta: async () => null, decode: async () => 1 });
  assert.ok(p.writes.some((w) => w.store === 'certs' && w.value.id === 'c-old'));
  assert.ok(p.writes.some((w) => w.store === 'jobs' && w.value.id === 'j-old'));
});
