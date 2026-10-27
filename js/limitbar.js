// v0.36.4: a bit of fun — a "Limit" style gauge on the certificate screen.
// Pink fill as sections get filled in; at 100% it flashes rainbow colours with
// LIMIT. Plain CSS, no game assets. Screen only (never on PDFs).
// Switch: Settings → Appearance, saved on this device (localStorage sparky.limitbar).
import { h } from './ui.js';
const KEY = 'sparky.limitbar';
export const limitOn = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
export const setLimitOn = (on) => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch {} };
export const limitPct = (done, total) => (total > 0 ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : 0);
export function limitBar(done, total) {
  const pct = limitPct(done, total), full = total > 0 && done >= total;
  return h('div', { class: 'limitbar' + (full ? ' full' : ''), id: 'limitbar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct), 'aria-label': full ? 'Certificate complete, 100% filled in' : `${pct}% filled in` },
    h('div', { class: 'lb-track' }, h('i', { style: `width:${full ? 100 : pct}%` })), h('span', { class: 'lb-word' }, full ? '100%' : `${pct}%`));
}
