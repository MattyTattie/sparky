// main.js — start the app.
import './app.js';
import './certui.js';
import './schedule.js';
import './calcui.js';
import './calcsize.js';
import './calcdc.js';
import './calcdcplan.js';
import './importui.js';
import { render } from './app.js';
import { persist } from './db.js';
import { recoverPending } from './state.js';
persist();
recoverPending().finally(render);
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('./sw.js').catch(() => {});
