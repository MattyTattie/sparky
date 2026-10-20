// node tests/pdf_spare_v10.mjs <outdir> — sample EIC with radial circuits with blank ring boxes, for the v0.18.4 ring N/A shots. FAKE data.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
globalThis.jspdf = require('/workspace/sparky-work/npm/package/dist/jspdf.node.min.js');
const { certificatePdf } = await import('../js/pdf.js');
const S = await import('./sample-data.mjs');
const T = await import('../js/templates.js');
const out = process.argv[2] || '/tmp';
const c = S.sampleEIC(); const b = c.boards[0]; let n = b.circuits.length;
for (const x of b.circuits) if (!T.isRingCircuit(x)) for (const k of ['r1', 'rn', 'r2']) x[k] = '';
console.log(b.circuits.map((x) => x.num + ':' + x.desc + ':' + (T.isRingCircuit(x) ? 'ring' : 'radial')).join(' | '));
const blob = await certificatePdf(c, { profile: S.PROFILE });
fs.writeFileSync(`${out}/v184-ring-na-EIC.pdf`, Buffer.from(await blob.arrayBuffer()));
