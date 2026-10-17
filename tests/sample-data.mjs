// Clearly fake example data for tests, screenshots and sample PDFs.
// (Made-up people and places only — never real customer data.)
import { newCert, blankBoard } from '../js/certmodel.js';
import { blankCircuit, applyTemplate, TEMPLATES, makeSpare } from '../js/templates.js';

export const PROFILE = { name: 'Sam Sparks', business: 'Example Electrical (sample)', address1: '1 Sample Street', town: 'Testville', postcode: 'ZZ1 1ZZ', phone: '01234 000000', email: 'hello@example.com', position: 'Proprietor', regNo: 'Sample reg no. 000000' };
export const CUSTOMER = { id: 'cust-demo', name: 'A. N. Example', address: '12 Imaginary Road, Faketown', postcode: 'ZZ9 9ZZ', phone: '', email: '', notes: 'Fake customer for testing' };
export const JOB = { id: 'job-demo', customerId: 'cust-demo', title: 'Consumer unit change', siteAddress: '12 Imaginary Road, Faketown', sitePostcode: 'ZZ9 9ZZ', notes: 'Demo job with made-up readings', status: 'open', photos: [] };
export const INSTRUMENTS = { multi: 'Megger MFT1741+ s/n 000123 (cal. 2026-03-01)', continuity: '', ir: '', efli: '', rcd: '', electrode: '' };

