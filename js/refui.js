// refui.js — v0.30: Reference section. List at #/ref, one table at #/ref/<id>. Offline (in sw.js).
import { h } from './ui.js';
import { route, page } from './app.js';
import { icon } from './icons.js';
import { REF, refById } from './refdata.js';

const table = (t) => h('div', { class: 'reftblwrap' },
  t.caption ? h('h3', { class: 'refcap' }, t.caption) : null,
  h('table', { class: 'reftbl' }, h('thead', {}, h('tr', {}, t.head.map((c) => h('th', { scope: 'col' }, c)))),
    h('tbody', {}, t.rows.map((r) => h('tr', {}, r.map((c, i) => (i === 0 ? h('th', { scope: 'row' }, c) : h('td', {}, c))))))));

route(/^\/ref$/, async () => {
  page('Reference', [
    h('p', { class: 'note' }, 'Handy BS 7671 tables, on your phone even with no signal. Check your own copy of the regs for anything unusual.'),
    h('div', { class: 'calcpicks' }, REF.map((r) => h('a', { class: 'calcpick', href: '#/ref/' + r.id },
      h('span', { class: 'cpic' }, icon(r.ic, { size: 24 })),
      h('span', { class: 'cpt' }, h('span', { class: 'cpn' }, r.title), h('span', { class: 'cps' }, r.table)),
      icon('chevronRight', { size: 20, cls: 'cpgo' })))),
  ], { back: '#/calc' });
});

route(/^\/ref\/([a-z0-9]+)$/, async (id) => {
  const r = refById(id); if (!r) return page('Reference', h('div', { class: 'notice amber' }, 'That table isn\u2019t here.'), { back: '#/ref' });
  page(r.title, [
    h('div', { class: 'card refcard' }, h('p', { class: 'refplain' }, r.plain), h('p', { class: 'note' }, 'BS 7671: ' + r.table)),
    (r.tables || []).map((t) => h('div', { class: 'card refcard' }, table(t))),
    (r.cards || []).map((c) => h('div', { class: 'card refcard' }, h('h3', { class: 'refcap' }, c.t), h('ul', { class: 'reflist' }, c.lines.map((l) => h('li', {}, l))))),
    h('details', { class: 'card refmore' }, h('summary', {}, 'More info'), h('ul', { class: 'reflist' }, r.more.map((l) => h('li', {}, l)))),
  ], { back: '#/ref', sub: r.table });
});
