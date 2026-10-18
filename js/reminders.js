// reminders.js — when each job's installation is next due for inspection,
// a "Due soon" list on the jobs page, and a calendar file (.ics) you can add
// to your phone's calendar. Plain JS, tested by tests/reminders.test.mjs.
// Stored as job.nextInspection (yyyy-mm-dd) and job.remindOff (optional fields:
// older backups without them still restore fine).

export const SOON_DAYS = 90;
const iso = (d) => d.toISOString().slice(0, 10);
const addYears = (isoDate, y) => { const d = new Date(isoDate + 'T12:00:00Z'); d.setUTCFullYear(d.getUTCFullYear() + y); return iso(d); };
const addMonths = (isoDate, m) => { const d = new Date(isoDate + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + m); return iso(d); };

// "10 years" / "5 years" / "6 months" → date after `from`.
export function afterInterval(from, interval) {
  const m = /(\d+(?:\.\d+)?)\s*(year|yr|month|mo)/i.exec(String(interval || ''));
  if (!from || !m) return null;
  return /^y/i.test(m[2]) ? addYears(from, Math.round(Number(m[1]))) : addMonths(from, Math.round(Number(m[1])));
}
// The next inspection date the certificates suggest (newest certificate first).
export function suggestFromCerts(certs = []) {
  const sorted = [...certs].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  for (const c of sorted) {
    if (c.type === 'EICR' && c.eicr && /^\d{4}-\d{2}-\d{2}$/.test(c.eicr.nextDate || '')) return { date: c.eicr.nextDate, from: c.number || 'EICR', why: 'Next inspection date on the EICR' };
    if (c.type === 'EIC' && c.eic && c.eic.nextInterval) {
      const done = (c.issuedAt || c.createdAt || '').slice(0, 10);
      const d = afterInterval(done, c.eic.nextInterval);
      if (d) return { date: d, from: c.number || 'EIC', why: `${c.eic.nextInterval} from the EIC (${done.split('-').reverse().join('/')})` };
    }
  }
  return null;
}
export function nextFor(job, certs = []) {
  if (job && /^\d{4}-\d{2}-\d{2}$/.test(job.nextInspection || '')) return { date: job.nextInspection, set: true };
  const s = suggestFromCerts(certs); return s ? { ...s, set: false } : null;
}
// 'overdue' | 'soon' | 'later' | null, and whole days to go.
export function dueState(date, today = new Date()) {
  if (!date) return null;
  const d = new Date(date + 'T23:59:59'); if (isNaN(d)) return null;
  const days = Math.floor((d - today) / 86400000);
  return { state: days < 0 ? 'overdue' : days <= SOON_DAYS ? 'soon' : 'later', days };
}
export function dueList(jobs, certs, today = new Date()) {
  const out = [];
  for (const j of jobs) {
    if (j.remindOff) continue;
    const n = nextFor(j, certs.filter((c) => c.jobId === j.id)); if (!n) continue;
    const st = dueState(n.date, today); if (!st || st.state === 'later') continue;
    out.push({ job: j, date: n.date, ...st });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
// iCalendar file: an all-day event on the due date, with a reminder a month before.
const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = (line) => { const out = []; let s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); } out.push(s); return out.join('\r\n'); };
export function icsFor({ uid, date, title, location = '', notes = '', now = new Date() }) {
  const d = date.replace(/-/g, ''); const next = new Date(date + 'T12:00:00Z'); next.setUTCDate(next.getUTCDate() + 1);
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sparky//Inspection reminder//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${uid}@sparky`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${iso(next).replace(/-/g, '')}`,
    `SUMMARY:${esc(title)}`, location ? `LOCATION:${esc(location)}` : null, notes ? `DESCRIPTION:${esc(notes)}` : null,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'TRIGGER:-P30D', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR']
    .filter(Boolean).map(fold).join('\r\n') + '\r\n';
}
