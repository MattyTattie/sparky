// =====================================================================
// email.js — v0.17 "Email to customer". Opens your own mail app with the
// PDF attached (share menu, e.g. Gmail on Android). If your device can't
// share files, the PDF is saved to your downloads and a blank email opens
// with the subject, message and the client's email filled in, for you to
// attach it. The app never sends anything itself.
// =====================================================================
import { toast } from './ui.js';
import { emailParts, mailtoUrl } from './dangermodel.js';

export async function emailPdf(cert, blob, name, { notice = null, profile = {}, to = '' } = {}) {
  const { subject, body } = emailParts(cert, { notice, profile });
  const file = new File([blob], name, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: subject, text: body }); return 'shared'; }
    catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  toast('PDF saved to your downloads. Attach it to the email.');
  setTimeout(() => { location.href = mailtoUrl(to || (cert.client && cert.client.email) || '', { subject, body }); }, 400);
  return 'mailto';
}
