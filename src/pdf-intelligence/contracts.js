export const PDF_INTELLIGENCE_SCHEMA_VERSION = 1;
export const PDF_INTELLIGENCE_DEFAULT_MODE = 'off';
export const PDF_INTELLIGENCE_MODES = Object.freeze(['off', 'shadow']);

export function normalizePdfType(value) {
  const key = String(value || '').replace(/[\s_-]+/g, '').toLowerCase();
  if (key === 'textbased' || key === 'text') return 'TextBased';
  if (key === 'scanned' || key === 'scan') return 'Scanned';
  if (key === 'imagebased' || key === 'image') return 'ImageBased';
  if (key === 'mixed') return 'Mixed';
  return 'Unknown';
}

export function resolvePdfIntelligenceMode(explicitMode) {
  const raw = explicitMode ?? globalThis?.HNL_PDF_INTELLIGENCE_MODE ?? PDF_INTELLIGENCE_DEFAULT_MODE;
  const normalized = String(raw || '').trim().toLowerCase();
  return PDF_INTELLIGENCE_MODES.includes(normalized) ? normalized : PDF_INTELLIGENCE_DEFAULT_MODE;
}

export function classificationFromHnlDoc(doc = {}) {
  const pages = Array.isArray(doc.pages) ? doc.pages : [];
  const usable = pages.filter(page => page?.textQuality?.usable).length;
  const total = Number(doc.pageCount || pages.length || 0);
  const textChars = Number(doc.textChars || pages.reduce((sum, page) => sum + String(page?.text || '').length, 0));
  let pdfType = 'Unknown';
  if (total > 0) {
    if (usable === 0 || textChars === 0) pdfType = 'Scanned';
    else if (doc.scannedLikely) pdfType = usable < total ? 'Mixed' : 'Scanned';
    else pdfType = usable < total ? 'Mixed' : 'TextBased';
  }
  return {
    engine: 'hnl-pdfjs-current',
    pdfType,
    pageCount: total,
    pagesNeedingOcr: pages.filter(page => !page?.textQuality?.usable).map(page => Number(page.page)).filter(Number.isFinite),
    confidence: null,
    textChars,
    basis: 'Derived from current HNL parsePdf textQuality/scannedLikely fields; does not replace production classification.'
  };
}

export function makePageProvenance({ page, source, confidence = null, bbox = null, needsOcr = false, ocrReason = null } = {}) {
  return {
    page: Number(page) || 0,
    source: String(source || 'unknown'),
    confidence: Number.isFinite(Number(confidence)) ? Number(confidence) : null,
    bbox: Array.isArray(bbox) && bbox.length === 4 ? bbox.map(Number) : null,
    needsOcr: Boolean(needsOcr),
    ocrReason: ocrReason ? String(ocrReason) : null
  };
}

export function compareClassifications(hnl, candidate) {
  const left = hnl || {};
  const right = candidate || {};
  const pageCountMatch = Number(left.pageCount || 0) === Number(right.pageCount || 0);
  const typeMatch = normalizePdfType(left.pdfType) === normalizePdfType(right.pdfType);
  const leftOcr = new Set((left.pagesNeedingOcr || []).map(Number));
  const rightOcr = new Set((right.pagesNeedingOcr || []).map(Number));
  const union = new Set([...leftOcr, ...rightOcr]);
  const intersection = [...leftOcr].filter(page => rightOcr.has(page));
  const ocrPageJaccard = union.size ? intersection.length / union.size : 1;
  return {
    pageCountMatch,
    typeMatch,
    ocrPageJaccard: Number(ocrPageJaccard.toFixed(6)),
    hnlType: normalizePdfType(left.pdfType),
    candidateType: normalizePdfType(right.pdfType)
  };
}

export function safeError(error) {
  return {
    name: String(error?.name || 'Error'),
    code: error?.code ? String(error.code) : null,
    message: String(error?.message || error || 'Unknown error').slice(0, 1200)
  };
}
