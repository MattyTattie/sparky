// calcdc.js — DC calculator: solar PV strings (cold-morning voltage, cable,
// string fuses) and battery ↔ inverter leads (volt drop, cable, fuse).
import { h, fill } from './ui.js';
import { route, page, render } from './app.js';
import { setLastCalc, formKit, icard, more, answerCard, pchip, resline, detailCard, banner } from './calckit.js';
import { pvString, batteryLeads, DC_AMPS, RHO20, ALPHA, rhoAt } from './dc.js';

const DEFAULTS = { mode: 'pv', n: '10', voc: '49.5', vmp: '41.6', isc: '13.9', imp: '13.2', coef: '-0.27', tmin: '-10', invMax: '600', mpptMax: '', pvLen: '25', strings: '1', maxFuse: '25', pvPct: '1',
  bV: '51.2', bI: '', bKw: '5', bEff: '0.95', bLen: '2', bPct: '1', temp: '70', cable: 'xlpe90' };

// v0.6: the DC tab has two parts; #/calc/dc opens the last one used.
route(/^\/calc\/dc$/, async () => { const t = localStorage.getItem('sparky.dcsub'); history.replaceState(null, '', '#/calc/dc/' + (t === 'plan' ? 'plan' : 'pv')); return render(); });
route(/^\/calc\/dc\/pv$/, async () => {
  setLastCalc('pv'); localStorage.setItem('sparky.dcsub', 'pv');
  const v = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem('sparky.dc1') || 'null') || {}) };
  const top = h('div'); const form = h('div'); const work = h('div'); const modeEl = h('div');
  const save = () => { localStorage.setItem('sparky.dc1', JSON.stringify(v)); drawForm(); draw(); };
  const set = (k, val) => { v[k] = val; save(); };
  const F = formKit(v, set);
  const line = resline;
  const cableMore = (pctKey, id) => more(id, [
    F.sel('cable', 'Cable type (for its current rating)', Object.entries(DC_AMPS).map(([k, t]) => [k, t.label])),
    F.seg(pctKey, 'Volt drop target', [['1', '1%'], ['1.5', '1.5%'], ['2', '2%'], ['3', '3%']], 'How much of the voltage you\u2019re happy to lose in the cable.', 'small'),
    F.seg('temp', 'Cable temperature for the resistance', [['20', '20 °C'], ['50', '50 °C'], ['70', '70 °C'], ['90', '90 °C']], '70 °C is a safe working figure.', 'small')],
    `${(DC_AMPS[v.cable] || DC_AMPS.xlpe90).label.split(',')[0]}, ${v[pctKey]}% drop, ${v.temp} °C`);

  const drawForm = () => fill(form,
    fill(modeEl, h('div', { class: 'seg' }, F.chips('mode', [['pv', 'Solar PV string'], ['battery', 'Battery leads']], 'seg2'))) && null,
    v.mode === 'pv' ? [
      icard('The panels', [
        h('div', { class: 'grid2' }, F.num('n', 'Panels in the string', { hint: 'In series' }), F.num('voc', 'Panel Voc', { unit: 'V', hint: 'Open-circuit volts, data sheet' })),
        h('div', { class: 'grid2' }, F.num('isc', 'Panel Isc', { unit: 'A', hint: 'Short-circuit amps' }), F.num('strings', 'Strings in parallel', { hint: '3+ need string fuses' })),
        more('pv-panel', [
          h('div', { class: 'grid2' }, F.num('vmp', 'Vmp', { unit: 'V', hint: 'Max-power volts' }), F.num('imp', 'Imp', { unit: 'A', hint: 'Max-power amps' })),
          h('div', { class: 'grid2' }, F.num('coef', 'Voc temperature coefficient', { unit: '%/°C', ph: '-0.27', hint: 'How much Voc rises per °C colder' }), F.num('maxFuse', 'Max series fuse', { unit: 'A', ph: '25', hint: 'From the panel label' })),
          F.num('tmin', 'Coldest morning', { unit: '°C', hint: '−10 °C is the usual UK design figure; colder for exposed or high sites.' })],
          `Vmp ${v.vmp} V, coeff ${v.coef} %/°C, coldest ${v.tmin} °C, max fuse ${v.maxFuse || '–'} A`)], { step: 1 }),
      icard('Inverter and cable run', [
        h('div', { class: 'grid2' }, F.num('invMax', 'Inverter max DC input', { unit: 'V', hint: 'Must never be exceeded' }), F.num('pvLen', 'Cable run, one way', { unit: 'm', hint: 'Panels to inverter' })),
        more('pv-inv', [F.num('mpptMax', 'MPPT range top', { unit: 'V', hint: 'Optional: where the inverter stops tracking' }), cableMore('pvPct', 'pv-cable')], `MPPT top ${v.mpptMax || '–'} V`)], { step: 2 })] : [
      icard('Battery and inverter', [
        h('div', { class: 'grid2' }, F.num('bV', 'Battery voltage', { unit: 'V', hint: 'Nominal, e.g. 51.2' }), F.num('bKw', 'Inverter power', { unit: 'kW', hint: 'Or the current below' })),
        F.num('bLen', 'Cable run, one way', { unit: 'm', hint: 'Battery to inverter' }),
        more('bat-more', [
          h('div', { class: 'grid2' }, F.num('bI', 'Max continuous current', { unit: 'A', ph: 'data sheet', hint: 'If filled in, it\u2019s used instead of kW' }), F.num('bEff', 'Inverter efficiency', { ph: '0.95', hint: '0.95 = 95%' })),
          cableMore('bPct', 'bat-cable')], `${v.bI ? v.bI + ' A' : 'from kW'}, efficiency ${v.bEff}`)], { step: 1 })]);

  const draw = () => {
    const tbl = DC_AMPS[v.cable] || DC_AMPS.xlpe90;
    const sizeRows = (sz, amps) => sz ? detailCard('dc-sizes', 'Every size', [
      h('table', { class: 'calctab' }, h('tr', {}, ['mm²', 'Rated A', 'Drop V', 'Drop %', ''].map((t) => h('th', {}, t))),
        sz.rows.slice(0, 9).map((r) => h('tr', { class: r === sz.pick ? 'on' : '' }, h('td', {}, r.size), h('td', { class: r.curOk ? '' : 'bad' }, r.amps ?? '–'), h('td', {}, r.vd ? r.vd.volts : '–'), h('td', { class: r.vdOk ? '' : 'bad' }, r.vd ? r.vd.pct + '%' : '–'), h('td', {}, r.curOk && r.vdOk ? '✓' : '✗')))),
      h('p', { class: 'note' }, `Needs ≥ ${amps} A. Volt drop = 2 × length × I × ρ ÷ csa (out and back), ρ = ${RHO20} Ω·mm²/m at 20 °C × (1 + ${ALPHA} × (T − 20)) = ${rhoAt(v.temp).toFixed(5)} at ${v.temp} °C.`)]) : null;
    if (v.mode === 'pv') {
      const r = pvString({ n: v.n, voc: v.voc, vmp: v.vmp, isc: v.isc, imp: v.imp, coefPct: v.coef, tmin: v.tmin, invMax: v.invMax, mpptMax: v.mpptMax, length: v.pvLen, targetPct: v.pvPct, temp: v.temp, strings: v.strings, maxSeriesFuse: v.maxFuse, cable: v.cable });
      const p = r.size && r.size.pick;
      const good = r.vocOk !== false && p ? (r.near || r.mpptOk === false ? 'warn' : true) : false;
      const chips = [r.cold != null ? pchip(r.vocOk === false ? false : r.near ? 'warn' : r.vocOk, `Cold Voc ${r.cold} V`) : pchip(null, 'Cold Voc'), r.mpptOk != null ? pchip(r.mpptOk ? true : 'warn', 'MPPT range') : null, p ? pchip(true, `Drop ${p.vd.pct}%`) : pchip(false, 'Cable'),
        r.fuse ? pchip(r.fuse.needed ? (r.fuse.fuse ? true : false) : true, r.fuse.needed ? (r.fuse.fuse ? `${r.fuse.fuse} A string fuses` : 'String fuses') : 'No string fuses needed') : null].filter(Boolean);
      fill(top, answerCard({ kicker: `String of ${v.n} × ${v.voc} V`, good,
        big: [r.cold != null ? `${r.cold} V on a cold morning` : 'Enter the panels', p ? `${p.size} mm² PV cable` : 'No cable size fits'],
        sub: r.invMax ? `Inverter max ${r.invMax} V${r.fuse && r.fuse.needed && r.fuse.fuse ? ` · ${r.fuse.fuse} A gPV fuse in each string (+ and −)` : ''}` : null, chips }),
        r.vocOk === false ? banner(`Cold-morning Voc ${r.cold} V is over the inverter\u2019s ${r.invMax} V.`, 'Take a panel out of the string.', 'red') : r.near ? banner(`Cold-morning Voc is within 5% of the inverter\u2019s ${r.invMax} V.`, 'Leave more margin: one panel fewer, or check the coldest temperature for the site.') : null,
        r.mpptOk === false ? banner('Cold Voc is above the MPPT range.', 'The inverter will clip until the panels warm up. Check the data sheet.') : null);
      fill(work, detailCard('pv-how', 'How it worked it out', [
        r.cold != null ? line(r.vocOk, `Cold-morning Voc ${r.cold} V at ${v.tmin} °C${r.invMax ? `, inverter max ${r.invMax} V` : ''}`, `${v.n} × ${v.voc} V × (1 + ${v.coef}% × (${v.tmin} − 25)) = ${r.cold} V. At STC it\u2019s ${r.stc} V.${r.near ? ' ⚠ Within 5% of the inverter limit: leave more margin.' : ''}${r.vocOk === false ? ' Over the limit: take a panel out of the string.' : ''}`) : line(null, 'Enter panels, Voc and the coefficient'),
        r.mpptOk != null ? line(r.mpptOk, `Cold Voc vs MPPT range top ${r.mpptMax} V`, r.mpptOk ? 'Inside the MPPT range.' : 'Above the MPPT range: the inverter will clip until the panels warm up (check the data sheet).') : null,
        r.vstring ? line(null, `String working voltage about ${r.vstring} V (${v.n} × Vmp)`, 'Used as the base for the volt drop %.') : null,
        p ? line(true, `Cable: ${p.size} mm² — drop ${p.vd.volts} V (${p.vd.pct}%), target ${v.pvPct}%`, `${r.size.why.length ? r.size.why[r.size.why.length - 1] + ', so ' + p.size + ' mm². ' : ''}Cable must carry ${r.needAmps} A (1.25 × Isc${r.fuse && r.fuse.needed ? ', and the fuse rating' : ''}). ${tbl.label}.`) : line(false, 'Cable: no size up to 120 mm² meets that target'),
        r.fuse ? line(r.fuse.needed ? (r.fuse.fuse ? true : false) : null, r.fuse.needed ? (r.fuse.fuse ? `String fuses: ${r.fuse.fuse} A gPV in each string (+ and −)` : 'String fuses needed, but no standard size fits') : 'String fuses: not needed', r.fuse.needed ? `${r.fuse.why} Fuse between 1.5 × Isc (${r.fuse.lo} A) and 2.4 × Isc (${r.fuse.hi} A)${r.fuse.maxSeriesFuse ? ` and no more than the panel\u2019s ${r.fuse.maxSeriesFuse} A` : ''}, rated for at least ${r.cold || '?'} V DC.` : `${r.fuse.why} With 3 or more strings in parallel each one needs gPV fuses.`) : null]),
        sizeRows(r.size, r.needAmps), notes());
    } else {
      const r = batteryLeads({ volts: v.bV, current: v.bI, kw: v.bKw, eff: v.bEff, length: v.bLen, targetPct: v.bPct, temp: v.temp, cable: v.cable });
      if (!r.ok) { fill(top, banner(r.error, '', 'red')); fill(work); return; }
      const p = r.size && r.size.pick;
      fill(top, answerCard({ kicker: `Battery leads: ${r.current} A at ${v.bV} V`, good: p && r.fuse && r.fuse.fuse ? true : false,
        big: [r.fuse && r.fuse.fuse ? `${r.fuse.fuse} A DC fuse` : 'Fuse: bigger than listed', p ? `${p.size} mm² each way` : 'No cable size fits'],
        sub: p ? `Drop ${p.vd.volts} V (${p.vd.pct}%), losing about ${p.vd.watts} W` : 'Shorten the run or run cables in parallel.',
        chips: [pchip(!!(r.fuse && r.fuse.fuse), 'Fuse'), p ? pchip(true, `Drop ${p.vd.pct}%`) : pchip(false, 'Cable')] }));
      fill(work, detailCard('bat-how', 'How it worked it out', [
        r.fromKw ? h('div', { class: 'note' }, `${v.bKw} kW × 1000 ÷ (${v.bV} V × ${v.bEff}) = ${r.current} A.`) : null,
        r.fuse ? line(!!r.fuse.fuse, r.fuse.fuse ? `Fuse: ${r.fuse.fuse} A DC-rated (e.g. Class T or NH)` : 'Fuse: bigger than the sizes listed', `At least 1.25 × ${r.current} A = ${r.fuse.need} A, and no bigger than the cable can carry. Breaking capacity must be above the battery\u2019s short-circuit current (data sheet; often over 10 kA).`) : null,
        p ? line(true, `Cable: ${p.size} mm² each way — drop ${p.vd.volts} V (${p.vd.pct}%), losing about ${p.vd.watts} W`, `${r.size.why.length ? r.size.why[r.size.why.length - 1] + ', so ' + p.size + ' mm². ' : ''}Must carry the fuse rating (${r.fuse && r.fuse.fuse} A). ${tbl.label}.`) : line(false, 'Cable: no size up to 120 mm² does it. Shorten the run or parallel the cables.')]),
        sizeRows(r.size, r.fuse && r.fuse.fuse), notes());
    }
  };
  const notes = () => h('div', {}, detailCard('dc-src', 'Where the numbers come from', [
    h('ul', { class: 'note' },
      h('li', {}, 'PV string cable starts at 4 mm² (the usual smallest PV cable).'),
      h('li', {}, 'Copper resistance from first principles (resistivity at the chosen temperature). Volt drop counts both the + and − cables.'),
      h('li', {}, 'Cable ratings: BS 7671 Table 4D1A / 4E1A, two single-core cables clipped direct, 30 °C, no grouping. PV cable (H1Z2Z2-K) and tri-rated makers often give higher ratings: use theirs if you have them.'),
      h('li', {}, 'PV: cold Voc = n × Voc × (1 + coefficient × (Tmin − 25 °C)); cable Iz ≥ 1.25 × Isc; string fuses (gPV) when 3+ strings are in parallel, 1.5–2.4 × Isc and ≤ the panel\u2019s max series fuse (IET Code of Practice for Grid-connected Solar PV, BS 7671 Section 712).'),
      h('li', {}, 'Battery: fuse ≥ 1.25 × max continuous current, cable rated at least the fuse (IET Code of Practice for Electrical Energy Storage Systems).'),
      h('li', {}, '⚠ Rules of thumb typed in from the codes of practice: always check the panel, inverter, battery and fuse makers\u2019 instructions.'))]),
    h('div', { class: 'notice amber' }, 'DC arcs don\u2019t go out on their own: isolate and cover the panels, and use DC-rated isolators and fuses.'));
  drawForm(); draw();
  page('Solar string & battery checks', [modeEl, top, form, work], { back: '#/calc' });
});
