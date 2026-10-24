// calcmd.js — v0.9: Maximum demand helper screen. List the loads, get the
// On-Site Guide diversity figure, and (from a certificate) drop it into the
// maximum demand box. Sums in maxdemand.js.
import { h, fill, toast } from './ui.js';
import { route, page, go } from './app.js';
import * as db from './db.js';
import { flush } from './state.js';
import { setLastCalc, icard, answerCard, pchip, resline, detailCard, banner } from './calckit.js';
import { KINDS, kind, maxDemand, maxDemandLines, EXAMPLE } from './maxdemand.js';
import { icon } from './icons.js';

const KEY = 'sparky.md1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
route(/^\/calc\/md(?:\/([^/]+))?$/, async (certId) => {
  setLastCalc('md');
  const cert = certId ? await db.get('certs', certId) : null;
  const v = load() || { loads: [], fuse: '100' };
  const top = h('div'); const list = h('div'); const add = h('div'); const work = h('div');
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };
  const save = () => { store(); draw(); };
  // v0.26: per-line working, a name on each line, and − / + that update the numbers in place.
  const notes = []; // line i → its working element
  const NAME_PH = { cooking: 'e.g. Hob, Oven, Microwave', heater: 'e.g. Lounge panel', ring: 'e.g. Kitchen ring', radial: 'e.g. Garage', lighting: 'e.g. Upstairs lights' };
  const row = (l, i) => { const d = kind(l.k) || KINDS[0];
    const note = h('span', { class: 'note mdwork' }); notes[i] = note;
    const qty = h('input', { inputmode: 'numeric', value: l.qty, 'aria-label': 'How many', onchange: (e) => { l.qty = String(Math.max(0, Math.round(Number(e.target.value) || 0))); e.target.value = l.qty; store(); refresh(e.target); } });
    const step = (by) => (e) => { e.preventDefault(); l.qty = String(Math.max(0, (Math.round(Number(l.qty) || 0)) + by)); qty.value = l.qty; store(); refresh(e.currentTarget); };
    return h('div', { class: 'mdrow' },
      h('div', { class: 'mdname' }, h('b', {}, d.label), note),
      h('label', { class: 'mini mdlabel' }, h('span', {}, 'Name (optional)'), h('input', { value: l.name || '', placeholder: NAME_PH[l.k] || 'e.g. what it is', maxlength: 40, oninput: (e) => { l.name = e.target.value.trim() ? e.target.value : undefined; store(); } })),
      h('div', { class: 'mdin' },
        h('div', { class: 'mini' }, h('span', {}, 'How many'), h('div', { class: 'stepper' },
          h('button', { class: 'stepbtn', type: 'button', 'aria-label': 'One fewer', onclick: step(-1) }, '\u2212'), qty,
          h('button', { class: 'stepbtn', type: 'button', 'aria-label': 'One more', onclick: step(1) }, '+'))),
        d.unit === 'each' ? null : h('label', { class: 'mini' }, h('span', {}, d.unit === 'A' ? 'Breaker (A)' : d.unit === 'W' ? 'Watts each' : 'kW each'), h('input', { inputmode: 'decimal', value: l.value, onchange: (e) => { l.value = e.target.value; store(); refresh(e.target); } })),
        h('button', { class: 'iconbtn small', 'aria-label': 'Remove', onclick: () => { v.loads.splice(i, 1); save(); } }, icon('x', { size: 18 }))));
  };
  const lineNotes = () => { const L = maxDemandLines(v.loads).lines; L.forEach((x, i) => { if (notes[i] && x) notes[i].textContent = x.full; }); };
  // Update the figures without rebuilding the rows; keep the tapped control where it was on screen.
  const refresh = (anchor) => {
    const before = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect().top : null;
    lineNotes(); drawTop(); drawWork();
    if (before != null) { const diff = anchor.getBoundingClientRect().top - before; if (Math.abs(diff) > 0.5) scrollBy(0, diff); }
  };
  const drawTop = () => {
    const r = maxDemand(v.loads); const fuse = Number(v.fuse) || 0;
    fill(top, v.loads.length ? answerCard({ kicker: 'Maximum demand (by the book)', big: `${Math.round(r.total)} A`, sub: `${r.totalKVA} kVA at 230 V · ${r.connected} A connected before diversity`,
      good: fuse && r.total > fuse ? 'warn' : true,
      chips: [fuse ? pchip(r.total <= fuse, `Supply fuse ${fuse} A`) : null].filter(Boolean),
      extra: cert ? h('button', { class: 'btn primary', style: 'margin-top:10px;width:100%', onclick: async () => { await flush(); const c = await db.get('certs', cert.id); c.parts = c.parts || {}; c.parts.maxDemand = String(Math.round(r.total)); c.parts.mdUnit = 'A'; c.updatedAt = new Date().toISOString(); c.version = (c.version || 0) + 1; await db.put('certs', c); toast(`Maximum demand ${Math.round(r.total)} A put on ${c.number}`); go(`#/cert/${c.id}/s/parts`); } }, `Use ${Math.round(r.total)} A on ${cert.number}`) : null })
      : answerCard({ kicker: 'Maximum demand', big: 'Add the loads', sub: 'Tap the loads below, or try the example.', good: 'warn' }),
      v.loads.length && fuse && r.total > fuse ? banner(`By the book it\u2019s over the ${fuse} A supply fuse.`, 'That\u2019s common on paper: the book figure is cautious. See \u201cWhat it really draws\u201d below, and think about load management (EV, heating) or a supply upgrade if the real peak is close.') : null);
  };
  const draw = () => {
    drawTop(); notes.length = 0;
    fill(list, v.loads.length ? icard('Your loads', v.loads.map(row), { step: 1 }) : null); lineNotes();
    fill(add, icard(v.loads.length ? 'Add another' : 'Add the loads', [
      h('div', { class: 'chips mdadd' }, KINDS.map((d) => h('button', { class: 'chip', type: 'button', onclick: () => { v.loads.push({ k: d.k, qty: 1, value: d.dflt }); save(); } }, '+ ' + d.label))),
      h('div', { class: 'btns' }, h('button', { class: 'btn small', onclick: () => { v.loads = EXAMPLE.map((x) => ({ ...x })); save(); } }, 'Load the example house'), v.loads.length ? h('button', { class: 'btn small', onclick: () => { v.loads = []; save(); } }, 'Clear') : null),
      h('label', { class: 'f fld2' }, h('span', {}, 'Supply fuse (cut-out)'), h('span', { class: 'withunit' }, h('input', { inputmode: 'numeric', value: v.fuse, onchange: (e) => { v.fuse = e.target.value; save(); } }), h('span', { class: 'unit' }, 'A')), h('span', { class: 'help' }, 'Usually 60, 80 or 100 A. Leave blank to skip.'))], { step: v.loads.length ? 2 : 1 }));
    drawWork();
  };
  const drawWork = () => {
    const r = maxDemand(v.loads); const G = maxDemandLines(v.loads).groups;
    const names = (g) => v.loads.map((l, i) => [l, i]).filter(([l]) => { const d = kind(l.k); return d && (d.unit === 'each' ? 'cookerSocket' : d.group) === g; }).map(([l]) => l.name || kind(l.k).label);
    fill(work, v.loads.length ? [
      detailCard('md-how', 'How it worked it out', G.map((g) => resline(null, `${g.label}: ${g.connected} A \u2192 ${g.demand} A`, (g.lines > 1 ? `${g.lines} lines combined (${names(g.g).join(', ')}). ` : '') + `${g.items} item(s): ${g.work || 'nothing counted'}. Rule: ${g.rule}`)), { open: true }),
      detailCard('md-real', 'What it really draws', [h('p', { class: 'note' }, `The ${Math.round(r.total)} A is the On-Site Guide design figure: use it for the supply, tails and main switch, and for the maximum demand box. A house rarely gets near it: everything would have to be on at once. A typical home without electric heating peaks around 40\u201360 A; showers, electric heating and an EV charger push it up. If you need the real figure, a clamp meter on the tails at teatime in winter (or the supplier\u2019s smart meter data) tells you.`)]),
      detailCard('md-src', 'Where the rules come from', [h('p', { class: 'note' }, '\u26a0 Diversity allowances from memory of the IET On-Site Guide, Appendix A (Table A2, household installations). Check against your copy. Socket circuits use the Appendix H "standard circuits" rule (largest 100%, others 40%). Lighting is entered as the lamp load actually fitted.')])] : null);
  };
  draw();
  page('Maximum demand', [cert ? h('div', { class: 'notice info' }, `For ${cert.number}. The answer can go straight into its maximum demand box.`) : null, top, list, add, work], { back: cert ? `#/cert/${cert.id}/s/parts` : '#/calc' });
});
