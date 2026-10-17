// =====================================================================
// certmodel.js — what a certificate holds, and the on-screen sections.
// =====================================================================
import { blankCircuit } from './templates.js';
import { EIC_ITEMS, EICR_ITEMS } from './inspections.js';

export const TYPES = {
  EIC: { name: 'Electrical Installation Certificate', short: 'EIC', prefix: 'EIC' },
  EICR: { name: 'Electrical Installation Condition Report', short: 'EICR', prefix: 'EICR' },
  MW: { name: 'Minor Works Certificate', short: 'Minor Works', prefix: 'MW' },
};
export const AMENDED_TO = '2026';
export const EARTHING = ['TN-C', 'TN-S', 'TN-C-S (PME)', 'TN-C-S (PNB)', 'TT', 'IT'];
export const LIVE_COND = ['1-phase, 2-wire', '2-phase, 3-wire', '3-phase, 3-wire', '3-phase, 4-wire', 'DC 2-wire', 'DC 3-wire', 'Other'];

export function get(o, path) { return path.split('.').reduce((a, k) => (a == null ? a : a[k]), o); }
export function set(o, path, v) {
  const ks = path.split('.'); let a = o;
  for (const k of ks.slice(0, -1)) { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; a = a[k]; }
  a[ks[ks.length - 1]] = v;
}

export function blankBoard(n = 1) {
  return { id: 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ref: n === 1 ? 'DB1' : 'DB' + n, location: '', suppliedFrom: n === 1 ? 'Origin' : '', ocpdBs: '', ocpdType: '', ocpdRating: '', spdT1: false, spdT2: false, spdT3: false, spdNA: false, rcdBs: '', rcdType: '', rcdRating: '', rcdIdn: '', zdb: '', ipf: '', polOk: false, phaseSeq: false, spdOk: false, spdStatusNA: false, circuits: [] };
}

const person = (p = {}) => ({ name: p.name || '', for: p.business || '', address: [p.address1, p.address2, p.town].filter(Boolean).join(', '), postcode: p.postcode || '', tel: p.phone || '', position: p.position || '' });

