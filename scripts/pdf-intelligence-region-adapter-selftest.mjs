import assert from 'node:assert/strict';
import { createDeepDocVietOcrAdapter } from '../src/pdf-intelligence/deepdoc-vietocr-adapter.js';
import { runDeepDocRegionOcr } from '../src/pdf-intelligence/deepdoc-region-bridge.js';

const adapter = await createDeepDocVietOcrAdapter({ deepdocHome: '/definitely/not/installed/hnl-deepdoc-p3' });
assert.equal(adapter.available, false);
assert.equal(typeof adapter.processRegionImage, 'function');
assert.equal(adapter.capabilities.selectiveRegions, false);
await assert.rejects(
  () => adapter.processRegionImage(new Uint8Array([1, 2, 3]), { fileName: 'region.jpg' }),
  error => Boolean(error?.code)
);
const missingImage = await runDeepDocRegionOcr(null);
assert.equal(missingImage.available, false);
assert.equal(missingImage.code, 'REGION_IMAGE_REQUIRED');

console.log('PDF INTELLIGENCE P3 REGION ADAPTER SELFTEST: PASS');
