// =====================================================================
// cuscan.js — turn OCR words from a consumer unit photo into circuits.
// Plain JS (no browser), tested by tests/cuscan.test.mjs.
//
// How it reads a row of breakers:
//  1. Every word is classified: a curve+rating marking (B32, "B 32", 832),
//     a maker's model code that carries the rating (FuseBox RTA063230B =
//     32 A, 30 mA, curve B), 30mA, Type A/AC, RCBO, main switch / isolator,
//     SPD, or a circuit label.
//  2. Words are grouped into columns, one per breaker, using the spacing
//     of the markings (works on angled photos, where the spacing changes).
//  3. Each column votes: marking and model code are two separate sources.
//     If they disagree, or neither is readable, the way is still listed,
//     marked "check", so you can type it next to the photo crop.
// The result is ALWAYS reviewed before anything is saved.
// =====================================================================
export const VALID = [1, 2, 3, 4, 5, 6, 10, 13, 15, 16, 20, 25, 30, 32, 40, 45, 50, 63, 80, 100, 125];
const LABELS = [
  ['Sockets', /sock|skts?\b|s\/o|ring|plugs?\b|power/i], ['Lights', /light|ltg|lts\b|lighting/i], ['Cooker', /cook/i], ['Oven', /oven/i], ['Hob', /\bhob\b/i],
  ['Shower', /shower/i], ['Immersion', /[il1|]mmer|imm\b/i], ['Hot water', /hot ?water|\bhw\b/i], ['Smoke alarms', /smoke|alarm|heat det/i],
  ['Boiler', /boiler|heating|\bch\b/i], ['Radiator', /radiat/i], ['Towel rail', /towel/i], ['EV charger', /\bev\b|charger/i], ['Garage', /garage|shed|outbuild/i],
  ['Kitchen', /kitchen|ktchn/i], ['Fridge/freezer', /fridge|freez/i], ['Washer', /wash|dryer/i], ['Dishwasher', /dish/i], ['Spare', /spare/i],
];
// Words that turn up on label strips: OCR'd words close to one of these get corrected.
const LABEL_WORDS = ['DOWNSTAIRS', 'UPSTAIRS', 'SOCKETS', 'SKTS', 'SOCKET', 'LIGHTS', 'LIGHTING', 'HOT', 'WATER', 'OVEN', 'COMBI', 'HOB', 'COOKER', 'SHOWER', 'IMMERSION', 'BOOST',
  'RADIATOR', 'RADIATORS', 'BEDROOM', 'KITCHEN', 'TOWEL', 'RAIL', 'BOILER', 'HEATING', 'SMOKE', 'ALARMS', 'ALARM', 'GARAGE', 'SHED', 'GARDEN', 'OUTSIDE', 'FRONT', 'BACK', 'LOFT',
  'BATHROOM', 'LOUNGE', 'LIVING', 'ROOM', 'DINING', 'HALL', 'LANDING', 'UTILITY', 'FRIDGE', 'FREEZER', 'WASHER', 'DRYER', 'DISHWASHER', 'SPARE', 'CHARGER', 'EXTRACTOR', 'FAN', 'FLOOR', 'UNDERFLOOR', 'RING', 'MICROWAVE', 'RADIAL', 'ISOLATOR'];
function editDist(a, b) { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }
export function fixLabelWord(w) {
  const u = w.toUpperCase(); if (u.length < 3 || /\d/.test(u)) return w; if (LABEL_WORDS.includes(u)) return u;
  if (u.length >= 4) { const pre = LABEL_WORDS.find((c) => c.length > u.length && c.startsWith(u)); if (pre) return pre; }
  let best = null, bd = Infinity; for (const c of LABEL_WORDS) { if (Math.abs(c.length - u.length) > 2) continue; const d = editDist(u, c); if (d < bd) { bd = d; best = c; } }
  return best && bd <= Math.max(1, Math.floor(u.length / 3.5)) ? best : w;
}
export const fixLabel = (text) => text.split(/\s+/).filter(Boolean).filter((w) => !/^[A-Za-z]{1,2}$/.test(w) || /^(hw|ch|ev|up|dn|1st|2nd)$/i.test(w)).map(fixLabelWord).join(' ');
export function labelFor(text) { for (const [name, rx] of LABELS) if (rx.test(text)) return name; return null; }

