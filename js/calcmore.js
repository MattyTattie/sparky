// calcmore.js — v0.19 screens: control circuit transformer, contactor picker and fault level at a
// sub-board. Sums in calcextra.js.
import { h, fill, toast } from './ui.js';
import { route, page, go } from './app.js';
import * as db from './db.js';
import { flush } from './state.js';
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
  // v0.21: supply side first, then the transformer itself.
  fill(form,
    icard('What feeds it', [F.seg('vp', 'Primary (supply) voltage', [['400', '400 V'], ['230', '230 V']], '', 'small')], { step: 1, key: 'supply' }),
    icard('The transformer', [
      F.num('va', 'Rating', { unit: 'VA', hint: 'On the plate, e.g. 100, 250, 500 VA' }),
      F.seg('vs', 'Secondary voltage', [['230', '230 V'], ['110', '110 V'], ['24', '24 V'], ['12', '12 V']], '', 'small')], { step: 2, gives: 'Ip, Is, fuses', key: 'xfmr' }));
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
    icard('The load', [
      F.seg('phase', '', [['1', 'Single-phase 230 V'], ['3', 'Three-phase 400 V']], '', 'seg2'),
      h('div', { class: 'grid2' }, F.num('load', v.unit === 'kW' ? 'Load' : 'Current', { unit: v.unit === 'kW' ? 'kW' : 'A' }), F.seg('unit', 'Load in', [['kW', 'kW'], ['A', 'Amps']], '', 'small')),
      v.unit === 'kW' ? more('ct-load', [F.num('pf', 'Power factor', { hint: '1 for heaters, about 0.85 for motors.' }), motor ? F.num('eff', 'Motor efficiency', { hint: 'About 0.85 for small motors. Better: use the nameplate FLC in amps.' }) : null], `pf ${v.pf}${motor ? ', eff ' + v.eff : ''}`) : null], { step: 1, gives: 'Ib', key: 'load' }),
    icard('What it switches', [F.sel('cat', 'Type of load', CATS.map((x) => [x.k, `${x.k} – ${x.label}`]), c.why)], { step: 2, gives: 'Contactor size', key: 'category' }),
    icard('The coil', [F.seg('coil', 'Control voltage', [['230', '230 V'], ['110', '110 V'], ['24', '24 V']], 'The coil must match the control circuit, not the load.', 'small')], { step: 3, key: 'coil' }));
  fill(work, r.ok ? [
    detailCard('ct-side', 'Reading the side of a contactor', [
      h('p', { class: 'note' }, 'A contactor lists several ratings, for example “AC-1 40 A, AC-3 25 A, AC-3 11 kW 400 V”. It\u2019s the same contactor on different kinds of load. Read only the line for your category:'),
      h('ul', { class: 'note' }, CATS.map((x) => h('li', { class: x.k === c.k ? 'on' : '' }, h('b', {}, x.k + ': '), x.label + '. ', x.why))),
      h('p', { class: 'note' }, `Worked out: ${r.how} = ${r.amps} A${c.mult !== 1 ? `, × ${c.mult} = ${r.need} A` : ''}, then the next standard ${r.line} size up.`)]),
    c.typical || c.k === 'AC-1' ? typical('The margins are typical figures. The contactor maker\u2019s rating for your category takes priority.') : null] : null);
});

