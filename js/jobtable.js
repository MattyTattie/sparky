// jobtable.js — v0.28: the rows and sorting for the desktop jobs table (pure, no DOM).
export const JOB_COLS = [['job', 'Job'], ['customer', 'Customer'], ['address', 'Address'], ['certs', 'Certificates'], ['status', 'Status'], ['updated', 'Updated']];
export function jobRows(jobs, certs, cmap, types = {}) {
  return (jobs || []).map((j) => {
    const n = (certs || []).filter((c) => c.jobId === j.id);
    const drafts = n.filter((c) => c.status !== 'issued').length;
    const status = j.status === 'done' || j.status === 'closed' ? 'Closed' : !n.length ? 'No certificate yet' : drafts ? (drafts === n.length ? 'Draft' : `${drafts} draft, ${n.length - drafts} issued`) : 'Issued';
    const cust = cmap[j.customerId];
    return { id: j.id, job: j.title || 'Job', customer: (cust && cust.name) || '', address: [j.siteAddress, j.sitePostcode].filter(Boolean).join(', ').replace(/\n/g, ', '),
      certs: n.map((c) => (types[c.type] || { short: c.type || '?' }).short).join(', '), status, updated: j.updatedAt || '' };
  });
}
export function sortRows(rows, key = 'updated', dir = key === 'updated' ? -1 : 1) {
  return [...rows].sort((a, b) => { const x = String(a[key] || ''), y = String(b[key] || '');
    if (!x && y) return 1; if (x && !y) return -1;
    return dir * x.localeCompare(y, 'en-GB', { sensitivity: 'base', numeric: true }) || String(b.updated).localeCompare(String(a.updated)); });
}
