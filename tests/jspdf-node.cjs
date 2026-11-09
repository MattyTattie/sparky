// v0.45: one place that finds jsPDF's Node build for the PDF tests (the app itself uses vendor/jspdf).
// Looks in: $JSPDF_NODE, tests/.jspdf (made by tests/setup-jspdf.sh), then the old box copy.
// If none is there it runs the setup script once (needs npm and the internet), then tries again.
const fs = require('node:fs'); const path = require('node:path'); const { spawnSync } = require('node:child_process');
const VERSION = '4.2.1'; // same as vendor/jspdf/jspdf.umd.min.js
const spots = () => [process.env.JSPDF_NODE, path.join(__dirname, '.jspdf/node_modules/jspdf/dist/jspdf.node.min.js'), '/workspace/sparky-work/npm/package/dist/jspdf.node.min.js'].filter(Boolean);
const usable = (f) => { try { require(f); return true; } catch { return false; } };
let found = spots().find((f) => fs.existsSync(f) && usable(f));
if (!found) {
  const r = spawnSync('bash', [path.join(__dirname, 'setup-jspdf.sh')], { stdio: ['ignore', 'pipe', 'pipe'] });
  found = spots().find((f) => fs.existsSync(f) && usable(f));
  if (!found) throw new Error(`jsPDF ${VERSION} Node build not found. Run: bash tests/setup-jspdf.sh\n` + String(r.stderr || '').slice(-800));
}
module.exports = require(found);
module.exports.__path = found;
