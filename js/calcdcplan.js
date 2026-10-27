// calcdcplan.js — "DC system planner" (Calculators → DC system planner).
// v0.7: a step-by-step wizard (System → Loads → Charging → Inverter → Cable
// runs → Results). Same inputs object as v0.6 (localStorage sparky.dcplan1 and
// job.dcPlans[].inputs), so saved plans open as before. Layout only; the sums
// are all planDC() in dcplan.js. Connections + wiring diagram: dcwire.js.
import { INV_EFF } from './dcplan.js';
import { h, fill, toast, modal, shareOrDownload } from './ui.js';
import { route, page, go } from './app.js';
import * as db from './db.js';
import { getProfile } from './state.js';
import { planDC, planText, PLAN_DEFAULTS, VAN_EXAMPLE, QUICK_LOADS, quickLoad, CHEMS, PLAN_CABLES, SAFETY, PV_LAYOUTS, ALT_DEFAULT, MAX_FUSE, ISOLATOR_SIZES, SHUNT_SIZES, ampsOr, mpptText } from './dcplan.js';
import { connections, wiringModel, wiringSvg, connectionText, cSize } from './dcwire.js';
import { setLastCalc, formKit, icard, more, fold, banner, resline, pchip } from './calckit.js';
import { icon } from './icons.js';

const KEY = 'sparky.dcplan1';
// v0.35: '2 in parallel', not '1 in series', when the panels are paralleled (matches the diagram).
const pvLayoutText = (pv) => (pv.strings === 1 ? (pv.series > 1 ? `${pv.series} in series` : '1 panel') : pv.series === 1 ? `${pv.strings} in parallel` : `${pv.series} series × ${pv.strings} parallel`);
export const dcSubTabs = () => null; // v0.6 tabs, replaced by the Calculators home in v0.7
export const loadPlanInputs = () => { try { return { ...PLAN_DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || 'null') || {}) }; } catch { return { ...PLAN_DEFAULTS }; } };
export const storePlanInputs = (v) => localStorage.setItem(KEY, JSON.stringify(v));
const clone = (o) => JSON.parse(JSON.stringify(o));
export const STEPS = [['system', 'System'], ['loads', 'Loads'], ['charging', 'Charging'], ['inverter', 'Inverter'], ['cables', 'Cable runs'], ['results', 'Results']];
const QUICK_IC = { lights: 'sun', fridge: 'layers', pump: 'zap', sockets: 'zap', heater: 'zap', fan: 'zap', laptop: 'fileText', kettle: 'zap', ac: 'zap' };
const shortName = (n) => n.replace(' (via inverter)', '').replace(' (230 V via inverter)', '');

// What to do about each warning planDC() can give.
export function warningTodo(w) {
  if (/^Inverter .*less than/.test(w)) return 'Pick a bigger inverter in step 4, or take some 230 V things off in step 2.';
  if (/^Solar: cold-morning Voc/.test(w)) return 'Put fewer panels in series (step 3 → Solar → More options), or use a controller with a higher max PV voltage.';
  if (/^Solar: the string voltage on a hot day/.test(w)) return 'Step 3 → Solar → More options → panels in series.';
  if (/^Solar: your .*controller/.test(w)) return 'Fit the bigger controller, or live with losing a bit of charge on the sunniest days.';
  if (/BMS/.test(w)) return 'Pick a battery with a bigger BMS rating, or don\u2019t run everything at once.';
  if (/^All chargers at once/.test(w)) return 'Check the battery\u2019s data sheet allows that much charge current, or fit smaller chargers.';
  if (/^DC-DC: it draws/.test(w)) return 'Fit a smaller DC-DC charger (step 3), or put in your alternator\u2019s real rating (step 3 → DC-DC → More options). Check its label or the van handbook.';
  if (/no standard (fuse|isolator)|biggest .* (shunt|busbar)|needs more than .* mm²/.test(w)) return 'Go up to 24 or 48 V in step 1 (half or a quarter of the current), or fit a smaller inverter in step 4.';
  if (/^Solar: .* over the biggest/.test(w)) return 'Split the panels across 2 controllers, or go up a voltage in step 1.';
  if (/^Battery:/.test(w)) return 'Fit a bigger battery (step 1), use less each day (step 2), or plan for fewer days without charging.';
  return '';
}

