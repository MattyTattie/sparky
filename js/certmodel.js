// =====================================================================
// certmodel.js — what a certificate holds, and the on-screen sections.
// =====================================================================
import { blankCircuit, isSpareCircuit } from './templates.js';
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
  f('supply.polarity', 'Supply polarity confirmed', 'check'), f('supply.otherSources', 'Other sources of supply (continuation sheet)', 'check', { redraw: true }),
  f('supply.spBs', 'Supply protective device BS (EN)'), f('supply.spType', 'Type', 'text', { opt: true }), f('supply.spRating', 'Rated current (A)', 'num'), f('supply.spKa', 'Breaking capacity (kA)', 'num'),
], doneIf: (c) => sourcesOk(c) };
// v0.8: the parts of section G/J that only apply sometimes. Fields can carry
// showIf / hideIf: a key (shown/hidden when that value is truthy) or a
// function (cert) => boolean. Hidden fields print N/A and are not needed for
// the green dot. opt: true = can be left blank (e.g. "if any").
export const isElectrode = (c) => /electrode/i.test(get(c, 'parts.means') || '');
const anyOf = (c, ks) => ks.some((k) => String(get(c, 'parts.' + k) ?? '').trim());
// "Main switch is an RCD" / "...is a breaker or fuse": old jobs have no tick, so
// work it out from the boxes (anything filled in = on), so nothing disappears.
export const msIsRcd = (c) => { const v = get(c, 'parts.msIsRcd'); return v == null ? anyOf(c, ['rcdType', 'rcdIdn', 'rcdDelay', 'rcdMs']) : Boolean(v); };
export const msIsOcpd = (c) => { const v = get(c, 'parts.msIsOcpd'); return v == null ? anyOf(c, ['msType', 'msRating', 'msKa']) : Boolean(v); };
// Bonded services, each with its own optional csa (v0.8, blank = same as the main bonding csa).
export const BOND_SERVICES = [['Water', 'water installation pipes'], ['Gas', 'gas installation pipes'], ['Oil', 'oil installation pipes'], ['Steel', 'structural steel'], ['Lightning', 'lightning protection']];
export const bondTicked = (c, svc) => (svc === 'Other' ? Boolean(String(get(c, 'parts.bondOther') || '').trim()) : Boolean(get(c, 'parts.bond' + svc)));
export const bondCsaFor = (c, svc) => String(get(c, `parts.bond${svc}Csa`) ?? '').trim() || String(get(c, 'parts.bondCsa') ?? '').trim();
export const bondNone = (c) => Boolean(get(c, 'parts.bondNone'));
const svcCsa = (svc, name) => f(`parts.bond${svc}Csa`, `${name} bonding csa (mm²)`, 'num', { showIf: (c) => bondTicked(c, svc), placeholder: (c) => (get(c, 'parts.bondCsa') ? 'Same as main: ' + get(c, 'parts.bondCsa') : ''), opt: true, indent: true });
const PARTS = { id: 'parts', title: 'Earthing, bonding and main switch', form: 'G / J', fields: [
  f('parts.means', 'Means of earthing', 'chips', { opts: ['Distributor\u2019s facility', 'Installation earth electrode'], redraw: true }),
  f('parts.maxDemand', 'Maximum demand', 'num', { action: { label: 'Work it out from the loads', href: (c) => '#/calc/md/' + c.id } }), f('parts.mdUnit', 'Unit', 'chips', { opts: ['A', 'kVA'] }),
  f('parts.elType', 'Earth electrode type (rod, tape…)', 'text', { showIf: isElectrode }), f('parts.elLocation', 'Electrode location', 'text', { showIf: isElectrode }), f('parts.elRa', 'Electrode resistance RA (Ω)', 'num', { showIf: isElectrode }),
  // v0.10: headings as on the IET form.
  f('parts._hEc', 'Earthing conductor', 'heading'),
  f('parts.ecMat', 'Material'), f('parts.ecCsa', 'csa (mm²)', 'num'), f('parts.ecOk', 'Connection / continuity verified', 'check'),
  f('parts._hBond', 'Main protective bonding conductors', 'heading'),
  f('parts.bondNone', 'None needed (no extraneous-conductive-parts: all plastic / none present)', 'check', { redraw: true, hideIf: (c) => !bondNone(c) && (BOND_SERVICES.some(([s]) => bondTicked(c, s)) || bondTicked(c, 'Other')) }),
  f('parts.bondMat', 'Material', 'text', { hideIf: 'parts.bondNone' }), f('parts.bondCsa', 'csa (mm²)', 'num', { hideIf: 'parts.bondNone', hint: 'Used for every service below unless you give it its own size.' }), f('parts.bondOk', 'Connection / continuity verified', 'check', { hideIf: 'parts.bondNone' }),
  f('parts._hExt', 'Bonding of extraneous-conductive-parts', 'heading', { hideIf: 'parts.bondNone' }),
  f('parts.bondWater', 'Water installation pipes', 'check', { redraw: true, hideIf: 'parts.bondNone' }), svcCsa('Water', 'Water'),
  f('parts.bondGas', 'Gas installation pipes', 'check', { redraw: true, hideIf: 'parts.bondNone' }), svcCsa('Gas', 'Gas'),
  f('parts.bondOil', 'Oil installation pipes', 'check', { redraw: true, hideIf: 'parts.bondNone' }), svcCsa('Oil', 'Oil'),
  f('parts.bondSteel', 'Structural steel', 'check', { redraw: true, hideIf: 'parts.bondNone' }), svcCsa('Steel', 'Structural steel'),
  f('parts.bondLightning', 'Lightning protection', 'check', { redraw: true, hideIf: 'parts.bondNone' }), svcCsa('Lightning', 'Lightning protection'),
  f('parts.bondOther', 'Other (specify)', 'text', { redraw: 'blur', opt: true, hideIf: 'parts.bondNone' }), svcCsa('Other', 'Other'),
  f('parts.msLocation', 'Main switch location'), f('parts.msBs', 'Main switch BS (EN)'), f('parts.msPoles', 'No. of poles', 'num'), f('parts.msCurrent', 'Current rating (A)', 'num'), f('parts.msVoltage', 'Voltage rating (V)', 'num'),
  f('parts.msIsOcpd', 'Main switch is a breaker or fuse (OCPD)', 'check', { dflt: msIsOcpd, redraw: true }),
  f('parts.msType', 'Device type (MCCB / ACB / fuse…)', 'text', { showIf: msIsOcpd, indent: true }), f('parts.msRating', 'Device rating/setting (A)', 'num', { showIf: msIsOcpd, indent: true }), f('parts.msKa', 'Breaking capacity (kA)', 'num', { showIf: msIsOcpd, indent: true }),
  f('parts.msIsRcd', 'Main switch is an RCD', 'check', { dflt: msIsRcd, redraw: true }),
  f('parts.rcdType', 'RCD type (AC/A/F/B)', 'text', { showIf: msIsRcd, indent: true }), f('parts.rcdIdn', 'IΔn (mA)', 'num', { showIf: msIsRcd, indent: true }), f('parts.rcdDelay', 'Rated time delay (ms)', 'num', { showIf: msIsRcd, indent: true, hint: '0 if not time-delayed.' }), f('parts.rcdMs', 'Measured operating time (ms)', 'num', { showIf: msIsRcd, indent: true }),
], doneIf: (c) => bondNone(c) || BOND_SERVICES.some(([s]) => bondTicked(c, s)) || bondTicked(c, 'Other') };

