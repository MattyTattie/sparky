// node tests/pdf_spare_v10.mjs <outdir> — sample EIC with three spare ways (plain, RCBO typed, no device), for the v0.10 PDF shots. FAKE data.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
globalThis.jspdf = require('/workspace/sparky-work/npm/package/dist/jspdf.node.min.js');
const { certificatePdf } = await import('../js/pdf.js');
const S = await import('./sample-data.mjs');
const T = await import('../js/templates.js');
const out = process.argv[2] || '/tmp';
const c = S.sampleEIC(); const b = c.boards[0]; let n = b.circuits.length;
const sp = (o) => { const x = T.blankCircuit(++n); x.desc = 'Spare'; T.descChanged(x, false); return Object.assign(x, o); };
b.circuits.push(sp({}), sp({ desc: 'SPARE', device: 'rcbo', bs: '61009', type: 'B', rating: '32', bka: '6', rcdBs: '61009', rcdType: 'A', rcdIdn: '30', rcdRating: '32', remarks: 'RCBO fitted, not connected' }), sp({ desc: 'spare', noDevice: true }));
const blob = await certificatePdf(c, { profile: S.PROFILE });
fs.writeFileSync(`${out}/v10-spare-EIC.pdf`, Buffer.from(await blob.arrayBuffer()));
console.log(JSON.stringify(b.circuits.slice(-3).map((x) => x.num)));
