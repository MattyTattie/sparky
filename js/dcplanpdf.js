// dcplanpdf.js — the DC system plan as an A4 PDF (summary, parts list,
// cable runs with the reasons, safety notes). Uses the same Kit as the certificates.
import { loadJsPDF, Kit, GREY, INK, VALUE, RED } from './pdfkit.js';
import { SAFETY, MAX_FUSE, ISOLATOR_SIZES, SHUNT_SIZES, BUSBAR_SIZES, ampsOr, fuseText, sizeText, mpptText } from './dcplan.js';
import { connections, wiringModel, cSize } from './dcwire.js';

export async function dcPlanPdf(p, { title = 'DC system plan', profile = {}, base, inputs = {} } = {}) {
  const { jsPDF } = await loadJsPDF(base);
  const k = new Kit(jsPDF, { orientation: 'p', footer: 'DC system plan made with Zs Pro. A guide only: follow the makers\u2019 instructions.' });
  const room = (h) => { if (k.y + h > k.H - k.M - 10) { k.addPage(); } };
  const para = (text, { size = 8, bold = false, color = INK, indent = 0 } = {}) => {
    const ls = k.wrap(text, k.cw - indent, size, bold); const step = k.lh(size);
    for (const s of ls) { room(step + 1); k.t(s, k.x0 + indent, k.y + step * 0.8, { size, bold, color }); k.y += step; }
    k.y += 0.6;
  };
  const head = (t) => { room(14); k.y += 2; k.rect(k.x0, k.y, k.cw, 6.5, { lw: 0.3, color: INK, fill: [235, 238, 250] }); k.t(t, k.x0 + 2, k.y + 4.6, { size: 9.5, bold: true }); k.y += 8.5; };
  // header
  k.t('DC SYSTEM PLAN', k.x0, k.y + 6, { size: 16, bold: true });
  k.t(title, k.x0, k.y + 12, { size: 10, color: GREY, maxW: k.cw * 0.6 });
  k.t(profile.business || profile.name || '', k.x1, k.y + 6, { size: 10, bold: true, align: 'right', maxW: k.cw * 0.38 });
  k.t(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), k.x1, k.y + 11, { size: 8, color: GREY, align: 'right' });
  k.y += 17;
  head('Summary');
  const sum = [
    ['System', `${p.V} V, ${p.battery.label}, ${p.cableLabel}${p.derate < 1 ? ` (derated × ${p.derate})` : ''}`],
    ['Daily use', `${p.daily.wh} Wh = ${p.daily.ah} Ah at ${p.V} V (DC ${p.daily.dcWh} Wh, 230 V ${p.daily.acWh} Wh${p.daily.idleWh ? `, incl. inverter idle ${p.daily.idleW} W × ${p.daily.idleH} h = ${p.daily.idleWh} Wh` : ''})`],
    ['Battery', p.battery.why],
    p.inverter ? ['Inverter', `${p.inverter.w} W pure sine, ${p.inverter.current} A DC at full output`] : null,
    p.solar ? ['Solar', `${p.solar.w} W → MPPT ${p.solar.mpptV} V / ${mpptText(p.solar)}${p.solar.pv && p.solar.pv.cold ? `; cold Voc ${p.solar.pv.cold} V` : ''}`] : null,
    p.dcdc ? ['DC-DC', `${p.dcdc.a} A (${p.dcdc.inI} A from the starter battery)`] : null,
    p.shore ? ['Mains charger', `${p.shore.a} A`] : null,
    p.main ? ['Main', `${fuseText(p.main)}, ${sizeText(p.main)} cable, ${ampsOr(p.isolator.a, ISOLATOR_SIZES)} isolator, ${ampsOr(p.shunt.a, SHUNT_SIZES)} shunt, ${ampsOr(p.busbar.a, BUSBAR_SIZES)} busbars`] : null,
  ].filter(Boolean);
  for (const [a, b] of sum) { const ls = k.wrap(b, k.cw - 32, 8); room(ls.length * k.lh(8) + 1); k.t(a, k.x0 + 1, k.y + 2.8, { size: 8, bold: true }); ls.forEach((s, i) => k.t(s, k.x0 + 32, k.y + 2.8 + i * k.lh(8), { size: 8, color: VALUE })); k.y += ls.length * k.lh(8) + 1.2; }
  for (const w of p.warnings) para('⚠ ' + w, { size: 8, bold: true, color: RED });
  if (p.profile) { head(`Charger settings (${p.profile.name}, ${p.V} V)`); for (const l of p.profile.lines) para('• ' + l, { size: 7.5 }); }
  // v0.7: every link between the kit, in order
  head('Connections, in order (red = positive, black = negative)');
  connections(p, inputs).forEach((c, i) => {
    const path = `${i + 1}.  ${[c.from, ...(c.via || []), c.to].join(' → ')}`;
    const spec = c.ac ? '' : [c.size ? `${c.size} mm² ${c.colour}` : `${cSize(c)} (${c.colour})`, c.length ? `${c.length} m` : null, c.vd != null ? `${c.vd}% drop (≤ ${c.limit ?? '–'}%)` : null].filter(Boolean).join('  ·  ');
    room(12); para(path, { size: 8.5, bold: true });
    if (spec) para(spec, { size: 8, color: VALUE, indent: 5 });
    if (c.fuse) para(`Fuse: ${c.fuse.text}, ${c.fuse.where}`, { size: 8, color: RED, indent: 5 });
    if (c.note) para(c.note, { size: 7, color: GREY, indent: 5 });
    k.y += 0.8;
  });
  // v0.7: the wiring diagram (same model as on screen)
  const wm = wiringModel(p, inputs);
  if ((k.H - k.M - 26 - k.y) / wm.H < 0.33) k.addPage();
  head('Wiring diagram (a layout guide, not to scale)');
  drawWiring(k, wm);
  head('Parts list');
  partsBody(k, p, room);
  head('Cable runs: current, fuse, cable and why');
  const cols = [['Run', 52], ['Current', 22], ['Fuse', 38], ['Cable', 20], ['Length', 16], ['Drop', 42]];
  const xs = []; let cx = k.x0; for (const [, w] of cols) { xs.push(cx); cx += w * (k.cw / 190); }
  const rowH = 5.4; room(rowH * 2); cols.forEach(([t], i) => k.t(t, xs[i] + 1, k.y + 3.8, { size: 7.5, bold: true })); k.y += rowH;
  for (const r of p.runs) {
    room(rowH + 12);
    const cells = [r.name, `${r.current} A${r.peak > r.current ? ` (${r.peak} pk)` : ''}`, r.fuse ? `${r.fuse.A} A ${r.fuse.label.replace(' fuse', '').replace(' (ATO/ATC)', '')}` : `over ${MAX_FUSE} A`, sizeText(r), r.length + ' m', r.vd ? `${r.vd.volts} V (${r.vd.pct}%) ≤ ${r.pct}%` : '–'];
    k.line(k.x0, k.y, k.x1, k.y, { w: 0.15 });
    cells.forEach((c, i) => k.t(c, xs[i] + 1, k.y + 3.8, { size: 7.5, bold: i === 0 || i === 3, color: i === 0 ? INK : VALUE, maxW: cols[i][1] * (k.cw / 190) - 2 }));
    k.y += rowH; para(r.why, { size: 6.8, color: GREY, indent: 1 });
  }
  head('Notes and standards');
  for (const n of [...p.notes, ...(p.inverter ? [p.inverter.surge] : []), p.chassis.why, ...SAFETY]) para('• ' + n, { size: 7.5 });
  k.footers();
  return k.blob();
}

