// sw.js — keeps the app working with no signal (garages, lofts, cellars).
// Your jobs and certificates are NOT in here: they're in IndexedDB.
// When any app file changes, bump CACHE (sparky-v0.1 -> sparky-v0.2).
// v0.50.0: the big libraries (board scan, PDF viewer, PDF maker, fonts) live in their own cache, VENDOR_CACHE,
// which is only bumped when one of THEM changes. An app update then downloads about 0.6 MB instead of 6 MB.
// Shares the mattytattie.github.io origin with Hearth, so it only ever
// deletes caches whose names start with "sparky-".
const CACHE = 'sparky-v0.50.0';
const VENDOR_CACHE = 'sparky-vendor-1';
const FILES = [
  "./",
  "./dark.css",
  "./desktop.css",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/icon.svg",
  "./index.html",
  "./js/a11y.js",
  "./js/app.js",
  "./js/backnav.js",
  "./js/backup.js",
  "./js/boardmain.js",
  "./js/boardrcd.js",
  "./js/cables.js",
  "./js/calc.js",
  "./js/calcdc.js",
  "./js/calcdcplan.js",
  "./js/calcextra.js",
  "./js/calckit.js",
  "./js/calcmd.js",
  "./js/calcmore.js",
  "./js/calcsize.js",
  "./js/calcui.js",
  "./js/certcheck.js",
  "./js/certdelete.js",
  "./js/certmodel.js",
  "./js/certui.js",
  "./js/checks.js",
  "./js/config.js",
  "./js/cuscan.js",
  "./js/dangermodel.js",
  "./js/dangerpdf.js",
  "./js/dangerui.js",
  "./js/db.js",
  "./js/dc.js",
  "./js/dcplan.js",
  "./js/dcplanpdf.js",
  "./js/dcwire.js",
  "./js/design.js",
  "./js/diagrampro.js",
  "./js/driveroot.js",
  "./js/email.js",
  "./js/feed.js",
  "./js/filerules.js",
  "./js/fitbox.js",
  "./js/gdrive.js",
  "./js/guidance.js",
  "./js/icons.js",
  "./js/importextra.js",
  "./js/importjob.js",
  "./js/importres.js",
  "./js/importui.js",
  "./js/inspections.js",
  "./js/instruments.js",
  "./js/jobdelete.js",
  "./js/jobnext.js",
  "./js/jobtable.js",
  "./js/limitbar.js",
  "./js/limits.js",
  "./js/main.js",
  "./js/maxdemand.js",
  "./js/obsfrom.js",
  "./js/ocpdfill.js",
  "./js/ocr.js",
  "./js/parts.js",
  "./js/partspdf.js",
  "./js/pdf.js",
  "./js/pdffonts.js",
  "./js/pdfkit.js",
  "./js/pdflist.js",
  "./js/pdfview.js",
  "./js/presets.js",
  "./js/quickfill.js",
  "./js/rcdreuse.js",
  "./js/rcdtype.js",
  "./js/rcdways.js",
  "./js/refdata.js",
  "./js/refui.js",
  "./js/reminders.js",
  "./js/schedule.js",
  "./js/settingsync.js",
  "./js/state.js",
  "./js/symbols.js",
  "./js/symdata.js",
  "./js/sync.js",
  "./js/syncmerge.js",
  "./js/templates.js",
  "./js/testacross.js",
  "./js/testlist.js",
  "./js/theme.js",
  "./js/ui.js",
  "./js/usecircuit.js",
  "./js/usecore.js",
  "./js/voice.js",
  "./js/wiring.js",
  "./manifest.json",
  "./styles.css",
];
const VENDOR = [
  "./fonts/inter-latin.woff2",
  "./vendor/jspdf/jspdf.umd.min.js",
  "./vendor/pdfjs/pdf.min.js",
  "./vendor/pdfjs/pdf.worker.min.js",
  "./vendor/tesseract/eng.traineddata.gz",
  "./vendor/tesseract/tesseract-core-lstm.js",
  "./vendor/tesseract/tesseract-core-lstm.wasm",
  "./vendor/tesseract/tesseract-core-simd-lstm.js",
  "./vendor/tesseract/tesseract-core-simd-lstm.wasm",
  "./vendor/tesseract/tesseract.min.js",
  "./vendor/tesseract/worker.min.js",
];
// Needed to make a PDF and draw the screen: in place before the new version takes over.
const VENDOR_NOW = VENDOR.filter((f) => /\/(fonts|vendor\/jspdf)\//.test(f));
// Board scan (OCR) and View PDF: fetched in the background straight after install (and resumed on each launch
// until they're all in), so they work with no signal without making the install wait for 4 MB.
// Only the Tesseract build this device can run (SIMD or not) is kept.
const simd = (() => { try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch { return false; } })();
const wanted = (f) => !/tesseract-core-(simd-)?lstm\./.test(f) || /simd/.test(f) === simd;
const VENDOR_LATER = VENDOR.filter((f) => !VENDOR_NOW.includes(f) && wanted(f));
const isVendor = (path) => /\/(vendor|fonts)\//.test(path);
// A vendor file already kept by an older version (any sparky-* cache) is copied, not downloaded again.
async function fillVendor(list) {
  const vc = await caches.open(VENDOR_CACHE); let got = 0;
  for (const f of list) {
    const req = new Request(f);
    if (await vc.match(req, { ignoreSearch: true })) continue;
    let r = await caches.match(req, { ignoreSearch: true });
    if (!r) { try { r = await fetch(new Request(f, { cache: 'reload' })); } catch { r = null; } }
    if (r && r.ok) { await vc.put(req, r.clone ? r.clone() : r); got++; }
  }
  return got;
}
let filling = null;
const fillLater = () => (filling = filling || fillVendor(VENDOR_LATER).finally(() => { filling = null; }));
const installAll = () => Promise.all([
  caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))),
  fillVendor(VENDOR_NOW),
]).then(() => caches.keys()).then(async (ks) => {
  // copy any vendor files an older version kept (a quick local copy, no download), before activate tidies up
  if (ks.some((k) => k.startsWith('sparky-') && k !== CACHE && k !== VENDOR_CACHE)) { const vc = await caches.open(VENDOR_CACHE);
    for (const f of VENDOR_LATER) { const req = new Request(f); if (await vc.match(req, { ignoreSearch: true })) continue; const r = await caches.match(req, { ignoreSearch: true }); if (r && r.ok) await vc.put(req, r); } }
});
self.addEventListener('install', (e) => { e.waitUntil(installAll().then(() => self.skipWaiting())); }); // v0.36.1: take over straight away (a waiting worker could sit for ever on TWA/Mac)
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
  // v0.50.0: the page asks for the background download once it has loaded (and on each launch until it's done)
  if (e.data === 'fillVendor') e.waitUntil(fillLater().then((n) => { if (e.source) e.source.postMessage({ vendor: 'filled', got: n, of: VENDOR_LATER.length }); }).catch(() => {}));
  if (e.data === 'vendorStatus') e.waitUntil(caches.open(VENDOR_CACHE).then(async (vc) => { let have = 0; for (const f of VENDOR_LATER) if (await vc.match(new Request(f), { ignoreSearch: true })) have++; if (e.source) e.source.postMessage({ vendor: 'status', have, of: VENDOR_LATER.length }); }));
});
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(async (ks) => {
  const stuck = ks.some((k) => /^sparky-v0\.(\d|[12]\d|3[0-5])\./.test(k)); // pages still running 0.35.x or older have no update banner
  await Promise.all(ks.filter((k) => k.startsWith('sparky-') && k !== CACHE && k !== VENDOR_CACHE).map((k) => caches.delete(k)));
  await self.clients.claim();
  if (stuck) for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url).catch(() => {}); // one-off self-heal reload
})); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith(new URL('./', self.registration.scope).pathname)) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(isVendor(u.pathname) ? VENDOR_CACHE : CACHE).then((c) => c.put(e.request, cp)); } return r; }).catch(() => caches.match('./index.html'))));
});
