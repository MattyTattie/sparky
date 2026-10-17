// =====================================================================
// cuscan.js — read circuit details off a photo of a consumer unit.
// The OCR (Tesseract, bundled) finds words and where they are; we look
// for device markings like "B32", "C16", "6A" and labels like "Sockets".
// The result is ALWAYS shown for checking before anything is saved.
// =====================================================================
const LABELS = [
  ['sockets', /sock|s\/o|ring|plugs?\b|power/i], ['lights', /light|ltg|lts\b|lighting/i], ['cooker', /cook|oven|hob/i],
  ['shower', /shower/i], ['immersion', /[il1|]mmer|imm\b|water heater/i], ['smoke alarms', /smoke|alarm|fire|heat det/i],
  ['boiler', /boiler|heating|ch\b/i], ['ev charger', /\bev\b|car|charger/i], ['garage', /garage|shed|outbuild/i],
  ['kitchen', /kitchen|ktchn/i], ['upstairs', /up(stairs)?\b/i], ['downstairs', /down(stairs)?\b|grd|ground/i],
  ['fridge/freezer', /fridge|freez/i], ['washer', /wash|dryer/i], ['dishwasher', /dish/i], ['spare', /spare/i],
];
// Device tokens: B32, C 16, 32B, D6, "B 6A". Returns {type, rating} or null.
export function readDevice(word) {
  const w = String(word || '').toUpperCase().replace(/[|]/g, '1').replace(/O/g, '0').replace(/\s+/g, '');
  let m = /^([BCD])(\d{1,3})A?$/.exec(w) || /^(\d{1,3})A?([BCD])$/.exec(w);
  if (m) { const [type, rating] = isNaN(m[1]) ? [m[1], m[2]] : [m[2], m[1]]; if (VALID.includes(Number(rating))) return { type, rating: String(Number(rating)) }; }
  m = /^(\d{1,3})A$/.exec(w); if (m && VALID.includes(Number(m[1]))) return { type: '', rating: String(Number(m[1])) };
  return null;
}
const VALID = [3, 6, 10, 13, 15, 16, 20, 25, 30, 32, 40, 45, 50, 63, 80, 100, 125];
export function labelFor(text) { for (const [name, rx] of LABELS) if (rx.test(text)) return name; return null; }
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// words: [{text, bbox:{x0,y0,x1,y1}}] from Tesseract. Returns proposed circuits, left to right.
export function proposeCircuits(words, { rcbo = true, mode30 = 'A' } = {}) {
  const devs = []; const labs = [];
  for (const w of words || []) {
    const t = String(w.text || '').trim(); if (!t) continue;
    const d = readDevice(t); const b = w.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    if (d) devs.push({ ...d, cx, cy, text: t });
    else { const l = labelFor(t) || (/^[A-Za-z][A-Za-z/&-]{3,}$/.test(t) && !/^(type|rcbo|mcb|rcd|test|main|switch|isolator|off|on)$/i.test(t) ? t.toLowerCase() : null); if (l) labs.push({ label: l, cx, cy, text: t, known: !!labelFor(t) }); }
  }
  // Group devices into rows (boards can have two rows), then left to right.
  devs.sort((a, b) => a.cy - b.cy);
  const rows = []; for (const d of devs) { const r = rows.find((x) => Math.abs(x.cy - d.cy) < 60); if (r) { r.items.push(d); r.cy = (r.cy + d.cy) / 2; } else rows.push({ cy: d.cy, items: [d] }); }
  const ordered = rows.flatMap((r) => r.items.sort((a, b) => a.cx - b.cx));
  // Each label goes to its nearest device (left-right mostly); a device keeps the closest label.
  const xs = ordered.map((d) => d.cx).sort((p, q) => p - q);
  const gaps = xs.slice(1).map((x, i) => x - xs[i]).filter((g) => g > 5).sort((p, q) => p - q);
  const pitch = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 400;
  const best = new Map();
  for (const l of labs) {
    let bi = -1, bd = Infinity;
    ordered.forEach((d, i) => { const dist = Math.abs(l.cx - d.cx) + Math.abs(l.cy - d.cy) * 0.35; if (dist < bd) { bd = dist; bi = i; } });
    if (bi < 0 || Math.abs(l.cx - ordered[bi].cx) > pitch * 0.75) continue;
    const cur = best.get(bi); if (!cur || bd < cur.d) best.set(bi, { d: bd, label: l.label });
  }
  return ordered.map((d, i) => {
    const desc = best.has(i) ? cap(best.get(i).label) : '';
    return { num: String(i + 1), desc, type: d.type || 'B', rating: d.rating, device: rcbo ? 'rcbo' : 'mcb', bs: rcbo ? '61009' : '60898', rcdIdn: rcbo ? '30' : '', rcdType: rcbo ? mode30 : '', rcdBs: rcbo ? '61009' : '', rcdRating: rcbo ? d.rating : '', source: d.text, spare: /spare/i.test(desc) };
  });
}
