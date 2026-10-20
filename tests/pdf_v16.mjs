// node tests/pdf_v16.mjs <outdir> — FAKE certificates with multi-line addresses everywhere
// (signatories, client, installation) and two boards, for the v0.16 PDF checks and shots.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
globalThis.jspdf ||= require('/workspace/sparky-work/npm/package/dist/jspdf.node.min.js');
const { certificatePdf } = await import('../js/pdf.js');
const S = await import('./sample-data.mjs');
export const ADDR = 'Unit 4, Example Trade Park\nSample Industrial Estate\nLong Lane Road\nFaketown, Testshire';
export function multiAddr(c) {
  for (const p of Object.values(c.people || {})) if (p) { if (!p.name) p.name = 'Sam Sparks'; p.address = ADDR; p.postcode = 'ZZ1 1ZZ'; p.tel = '01234 000000'; }
  c.client.address = '12 Imaginary Road\nFaketown\nTestshire'; c.install.address = 'Flat 3, The Old Mill\n12 Imaginary Road\nFaketown'; c.install.postcode = 'ZZ9 9ZZ';
  return c;
}
export function twoBoards(c) {
  const b2 = S.board(); b2.id = 'db2'; b2.ref = 'DB2'; b2.location = 'Garage (generation CU)';
  const base = b2.circuits[0];
  b2.circuits = Array.from({ length: 20 }, (_, i) => ({ ...base, id: 'g' + i, num: String(i + 1), desc: 'Garage circuit ' + (i + 1) }));
  c.boards[0].ref = 'DB1'; c.boards.push(b2);
  return c;
}
export async function v16Pdfs() {
  const P = { profile: S.PROFILE };
  return {
    'v16-EIC': await certificatePdf(twoBoards(multiAddr(S.sampleEIC())), P),
    'v16-EICR': await certificatePdf(twoBoards(multiAddr(S.sampleEICR())), P),
    'v16-MW': await certificatePdf(multiAddr(S.sampleMW()), P),
  };
}
if (process.argv[1] && process.argv[1].endsWith('pdf_v16.mjs')) {
  const out = process.argv[2] || '/tmp';
  for (const [n, b] of Object.entries(await v16Pdfs())) fs.writeFileSync(`${out}/${n}.pdf`, Buffer.from(await b.arrayBuffer()));
  console.log('done');
}
