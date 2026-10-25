// =====================================================================
// gdrive.js — talking to Google: sign-in, Drive files, the file picker.
// =====================================================================
// Only loaded once you turn on "Sync with Google Drive". Nothing here runs
// for phone-only use. There's no server: the phone signs in with Google
// directly ("Google Identity Services" token flow) and calls the Drive
// REST API with fetch().
//
// PERMISSION ("scope"): drive.file. The app can only see files it created
// itself, or files you hand it in Google's own file picker. It can't see
// anything else in your Drive. See HOW-IT-WORKS.md section 9 for why.

import { GOOGLE_CLIENT_ID } from './config.js';

export const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const TOKEN_KEY = 'sparky.gtoken';

export const isConfigured = () => Boolean(GOOGLE_CLIENT_ID) && !/^PASTE/.test(GOOGLE_CLIENT_ID);

// Errors the sync code reacts to differently.
export class AuthError extends Error { constructor(m = 'Please sign in to Google again.') { super(m); this.name = 'AuthError'; } }
export class OfflineError extends Error { constructor(m = 'No internet connection.') { super(m); this.name = 'OfflineError'; } }
export class NotFoundError extends Error { constructor(m = 'File not found in Drive.') { super(m); this.name = 'NotFoundError'; } }

// ---------- loading Google's scripts (only when needed) ----------
const scripts = {};
function loadScript(src) {
  if (!scripts[src]) {
    scripts[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => { delete scripts[src]; reject(new OfflineError('Could not reach Google. Are you online?')); };
      document.head.append(s);
    });
  }
  return scripts[src];
}

// ---------- sign-in (access tokens) ----------
// Google gives a short-lived (1 hour) access token. We keep it in
// localStorage so a quick re-open of the app can sync straight away.
//
// Keeping it fresh without bothering you: once you've agreed to this app
// once, Google hands out a new token with no questions when we ask with
// prompt '' and your email as the hint (the window it opens closes by
// itself). Browsers only allow that window straight after a tap, so we ask
// (a) when a sync starts from a tap, and (b) on your next tap anywhere in
// the app once the token is about to run out (see sync.js). We never open
// it with no tap: that would trigger a "pop-up blocked" warning.
let tokenClient = null;
let pending = null;
const HINT_KEY = 'sparky.ghint';

function readToken() {
  try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null'); } catch { return null; }
}
function storedToken() {
  const t = readToken();
  return t && t.expiresAt > Date.now() + 60_000 ? t : null;
}
export const hasToken = () => Boolean(storedToken());
// Milliseconds until the current token runs out (0 if none).
export const tokenLeft = () => { const t = readToken(); return t ? Math.max(0, t.expiresAt - Date.now()) : 0; };
// Load Google's sign-in script early, so a quiet refresh after a tap is quick.
export const warmUp = () => getTokenClient().catch(() => {});
export function forgetToken() { try { localStorage.removeItem(TOKEN_KEY); } catch {} }
// The last Google account used on this phone, kept as a sign-in hint
// (survives the token running out; cleared by Disconnect).
export const accountHint = () => { try { return localStorage.getItem(HINT_KEY) || ''; } catch { return ''; } };
export function rememberAccount(email) { try { if (email) localStorage.setItem(HINT_KEY, email); else localStorage.removeItem(HINT_KEY); } catch {} }
// True while the browser treats us as "just tapped" (so a window may open).
export const canOpenWindow = () => !navigator.userActivation || navigator.userActivation.isActive;

async function getTokenClient() {
  await loadScript('https://accounts.google.com/gsi/client');
  if (!tokenClient) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        const p = pending; pending = null;
        if (!p) return;
        clearTimeout(p.timer);
        if (resp.error) return p.reject(resp.error === 'access_denied' ? new AuthError('Google sign-in was cancelled, or access to Drive wasn\u2019t allowed. Tap the button again and tick “See, edit, create… Drive files”.') : new AuthError('Google sign-in failed: ' + (resp.error_description || resp.error)));
        const t = { accessToken: resp.access_token, expiresAt: Date.now() + (Number(resp.expires_in) || 3600) * 1000 };
        try { localStorage.setItem(TOKEN_KEY, JSON.stringify(t)); } catch {}
        p.resolve(t.accessToken);
      },
      error_callback: (err) => {
        const p = pending; pending = null;
        if (!p) return;
        clearTimeout(p.timer);
        p.reject(signInError(err && err.type));
      },
    });
  }
  return tokenClient;
}

