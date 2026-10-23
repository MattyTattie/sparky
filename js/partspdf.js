// partspdf.js (v0.25): a simple A4 "Parts used" list. Shows the job name and
// certificate numbers only: no customer name or address.
import { loadJsPDF, Kit, GREY, INK, VALUE } from './pdfkit.js';

export async function partsPdf(res, { title = 'Job', profile = {}, base } = {}) {
  const { jsPDF } = await loadJsPDF(base);
  const k = new Kit(jsPDF, { orientation: 'p', footer: 'Parts list made with Zs Pro from the schedules. Check the boards before ordering.' });
  const room = (hh) => { if (k.y + hh > k.H - k.M - 10) k.addPage(); };
  const head = (t, sub = '') => { room(16); k.y += 2; k.rect(k.x0, k.y, k.cw, 6.5, { lw: 0.3, color: INK, fill: [235, 238, 250] }); k.t(t, k.x0 + 2, k.y + 4.6, { size: 9.5, bold: true }); if (sub) k.t(sub, k.x1 - 2, k.y + 4.6, { size: 8, color: GREY, align: 'right' }); k.y += 8.5; };
  const row = (qty, name, note = '') => {
    const ls = k.wrap(name, k.cw - 60, 9); const ns = note ? k.wrap(note, 42, 7.5) : [];
    const hh = Math.max(ls.length * k.lh(9), ns.length * k.lh(7.5)) + 1.6; room(hh);
    k.t(`${qty} ×`, k.x0 + 12, k.y + 3.4, { size: 9, bold: true, align: 'right', color: VALUE });
    ls.forEach((s, i) => k.t(s, k.x0 + 15, k.y + 3.4 + i * k.lh(9), { size: 9, color: VALUE }));
    ns.forEach((s, i) => k.t(s, k.x1 - 1, k.y + 3.2 + i * k.lh(7.5), { size: 7.5, color: GREY, align: 'right' }));
    k.y += hh; k.line(k.x0, k.y - 0.4, k.x1, k.y - 0.4, { w: 0.1, color: [200, 200, 200] });
  };
  k.t('PARTS USED', k.x0, k.y + 6, { size: 16, bold: true });
  k.t(title, k.x0, k.y + 12, { size: 10, color: INK, maxW: k.cw * 0.6 });
  k.t(profile.business || profile.name || '', k.x1, k.y + 6, { size: 10, bold: true, align: 'right', maxW: k.cw * 0.38 });
  k.t(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), k.x1, k.y + 11, { size: 8, color: GREY, align: 'right' });
  k.y += 15;
  if (res.from.length) { const ls = k.wrap('From ' + res.from.join(', '), k.cw, 8); ls.forEach((s) => { k.t(s, k.x0, k.y + 3, { size: 8, color: GREY }); k.y += k.lh(8); }); }
  for (const b of res.boards) {
    head(`${b.ref}${b.location ? ' · ' + b.location : ''}`, `${b.ways} way(s)${b.spares ? ', ' + b.spares + ' spare' : ''}${res.boards.length > 1 && res.from.length > 1 ? ' · ' + b.cert : ''}`);
    if (!b.items.length) { k.t('No devices filled in on this board.', k.x0 + 2, k.y + 3.4, { size: 8.5, color: GREY }); k.y += 6; }
    for (const it of b.items) row(it.qty, it.name, it.circuits.length ? (it.rcd ? 'covers ' : 'circuits ') + it.circuits.join(', ') : '');
  }
  if (res.boards.length > 1) { head('Total for the job'); for (const t of res.totals) row(t.qty, t.name); }
  k.footers('');
  return k.blob();
}
