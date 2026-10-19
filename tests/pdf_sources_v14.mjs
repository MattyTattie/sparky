// node tests/pdf_sources_v14.mjs <outdir> — sample EIC with two other sources of supply, for the v0.14 PDF shot. FAKE data.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
globalThis.jspdf = require('/workspace/sparky-work/npm/package/dist/jspdf.node.min.js');
const { certificatePdf } = await import('../js/pdf.js');
const S = await import('./sample-data.mjs');
const M = await import('../js/certmodel.js');
const out = process.argv[2] || '/tmp';
const c = S.sampleEIC(); c.supply.otherSources = true;
c.otherSources = [
  { ...M.blankSource('s1'), type: 'PV inverter', make: 'Example Solar 3.6 kW single-phase inverter', kw: '3.6', isolation: 'AC isolator beside the consumer unit; DC isolator on the inverter in the loft', ref: 'G98-SAMPLE-0001', notes: 'Dual-supply labels fitted at the CU, meter and isolator' },
  { ...M.blankSource('s2'), type: 'Battery storage', make: 'Example 5.2 kWh AC-coupled battery', kw: '3', isolation: 'Isolator on the battery unit, garage', ref: '' },
];
const blob = await certificatePdf(c, { profile: S.PROFILE });
fs.writeFileSync(`${out}/v14-sources-EIC.pdf`, Buffer.from(await blob.arrayBuffer()));
