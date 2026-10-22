// calcsize.js — "Size a circuit": put in the load and the length of run, and
// it suggests the breaker and the smallest cable that passes everything,
// saying in plain words why it went up a size.
import { h, fill } from './ui.js';
import { route, page } from './app.js';
import { groupSel, groupWords, methodPick, longPick } from './calckit.js';
import { CABLES, CABLE_PICKS, AMBIENTS, CI_OPTIONS, SINGLES_CPC, THREE_PHASE_CABLES, UL, CUTOUT_FUSES, TYPICAL_NOTE } from './cables.js';
import { sizeCircuit, LOAD_TYPES, START_METHODS, convertLine } from './design.js';
import { useOnCircuit } from './usecircuit.js';
import { DEVICES, deviceById, CHECK_NOTE, devName } from './limits.js';
import { ccc, setLastCalc, formKit, icard, more, answerCard, pchip, resline, detailCard, banner } from './calckit.js';
import { icon } from './icons.js';

const CABLE_ORDER = ['te', 'te3', 'singles', 'swa', 'swaX', 'swa3', 'swa3X', 'h07', 'tails', 'flex', 'tri', 'sycy'];
// v0.21: the cards in the order an engineer works a design (tests/v21.test.js checks this).
export const SIZE_CARDS = ['supply', 'breaker', 'cable', 'earth'];
const DEFAULTS = { phase: '1', loadType: 'general', load: '20', unit: 'A', pf: '1', ringLoad: 'spread', length: '32', ze: '0.35', vd: 'auto', cable: 'te', cpcMode: 'core', method: 'C', ambient: '30', grouped: '1', grouping: 'bunched', ci: '1', separateCpc: false, device: 'rcbo', type: 'auto', time: 0.4, start: 'dol', eff: '0.85', cutout: '100', mpcbMax: '', mpcbSet: '', magMult: '13', ir: '', im: '' };

