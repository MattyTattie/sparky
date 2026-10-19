// =====================================================================
// app.js — screens: jobs, customers, settings, backup. The certificate
// screens are in certui.js, the schedule of test results in schedule.js.
// =====================================================================
import * as db from './db.js';
import { h, fill, toast, modal, confirmBox, fmtDate, pickFile, shrinkImage, blobToDataUrl, shareOrDownload, icon, emptyState, skeleton } from './ui.js';
import { S, flush, getProfile, getInstruments, calibrationWarnings, INSTRUMENT_KINDS, instrumentText, touchJob } from './state.js';
import { APP_NAME, APP_VERSION, APP_SLUG, DRIVE_ROOT } from './config.js';
import { TYPES, copyCertForJob } from './certmodel.js';
import { calibrationState } from './checks.js';
import { CHECK_NOTE } from './limits.js';
import * as backup from './backup.js';
import * as G from './gdrive.js';
import { dueList, nextFor, suggestFromCerts, dueState, icsFor } from './reminders.js';

const routes = [];
export const route = (re, fn) => routes.push([re, fn]);
export const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };

// The page frame: top bar + content (+ the bottom nav on the main tabs).
// v0.5 polish: icon buttons, a bottom nav, and decorate() puts the icon set
// on buttons and list rows so every screen looks the same.
const NAV = [['#/', 'briefcase', 'Jobs'], ['#/calc', 'calculator', 'Calculators'], ['#/customers', 'users', 'Customers'], ['#/settings', 'settings', 'Settings']];
const navFor = (hash) => { const p = hash.replace(/^#/, '') || '/'; if (p === '/') return '#/'; if (/^\/calc/.test(p)) return '#/calc'; if (p === '/customers') return '#/customers'; if (p === '/settings') return '#/settings'; return null; };
export function page(title, content, { back = null, sub = '', actions = [], wide = false } = {}) {
  const app = document.getElementById('app');
  const tab = navFor(location.hash);
  const main = h('main', { class: (wide ? 'wide ' : '') + (tab ? 'hasnav' : '') }, content);
  fill(app, 
    h('header', { class: 'top' },
      back ? h('button', { class: 'iconbtn', 'aria-label': 'Back', onclick: () => go(back) }, icon('arrowLeft', { size: 22 })) : h('span', { class: 'brandmark', 'aria-hidden': 'true' }, icon('zap', { size: 20 })),
      h('h1', {}, title, title === APP_NAME ? h('span', { class: 'beta' }, 'BETA') : null, sub ? h('span', { class: 'sub' }, sub) : null),
      actions),
    main,
    tab ? h('nav', { class: 'bottomnav', 'aria-label': 'Main' }, NAV.map(([href, ic, label]) => h('a', { href, class: 'navi' + (href === tab ? ' on' : ''), 'aria-current': href === tab ? 'page' : null }, icon(ic, { size: 22 }), h('span', {}, label)))) : null);
  decorate(app);
  window.scrollTo(0, 0);
}
// Icons on buttons by what they say (keeps the screens' code simple).
const BTN_ICONS = [[/^\+ ?/, 'plus'], [/^Take photo/, 'camera'], [/^Add from gallery|^Add logo|^Change logo/, 'image'], [/^Back up|^Connect Google/, 'cloudUp'], [/^Restore from Drive/, 'cloudDown'], [/^Restore from file|^Import/, 'download'], [/^Save backup file/, 'download'],
  [/^Copy/, 'copy'], [/^Delete|^Remove/, 'trash'], [/^View/, 'eye'], [/^Share/, 'share'], [/^Add to calendar/, 'calendar'], [/^Say readings/, 'mic'], [/^Use wording/, 'clipboard'], [/^Make PDF|^Make the PDF|PDF$/, 'fileText'], [/^Scan/, 'scan'], [/^Customers$/, 'users'], [/^Calculators$/, 'calculator'], [/^Settings$/, 'settings'], [/^Sign/, 'pen'], [/^Disconnect/, 'x']];
export function decorate(root) {
  root.querySelectorAll('.go').forEach((el) => { if (!el.querySelector('svg')) el.replaceChildren(icon('chevronRight', { size: 18 })); });
  root.querySelectorAll('main .btn:not(.noic), .modal .btn:not(.noic)').forEach((b) => {
    if (b.querySelector('svg') || b.classList.contains('ic')) return;
    const t = b.textContent.trim(); const m = BTN_ICONS.find(([re]) => re.test(t)); if (!m) return;
    const label = m[1] === 'plus' ? t.replace(/^\+ ?/, '') : t;
    b.replaceChildren(icon(m[1], { size: 18 }), h('span', {}, label));
  });
}
// Screens that fill parts in after page() (and pop-up sheets) get the icons too.
let decoT = 0;
new MutationObserver(() => { if (!decoT) decoT = requestAnimationFrame(() => { decoT = 0; decorate(document.body); }); }).observe(document.body, { childList: true, subtree: true });

export async function render() {
  await flush();
  const hash = location.hash.slice(1) || '/';
  // v0.5: grey placeholder rows if a page takes a moment (big jobs, PDFs).
  const skel = setTimeout(() => { const m = document.querySelector('#app main'); if (m) fill(m, skeleton(4)); }, 160);
  try {
    for (const [re, fn] of routes) { const m = re.exec(hash); if (m) { try { await fn(...m.slice(1)); } catch (e) { console.error(e); page('Something went wrong', h('div', { class: 'notice red' }, String(e.message || e)), { back: '#/' }); } return; } }
    go('#/');
  } finally { clearTimeout(skel); }
}
window.addEventListener('hashchange', render);

// ---------- Home: jobs ----------
const jobLine = (j, cust) => [cust && cust.name, (j.siteAddress || '').split(/[,\n]/)[0]].filter(Boolean).join(' · ');
route(/^\/$/, async () => {
  const [jobs, customers, warns, certs] = await Promise.all([db.all('jobs'), db.all('customers'), calibrationWarnings(), db.all('certs')]);
  const cmap = Object.fromEntries(customers.map((c) => [c.id, c]));
  jobs.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const list = h('div', { class: 'list' });
  const draw = (q = '') => {
    const qq = q.toLowerCase();
    const shown = jobs.filter((j) => !qq || [j.title, j.siteAddress, j.sitePostcode, (cmap[j.customerId] || {}).name].join(' ').toLowerCase().includes(qq));
    fill(list, ...(shown.length ? shown.map((j) => {
      const n = certs.filter((c) => c.jobId === j.id);
      return h('a', { class: 'row', href: '#/job/' + j.id }, h('span', { class: 'tile' }, icon('briefcase', { size: 20 })),
        h('div', { class: 'main' }, h('div', { class: 't' }, j.title || 'Job'), h('div', { class: 's' }, jobLine(j, cmap[j.customerId]) || 'No customer yet')),
        n.length ? h('span', { class: 'pill' }, n.map((c) => (TYPES[c.type] || { short: c.type || '?' }).short).join(', ')) : null, h('span', { class: 'go' }, '›'));
    }) : [jobs.length ? emptyState('search', `No jobs match “${q}”.`) : emptyState('briefcase', 'No jobs yet. Start one, then add its certificates.', h('button', { class: 'btn primary', onclick: () => go('#/newjob') }, '+ New job'))]));
  };
  draw();
  const profile = await getProfile();
  page(APP_NAME, [
    !profile.name ? h('a', { class: 'notice info', href: '#/settings', style: 'display:block;text-decoration:none' }, 'First, add your details, logo and test instruments in Settings. They fill in every certificate for you.') : null,
    warns.map((w) => h('a', { class: 'notice ' + w.level, href: '#/settings', style: 'display:block;text-decoration:none' }, w.text)),
    dueCard(jobs, certs, cmap),
    jobs.length ? h('label', { class: 'searchbox' }, icon('search', { size: 18 }), h('input', { class: 'search', type: 'search', placeholder: 'Search jobs, customers, addresses', 'aria-label': 'Search jobs', oninput: (e) => draw(e.target.value) })) : null,
    jobs.length ? h('h2', { class: 'sec' }, `Jobs (${jobs.length})`) : null,
    list,
    h('p', { class: 'note' }, `${APP_NAME} ${APP_VERSION}. Everything is saved on this phone as you type. `, h('a', { href: '#/settings' }, 'Back up to Google Drive'), '.'),
    jobs.length ? h('button', { class: 'btn primary fab', onclick: () => go('#/newjob') }, '+ New job') : null,
  ], { actions: [h('button', { class: 'iconbtn', 'aria-label': 'Settings', onclick: () => go('#/settings') }, icon('settings', { size: 20 }))] });
});

// Inspections due in the next 90 days (or overdue), from each job's next inspection date.
function dueCard(jobs, certs, cmap) {
  const due = dueList(jobs, certs);
  if (!due.length) return null;
  const when = (d) => d.state === 'overdue' ? `Overdue ${-d.days} day${d.days === -1 ? '' : 's'}` : d.days === 0 ? 'Due today' : `In ${d.days} day${d.days === 1 ? '' : 's'}`;
  return h('div', { class: 'card duecard' }, h('h2', {}, `Due soon (${due.length})`),
    h('div', { class: 'list' }, due.map((d) => h('a', { class: 'row', href: '#/job/' + d.job.id },
      h('div', { class: 'main' }, h('div', { class: 't' }, d.job.title || 'Job'), h('div', { class: 's' }, [jobLine(d.job, cmap[d.job.customerId]), 're-test ' + fmtDate(d.date)].filter(Boolean).join(' · '))),
      h('span', { class: 'pill ' + (d.state === 'overdue' ? 'red' : 'amber') }, when(d)), h('span', { class: 'go' }, '›')))),
    h('p', { class: 'note' }, 'From the next inspection date on each job (set on the job page). Inspections due within 90 days show here.'));
}

// ---------- New job (with saved customers) ----------
route(/^\/newjob(?:\/(.+))?$/, async (custId) => {
  const customers = (await db.all('customers')).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const v = { title: '', name: '', address: '', postcode: '', phone: '', email: '', siteSame: true, siteAddress: '', sitePostcode: '', notes: '', customerId: custId || '' };
  const fillFrom = (c) => { Object.assign(v, { customerId: c.id, name: c.name || '', address: c.address || '', postcode: c.postcode || '', phone: c.phone || '', email: c.email || '' }); };
  if (custId) { const c = customers.find((x) => x.id === custId); if (c) fillFrom(c); }
  const form = h('div');
  const inp = (k, label, type = 'text', x = {}) => h('label', { class: 'f' }, h('span', {}, label), h(type === 'area' ? 'textarea' : 'input', { type: type === 'area' ? null : type, value: v[k], oninput: (e) => { v[k] = e.target.value; if (k === 'name') suggest(e.target.value); }, ...x }));
  const sugg = h('div', { class: 'list', style: 'display:none' });
  const suggest = (q) => {
    const m = q.length < 2 ? [] : customers.filter((c) => (c.name || '').toLowerCase().includes(q.toLowerCase())).slice(0, 5);
    sugg.style.display = m.length ? '' : 'none';
    fill(sugg, ...m.map((c) => h('button', { class: 'row', onclick: () => { fillFrom(c); draw(); toast('Filled in from your saved customers'); } }, h('div', { class: 'main' }, h('div', { class: 't' }, c.name), h('div', { class: 's' }, [c.address, c.postcode].filter(Boolean).join(', '))))));
  };
  const draw = () => {
    fill(form, 
      h('div', { class: 'card' }, h('h2', {}, 'Job'), inp('title', 'What\u2019s the job? (e.g. Consumer unit change)')),
      h('div', { class: 'card' }, h('h2', {}, 'Customer'),
        customers.length ? h('label', { class: 'f' }, h('span', {}, 'Saved customer'), h('select', { onchange: (e) => { const c = customers.find((x) => x.id === e.target.value); if (c) fillFrom(c); else Object.assign(v, { customerId: '', name: '', address: '', postcode: '', phone: '', email: '' }); draw(); } },
          h('option', { value: '' }, '— New customer —'), customers.map((c) => h('option', { value: c.id, selected: c.id === v.customerId ? true : null }, c.name)))) : null,
        inp('name', 'Name'), sugg, inp('address', 'Address', 'area'), inp('postcode', 'Postcode'),
        h('div', { class: 'grid2' }, inp('phone', 'Phone', 'tel'), inp('email', 'Email', 'email'))),
      h('div', { class: 'card' }, h('h2', {}, 'Where the work is'),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: v.siteSame, onchange: (e) => { v.siteSame = e.target.checked; draw(); } }), 'Same as the customer\u2019s address'),
        v.siteSame ? null : [inp('siteAddress', 'Installation address', 'area'), inp('sitePostcode', 'Postcode')],
        inp('notes', 'Notes', 'area')),
      h('div', { class: 'btns full' }, h('button', { class: 'btn primary', onclick: create }, 'Create job')));
  };
  const create = async () => {
    if (!v.name.trim() && !v.title.trim()) return toast('Add a job title or customer name');
    let cid = v.customerId;
    const cust = { id: cid || db.newId(), name: v.name.trim(), address: v.address.trim(), postcode: v.postcode.trim().toUpperCase(), phone: v.phone, email: v.email, updatedAt: new Date().toISOString() };
    if (cust.name) { const old = cid ? await db.get('customers', cid) : null; await db.put('customers', { ...(old || { createdAt: cust.updatedAt }), ...cust }); cid = cust.id; }
    const job = { id: db.newId(), customerId: cust.name ? cid : '', title: v.title.trim() || 'Job', siteAddress: v.siteSame ? cust.address : v.siteAddress.trim(), sitePostcode: v.siteSame ? cust.postcode : v.sitePostcode.trim().toUpperCase(), notes: v.notes, status: 'open', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1 };
    await db.put('jobs', job); go('#/job/' + job.id);
  };
  draw();
  page('New job', form, { back: '#/' });
});

