import assert from 'node:assert/strict';
import {
  PDF_INTELLIGENCE_DEFAULT_MODE,
  classificationFromHnlDoc,
  compareClassifications,
  normalizePdfType,
  resolvePdfIntelligenceMode
} from '../src/pdf-intelligence/contracts.js';
import { createFirecrawlPdfInspector } from '../src/pdf-intelligence/firecrawl-adapter.js';

assert.equal(PDF_INTELLIGENCE_DEFAULT_MODE, 'off');
assert.equal(resolvePdfIntelligenceMode(undefined), 'off');
assert.equal(resolvePdfIntelligenceMode('shadow'), 'shadow');
assert.equal(resolvePdfIntelligenceMode('production'), 'off');
assert.equal(normalizePdfType('text_based'), 'TextBased');
assert.equal(normalizePdfType('ImageBased'), 'ImageBased');

const baseline = classificationFromHnlDoc({
  pageCount: 2,
  textChars: 240,
  scannedLikely: false,
  pages: [
    { page: 1, text: 'TCVN text', textQuality: { usable: true } },
    { page: 2, text: 'More text', textQuality: { usable: true } }
  ]
});
assert.equal(baseline.pdfType, 'TextBased');
assert.deepEqual(baseline.pagesNeedingOcr, []);
const comparison = compareClassifications(baseline, { pdfType: 'TextBased', pageCount: 2, pagesNeedingOcr: [] });
assert.equal(comparison.pageCountMatch, true);
assert.equal(comparison.typeMatch, true);
assert.equal(comparison.ocrPageJaccard, 1);

// Missing optional dependency is an expected controlled state, never a crash.
const adapter = await createFirecrawlPdfInspector({ runtime: 'node' });
assert.equal(typeof adapter.available, 'boolean');
if (!adapter.available) assert.ok(adapter.error?.message);

console.log('PDF INTELLIGENCE SELFTEST: PASS');
console.log(JSON.stringify({ modeDefault: PDF_INTELLIGENCE_DEFAULT_MODE, firecrawlAvailable: adapter.available, packageName: adapter.packageName }, null, 2));
