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

## v0.5 (19 Oct 2026, built on branch `v0.5`, NOT pushed / not live)
- **Security** (mirrors Hearth v15.0): pdf.js `isEvalSupported: false`; voice note under the mic buttons ("Voice entry uses Google's speech service…"); CSP `<meta>` in index.html. Tested under the CSP: Google sign-in script loads (real GSI script fetched in WebKit), mocked sign-in + Drive restore (Chromium + WebKit), pdf.js viewer + worker, Tesseract OCR (wasm), PDF making. Rollback = delete the CSP meta tag. Sparky does not use the Drive Picker, so it is not in the CSP (add `https://docs.google.com` script/frame if a picker is ever added; frame-src already has it).
- **Restore from Drive**: sign-in is asked for straight inside the tap (Safari/Chrome on Mac block it otherwise); a message box under the buttons explains every outcome (signing in, still waiting after 12 s, pop-up blocked, sign-in cancelled/denied, Google unreachable, no backups, download/read error with the error text, per-job failures). Mock: `python3 tests/restore_mock.py chromium|webkit ok|empty|blocked|never|gsifail` (`SHOTS=dir` for phone screenshots).
- **Supplementary bonding** (EIC + EICR section after the boards): optional `cert.bonding = [{id, location, parts, csa, material, reading, verified}]` and `cert.bondingNA`. Printed as a "SCHEDULE OF SUPPLEMENTARY BONDING" continuation sheet after the schedules (the IET model forms have no dedicated bonding schedule; listed in Section J / H "continuation sheets"). Old certificates/backups without it are fine.
- **PDF layout**: js/pdfkit.js `wrap()` only breaks at spaces / after hyphens; `field()` shrinks the value (to 6 pt), then the label, then 2 mini-lines, then "…"; multi-line fields grow. `tests/pdf_overlap.py` checks word boxes for overlaps/off-page (0 on the stress and sample PDFs). Footer: form note left, "CertNo · Page X of Y" right; logo mark if no logo.
- **Page order** (EIC/EICR): certificate → (observations continued) → schedule of inspections → ALL circuit-details sheets → ALL test-results sheets → bonding → guidance. Each schedule sheet: "DB/CU: ref (location) · Sheet x of y (continuation)", cert number, Page X of Y. 16 circuits per sheet (`PER_SHEET`), row height fitted to the page. Observations paginate with "SECTION K: OBSERVATIONS (continued)".
- **3-phase sizer** ("Size it"): Single-phase 230 V (default) / Three-phase 400 V. Ib = P/(√3·400·pf); cables 4-core SWA PVC/XLPE and singles (3-phase); volt drop as % of 400 V; Zs and adiabatic phase–earth (230 V); device triple-pole "(TP)"; rings blocked on 3-phase. "Check it" tab is still single-phase only.
- **Polish**: js/icons.js (Lucide-style inline SVG, ISC), bottom nav (Jobs / Calculators / Customers / Settings), icon back button, tiles on list rows, empty states (`emptyState()`), skeleton rows (`skeleton()`), press states; all animation off under prefers-reduced-motion. Buttons get icons automatically by label (`BTN_ICONS` in app.js).
- Cache `sparky-v0.5.0`, APP_VERSION `0.5.0 beta`. `node --test tests/` → 82 pass. Screens: `python3 tests/screens_v05.py`, `python3 tests/screens_polish.py after`, `node tests/stress_pdf.mjs <dir>`.
- **Android app v2**: /workspace/sparky-android/output/Sparky-v2.apk (versionCode 2, versionName 0.5.0), status bar #2952FF, white splash and nav bar, same key (SHA-256 C8:14:…:8B:57). See sparky-android/BUILD-NOTES.txt.
- Known: in Playwright's WebKit (a private/ephemeral profile) IndexedDB can't store PDF Blobs, so "View PDF" fails there (same in v0.4). Real Safari in normal mode is fine; Safari private browsing would hit it — the toast now says so instead of "null".

