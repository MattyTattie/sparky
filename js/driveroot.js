// =====================================================================
// driveroot.js (v0.31.1) — find the app's Drive folder, now called "Zs Pro".
// Older versions called it "Sparky jobs". G is gdrive.js (or a test mock).
//
// Rules (never deletes a job; folders are only binned when empty):
//  1. Look for "Zs Pro" and "Sparky jobs" folders.
//  2. Pick one "main" folder: a "Zs Pro" one if any, else a "Sparky jobs"
//     one. Among several, the one holding the most items wins, then the
//     oldest. If it's called "Sparky jobs" it is renamed (same id).
//  3. Every other matching folder has its contents MOVED into the main one
//     (ids kept, so jobs still point at their folders), then is binned
//     if empty. This tidies up a "Sparky jobs" folder that an old version
//     on another phone/Mac may make again after the rename.
//  4. Only if nothing is found is a new "Zs Pro" folder created.
// =====================================================================
const FOLDER = 'application/vnd.google-apps.folder';
const byName = (n) => `name = '${n.replace(/'/g, "\\'")}' and mimeType = '${FOLDER}' and trashed = false`;
const children = (G, id) => G.list(`'${id}' in parents and trashed = false`);

async function candidates(G, name, legacy) {
  const a = (await G.list(byName(name))).map((f) => ({ ...f, legacy: false }));
  const b = (await G.list(byName(legacy))).map((f) => ({ ...f, legacy: true }));
  const all = [...a, ...b].filter((f, i, arr) => arr.findIndex((x) => x.id === f.id) === i);
  for (const f of all) f.kids = await children(G, f.id);
  return all;
}
export function pickMain(all) {
  return [...all].sort((x, y) => (x.legacy - y.legacy) || (y.kids.length - x.kids.length) || String(x.createdTime || '').localeCompare(String(y.createdTime || '')))[0];
}
async function mergeInto(G, main, others) {
  let moved = 0;
  for (const o of others) {
    for (const k of o.kids) { await G.move(k.id, main.id, o.id); moved++; }
    const left = await children(G, o.id);
    if (!left.length) await G.trash(o.id);
  }
  return moved;
}
export async function findRoot(G, { name, legacy }) {
  const all = await candidates(G, name, legacy);
  if (!all.length) return (await G.createFolder(name)).id;
  const main = pickMain(all);
  if (main.name !== name) await G.rename(main.id, name);
  await mergeInto(G, main, all.filter((f) => f.id !== main.id));
  return main.id;
}
// Cached-id path: tidy strays into the known folder. Returns items moved.
export async function sweepStrays(G, mainId, { name, legacy }) {
  const others = (await candidates(G, name, legacy)).filter((f) => f.id !== mainId);
  if (!others.length) return 0;
  return mergeInto(G, { id: mainId }, others);
}