// ---------- Job page ----------
route(/^\/job\/([^/]+)$/, async (id) => {
  const job = await db.get('jobs', id); if (!job) return go('#/');
  const cust = job.customerId ? await db.get('customers', job.customerId) : null;
  const certs = (await db.byJob('certs', id)).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  const files = await db.byJob('files', id);
  const photos = files.filter((f) => f.kind === 'photo');
  const pdfs = files.filter((f) => f.kind === 'pdf' || f.kind === 'chart');
  const save = async () => { job.updatedAt = new Date().toISOString(); job.version = (job.version || 0) + 1; await db.put('jobs', job); };
  const txt = (k, label, type = 'text') => h('label', { class: 'f' }, h('span', {}, label), h(type === 'area' ? 'textarea' : 'input', { value: job[k] || '', oninput: (e) => { job[k] = e.target.value; save(); } }));
  const addPhotos = async (capture) => {
    const fs = await pickFile({ accept: 'image/*', capture, multiple: !capture });
    for (const f of fs) { const b = await shrinkImage(f); await db.put('files', { id: db.newId(), jobId: id, kind: 'photo', name: `photo-${Date.now()}.jpg`, blob: b, caption: '', createdAt: new Date().toISOString(), version: 1 }); }
    if (fs.length) { await save(); render(); }
  };
  const photoView = async (f) => {
    const cap = h('input', { value: f.caption || '', placeholder: 'Caption (shows under the photo on certificates)' });
    const r = await modal('Photo', h('div', {}, h('img', { src: URL.createObjectURL(f.blob), style: 'width:100%;border-radius:8px;margin-bottom:8px' }), cap), [{ label: 'Delete', value: 'del', cls: 'warn' }, { label: 'Done', value: 'ok', cls: 'primary' }]);
    if (r === 'del') { if (await confirmBox('Delete photo?', 'This removes it from the phone.', 'Delete', 'warn')) { await db.del('files', f.id); render(); } return; }
    if (r === 'ok' && cap.value !== (f.caption || '')) { f.caption = cap.value; f.version = (f.version || 1) + 1; await db.put('files', f); }
  };
  const newCert = async (type) => { const { createCert } = await import('./certui.js'); const c = await createCert(type, job, cust); go('#/cert/' + c.id); };
  const copyJob = async () => {
    if (!(await confirmBox('Copy this job?', 'Makes a new job for the same customer, with copies of the certificates: installation details, boards and circuit details are kept; readings, signatures and dates are cleared.', 'Copy job'))) return;
    const nj = { ...job, id: db.newId(), title: job.title + ' (copy)', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1, driveFolderId: null, driveJsonId: null, backedUpAt: null };
    await db.put('jobs', nj);
    for (const c of certs) await db.put('certs', copyCertForJob(c, { job: nj, customer: cust || {}, number: await db.nextNumber(TYPES[c.type].prefix) }));
    toast('Job copied'); go('#/job/' + nj.id);
  };
  const doBackup = async (btn) => {
    btn.disabled = true; btn.textContent = 'Backing up…';
    try { await G.getToken({ interactive: true, email: G.accountHint() }); await backup.backupJob(id, { onStep: (s) => (btn.textContent = s) }); toast('Saved to Google Drive'); render(); }
    catch (e) { toast(e.message || 'Backup failed'); btn.disabled = false; btn.textContent = 'Back up to Drive'; }
  };
  const delJob = async () => {
    if (!(await confirmBox('Delete this job?', `Deletes the job, its ${certs.length} certificate(s) and ${photos.length} photo(s) from this phone. Anything already in Google Drive stays there.`, 'Delete', 'warn'))) return;
    for (const c of certs) await db.del('certs', c.id); for (const f of files) await db.del('files', f.id); await db.del('jobs', id); go('#/');
  };
  const { dcPlansCard } = await import('./calcdcplan.js'); // v0.6: optional job.dcPlans
  const status = (c) => c.status === 'issued' ? h('span', { class: 'pill green' }, 'Issued') : h('span', { class: 'pill' }, 'Draft');
  page(job.title || 'Job', [
    h('div', { class: 'card' }, h('h2', {}, 'Certificates'),
      certs.length ? h('div', { class: 'list' }, certs.map((c) => h('a', { class: 'row', href: '#/cert/' + c.id }, h('span', { class: 'tile' }, icon('fileCheck', { size: 20 })), h('div', { class: 'main' }, h('div', { class: 't' }, `${TYPES[c.type].name}`), h('div', { class: 's' }, `${c.number} · updated ${fmtDate(c.updatedAt)}`)), status(c), h('span', { class: 'go' }, '›')))) : emptyState('fileText', 'No certificates yet. Pick one below to start.'),
      h('div', { class: 'btns full' }, h('button', { class: 'btn primary', onclick: () => newCert('EIC') }, '+ EIC'), h('button', { class: 'btn primary', onclick: () => newCert('MW') }, '+ Minor Works'), h('button', { class: 'btn primary', onclick: () => newCert('EICR') }, '+ EICR'))),
    nextCard(job, certs, cust, save),
    h('div', { class: 'card' }, h('h2', {}, 'Customer'),
      cust ? h('a', { class: 'row', href: '#/customer/' + cust.id, style: 'padding:6px 0' }, h('div', { class: 'main' }, h('div', { class: 't' }, cust.name), h('div', { class: 's' }, [cust.address, cust.postcode].filter(Boolean).join(', '))), h('span', { class: 'go' }, '›')) : h('p', { class: 'note' }, 'No customer.'),
      txt('title', 'Job title'), txt('siteAddress', 'Installation address', 'area'), txt('sitePostcode', 'Postcode'), txt('notes', 'Notes', 'area')),
    h('div', { class: 'card' }, h('h2', {}, `Photos (${photos.length})`),
      photos.length ? h('div', { class: 'photos' }, photos.map((f) => h('img', { src: URL.createObjectURL(f.blob), alt: f.caption || 'Photo', onclick: () => photoView(f) }))) : emptyState('camera', 'No photos yet. Add the board, labels and any defects.'),
      h('div', { class: 'btns full' }, h('button', { class: 'btn', onclick: () => addPhotos(true) }, 'Take photo'), h('button', { class: 'btn', onclick: () => addPhotos(false) }, 'Add from gallery'))),
    dcPlansCard(job, save, render),
    pdfs.length ? h('div', { class: 'card' }, h('h2', {}, 'Saved PDFs'), h('div', { class: 'list' }, pdfs.map((f) => h('div', { class: 'row pdfrow' }, h('div', { class: 'main' }, h('div', { class: 't' }, f.name), h('div', { class: 's' }, 'Made ' + fmtDate(f.createdAt))),
      h('button', { class: 'btn small', onclick: async () => (await import('./pdfview.js')).viewPdf(f.blob, f.name) }, 'View'),
      h('button', { class: 'btn small', 'aria-label': 'Share ' + f.name, onclick: () => shareOrDownload(f.blob, f.name) }, 'Share'))))) : null,
    h('div', { class: 'card' }, h('h2', {}, 'Backup'),
      h('p', { class: 'note' }, job.backedUpAt ? `In Google Drive (folder “${backup.jobFolderName(job, cust)}”), last saved ${new Date(job.backedUpAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}${(job.version || 0) > (job.backedUpVersion || 0) ? ' — changed since.' : '.'}` : 'Saved on this phone. Not in Google Drive yet.'),
      h('div', { class: 'btns full' }, G.isConfigured() ? h('button', { class: 'btn', onclick: (e) => doBackup(e.currentTarget) }, 'Back up to Drive') : null, h('button', { class: 'btn', onclick: copyJob }, 'Copy job'), h('button', { class: 'btn warn', onclick: delJob }, 'Delete job'))),
  ], { back: '#/', sub: cust ? cust.name : '' });
});

