// =====================================================================
// testacross.js (v0.14) — "Test across circuits": pick a test, get every
// circuit on the board in a list with just the boxes for that test. It
// edits the same circuit objects as the circuit pages and the schedule,
// so everything stays in step. Red/amber flags come from checks.js.
// Route: #/cert/<id>/b/<board>/t/<test>
// =====================================================================
import { h, fill, toast, modal } from './ui.js';
import { rcdGroups, commonTime, planRcdTime, applyRcdTime, undoRcdTime } from './rcdreuse.js';
import { route, page, go } from './app.js';
import { openCert, changed } from './state.js';
import { FIELD, autoNA } from './templates.js';
import { checkCircuit, limitZs, boardCtx, fmtZs } from './checks.js';
import { TEST_STEPS, stepById, prevStep, nextStep, rowMode, quickFor, progress, fillEmpty } from './testlist.js';

const ctxFor = (cert, b) => boardCtx(cert, b);
const LABEL = { r1r2: 'R1+R2 Ω', R2: 'R2 Ω', r1: 'r1 Ω', rn: 'rn Ω', r2: 'r2 Ω', irV: 'Test V', irLL: 'L–L MΩ', irLE: 'L–E MΩ', pol: 'Polarity', zs: 'Zs Ω', rcdMs: 'Trip ms', rcdBtn: 'Test button' };
const BULK = { ir: [['irV', '500', 'Test V 500 on all'], ['irLL', '>999', 'L–L >999 on all empty'], ['irLE', '>999', 'L–E >999 on all empty']], pol: [['pol', '✓', 'Polarity ✓ on all empty']], rcd: [['rcdBtn', '✓', 'Test button ✓ on all empty']] };

route(/^\/cert\/([^/]+)\/b\/(\d+)\/t\/([a-z0-9]+)$/, async (id, bi, tid) => {
  const cert = await openCert(id); if (!cert) return go('#/');
  const b = cert.boards[+bi]; if (!b) return go('#/cert/' + id);
  const step = stepById(tid); const base = `#/cert/${id}/b/${bi}`;
  const prog = h('span', { class: 'tprog' });
  const updProg = () => { const p = progress(b, step.id); prog.textContent = p.need ? `${p.done} of ${p.need} done` : 'Nothing to test here'; prog.className = 'tprog' + (p.need && p.done === p.need ? ' all' : ''); };
  const list = h('div', { class: 'tlist' });
  const drawList = () => fill(list, b.circuits.length ? b.circuits.map((c, ci) => row(c, ci)) : h('div', { class: 'empty' }, 'No circuits on this board yet.'));
  function row(c, ci) {
    const m = rowMode(c, step.id);
    const head = h('a', { class: 'thd', href: `${base}/c/${ci}`, title: 'Open the full circuit page' }, h('span', { class: 'no' }, c.num || ci + 1), h('span', { class: 'ds' }, c.desc || 'No description'), h('span', { class: 'go' }, '›'));
    if (m.mode === 'skip') return h('div', { class: 'trow skip' }, head, h('div', { class: 'note' }, m.why + ' \u00b7 nothing to enter'));
    const flagEls = {}; const inputs = {};
    const lim = step.id === 'zs' ? h('div', { class: 'note tlim' }) : null;
    const refresh = () => {
      const res = checkCircuit(c, ctxFor(cert, b));
      for (const [k, el] of Object.entries(flagEls)) { const f = res.flags[k]; el.wrap.className = 'tf ' + (f ? f.level : ''); el.msg.textContent = f ? f.msg : ''; }
      for (const [k, el] of Object.entries(inputs)) { const na = autoNA(c, k); el.placeholder = na ? 'N/A' : ''; el.classList.toggle('autona', na); }
      if (lim) { const l = limitZs(c, ctxFor(cert, b)); fill(lim, l.value != null ? ['Max Zs ', h('b', {}, fmtZs(l.value) + ' \u03a9'), res.cold != null ? ` \u00b7 80% ${res.cold.toFixed(2)} \u03a9` : ''] : 'Pick the device on the circuit page to see the max Zs.'); }
      updProg();
    };
    const box = (k) => {
      const fd = FIELD[k] || {};
      const input = h('input', { value: c[k] ?? '', inputmode: fd.num ? 'decimal' : null, 'aria-label': `Circuit ${c.num} ${fd.label || k}`, oninput: (e) => { c[k] = e.target.value; changed(); refresh(); },
        onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); const all = [...list.querySelectorAll('input')]; const nx = all[all.indexOf(e.target) + 1]; if (nx) nx.focus(); } } });
      inputs[k] = input;
      const msg = h('div', { class: 'msg' });
      const wrap = h('div', { class: 'tf' }, h('div', { class: 'lab' }, h('span', {}, LABEL[k] || fd.short), fd.col ? h('span', { class: 'col' }, 'col ' + fd.col) : null),
        h('div', { class: 'inrow' }, input, quickFor(k).map((q) => h('button', { class: 'q', type: 'button', onclick: () => { c[k] = c[k] === q ? '' : q; input.value = c[k]; changed(); refresh(); } }, q))), msg);
      flagEls[k] = { wrap, msg }; return wrap;
    };
    const el = h('div', { class: 'trow' }, head, m.note ? h('div', { class: 'note tnote' }, m.note) : null, lim,
      h('div', { class: 'tboxes n' + step.keys.length }, step.keys.map(box)));
    refresh(); return el;
  }
  const chips = h('div', { class: 'tsteps', role: 'tablist' }, TEST_STEPS.map((s, i) => h('a', { class: 'tstep' + (s.id === step.id ? ' on' : '') + (s.dead ? '' : ' live'), href: `${base}/t/${s.id}`, role: 'tab' }, h('span', { class: 'tn' }, i + 1), s.short)));
  const bulk = (BULK[step.id] || []).map(([k, v, label]) => h('button', { class: 'btn small', type: 'button', onclick: () => { const n = k === 'irV' ? b.circuits.filter((c) => rowMode(c, step.id).mode === 'edit' && (c.irV = v)).length : fillEmpty(b, step.id, k, v); changed(); toast(`${label.split(' on')[0]}: ${n} circuit${n === 1 ? '' : 's'}`); drawList(); updProg(); } }, label));
  const p = prevStep(step.id), n = nextStep(step.id);
  // v0.46.0: one trip time per shared RCD (RCBOs stay per circuit)
  const reuse = step.id === 'rcd' ? rcdReuse(b, () => { drawList(); updProg(); }) : null;
  drawList(); updProg();
  setTimeout(() => { const on = chips.querySelector('.on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' }); }, 0);
  page('Test across circuits', [
    chips,
    h('div', { class: 'card thead' }, h('div', { class: 'tkind' }, step.dead ? 'Dead test' : 'Live test'), h('h2', {}, step.title), h('p', { class: 'note' }, step.hint), prog,
      bulk.length ? h('div', { class: 'btns' }, bulk) : null),
    reuse,
    list,
    h('p', { class: 'note' }, 'Same readings as the circuit pages and the schedule: change it here or there. Tap a circuit name to open its full page.'),
    h('div', { class: 'stick tnav' }, p ? h('a', { class: 'btn', href: `${base}/t/${p.id}` }, '\u2190 ' + p.short) : h('a', { class: 'btn', href: base }, '\u2190 Board'),
      n ? h('a', { class: 'btn primary', href: `${base}/t/${n.id}` }, 'Next test: ' + n.short + ' \u2192') : h('a', { class: 'btn primary', href: base }, 'Done \u2713')),
  ], { back: base, sub: `${b.ref || 'Board'} \u00b7 ${cert.number}` });
});

