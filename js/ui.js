// =====================================================================
// ui.js — tiny helpers for building screens (no framework).
// =====================================================================
import { icon } from './icons.js';
export { icon };
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
export const $ = (s, r = document) => r.querySelector(s);
let toastT;
export function toast(msg, ms = 2600) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = h('div', { class: 'toast', role: 'status' }, msg); document.body.append(t);
  clearTimeout(toastT); toastT = setTimeout(() => t.remove(), ms);
}
export function modal(title, body, buttons = []) {
  return new Promise((res) => {
    const close = (v) => { bg.remove(); res(v); };
    const bg = h('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) close(null); } },
      h('div', { class: 'modal', role: 'dialog' }, h('h3', {}, title), body,
        h('div', { class: 'btns full' }, buttons.map((b) => h('button', { class: 'btn ' + (b.cls || ''), onclick: () => close(b.value) }, b.label)))));
    document.body.append(bg);
    const first = bg.querySelector('input,textarea,select'); if (first) setTimeout(() => first.focus(), 50);
  });
}
export const confirmBox = (title, text, yes = 'Yes', cls = 'primary') => modal(title, h('p', {}, text), [{ label: 'Cancel', value: false }, { label: yes, value: true, cls }]);
export function debounce(fn, ms) { let t; const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; d.flush = () => { clearTimeout(t); fn(); }; return d; }
export const fmtDate = (iso) => { if (!iso) return ''; const d = new Date(iso.length === 10 ? iso + 'T12:00' : iso); return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
export const blobToDataUrl = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
// Shrink a photo before saving (keeps the phone and Drive tidy).
export async function shrinkImage(file, max = 1600, q = 0.82, type = 'image/jpeg') {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  const g = c.getContext('2d'); if (type === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
  g.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b || file), type, q));
}
export function pickFile({ accept = 'image/*', capture = false, multiple = false } = {}) {
  return new Promise((res) => {
    const i = h('input', { type: 'file', accept, capture: capture ? 'environment' : null, multiple, style: 'display:none' });
    i.onchange = () => { res([...i.files]); i.remove(); };
    document.body.append(i); i.click();
  });
}
// Hand a file to the phone's share sheet (you choose the app and the person),
// or download it where sharing isn't available. Never sends on its own.
export async function shareOrDownload(blob, name, text = '') {
  const file = new File([blob], name, { type: blob.type || 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name, text }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  return 'downloaded';
}
// Replace an element's contents (arrays flattened, null/false skipped).
export function fill(el, ...kids) { el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false).map((k) => (k instanceof Node ? k : document.createTextNode(String(k))))); return el; }
// v0.5: a friendly empty state: icon + one line + an optional action.
export const emptyState = (ic, text, action = null) => h('div', { class: 'empty2' }, h('div', { class: 'emptyic' }, icon(ic, { size: 28 })), h('p', {}, text), action);
// v0.5: grey placeholder rows while a page loads (instead of a blank screen).
export const skeleton = (n = 3) => h('div', { class: 'list skel', 'aria-busy': 'true', 'aria-label': 'Loading' }, Array.from({ length: n }, () => h('div', { class: 'row' }, h('div', { class: 'main' }, h('div', { class: 'sk sk1' }), h('div', { class: 'sk sk2' })))));
// A button/link label with an icon in front.
export const withIcon = (ic, text) => [icon(ic, { size: 18 }), h('span', {}, text)];
