import { safeError } from './contracts.js';
import { createDeepDocVietOcrAdapter } from './deepdoc-vietocr-adapter.js';

function nodeRuntime() {
  return typeof process !== 'undefined' && Boolean(process?.versions?.node);
}

/** Node/Desktop helper for a region image produced by cropCanvasRegionToBase64. */
export async function runDeepDocRegionOcr(image, options = {}) {
  if (!nodeRuntime()) return { available: false, code: 'NODE_ONLY', message: 'DeepDoc region OCR is Desktop/Node-only.' };
  if (!image?.data) return { available: false, code: 'REGION_IMAGE_REQUIRED', message: 'Region JPEG/PNG base64 is required.' };
  try {
    const adapter = await createDeepDocVietOcrAdapter(options);
    if (!adapter.available) return { available: false, ...(adapter.health || {}), code: adapter.health?.code || 'DEEPOCR_UNAVAILABLE' };
    const bytes = Buffer.from(String(image.data), 'base64');
    const result = await adapter.processRegionImage(bytes, {
      fileName: image.mimeType === 'image/png' ? 'hnl-region.png' : 'hnl-region.jpg',
      threshold: options.threshold ?? 0.5,
      tableStructure: options.tableStructure ?? true,
      dpi: options.dpi ?? 216
    });
    const page = result.pages?.[0] || {};
    return {
      available: true,
      engine: 'deepdoc-vietocr-region',
      text: String(page.text || ''),
      ocrLines: page.ocrLines || [],
      layouts: page.layouts || [],
      tableStructures: page.tableStructures || [],
      recognizerConfidenceUsable: false,
      inputSha256: result.inputSha256 || null,
      elapsedMs: result.elapsedMs || null
    };
  } catch (error) {
    return { available: false, code: error?.code || 'DEEPOCR_REGION_FAILED', ...safeError(error) };
  }
}
