import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
const pdfCache = new Map();
const activeRenderTasks = new WeakMap();

function normalizeText(items) {
  if (!items?.length) return '';
  const rows = new Map();
  for (const item of items) {
    const y = Math.round(item.transform?.[5] || 0);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push(item);
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, row]) => row
      .sort((a, b) => (a.transform?.[4] || 0) - (b.transform?.[4] || 0))
      .map(x => x.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim())
    .filter(Boolean)
    .join('\n');
}

export function detectStandard(text, filename = '') {
  const combined = `${filename}\n${text}`;
  const patterns = [
    /\bTCVN\s*\d+(?:-\d+)?\s*:\s*\d{4}\b/i,
    /\bQCVN\s*\d+(?:[:\/]\d+)?[^\n]{0,20}\b/i,
    /\bASTM\s+[A-Z]\s*\d+[A-Z]?(?:[-:]\d{2,4})?\b/i,
    /\bBS\s+EN\s+\d+(?:[-:]\d+)*\b/i,
    /\bEN\s+\d+(?:[-:]\d+)*\b/i,
    /\bJIS\s+[A-Z]\s*\d+\b/i
  ];
  for (const pattern of patterns) {
    const match = combined.match(pattern);
    if (match) return match[0].replace(/\s+/g, ' ').trim();
  }
  return filename.replace(/\.pdf$/i, '') || 'Tài liệu PDF';
}

async function sha256Hex(buffer) {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function parsePdf(file, onProgress = () => {}) {
  const data = await file.arrayBuffer();
  const fingerprint = await sha256Hex(data.slice(0));
  const task = pdfjsLib.getDocument({ data });
  const pdf = await task.promise;
  const pages = [];
  let totalChars = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = normalizeText(content.items);
    totalChars += text.length;
    pages.push({ page: i, text });
    onProgress(i, pdf.numPages);
  }
  const firstText = pages.slice(0, 4).map(p => p.text).join('\n');
  const doc = {
    id: crypto.randomUUID(),
    fingerprint,
    name: file.name,
    standard: detectStandard(firstText, file.name),
    pageCount: pdf.numPages,
    size: file.size,
    type: file.type || 'application/pdf',
    createdAt: new Date().toISOString(),
    blob: file,
    textChars: totalChars,
    scannedLikely: totalChars < Math.max(120, pdf.numPages * 35),
    pages
  };
  pdfCache.set(doc.id, pdf);
  return doc;
}

async function getPdf(doc) {
  if (pdfCache.has(doc.id)) return pdfCache.get(doc.id);
  const data = await doc.blob.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  pdfCache.set(doc.id, pdf);
  return pdf;
}

export async function renderPdfPage(doc, pageNumber, canvas, scale = 1.2) {
  if (!doc?.blob) throw new Error('PDF không còn dữ liệu gốc trong thư viện cục bộ.');
  const pdf = await getPdf(doc);
  const safePage = Math.min(Math.max(1, Number(pageNumber) || 1), pdf.numPages);
  const page = await pdf.getPage(safePage);
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext('2d', { alpha: false });
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(viewport.width * ratio);
  canvas.height = Math.floor(viewport.height * ratio);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.fillStyle = '#fff';
  context.fillRect(0, 0, viewport.width, viewport.height);
  const previousTask = activeRenderTasks.get(canvas);
  if (previousTask) {
    try { previousTask.cancel(); } catch { /* noop */ }
  }
  const renderTask = page.render({ canvasContext: context, viewport });
  activeRenderTasks.set(canvas, renderTask);
  try {
    await renderTask.promise;
  } catch (error) {
    if (error?.name !== 'RenderingCancelledException') throw error;
  } finally {
    // Mỗi canvas có render task riêng để chế độ cuộn liên tục có thể
    // hiển thị nhiều trang song song mà không hủy lẫn nhau.
    if (activeRenderTasks.get(canvas) === renderTask) activeRenderTasks.delete(canvas);
  }
  return pdf.numPages;
}

export function clearPdfCache(docId) {
  const pdf = pdfCache.get(docId);
  try { pdf?.destroy?.(); } catch { /* noop */ }
  pdfCache.delete(docId);
}


/** Render one PDF page to a compressed JPEG base64 payload for local Vision/OCR. */
export async function renderPdfPageToBase64(doc, pageNumber, scale = 1.7) {
  if (!doc?.blob) throw new Error('PDF không còn dữ liệu gốc để OCR.');
  const pdf = await getPdf(doc);
  const safePage = Math.min(Math.max(1, Number(pageNumber) || 1), pdf.numPages);
  const page = await pdf.getPage(safePage);
  let viewport = page.getViewport({ scale });
  // Avoid huge images that can exhaust RAM/VRAM on long technical standards.
  const maxPixels = 4_500_000;
  const pixels = viewport.width * viewport.height;
  if (pixels > maxPixels) viewport = page.getViewport({ scale: scale * Math.sqrt(maxPixels / pixels) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d', { alpha:false });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext:ctx, viewport }).promise;
  const url = canvas.toDataURL('image/jpeg', 0.86);
  return { page:safePage, mimeType:'image/jpeg', data:url.split(',')[1] || '' };
}
