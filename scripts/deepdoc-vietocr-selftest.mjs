import assert from 'node:assert/strict';
import { normalizeDeepDocResult, createDeepDocVietOcrAdapter } from '../src/pdf-intelligence/deepdoc-vietocr-adapter.js';

const fixture = normalizeDeepDocResult({
  sourcePageCount: 2,
  elapsedMs: 125.5,
  threshold: 0.5,
  pages: [{
    page: 2,
    width: 1000,
    height: 1400,
    text: 'TCVN 10304:2025\nBảng 6',
    ocrLines: [{ text: 'TCVN 10304:2025', bbox: [1, 2, 100, 20], score: 1, scoreSemantics: 'synthetic-current-deepdoc-vietocr' }],
    layouts: [
      { type: 'Title', bbox: [0, 0, 200, 30], score: 0.9 },
      { type: 'Table', bbox: [0, 100, 900, 700], score: 0.8 },
      { type: 'Equation', bbox: [100, 800, 700, 900], score: 0.75 }
    ],
    tableStructures: [{ bbox: [0, 100, 900, 700], components: [] }]
  }]
});

assert.equal(fixture.engine, 'deepdoc-vietocr-external');
assert.equal(fixture.sourcePageCount, 2);
assert.deepEqual(fixture.processedPages, [2]);
assert.equal(fixture.tableRegionCount, 1);
assert.equal(fixture.equationRegionCount, 1);
assert.equal(fixture.recognizerConfidenceUsable, false);
assert.match(fixture.recognizerConfidenceReason, /score=1\.0/);
assert.deepEqual(fixture.pages[0].ocrLines[0].bbox, [1, 2, 100, 20]);

// Missing external clone must be a controlled unavailable state, never a crash.
const adapter = await createDeepDocVietOcrAdapter({ deepdocHome: '/definitely/not/installed/hnl-deepdoc' });
assert.equal(adapter.available, false);
assert.equal(adapter.capabilities.calibratedOcrConfidence, false);

console.log('DEEPDOC VIETOCR SHADOW SELFTEST: PASS');
console.log(JSON.stringify({ available: adapter.available, health: adapter.health, confidenceUsable: fixture.recognizerConfidenceUsable }, null, 2));
