// instruments.js — v0.26: saved test instruments (plain, tested). No database here.
export const INSTRUMENT_KINDS = [
  ['multi', 'Multifunction tester'], ['continuity', 'Continuity'], ['ir', 'Insulation resistance'],
  ['efli', 'Earth fault loop impedance'], ['rcd', 'RCD tester'], ['electrode', 'Earth electrode resistance'],
];
export const instrumentText = (i) => [i.make, i.model, i.serial ? 's/n ' + i.serial : ''].filter(Boolean).join(' ');
// v0.26: what each saved instrument can be tagged as "used for". The first six are the
// boxes on the IET forms; PFC and Other are tags only (PFC is read on the loop tester).
export const INSTRUMENT_TAGS = [...INSTRUMENT_KINDS, ['pfc', 'Prospective fault current'], ['other', 'Other']];
// Older saves: no id, no kinds, or kinds as a string. Always returns a tidy list (new fields optional).
export function normInstruments(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((i) => i && typeof i === 'object').map((i, n) => ({ ...i, id: i.id || 'ins' + n + '-' + String(i.serial || i.model || '').replace(/\W/g, '').slice(0, 12), kinds: Array.isArray(i.kinds) ? i.kinds : typeof i.kinds === 'string' && i.kinds ? i.kinds.split(/[,\s]+/) : [] }));
}
// The saved instruments for one box on the form, the ones tagged for it first.
export function instrumentsFor(k, list) {
  const L = normInstruments(list);
  const rank = (i) => (i.kinds.includes(k) ? 0 : i.kinds.includes('multi') && ['continuity', 'ir', 'efli', 'rcd'].includes(k) ? 1 : 2);
  return L.map((i, n) => [i, n]).sort((x, y) => rank(x[0]) - rank(y[0]) || x[1] - y[1]).map(([i]) => i);
}
// Which saved instrument fills each box by default: the first in use that's tagged for it.
export function pickDefaults(list) {
  const ids = {}, text = {};
  for (const i of normInstruments(list)) if (i.inUse !== false) for (const k of i.kinds) if (!ids[k] && INSTRUMENT_KINDS.some(([x]) => x === k)) { ids[k] = i.id; text[k] = instrumentText(i); }
  return { ids, text };
}
// v0.29: certs never print calibration dates. If one looks typed into an instrument's text
// (make / model / serial, or a typed box on a cert), warn gently: it would print on the cert.
const MONTHS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december';
const DATE_RES = [/\bcal(?:ibrat\w*|\.|'d|d)?\b/i, /\b\d{1,2}[\/.-]\d{1,2}[\/.-](?:\d{2}|\d{4})\b/, /\b(?:19|20)\d{2}[\/.-]\d{1,2}[\/.-]\d{1,2}\b/,
  new RegExp(`\\b(?:\\d{1,2}(?:st|nd|rd|th)?\\s+)?(?:${MONTHS})\\.?\\s+(?:19|20)?\\d{2}\\b`, 'i'), /\b(?:due|exp(?:ires|iry)?|valid)\b.*\b(?:19|20)\d{2}\b/i];
export const looksLikeCalDate = (text) => { const s = String(text || ''); return !!s.trim() && DATE_RES.some((re) => re.test(s)); };
export const CAL_DATE_WARN = 'That looks like a calibration date. It would print on the certificate, and certs don\u2019t show calibration dates. Put it in \u201cCalibration due\u201d in Settings instead.';
export const calDateFields = (obj) => Object.entries(obj || {}).filter(([, v]) => looksLikeCalDate(v)).map(([k]) => k);