// Fix the usual OCR mix-ups inside a number: O/D/Q→0, I/l/|→1, S→5, G→6, Z→2.
const digitsOf = (s) => s.replace(/[OoDQ]/g, '0').replace(/[Il|!\]]/g, '1').replace(/[Ss]/g, '5').replace(/[G]/g, '6').replace(/[Zz]/g, '2');
const clean = (w) => String(w || '').trim().replace(/[®™'’"“”,.;:()[\]{}]+$/g, '').replace(/^[®™'’"“”,.;:()[\]{}]+/g, '');

// "B32", "B 32", "C16A", "32B", OCR's "832" / "86" (B read as 8), "c16".
export function readMarking(word) {
  let w = clean(word).replace(/\s+/g, '').toUpperCase();
  if (!w || w.length > 5) return null;
  let m = /^([BCD])([0-9OIL|SGZ]{1,3})A?$/.exec(w) || /^([0-9OIL|SGZ]{1,3})A?([BCD])$/.exec(w);
  if (m) {
    const [type, raw] = /[BCD]/.test(m[1]) && m[1].length === 1 ? [m[1], m[2]] : [m[2], m[1]];
    const r = Number(digitsOf(raw)); if (!VALID.includes(r) || r > 63) return null;
    // 1-5 A are rare on house boards and are usually a half-read "B16"/"B6": only trust a clean "B2"-style read, and flag it.
    if (r < 6 && (!/^[0-9]$/.test(raw) || !/[BCD]/.test(m[1]))) return null;
    return { type, rating: String(r), how: 'marking', ...(r < 6 || /[^0-9]/.test(raw) ? { guess: true } : {}) };
  }
  // B misread as 8: "832" → B32, "86" → B6, "816" → B16 (only when the number itself isn't a rating)
  m = /^8([0-9OSIL]{1,2})$/.exec(w) || /^[53]([0-9OSIL]{2})$/.exec(w);
  if (m) { const r = Number(digitsOf(m[1])); if (VALID.includes(r) && r >= 6 && r <= 63 && !VALID.includes(Number(digitsOf(w)))) return { type: 'B', rating: String(r), how: 'marking', guess: true }; }
  return null;
}
// Maker's model codes that include the rating. Add more brands here.
// FuseBox RCBOs: RTA0 6 16 30 B = 6 kA, 16 A, 30 mA, curve B.
export const MODEL_CODES = [
  { brand: 'FuseBox RTA RCBO', rx: /^R?TA[0-9ODQ]([0-9ODGSILB])([0-9ODGSIL]{2})([0-9ODGSIL]{2})([BCD8])$/i,
    parse: (m) => ({ ka: digitsOf(m[1].replace('B', '6')), rating: String(Number(digitsOf(m[2]))), idn: String(Number(digitsOf(m[3]))), type: m[4].toUpperCase().replace('8', 'B'), rcbo: true }) },
];
export function readModel(word) {
  const w = clean(word).replace(/\s+/g, '').toUpperCase().replace(/^ATA|^RTAO|^RTAD/, (s) => (s === 'ATA' ? 'RTA' : 'RTA0'));
  for (const mc of MODEL_CODES) {
    const m = mc.rx.exec(w); if (!m) continue;
    const r = mc.parse(m); if (!VALID.includes(Number(r.rating))) continue;
    if (!['10', '30', '100', '300'].includes(r.idn)) r.idn = '30';
    return { ...r, how: 'model', brand: mc.brand };
  }
  return null;
}
export const readMa = (w) => { const m = /^([0-9OS]{2,3})m?A$/i.exec(clean(w).replace(/\s+/g, '')); if (!m || !/ma$/i.test(clean(w))) return null; const v = Number(digitsOf(m[1])); return [10, 30, 100, 300].includes(v) ? String(v) : null; };
const readAmps = (w) => { const m = /^([0-9OSIL]{2,3})A$/i.exec(clean(w)); if (!m) return null; const v = Number(digitsOf(m[1])); return VALID.includes(v) ? v : null; };

// Classify one OCR word. bbox in photo pixels.
export function classify(word) {
  const t = clean(word.text); const b = word.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
  const base = { text: t, cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, w: b.x1 - b.x0, h: b.y1 - b.y0, bbox: b };
  if (!t) return null;
  const mo = readModel(t); if (mo) return { ...base, kind: 'model', ...mo };
  const mk = readMarking(t); if (mk) return { ...base, kind: 'marking', ...mk };
  const ma = readMa(t); if (ma) return { ...base, kind: 'ma', idn: ma };
  if (/^rcbo$/i.test(t)) return { ...base, kind: 'rcbo' };
  if (/^(main|switch|isolator|isol)/i.test(t)) return { ...base, kind: 'main' };
  if (/^spd$|^surge/i.test(t)) return { ...base, kind: 'spd' };
  if (/^(AC|A|F|B)$/.test(t) && word.prev && /^type$/i.test(word.prev)) return { ...base, kind: 'rcdtype', rcdType: t };
  const a = readAmps(t); if (a) return { ...base, kind: 'amps', amps: a };
  // Looks like a marking we couldn't make sense of: still evidence of a breaker here.
  if (/^[8BCD53][0-9OSIL]{1,2}$/.test(t) || /^[0-9OSIL]{1,2}[BCD]$/.test(t)) return { ...base, kind: 'face', unread: true };
  if (/^test$/i.test(t) || /^fuse ?b[o0a]x/i.test(t) || /^(hager|mk|wylex|crabtree|schneider|eaton|bg|contactum|lewden|proteus)$/i.test(t)) return { ...base, kind: 'face' };
  return null;
}
// Join split words: "B" + "32" → "B32"; "Type" + "A" handled by classify(prev).
export function mergeWords(words) {
  const ws = (words || []).filter((w) => w && w.text != null).map((w) => ({ ...w, text: String(w.text) }));
  const out = [];
  for (let i = 0; i < ws.length; i++) {
    const a = ws[i], b = ws[i + 1];
    if (b && /^[BCD]$/i.test(clean(a.text)) && /^[0-9OIS]{1,2}A?$/i.test(clean(b.text)) && Math.abs((a.bbox.y0 + a.bbox.y1) - (b.bbox.y0 + b.bbox.y1)) / 2 < (a.bbox.y1 - a.bbox.y0) && b.bbox.x0 - a.bbox.x1 < 2 * (a.bbox.y1 - a.bbox.y0)) {
      out.push({ text: clean(a.text) + clean(b.text), bbox: { x0: a.bbox.x0, y0: Math.min(a.bbox.y0, b.bbox.y0), x1: b.bbox.x1, y1: Math.max(a.bbox.y1, b.bbox.y1) } }); i++; continue;
    }
    out.push({ ...a, prev: ws[i - 1] && clean(ws[i - 1].text) });
  }
  return out;
}
const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

// Group evidence into columns (one per breaker), left to right.
export function columns(items) {
  const strong = items.filter((i) => ['model', 'marking', 'ma', 'face', 'amps', 'main', 'spd', 'rcbo'].includes(i.kind)).sort((a, b) => a.cx - b.cx);
  if (!strong.length) return [];
  // Spacing between breakers, from marking/model words (one of each per breaker).
  const gapsOf = (kind) => { const xs = strong.filter((i) => i.kind === kind).map((i) => i.cx); return xs.slice(1).map((x, i) => x - xs[i]).filter((g) => g > 0); };
  const widths = strong.filter((i) => i.kind === 'model' || i.kind === 'face').map((i) => i.w);
  let pitch = median([...gapsOf('model'), ...gapsOf('marking'), ...gapsOf('ma')].filter((g) => !widths.length || g > median(widths) * 0.6)) || (median(widths) ? median(widths) * 1.15 : 100);
  const tol = pitch * 0.45;
  const cols = [];
  for (const it of strong) {
    const c = cols[cols.length - 1];
    // a wide main switch / isolator word can sit between two columns; anything within tol joins
    if (c && it.cx - c.cx < tol) { c.items.push(it); c.cx = c.items.reduce((s, x) => s + x.cx, 0) / c.items.length; }
    else cols.push({ cx: it.cx, items: [it] });
  }
  return cols.map((c) => ({ ...c, pitch }));
}

// What one column says. Returns a proposed way, or a board item (main switch / SPD).
export function readColumn(col) {
  const by = (k) => col.items.filter((i) => i.kind === k);
  const marks = by('marking'), models = by('model');
  const main = by('main').length > 0, spd = by('spd').length > 0;
  const amps = by('amps').map((a) => a.amps);
  const solid = models.length || marks.some((m) => !m.guess);
  if ((main && !solid) || (!solid && amps.some((a) => a >= 63))) return { kind: 'main', rating: String(Math.max(0, ...amps) || ''), cx: col.cx, items: col.items };
  if (spd && !marks.length && !models.length) return { kind: 'spd', cx: col.cx, items: col.items };
  const vote = {};
  const add = (type, rating, w) => { const k = (type || '?') + rating; vote[k] = (vote[k] || 0) + w; };
  for (const m of marks) add(m.type, m.rating, m.guess ? 1 : 2);
  for (const m of models) add(m.type, m.rating, 2);
  const ranked = Object.entries(vote).sort((a, b) => b[1] - a[1]);
  const idn = (by('ma')[0] || models[0] || {}).idn || '';
  const rcbo = !!(models.some((m) => m.rcbo) || by('ma').length || by('rcbo').length);
  const rcdType = (by('rcdtype')[0] || {}).rcdType || '';
  if (!ranked.length) return { kind: 'way', type: '', rating: '', rcbo, idn, rcdType, sure: false, why: 'Couldn\u2019t read the rating', cx: col.cx, items: col.items };
  const [best, score] = ranked[0];
  const type = best[0] === '?' ? '' : best[0], rating = best.slice(1);
  const agree = marks.some((m) => m.type + m.rating === best) && models.some((m) => m.type + m.rating === best);
  const conflict = ranked.length > 1 && ranked[1][1] >= score;
  const brand = (models[0] || {}).brand || ''; const ka = (models[0] || {}).ka || '';
  return { kind: 'way', type, rating, rcbo, idn, rcdType, brand, ka, sure: agree || (score >= 2 && !conflict && !marks.some((m) => m.guess) && !!type),
    why: conflict ? `Readings disagree (${ranked.map((r) => r[0]).join(' / ')})` : agree ? 'Marking and model code agree' : models.length ? 'From the model code' : 'From the marking', cx: col.cx, items: col.items };
}

// Labels (often on strips under the breakers, written sideways). labelWords
// have cx already mapped back into the row's x coordinates.
export function attachLabels(ways, labelWords) {
  if (!ways.length) return ways;
  const pitch = ways[0].pitch || median(ways.slice(1).map((w, i) => w.cx - ways[i].cx)) || 100;
  // Words of one strip share an x; join them into a phrase.
  const ws = (labelWords || []).map((w) => ({ ...w, text: clean(w.text) })).filter((w) => /[A-Za-z]{2,}/.test(w.text) && w.text.length >= 2 && (w.conf == null || w.conf >= 55)).sort((a, b) => a.cx - b.cx || a.order - b.order);
  const strips = [];
  for (const w of ws) { const s = strips.find((x) => Math.abs(x.cx - w.cx) < pitch * 0.35); if (s) { s.words.push(w); } else strips.push({ cx: w.cx, words: [w] }); }
  for (const s of strips) {
    const text = fixLabel(s.words.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((w) => w.text).join(' ').replace(/\s+/g, ' ').trim());
    if (!labelFor(text) && !/^[A-Za-z][A-Za-z0-9 /&-]{3,}$/.test(text)) continue;
    let bi = -1, bd = Infinity; ways.forEach((w, i) => { const d = Math.abs(w.cx - s.cx); if (d < bd) { bd = d; bi = i; } });
    if (bi >= 0 && bd < pitch * 0.8 && !ways[bi].desc) ways[bi].desc = text.charAt(0) + text.slice(1).toLowerCase();
  }
  return ways;
}

// Whole row: OCR words of the breaker faces (+ optional label words) → ways and board items.
export function readRow(words, labelWords = []) {
  const items = mergeWords(words).map(classify).filter(Boolean);
  const cols = columns(items);
  let read = cols.map(readColumn).map((r, i) => ({ ...r, pitch: cols[i].pitch }));
  // A main switch / isolator is two modules wide: its "100A" and "MAIN SWITCH" can land in neighbouring columns. Join them.
  read = read.reduce((a, r) => { const l = a[a.length - 1]; if (l && l.kind === 'main' && r.kind === 'main') { l.rating = l.rating || r.rating; l.items = [...l.items, ...r.items]; l.cx = (l.cx + r.cx) / 2; l.wide = true; } else a.push(r); return a; }, []);
  // Past the main switch, anything we couldn't read is probably the SPD or an isolator, not a circuit: flag it, don't guess.
  const mi = read.findIndex((r) => r.kind === 'main');
  read = read.map((r, i) => {
    if (r.kind === 'main') return { ...r, why: r.rating ? `Main switch / isolator, ${r.rating}A` : 'Main switch / isolator' };
    if (r.kind === 'spd') return { ...r, why: 'Surge protection (SPD)' };
    if (r.kind === 'way' && !r.rating && mi >= 0 && i > mi) return { ...r, kind: 'other', why: 'Right of the main switch and no rating read: probably an SPD or isolator. Check it.' };
    return r;
  });
  const ways = read.filter((r) => r.kind === 'way');
  // A lone odd "10mA" on a way we couldn't read is usually a misread: use the row's usual RCD rating (still flagged).
  const idns = ways.filter((w) => w.sure && w.idn).map((w) => w.idn); const usual = idns.length >= 3 ? median(idns.map(Number)) : null;
  if (usual) for (const w of ways) if (!w.sure && w.idn && Number(w.idn) !== usual && !w.items.some((i) => i.kind === 'model')) w.idn = String(usual);
  attachLabels(ways, labelWords);
  return { ways, board: read.filter((r) => r.kind !== 'way'), pitch: cols.length ? cols[0].pitch : null };
}

// Equal slots when OCR finds nothing: so you can type each way next to its crop.
export function splitSlots(rect, n) {
  const w = rect.w / n; return Array.from({ length: n }, (_, i) => ({ x: rect.x + i * w, y: rect.y, w, h: rect.h }));
}

// Several photos / rows in order → one numbered list of circuits.
export function mergeRows(rows, { start = 1 } = {}) {
  let n = start - 1; const out = [];
  for (const r of rows) for (const w of r.ways) out.push({ ...w, num: String(++n), part: r.part });
  return out;
}

// A proposed way → circuit fields for the schedule.
export function toCircuit(w) {
  const rcbo = w.rcbo !== false;
  return { desc: w.desc || '', type: w.type || 'B', rating: w.rating || '', device: rcbo ? 'rcbo' : 'mcb', bs: rcbo ? '61009' : '60898',
    rcdBs: rcbo ? '61009' : '', rcdIdn: rcbo ? (w.idn || '30') : '', rcdType: rcbo ? (w.rcdType || 'A') : '', rcdRating: rcbo ? (w.rating || '') : '', bka: w.ka || (w.brand ? '6' : ''), time: 0.4 };
}

// ---- kept for older callers / tests ----
export function readDevice(word) { const m = readMarking(word); if (m) return { type: m.type, rating: m.rating }; const a = readAmps(word); return a && a <= 63 ? { type: '', rating: String(a) } : null; }
export function proposeCircuits(words) {
  return readRow(words.filter((w) => !labelFor(w.text || '')), words.filter((w) => labelFor(w.text || '')).map((w, i) => ({ ...w, cx: (w.bbox.x0 + w.bbox.x1) / 2, order: i })))
    .ways.map((w, i) => ({ num: String(i + 1), source: w.items.map((x) => x.text).join(' '), ...toCircuit(w), spare: /spare/i.test(w.desc || '') }));
}
