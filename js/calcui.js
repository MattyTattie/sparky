// calcui.js — one calculator for a circuit: pick the device, the circuit and
// the cable; it tells you straight away whether the cable carries the
// current, the volt drop is OK, and the Zs will be within the limit.
import { h, fill } from './ui.js';
import { route, page } from './app.js';
import { ccc, CALCS, setLastCalc, lastCalc, formKit, icard, more, answerCard, pchip, resline, detailCard, banner } from './calckit.js';
import { ringCheck } from './checks.js';
import { icon } from './icons.js';
import { SYMBOLS } from './symbols.js';
import { groupSel, groupWords, methodPick, longPick } from './calckit.js';
import { CABLES, CABLE_PICKS, AMBIENTS, CA_SOURCE, ARMOUR_MOHM_PER_M, TEMP_MULT, THREE_PHASE_CABLES, UL } from './cables.js';
import { voltDrop, sizeCable, designZs, r1r2At20, izLine } from './calc.js';
import { adiabatic, kFor, cpcAreaFor } from './design.js';
import { CHECK_NOTE, DEVICES, deviceById, ratingsFor, maxZs, maxZsSource, maxZsForTrip, devName } from './limits.js';

const CABLE_ORDER = ['te', 'te3', 'swa', 'swaX', 'swa3', 'swa3X', 'singles', 'tails', 'h07', 'flex', 'tri', 'sycy'];
const DEFAULTS = { phase: '1', device: 'rcbo', type: 'B', rating: '32', ib: '20', shape: 'radial', length: '25', lighting: false, ze: '0.35', cable: 'te', method: 'C', size: 'auto', cpcMode: 'core', ambient: '30', grouped: '1', grouping: 'bunched', ci: '1', time: 0.4 };
const SHAPES = [['radial', 'Radial'], ['ring-point', 'Ring: load at far point'], ['ring-spread', 'Ring: load spread']];

// CPC for a cable + size (T&E has a smaller CPC; SWA uses a core or the armour).
export function cpcFor(cable, size, cpcMode) {
  // v0.20: one rule for every cable (tri-rated and tails are 2-core but NOT armoured).
  const a = cpcAreaFor(cable, size, cpcMode); return a ? a.cpc : null;
}

// v0.7: Calculators home — big cards, one line each, last used at the top.
route(/^\/calc$/, async () => {
  const last = lastCalc(); const lc = CALCS.find((c) => c.key === last);
  const card = (c, isLast) => h('a', { class: 'calcpick' + (isLast ? ' last' : ''), href: c.href },
    h('span', { class: 'cpic' }, icon(c.ic, { size: 24 })),
    h('span', { class: 'cpt' }, h('span', { class: 'cpn' }, c.title, isLast ? h('span', { class: 'lastbadge' }, 'Last used') : null), h('span', { class: 'cps' }, c.sub)),
    icon('chevronRight', { size: 20, cls: 'cpgo' }));
  page('Calculators', [
    h('p', { class: 'note calcintro' }, 'Pick what you want to work out. Everything stays on this device.'),
    lc ? [h('h2', { class: 'sec' }, 'Carry on'), card(lc, true), h('h2', { class: 'sec' }, 'All calculators')] : null,
    h('div', { class: 'calcpicks' }, CALCS.filter((c) => c !== lc).map((c) => card(c, false))),
  ]);
});
// Kept so older links (#/calc/<tab>) still land somewhere sensible.
export const calcTabs = () => null;

