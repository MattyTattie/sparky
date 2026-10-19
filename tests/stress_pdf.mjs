// node tests/stress_pdf.mjs <outdir> — FAKE stress-test certificates with long values in every
// box (layout check: nothing may overlap). Also used by tests/pdf_layout.test.mjs.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
globalThis.jspdf ||= require('/workspace/sparky-work/npm/package/dist/jspdf.node.min.js');
const { certificatePdf } = await import('../js/pdf.js');
const S = await import('./sample-data.mjs');
const LONG = 'Switch-disconnector';
export function stressify(c, nCircuits = 40, nObs = 0) {
  const walk = (o) => { for (const [k, v] of Object.entries(o)) { if (typeof v === 'string' && k !== 'id' && k !== 'type' && k !== 'earthing' && k !== 'conductors' && !/date|Date|completed|nextInterval|mdUnit|amendedTo|status/.test(k)) o[k] = v ? v + (v.length < 6 ? ' (long value test)' : ' — plus a deliberately long extra note to stress the layout') : 'Long test value 123456'; } };
  for (const s of ['install', 'supply', 'parts', 'eic', 'eicr', 'mw']) if (c[s]) walk(c[s]);
  if (c.parts) Object.assign(c.parts, { msType: LONG, msBs: 'BS EN 60947-3:2021', msCurrent: '100', msKa: '>16' });
  for (const p of Object.values(c.people || {})) if (p) p.name = 'Maximilian Featherstonehaugh-Smythe';
  c.client.name = 'A Very Long Client Name Limited (fake)'; c.number = c.type + '-000123-LONG';
  for (const b of c.boards || []) {
    b.ref = 'DB-GARAGE-SUB-1'; b.location = 'Detached garage, rear wall behind the freezer (fake)';
    const base = b.circuits[0];
    b.circuits = Array.from({ length: nCircuits }, (_, i) => ({ ...base, id: 'c' + i, num: String(i + 1) + (i % 7 === 0 ? 'L1' : ''), desc: i % 3 ? 'Kitchen sockets ring final incl. island and utility room' : 'Spare', live: '2.5', cpc: '1.5', bs: '61009-1', type: 'B', rating: '32', bka: '10', irLL: '>999', irLE: 'LIM', irV: '500', r1: '0.123', rn: '0.124', r2: '0.205', r1r2: 'N/A', R2: 'N/A', zs: '>99.99', rcdMs: '>300', rcdBs: '61009-1', rcdType: 'A-S', rcdIdn: '300', rcdRating: '32', pol: '✓', rcdBtn: '✓', afddBtn: 'N/A', remarks: 'Vulnerable equipment: fridge freezer and router; disconnected for IR test at 250 V', wiring: 'A', ref: '100', points: '12', maxZsOverride: '' }));
  }
  if (c.type !== 'MW') c.bonding = [
    { id: 'b1', location: 'Bathroom (first floor, en-suite off the main bedroom)', parts: 'Hot and cold water pipes, Central heating pipes, Radiator / towel rail, Metal bath / shower tray, CPCs of circuits in the location', csa: '4', material: 'Copper', reading: '0.03', verified: true },
    { id: 'b2', location: 'Kitchen', parts: 'Hot and cold water pipes at sink', csa: '4', material: 'Copper', reading: '0.05', verified: true },
    { id: 'b3', location: 'Boiler / airing cupboard', parts: 'Gas pipe, Central heating pipes', csa: '10', material: 'Copper', reading: '>0.99 (check clamp)', verified: false },
  ];
  if (c.observations && nObs) c.observations = Array.from({ length: nObs }, (_, i) => ({ id: 'o' + i, text: 'Observation ' + (i + 1) + ': socket-outlet in kitchen has a cracked faceplate exposing live parts; replace accessory and re-test the circuit afterwards (fake)', code: ['C1', 'C2', 'C3', 'FI'][i % 4], reg: '416.2.1', location: 'Kitchen, circuit 7' }));
  return c;
}
export async function stressPdfs() {
  return {
    EIC: await certificatePdf(stressify(S.sampleEIC(), 40), { profile: { ...S.PROFILE, name: 'Maximilian Featherstonehaugh-Smythe' } }),
    EICR: await certificatePdf(stressify(S.sampleEICR(), 40, 30), { profile: S.PROFILE }),
    MW: await certificatePdf(stressify(S.sampleMW(), 1), { profile: S.PROFILE }),
  };
}
if (process.argv[1] && process.argv[1].endsWith('stress_pdf.mjs')) {
  const out = process.argv[2] || '/tmp';
  for (const [n, b] of Object.entries(await stressPdfs())) fs.writeFileSync(`${out}/stress-${n}.pdf`, Buffer.from(await b.arrayBuffer()));
  console.log('done');
}
