# Renaming the app
The name appears in only these places:
1. `js/config.js` — `APP_NAME` (shown in the app) and `DRIVE_ROOT` (the Drive folder name;
   changing it starts a new folder, so old backups stay in the old one).
2. `manifest.json` — `name` and `short_name` (the name under the home-screen icon).
3. `index.html` — `<title>`.
Keep `APP_SLUG`, the database name in `js/db.js`, the `sparky.` storage keys and the
`sparky-` cache prefix as they are, or saved data won't be found. After a rename, bump
`CACHE` in sw.js so phones pick up the change.
