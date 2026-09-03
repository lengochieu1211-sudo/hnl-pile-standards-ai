import { parsePdf } from './pdf.js';
import { isModernOfficeFileName, isLegacyOfficeFileName, officeMimeForName, parseOfficeFile } from './office-ingest.js';

const TEXT_EXT = /\.(txt|md|csv|json|xml|html?|log|ini|cfg|yaml|yml)$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|bmp|gif)$/i;
const PDF_EXT = /\.pdf$/i;
const ZIP_EXT = /\.zip$/i;
const LOCAL_ARCHIVE_EXT = /(?:\.rar|\.7z|\.tar|\.tgz|\.tar\.gz|\.gz|\.bz2|\.xz)$/i;

function ext(name='') {
  const m = String(name).toLowerCase().match(/\.[^.\\/]+$/);
  return m?.[0] || '';
}

export function inferMime(name='') {
  const officeMime = officeMimeForName(name);
  if (officeMime) return officeMime;
  const e = ext(name);
  const map = {
    '.pdf':'application/pdf', '.txt':'text/plain', '.md':'text/markdown', '.csv':'text/csv', '.json':'application/json',
    '.xml':'application/xml', '.html':'text/html', '.htm':'text/html', '.yaml':'text/yaml', '.yml':'text/yaml',
    '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.bmp':'image/bmp', '.gif':'image/gif',
    '.zip':'application/zip', '.rar':'application/vnd.rar', '.7z':'application/x-7z-compressed', '.tar':'application/x-tar', '.tgz':'application/gzip', '.gz':'application/gzip', '.bz2':'application/x-bzip2', '.xz':'application/x-xz'
  };
  return map[e] || 'application/octet-stream';
}

export function supportedInput(name='') {
  return PDF_EXT.test(name) || TEXT_EXT.test(name) || IMAGE_EXT.test(name) || ZIP_EXT.test(name) || isModernOfficeFileName(name) || isLegacyOfficeFileName(name);
}

export function isArchiveFile(name='') { return LOCAL_ARCHIVE_EXT.test(String(name || '')); }