export function newCert(type, { job = {}, customer = {}, profile = {}, instruments = {}, number = '' } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const me = person(profile);
  const c = {
    id: (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'x' + Date.now(),
    jobId: job.id || '', type, number, status: 'draft',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    amendedTo: AMENDED_TO,
    client: { name: customer.name || '', address: [customer.address, customer.postcode].filter(Boolean).join(', ') },
    install: { address: job.siteAddress || customer.address || '', postcode: job.sitePostcode || customer.postcode || '', occupier: '', description: '', extentType: 'New installation', extent: '' },
    supply: { earthing: 'TN-C-S (PME)', conductors: '1-phase, 2-wire', acdc: 'AC', u: '230', f: '50', ipf: '', ze: '', polarity: true, otherSources: false, spBs: 'BS 88-3', spType: '', spRating: '', spKa: '' },
    parts: { means: 'Distributor\u2019s facility', maxDemand: '', mdUnit: 'A', elType: '', elLocation: '', elRa: '', ecMat: 'Copper', ecCsa: '16', ecOk: true, bondMat: 'Copper', bondCsa: '10', bondOk: true, bondWater: false, bondGas: false, bondOil: false, bondSteel: false, bondLightning: false, bondOther: '', msLocation: '', msBs: '60947-3', msPoles: '2', msCurrent: '100', msVoltage: '230', msType: '', msRating: '', msKa: '', rcdType: '', rcdIdn: '', rcdDelay: '', rcdMs: '', rcdKa: '' },
    inspections: {}, comments: '',
    eic: { designDepartures: 'None', exceptions: 'None', riskAttached: false, constructionDepartures: 'None', inspectionDepartures: 'None', nextInterval: '10 years', samePerson: true, contSheet: '' },
    people: { designer: { ...me }, designer2: { name: '', for: '', address: '', postcode: '', tel: '' }, constructor: { ...me }, inspector: { ...me } },
    sigs: {},
    eicr: { reason: '', datesDone: today.split('-').reverse().join('/'), premises: 'Residential', premisesOther: '', wiringAge: '', alterations: 'Not apparent', alterAge: '', records: 'No', lastInspection: '', extent: '', agreedLimits: '', agreedWith: '', operationalLimits: '', overall: '', general: '', nextDate: '', nextReasons: '', authoriser: { name: me.name, for: me.for, position: me.position, address: me.address } },
    observations: [],
    boards: type === 'MW' ? [] : [blankBoard(1)],
    mw: { completed: today, description: '', departures: 'None', exceptions: 'None', risk: false, comments: '', earthing: 'TN-C-S (PME)', zdb: '', earthingCond: true, bondWater: false, bondGas: false, bondOil: false, bondSteel: false, bondOther: '', dbRef: 'DB1', dbLocation: '', circuit: blankCircuit(1), spdOk: '', afddOk: '' },
    instruments: { ...instruments },
    photoIds: [],
  };
  if (type === 'EIC') for (const [n] of EIC_ITEMS) c.inspections[n] = '';
  if (type === 'EICR') for (const [n, , h] of EICR_ITEMS) if (!h) c.inspections[n] = '';
  return c;
}

// Duplicate a certificate for a new job: keeps installation details,
// boards and circuit details, clears readings, signatures and dates.
export function copyCertForJob(src, { job = {}, customer = {}, number = '' } = {}) {
  const c = JSON.parse(JSON.stringify(src));
  c.id = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'x' + Date.now();
  c.jobId = job.id || ''; c.number = number; c.status = 'draft'; c.sigs = {};
  c.createdAt = c.updatedAt = new Date().toISOString();
  c.client = { name: customer.name || '', address: [customer.address, customer.postcode].filter(Boolean).join(', ') };
  c.install.address = job.siteAddress || customer.address || ''; c.install.postcode = job.sitePostcode || customer.postcode || '';
  c.supply.ipf = ''; c.supply.ze = ''; c.photoIds = []; c.observations = [];
  const clear = (ci) => { for (const k of ['r1', 'rn', 'r2', 'r1r2', 'R2', 'irLL', 'irLE', 'pol', 'zs', 'rcdMs', 'rcdBtn', 'afddBtn']) if (ci[k] !== 'N/A') ci[k] = ''; };
  for (const b of c.boards || []) { b.zdb = ''; b.ipf = ''; for (const ci of b.circuits) clear(ci); }
  if (c.mw && c.mw.circuit) clear(c.mw.circuit);
  for (const k of Object.keys(c.inspections || {})) c.inspections[k] = '';
  return c;
}

// The overall EICR result from the observations (C1/C2 → unsatisfactory).
export function eicrOverall(cert) {
  const codes = (cert.observations || []).map((o) => o.code);
  return codes.includes('C1') || codes.includes('C2') ? 'UNSATISFACTORY' : 'SATISFACTORY';
}

// ---------- Section lists for the screens ----------
// f(key, label, type, extra)
const f = (k, label, type = 'text', x = {}) => ({ k, label, type, ...x });
const SUPPLY = { id: 'supply', title: 'Supply and earthing', form: 'F / I', fields: [
  f('supply.earthing', 'Earthing arrangement', 'chips', { opts: EARTHING }),
  f('supply.conductors', 'Live conductors', 'select', { opts: LIVE_COND }),
  f('supply.u', 'Nominal voltage U/U0 (V)', 'num'), f('supply.f', 'Nominal frequency (Hz)', 'num'),
  f('supply.ipf', 'Prospective fault current Ipf (kA)', 'num'), f('supply.ze', 'External loop impedance Ze (Ω)', 'num'),
  f('supply.polarity', 'Supply polarity confirmed', 'check'), f('supply.otherSources', 'Other sources of supply (continuation sheet)', 'check'),
  f('supply.spBs', 'Supply protective device BS (EN)'), f('supply.spType', 'Type'), f('supply.spRating', 'Rated current (A)', 'num'), f('supply.spKa', 'Breaking capacity (kA)', 'num'),
] };
const PARTS = { id: 'parts', title: 'Earthing, bonding and main switch', form: 'G / J', fields: [
  f('parts.means', 'Means of earthing', 'chips', { opts: ['Distributor\u2019s facility', 'Installation earth electrode'] }),
  f('parts.maxDemand', 'Maximum demand', 'num'), f('parts.mdUnit', 'Unit', 'chips', { opts: ['A', 'kVA'] }),
  f('parts.elType', 'Earth electrode type (rod, tape…)'), f('parts.elLocation', 'Electrode location'), f('parts.elRa', 'Electrode resistance RA (Ω)', 'num'),
  f('parts.ecMat', 'Earthing conductor material'), f('parts.ecCsa', 'Earthing conductor csa (mm²)', 'num'), f('parts.ecOk', 'Earthing conductor connection verified', 'check'),
  f('parts.bondMat', 'Main bonding material'), f('parts.bondCsa', 'Main bonding csa (mm²)', 'num'), f('parts.bondOk', 'Main bonding connection verified', 'check'),
  f('parts.bondWater', 'Bonded to water', 'check'), f('parts.bondGas', 'Bonded to gas', 'check'), f('parts.bondOil', 'Bonded to oil', 'check'), f('parts.bondSteel', 'Bonded to structural steel', 'check'), f('parts.bondLightning', 'Bonded to lightning protection', 'check'), f('parts.bondOther', 'Bonded to other (specify)'),
  f('parts.msLocation', 'Main switch location'), f('parts.msBs', 'Main switch BS (EN)'), f('parts.msPoles', 'No. of poles', 'num'), f('parts.msCurrent', 'Current rating (A)', 'num'), f('parts.msVoltage', 'Voltage rating (V)', 'num'),
  f('parts.msType', 'If OCPD: device type (MCCB / fuse…)'), f('parts.msRating', 'Device rating/setting (A)', 'num'), f('parts.msKa', 'Breaking capacity (kA)', 'num'),
  f('parts.rcdType', 'If RCD main switch: type (AC/A/F/B)'), f('parts.rcdIdn', 'IΔn (mA)', 'num'), f('parts.rcdDelay', 'Rated time delay (ms)', 'num'), f('parts.rcdMs', 'Measured operating time (ms)', 'num'),
] };

export function sectionsFor(type) {
  if (type === 'EIC') return [
    { id: 'client', title: 'Client and installation', form: 'A / B', fields: [
      f('client.name', 'Client name'), f('client.address', 'Client address', 'area'),
      f('install.address', 'Installation address', 'area'), f('install.postcode', 'Installation postcode'),
      f('install.extentType', 'Type of work', 'chips', { opts: ['New installation', 'Addition to an existing installation', 'Alteration to an existing installation'] }),
      f('install.description', 'Description of installation', 'area'), f('install.extent', 'Extent of installation covered by this certificate', 'area'),
    ] },
    { id: 'design', title: 'Design, construction, inspection', form: 'C / D', fields: [
      f('eic.designDepartures', 'Design: departures from BS 7671', 'area'), f('eic.exceptions', 'Permitted exceptions (411.3.3)', 'area'), f('eic.riskAttached', 'Risk assessment attached', 'check'),
      f('eic.constructionDepartures', 'Construction: departures', 'area'), f('eic.inspectionDepartures', 'Inspection & testing: departures', 'area'),
      f('eic.nextInterval', 'Next inspection in not more than', 'chips', { opts: ['10 years', '5 years', '3 years', '1 year'] }),
    ] },
    { id: 'people', title: 'Who signs (particulars)', form: 'E', fields: [
      f('eic.samePerson', 'I did the design, construction and testing', 'check'),
      f('people.designer.name', 'Designer name'), f('people.designer.for', 'For/on behalf of'), f('people.designer.address', 'Address', 'area'), f('people.designer.postcode', 'Postcode'), f('people.designer.tel', 'Tel'),
      f('people.constructor.name', 'Constructor name', 'text', { hideIf: 'eic.samePerson' }), f('people.constructor.for', 'For/on behalf of', 'text', { hideIf: 'eic.samePerson' }),
      f('people.inspector.name', 'Inspector name', 'text', { hideIf: 'eic.samePerson' }), f('people.inspector.for', 'For/on behalf of', 'text', { hideIf: 'eic.samePerson' }),
      f('people.designer2.name', 'Designer No 2 (if any)'), f('people.designer2.for', 'Designer 2 for/on behalf of'),
    ] },
    SUPPLY, PARTS,
    { id: 'inspections', title: 'Schedule of inspections', form: 'H', special: 'inspections' },
    { id: 'comments', title: 'Comments on existing installation', form: 'I', fields: [f('comments', 'Comments (see Regulation 644.1.2)', 'area')] },
    { id: 'boards', title: 'Circuits and test results', form: 'Schedules', special: 'boards' },
    { id: 'sign', title: 'Sign', form: 'C', special: 'sign' },
  ];
  if (type === 'EICR') return [
    { id: 'client', title: 'Person ordering, reason', form: 'A / B', fields: [
      f('client.name', 'Person ordering the report'), f('client.address', 'Their address', 'area'),
      f('eicr.reason', 'Reason for producing this report', 'chips', { opts: ['Change of tenancy', 'Landlord requirement', 'Sale of property', 'Periodic inspection', 'Insurance', 'Other'] }),
      f('eicr.datesDone', 'Date(s) inspection and testing carried out'),
    ] },
    { id: 'install', title: 'The installation', form: 'C', fields: [
      f('install.occupier', 'Occupier'), f('install.address', 'Installation address', 'area'), f('install.postcode', 'Postcode'),
      f('eicr.premises', 'Description of premises', 'chips', { opts: ['Residential', 'Commercial', 'Industrial', 'Other'] }), f('eicr.premisesOther', 'If other, describe'),
      f('eicr.wiringAge', 'Estimated age of wiring (years)', 'num'),
      f('eicr.alterations', 'Evidence of additions / alterations', 'chips', { opts: ['Yes', 'Not apparent'] }), f('eicr.alterAge', 'If yes, estimated age (years)', 'num'),
      f('eicr.records', 'Installation records available (651.1)', 'chips', { opts: ['Yes', 'No'] }), f('eicr.lastInspection', 'Date of last inspection'),
    ] },
    { id: 'extent', title: 'Extent and limitations', form: 'D', fields: [
      f('eicr.extent', 'Parts of the installation inspected and tested', 'area'), f('eicr.agreedLimits', 'Agreed limitations, with reasons', 'area'), f('eicr.agreedWith', 'Agreed with'), f('eicr.operationalLimits', 'Operational limitations, with reasons', 'area'),
    ] },
    { id: 'observations', title: 'Observations (C1, C2, C3, FI)', form: 'K', special: 'observations' },
    { id: 'summary', title: 'Summary and next inspection', form: 'E / F', fields: [
      f('eicr.general', 'General condition of the installation (electrical safety)', 'area'),
      f('eicr.overall', 'Overall assessment', 'chips', { opts: ['SATISFACTORY', 'UNSATISFACTORY'], hint: 'Set automatically from the observations unless you pick one.' }),
      f('eicr.nextDate', 'Next inspection before', 'date'), f('eicr.nextReasons', 'For the following reasons', 'area'),
    ] },
    SUPPLY, PARTS,
    { id: 'inspections', title: 'Schedule of inspection', form: 'Schedule', special: 'inspections' },
    { id: 'boards', title: 'Circuits and test results', form: 'Schedules', special: 'boards' },
    { id: 'sign', title: 'Declaration and sign', form: 'G', special: 'sign', fields: [
      f('people.inspector.name', 'Inspected and tested by'), f('people.inspector.for', 'For/on behalf of'), f('people.inspector.position', 'Position'), f('people.inspector.address', 'Address', 'area'),
      f('eicr.authoriser.name', 'Report authorised for issue by'), f('eicr.authoriser.for', 'For/on behalf of'), f('eicr.authoriser.position', 'Position'),
    ] },
  ];
  return [
    { id: 'mwA', title: 'The minor works', form: 'A', fields: [
      f('client.name', 'Details of the client'), f('mw.completed', 'Date minor works completed', 'date'),
      f('install.address', 'Installation location/address', 'area'), f('mw.description', 'Description of the minor works', 'area'),
      f('mw.departures', 'Departures from BS 7671', 'area'), f('mw.exceptions', 'Permitted exceptions (411.3.3)', 'area'), f('mw.risk', 'Risk assessment attached', 'check'),
      f('mw.comments', 'Comments on the existing installation (644.1.2)', 'area'),
    ] },
    { id: 'mwB', title: 'Earthing and bonding', form: 'B', fields: [
      f('mw.earthing', 'System earthing arrangement', 'chips', { opts: EARTHING }), f('mw.zdb', 'Zdb at the board supplying the circuit (Ω)', 'num'),
      f('mw.earthingCond', 'Earthing conductor present', 'check'),
      f('mw.bondWater', 'Bonding to water', 'check'), f('mw.bondGas', 'Bonding to gas', 'check'), f('mw.bondOil', 'Bonding to oil', 'check'), f('mw.bondSteel', 'Bonding to structural steel', 'check'), f('mw.bondOther', 'Other (specify)'),
    ] },
    { id: 'mwC', title: 'Circuit and test results', form: 'C / D', special: 'mwcircuit', fields: [
      f('mw.dbRef', 'DB reference'), f('mw.dbLocation', 'DB location and type'),
    ] },
    { id: 'sign', title: 'Declaration and sign', form: 'E', special: 'sign', fields: [
      f('people.inspector.name', 'Name'), f('people.inspector.for', 'For/on behalf of'), f('people.inspector.position', 'Position'), f('people.inspector.address', 'Address', 'area'),
    ] },
  ];
}

// How complete a section is (for the progress ticks).
export function sectionDone(cert, s) {
  if (s.special === 'inspections') { const v = Object.values(cert.inspections || {}); return v.length && v.every(Boolean); }
  if (s.special === 'boards') return (cert.boards || []).some((b) => b.circuits.length) && cert.boards.every((b) => b.circuits.every((c) => c.spare || c.zs || c.desc === 'SPARE'));
  if (s.special === 'observations') return true;
  if (s.special === 'sign') return Boolean(cert.sigs && Object.values(cert.sigs).some((x) => x && x.img));
  if (s.special === 'mwcircuit') return Boolean(cert.mw.circuit.desc && cert.mw.circuit.zs);
  const need = (s.fields || []).filter((x) => x.type !== 'check' && !x.hideIf).slice(0, 3);
  return need.every((x) => String(get(cert, x.k) ?? '').trim());
}
