// config.js — the app's name and Google settings, in ONE place.
// Name: Zs Pro (v0.25; was Sparky). Change APP_NAME here and in
// manifest.json / index.html <title>.
export const APP_NAME = 'Zs Pro';
export const APP_VERSION = '0.43.8 beta';
export const APP_SLUG = 'sparky';
// Same Google Cloud project as Hearth (not secret: only works from
// https://mattytattie.github.io and for its test users). drive.file scope:
// the app only sees files it created itself.
export const GOOGLE_CLIENT_ID = '425528310525-goun70d3ns6egm13692nn6hr1acgqfea.apps.googleusercontent.com';
// Top folder in Drive; each job gets its own folder inside it.
export const DRIVE_ROOT = 'Zs Pro';
// v0.31.1: the folder's old name; found and renamed to DRIVE_ROOT on first sync.
export const DRIVE_ROOT_OLD = 'Sparky jobs';
