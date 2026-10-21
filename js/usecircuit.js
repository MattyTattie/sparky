// usecircuit.js — v0.19 "Use on a circuit" from the cable calculator. Pick the job (the last one
// opened first), the board, then a circuit or "New circuit"; see exactly what changes; then it
// fills in the cable and device boxes only. An Undo toast puts it back for about 8 seconds.
import { h, fill, modal, toast } from './ui.js';
import * as db from './db.js';
import { S, touchJob, flush } from './state.js';
import { blankCircuit } from './templates.js';
import { planUse, applyUse, undoUse } from './usecore.js';

// Remember the last job / certificate opened, so it's the default.
addEventListener('hashchange', () => { const m = /#\/(job|cert)\/([^/?]+)/.exec(location.hash); if (m) localStorage.setItem(m[1] === 'job' ? 'sparky.lastJob' : 'sparky.lastCert', m[2]); if (m && m[1] === 'job') localStorage.removeItem('sparky.lastCert'); });
async function defaultJob(jobs) {
  const lc = localStorage.getItem('sparky.lastCert'); if (lc) { const c = await db.get('certs', lc); if (c && jobs.some((j) => j.id === c.jobId)) return c.jobId; }
  const lj = localStorage.getItem('sparky.lastJob'); if (lj && jobs.some((j) => j.id === lj)) return lj;
  return jobs[0] && jobs[0].id;
}
const shown = (v) => (v === '' || v == null ? 'blank' : String(v));

export async function useOnCircuit(res) {
  await flush();
  const jobs = (await db.all('jobs')).filter((j) => !j.deleted).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  if (!jobs.length) { toast('No jobs yet. Add a job with a certificate first.'); return; }
  const sel = { job: await defaultJob(jobs), board: '', circuit: '' };
  let boards = [];
  const body = h('div', { class: 'usecirc' });
  const draw = async () => {
    const certs = (await db.byJob('certs', sel.job)).filter((c) => (c.boards || []).length);
    boards = certs.flatMap((c) => c.boards.map((b, bi) => ({ key: c.id + ':' + bi, cert: c, bi, label: `${c.number || c.type} · ${b.ref || 'DB' + (bi + 1)}${b.location ? ' (' + b.location + ')' : ''}` })));
    if (!boards.some((b) => b.key === sel.board)) { const lc = localStorage.getItem('sparky.lastCert'); sel.board = (boards.find((b) => b.cert.id === lc) || boards[0] || {}).key || ''; sel.circuit = ''; }
    const bd = boards.find((b) => b.key === sel.board);
    const circs = bd ? bd.cert.boards[bd.bi].circuits : [];
    if (sel.circuit !== 'new' && !circs.some((c) => c.id === sel.circuit)) sel.circuit = circs[0] ? circs[0].id : 'new';
    const c = sel.circuit === 'new' ? blankCircuit(circs.length + 1) : circs.find((x) => x.id === sel.circuit);
    const plan = c ? planUse(c, res) : [];
    const select = (k, opts, label) => h('label', { class: 'f' }, h('span', {}, label), h('select', { 'data-k': k, onchange: (e) => { sel[k] = e.target.value; if (k === 'job') sel.board = ''; draw(); } }, opts.map(([v, t]) => h('option', { value: v, selected: String(sel[k]) === String(v) ? true : null }, t))));
    fill(body,
      select('job', jobs.map((j) => [j.id, j.title || 'Job']), 'Job'),
      boards.length ? select('board', boards.map((b) => [b.key, b.label]), 'Board') : h('p', { class: 'note warnnote' }, 'This job has no certificate with a board yet.'),
      bd ? select('circuit', [...circs.map((x) => [x.id, `${x.num} – ${x.desc || 'No description'}`]), ['new', '+ New circuit']], 'Circuit') : null,
      bd ? h('div', { class: 'usepre' }, h('div', { class: 'usepre-h' }, sel.circuit === 'new' ? `New circuit ${circs.length + 1} will get:` : 'What will change:'),
        plan.length ? h('table', { class: 'calctab usetab' }, h('tr', {}, h('th', {}, 'Box'), h('th', {}, 'Now'), h('th', {}, 'Becomes')), plan.map((p) => h('tr', {}, h('td', {}, p.name), h('td', { class: 'was' }, shown(p.fromText)), h('td', { class: 'to' }, shown(p.toText)))))
          : h('p', { class: 'note' }, 'Nothing to change: this circuit already has these values.'),
        h('p', { class: 'note' }, 'Only the cable and device boxes. Test results are never touched.')) : null);
  };
  await draw();
  const ok = await modal('Use on a circuit', body, [{ label: 'Cancel', value: false }, { label: 'Fill it in', value: true, cls: 'primary' }]);
  if (!ok) return;
  const bd = boards.find((b) => b.key === sel.board); if (!bd) return;
  const cert = await db.get('certs', bd.cert.id); const board = cert.boards[bd.bi];
  let c; let added = false;
  if (sel.circuit === 'new') { c = blankCircuit(board.circuits.length + 1); board.circuits.push(c); added = true; } else c = board.circuits.find((x) => x.id === sel.circuit);
  if (!c) return;
  const snap = applyUse(c, res);
  const save = async (cc) => { cc.updatedAt = new Date().toISOString(); cc.version = (cc.version || 0) + 1; await db.put('certs', cc); if (S.cert && S.cert.id === cc.id) S.cert = cc; if (cc.jobId) await touchJob(cc.jobId); };
  await save(cert);
  const undo = async () => {
    const cc = await db.get('certs', cert.id); const b = cc.boards[bd.bi];
    if (added) b.circuits = b.circuits.filter((x) => x.id !== c.id); else { const x = b.circuits.find((y) => y.id === c.id); if (x) undoUse(x, snap); }
    await save(cc); toast('Put back as it was');
  };
  toast(h('span', { class: 'undotoast' }, h('span', {}, `Filled in circuit ${c.num}${c.desc ? ' – ' + c.desc : ''} on ${board.ref || 'the board'}.`), h('button', { class: 'btn small undo', 'data-undo': '1', onclick: (e) => { e.currentTarget.disabled = true; undo(); } }, 'Undo')), 8000);
}