const COL = { pos: [217, 45, 32], neg: [16, 24, 40], pv: [217, 45, 32], ac: [102, 112, 133] };
const BOX = { kit: [[255, 255, 255], [160, 172, 205], INK], fuse: [[255, 244, 242], [230, 140, 128], [159, 29, 20]], bus: [[41, 82, 255], [41, 82, 255], [255, 255, 255]], load: [[251, 252, 255], [190, 198, 215], INK], neg: [[242, 244, 247], [152, 162, 179], INK] };
function drawWiring(k, m) {
  const avail = k.H - k.M - 14 - k.y;
  const s = Math.min(k.cw / m.W, avail / m.H); const ox = k.x0 + (k.cw - m.W * s) / 2, oy = k.y + 2;
  const X = (x) => ox + x * s, Y = (y) => oy + y * s, pt = (u) => (u * s) / 0.3528;
  const d = k.doc;
  for (const w of m.wires) for (let i = 1; i < w.pts.length; i++) k.line(X(w.pts[i - 1][0]), Y(w.pts[i - 1][1]), X(w.pts[i][0]), Y(w.pts[i][1]), { w: 0.6, color: COL[w.c], dash: w.c === 'pv' ? [1.6, 1] : null });
  const rbox = (x, y, w, h, fill, line, r = 2.2) => { d.setDrawColor(...line); d.setLineWidth(0.3); d.setFillColor(...fill); d.roundedRect(X(x), Y(y), w * s, h * s, r * s, r * s, 'FD'); };
  for (const b of m.boxes) {
    const [fill, line, ink] = b.bad ? [[254, 243, 242], [217, 45, 32], [180, 35, 24]] : BOX[b.kind] || BOX.kit; rbox(b.x, b.y, b.w, b.h, fill, line, 7);
    if (b.kind === 'load') { k.t(b.t, X(b.x + 6), Y(b.y + 12), { size: pt(8), bold: true, color: ink, maxW: (b.w - 10) * s }); k.t(b.s[0] || '', X(b.x + 6), Y(b.y + 23), { size: pt(7), color: GREY, maxW: (b.w - 10) * s }); continue; }
    const n = b.s.length; const top = b.y + b.h / 2 - (n * 9) / 2 + 3; const cx = X(b.x + b.w / 2);
    k.t(b.t, cx, Y(top), { size: pt(b.kind === 'bus' ? 9 : 8.5), bold: true, color: ink, align: 'center', maxW: (b.w - 8) * s });
    b.s.forEach((t, i) => k.t(t, cx, Y(top + 10 + i * 9), { size: pt(7), color: b.kind === 'fuse' ? [159, 29, 20] : GREY, align: 'center', maxW: (b.w - 8) * s }));
  }
  for (const q of m.pills) {
    const fuse = q.kind === 'fuse' || q.bad; rbox(q.cx - q.w / 2, q.y, q.w, q.h, q.bad ? [254, 228, 226] : fuse ? [255, 244, 242] : [255, 255, 255], q.bad ? [217, 45, 32] : fuse ? [230, 140, 128] : [160, 172, 205], 6.5);
    k.t(q.t, X(q.cx), Y(q.y + 9.4), { size: pt(7.5), bold: true, color: q.bad ? [180, 35, 24] : fuse ? [159, 29, 20] : INK, align: 'center', maxW: (q.w - 4) * s });
  }
  for (const t of m.texts) k.t(t.t, X(t.x), Y(t.y), { size: pt(t.size), bold: !!t.bold, color: t.color === 'sub' ? GREY : INK, maxW: (m.W - t.x - 4) * s });
  k.y = oy + m.H * s + 2;
}

