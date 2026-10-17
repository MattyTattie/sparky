# How it works (plain English)

**Where the data lives.** Everything is saved in the phone's own database
(IndexedDB, name `sparky-certs`) as you type: every field is saved within a third of a
second. If the app is closed in that gap, a copy goes into the browser's local storage
straight away and is put back next time. Nothing waits for a Save button.

**Backups.** Settings has two kinds:
1. *Google Drive:* each job gets its own folder in "Sparky jobs" in your Drive, holding
   the job's data (`job.json`), its photos and its PDFs. The app uses the `drive.file`
   permission, so it can only see files it made itself. You can back up one job, all
   jobs, or automatically when you leave a job. "Restore from Drive" brings jobs back
   onto a new phone.
2. *Backup file:* one JSON file with everything. Restoring adds to what's on the phone
   and never deletes.

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
