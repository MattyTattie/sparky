// main.js — start the app.
import { start as backNav } from './backnav.js';
import './app.js';
import './certui.js';
import './schedule.js';
import './testacross.js';
import './calcui.js';
import './calcmd.js';
import './refui.js';
import './calcsize.js';
import './calcmore.js';
import './calcdc.js';
import './calcdcplan.js';
import './importui.js';
import './dangerui.js';
import './importextra.js';
import { render } from './app.js';
import { startSymbols } from './symbols.js';
startSymbols();
import { persist } from './db.js';
import { recoverPending } from './state.js';
persist();
backNav();
recoverPending().finally(() => { render(); import('./sync.js').then((m) => m.init()).catch(() => {}); });
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
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    offer(reg.waiting);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
}