function partsBody(k, p, room) {
  for (const g of p.parts) {
    room(10); k.t(g.group.toUpperCase(), k.x0 + 1, k.y + 3.4, { size: 8.5, bold: true }); k.y += 5;
    for (const it of g.items) {
      const q = typeof it.qty === 'string' ? it.qty : it.qty !== 1 ? '× ' + it.qty : '';
      const ls = k.wrap(it.item, k.cw - 30, 8); const hgt = ls.length * k.lh(8) + 0.8;
      room(hgt + 1); k.rect(k.x0 + 1, k.y + 0.4, 2.8, 2.8, { lw: 0.2 });
      ls.forEach((s, i) => k.t(s, k.x0 + 6, k.y + 2.9 + i * k.lh(8), { size: 8 }));
      if (q) k.t(q, k.x1 - 1, k.y + 2.9, { size: 8, bold: true, align: 'right', color: VALUE });
      k.y += hgt; k.line(k.x0 + 6, k.y, k.x1, k.y, { w: 0.1, color: [210, 210, 210] }); k.y += 0.6;
    }
    k.y += 1.5;
  }
}
// v0.35: parts list on its own (as the AC parts list), with the charger settings.
export async function dcPartsPdf(p, { profile = {}, base } = {}) {
  const { jsPDF } = await loadJsPDF(base);
  const k = new Kit(jsPDF, { orientation: 'p', footer: 'DC parts list made with Zs Pro. A guide only: follow the makers\u2019 instructions.' });
  const room = (h) => { if (k.y + h > k.H - k.M - 10) k.addPage(); };
  k.t('DC PARTS LIST', k.x0, k.y + 6, { size: 16, bold: true });
  k.t(`${p.V} V ${p.battery.label} system`, k.x0, k.y + 12, { size: 10, color: GREY, maxW: k.cw * 0.6 });
  k.t(profile.business || profile.name || '', k.x1, k.y + 6, { size: 10, bold: true, align: 'right', maxW: k.cw * 0.38 });
  k.y += 17;
  partsBody(k, p, room);
  room(14); k.t('CHARGER SETTINGS (' + p.profile.name + ', ' + p.V + ' V)', k.x0 + 1, k.y + 3.4, { size: 8.5, bold: true }); k.y += 5;
  for (const l of p.profile.lines) { const ls = k.wrap('• ' + l, k.cw - 4, 7.5); room(ls.length * k.lh(7.5) + 1); ls.forEach((t, i) => k.t(t, k.x0 + 2, k.y + 2.8 + i * k.lh(7.5), { size: 7.5 })); k.y += ls.length * k.lh(7.5) + 0.6; }
  k.footers();
  return k.blob();
}
