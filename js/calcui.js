// calcui.js — one calculator for a circuit: pick the device, the circuit and
// the cable; it tells you straight away whether the cable carries the
// current, the volt drop is OK, and the Zs will be within the limit.
import { h, fill } from './ui.js';
import { route, page, render } from './app.js';
import { CABLES, CABLE_PICKS, AMBIENTS, CA_SOURCE, ARMOUR_MOHM_PER_M, TEMP_MULT } from './cables.js';
import { voltDrop, sizeCable, designZs, r1r2At20 } from './calc.js';
import { adiabatic, kFor, cpcAreaFor } from './design.js';
import { CHECK_NOTE, DEVICES, deviceById, ratingsFor, maxZs, maxZsSource } from './limits.js';

const CABLE_ORDER = ['te', 'swa', 'swaX', 'swa3', 'swa3X'];
const DEFAULTS = { device: 'rcbo', type: 'B', rating: '32', ib: '20', shape: 'radial', length: '25', lighting: false, ze: '0.35', cable: 'te', method: 'C', size: 'auto', cpcMode: 'core', ambient: '30', grouped: '1', grouping: 'bunched', ci: '1', time: 0.4 };
const SHAPES = [['radial', 'Radial'], ['ring-point', 'Ring: load at far point'], ['ring-spread', 'Ring: load spread']];

// CPC for a cable + size (T&E has a smaller CPC; SWA uses a core or the armour).
export function cpcFor(cable, size, cpcMode) {
  if (cable === 'te') return CABLE_PICKS.te.sizes[size] ?? null;
  if (CABLES[cable] && CABLES[cable].cores === 2) return 'armour';
  return cpcMode === 'armour' ? 'armour' : Number(size);
}