route(/^\/calc\/dc\/plan(?:\/(\w+))?$/, async (stepArg) => {
  setLastCalc('plan'); localStorage.setItem('sparky.dcsub', 'plan');
  const step = STEPS.some(([k]) => k === stepArg) ? stepArg : (STEPS.some(([k]) => k === localStorage.getItem('sparky.dcstep')) ? localStorage.getItem('sparky.dcstep') : 'system');
  if (stepArg !== step) history.replaceState(null, '', '#/calc/dc/plan/' + step);
  localStorage.setItem('sparky.dcstep', step);
  const idx = STEPS.findIndex(([k]) => k === step);
  const v = loadPlanInputs(); v.loads = (v.loads || []).map((l) => ({ ...l }));
  const body = h('div'); const live = h('div', { class: 'wizlive' });
  const save = () => { storePlanInputs(v); draw(); };
  const set = (k, val) => {
    // v0.35: swap the battery size between Ah and kWh, keeping the same battery.
    if (k === 'battUnit' && val !== v.battUnit) { const p0 = planDC(v); if (val === 'kwh') { v.battKwh = p0.battery.fittedAh ? String(p0.battery.kwh) : ''; v.battAh = ''; } else { v.battAh = p0.battery.fittedAh ? String(p0.battery.fittedAh) : ''; v.battKwh = ''; } }
    v[k] = val; save(); };
  const F = formKit(v, set);
  const setLoad = (i, k, val) => { v.loads[i][k] = val; save(); };
  // On/off and "I already have one" switches stash the value so switching back brings it back.
  const off = () => (v._off ||= {});
  const toggle = (keys, on, dflt = {}) => { for (const k of keys) { if (on) { v[k] = off()[k] || dflt[k] || ''; delete off()[k]; } else { if (v[k]) off()[k] = v[k]; v[k] = ''; } } save(); };
  const sw = (on, label, onchange, hint = '') => h('div', { class: 'swrow' }, h('div', { class: 'swt' }, h('div', { class: 'swl' }, label), hint ? h('div', { class: 'help' }, hint) : null),
    h('button', { class: 'switch' + (on ? ' on' : ''), type: 'button', role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': label, onclick: () => onchange(!on) }, h('span', {})));
  const have = (key, { auto, mine, unit, hint, dflt }) => {
    const isHave = String(v[key] ?? '').trim() !== '' || (v._have || {})[key];
    return h('div', { class: 'f fld2' },
      h('div', { class: 'chips seg2' }, h('button', { class: 'chip' + (!isHave ? ' on' : ''), type: 'button', onclick: () => { (v._have ||= {})[key] = false; toggle([key], false); } }, auto),
        h('button', { class: 'chip' + (isHave ? ' on' : ''), type: 'button', onclick: () => { (v._have ||= {})[key] = true; toggle([key], true, { [key]: dflt }); } }, 'I already have one')),
      isHave ? F.num(key, mine, { unit, hint }) : null);
  };

  const stepper = () => h('nav', { class: 'stepper', 'aria-label': 'Steps' }, STEPS.map(([k, t], i) => h('a', { class: 'stp' + (i === idx ? ' on' : '') + (i < idx ? ' done' : ''), href: '#/calc/dc/plan/' + k, 'aria-current': i === idx ? 'step' : null },
    h('span', { class: 'stpn' }, i < idx ? icon('check', { size: 14 }) : String(i + 1)), h('span', { class: 'stpt' }, t))));
  const navBar = () => h('div', { class: 'wiznav' },
    idx > 0 ? h('a', { class: 'btn noic', href: '#/calc/dc/plan/' + STEPS[idx - 1][0] }, '‹ Back') : h('a', { class: 'btn noic', href: '#/calc' }, '‹ Calculators'),
    idx < STEPS.length - 1 ? h('a', { class: 'btn primary noic', href: '#/calc/dc/plan/' + STEPS[idx + 1][0] }, idx === STEPS.length - 2 ? 'See results ›' : 'Next ›') : h('a', { class: 'btn noic', href: '#/calc/dc/plan/system' }, 'Edit from step 1'));

  // v0.35.1: battery sizing lives with the other battery settings on System (it still sizes from the loads).
  const battBlock = (p) => [v.battUnit === 'kwh' && (v._have || {}).battAh
        ? h('div', { class: 'f fld2' }, h('div', { class: 'chips seg2' }, h('button', { class: 'chip', type: 'button', onclick: () => { (v._have ||= {}).battAh = false; v.battKwh = ''; v.battAh = ''; save(); } }, `Size for me${p.battery.suggestAh ? ` (${p.battery.suggestAh} Ah · ${p.battery.suggestKwh} kWh)` : ''}`), h('button', { class: 'chip on', type: 'button' }, 'I already have one')),
          F.num('battKwh', 'Your battery', { unit: 'kWh', hint: `= ${p.battery.fittedAh || '?'} Ah at ${p.battery.nomV} V nominal. You need about ${p.battery.needKwh} kWh (${p.battery.needAh} Ah).` }))
        : have('battAh', { auto: `Size for me${p.battery.suggestAh ? ` (${p.battery.suggestAh} Ah · ${p.battery.suggestKwh} kWh)` : ''}`, mine: 'Your battery', unit: 'Ah', hint: `You need about ${p.battery.needAh} Ah (${p.battery.needKwh} kWh) for what you\u2019ve put in.${p.battery.fittedAh ? ` Yours is ${p.battery.kwh} kWh at ${p.battery.nomV} V nominal.` : ''}`, dflt: String(p.battery.suggestAh || '') }),
        (v._have || {}).battAh || String(v.battAh || '').trim() || String(v.battKwh || '').trim() ? (v.battUnit ||= 'ah', F.seg('battUnit', 'Battery size in', [['ah', 'Ah'], ['kwh', 'kWh']], 'kWh = Ah × nominal volts ÷ 1000 (12.8 V per 12 V for LiFePO4).', 'small')) : null];
  const steps = {
    system: (p) => [
      icard('Your system', [
        F.seg('volts', 'System voltage', [['12', '12 V'], ['24', '24 V'], ['48', '48 V']], '12 V for most vans. 24 or 48 V for bigger systems: half or a quarter of the current, so thinner cables.'),
        F.seg('chem', 'Battery type', Object.entries(CHEMS).map(([k, c]) => [k, c.label]), 'LiFePO4 (lithium) is lighter and you can use about 80% of it. AGM and lead-acid: use about half if you want them to last.', 'small'),
        F.num('days', 'Days with no charging', { unit: 'days', hint: 'How long it has to last with no sun, no driving and no hook-up.' }),
        ...battBlock(p),
        more('dc-sys', [
          F.num('dod', 'Usable part of the battery (depth of discharge)', { unit: '%', ph: String(Math.round((CHEMS[v.chem] || CHEMS.lifepo4).dod * 100)), hint: `Blank = ${Math.round((CHEMS[v.chem] || CHEMS.lifepo4).dod * 100)}% for ${(CHEMS[v.chem] || CHEMS.lifepo4).label}.` }),
          F.num('bmsA', 'Battery BMS max continuous current', { unit: 'A', ph: 'data sheet', hint: 'BMS = the battery\u2019s own protection board. Optional: lets Zs Pro check it can feed everything at once.' })],
          `${v.dod || Math.round((CHEMS[v.chem] || CHEMS.lifepo4).dod * 100)}% usable${v.bmsA ? `, BMS ${v.bmsA} A` : ''}`)], { step: 1 }),
      h('div', { class: 'btns full' }, h('button', { class: 'btn', onclick: () => { Object.assign(v, clone(VAN_EXAMPLE)); delete v._off; delete v._have; save(); toast('Camper van example loaded'); } }, 'Load camper van example'),
        h('button', { class: 'btn', onclick: () => { Object.keys(v).forEach((k) => delete v[k]); Object.assign(v, clone(PLAN_DEFAULTS)); v.loads = []; save(); } }, 'Start again'))],

    loads: (p) => [
      icard('Add what you\u2019ll run', [
        h('p', { class: 'help', style: 'margin:0 0 10px' }, 'Tap to add. Typical figures are filled in: change them to suit.'),
        h('div', { class: 'quickgrid' }, QUICK_LOADS.map((q) => h('button', { class: 'quick' + (q.ac ? ' ac' : ''), type: 'button', onclick: () => { v.loads.push(quickLoad(q.key)); save(); toast(shortName(q.name) + ' added'); } },
          h('span', { class: 'qn' }, '+ ' + shortName(q.name)), h('span', { class: 'qs' }, `${q.w} W · ${q.hours} h a day${q.ac ? ' · 230 V' : ''}`)))),
        h('div', { class: 'btns full' }, h('button', { class: 'btn', onclick: () => { v.loads.push({ name: '', value: '', unit: 'W', hours: '', length: '', peak: '' }); save(); } }, `+ Other ${v.volts || 12} V thing`),
          h('button', { class: 'btn', onclick: () => { v.loads.push({ name: '', ac: true, value: '', unit: 'W', hours: '' }); save(); } }, '+ Other 230 V thing'))], { step: 2 }),
      icard(`Your loads (${v.loads.length})`, [
        v.loads.length ? null : h('p', { class: 'help' }, 'Nothing yet: add some above.'),
        v.loads.map((l, i) => h('div', { class: 'loadrow' + (l.ac ? ' ac' : '') },
          h('div', { class: 'loadtop' }, h('input', { class: 'lname', value: l.name || '', placeholder: 'What is it?', 'aria-label': 'Load name', onchange: (e) => setLoad(i, 'name', e.target.value) }),
            l.ac ? h('span', { class: 'tag ac' }, '230 V') : h('span', { class: 'tag' }, `${v.volts || 12} V`),
            h('button', { class: 'btn small warn ic', type: 'button', 'aria-label': 'Remove ' + (l.name || 'load'), onclick: () => { v.loads.splice(i, 1); save(); } }, icon('x', { size: 16 }))),
          h('div', { class: 'grid2' },
            h('label', { class: 'f fld2' }, h('span', {}, 'Power'), h('span', { class: 'withunit' }, h('input', { inputmode: 'decimal', value: l.value || '', onchange: (e) => setLoad(i, 'value', e.target.value.trim()) }), h('span', { class: 'unit' }, l.unit === 'A' && !l.ac ? 'A' : 'W'))),
            h('label', { class: 'f fld2' }, h('span', {}, 'Hours a day'), h('span', { class: 'withunit' }, h('input', { inputmode: 'decimal', value: l.hours || '', onchange: (e) => setLoad(i, 'hours', e.target.value.trim()) }), h('span', { class: 'unit' }, 'h')))),
          l.ac ? h('p', { class: 'help', style: 'margin:-4px 0 8px' }, 'Runs off the inverter (step 4).') : more('load-' + i, [
            h('div', { class: 'grid2' },
              h('label', { class: 'f fld2' }, h('span', {}, 'Peak / start-up'), h('span', { class: 'withunit' }, h('input', { inputmode: 'decimal', value: l.peak || '', placeholder: 'optional', onchange: (e) => setLoad(i, 'peak', e.target.value.trim()) }), h('span', { class: 'unit' }, l.unit === 'A' ? 'A' : 'W')), h('span', { class: 'help' }, 'Fuse and cable are sized for it')),
              h('div', { class: 'f fld2' }, h('span', { class: 'lab' }, 'Power in'), h('div', { class: 'chips small' }, ['W', 'A'].map((u) => h('button', { class: 'chip' + ((l.unit || 'W') === u ? ' on' : ''), type: 'button', onclick: () => setLoad(i, 'unit', u) }, u === 'W' ? 'Watts' : 'Amps'))))),
            h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!l.lighting, onchange: (e) => setLoad(i, 'lighting', e.target.checked) }), '10% volt drop is OK'), h('span', { class: 'help' }, 'Lighting and other things that don\u2019t mind a bit less voltage (the usual marine rule). Otherwise 3%.')],
            `${l.peak ? 'peak ' + l.peak + (l.unit === 'A' ? ' A' : ' W') : 'no peak'}, ${l.lighting ? '10%' : '3%'} drop`))),
        h('div', { class: 'help' }, 'Hours a day = how long it runs at that power. A fridge cycles on and off, so about 8 h on a warm day.')]),
      h('div', { class: 'tot' }, `That\u2019s ${p.daily.wh} Wh a day = ${p.daily.ah} Ah at ${p.V} V`)],

    charging: (p) => {
      const sOn = !!String(v.solarW || '').trim(), dOn = !!String(v.dcdcA || '').trim(), mOn = !!String(v.shoreA || '').trim();
      const dSug = (p.dcdcAdvice.match(/DC-DC: (\d+)/) || [])[1];
      return [
        h('p', { class: 'help steplead' }, 'Turn on the ways you\u2019ll charge the battery. All optional.'),
        icard('Solar panels', [
          sw(sOn, 'Solar on the roof', (on) => toggle(['solarW', 'panels'], on, { solarW: '200', panels: '1' }), 'Panels feed an MPPT = solar charge controller, which charges the battery.'),
          sOn ? [h('div', { class: 'grid2' }, F.num('solarW', 'Solar total', { unit: 'W', hint: 'All the panels added up' }), F.num('panels', 'How many panels', { hint: 'Same size panels' })),
            h('div', { class: 'f fld2' }, h('span', { class: 'lab' }, 'Solar controller (MPPT)'), have('mpptA', { auto: `Pick for me${p.solar && p.solar.mpptPick ? ` (${p.solar.mpptPick} A)` : ''}`, mine: 'Your controller\u2019s charge current', unit: 'A', hint: 'The amps on its label, e.g. 100/30 = 30 A.', dflt: String((p.solar && p.solar.mpptPick) || '') })),
            Number(v.panels) > 1 ? [F.seg('pvLayout', 'How the panels are wired', PV_LAYOUTS, 'Series adds the volts (thinner cable, check the cold-morning Voc). Parallel adds the amps (lower volts, thicker cable).', 'small'),
              v.pvLayout === 'custom' ? F.num('series', 'Panels in series', { hint: 'In each string' }) : null,
              p.solar && p.solar.pv ? h('div', { class: 'help' }, `${p.solar.pv.series} in series × ${p.solar.pv.strings} string${p.solar.pv.strings > 1 ? 's' : ''}: cold-morning Voc ${p.solar.pv.cold} V ${p.solar.pv.vocOk === false ? '> ' : '≤ '}${p.solar.mpptV} V controller max.`) : h('div', { class: 'help' }, 'Add the panel Voc under More options to check the cold-morning voltage.')] : null,
            more('dc-solar', [
              h('p', { class: 'help' }, 'From the panel\u2019s label or data sheet. Voc = open-circuit volts, Vmp = working volts, Isc = short-circuit amps.'),
              h('div', { class: 'grid3' }, F.num('panelVoc', 'Voc', { unit: 'V', ph: 'optional' }), F.num('panelVmp', 'Vmp', { unit: 'V' }), F.num('panelIsc', 'Isc', { unit: 'A' })),
              h('div', { class: 'grid2' }, F.num('mpptV', 'Controller max PV volts', { unit: 'V', hint: 'The first number: 100/30 = 100 V' })),
              h('div', { class: 'grid2' }, F.num('tmin', 'Coldest morning', { unit: '°C', hint: '−10 °C for the UK' }), F.num('coef', 'Voc coefficient', { unit: '%/°C', hint: 'Panel data sheet' }))],
              `${v.panelVoc ? 'Voc ' + v.panelVoc + ' V, ' : 'no panel figures, '}${v.mpptV || 100} V controller, ${v.tmin} °C, ${v.coef} %/°C`)] : null]),
        icard('Charging from the engine', [
          sw(dOn, 'DC-DC charger', (on) => toggle(['dcdcA'], on, { dcdcA: dSug || '30' }), 'Battery-to-battery charger: charges your second (leisure) battery from the alternator while you drive.'),
          dOn ? [F.num('dcdcA', 'DC-DC charger size', { unit: 'A', hint: `Suggested for your battery: ${dSug || '?'} A.` }),
            p.dcdc ? h('div', { class: 'help' }, `It draws about ${p.dcdc.inI} A from the alternator: ${Math.round(p.dcdc.altShare * 100)}% of ${p.dcdc.altAssumed ? `an assumed ${ALT_DEFAULT} A` : `your ${p.dcdc.altRated} A`} alternator. Zs Pro warns over 50%.`) : null,
            sw(!!v.smartAlt, 'Smart alternator (Euro 6)', (on) => set('smartAlt', on ? '1' : ''), 'Most vans from about 2015 on. Adds the ignition / D+ trigger wire the charger needs to the plan, parts list and diagram.'),
            more('dc-dcdc', [h('div', { class: 'grid2' }, F.num('altA', 'Alternator', { unit: 'A', ph: String(ALT_DEFAULT), hint: `Blank = ${ALT_DEFAULT} A assumed. On its label or in the handbook.` }), F.num('vehV', 'Vehicle battery', { unit: 'V', hint: 'Usually 12 V' })),
              v.smartAlt ? F.num('trigLen', 'Trigger wire length', { unit: 'm', hint: 'Ignition live or D+ to the charger' }) : null], `alternator ${v.altA || ALT_DEFAULT + ' (assumed)'} A, vehicle ${v.vehV || 12} V`)] : null]),
        icard('Charging from mains hook-up', [
          sw(mOn, 'Mains (shore) charger', (on) => toggle(['shoreA'], on, { shoreA: String(p.shoreSuggest || 20) }), 'Charges the battery when you\u2019re plugged into a campsite or house supply.'),
          mOn ? F.num('shoreA', 'Mains charger size', { unit: 'A', hint: `About ${p.shoreSuggest} A suits this battery.` }) : null]),
      ];
    },

    inverter: (p) => {
      const acW = p.acLoads.reduce((a, l) => a + l.w, 0);
      return [
        icard('Inverter (230 V from the battery)', [
          h('p', { class: 'help', style: 'margin-top:0' }, `An inverter turns the battery\u2019s ${p.V} V into 230 V for mains things like a laptop charger or a low-watt kettle.`),
          acW ? h('div', { class: 'tot inl' }, `Your 230 V things add up to ${acW} W`) : (v._have || {}).invW || String(v.invW || '').trim() ? h('p', { class: 'help' }, 'No 230 V things listed in step 2: add them there, or put the kWh a day below.') : h('p', { class: 'help' }, 'You\u2019ve no 230 V things in step 2, so you don\u2019t need one. Set a size below if you want one anyway.'),
          have('invW', { auto: acW ? `Size for me (${p.inverter && p.inverter.suggest ? p.inverter.suggest : '?'} W)` : 'No inverter', mine: 'Your inverter', unit: 'W', hint: 'Continuous rating (not the peak). Pure sine wave.', dflt: String((p.inverter && p.inverter.suggest) || 1000) }),
          p.inverter ? h('div', { class: 'grid2' },
            F.num('acKwh', '230 V use a day (if not listed as loads)', { unit: 'kWh', hint: `Taken from the battery ÷ ${INV_EFF * 100}% inverter efficiency. Leave blank if you added the 230 V loads in step 2.` }),
            F.num('invIdle', 'Inverter idle (no-load) draw', { unit: 'W', ph: String(p.daily.idleW), hint: `Blank = about ${p.daily.idleW} W. On the data sheet as no-load or standby power.` }),
            F.num('invHours', 'Hours a day the inverter is on', { unit: 'h', ph: '24', hint: `Idle draw ${p.daily.idleW} W × ${p.daily.idleH} h = ${p.daily.idleWh} Wh a day.` })) : null,
          p.daily.invNoUse ? h('p', { class: 'help warnline' }, 'Add what the inverter runs (or kWh a day) to see how long the battery lasts. Its rating is not daily use.') : null,
          p.inverter ? h('div', { class: 'help' }, `At full power it draws about ${p.inverter.current} A from the battery: its cable and fuse are sized for that.`) : null], { step: 4 })];
    },

    cables: (p) => {
      const len = (k, label, hint) => F.num(k, label, { unit: 'm', hint });
      return [
        icard('Main cable runs', [
          h('p', { class: 'help', style: 'margin-top:0' }, 'One-way lengths. Short is good: the defaults suit a small van.'),
          h('div', { class: 'grid2' }, len('mainLen', 'Battery to busbar', 'Through the main fuse and isolator'), p.inverter ? len('invLen', 'Busbar to inverter', 'Keep it short') : null),
          h('div', { class: 'grid2' }, p.dcLoads.length ? len('fuseBoxLen', 'Busbar to fuse box', '12 V fuse box for the loads') : null, (p.solar || p.dcdc || p.shore) ? len('chargeLen', 'Chargers to busbar', 'MPPT, DC-DC, mains charger') : null),
          h('div', { class: 'grid2' }, p.solar ? len('pvLen', 'Roof panels to MPPT', 'Solar PV cable') : null, p.dcdc ? len('dcdcLen', 'Starter battery to DC-DC', 'Often front to back of the van') : null),
          more('dc-cable', [
            F.seg('cable', 'Cable', Object.entries(PLAN_CABLES).map(([k, c]) => [k, c.label]), 'Tri-rated or tinned marine cable is the usual choice.', 'small'),
            F.seg('install', 'How the cables run', [['clipped', 'Clipped / free air'], ['bundled', 'Bundled in a loom or conduit']], 'Bundled cables run hotter, so they need to be bigger.', 'small'),
            F.seg('ambient', 'Hottest it gets round the cables', [['30', '30 °C'], ['40', '40 °C'], ['50', '50 °C']], 'Engine bays and under-floor near exhausts get hot.', 'small'),
            F.seg('mainPct', 'Volt drop for the main, inverter and charger cables', [['1', '1%'], ['2', '2%'], ['3', '3%']], 'Loads use 3%, or 10% where you ticked it.', 'small')],
            `${PLAN_CABLES[v.cable] ? PLAN_CABLES[v.cable].label.split(' singles')[0] : ''}, ${v.install === 'bundled' ? 'bundled' : 'clipped'}, ${v.ambient} °C, ${v.mainPct}% drop`)], { step: 5 }),
        p.dcLoads.length ? icard('Fuse box to each load', [
          h('div', { class: 'grid2' }, v.loads.map((l, i) => l.ac || !(Number(l.value) > 0) ? null : h('label', { class: 'f fld2' }, h('span', {}, shortName(l.name || `Load ${i + 1}`)), h('span', { class: 'withunit' }, h('input', { inputmode: 'decimal', value: l.length || '', placeholder: 'm', onchange: (e) => setLoad(i, 'length', e.target.value.trim()) }), h('span', { class: 'unit' }, 'm'))))),
          h('p', { class: 'help' }, 'Fuse box to the load, one way. Blank = no cable sized for it.')]) : null];
    },

    results: (p) => results(v, p),
  };

  const draw = () => {
    const p = planDC(v);
    fill(body, steps[step](p));
    fill(live, step === 'results' ? null : h('span', {}, icon('zap', { size: 14 }), ` ${p.daily.wh} Wh a day · battery ${p.battery.fittedAh ? p.battery.fittedAh + ' Ah (' + p.battery.kwh + ' kWh) fitted' : 'about ' + (p.battery.suggestAh || p.battery.needAh) + ' Ah (' + p.battery.kwh + ' kWh)'}${p.warnings.length ? ` · ${p.warnings.length} to check` : ''}`));
  };
  draw();
  page('DC system planner', [stepper(), h('h2', { class: 'wizt' }, `Step ${idx + 1} of ${STEPS.length} · ${STEPS[idx][1]}`), body, live, navBar()], { back: '#/calc' });
  document.querySelector('main')?.classList.add('haswiz');
});

