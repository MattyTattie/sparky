// =====================================================================
// rcdways.js — v0.50.0: split-load and dual-RCD boards. Pure (no DOM).
// Optional board fields (old boards have neither, and behave as before):
//   b.rcdWays  "1-6, 9"  the ways the board's RCD (RCD 1) covers. Blank = all
//              ways (less any on RCD 2).
//   b.rcd2     { rcdBs, rcdType, rcdIdn, rcdRating, ways: "7-12" } a second RCD.
// A way on neither gets 'N/A' in its RCD boxes (auto, so typing wins). This
// drives the RCD fill (ocpdfill), the verdicts (checks), the parts list, the
// PDF and the diagram, which all read the circuit's own RCD boxes.
// =====================================================================
import { deviceById, deviceFromBs } from './limits.js';
const T = (v) => String(v ?? '').trim();
const real = (v) => !!T(v) && !/^n\/?a$/i.test(T(v));
// "1-6, 9", "1–6 9", "1 to 6", "7a" → a test on a way number; null when blank or nothing readable.
export function parseWays(s) {
  const t = T(s); if (!t) return null;
  const ranges = []; const ids = new Set();
  for (const part of t.replace(/\s*(?:-|\u2013|\u2014|\bto\b)\s*/gi, '-').split(/[,;\s]+/).filter(Boolean)) {
    const r = /^(\d+)-(\d+)$/.exec(part);
    if (r) { const a = +r[1], z = +r[2]; ranges.push([Math.min(a, z), Math.max(a, z)]); continue; }
    if (/^\d+[a-z]?$/i.test(part)) { ids.add(part.toLowerCase()); continue; }
  }
  if (!ranges.length && !ids.size) return null;
  return (num) => { const n = T(num).toLowerCase(); if (!n) return false; if (ids.has(n)) return true; const m = /^(\d+)/.exec(n); if (!m) return false; const k = +m[1]; return ids.has(String(k)) || ranges.some(([a, z]) => k >= a && k <= z); };
}
export const hasRcd2 = (b) => !!(b && b.rcd2 && real(b.rcd2.rcdIdn) && parseWays(b.rcd2.ways));
const boardOwn = (b) => real(b && b.rcdIdn);
// Which RCD protects this circuit's MCB / fuse line on board b:
//   { which: 'board' }   no split set up: the board's RCD as before (or none)
//   { which: '1', rcd }  RCD 1 (the board's RCD) on a split board
//   { which: '2', rcd }  RCD 2
//   { which: 'none' }    a way on neither RCD (the non-RCD side)
export function rcdForWay(b, num) {
  if (!b) return { which: 'board' };
  const r2 = hasRcd2(b) ? parseWays(b.rcd2.ways) : null; const w1 = parseWays(b.rcdWays);
  if (!r2 && !w1) return { which: 'board' };
  if (!T(num)) return { which: 'board' }; // no way number: can't tell, keep the old behaviour
  if (r2 && r2(num)) return { which: '2', rcd: b.rcd2 };
  if (w1) return w1(num) ? { which: r2 ? '1' : 'board', rcd: b } : { which: 'none' };
  return { which: '1', rcd: b };
}
// Plain text for the board page and PDF notes: "RCD 1 covers 1–6, RCD 2 covers 7–12, ways 13–14 have no RCD".
export function rcdCoverText(b) {
  if (!b) return '';
  const w1 = T(b.rcdWays), two = hasRcd2(b);
  if (!w1 && !two) return '';
  const p = [];
  if (boardOwn(b)) p.push(`${two ? 'RCD 1' : 'The board\u2019s RCD'} covers ${w1 ? 'ways ' + w1 : 'every other way'}`);
  if (two) p.push(`RCD 2 covers ways ${T(b.rcd2.ways)}`);
  return p.join('; ');
}
// Ways on neither RCD (MCB / fuse lines only: an RCBO has its own RCD; spares and no-device ways are left out).
export function noRcdWays(b, isSpare = () => false) {
  if (!b || (!parseWays(b.rcdWays) && !hasRcd2(b))) return [];
  return (b.circuits || []).filter((c) => { if (!c || c.noDevice || isSpare(c) || !T(c.num)) return false; const d = deviceById(c.device) || deviceFromBs(c.bs); return !(d && d.rcd) && rcdForWay(b, c.num).which === 'none'; }).map((c) => T(c.num));
}
// v0.50.0: one sentence for the board page, the PDF row and the diagram, so all three say the same thing.
export function rcdCoverFull(b, isSpare = () => false) {
  const t = rcdCoverText(b); if (!t) return '';
  const no = noRcdWays(b, isSpare);
  return t + (no.length ? `; no RCD on way${no.length === 1 ? '' : 's'} ${no.join(', ')}` : '');
}