// ---------- Fault level at a sub-board ----------
// v0.29: plain intro, units on every label, the working in Ω, a clear breaker check, and
// (opened from a board on a cert) a button that puts the answer in that board's Ipf box.
const FL_CABLES = ['swa', 'swa3', 'swa4', 'swaX', 'swa4X', 'singles', 'te', 'h07', 'tails'];
const FL_DEFAULTS = { phase: '1', pfc: '', ze: '', cable: 'swa', size: '16', length: '', ka: '6' };
route(/^\/calc\/fault(?:\/([^/]+)\/(\d+))?$/, async (certId, bi) => {
  setLastCalc('fault');
  const LS = 'sparky.fault1';
  const v = { ...FL_DEFAULTS, ...(JSON.parse(localStorage.getItem(LS) || 'null') || {}) };
  const cert = certId ? await db.get('certs', certId) : null; const board = cert && cert.boards ? cert.boards[Number(bi)] : null;
  if (cert && board) { const sp = cert.supply || {}; if (sp.ipf) v.pfc = String(sp.ipf); if (sp.ze) v.ze = String(sp.ze); }
  const top = h('div'); const form = h('div'); const work = h('div');
  const set = (k, val) => { v[k] = val; localStorage.setItem(LS, JSON.stringify(v)); draw(); };
  const F = formKit(v, set);
  const draw = () => {
    const cab = CABLES[v.cable] || CABLES.swa; if (!cab.sizes.map(String).includes(String(v.size))) v.size = String(cab.sizes[0]);
    const armour = /^swa/.test(v.cable) && (cab.cores === 2 || cab.cores === 4);
    const r = faultLevel({ pfc: v.pfc, ze: v.ze, phase: v.phase, cable: v.cable, size: v.size, length: v.length, armour, deviceKa: v.ka });
    const three = v.phase === '3';
    fill(top, h('p', { class: 'note flintro' }, 'Works out the fault current at a sub-board, so you can check its breakers can handle it.'), r.ok ? answerCard({ kicker: 'Fault level at the sub-board', good: r.pass ? true : false, big: `${r.worst} kA`,
      sub: `The larger of the two: ${r.which === 'PEFC' ? 'the earth fault (PEFC)' : 'the short circuit (PSCC)'}.`,
      chips: [pchip(r.pass, `${r.ka} kA breakers: ${r.pass ? 'OK' : 'NOT enough'}`)],
      extra: h('div', {},
        h('ul', { class: 'note flsum' },
          h('li', {}, h('b', {}, `PSCC ${r.pscc} kA`), ` – short circuit between live conductors${three ? ' (three-phase)' : ' (line to neutral)'}.`),
          r.pefc != null ? h('li', {}, h('b', {}, `PEFC ${r.pefc} kA`), ' – earth fault, line to earth.') : h('li', {}, 'Put in Ze to get the earth fault current (PEFC) too.'),
          r.zeSub != null ? h('li', {}, `Ze at the sub-board (Ze + R1+R2): ${r.zeSub} Ω – handy for the Zs checks there.`) : null),
        board ? h('button', { class: 'btn primary', style: 'margin-top:10px;width:100%', onclick: async () => {
          await flush(); const c = await db.get('certs', cert.id); const b = c.boards[Number(bi)]; b.ipf = String(r.worst);
          c.updatedAt = new Date().toISOString(); c.version = (c.version || 0) + 1; await db.put('certs', c);
          toast(`${r.worst} kA put in Ipf for ${b.ref || 'the board'}`); go(`#/cert/${c.id}/b/${bi}`); } }, `Use ${r.worst} kA as Ipf on ${board.ref || 'this board'}`) : null) })
      : answerCard({ kicker: 'Fault level at the sub-board', big: 'Fill in the boxes', sub: 'Put in the fault current and Ze at the main board, then the sub-main cable.', good: 'warn' }),
      r.ok && !r.pass ? banner(`${r.worst} kA is more than the ${r.ka} kA rating of the breakers.`, 'Use higher-rated devices (10 kA or more), or check the maker’s back-up (cascade) table with the upstream fuse. A consumer unit fed by a BS 88-3 fuse of 100 A or less is usually rated 16 kA conditional.') : null);
    fill(form,
      icard('At the main board (origin)', [F.seg('phase', '', [['1', 'Single-phase'], ['3', 'Three-phase']], three ? 'Three-phase fault taken as 2 × the single-phase PSCC (rule of thumb from Guidance Note 3).' : '', 'seg2'),
        h('div', { class: 'grid2' }, F.num('pfc', 'Fault current at the main board (PFC)', { unit: 'kA', hint: 'Your highest PSCC or PEFC reading at the origin' }), F.num('ze', 'Ze at the origin', { unit: 'Ω', hint: 'For the earth fault current' }))], { step: 1, gives: 'source impedance', key: 'origin' }),
      icard('The sub-main cable', [F.sel('cable', 'Sub-main cable', FL_CABLES.map((k) => [k, CABLES[k].label])),
        h('div', { class: 'grid2' }, F.sel('size', 'Size (mm²)', cab.sizes.map((s) => [String(s), s + ' mm²'])), F.num('length', 'Length one way', { unit: 'm' }))], { step: 2, gives: 'R1+Rn and R1+R2', key: 'run' }),
      icard('Breakers at the sub-board', [F.seg('ka', 'Breaking capacity (kA)', KA_RATINGS.map((k) => [String(k), k + ' kA']), 'On the breakers, the number in a box (e.g. 6000 = 6 kA).', 'small')], { step: 3, gives: 'breaking capacity check', key: 'device' }));
    fill(work, r.ok ? [detailCard('fl-how', 'How it worked it out', h('ol', { class: 'steps' },
        h('li', {}, `Source impedance at the origin = 230 V ÷ ${Number(v.pfc)} kA = ${r.zsrc} Ω.`),
        h('li', {}, `Sub-main R1+Rn = ${r.r1rn} Ω${r.r1r2 != null ? `, R1+R2 = ${r.r1r2} Ω` : ''} (${v.length || 0} m of ${v.size} mm², cold).`),
        r.steps.slice(1).map((t) => h('li', {}, t)))),
      detailCard('fl-more', 'More info', [h('p', { class: 'note' }, 'PSCC is the current if line and neutral (or two lines) touch; PEFC is the current if line touches earth. The fault level is the larger of the two, and every device at the sub-board must be able to break it (its kA rating). Write it as Ipf for that board on the schedule of test results. The cable is taken cold (20 °C) because that gives the highest current; reactance is ignored, which is fine up to about 35 mm².'),
        r.big ? typical('Above 35 mm² cable reactance matters, so this estimate is on the high side.') : null,
        h('p', { class: 'note' }, 'An estimate: measure the PFC at the sub-board when you test.')])] : null);
  };
  draw();
  page('Fault level at a sub-board', [top, form, work], { back: board ? `#/cert/${cert.id}/b/${bi}` : '#/calc' });
});
