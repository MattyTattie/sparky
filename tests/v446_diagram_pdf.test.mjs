// v0.44.6: View PDF on the wiring diagram screen = just the diagram sheets. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.jspdf ||= require('/workspace/sparky-work/npm/package/dist/jspdf.node.min.js');
const { diagramOnlyPdf } = await import('../js/pdf.js');
const cert = { type: 'EIC', number: 'EIC-TEST-1', diagramPdf: false, install: { address: '1 Test Street' }, client: {}, boards: [{ id: 'b', ref: 'DB1', circuits: [{ num: '1', desc: 'Hot water', device: 'mcb', type: 'B', rating: '16', live: '2.5', cpc: '1.5', points: '1', diagram: { items: { immersion: 1 } } }, { num: '2', desc: 'Solar PV', device: 'mcb', type: 'B', rating: '16', live: '4', cpc: '2.5', points: '1', diagram: { items: { pvarray: 1, dciso: 1, hybinv: 1, aciso: 1 } } }] }] };
test('diagram-only PDF has only wiring diagram pages, even when not in the certificate PDF', async () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'v446-')), 'd.pdf'); fs.writeFileSync(f, Buffer.from(await (await diagramOnlyPdf(cert)).arrayBuffer()));
  const txt = spawnSync('pdftotext', ['-layout', f, '-']).stdout.toString(); const pages = txt.split('\f').filter((p) => p.trim());
  assert.ok(pages.length >= 1); for (const p of pages) assert.match(p, /WIRING DIAGRAM/);
  assert.match(txt, /Immersion/); assert.match(txt, /Inverter/); assert.doesNotMatch(txt, /SCHEDULE OF TEST RESULTS|DECLARATION/);
});
