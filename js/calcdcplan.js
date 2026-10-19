// calcdcplan.js — "DC system planner" screen (Calculators → DC → DC system planner).
// Inputs are kept on this phone (localStorage) and can be saved to a job
// (job.dcPlans, optional: older backups and older app versions are unaffected).
import { h, fill, toast, modal, shareOrDownload } from './ui.js';
import { route, page, go } from './app.js';
import * as db from './db.js';
import { getProfile } from './state.js';
import { planDC, planText, PLAN_DEFAULTS, VAN_EXAMPLE, QUICK_LOADS, quickLoad, CHEMS, PLAN_CABLES, SAFETY } from './dcplan.js';
import { calcTabs } from './calcui.js';

const KEY = 'sparky.dcplan1';
export const dcSubTabs = (on) => { localStorage.setItem('sparky.dcsub', on); return h('div', { class: 'chips subtabs' }, [['pv', 'Solar / battery checks'], ['plan', 'DC system planner']].map(([k, t]) => h('a', { class: 'chip' + (k === on ? ' on' : ''), href: '#/calc/dc/' + k }, t))); };
export const loadPlanInputs = () => { try { return { ...PLAN_DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || 'null') || {}) }; } catch { return { ...PLAN_DEFAULTS }; } };
export const storePlanInputs = (v) => localStorage.setItem(KEY, JSON.stringify(v));
const clone = (o) => JSON.parse(JSON.stringify(o));

