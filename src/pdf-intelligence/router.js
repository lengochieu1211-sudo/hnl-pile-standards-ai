import {
  PDF_INTELLIGENCE_SCHEMA_VERSION,
  classificationFromHnlDoc,
  compareClassifications,
  resolvePdfIntelligenceMode,
  safeError
} from './contracts.js';
import { createFirecrawlPdfInspector } from './firecrawl-adapter.js';

async function sha256Hex(bytes) {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', array);
    return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  return null;
}

/**
 * Shadow-only PDF intelligence probe.
 * It NEVER mutates the current HNL document and NEVER changes OCR/search routing.
 * v1.26 production behavior therefore remains the source of truth.
 */
export async function inspectPdfInShadow({ file, currentDoc, mode, runtime = 'auto' } = {}) {
  const resolvedMode = resolvePdfIntelligenceMode(mode);
  const baseline = classificationFromHnlDoc(currentDoc || {});
  const report = {
    schemaVersion: PDF_INTELLIGENCE_SCHEMA_VERSION,
    mode: resolvedMode,
    promotionState: 'SHADOW_ONLY',
    productionMutationAllowed: false,
    baseline,
    candidate: null,
    comparison: null,
    fingerprint: currentDoc?.fingerprint || null,
    warnings: []
  };
  if (resolvedMode === 'off') return { ...report, status: 'DISABLED' };
  if (!file?.arrayBuffer) return { ...report, status: 'BLOCK', error: { message: 'PDF File/Blob is required.' } };

  try {
    const buffer = await file.arrayBuffer();
    report.fingerprint ||= await sha256Hex(buffer);
    const adapter = await createFirecrawlPdfInspector({ runtime });
    report.adapter = {
      available: adapter.available,
      runtime: adapter.runtime,
      packageName: adapter.packageName,
      capabilities: adapter.capabilities
    };
    if (!adapter.available) {
      return { ...report, status: 'DEPENDENCY_NOT_INSTALLED', error: adapter.error };
    }
    const candidate = await adapter.classify(buffer);
    report.candidate = candidate;
    report.comparison = compareClassifications(baseline, candidate);
    return { ...report, status: 'SHADOW_RESULT' };
  } catch (error) {
    return { ...report, status: 'BLOCK', error: safeError(error) };
  }
}