route(/^\/calc\/size$/, async () => {
  setLastCalc('size');
  const v = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem('sparky.size1') || 'null') || {}) };
  const top = h('div'); const form = h('div'); const work = h('div');
  const save = () => { localStorage.setItem('sparky.size1', JSON.stringify(v)); drawForm(); draw(); };
  // v0.18.5: a curve picked for one kind of load shouldn't carry over to another (a remembered B on a motor).
  const set = (k, val) => { if ((k === 'loadType' && val !== v.loadType) || (k === 'start' && val !== v.start)) v.type = 'auto'; v[k] = val; save(); }; // v0.19: a new start method re-picks the curve too
  const F = formKit(v, set);

  const drawForm = () => {
    const three = v.phase === '3';
    const order = three ? THREE_PHASE_CABLES : CABLE_ORDER;
    if (!order.includes(v.cable)) v.cable = order[0];
    if (three && v.loadType === 'ring') v.loadType = 'general';
    const cab = CABLES[v.cable] || CABLES.te; if (!cab.methods[v.method]) v.method = Object.keys(cab.methods)[0];
    const d = deviceById(v.device) || deviceById('rcbo');
    if (v.type !== 'auto' && !d.types.includes(v.type)) v.type = 'auto';
    const ring = v.loadType === 'ring';
    const ciLabel = (CI_OPTIONS.find(([k]) => String(k) === String(v.ci)) || [, 'none'])[1];
    fill(form,
      icard('What it supplies', [
        F.seg('phase', '', [['1', 'Single-phase 230 V'], ['3', 'Three-phase 400 V']], three ? 'Balanced 3-phase load (motor, 3-phase EV charger, heater bank).' : '', 'seg2'),
        F.seg('loadType', 'Type of load', three ? LOAD_TYPES.filter(([k]) => k !== 'ring') : LOAD_TYPES, '', 'small'),
        v.loadType === 'motor' ? F.seg('start', 'How it starts', START_METHODS.map(([k, l, m]) => [k, `${l} (~${m}×)`]), 'Typical starting current as a multiple of running current. The motor maker\u2019s figure is better if you have it.', 'small') : null,
        h('div', { class: 'grid2' }, F.num('load', v.unit === 'kW' ? (three ? 'Total load (P)' : 'Load (P)') : (three ? 'Design current per phase (Ib)' : 'Load / design current (Ib)'), { unit: v.unit === 'kW' ? 'kW' : 'A', hint: v.unit === 'kW' ? (three ? 'All 3 phases together' : 'e.g. 9.5 for a shower') : 'What it draws' }),
          F.seg('unit', 'Load in', [['kW', 'kW'], ['A', 'Amps']], '', 'small')),
        ring ? F.seg('ringLoad', 'How the load sits on the ring', [['spread', 'Spread round'], ['point', 'All at the far point']], '', 'small') : null,
        // v0.19: kW ↔ amps, using pf (and efficiency for motors).
        h('p', { class: 'note convline', 'data-conv': '1' }, convertLine({ load: v.load, unit: v.unit, pf: v.pf, phase: v.phase, eff: v.eff, motor: v.loadType === 'motor' })),
        more('size-load', [F.num('pf', 'Power factor', { hint: '1 for heaters and showers, about 0.8 for motors.' }),
          v.loadType === 'motor' ? F.num('eff', 'Motor efficiency', { hint: 'Motors are rated on shaft output. About 0.85 for small motors, 0.9+ for big ones; the nameplate may say.' }) : null],
          `pf ${v.pf}${v.loadType === 'motor' ? ', efficiency ' + v.eff : ''}`)], { step: 1, gives: 'Ib', key: 'supply' }),
      icard('The breaker', [
        F.sel('device', 'Device', DEVICES.filter((x) => (x.table && x.id !== 'bs1362') || x.adj).map((x) => [x.id, x.label])),
        d.adj === 'mpcb' ? [h('div', { class: 'grid2' }, F.num('mpcbSet', 'Thermal dial setting', { unit: 'A', ph: 'FLC', hint: 'Set to the motor FLC. Blank = the load current.' }), F.num('mpcbMax', 'Top of dial range', { unit: 'A', ph: 'auto', hint: 'Blank = a typical range for the FLC.' })),
          F.num('magMult', 'Magnetic trip × range top', { hint: 'About 13 × is typical, check the maker.' })] : null,
        d.adj === 'mccb' ? h('div', { class: 'grid2' }, F.num('ir', 'Thermal setting Ir', { unit: 'A', ph: 'auto', hint: 'What the dial is set to.' }), F.num('im', 'Magnetic setting Im / Ii', { unit: 'A', ph: '10 × Ir', hint: 'In amps (e.g. 10 × Ir = 1000 A on 100 A).' })) : null,
        d.types.length > 1 ? F.seg('type', 'Type / curve', [['auto', 'Auto'], ...d.types.map((t) => [t, t])], 'Auto = B, or C for motors. Pick D for a heavy motor start.', 'small') : null,
        more('size-dev', [F.seg('time', 'Disconnection time', [[0.4, '0.4 s'], [5, '5 s']], '0.4 s for final circuits up to 63 A; 5 s for distribution circuits and over 63 A.', 'small')], `${v.time} s`)], { step: 2, gives: 'In', key: 'breaker' }),
      icard('The cable and where it runs', [
        longPick(v, set, 'cable', 'Cable', order.map((k) => [k, CABLES[k].label])),
        cab.tails ? F.seg('cutout', 'Cutout (supplier’s) fuse', CUTOUT_FUSES.map((a) => [String(a), a + ' A']), 'The tails must carry at least this, as installed.', 'small') : null,
        cab.typical ? h('p', { class: 'note warnnote' }, 'Typical, check your books. ' + TYPICAL_NOTE) : null,
        more('size-run', [
          methodPick(v, set, cab),
          h('div', { class: 'grid2' }, F.sel('ambient', 'Hottest air round it', AMBIENTS.map((t) => [t, t + ' °C'])), F.num('grouped', 'Circuits grouped', { ph: '1', hint: 'Including this one. Blank = 1' })),
          groupSel(F, v, set),
          longPick(v, set, 'ci', 'Thermal insulation', CI_OPTIONS),
          /^10[0-3]$/.test(String(v.method)) && v.ci !== '1' ? h('p', { class: 'note warnnote' }, 'Methods 100–103 already allow for the insulation. Leave this at “None” unless the cable is also buried in it elsewhere.') : null,
          cab.methods[v.method] && cab.methods[v.method].bunched ? h('p', { class: 'note' }, 'Bunched in a panel: the bunched grouping factor (Table 4C1) is used with the number of circuits above.') : null,
          cab.note ? h('p', { class: 'note warnnote' }, cab.note) : null],
          `method ${v.method}, ${v.ambient} °C, ${groupWords(v)}, ${String(ciLabel).split(' (')[0].toLowerCase()}`)], { step: 3, gives: 'Iz', key: 'cable' }),
      icard('Length and earthing', [
        h('div', { class: 'grid2' }, F.num('length', ring ? 'Ring length' : 'Length of run', { unit: 'm', hint: ring ? 'All the way round' : 'Board to the far end' }), F.num('ze', 'Ze at the board', { unit: 'Ω', ph: '0.35', hint: '0.35 PME, 0.8 TN-S' })),
        !three && CABLES[v.cable].cores === 3 && !CABLES[v.cable].cpcCore ? F.seg('cpcMode', 'Earth (CPC)', [['core', '3rd core'], ['armour', 'Armour']], '', 'small') : null,
        v.cable === 'singles' ? F.chk('separateCpc', 'CPC run separately, not bunched with the circuit', 'k 143 instead of 115 for the adiabatic check.') : null,
        more('size-vd', [F.seg('vd', 'Volt drop limit', [['auto', v.loadType === 'lighting' ? 'Auto (3% lighting)' : 'Auto (5% other)'], ['3', '3%'], ['5', '5%']], 'From the origin. If this is fed from a sub-board, leave room for its drop.', 'small')], `VD ${v.vd === 'auto' ? 'auto' : v.vd + '%'}`)], { step: 4, gives: 'VD, Zs, adiabatic', key: 'earth' }));
  };

  const draw = () => {
    const r = sizeCircuit({ eff: v.eff, cutout: v.cutout, mpcbSet: v.mpcbSet, mpcbMax: v.mpcbMax, magMult: v.magMult, ir: v.ir, im: v.im, load: v.load, unit: v.unit, pf: v.pf, loadType: v.loadType, length: v.length, cable: v.cable, cpcMode: v.cpcMode, method: v.method, ambient: +v.ambient, grouped: +v.grouped, grouping: v.grouping, ci: +v.ci, ze: Number(v.ze) || 0, device: v.device, type: v.type, time: Number(v.time), vdPct: v.vd === 'auto' ? null : v.vd, ringLoad: v.ringLoad, start: v.start, separateCpc: v.separateCpc, phase: Number(v.phase) || 1 });
    if (!r.ok) { fill(top, banner(r.error, 'Check the load and length above.', 'red')); fill(work); return; }
    const d = deviceById(r.device); const p = r.pick;
    const cpcText = (row) => row.cpc === 'armour' ? ' + armour as CPC' : row.cpc != null ? ` / ${row.cpc} mm² CPC` : '';
    const line = resline;
    const chips = p ? [pchip(p.cur.pass, 'Current'), pchip(p.vd.pass, `Volt drop ${p.vd.pct}%`), pchip(p.z.pass, `Zs ${p.z.zs} / ${p.z.max ?? '?'} Ω`), p.adi.ok ? pchip(p.adi.pass ? true : 'warn', 'Earth size (adiabatic)') : pchip(null, 'Earth size')] : [];
    const lastR = r.reasons && r.reasons.length ? r.reasons[r.reasons.length - 1] : null;
    const why = lastR && lastR.why.length ? lastR.why.join('. ') + '.' : '';
    const brkName = p ? (r.adjLabel ? r.adjLabel : devName(d, r.curve, r.inA)) + (r.phase === 3 ? ' (TP)' : '') : '';
    fill(top, answerCard({ kicker: p ? 'Use' : 'No cable passes', good: p ? (p.adi.ok && !p.adi.pass ? 'warn' : true) : false,
      big: p ? [r.adjLabel ? `${r.adjLabel}${r.phase === 3 ? ' (TP)' : ''}` : `${devName(d, r.curve, r.inA)}${r.phase === 3 ? ' (TP)' : ''}`, `${p.size} mm²${cpcText(p)}`] : 'Try another cable or method',
      sub: p ? `${CABLES[v.cable].label.split(',')[0]} · Ib ${r.ib} A · ${v.length} m` : 'Nothing in this table passes current, volt drop and Zs.', chips,
      extra: p ? [ccc(r.izInfo, 'Recommended breaker: ' + brkName), why ? h('div', { class: 'ans-why bad' }, why) : null, h('div', { class: 'ans-test' }, icon('clipboard', { size: 16 }), `When you test: expect R1+R2 about ${p.z.r20} Ω at 20 °C${r.ring ? ' (ring, (r1 + r2) ÷ 4)' : ''}.`),
        h('button', { class: 'btn primary', style: 'margin-top:10px;width:100%', 'data-use': '1', onclick: () => useOnCircuit({ cable: v.cable, size: p.size, cpc: p.cpc, device: r.device, curve: r.curve, rating: r.inA, three: r.phase === 3, cpcMode: v.cpcMode, im: r.imag }) }, icon('clipboard', { size: 16 }), 'Use on a circuit')] : null }),
      (r.advice || []).map((a) => banner(a.text, '', a.level === 'warn' ? 'amber' : 'info')),
      p && p.adi.ok && !p.adi.pass ? banner(`The earth (CPC) may be too small: it needs ${p.adi.smin} mm², it has ${p.adi.area} mm².`, 'This assumes the worst-case 0.1 s let-through. Check the breaker maker\u2019s I²t figure, or go up a cable size.') : null);
    fill(work,
      detailCard('size-how', 'How it worked it out', [
        h('ol', { class: 'steps' }, r.steps.map((t) => h('li', {}, t, r.izInfo && t === r.izInfo.text && r.izInfo.detail ? h('details', { class: 'izmore' }, h('summary', {}, 'More info'), h('div', { class: 'izdetail' }, r.izInfo.detail)) : null))),
        p ? [
          line(p.cur.pass, 'Current: ' + (r.izInfo ? r.izInfo.text : `${p.size} mm² CCC after factors: ${p.cur.iz} A`), `Tabulated ${p.cur.it} A × factors ${r.factors.total}.`),
          line(p.vd.pass, `Volt drop: ${p.vd.volts} V (${p.vd.pct}% of ${r.vref} V), limit ${p.vd.limit}%`, `${p.vd.mvam} mV/A/m × ${r.ib} A × ${v.length} m ÷ 1000${p.vd.div > 1 ? ' ÷ ' + p.vd.div + ' (ring)' : ''}.`),
          line(p.z.pass, `Zs${r.phase === 3 ? ' (phase–earth)' : ''}: ${p.z.zs} Ω, max ${p.z.max ?? '?'} Ω`, `Ze ${v.ze} + (R1+R2) ${p.z.r20} Ω × hot = ${p.z.rHot} Ω.`),
          p.adi.ok ? line(p.adi.pass, `Adiabatic: CPC needs ${p.adi.smin} mm², ${p.adi.armour ? 'armour is' : 'has'} ${p.adi.area} mm²`, `Fault ${Math.round(p.adi.ifault)} A. ${p.adi.how} k ${r.k.k}.`) : line(null, 'Adiabatic: ' + (p.adi.error || 'not worked out')),
        ] : null]),
      detailCard('size-sizes', 'Every size', [
        h('table', { class: 'calctab' }, h('tr', {}, ['mm²', 'Iz A', 'V drop', 'Zs Ω', 'CPC needs', ''].map((t) => h('th', {}, t))),
          r.rows.map((row) => h('tr', { class: row === p ? 'on' : '' }, h('td', {}, row.size), h('td', { class: row.cur.pass ? '' : 'bad' }, row.cur.iz ?? '–'), h('td', { class: row.vd.pass ? '' : 'bad' }, row.vd.pct + '%'), h('td', { class: row.z.pass === false ? 'bad' : '' }, row.z.zs ?? '–'), h('td', { class: row.adi.pass === false ? 'bad' : '' }, row.adi.ok ? row.adi.smin + ' mm²' : '–'), h('td', {}, row.ok ? '✓' : '✗')))),
        h('p', { class: 'note' }, `Needed: Iz ≥ ${r.ring ? '20 A (ring, 2.5 mm²+)' : r.inA + ' A'}; volt drop ≤ ${r.limit}%; Zs ≤ ${r.max ?? '?'} Ω; CPC at least the adiabatic size.`)]),
      detailCard('size-src', 'Where the numbers come from', [
        h('ul', { class: 'note' }, r.notes.map((t) => h('li', {}, t)), v.cable === 'singles' ? h('li', {}, `Singles CPC (Table 54.7): ${Object.entries(SINGLES_CPC).map(([a, b]) => a + '→' + b).join(', ')} mm².`) : null, h('li', {}, `Current ratings and volt drop: BS 7671 ${CABLES[v.cable].source}.`))]),
      h('div', { class: 'notice amber' }, 'A design aid, not a design: check diversity, the cable\u2019s route, and the maker\u2019s data. ', CHECK_NOTE));
  };
  drawForm(); draw();
  page('Size a cable & breaker', [top, form, work], { back: '#/calc' });
});