route(/^\/calc\/dc\/plan$/, async () => {
  const v = loadPlanInputs(); v.loads = (v.loads || []).map((l) => ({ ...l }));
  const top = h('div'); const form = h('div'); const work = h('div');
  const save = () => { storePlanInputs(v); drawForm(); draw(); };
  const set = (k, val) => { v[k] = val; save(); };
  const chips = (k, opts, cls = '') => h('div', { class: 'chips ' + cls }, opts.map(([val, t]) => h('button', { class: 'chip' + (String(v[k]) === String(val) ? ' on' : ''), onclick: () => set(k, val) }, t)));
  const num = (k, label, ph = '') => h('label', { class: 'f' }, h('span', {}, label), h('input', { inputmode: 'decimal', value: v[k], placeholder: ph, onchange: (e) => set(k, e.target.value.trim()) }));
  const lab = (t) => h('span', { class: 'note', style: 'display:block;margin:6px 0 4px' }, t);
  const line = (ok, text, sub) => h('div', { class: 'resline ' + (ok === true ? 'ok' : ok === false ? 'bad' : 'na') }, h('b', {}, ok === true ? '✓' : ok === false ? '✗' : '–'), h('div', {}, h('div', {}, text), sub ? h('div', { class: 'note' }, sub) : null));
  const setLoad = (i, k, val) => { v.loads[i][k] = val; save(); };

  const loadRow = (l, i) => h('div', { class: 'loadrow' + (l.ac ? ' ac' : '') },
    h('div', { class: 'loadtop' }, h('input', { class: 'lname', value: l.name || '', placeholder: 'Name', 'aria-label': 'Load name', onchange: (e) => setLoad(i, 'name', e.target.value) }),
      h('button', { class: 'btn small warn', 'aria-label': 'Remove ' + (l.name || 'load'), onclick: () => { v.loads.splice(i, 1); save(); } }, '✕')),
    h('div', { class: 'grid3' },
      h('label', { class: 'f' }, h('span', {}, l.ac ? 'Power (W, 230 V)' : `Power (${l.unit === 'A' ? 'A' : 'W'})`), h('input', { inputmode: 'decimal', value: l.value || '', onchange: (e) => setLoad(i, 'value', e.target.value.trim()) })),
      h('label', { class: 'f' }, h('span', {}, 'Hours a day'), h('input', { inputmode: 'decimal', value: l.hours || '', onchange: (e) => setLoad(i, 'hours', e.target.value.trim()) })),
      l.ac ? h('div', { class: 'note', style: 'align-self:center' }, 'via the inverter') : h('label', { class: 'f' }, h('span', {}, 'Run (m, one way)'), h('input', { inputmode: 'decimal', value: l.length || '', onchange: (e) => setLoad(i, 'length', e.target.value.trim()) }))),
    l.ac ? null : h('div', { class: 'grid3' },
      h('label', { class: 'f' }, h('span', {}, `Peak (${l.unit === 'A' ? 'A' : 'W'}, optional)`), h('input', { inputmode: 'decimal', value: l.peak || '', onchange: (e) => setLoad(i, 'peak', e.target.value.trim()) })),
      h('div', { class: 'chips small', style: 'align-self:end;margin-bottom:10px' }, ['W', 'A'].map((u) => h('button', { class: 'chip' + ((l.unit || 'W') === u ? ' on' : ''), onclick: () => setLoad(i, 'unit', u) }, u))),
      h('label', { class: 'check', style: 'align-self:end' }, h('input', { type: 'checkbox', checked: !!l.lighting, onchange: (e) => setLoad(i, 'lighting', e.target.checked) }), '10% drop OK')));

  const drawForm = () => fill(form,
    h('div', { class: 'card' }, h('h2', {}, 'System'),
      lab('System voltage'), chips('volts', [['12', '12 V'], ['24', '24 V'], ['48', '48 V']]),
      lab('Battery type'), chips('chem', Object.entries(CHEMS).map(([k, c]) => [k, c.label])),
      h('div', { class: 'grid3' }, num('dod', 'Usable %', String(Math.round((CHEMS[v.chem] || CHEMS.lifepo4).dod * 100))), num('days', 'Days with no charging'), num('battAh', 'Battery fitted (Ah)', 'optional')),
      num('bmsA', 'Battery BMS max continuous (A, optional)', 'from the data sheet'),
      h('p', { class: 'note' }, 'Usable % (depth of discharge): about 80% for LiFePO4, 50% for AGM and lead-acid if you want them to last.')),
    h('div', { class: 'card' }, h('h2', {}, `Loads (${v.loads.length})`),
      v.loads.map(loadRow),
      lab('Add a load'),
      h('div', { class: 'chips small' }, QUICK_LOADS.map((q) => h('button', { class: 'chip', onclick: () => { v.loads.push(quickLoad(q.key)); save(); } }, '+ ' + q.name.replace(' (via inverter)', '').replace(' (230 V via inverter)', ' (230 V)'))),
        h('button', { class: 'chip', onclick: () => { v.loads.push({ name: '', value: '', unit: 'W', hours: '', length: '', peak: '' }); save(); } }, '+ Other DC'),
        h('button', { class: 'chip', onclick: () => { v.loads.push({ name: '', ac: true, value: '', unit: 'W', hours: '' }); save(); } }, '+ Other 230 V')),
      h('p', { class: 'note' }, 'Hours a day = how long it runs at that power (a fridge cycles, so about 8 h on a warm day). Peak is the start-up or max draw (heater glow plug, 12 V socket): the fuse and cable are sized for it. Run = fuse box to the load, one way.')),
    h('div', { class: 'card' }, h('h2', {}, 'Charging'),
      h('div', { class: 'grid2' }, num('solarW', 'Solar panels total (W)', '0 = none'), num('panels', 'Number of panels')),
      v.solarW ? [h('div', { class: 'grid3' }, num('panelVoc', 'Panel Voc (V)', 'optional'), num('panelVmp', 'Vmp (V)'), num('panelIsc', 'Isc (A)')),
        h('div', { class: 'grid3' }, num('series', 'In series', 'auto'), num('mpptV', 'MPPT max PV (V)'), num('pvLen', 'Roof to MPPT (m)')),
        h('div', { class: 'grid2' }, num('tmin', 'Coldest °C'), num('coef', 'Voc coeff. (%/°C)'))] : null,
      h('div', { class: 'grid3' }, num('dcdcA', 'DC-DC charger (A)', '0 = none'), num('altA', 'Alternator (A)', 'optional'), num('dcdcLen', 'Starter batt. to DC-DC (m)')),
      h('div', { class: 'grid2' }, num('shoreA', 'Mains (shore) charger (A)', '0 = none'), num('vehV', 'Vehicle battery (V)'))),
    h('div', { class: 'card' }, h('h2', {}, 'Inverter and layout'),
      h('div', { class: 'grid2' }, num('invW', 'Inverter (W)', 'blank = from 230 V loads'), num('invLen', 'Busbar to inverter (m)')),
      h('div', { class: 'grid3' }, num('mainLen', 'Battery to busbar (m)'), num('fuseBoxLen', 'Busbar to fuse box (m)'), num('chargeLen', 'Chargers to busbar (m)')),
      lab('Cable'), chips('cable', Object.entries(PLAN_CABLES).map(([k, c]) => [k, c.label]), 'small'),
      lab('How the cables run'), chips('install', [['clipped', 'Clipped / free air'], ['bundled', 'Bundled in a loom or conduit']], 'small'),
      lab('Hottest it gets round the cables'), chips('ambient', [['30', '30 °C'], ['40', '40 °C'], ['50', '50 °C']], 'small'),
      lab('Volt drop target for the main, inverter and charger cables'), chips('mainPct', [['1', '1%'], ['2', '2%'], ['3', '3%']], 'small'),
      h('p', { class: 'note' }, 'Loads are sized for 3% drop, or 10% where you tick it (lighting and other non-critical loads).')),
    h('div', { class: 'btns full' }, h('button', { class: 'btn', onclick: () => { Object.assign(v, clone(VAN_EXAMPLE)); save(); toast('Camper van example loaded'); } }, 'Load camper van example'),
      h('button', { class: 'btn', onclick: () => { Object.assign(v, clone(PLAN_DEFAULTS)); v.loads = []; save(); } }, 'Start again')));

  const draw = () => {
    const p = planDC(v);
    const R = (r, label) => r ? line(r.ok, `${label}: ${r.fuse ? r.fuse.A + ' A ' + r.fuse.label : 'fuse ?'}, ${r.size ? r.size + ' mm²' : 'no cable size fits'}${r.vd ? ` (${r.vd.pct}% drop)` : ''}`, r.why) : null;
    const bad = p.warnings.length > 0 || p.runs.some((r) => !r.ok);
    fill(top, h('div', { class: 'card calcsum nostick ' + (bad ? 'bad' : 'good') },
      h('div', { class: 'calchead' }, `${p.V} V ${p.battery.label}`, h('span', { class: 'note' }, ` · ${p.daily.wh} Wh a day`)),
      line(p.battery.ok, `Battery: ${p.battery.needAh} Ah needed${p.battery.fittedAh ? `, ${p.battery.fittedAh} Ah fitted (${p.battery.fittedDays} days)` : ` (about ${p.battery.suggestAh} Ah)`}`, p.battery.why),
      p.inverter ? line(p.inverter.small ? false : true, `Inverter: ${p.inverter.w} W, ${p.inverter.current} A from the battery`, p.inverter.why) : null,
      p.solar ? line(p.solar.pv ? p.solar.pv.vocOk : null, `Solar: ${p.solar.w} W → MPPT ${p.solar.mpptV} V / ${p.solar.mppt} A`, p.solar.why + (p.solar.pv && p.solar.pv.cold ? ` ${p.solar.pv.series} in series: cold-morning Voc ${p.solar.pv.cold} V at ${v.tmin} °C ${p.solar.pv.vocOk ? '≤' : '>'} ${p.solar.mpptV} V${p.solar.pv.seriesAuto ? ' (most in series that fits)' : ''}.` : ' Add the panel Voc to check the controller\u2019s max PV voltage.')) : null,
      p.dcdc ? line(!p.dcdc.tooBig, `DC-DC: ${p.dcdc.a} A`, p.dcdcAdvice) : line(null, 'DC-DC: none', p.dcdcAdvice),
      p.main ? line(p.main.ok, `Main: ${p.main.fuse ? p.main.fuse.A + ' A ' + p.main.fuse.label : '?'}, ${p.main.size ?? '?'} mm², ${p.isolator.a} A isolator, ${p.shunt.a} A shunt`, p.main.why) : null,
      p.warnings.map((w) => h('div', { class: 'notice amber', style: 'margin:6px 0 0' }, '⚠ ' + w))));
    const groups = p.parts.map((g) => h('div', { class: 'partgroup' }, h('h3', {}, g.group), h('ul', { class: 'parts' }, g.items.map((it) => h('li', {}, h('span', {}, it.item), it.qty !== 1 ? h('b', {}, typeof it.qty === 'string' ? it.qty : '× ' + it.qty) : null)))));
    fill(work,
      h('div', { class: 'card', id: 'runs' }, h('h2', {}, 'Cables and fuses'),
        h('table', { class: 'calctab runs' }, h('tr', {}, ['Run', 'A', 'Fuse', 'mm²', 'Drop'].map((t) => h('th', {}, t))),
          p.runs.map((r) => h('tr', {}, h('td', {}, r.name), h('td', {}, r.peak > r.current ? `${r.current} (${r.peak})` : r.current), h('td', {}, r.fuse ? r.fuse.A : '?'), h('td', { class: r.size ? '' : 'bad' }, r.size ?? '✗'), h('td', { class: r.vd && r.vd.pct <= r.pct ? '' : 'bad' }, r.vd ? r.vd.pct + '%' : '–')))),
        h('p', { class: 'note' }, 'A (peak) · fuse ≥ 1.25 × peak · cable rated ≥ the fuse · drop at the working current, + and − cables together. Tap a line below for why.'),
        p.runs.map((r) => h('details', { class: 'why' }, h('summary', {}, r.name), h('p', { class: 'note' }, r.why)))),
      h('div', { class: 'card', id: 'parts' }, h('h2', {}, 'Parts list'), groups,
        h('div', { class: 'btns full' },
          h('button', { class: 'btn primary', onclick: () => sharePdf(p) }, 'PDF'),
          h('button', { class: 'btn', onclick: () => shareText(p) }, 'Share as text'),
          h('button', { class: 'btn', onclick: () => saveToJob(v, p) }, 'Save to a job'))),
      h('div', { class: 'card' }, h('h2', {}, 'Other things to sort'),
        h('ul', { class: 'note' }, p.notes.map((n) => h('li', {}, n)), p.inverter ? h('li', {}, p.inverter.surge) : null, h('li', {}, p.chassis.why), p.shunt ? h('li', {}, 'Shunt: ' + p.shunt.why) : null, p.busbar ? h('li', {}, 'Busbars: ' + p.busbar.why) : null)),
      h('div', { class: 'card' }, h('h2', {}, 'Where the numbers come from'),
        h('ul', { class: 'note' },
          h('li', {}, `Cable ratings: ${PLAN_CABLES[p.cable].note} Factors: ambient ${p.ambient} °C × ${p.ca} (Table 4B1)${p.cg < 1 ? `, bundled × ${p.cg} (Table 4C1, 3 circuits)` : ''}. Smallest size 1.5 mm². Thin-wall automotive cable (FLRY) is rated by its maker: don\u2019t use these figures for it.`),
          h('li', {}, 'Volt drop: copper resistance at 70 °C, out and back (+ and −), as % of the system voltage. Loads 3% (10% where ticked); the battery-to-busbar, inverter and charger cables use the target you pick; fuse box feed 1%; DC-DC input 5%.'),
          h('li', {}, 'Fuses: at least 1.25 × the current (peak for loads); cable rated at least the fuse. Blade up to 30 A, then MIDI, MEGA / ANL; Class T for the LiFePO4 main fuse. ⚠ Size ranges are typical makers\u2019 ranges.'),
          h('li', {}, `Inverter current = W ÷ (lowest battery voltage ${p.inverter ? p.inverter.vlow + ' V' : '(11.5 V per 12 V for LiFePO4, 11 V for lead)'} × 90%). 230 V loads use 90% inverter efficiency for daily energy; the inverter\u2019s own idle draw (often 5–20 W) isn\u2019t counted.`),
          h('li', {}, 'MPPT current = solar W ÷ battery V × 1.25. Cold Voc uses the same sum as the Solar / battery checks. ⚠ Solar yield is a rough UK figure (4 h summer, 0.7 h winter, × 0.8).'),
          h('li', {}, 'DC-DC: up to about 50% of a LiFePO4 battery\u2019s Ah (20% AGM, 15% lead) and about a quarter of the alternator: ⚠ rules of thumb. Check the battery and charger makers.'),
          h('li', {}, 'Lengths in the parts list are red + black for each run, + 10%, rounded up to 0.5 m.'))),
      h('div', { class: 'notice amber' }, SAFETY[0], ' ', SAFETY[2]));
  };
  drawForm(); draw();
  page('Calculators', [calcTabs('dc'), dcSubTabs('plan'), top, form, work], { back: '#/' });
});

