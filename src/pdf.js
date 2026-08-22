import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

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
  for (const p of patterns) {
    const m = combined.match(p);
    if (m) return m[0].replace(/\s+/g, ' ').trim();
  }
  return filename.replace(/\.pdf$/i, '');
}

export async function parsePdf(file, onProgress = () => {}) {
  const data = await file.arrayBuffer();
  const task = pdfjsLib.getDocument({ data });
  const pdf = await task.promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push({ page: i, text: normalizeText(content.items) });
    onProgress(i, pdf.numPages);
  }
  const firstText = pages.slice(0, 3).map(p => p.text).join('\n');
  return {
    id: crypto.randomUUID(),
    name: file.name,
    standard: detectStandard(firstText, file.name),
    pageCount: pdf.numPages,
    size: file.size,
    type: file.type || 'application/pdf',
    createdAt: new Date().toISOString(),
    blob: file,
    pages
  };
}

export async function renderPdfPage(blob, pageNumber, canvas, scale = 1.2) {
  const data = await blob.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const safePage = Math.min(Math.max(1, pageNumber), pdf.numPages);
  const page = await pdf.getPage(safePage);
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * ratio);
  canvas.height = Math.floor(viewport.height * ratio);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  await page.render({ canvasContext: context, viewport }).promise;
  return pdf.numPages;
}