export function sectionsFor(type) {
  if (type === 'EIC') return [
    { id: 'client', title: 'Client and installation', form: 'A / B', fields: [
      f('client.name', 'Client name'), f('client.address', 'Client address', 'area'),
      f('install.address', 'Installation address', 'area'), f('install.postcode', 'Installation postcode', 'text', { opt: true }),
      f('install.extentType', 'Type of work', 'chips', { opts: ['New installation', 'Addition to an existing installation', 'Alteration to an existing installation'] }),
      f('install.description', 'Description of installation', 'area'), f('install.extent', 'Extent of installation covered by this certificate', 'area'),
    ] },
    { id: 'design', title: 'Design, construction, inspection', form: 'C / D', fields: [
      f('eic.designDepartures', 'Design: departures from BS 7671', 'area', { opt: true }), f('eic.exceptions', 'Permitted exceptions (411.3.3)', 'area', { opt: true }), f('eic.riskAttached', 'Risk assessment attached', 'check'),
      f('eic.constructionDepartures', 'Construction: departures', 'area', { opt: true }), f('eic.inspectionDepartures', 'Inspection & testing: departures', 'area', { opt: true }),
      f('eic.nextInterval', 'Next inspection in not more than', 'chips', { opts: ['10 years', '5 years', '3 years', '1 year'] }),
    ] },
    { id: 'people', title: 'Who signs (particulars)', form: 'E', fields: [
      f('eic.samePerson', 'I did the design, construction and testing', 'check'),
      f('people.designer.name', 'Designer name'), f('people.designer.for', 'For/on behalf of'), f('people.designer.address', 'Address', 'area'), f('people.designer.postcode', 'Postcode', 'text', { opt: true }), f('people.designer.tel', 'Tel', 'text', { opt: true }),
      f('people.constructor.name', 'Constructor name', 'text', { hideIf: 'eic.samePerson' }), f('people.constructor.for', 'For/on behalf of', 'text', { hideIf: 'eic.samePerson' }),
      f('people.inspector.name', 'Inspector name', 'text', { hideIf: 'eic.samePerson' }), f('people.inspector.for', 'For/on behalf of', 'text', { hideIf: 'eic.samePerson' }),
      f('people.designer2.name', 'Designer No 2 (if any)', 'text', { opt: true }), f('people.designer2.for', 'Designer 2 for/on behalf of', 'text', { opt: true, showIf: 'people.designer2.name' }),
    ] },
    SUPPLY, PARTS,
    { id: 'inspections', title: 'Schedule of inspections', form: 'H', special: 'inspections' },
    { id: 'comments', title: 'Comments on existing installation', form: 'I', fields: [f('comments', 'Comments (see Regulation 644.1.2)', 'area', { opt: true })] },
    { id: 'boards', title: 'Circuits and test results', form: 'Schedules', special: 'boards' },
    { id: 'bonding', title: 'Supplementary bonding', form: 'Schedule', special: 'bonding' },
    { id: 'sign', title: 'Sign', form: 'C', special: 'sign' },
  ];
  if (type === 'EICR') return [
    { id: 'client', title: 'Person ordering, reason', form: 'A / B', fields: [
      f('client.name', 'Person ordering the report'), f('client.address', 'Their address', 'area'),
      f('eicr.reason', 'Reason for producing this report', 'chips', { opts: ['Change of tenancy', 'Landlord requirement', 'Sale of property', 'Periodic inspection', 'Insurance', 'Other'] }),
      f('eicr.datesDone', 'Date(s) inspection and testing carried out'),
    ] },
    { id: 'install', title: 'The installation', form: 'C', fields: [
      f('install.occupier', 'Occupier', 'text', { opt: true }), f('install.address', 'Installation address', 'area'), f('install.postcode', 'Postcode', 'text', { opt: true }),
      f('eicr.premises', 'Description of premises', 'chips', { opts: ['Residential', 'Commercial', 'Industrial', 'Other'], redraw: true }), f('eicr.premisesOther', 'If other, describe', 'text', { showIf: (c) => c.eicr.premises === 'Other' }),
      f('eicr.wiringAge', 'Estimated age of wiring (years)', 'num'),
      f('eicr.alterations', 'Evidence of additions / alterations', 'chips', { opts: ['Yes', 'Not apparent'], redraw: true }), f('eicr.alterAge', 'If yes, estimated age (years)', 'num', { showIf: (c) => c.eicr.alterations === 'Yes' }),
      f('eicr.records', 'Installation records available (651.1)', 'chips', { opts: ['Yes', 'No'] }), f('eicr.lastInspection', 'Date of last inspection', 'text', { opt: true, hint: 'Leave blank if not known.' }),
    ] },
    { id: 'extent', title: 'Extent and limitations', form: 'D', fields: [
      f('eicr.extent', 'Parts of the installation inspected and tested', 'area'), f('eicr.agreedLimits', 'Agreed limitations, with reasons', 'area', { opt: true }), f('eicr.agreedWith', 'Agreed with', 'text', { opt: true }), f('eicr.operationalLimits', 'Operational limitations, with reasons', 'area', { opt: true }),
    ] },
    { id: 'observations', title: 'Observations (C1, C2, C3, FI)', form: 'K', special: 'observations' },
    { id: 'summary', title: 'Summary and next inspection', form: 'E / F', fields: [
      f('eicr.general', 'General condition of the installation (electrical safety)', 'area'),
      f('eicr.overall', 'Overall assessment', 'chips', { opts: ['SATISFACTORY', 'UNSATISFACTORY'], opt: true, hint: 'Set automatically from the observations unless you pick one.' }),
      f('eicr.nextDate', 'Next inspection before', 'date'), f('eicr.nextReasons', 'For the following reasons', 'area', { opt: true }),
    ] },
    SUPPLY, PARTS,
    { id: 'inspections', title: 'Schedule of inspection', form: 'Schedule', special: 'inspections' },
    { id: 'boards', title: 'Circuits and test results', form: 'Schedules', special: 'boards' },
    { id: 'bonding', title: 'Supplementary bonding', form: 'Schedule', special: 'bonding' },
    { id: 'sign', title: 'Declaration and sign', form: 'G', special: 'sign', fields: [
      f('people.inspector.name', 'Inspected and tested by'), f('people.inspector.for', 'For/on behalf of'), f('people.inspector.position', 'Position'), f('people.inspector.address', 'Address', 'area'),
      f('eicr.authoriser.name', 'Report authorised for issue by'), f('eicr.authoriser.for', 'For/on behalf of'), f('eicr.authoriser.position', 'Position'),
    ] },
  ];
  return [
    { id: 'mwA', title: 'The minor works', form: 'A', fields: [
      f('client.name', 'Details of the client'), f('mw.completed', 'Date minor works completed', 'date'),
      f('install.address', 'Installation location/address', 'area'), f('mw.description', 'Description of the minor works', 'area'),
      f('mw.departures', 'Departures from BS 7671', 'area', { opt: true }), f('mw.exceptions', 'Permitted exceptions (411.3.3)', 'area', { opt: true }), f('mw.risk', 'Risk assessment attached', 'check'),
      f('mw.comments', 'Comments on the existing installation (644.1.2)', 'area', { opt: true }),
    ] },
    { id: 'mwB', title: 'Earthing and bonding', form: 'B', fields: [
      f('mw.earthing', 'System earthing arrangement', 'chips', { opts: EARTHING }), f('mw.zdb', 'Zdb at the board supplying the circuit (Ω)', 'num'),
      f('mw.earthingCond', 'Earthing conductor present', 'check'),
      f('mw.bondWater', 'Bonding to water', 'check'), f('mw.bondGas', 'Bonding to gas', 'check'), f('mw.bondOil', 'Bonding to oil', 'check'), f('mw.bondSteel', 'Bonding to structural steel', 'check'), f('mw.bondOther', 'Other (specify)', 'text', { opt: true }),
    ] },
    { id: 'mwC', title: 'Circuit and test results', form: 'C / D', special: 'mwcircuit', fields: [
      f('mw.dbRef', 'DB reference'), f('mw.dbLocation', 'DB location and type', 'text', { opt: true }),
    ] },
    { id: 'sign', title: 'Declaration and sign', form: 'E', special: 'sign', fields: [
      f('people.inspector.name', 'Name'), f('people.inspector.for', 'For/on behalf of'), f('people.inspector.position', 'Position'), f('people.inspector.address', 'Address', 'area'),
    ] },
  ];
}

