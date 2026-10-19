// calcdc.js — DC calculator: solar PV strings (cold-morning voltage, cable,
// string fuses) and battery ↔ inverter leads (volt drop, cable, fuse).
import { h, fill } from './ui.js';
import { route, page } from './app.js';
import { pvString, batteryLeads, DC_AMPS, RHO20, ALPHA, rhoAt } from './dc.js';
import { calcTabs } from './calcui.js';

const DEFAULTS = { mode: 'pv', n: '10', voc: '49.5', vmp: '41.6', isc: '13.9', imp: '13.2', coef: '-0.27', tmin: '-10', invMax: '600', mpptMax: '', pvLen: '25', strings: '1', maxFuse: '25', pvPct: '1',
  bV: '51.2', bI: '', bKw: '5', bEff: '0.95', bLen: '2', bPct: '1', temp: '70', cable: 'xlpe90' };

route(/^\/calc\/dc$/, async () => {
  const v = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem('sparky.dc1') || 'null') || {}) };
  const top = h('div'); const form = h('div'); const work = h('div');
  const save = () => { localStorage.setItem('sparky.dc1', JSON.stringify(v)); drawForm(); draw(); };
  const set = (k, val) => { v[k] = val; save(); };
  const chips = (k, opts, cls = '') => h('div', { class: 'chips ' + cls }, opts.map(([val, t]) => h('button', { class: 'chip' + (String(v[k]) === String(val) ? ' on' : ''), onclick: () => set(k, val) }, t)));
  const num = (k, label, ph = '') => h('label', { class: 'f' }, h('span', {}, label), h('input', { inputmode: 'decimal', value: v[k], placeholder: ph, onchange: (e) => set(k, e.target.value.trim()) }));
  const lab = (t) => h('span', { class: 'note', style: 'display:block;margin:6px 0 4px' }, t);
  const line = (ok, text, sub) => h('div', { class: 'resline ' + (ok === true ? 'ok' : ok === false ? 'bad' : 'na') }, h('b', {}, ok === true ? '✓' : ok === false ? '✗' : '–'), h('div', {}, h('div', {}, text), sub ? h('div', { class: 'note' }, sub) : null));
  const cableCard = (pctKey) => h('div', { class: 'card' }, h('h2', {}, 'Cable'),
    h('label', { class: 'f' }, h('span', {}, 'Cable type (for its current rating)'), h('select', { onchange: (e) => set('cable', e.target.value) }, Object.entries(DC_AMPS).map(([k, t]) => h('option', { value: k, selected: v.cable === k ? true : null }, t.label)))),
    lab('Volt drop target'), chips(pctKey, [['1', '1%'], ['1.5', '1.5%'], ['2', '2%'], ['3', '3%']], 'small'),
    lab('Conductor temperature for the resistance'), chips('temp', [['20', '20 °C'], ['50', '50 °C'], ['70', '70 °C'], ['90', '90 °C']], 'small'));

  const drawForm = () => fill(form,
    chips('mode', [['pv', 'Solar PV string'], ['battery', 'Battery leads']]),
    v.mode === 'pv' ? [
      h('div', { class: 'card' }, h('h2', {}, 'Panels (from the data sheet, STC)'),
        h('div', { class: 'grid3' }, num('n', 'Panels in the string'), num('voc', 'Voc (V)'), num('vmp', 'Vmp (V)')),
        h('div', { class: 'grid3' }, num('isc', 'Isc (A)'), num('imp', 'Imp (A)'), num('coef', 'Voc temp. coeff. (%/°C)', '-0.27')),
        num('maxFuse', 'Max series fuse rating (A)', 'e.g. 25')),
      h('div', { class: 'card' }, h('h2', {}, 'Inverter and site'),
        h('div', { class: 'grid2' }, num('invMax', 'Inverter max DC input (V)'), num('mpptMax', 'MPPT range top (V, optional)')),
        h('div', { class: 'grid3' }, num('tmin', 'Coldest °C'), num('strings', 'Strings in parallel'), num('pvLen', 'Cable run one way (m)')),
        h('p', { class: 'note' }, 'Coldest temperature: −10 °C is the usual UK design figure; use colder for exposed or high sites.')),
      cableCard('pvPct')] : [
      h('div', { class: 'card' }, h('h2', {}, 'Battery and inverter'),
        h('div', { class: 'grid2' }, num('bV', 'Battery voltage (V, nominal)'), num('bI', 'Max continuous current (A)', 'from data sheet')),
        h('div', { class: 'grid2' }, num('bKw', 'or inverter power (kW)'), num('bEff', 'Inverter efficiency', '0.95')),
        num('bLen', 'Cable run one way (m)'),
        h('p', { class: 'note' }, 'If you fill in the current, it\u2019s used; otherwise current = kW × 1000 ÷ (V × efficiency). Use the lowest battery voltage for the worst case.')),
      cableCard('bPct')]);

  const draw = () => {
    const tbl = DC_AMPS[v.cable] || DC_AMPS.xlpe90;
    const sizeRows = (sz, amps) => sz ? h('div', { class: 'card' }, h('h2', {}, 'Every size'),
      h('table', { class: 'calctab' }, h('tr', {}, ['mm²', 'Rated A', 'Drop V', 'Drop %', ''].map((t) => h('th', {}, t))),
        sz.rows.slice(0, 9).map((r) => h('tr', { class: r === sz.pick ? 'on' : '' }, h('td', {}, r.size), h('td', { class: r.curOk ? '' : 'bad' }, r.amps ?? '–'), h('td', {}, r.vd ? r.vd.volts : '–'), h('td', { class: r.vdOk ? '' : 'bad' }, r.vd ? r.vd.pct + '%' : '–'), h('td', {}, r.curOk && r.vdOk ? '✓' : '✗')))),
      h('p', { class: 'note' }, `Needs ≥ ${amps} A. Volt drop = 2 × length × I × ρ ÷ csa (out and back), ρ = ${RHO20} Ω·mm²/m at 20 °C × (1 + ${ALPHA} × (T − 20)) = ${rhoAt(v.temp).toFixed(5)} at ${v.temp} °C.`)) : null;
    if (v.mode === 'pv') {
      const r = pvString({ n: v.n, voc: v.voc, vmp: v.vmp, isc: v.isc, imp: v.imp, coefPct: v.coef, tmin: v.tmin, invMax: v.invMax, mpptMax: v.mpptMax, length: v.pvLen, targetPct: v.pvPct, temp: v.temp, strings: v.strings, maxSeriesFuse: v.maxFuse, cable: v.cable });
      const p = r.size && r.size.pick;
      fill(top, h('div', { class: 'card calcsum nostick ' + (r.vocOk !== false && p ? 'good' : 'bad') },
        h('div', { class: 'calchead' }, `String of ${v.n} × ${v.voc} V Voc`),
        r.cold != null ? line(r.vocOk, `Cold-morning Voc ${r.cold} V at ${v.tmin} °C${r.invMax ? `, inverter max ${r.invMax} V` : ''}`, `${v.n} × ${v.voc} V × (1 + ${v.coef}% × (${v.tmin} − 25)) = ${r.cold} V. At STC it\u2019s ${r.stc} V.${r.near ? ' ⚠ Within 5% of the inverter limit: leave more margin.' : ''}${r.vocOk === false ? ' Over the limit: take a panel out of the string.' : ''}`) : line(null, 'Enter panels, Voc and the coefficient'),
        r.mpptOk != null ? line(r.mpptOk, `Cold Voc vs MPPT range top ${r.mpptMax} V`, r.mpptOk ? 'Inside the MPPT range.' : 'Above the MPPT range: the inverter will clip until the panels warm up (check the data sheet).') : null,
        r.vstring ? line(null, `String working voltage about ${r.vstring} V (${v.n} × Vmp)`, 'Used as the base for the volt drop %.') : null,
        p ? line(true, `Cable: ${p.size} mm² — drop ${p.vd.volts} V (${p.vd.pct}%), target ${v.pvPct}%`, `${r.size.why.length ? r.size.why[r.size.why.length - 1] + ', so ' + p.size + ' mm². ' : ''}Cable must carry ${r.needAmps} A (1.25 × Isc${r.fuse && r.fuse.needed ? ', and the fuse rating' : ''}). ${tbl.label}.`) : line(false, 'Cable: no size up to 120 mm² meets that target'),
        r.fuse ? line(r.fuse.needed ? (r.fuse.fuse ? true : false) : null, r.fuse.needed ? (r.fuse.fuse ? `String fuses: ${r.fuse.fuse} A gPV in each string (+ and −)` : 'String fuses needed, but no standard size fits') : 'String fuses: not needed', r.fuse.needed ? `${r.fuse.why} Fuse between 1.5 × Isc (${r.fuse.lo} A) and 2.4 × Isc (${r.fuse.hi} A)${r.fuse.maxSeriesFuse ? ` and no more than the panel\u2019s ${r.fuse.maxSeriesFuse} A` : ''}, rated for at least ${r.cold || '?'} V DC.` : `${r.fuse.why} With 3 or more strings in parallel each one needs gPV fuses.`) : null));
      fill(work, sizeRows(r.size, r.needAmps), notes());
    } else {
      const r = batteryLeads({ volts: v.bV, current: v.bI, kw: v.bKw, eff: v.bEff, length: v.bLen, targetPct: v.bPct, temp: v.temp, cable: v.cable });
      if (!r.ok) { fill(top, h('div', { class: 'notice red' }, r.error)); fill(work); return; }
      const p = r.size && r.size.pick;
      fill(top, h('div', { class: 'card calcsum nostick ' + (p ? 'good' : 'bad') },
        h('div', { class: 'calchead' }, `Battery leads: ${r.current} A at ${v.bV} V`),
        r.fromKw ? h('div', { class: 'note' }, `${v.bKw} kW × 1000 ÷ (${v.bV} V × ${v.bEff}) = ${r.current} A.`) : null,
        r.fuse ? line(!!r.fuse.fuse, r.fuse.fuse ? `Fuse: ${r.fuse.fuse} A DC-rated (e.g. Class T or NH)` : 'Fuse: bigger than the sizes listed', `At least 1.25 × ${r.current} A = ${r.fuse.need} A, and no bigger than the cable can carry. Breaking capacity must be above the battery\u2019s short-circuit current (data sheet; often over 10 kA).`) : null,
        p ? line(true, `Cable: ${p.size} mm² each way — drop ${p.vd.volts} V (${p.vd.pct}%), losing about ${p.vd.watts} W`, `${r.size.why.length ? r.size.why[r.size.why.length - 1] + ', so ' + p.size + ' mm². ' : ''}Must carry the fuse rating (${r.fuse && r.fuse.fuse} A). ${tbl.label}.`) : line(false, 'Cable: no size up to 120 mm² does it. Shorten the run or parallel the cables.')));
      fill(work, sizeRows(r.size, r.fuse && r.fuse.fuse), notes());
    }
  };
  const notes = () => h('div', {}, h('div', { class: 'card' }, h('h2', {}, 'Where the numbers come from'),
    h('ul', { class: 'note' },
      h('li', {}, 'PV string cable starts at 4 mm² (the usual smallest PV cable).'),
      h('li', {}, 'Copper resistance from first principles (resistivity at the chosen temperature). Volt drop counts both the + and − cables.'),
      h('li', {}, 'Cable ratings: BS 7671 Table 4D1A / 4E1A, two single-core cables clipped direct, 30 °C, no grouping. PV cable (H1Z2Z2-K) and tri-rated makers often give higher ratings: use theirs if you have them.'),
      h('li', {}, 'PV: cold Voc = n × Voc × (1 + coefficient × (Tmin − 25 °C)); cable Iz ≥ 1.25 × Isc; string fuses (gPV) when 3+ strings are in parallel, 1.5–2.4 × Isc and ≤ the panel\u2019s max series fuse (IET Code of Practice for Grid-connected Solar PV, BS 7671 Section 712).'),
      h('li', {}, 'Battery: fuse ≥ 1.25 × max continuous current, cable rated at least the fuse (IET Code of Practice for Electrical Energy Storage Systems).'),
      h('li', {}, '⚠ Rules of thumb typed in from the codes of practice: always check the panel, inverter, battery and fuse makers\u2019 instructions.'))),
    h('div', { class: 'notice amber' }, 'DC arcs don\u2019t go out on their own: isolate and cover the panels, and use DC-rated isolators and fuses.'));
  drawForm(); draw();
  page('Calculators', [calcTabs('dc'), top, form, work], { back: '#/' });
});
