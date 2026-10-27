// =====================================================================
// dcwire.js — v0.7: the DC plan as CONNECTIONS (every link between the
// bits of kit, in order, with its cable, fuse and volt drop) and a simple
// WIRING DIAGRAM model. Plain JS, no DOM: the screen draws the model as
// inline SVG (wiringSvg) and the PDF draws the same model with the Kit.
// Only reads what planDC() already worked out: no new sums.
// =====================================================================
import { MAX_FUSE, MAX_CABLE, ISOLATOR_SIZES, SHUNT_SIZES, BUSBAR_SIZES, ampsOr, sizeText, mpptText } from './dcplan.js';
const num = (v, d = 0) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : d; };
export const fuseShort = (f) => f ? `${f.A} A ${f.label.replace(' fuse', '').replace(' (ATO/ATC)', '')}` : null;
const fuseLong = (f) => f ? `${f.A} A ${f.label}` : null;

// Every link, in the order you'd wire it. Only kit that's in the plan.
export function connections(p, o = {}) {
  const C = [];
  const add = (c) => C.push({ fuse: null, vd: null, limit: null, ok: true, note: '', ...c });
  const fromRun = (r) => r ? { size: r.size, big: !r.size && r.current > 0 && r.length > 0, length: r.length, vd: r.vd ? r.vd.pct : null, limit: r.pct, ok: r.ok } : {};
  if (p.main) {
    add({ id: 'main', from: 'Battery +', via: ['Main fuse', 'Isolator'], to: '+ busbar', ...fromRun(p.main), colour: 'red',
      fuse: p.main.fuse ? { text: fuseLong(p.main.fuse), where: 'on the battery positive, as close to the terminal as you can' } : null,
      note: `Isolator: ${ampsOr(p.isolator.a, ISOLATOR_SIZES)} DC-rated, after the main fuse. Same cable all the way.` });
    add({ id: 'neg', from: 'Battery −', via: ['Shunt'], to: '− busbar', size: p.main.size, big: !p.main.size, length: p.main.length, colour: 'black', vd: null, ok: !!p.main.size,
      note: `Shunt ${ampsOr(p.shunt.a, SHUNT_SIZES)} goes on the battery negative: nothing else on the battery negative. No fuse on the negative.` });
  }
  if (p.inverter) add({ id: 'inverter', from: '+ busbar', to: 'Inverter', ...fromRun(p.inverter.run), colour: 'red + black',
    fuse: p.inverter.run.fuse ? { text: fuseLong(p.inverter.run.fuse), where: 'at the busbar end of the positive' } : null,
    note: `${p.inverter.w} W, up to ${p.inverter.current} A from the battery. Negative to the − busbar.` });
  if (p.solar) {
    const pv = p.solar.pv; const pick = pv && pv.size && pv.size.pick;
    const isoV = pv && pv.cold ? Math.ceil(pv.cold) : p.solar.mpptV; const isoA = pv && pv.cableAmps ? Math.ceil(pv.cableAmps * Math.max(1, pv.strings)) : null;
    add({ id: 'pv', from: 'Solar panels', via: ['PV isolator'], to: 'MPPT (solar controller)', size: pick ? pick.size : 4, length: num(o.pvLen, 5), colour: 'red + black (PV cable)', cableType: 'solar PV cable (H1Z2Z2-K)',
      vd: pick ? pick.vd.pct : null, limit: pick ? 3 : null, ok: true,
      fuse: pv && pv.fuse && pv.fuse.needed && pv.fuse.fuse ? { text: `${pv.fuse.fuse} A gPV string fuses`, where: 'in each string, + and −' } : null,
      note: `PV isolator: DC-rated, at least ${isoV} V${isoA ? ` and ${isoA} A` : ''}. ${pick ? '' : 'Add the panel figures in Charging → More options to size the PV cable; 4 mm² suits most van roofs. '}MC4 plugs on the panel leads.` });
    add({ id: 'mppt', from: 'MPPT (solar controller)', to: '+ busbar', ...fromRun(p.solar.run), colour: 'red + black',
      fuse: p.solar.run.fuse ? { text: fuseLong(p.solar.run.fuse), where: 'at the busbar end of the positive' } : null, note: `Controller ${p.solar.mpptV} V / ${mpptText(p.solar)}.` });
  }
  if (p.dcdc) {
    add({ id: 'dcdcIn', from: 'Starter battery', to: 'DC-DC charger', ...fromRun(p.dcdc.inRun), colour: 'red (+ black to chassis or the starter battery −)',
      fuse: p.dcdc.inRun.fuse ? { text: fuseLong(p.dcdc.inRun.fuse), where: 'at the starter battery positive (and the same again at the DC-DC end if the run is long)' } : null,
      note: `About ${p.dcdc.inI} A from the starter battery. Allowed 5% drop (the charger brings the voltage back up).` });
    add({ id: 'dcdcOut', from: 'DC-DC charger', to: '+ busbar', ...fromRun(p.dcdc.outRun), colour: 'red + black',
      fuse: p.dcdc.outRun.fuse ? { text: fuseLong(p.dcdc.outRun.fuse), where: 'at the busbar end of the positive' } : null, note: `${p.dcdc.a} A charger.` });
    // v0.35: smart alternator (Euro 6): ignition / D+ trigger wire to the charger.
    if (p.dcdc.trigger) { const t = p.dcdc.trigger;
      add({ id: 'trigger', from: 'Ignition-switched live (or alternator D+)', to: 'DC-DC trigger input', size: t.size, length: t.length, colour: 'one thin wire (signal only)', vd: null,
        fuse: t.fuse ? { text: fuseLong(t.fuse), where: 'at the ignition feed (add-a-fuse tap or in-line holder)' } : null,
        note: 'Tells the charger the engine is running. Turn on its smart-alternator mode. Carries well under 1 A.' }); }
  }
  if (p.shore) add({ id: 'shore', from: 'Mains charger', to: '+ busbar', ...fromRun(p.shore.run), colour: 'red + black',
    fuse: p.shore.run.fuse ? { text: fuseLong(p.shore.run.fuse), where: 'at the busbar end of the positive' } : null,
    note: `${p.shore.a} A charger. The 230 V hook-up side is BS 7671 Section 721 work.` });
  if (p.fuseBox) {
    add({ id: 'fusebox', from: '+ busbar', to: p.fuseBox.label || 'Fuse box', ...fromRun(p.fuseBox.run), colour: 'red + black',
      fuse: p.fuseBox.run.fuse ? { text: fuseLong(p.fuseBox.run.fuse), where: 'at the busbar end of the positive' } : null, note: `${p.fuseBox.ways}-way ${p.fuseBox.breakers ? 'DC breaker board' : 'blade fuse box'} with a negative bus.` });
    for (const l of p.dcLoads) {
      if (l.run) add({ id: 'load' + l.i, from: p.fuseBox ? p.fuseBox.label : 'Fuse box', to: l.name, ...fromRun(l.run), colour: 'red + black', load: true,
        fuse: l.run.fuse ? { text: fuseLong(l.run.fuse), where: p.fuseBox && p.fuseBox.breakers ? 'in the DC breaker board' : 'in the fuse box' } : null });
      else add({ id: 'load' + l.i, from: p.fuseBox ? p.fuseBox.label : 'Fuse box', to: l.name, size: null, length: null, colour: 'red + black', load: true, ok: false, note: 'Add the run length (step 5) to size this cable and fuse.' });
    }
  }
  if (p.inverter && p.acLoads.length) add({ id: 'ac', from: 'Inverter', to: '230 V sockets', size: null, length: null, colour: '230 V cable', ac: true,
    note: `${p.acLoads.map((l) => l.name.replace(/ \((230 V )?via inverter\)/, '')).join(', ')}. Wire it as a 230 V circuit with RCD protection and earth it as the inverter maker says.` });
  if (p.chassis) add({ id: 'chassis', from: '− busbar', to: 'Vehicle chassis', size: p.chassis.size, length: 0.5, colour: 'black', note: 'One clean, bare, protected point. No fuse.' });
  return C;
}

