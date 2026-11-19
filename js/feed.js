// =====================================================================
// feed.js — v0.50.0: reads a board's "Supplied from" text ("DB1 circuit 9",
// "DB1/9", "DB 1 - way 9", "Circuit 9 of DB1", "DB1") into a board and
// circuit on the same certificate. One reader for the checks (RCD upstream),
// the diagram and the board page, so they always agree. Pure (no DOM).
// Old free text keeps working; the board page's picker writes the plain
// "DB1 circuit 9" form, so nothing new is stored (backups unchanged).
// =====================================================================
const norm = (s) => String(s ?? '').toLowerCase().replace(/[\s\-_.]+/g, '');
const KW = '(?:way|circuit|cct|ckt|c)\\s*(?:no\\.?|number)?\\s*#?\\s*';
const NUM = '(\\d+[a-z]?)';
const SEP = '[\\s,:;/\\\\\\-\\u2013\\u2014\\u00b7#]';
// Circuit first: "Circuit 9 of DB1", "way 9, DB1", "c9 in DB1"
const RE_CFIRST = new RegExp(`^${KW}${NUM}\\s*(?:(?:of|in|on|at|from)\\b|${SEP})+\\s*(.+)$`, 'i');
// Board then keyword: "DB1 circuit 9", "DB1-C10", "DB1 way 9"
const RE_KW = new RegExp(`^(.*?)${SEP}*${KW}${NUM}$`, 'i');
// Board then a separator and a number: "DB1/9", "DB1 - 9", "DB1: 9", "DB1, 9", "DB1 #9"
const RE_SEP = new RegExp(`^(.*?\\S)\\s*${SEP}+\\s*${NUM}$`, 'i');

// { bi, ref, circuitNum, text } or null. boards: the certificate's boards; selfBi: this board (never its own feed).
export function parseFeed(text, boards = [], selfBi = -1) {
  const t = String(text ?? '').trim(); if (!t) return null;
  const find = (ref) => { const n = norm(ref); if (!n) return -1; return boards.findIndex((x, i) => i !== selfBi && x && norm(x.ref) === n); };
  const out = (bi, cn) => ({ bi, ref: String(boards[bi].ref || '').trim(), circuitNum: cn ? String(cn).trim() : '', text: t });
  // the whole text is a board's name ("DB 1", "Garage CU")
  let bi = find(t); if (bi >= 0) return out(bi, '');
  for (const [re, refAt, numAt] of [[RE_CFIRST, 2, 1], [RE_KW, 1, 2], [RE_SEP, 1, 2]]) {
    const m = t.match(re); if (!m) continue;
    bi = find(m[refAt].replace(new RegExp(`${SEP}+$`), '')); if (bi >= 0) return out(bi, m[numAt]);
  }
  return null;
}
// The circuit (or undefined) a parsed feed names on its board.
export const feedCircuit = (boards, f) => (f && f.circuitNum ? ((boards[f.bi] || {}).circuits || []).find((c) => c && String(c.num ?? '').trim().toLowerCase() === f.circuitNum.toLowerCase()) : undefined);
// The plain form the picker writes: "DB1 circuit 9" (or just "DB1").
export const feedText = (ref, num) => (num ? `${ref} circuit ${num}` : String(ref || ''));
