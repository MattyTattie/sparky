// pdfview.js — look at a PDF inside the app before you share or print it.
// Android's web view can't show PDFs itself, so pages are drawn with pdf.js
// (vendor/pdfjs, works offline). Nothing is sent anywhere.
import { h, toast, shareOrDownload, icon } from './ui.js';

let lib = null;
async function pdfjs() {
  if (lib) return lib;
  lib = await import('../vendor/pdfjs/pdf.min.js');
  lib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.js', import.meta.url).href;
  return lib;
}

export async function viewPdf(blob, name = 'certificate.pdf', { shareText = '', email = null } = {}) {
  const pages = h('div', { class: 'pdfpages' }, h('p', { class: 'note', style: 'color:#fff;padding:20px' }, 'Opening…'));
  const count = h('span', { class: 'pdfcount' });
  const close = () => { bg.remove(); document.body.classList.remove('noscroll'); window.removeEventListener('hashchange', close); };
  const bg = h('div', { class: 'pdfview', role: 'dialog', 'aria-label': 'PDF preview' },
    h('div', { class: 'pdfbar' },
      h('button', { class: 'pdfbtn', 'aria-label': 'Close', onclick: close }, '✕'),
      h('div', { class: 'pdfname' }, name, count),
      h('button', { class: 'pdfbtn', 'aria-label': 'Zoom', onclick: () => { if (!doc) return; zoom = zoom === 1 ? 2 : 1; draw(); } }, icon('search', { size: 20 })),
      email ? h('button', { class: 'pdfbtn wide', id: 'pdfemail', onclick: () => email() }, 'Email') : null,
      h('button', { class: 'pdfbtn wide', onclick: async () => { const r = await shareOrDownload(blob, name, shareText); if (r === 'downloaded') toast('Saved to your downloads'); } }, 'Share / print')),
    pages);
  document.body.append(bg); document.body.classList.add('noscroll');
  window.addEventListener('hashchange', close);
  let zoom = 1; let doc = null; let run = 0;
  const draw = async () => {
    const me = ++run;
    pages.replaceChildren();
    const W = Math.min(window.innerWidth - 16, 1100) * zoom; const dpr = Math.min(window.devicePixelRatio || 1, zoom > 1 ? 2 : 3);
    for (let i = 1; i <= doc.numPages; i++) {
      if (!bg.isConnected || me !== run) return;
      const pg = await doc.getPage(i);
      const v1 = pg.getViewport({ scale: 1 }); const scale = (W / v1.width) * dpr; const vp = pg.getViewport({ scale });
      const cv = h('canvas', { class: 'pdfpage', width: Math.round(vp.width), height: Math.round(vp.height), style: `width:${W}px;height:${Math.round(vp.height / dpr)}px` });
      pages.append(cv, h('div', { class: 'pdfpn' }, `Page ${i} of ${doc.numPages}`));
      await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    }
  };
  try {
    const { getDocument } = await pdfjs();
    doc = await getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false }).promise;
    count.textContent = ` · ${doc.numPages} page${doc.numPages === 1 ? '' : 's'}`;
    await draw();
  } catch (e) {
    console.error(e);
    pages.replaceChildren(h('div', { class: 'notice red', style: 'margin:16px' }, 'Couldn\u2019t show this PDF here: ' + (e.message || e) + '. Use “Share / print” to open it in another app.'));
  }
}