// Next inspection (re-test reminder) for a job.
function nextCard(job, certs, cust, save) {
  const box = h('div', { class: 'card' });
  const draw = () => {
    const sug = suggestFromCerts(certs); const n = nextFor(job, certs); const st = n && dueState(n.date);
    fill(box, h('h2', {}, 'Next inspection'),
      st ? h('div', { class: 'notice ' + (st.state === 'overdue' ? 'red' : st.state === 'soon' ? 'amber' : 'info') }, st.state === 'overdue' ? `Overdue since ${fmtDate(n.date)}.` : `Due ${fmtDate(n.date)} (in ${st.days} days).`, n.set ? '' : ` From ${n.from}.`) : h('p', { class: 'note' }, 'No date yet. Fill in “Next inspection” on the EICR (or EIC), or set one here.'),
      h('label', { class: 'f' }, h('span', {}, 'Re-test due (leave blank to use the certificate)'), h('input', { type: 'date', value: job.nextInspection || '', onchange: async (e) => { job.nextInspection = e.target.value; await save(); draw(); } })),
      sug && job.nextInspection && sug.date !== job.nextInspection ? h('button', { class: 'btn small', onclick: async () => { job.nextInspection = ''; await save(); draw(); } }, `Use ${sug.from}: ${fmtDate(sug.date)}`) : null,
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !job.remindOff, onchange: async (e) => { job.remindOff = !e.target.checked; await save(); } }), 'Show on “Due soon” on the jobs page'),
      n ? h('div', { class: 'btns' }, h('button', { class: 'btn small', onclick: async () => {
        const where = [job.siteAddress, job.sitePostcode].filter(Boolean).join(', ');
        const ics = icsFor({ uid: job.id + '-' + n.date, date: n.date, title: `Electrical inspection due: ${[cust && cust.name, (job.siteAddress || '').split(/[,\n]/)[0]].filter(Boolean).join(', ') || job.title}`, location: where, notes: `${job.title || ''}. Re-test due (from ${n.set ? 'the job' : n.from}). Made by ${APP_NAME}.` });
        const r = await shareOrDownload(new Blob([ics], { type: 'text/calendar' }), `inspection-due-${n.date}.ics`); if (r === 'downloaded') toast('Calendar file saved: open it to add the reminder');
      } }, 'Add to calendar')) : null,
      h('p', { class: 'note' }, 'The calendar file has a reminder a month before. It stays on your phone: nothing is sent to the customer.'));
  };
  draw(); return box;
}

