// a11y.js — v0.29: make sure every number box is linked to its label (and unit) for screen readers.
// The "what it means" term buttons inside a <label> steal the label from the input (a button is
// labelable), so boxes like Ze or Ipf were read out as just "edit text". This pass gives any input,
// select or textarea with no working label an aria-label built from the label text plus its unit.
// Pure DOM, no layout change. Called from decorate() on every render.
const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
const labelled = (el) => {
  if (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) return true;
  const ls = el.labels ? [...el.labels] : [];
  return ls.some((l) => l.control === el && txt(l));
};
export function nameFor(el) {
  let name = ''; let unit = '';
  const lab = el.closest('label');
  if (lab) {
    const first = [...lab.children].find((c) => c.tagName === 'SPAN' && !c.classList.contains('withunit') && !c.contains(el));
    name = txt(first);
    const u = el.parentElement && el.parentElement.classList.contains('withunit') ? el.parentElement.querySelector('.unit') : null;
    unit = txt(u);
  }
  if (!name) { const fld = el.closest('.fld'); if (fld) { const s = fld.querySelector('.lab span'); name = txt(s); } }
  if (!name) {
    const td = el.closest('td'); const table = td && td.closest('table');
    if (td && table) {
      const th = table.tHead && table.tHead.rows.length ? table.tHead.rows[table.tHead.rows.length - 1].cells[td.cellIndex] : null;
      const row = td.parentElement; const no = row && row.cells[0] ? txt(row.cells[0]) : '';
      name = [no ? `Circuit ${no}` : '', txt(th)].filter(Boolean).join(' ');
    }
  }
  if (!name) return '';
  if (unit && !name.includes(unit)) name += ` (${unit})`;
  return name;
}
export function labelInputs(root) {
  root.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea').forEach((el) => {
    if (labelled(el)) return;
    const n = nameFor(el); if (n) el.setAttribute('aria-label', n);
  });
}