// ---- wiring diagram model --------------------------------------------
// Units are "diagram units" (360 wide). Text widths are estimated (Inter /
// Arimo average ≈ 0.55 × size); the PDF re-checks with real widths.
export const estW = (t, size) => String(t).length * size * 0.56;
const fit = (t, w, size) => { t = String(t); if (estW(t, size) <= w) return t; while (t.length > 1 && estW(t + '…', size) > w) t = t.slice(0, -1); return t.trimEnd() + '…'; };
const wrapEst = (t, w, size) => { const out = []; let line = ''; for (const word of String(t).split(' ')) { const tryL = line ? line + ' ' + word : word; if (estW(tryL, size) > w && line) { out.push(line); line = word; } else line = tryL; } if (line) out.push(line); return out; };

// v0.35.1: one layout rule for every leg. Stacked pills get PILL_GAP between them and
// at least PILL_GAP clear of the box above and below; rows move down to make room.
export const PILL_H = 13, PILL_GAP = 6;
const ROWS = ['r0', 'r1', 'r2', 'bus', 'r3'];
export const stackHeight = (n) => n * PILL_H + (n - 1) * PILL_GAP + 2 * PILL_GAP;
export function wiringModel(p, o = {}) {
  let Y = { r0: 8, r1: 92, r2: 166, bus: 248, r3: 314 };
  let H = { r0: 40, r1: 30, r2: 38, bus: 22, r3: 44 };
  for (let pass = 0; pass < 8; pass++) {
    const m = buildModel(p, o, Y, H);
    // real row heights (boxes grow when text wraps)
    const H2 = { ...H }; for (const b of m.boxes) if (b.row) H2[b.row] = Math.max(H2[b.row], b.h);
    const Y2 = { ...Y }; let moved = false;
    for (let i = 1; i < ROWS.length; i++) { const r = ROWS[i], prev = ROWS[i - 1]; const base = Y[r] - Y[prev] - H[prev]; Y2[r] = Y2[prev] + H2[prev] + base; }
    for (const s of m.stacks) { const room = Y2[s.b] - (Y2[s.a] + H2[s.a]); const short = stackHeight(s.n) - room;
      if (short > 0) { moved = true; for (let i = ROWS.indexOf(s.b); i < ROWS.length; i++) Y2[ROWS[i]] += short; } }
    if (!moved && ROWS.every((r) => Y2[r] === Y[r] && H2[r] === H[r])) { delete m.stacks; return m; }
    Y = Y2; H = H2;
  }
  const m = buildModel(p, o, Y, H); delete m.stacks; return m;
}
function buildModel(p, o, Y, H) {
  const W = 360, CW = 104, X = [8, 128, 248], MID = X.map((x) => x + CW / 2);
  const stacks = [];
  const boxes = [], wires = [], pills = [], texts = [];
  // v0.35: box text wraps (never cut short with '…'); the box grows if it needs to.
  const box = (col, row, t, s = [], kind = 'kit') => { const sub = s.filter(Boolean).flatMap((x) => wrapEst(x, CW - 8, 7)); const b = { row, x: X[col], y: Y[row], w: CW, h: Math.max(H[row], 14 + sub.length * 9 + 4), t, s: sub, kind }; boxes.push(b); return b; };
  const wire = (pts, c = 'pos') => wires.push({ pts, c });
  // cable (and fuse) labels stacked in the middle of a vertical wire
  // v0.35: extra tags ({ t, kind, bad }) for isolators / cold Voc; bad = over a limit (drawn red).
  const tags = (x, y1, y2, cable, fuse, extra = [], a, bRow) => { const list = [cable && (typeof cable === 'object' ? { kind: 'cable', ...cable } : { t: cable, kind: 'cable' }), fuse && (typeof fuse === 'object' ? { kind: 'fuse', ...fuse } : { t: fuse, kind: 'fuse' }), ...extra].filter(Boolean); if (a) stacks.push({ a, b: bRow, n: list.length }); const hh = PILL_H, gap = PILL_GAP; let y = (y1 + y2) / 2 - (list.length * hh + (list.length - 1) * gap) / 2;
    for (const it of list) { const w = Math.min(CW + 12, estW(it.t, 7.5) + 10); pills.push({ cx: x, y, w, h: hh, t: it.t, kind: it.kind, bad: !!it.bad }); y += hh + gap; } };
  const mm = (r) => sizeText(r);
  const fz = (r) => fuseShort(r && r.fuse) || (r && r.need > MAX_FUSE ? { t: `over ${MAX_FUSE} A fuse`, bad: true } : null);
  const down = (col, rowA, rowB, c, cable, fuse, extra) => { const x = MID[col], y1 = Y[rowA] + H[rowA], y2 = Y[rowB]; wire([[x, y1], [x, y2]], c); tags(x, y1, y2, cable, fuse, extra, rowA, rowB); };
  const amps = (r) => r && r.size ? `${r.size} mm² · ${Math.round(r.current * 10) / 10} A` : `${sizeText(r)} · ${Math.round(((r && r.current) || 0) * 10) / 10} A`;
  const b = p.battery;
  // centre: battery → main fuse → isolator → busbar
  box(1, 'r0', 'Battery', [`${p.V} V ${b.fittedAh || b.suggestAh || b.needAh} Ah · ${b.kwh} kWh`, b.label.replace(' (lithium)', '').replace(' (flooded)', '')]);
  if (p.main) {
    box(1, 'r1', 'Main fuse', [fuseShort(p.main.fuse) || `Over ${MAX_FUSE} A`, p.main.fuse ? '' : 'no standard fuse'], 'fuse').bad = !p.main.fuse;
    box(1, 'r2', 'Isolator', [`${ampsOr(p.isolator.a, ISOLATOR_SIZES)} DC`, p.isolator.a ? '' : 'no standard isolator']).bad = !p.isolator.a;
    const mc = { t: mm(p.main), bad: !p.main.size }; down(1, 'r0', 'r1', 'pos', mc); down(1, 'r1', 'r2', 'pos', mc); down(1, 'r2', 'bus', 'pos', mc);
  }
  // left: solar
  if (p.solar) {
    // v0.35: series / parallel layout, string fuses, cold Voc against the controller (red if over),
    // PV cable size + current + drop, and the controller-to-busbar cable with its current.
    const pv = p.solar.pv; const pick = pv && pv.size && pv.size.pick; const over = !!(pv && pv.vocOk === false);
    const lay = !pv ? `${p.solar.panels} panel${p.solar.panels > 1 ? 's' : ''}` : pv.strings === 1 ? (pv.series > 1 ? `${pv.series} in series` : '1 panel') : pv.series === 1 ? `${pv.strings} in parallel` : `${pv.series} series × ${pv.strings} parallel`;
    const pb = box(0, 'r0', 'Solar panels', [`${p.solar.w} W`, lay]); pb.bad = over;
    const ib = box(0, 'r1', 'PV isolator', [`≥ ${pv && pv.cold ? Math.ceil(pv.cold) : p.solar.mpptV} V DC`], 'fuse');
    const mb = box(0, 'r2', 'MPPT', [`${p.solar.mpptV} V / ${mpptText(p.solar).replace(' (use 2 controllers)', '')}`, over ? `OVER: Voc ${pv.cold} V` : p.solar.mppt ? 'solar controller' : 'use 2 controllers']); mb.bad = over || !p.solar.mppt;
    const pvI = p.solar.pvDrop ? p.solar.pvDrop.current : null;
    const pvc = { t: `${pick ? pick.size : 4} mm² PV${pvI ? ` · ${pvI} A` : ''}${pick ? ` · ${pick.vd.pct}%` : ''}`, bad: !!(pv && pv.size && !pick) };
    const sf = pv && pv.fuse && pv.fuse.needed ? (pv.fuse.fuse ? `${pv.fuse.fuse} A gPV string fuses` : 'gPV string fuses') : null;
    down(0, 'r0', 'r1', 'pv', pvc, sf, pv && pv.cold ? [{ t: `Voc ${pv.cold} V ${over ? '>' : '≤'} ${p.solar.mpptV} V`, kind: over ? 'cable' : 'volt', bad: over }] : []);
    down(0, 'r1', 'r2', 'pv', pvc);
    down(0, 'r2', 'bus', 'pos', { t: amps(p.solar.run), bad: !p.solar.run.ok }, fz(p.solar.run));
  }
  // right: DC-DC from the starter battery; mains charger
  let shoreRow = null;
  if (p.dcdc) {
    box(2, 'r0', 'Starter battery', [`${p.vehV} V vehicle`, 'alternator']);
    box(2, 'r2', 'DC-DC charger', [`${p.dcdc.a} A`, p.dcdc.trigger ? '+ trigger wire' : '']);
    const x = MID[2], y1 = Y.r0 + H.r0, y2 = Y.r2; wire([[x, y1], [x, y2]]); tags(x, y1, y2, mm(p.dcdc.inRun), fz(p.dcdc.inRun), [], 'r0', 'r2');
    down(2, 'r2', 'bus', 'pos', mm(p.dcdc.outRun), fz(p.dcdc.outRun));
    if (p.shore) shoreRow = 'r3';
  } else if (p.shore) shoreRow = 'r2';
  if (shoreRow) {
    box(2, shoreRow, 'Mains charger', [`${p.shore.a} A`, 'from 230 V hook-up']);
    if (shoreRow === 'r2') down(2, 'r2', 'bus', 'pos', mm(p.shore.run), fz(p.shore.run));
    else { const x = MID[2], y1 = Y.bus + H.bus, y2 = Y.r3; wire([[x, y1], [x, y2]]); tags(x, y1, y2, mm(p.shore.run), fz(p.shore.run), [], 'bus', 'r3'); }
  }
  boxes.push({ x: 8, y: Y.bus, w: W - 16, h: H.bus, t: `+ BUSBAR${p.busbar ? '  ' + ampsOr(p.busbar.a, BUSBAR_SIZES) : ''}`, bad: !!(p.busbar && !p.busbar.a), s: [], kind: 'bus' });
  // below the busbar: inverter, fuse box and loads
  const busBot = Y.bus + H.bus; let bottom = busBot;
  if (p.inverter) {
    const ac = p.acLoads.map((l) => l.name.replace(/ \((230 V )?via inverter\)/, '').replace(/^Low-watt /, ''));
    box(0, 'r3', 'Inverter', [`${p.inverter.w} W → 230 V`, `${p.inverter.current} A DC`]);
    const x = MID[0]; wire([[x, busBot], [x, Y.r3]]); tags(x, busBot, Y.r3, { t: amps(p.inverter.run), bad: !p.inverter.run.ok }, fz(p.inverter.run), p.inverter.isoA ? [{ t: `${p.inverter.isoA} A DC isolator`, kind: 'fuse' }] : [], 'bus', 'r3');
    // v0.35: AC output under the inverter
    const yA = Y.r3 + H.r3 + 22; wire([[x, Y.r3 + H.r3], [x, yA]], 'ac');
    const acLines = wrapEst(ac.length ? `230 V AC out: ${ac.join(', ')}` : '230 V AC out (RCD protected)', CW - 8, 7);
    boxes.push({ x: X[0], y: yA, w: CW, h: 16 + acLines.length * 9, t: 'AC output', s: acLines, kind: 'neg' });
    bottom = Math.max(bottom, yA + 16 + acLines.length * 9);
  }
  if (p.fuseBox) {
    box(1, 'r3', p.fuseBox.label || 'Fuse box', [p.fuseBox.sub || `${p.fuseBox.ways}-way blade`]);
    const x = MID[1]; wire([[x, busBot], [x, Y.r3]]); tags(x, busBot, Y.r3, mm(p.fuseBox.run), fz(p.fuseBox.run), [], 'bus', 'r3');
    const bx = X[1] + 14, lx = X[1] + 30, lw = W - 8 - lx, rh = 30, gap = 6; let y = Y.r3 + H.r3 + 14;
    const loads = p.dcLoads; if (loads.length) {
      const last = y + (loads.length - 1) * (rh + gap) + rh / 2;
      wire([[bx, Y.r3 + H.r3], [bx, last]]);
      for (const l of loads) { const r = l.run; wire([[bx, y + rh / 2], [lx, y + rh / 2]]);
        boxes.push({ x: lx, y, w: lw, h: rh, t: l.name, s: [r ? `${mm(r)} · ${fuseShort(r.fuse) || `over ${MAX_FUSE} A fuse`} · ${r.length} m` : 'add a run length (step 5)'], kind: 'load' }); y += rh + gap; }
      bottom = Math.max(bottom, y - gap);
    }
  }
  if (shoreRow === 'r3') bottom = Math.max(bottom, Y.r3 + H.r3);
  // v0.35: smart-alternator trigger wire, as a note under the diagram (wrapped, never cut short).
  if (p.dcdc && p.dcdc.trigger) { const t = p.dcdc.trigger; let yT = bottom + 16;
    for (const line of wrapEst(`Smart alternator: ${t.size} mm² trigger wire from an ignition-switched live (or alternator D+) to the DC-DC trigger input, ${t.fuse ? t.fuse.A + ' A blade fuse' : 'fused'} at the feed end.`, W - 16, 7.5)) { texts.push({ x: 8, y: yT, t: line, size: 7.5, color: 'sub' }); yT += 11; }
    bottom = yT - 6; }
  // negative side
  let yN = bottom + 34;
  texts.push({ x: 8, y: yN - 10, t: 'NEGATIVE SIDE', size: 7.5, bold: true, color: 'sub' });
  if (p.main) {
    const nb = [[8, 70, 'Battery −', ''], [106, 70, 'Shunt', ampsOr(p.shunt.a, SHUNT_SIZES)], [212, 70, '− Busbar', p.busbar ? ampsOr(p.busbar.a, BUSBAR_SIZES) : ''], [306, 46, 'Chassis', '']];
    for (const [x, w, t, s] of nb) boxes.push({ x, y: yN, w, h: 32, t, s: s ? [s] : [], kind: 'neg' });
    const ym = yN + 16; wire([[78, ym], [106, ym]], 'neg'); wire([[176, ym], [212, ym]], 'neg'); wire([[282, ym], [306, ym]], 'neg');
    yN += 32 + 8;
    for (const line of wrapEst(`Battery − to shunt to − busbar: ${sizeText(p.main)} black. − busbar to chassis: ${p.chassis.size} mm² black. Every negative goes back to the − busbar, the same size as its positive.`, W - 16, 7.5)) { yN += 11; texts.push({ x: 8, y: yN, t: line, size: 7.5, color: 'sub' }); }
  }
  return { W, H: yN + 10, boxes, wires, pills, texts, stacks };
}

