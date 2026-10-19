// dcplanpdf.js — the DC system plan as an A4 PDF (summary, parts list,
// cable runs with the reasons, safety notes). Uses the same Kit as the certificates.
import { loadJsPDF, Kit, GREY, INK, VALUE, RED } from './pdfkit.js';
import { SAFETY } from './dcplan.js';

export async function dcPlanPdf(p, { title = 'DC system plan', profile = {}, base } = {}) {
  const { jsPDF } = await loadJsPDF(base);
  const k = new Kit(jsPDF, { orientation: 'p', footer: 'DC system plan made with Sparky. A guide only: follow the makers\u2019 instructions.' });
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
    ['Daily use', `${p.daily.wh} Wh = ${p.daily.ah} Ah at ${p.V} V (DC ${p.daily.dcWh} Wh, 230 V ${p.daily.acWh} Wh)`],
    ['Battery', p.battery.why],
    p.inverter ? ['Inverter', `${p.inverter.w} W pure sine, ${p.inverter.current} A DC at full output`] : null,
    p.solar ? ['Solar', `${p.solar.w} W → MPPT ${p.solar.mpptV} V / ${p.solar.mppt} A${p.solar.pv && p.solar.pv.cold ? `; cold Voc ${p.solar.pv.cold} V` : ''}`] : null,
    p.dcdc ? ['DC-DC', `${p.dcdc.a} A (${p.dcdc.inI} A from the starter battery)`] : null,
    p.shore ? ['Mains charger', `${p.shore.a} A`] : null,
    p.main ? ['Main', `${p.main.fuse ? p.main.fuse.A + ' A ' + p.main.fuse.label : '?'}, ${p.main.size ?? '?'} mm² cable, ${p.isolator.a} A isolator, ${p.shunt.a} A shunt, ${p.busbar.a} A busbars`] : null,
  ].filter(Boolean);
  for (const [a, b] of sum) { const ls = k.wrap(b, k.cw - 32, 8); room(ls.length * k.lh(8) + 1); k.t(a, k.x0 + 1, k.y + 2.8, { size: 8, bold: true }); ls.forEach((s, i) => k.t(s, k.x0 + 32, k.y + 2.8 + i * k.lh(8), { size: 8, color: VALUE })); k.y += ls.length * k.lh(8) + 1.2; }
  for (const w of p.warnings) para('⚠ ' + w, { size: 8, bold: true, color: RED });
  head('Parts list');
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
  head('Cable runs: current, fuse, cable and why');
  const cols = [['Run', 52], ['Current', 22], ['Fuse', 38], ['Cable', 20], ['Length', 16], ['Drop', 42]];
  const xs = []; let cx = k.x0; for (const [, w] of cols) { xs.push(cx); cx += w * (k.cw / 190); }
  const rowH = 5.4; room(rowH * 2); cols.forEach(([t], i) => k.t(t, xs[i] + 1, k.y + 3.8, { size: 7.5, bold: true })); k.y += rowH;
  for (const r of p.runs) {
    room(rowH + 12);
    const cells = [r.name, `${r.current} A${r.peak > r.current ? ` (${r.peak} pk)` : ''}`, r.fuse ? `${r.fuse.A} A ${r.fuse.label.replace(' fuse', '').replace(' (ATO/ATC)', '')}` : '?', r.size ? r.size + ' mm²' : '?', r.length + ' m', r.vd ? `${r.vd.volts} V (${r.vd.pct}%) ≤ ${r.pct}%` : '?'];
    k.line(k.x0, k.y, k.x1, k.y, { w: 0.15 });
    cells.forEach((c, i) => k.t(c, xs[i] + 1, k.y + 3.8, { size: 7.5, bold: i === 0 || i === 3, color: i === 0 ? INK : VALUE, maxW: cols[i][1] * (k.cw / 190) - 2 }));
    k.y += rowH; para(r.why, { size: 6.8, color: GREY, indent: 1 });
  }
  head('Notes and standards');
  for (const n of [...p.notes, ...(p.inverter ? [p.inverter.surge] : []), p.chassis.why, ...SAFETY]) para('• ' + n, { size: 7.5 });
  k.footers();
  return k.blob();
}
