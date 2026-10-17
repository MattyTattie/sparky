// node tests/make_sample_pdfs.mjs <outdir> — renders the sample PDFs with the real pdf.js (Node build of jsPDF).
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
globalThis.jspdf = require('/workspace/sparky-work/npm/package/dist/jspdf.node.min.js');
const { certificatePdf, boardChartPdf } = await import('../js/pdf.js');
const S = await import('./sample-data.mjs');
const out = process.argv[2] || '/tmp';
for (const [n, c] of [['EIC', S.sampleEIC()], ['EICR', S.sampleEICR()], ['MinorWorks', S.sampleMW()]]) {
  const b = await certificatePdf(c, { profile: S.PROFILE });
  fs.writeFileSync(`${out}/sample-${n}.pdf`, Buffer.from(await b.arrayBuffer()));
}
const e = S.sampleEIC();
fs.writeFileSync(`${out}/sample-circuit-chart.pdf`, Buffer.from(await (await boardChartPdf(e, e.boards[0], S.PROFILE)).arrayBuffer()));
console.log('done');
