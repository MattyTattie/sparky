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

## v0.4 (18 Oct 2026, built on branch `v0.4`, NOT pushed / not live)
- **New look** (restyle 7ff61ca) merged. Cache `sparky-v0.4.0`, APP_VERSION `0.4.0 beta`, manifest theme `#2952ff`. The Android app's splash and status bar stay navy until the APK is rebuilt (the TWA loads the live site, so no new APK is needed for anything else).
- **Calculators** now have tabs: "Size it" (`#/calc/size`, js/calcsize.js), "Check it" (`#/calc/check`, the v0.3 calculator), "Solar / battery" (`#/calc/dc`, js/calcdc.js). `#/calc` opens the last tab used.
- **Sums** in new plain modules with tests: js/design.js (adiabatic, fault clearing time, sizer), js/dc.js (DC), js/reminders.js (next inspection, .ics). `node --test tests/` → 73 pass.
- **Ring check** (checks.js `ringCheck`), shown on the circuit page when "Ring final circuit" is ticked; r1/rn/r2 boxes are hidden otherwise (the readings are kept, and a note says they're hidden).
- **Adiabatic** (checks.js `circuitAdiabatic`): from the measured Zs; amber flag on the CPC box if it fails.
- **Copy** circuit (to this board or another, readings optional) and copy a whole board (templates.js `copyBoard`).
- **Observation library**: 54 entries in inspections.js `OBSERVATIONS` (with `cat`), picker `pickObservation()` in certui.js.
- **PDF viewer**: js/pdfview.js with pdf.js 4.10.38 in vendor/pdfjs (Apache-2.0; renamed .mjs → .js so any server sends the right type). Works offline.
- **Reminders**: optional job fields `nextInspection` (yyyy-mm-dd) and `remindOff`. No change to the backup format: older backups restore fine.
- Screenshots: `python3 tests/screens_v04.py /workspace/sparky-shots/v0.4` (server on :8765).

### v0.4 — values to check (Matthew)
- **Adiabatic method** (the app's own simplification, on the safe side):
  - fault current I = 230 V ÷ Zs (measured or design Zs at the end of the circuit);
  - MCB/RCBO in the instantaneous region: t = 0.1 s, but capped at the energy-limiting class 3 let-through for the breaking capacity (BS EN 60898-1 Annex ZA; ≤16 A: 15k/25k/35k/70k A²s at 3/4.5/6/10 kA; 20–32 A: 18k/32k/45k/90k). ⚠ Typed in from memory: check the class 3 table or the maker's I²t. Because it's a worst case, low-Zs circuits near the board (e.g. 2.5/1.5 on B20/B32 below about 0.42 Ω) show amber; the maker's real let-through is usually much lower.
  - fuses: time read off a straight log-log line through the Table 41.2 (0.4 s) and 41.4 (5 s) points, never less than 0.1 s;
  - RCD fault protection (TT): 300 ms (500 ms for S-type).
- **k values**: 115 (PVC core/bunched), 143 (XLPE core; separate PVC CPC), 176 (separate XLPE), steel armour 51 (PVC SWA) / 46 (XLPE SWA). Tables 54.2–54.4.
- **Armour areas** (maker's data, BS 5467): 2-core 16/17/21/23/26/31/42/46 mm² and 3-core 17/19/23/24/29/33/46/52 mm² for 1.5–35 mm². ⚠ Check against the cable data sheet.
- **Singles (6491X)**: Table 4D1A methods A/B/C (checked against published copies). Volt drop 25/35 mm² uses 1.80/1.30 mV/A/m (Table 4D1B z values, from memory).
- **6243Y** rated with the T&E Table 4D5 figures.
- **Ci** options: Table 52.2 short lengths 50/100/200/400 mm = 0.88/0.78/0.63/0.51, and 0.5 for 0.5 m or more.
- **Sizer**: In = next standard rating ≥ Ib; B by default, C suggested for motors; volt drop 3% lighting, 5% other; Ze default 0.35 Ω (TN-C-S); ring = 30/32 A, 2.5 mm²+, Iz ≥ 20 A (433.1.204). No diversity, 3-phase or harmonics.
- **Ring volt drop on the circuit page**: OSG assumption of 20 A at the far point + 12 A spread round the ring, using the loop length worked out from r1 (copper 7.41 mΩ/m for 2.5 mm²).
- **DC**: copper ρ 0.017241 Ω·mm²/m at 20 °C, α 0.00393; ratings from Table 4D1A col 6 (70 °C) / 4E1A col 6 (90 °C), both checked; PV cable Iz ≥ 1.25 × Isc; string fuses when 3+ strings are in parallel, 1.5–2.4 × Isc and ≤ the panel's max series fuse; battery fuse ≥ 1.25 × max continuous current, cable ≥ fuse. gPV and battery fuse size lists are typical makers' ranges.
- **Observation codes** are suggested wordings/codes (in the spirit of Electrical Safety First BPG4). Regs worth a look: 421.1.7 (AFDD), 536.4.203 (mixed devices), 701.512.3 (socket-outlets 2.5 m from zone 1), 514.14.1 (mixed colours notice).
