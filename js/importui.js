// importui.js — "Import results file" screen: shows exactly what will change
// before anything is changed. Fills blanks only; your values win unless you tick otherwise.
import { h, fill, toast, pickFile } from './ui.js';
import { route, page, go } from './app.js';
import { openCert, changed, flush } from './state.js';
import { blankCircuit } from './templates.js';
import { planImport, applyImport, checkResultsFile } from './importres.js';

let pending = null; // { certId, data, name }

export async function startImport(certId) {
  const [f] = await pickFile({ accept: '.json,application/json' }); if (!f) return;
  try { const data = checkResultsFile(JSON.parse(await f.text())); pending = { certId, data, name: f.name }; go(`#/cert/${certId}/import`); }
  catch (e) { toast(e instanceof SyntaxError ? 'That file isn\u2019t a results file (not JSON).' : e.message, 4000); }
}

const show = (v) => (v === true ? '✓' : v === '' || v == null ? '–' : String(v));

route(/^\/cert\/([^/]+)\/import$/, async (id) => {
  const cert = await openCert(id); if (!cert) return go('#/');
  if (!pending || pending.certId !== id) return go(`#/cert/${id}`);
  const box = h('div'); let bi = 0;
  const takeFile = new Set(); let clash = 'skip';
  const draw = () => {
    const plan = planImport(cert, pending.data, bi); const s = plan.summary;
    const chg = (prefix) => (c) => h('div', { class: 'improw ' + c.action },
      h('div', { class: 'iml' }, c.label, c.note ? h('span', { class: 'note' }, ' · ' + c.note) : null),
      c.action === 'fill' ? h('div', {}, h('span', { class: 'note' }, 'blank → '), h('b', {}, show(c.val)))
        : h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: takeFile.has(prefix + c.k), onchange: (e) => { e.target.checked ? takeFile.add(prefix + c.k) : takeFile.delete(prefix + c.k); } }),
          h('span', {}, 'Yours: ', h('b', {}, show(c.cur)), ' · file: ', h('b', {}, show(c.val)), h('span', { class: 'note' }, ' (tick to use the file\u2019s)'))));
    fill(box,
      h('div', { class: 'card' }, h('b', {}, pending.data.source || pending.name),
        h('p', { class: 'note' }, 'Nothing has changed yet. Blank boxes get filled from the file. Where you already have something different, yours is kept unless you tick it. No circuits, readings or photos are removed.'),
        cert.boards.length > 1 ? h('label', { class: 'f' }, h('span', {}, 'Into board'), h('select', { onchange: (e) => { bi = +e.target.value; takeFile.clear(); draw(); } }, cert.boards.map((b, i) => h('option', { value: i, selected: i === bi ? true : null }, b.ref || 'DB' + (i + 1))))) : null,
        h('div', { class: 'chips' }, h('span', { class: 'pill green' }, `${s.matched} circuits matched`), h('span', { class: 'pill' }, `${s.added} to add`), h('span', { class: 'pill' }, `${s.fills} boxes to fill`), s.differs ? h('span', { class: 'pill amber' }, `${s.differs} differences`) : null, s.clashes ? h('span', { class: 'pill red' }, `${s.clashes} number clashes`) : null)),
      (pending.data.notes || []).length ? h('div', { class: 'notice amber' }, h('b', {}, 'Notes in the file: '), h('ul', {}, pending.data.notes.map((n) => h('li', {}, n)))) : null,
      plan.certChanges.length ? h('div', { class: 'card' }, h('h2', {}, 'Certificate details'), plan.certChanges.map(chg('cert:'))) : null,
      plan.boardChanges.length ? h('div', { class: 'card' }, h('h2', {}, 'Board ' + (cert.boards[bi].ref || '')), plan.boardChanges.map(chg('board:'))) : null,
      h('h2', { class: 'sec' }, 'Circuits'),
      plan.circuits.map((c) => h('div', { class: 'card impc ' + c.how },
        h('div', { class: 'rowhead' }, h('b', {}, `${c.num} ${c.desc || ''}`), h('span', { class: 'note' },
          c.how === 'number' ? ' · matched by number' : c.how === 'description' ? ' · matched by description (different number here)' : c.how === 'new' ? ' · not on the certificate yet: will be added' : ` · number ${c.num} is “${c.clashWith.desc || 'blank'}” here`)),
        c.how === 'clash' ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: clash === 'add', onchange: (e) => { clash = e.target.checked ? 'add' : 'skip'; draw(); } }), 'Add file circuits whose number is taken as extra circuits (otherwise skipped)') : null,
        c.targetId && !c.changes.length ? h('div', { class: 'note' }, 'Nothing new in the file for this one.') : null,
        c.changes.map(chg(`c:${c.num}:`)))),
      plan.untouched.length ? h('p', { class: 'note' }, `Not in the file, left exactly as they are: ${plan.untouched.map((u) => u.num + (u.desc ? ' ' + u.desc : '')).join(', ')}`) : null,
      h('div', { class: 'stick' }, h('button', { class: 'btn', onclick: () => { pending = null; go(`#/cert/${id}`); } }, 'Cancel'),
        h('button', { class: 'btn primary', onclick: async () => {
          const r = applyImport(cert, planImport(cert, pending.data, bi), { takeFile, clash, boardIndex: bi, makeCircuit: (n) => blankCircuit(n) });
          changed(); await flush(); pending = null;
          toast(`Imported: ${r.filled} filled, ${r.replaced} replaced, ${r.added} circuit(s) added`, 4000); go(`#/cert/${id}/b/${bi}`);
        } }, 'Import')));
  };
  draw();
  page('Import results', box, { back: `#/cert/${id}`, sub: cert.number });
});
