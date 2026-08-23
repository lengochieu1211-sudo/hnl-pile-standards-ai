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

/**
 * Build a lightweight selectable text overlay aligned to the rendered PDF page.
 * It is intentionally independent from pdf_viewer.js so Desktop/Web use the
 * same legacy-safe PDF.js API without pulling the full viewer bundle.
 */
export async function renderPdfTextLayer(doc, pageNumber, layer, scale = 1.2) {
  if (!doc?.blob || !layer) return { items:0, text:'' };
  const pdf = await getPdf(doc);
  const safePage = Math.min(Math.max(1, Number(pageNumber) || 1), pdf.numPages);
  const page = await pdf.getPage(safePage);
  const viewport = page.getViewport({ scale });
  const content = await page.getTextContent();
  layer.replaceChildren();
  layer.style.width = `${viewport.width}px`;
  layer.style.height = `${viewport.height}px`;
  layer.dataset.page = String(safePage);
  let visibleItems = 0;
  for (const item of content.items || []) {
    const text = String(item.str || '');
    if (!text.trim()) continue;
    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform || [1,0,0,1,0,0]);
    const angle = Math.atan2(tx[1], tx[0]);
    const fontHeight = Math.max(1, Math.hypot(tx[2], tx[3]));
    const span = document.createElement('span');
    span.textContent = text;
    span.style.left = `${tx[4]}px`;
    span.style.top = `${tx[5] - fontHeight}px`;
    span.style.fontSize = `${fontHeight}px`;
    span.style.fontFamily = 'sans-serif';
    span.style.transformOrigin = '0 0';
    span.style.transform = angle ? `rotate(${angle}rad)` : 'none';
    span.dataset.pdfText = '1';
    layer.appendChild(span);
    visibleItems++;
  }
  return { items:visibleItems, text:normalizeText(content.items || []) };
}

/**
 * Crop only the user-selected rectangle from an already rendered PDF canvas.
 * Rectangle coordinates are CSS pixels relative to the canvas box.
 * The output is capped so OCR/Vision never receives a full oversized page by accident.
 */
export function cropCanvasRegionToBase64(canvas, rect, { maxPixels = 1_800_000, quality = 0.88 } = {}) {
  if (!canvas || !rect) throw new Error('Chưa có vùng PDF để quét.');
  const box = canvas.getBoundingClientRect();
  const cssW = Math.max(1, box.width);
  const cssH = Math.max(1, box.height);
  const sxRatio = canvas.width / cssW;
  const syRatio = canvas.height / cssH;
  let x = Math.max(0, Math.min(cssW, Number(rect.x) || 0));
  let y = Math.max(0, Math.min(cssH, Number(rect.y) || 0));
  let w = Math.max(1, Math.min(cssW - x, Number(rect.width) || 0));
  let h = Math.max(1, Math.min(cssH - y, Number(rect.height) || 0));
  if (w < 8 || h < 8) throw new Error('Vùng chọn quá nhỏ.');
  const sx = Math.round(x * sxRatio);
  const sy = Math.round(y * syRatio);
  const sw = Math.max(1, Math.round(w * sxRatio));
  const sh = Math.max(1, Math.round(h * syRatio));
  let outW = sw, outH = sh;
  const pixels = outW * outH;
  if (pixels > maxPixels) {
    const shrink = Math.sqrt(maxPixels / pixels);
    outW = Math.max(1, Math.round(outW * shrink));
    outH = Math.max(1, Math.round(outH * shrink));
  }
  const out = document.createElement('canvas');
  out.width = outW; out.height = outH;
  const ctx = out.getContext('2d', { alpha:false });
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,outW,outH);
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, outW, outH);
  const url = out.toDataURL('image/jpeg', quality);
  return {
    mimeType:'image/jpeg',
    data:url.split(',')[1] || '',
    width:outW,
    height:outH,
    sourceRect:{ x, y, width:w, height:h },
    sourcePixels:sw*sh,
    outputPixels:outW*outH
  };
}

/**
 * Read only text-layer spans whose visual boxes intersect the selected region.
 * Region coordinates are CSS pixels relative to the rendered PDF page/canvas.
 */
export function extractTextFromLayerRegion(layer, rect) {
  if (!layer || !rect) return '';
  const layerBox = layer.getBoundingClientRect();
  if (!layerBox.width || !layerBox.height) return '';
  const rx1 = layerBox.left + Math.max(0, Number(rect.x) || 0);
  const ry1 = layerBox.top + Math.max(0, Number(rect.y) || 0);
  const rx2 = rx1 + Math.max(0, Number(rect.width) || 0);
  const ry2 = ry1 + Math.max(0, Number(rect.height) || 0);
  const rows = [];
  for (const span of layer.querySelectorAll('[data-pdf-text="1"]')) {
    const b = span.getBoundingClientRect();
    const ix = Math.max(0, Math.min(rx2, b.right) - Math.max(rx1, b.left));
    const iy = Math.max(0, Math.min(ry2, b.bottom) - Math.max(ry1, b.top));
    const overlap = ix * iy;
    if (!overlap) continue;
    const text = String(span.textContent || '').trim();
    if (!text) continue;
    rows.push({ text, x:b.left, y:b.top, h:b.height });
  }
  if (!rows.length) return '';
  rows.sort((a,b) => Math.abs(a.y-b.y) > Math.max(3, Math.min(a.h,b.h)*0.55) ? a.y-b.y : a.x-b.x);
  const out = [];
  let lastY = null;
  for (const item of rows) {
    if (lastY == null || Math.abs(item.y-lastY) > Math.max(4, item.h*0.65)) out.push(item.text);
    else out[out.length-1] += ` ${item.text}`;
    lastY = item.y;
  }
  return out.join('\n').replace(/[ \t]+/g,' ').trim();
}

/**
 * Best-effort local OCR using Chromium's TextDetector when available.
 * No network request is made. Callers may explicitly offer Vision AI only
 * when this local step is unavailable or too weak.
 */
export async function ocrImageBase64Locally(image) {
  if (!image?.data || !('TextDetector' in globalThis) || typeof createImageBitmap !== 'function') {
    return { available:false, text:'', blocks:0 };
  }
  try {
    const binary = atob(image.data);
    const bytes = new Uint8Array(binary.length);
    for (let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type:image.mimeType || 'image/jpeg' });
    const bitmap = await createImageBitmap(blob);
    const detector = new globalThis.TextDetector();
    const blocks = await detector.detect(bitmap);
    bitmap.close?.();
    const text = (blocks || []).map(x => String(x.rawValue || '').trim()).filter(Boolean).join('\n').trim();
    return { available:true, text, blocks:(blocks || []).length };
  } catch (error) {
    return { available:true, text:'', blocks:0, error:String(error?.message || error) };
  }
}
