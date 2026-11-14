# Sparky — niggles and update lists

## [BUILT v0.33.2 on branch `v0.33.2-row-open` — NOT LIVE] Tap a circuit number in the table to open it
- Schedule table (landscape phone / Mac): the No. cell is now a blue underlined number with a › chevron (pointer + hover tint on Mac). Click/tap or Enter on it opens that way's own circuit page. Other boxes stay typeable in the table; the circuit number itself is edited on the circuit page. The ✎ row button does the same.
- Back / All circuits returns to the table at the same scroll (page and table, saved per board, used once).
- Phone portrait cards unchanged. Shots: /workspace/sparky-shots/v0.33.2 (tests/screens_v332.py).

## [BUILT v0.33.1 on branch `v0.33.1-ocpd-autofill` — NOT LIVE] OCPD boxes auto-fill + description on test results
- Cause: the device picker never set Breaking capacity (kA); for an RCBO it set the RCD values in the data but the RCD boxes on screen (outside the device panel) weren't redrawn, so they looked blank until you left the page; it also overwrote a typed RCD BS and RCD rating, and switching away from RCBO left stale RCD values. Typing a BS number in the table only set the device.
- Now (js/ocpdfill.js): device / type / rating (picker, chips, typed BS or rating, table, presets) fill BS, type, kA (MCB/RCBO 6, BS 88-3 16, BS 88-2 50, BS 1362 6; none for BS 3036/MCCB/MPCB/other) and for RCBO RCD BS 61009, type A, 30 mA, rating = rating. Only blank boxes or ones the app filled (c.autoF) change; typed values (incl. N/A) never. Old circuits: existing values count as typed. Max Zs stays from the table. "No device fitted" spares skipped. Copy to next way carries the auto marks.
- PDF test results: narrow 'Circuit description' column after the circuit number (width taken from Remarks). Table cells wrap in full (no '…'); rows grow; only rows that can't fit go to a '(continued)' sheet.

## [BUILT v0.33.0 on branch `v0.33.0-a4-gaps` — NOT LIVE] A4:2026 form gaps
- EICR 1.1 split into six intake sub-rows (service cable, service head, earthing arrangement, meter tails, metering equipment, means of isolation) with NOTE 1/2 and a Y / N/A "person ordering notified" tick (screen + PDF). Old certs: a single old 1.1 outcome is copied to all six sub-rows (blank stays blank).
- "Report No." on all EICR pages; "Certificate/Report No." on generic schedules. EIC test results show signature + date by "Tested by".
- EIC Section C liability + "For CONSTRUCTION / INSPECTION AND TESTING" lines; Section J now fits on page 2 (EIC is 5 pages).
- Section G: kVA / A (delete as appropriate), RA/ZA, lightning protection system, optional RCD main switch kA, protective device settings note; Section F AC/DC ticks.
- EICR wording: 1.0 caveat, 7.1/8.1 "and attach to the report", Section D bullets, continuation hints; MW bold safety sentences, MW "Other (Specify)" bonding always shown; "Adding to an existing installation"; Remarks continuation hint.
- Page-by-page check vs IET refs: added RA/ZA "(delete as appropriate)", bold EICR Section G declaration, schedule "persons responsible" note, full 5.4/5.12/5.17 wording with bullets, MW "Notes for the person producing the Certificate", bold EICR guidance lead line.
- Not done (optional item 9 extras).

## [BUILT v0.32.0 on branch `v0.32.0-a4-forms`, 25 Oct 2026 — NOT LIVE] screenshots in /workspace/sparky-shots/v0.32.0, publish only on his OK
- [built] EICR observations on screen split into "C1 and C2" and "C3 and FI" like the A4 form (PDF was already split).
- [built] Optional AFDD BS (EN) / type / rating on circuits (and in presets; old presets keep their key). Printed on Minor Works Section C, the only A4 form with AFDD boxes. MW circuit editor also gets SPD BS (EN) / type (the PDF printed them but there were no inputs).
- [built] Optional board "Max demand (A)"; prints under the board details on the circuit details sheet only when filled.
- [built] Bidirectional devices (Reg 530.3.201): board tick "Fed by battery / PV / generator" (or a circuit described as battery/inverter/PV/solar/generator) shows a reminder with an "Add note" button. The note goes into the comments (EIC comments, EICR general condition, MW Section A comments) only when tapped, never twice.
- A4 gaps left: no AFDD columns or per-board max demand on the IET EIC/EICR circuit details sheet (we print max demand as an extra line); no AFDD details on EIC/EICR PDFs.

## [BUILT v0.16 on branch `v0.16`, 20 Oct 2026 — NOT LIVE] screenshots in /workspace/sparky-shots/v0.16, publish only on his OK
- [built] Settings tidy: one Sync card (status, on/off, connected as, Disconnect; backup-all / restore from Drive under "More"), then one Files card (Save backup, Restore from file, Import extra details, Import results file → pick the certificate). (Matthew 20 Oct)
- [built] Certificate page: Earlier results card gone (both imports are in Settings → Files). (Matthew 20 Oct)
- [built] PDF: multi-line addresses wrap and push Postcode down (Section E signatories, client and installation addresses, EIC/EICR/MW). (Matthew 20 Oct)
- [built] PDF with 2+ boards: all DB1 schedules, then all DB2. (Matthew 20 Oct)
- Still on the list: "Hybrid (battery + PV)" option in other-source types (offered, not confirmed).

## [BUILT v0.15 on branch `v0.15`, 20 Oct 2026 — NOT LIVE] screenshots in /workspace/sparky-shots/v0.15, publish only on his OK
- [built] Import extra details (Settings, and on each certificate under Earlier results): pick a Sparky .json (synced job.json, backup, or one certificate). Preview lists what will be added, which empty boxes get filled, and what's skipped because there's already a value; then Import or Cancel. Never overwrites or deletes. Matches certificates by id then number; boards by id then DB ref; circuits by id then number; sources by id then make. Touches updatedAt so it syncs. (Matthew 20 Oct)
- [built] Test across circuits count: R1+R2 needs a real value in R1+R2 or R2 (N/A in R2 with R1+R2 blank no longer counts). IR needs at least one real reading; RCD on a circuit with an RCD needs a real trip time. Deliberate N/A (e.g. RCD on a non-RCD circuit) and spare auto N/A still count. (Matthew 20 Oct)
- His battery import file (kept off the repo): /workspace/sparky-backups/sparky-import-battery-2026-10-20.json — adds Source 1, DB2 and its inverter circuit to EIC-0001.

