// =====================================================================
// app.js — screens: jobs, customers, settings, backup. The certificate
// screens are in certui.js, the schedule of test results in schedule.js.
// =====================================================================
import { limitOn, setLimitOn, limitDemo } from './limitbar.js';
import { pdfFlagsDefault, setPdfFlagsDefault } from './certmodel.js';
import { pdfRows, madeAt } from './pdflist.js';
import { nextStep } from './jobnext.js';
import * as db from './db.js';
import { h, fill, toast, modal, confirmBox, fmtDate, pickFile, shrinkImage, blobToDataUrl, shareOrDownload, icon, emptyState, skeleton, withIcon } from './ui.js';
import { S, flush, getProfile, getInstruments, calibrationWarnings, INSTRUMENT_KINDS, INSTRUMENT_TAGS, instrumentText, touchJob, saveSetting } from './state.js';
import { looksLikeCalDate, CAL_DATE_WARN } from './instruments.js';
import { labelInputs } from './a11y.js';
import { APP_NAME, APP_VERSION, APP_SLUG, DRIVE_ROOT, DRIVE_ROOT_OLD } from './config.js';
import { TYPES, copyCertForJob } from './certmodel.js';
import { diagramHasCircuits } from './wiring.js';
import { JOB_COLS, jobRows, sortRows } from './jobtable.js';
import { calibrationState } from './checks.js';
import { CHECK_NOTE } from './limits.js';
import * as backup from './backup.js';
import * as G from './gdrive.js';
import * as sync from './sync.js';
import * as presets from './presets.js';
import { dueList, nextFor, suggestFromCerts, dueState, icsFor } from './reminders.js';

const routes = [];
export const route = (re, fn) => routes.push([re, fn]);
export const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };

// The page frame: top bar + content (+ the bottom nav on the main tabs).
// v0.5 polish: icon buttons, a bottom nav, and decorate() puts the icon set
// on buttons and list rows so every screen looks the same.
const NAV = [['#/', 'briefcase', 'Jobs'], ['#/calc', 'calculator', 'Calculators'], ['#/customers', 'users', 'Customers'], ['#/settings', 'settings', 'Settings']];
const navFor = (hash) => { const p = hash.replace(/^#/, '') || '/'; if (p === '/') return '#/'; if (/^\/calc/.test(p)) return '#/calc'; if (p === '/customers') return '#/customers'; if (p === '/settings') return '#/settings'; return null; };
const DESK = window.matchMedia('(min-width: 900px)');
DESK.addEventListener('change', () => render());
const deskTabFor = (hash) => /^#\/(job|cert|newjob)/.test(hash) ? '#/' : /^#\/customer/.test(hash) ? '#/customers' : /^#\/settings/.test(hash) ? '#/settings' : null;
// v0.31: the job list can be hidden; remembered on this computer only (not synced, not in backups).
const PANE_KEY = 'sparky.jobpane';
function paneOpen() { try { return localStorage.getItem(PANE_KEY) !== 'closed'; } catch { return true; } }
function setPaneOpen(on) { try { localStorage.setItem(PANE_KEY, on ? 'open' : 'closed'); } catch {} render(); }
// v0.27: the job list beside a job or certificate on a wide screen (filled in after the page draws).
function jobPane() {
  const box = h('aside', { class: 'jobpane', 'aria-label': 'Jobs' }, h('div', { class: 'jobpane-h' }, h('b', {}, 'Jobs'), h('span', { class: 'jobpane-a' }, h('a', { href: '#/', class: 'small' }, 'All jobs'), h('button', { class: 'btn small panetoggle', 'aria-expanded': 'true', title: 'Hide the job list to give the certificate more room', onclick: () => setPaneOpen(false) }, '« Hide'))));
  const m = location.hash.match(/^#\/(job|cert)\/([^/]+)/);
  (async () => {
    const [jobs, customers, certs] = await Promise.all([db.all('jobs'), db.all('customers'), db.all('certs')]);
    const cmap = Object.fromEntries(customers.map((c) => [c.id, c]));
    const cur = m ? (m[1] === 'job' ? m[2] : (certs.find((c) => c.id === m[2]) || {}).jobId) : null;
    jobs.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    box.append(h('div', { class: 'list' }, jobs.map((j) => {
      const n = certs.filter((c) => c.jobId === j.id);
      return h('a', { class: 'row' + (j.id === cur ? ' on' : ''), href: '#/job/' + j.id, 'aria-current': j.id === cur ? 'page' : null },
        h('div', { class: 'main' }, h('div', { class: 't' }, j.title || 'Job'), h('div', { class: 's' }, jobLine(j, cmap[j.customerId]) || 'No customer yet'),
          n.length ? h('div', { class: 'rowtags' }, h('span', { class: 'pill' }, n.map((c) => (TYPES[c.type] || { short: c.type || '?' }).short).join(', '))) : null));
    })));
    const on = box.querySelector('.row.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
  })().catch(() => {});
  return box;
}
export function page(title, content, { back = null, sub = '', actions = [], wide = false } = {}) {
  const app = document.getElementById('app');
  const tab = navFor(location.hash);
  // v0.27: on a wide screen (900px+) the tabs become a sidebar on every page, and job/cert
  // pages get the job list beside them. Phones (below 900px) get exactly the old layout.
  const desk = DESK.matches;
  const dtab = tab || (desk ? deskTabFor(location.hash) : null);
  const listSpot = desk && !wide && /^#\/(job|cert)\//.test(location.hash);
  const listPane = listSpot && paneOpen(); // v0.31: Hide / Show jobs, remembered on this computer
  const calcPage = /^#\/calc\/./.test(location.hash);
  const main = h('main', { class: (wide ? 'wide ' : '') + (tab ? 'hasnav' : '') + (desk && calcPage ? ' calcpage' : '') + (listPane ? ' withlist' : '') }, content);
  document.body.classList.toggle('desk', desk); document.body.classList.toggle('withlist', listPane);
  fill(app, 
    h('header', { class: 'top' },
      back ? h('button', { class: 'iconbtn', 'aria-label': 'Back', onclick: () => go(back) }, icon('arrowLeft', { size: 22 })) : h('span', { class: 'brandmark', 'aria-hidden': 'true' }, h('img', { src: 'icons/icon.svg', alt: '', width: 36, height: 36 })),
      h('h1', {}, title, title === APP_NAME ? h('span', { class: 'beta' }, 'BETA') : null, sub ? h('span', { class: 'sub' }, sub) : null),
      listSpot && !listPane ? h('button', { class: 'btn small panetoggle', 'aria-expanded': 'false', title: 'Show the job list', onclick: () => setPaneOpen(true) }, '☰ Show jobs') : null,
      syncChip(), actions),
    main,
    (tab || desk) ? h('nav', { class: 'bottomnav', 'aria-label': 'Main' }, desk ? h('a', { class: 'sidebrand', href: '#/' }, h('img', { src: 'icons/icon.svg', alt: '', width: 34, height: 34 }), h('span', {}, h('b', {}, APP_NAME), h('small', {}, APP_VERSION))) : null,
      NAV.map(([href, ic, label]) => h('a', { href, class: 'navi' + (href === dtab ? ' on' : ''), 'aria-current': href === tab ? 'page' : null }, icon(ic, { size: 22 }), h('span', {}, label))),
      desk ? h('button', { class: 'btn primary sidenew', onclick: () => go('#/newjob') }, '+ New job') : null) : null,
    listPane ? jobPane() : null);
  decorate(app);
  window.scrollTo(0, 0);
}
// v0.9: small sync status in the top bar (hidden while sync is off).
// Tap: sign in again if needed, otherwise sync now.
function syncChip() {
  const st = sync.getStatus(); if (st.state === 'off') return null;
  const [t, c] = sync.statusText(st);
  return h('button', { id: 'syncchip', class: 'syncchip ' + c + (st.state === 'syncing' ? ' spin' : ''), 'aria-label': 'Sync: ' + t, title: st.message || t, onclick: () => (st.state === 'signin' ? sync.connect().catch((e) => toast(e.message || String(e))) : (st.state === 'error' ? go('#/settings') : sync.syncNow({ interactive: true }))) }, h('i', {}), h('span', {}, t));
}
sync.onStatus(() => { const old = document.getElementById('syncchip'); const top = document.querySelector('header.top'); if (!top) return; const n = syncChip(); if (old && n) old.replaceWith(n); else if (old) old.remove(); else if (n) top.insertBefore(n, top.querySelector('h1').nextSibling); });
// Something came in from the other device: redraw (not while typing in a box).
addEventListener('sparky:synced', () => { const a = document.activeElement; if (!(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) render(); });

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
  labelInputs(root);
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
  let draw = (q = '') => {
    const qq = q.toLowerCase();
    const shown = jobs.filter((j) => !qq || [j.title, j.siteAddress, j.sitePostcode, (cmap[j.customerId] || {}).name].join(' ').toLowerCase().includes(qq));
    fill(list, ...(shown.length ? shown.map((j) => {
      const n = certs.filter((c) => c.jobId === j.id);
      const tt = n.length ? ({ EICR: ' t-eicr', MW: ' t-mw' })[n[0].type] || '' : '';
      return h('a', { class: 'row', href: '#/job/' + j.id }, h('span', { class: 'tile' + tt }, icon(n.length ? 'fileCheck' : 'briefcase', { size: 20 })),
        h('div', { class: 'main' }, h('div', { class: 't' }, j.title || 'Job'), h('div', { class: 's' }, jobLine(j, cmap[j.customerId]) || 'No customer yet'),
          n.length ? h('div', { class: 'rowtags' }, h('span', { class: 'pill' }, n.map((c) => (TYPES[c.type] || { short: c.type || '?' }).short).join(', '))) : null), // v0.36: tags under the title, so words stay whole
        h('span', { class: 'go' }, '›'));
    }) : [jobs.length ? emptyState('search', `No jobs match “${q}”.`) : emptyState('briefcase', 'No jobs yet. Start one, then add its certificates.', h('button', { class: 'btn primary', onclick: () => go('#/newjob') }, '+ New job'))]));
  };
  // v0.28: on a wide screen the jobs are a sortable table instead of cards.
  if (DESK.matches) {
    const all = jobRows(jobs, certs, cmap, TYPES); let sk = 'updated', sd = -1, qq = '';
    const drawT = () => {
      const shown = sortRows(all.filter((r) => !qq || [r.job, r.customer, r.address].join(' ').toLowerCase().includes(qq)), sk, sd);
      fill(list, shown.length ? h('table', { class: 'jobtable' },
        h('thead', {}, h('tr', {}, JOB_COLS.map(([k, t]) => h('th', { scope: 'col', 'aria-sort': k === sk ? (sd > 0 ? 'ascending' : 'descending') : null },
          h('button', { type: 'button', class: 'sorth' + (k === sk ? ' on' : ''), onclick: () => { if (sk === k) sd = -sd; else { sk = k; sd = k === 'updated' ? -1 : 1; } drawT(); } }, t, k === sk ? h('span', { class: 'sortarrow', 'aria-hidden': 'true' }, sd > 0 ? ' \u25B2' : ' \u25BC') : null))))),
        h('tbody', {}, shown.map((r) => h('tr', { tabindex: 0, onclick: () => go('#/job/' + r.id), onkeydown: (e) => { if (e.key === 'Enter') go('#/job/' + r.id); } },
          h('td', { class: 'jt-job' }, h('a', { href: '#/job/' + r.id }, r.job)), h('td', {}, r.customer || '\u2014'), h('td', {}, r.address || '\u2014'),
          h('td', {}, r.certs || '\u2014'), h('td', {}, h('span', { class: 'jt-status ' + (r.status === 'Issued' ? 'ok' : r.status === 'Closed' ? 'na' : 'draft') }, r.status)), h('td', { class: 'jt-date' }, r.updated ? fmtDate(r.updated) : '\u2014'))))) 
        : (jobs.length ? emptyState('search', `No jobs match \u201c${qq}\u201d.`) : emptyState('briefcase', 'No jobs yet. Start one, then add its certificates.', h('button', { class: 'btn primary', onclick: () => go('#/newjob') }, '+ New job'))));
    };
    draw = (q = '') => { qq = q.toLowerCase(); drawT(); };
  }
  draw();
  const profile = await getProfile();
  page(APP_NAME, [
    !jobs.length ? h('a', { class: 'notice info newphone-link', href: '#/settings', onclick: () => { try { sessionStorage.setItem('sparky.goRestore', '1'); } catch {} } }, h('b', {}, 'Setting up a new phone?'), ' Restore from Google\u00a0Drive\u00a0›') : null,
    !profile.name ? h('a', { class: 'row setupcard', href: '#/settings', id: 'setupcard' }, h('span', { class: 'tile' }, icon('settings', { size: 18 })), h('div', { class: 'main' }, h('div', { class: 't' }, 'Set up your details'), h('div', { class: 's' }, 'Your name, logo and test instruments. They fill in every certificate for you.')), h('span', { class: 'go' }, '\u203a')) : null,
    warns.map((w) => h('a', { class: 'notice ' + w.level, href: '#/settings', style: 'display:block;text-decoration:none' }, w.text)),
    jobs.length ? statsStrip(jobs, certs) : null,
    dueCard(jobs, certs, cmap),
    await conflictNotice(),
    jobs.length ? h('label', { class: 'searchbox' }, icon('search', { size: 18 }), h('input', { class: 'search', type: 'search', placeholder: 'Search jobs, customers, addresses', 'aria-label': 'Search jobs', oninput: (e) => draw(e.target.value) })) : null,
    jobs.length ? h('h2', { class: 'sec' }, `Jobs (${jobs.length})`) : null,
    list,
    h('p', { class: 'note' }, `${APP_NAME} ${APP_VERSION}. Everything is saved on this device as you type. `, sync.getStatus().state === 'off' ? [h('a', { href: '#/settings' }, 'Sync with your other devices through Google Drive'), '.'] : 'Synced to your Google Drive.'),
    jobs.length ? h('button', { class: 'btn primary fab', onclick: () => go('#/newjob') }, '+ New job') : null,
  ], { actions: [h('button', { class: 'iconbtn', 'aria-label': 'Settings', onclick: () => go('#/settings') }, icon('settings', { size: 20 }))] });
});

// v0.9 look: three quick numbers at the top of the jobs page.
function statsStrip(jobs, certs) {
  const open = jobs.filter((j) => j.status !== 'done' && j.status !== 'closed').length;
  const drafts = certs.filter((c) => c.status !== 'issued').length;
  const due = dueList(jobs, certs).length;
  return h('div', { class: 'stats' },
    h('div', { class: 'stat' }, h('b', {}, String(open)), h('span', {}, open === 1 ? 'Open job' : 'Open jobs')),
    h('div', { class: 'stat' }, h('b', {}, String(drafts)), h('span', {}, drafts === 1 ? 'Draft cert' : 'Draft certs')),
    h('div', { class: 'stat' + (due ? ' warn' : '') }, h('b', {}, String(due)), h('span', {}, due === 1 ? 'Re-test due' : 'Re-tests due')));
}

// v0.9: a job changed on both devices: say which copy is which.
async function conflictNotice() {
  const l = await sync.conflictsToShow(); if (!l.length) return null;
  const box = h('div', { class: 'notice amber conflict' },
    h('b', {}, l.length === 1 ? 'A job was changed on both devices' : `${l.length} jobs were changed on both devices`),
    h('div', {}, 'Nothing was lost: the newest is kept as normal, and the other version is saved as its own job marked \u201cconflict copy\u201d. Check it, then delete whichever you don\u2019t need.'),
    h('ul', {}, l.map((x) => h('li', {}, h('a', { href: '#/job/' + x.copyId }, x.copyTitle)))),
    h('button', { class: 'btn small', onclick: async () => { await sync.dismissConflicts(); box.remove(); } }, 'Got it'));
  return box;
}

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

const fmtDateTime = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
// ---------- Job page ----------
route(/^\/job\/([^/]+)(?:\/(photos|details|next|pdfs|backup|dc|parts))?$/, async (id, sub) => {
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
    if (r === 'del') { if (await confirmBox('Delete photo?', 'This removes it from this device.', 'Delete', 'warn')) { await db.del('files', f.id); render(); } return; }
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
    const onDrive = Boolean(job.driveFolderId);
    if (!(await confirmBox('Delete this job?', `Deletes the job, its ${certs.length} certificate(s) and ${photos.length} photo(s).` + (onDrive ? ' Its Google Drive folder goes to Drive\u2019s bin (you can get it back from there for 30 days), and it comes off your other devices next time they sync.' : ''), 'Delete', 'warn'))) return;
    const { deleteJob } = await import('./jobdelete.js'); await deleteJob(job); go('#/');
  };
  const { dcPlansCard } = await import('./calcdcplan.js'); // v0.6: optional job.dcPlans
  const status = (c) => c.status === 'issued' ? h('span', { class: 'pill green' }, 'Issued') : h('span', { class: 'pill' }, 'Draft');
  const certRow = (c) => h('a', { class: 'row', href: '#/cert/' + c.id }, h('span', { class: 'tile ctype' }, c.type === 'MW' ? 'MW' : c.type), h('div', { class: 'main' }, h('div', { class: 't' }, c.number), h('div', { class: 's' }, `Updated ${fmtDateTime(c.updatedAt)}`)), status(c), h('span', { class: 'go' }, '›'));
  const addCert = async () => { const t = await modal('Add certificate', h('p', { class: 'note' }, 'Which certificate for this job?'), [{ label: 'EIC', value: 'EIC', cls: 'primary' }, { label: 'EICR', value: 'EICR', cls: 'primary' }, { label: 'Minor Works', value: 'MW', cls: 'primary' }, { label: 'Cancel', value: null }]); if (t) newCert(t); };
  const more = async () => { const r = await modal('More', h('p', { class: 'note' }, job.title || 'This job'), [{ label: 'Copy job', value: 'copy' }, { label: 'Delete job', value: 'del', cls: 'warn' }, { label: 'Cancel', value: null }]); if (r === 'copy') copyJob(); else if (r === 'del') delJob(); };
  const back = '#/job/' + id;
  // v0.18: the folded parts each open on their own page.
  if (sub === 'photos') return page(`Photos (${photos.length})`, [h('div', { class: 'card' },
      photos.length ? h('div', { class: 'photos' }, photos.map((f) => h('img', { src: URL.createObjectURL(f.blob), alt: f.caption || 'Photo', onclick: () => photoView(f) }))) : emptyState('camera', 'No photos yet. Add the board, labels and any defects.'),
      h('div', { class: 'btns full' }, h('button', { class: 'btn', onclick: () => addPhotos(true) }, 'Take photo'), h('button', { class: 'btn', onclick: () => addPhotos(false) }, 'Add from gallery')))], { back, sub: job.title });
  if (sub === 'details') return page('Job details & notes', [
    h('div', { class: 'card' }, h('h2', {}, 'Customer'),
      cust ? h('a', { class: 'row inrow', href: '#/customer/' + cust.id }, h('div', { class: 'main' }, h('div', { class: 't' }, cust.name), h('div', { class: 's' }, [cust.address, cust.postcode].filter(Boolean).join(', '))), h('span', { class: 'go' }, '›')) : h('p', { class: 'note' }, 'No customer.')),
    h('div', { class: 'card' }, h('h2', {}, 'Job'), txt('title', 'Job title'), txt('siteAddress', 'Installation address', 'area'), txt('sitePostcode', 'Postcode'), txt('notes', 'Notes', 'area'))], { back, sub: job.title });
  if (sub === 'next') return page('Next inspection', [nextCard(job, certs, cust, save)], { back, sub: job.title });
  if (sub === 'pdfs') return page(`Saved PDFs (${pdfs.length})`, [pdfs.length ? h('div', { class: 'card', id: 'savedpdfs' }, h('div', { class: 'pdflist' }, pdfRows(pdfs).map(({ f, latest }) => h('div', { class: 'pdfitem' + (latest ? ' latest' : '') },
      h('div', { class: 'pn' }, f.name),
      h('div', { class: 'pm' }, latest ? h('span', { class: 'pill latest' }, 'Latest') : null, h('span', {}, 'Made ' + madeAt(f.createdAt))),
      h('div', { class: 'btns' },
        h('button', { class: 'btn small', onclick: async () => (await import('./pdfview.js')).viewPdf(f.blob, f.name) }, withIcon('eye', 'View')),
        h('button', { class: 'btn small', 'aria-label': 'Share ' + f.name, onclick: () => shareOrDownload(f.blob, f.name) }, withIcon('share', 'Share'))))))) : emptyState('fileText', 'No PDFs yet. Make one from a certificate.')], { back, sub: job.title });
  if (sub === 'backup') return page('Backup', [h('div', { class: 'card' },
      h('p', { class: 'note' }, job.backedUpAt ? `In Google Drive (folder “${backup.jobFolderName(job, cust)}”), last saved ${new Date(job.backedUpAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}${(job.version || 0) > (job.backedUpVersion || 0) ? ' — changed since.' : '.'}` : 'Saved on this device. Not in Google Drive yet.'),
      h('div', { class: 'btns full' }, G.isConfigured() ? h('button', { class: 'btn', onclick: (e) => doBackup(e.currentTarget) }, 'Back up to Drive') : null, h('button', { class: 'btn', onclick: copyJob }, 'Copy job')))], { back, sub: job.title });
  if (sub === 'parts') { // v0.25: parts used, from the schedules
    const { partsForJob, partsText } = await import('./parts.js');
    const res = partsForJob(certs); const name = job.title || 'Job';
    const ref = res.from.length ? `${name} (${res.from.join(', ')})` : name;
    const text = partsText(res, ref);
    const share = async () => {
      if (navigator.share) { try { await navigator.share({ title: 'Parts used: ' + name, text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
      try { await navigator.clipboard.writeText(text); toast('Copied: paste it into a message or note'); } catch { toast('Couldn\u2019t share or copy on this device'); }
    };
    const pdf = async (btn) => { btn.disabled = true; try { const { partsPdf } = await import('./partspdf.js'); const blob = await partsPdf(res, { title: ref, profile: await getProfile() }); const fn = `parts-${(name).replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'job'}.pdf`; const r = await modal('Parts list PDF', h('p', {}, 'View it here, or share / save it.'), [{ label: 'Close', value: null }, { label: 'View', value: 'view' }, { label: 'Share', value: 'share', cls: 'primary' }]); if (r === 'view') (await import('./pdfview.js')).viewPdf(blob, fn, { shareText: 'Parts used: ' + name }); else if (r === 'share') await shareOrDownload(blob, fn); } catch (e) { toast(e.message || 'PDF failed'); } finally { btn.disabled = false; } };
    const qrow = (it) => h('div', { class: 'partrow' }, h('span', { class: 'pq' }, it.qty + ' \u00d7'), h('div', { class: 'pn' }, h('div', {}, it.name), it.circuits && it.circuits.length ? h('div', { class: 's' }, (it.rcd ? 'Covers circuits ' : 'Circuits ') + it.circuits.join(', ')) : null));
    return page('Parts used', [
      !res.boards.length ? emptyState('clipboard', 'No boards yet. Fill in a schedule on a certificate and the parts show here.') : [
        h('p', { class: 'note' }, `From the schedules on ${res.from.join(', ')}. Spare ways with no device fitted are left out.`),
        res.boards.map((b) => h('div', { class: 'card parts' }, h('h2', {}, b.ref + (b.location ? ' \u00b7 ' + b.location : '')), h('div', { class: 'note' }, `${b.ways} way(s)${b.spares ? `, ${b.spares} spare` : ''}${res.from.length > 1 ? ' \u00b7 ' + b.cert : ''}`),
          b.items.length ? h('div', { class: 'plist' }, b.items.map(qrow)) : h('p', { class: 'note' }, 'No devices filled in on this board.'))),
        res.boards.length > 1 ? h('div', { class: 'card parts' }, h('h2', {}, 'Total for the job'), h('div', { class: 'plist' }, res.totals.map(qrow))) : null,
        h('div', { class: 'btns full' }, h('button', { class: 'btn primary', onclick: share }, withIcon('share', 'Share')), h('button', { class: 'btn', onclick: (e) => pdf(e.currentTarget) }, withIcon('fileText', 'PDF')))],
    ], { back, sub: job.title });
  }
  if (sub === 'dc') return page('DC system plans', [dcPlansCard(job, save, render) || emptyState('zap', 'No DC system plans on this job.')], { back, sub: job.title });

  const ns = nextStep(certs);
  const nx = nextFor(job, certs);
  const backedState = job.backedUpAt ? ((job.version || 0) > (job.backedUpVersion || 0) ? ['Changed since backup', 'amber'] : ['Backed up', 'green']) : null;
  const drafts = certs.filter((c) => c.status !== 'issued');
  const pills = [
    ...[...new Set(certs.map((c) => c.type))].map((t) => { const d = drafts.some((c) => c.type === t); return h('span', { class: 'pill ' + (d ? 'info' : 'green') }, `${t === 'MW' ? 'Minor Works' : t} ${d ? 'draft' : 'issued'}`); }),
    nx ? h('span', { class: 'pill amber' }, 'Re-test ' + new Date(nx.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })) : null,
    backedState ? h('span', { class: 'pill ' + backedState[1] }, backedState[0]) : null];
  // v0.43.1: the wiring diagram lives on the job page (one cert opens it; several ask which)
  const diagramRow = (cs) => { const ds = cs.filter((c) => c.type !== 'MW' || (c.boards || []).length);
    if (!ds.length) return null;
    const right = ds.length === 1 ? (diagramHasCircuits(ds[0]) ? (ds[0].number || 'Drawn') : 'Not drawn') : `${ds.length} certificates`;
    if (ds.length === 1) { const r = frow(`#/cert/${ds[0].id}/diagram`, 'Wiring diagram', right, 'layers'); r.id = 'jobdiagram'; return r; }
    const pick = async () => { const id = await modal('Which wiring diagram?', h('p', { class: 'note' }, 'Pick the certificate to draw.'), [...ds.map((c) => ({ label: `${c.number || c.type} \u00b7 ${(TYPES[c.type] || {}).short || c.type}${diagramHasCircuits(c) ? '' : ' (not drawn)'}`, value: c.id })), { label: 'Cancel', value: null }]); if (id) go(`#/cert/${id}/diagram`); };
    return h('button', { class: 'row frow', id: 'jobdiagram', type: 'button', onclick: pick }, h('span', { class: 'fic' }, icon('layers', { size: 18 })), h('div', { class: 'main' }, h('div', { class: 't' }, 'Wiring diagram')), h('span', { class: 'rv' }, right), h('span', { class: 'go' }, '\u203a')); };
  const frow = (href, label, right = '', ic = null) => h('a', { class: 'row frow', href }, ic ? h('span', { class: 'fic' }, icon(ic, { size: 18 })) : null, h('div', { class: 'main' }, h('div', { class: 't' }, label)), right !== '' ? h('span', { class: 'rv' }, right) : null, h('span', { class: 'go' }, '›'));
  page(job.title || 'Job', [
    h('div', { class: 'card jsum' },
      h('div', { class: 'jname' }, cust ? cust.name : (job.title || 'Job')),
      h('div', { class: 'note' }, [job.siteAddress, job.sitePostcode].filter(Boolean).join(' ').replace(/\n/g, ', ') || 'No address yet'),
      pills.filter(Boolean).length ? h('div', { class: 'pills' }, pills) : null),
    h('div', { class: 'card nextstep', id: 'nextstep' },
      h('div', { class: 'nsk' }, 'Next step'), h('div', { class: 'nst' }, ns.title),
      ns.kind !== 'start' ? h('div', { class: 'prog' }, h('i', { style: `width:${ns.pct}%` })) : null,
      h('div', { class: 'note' }, ns.sub),
      h('div', { class: 'btns full' }, ns.href ? h('a', { class: 'btn primary big', href: ns.href }, ns.label) : h('button', { class: 'btn primary big', onclick: addCert }, ns.label))),
    certs.length ? h('h2', { class: 'sec' }, 'Certificates') : null,
    !certs.length ? null : h('div', { class: 'list' }, certs.map(certRow), h('button', { class: 'row addrow', onclick: addCert }, h('span', { class: 'tile addt' }, icon('plus', { size: 18 })), h('div', { class: 'main' }, h('div', { class: 't' }, 'Add certificate…')))),
    h('h2', { class: 'sec' }, 'Photos · notes · customer'),
    h('div', { class: 'list' },
      frow(back + '/photos', 'Photos', String(photos.length), 'camera'),
      frow(back + '/details', 'Job details & notes', cust ? cust.name : '', 'clipboard'),
      frow(back + '/next', 'Next inspection', nx ? new Date(nx.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 'Not set', 'calendar'),
      frow(back + '/pdfs', 'Saved PDFs', String(pdfs.length), 'fileText'),
      diagramRow(certs),
      certs.some((c) => (c.boards || []).some((b) => (b.circuits || []).length)) ? frow(back + '/parts', 'Parts used', '', 'clipboard') : null,
      job.dcPlans && job.dcPlans.length ? frow(back + '/dc', 'DC system plans', String(job.dcPlans.length), 'zap') : null,
      frow(back + '/backup', 'Backup', job.backedUpAt ? (backedState[0] === 'Backed up' ? 'In Drive' : 'Changed') : 'This device', 'cloudUp')),
    h('h2', { class: 'sec' }, 'More'),
    h('div', { class: 'list' }, h('button', { class: 'row frow', onclick: copyJob }, h('span', { class: 'fic' }, icon('copy', { size: 18 })), h('div', { class: 'main' }, h('div', { class: 't' }, 'Copy job'))),
      h('button', { class: 'row frow danger', onclick: delJob }, h('span', { class: 'fic' }, icon('trash', { size: 18 })), h('div', { class: 'main' }, h('div', { class: 't' }, 'Delete job')))),
  ], { back: '#/', sub: cust ? cust.name : '', actions: [h('button', { class: 'iconbtn', 'aria-label': 'More', id: 'jobmore', onclick: more }, icon('more', { size: 22 }))] });
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
      h('p', { class: 'note' }, 'The calendar file has a reminder a month before. It stays on this device: nothing is sent to the customer.'));
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

// v0.18: Appearance (this device only).
function appearanceCard() {
  const T = window.sparkyTheme || { get: () => 'system', set: () => {} };
  const box = h('div', { class: 'chips seg2', role: 'radiogroup', 'aria-label': 'Appearance' });
  const draw = () => fill(box, [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(([v, t]) => h('button', { class: 'chip' + (T.get() === v ? ' on' : ''), role: 'radio', 'aria-checked': T.get() === v ? 'true' : 'false', onclick: () => { T.set(v); draw(); } }, t)));
  draw();
  return h('div', { class: 'card', id: 'appearance' }, h('h2', {}, 'Appearance'), box,
    h('p', { class: 'note', style: 'margin-top:10px' }, 'System follows your device’s dark mode setting. Certificates and PDFs always print on white. Saved on this device only.'),
    h('label', { class: 'check', id: 'pdfflagrow', style: 'margin-top:10px' }, h('input', { type: 'checkbox', id: 'pdfflags', checked: pdfFlagsDefault(), onchange: (e) => setPdfFlagsDefault(e.target.checked) }), 'Show readings over the limit in red on PDFs'),
    h('label', { class: 'check', id: 'limitrow', style: 'margin-top:10px' }, h('input', { type: 'checkbox', id: 'limiton', checked: limitOn(), onchange: (e) => setLimitOn(e.target.checked) }), 'Limit bar on certificates (just for fun: flashes when it\u2019s all filled in)'),
    limitDemo());
}
// ---------- Settings: you, your logo, test instruments, backup ----------
route(/^\/settings$/, async () => {
  const p = await getProfile();
  const ins = await getInstruments();
  const saveP = () => saveSetting('profile', p); // v0.26: stamped, syncs to your other devices
  const saveI = () => saveSetting('instruments', ins);
  const txt = (k, label, type = 'text', ph = '') => h('label', { class: 'f' }, h('span', {}, label), h('input', { type, value: p[k] || '', placeholder: ph, oninput: (e) => { p[k] = e.target.value; saveP(); } }));
  const logoBox = h('div');
  const drawLogo = () => fill(logoBox, p.logo ? h('img', { class: 'logoprev', src: p.logo, style: 'max-height:70px;max-width:220px;display:block;margin-bottom:8px;padding:4px' }) : h('p', { class: 'note' }, 'No logo yet.'),
    h('div', { class: 'btns' }, h('button', { class: 'btn small', onclick: async () => { const [f] = await pickFile({ accept: 'image/*' }); if (!f) return; const b = await shrinkImage(f, 600, 0.9, 'image/png'); p.logo = await blobToDataUrl(b); await saveP(); drawLogo(); } }, p.logo ? 'Change logo' : 'Add logo'), p.logo ? h('button', { class: 'btn small warn', onclick: async () => { delete p.logo; await saveP(); drawLogo(); } }, 'Remove') : null));
  drawLogo();
  const sigBox = h('div');
  const drawSig = async () => { const s = await db.getMeta('mysig'); fill(sigBox, s ? h('img', { class: 'sigimg', src: s }) : h('p', { class: 'note' }, 'No saved signature. You can save one the first time you sign a certificate.'), s ? h('div', { class: 'btns' }, h('button', { class: 'btn small warn', onclick: async () => { await saveSetting('mysig', null); drawSig(); } }, 'Remove saved signature')) : null); };
  drawSig();
  const insBox = h('div');
  const drawIns = () => fill(insBox, ...ins.map((i, n) => {
    const st = calibrationState(i.calDue);
    const calWarn = h('div', { class: 'notice amber calwarn', role: 'status' }); const showCal = () => { const bad = ['make', 'model', 'serial'].some((x) => looksLikeCalDate(i[x])); calWarn.textContent = bad ? CAL_DATE_WARN.replace(' in Settings', '') : ''; calWarn.hidden = !bad; }; showCal();
    const f = (k, label, type = 'text') => h('label', { class: 'f' }, h('span', {}, label), h('input', { type, value: i[k] || '', oninput: (e) => { i[k] = e.target.value; saveI(); if (k === 'calDue') drawIns(); else showCal(); } }));
    return h('div', { class: 'card' },
      st === 'out' ? h('div', { class: 'notice red' }, 'Calibration out of date.') : st === 'soon' ? h('div', { class: 'notice amber' }, 'Calibration due within a month.') : null,
      h('div', { class: 'grid2' }, f('make', 'Make'), f('model', 'Model')), h('div', { class: 'grid2' }, f('serial', 'Serial / asset no.'), f('calDue', 'Calibration due', 'date')),
      calWarn,
      h('div', { class: 'note', style: 'margin-bottom:6px' }, 'Used for:'),
      h('div', { class: 'chips' }, INSTRUMENT_TAGS.map(([k, label]) => h('button', { class: 'chip' + ((i.kinds || []).includes(k) ? ' on' : ''), onclick: () => { i.kinds = (i.kinds || []).includes(k) ? i.kinds.filter((x) => x !== k) : [...(i.kinds || []), k]; saveI(); drawIns(); } }, label))),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: i.inUse !== false, onchange: (e) => { i.inUse = e.target.checked; saveI(); } }), 'Fill this in on new certificates'),
      h('button', { class: 'btn small warn', onclick: async () => { if (await confirmBox('Remove instrument?', instrumentText(i) || 'This instrument', 'Remove', 'warn')) { ins.splice(n, 1); saveI(); drawIns(); } } }, 'Remove'));
  }), h('button', { class: 'btn', onclick: () => { ins.push({ id: db.newId(), make: '', model: '', serial: '', calDue: '', kinds: ins.length ? [] : ['multi', 'continuity', 'ir', 'efli', 'rcd'], inUse: true }); saveI(); drawIns(); } }, '+ Add test instrument'));
  drawIns();

  // v0.16: one "Sync" card (sync + the old Drive backup folded in), then one "Files" card.
  const driveBox = h('div');
  const syncBox = h('div', { class: 'syncbox' });
  let moreOpen = false;
  const backupAll = async (e) => { const b = e.currentTarget; b.disabled = true; try { await G.getToken({ interactive: true, email: G.accountHint() }); const jobs = await db.all('jobs'); let n = 0; for (const j of jobs) { b.textContent = `Backing up ${++n} of ${jobs.length}…`; await backup.backupJob(j.id); } say(`Backed up ${jobs.length} job(s).`, 'green'); } catch (err) { say('Backup failed. ' + (err.message || err), 'red'); } b.disabled = false; b.textContent = 'Back up all jobs now'; };
  const drawSync = async () => {
    const c = await sync.getConfig(); const st = sync.getStatus(); const [t, col] = sync.statusText(st);
    const who = G.accountHint(); const signed = G.hasToken() || who;
    const toggle = h('label', { class: 'switchrow' }, h('span', {}, h('b', {}, 'Sync'), h('span', { class: 'note' }, c.enabled ? ' On' : ' Off')),
      h('input', { type: 'checkbox', role: 'switch', class: 'switch', checked: !!c.enabled, onchange: async (e) => { const on = e.target.checked; e.target.disabled = true; if (on) { try { await sync.connect(); } catch (err) { say('Couldn\u2019t switch sync on. ' + (err.message || err), 'red'); } } else await sync.disconnect(); drawSync(); } }));
    const nJobs = (await db.all('jobs')).length;
    // v0.25: a plain route for a new phone (uses the same restore as "More › Restore from Drive").
    const newPhone = !c.enabled || !nJobs ? h('div', { class: 'newphone', id: 'newphone' },
      h('div', { class: 'np-ic' }, icon('cloudDown', { size: 22 })),
      h('div', { class: 'np-t' }, h('b', {}, 'Setting up a new phone?'), h('div', { class: 'note' }, 'Bring your jobs, photos and certificates back from your Google Drive. Nothing in your Drive is changed.'),
        h('button', { class: 'btn primary', id: 'restore-new', onclick: restoreFromDrive }, 'Restore from Google Drive'))) : null;
    fill(syncBox,
      newPhone,
      h('p', { class: 'note' }, 'Your jobs, photos and PDFs are kept in your Google Drive, in the \u201c' + DRIVE_ROOT + '\u201d folder (it used to be called \u201c' + DRIVE_ROOT_OLD + '\u201d; the app renames it for you), and kept the same on all your devices. Changes go up within about 20 seconds; another device picks them up when you open it. If a job is changed on two devices before they catch up, the newest is kept and the other is saved as a \u201cconflict copy\u201d. The app can only see files it made itself.'),
      toggle,
      h('div', { class: 'syncline' }, c.enabled ? h('span', { class: 'syncchip ' + col }, h('i', {}), h('span', {}, t)) : h('span', { class: 'syncchip' }, h('i', {}), h('span', {}, 'Sync off')),
        h('span', { class: 'note' }, signed && who ? 'Connected as ' + who : signed ? 'Connected' : 'Not connected')),
      c.enabled && st.message ? h('div', { class: 'notice ' + (st.state === 'error' ? 'red' : 'amber') }, st.message) : null,
      h('div', { class: 'btns full' },
        c.enabled ? (st.state === 'signin' ? h('button', { class: 'btn primary', onclick: async (e) => { e.currentTarget.disabled = true; try { await sync.connect(); } catch (err) { say('Couldn\u2019t sign in to Google. ' + (err.message || err), 'red'); } drawSync(); } }, 'Sign in to Google') : h('button', { class: 'btn primary', onclick: async (e) => { e.currentTarget.disabled = true; await sync.syncNow({ interactive: true }); drawSync(); } }, 'Sync now'))
          : h('button', { class: 'btn primary', onclick: async (e) => { const b = e.currentTarget; b.disabled = true; b.textContent = 'Signing in…'; try { await sync.connect(); } catch (err) { say('Couldn\u2019t switch sync on. ' + (err.message || err), 'red'); } drawSync(); } }, 'Turn on sync (sign in to Google)'),
        signed ? h('button', { class: 'btn', onclick: async () => { if (!(await confirmBox('Disconnect Google Drive?', 'Sync stops on this device and it signs out of Google. Nothing in your Drive or on this device is deleted.', 'Disconnect', 'warn'))) return; await sync.disconnect(); await G.revoke(); G.rememberAccount(''); drawSync(); } }, 'Disconnect') : null),
      driveMsg,
      signed ? h('details', { class: 'more', open: moreOpen, ontoggle: (e) => { moreOpen = e.target.open; } }, h('summary', {}, 'More'),
        h('p', { class: 'note' }, 'Only needed now and then: sync already keeps your Drive up to date.'),
        // Kept for anyone who ticked it before v0.16; with sync on it's covered, so it only shows if it was on.
        p.autoBackup ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!p.autoBackup, onchange: (e) => { p.autoBackup = e.target.checked; saveP(); } }), 'Also back up a job when I leave it (used when sync is off)') : null,
        h('div', { class: 'btns full' },
          h('button', { class: 'btn small', onclick: backupAll }, 'Back up all jobs now'),
          h('button', { class: 'btn small', onclick: restoreFromDrive }, 'Restore from Drive'))) : null);
    if (signed) G.warmUp(); // load Google's script now, so the tap can open its window straight away
  };
  let first = true; const unsub = sync.onStatus(() => { if (!first && !syncBox.isConnected) return unsub(); first = false; drawSync(); });
  const drawDrive = () => { fill(driveBox, syncBox); drawSync(); };
  const pickResultsCert = async () => {
    const [certs, jobs] = await Promise.all([db.all('certs'), db.all('jobs')]);
    const jn = Object.fromEntries(jobs.map((j) => [j.id, j.name || j.title || '']));
    const list = certs.filter((c) => c.type !== 'MW').sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    if (!list.length) { toast('Make an EIC or EICR first, then import its results here.', 4000); return; }
    let pickId = list[0].id;
    const ok = await modal('Import results into which certificate?', h('div', { class: 'list' }, list.map((c, i) => h('label', { class: 'row' }, h('input', { type: 'radio', name: 'rc', checked: i === 0, onchange: () => { pickId = c.id; } }),
      h('div', { class: 'main' }, h('div', { class: 't' }, `${c.number || ''} \u00b7 ${(TYPES[c.type] || {}).short || c.type}`), h('div', { class: 's' }, [jn[c.jobId], ((c.install || {}).address || '').split(/[,\n]/)[0]].filter(Boolean).join(' \u00b7 ')))))),
      [{ label: 'Cancel', value: false }, { label: 'Choose file', value: true, cls: 'primary' }]);
    if (ok) (await import('./importui.js')).startImport(pickId);
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
    h('p', { class: 'note setver' }, `Version ${APP_VERSION}`),
    h('div', { class: 'card' }, h('h2', {}, 'You'), h('p', { class: 'note' }, 'Shown on your certificates. Kept on this device (and in your Drive backup), never in the app\u2019s code.'),
      txt('name', 'Your name'), txt('business', 'Business name'), txt('position', 'Position', 'text', 'e.g. Proprietor'),
      txt('address1', 'Address line 1'), txt('address2', 'Address line 2'), h('div', { class: 'grid2' }, txt('town', 'Town'), txt('postcode', 'Postcode')),
      txt('phone', 'Phone', 'tel'), txt('email', 'Email', 'email'), // v0.19: email on its own full-width line
      txt('regNo', 'Registration / membership no. (optional)'), txt('certPrefix', 'Certificate number prefix (optional)', 'text', 'e.g. SS-')),
    h('div', { class: 'card' }, h('h2', {}, 'Logo'), logoBox),
    appearanceCard(),
    h('div', { class: 'card' }, h('h2', {}, 'Signature'), sigBox),
    h('a', { class: 'card linkcard', href: '#/settings/presets' }, h('h2', {}, 'Device presets'), h('p', { class: 'note' }, 'Breakers and RCBOs you\u2019ve used, ready to tap on any circuit. Rename or delete them here.')),
    h('h2', { class: 'sec' }, 'Test instruments'), h('p', { class: 'note' }, 'Add each tester and tag what it\u2019s used for. On a certificate you pick one for each test, and it prints the serial. You\u2019ll get a warning a month before calibration is due.'), insBox,
    h('div', { class: 'card', id: 'drive' }, h('h2', {}, 'Sync'), G.isConfigured() ? driveBox : h('p', { class: 'note' }, 'Not set up in this build.')),
    h('div', { class: 'card', id: 'files' }, h('h2', {}, 'Files'),
      h('p', { class: 'note' }, 'Backups and imports from a file you keep anywhere. Restoring adds to what\u2019s here; imports show you every change first and never overwrite or remove anything.'),
      h('div', { class: 'btns full stack' },
        h('button', { class: 'btn', onclick: async () => { const b = await backup.exportAll(); await shareOrDownload(b, `${APP_SLUG}-backup-${new Date().toISOString().slice(0, 10)}.json`); } }, 'Save backup file'),
        h('button', { class: 'btn', onclick: async () => { const [f] = await pickFile({ accept: '.json,application/json' }); if (!f) return; try { const n = await backup.importAll(f); toast(`Restored ${n} item(s)`); render(); } catch (e) { toast(e.message); } } }, 'Restore from file'),
        h('button', { class: 'btn', onclick: async () => (await import('./importextra.js')).startExtra() }, 'Import extra details'),
        h('button', { class: 'btn', onclick: pickResultsCert }, 'Import results file')),
      h('p', { class: 'note', style: 'margin-top:8px' }, 'Import extra details: adds certificates\u2019 boards, circuits and sources from a Zs Pro (Sparky) job.json or backup. Import results file: fills test results on one certificate you choose.')),
    h('div', { class: 'notice amber' }, CHECK_NOTE),
    h('p', { class: 'note' }, `${APP_NAME} ${APP_VERSION}. Forms follow the IET model forms for BS 7671:2018+A4:2026. Not affiliated with the IET.`),
  ], { back: '#/' });
  // v0.25: from "Setting up a new phone?" on the jobs page: straight to the restore box.
  try { if (sessionStorage.getItem('sparky.goRestore')) { sessionStorage.removeItem('sparky.goRestore'); setTimeout(() => { const el = document.getElementById('newphone') || document.getElementById('drive'); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); } }, 350); } } catch {}
});