// v0.5: clearer messages for each way sign-in can fail (shown on screen).
export class PopupBlockedError extends AuthError { constructor() { super('The Google sign-in window was blocked by the browser. Allow pop-ups for this site (Safari: Settings → Websites → Pop-up Windows; Chrome: the icon at the right of the address bar), then tap the button again.'); this.name = 'PopupBlockedError'; } }
function signInError(type) {
  if (type === 'popup_failed_to_open') return new PopupBlockedError();
  if (type === 'popup_closed') return new AuthError('Sign-in was cancelled (the Google window was closed).');
  return new AuthError('Google sign-in did not finish' + (type ? ` (${type})` : '') + '. Tap the button to try again.');
}
// v0.5: browsers (Safari on the Mac especially) only let the sign-in window
// open if it's asked for straight away inside the tap. So when Google's
// script is already loaded, requestAccessToken is called right now, in the
// same tick as the tap, not after an await. warmUp() loads it early.
function ask(client, opts, timeoutMs, resolve, reject) {
  if (pending) { clearTimeout(pending.timer); pending.reject(new AuthError('Google sign-in did not finish.')); }
  pending = { resolve, reject, timer: timeoutMs ? setTimeout(() => { if (pending && pending.reject === reject) { pending = null; reject(new AuthError('Google sign-in didn\u2019t come back. If no Google window appeared, pop-ups may be blocked for this site: allow them and try again.')); } }, timeoutMs) : 0 };
  try { client.requestAccessToken(opts); } catch (e) { clearTimeout(pending.timer); pending = null; reject(new AuthError('Google sign-in could not start: ' + (e.message || e))); }
}
function request(opts, timeoutMs = 0) {
  if (tokenClient) return new Promise((resolve, reject) => ask(tokenClient, opts, timeoutMs, resolve, reject));
  return getTokenClient().then((client) => new Promise((resolve, reject) => ask(client, opts, timeoutMs, resolve, reject)));
}
export const isReady = () => Boolean(tokenClient);

