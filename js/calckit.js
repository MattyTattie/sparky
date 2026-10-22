// =====================================================================
// calckit.js — v0.7: the shared look for every calculator screen.
// Short input cards, a helper line under each field, advanced fields
// under "More options", an answer card at the top with pass/fail chips,
// and the details folded away. Layout only: no sums in here.
// =====================================================================
import { h, icon } from './ui.js';
import { GROUPINGS, GROUP_HINT, cgFor } from './cables.js';

// The calculator picker (Calculators home). key = what's remembered as "last used".
export const CALCS = [
  { key: 'size', href: '#/calc/size', ic: 'zap', title: 'Size a cable & breaker', sub: 'Put in the load and the length: get the breaker and the smallest cable that passes.' },
  { key: 'check', href: '#/calc/check', ic: 'check', title: 'Check a circuit', sub: 'Zs, volt drop, current rating and the adiabatic check for a cable you\u2019ve picked.' },
  { key: 'md', href: '#/calc/md', ic: 'gauge', title: 'Maximum demand', sub: 'List the cooker, heaters, showers, sockets and lights: get the On-Site Guide figure with diversity.' },
  { key: 'ring', href: '#/calc/ring', ic: 'link', title: 'Ring final check', sub: 'Your r1, rn and r2 readings: do the ends match, and what R1+R2 to expect.' },
  { key: 'fault', href: '#/calc/fault', ic: 'zap', title: 'Fault level at a sub-board', sub: 'PFC at the origin and the sub-main: get the PSCC and PEFC at the far end against the 6 or 10 kA rating.' },
  { key: 'contactor', href: '#/calc/contactor', ic: 'layers', title: 'Contactor picker', sub: 'Pick the load type: get the AC-1 / AC-3 category and the size, with a margin.' },
  { key: 'xfmr', href: '#/calc/xfmr', ic: 'gauge', title: 'Control transformer', sub: 'VA and voltages: primary and secondary current, and the fuse each side.' },
  { key: 'symbols', href: '#/calc/symbols', ic: 'clipboard', title: 'Symbols', sub: 'Ib, In, Iz, Zs, Ca, Icu, AC-3\u2026: what each one means, in one line.' },
  { key: 'pv', href: '#/calc/dc/pv', ic: 'sun', title: 'Solar string & battery checks', sub: 'Cold-morning string voltage, PV cable and string fuses; battery-to-inverter leads.' },
  { key: 'plan', href: '#/calc/dc/plan', ic: 'layers', title: 'DC system planner', sub: 'Vans, boats, sheds: step by step to a battery, cables, fuses, wiring diagram and parts list.' },
];
export const setLastCalc = (key) => localStorage.setItem('sparky.calclast', key);
export const lastCalc = () => localStorage.getItem('sparky.calclast');

// Folded sections remember if you opened or closed them (forms redraw on every change).
const SS = typeof sessionStorage !== 'undefined' ? sessionStorage : { getItem: () => null, setItem: () => {} };
const ST = JSON.parse(SS.getItem('sparky.fold') || '{}');
const keep = () => SS.setItem('sparky.fold', JSON.stringify(ST));
export const isOpen = (id, dflt = false) => (id in ST ? ST[id] : dflt);
export function setOpen(id, on) { ST[id] = !!on; keep(); }
export function fold(id, title, kids, { open = false, cls = '', badge = null, sub = null } = {}) {
  return h('details', { class: 'fold ' + cls, open: isOpen(id, open) ? true : null, 'data-fold': id, ontoggle: (e) => setOpen(id, e.target.open) },
    h('summary', {}, h('span', { class: 'foldt' }, h('span', {}, title), sub ? h('span', { class: 'folds' }, sub) : null), badge, icon('chevronRight', { size: 18, cls: 'foldic' })), h('div', { class: 'foldin' }, kids));
}
// "More options" inside an input card, with the defaults shown on the summary line.
export const more = (id, kids, shows = '') => fold(id, 'More options', kids, { cls: 'more', sub: shows ? 'Using: ' + shows : null });