// ---- Results ----
function results(v, p) {
  const conns = connections(p, v);
  const need = [
    ['Battery', `${p.V} V ${p.battery.fittedAh || p.battery.suggestAh || p.battery.needAh} Ah · ${p.battery.kwh} kWh ${p.battery.label.replace(' (lithium)', '')}`, p.battery.invNoUse && !p.daily.dcWh ? 'Add what the inverter runs (or kWh a day) to see how long the battery lasts' : p.battery.noLoads ? 'No loads entered yet. Add loads to see how long it lasts' : p.battery.fittedAh ? `Needs ${p.battery.needAh} Ah (${p.battery.needKwh} kWh): yours lasts about ${p.battery.fittedDays} days` : `Needs ${p.battery.needAh} Ah (${p.battery.needKwh} kWh) for ${p.battery.days} day${p.battery.days === 1 ? '' : 's'}`, p.battery.ok !== false],
    p.inverter ? ['Inverter', `${p.inverter.w} W pure sine`, `Up to ${p.inverter.current} A from the battery`, !p.inverter.small] : null,
    p.solar ? ['Solar controller (MPPT)', `${p.solar.mpptV} V / ${mpptText(p.solar)}`, `${p.solar.w} W of panels${p.solar.pv && p.solar.pv.cold ? ', ' + pvLayoutText(p.solar.pv) : ''}`, !(p.solar.pv && p.solar.pv.vocOk === false) && !(p.solar.mpptHave && p.solar.mpptHave < p.solar.needA) && !!p.solar.mppt] : null,
    p.solar ? ['Solar cable', p.solar.pvDrop ? `${p.solar.pvDrop.size} mm² PV cable` : '4 mm² PV cable', p.solar.pvDrop ? `Panels to controller: ${p.solar.pvDrop.current} A, drop ${p.solar.pvDrop.volts} V (${p.solar.pvDrop.pct}%, target ≤ 3%) at ${p.solar.pvDrop.vstring} V` : 'Add the panel Voc, Vmp and Isc (step 3) to work out the volt drop', true] : null,
    p.dcdc ? ['DC-DC charger', `${p.dcdc.a} A`, `About ${p.dcdc.inI} A from the alternator (${Math.round(p.dcdc.altShare * 100)}% of ${p.dcdc.altRated} A${p.dcdc.altAssumed ? ' assumed' : ''})${p.dcdc.smart ? '. Smart alternator: needs the trigger wire' : ''}`, !p.dcdc.tooBig] : null,
    p.shore ? ['Mains charger', `${p.shore.a} A`, '', true] : null,
    p.main ? ['Main fuse', p.main.fuse ? `${p.main.fuse.A} A ${p.main.fuse.label.replace(' fuse', '')}` : `Over ${MAX_FUSE} A: no standard fuse`, p.main.fuse ? 'At the battery positive' : 'Go up a voltage (24 or 48 V) or fit a smaller inverter', !!p.main.fuse] : null,
    p.main ? ['Main cable', p.main.size ? `${p.main.size} mm²` : 'Over 120 mm²: no single cable fits', `${p.cableLabel.split(' singles')[0]}, red + black`, !!p.main.size] : null,
    p.main ? ['Isolator & shunt', `${(t => t[0].toUpperCase() + t.slice(1))(ampsOr(p.isolator.a, ISOLATOR_SIZES))} isolator · ${ampsOr(p.shunt.a, SHUNT_SIZES)} shunt`, p.isolator.a && p.shunt.a ? 'Shunt = battery monitor sensor, on the negative' : 'No standard size that big: go up a voltage (24 or 48 V)', !!(p.isolator.a && p.shunt.a)] : null,
  ].filter(Boolean);
  const bad = p.warnings.length > 0 || p.runs.some((r) => !r.ok);
  const svg = wiringSvg(wiringModel(p, v));
  const groups = p.parts.map((g) => h('div', { class: 'partgroup' }, h('h3', {}, g.group), h('ul', { class: 'parts' }, g.items.map((it) => h('li', {}, h('span', {}, it.item), it.qty !== 1 ? h('b', {}, typeof it.qty === 'string' ? it.qty : '× ' + it.qty) : null)))));
  const conn = (c, i) => h('li', { class: 'conn' + (c.ok === false ? ' bad' : '') },
    h('div', { class: 'cn' }, String(i + 1)),
    h('div', { class: 'cb' },
      h('div', { class: 'cpath' }, [c.from, ...(c.via || []), c.to].map((x, j) => [j ? h('span', { class: 'arr' }, '→') : null, h('span', {}, x)])),
      c.ac ? null : h('div', { class: 'cspec' }, c.size ? h('b', {}, `${c.size} mm²`) : h('b', { class: 'badt' }, cSize(c)), ` ${c.colour}`, c.length ? ` · ${c.length} m` : '', c.vd != null ? ` · ${c.vd}% drop` : ''),
      c.fuse ? h('div', { class: 'cfuse' }, icon('zap', { size: 14 }), h('span', {}, h('b', {}, c.fuse.text), ' — ' + c.fuse.where)) : null,
      c.note ? h('div', { class: 'help' }, c.note) : null));
  return [
    h('div', { class: 'card anscard needcard ' + (bad ? 'warn' : 'good') },
      h('div', { class: 'ans-k' }, 'What you need'),
      h('div', { class: 'needlist' }, need.map(([k, val, sub, ok]) => h('div', { class: 'need' + (ok ? '' : ' bad') }, h('div', { class: 'nk' }, k), h('div', { class: 'nv' }, val), sub ? h('div', { class: 'ns' }, sub) : null))),
      h('div', { class: 'pchips' }, p.battery.noLoads ? h('a', { class: 'pchip warn', href: '#/calc/dc/plan/loads' }, '0 Wh a day: add loads') : pchip(null, `${p.daily.wh} Wh a day`), p.battery.noLoads ? null : pchip(p.battery.ok === false ? 'warn' : true, `${p.battery.fittedDays ?? p.battery.days} days off-grid`), pchip(p.runs.every((r) => r.ok), `${p.runs.length} cable runs`))),
    p.warnings.map((w) => banner(w, warningTodo(w))),
    h('div', { class: 'card conncard' }, h('h2', {}, 'Connections, in order'),
      h('p', { class: 'help', style: 'margin-top:0' }, 'Every link between the kit: cable, length, fuse and where it goes. Red = positive, black = negative.'),
      h('ol', { class: 'conns' }, conns.map(conn))),
    h('div', { class: 'card' }, fold('dc-diagram', 'Wiring diagram', [h('div', { class: 'wiring' + (localStorage.getItem('sparky.wzoom') === '1' ? ' zoom' : ''), html: svg }), h('div', { class: 'btns' }, h('button', { class: 'btn small noic', type: 'button', onclick: (e) => { const w = e.target.closest('.foldin').querySelector('.wiring'); const z = w.classList.toggle('zoom'); localStorage.setItem('sparky.wzoom', z ? '1' : '0'); e.target.textContent = z ? 'Fit to screen' : 'Make it bigger'; } }, localStorage.getItem('sparky.wzoom') === '1' ? 'Fit to screen' : 'Make it bigger')), h('p', { class: 'help' }, 'A layout guide, not to scale. Fuses sit at the busbar end of each positive unless it says otherwise.')], { open: true })),
    h('div', { class: 'card foldcard' }, fold('dc-runs', 'Cables & fuses', [
      h('table', { class: 'calctab runs' }, h('tr', {}, ['Run', 'A', 'Fuse', 'mm²', 'Drop'].map((t) => h('th', {}, t))),
        p.runs.map((r) => h('tr', {}, h('td', {}, r.name), h('td', {}, r.peak > r.current ? `${r.current} (${r.peak})` : r.current), h('td', { class: r.fuse ? '' : 'bad' }, r.fuse ? r.fuse.A : `>${MAX_FUSE}`), h('td', { class: r.size ? '' : 'bad' }, r.size ?? '✗'), h('td', { class: r.vd && r.vd.pct <= r.pct ? '' : 'bad' }, r.vd ? r.vd.pct + '%' : '–')))),
      h('p', { class: 'note' }, 'A (peak) · fuse ≥ 1.25 × peak · cable rated ≥ the fuse · drop at the working current, + and − cables together.')], { badge: h('span', { class: 'fbadge' }, String(p.runs.length)) })),
    h('div', { class: 'card' }, h('h2', {}, 'Charger settings'),
      h('p', { class: 'help', style: 'margin-top:0' }, `For ${p.profile.name} at ${p.V} V. Set the ${[p.solar ? 'solar controller (MPPT)' : '', p.dcdc ? 'DC-DC charger' : '', p.shore ? 'mains charger' : ''].filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' and $1') || 'chargers'} to match.`),
      h('div', { class: 'needlist' }, [['Absorption (boost)', p.profile.absorb, p.profile.absorbTime], ['Float', p.profile.float, ''], ['Equalise', p.profile.equalise || 'Off', p.profile.equalise ? 'Now and then only' : ''], ['Temperature compensation', p.profile.tempComp ? `${p.profile.tempComp} mV/°C` : 'Off', '']].map(([k, val, sub]) => h('div', { class: 'need' }, h('div', { class: 'nk' }, k), h('div', { class: 'nv' }, val), sub ? h('div', { class: 'ns' }, sub) : null))),
      h('ul', { class: 'note' }, p.profile.extra.map((t) => h('li', {}, t)), h('li', {}, '⚠ Typical figures: the battery maker\u2019s data sheet wins.'))),
    h('div', { class: 'card foldcard' }, fold('dc-parts', 'Parts list', [groups, h('div', { class: 'btns' }, h('button', { class: 'btn small', type: 'button', onclick: () => sharePartsPdf(p) }, 'Parts list PDF'))], { badge: h('span', { class: 'fbadge' }, String(p.parts.reduce((a, g) => a + g.items.length, 0))) })),
    h('div', { class: 'card foldcard' }, fold('dc-why', 'Why (the reasons)', [
      resline(p.battery.ok, 'Battery', p.battery.why),
      p.inverter ? resline(!p.inverter.small, 'Inverter', p.inverter.why) : null,
      p.solar ? resline(p.solar.pv ? p.solar.pv.vocOk : null, 'Solar controller', p.solar.why + (p.solar.pv && p.solar.pv.cold ? ` ${p.solar.pv.series} in series: cold-morning Voc ${p.solar.pv.cold} V at ${v.tmin} °C ${p.solar.pv.vocOk ? '≤' : '>'} ${p.solar.mpptV} V${p.solar.pv.seriesAuto ? ' (most in series that fits)' : ''}.` : ' Add the panel Voc to check the controller\u2019s max PV voltage.')) : null,
      resline(p.dcdc ? !p.dcdc.tooBig : null, 'DC-DC', p.dcdcAdvice),
      p.main ? resline(p.main.ok, 'Main fuse and cable', p.main.why) : null,
      p.shunt ? resline(null, 'Shunt', p.shunt.why) : null, p.busbar ? resline(null, 'Busbars', p.busbar.why) : null,
      p.runs.map((r) => h('details', { class: 'why' }, h('summary', {}, r.name), h('p', { class: 'note' }, r.why))),
      h('h3', { class: 'subh' }, 'Where the numbers come from'),
      h('ul', { class: 'note' },
        h('li', {}, `Cable ratings: ${PLAN_CABLES[p.cable].note} Factors: ambient ${p.ambient} °C × ${p.ca} (Table 4B1)${p.cg < 1 ? `, bundled × ${p.cg} (Table 4C1, 3 circuits)` : ''}. Smallest size 1.5 mm². Thin-wall automotive cable (FLRY) is rated by its maker: don\u2019t use these figures for it.`),
        h('li', {}, 'Volt drop: copper resistance at 70 °C, out and back (+ and −), as % of the system voltage. Loads 3% (10% where ticked); the battery-to-busbar, inverter and charger cables use the target you pick; fuse box feed 1%; DC-DC input 5%.'),
        h('li', {}, 'Fuses: at least 1.25 × the current (peak for loads); cable rated at least the fuse. Blade up to 30 A, then MIDI, MEGA / ANL; Class T for the LiFePO4 main fuse. ⚠ Size ranges are typical makers\u2019 ranges.'),
        h('li', {}, `Inverter current = W ÷ (lowest battery voltage ${p.inverter ? p.inverter.vlow + ' V' : '(11.5 V per 12 V for LiFePO4, 11 V for lead)'} × 90%). 230 V loads use 90% inverter efficiency for daily energy; the inverter\u2019s own idle draw (often 5–20 W) isn\u2019t counted.`),
        h('li', {}, 'MPPT current = solar W ÷ battery V × 1.25. Cold Voc uses the same sum as the Solar / battery checks. ⚠ Solar yield is a rough UK figure (4 h summer, 0.7 h winter, × 0.8).'),
        h('li', {}, 'DC-DC: up to about 50% of a LiFePO4 battery\u2019s Ah (20% AGM, 15% lead) and about a quarter of the alternator suggested; a warning shows when the charger\u2019s input current is over half the alternator rating (120 A assumed if blank): ⚠ rules of thumb. Check the battery and charger makers.'),
        h('li', {}, 'Lengths in the parts list are red + black for each run, + 10%, rounded up to 0.5 m.'))])),
    h('div', { class: 'card foldcard' }, fold('dc-safety', 'Safety notes', [
      h('ul', { class: 'note' }, p.notes.map((n) => h('li', {}, n)), p.inverter ? h('li', {}, p.inverter.surge) : null, h('li', {}, p.chassis.why), SAFETY.map((n) => h('li', {}, n)))])),
    h('div', { class: 'card' }, h('h2', {}, 'Share or save'),
      h('div', { class: 'btns full' },
        h('button', { class: 'btn primary', onclick: () => sharePdf(p, 'DC system plan', v) }, 'PDF'),
        h('button', { class: 'btn', onclick: () => shareText(p, 'DC system plan', v) }, 'Share as text'),
        h('button', { class: 'btn', onclick: () => saveToJob(v, p) }, 'Save to a job'))),
  ];
}