// v0.5: supplementary bonding (optional, so older certificates and backups
// still load): cert.bonding = [{ id, location, parts, csa, material, reading, verified }],
// cert.bondingNA = true when none is installed/needed.
export const blankBond = (id = '') => ({ id, location: '', parts: '', csa: '4', material: 'Copper', reading: '', verified: false });
export const BOND_LOCATIONS = ['Bathroom', 'Shower room', 'En-suite', 'Kitchen', 'Utility room', 'Boiler / airing cupboard', 'Swimming pool / hot tub', 'Sauna', 'Agricultural building', 'Other'];
export const BOND_PARTS = ['Hot and cold water pipes', 'Central heating pipes', 'Radiator / towel rail', 'Metal bath / shower tray', 'Waste pipe (metal)', 'CPCs of circuits in the location', 'Structural steel', 'Gas pipe'];

// v0.8: is a field showing? showIf / hideIf take a key (truthy value) or a
// function (cert) => boolean. Hidden fields are not needed and print N/A.
const test = (c, w) => (typeof w === 'function' ? Boolean(w(c)) : Boolean(get(c, w)));
export function visible(cert, fd) {
  if (fd.hideIf && test(cert, fd.hideIf)) return false;
  if (fd.showIf && !test(cert, fd.showIf)) return false;
  return true;
}
// The fields a section needs before its dot goes green: every showing field
// that isn't a tick box and isn't marked opt (optional / "if any").
export const neededFields = (cert, s) => (s.fields || []).filter((x) => x.type !== 'check' && x.type !== 'heading' && !x.opt && visible(cert, x));
const filled = (v) => String(v ?? '').trim() !== '';