// Inline SVG (a string, so it can go in with innerHTML; all text is escaped).
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const WIRE_COL = { pos: '#d92d20', neg: '#101828', pv: '#d92d20', ac: '#667085' };
export function wiringSvg(m) {
  const S = [];
  S.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${m.W} ${m.H}" width="100%" role="img" aria-label="Wiring diagram" font-family="Inter, Arimo, system-ui, sans-serif">`);
  for (const w of m.wires) S.push(`<polyline points="${w.pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${WIRE_COL[w.c]}" stroke-width="${w.c === 'neg' ? 2.4 : 2.2}"${w.c === 'pv' ? ' stroke-dasharray="5 3"' : ''} stroke-linecap="round"/>`);
  const fills = { kit: ['#ffffff', '#c9d2ee', '#101828'], fuse: ['#fff4f2', '#f3a59a', '#9f1d14'], bus: ['#2952ff', '#2952ff', '#ffffff'], load: ['#fbfcff', '#d7ddeb', '#101828'], neg: ['#f2f4f7', '#98a2b3', '#101828'] };
  for (const b of m.boxes) {
    const [bg, line, ink] = fills[b.kind] || fills.kit; const n = b.s.length; const cx = b.x + b.w / 2;
    S.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="7" fill="${b.bad ? '#fef3f2' : bg}" stroke="${b.bad ? '#d92d20' : line}" stroke-width="${b.bad ? 2 : 1.3}"/>`);
    if (b.kind === 'load') { S.push(`<text x="${b.x + 6}" y="${b.y + 12}" font-size="8" font-weight="700" fill="${ink}">${esc(b.t)}</text>`); S.push(`<text x="${b.x + 6}" y="${b.y + 23}" font-size="7" fill="#475467">${esc(b.s[0] || '')}</text>`); continue; }
    const top = b.y + b.h / 2 - (n * 9) / 2 + 3;
    S.push(`<text x="${cx}" y="${top}" text-anchor="middle" font-size="${b.kind === 'bus' ? 9 : 8.5}" font-weight="800" fill="${ink}">${esc(b.t)}</text>`);
    b.s.forEach((s, i) => S.push(`<text x="${cx}" y="${top + 10 + i * 9}" text-anchor="middle" font-size="7" fill="${b.kind === 'fuse' ? '#9f1d14' : '#475467'}">${esc(s)}</text>`));
  }
  for (const p of m.pills) {
    const fuse = p.kind === 'fuse';
    const [bg, ln, ink] = p.bad ? ['#fee4e2', '#d92d20', '#b42318'] : p.kind === 'volt' ? ['#ecfdf3', '#75e0a7', '#067647'] : fuse ? ['#fff4f2', '#f3a59a', '#9f1d14'] : ['#ffffff', '#c9d2ee', '#101828'];
    S.push(`<rect x="${p.cx - p.w / 2}" y="${p.y}" width="${p.w}" height="${p.h}" rx="6.5" fill="${bg}" stroke="${ln}" stroke-width="${p.bad ? 1.6 : 1}"/>`);
    S.push(`<text x="${p.cx}" y="${p.y + 9.4}" text-anchor="middle" font-size="7.5" font-weight="700" fill="${ink}">${esc(p.t)}</text>`);
  }
  for (const t of m.texts) S.push(`<text x="${t.x}" y="${t.y}" font-size="${t.size}"${t.bold ? ' font-weight="800" letter-spacing=".6"' : ''} fill="${t.color === 'sub' ? '#475467' : '#101828'}">${esc(t.t)}</text>`);
  S.push('</svg>');
  return S.join('');
}

// One connection as a line of text (share as text, PDF).
export const cSize = (c) => c.big ? `over ${MAX_CABLE} mm²` : 'size to suit';
export function connectionText(c) {
  const path = [c.from, ...(c.via || []), c.to].join(' → ');
  const spec = c.ac ? '' : [c.size ? `${c.size} mm² ${c.colour}` : `${cSize(c)} (${c.colour})`, c.length ? `${c.length} m` : null, c.vd != null ? `${c.vd}% drop` : null].filter(Boolean).join(', ');
  return `${path}${spec ? ': ' + spec : ''}${c.fuse ? `. Fuse: ${c.fuse.text}, ${c.fuse.where}` : ''}${c.note ? `. ${c.note}` : ''}`;
}
