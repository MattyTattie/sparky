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
- OCR is tuned on clean test images; real consumer units need trying.
- Voice entry needs Chrome's online speech service on most Android phones.
- Not built yet: a separate bonding schedule, the electrical installation
  "continuation sheet", multi-phase (3-phase) columns beyond the single Zs/IR values,
  emailing straight from the app (deliberately left out: you share the PDF yourself).
