# Handoff notes

Status: beta v0.1, built on the box in /workspace/sparky-app. **Not published.**

Open points
- Pick the final name: change `APP_NAME` in js/config.js, plus manifest.json and the
  index.html title. Drive folder: `DRIVE_ROOT`.
- Publishing: new repo under MattyTattie (e.g. `sparky`), Pages from main. Add the Pages
  URL to the Google OAuth client's JavaScript origins. It's the same origin as Hearth,
  so nothing new is needed unless the app moves to a new domain.
  Run ./check-private.sh first.
- Limits to double-check against the book: fuse tables (BS 88-2, BS 88-3, BS 3036,
  BS 1362) were taken from two secondary sources that agree; cable ratings, volt drop
  mV/A/m and the Ca/Cg factors were written from memory of Appendix 4; BS 3871 is a
  legacy table (not in BS 7671).
- OCR: tested on a real two-row FuseBox RCBO board (see v0.2 below). The right-hand end of a
  row (glare/angle) still often needs typing; those ways are flagged "check".
- Voice entry needs Chrome's online speech service on most Android phones.
- Not built yet: a separate bonding schedule, the electrical installation
  "continuation sheet", multi-phase (3-phase) columns beyond the single Zs/IR values,
  emailing straight from the app (deliberately left out: you share the PDF yourself).

## v0.2 (board scanner fix)
- Scanner rewritten (js/ocr.js, js/cuscan.js, scan screen in js/schedule.js):
  - Reads each row from the full-resolution photo, scaled so breaker text is a good size,
    with two passes per row (contrast-stretched + local threshold for glare), plus fallbacks.
  - Several photos per board (in order) and an optional "draw a box round each row" step
    with zoom; without boxes, rows are found automatically.
  - Markings B6/B32/C16/"B 32", 30mA, RCBO, and FuseBox RTA model codes (RTA0 kA rating mA
    curve) vote together; common misreads (832→B32, 520→B20) count only as guesses.
  - Label strips under the breakers are read sideways and spell-fixed.
  - Main switch / isolator and SPD (orange) are shown as "Not a circuit", never added
    as circuits; unknown devices right of the main switch are flagged, not guessed.
  - Review shows every way next to its own photo crop; unsure ones say "check: …".
    "+ way after" and "Split into N equal ways" for typing by hand.
- Scan photos are now saved with the job (and back up to Drive). Before, they were never saved.
- Backups run one at a time per job (js/filerules.js serialPerKey), and moving between pages
  inside one certificate no longer triggers an auto-backup. This caused duplicate chart PDFs in Drive.
- Charts are stored as kind 'chart' and a remade chart replaces the old record (findOldPdf).
- Labels: on the real test board, OVEN / COMBI OVEN land on top-row ways 2 and 3, which the owner
  confirmed is right (strips sit offset by perspective; matching is by nearest x, no tweak needed).
  Other labels can land one way off; the review crops make that easy to spot.
- Tests: tests/cuscan.test.mjs. Service worker cache: sparky-v0.2.

## v0.3 (17 Oct 2026, built locally, NOT pushed)
- **Import results file** (job → certificate → "Earlier results" → Import results file). Reads a `{app:'sparky', kind:'results', format:1}` JSON file, previews it, then MERGES by circuit: it matches on circuit number when the description and device rating agree, otherwise on a unique description. It only fills blank boxes; any different values are listed and only taken if you tick them. It never deletes circuits or photos. Code: js/importres.js (logic, tested), js/importui.js (preview). The backup format is unchanged; cert.imports records each import.
- restoreDriveJob no longer overwrites a newer local job record.
- **Calculator overhaul** (js/calc.js, js/calcui.js): device/curve/rating chips feed max Zs; radial / ring (load at a point ÷4, spread ÷8); ring Iz ≥ 20 A only for ≥2.5 mm² on 30/32 A (433.1.204); ambient 20–60 °C; 3-core SWA with the 3rd core or the armour as CPC; design Zs = Ze + R1+R2(20 °C) × 1.2/1.28; expected R1+R2; a "where the numbers come from" list.
- **Circuit page**: cable picker (6242Y 1–16 mm² auto-fills live/CPC; 6243Y; 2-/3-core SWA, armour → CPC 'SWA'); wiring (col 3) and reference method (col 4) drop-downs (they keep unknown values as entered); amber flag when In > cable It (rings excepted); implied length from R1+R2. RCD rating auto-fill from the RCBO is unchanged.
- **Flagged data (shown in the UI notes too):**
  - 20 °C uses the Table 4B1 25 °C factor.
  - Method D: no air-ambient factor.
  - Armour resistance is from the maker (Anixter BS 5467), not BS 7671.
  - 6243Y 2.5 mm² CPC: makers differ (1.0 or 1.5), so the app fills 1.0.
  - 3-core SWA is rated with the 2-core single-phase columns.
  - The armour uses the same hot multiplier as the conductors (conservative).
- Cache sparky-v0.3, APP_VERSION 0.3 beta. Tests: `node --test tests/` (49 pass).
