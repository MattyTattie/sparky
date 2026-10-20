# Sparky — niggles and update lists

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
