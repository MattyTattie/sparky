// calcmd.js — v0.9: Maximum demand helper screen. List the loads, get the
// On-Site Guide diversity figure, and (from a certificate) drop it into the
// maximum demand box. Sums in maxdemand.js.
import { h, fill, toast } from './ui.js';
import { route, page, go } from './app.js';
import * as db from './db.js';
import { flush } from './state.js';
import { setLastCalc, icard, answerCard, pchip, resline, detailCard, banner } from './calckit.js';
import { KINDS, kind, maxDemand, ampsEach, EXAMPLE } from './maxdemand.js';
import { icon } from './icons.js';

const KEY = 'sparky.md1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
route(/^\/calc\/md(?:\/([^/]+))?$/, async (certId) => {
  setLastCalc('md');
  const cert = certId ? await db.get('certs', certId) : null;
  const v = load() || { loads: [], fuse: '100' };
  const top = h('div'); const list = h('div'); const add = h('div'); const work = h('div');
  const save = () => { localStorage.setItem(KEY, JSON.stringify(v)); draw(); };
  const row = (l, i) => { const d = kind(l.k) || KINDS[0];
    return h('div', { class: 'mdrow' },
      h('div', { class: 'mdname' }, h('b', {}, l.name || d.label), h('span', { class: 'note' }, d.unit === 'each' ? '+5 A each' : `${l.qty} × ${l.value} ${d.unit} = ${Math.round(ampsEach(l) * (Number(l.qty) || 0) * 10) / 10} A`)),
      h('div', { class: 'mdin' },
        h('label', { class: 'mini' }, h('span', {}, 'How many'), h('input', { inputmode: 'numeric', value: l.qty, onchange: (e) => { l.qty = e.target.value; save(); } })),
        d.unit === 'each' ? null : h('label', { class: 'mini' }, h('span', {}, d.unit === 'A' ? 'Breaker (A)' : d.unit === 'W' ? 'Watts each' : 'kW each'), h('input', { inputmode: 'decimal', value: l.value, onchange: (e) => { l.value = e.target.value; save(); } })),
        h('button', { class: 'iconbtn small', 'aria-label': 'Remove', onclick: () => { v.loads.splice(i, 1); save(); } }, icon('x', { size: 18 }))));
  };
  const draw = () => {
    const r = maxDemand(v.loads); const fuse = Number(v.fuse) || 0;
    fill(top, v.loads.length ? answerCard({ kicker: 'Maximum demand (by the book)', big: `${Math.round(r.total)} A`, sub: `${r.totalKVA} kVA at 230 V · ${r.connected} A connected before diversity`,
      good: fuse && r.total > fuse ? 'warn' : true,
      chips: [fuse ? pchip(r.total <= fuse, `Supply fuse ${fuse} A`) : null].filter(Boolean),
      extra: cert ? h('button', { class: 'btn primary', style: 'margin-top:10px;width:100%', onclick: async () => { await flush(); const c = await db.get('certs', cert.id); c.parts = c.parts || {}; c.parts.maxDemand = String(Math.round(r.total)); c.parts.mdUnit = 'A'; c.updatedAt = new Date().toISOString(); c.version = (c.version || 0) + 1; await db.put('certs', c); toast(`Maximum demand ${Math.round(r.total)} A put on ${c.number}`); go(`#/cert/${c.id}/s/parts`); } }, `Use ${Math.round(r.total)} A on ${cert.number}`) : null })
      : answerCard({ kicker: 'Maximum demand', big: 'Add the loads', sub: 'Tap the loads below, or try the example.', good: 'warn' }),
      v.loads.length && fuse && r.total > fuse ? banner(`By the book it\u2019s over the ${fuse} A supply fuse.`, 'That\u2019s common on paper: the book figure is cautious. See \u201cWhat it really draws\u201d below, and think about load management (EV, heating) or a supply upgrade if the real peak is close.') : null);
    fill(list, v.loads.length ? icard('Your loads', v.loads.map(row), { step: 1 }) : null);
    fill(add, icard(v.loads.length ? 'Add another' : 'Add the loads', [
      h('div', { class: 'chips mdadd' }, KINDS.map((d) => h('button', { class: 'chip', type: 'button', onclick: () => { v.loads.push({ k: d.k, qty: 1, value: d.dflt }); save(); } }, '+ ' + d.label))),
      h('div', { class: 'btns' }, h('button', { class: 'btn small', onclick: () => { v.loads = EXAMPLE.map((x) => ({ ...x })); save(); } }, 'Load the example house'), v.loads.length ? h('button', { class: 'btn small', onclick: () => { v.loads = []; save(); } }, 'Clear') : null),
      h('label', { class: 'f fld2' }, h('span', {}, 'Supply fuse (cut-out)'), h('span', { class: 'withunit' }, h('input', { inputmode: 'numeric', value: v.fuse, onchange: (e) => { v.fuse = e.target.value; save(); } }), h('span', { class: 'unit' }, 'A')), h('span', { class: 'help' }, 'Usually 60, 80 or 100 A. Leave blank to skip.'))], { step: v.loads.length ? 2 : 1 }));
    fill(work, v.loads.length ? [
      detailCard('md-how', 'How it worked it out', r.groups.map((g) => resline(null, `${g.label}: ${g.demand} A`, `${g.items} item(s), ${g.connected} A connected → ${g.rule}`)), { open: true }),
      detailCard('md-real', 'What it really draws', [h('p', { class: 'note' }, `The ${Math.round(r.total)} A is the On-Site Guide design figure: use it for the supply, tails and main switch, and for the maximum demand box. A house rarely gets near it: everything would have to be on at once. A typical home without electric heating peaks around 40\u201360 A; showers, electric heating and an EV charger push it up. If you need the real figure, a clamp meter on the tails at teatime in winter (or the supplier\u2019s smart meter data) tells you.`)]),
      detailCard('md-src', 'Where the rules come from', [h('p', { class: 'note' }, '\u26a0 Diversity allowances from memory of the IET On-Site Guide, Appendix A (Table A2, household installations). Check against your copy. Socket circuits use the Appendix H "standard circuits" rule (largest 100%, others 40%). Lighting is entered as the lamp load actually fitted.')])] : null);
  };
  draw();
  page('Maximum demand', [cert ? h('div', { class: 'notice info' }, `For ${cert.number}. The answer can go straight into its maximum demand box.`) : null, top, list, add, work], { back: cert ? `#/cert/${cert.id}/s/parts` : '#/calc' });
});
