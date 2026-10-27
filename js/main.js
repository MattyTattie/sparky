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
// v0.36: a new version waits until you tap "New version, tap to update" (nothing reloads mid-certificate).
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  let shown = false; let reloading = false;
  const offer = (w) => {
    if (!w || shown || !navigator.serviceWorker.controller) return; shown = true;
    const b = document.createElement('button'); b.className = 'updbar'; b.type = 'button'; b.setAttribute('role', 'status');
    b.innerHTML = '<span>New version</span><b>Tap to update</b>';
    b.onclick = async () => { b.disabled = true; try { const { flush } = await import('./state.js'); await flush(); } catch {} w.postMessage('skipWaiting'); };
    document.body.append(b);
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (shown && !reloading) { reloading = true; location.reload(); } });
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    offer(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); }); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
}
