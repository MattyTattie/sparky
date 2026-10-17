# Sparky (beta) — working name

Electrical certificates on your phone, to **BS 7671:2018+A4:2026**:
Electrical Installation Certificate (EIC), Minor Works, and Condition Report (EICR),
with schedules of inspection and test results laid out like the IET model forms
(dated 15 April 2026). No subscription, works offline, nothing leaves the phone
unless you share it or back it up to your own Google Drive.

**Beta.** Check everything before you issue a certificate. The built-in limits
(max Zs, IR minimums, RCD times, cable tables) are in `js/limits.js` and
`js/cables.js` with their sources. Check them against your own copy of the regs.

## What it does
- Jobs: one per visit, with customer, address, notes, photos and certificates. Saved
  customers fill in repeat jobs. You can copy a job (it keeps the details and clears
  the readings).
- Schedule of test results: one row per circuit (columns 1–31 as on the form). On a
  phone held upright you get a card per circuit; turn it sideways for the full table.
  It has circuit templates, copy row, one-tap SPARE/N/A, and fill buttons
  (>999, ✓, 500 V).
- Live checks: max Zs from Tables 41.2–41.4 (0.4 s and 5 s, Cmin 0.95), Table 41.5 on TT.
  Red means over the limit; amber means over 80%. IR below the Table 64 minimum,
  RCD times over the limit, and ring r1/rn/r2 checks are flagged too.
- Your details, logo, signature and test instruments fill in automatically. You get a
  warning when calibration is due within a month or out of date.
- EICR observations picker (C1/C2/C3/FI) with editable regulation numbers; the overall
  assessment follows the codes.
- PDFs follow the IET A4 layouts, with your branding, on-screen signatures and photos.
  Sharing goes through the phone's share sheet. The app never sends anything itself.
- Circuit chart for the board door, plus cable sizing and volt drop calculators.
- Consumer unit photo scan (reads B32/C16 and labels; you review every row) and
  voice entry ("Zs nought point four two").

## Files
`index.html`, `styles.css`, `sw.js` (offline), `manifest.json`, `js/` (all code, no build
step), `vendor/` (jsPDF, Tesseract), `fonts/` (Arimo for the PDFs, Inter for the app),
`tests/` (Node unit tests and Playwright screenshots with fake data only).

## Run the tests
    node --test tests/                 # limits, checks, calcs, voice, scan parser
    python3 -m http.server 8765 &      # then:
    python3 tests/screens.py /workspace/sparky-shots
    python3 tests/flow.py
    node tests/make_sample_pdfs.mjs /workspace/sparky-shots

## Before publishing
    ./check-private.sh .    # must pass
    ./build-sw.sh           # refresh the offline file list, and bump CACHE in sw.js