route(/^\/calc\/check$/, async () => {
  setLastCalc('check');
  const v = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem('sparky.calc2') || 'null') || {}) };
  const top = h('div'); const form = h('div'); const work = h('div');
  const save = () => { localStorage.setItem('sparky.calc2', JSON.stringify(v)); drawForm(); draw(); };
  const set = (k, val) => { v[k] = val; save(); };
  const F = formKit(v, set);

  const drawForm = () => {
    // v0.9: 3-phase 400 V (balanced): three-phase cables only, radial only.
    const three = v.phase === '3';
    if (three && !THREE_PHASE_CABLES.includes(v.cable)) v.cable = 'swa4';
    if (!three && !CABLE_ORDER.includes(v.cable)) v.cable = 'te';
    if (three) v.shape = 'radial';
    const d = deviceById(v.device) || deviceById('rcbo');
    if (d.adj && !(Number(v.rating) > 0)) v.rating = '20';
    if (!d.types.includes(v.type)) v.type = d.types[0] || '';
    const ratings = ratingsFor(d.id, v.type); if (!d.adj && ratings.length && !ratings.map(String).includes(String(v.rating))) v.rating = String(ratings.find((r) => r >= 20) || ratings[0]);
    const cab = CABLES[v.cable] || CABLES.te; if (!cab.methods[v.method]) v.method = Object.keys(cab.methods)[0];
    if (v.size !== 'auto' && !cab.sizes.map(String).includes(String(v.size))) v.size = 'auto';
    const amb = AMBIENTS.includes(Number(v.ambient)) ? v.ambient : v.ambient;
    fill(form,
      icard('Supply and load', [
        F.seg('phase', 'Supply', [['1', 'Single-phase 230 V'], ['3', '3-phase 400 V']], three ? 'Balanced 3-phase load. Put in the current in each phase. ⚠ 3-phase cable figures are from memory of Appendix 4: check them.' : '', 'small'),
        three ? null : F.seg('shape', 'Shape', SHAPES, v.shape === 'radial' ? '' : 'Ring: put in the length all the way round the ring.', 'small'),
        F.num('ib', three ? 'Design current per phase (Ib)' : 'Load / design current (Ib)', { unit: 'A', hint: three ? 'kW × 1000 ÷ (1.732 × 400)' : 'Design current' }),
      ], { step: 1, gives: 'Ib', key: 'supply' }),
      icard('The breaker', [
        F.sel('device', 'Device', DEVICES.filter((x) => x.table || x.adj).map((x) => [x.id, x.label])),
        d.types.length > 1 ? F.seg('type', 'Type / curve', d.types.map((t) => [t, t]), 'B for most domestic circuits, C for motors and big inrush.') : null,
        d.adj ? h('div', { class: 'grid2' }, F.num('rating', d.adj === 'mpcb' ? 'Dial setting (In)' : 'Thermal setting Ir (In)', { unit: 'A' }), F.num('im', 'Magnetic trip (Im)', { unit: 'A', ph: d.adj === 'mpcb' ? '13 × dial top' : '10 × Ir', hint: 'Blank = ' + (d.adj === 'mpcb' ? '13' : '10') + ' × the setting.' }))
          : F.seg('rating', 'Rating (In)', ratings.map((r) => [r, r + ' A']), '', 'small'),
        more('chk-dev', [F.seg('time', 'Disconnection time', [[0.4, '0.4 s'], [5, '5 s']], '0.4 s for final circuits up to 63 A; 5 s for distribution circuits and over 63 A.', 'small')], `${v.time} s`)], { step: 2, gives: 'In', key: 'breaker' }),
      icard('The cable and how it\u2019s installed', [
        longPick(v, set, 'cable', 'Cable', (three ? THREE_PHASE_CABLES : CABLE_ORDER).map((k) => [k, CABLES[k].label])),
        more('chk-cable', [
          methodPick(v, set, cab),
          h('div', { class: 'grid2' }, F.sel('ambient', 'Hottest air round it', AMBIENTS.map((t) => [t, t + ' °C'])), F.num('grouped', 'Circuits grouped', { ph: '1', hint: 'Including this one. Blank = 1' })),
          groupSel(F, v, set),
          longPick(v, set, 'ci', 'Thermal insulation', [['1', 'None (Ci 1.0)'], ['0.5', 'Totally surrounded for 0.5 m or more (Ci 0.5)']]),
          cab.note ? h('p', { class: 'note warnnote' }, cab.note) : null],
          `method ${v.method}, ${amb} °C, ${groupWords(v)}, ${v.ci === '0.5' ? 'in insulation' : 'no insulation'}`)], { step: 3, gives: 'Iz', key: 'cable' }),
      icard('Length and earthing', [
        h('div', { class: 'grid2' }, F.num('length', v.shape === 'radial' ? 'Length' : 'Ring length', { unit: 'm', hint: v.shape === 'radial' ? 'Board to the far end' : 'All the way round' }), F.num('ze', 'Ze at the board', { unit: 'Ω', ph: '0.35', hint: '0.35 Ω PME (TN-C-S), 0.8 Ω TN-S. Measured is best.' })),
        CABLES[v.cable].cores === 3 && !CABLES[v.cable].cpcCore ? F.seg('cpcMode', 'Earth (CPC)', [['core', '3rd core'], ['armour', 'Armour']], '', 'small') : null,
        F.chk('lighting', 'Lighting circuit', 'Ticked = 3% volt drop limit instead of 5%.'),
      ], { step: 4, gives: 'VD, Zs, adiabatic', key: 'earth' }));
  };

  const draw = () => {
    const d = deviceById(v.device); const ring = v.shape === 'radial' ? false : v.shape.slice(5);
    const three = v.phase === '3' && CABLES[v.cable] && CABLES[v.cable].phase === 3;
    const s = sizeCable({ cable: v.cable, method: v.method, ib: +v.ib, inA: +v.rating, length: +v.length, ambient: +v.ambient, grouped: +v.grouped, grouping: v.grouping, insulationCi: +v.ci, bs3036: v.device === 'bs3036', lighting: v.lighting, ring, uo: three ? UL : undefined });
    const imag = d && d.adj ? (Number(v.im) > 0 ? Number(v.im) : Number(v.rating) * (d.adj === 'mpcb' ? 13 : 10)) : null;
    const max = imag ? maxZsForTrip(imag) : maxZs({ device: v.device, type: v.type, rating: v.rating, time: v.time });
    if (!s.ok) { fill(top, banner(s.error, 'Change the breaker rating or the load so the rating is at least the load.', 'red')); fill(work); return; }
    const size = v.size === 'auto' ? (s.pick ? s.pick.size : null) : Number(v.size);
    const row = s.rows.find((r) => r.size === size);
    const cpc = size != null ? cpcFor(v.cable, size, v.cpcMode) : null;
    const z = size != null ? designZs({ ze: v.ze, cable: v.cable, live: size, cpc, length: +v.length, ring, device: v.device, type: v.type, rating: v.rating, time: v.time }) : null;
    if (z && z.ok && imag) { z.max = max; z.pass = z.zs == null ? null : z.zs <= max; }
    const line = resline;
    const izInfo = (rw) => izLine({ size: rw.size, it: rw.it, iz: rw.iz, needIz: rw.needIz, f: s.factors, ring: !!ring && rw.needIz === 20, inA: +v.rating });
    const allOk = row && row.currentOk && (!row.vd || row.vd.pass) && (!z || z.pass !== false);
    let adi = null, adiCp = null, adiK = null, adiArea = null;
    if (z && z.ok && z.zs != null) { adiCp = cpcAreaFor(v.cable, size, v.cpcMode); adiArea = adiCp ? (adiCp.cpc === 'armour' ? adiCp.area : adiCp.cpc) : null; adiK = kFor({ cable: v.cable, cpcMode: v.cpcMode }); adi = adiabatic({ zs: z.zs, device: v.device, type: v.type, rating: v.rating, k: adiK.k, cpcCsa: adiArea, rcd: !!(d && d.rcd), time: v.time, imag }); }
    const cableName = size == null ? 'No size passes' : `${size} mm²${cpc === 'armour' ? ' + armour CPC' : cpc ? ` / ${cpc} CPC` : ''}`;
    const chips = [
      row ? pchip(row.currentOk, 'Current') : pchip(false, 'Current'),
      row && row.vd ? pchip(row.vd.pass, `Volt drop ${row.vd.pct}%`) : pchip(null, 'Volt drop'),
      z && z.ok && z.zs != null ? pchip(z.pass === false ? false : z.pass === true ? true : null, `Zs ${z.zs} / ${max ?? '?'} Ω`) : pchip(null, 'Zs'),
      adi ? (adi.ok ? pchip(adi.pass ? true : 'warn', 'Earth size (adiabatic)') : pchip(false, 'Earth size')) : pchip(null, 'Earth size'),
    ];
    fill(top, answerCard({ kicker: allOk ? 'This circuit passes' : 'This circuit needs a look', big: [size == null ? cableName : `${size} mm²${cpc === 'armour' ? ' + armour CPC' : cpc ? ` / ${cpc} mm² CPC` : ''}`, devName(d, v.type, v.rating, three, imag)], good: allOk ? (adi && adi.ok && !adi.pass ? 'warn' : true) : false,
      sub: `${three ? '3-phase 400 V · ' : ''}${CABLES[v.cable].label.split(',')[0]} · ${v.shape === 'radial' ? 'radial' : 'ring'} ${v.length} m · ${v.ib} A ${three ? 'per phase' : 'load'}${v.lighting ? ' · lighting' : ''}`, chips,
      extra: [row ? ccc(izInfo(row)) : null, size != null && Number(v.length) ? h('div', { class: 'ans-test' }, icon('clipboard', { size: 16 }), `When you test: expect R1+R2 about ${r1r2At20({ live: size, cpc, length: +v.length, cores: CABLES[v.cable].cores, ring, rTable: CABLES[v.cable].rTable || null })} Ω at 20 °C${ring ? ' (ring, end-to-end ÷ 4)' : ''}.`) : null] }),
      adi && adi.ok && !adi.pass ? banner(`The earth (CPC) may be too small for the fault: it needs ${adi.smin} mm², it\u2019s ${adiArea} mm².`, 'This assumes the worst-case 0.1 s let-through. Check the breaker maker\u2019s I²t figure, or go up a cable size.') : null);
    fill(work,
      detailCard('chk-how', 'How it worked it out', [
        row ? h('div', { class: 'resline ' + (row.currentOk ? 'ok' : 'bad') }, h('b', {}, row.currentOk ? '✓' : '✗'), h('div', {}, h('div', {}, izInfo(row).text), h('details', { class: 'izmore' }, h('summary', {}, 'More info'), h('div', { class: 'izdetail' }, izInfo(row).detail, ` Tabulated It needed: ${row.needIt} A.${s.caNote ? ' ' + s.caNote : ''}`))))) : line(false, 'Current: no size passes. Try a bigger cable or another method.'),
        row && row.vd ? line(row.vd.pass, `Volt drop: ${row.vd.volts} V (${row.vd.pct}%), limit ${row.vd.limitPct}%`, `${row.vd.mvam} mV/A/m × ${v.ib} A × ${v.length} m ÷ 1000${row.vd.divisor > 1 ? ' ÷ ' + row.vd.divisor + ' (ring)' : ''}`) : line(null, 'Volt drop: enter a length'),
        z && z.ok ? line(z.pass, z.zs != null ? `Zs: ${z.zs} Ω, max ${max ?? '?'} Ω` : `Zs: enter Ze. Max ${max ?? '?'} Ω`, `Ze ${v.ze || '?'} + (R1+R2) ${z.r20} Ω × ${z.mult} hot = ${z.rHot} Ω. ${max != null ? (imag ? `Max Zs = Uo × 0.95 ÷ ${Math.round(imag)} A magnetic trip.` : maxZsSource(v.device)) : 'No table figure for this device.'}${z.note ? ' ' + z.note : ''}`) : line(null, `Zs: max ${max ?? '?'} Ω (need a size and length)`),
        (() => { if (!adi) return line(null, 'Adiabatic: enter Ze, a size and a length'); const a = adi; const cp = adiCp; const area = adiArea; const k = adiK;
          return a.ok ? line(a.pass, `Adiabatic: CPC needs ${a.smin} mm², ${cp.cpc === 'armour' ? 'armour is' : 'it\u2019s'} ${area} mm²`, `Fault ${Math.round(a.ifault)} A at Zs ${z.zs} Ω. ${a.how} S = √(${a.i2t}) ÷ k ${a.k} (${k.label}).${cp.cpc === 'armour' ? ' ⚠ Armour area is maker\u2019s data.' : ''}`) : line(false, 'Adiabatic: ' + a.error); })()]),
      detailCard('chk-sizes', 'Every size', [
        h('table', { class: 'calctab' }, h('tr', {}, ['mm²', 'It A', 'Iz A', 'Current', 'Volt drop'].map((t) => h('th', {}, t))),
          s.rows.map((r) => h('tr', { class: r.size === size ? 'on' : '' }, h('td', {}, r.size), h('td', {}, r.it ?? '–'), h('td', {}, r.iz ?? '–'), h('td', {}, r.currentOk ? '✓' : '✗'), h('td', {}, r.vd ? `${r.vd.pct}% ${r.vd.pass ? '✓' : '✗'}` : '–'))))]),
      detailCard('chk-src', 'Where the numbers come from', [
        h('ul', { class: 'note' }, s.assumptions.map((a) => h('li', {}, a)),
          h('li', {}, `Current ratings and volt drop: BS 7671 ${CABLES[v.cable].source}.`),
          h('li', {}, `Ambient factor: ${CA_SOURCE}. ⚠ The table starts at 25 °C; 20 °C uses the 25 °C factor.`),
          h('li', {}, `R1+R2: copper at 20 °C (BS EN 60228 maxima), × ${TEMP_MULT[70]} (70 °C) or ${TEMP_MULT[90]} (90 °C) for the design Zs (${TEMP_MULT.source}).`),
          cpc === 'armour' ? h('li', {}, `⚠ Armour resistance: ${ARMOUR_MOHM_PER_M.source}`) : null,
          v.cable === 'te' ? h('li', {}, 'T&E CPC sizes (6242Y): 1.0/1.0, 1.5/1.0, 2.5/1.5, 4/1.5, 6/2.5, 10/4, 16/6 mm² (BS 6004, maker data).') : null)]),
      h('div', { class: 'notice amber' }, CHECK_NOTE));
  };
  drawForm(); draw();
  page('Check a circuit', [top, form, work], { back: '#/calc' });
});

