import assert from 'node:assert/strict';
import {
  assessRegionText,
  chooseInitialRegionRoute,
  chooseFallbackAfterCandidate,
  effectiveConfidence,
  makeRegionProvenance,
  mapCropBboxToPage,
  normalizeRegionRect
} from '../src/pdf-intelligence/region-selective-core.js';

let passed = 0;
function ok(fn) { fn(); passed++; }

ok(() => assert.equal(assessRegionText('TCVN 10304:2025 Điều 7.2.3').usable, true));
ok(() => assert.equal(assessRegionText('C ọ c c h ố n g').usable, false));
ok(() => assert.equal(chooseInitialRegionRoute({ nativeText: 'Bảng 6', deepDocAvailable: true }).route, 'native'));
ok(() => assert.equal(chooseInitialRegionRoute({ nativeText: '', deepDocAvailable: true }).route, 'deepdoc-vietocr'));
ok(() => assert.equal(chooseInitialRegionRoute({ nativeText: '', chromiumLocalOcrAvailable: true }).route, 'chromium-local-ocr'));
ok(() => assert.equal(chooseInitialRegionRoute({ nativeText: '', visionAvailable: true }).route, 'vision'));
ok(() => assert.equal(chooseFallbackAfterCandidate({ candidateText: '', nextLocalAvailable: false, visionAvailable: true }).route, 'vision'));
ok(() => assert.deepEqual(normalizeRegionRect({ x: -5, y: 10, width: 500, height: 90 }, { width: 200, height: 100 }), { x: 0, y: 10, width: 200, height: 90 }));
ok(() => {
  const mapped = mapCropBboxToPage({
    cropBbox: [25, 20, 75, 80], cropWidth: 100, cropHeight: 100,
    sourceRect: { x: 100, y: 200, width: 200, height: 100 }, pageWidth: 1000, pageHeight: 1000
  });
  assert.deepEqual(mapped.cssBbox, [150, 220, 250, 280]);
  assert.deepEqual(mapped.normalizedBbox, [0.15, 0.22, 0.25, 0.28]);
});
ok(() => assert.equal(effectiveConfidence({ engine: 'deepdoc-vietocr-region', reportedConfidence: 1, confidenceUsable: true }), null));
ok(() => {
  const p = makeRegionProvenance({
    fingerprint: 'abc', page: 3, pageWidth: 1000, pageHeight: 2000,
    rect: { x: 100, y: 200, width: 300, height: 400 }, engine: 'pdfjs-native-region', route: 'native', status: 'SHADOW_RESULT'
  });
  assert.equal(p.productionMutationAllowed, false);
  assert.equal(p.promotionState, 'SHADOW_ONLY');
  assert.deepEqual(p.normalizedBbox, [0.1, 0.1, 0.4, 0.3]);
});

assert.equal(passed, 11);
console.log(`PDF INTELLIGENCE P3 REGION GOLDEN: PASS · ${passed}/11`);