async function sharePdf(p, name = 'DC system plan', inputs = {}) {
  try { const { dcPlanPdf } = await import('./dcplanpdf.js'); const blob = await dcPlanPdf(p, { title: name, profile: await getProfile(), inputs });
    const r = await modal('DC system plan PDF', h('p', {}, 'View it here, or share / save it.'), [{ label: 'Close', value: null }, { label: 'View', value: 'view' }, { label: 'Share', value: 'share', cls: 'primary' }]);
    if (r === 'view') (await import('./pdfview.js')).viewPdf(blob, fileName(name));
    if (r === 'share') shareOrDownload(blob, fileName(name));
  } catch (e) { toast(e.message || 'Could not make the PDF'); }
}
// v0.35: the DC parts list on its own (fuses, isolators, busbars, cables…), as the AC parts list.
async function sharePartsPdf(p) {
  try { const { dcPartsPdf } = await import('./dcplanpdf.js'); const blob = await dcPartsPdf(p, { profile: await getProfile() });
    const r = await modal('DC parts list PDF', h('p', {}, 'View it here, or share / save it.'), [{ label: 'Close', value: null }, { label: 'View', value: 'view' }, { label: 'Share', value: 'share', cls: 'primary' }]);
    if (r === 'view') (await import('./pdfview.js')).viewPdf(blob, 'DC-parts-list.pdf');
    if (r === 'share') shareOrDownload(blob, 'DC-parts-list.pdf');
  } catch (e) { toast(e.message || 'Could not make the PDF'); }
}
const fileName = (name) => (name || 'DC-system-plan').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') + '.pdf';
async function shareText(p, name = 'DC system plan', inputs = {}) {
  const text = planText(p, name) + '\n\nCONNECTIONS (in order)\n' + connections(p, inputs).map((c, i) => `${i + 1}. ${connectionText(c)}`).join('\n');
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
  if (pdf.checked) { try { const { dcPlanPdf } = await import('./dcplanpdf.js'); const blob = await dcPlanPdf(p, { title: entry.name, profile: await getProfile(), inputs: v }); await db.put('files', { id: db.newId(), jobId: job.id, kind: 'pdf', name: fileName(entry.name), blob, createdAt: now, version: 1, dcPlanId: entry.id }); } catch (e) { toast('Plan saved, but the PDF failed: ' + (e.message || e)); } }
  toast('Saved to ' + (job.title || 'the job'));
}
// Job page card: the DC plans saved with this job.
export function dcPlansCard(job, save, rerender) {
  if (!(job.dcPlans && job.dcPlans.length)) return null;
  return h('div', { class: 'card' }, h('h2', {}, 'DC system plans'),
    h('div', { class: 'list' }, job.dcPlans.map((d) => h('div', { class: 'row pdfrow' }, h('div', { class: 'main' }, h('div', { class: 't' }, d.name), h('div', { class: 's' }, `${d.summary ? `${d.summary.volts} V · ${d.summary.ah} Ah · ${d.summary.wh} Wh/day · ` : ''}saved ${new Date(d.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`)),
      h('button', { class: 'btn small', onclick: () => { storePlanInputs({ ...PLAN_DEFAULTS, ...clone(d.inputs || {}) }); go('#/calc/dc/plan/results'); } }, 'Open'),
      h('button', { class: 'btn small warn', 'aria-label': 'Delete ' + d.name, onclick: async () => { job.dcPlans = job.dcPlans.filter((x) => x.id !== d.id); await save(); rerender(); } }, 'Delete')))));
}
