import type jsPDF from 'jspdf';

/**
 * Thai-capable font for jsPDF exports.
 * The built-in Helvetica (and Poppins) have no Thai glyphs, so Thai text came out
 * garbled. Sarabun (OFL, served from /public/fonts) covers Thai + Latin.
 */
export const PDF_FONT = 'Sarabun';

let fontDataPromise: Promise<{ regular: string; bold: string } | null> | null = null;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(out);
}

function loadFontData() {
  if (!fontDataPromise) {
    fontDataPromise = Promise.all([
      fetch('/fonts/Sarabun-Regular.ttf'),
      fetch('/fonts/Sarabun-Bold.ttf'),
    ])
      .then(async ([regular, bold]) => {
        if (!regular.ok || !bold.ok) return null;
        return { regular: toBase64(await regular.arrayBuffer()), bold: toBase64(await bold.arrayBuffer()) };
      })
      .catch(() => null)
      .then((data) => {
        if (!data) fontDataPromise = null; // allow a retry on the next export
        return data;
      });
  }
  return fontDataPromise;
}

/**
 * Register Sarabun on the document. Returns the font name to use, or
 * 'helvetica' if the font files could not be loaded.
 */
export async function ensureThaiFont(doc: jsPDF): Promise<string> {
  const data = await loadFontData();
  if (!data) return 'helvetica';
  doc.addFileToVFS('Sarabun-Regular.ttf', data.regular);
  doc.addFileToVFS('Sarabun-Bold.ttf', data.bold);
  doc.addFont('Sarabun-Regular.ttf', PDF_FONT, 'normal');
  doc.addFont('Sarabun-Bold.ttf', PDF_FONT, 'bold');
  doc.setFont(PDF_FONT, 'normal');
  return PDF_FONT;
}

/* ── Poppins (the app's font) with Sarabun for Thai ─────────────────────── */
export const PDF_LATIN = 'Poppins';
let poppinsPromise: Promise<{ regular: string; bold: string } | null> | null = null;
function loadPoppins() {
  if (!poppinsPromise) {
    poppinsPromise = Promise.all([fetch('/fonts/Poppins-Regular.ttf'), fetch('/fonts/Poppins-SemiBold.ttf')])
      .then(async ([r, b]) => (r.ok && b.ok ? { regular: toBase64(await r.arrayBuffer()), bold: toBase64(await b.arrayBuffer()) } : null))
      .catch(() => null)
      .then((d) => { if (!d) poppinsPromise = null; return d; });
  }
  return poppinsPromise;
}
export const hasThai = (s: unknown) => /[฀-๿]/.test(String(s ?? ''));

/**
 * Register Poppins (Latin) and Sarabun (Thai) on the document.
 * `fontFor(text)` picks Sarabun for text with Thai letters (Poppins has none), else Poppins.
 */
export async function ensurePoppinsFont(doc: jsPDF): Promise<{ latin: string; thai: string; fontFor: (text: unknown) => string }> {
  const [poppins, thai] = await Promise.all([loadPoppins(), ensureThaiFont(doc)]);
  let latin = thai;
  if (poppins) {
    doc.addFileToVFS('Poppins-Regular.ttf', poppins.regular);
    doc.addFileToVFS('Poppins-SemiBold.ttf', poppins.bold);
    doc.addFont('Poppins-Regular.ttf', PDF_LATIN, 'normal');
    doc.addFont('Poppins-SemiBold.ttf', PDF_LATIN, 'bold');
    latin = PDF_LATIN;
  }
  doc.setFont(latin, 'normal');
  return { latin, thai, fontFor: (text) => (hasThai(text) ? thai : latin) };
}