const T = (name) => TEMPLATES.find((t) => t.name.startsWith(name));
function circuits(clean = true) {
  const c = (n, tname, extra) => Object.assign(applyTemplate(blankCircuit(n), T(tname)), extra);
  return [
    c(1, 'Ring final', { desc: 'Sockets downstairs', points: '12', r1: '0.52', rn: '0.52', r2: '0.86', r1r2: '0.35', irLL: '>999', irLE: '>999', pol: '✓', zs: '0.62', rcdMs: '22', rcdBtn: '✓', afddBtn: 'N/A' }),
    c(2, 'Ring final', { desc: 'Sockets upstairs', points: '10', r1: '0.61', rn: '0.62', r2: '1.01', r1r2: '0.41', irLL: '>999', irLE: clean ? '>999' : '250', pol: '✓', zs: clean ? '0.71' : '1.21', rcdMs: '25', rcdBtn: '✓', afddBtn: 'N/A', remarks: clean ? '' : 'Over 80% of max Zs, re-test hot' }),
    c(3, 'Radial 32', { desc: 'Kitchen appliances', points: '4', r1r2: '0.28', irLL: '>999', irLE: '>999', pol: '✓', zs: '0.55', rcdMs: '19', rcdBtn: '✓', afddBtn: 'N/A' }),
    c(4, 'Cooker', { r1r2: '0.21', irLL: '>999', irLE: '>999', pol: '✓', zs: '0.48', rcdMs: '24', rcdBtn: '✓', afddBtn: 'N/A' }),
    c(5, 'Electric shower', { r1r2: '0.16', irLL: '>999', irLE: '>999', pol: '✓', zs: clean ? '0.40' : '1.20', rcdMs: clean ? '18' : '330', rcdBtn: '✓', afddBtn: 'N/A', remarks: clean ? '' : 'Demo: Zs and RCD time over limit' }),
    c(6, 'Lighting', { desc: 'Lights downstairs', points: '9', r1r2: '1.10', irLL: '>999', irLE: clean ? '>999' : '0.8', pol: '✓', zs: '1.45', rcdMs: '21', rcdBtn: '✓', afddBtn: 'N/A' }),
    c(7, 'Lighting', { desc: 'Lights upstairs', points: '8', r1r2: '1.32', irLL: '>999', irLE: '>999', pol: '✓', zs: '1.67', rcdMs: '23', rcdBtn: '✓', afddBtn: 'N/A' }),
    c(8, 'Smoke', { points: '4', r1r2: '1.02', irLL: '>999', irLE: '>999', pol: '✓', zs: '1.39', rcdMs: '26', rcdBtn: '✓', afddBtn: 'N/A' }),
    makeSpare(blankCircuit(9)),
  ];
}
export function board(clean = true) {
  const b = blankBoard(1);
  Object.assign(b, { location: 'Under stairs', ocpdBs: 'BS 88-3', ocpdType: 'gG', ocpdRating: '100', spdT2: true, rcdBs: 'N/A', zdb: '0.24', ipf: '1.6', polOk: true, phaseSeq: false, spdOk: true });
  b.circuits = circuits(clean);
  return b;
}
const base = { profile: PROFILE, customer: CUSTOMER, job: JOB, instruments: INSTRUMENTS };
const sigImg = null;
export function sampleEIC() {
  const c = newCert('EIC', { ...base, number: 'EIC-0001' });
  Object.assign(c.install, { description: 'Replacement consumer unit with RCBOs and Type 2 SPD; all circuits tested', extent: 'Consumer unit and all final circuits from the CU (existing wiring tested, not altered)', extentType: 'Alteration to an existing installation' });
  Object.assign(c.supply, { ipf: '1.6', ze: '0.24', spType: 'gG', spRating: '100', spKa: '33' });
  Object.assign(c.parts, { maxDemand: '60', bondWater: true, bondGas: true, msLocation: 'Consumer unit', msType: '', rcdType: '' });
  for (const k of Object.keys(c.inspections)) c.inspections[k] = ['2.0', '5.0', '13.0', '14.0'].includes(k) ? 'N/A' : '✓';
  c.comments = 'Demo comment: no main bonding label at the gas meter (now fitted).';
  c.boards = [board()];
  return c;
}
export function sampleEICR() {
  const c = newCert('EICR', { ...base, number: 'EICR-0001' });
  Object.assign(c.eicr, { reason: 'Change of tenancy', wiringAge: '25', alterations: 'Yes', alterAge: '8', records: 'No', extent: 'Whole installation, 10% sample of accessories opened up', agreedLimits: 'Loft not accessed (boarded and stored)', agreedWith: 'Client', operationalLimits: 'None', general: 'Fair for its age; see observations', nextDate: '2031-10-17', nextReasons: 'Rented property (5-year interval)' });
  c.install.occupier = 'Tenant (fake)';
  Object.assign(c.supply, { ipf: '1.6', ze: '0.24', spType: 'gG', spRating: '100' });
  for (const k of Object.keys(c.inspections)) c.inspections[k] = /^(2\.0|4\.2[12]|6\.[23]|7\.1|8\.1)$/.test(k) ? 'N/A' : '✓';
  c.inspections['4.10'] = 'C3'; c.inspections['5.12'] = 'C2';
  c.observations = [
    { id: 'o1', text: 'No RCD protection for socket-outlets that may supply equipment used outdoors', code: 'C2', reg: '411.3.3', location: 'Circuit 5 (demo)' },
    { id: 'o2', text: 'RCD six-monthly test notice missing', code: 'C3', reg: '514.12.2', location: 'Consumer unit' },
    { id: 'o3', text: 'Unable to locate or access circuit — further investigation advised', code: 'FI', reg: '651.2', location: 'Garage spur' },
  ];
  c.boards = [board()];
  return c;
}
export function sampleMW() {
  const c = newCert('MW', { ...base, number: 'MW-0001' });
  Object.assign(c.mw, { description: 'Added one double socket-outlet to the kitchen ring (circuit 1)', zdb: '0.24', bondWater: true, bondGas: true, dbLocation: 'Under stairs, metal CU', spdOk: '✓' });
  Object.assign(c.mw.circuit, applyTemplate(c.mw.circuit, T('Ring final')), { desc: 'Kitchen sockets', r1: '0.48', rn: '0.49', r2: '0.80', r1r2: '0.32', irLL: '>999', irLE: '>999', pol: '✓', zs: '0.58', rcdMs: '21', rcdBtn: '✓', afddBtn: 'N/A' });
  return c;
}
