# Sparky — niggles and update lists

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