## [BUILT v0.14 on branch `v0.14`, 19 Oct 2026 — NOT LIVE] screenshots in /workspace/sparky-shots/v0.14, publish only on his OK
- [built] Circuit page: the RCD boxes (cols 13–16, N/A buttons, S-type tick) now sit under "RCD (if any)" straight after the protective device, before "Cable and wiring". Col numbers kept. (Matthew 19 Oct)
- [built] Other sources of supply: ticking it on Supply and earthing opens a list (type battery / PV inverter / generator / other, make and model, kW, isolation and where, G98/G99 ref, notes), add/remove several. Prints "OTHER SOURCES OF SUPPLY (continuation sheet)" with the cert number, counted in the continuation sheets. Status line asks for a type and kW for each. For his inverter. (Matthew 19 Oct)
- [built] Test across circuits (board page, big button): R1+R2/R2 → ring r1/rn/r2 → IR (V, L–L, L–E) → polarity → Zs → RCD ms + button. Every circuit in a list with just those boxes, live red/amber flags, Next test / previous, fill-all-empty buttons, spares (and non-rings on the ring step) greyed. Same data as the circuit pages. EIC and EICR; not on minor works (one circuit only).
- Later maybe: AFDD button step; per-phase readings for 3-phase boards.

## [BUILT v0.11 on branch `v0.11`, 19 Oct 2026 — NOT LIVE] screenshots in /workspace/sparky-shots/v0.11
- [built] Device presets: chips on the circuit page (most used first), "+ Save as preset", and a new combination is remembered automatically when you leave a circuit. Tapping fills only BS/type/rating/kA/RCD boxes. Settings → Device presets: rename / delete. In the backup file (meta.devicePresets) and carried in each job.json for sync (merged by combination; deletes stick).
- [built] Board select mode: "Select circuits to change together", Select all (skips spares with No device fitted), Apply… a preset and/or set device + cable boxes; "Overwrite / Only fill empty boxes / Cancel" when something would change.
- No AFDD device field exists on circuits (only the AFDD test-button column), so presets have no AFDD part. Add one later if wanted.
- A preset change on its own only syncs when a job is next saved.

## [BUILT v0.10 on branch `v0.10`, 19 Oct 2026 — NOT LIVE] screenshots in /workspace/sparky-shots/v0.10
- [built] Generic device wording (sync, conflict copies "from another device" / "from this device", "this device" instead of "this phone"). Old conflict-copy titles left as they are.
- [built] G/J headings: Earthing conductor / Main protective bonding conductors (None-needed tick first) / Bonding of extraneous-conductive-parts. PDF layout unchanged.
- [built] Spare ways: "spare" (any case) → empty boxes show grey N/A placeholders, device boxes stay blank unless "No device fitted"; PDF prints auto N/A light grey. Old v0.9 spares (typed N/A) print as typed.

