// v0.35.2: RCD type = waveform type (AC / A / F / B) plus S for time-delayed, written 'A S'
// (as entered on the IET model forms' RCD 'Type' box). Old values ('S', 'A-S', 'AS', 'Type A S')
// still read: 'S' on its own (no waveform recorded) is kept as 'S'.
export const WAVES = ['AC', 'A', 'F', 'B'];
export function parseRcdType(t) {
  const raw = String(t ?? '').trim(); const u = raw.toUpperCase().replace(/^TYPE\s*/, '');
  if (!u) return { wave: '', s: false, raw: '' };
  if (u === 'N/A') return { wave: '', s: false, raw, na: true };
  const m = u.match(/^(AC|A|F|B)?[\s\-/]*(S)?$/);
  if (!m) return { wave: '', s: false, raw, other: true };
  return { wave: m[1] || '', s: !!m[2], raw };
}
export const formatRcdType = (wave, s) => [wave || '', s ? 'S' : ''].filter(Boolean).join(' ');
// Tidy for display / print: 'A-S' -> 'A S'; unknown text left exactly as typed.
export function showRcdType(t) { const p = parseRcdType(t); return p.na || p.other || !p.raw ? (p.raw || '') : formatRcdType(p.wave, p.s); }
export const isSType = (t) => parseRcdType(t).s;
