// calcsize.js — "Size a circuit": put in the load and the length of run, and
// it suggests the breaker and the smallest cable that passes everything,
// saying in plain words why it went up a size.
import { h, fill } from './ui.js';
import { route, page } from './app.js';
import { CABLES, CABLE_PICKS, AMBIENTS, CI_OPTIONS, SINGLES_CPC } from './cables.js';
import { sizeCircuit, LOAD_TYPES } from './design.js';
import { DEVICES, deviceById, CHECK_NOTE } from './limits.js';
import { calcTabs } from './calcui.js';

const CABLE_ORDER = ['te', 'te3', 'singles', 'swa', 'swaX', 'swa3', 'swa3X'];
const DEFAULTS = { loadType: 'general', load: '20', unit: 'A', pf: '1', ringLoad: 'spread', length: '32', ze: '0.35', vd: 'auto', cable: 'te', cpcMode: 'core', method: 'C', ambient: '30', grouped: '1', grouping: 'bunched', ci: '1', separateCpc: false, device: 'rcbo', type: 'auto', time: 0.4 };

route(/^\/calc\/size$/, async () => {
  const v = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem('sparky.size1') || 'null') || {}) };
  const top = h('div'); const form = h('div'); const work = h('div');
  const save = () => { localStorage.setItem('sparky.size1', JSON.stringify(v)); drawForm(); draw(); };
  const set = (k, val) => { v[k] = val; save(); };
  const chips = (k, opts, cls = '') => h('div', { class: 'chips ' + cls }, opts.map(([val, t]) => h('button', { class: 'chip' + (String(v[k]) === String(val) ? ' on' : ''), onclick: () => set(k, val) }, t)));
  const sel = (k, label, opts) => h('label', { class: 'f' }, h('span', {}, label), h('select', { onchange: (e) => set(k, e.target.value) }, opts.map(([val, t]) => h('option', { value: val, selected: String(v[k]) === String(val) ? true : null }, t))));
  const num = (k, label, ph = '') => h('label', { class: 'f' }, h('span', {}, label), h('input', { inputmode: 'decimal', value: v[k], placeholder: ph, onchange: (e) => set(k, e.target.value.trim()) }));
  const chk = (k, label) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: v[k], onchange: (e) => set(k, e.target.checked) }), label);
  const lab = (t) => h('span', { class: 'note', style: 'display:block;margin:6px 0 4px' }, t);

  const drawForm = () => {
    const cab = CABLES[v.cable] || CABLES.te; if (!cab.methods[v.method]) v.method = Object.keys(cab.methods)[0];
    const d = deviceById(v.device) || deviceById('rcbo');
    if (v.type !== 'auto' && !d.types.includes(v.type)) v.type = 'auto';
    const ring = v.loadType === 'ring';
    fill(form,
      h('div', { class: 'card' }, h('h2', {}, '1 · What it supplies'),
        chips('loadType', LOAD_TYPES, 'small'),
        h('div', { class: 'grid2' }, num('load', v.unit === 'kW' ? 'Load (kW)' : 'Load / design current Ib (A)'), h('div', {}, lab('Load in'), chips('unit', [['kW', 'kW'], ['A', 'Amps']]))),
        v.unit === 'kW' ? num('pf', 'Power factor (1 for heaters / showers, about 0.8 for motors)') : null,
        ring ? h('div', {}, lab('How the load sits on the ring'), chips('ringLoad', [['spread', 'Spread round the ring'], ['point', 'All at the far point']], 'small')) : null),
      h('div', { class: 'card' }, h('h2', {}, '2 · The run'),
        h('div', { class: 'grid2' }, num('length', ring ? 'Ring loop length (m), all the way round' : 'Length of run (m)'), num('ze', 'Ze or Zdb at the board (Ω)', '0.35')),
        h('p', { class: 'note' }, 'Ze 0.35 Ω is the usual TN-C-S (PME) figure, 0.8 Ω TN-S. Use your measured figure if you have one; from a sub-board use its Zdb.'),
        lab('Volt drop limit'), chips('vd', [['auto', v.loadType === 'lighting' ? 'Auto (3% lighting)' : 'Auto (5% other)'], ['3', '3%'], ['5', '5%']], 'small')),
      h('div', { class: 'card' }, h('h2', {}, '3 · Cable and how it\u2019s installed'),
        sel('cable', 'Cable', CABLE_ORDER.map((k) => [k, CABLES[k].label])),
        CABLES[v.cable].cores === 3 ? h('div', {}, lab('CPC'), chips('cpcMode', [['core', '3rd core'], ['armour', 'Armour']])) : null,
        sel('method', 'Installation (reference) method', Object.entries(cab.methods).map(([k, m]) => [k, m.label])),
        h('div', { class: 'grid3' }, sel('ambient', 'Ambient °C', AMBIENTS.map((t) => [t, t + ' °C'])), num('grouped', 'Circuits grouped'), sel('grouping', 'Grouping', [['bunched', 'Bunched / enclosed'], ['clipped', 'One layer on a wall']])),
        sel('ci', 'Thermal insulation', CI_OPTIONS),
        /^10[0-3]$/.test(String(v.method)) && v.ci !== '1' ? h('p', { class: 'note warnnote' }, 'Methods 100–103 already allow for the insulation. Leave this at “None” unless the cable is also buried in it elsewhere.') : null,
        v.cable === 'singles' ? chk('separateCpc', 'CPC run separately, not bunched with the circuit (k 143 instead of 115)') : null,
        cab.note ? h('p', { class: 'note warnnote' }, cab.note) : null),
      h('div', { class: 'card' }, h('h2', {}, '4 · Protective device'),
        sel('device', 'Device', DEVICES.filter((x) => x.table && x.id !== 'bs1362').map((x) => [x.id, x.label])),
        d.types.length > 1 ? h('div', {}, lab('Type / curve'), chips('type', [['auto', 'Auto'], ...d.types.map((t) => [t, t])])) : null,
        lab('Disconnection time'), chips('time', [[0.4, '0.4 s (final circuit ≤ 63 A)'], [5, '5 s (distribution / > 63 A)']], 'small')));
  };

  const draw = () => {
    const r = sizeCircuit({ load: v.load, unit: v.unit, pf: v.pf, loadType: v.loadType, length: v.length, cable: v.cable, cpcMode: v.cpcMode, method: v.method, ambient: +v.ambient, grouped: +v.grouped, grouping: v.grouping, ci: +v.ci, ze: Number(v.ze) || 0, device: v.device, type: v.type, time: Number(v.time), vdPct: v.vd === 'auto' ? null : v.vd, ringLoad: v.ringLoad, separateCpc: v.separateCpc });
    if (!r.ok) { fill(top, h('div', { class: 'notice red' }, r.error)); fill(work); return; }
    const d = deviceById(r.device); const p = r.pick;
    const cpcText = (row) => row.cpc === 'armour' ? ' + armour as CPC' : row.cpc != null ? ` / ${row.cpc} mm² CPC` : '';
    const line = (ok, text, sub) => h('div', { class: 'resline ' + (ok === true ? 'ok' : ok === false ? 'bad' : 'na') }, h('b', {}, ok === true ? '✓' : ok === false ? '✗' : '–'), h('div', {}, h('div', {}, text), sub ? h('div', { class: 'note' }, sub) : null));
    fill(top, h('div', { class: 'card calcsum nostick ' + (p ? 'good' : 'bad') },
      h('div', { class: 'answer' }, p ? [h('div', { class: 'ans-k' }, 'Use'), h('div', { class: 'ans-v' }, `${r.inA} A Type ${r.curve} ${d.label.split(' (')[0]}`), h('div', { class: 'ans-v' }, `${p.size} mm²${cpcText(p)}`), h('div', { class: 'note' }, CABLES[v.cable].label)] : h('div', { class: 'ans-v' }, 'No cable in this table passes')),
      h('ol', { class: 'steps' }, r.steps.map((t) => h('li', {}, t))),
      p ? [
        line(p.cur.pass, `Current: carries ${p.cur.iz} A after factors, needs ${p.cur.needIz} A`, `Tabulated ${p.cur.it} A × factors ${r.factors.total}.`),
        line(p.vd.pass, `Volt drop: ${p.vd.volts} V (${p.vd.pct}%), limit ${p.vd.limit}%`, `${p.vd.mvam} mV/A/m × ${r.ib} A × ${v.length} m ÷ 1000${p.vd.div > 1 ? ' ÷ ' + p.vd.div + ' (ring)' : ''}.`),
        line(p.z.pass, `Zs: ${p.z.zs} Ω, max ${p.z.max ?? '?'} Ω`, `Ze ${v.ze} + (R1+R2) ${p.z.r20} Ω × hot = ${p.z.rHot} Ω.`),
        p.adi.ok ? line(p.adi.pass, `Adiabatic: CPC needs ${p.adi.smin} mm², ${p.adi.armour ? 'armour is' : 'has'} ${p.adi.area} mm²`, `Fault ${Math.round(p.adi.ifault)} A. ${p.adi.how} k ${r.k.k}.`) : line(null, 'Adiabatic: ' + (p.adi.error || 'not worked out')),
        h('div', { class: 'note', style: 'margin-top:6px' }, `When you test: expect R1+R2 about ${p.z.r20} Ω at 20 °C${r.ring ? ' (ring, (r1 + r2) ÷ 4)' : ''}.`),
      ] : null));
    fill(work, h('div', { class: 'card' }, h('h2', {}, 'Every size'),
      h('table', { class: 'calctab' }, h('tr', {}, ['mm²', 'Iz A', 'V drop', 'Zs Ω', 'CPC needs', ''].map((t) => h('th', {}, t))),
        r.rows.map((row) => h('tr', { class: row === p ? 'on' : '' }, h('td', {}, row.size), h('td', { class: row.cur.pass ? '' : 'bad' }, row.cur.iz ?? '–'), h('td', { class: row.vd.pass ? '' : 'bad' }, row.vd.pct + '%'), h('td', { class: row.z.pass === false ? 'bad' : '' }, row.z.zs ?? '–'), h('td', { class: row.adi.pass === false ? 'bad' : '' }, row.adi.ok ? row.adi.smin + ' mm²' : '–'), h('td', {}, row.ok ? '✓' : '✗')))),
      h('p', { class: 'note' }, `Needed: Iz ≥ ${r.ring ? '20 A (ring, 2.5 mm²+)' : r.inA + ' A'}; volt drop ≤ ${r.limit}%; Zs ≤ ${r.max ?? '?'} Ω; CPC at least the adiabatic size.`),
      h('h2', { style: 'margin-top:12px' }, 'Where the numbers come from'),
      h('ul', { class: 'note' }, r.notes.map((t) => h('li', {}, t)), v.cable === 'singles' ? h('li', {}, `Singles CPC (Table 54.7): ${Object.entries(SINGLES_CPC).map(([a, b]) => a + '→' + b).join(', ')} mm².`) : null, h('li', {}, `Current ratings and volt drop: BS 7671 ${CABLES[v.cable].source}.`))),
      h('div', { class: 'notice amber' }, 'A design aid, not a design: check diversity, the cable\u2019s route, and the maker\u2019s data. ', CHECK_NOTE));
  };
  drawForm(); draw();
  page('Calculators', [calcTabs('size'), top, form, work], { back: '#/' });
});
