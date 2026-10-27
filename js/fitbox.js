// fitbox.js — v0.35.3: schedule boxes grow to fit what's typed (e.g. '>999'), never clip.
// Pure maths is split out so it can be tested without a browser.
export const FIT_SLACK = 6; // px spare so the caret and last character never touch the edge

// Width an input needs for its text: text + padding + border + slack, never below its normal size.
export function neededWidth(textW, { padL = 0, padR = 0, bordL = 0, bordR = 0, base = 0 } = {}) {
  const need = Math.ceil(textW + padL + padR + bordL + bordR + FIT_SLACK);
  return Math.max(base, need);
}

let ctx = null;
const measure = (text, font) => {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d');
  ctx.font = font; return ctx.measureText(text).width;
};

// Fit one input: its min-width forces the table column wider when the text needs it.
export function fitInput(el) {
  if (!el || el.tagName !== 'INPUT' || !el.isConnected) return;
  const cs = getComputedStyle(el);
  const font = cs.font || `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const text = el.value || el.placeholder || '';
  const px = (v) => parseFloat(v) || 0;
  const w = text ? neededWidth(measure(text, font), { padL: px(cs.paddingLeft), padR: px(cs.paddingRight), bordL: px(cs.borderLeftWidth), bordR: px(cs.borderRightWidth) }) : 0;
  const cur = el.style.minWidth;
  // Only set a min-width when the text would not fit the box as it is; otherwise leave the layout alone.
  el.style.minWidth = '';
  if (w && w > el.clientWidth + px(cs.borderLeftWidth) + px(cs.borderRightWidth)) el.style.minWidth = w + 'px';
  else if (cur && !w) el.style.minWidth = '';
}

export const fitRow = (tr) => tr && tr.querySelectorAll('input').forEach(fitInput);
export const fitTable = (t) => t && t.querySelectorAll('tbody tr').forEach(fitRow);

// Wire a schedule table: fit once it's on screen (and once fonts load), and refit a row on every keystroke
// (auto-filled boxes in the same row get refitted too).
export function autoFitTable(table) {
  table.addEventListener('input', (e) => fitRow(e.target.closest('tr')));
  table.addEventListener('change', (e) => fitRow(e.target.closest('tr')));
  const go = () => fitTable(table);
  requestAnimationFrame(() => requestAnimationFrame(go));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
  addEventListener('resize', () => table.isConnected && go());
}
