// Node-side benchmark adapter that mirrors the current HNL PDF.js text joining
// and textQuality/scannedLikely rules without importing browser-only ?url code.

function itemHeight(item) {
  return Math.max(1, Math.abs(Number(item?.height || item?.transform?.[3] || 0)) || 10);
}

function clusterTextRows(items) {
  const rows = [];
  const sorted = [...(items || [])].filter(x => String(x?.str || '').length)
    .sort((a, b) => (Number(b.transform?.[5] || 0) - Number(a.transform?.[5] || 0)) || (Number(a.transform?.[4] || 0) - Number(b.transform?.[4] || 0)));
  for (const item of sorted) {
    const y = Number(item.transform?.[5] || 0);
    const h = itemHeight(item);
    let row = rows.find(r => Math.abs(r.y - y) <= Math.max(1.5, Math.min(r.h, h) * 0.32));
    if (!row) { row = { y, h, items: [] }; rows.push(row); }
    row.items.push(item);
    row.y = (row.y * (row.items.length - 1) + y) / row.items.length;
    row.h = Math.max(row.h, h);
  }
  return rows.sort((a, b) => b.y - a.y);
}

function joinTextRow(row) {
  const items = [...row.items].sort((a, b) => Number(a.transform?.[4] || 0) - Number(b.transform?.[4] || 0));
  let out = '';
  let prev = null;
  for (const item of items) {
    const str = String(item.str || '');
    if (!str) continue;
    if (!prev) { out = str; prev = item; continue; }
    const prevStr = String(prev.str || '');
    const prevX = Number(prev.transform?.[4] || 0);
    const prevW = Math.abs(Number(prev.width || 0));
    const x = Number(item.transform?.[4] || 0);
    const gap = prevW > 0 ? x - (prevX + prevW) : Number.POSITIVE_INFINITY;
    const h = Math.max(1, Math.min(itemHeight(prev), itemHeight(item)));
    const alreadySpaced = /\s$/.test(prevStr) || /^\s/.test(str);
    const needsSpace = !alreadySpaced && (Number.isFinite(gap) ? gap > Math.max(0.9, h * 0.16) : true);
    out += `${needsSpace ? ' ' : ''}${str}`;
    prev = item;
  }
  return out.replace(/\s+/g, ' ').trim();
}

function normalizeText(items) {
  return clusterTextRows(items).map(joinTextRow).filter(Boolean).join('\n');
}

function textQuality(text = '') {
  const raw = String(text || '').trim();
  const compact = raw.replace(/\s+/g, '');
  const letters = (raw.match(/[A-Za-zÀ-ỹĐđ]/g) || []).length;
  const singleGlyphTokens = (raw.match(/(?:^|\s)[A-Za-zÀ-ỹĐđ](?=\s|$)/g) || []).length;
  const tokens = raw.split(/\s+/).filter(Boolean).length;
  return {
    chars: raw.length,
    compactChars: compact.length,
    alphaRatio: raw.length ? letters / raw.length : 0,
    splitGlyphRatio: tokens ? singleGlyphTokens / tokens : 0,
    usable: raw.length >= 24 && (letters >= 12 || /\d/.test(raw)) && !(tokens >= 20 && singleGlyphTokens / tokens > 0.7)
  };
}

export async function inspectWithHnlPdfJs(bytes) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const started = performance.now();
  const task = pdfjsLib.getDocument({ data: array, isEvalSupported: false, useWorkerFetch: false });
  const pdf = await task.promise;
  const pages = [];
  let textChars = 0;
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = normalizeText(content.items || []);
    const quality = textQuality(text);
    pages.push({ page: pageNumber, text, textQuality: quality });
    textChars += text.length;
  }
  const usablePages = pages.filter(page => page.textQuality.usable).length;
  const scannedLikely = textChars < Math.max(120, pdf.numPages * 35) || usablePages < Math.max(2, Math.ceil(pdf.numPages * 0.35));
  let pdfType = 'TextBased';
  if (usablePages === 0 || textChars === 0) pdfType = 'Scanned';
  else if (scannedLikely || usablePages < pdf.numPages) pdfType = 'Mixed';
  return {
    engine: 'hnl-pdfjs-baseline',
    pageCount: pdf.numPages,
    pdfType,
    scannedLikely,
    usablePages,
    pagesNeedingOcr: pages.filter(page => !page.textQuality.usable).map(page => page.page),
    textChars,
    elapsedMs: Number((performance.now() - started).toFixed(3)),
    pages
  };
}