// v0.11: device presets — rename / delete.
route(/^\/settings\/presets$/, async () => {
  const all = await presets.load();
  const box = h('div');
  const saveAll = () => presets.save(all);
  const draw = () => {
    const list = presets.shown(all);
    fill(box, list.length ? h('div', { class: 'card' }, list.map((p) => h('div', { class: 'prow' },
      h('textarea', { class: 'pname', rows: 1, value: p.name, 'aria-label': 'Preset name', oninput: (e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }, onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }, onchange: async (e) => { p.name = e.target.value.trim() || presets.nameFor(p.fields); p.updatedAt = new Date().toISOString(); await saveAll(); toast('Renamed'); } }),
      h('div', { class: 'note' }, `${[p.fields.bs && 'BS EN ' + p.fields.bs, (/^[BCD123]$/.test(p.fields.type || '') ? p.fields.type : '') + p.fields.rating + ' A', p.fields.im && 'Im ' + p.fields.im + ' A', p.fields.ig && 'Ig ' + p.fields.ig + ' A' + (p.fields.tg ? ', tg ' + p.fields.tg + ' s' : ''), p.fields.bka && p.fields.bka + ' kA', p.fields.rcdIdn && presets.ownRcd(p.fields) && `RCD ${p.fields.rcdType || ''} ${p.fields.rcdIdn} mA${p.fields.rcdRating ? ' ' + p.fields.rcdRating + ' A' : ''}`].filter(Boolean).join(' · ')}`),
      h('button', { class: 'btn small warn', onclick: async () => { if (!(await confirmBox('Delete preset?', p.name, 'Delete', 'warn'))) return; p.deleted = true; p.updatedAt = new Date().toISOString(); await saveAll(); draw(); } }, 'Delete'))))
      : h('div', { class: 'empty' }, 'No presets yet. Fill in a protective device on a circuit and it\u2019s remembered here.'));
    for (const ms of [0, 400]) setTimeout(() => box.querySelectorAll('textarea.pname').forEach((t) => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }), ms);
  };
  draw();
  page('Device presets', [h('p', { class: 'note' }, 'Most recently used first. Tapping one on a circuit fills only the protective device boxes (BS EN, type, rating, kA, the RCD boxes for RCBOs only, and the MCCB settings); cable sizes and readings are never touched. Saved on this device and in your backup; synced with your jobs.'), box], { back: '#/settings' });
});

// Auto-backup when leaving a job or certificate (only if switched on and signed in).
let lastJob = null;
window.addEventListener('hashchange', async (e) => {
  const prev = /#\/(?:job|cert)\/([^/]+)/.exec(e.oldURL || '');
  const id = prev && (prev[0].includes('/cert/') ? (await db.get('certs', prev[1]) || {}).jobId : prev[1]);
  if (!id || id === lastJob && location.hash.includes(id)) return;
  const p = await getProfile(); if (!p.autoBackup || !G.isConfigured() || !navigator.onLine) return;
  // v0.16: with sync on, changes already go up by themselves, so this older option only runs when sync is off.
  if ((await sync.getConfig()).enabled) return;
  if (location.hash.includes(id)) return;
  // Still inside one of this job's certificates (e.g. certificate → board → back): not leaving the job yet.
  const now = /#\/cert\/([^/]+)/.exec(location.hash);
  if (now && ((await db.get('certs', now[1])) || {}).jobId === id) return;
  const job = await db.get('jobs', id); if (!job || (job.version || 0) <= (job.backedUpVersion || 0)) return;
  try { await G.getToken({ interactive: false }); await backup.backupJob(id); } catch {}
});

export { S, touchJob };
