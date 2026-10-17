// filerules.js — small rules about saved files, kept separate so they can be tested.

// Run fn(key, ...) at most once at a time per key. A call made while one is
// running waits for it and then runs once more; extra calls in the meantime
// share that one follow-up run. (Stops two quick backups both uploading the
// same new file to Drive.)
export function serialPerKey(fn) {
  const running = new Map();
  const run = (key, ...args) => {
    const cur = running.get(key);
    if (cur) { if (!cur.again) cur.again = cur.p.catch(() => {}).then(() => { running.delete(key); return run(key, ...args); }); return cur.again; }
    const entry = { p: null, again: null };
    entry.p = Promise.resolve().then(() => fn(key, ...args)).finally(() => { if (running.get(key) === entry && !entry.again) running.delete(key); });
    running.set(key, entry);
    return entry.p;
  };
  run.isRunning = (key) => running.has(key);
  return run;
}

// The saved PDF this new one replaces, if any. Same certificate; charts also
// need the same name (one per board). Older versions stored charts as 'pdf'.
export function findOldPdf(files, certId, name, kind = 'pdf') {
  return files.find((f) => f.certId === certId && (f.kind === kind || (kind === 'chart' && f.kind === 'pdf')) && (kind !== 'chart' || f.name === name) && (kind !== 'pdf' || !/-chart-/.test(f.name || '')));
}
