// importextra.js (v0.15) — "Import extra details" preview screen.
// Shows exactly what will be added or filled, and what's skipped because you
// already have a value. Nothing changes until you tap Import.
import { h, fill, toast, pickFile } from './ui.js';
import { route, page, go } from './app.js';
import * as db from './db.js';
import { S, flush, touchJob } from './state.js';
import { readImportFile, planImport, counts, finish, opLabel, addDetail } from './importjob.js';

let pending = null; // { file, name, certId, back }

export async function startExtra(certId = null) {
  await flush();
  const [f] = await pickFile({ accept: '.json,application/json' }); if (!f) return;
  try { pending = { file: readImportFile(await f.text()), name: f.name, certId, back: certId ? `#/cert/${certId}` : '#/settings' }; go('#/import-extra'); }
  catch (e) { toast(e instanceof SyntaxError ? 'That file isn\u2019t a Zs Pro file (not JSON).' : e.message, 4000); }
}

const show = (v) => (v === true ? '✓' : v == null || v === '' ? '–' : typeof v === 'object' ? (Array.isArray(v) ? `${v.length} item(s)` : '…') : String(v));

route(/^\/import-extra$/, async () => {
  if (!pending) return go('#/settings');
  const p = pending;
  const plan = planImport(await db.all('certs'), p.file, { forceCertId: p.certId });
  const jobs = Object.fromEntries((await db.all('jobs')).map((j) => [j.id, j]));
  const all = plan.items.flatMap((it) => it.ops); const t = counts(all);
  const row = (o) => h('div', { class: 'improw ' + (o.action === 'skip' ? 'differs' : '') },
    h('div', { class: 'iml' }, opLabel(o)),
    o.action === 'add' ? h('div', {}, h('span', { class: 'pill green' }, 'add'), ' ', h('span', { class: 'note' }, addDetail(o)))
      : o.action === 'fill' ? h('div', {}, h('span', { class: 'note' }, 'blank → '), h('b', {}, show(o.val)))
        : h('div', {}, h('span', { class: 'note' }, 'yours kept: '), h('b', {}, show(o.cur)), h('span', { class: 'note' }, ' · file: ' + show(o.val))));
  const group = (title, list, empty) => h('div', { class: 'card' }, h('h2', {}, title), list.length ? list.map(row) : h('p', { class: 'note' }, empty));
  const body = [
    h('div', { class: 'card' }, h('b', {}, p.name),
      h('p', { class: 'note' }, 'Nothing has changed yet. This only adds what\u2019s missing and fills empty boxes. Anything you\u2019ve already filled in is kept, and nothing is removed.'),
      h('div', { class: 'chips' }, h('span', { class: 'pill green' }, `${t.add} to add`), h('span', { class: 'pill' }, `${t.fill} boxes to fill`), t.skip ? h('span', { class: 'pill amber' }, `${t.skip} skipped`) : null)),
    plan.unmatched.length ? h('div', { class: 'notice amber' }, `Not on this device, so left out: ${plan.unmatched.join(', ')}. Import only adds to certificates you already have.`) : null,
    plan.items.map((it) => {
      const add = it.ops.filter((o) => o.action === 'add'), fil = it.ops.filter((o) => o.action === 'fill'), sk = it.ops.filter((o) => o.action === 'skip');
      const job = jobs[it.local.jobId];
      return [h('h2', { class: 'sec' }, `${it.local.number || 'Certificate'}${job && job.title ? ' · ' + job.title : ''}`),
        it.how === 'this' ? h('p', { class: 'note' }, `The file\u2019s certificate (${it.incoming.number || 'no number'}) goes into this one.`) : null,
        !it.ops.length ? h('p', { class: 'note' }, 'Nothing new in the file for this certificate.') : null,
        add.length ? group('Will be added', add) : null,
        fil.length ? group('Empty boxes that will be filled', fil) : null,
        sk.length ? group('Skipped: you already have a value', sk) : null];
    }),
    p.file.ignored.length ? h('p', { class: 'note' }, 'Photos, presets and customer details in the file aren\u2019t imported here.') : null,
    h('div', { class: 'stick' }, h('button', { class: 'btn', onclick: () => { pending = null; go(p.back); } }, 'Cancel'),
      h('button', { class: 'btn primary', disabled: t.add + t.fill ? null : true, onclick: async () => {
        await flush();
        const fresh = planImport(await db.all('certs'), p.file, { forceCertId: p.certId }); let n = 0;
        for (const it of fresh.items) {
          if (!it.ops.some((o) => o.action !== 'skip')) continue;
          const m = finish(it.merged); await db.put('certs', m); if (S.cert && S.cert.id === m.id) S.cert = m;
          if (m.jobId) await touchJob(m.jobId); n++;
        }
        pending = null; toast(`Imported into ${n} certificate(s): ${t.add} added, ${t.fill} filled`, 4000); go(p.back);
      } }, 'Import')),
  ];
  page('Import extra details', h('div', {}, fill(h('div'), body)), { back: p.back });
});
