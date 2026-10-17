// =====================================================================
// voice.js — say a reading, it goes in the box. Uses the phone's own
// speech recognition (Chrome on Android; needs signal on most phones).
// parseSpeech() is plain JS so it can be tested without a phone.
// =====================================================================
const WORDNUM = { zero: '0', oh: '0', nought: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', point: '.', dot: '.' };
function normal(text) {
  const raw = String(text || '').toLowerCase().replace(/,/g, ' ').replace(/(\d)\s*\.\s*(\d)/g, '$1.$2').split(/\s+/).filter(Boolean)
    .map((w) => (WORDNUM[w] != null ? WORDNUM[w] : w));
  // join spoken numbers: "0 . 4 2" -> "0.42", ". 5" -> "0.5"
  const out = [];
  for (const t of raw) {
    const prev = out[out.length - 1];
    const isNum = /^\d+(\.\d*)?$/.test(t) || t === '.';
    if (isNum && prev != null && (/^\d+\.\d*$/.test(prev) || prev === '.' ) ) out[out.length - 1] = (prev === '.' ? '0.' : prev) + (t === '.' ? '' : t);
    else if (t === '.' && prev != null && /^\d+$/.test(prev)) out[out.length - 1] = prev + '.';
    else out.push(t);
  }
  return ' ' + out.join(' ') + ' ';
}
// Order matters: longer phrases first.
const RULES = [
  [/\b(r1 ?(\+|plus|and) ?r2|r1r2|are one plus are two|r one plus r two)\b/, 'r1r2'],
  [/\b(live (to |- )?live|line (to )?neutral|l ?l)\b/, 'irLL'],
  [/\b(live (to |- )?earth|line (to )?earth|l ?e|insulation|ir)\b/, 'irLE'],
  [/\b(zed ?s|z ?s|zs|loop|earth loop|said s|zedd s)\b/, 'zs'],
  [/\b(rcd|trip|trip time|disconnection|milliseconds|ms)\b/, 'rcdMs'],
  [/\b(r ?n|neutral|end to end neutral)\b/, 'rn'],
  [/\b(r2|r two|are two|cpc)\b/, 'r2'],
  [/\b(r1|r one|are one|line end)\b/, 'r1'],
];
export function parseSpeech(text) {
  const s = normal(text); const out = {};
  // polarity / buttons
  if (/\bpolarity (ok|okay|good|correct|fine|yes|tick)\b/.test(s)) out.pol = '✓';
  if (/\b(test button|button) (ok|okay|good|works|yes|tick)\b/.test(s)) out.rcdBtn = '✓';
  // split into "<field words> <number>" chunks
  const re = /((?:\s(?!\d+(?:\.\d+)?\s)\S+)+?)\s(greater than |more than |over |>)?(\d+(?:\.\d+)?)(?=\s)/g; let m;
  while ((m = re.exec(s))) {
    const words = ' ' + m[1] + ' ';
    for (const [rx, field] of RULES) if (rx.test(words)) {
      let v = m[3];
      if (m[2] || (/(irLL|irLE)/.test(field) && /greater|over|more/.test(words))) v = '>' + v;
      if (out[field] == null) out[field] = v; break;
    }
  }
  if (/\b(greater than|more than|over) 999\b/.test(s) && /insulation|ir\b/.test(s) && !/live|line/.test(s)) { out.irLL = out.irLL || '>999'; out.irLE = '>999'; }
  if (/\bnext( circuit)?\b/.test(s)) out._next = true;
  return out;
}
export const voiceSupported = () => typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
export function listen({ onResult, onEnd, onError } = {}) {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition; if (!R) { onError && onError(new Error('Voice entry isn\u2019t available on this phone.')); return null; }
  const r = new R(); r.lang = 'en-GB'; r.interimResults = false; r.maxAlternatives = 3; r.continuous = false;
  r.onresult = (e) => { const alts = [...e.results[0]].map((a) => a.transcript); onResult && onResult(alts[0], parseSpeech(alts[0]), alts); };
  r.onerror = (e) => onError && onError(new Error(e.error === 'not-allowed' ? 'Microphone permission was refused.' : e.error === 'network' ? 'Voice entry needs signal on this phone.' : 'Didn\u2019t catch that.'));
  r.onend = () => onEnd && onEnd();
  r.start(); return r;
}