// How complete a section is (for the progress dots).
export function sectionDone(cert, s) {
  if (s.special === 'inspections') { const v = Object.values(cert.inspections || {}); return v.length && v.every(Boolean); }
  if (s.special === 'boards') return (cert.boards || []).some((b) => b.circuits.length) && cert.boards.every((b) => b.circuits.every((c) => isSpareCircuit(c) || c.zs));
  if (s.special === 'observations') return true;
  if (s.special === 'bonding') return Boolean(cert.bondingNA || (cert.bonding || []).length || cert.status === 'issued');
  if (s.special === 'sign') return Boolean(cert.sigs && Object.values(cert.sigs).some((x) => x && x.img));
  if (s.special === 'mwcircuit') return Boolean(cert.mw.circuit.desc && cert.mw.circuit.zs) && neededFields(cert, s).every((x) => filled(get(cert, x.k)));
  if (s.id === 'parts') { // a ticked service needs a size (its own, or the main bonding csa)
    if (!bondNone(cert) && [...BOND_SERVICES.map(([x]) => x), 'Other'].some((x) => bondTicked(cert, x) && !bondCsaFor(cert, x))) return false;
  }
  if (s.doneIf && !s.doneIf(cert)) return false;
  return neededFields(cert, s).every((x) => filled(get(cert, x.k)));
}
// Which needed fields are still empty (shown at the top of a section).
export const missingFields = (cert, s) => (s.special ? [] : neededFields(cert, s).filter((x) => !filled(get(cert, x.k))));

// v0.14: other sources of supply (battery storage, PV inverter, generator...),
// printed on their own continuation sheet. Optional, so older certificates and
// backups still load: cert.otherSources = [{ id, type, make, kw, isolation, ref, notes }].
export const SOURCE_TYPES = ['Battery storage', 'PV inverter', 'Generator', 'Other'];
export const blankSource = (id = '') => ({ id, type: '', make: '', kw: '', isolation: '', ref: '', notes: '' });
export const sourceRows = (cert) => (get(cert, 'supply.otherSources') ? (cert.otherSources || []).filter((x) => x && (x.type || x.make || x.kw || x.isolation || x.ref || x.notes)) : []);
// What's still missing for the green dot: at least one source, each with a type and a rating.
export function sourcesMissing(cert) {
  if (!get(cert, 'supply.otherSources')) return [];
  const list = sourceRows(cert);
  if (!list.length) return ['the other source details'];
  const m = [];
  list.forEach((x, i) => { const n = list.length > 1 ? ` (source ${i + 1})` : ''; if (!x.type) m.push('source type' + n); if (!String(x.kw || '').trim()) m.push('rating kW' + n); });
  return m;
}
export const sourcesOk = (cert) => !sourcesMissing(cert).length;