## [BUILT v0.9 on branch `v0.9`, 19 Oct 2026 — NOT LIVE] Sync, 3-phase Check it, max demand, new look — screenshots in /workspace/sparky-shots/v0.9, publish only on his OK
- [built] Automatic sync phone ↔ Mac through his Drive (same "Sparky jobs" job.json files as the backup): sign in once per device (Settings → Google Drive → Turn on sync); changes go up ~20 s after the last edit (or straight away when the app is hidden); open/focus/online pulls newer job.json files. Changed on both → newest kept, the other saved as a "conflict copy" job (with its certificates and photos) and a notice on the jobs page. Deleted jobs stay deleted (per-device list). Status dot in the top bar (synced / syncing / offline / sign in / error) and a clear message in Settings.
- [built] Check it: Single-phase / 3-phase 400 V (4-core SWA 70/90 °C, singles), Ib per phase, volt drop % of 400 V, Zs/adiabatic phase–earth. ⚠ 3-phase tables from memory (same as the sizer): Matthew to check against Appendix 4.
- [built] Maximum demand helper (Calculators, and "Work it out from the loads" under the max demand box on G/J): OSG Table A2-style diversity, realistic-peak note, supply fuse check, "Use N A on EIC-xxxx". Example house = 124 A.
- [built] New look: deeper electric header, softer shadows, gradient buttons/chips, coloured calculator tiles, stats strip on the jobs page, page fade-in, focus rings. Theme colour #1a2bd6 (index.html, manifest, Android).
- [built] Android app v3 (versionCode 3, 0.9.0, status bar #1A2BD6, same key): /workspace/sparky-android/output/Sparky-v3.apk. No GitHub release yet.
- Not synced: Settings (your details, logo, instruments) and deleting a certificate inside a job. Customers only travel with their jobs.
- Later maybe: dark mode; 3-phase on the circuit schedule.

## [BUILT v0.8 on branch `v0.8`, 19 Oct 2026 — NOT LIVE] Section G/J + green dots (Matthew 19 Oct) — screenshots in /workspace/sparky-shots/v0.8, publish only on his OK
- [built] Earth electrode boxes only show with "Installation earth electrode"; otherwise N/A on the PDF.
- [built] Each bonded service (water, gas, oil, steel, lightning, other) gets its own csa box (blank = same as main bonding csa). PDF prints each with its size, unticked = N/A; main csa shows e.g. "10 / 16" if they differ. "No services need main bonding" tick (prints N/A).
- [built] "Main switch is a breaker or fuse (OCPD)" and "Main switch is an RCD" ticks: boxes hidden + N/A when off. Old jobs with values in those boxes count as ticked.
- [built] Green dots: every needed box in a section (hidden and "if any"/departures boxes not needed), plus a "Still to fill in for the green dot: …" line at the top of each section.
- [built] Plain "what to check" line under each item of the schedule of inspections (screen only), with reg numbers where certain.
- [built] Back button next to Next on every section (not on the first).
- New optional fields: parts.msIsRcd, parts.msIsOcpd, parts.bondNone, parts.bond{Water,Gas,Oil,Steel,Lightning,Other}Csa.
- Matthew to check: HANDOFF.md "v0.8 — to check".
- Not done: tests/flow.py is out of date since the v0.4 restyle (fails the same on main).

## [BUILT v0.7 on branch `v0.7`, 19 Oct 2026 — NOT LIVE] Calculator layout (Matthew 19 Oct: "the DC part seems a bit hard to understand") — screenshots in /workspace/sparky-shots/v0.7, publish only on his OK
- [built] Calculators home: big cards, plain one-liners, last used at the top. Ring final check as its own calculator.
- [built] DC planner as 6 steps (System, Loads, Charging, Inverter, Cable runs, Results), jump to any step, More options for the advanced bits, helper line on every field.
- [built] Results: "what you need" summary, warnings with what to do, Connections in order (every link: cable, length, fuse and where it sits, volt drop), wiring diagram (screen + PDF), the rest folded.
- [built] "I already have one" for battery, MPPT, DC-DC, mains charger, inverter.
- [built] Same answer-card / More options layout on Size it, Check it and Solar / battery.
- Later maybe: pick an isolator/busbar/fuse box he already has; thin-wall auto cable; diagram for 24/48 V house systems with several batteries in parallel.

## [BUILT v0.6 on branch `v0.6`, 19 Oct 2026 — NOT LIVE] DC system planner (Matthew 19 Oct: camper van, "a list of everything I need") — screenshots in /workspace/sparky-shots/v0.6, publish only on his OK
- [built] "Solar / battery" tab renamed "DC", with two parts: Solar / battery checks (unchanged) and DC system planner.
- [built] Planner: 12/24/48 V, LiFePO4/AGM/lead + usable %, days with no charging, loads (W or A, hours, peak, run length, 10% tick for lighting; quick picks), solar (W, Voc/Vmp/Isc, series, MPPT max V), DC-DC (A, alternator), mains charger, inverter.
- [built] Results: daily Wh/Ah, battery Ah, every cable + fuse with reasons, inverter, MPPT + cold Voc, DC-DC + input cable, main Class T fuse (LiFePO4), isolator, shunt, busbars, chassis bond, grouped parts list with lengths (+10%) and lugs; share as text, PDF (view/share), save to a job (job.dcPlans, optional) + PDF in Saved PDFs.
- Matthew to check: HANDOFF.md "v0.6 — values to check".
- Later maybe: thin-wall automotive cable ratings (maker's table), inverter idle draw, per-load "on at the same time" ticks (diversity).

## [BUILT v0.5 on branch `v0.5`, 19 Oct 2026 — NOT LIVE] Batch agreed 18–19 Oct 2026 (Matthew) — screenshots in /workspace/sparky-shots/v0.5, publish only on his OK
- [built] Security fixes (below) and Restore from Drive messages.
- [built] Supplementary bonding schedule (location, csa, parts bonded, continuity) on EIC/EICR, printed as a continuation sheet.
- [built] Continuation sheets labelled with DB ref, sheet x of y, certificate number and Page X of Y; schedules grouped (all circuit details, then all test results).
- [built] PDF text never overlaps: shrink → wrap at spaces/hyphens → ellipsis; fields grow; checked on every page with tests/pdf_overlap.py.
- [built] 3-phase 400 V in the cable sizer (4-core SWA, singles). Not done: 3-phase in "Check it".
- [built] "Paid app" polish: icons, bottom nav, empty states, skeletons, press states, cleaner PDF header/footer.
- [built] Android app v2 (blue status bar, white splash), output/Sparky-v2.apk, same key.
- Matthew to check: HANDOFF.md "v0.5 — values to check" (3-phase tables especially).
- Later maybe: 3-phase in "Check it"; 3-phase on the circuit schedule (per-phase Zs/PFC columns).

## [BUILT v0.4 on branch `v0.4`, 18 Oct 2026 — NOT LIVE] Batch agreed 17–18 Oct 2026 (Matthew) — screenshots in /workspace/sparky-shots/v0.4, publish only on his OK
- [built] New look: clean white + electric blue, rounded cards (restyle branch 7ff61ca merged in; cache sparky-v0.4.0, manifest theme #2952ff, APP_VERSION 0.4.0 beta). Android app splash/status bar stay navy until the APK is rebuilt.
- [built] Proper ring final check when "Ring final circuit" is ticked: r1/rn/r2 boxes only show when ticked; r1 vs rn within 0.05 Ω; r2 ≈ r1 × live/CPC csa (1.67 for 2.5/1.5); expected R1+R2 = (r1+r2)/4 and L–N = (r1+rn)/4; ring length from r1; ring volt drop (OSG: 20 A at far point + 12 A spread); expected Zs = Zdb + (r1+r2)/4.
- [built] DC calculator (Solar / battery tab): two-way DC volt drop at conductor temp, 1–3% target, cable size up to 120 mm²; PV cold-morning Voc vs inverter max and MPPT top (default −10 °C); string fuses (3+ strings, 1.5–2.4 × Isc, ≤ panel max series fuse); battery fuse ≥ 1.25 × current and cable ≥ fuse.
- [built] Copy a circuit (to this or another board, readings optional) / copy a whole board (new ids, readings and board tests optional).
- [built] Observation codes library: 54 entries (C1 8, C2 21, C3 19, FI 6), filter by code, search, grouped; "Use wording from the library" on each observation.
- [built] "View" PDFs inside the app (pdf.js, works offline, zoom button) on the job page's saved PDFs, the certificate's "View PDF", and circuit charts.
- [built] Re-test reminders: next inspection per job (from the EICR date / EIC interval, or typed in), "Due soon" (90 days / overdue) on the jobs page, 📅 calendar file (.ics) with a reminder a month before.
- [built] Adiabatic check (543.1.3) on the circuit page (from measured Zs; amber flag on CPC), in "Check it" and in the sizer. k 115/143/176, armour 51/46.
- [built] Cable & breaker sizer ("Size it" tab): load kW/A (+pf), run, method, ambient, grouping, insulation (Ci incl. Table 52.2 short lengths), T&E / 6243Y / singles / SWA; next breaker ≥ Ib, B (C for motors); smallest cable passing Iz, volt drop (3%/5%), Zs, adiabatic; plain-words reasons ("2.5 fails on volt drop at 32 m, so 4 mm²"); ring option.
- Matthew to check: see HANDOFF.md "v0.4 — values to check".

## [DONE v0.3, 17 Oct 2026] Calculator overhaul (Matthew 17 Oct 2026)
- Make the calculator more intuitive (clearer layout, fewer steps).
- Volt drop for ring final circuits (ring = quarter of radial length-based drop; allow load distributed / at a point).
- Ambient temperature options going down to 20°C (not just 25°C+), with matching correction factors.
- Drop-downs for protective device type and curve (MCB / RCBO, B / C / D, BS EN 60898 / 61009 / fuse types) so max Zs comes out right.
- 3-core SWA cables in the calculator (ratings, volt drop, R1+R2 using armour as CPC and/or 3rd core as CPC).

## [DONE v0.3, 17 Oct 2026] Circuit page drop-downs (Matthew 17 Oct 2026, screenshot of circuit page)
- Type of wiring (col 3): drop-down using the IET schedule codes (A–H, O) with plain names shown, e.g. "A – thermoplastic (PVC) insulated and sheathed".
- Reference method (col 4): drop-down of BS 7671 Appendix 4 reference methods (A, B, C, D, E, F, G, 100–103 for insulation/T&E in walls/ceilings etc.) with short plain descriptions.
- Cable picker: choose "Twin & earth (6242Y)" then a size drop-down 1.0–16 mm² that auto-fills live csa AND the correct CPC csa (1.0/1.0, 1.5/1.0, 2.5/1.5, 4/1.5, 6/2.5, 10/4, 16/6). Also "3-core & earth (6243Y)" with its correct CPC sizes (verify against maker data before coding), and 3-core SWA (from calculator list). Should also feed max Zs / R1+R2 checks.
- Done in v0.3. Flagged in the UI source notes: 20 °C uses the Table 4B1 25 °C factor; SWA armour resistance is from maker data; 6243Y 2.5 mm² CPC is filled as 1.0 (makers differ); 3-core SWA is rated with the 2-core single-phase columns.
- [built v0.5] Restore from Drive: show a clear message on any failure (pop-up blocked, no backups found, sign-in failed) instead of doing nothing. Mac restore "did nothing" 18 Oct then worked; cause not confirmed (likely the sign-in pop-up being asked for after a wait, now asked for straight in the tap).

## Security fixes (review 18 Oct 2026)
- [built v0.5] pdf.js: isEvalSupported:false (same as Hearth).
- [built v0.5] Note that voice entry uses Google speech service.
- [built v0.5] Add Content-Security-Policy meta (tested: sign-in script, Drive mock, pdf.js, OCR).
- Later maybe: separate Google OAuth client for Sparky.

- [built v0.10] Wording: remove "phone and Mac" / device-specific wording (sync text, conflict copy titles "from phone/Mac" etc.) — say "your devices"/"another device". Matthew wants it generic, not bespoke. (19 Oct)
- [built v0.10] Section G/J wording to match IET form: "Earthing conductor" (not main), "Main protective bonding conductors" (material/csa) as one heading, then separate heading "Bonding of extraneous-conductive-parts" for water/gas/oil/steel/lightning/other ticks (keep per-service csa). (19 Oct)
- [built v0.10] Typing "spare" (any case) as circuit description auto-fills rest of that circuit row (circuit details + test results) with grey N/A placeholders, counts as done; removing "spare" restores (do not overwrite real values). (19 Oct)
  - Spare: N/A must be a placeholder (typing replaces it). Leave protective device fields (BS, type, rating, kA, RCD) blank/editable for spares; only cable + test fields go grey N/A. Typed values print instead of N/A. (19 Oct)
  - Spare: add "No device fitted" tick; when on, device fields also grey N/A. (19 Oct)
  - Auto N/A prints grey on the PDF too (typed values black). Show PDF screenshot. (19 Oct)
- [built v0.12] Status line: replace "All filled in ✓" / "for the green dot" wording with "Section complete ✓" (and "Still to fill in: …" without "for the green dot"). Add the same status line to section H (schedule of inspections) and other special sections. (19 Oct)
- [built v0.12] Text areas (comments, descriptions, observations etc.) auto-grow to fit their content as he types (no inner scroll, no text cut off sideways); on Mac and phone. (19 Oct)
- [built v0.12] Schedule table rows: add a bin/delete-circuit button (with confirm "Delete circuit N?", offer renumber if sequential) next to edit/copy/spare icons; also on circuit page. (19 Oct)
- v0.14.1: ring hint on the R1+R2 step of Test across circuits.
- [built v0.15] Test across circuits R1+R2 step counts a circuit as done when R2 is N/A but R1+R2 is blank. Should need a real value in one of them (N/A in both = not done unless spare).

## v0.25
- Parts used counts one RCD per different RCD found on MCB circuits; two identical RCCBs on a split board show as one. Check before ordering.
- 3183Y PVC flex: no 3-phase table data in the app, so it switches to H07RN-F with a note.

## v0.26 notes
- Browsers usually block silent renewal without a tap; then "Tap to sync" shows.
- Removing a signature/logo on purpose won't sync to other devices (empty never wins).
- Binning a job folder by hand in Drive deletes that job on devices where it's unchanged.
- Two devices creating settings.json at once could leave a duplicate; the first found is used.
- Each sync reads settings.json (~2 extra requests per 5 min); each linked job gets a metadata check every 15 min.
- Max demand: taking a line to 0 near the page bottom can shift the scroll a little (page gets shorter).

## v0.27 notes
- Jobs home on desktop is a single list; the list/detail split appears once you open a job or certificate.
- The 2-column form rule is generic (cards with 3+ fields); some checkbox rows sit in their own row, leaving the odd gap.
- Schedule of test results still scrolls sideways at 1280px for the last columns (the IET table is very wide).
- The top bar still shows the Zs Pro mark on the jobs page as well as the sidebar.

## v0.28 notes
- Phone diff vs main: identical apart from the version text, the "last used" calculator, and hover/time-stamp noise from the test run.
- Desktop polish is CSS overrides of the phone styles; a few rarely used screens (scanner, DC planner steps) haven't been checked at desktop size.
- Jobs table sorts text alphabetically (status sorts by its wording, not by urgency).
- Max demand boxes are in order of each kind's first line, not the order of the "Add" chips.

- [DONE v0.31, live] Spare ways (Matthew 25 Oct): spare circuit card shows "Spare way · B16 A" and drops the device type even when he picked RCBO. Show the full device like live ways ("Spare way · B16 A RCBO"); if no device picked, show just "Spare way" (no default B16).

- [DONE v0.31, live] Board main RCD (Matthew 25 Oct): setting any one of RCD BS (EN) / RCD type / IΔn / Rating to N/A fills all four with N/A (only blanks; typing a real value later clears the N/As).

- [DONE v0.31, live] Parts list PDF (Matthew 25 Oct): PDF button currently goes straight to share/download; give it the same View / Share choice as the DC plan PDF (pdfview.js viewPdf).

- [DONE v0.31, live] (Matthew 25 Oct) Version shown in Settings. "Copy to next way" for a circuit (breaker, cable, etc; not test results). Mark several ways spare at once. Cert PDFs get View / Share choice. Mac: Tab/Enter move quickly through test boxes.

## v0.31.1 notes (Drive folder renamed to "Zs Pro", Matthew 25 Oct)
- The app renames its own "Sparky jobs" folder to "Zs Pro" (same folder id, so jobs/photos/settings stay put). Don't rename it by hand.
- Choice when several exist: a "Zs Pro" folder beats "Sparky jobs"; then the one with most items; then the oldest. Contents of the others are moved in (ids kept) and the empty folder goes to Drive's bin (restorable 30 days).
- Old version on another device: if it already synced it has the folder id cached and carries on fine in the renamed folder. If it's a fresh install/cleared data it can't find "Sparky jobs" and makes a new one; the new version moves that in and bins it on its next start (one extra Drive check per app start). Update both phone and Mac to 0.31.1 to avoid the back-and-forth.
- Merging two folders can leave two settings.json files; the first found is used (as v0.26).

## v0.31.2 notes (SPD N/A + board details tidy, Matthew 25 Oct)
- SPD boxes cascade like the main RCD: ticking "SPD status N/A" or SPD type "N/A", or typing N/A in "SPD protective device", ticks the other N/A and fills the device box only if blank. Ticking T1/T2/T3 or "status confirmed", or typing a real device, clears the N/As. T1-T3/status ticks and a typed device are never changed. Unticking an N/A does nothing to the others.
- Tick boxes were squashed (flex-shrink) when their label wrapped on narrow screens, so short-label ones like "SPD status N/A" looked bigger. Now all stay 24x24. PDF ticks were already one size.
- Boxes in a 2/3-column row line up (labels at the top, inputs at the bottom), e.g. Supplying device / Type / Rating when "Supplying device BS (EN)" wraps.
- DB reference and Location are each on their own full-width row.
- (Matthew follow-up) Ticking SPD type "N/A" by hand = no SPD fitted: unticks T1-T3 and "status confirmed", ticks SPD status N/A, puts N/A in a blank SPD protective device, and hides those three boxes behind "No SPD fitted" (polarity / phase sequence stay, they aren't SPD boxes). Unticking it shows them again and undoes only the N/As it filled itself (kept in optional `spdAuto`). T1-T3 / status confirmed it unticked are not restored.
- Ticking "SPD status N/A" alone still cascades (ticks type N/A) but hides nothing.
- PDF: the IET forms have no SPD device box; the SPD type N/A and status N/A print as ticks, as before.
- Correct polarity / Phase sequence moved out of the SPD group into their own "Board checks" group above SPD type (screen only; same fields, PDF unchanged).

## v0.31.3 notes (SPD ticks, Matthew 25 Oct)
- Bug: T2 + SPD type N/A + SPD status N/A all ticked. Cause: in 0.31.2 ticking "SPD status N/A" also ticked type N/A for you without clearing T1-T3 (and, being auto, didn't hide the boxes); certs saved before 0.31.2 could also have both.
- Now SPD type N/A and T1/T2/T3 are mutually exclusive (T1+T2 etc. still fine). Old certs with both show as saved and get fixed on the next SPD change.
- On-screen "SPD status N/A" replaced by "Not operational" (optional `spdNotOp`), exclusive with "status confirmed". Ticking it adds one observation (item 4.19, reg 651.4, location "Board DBx", code C2 to start); unticking removes it only if its text and code are unchanged. On an EIC the observation is stored but the EIC PDF has no observations section.
- PDF "SPD: N/A" tick = type N/A (or old spdStatusNA, so old certs print as before). Not operational prints the status box unticked.

## v0.31.4 notes (Matthew 25 Oct)
- "Not operational" SPD tick and its auto observation only on cert types with an observations section (EICR). EIC and Minor Works don't show the tick at all, so nothing is added. Old EICs with spdNotOp ticked keep the data (hidden, prints the status box unticked); observations already saved on EICs are left alone.

## v0.45.0 (PUBLISHED 9 Nov 2026 13:48 GMT)
- Done: TT with N/A in the RCD boxes now uses the Table 41.3 max Zs (was 1667 Ω, no red); RCD time ">300" and IR "<1" go red; no "Saved as device preset" pop-up on opening a circuit; Continue text centred; SPD "operational status confirmed" full width on EIC/MW; Drive bin queue no longer drops a folder when two jobs are deleted fast.
- Streamlined: circuit page (Copy to next way + SPARE up top, the rest under More; disconnection time / own max Zs and AFDD folded; one S-type control), board page (buttons and circuits first, details folded once filled, "Fill the empty boxes" chips only when there are circuits), Test across button on the certificate page, wiring diagram off in the PDF unless ticked, one Share PDF button (Email merged), no second Settings gear, presets saved quietly, new job phone/email/notes under More details.
- v0.45.1 (PUBLISHED 9 Nov 14:19 GMT): Garo CU (DB2) parts list missed its main switch. Later boards now have DB1's main switch boxes, parts list lists them, scan fills them, hint if missing.
- v0.45.2 (PUBLISHED 9 Nov 15:28 GMT): DB2's main switch now prints on its schedule header; DB1's board details point to where its main switch is entered.
- v0.45.2 (PUBLISHED 9 Nov 15:28 GMT): Board details card sat touching the fill chips (0 px gap); now 12 px like the other blocks.
- v0.45.3 (PUBLISHED 9 Nov 17:18 GMT): diagram drew the main switch as its own box between Meter and DB1; now it's inside each board block (DB1 from the certificate, DB2+ from board details).
- v0.45.3 (PUBLISHED 9 Nov 17:18 GMT): DB1 can be set to 'Meter via connector block' like the other boards; off by default, never guessed; drawn on the diagram.
- v0.46.0 (PUBLISHED 9 Nov 17:18 GMT): Check certificate before the PDF (missing fields, Zs/IR/RCD over limits, Satisfactory with C1/C2), each with a link; can still make the PDF.
- v0.46.0 (PUBLISHED 9 Nov 17:18 GMT): Ring / Radial / Lights quick fill on a circuit’s test results; empty boxes only unless you say so; Undo.
- v0.46.0 (PUBLISHED 9 Nov 17:18 GMT): enter a shared RCD’s trip time once on the RCD step and apply it to its circuits (RCBOs stay per circuit).
- v0.47.0 (PUBLISHED 9 Nov 19:43 GMT): per-board TT earthing (RA, electrode) with Table 41.5 / RA × IΔn checks; prints and draws.
- v0.47.0 (PUBLISHED 9 Nov 19:43 GMT): split-load boards: "Which RCD" (RCD 1 / RCD 2) keeps two identical RCCBs apart in parts, diagram and Reuse RCD times.
- v0.47.0 (PUBLISHED 9 Nov 19:43 GMT): parts list no longer double-counts RCDs; RCD main switch is one line; SPD MCB and meter tail connector block listed.
- v0.47.0 (PUBLISHED 9 Nov 19:43 GMT): RCD main switch has one set of boxes with an S chip; PDF/diagram show type, S, IΔn and location.
- v0.47.0 (PUBLISHED 9 Nov 19:43 GMT): ring final template ticks ring + cable; RCBO→MCB clears stale RCD details (board RCD or N/A prompt).
- v0.47.0 (PUBLISHED 9 Nov 19:43 GMT): board RCD S-type carries down to its circuits, amber if they differ.
- v0.47.0 (PUBLISHED 9 Nov 19:43 GMT): tapping a chosen chip no longer clears it.
- v0.47.0 (PUBLISHED 9 Nov 19:43 GMT): generation printed/drawn; battery and EV charger prompt chips; "Use my details" for blank signatory boxes.
- v0.47.0 (PUBLISHED 9 Nov 19:43 GMT): cosmetic: page 1 signature fits its line, max Zs 1667, outbuilding label, empty board not complete, section letters, DB1 OCPD N/A.
- v0.47.1 (PUBLISHED 9 Nov 20:39 GMT): board scan reads sideways photos (turns them upright), and has a Turn button.
- v0.47.1 (PUBLISHED 9 Nov 20:39 GMT): board scan knows an RCCB (Garo DCCB, 61008) from the main switch: fills the board's RCD (BS, A, mA) and its MCBs pick it up; SPD Type 2 and main switch BS 60947-3 filled if blank.
- v0.47.1 (PUBLISHED 9 Nov 20:39 GMT): checked on Matthew's real Garo DB2 photo (sideways): B50 circuit, 100 A main switch 60947-3, RCCB 61008 63 A 300 mA, SPD T2.

## [DONE v0.48.0, LIVE 14 Nov 2026 ~08:15 GMT, main e10d4ea] New list (10 Nov 2026)
- [x] Circuit with "No device fitted" ticked (Spare) still highlights a device preset chip (B50 MCB 6 kA). Should clear/unhighlight presets when no device.
- [x] Device presets list shows duplicate-looking chips (B50 MCB 6 kA x3, B50 MCB, B50 MCB 300 mA Type A-S S). Investigate what differs; dedupe identical ones and label differences so chips are distinguishable.
- [x] Spare way / No device fitted: Type (col 9) and Rating (col 10) still default to B / 3 A and print on the schedule (seen on DB2). Should print N/A; add N/A chip to Type and Rating rows and auto-select it when No device fitted is ticked.
  - Matthew confirmed (10 Nov): No device fitted => whole row N/A: all device boxes (BS, type, rating, kA, max Zs, RCD fields) AND all test results (R1+R2, IR, Zs, RCD times). Still editable by hand.

## [DONE v0.48.0, LIVE 14 Nov 2026 ~08:15 GMT, main e10d4ea] Calculator + diagram audit (13 Nov 2026)
Built as v0.48.0 beta (`sparky-v0.48.0`). **Live since 14 Nov 2026 ~08:15 GMT (main e10d4ea); the live smoke passed at 390/1440.** Workings, PDFs and screenshots: `/workspace/polish-review/zspro-v0480/`.

Audit only of v0.47.1 (local serve of the live build) at 390px and 1440px, with a fake 4-DB EIC. No app code changed. Screenshots and workings are in `/workspace/polish-review/zspro-calc-diagram-audit/`. Maths checked against BS 7671:2018+A2/A3 tables as used in the app (A4:2026; Uo=230, Cmin=0.95, Uo×Cmin=218.5 V). Max Zs (Tables 41.2–41.5), 80% rule, R1+R2 (OSG I1), volt drop (Table 4D5), Ca (Table 4B1), Cg (Table 4C1), shower/cable sizing, max demand (OSG Appendix A) and fault-level sums all matched the book figures where tested. Findings below are faults first (by severity), then upgrades. Separate from the 10 Nov list above.

### Faults
- [x] **Medium — Diagram draws ring vs radial from a name/size guess, not the "Ring final circuit" tick.** `isRingC()` in `js/wiring.js` is: "ring" in the description, or 32 A and 2.5 mm² unless the description has "radial". It never looks at `c.ring`. The rest of the app (`isRingCircuit()` / the tick) does. Confirmed on a fake job in v0.47.1: (1) Kitchen sockets, 32 A 2.5 mm², tick OFF, no "radial" in the name → `isRingC` true, drawn as a closed ring loop (screen at 390px and the diagram PDF); the schedule correctly treats it as a radial and ambers "32 A on 2.5 mm²… a 2.5 mm² radial can't be on 32 A" (Table 4D5 method C, It 27 A). (2) Upstairs sockets, 32 A 4 mm², tick ON, no "ring" in the name → `isRingC` false, drawn as a radial (single leg plus a hanging socket). See `390/32-diagram-kitchen-radial-as-ring.png`.
- [x] **Medium — Schedule cable check ignores Ca, Cg and Ci.** `cableCheck()` uses tabulated It only and says "before correction factors". A 32 A device on 6 mm² T&E method C (It 47 A, Table 4D5) is not flagged. At 55 °C, Table 4B1 Ca for 70 °C PVC is 0.61, so Iz = 47 × 0.61 = 28.67 A, which is below 32 A. The Check calculator applies the factors and correctly fails: "CCC after factors: 28.67 A, too small" (`crops/390-08-check-6mm-55C.png`). The Size calculator at the same conditions correctly steps up to 10 mm² (Iz 39.04 A). The circuit page has no ambient/grouping/Ci boxes.
- [x] **Medium — Cooker, shower and other named loads are drawn as "1 × point" with no symbol.** `noGuessLoad()` is true for every non-socket circuit that has no rooms and no switches, so the diagram suppresses guessed load names and symbols (v0.44.4 comment said this should only apply once the user has their own item list). Confirmed: "5 Cooker" and "6 Shower 9.5 kW" both show "Points: 1 × point" and no cooker/shower symbol, on screen and on the diagram PDF. Sockets and lights are drawn. EV charger and the hybrid inverter show amber "Add points served to draw sockets/lights" instead of an EV/inverter symbol.
- [x] **Medium — On a 390px phone, the sticky Previous / All circuits / Next bar overlaps the circuit form.** It sits on top of the 80 / 100 / 125 A rating chips and the OCPD BS (EN) / breaking-capacity (kA) boxes, so those fields are hard to read or tap. Confirmed on Circuit 2 and Circuit 11 (`crops/390-40-circuit-kitchen-radial.png`, `crops/390-42-circuit-utility-6mm.png`). At 1440px the bar does not cover the fields.
- [x] **Low — Check and Size calculators reject comma decimals; the Ring final check accepts them.** Size: load `9,5` kW shows "Enter the load (kW or amps)" and no answer (`crops/390-05-size-comma-9comma5.png`). Check: Ze `0,35` leaves the Zs chip grey (not calculated). Ring final check with r1/rn/r2 `0,32` / `0,32` / `0,53` reports "Ring looks sound" (it uses `checks.num`, which allows commas). `Number()` / unary `+` in the other calculators do not.
- [x] **Low — Check calculator's thermal-insulation picker is only Ci 1.0 and 0.5.** Size uses the full Table 52.2 set in `CI_OPTIONS` (0.88 / 0.78 / 0.63 / 0.51 for 50–400 mm through insulation, plus 0.5). An electrician checking a cable through 100 mm of insulation can only pick none or "totally surrounded". Code: `js/calcui.js` vs `js/calcsize.js`.
- [x] **Low — 90 °C Ca at 25 °C is 1.02 in `js/cables.js`; the usual Table 4B1 figure is 1.04** (√((90−25)/(90−30)) = 1.0408). Conservative, so it may oversize slightly. (20 °C using the 25 °C column is already disclosed in HANDOFF.)
- [x] **Low — `lengthFromR1R2()` has no ring argument.** A measured 0.195 Ω on 2.5/1.5 mm² is reported as 10 m (radial) not 40 m of ring (÷4). The circuit page only shows this hint when `!isRingLike(c)`, so a correctly ticked ring is safe. It would mislead if a ring was not recognised as one.
- [x] **Low — Size calculator at 390px: "Single-phase 230 V" wraps with "V" on its own line** inside the selected chip (`crops/390-04-size-55C-32A.png`). Cosmetic; fine at 1440px.

### Upgrades
- [x] **"Use on a circuit" from the Check calculator** (Size already has this button). Push the cable, breaker, and expected R1+R2 / Zs onto a chosen circuit on the schedule, so a "check" you just ran does not have to be typed in again.
- [x] **Ambient, grouping and Ci on the circuit (optional), and an Iz-after-factors check on the schedule.** Closes the Medium cable-check gap. The Check calculator already has the sums; the schedule should not silently ignore a hot loft or a bunch of circuits.
- [x] **Draw cooker, shower, EV and immersion symbols from the circuit name** unless the user has set their own item list. Don't show "Add points served to draw sockets/lights" on sub-mains, inverters or EV chargers; offer a one-tap "draw 1 × EV charger" (or cooker/shower) instead.
- [x] **Make `isRingC()` use the same rule as the "Ring final circuit" tick** (`isRingCircuit()` / `c.ring`). That is the fix for the first Medium fault.
- [x] **Adiabatic: optional maker I²t (let-through) figure**, instead of only the conservative default, so a 1.5 mm² CPC on a B20 is not failed (or only ambered) when the maker's energy-let-through would pass 543.1.3.
- [x] **Share or export the wiring diagram as a PNG (or a share sheet)** as well as "View PDF". The PDF path already works (4-page diagram, 0 overlaps on the fake 4-DB job).
- [x] **Cable numbers C1, C2… follow drawing order (RCD groups), not circuit numbers**, so circuit 5 becomes C3. Show the circuit number as well ("C3, circuit 5"), or number cables to match the circuit, so the "Feeds DB2 by cable C8" line is easier to follow on the schedule.
- [x] **Give the Check calculator the same Ci options as Size** (full Table 52.2).
- [x] **Accept comma decimals in every calculator**, the same way `checks.num` and the Ring final check already do.
- [x] **RCD selection hints on the circuit** (Type A for sockets that may supply outdoor equipment, Type B / 6 mA RDC-DD for EV, S-type upstream of a 30 mA device). Some EV prompt chips already exist; a short hint next to the RCD type would help on a split-load or TT board.
- [x] (13 Nov, Matthew OK) Name-based load symbols must be forgiving: case-insensitive, ignore extra words (e.g. "En-suite shower 9.5kW"), catch common typos/abbrevs (showr, elec shower, cookr, imm/immersion, EV/car charger). Never override user-set points/items.
- [x] (13 Nov) Spurs on rings AND radials: each spur is its own item where Matthew picks individually what it feeds (e.g. FCU -> boiler / extractor / heater / towel rail; single socket; double socket; cooker hood; light etc.) instead of fixed combos like "spur feeding a single socket". Diagram draws each spur off the ring/radial with the chosen device + its load; schedule point count follows.
- [x] (14 Nov, Matthew OK) FCU / SFCU **in the ring** (or radial), not only spurred off it: done in v0.48.0, live 14 Nov 2026 ~08:15 GMT.
- [x] (14 Nov, Matthew: "Can we do something so we know that where the lines cross that they aren't actually connected") Hop-overs where cables cross without connecting, and junction dots where they really join; both in the key. Done in v0.48.0, live 14 Nov 2026 ~08:15 GMT.


### v0.48.0 how they were done
- No device fitted: presets not highlighted; Type and Rating have an N/A chip (Rating chips still show when Type is N/A); `applyNoDevice` writes N/A on the whole row (device boxes + test results), still editable; leftover B/3/500 on old certs without `noDevAuto` display as N/A until the next edit. Optional field `c.noDevAuto`.
- Identical-looking B50 presets merge (`clean()` strips leftover RCD on MCBs); `distinguishName()` labels real differences (e.g. 300 mA Type A-S).
- Diagram `isRingC` is the same rule as the schedule tick (`isRingCircuit`). Kitchen 32 A 2.5 mm² with the tick off draws as a radial; upstairs 32 A 4 mm² with the tick on draws as a ring.
- Schedule `cableCheck` applies optional Ca/Cg/Ci (`c.ambient`, `c.grouped`, `c.grouping`, `c.ci`); 6 mm² T&E method C at 55 °C, It 47, Ca 0.61, Iz 28.67 A, amber vs 32 A. No-factor path keeps the old It wording. Folded “Correction factors and maker I²t” on the circuit.
- Name-based cooker/shower/EV/immersion/heater symbols: forgiving (`showr`, `elec shower`, `cookr`, `imm`, `EV`/`car charger`, extra words, case-insensitive). User item lists always win; points are never auto-written.
- Circuit Prev/All/Next is a real footer on a scrolling form (`body.circedit` + `.circuitpage`); it stays visible and does not cover rating chips at 390px or 1440px. (`pagein` no longer uses `transform`, which had made `position:fixed` stick to `main` on phones.)
- Shared `dec()` accepts comma decimals in every calculator and in the core sums.
- Check calculator has full Table 52.2 Ci and a “Use on a circuit” button (cable + device only, never test results).
- Table 4B1: 90 °C Ca at 25 °C is 1.04 (same as 20 °C).
- `lengthFromR1R2` is ring-aware (measured R1+R2 is loop/4; length = radial × 4) and comma-safe; the circuit page shows the hint on rings too.
- “Single-phase 230 V” stacks as one chip at ≤420px, no orphan “V”.
- Optional maker I²t (`c.i2t`) on Check, Size, and the circuit fold; otherwise the conservative default.
- Diagram “Share as PNG” next to View PDF.
- Cable labels: `C3 (circuit 5)`.
- Short RCD hints (EV Type B / 6 mA RDC-DD; Type A for sockets, outdoor wording if relevant; S-type if IΔn ≥ 100 or board upstream of 30 mA).
- Spurs on rings and radials: each is its own item (`c.diagram.spurList`); pick the device and what it feeds. Drawn off the ring or radial with that device + load. Points served is left as you set it, with a hint and an optional “Set points to N” — never auto-written.
- DB name, storage keys and backup format unchanged (optional fields only). Old backups still load. 692 tests pass. PDF overlaps: 0 after spur labels were stacked one per row.
- FCU in the ring: a spur item that is an FCU or SFCU can be set to Where: "In the ring" / "In the radial" (optional `place: 'in'`), with Position "At the end" (default), "Before socket 1" or "After socket N" (optional `after`). It is drawn as a faceplate on the ring/radial cable (the cable runs over it and drops into it, like a socket). Its load hangs off the FCU with the label to the right. It counts as one point ("Points served: 8 + 1 spur + 1 FCU in the ring = 10?"), not twice. Old spur items draw exactly as before. 703 tests pass; PDF and screen overlaps 0.
- Crossings: `markCrossings()` post-processes every drawing block's cable lines (rings, radials, lights, rooms, controls, sub-mains, supply/board). Where a horizontal and a vertical cable cross and neither ends there, the vertical gets a small semicircular hop bulging right (two crossings very close share one hop). Where three or more solid cable directions meet (a T, or a join built from segments), a small filled dot in the line colour. No dot at corners, straight joins, short terminal stubs (a socket's drop into its plate), dashed switch/link lines, or lines meeting a symbol's own terminal. Key: "Lines crossing, not connected" and "Connected", only when used. The same `layout()` feeds screen and PDF.

## After v0.48.0 (14 Nov 2026), not built yet
- (14 Nov) Draw sockets IN LINE on the ring/radial cable (cable runs through the faceplate like the DP switch), so spurs drop off a socket without lines crossing. Applies to rings and radials incl. rooms layouts.
- (14 Nov) DP switches like FCUs: in the Spurs list, a DP switch (20 A / 45 A) can sit in the ring/radial or be spurred, and he picks what it feeds individually (washer, dishwasher, boiler etc.); diagram + points follow. Old dpsw/dpsws room counts must still load.