// Form bits, bound to an object v with set(k, val).
export function formKit(v, set) {
  const help = (t) => t ? h('span', { class: 'help' }, t) : null;
  const unitWrap = (inp, unit) => unit ? h('span', { class: 'withunit' }, inp, h('span', { class: 'unit' }, unit)) : inp;
  return {
    help,
    chips: (k, opts, cls = '') => h('div', { class: 'chips ' + cls }, opts.map(([val, t]) => h('button', { class: 'chip' + (String(v[k]) === String(val) ? ' on' : ''), type: 'button', onclick: () => set(k, val) }, t))),
    field: (label, control, hint) => h('div', { class: 'f fld2' }, h('span', { class: 'lab' }, label), control, help(hint)),
    num: (k, label, { unit = '', hint = '', ph = '' } = {}) => h('label', { class: 'f fld2' }, h('span', {}, label), unitWrap(h('input', { inputmode: 'decimal', value: v[k] ?? '', placeholder: ph, onchange: (e) => set(k, e.target.value.trim()) }), unit), help(hint)),
    sel: (k, label, opts, hint = '') => h('label', { class: 'f fld2' }, h('span', {}, label), h('select', { onchange: (e) => set(k, e.target.value) }, opts.map(([val, t]) => h('option', { value: val, selected: String(v[k]) === String(val) ? true : null }, t))), help(hint)),
    chk: (k, label, hint = '') => h('div', { class: 'fld2' }, h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: v[k], onchange: (e) => set(k, e.target.checked) }), label), help(hint)),
    seg: (k, label, opts, hint = '', cls = '') => h('div', { class: 'f fld2' }, label ? h('span', { class: 'lab' }, label) : null, h('div', { class: 'chips ' + cls }, opts.map(([val, t]) => h('button', { class: 'chip' + (String(v[k]) === String(val) ? ' on' : ''), type: 'button', onclick: () => set(k, val) }, t))), help(hint)),
  };
}
// v0.21: gives = what this step works out (e.g. 'Ib'), shown as a small tag; key = data-card for tests/screens.
export const icard = (title, kids, { step = null, cls = '', gives = '', key = '' } = {}) => h('div', { class: 'card icard ' + cls, 'data-card': key || null }, h('h2', {}, step ? h('span', { class: 'stepno' }, step) : null, title, gives ? h('span', { class: 'gives' }, '→ ' + gives) : null), kids);

// Answer card: a kicker, the big answer, a line under it, and pass/fail chips.
// state: true = pass, false = fail, 'warn' = check it, null = not worked out.
export const pchip = (state, text) => h('span', { class: 'pchip ' + (state === true ? 'ok' : state === false ? 'bad' : state === 'warn' ? 'warn' : 'na') }, icon(state === true ? 'check' : state === false ? 'x' : state === 'warn' ? 'alert' : 'info', { size: 14 }), text);
export function answerCard({ kicker = 'Answer', big, sub = null, chips = [], good = true, extra = null }) {
  return h('div', { class: 'card anscard ' + (good === true ? 'good' : good === 'warn' ? 'warn' : 'bad') },
    h('div', { class: 'ans-k' }, kicker),
    [].concat(big).filter(Boolean).map((b) => h('div', { class: 'ans-big' }, b)),
    sub ? h('div', { class: 'ans-sub' }, sub) : null,
    chips.length ? h('div', { class: 'pchips' }, chips) : null, extra);
}
// Amber banner: what's wrong, and what to do about it.
export const banner = (text, todo = '', kind = 'amber') => h('div', { class: 'banner ' + kind, role: 'note' }, icon('alert', { size: 20 }), h('div', {}, h('div', { class: 'bt' }, text), todo ? h('div', { class: 'bd' }, todo) : null));
// One check line (✓/✗) used inside the folded details.
export const resline = (ok, text, sub) => h('div', { class: 'resline ' + (ok === true ? 'ok' : ok === false ? 'bad' : 'na') }, h('b', {}, ok === true ? '✓' : ok === false ? '✗' : '–'), h('div', {}, h('div', {}, text), sub ? h('div', { class: 'note' }, sub) : null));
// "Every size" etc. folded into a card.
export const detailCard = (id, title, kids, opts = {}) => h('div', { class: 'card foldcard' }, fold(id, title, kids, opts));

// v0.22: 'Grouped how' (BS 7671 Table 4C1 rows). Shows N/A, greyed, until 2 or more circuits are grouped.
export const isGrouped = (v) => Math.floor(Number(v.grouped) || 1) > 1;
export function groupSel(F, v) {
  if (!isGrouped(v)) return h('label', { class: 'f fld2' }, h('span', {}, 'Grouped how'), h('select', { disabled: true, class: 'autona', 'aria-label': 'Grouped how: N/A, not grouped' }, h('option', {}, 'N/A (not grouped)')), h('span', { class: 'help' }, GROUP_HINT));
  return [F.sel('grouping', 'Grouped how', GROUPINGS), h('p', { class: 'help' }, `Cg ${cgFor(v.grouping, v.grouped)} (Table 4C1). ${GROUP_HINT}`)];
}
export const groupWords = (v) => (isGrouped(v) ? `${Math.floor(Number(v.grouped))} grouped, ${((GROUPINGS.find(([k]) => k === v.grouping) || GROUPINGS[0])[1]).split(/[,(]/)[0].trim().toLowerCase()}` : 'not grouped');