// v0.46.0: "Same RCD: enter the trip time once". Ticked circuits get it; typed times only replaced if you say so; Undo.
function rcdReuse(b, redrawList) {
  const groups = rcdGroups(b); if (!groups.length) return null;
  const card = h('div', { class: 'card rcdreuse' });
  const undos = new Map(); const typed = new Map(); const picks = new Map();
  const draw = () => fill(card, h('h2', {}, 'Same RCD: enter the trip time once'),
    h('p', { class: 'note' }, 'For circuits sharing one RCD. Two RCDs the same on a split-load board? Set \u201cWhich RCD\u201d on the circuits and they get a card each (or untick them here). RCBOs are tested on their own, below.'),
    groups.map((g, gi) => {
      if (!picks.has(gi)) picks.set(gi, new Set(g.circuits)); const pick = picks.get(gi);
      const inp = h('input', { inputmode: 'decimal', value: typed.has(gi) ? typed.get(gi) : commonTime(g.circuits), oninput: (e) => typed.set(gi, e.target.value), 'aria-label': 'Trip time in ms for ' + g.label, placeholder: 'ms' });
      const apply = async () => {
        const ms = inp.value.trim(); if (!ms) { toast('Type the trip time first'); inp.focus(); return; }
        const plan = planRcdTime([...pick], ms); let replace = false;
        if (plan.clash.length) {
          const r = await modal('Some circuits already have a time', h('div', {}, h('ul', { class: 'qfclash' }, plan.clash.map((x) => h('li', {}, `Circuit ${x.c.num}: ${x.from} ms`)))),
            [{ label: 'Cancel', value: null }, { label: 'Only empty ones', value: 'empty' }, { label: `Replace with ${ms} ms`, value: 'all', cls: 'primary' }]);
          if (!r) return; replace = r === 'all';
        }
        const u = applyRcdTime(plan, { replace }); if (!u.length) { toast('Nothing changed'); return; }
        undos.set(gi, u); changed(); toast(`${ms} ms on ${u.length} circuit${u.length === 1 ? '' : 's'}`); draw(); redrawList();
      };
      return h('div', { class: 'rgrp' }, h('div', { class: 'rghd' }, h('b', {}, g.label)),
        h('div', { class: 'chips rgc' }, g.circuits.map((c) => h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: pick.has(c), onchange: (e) => { if (e.target.checked) pick.add(c); else pick.delete(c); } }), `${c.num} ${c.desc || ''}`.trim()))),
        h('div', { class: 'rgrow' }, h('label', { class: 'f' }, h('span', {}, 'Trip time at I\u0394n (ms)'), inp),
          h('button', { class: 'btn small primary', type: 'button', onclick: apply }, 'Apply to ticked circuits'),
          undos.has(gi) ? h('button', { class: 'btn small', type: 'button', onclick: () => { undoRcdTime(undos.get(gi)); undos.delete(gi); changed(); toast('Undone'); draw(); redrawList(); } }, 'Undo') : null));
    }));
  draw(); return card;
}
