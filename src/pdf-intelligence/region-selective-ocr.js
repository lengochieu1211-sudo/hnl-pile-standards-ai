import {
  cropCanvasRegionToBase64,
  extractTextFromLayerRegion,
  ocrImageBase64Locally
} from '../pdf.js';
import { resolvePdfIntelligenceMode, safeError } from './contracts.js';
import {
  PDF_REGION_SCHEMA_VERSION,
  assessRegionText,
  makeRegionProvenance,
  mapCropBboxToPage
} from './region-selective-core.js';

function pageBox(canvas) {
  const box = canvas?.getBoundingClientRect?.();
  return { width: Number(box?.width) || 0, height: Number(box?.height) || 0 };
}

function textFromCandidate(candidate) {
  if (typeof candidate === 'string') return candidate;
  return String(candidate?.text || candidate?.region?.text || candidate?.pages?.[0]?.text || '');
}

function candidateLines(candidate) {
  return candidate?.ocrLines || candidate?.region?.ocrLines || candidate?.pages?.[0]?.ocrLines || [];
}

/**
 * P3 shadow-only region router.
 * Production PDF/search/OCR state is never mutated. External OCR/Vision are only
 * called when the caller explicitly injects handlers.
 */
export async function inspectSelectedPdfRegionInShadow({
  doc,
  pageNumber,
  canvas,
  textLayer,
  rect,
  mode,
  regionKind = 'auto',
  deepDocRegionOcr = null,
  visionRegionOcr = null,
  allowChromiumFallback = true
} = {}) {
  const resolvedMode = resolvePdfIntelligenceMode(mode);
  const size = pageBox(canvas);
  const report = {
    schemaVersion: PDF_REGION_SCHEMA_VERSION,
    mode: resolvedMode,
    promotionState: 'SHADOW_ONLY',
    productionMutationAllowed: false,
    page: Number(pageNumber) || 0,
    regionKind,
    routeHistory: [],
    warnings: [],
    result: null,
    provenance: null
  };
  if (resolvedMode === 'off') return { ...report, status: 'DISABLED' };
  if (!doc?.blob || !canvas || !textLayer || !rect) {
    return { ...report, status: 'BLOCK', error: { message: 'PDF document, canvas, text layer and selected rectangle are required.' } };
  }

  const nativeText = extractTextFromLayerRegion(textLayer, rect);
  const nativeQuality = assessRegionText(nativeText, { kind: regionKind });
  report.routeHistory.push({ engine: 'pdfjs-native-region', quality: nativeQuality });
  if (nativeQuality.usable) {
    report.result = { engine: 'pdfjs-native-region', text: nativeText, quality: nativeQuality };
    report.provenance = makeRegionProvenance({
      fingerprint: doc.fingerprint, page: pageNumber, pageWidth: size.width, pageHeight: size.height,
      rect, engine: 'pdfjs-native-region', route: 'native', status: 'SHADOW_RESULT', textQuality: nativeQuality
    });
    return { ...report, status: 'SHADOW_RESULT', selectedRoute: 'native' };
  }

  let crop;
  try {
    crop = cropCanvasRegionToBase64(canvas, rect);
  } catch (error) {
    return { ...report, status: 'BLOCK', error: safeError(error) };
  }

  if (typeof deepDocRegionOcr === 'function') {
    try {
      const deep = await deepDocRegionOcr(crop, {
        page: Number(pageNumber) || 0,
        fingerprint: doc.fingerprint || null,
        regionKind
      });
      if (deep?.available !== false) {
        const text = textFromCandidate(deep);
        const quality = assessRegionText(text, { kind: regionKind });
        const mappedLines = candidateLines(deep).map(line => ({
          ...line,
          pageMapping: mapCropBboxToPage({
            cropBbox: line?.bbox,
            cropWidth: crop.width,
            cropHeight: crop.height,
            sourceRect: crop.sourceRect,
            pageWidth: size.width,
            pageHeight: size.height
          })
        }));
        report.routeHistory.push({ engine: 'deepdoc-vietocr-region', quality, recognizerConfidenceUsable: false });
        if (quality.usable) {
          report.result = { engine: 'deepdoc-vietocr-region', text, quality, ocrLines: mappedLines, layouts: deep?.layouts || deep?.region?.layouts || [] };
          report.provenance = makeRegionProvenance({
            fingerprint: doc.fingerprint, page: pageNumber, pageWidth: size.width, pageHeight: size.height,
            rect: crop.sourceRect, engine: 'deepdoc-vietocr-region', route: 'deepdoc-vietocr', status: 'SHADOW_RESULT',
            textQuality: quality, crop, reportedConfidence: null, confidenceUsable: false
          });
          return { ...report, status: 'SHADOW_RESULT', selectedRoute: 'deepdoc-vietocr' };
        }
        report.warnings.push('DeepDoc/VietOCR returned text but region-quality gate did not accept it; continuing to fallback without promoting data.');
      } else {
        report.warnings.push(`DeepDoc/VietOCR unavailable: ${deep?.code || deep?.message || 'unknown'}`);
      }
    } catch (error) {
      report.warnings.push(`DeepDoc/VietOCR region error: ${safeError(error).message}`);
    }
  }

  if (allowChromiumFallback) {
    const local = await ocrImageBase64Locally(crop);
    if (local.available) {
      const quality = assessRegionText(local.text, { kind: regionKind });
      report.routeHistory.push({ engine: 'chromium-textdetector-region', quality, blocks: local.blocks });
      if (quality.usable) {
        report.result = { engine: 'chromium-textdetector-region', text: local.text, quality, blocks: local.blocks };
        report.provenance = makeRegionProvenance({
          fingerprint: doc.fingerprint, page: pageNumber, pageWidth: size.width, pageHeight: size.height,
          rect: crop.sourceRect, engine: 'chromium-textdetector-region', route: 'chromium-local-ocr', status: 'SHADOW_RESULT',
          textQuality: quality, crop
        });
        return { ...report, status: 'SHADOW_RESULT', selectedRoute: 'chromium-local-ocr' };
      }
    }
  }

  if (typeof visionRegionOcr === 'function') {
    try {
      const vision = await visionRegionOcr(crop, {
        page: Number(pageNumber) || 0,
        fingerprint: doc.fingerprint || null,
        regionKind
      });
      const text = textFromCandidate(vision);
      const quality = assessRegionText(text, { kind: regionKind });
      report.routeHistory.push({ engine: 'vision-region-fallback', quality });
      report.result = { engine: 'vision-region-fallback', text, quality };
      report.provenance = makeRegionProvenance({
        fingerprint: doc.fingerprint, page: pageNumber, pageWidth: size.width, pageHeight: size.height,
        rect: crop.sourceRect, engine: 'vision-region-fallback', route: 'vision',
        status: quality.usable ? 'SHADOW_RESULT' : 'REVIEW_WEAK_RESULT', textQuality: quality, crop,
        reportedConfidence: vision?.confidence, confidenceUsable: Boolean(vision?.confidenceUsable)
      });
      return { ...report, status: quality.usable ? 'SHADOW_RESULT' : 'REVIEW_WEAK_RESULT', selectedRoute: 'vision' };
    } catch (error) {
      report.warnings.push(`Vision region fallback error: ${safeError(error).message}`);
    }
  }

  report.provenance = makeRegionProvenance({
    fingerprint: doc.fingerprint, page: pageNumber, pageWidth: size.width, pageHeight: size.height,
    rect: crop.sourceRect, engine: 'none', route: 'block', status: 'BLOCK_NO_USABLE_TEXT', textQuality: nativeQuality, crop
  });
  return { ...report, status: 'BLOCK_NO_USABLE_TEXT', selectedRoute: 'block' };
}