async function sha256Hex(buffer) {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function reviewProvenance({ sourceKind, sourcePath, fingerprint, extractor, details = {} }) {
  return {
    status: 'REVIEW',
    sourceKind,
    sourcePath,
    fingerprint,
    extractor,
    calculationMutationAllowed: false,
    ...details
  };
}

function splitTextPages(text, maxChars = 6500) {
  const clean = String(text || '').replace(/\r\n/g, '\n');
  if (!clean.trim()) return [{ page: 1, text: '' }];
  const pages = [];
  let start = 0;
  let page = 1;
  while (start < clean.length) {
    let end = Math.min(clean.length, start + maxChars);
    if (end < clean.length) {
      const nl = clean.lastIndexOf('\n', end);
      if (nl > start + maxChars * 0.55) end = nl;
    }
    pages.push({ page: page++, text: clean.slice(start, end).trim() });
    start = Math.max(end, start + 1);
  }
  return pages;
}

async function parseTextFile(file, sourcePath='') {
  const buffer = await file.arrayBuffer();
  const fingerprint = await sha256Hex(buffer);
  let text;
  try { text = new TextDecoder('utf-8', { fatal: false }).decode(buffer); }
  catch { text = await file.text(); }
  if (/\.json$/i.test(file.name)) {
    try { text = JSON.stringify(JSON.parse(text), null, 2); } catch { /* keep original */ }
  }
  const resolvedPath = sourcePath || file.name;
  const pages = splitTextPages(text).map(page => ({ ...page, sourceKind: 'text' }));
  return {
    id: crypto.randomUUID(), fingerprint, name: file.name, standard: file.name.replace(/\.[^.]+$/, ''),
    pageCount: pages.length, size: file.size, type: file.type || inferMime(file.name), createdAt: new Date().toISOString(),
    blob: file, textChars: text.length, scannedLikely: false, pages, viewerKind: 'text', sourceKind: 'text', sourcePath: resolvedPath,
    provenance: reviewProvenance({ sourceKind: 'text', sourcePath: resolvedPath, fingerprint, extractor: 'UTF8_TEXT' })
  };
}

async function tryBrowserOcr(file) {
  if (!('TextDetector' in globalThis)) return '';
  try {
    const bmp = await createImageBitmap(file);
    const detector = new globalThis.TextDetector();
    const blocks = await detector.detect(bmp);
    bmp.close?.();
    return blocks.map(x => x.rawValue || '').filter(Boolean).join('\n').trim();
  } catch { return ''; }
}

async function parseImageFile(file, sourcePath='') {
  const buffer = await file.arrayBuffer();
  const fingerprint = await sha256Hex(buffer);
  const browserText = await tryBrowserOcr(file);
  const resolvedPath = sourcePath || file.name;
  const baseText = browserText || `Hình ảnh nguồn: ${resolvedPath}. Chưa có OCR cục bộ. Khi dùng Gemini hoặc HNL Offline AI có model nhìn ảnh, trợ lý có thể đọc trực tiếp hình này.`;
  const extractor = browserText ? 'BROWSER_TEXT_DETECTOR' : 'VISION_REVIEW_REQUIRED';
  return {
    id: crypto.randomUUID(), fingerprint, name: file.name, standard: file.name.replace(/\.[^.]+$/, ''),
    pageCount: 1, size: file.size, type: file.type || inferMime(file.name), createdAt: new Date().toISOString(),
    blob: file, textChars: browserText.length, scannedLikely: false, pages: [{ page: 1, text: baseText, sourceKind: 'image' }],
    viewerKind: 'image', sourceKind: 'image', sourcePath: resolvedPath, ocrStatus: browserText ? 'browser' : 'vision',
    provenance: reviewProvenance({ sourceKind: 'image', sourcePath: resolvedPath, fingerprint, extractor })
  };
}

function findEocd(view) {
  const sig = 0x06054b50;
  const min = Math.max(0, view.byteLength - 0xFFFF - 22);
  for (let i = view.byteLength - 22; i >= min; i--) if (view.getUint32(i, true) === sig) return i;
  return -1;
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') throw new Error('Trình duyệt này chưa hỗ trợ giải nén DEFLATE. Hãy dùng Chrome/Edge mới.');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function extractZip(file, { maxEntries = 800, maxUncompressed = 350 * 1024 * 1024 } = {}) {
  const buf = await file.arrayBuffer();
  const view = new DataView(buf);
  const eocd = findEocd(view);
  if (eocd < 0) throw new Error('Không tìm thấy cấu trúc ZIP hợp lệ.');
  const total = view.getUint16(eocd + 10, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (total > maxEntries) throw new Error(`ZIP có ${total} mục, vượt giới hạn an toàn ${maxEntries}.`);
  let ptr = cdOffset;
  let totalOut = 0;
  const out = [];
  const decoder = new TextDecoder('utf-8', { fatal: false });
  for (let i = 0; i < total; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) throw new Error('ZIP bị lỗi bảng thư mục trung tâm.');
    const flags = view.getUint16(ptr + 8, true);
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const uncompSize = view.getUint32(ptr + 24, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = decoder.decode(new Uint8Array(buf, ptr + 46, nameLen));
    ptr += 46 + nameLen + extraLen + commentLen;
    if (!name || name.endsWith('/')) continue;
    if (flags & 0x1) throw new Error(`ZIP có file mã hóa: ${name}. Chưa hỗ trợ ZIP có mật khẩu.`);
    if (!supportedInput(name)) continue;
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error(`ZIP lỗi local header: ${name}`);
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const compressed = new Uint8Array(buf, dataStart, compSize);
    let bytes;
    if (method === 0) bytes = new Uint8Array(compressed);
    else if (method === 8) bytes = await inflateRaw(compressed);
    else continue;
    totalOut += bytes.byteLength || uncompSize;
    if (totalOut > maxUncompressed) throw new Error('ZIP giải nén vượt giới hạn 350 MB để tránh treo trình duyệt.');
    const shortName = name.split('/').pop() || name;
    out.push({ file: new File([bytes], shortName, { type: inferMime(shortName), lastModified: file.lastModified }), path: `${file.name}/${name}`, internalPath:name });
  }
  return out;
}

export async function parseInputFile(file, { sourcePath = '', onPdfProgress = () => {} } = {}) {
  const resolvedPath = sourcePath || file.name;
  if (PDF_EXT.test(file.name) || file.type === 'application/pdf') {
    const doc = await parsePdf(file, onPdfProgress);
    doc.viewerKind = 'pdf';
    doc.sourceKind = 'pdf';
    doc.sourcePath = resolvedPath;
    doc.provenance = reviewProvenance({ sourceKind: 'pdf', sourcePath: resolvedPath, fingerprint: doc.fingerprint || '', extractor: 'PDFJS_NATIVE_OR_EXISTING_PDF_PIPELINE' });
    return doc;
  }
  if (isModernOfficeFileName(file.name) || isLegacyOfficeFileName(file.name)) return parseOfficeFile(file, { sourcePath: resolvedPath });
  if (IMAGE_EXT.test(file.name) || String(file.type).startsWith('image/')) return parseImageFile(file, resolvedPath);
  if (TEXT_EXT.test(file.name) || String(file.type).startsWith('text/')) return parseTextFile(file, resolvedPath);
  throw new Error(`Chưa hỗ trợ loại file: ${file.name}`);
}

export async function expandInputItems(files, { maxDepth = 3 } = {}) {
  const output = [];
  async function visit(file, sourcePath='', depth=0) {
    if (!file) return;
    const currentPath = sourcePath || file.webkitRelativePath || file.name;
    if (ZIP_EXT.test(file.name)) {
      if (depth >= maxDepth) throw new Error(`ZIP lồng quá ${maxDepth} cấp: ${currentPath}`);
      const entries = await extractZip(file);
      for (const entry of entries) {
        const inside = entry.internalPath || String(entry.path || '').replace(new RegExp(`^${file.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?`), '');
        await visit(entry.file, `${currentPath}/${inside}`.replace(/\/{2,}/g,'/'), depth + 1);
      }
      return;
    }
    if (supportedInput(file.name)) output.push({ file, path: currentPath });
  }
  for (const item of files) {
    const file = item?.file || item;
    const sourcePath = item?.path || file?.webkitRelativePath || file?.name || '';
    await visit(file, sourcePath, 0);
  }
  return output;
}

export async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(binary);
}

export async function extractArchiveViaLocalBridge(file, password = '') {
  const response = await fetch(`/api/extract-archive?name=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', ...(password ? { 'X-HNL-Archive-Password': encodeURIComponent(password) } : {}) },
    body: file
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const err = new Error(data.error || `Không giải nén được ${file.name}`); err.code = data.code || `HTTP_${response.status}`; throw err; }
  return (data.entries || []).map(entry => {
    const binary = atob(entry.data || '');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const name = String(entry.path || 'file').split('/').pop();
    return { file: new File([bytes], name, { type: inferMime(name), lastModified: file.lastModified }), path: `${file.name}/${entry.path}` };
  });
}
