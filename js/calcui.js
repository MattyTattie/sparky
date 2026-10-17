// calcui.js — cable sizing and volt drop calculators.
import { h, fill } from './ui.js';
import { route, page } from './app.js';
import { CABLES } from './cables.js';
import { voltDrop, sizeCable, expectedR1R2, MOHM_PER_M } from './calc.js';
import { CHECK_NOTE } from './limits.js';

route(/^\/calc$/, async () => {
  const v = JSON.parse(localStorage.getItem('sparky.calc') || 'null') || { cable: 'te', method: 'C', size: '2.5', ib: '20', inA: '20', length: '25', ambient: '30', grouped: '1', grouping: 'bunched', ci: '1', bs3036: false, lighting: false, live: '2.5', cpc: '1.5' };
  const out = h('div');
  const save = () => { localStorage.setItem('sparky.calc', JSON.stringify(v)); draw(); };
  const sel = (k, label, opts) => h('label', { class: 'f' }, h('span', {}, label), h('select', { onchange: (e) => { v[k] = e.target.value; if (k === 'cable') { v.method = Object.keys(CABLES[v.cable].methods)[0]; render2(); } save(); } }, opts.map(([val, t]) => h('option', { value: val, selected: String(v[k]) === String(val) ? true : null }, t))));
  const num = (k, label) => h('label', { class: 'f' }, h('span', {}, label), h('input', { inputmode: 'decimal', value: v[k], oninput: (e) => { v[k] = e.target.value; save(); } }));
  const chk = (k, label) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: v[k], onchange: (e) => { v[k] = e.target.checked; save(); } }), label);
  const form = h('div');
  const render2 = () => fill(form, 
    h('div', { class: 'card' }, h('h2', {}, 'The circuit'),
      sel('cable', 'Cable', Object.entries(CABLES).map(([k, c]) => [k, c.label])),
      sel('method', 'Installation method', Object.entries(CABLES[v.cable].methods).map(([k, m]) => [k, m.label])),
      h('div', { class: 'grid3' }, num('ib', 'Design current Ib (A)'), num('inA', 'Device In (A)'), num('length', 'Length (m)')),
      h('div', { class: 'grid3' }, sel('ambient', 'Ambient °C', [25, 30, 35, 40, 45, 50].map((t) => [t, t])), num('grouped', 'Circuits grouped'), sel('grouping', 'Grouping', [['bunched', 'Bunched / enclosed'], ['clipped', 'Single layer on wall']])),
      sel('ci', 'Thermal insulation', [['1', 'None (Ci 1.0)'], ['0.89', 'One side, ≤100 mm? check (0.89)'], ['0.5', 'Totally surrounded 0.5 m (0.5)']]),
      chk('bs3036', 'Protected by a BS 3036 rewirable fuse (Cf 0.725)'), chk('lighting', 'Lighting circuit (3% volt drop)')),
    sel('size', 'Volt drop for a size (mm²)', CABLES[v.cable].sizes.map((s) => [s, s + ' mm²'])));
  const draw = () => {
    const s = sizeCable({ cable: v.cable, method: v.method, ib: +v.ib, inA: +v.inA, length: +v.length, ambient: +v.ambient, grouped: +v.grouped, grouping: v.grouping, insulationCi: +v.ci, bs3036: v.bs3036, lighting: v.lighting });
    const vd = voltDrop({ cable: v.cable, size: +v.size, ib: +v.ib, length: +v.length, lighting: v.lighting });
    const r = expectedR1R2(+v.live, +v.cpc, +v.length);
    fill(out, 
      !s.ok ? h('div', { class: 'notice red' }, s.error) : h('div', { class: 'card' }, h('h2', {}, 'Cable size'),
        s.pick ? h('div', { class: 'notice green' }, h('b', {}, `${s.pick.size} mm²`), ` — It ${s.pick.it} A (needs ≥ ${s.needIt} A), Iz ${s.pick.iz} A${s.pick.vd ? `, volt drop ${s.pick.vd.volts} V (${s.pick.vd.pct}%)` : ''}`) : h('div', { class: 'notice red' }, 'No size in this table passes. Try another method or a bigger cable type.'),
        h('div', { class: 'note' }, `Correction factors: Ca ${s.factors.ca} × Cg ${s.factors.cg} × Ci ${s.factors.ci} × Cf ${s.factors.cf} = ${s.factors.total}`),
        h('table', { style: 'width:100%;font-size:14px;margin-top:8px;border-collapse:collapse' }, h('tr', {}, ['mm²', 'It A', 'Iz A', 'Current', 'Volt drop'].map((t) => h('th', { style: 'text-align:left' }, t))),
          s.rows.map((r) => h('tr', { style: s.pick && s.pick.size === r.size ? 'background:#e3f4e8' : '' }, h('td', {}, r.size), h('td', {}, r.it ?? '–'), h('td', {}, r.iz ?? '–'), h('td', {}, r.currentOk ? '✓' : '✗'), h('td', {}, r.vd ? `${r.vd.pct}% ${r.vd.pass ? '✓' : '✗'}` : '–')))),
        h('ul', { class: 'note' }, s.assumptions.map((a) => h('li', {}, a)))),
      vd.ok ? h('div', { class: 'card' }, h('h2', {}, 'Volt drop'), h('div', { class: 'notice ' + (vd.pass ? 'green' : 'red') }, `${v.size} mm² at ${v.ib} A over ${v.length} m: ${vd.volts} V (${vd.pct}%). Limit ${vd.limitPct}% = ${vd.limitV} V. ${vd.pass ? 'OK.' : 'Too much.'}`), h('div', { class: 'note' }, `${vd.mvam} mV/A/m × ${v.ib} A × ${v.length} m ÷ 1000`)) : null,
      h('div', { class: 'card' }, h('h2', {}, 'Expected R1+R2'), h('div', { class: 'grid2' },
        h('label', { class: 'f' }, h('span', {}, 'Live mm²'), h('select', { onchange: (e) => { v.live = e.target.value; save(); } }, Object.keys(MOHM_PER_M).map((k) => h('option', { selected: String(v.live) === k ? true : null }, k)))),
        h('label', { class: 'f' }, h('span', {}, 'CPC mm²'), h('select', { onchange: (e) => { v.cpc = e.target.value; save(); } }, Object.keys(MOHM_PER_M).map((k) => h('option', { selected: String(v.cpc) === k ? true : null }, k))))),
        h('div', {}, r != null ? `About ${r} Ω at 20 °C for ${v.length} m (radial; a ring end-to-end ÷ 4).` : '–')),
      h('div', { class: 'notice amber' }, CHECK_NOTE));
  };
  render2(); draw();
  page('Calculators', [form, out], { back: '#/' });
});
