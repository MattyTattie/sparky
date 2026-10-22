// symbols.js — v0.20: one list of the symbols used across the app. The same
// definitions feed the tap-to-explain pop-ups and the Symbols sheet in Calculators.
import { h } from './ui.js';

import { SYM, SYM_RE } from './symdata.js';
export { SYMBOLS, SYM, SYM_RE } from './symdata.js';

export function symChip(s) { return h('button', { type: 'button', class: 'sym', 'data-sym': s, 'aria-label': `${s}: what it means` }, s); }

let pop = null;
export function closeSym() { if (pop) { pop.remove(); pop = null; } }
export function openSym(el) {
  const d = SYM[el.dataset.sym]; if (!d) return;
  closeSym();
  pop = h('div', { class: 'sympop', role: 'dialog', 'aria-label': d.name }, h('div', { class: 'symhd' }, h('b', {}, d.s), h('span', {}, d.name)), h('div', { class: 'symtx' }, d.desc), h('a', { class: 'symall', href: '#/calc/symbols' }, 'All symbols'));
  document.body.appendChild(pop);
  const r = el.getBoundingClientRect(); const w = Math.min(300, window.innerWidth - 16);
  pop.style.width = w + 'px';
  pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
  const below = r.bottom + 8; const ph = pop.offsetHeight;
  pop.style.top = (below + ph > window.innerHeight - 8 ? Math.max(8, r.top - ph - 8) : below) + 'px';
}

// Wrap symbols in on-screen text (labels, notes, result lines). Skips inputs, buttons, links and the PDF view.
const SKIP = 'input,textarea,select,option,button,script,style,svg,.sym,.sympop,.pdfview,.pdfpages,[contenteditable],code,a,.nosym';
// keep "(CCC)" together: bracket + chip + bracket in one non-breaking box
function h_nw(chip) { const w = document.createElement('span'); w.className = 'symnw'; w.append('(', chip, ')'); return w; }
export function wrapSymbols(root) {
  if (!root || !root.querySelectorAll) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (!n.nodeValue || !/[A-Z]/.test(n.nodeValue) || (n.parentElement && n.parentElement.closest(SKIP)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  const todo = []; let n; while ((n = walker.nextNode())) { SYM_RE.lastIndex = 0; if (SYM_RE.test(n.nodeValue)) todo.push(n); }
  for (const t of todo) {
    const txt = t.nodeValue; const frag = document.createElement('span'); frag.className = 'symwrap'; /* one inline box, so flex parents keep the sentence together */ let last = 0; SYM_RE.lastIndex = 0; let m;
    while ((m = SYM_RE.exec(txt))) { const s = m[0]; if (!SYM[s]) continue; const pre = txt.slice(last, m.index); if (pre.endsWith('(') && txt[m.index + s.length] === ')') { frag.append(pre.slice(0, -1), h_nw(symChip(s))); last = m.index + s.length + 1; } else { frag.append(pre, symChip(s)); last = m.index + s.length; } }
    frag.append(txt.slice(last)); t.replaceWith(frag);
  }
}
export function startSymbols() {
  document.addEventListener('click', (e) => {
    const s = e.target.closest && e.target.closest('.sym');
    if (s) { e.preventDefault(); e.stopPropagation(); if (pop && pop.dataset.for === s.dataset.sym) return closeSym(); openSym(s); pop.dataset.for = s.dataset.sym; return; }
    if (!(e.target.closest && e.target.closest('.sympop'))) closeSym();
  }, true);
  window.addEventListener('hashchange', closeSym); let y0 = 0; document.addEventListener('click', () => { y0 = window.scrollY; }, true);
  window.addEventListener('scroll', () => { if (pop && Math.abs(window.scrollY - y0) > 40) closeSym(); }, { passive: true }); // small tap-scrolls (focus, address bar) don't close it
  let q = false; const run = () => { q = false; const app = document.getElementById('app') || document.body; wrapSymbols(app); };
  new MutationObserver(() => { if (!q) { q = true; requestAnimationFrame(run); } }).observe(document.body, { childList: true, subtree: true });
  run();
}
