export const PDF_REGION_SCHEMA_VERSION = 1;
export const PDF_REGION_PROMOTION_STATE = 'SHADOW_ONLY';

export function normalizeRegionRect(rect = {}, bounds = null) {
  let x = Number(rect.x) || 0;
  let y = Number(rect.y) || 0;
  let width = Math.max(0, Number(rect.width) || 0);
  let height = Math.max(0, Number(rect.height) || 0);
  if (bounds) {
    const maxW = Math.max(0, Number(bounds.width) || 0);
    const maxH = Math.max(0, Number(bounds.height) || 0);
    x = Math.max(0, Math.min(maxW, x));
    y = Math.max(0, Math.min(maxH, y));
    width = Math.max(0, Math.min(maxW - x, width));
    height = Math.max(0, Math.min(maxH - y, height));
  }
  return { x, y, width, height };
}

export function assessRegionText(text = '', { kind = 'auto' } = {}) {
  const raw = String(text || '').replace(/\r/g, '').trim();
  const compact = raw.replace(/\s+/g, '');
  const alnum = (raw.match(/[0-9A-Za-zÀ-ỹĐđ]/g) || []).length;
  const math = (raw.match(/[=+\-×÷*/^%Σ∑√γΓφΦηξλμρσπτθδΔ≤≥≈<>()[\]{}]/g) || []).length;
  const replacement = (raw.match(/�/g) || []).length;
  const tokens = raw.split(/\s+/).filter(Boolean);
  const singleGlyphTokens = tokens.filter(token => /^[0-9A-Za-zÀ-ỹĐđ]$/.test(token)).length;
  const splitGlyphRatio = tokens.length ? singleGlyphTokens / tokens.length : 0;
  const signal = alnum + math;
  const signalRatio = compact.length ? signal / compact.length : 0;
  const replacementRatio = compact.length ? replacement / compact.length : 0;
  const suspiciousSplit = tokens.length >= 8 && splitGlyphRatio > 0.72;
  const usable = compact.length >= 2
    && signal >= Math.min(2, compact.length)
    && signalRatio >= 0.35
    && replacementRatio <= 0.08
    && !suspiciousSplit;
  return {
    kind,
    chars: raw.length,
    compactChars: compact.length,
    alnum,
    math,
    signalRatio: Number(signalRatio.toFixed(6)),
    replacementRatio: Number(replacementRatio.toFixed(6)),
    splitGlyphRatio: Number(splitGlyphRatio.toFixed(6)),
    suspiciousSplit,
    usable,
    text: raw
  };
}

export function chooseInitialRegionRoute({
  nativeText = '',
  regionKind = 'auto',
  deepDocAvailable = false,
  chromiumLocalOcrAvailable = false,
  visionAvailable = false
} = {}) {
  const nativeQuality = assessRegionText(nativeText, { kind: regionKind });
  if (nativeQuality.usable) return { route: 'native', nativeQuality };
  if (deepDocAvailable) return { route: 'deepdoc-vietocr', nativeQuality };
  if (chromiumLocalOcrAvailable) return { route: 'chromium-local-ocr', nativeQuality };
  if (visionAvailable) return { route: 'vision', nativeQuality };
  return { route: 'block', nativeQuality };
}

export function chooseFallbackAfterCandidate({
  candidateText = '',
  regionKind = 'auto',
  nextLocalAvailable = false,
  visionAvailable = false
} = {}) {
  const candidateQuality = assessRegionText(candidateText, { kind: regionKind });
  if (candidateQuality.usable) return { accepted: true, route: 'accept', candidateQuality };
  if (nextLocalAvailable) return { accepted: false, route: 'chromium-local-ocr', candidateQuality };
  if (visionAvailable) return { accepted: false, route: 'vision', candidateQuality };
  return { accepted: false, route: 'block', candidateQuality };
}

export function mapCropBboxToPage({ cropBbox, cropWidth, cropHeight, sourceRect, pageWidth, pageHeight } = {}) {
  if (!Array.isArray(cropBbox) || cropBbox.length !== 4) return null;
  const cw = Number(cropWidth) || 0;
  const ch = Number(cropHeight) || 0;
  const pw = Number(pageWidth) || 0;
  const ph = Number(pageHeight) || 0;
  if (cw <= 0 || ch <= 0 || pw <= 0 || ph <= 0) return null;
  const src = normalizeRegionRect(sourceRect, { width: pw, height: ph });
  const [x0, y0, x1, y1] = cropBbox.map(Number);
  if (![x0, y0, x1, y1].every(Number.isFinite)) return null;
  const css = [
    src.x + (x0 / cw) * src.width,
    src.y + (y0 / ch) * src.height,
    src.x + (x1 / cw) * src.width,
    src.y + (y1 / ch) * src.height
  ];
  const normalized = [css[0] / pw, css[1] / ph, css[2] / pw, css[3] / ph]
    .map(value => Number(Math.max(0, Math.min(1, value)).toFixed(8)));
  return {
    cssBbox: css.map(value => Number(value.toFixed(4))),
    normalizedBbox: normalized
  };
}

export function effectiveConfidence({ engine, reportedConfidence, confidenceUsable = true } = {}) {
  const value = Number(reportedConfidence);
  if (!confidenceUsable || String(engine || '').includes('deepdoc-vietocr')) return null;
  return Number.isFinite(value) ? value : null;
}

export function makeRegionProvenance({
  fingerprint = null,
  page = 0,
  pageWidth = 0,
  pageHeight = 0,
  rect,
  engine = 'unknown',
  route = 'unknown',
  status = 'REVIEW',
  textQuality = null,
  crop = null,
  reportedConfidence = null,
  confidenceUsable = true
} = {}) {
  const pageRect = normalizeRegionRect(rect, { width: pageWidth, height: pageHeight });
  const normalizedBbox = pageWidth > 0 && pageHeight > 0 ? [
    pageRect.x / pageWidth,
    pageRect.y / pageHeight,
    (pageRect.x + pageRect.width) / pageWidth,
    (pageRect.y + pageRect.height) / pageHeight
  ].map(v => Number(Math.max(0, Math.min(1, v)).toFixed(8))) : null;
  return {
    schemaVersion: PDF_REGION_SCHEMA_VERSION,
    promotionState: PDF_REGION_PROMOTION_STATE,
    productionMutationAllowed: false,
    fingerprint: fingerprint || null,
    page: Number(page) || 0,
    pageSizeCss: { width: Number(pageWidth) || 0, height: Number(pageHeight) || 0 },
    pageRectCss: pageRect,
    normalizedBbox,
    engine: String(engine || 'unknown'),
    route: String(route || 'unknown'),
    status: String(status || 'REVIEW'),
    confidence: effectiveConfidence({ engine, reportedConfidence, confidenceUsable }),
    confidenceUsable: Boolean(confidenceUsable) && !String(engine || '').includes('deepdoc-vietocr'),
    textQuality,
    crop: crop ? {
      width: Number(crop.width) || null,
      height: Number(crop.height) || null,
      outputPixels: Number(crop.outputPixels) || null
    } : null
  };
}
