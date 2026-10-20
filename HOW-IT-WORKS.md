# How it works (plain English)

**Where the data lives.** Everything is saved in the phone's own database
(IndexedDB, name `sparky-certs`) as you type: every field is saved within a third of a
second. If the app is closed in that gap, a copy goes into the browser's local storage
straight away and is put back next time. Nothing waits for a Save button.

**Sync and files.** Settings has two cards:
1. *Sync:* each job gets its own folder in "Sparky jobs" in your Drive, holding
   the job's data (`job.json`), its photos and its PDFs, and every change goes up by
   itself and comes down on your other devices. The app uses the `drive.file`
   permission, so it can only see files it made itself. Under "More": back up all jobs
   now, and "Restore from Drive" to bring jobs back onto a new device.
2. *Files:* one JSON backup file with everything (restoring adds to what's there and
   never deletes), plus Import extra details and Import results file (you pick the
   certificate). Imports show every change first and never overwrite.

**Limits.** All of them are in `js/limits.js` (max Zs tables, Table 41.5, Table 64, RCD
times, ring checks, volt drop limits), each with its source. `js/checks.js` uses them to
colour the readings. Your own max Zs figure (e.g. from the maker's data) always wins
over the table.

**PDFs.** `js/pdf.js` draws each form with jsPDF in the IET A4 layout: section letters,
wording, the 31-column schedules on landscape pages, and the guidance for recipients.
There is no IET logo (their terms don't allow it). Arimo, a font metric-compatible
with Arial, is embedded.

**Sharing.** "Make PDF and share" opens Android's share sheet: you pick Gmail, WhatsApp
or Drive, and who it goes to. Nothing is ever sent automatically.

**Same website as Hearth.** If it's published to mattytattie.github.io/<name>/, it shares
the origin with Hearth. To keep the two apart, its storage keys start `sparky.` and its
offline cache only ever deletes caches named `sparky-*`.
