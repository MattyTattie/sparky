
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