// ---------- Customers ----------
route(/^\/customers$/, async () => {
  const cs = (await db.all('customers')).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const jobs = await db.all('jobs');
  page('Customers', [
    h('p', { class: 'note' }, 'Customers are saved when you make a job. Pick one on a new job and their details fill in.'),
    cs.length ? h('div', { class: 'list' }, cs.map((c) => h('a', { class: 'row', href: '#/customer/' + c.id }, h('span', { class: 'tile initials' }, (c.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')), h('div', { class: 'main' }, h('div', { class: 't' }, c.name), h('div', { class: 's' }, [c.address, c.postcode].filter(Boolean).join(', '))), h('span', { class: 'pill' }, ((n) => n + (n === 1 ? ' job' : ' jobs'))(jobs.filter((j) => j.customerId === c.id).length)), h('span', { class: 'go' }, '›')))) : emptyState('users', 'No customers yet. They\u2019re saved when you make a job.', h('a', { class: 'btn primary', href: '#/newjob' }, '+ New job')),
  ], { back: '#/' });
});
route(/^\/customer\/([^/]+)$/, async (id) => {
  const c = await db.get('customers', id); if (!c) return go('#/customers');
  const jobs = (await db.all('jobs')).filter((j) => j.customerId === id);
  const save = async () => { c.updatedAt = new Date().toISOString(); await db.put('customers', c); };
  const txt = (k, label, type = 'text') => h('label', { class: 'f' }, h('span', {}, label), h(type === 'area' ? 'textarea' : 'input', { type: type === 'area' ? null : type, value: c[k] || '', oninput: (e) => { c[k] = e.target.value; save(); } }));
  page(c.name || 'Customer', [
    h('div', { class: 'card' }, txt('name', 'Name'), txt('address', 'Address', 'area'), txt('postcode', 'Postcode'), h('div', { class: 'grid2' }, txt('phone', 'Phone', 'tel'), txt('email', 'Email', 'email')), txt('notes', 'Notes', 'area')),
    h('div', { class: 'card' }, h('h2', {}, 'Jobs'), h('div', { class: 'list' }, jobs.map((j) => h('a', { class: 'row', href: '#/job/' + j.id }, h('div', { class: 'main' }, h('div', { class: 't' }, j.title), h('div', { class: 's' }, fmtDate(j.createdAt))), h('span', { class: 'go' }, '›')))),
      h('div', { class: 'btns full' }, h('a', { class: 'btn primary', href: '#/newjob/' + id }, '+ New job for this customer'))),
    !jobs.length ? h('button', { class: 'btn warn', onclick: async () => { if (await confirmBox('Delete customer?', 'They have no jobs.', 'Delete', 'warn')) { await db.del('customers', id); go('#/customers'); } } }, 'Delete customer') : null,
  ], { back: '#/customers' });
});

// ---------- Settings: you, your logo, test instruments, backup ----------
route(/^\/settings$/, async () => {
  const p = await getProfile();
  const ins = await getInstruments();
  const saveP = () => db.setMeta('profile', p);
  const saveI = () => db.setMeta('instruments', ins);
  const txt = (k, label, type = 'text', ph = '') => h('label', { class: 'f' }, h('span', {}, label), h('input', { type, value: p[k] || '', placeholder: ph, oninput: (e) => { p[k] = e.target.value; saveP(); } }));
  const logoBox = h('div');
  const drawLogo = () => fill(logoBox, p.logo ? h('img', { src: p.logo, style: 'max-height:70px;max-width:220px;display:block;margin-bottom:8px' }) : h('p', { class: 'note' }, 'No logo yet.'),
    h('div', { class: 'btns' }, h('button', { class: 'btn small', onclick: async () => { const [f] = await pickFile({ accept: 'image/*' }); if (!f) return; const b = await shrinkImage(f, 600, 0.9, 'image/png'); p.logo = await blobToDataUrl(b); await saveP(); drawLogo(); } }, p.logo ? 'Change logo' : 'Add logo'), p.logo ? h('button', { class: 'btn small warn', onclick: async () => { delete p.logo; await saveP(); drawLogo(); } }, 'Remove') : null));
  drawLogo();
  const sigBox = h('div');
  const drawSig = async () => { const s = await db.getMeta('mysig'); fill(sigBox, s ? h('img', { class: 'sigimg', src: s }) : h('p', { class: 'note' }, 'No saved signature. You can save one the first time you sign a certificate.'), s ? h('div', { class: 'btns' }, h('button', { class: 'btn small warn', onclick: async () => { await db.setMeta('mysig', null); drawSig(); } }, 'Remove saved signature')) : null); };
  drawSig();
  const insBox = h('div');
  const drawIns = () => fill(insBox, ...ins.map((i, n) => {
    const st = calibrationState(i.calDue);
    const f = (k, label, type = 'text') => h('label', { class: 'f' }, h('span', {}, label), h('input', { type, value: i[k] || '', oninput: (e) => { i[k] = e.target.value; saveI(); if (k === 'calDue') drawIns(); } }));
    return h('div', { class: 'card' },
      st === 'out' ? h('div', { class: 'notice red' }, 'Calibration out of date.') : st === 'soon' ? h('div', { class: 'notice amber' }, 'Calibration due within a month.') : null,
      h('div', { class: 'grid2' }, f('make', 'Make'), f('model', 'Model')), h('div', { class: 'grid2' }, f('serial', 'Serial / asset no.'), f('calDue', 'Calibration due', 'date')),
      h('div', { class: 'note', style: 'margin-bottom:6px' }, 'Used for:'),
      h('div', { class: 'chips' }, INSTRUMENT_KINDS.map(([k, label]) => h('button', { class: 'chip' + ((i.kinds || []).includes(k) ? ' on' : ''), onclick: () => { i.kinds = (i.kinds || []).includes(k) ? i.kinds.filter((x) => x !== k) : [...(i.kinds || []), k]; saveI(); drawIns(); } }, label))),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: i.inUse !== false, onchange: (e) => { i.inUse = e.target.checked; saveI(); } }), 'Fill this in on new certificates'),
      h('button', { class: 'btn small warn', onclick: async () => { if (await confirmBox('Remove instrument?', instrumentText(i) || 'This instrument', 'Remove', 'warn')) { ins.splice(n, 1); saveI(); drawIns(); } } }, 'Remove'));
  }), h('button', { class: 'btn', onclick: () => { ins.push({ id: db.newId(), make: '', model: '', serial: '', calDue: '', kinds: ins.length ? [] : ['multi', 'continuity', 'ir', 'efli', 'rcd'], inUse: true }); saveI(); drawIns(); } }, '+ Add test instrument'));
  drawIns();

  // Backup
  const driveBox = h('div');
  const drawDrive = () => {
    const signed = G.hasToken() || G.accountHint();
    fill(driveBox, 
      h('p', { class: 'note' }, 'Each job gets its own folder in your Google Drive (“' + DRIVE_ROOT + '”), with its photos, PDFs and a data file. The app can only see files it made itself. Nothing is shared with anyone.'),
      signed ? h('p', {}, 'Connected' + (G.accountHint() ? ' as ' + G.accountHint() : '') + '.') : null,
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!p.autoBackup, onchange: (e) => { p.autoBackup = e.target.checked; saveP(); } }), 'Back up a job automatically when I leave it (needs signal)'),
      h('div', { class: 'btns full' },
        h('button', { class: 'btn primary', onclick: async (e) => { const b = e.currentTarget; b.disabled = true; try { await G.getToken({ interactive: true, choose: !signed }); try { const me = await G.whoAmI(); G.rememberAccount(me && me.user && me.user.emailAddress); } catch {} const jobs = await db.all('jobs'); let n = 0; for (const j of jobs) { b.textContent = `Backing up ${++n} of ${jobs.length}…`; await backup.backupJob(j.id); } say(`Backed up ${jobs.length} job(s).`, 'green'); } catch (err) { say('Backup failed. ' + (err.message || err), 'red'); } b.disabled = false; drawDrive(); } }, signed ? 'Back up all jobs now' : 'Connect Google Drive'),
        signed ? h('button', { class: 'btn', onclick: restoreFromDrive }, 'Restore from Drive') : null,
        signed ? h('button', { class: 'btn', onclick: async () => { await G.revoke(); G.rememberAccount(''); drawDrive(); } }, 'Disconnect') : null),
      driveMsg);
    if (signed) G.warmUp(); // load Google's script now, so the tap can open its window straight away
  };
  // v0.5: every step and every failure shows in a box under the buttons
  // (a toast was easy to miss, and some failures showed nothing at all).
  const driveMsg = h('div', { class: 'drivemsg', role: 'status', 'aria-live': 'polite' });
  const say = (text, kind = 'info', extra = null) => fill(driveMsg, text ? h('div', { class: 'notice ' + kind }, h('div', {}, text), extra) : null);
  const restoreFromDrive = async (e) => {
    const btn = e && e.currentTarget; if (btn) btn.disabled = true;
    // Ask Google straight away, inside the tap (Safari blocks the window otherwise).
    const tokenP = G.getToken({ interactive: true, email: G.accountHint() });
    say('Signing in to Google… If a Google window opens, finish signing in there.');
    const slow = setTimeout(() => say('Still waiting for Google. If no Google window appeared, the browser may have blocked it: allow pop-ups for this site and tap Restore again.', 'amber'), 12000);
    let step = 'sign-in';
    try {
      await tokenP; clearTimeout(slow);
      step = 'list'; say('Looking for backups in your Drive…');
      const list = await backup.listDriveJobs();
      if (!list.length) { say('No backups found in your Drive (“' + DRIVE_ROOT + '” folder is empty). On the other device, open Settings and tap “Back up all jobs now” first, then try again here.', 'amber'); return; }
      say('');
      const chosen = new Set();
      const pick = await modal('Restore a job from Drive', h('div', { class: 'list' }, list.map((f) => h('label', { class: 'row' }, h('input', { type: 'checkbox', value: f.id, class: 'rj', onchange: (ev) => { if (ev.target.checked) chosen.add(f.id); else chosen.delete(f.id); } }), h('div', { class: 'main' }, h('div', { class: 't' }, f.name), f.modified ? h('div', { class: 's' }, 'Backed up ' + fmtDate(f.modified)) : null)))), [{ label: 'Cancel', value: false }, { label: 'Restore', value: true, cls: 'primary' }]);
      if (!pick) { say('Restore cancelled. Nothing was changed.'); return; }
      const ids = [...chosen];
      if (!ids.length) { say('No job was ticked, so nothing was restored. Tap Restore from Drive and tick a job.', 'amber'); return; }
      step = 'download';
      const failed = []; let ok = 0;
      for (const fid of ids) {
        const name = (list.find((f) => f.id === fid) || {}).name || 'job';
        say(`Restoring ${ok + failed.length + 1} of ${ids.length}: ${name}…`);
        try { await backup.restoreDriveJob(fid); ok++; } catch (err) { failed.push(`${name}: ${err.message || err}`); }
      }
      if (failed.length) { say(`Restored ${ok} of ${ids.length}. These didn\u2019t work:`, 'red', h('ul', {}, failed.map((t) => h('li', {}, t)))); return; }
      toast(`Restored ${ok} job(s)`); location.hash = '#/';
    } catch (err) {
      clearTimeout(slow);
      const what = step === 'sign-in' ? 'Couldn\u2019t sign in to Google. ' : step === 'list' ? 'Couldn\u2019t read your backups from Drive. ' : 'Restore failed. ';
      say(what + (err && err.message ? err.message : String(err)), 'red');
    } finally { if (btn) btn.disabled = false; }
  };
  drawDrive();
  page('Settings', [
    h('div', { class: 'card' }, h('h2', {}, 'You'), h('p', { class: 'note' }, 'Shown on your certificates. Kept on this phone (and in your Drive backup), never in the app\u2019s code.'),
      txt('name', 'Your name'), txt('business', 'Business name'), txt('position', 'Position', 'text', 'e.g. Proprietor'),
      txt('address1', 'Address line 1'), txt('address2', 'Address line 2'), h('div', { class: 'grid2' }, txt('town', 'Town'), txt('postcode', 'Postcode')),
      h('div', { class: 'grid2' }, txt('phone', 'Phone', 'tel'), txt('email', 'Email', 'email')),
      txt('regNo', 'Registration / membership no. (optional)'), txt('certPrefix', 'Certificate number prefix (optional)', 'text', 'e.g. SS-')),
    h('div', { class: 'card' }, h('h2', {}, 'Logo'), logoBox),
    h('div', { class: 'card' }, h('h2', {}, 'Signature'), sigBox),
    h('h2', { class: 'sec' }, 'Test instruments'), h('p', { class: 'note' }, 'Fills the instruments box on every new certificate. You\u2019ll get a warning a month before calibration is due, and when it\u2019s out of date.'), insBox,
    h('div', { class: 'card' }, h('h2', {}, 'Google Drive backup'), G.isConfigured() ? driveBox : h('p', { class: 'note' }, 'Not set up in this build.')),
    h('div', { class: 'card' }, h('h2', {}, 'Backup file'), h('p', { class: 'note' }, 'Everything in one file you can keep anywhere. Restoring adds to what\u2019s here; nothing is deleted.'),
      h('div', { class: 'btns full' },
        h('button', { class: 'btn', onclick: async () => { const b = await backup.exportAll(); await shareOrDownload(b, `${APP_SLUG}-backup-${new Date().toISOString().slice(0, 10)}.json`); } }, 'Save backup file'),
        h('button', { class: 'btn', onclick: async () => { const [f] = await pickFile({ accept: '.json,application/json' }); if (!f) return; try { const n = await backup.importAll(await f.text()); toast(`Restored ${n} item(s)`); } catch (e) { toast(e.message); } } }, 'Restore from file'))),
    h('div', { class: 'notice amber' }, CHECK_NOTE),
    h('p', { class: 'note' }, `${APP_NAME} ${APP_VERSION}. Forms follow the IET model forms for BS 7671:2018+A4:2026. Not affiliated with the IET.`),
  ], { back: '#/' });
});

// Auto-backup when leaving a job or certificate (only if switched on and signed in).
let lastJob = null;
window.addEventListener('hashchange', async (e) => {
  const prev = /#\/(?:job|cert)\/([^/]+)/.exec(e.oldURL || '');
  const id = prev && (prev[0].includes('/cert/') ? (await db.get('certs', prev[1]) || {}).jobId : prev[1]);
  if (!id || id === lastJob && location.hash.includes(id)) return;
  const p = await getProfile(); if (!p.autoBackup || !G.isConfigured() || !navigator.onLine) return;
  if (location.hash.includes(id)) return;
  // Still inside one of this job's certificates (e.g. certificate → board → back): not leaving the job yet.
  const now = /#\/cert\/([^/]+)/.exec(location.hash);
  if (now && ((await db.get('certs', now[1])) || {}).jobId === id) return;
  const job = await db.get('jobs', id); if (!job || (job.version || 0) <= (job.backedUpVersion || 0)) return;
  try { await G.getToken({ interactive: false }); await backup.backupJob(id); } catch {}
});

export { S, touchJob };