async function sharePdf(p, name = 'DC system plan') {
  try { const { dcPlanPdf } = await import('./dcplanpdf.js'); const blob = await dcPlanPdf(p, { title: name, profile: await getProfile() });
    const r = await modal('DC system plan PDF', h('p', {}, 'View it here, or share / save it.'), [{ label: 'Close', value: null }, { label: 'View', value: 'view' }, { label: 'Share', value: 'share', cls: 'primary' }]);
    if (r === 'view') (await import('./pdfview.js')).viewPdf(blob, fileName(name));
    if (r === 'share') shareOrDownload(blob, fileName(name));
  } catch (e) { toast(e.message || 'Could not make the PDF'); }
}
const fileName = (name) => (name || 'DC-system-plan').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') + '.pdf';
async function shareText(p, name = 'DC system plan') {
  const text = planText(p, name);
  if (navigator.share) { try { await navigator.share({ title: name, text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text); toast('Copied: paste it into a message or note'); } catch { shareOrDownload(new Blob([text], { type: 'text/plain' }), fileName(name).replace(/\.pdf$/, '.txt')); }
}
async function saveToJob(v, p) {
  const jobs = (await db.all('jobs')).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  if (!jobs.length) return toast('Make a job first, then save the plan to it');
  const sel = h('select', {}, jobs.map((j) => h('option', { value: j.id }, j.title || 'Job')));
  const nm = h('input', { value: `DC plan ${p.V} V ${p.battery.fittedAh || p.battery.suggestAh} Ah`, placeholder: 'Plan name' });
  const pdf = h('input', { type: 'checkbox', checked: true });
  const r = await modal('Save to a job', h('div', {}, h('label', { class: 'f' }, h('span', {}, 'Job'), sel), h('label', { class: 'f' }, h('span', {}, 'Name'), nm), h('label', { class: 'check' }, pdf, 'Also save the PDF with the job')), [{ label: 'Cancel', value: false }, { label: 'Save', value: true, cls: 'primary' }]);
  if (!r) return;
  const job = await db.get('jobs', sel.value); if (!job) return;
  const now = new Date().toISOString();
  const entry = { id: db.newId(), name: nm.value.trim() || 'DC plan', savedAt: now, inputs: clone(v), summary: { volts: p.V, wh: p.daily.wh, ah: p.battery.fittedAh || p.battery.suggestAh, inverterW: p.inverter ? p.inverter.w : 0 } };
  job.dcPlans = [...(job.dcPlans || []), entry]; job.updatedAt = now; job.version = (job.version || 0) + 1; await db.put('jobs', job);
  if (pdf.checked) { try { const { dcPlanPdf } = await import('./dcplanpdf.js'); const blob = await dcPlanPdf(p, { title: entry.name, profile: await getProfile() }); await db.put('files', { id: db.newId(), jobId: job.id, kind: 'pdf', name: fileName(entry.name), blob, createdAt: now, version: 1, dcPlanId: entry.id }); } catch (e) { toast('Plan saved, but the PDF failed: ' + (e.message || e)); } }
  toast('Saved to ' + (job.title || 'the job'));
}
// Job page card: the DC plans saved with this job.
export function dcPlansCard(job, save, rerender) {
  if (!(job.dcPlans && job.dcPlans.length)) return null;
  return h('div', { class: 'card' }, h('h2', {}, 'DC system plans'),
    h('div', { class: 'list' }, job.dcPlans.map((d) => h('div', { class: 'row pdfrow' }, h('div', { class: 'main' }, h('div', { class: 't' }, d.name), h('div', { class: 's' }, `${d.summary ? `${d.summary.volts} V · ${d.summary.ah} Ah · ${d.summary.wh} Wh/day · ` : ''}saved ${new Date(d.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`)),
      h('button', { class: 'btn small', onclick: () => { storePlanInputs({ ...PLAN_DEFAULTS, ...clone(d.inputs || {}) }); go('#/calc/dc/plan'); } }, 'Open'),
      h('button', { class: 'btn small warn', 'aria-label': 'Delete ' + d.name, onclick: async () => { job.dcPlans = job.dcPlans.filter((x) => x.id !== d.id); await save(); rerender(); } }, 'Delete')))));
}