// A quiet refresh: no account chooser, no consent screen (Google only shows
// something if it really has to). Only call it straight after a tap.
let refreshing = null;
export function refreshSilently(email = accountHint()) {
  if (!refreshing) {
    refreshing = request({ prompt: '', login_hint: email || undefined, hint: email || undefined }, 20_000)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

// interactive=true only from a tap (browsers block pop-ups otherwise).
// Not interactive: use the saved token, or refresh quietly if we're inside
// a tap anyway; otherwise say "sign in" (the app shows a gentle prompt).
export async function getToken({ interactive = false, email = '', choose = false } = {}) {
  const t = choose ? null : storedToken();
  if (t) return t.accessToken;
  const hint = choose ? '' : email || accountHint();
  if (!interactive) {
    if (hint && canOpenWindow() && navigator.userActivation) return refreshSilently(hint);
    throw new AuthError();
  }
  // From a tap: a long time limit (you may need to pick an account or agree),
  // so a window that never comes back can't leave the button doing nothing.
  return request(hint ? { prompt: '', login_hint: hint, hint } : { prompt: 'select_account' }, 180_000);
}

export async function revoke() {
  const t = storedToken();
  forgetToken();
  rememberAccount('');
  try {
    if (t && window.google && window.google.accounts) window.google.accounts.oauth2.revoke(t.accessToken, () => {});
  } catch {}
}

// ---------- Drive REST ----------
// Some shared files need a "resource key" sent with every request (Google
// added these for link-shared files). The picker tells us the key; we
// remember it here and send it for that file.
const resourceKeys = {};
export function setResourceKeys(map) { Object.assign(resourceKeys, map || {}); }
function rkHeader() {
  const pairs = Object.entries(resourceKeys).filter(([, k]) => k).map(([id, k]) => `${id}/${k}`);
  return pairs.length ? { 'X-Goog-Drive-Resource-Keys': pairs.join(',') } : {};
}

async function call(url, { method = 'GET', body, headers = {}, raw = false, timeoutMs = 0 } = {}) {
  const token = await getToken();
  let res;
  // v13.8: photo uploads pass a time limit, so a stalled request fails (and
  // is retried for that one photo) instead of hanging for minutes.
  const ctl = timeoutMs && typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : 0;
  try {
    res = await fetch(url, { method, body, headers: { Authorization: `Bearer ${token}`, ...rkHeader(), ...headers }, ...(ctl ? { signal: ctl.signal } : {}) });
  } catch {
    throw new OfflineError(ctl && ctl.signal.aborted ? 'Google Drive took too long to answer.' : undefined);
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401) { forgetToken(); throw new AuthError(); }
  if (res.status === 404) throw new NotFoundError();
  if (!res.ok) {
    let msg = `Google Drive said ${res.status}`;
    try { const j = await res.json(); if (j.error && j.error.message) msg += `: ${j.error.message}`; } catch {}
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  if (raw) return res;
  return res.status === 204 ? null : res.json();
}

const q = (s) => encodeURIComponent(s);
const FIELDS = 'id,name,version,modifiedTime,createdTime,trashed,parents,mimeType,size,resourceKey,ownedByMe,capabilities(canEdit,canShare)';

export function whoAmI() {
  return call(`${API}/about?fields=${q('user(displayName,emailAddress)')}`).then((r) => r.user);
}
// v13.8: small metadata requests give up after 30 s (a stalled request
// used to hold the whole sync up for minutes); the sync tries again later.
const META_TIMEOUT = 30_000;
export function getMeta(id) {
  return call(`${API}/files/${id}?fields=${q(FIELDS)}&supportsAllDrives=true`, { timeoutMs: META_TIMEOUT });
}
// v13.8: follows nextPageToken, so folders with more than 100 files
// (e.g. many photos) are listed in full.
export async function list(query) {
  const out = [];
  let page = '';
  for (let i = 0; i < 50; i++) {
    const r = await call(`${API}/files?q=${q(query)}&fields=${q(`nextPageToken,files(${FIELDS})`)}&pageSize=100&spaces=drive&includeItemsFromAllDrives=true&supportsAllDrives=true${page ? `&pageToken=${q(page)}` : ''}`, { timeoutMs: META_TIMEOUT });
    out.push(...(r.files || []));
    if (!r.nextPageToken) break;
    page = r.nextPageToken;
  }
  return out;
}
export async function readJSON(id) {
  const res = await call(`${API}/files/${id}?alt=media&supportsAllDrives=true`, { raw: true });
  const text = await res.text();
  try { return JSON.parse(text || 'null'); } catch (e) { throw new Error('A backup file in Drive is damaged and couldn\u2019t be read (' + (e.message || 'bad JSON') + ').'); }
}
// Writing the shared file. v13: a "resumable" upload, which Google
// recommends for anything over 5 MB and for phones: step 1 asks Drive for
// an upload address, step 2 sends the file there. If the connection drops
// half way, we ask Drive how much arrived and send only the rest (a few
// tries). If the resumable start itself fails (an old proxy, an odd
// network), it falls back to the simple one-shot upload used before.
// The file's content is exactly the same either way.
export async function writeJSON(id, data) {
  const body = new Blob([JSON.stringify(data)], { type: 'application/json' });
  let session = null;
  try {
    const res = await call(`${UPLOAD}/files/${id}?uploadType=resumable&fields=${q(FIELDS)}&supportsAllDrives=true`, {
      method: 'PATCH', raw: true,
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/json', 'X-Upload-Content-Length': String(body.size) },
      body: '{}',
    });
    session = res.headers.get('Location');
  } catch (err) {
    if (err instanceof AuthError || err instanceof NotFoundError) throw err;
    session = null;
  }
  if (!session) return writeSimple(id, body);
  return sendResumable(session, body);
}
function writeSimple(id, body) {
  return call(`${UPLOAD}/files/${id}?uploadType=media&fields=${q(FIELDS)}&supportsAllDrives=true`, {
    method: 'PATCH', body, headers: { 'Content-Type': 'application/json' },
  });
}
async function sendResumable(session, body, { tries = 4, timeoutMs = 0 } = {}) {
  const total = body.size;
  let from = 0;
  for (let attempt = 0; attempt < tries; attempt++) {
    const token = await getToken();
    const headers = { Authorization: `Bearer ${token}` };
    if (from > 0) headers['Content-Range'] = `bytes ${from}-${total - 1}/${total}`;
    let res;
    const ctl = timeoutMs && typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : 0;
    try {
      res = await fetch(session, { method: 'PUT', headers, body: from > 0 ? body.slice(from) : body, ...(ctl ? { signal: ctl.signal } : {}) });
    } catch {
      // Dropped connection (or too slow): ask how much Drive has, then send the rest.
      clearTimeout(timer);
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      const got = await uploadedSoFar(session, total, token);
      if (got && typeof got === 'object') return got.meta; // all there (meta may be null: caller checks)
      from = got;
      continue;
    } finally {
      clearTimeout(timer);
    }
    if (res.ok) return res.status === 204 ? null : res.json();
    if (res.status === 401) { forgetToken(); throw new AuthError(); }
    if (res.status === 404 || res.status === 410) throw new Error('Google Drive upload expired. It will try again shortly.');
    if (res.status === 308) { from = rangeEnd(res.headers.get('Range')); continue; }
    let msg = `Google Drive said ${res.status}`;
    try { const j = await res.json(); if (j.error && j.error.message) msg += `: ${j.error.message}`; } catch {}
    const err = new Error(msg); err.status = res.status; throw err;
  }
  throw new OfflineError('The upload to Google Drive kept being interrupted. It will try again shortly.');
}
const rangeEnd = (range) => { const m = /bytes=0-(\d+)/.exec(range || ''); return m ? Number(m[1]) + 1 : 0; };
// How much of an interrupted upload Drive has. A finished upload answers
// with the file itself: then { meta } is returned instead of a byte count.
async function uploadedSoFar(session, total, token) {
  try {
    const res = await fetch(session, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Range': `bytes */${total}` } });
    if (res.ok) { let meta = null; try { meta = await res.json(); } catch {} return { meta }; }
    if (res.status === 308) return rangeEnd(res.headers.get('Range'));
  } catch {}
  return 0;
}
export function createFolder(name, parentId) {
  const meta = { name, mimeType: 'application/vnd.google-apps.folder', appProperties: { sparky: 'folder' } };
  if (parentId) meta.parents = [parentId];
  return call(`${API}/files?fields=${q(FIELDS)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  });
}
export async function createJSON(name, parentId, data) {
  const meta = await call(`${API}/files?fields=${q(FIELDS)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parents: [parentId], mimeType: 'application/json', appProperties: { sparky: 'data' } }),
  });
  await writeJSON(meta.id, data);
  return meta;
}
// Binary files (photos). Same drive.file rules as JSON: the phone that
// created the file can open it; the other phone gets the bytes via the
// shared sync file the first time, then keeps them in its local cache.
//
// v13.8: uploadNewBlob creates the file and sends its bytes in ONE
// resumable upload (name + folder go with the first request). Drive only
// makes the file once every byte has arrived, so an interrupted upload no
// longer leaves an empty 0-byte file behind. It answers with the file's
// details, including the size Drive stored, so the caller can check it.
export async function uploadNewBlob(name, parentId, blob, mimeType = 'image/jpeg', appProperties = { sparky: 'file' }, { timeoutMs = 60_000, tries = 2 } = {}) {
  const metaBody = { name, mimeType, appProperties };
  if (parentId) metaBody.parents = [parentId];
  let session = null;
  try {
    const res = await call(`${UPLOAD}/files?uploadType=resumable&fields=${q(FIELDS)}&supportsAllDrives=true`, {
      method: 'POST', raw: true, timeoutMs,
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mimeType, 'X-Upload-Content-Length': String(blob.size) },
      body: JSON.stringify(metaBody),
    });
    session = res.headers.get('Location');
  } catch (err) {
    if (err instanceof AuthError || err instanceof NotFoundError || err instanceof OfflineError) throw err;
    session = null;
  }
  if (!session) return createBlob(name, parentId, blob, mimeType, appProperties, { timeoutMs }); // old two-step way
  return sendResumable(session, blob, { tries, timeoutMs });
}
// The older two-step way (create an empty file, then send the bytes). Kept
// as a fallback; returns the file's details after the bytes went up (or
// null if Drive didn't say: the caller then reads them).
export async function createBlob(name, parentId, blob, mimeType = 'image/jpeg', appProperties = { sparky: 'file' }, { timeoutMs = 0 } = {}) {
  const metaBody = { name, mimeType, appProperties };
  if (parentId) metaBody.parents = [parentId];
  const meta = await call(`${API}/files?fields=${q(FIELDS)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metaBody), timeoutMs,
  });
  let after = null;
  try {
    after = await writeBlob(meta.id, blob, mimeType, { timeoutMs });
  } catch (err) {
    err.createdId = meta.id; // so the caller can bin the empty file
    throw err;
  }
  return after && after.id ? after : { ...meta, size: after && after.size != null ? after.size : undefined, unchecked: !after };
}
export async function writeBlob(id, blob, mimeType = 'image/jpeg', { timeoutMs = 0 } = {}) {
  let session = null;
  try {
    const res = await call(`${UPLOAD}/files/${id}?uploadType=resumable&fields=${q(FIELDS)}&supportsAllDrives=true`, {
      method: 'PATCH', raw: true, timeoutMs,
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mimeType, 'X-Upload-Content-Length': String(blob.size) },
      body: '{}',
    });
    session = res.headers.get('Location');
  } catch (err) {
    if (err instanceof AuthError || err instanceof NotFoundError) throw err;
    session = null;
  }
  if (!session) {
    return call(`${UPLOAD}/files/${id}?uploadType=media&fields=${q(FIELDS)}&supportsAllDrives=true`, {
      method: 'PATCH', body: blob, headers: { 'Content-Type': mimeType }, timeoutMs,
    });
  }
  return sendResumable(session, blob, { timeoutMs, tries: timeoutMs ? 2 : 4 });
}
// v0.31.1: rename a file/folder this app made (drive.file allows it).
export function rename(id, name) {
  return call(`${API}/files/${id}?fields=${q(FIELDS)}&supportsAllDrives=true`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, timeoutMs: META_TIMEOUT,
    body: JSON.stringify({ name }),
  });
}
// v0.31.1: move a file into another folder (same id, nothing re-uploaded).
export function move(id, toParent, fromParent) {
  return call(`${API}/files/${id}?addParents=${q(toParent)}&removeParents=${q(fromParent)}&fields=${q('id,parents')}&supportsAllDrives=true`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, timeoutMs: META_TIMEOUT,
    body: '{}',
  });
}
// v13.8: move a file this app made to Drive's bin (never a permanent
// delete; it can be restored from the bin for 30 days).
export function trash(id) {
  return call(`${API}/files/${id}?fields=${q('id,trashed')}&supportsAllDrives=true`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, timeoutMs: META_TIMEOUT,
    body: JSON.stringify({ trashed: true }),
  });
}
export async function readBlob(id) {
  const res = await call(`${API}/files/${id}?alt=media&supportsAllDrives=true`, { raw: true });
  return res.blob();
}
