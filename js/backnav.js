// =====================================================================
// backnav.js — v0.18: the phone's back button closes what's open on top
// (PDF viewer, dialogs, sign pad, pickers) instead of leaving the page.
// Any .modal-bg or .pdfview added to the page gets a history entry; back
// closes the top one. Closing it with a button removes that entry again,
// so the next back goes back a page as normal (no double-back).
// =====================================================================
const SEL = '.modal-bg, .pdfview';
const stack = []; // [{ el, id }]
let seq = 0; let ignore = 0; let byBack = null;

function closeEl(el) {
  el.dispatchEvent(new CustomEvent('sparky:back'));
  if (!el.isConnected) return;
  if (el.classList.contains('pdfview')) { const b = el.querySelector('.pdfbtn[aria-label="Close"]'); if (b) b.click(); }
  else { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); } // modals close when you tap the dim area
  if (el.isConnected) { const c = el.querySelector('button.cancel, .btns button:first-child'); if (c && /cancel|close|done/i.test(c.textContent)) c.click(); }
  if (el.isConnected) el.remove();
}
function added(el) {
  if (stack.some((x) => x.el === el)) return;
  const id = 'ov' + (++seq);
  stack.push({ el, id });
  history.pushState({ ...(history.state || {}), sparkyOv: id }, '');
}
function removed(el) {
  const i = stack.findIndex((x) => x.el === el); if (i < 0) return;
  const [{ id }] = stack.splice(i, 1);
  if (byBack === id) { byBack = null; return; } // back already took the entry away
  // closed with a button: take our entry off again, unless the page has moved on meanwhile
  setTimeout(() => { if (history.state && history.state.sparkyOv === id) { ignore++; history.back(); } }, 0);
}
export function start() {
  new MutationObserver((ms) => {
    for (const m of ms) {
      m.addedNodes.forEach((n) => { if (n.nodeType === 1 && n.matches && n.matches(SEL)) added(n); });
      m.removedNodes.forEach((n) => { if (n.nodeType === 1 && n.matches && n.matches(SEL)) removed(n); });
    }
  }).observe(document.body, { childList: true });
  addEventListener('popstate', (e) => {
    if (ignore) { ignore--; return; }
    const st = e.state || {};
    const top = stack[stack.length - 1];
    if (top && st.sparkyOv !== top.id) { byBack = top.id; closeEl(top.el); return; }
    // landed on an entry of an overlay that's already gone (e.g. it opened another page): skip it
    if (st.sparkyOv && !stack.some((x) => x.id === st.sparkyOv)) { ignore++; history.back(); }
  });
}
export const _stack = stack; // tests
