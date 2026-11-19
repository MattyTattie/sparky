// =====================================================================
// boardrcd.js — v0.49.0: the board's RCD on the MCB / fuse lines, applied
// when a certificate is LOADED (and so on save, restore and migration), not
// only when a board's schedule happens to be opened. Before v0.49.0 the
// verdicts, Check certificate, the PDF and the parts list could differ
// depending on whether the board had been looked at.
// Pure (no DOM). Idempotent: running it twice changes nothing the 2nd time.
// It only touches boxes the app filled itself (autoF) or blank boxes, and an
// RCBO's own leftover values (61009 / its rating / 30 mA) on an MCB line when
// the board has its own RCD. Anything typed by hand is never changed.
// =====================================================================
import { fillBoardRcd, releaseRcboRcd, boardHasRcd, syncBoardS } from './ocpdfill.js';
import { mirrorMainRcd, liftBoardRcdToMain } from './boardmain.js';
import { isSpareCircuit } from './templates.js';
import { hasRcd2 } from './rcdways.js';
import { deviceById, deviceFromBs } from './limits.js';

const RCBO = { rcd: true }, NOT_RCBO = { rcd: false };
// Returns how many boxes / circuits changed (0 = already settled).
export function settleBoardRcds(cert) {
  if (!cert || !Array.isArray(cert.boards)) return 0;
  let n = 0;
  cert.boards.forEach((b, bi) => {
    if (!b || !Array.isArray(b.circuits)) return;
    if (cert.parts || bi > 0) n += liftBoardRcdToMain(cert, bi).length + mirrorMainRcd(cert, bi).length;
    if (boardHasRcd(b) || hasRcd2(b)) for (const c of b.circuits) {
      if (!c || c.noDevice || isSpareCircuit(c)) continue;
      const d = deviceById(c.device) || deviceFromBs(c.bs); if (!d || d.rcd) continue;
      // An MCB line still holding its old RCBO's own values: let the board's RCD replace them.
      // Only when the BS box says it was an RCBO (61009 / 62423): a split board's second RCD typed by hand is left alone.
      if (!/^(61009|62423)$/.test(String(c.rcdBs ?? '').trim())) continue;
      if (releaseRcboRcd(c, RCBO, NOT_RCBO).length) n++;
    }
    n += fillBoardRcd(b, isSpareCircuit);
    n += syncBoardS(b);
  });
  return n;
}