// Tabs across the top of every calculator.
export const CALC_TABS = [['size', 'Size it'], ['check', 'Check it'], ['dc', 'DC']];
export function calcTabs(on) {
  localStorage.setItem('sparky.calctab', on);
  return h('div', { class: 'tabs' }, CALC_TABS.map(([k, t]) => h('a', { class: 'tab' + (k === on ? ' on' : ''), href: '#/calc/' + k }, t)));
}
route(/^\/calc$/, async () => { const t = localStorage.getItem('sparky.calctab'); history.replaceState(null, '', '#/calc/' + (CALC_TABS.some(([k]) => k === t) ? t : 'size')); return render(); });
route(/^\/calc\/check$/, async () => {
  const v = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem('sparky.calc2') || 'null') || {}) };
  const top = h('div'); const form = h('div'); const work = h('div');
  const save = () => { localStorage.setItem('sparky.calc2', JSON.stringify(v)); drawForm(); draw(); };
  const set = (k, val) => { v[k] = val; save(); };
  const chips = (k, opts, cls = '') => h('div', { class: 'chips ' + cls }, opts.map(([val, t]) => h('button', { class: 'chip' + (String(v[k]) === String(val) ? ' on' : ''), onclick: () => set(k, val) }, t)));
  const sel = (k, label, opts) => h('label', { class: 'f' }, h('span', {}, label), h('select', { onchange: (e) => set(k, e.target.value) }, opts.map(([val, t]) => h('option', { value: val, selected: String(v[k]) === String(val) ? true : null }, t))));
  const num = (k, label, ph = '') => h('label', { class: 'f' }, h('span', {}, label), h('input', { inputmode: 'decimal', value: v[k], placeholder: ph, onchange: (e) => set(k, e.target.value.trim()) }));
  const chk = (k, label) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: v[k], onchange: (e) => set(k, e.target.checked) }), label);

  const drawForm = () => {
    const d = deviceById(v.device) || deviceById('rcbo');
    if (!d.types.includes(v.type)) v.type = d.types[0] || '';
    const ratings = ratingsFor(d.id, v.type); if (ratings.length && !ratings.map(String).includes(String(v.rating))) v.rating = String(ratings.find((r) => r >= 20) || ratings[0]);
    const cab = CABLES[v.cable] || CABLES.te; if (!cab.methods[v.method]) v.method = Object.keys(cab.methods)[0];
    if (v.size !== 'auto' && !cab.sizes.map(String).includes(String(v.size))) v.size = 'auto';
    fill(form,
      h('div', { class: 'card' }, h('h2', {}, '1 · Protective device'),
        sel('device', 'Device', DEVICES.filter((x) => x.table).map((x) => [x.id, x.label])),
        d.types.length > 1 ? h('div', { class: 'f' }, h('span', { class: 'note' }, 'Type / curve'), chips('type', d.types.map((t) => [t, t]))) : null,
        h('div', { class: 'f' }, h('span', { class: 'note' }, 'Rating In (A)'), chips('rating', ratings.map((r) => [r, r]), 'small')),
        h('div', { class: 'f' }, h('span', { class: 'note' }, 'Disconnection time'), chips('time', [[0.4, '0.4 s (final circuit ≤ 63 A)'], [5, '5 s (distribution / > 63 A)']]))),
      h('div', { class: 'card' }, h('h2', {}, '2 · Circuit'),
        chips('shape', SHAPES),
        h('div', { class: 'grid3' }, num('ib', 'Design current Ib (A)'), num('length', v.shape === 'radial' ? 'Length (m)' : 'Ring loop length (m)'), num('ze', 'Ze (Ω)', 'e.g. 0.35')),
        chk('lighting', 'Lighting circuit (3% volt drop instead of 5%)')),
      h('div', { class: 'card' }, h('h2', {}, '3 · Cable and where it runs'),
        sel('cable', 'Cable', CABLE_ORDER.map((k) => [k, CABLES[k].label])),
        CABLES[v.cable].cores === 3 ? h('div', { class: 'f' }, h('span', { class: 'note' }, 'CPC'), chips('cpcMode', [['core', '3rd core'], ['armour', 'Armour']])) : null,
        h('div', { class: 'grid2' }, sel('size', 'Size (mm²)', [['auto', 'Smallest that passes'], ...cab.sizes.map((s) => [s, s + ' mm²' + (v.cable === 'te' ? ` / ${CABLE_PICKS.te.sizes[s]} CPC` : '')])]),
          sel('method', 'Installation method', Object.entries(cab.methods).map(([k, m]) => [k, m.label]))),
        h('div', { class: 'grid3' }, sel('ambient', 'Ambient °C', AMBIENTS.map((t) => [t, t + ' °C'])), num('grouped', 'Circuits grouped'), sel('grouping', 'Grouping', [['bunched', 'Bunched / enclosed'], ['clipped', 'One layer on a wall']])),
        sel('ci', 'Thermal insulation', [['1', 'None (Ci 1.0)'], ['0.5', 'Totally surrounded for 0.5 m or more (Ci 0.5)']]),
        cab.note ? h('p', { class: 'note warnnote' }, cab.note) : null));
  };

  const draw = () => {
    const d = deviceById(v.device); const ring = v.shape === 'radial' ? false : v.shape.slice(5);
    const s = sizeCable({ cable: v.cable, method: v.method, ib: +v.ib, inA: +v.rating, length: +v.length, ambient: +v.ambient, grouped: +v.grouped, grouping: v.grouping, insulationCi: +v.ci, bs3036: v.device === 'bs3036', lighting: v.lighting, ring });
    const max = maxZs({ device: v.device, type: v.type, rating: v.rating, time: v.time });
    if (!s.ok) { fill(top, h('div', { class: 'notice red' }, s.error)); fill(work); return; }
    const size = v.size === 'auto' ? (s.pick ? s.pick.size : null) : Number(v.size);
    const row = s.rows.find((r) => r.size === size);
    const cpc = size != null ? cpcFor(v.cable, size, v.cpcMode) : null;
    const z = size != null ? designZs({ ze: v.ze, cable: v.cable, live: size, cpc, length: +v.length, ring, device: v.device, type: v.type, rating: v.rating, time: v.time }) : null;
    const line = (ok, text, sub) => h('div', { class: 'resline ' + (ok === true ? 'ok' : ok === false ? 'bad' : 'na') }, h('b', {}, ok === true ? '✓' : ok === false ? '✗' : '–'), h('div', {}, h('div', {}, text), sub ? h('div', { class: 'note' }, sub) : null));
    const allOk = row && row.currentOk && (!row.vd || row.vd.pass) && (!z || z.pass !== false);
    fill(top, h('div', { class: 'card calcsum ' + (allOk ? 'good' : 'bad') },
      h('div', { class: 'calchead' }, size == null ? 'No size in this table passes' : `${size} mm²${cpc === 'armour' ? ' + armour CPC' : cpc ? ` / ${cpc} mm² CPC` : ''} ${CABLES[v.cable].label.split(',')[0]}`, h('span', { class: 'note' }, ` · ${d ? d.label.split(' (')[0] : ''} ${v.type}${v.rating} · ${v.shape === 'radial' ? 'radial' : 'ring'} ${v.length} m`)),
      row ? line(row.currentOk, `Current: cable ${row.it} A tabulated, needs ${row.needIt} A`, `Iz after factors ${row.iz} A (needs ${row.needIz} A). Factors ${s.factors.total}${s.caNote ? ' · ' + s.caNote : ''}`) : line(false, 'Current: no size passes. Try a bigger cable or another method.'),
      row && row.vd ? line(row.vd.pass, `Volt drop: ${row.vd.volts} V (${row.vd.pct}%), limit ${row.vd.limitPct}%`, `${row.vd.mvam} mV/A/m × ${v.ib} A × ${v.length} m ÷ 1000${row.vd.divisor > 1 ? ' ÷ ' + row.vd.divisor + ' (ring)' : ''}`) : line(null, 'Volt drop: enter a length'),
      z && z.ok ? line(z.pass, z.zs != null ? `Zs: ${z.zs} Ω, max ${max ?? '?'} Ω` : `Zs: enter Ze. Max ${max ?? '?'} Ω`, `Ze ${v.ze || '?'} + (R1+R2) ${z.r20} Ω × ${z.mult} hot = ${z.rHot} Ω. ${max != null ? maxZsSource(v.device) : 'No table figure for this device.'}${z.note ? ' ' + z.note : ''}`) : line(null, `Zs: max ${max ?? '?'} Ω (need a size and length)`),
      (() => { if (!z || !z.ok || z.zs == null) return line(null, 'Adiabatic: enter Ze, a size and a length'); const cp = cpcAreaFor(v.cable, size, v.cpcMode); const area = cp ? (cp.cpc === 'armour' ? cp.area : cp.cpc) : null; const k = kFor({ cable: v.cable, cpcMode: v.cpcMode }); const a = adiabatic({ zs: z.zs, device: v.device, type: v.type, rating: v.rating, k: k.k, cpcCsa: area, rcd: !!(d && d.rcd), time: v.time });
        return a.ok ? line(a.pass, `Adiabatic: CPC needs ${a.smin} mm², ${cp.cpc === 'armour' ? 'armour is' : 'it\u2019s'} ${area} mm²`, `Fault ${Math.round(a.ifault)} A at Zs ${z.zs} Ω. ${a.how} S = √(${a.i2t}) ÷ k ${a.k} (${k.label}).${cp.cpc === 'armour' ? ' ⚠ Armour area is maker\u2019s data.' : ''}`) : line(false, 'Adiabatic: ' + a.error); })(),
      size != null && Number(v.length) ? h('div', { class: 'note', style: 'margin-top:6px' }, `When you test: expect R1+R2 about ${r1r2At20({ live: size, cpc, length: +v.length, cores: CABLES[v.cable].cores, ring })} Ω at 20 °C${ring ? ' (ring, end-to-end ÷ 4)' : ''}.`) : null));
    fill(work, h('div', { class: 'card' }, h('h2', {}, 'All sizes'),
      h('table', { class: 'calctab' }, h('tr', {}, ['mm²', 'It A', 'Iz A', 'Current', 'Volt drop'].map((t) => h('th', {}, t))),
        s.rows.map((r) => h('tr', { class: r.size === size ? 'on' : '' }, h('td', {}, r.size), h('td', {}, r.it ?? '–'), h('td', {}, r.iz ?? '–'), h('td', {}, r.currentOk ? '✓' : '✗'), h('td', {}, r.vd ? `${r.vd.pct}% ${r.vd.pass ? '✓' : '✗'}` : '–')))),
      h('h2', { style: 'margin-top:12px' }, 'Where the numbers come from'),
      h('ul', { class: 'note' }, s.assumptions.map((a) => h('li', {}, a)),
        h('li', {}, `Current ratings and volt drop: BS 7671 ${CABLES[v.cable].source}.`),
        h('li', {}, `Ambient factor: ${CA_SOURCE}. ⚠ The table starts at 25 °C; 20 °C uses the 25 °C factor.`),
        h('li', {}, `R1+R2: copper at 20 °C (BS EN 60228 maxima), × ${TEMP_MULT[70]} (70 °C) or ${TEMP_MULT[90]} (90 °C) for the design Zs (${TEMP_MULT.source}).`),
        cpc === 'armour' ? h('li', {}, `⚠ Armour resistance: ${ARMOUR_MOHM_PER_M.source}`) : null,
        v.cable === 'te' ? h('li', {}, 'T&E CPC sizes (6242Y): 1.0/1.0, 1.5/1.0, 2.5/1.5, 4/1.5, 6/2.5, 10/4, 16/6 mm² (BS 6004, maker data).') : null)),
      h('div', { class: 'notice amber' }, CHECK_NOTE));
  };
  drawForm(); draw();
  page('Calculators', [calcTabs('check'), top, form, work], { back: '#/' });
});