// v0.7: Ring final check on its own (the same ringCheck as the circuit page).
const RING_DEFAULTS = { csa: '2.5', r1: '', rn: '', r2: '', r1r2: '', zdb: '', zs: '', device: 'rcbo', type: 'B', rating: '32' };
const RING_CSA = { '2.5': [2.5, 1.5], '4': [4, 1.5] };
route(/^\/calc\/ring$/, async () => {
  setLastCalc('ring');
  const v = { ...RING_DEFAULTS, ...(JSON.parse(localStorage.getItem('sparky.ring1') || 'null') || {}) };
  const top = h('div'); const form = h('div'); const work = h('div');
  const save = () => { localStorage.setItem('sparky.ring1', JSON.stringify(v)); drawForm(); draw(); };
  const set = (k, val) => { v[k] = val; save(); };
  const F = formKit(v, set);
  const drawForm = () => fill(form,
    icard('The cable', [F.seg('csa', 'Twin & earth', [['2.5', '2.5 / 1.5 mm²'], ['4', '4 / 1.5 mm²']], 'Sets what r2 should be compared with (CPC smaller than the live).')], { step: 1, key: 'cable' }),
    icard('End-to-end readings', [
      h('div', { class: 'grid3' }, F.num('r1', 'r1 (line)', { unit: 'Ω' }), F.num('rn', 'rn (neutral)', { unit: 'Ω' }), F.num('r2', 'r2 (CPC)', { unit: 'Ω' })),
      h('p', { class: 'help' }, 'Measure each leg end to end at the board, ring split.')], { step: 2, gives: 'r1 = rn, r2 ratio', key: 'ends' }),
    icard('Cross-connected', [
      F.num('r1r2', 'Highest R1+R2 at a socket', { unit: 'Ω', hint: 'Line and CPC crossed over at the board; the highest reading round the ring.' }),
      more('ring-more', [
        h('div', { class: 'grid2' }, F.num('zdb', 'Zdb at the board', { unit: 'Ω', hint: 'For the expected Zs' }), F.num('zs', 'Measured Zs', { unit: 'Ω', hint: 'At the furthest socket' })),
        F.seg('rating', 'Breaker', [['30', '30 A'], ['32', 'B32 / 32 A']], '', 'small')], v.zdb ? `Zdb ${v.zdb} Ω` : 'no Zs check')], { step: 3, gives: 'R1+R2, Zs', key: 'cross' }));
  const draw = () => {
    const [live, cpc] = RING_CSA[v.csa] || RING_CSA['2.5'];
    const r = ringCheck({ r1: v.r1, rn: v.rn, r2: v.r2, r1r2: v.r1r2, zs: v.zs, live, cpc, device: v.device, type: v.type, rating: v.rating }, { zdb: v.zdb });
    if (r.empty) { fill(top, answerCard({ kicker: 'Ring final check', big: 'Put your readings in', sub: 'Start with r1, rn and r2 below.', good: 'warn' })); fill(work); return; }
    const judged = r.items.filter((i) => i.pass != null); const bad = judged.filter((i) => i.pass === false);
    const name = (t) => /^r1 .* rn/.test(t) ? 'Line & neutral match' : /^r2/.test(t) ? 'CPC (r2) right' : /^R1\+R2/.test(t) ? 'R1+R2 as expected' : /^Ring about/.test(t) ? 'Volt drop' : /^Expected Zs/.test(t) ? 'Zs' : null;
    const chips = r.items.map((i) => name(i.text) && (i.pass != null || /^Expected Zs/.test(i.text)) ? pchip(i.pass, name(i.text)) : null).filter(Boolean);
    const exp = r.items.find((i) => /^Expected R1\+R2|^R1\+R2/.test(i.text));
    fill(top, answerCard({ kicker: 'Ring final check', big: bad.length ? 'Check the ring' : judged.length ? 'Ring looks sound' : 'Add more readings', good: bad.length ? false : judged.length ? true : 'warn',
      sub: exp ? exp.text.replace(/ \(\(r1 \+ r2\) ÷ 4\)/, '') : null, chips }),
      bad.length ? banner(bad.map((i) => i.text).join('. ') + '.', 'Look for a loose or swapped conductor, a spur on the ring, or a break. Re-make the connections and test again.') : null);
    fill(work, detailCard('ring-how', 'How it worked it out', r.items.map((i) => resline(i.pass, i.text, i.sub))), h('div', { class: 'notice amber' }, CHECK_NOTE));
  };
  drawForm(); draw();
  page('Ring final check', [top, form, work], { back: '#/calc' });
});

// v0.20: Symbols sheet (same definitions as the tap pop-ups).
route(/^\/calc\/symbols$/, async () => {
  setLastCalc('symbols');
  const groups = [...new Set(SYMBOLS.map((x) => x[3]))];
  page('Symbols', [h('p', { class: 'note calcintro' }, 'Tap any symbol in the app (like Ib or Zs) to see this in a pop-up.'),
    groups.map((g) => [h('h2', { class: 'sec' }, g), h('div', { class: 'card symlist nosym' }, SYMBOLS.filter((x) => x[3] === g).map(([s, n, d]) => h('div', { class: 'symrow' }, h('b', { class: 'symk' }, s), h('div', {}, h('div', { class: 'symn' }, n), h('div', { class: 'note' }, d)))))])], { back: '#/calc' });
});
