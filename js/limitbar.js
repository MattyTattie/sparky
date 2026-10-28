// v0.36.4: a bit of fun — a "Limit" style gauge on the certificate screen.
// Pink fill as sections get filled in; at 100% it flashes rainbow colours (no text, just 100%).
// Plain CSS, no game assets. Screen only (never on PDFs).
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

// v0.36.5: Settings preview — fills up, then plays the full animation. "Play preview" replays it.
export function limitDemo() {
  const slot = h('div', { style: 'flex:1' });
  let t = null;
  const play = () => { clearInterval(t); let n = 0; slot.replaceChildren(limitBar(0, 10)); t = setInterval(() => { n++; slot.replaceChildren(limitBar(n, 10)); if (n >= 10) clearInterval(t); }, 250); };
  const wrap = h('div', { class: 'lb-demo', id: 'limitdemo' }, slot, h('button', { class: 'btn small', type: 'button', id: 'limitplay', onclick: play }, 'Play preview'));
  slot.replaceChildren(limitBar(10, 10));
  return wrap;
}
