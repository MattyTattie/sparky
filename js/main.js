// main.js — start the app.
import { start as backNav } from './backnav.js';
import './app.js';
import { render, setLazyScreens, loadScreens } from './app.js';
// v0.50.0: the screens beyond the jobs list load on demand (and in the background straight after the first page),
// so a phone runs about half the JavaScript before it can show your jobs. Everything is still kept offline by the
// service worker, so this changes nothing with no signal.
export const SCREENS = ['./certui.js', './schedule.js', './testacross.js', './calcui.js', './calcmd.js', './refui.js', './calcsize.js', './calcmore.js', './calcdc.js', './calcdcplan.js', './importui.js', './dangerui.js', './importextra.js'];
setLazyScreens(() => Promise.all(SCREENS.map((m) => import(m))));
import { startSymbols } from './symbols.js';
startSymbols();
import { persist } from './db.js';
import { recoverPending } from './state.js';
persist();
backNav();
recoverPending().finally(async () => { await render(); import('./sync.js').then((m) => m.init()).catch(() => {});
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200)); idle(() => loadScreens().catch(() => {})); });
// v0.36.1: new versions install and take over by themselves; the banner just asks you to reload when you're ready.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  let shown = false; let reloading = false;
  const offer = (w) => {
    if (!w || shown || !navigator.serviceWorker.controller) return; shown = true;
    const b = document.createElement('button'); b.className = 'updbar'; b.type = 'button'; b.setAttribute('role', 'status');
    b.innerHTML = '<span>New version</span><b>Tap to update</b>';
    b.onclick = async () => { b.disabled = true; try { const { flush } = await import('./state.js'); await flush(); } catch {} w.postMessage('skipWaiting'); };
    document.body.append(b);
  };
  const hadCtl = !!navigator.serviceWorker.controller;
  // v0.36.1: the new worker takes over by itself; if it does so while you're working, offer a reload instead of yanking the page.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return; if (shown) { reloading = true; location.reload(); return; }
    if (!hadCtl) return; shown = true;
    const b = document.createElement('button'); b.className = 'updbar'; b.type = 'button'; b.setAttribute('role', 'status');
    b.innerHTML = '<span>New version</span><b>Tap to update</b>';
    b.onclick = async () => { b.disabled = true; try { const { flush } = await import('./state.js'); await flush(); } catch {} reloading = true; location.reload(); };
    document.body.append(b);
  });
  // v0.50.0: board scan and View PDF download in the background once the app is up (resumed each launch until done)
  const fillVendor = () => { if (navigator.onLine === false) return; navigator.serviceWorker.ready.then((reg) => { if (reg.active) reg.active.postMessage('fillVendor'); }).catch(() => {}); };
  const idleV = window.requestIdleCallback || ((f) => setTimeout(f, 1500));
  window.addEventListener('load', () => idleV(fillVendor, { timeout: 5000 }));
  window.addEventListener('online', fillVendor);
  navigator.serviceWorker.addEventListener('controllerchange', () => idleV(fillVendor, { timeout: 5000 }));
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    offer(reg.waiting);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
}
