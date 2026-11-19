// =====================================================================
// obsfrom.js — v0.50.0: on an EICR a red reading is an existing fault to
// RECORD, not something to "fix before issuing". This turns a red flag into
// a suggested observation (text, code, regulation, location). The code is
// only a suggestion: the inspector chooses (the dialog lets them change it).
// Optional obs.src ("boardIndex/way/field") stops the same reading being
// added twice; old observations have none. Pure (no DOM).
// =====================================================================
const T = (v) => String(v ?? '').trim();
// field -> [suggested code, regulation, short lead-in]
const SUGGEST = {
  zs: ['C2', (tt) => (tt ? '411.5.3' : '411.4.4'), 'Earth fault loop impedance too high'],
  irLL: ['C2', () => '643.3', 'Insulation resistance (live to live) below the minimum'],
  irLE: ['C2', () => '643.3', 'Insulation resistance (live to earth) below the minimum'],
  pol: ['C1', () => '643.6', 'Incorrect polarity'],
  rcdMs: ['C2', () => '643.7', 'RCD did not disconnect in time'],
  rcdIdn: ['C2', () => '411.5.3', 'TT: RA \u00d7 I\u0394n over 50 V'],
  rcdBtn: ['C2', () => '643.10', 'RCD test button did not work'],
  afddBtn: ['C3', () => '643.10', 'AFDD test button did not work'],
  live: ['C2', () => '433.1.1', 'Cable not protected against overload'],
};
export const obsSrc = (bi, c, field) => `${bi}/${T(c && c.num) || '?'}/${field}`;
// The suggested observation for one red flag (or null for a flag it doesn't know).
export function obsSuggestion({ cert, b, bi, c, field, flag }) {
  const s = SUGGEST[field]; if (!s || !flag) return null;
  const tt = /TT/i.test(T((b && b.earthing) || (cert && cert.supply && cert.supply.earthing)));
  const where = `${T(b && b.ref) || 'Board'} circuit ${T(c && c.num) || '?'}`;
  const desc = T(c && c.desc);
  // the flag's message, without its advice ("Check …", "Fill in …"): an observation states what was found
  const found = T(flag.msg).replace(/[:;]?\s*\b(check|fill in|lower RA|enter|is it|tap|re-?test|worth a)\b[^.]*\.?/gi, '.').replace(/\.(\s*\.)+/g, '.').replace(/\s*\(Reg\s[^)]*\)/g, '').trim();
  return {
    text: `${s[2]}${desc ? ' (' + desc + ')' : ''}: ${found}`.replace(/\s+/g, ' ').replace(/:\s*$/, '.'),
    code: s[0], reg: T(flag.reg) || s[1](tt), location: where, src: obsSrc(bi, c, field),
  };
}
export const hasObsFor = (cert, src) => !!src && ((cert && cert.observations) || []).some((o) => o && o.src === src);
