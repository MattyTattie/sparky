// calcmore.js — v0.19 screens: control circuit transformer, contactor picker and fault level at a
// sub-board. Sums in calcextra.js.
import { h, fill } from './ui.js';
import { route, page } from './app.js';
import { setLastCalc, formKit, icard, more, answerCard, pchip, detailCard, banner } from './calckit.js';
import { transformer, contactor, CATS, catFor, faultLevel, KA_RATINGS } from './calcextra.js';
import { CABLES } from './cables.js';

const screen = (key, title, defaults, build) => route(new RegExp('^/calc/' + key + '$'), async () => {
  setLastCalc(key);
  const LS = 'sparky.' + key + '1';
  const v = { ...defaults, ...(JSON.parse(localStorage.getItem(LS) || 'null') || {}) };
  const top = h('div'); const form = h('div'); const work = h('div');
  const set = (k, val) => { v[k] = val; localStorage.setItem(LS, JSON.stringify(v)); draw(); };
  const F = formKit(v, set);
  const draw = () => build({ v, F, top, form, work });
  draw();
  page(title, [top, form, work], { back: '#/calc' });
});
const typical = (t) => h('p', { class: 'note warnnote' }, 'Typical, check your books. ' + t);

// ---------- Control circuit transformer ----------
screen('xfmr', 'Control transformer', { va: '250', vp: '400', vs: '24' }, ({ v, F, top, form, work }) => {
  const r = transformer({ va: v.va, vp: v.vp, vs: v.vs });
  fill(top, r.ok ? answerCard({ kicker: 'Fuses', big: [`Primary ${r.fp ?? '?'} A time-delay / aM`, `Secondary ${r.fs ?? '?'} A gG`], sub: `Primary ${r.ip} A · secondary ${r.is} A at ${v.va} VA`, chips: [pchip('warn', 'Typical, check the maker')] }) : banner(r.error, '', 'red'));
  fill(form, icard('The transformer', [
    F.num('va', 'Rating', { unit: 'VA', hint: 'On the plate, e.g. 100, 250, 500 VA' }),
    h('div', { class: 'grid2' }, F.seg('vp', 'Primary', [['400', '400 V'], ['230', '230 V']], '', 'small'), F.seg('vs', 'Secondary', [['230', '230 V'], ['110', '110 V'], ['24', '24 V'], ['12', '12 V']], '', 'small'))], { step: 1 }));
  fill(work, r.ok ? [detailCard('xf-how', 'How it worked it out', h('ul', { class: 'note' }, r.notes.map((t) => h('li', {}, t)))),
    typical('Switch-on inrush is often 10–25 × the primary current for a few milliseconds, so the primary fuse needs a time-delay (aM / motor-rated) type. Check the transformer maker\u2019s fuse table.')] : null);
});

// ---------- Contactor picker ----------
screen('contactor', 'Contactor picker', { cat: 'AC-1', load: '10', unit: 'kW', phase: '3', pf: '1', eff: '0.85', coil: '230' }, ({ v, F, top, form, work }) => {
  const c = catFor(v.cat); const motor = ['AC-3', 'AC-4'].includes(c.k);
  const r = contactor({ cat: v.cat, load: v.load, unit: v.unit, phase: v.phase, pf: v.pf, eff: motor ? v.eff : 1 });
  fill(top, r.ok ? answerCard({ kicker: `Contactor, ${c.k}`, big: r.size ? `${r.size} A ${r.line}${r.next ? ' (or ' + r.next + ' A)' : ''}` : 'Bigger than the sizes in the app', sub: `Load ${r.amps} A${v.phase === '3' ? ' per phase' : ''} · needs ${r.need} A on the ${r.line} line${c.mult !== 1 ? ' (× ' + c.mult + ' margin)' : ''}`,
    chips: [pchip(true, c.label), c.typical ? pchip('warn', 'Typical, check the maker') : null].filter(Boolean),
    extra: h('div', { class: 'ans-why' }, `Coil: order a ${v.coil} V ${v.coil === '24' ? 'AC or DC (check which)' : 'AC'} coil to match your control circuit.`) }) : banner(r.error, '', 'red'));
  fill(form,
    icard('What it switches', [F.sel('cat', 'Type of load', CATS.map((x) => [x.k, `${x.k} – ${x.label}`]), c.why)], { step: 1 }),
    icard('The load', [
      F.seg('phase', '', [['1', 'Single-phase 230 V'], ['3', 'Three-phase 400 V']], '', 'seg2'),
      h('div', { class: 'grid2' }, F.num('load', v.unit === 'kW' ? 'Load' : 'Current', { unit: v.unit === 'kW' ? 'kW' : 'A' }), F.seg('unit', 'Load in', [['kW', 'kW'], ['A', 'Amps']], '', 'small')),
      v.unit === 'kW' ? more('ct-load', [F.num('pf', 'Power factor', { hint: '1 for heaters, about 0.85 for motors.' }), motor ? F.num('eff', 'Motor efficiency', { hint: 'About 0.85 for small motors. Better: use the nameplate FLC in amps.' }) : null], `pf ${v.pf}${motor ? ', eff ' + v.eff : ''}`) : null], { step: 2 }),
    icard('The coil', [F.seg('coil', 'Control voltage', [['230', '230 V'], ['110', '110 V'], ['24', '24 V']], 'The coil must match the control circuit, not the load.', 'small')], { step: 3 }));
  fill(work, r.ok ? [
    detailCard('ct-side', 'Reading the side of a contactor', [
      h('p', { class: 'note' }, 'A contactor lists several ratings, for example “AC-1 40 A, AC-3 25 A, AC-3 11 kW 400 V”. It\u2019s the same contactor on different kinds of load. Read only the line for your category:'),
      h('ul', { class: 'note' }, CATS.map((x) => h('li', { class: x.k === c.k ? 'on' : '' }, h('b', {}, x.k + ': '), x.label + '. ', x.why))),
      h('p', { class: 'note' }, `Worked out: ${r.how} = ${r.amps} A${c.mult !== 1 ? `, × ${c.mult} = ${r.need} A` : ''}, then the next standard ${r.line} size up.`)]),
    c.typical || c.k === 'AC-1' ? typical('The margins are typical figures. The contactor maker\u2019s rating for your category takes priority.') : null] : null);
});

