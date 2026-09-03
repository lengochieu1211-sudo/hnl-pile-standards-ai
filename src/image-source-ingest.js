async function sha256Hex(buffer) {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function tryBrowserOcr(file) {
  if (!('TextDetector' in globalThis)) return '';
  try {
    const bmp = await createImageBitmap(file);
    const detector = new globalThis.TextDetector();
    const blocks = await detector.detect(bmp);
    bmp.close?.();
    return blocks.map(item => item.rawValue || '').filter(Boolean).join('\n').trim();
  } catch {
    return '';
  }
}

export async function parseImageSourceFile(file, { sourcePath = '' } = {}) {
  const buffer = await file.arrayBuffer();
  const fingerprint = await sha256Hex(buffer);
  const browserText = await tryBrowserOcr(file);
  const resolvedPath = sourcePath || file.name;
  const extractor = browserText ? 'BROWSER_TEXT_DETECTOR' : 'VISION_REVIEW_REQUIRED';
  const baseText = browserText || `Hình ảnh nguồn: ${resolvedPath}. Chưa có OCR cục bộ. Khi dùng Gemini hoặc HNL Offline AI có model nhìn ảnh, trợ lý có thể đọc trực tiếp hình này.`;
  return {
    id: crypto.randomUUID(),
    fingerprint,
    name: file.name,
    standard: file.name.replace(/\.[^.]+$/, ''),
    pageCount: 1,
    size: file.size,
    type: file.type || 'application/octet-stream',
    createdAt: new Date().toISOString(),
    blob: file,
    textChars: browserText.length,
    scannedLikely: false,
    pages: [{ page: 1, text: baseText, sourceKind: 'image' }],
    viewerKind: 'image',
    sourceKind: 'image',
    sourcePath: resolvedPath,
    ocrStatus: browserText ? 'browser' : 'vision',
    provenance: {
      status: 'REVIEW',
      sourceKind: 'image',
      sourcePath: resolvedPath,
      fingerprint,
      extractor,
      calculationMutationAllowed: false
    }
  };
}