### v0.5 — values to check (Matthew)
- **⚠ 3-phase tables are typed in from memory**, check against BS 7671 Appendix 4 before trusting:
  - 4-core SWA 70 °C PVC (Table 4D4A/4D4B, 3/4-core): mV/A/m 25 / 15 / 9.5 / 6.4 / 3.8 / 2.4 / 1.5 / 1.1 for 1.5–35 mm²; method C 18 / 25 / 33 / 42 / 58 / 77 / 102 / 125 A; method D 18 / 24 / 30 / 38 / 50 / 64 / 82 / 98 A.
  - 4-core SWA 90 °C XLPE (Table 4E4A/4E4B): mV/A/m 27 / 16 / 10 / 6.8 / 4.0 / 2.5 / 1.65 / 1.15; method C 23 / 31 / 42 / 53 / 73 / 94 / 124 / 154 A; method D 21 / 28 / 36 / 44 / 58 / 75 / 96 / 115 A.
  - Singles 3-phase (Table 4D1A/4D1B, 3 or 4 cables): 1–35 mm² mV/A/m 38 / 25 / 15 / 9.5 / 6.4 / 3.8 / 2.4 / 1.55 / 1.15 (single-phase × 0.866); method A 10.5 / 13.5 / 18 / 24 / 31 / 42 / 56 / 73 / 89; B 12 / 15.5 / 21 / 28 / 36 / 50 / 68 / 89 / 110; C 14 / 18 / 25 / 33 / 43 / 59 / 79 / 104 / 129 A.
  - 4-core armour (maker's data, BS 5467): area 18 / 20 / 24 / 35 / 40 / 46 / 62 / 68 mm², resistance 9.5 / 7.9 / 6.8 / 4.0 / 3.6 / 3.2 / 2.3 / 2.0 mΩ/m. ⚠ Check the data sheet.
- **Bonding**: the amber note shows above 0.5 Ω; PDF note quotes Reg 544.2 (2.5 mm² Cu mechanically protected, else 4 mm²) and 415.2.2 (R ≤ 50 V / Ia; RCD: Ia = IΔn). Bonding schedule placement as a continuation sheet — OK?
- **Worked examples** (sizer, 3-phase): 22 kW 40 m 4-core SWA C → 32 A B (TP), 4 mm²; 11 kW pf 0.85 XLPE SWA → 20 A C, 1.5 mm²; 30 kW 60 m singles B → 50 A, 10 mm².

## v0.6 (19 Oct 2026, built on branch `v0.6`, NOT pushed / not live)
- **Calculators → DC** (tab renamed from "Solar / battery"): sub-tabs `#/calc/dc/pv` (the v0.4 Solar / battery checks, unchanged) and `#/calc/dc/plan` (new DC system planner). `#/calc/dc` opens the last one used (`sparky.dcsub`).
- **Sums**: js/dcplan.js (plain, tested in tests/v06.test.mjs) — `planDC(inputs)`, `sizeRun()`, `partsList()`, `planText()`. Reuses dc.js `dcCableSize`, `pvString`, `coldVoc`. UI: js/calcdcplan.js. PDF: js/dcplanpdf.js (same Kit as certificates; checked with tests/pdf_overlap.py).
- **Saved with a job**: optional `job.dcPlans = [{id, name, savedAt, inputs, summary}]` on the job record (goes into job.json with the job, so Drive backup/restore carry it; old jobs/backups don't have it and are fine; older app versions ignore it). Optional PDF saved as an ordinary `files` record (kind 'pdf', `dcPlanId`), so it shows in Saved PDFs and backs up like any PDF. Job page shows a "DC system plans" card (Open / Delete). Planner inputs on the phone: localStorage `sparky.dcplan1`.
- No new external scripts or connections: CSP unchanged. Cache `sparky-v0.6.0`, APP_VERSION `0.6.0 beta`. `node --test tests/` → 94 pass. Screens: `python3 tests/screens_v06.py` (server on :8765).

### v0.6 — values to check (Matthew)
- **Cable ratings**: two singles clipped direct, 30 °C. Tri-rated / marine 90 °C uses BS 7671 Table 4E1A col 6; 70 °C PVC uses Table 4D1A col 6 (same tables as the v0.4 DC calc). Ambient (Table 4B1): 90 °C 35/40/45/50 °C = 0.96/0.91/0.87/0.82; 70 °C = 0.94/0.87/0.79/0.71. "Bundled" = ×0.7 (Table 4C1, 3 circuits bunched). Smallest size 1.5 mm². Thin-wall automotive (FLRY) not covered (maker-rated).
- **Volt drop**: copper at 70 °C, out and back, % of nominal 12/24/48 V. Loads 3% (10% if ticked); main/inverter/charger runs pick 1/2/3% (default 2%); fuse box feed 1%; DC-DC input 5% of the vehicle voltage (the charger boosts; makers' tables often allow a smaller cable).
- **Fuses**: ≥ 1.25 × current (peak for loads); cable rated ≥ fuse ÷ factors. Blade ≤ 30 A, then MIDI (≤ 200 A for chargers ≤ 125 A), MEGA, ANL; LiFePO4 main = Class T (≤ 400 A in the list). ⚠ Ranges typed in as typical: blade 1–30; MIDI 30–200; MEGA 40–500; ANL 35–500; Class T 100–400.
- **Battery**: Ah = daily Wh ÷ V × days ÷ usable (LiFePO4 80%, AGM/lead 50% default). Inverter DC current = W ÷ (low volts × 0.9): low volts 11.5 V per 12 V LiFePO4, 11.0 V lead/AGM. 230 V loads' daily energy ÷ 0.9. Inverter idle draw not counted.
- **Inverter size**: Σ 230 V loads × 1.25 → next of 150/300/500/600/800/1000/1200/1500/2000/2500/3000/3500/4000/5000 W; surge note only.
- **MPPT**: solar W ÷ V × 1.25 → next of 10/15/20/30/35/40/45/50/60/70/85/100 A. Cold Voc as the PV checks (default −10 °C, −0.29 %/°C); "auto" series = most in series with cold Voc ≤ 95% of the MPPT max. Hot Vmp check: series × Vmp × (1 − 0.35% × 45) ≥ charge V + 5 V. Solar yield ⚠ rough: W × 4 h (summer) / 0.7 h (winter) × 0.8.
- **DC-DC**: suggestion ≤ battery Ah × 0.5 (LiFePO4) / 0.2 (AGM) / 0.15 (lead) and ≤ ¼ of the alternator (120 A assumed if blank) → ⚠ rules of thumb. Input current = A × 14.4 V ÷ (13 V × 0.9). Mains charger suggestion ≈ 0.15–0.2 × Ah.
- **Main**: Imain = max(everything on: inverter + DC load peaks, all chargers together). Shunt ≥ main fuse (100/300/500/1000/2000 A); isolator ≥ main fuse continuous (100/150/250/300/350/500/600 A); busbars ≥ main fuse (100/150/250/300/600/1000 A). Chassis bond ≥ DC-DC input cable, 16 mm² min.
- **Quick-pick loads** (12 V typical): LED lights 24 W 5 h; compressor fridge 45 W (60 W peak) 8 h; water pump 60 W 0.3 h; USB/12 V sockets 30 W (120 W peak) 3 h; diesel heater 30 W (120 W start) 8 h; roof fan 24 W 4 h; laptop 65 W 2 h (230 V); low-watt kettle 1000 W 0.1 h (230 V).
- **Standards quoted**: BS EN 1648-2 (motor caravans, 12 V d.c.), BS EN 1648-1 (caravans), BS 7671 Section 721 (caravans and motor caravans, 230 V), BS EN ISO 10133 / 13297 (small craft d.c. / a.c.). 3% / 10% volt drop described as "the usual marine rule". No regulation numbers quoted.
- **Worked example** (VAN_EXAMPLE, 12 V 200 Ah LiFePO4, 400 W solar (2 × 200 W, Voc 24.3), 30 A DC-DC, 1500 W inverter, fridge, lights, pump, diesel heater, laptop, low-watt kettle, 2 days at 80%): 993.5 Wh/day = 82.8 Ah; needs 207 Ah (200 Ah ≈ 1.9 days, flagged); inverter 144.9 A → 200 A MEGA, 50 mm² (1.49% over 1.5 m); MPPT 100 V / 45 A, 2 in series, cold Voc 53.5 V; main 166.9 A → 225 A Class T, 50 mm²; 250 A isolator, 300 A shunt, 250 A busbars; DC-DC in 36.9 A → 50 A MIDI, 16 mm² over 5 m; out 40 A MIDI, 6 mm²; fuse box feed 30 A MIDI, 10 mm²; loads 1.5–2.5 mm² on 3–15 A blades.

## v0.16 (20 Oct 2026, branch `v0.16`, NOT pushed)
- Settings: one **Sync** card (connected as, status chip, Sync on/off switch, Sync now / Sign in, Disconnect with a confirm: turns sync off and signs out of Google, deletes nothing). "More" fold: Back up all jobs now, Restore from Drive, and the old "back up a job when I leave it" tick (only shown if it was already on). The leave-a-job backup in app.js now only runs when sync is OFF (sync already pushes every change). `profile.autoBackup` kept as is.
- Settings: one **Files** card (`#files`): Save backup file, Restore from file, Import extra details, Import results file (asks which EIC/EICR first, newest first, then the file; same importui.js preview).
- Certificate page: "Earlier results" card removed (certui.js).
- PDF: pdfkit `field()` now wraps a typed multi-line value line by line on growing fields (address pushes Postcode / the next row down); one-line fields join lines with commas; `t()` never draws a raw newline. Before, jsPDF drew the `\n` lines on top of the next row (Section E, EICR/MW addresses, install address + postcode).
- PDF order: `scheduleOrder(cert)` in pdf.js — board by board: DB1 circuit details sheets, DB1 test results sheets, then DB2 … (v0.5–v0.15 printed every board's circuit details, then every board's test results).
- No format change. Cache sparky-v0.16.0, APP_VERSION 0.16.0 beta. `node --test tests/` → 145 pass (tests/v16.test.mjs). PDFs: `node tests/pdf_v16.mjs <dir>` (multi-line addresses + 2 boards; overlap checker 0, was 45 on v0.15). Shots: `python3 tests/screens_v16.py <dir>` (fake Drive from sync_mock.py).

## v0.15 (20 Oct 2026, branch `v0.15`, NOT pushed)
- js/importjob.js (pure, tested): readImportFile (job.json / backup / {cert} / bare cert), mergeCert (fill empty only; arrays of objects matched by id then MATCH key: boards.ref, circuits.num, otherSources.make, bonding.location, observations.item; unmatched added; nothing removed; false/''/null/[] count as empty, so ticks are set but never cleared), planImport (cert by id then number; forceCertId on a cert page), counts, finish (updatedAt, version+1, imports[] {kind:'extra'}), opLabel/addDetail. Never merged: ids, timestamps, version, drive/sync fields, imports, photoIds, sigs; at cert level also jobId, number, type, status, amendedTo. Job/customer/files/presets in the file are ignored.
- js/importextra.js: route `#/import-extra` (preview → Import/Cancel). Buttons: Settings card and certificate "Earlier results" card. Saves with db.put + touchJob (sync picks it up).
- testlist.js `stepDone(c, step)` used by progress (R1+R2 / IR / RCD real-value rules; autoNA kept).
- No format change: only an optional `cert.imports` entry. Cache sparky-v0.15.0, APP_VERSION 0.15.0 beta. `node --test tests/` → 142 pass (tests/v15.test.mjs). Shots: `python3 tests/screens_v15.py <dir> <fake import json>`.

## v0.14 (19 Oct 2026, branch `v0.14`, NOT pushed)
- schedule.js circuitEditor: RCD group (.rcdgrp) moved into Circuit details after devBox; "Cable and wiring" heading before cableBox. boardTools: big "Test across circuits" link (.bigtest).
- js/testlist.js (pure, tested): TEST_STEPS (r1r2, ring, ir, pol, zs, rcd; dead then live), rowMode (skip spares / non-rings), quickFor, progress, fillEmpty (never overwrites). js/testacross.js: route `#/cert/<id>/b/<bi>/t/<step>`, uses checkCircuit/limitZs for flags. Imported in main.js.
- Other sources: optional `cert.otherSources = [{id, type, typeOther?, make, kw, isolation, ref, notes}]` (only printed/needed when supply.otherSources is ticked). certmodel: SOURCE_TYPES, blankSource, sourceRows, sourcesMissing, sourcesOk (SUPPLY doneIf). certui: sourcesSection under the Supply fields; stateLine lists what's missing. pdf.js: sourcesSheet after the bonding schedule, SRC_PER_PAGE 4, sourceSheetCount in contSheets, "(incl. … other sources of supply)".
- Cache sparky-v0.14.0, APP_VERSION 0.14.0 beta. `node --test tests/` → 135 pass (tests/v14.test.mjs). Shots: `python3 tests/screens_v14.py <dir>`; PDF: `node tests/pdf_sources_v14.mjs <dir>`.
- Note: `node --check` on these files does NOT check ES module syntax; use `node --input-type=module --check < file.js`.

## v0.11 (19 Oct 2026, branch `v0.11`, NOT pushed)
- js/presets.js: PRESET_KEYS, presetFrom/keyOf/nameFor/applyPreset/wouldOverwrite/shown/mergePresets/remember, load/save/mergeIn/used (meta 'devicePresets' = { list }), bulkApply, skipByDefault, BULK_FIELDS.
- backup.js: exportAll includes meta.devicePresets; importAll merges it; job.json gets optional devicePresets; applyRemote + sync pull merge it.
- schedule.js: presetPicker on the circuit editor, auto-remember on leaving a circuit (one hashchange listener), select mode + applyDialog on the board page. app.js: #/settings/presets.
- Tests: tests/v11.test.mjs, tests/screens_v11.py.

## v0.10 (19 Oct 2026, branch `v0.10`, NOT pushed)
- templates.js: isSpareCircuit, autoNA(c, k), DEVICE_KEYS, descChanged (500 V IR default cleared on spare / put back), makeSpare now only sets desc 'SPARE'. checks.isSpare = isSpareCircuit. New optional circuit field `noDevice`.
- pdf.js scheduleRows: auto N/A cells { v: 'N/A', auto: true } → AUTO_GREY [170,170,170] in tableGrid.
- schedule.js: placeholders + .autona class in the editor and landscape table, "No device fitted" tick on spares, code selects show N/A.
- certmodel/certui: field type 'heading' (never required). G/J reordered with IET headings.
- Tests: tests/v10.test.mjs, tests/screens_v10.py, tests/pdf_spare_v10.mjs.

## v0.9 (19 Oct 2026, built on branch `v0.9`, NOT pushed / not live)
- Sync: js/syncmerge.js (pure: planJob, needsPush, conflictCopy, deviceLabel, newestTime), js/sync.js (status listeners, schedule, init/connect/disconnect/syncNow, pull, conflict notices), db.onPut hook, backup.applyRemote (shared with Restore from Drive), backupJobNow re-reads the job before saving (edits during upload stay "changed since") and records job.syncSavedAt.
- New optional fields: job.syncSavedAt, job.conflictOf, job.conflictAt; job.json gets optional "device". Meta keys sync.config / sync.deleted / sync.conflicts (device-only). Backup file format unchanged.
- Pull asks Drive for job.json files modified since the last pull (drive.file scope: only files the app made).
- Check it 3-phase: calcui.js (phase seg), calc.sizeCable({ uo }) for % of 400 V.
- Max demand: js/maxdemand.js (sums), js/calcmd.js (#/calc/md and #/calc/md/<certId>); field option `action` in certui field().
- Look: v0.9 block at the end of styles.css; statsStrip on the jobs page.
- Tests: tests/v09.test.mjs; tests/sync_mock.py (two browsers, one fake Drive); tests/screens_v09.py, tests/screens_v09_look.py.
### v0.9 — to check
- 3-phase tables (cables.js swa4/swa4X/singles3, from memory of Appendix 4) — now also used by Check it.
- Diversity rules in maxdemand.js (OSG Appendix A Table A2 from memory): cooking 10 A + 30% (+5 A socket), heating 10 A + 50%, immersion 100%, showers 100/100/25%, sockets 100% largest + 40% others, lighting 66%, EV 100%.

## v0.8 (19 Oct 2026, built on branch `v0.8`, NOT pushed / not live)
- certmodel.js: fields take showIf/hideIf (key or (cert)=>bool), opt (not needed for the dot), dflt (tick inferred from data), placeholder, hint, indent, redraw. visible(), neededFields(), missingFields(); sectionDone uses them. PARTS has doneIf (a bonded service or bondNone).
- pdf.js particularsSection: N/A for hidden boxes; per-service csa three to a line.
- inspections.js: EIC_HELP / EICR_HELP (screen only). certui.js: helpLine, stateLine, Back + Next (.secnav).
- Tests: tests/v08.test.mjs (incl. overlap check on G/J variants); screenshots: tests/screens_v08.py.
### v0.8 — to check
- Reg numbers on the EIC section H help lines: 551.6/551.7, Section 411, 416, 412/413/414, 411.3.3/411.3.4/Section 415, Chapter 46/Section 537, Chapter 55, Section 514, Section 701, Part 7, Chapter 82.
- Typical sizes quoted in EICR help (16 mm² earthing / 10 mm² bonding on most PME homes; IPX4/IPX5 in bathroom zones; IP2X/IP4X top).

## v0.7 (19 Oct 2026, built on branch `v0.7`, NOT pushed / not live)
- **Layout/UX rework of the calculators. Sums unchanged** (all v0.3–v0.6 tests pass with the same values).
- **Calculators home** (`#/calc`): big cards with one line each: Size a cable & breaker (`#/calc/size`), Check a circuit (`#/calc/check`), Ring final check (`#/calc/ring`, new screen using the same `ringCheck()` as the circuit page), Solar string & battery checks (`#/calc/dc/pv`), DC system planner (`#/calc/dc/plan`). The last one used (`sparky.calclast`) shows at the top as "Carry on". The old tabs are gone (`calcTabs`/`dcSubTabs` return null); old links still work.
- **Shared look** (js/calckit.js): short input cards, a helper line and unit on each field, advanced fields under "More options" (the summary line shows the values in use), answer card at the top (big result + pass/fail chips), details folded ("How it worked it out", "Every size", "Where the numbers come from"). Fold open/closed state is kept for the session (`sessionStorage sparky.fold`). Amber banners say what's wrong and what to do.
- **DC planner wizard** (js/calcdcplan.js): `#/calc/dc/plan/<system|loads|charging|inverter|cables|results>`, progress stepper (tap any step), Back/Next bar, live "Wh a day · battery" pill. Same inputs object (localStorage `sparky.dcplan1`, `job.dcPlans[].inputs`); two optional UI keys added: `_off` (values kept when a switch is turned off) and `_have` ("I already have one" choice). Older versions ignore them. Opening a saved plan from a job goes straight to Results.
- **Kit you already have**: battery (battAh), MPPT (**new optional `mpptA`**: blank = picked as before; set = used, with a warning if it's under solar W ÷ V × 1.25), DC-DC (dcdcA, pre-filled with the suggestion), mains charger (shoreA, pre-filled), inverter (invW).
- **Results**: "What you need" card (battery, inverter, MPPT, DC-DC, mains charger, main fuse, main cable, isolator & shunt); warning banners with what to do; **Connections, in order** (js/dcwire.js `connections()`: every link with cable mm², red/black, length, fuse type + rating + where it sits, volt drop; only kit that's in the plan); **wiring diagram** (`wiringModel()` → inline SVG on screen, same model drawn with the Kit in the PDF; "Make it bigger" zoom); folded Cables & fuses, Parts list, Why, Safety notes; Share or save. Share-as-text adds the connections after the v0.6 text.
- **PDF**: Connections section after the summary, then the wiring diagram (own page if there isn't room at ≥ 0.33 scale), then the parts list etc. `tests/pdf_overlap.py` → 0.
- Assumptions shown on the connections (not new sums): the negative battery → shunt → − busbar cable is the main cable size and length; chassis bond 0.5 m; PV cable 4 mm² when the panel figures aren't filled in (as the v0.6 parts list).
- Cache `sparky-v0.7.0`, APP_VERSION `0.7.0 beta`. `node --test tests/` → 98 pass (94 old + 4 new in tests/v07.test.mjs). Screens: `python3 tests/screens_v07.py [outdir] [after|before] [baseurl]` (`VIEW=1280x800` for Mac width).

## v0.25 (Zs Pro)
- Renamed to **Zs Pro** (APP_NAME, manifest, title, PDFs). Repo, URL, DB name, `sparky.*`
  keys, APP_SLUG, DRIVE_ROOT ('Sparky jobs') and the backup format are unchanged.
  The Android TWA name lives outside the repo (sparky-android/project/twa-manifest.json):
  not changed; needs an APK rebuild.
- New navy "Zs / PRO" icon: `python3 make_icons.py` (Inter paths via fontTools, rounded to whole units).
- Google token renews quietly on a sync-button tap when it has under 10 min left (as Hearth).
- "Load spread evenly along the run" (radial only): volt drop on half the length.
- MCCB LSIG: optional Ig/tg on circuits, calculators and presets. Max Zs uses Ig when set
  (Uo × 0.95 ÷ Ig); adiabatic uses tg. Settings print in the schedule Remarks.
- Presets: no "used N×", most recent first then name; Im/Ig/tg saved (old keys unchanged);
  MCCB/MPCB presets never carry RCD fields.
- Parts used per job (js/parts.js, js/partspdf.js, #/job/<id>/parts): from the EICs (or
  EICRs if no EIC); spares with no device left out; Share text or PDF (job name + cert no. only).
- "Setting up a new phone? Restore from Google Drive" on an empty jobs page and in Settings › Sync.
- 3-phase flex in Check a circuit: H07RN-F, tri-rated, SY/CY. 3183Y has no 3-phase figures: a note says so.

## v0.26.0 beta (branch v0.26-equipment-sync, not merged)
- **Test equipment**: Settings → Test instruments, each with tags (the 6 IET boxes + PFC/Other, tag only). Certs (EIC/EICR/MW) pick one per test (`cert.instrumentIds`, optional); text still in `cert.instruments`. MW Section D prints a "Test instruments used" line (`mwInstruments`). No calibration dates printed. Pure code in `js/instruments.js`.
- **Quiet renewal**: `quietRefresh` on open/visible/focus, stops after a blocked popup; sync every 5 min while visible (`POLL_EVERY`). Known account shows "Tap to sync" instead of "Sign in".
- **Settings sync**: `settings.json` in the Sparky root folder; profile/logo, mysig, instruments; per-key last-write-wins with `sync.settingsStamps`; an empty side never wins (`js/settingsync.js`). Saves go through `saveSetting()`.
- **Job delete**: `js/jobdelete.js` bins the Drive folder (queued offline) and writes a tombstone. Other devices remove a job whose Drive copy is trashed/missing (`planGone`, checked every 15 min); a job with unsynced edits is kept and re-uploaded (updatedAt bumped so it beats the tombstone). Errors other than not-found never delete.
- **Max demand**: per-line working, group totals when lines combine, optional names, − / + steppers updating in place (scroll held).
- Tests: `node --test tests/` (250), `tests/sync_v26.py`, `tests/screens_v26.py`.