// ---------- Fault level at a sub-board ----------
const FL_CABLES = ['swa', 'swa3', 'swa4', 'swaX', 'swa4X', 'singles', 'te', 'h07', 'tails'];
screen('fault', 'Fault level at a sub-board', { phase: '1', pfc: '16', ze: '0.35', cable: 'swa', size: '16', length: '20', ka: '6' }, ({ v, F, top, form, work }) => {
  const cab = CABLES[v.cable] || CABLES.swa; if (!cab.sizes.map(String).includes(String(v.size))) v.size = String(cab.sizes[0]);
  const armour = /^swa/.test(v.cable) && (cab.cores === 2 || cab.cores === 4);
  const r = faultLevel({ pfc: v.pfc, ze: v.ze, phase: v.phase, cable: v.cable, size: v.size, length: v.length, armour, deviceKa: v.ka });
  fill(top, r.ok ? answerCard({ kicker: 'At the sub-board', good: r.pass ? true : false, big: `${r.worst} kA`, sub: `PSCC ${r.pscc} kA${v.phase === '3' ? ' (3-phase)' : ''}${r.pefc != null ? ` · PEFC ${r.pefc} kA` : ''}`,
    chips: [pchip(r.pass, `Devices rated ${r.ka} kA`)] }) : banner(r.error, '', 'red'),
    r.ok && !r.pass ? banner(`${r.worst} kA is more than the ${r.ka} kA rating of the devices.`, 'Use higher-rated devices (10 kA or more), or check the maker\u2019s back-up (cascade) table with the upstream fuse.') : null);
  fill(form,
    icard('At the origin', [F.seg('phase', '', [['1', 'Single-phase'], ['3', 'Three-phase']], v.phase === '3' ? 'Three-phase fault taken as 2 × the single-phase PSCC (rule of thumb).' : '', 'seg2'),
      h('div', { class: 'grid2' }, F.num('pfc', 'PSCC at the origin', { unit: 'kA', hint: 'Measured L–N, or 16 kA if not known' }), F.num('ze', 'Ze', { unit: 'Ω', hint: 'For the earth fault current' }))], { step: 1 }),
    icard('The sub-main', [F.sel('cable', 'Cable', FL_CABLES.map((k) => [k, CABLES[k].label])),
      h('div', { class: 'grid2' }, F.sel('size', 'Size', cab.sizes.map((s) => [String(s), s + ' mm²'])), F.num('length', 'Length', { unit: 'm' }))], { step: 2 }),
    icard('The sub-board', [F.seg('ka', 'Breaking capacity of its devices', KA_RATINGS.map((k) => [String(k), k + ' kA']), 'On the breakers, the number in a box (e.g. 6000 = 6 kA).', 'small')], { step: 3 }));
  fill(work, r.ok ? [detailCard('fl-how', 'How it worked it out', h('ol', { class: 'steps' }, r.steps.map((t) => h('li', {}, t)))),
    r.big ? typical('Above 35 mm² cable reactance matters, so this estimate is on the high side.') : h('p', { class: 'note' }, 'An estimate: measure the PFC at the sub-board when you test.')] : null);
});
