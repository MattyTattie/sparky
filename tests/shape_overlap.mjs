// Text-vs-symbol overlap for a diagram layout() result. Used by tests and to
// dump a JSON that pdf_overlap.py can check for 390/1440 screens.
import { textW } from '../js/wiring.js';

export function textBBox(z) {
  const size = z.size || 12;
  const w = textW(z.txt, size, !!z.bold);
  const x0 = z.anchor === 'middle' ? z.x - w / 2 : z.anchor === 'end' ? z.x - w : z.x;
  return { x: x0, y: z.y - size * 0.8, w, h: size * 1.02, txt: z.txt, size };
}

// Small filled-white faceplates and load boxes — not page-wide headers or breaker boxes (~55 wide).
export function symbolRects(shapes, { maxW = 50, maxH = 40, minW = 6, minH = 6 } = {}) {
  return shapes.filter((z) => z.t === 'rect' && z.w > minW && z.w < maxW && z.h > minH && z.h < maxH
    && z.fill && z.fill[0] >= 250)
    .map((z) => ({ x: z.x, y: z.y, w: z.w, h: z.h }));
}

const CAPTION = /^(JB|EV|IP|N|\+|MCB|RCBO|Spare|Rail|Rad|Cooker|Hob|PV|Shower|Alarm|Immersion|T2|DB\d*|C?\d+|B\d+|A\d+|RCD|SPD|KM\d*|Ctrl|EE|A|DP|13A|ISO)$/i;

export function textSymbolOverlaps(shapes, { minArea = 2, minFrac = 0.12 } = {}) {
  const hits = [];
  const texts = shapes.filter((z) => z.t === 'text' && z.txt && String(z.txt).trim());
  const syms = symbolRects(shapes);
  for (const t of texts) {
    const b = textBBox(t);
    const ta = b.w * b.h;
    for (const s of syms) {
      const ix = Math.min(b.x + b.w, s.x + s.w) - Math.max(b.x, s.x);
      const iy = Math.min(b.y + b.h, s.y + s.h) - Math.max(b.y, s.y);
      if (ix <= 0.4 || iy <= 0.4) continue;
      const area = ix * iy;
      if (area <= minFrac * Math.min(ta, s.w * s.h) && area < minArea) continue;
      const contained = area > 0.7 * ta;
      if (contained && CAPTION.test(String(t.txt).trim())) continue;
      hits.push({ txt: t.txt, text: b, sym: s, area });
    }
  }
  return hits;
}

// A hanging spur socket must not draw the through-cable (a horizontal tick on the drop).
export function hangingSocketTicks(shapes) {
  const plates = shapes.filter((z) => z.t === 'rect' && z.fill && z.fill[0] >= 250
    && z.h > 12 && z.h < 22 && z.w > 14 && z.w < 40);
  if (!plates.length) return [];
  const minY = Math.min(...plates.map((p) => p.y));
  const spurPlates = plates.filter((p) => p.y > minY + 20 && p.w < 28 && p.w > p.h + 1); // hanging singles, not the ring twins (nor a square FCU plate sat in the ring, whose cable runs over it by design)
  const lines = shapes.filter((z) => z.t === 'line' && Math.abs(z.y1 - z.y2) < 0.45);
  const ticks = [];
  for (const p of spurPlates) {
    const cx = p.x + p.w / 2;
    // plate top is cy + r*0.35; through-cable would sit at cy, just above the plate
    const cy = p.y - (p.h / 1.7) * 0.35;
    const hit = lines.filter((l) => Math.abs(Math.min(l.y1, l.y2) - cy) < 1.8
      && Math.min(l.x1, l.x2) < cx - 5 && Math.max(l.x1, l.x2) > cx + 5);
    if (hit.length) ticks.push({ plate: p, cy, lines: hit });
  }
  return ticks;
}

export function shapesToJson(blocks, name) {
  const shapes = (blocks || []).flatMap((b) => b.shapes || []);
  const texts = shapes.filter((z) => z.t === 'text').map((z) => {
    const b = textBBox(z);
    return { x: b.x, y: b.y, w: b.w, h: b.h, txt: b.txt };
  });
  const rects = symbolRects(shapes).map((s) => ({ x: s.x, y: s.y, w: s.w, h: s.h }));
  return { name, texts, rects };
}
