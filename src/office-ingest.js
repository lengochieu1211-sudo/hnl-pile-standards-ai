const DOCX_EXT = /\.docx$/i;
const EXCEL_EXT = /\.(xlsx|xlsm)$/i;
const LEGACY_OFFICE_EXT = /\.(doc|xls)$/i;
const OFFICE_MAX_BYTES = 80 * 1024 * 1024;
const EXCEL_MAX_SHEETS = 80;
const EXCEL_MAX_NONEMPTY_CELLS = 250000;
const TEXT_PAGE_CHARS = 6500;

export function isModernOfficeFileName(name = '') {
  return DOCX_EXT.test(String(name || '')) || EXCEL_EXT.test(String(name || ''));
}

export function isLegacyOfficeFileName(name = '') {
  return LEGACY_OFFICE_EXT.test(String(name || ''));
}

export function officeMimeForName(name = '') {
  const value = String(name || '').toLowerCase();
  if (value.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (value.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (value.endsWith('.xlsm')) return 'application/vnd.ms-excel.sheet.macroEnabled.12';
  if (value.endsWith('.doc')) return 'application/msword';
  if (value.endsWith('.xls')) return 'application/vnd.ms-excel';
  return '';
}

async function sha256Hex(buffer) {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function splitTextPages(text, maxChars = TEXT_PAGE_CHARS) {
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

function decodeXmlEntities(text = '') {
  return String(text)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function wordXmlToText(xml = '') {
  const normalized = String(xml)
    .replace(/<w:tab\b[^>]*\/>/gi, '\t')
    .replace(/<w:br\b[^>]*\/>/gi, '\n')
    .replace(/<w:cr\b[^>]*\/>/gi, '\n')
    .replace(/<\/w:tc>/gi, '\t')
    .replace(/<\/w:tr>/gi, '\n')
    .replace(/<\/w:p>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeXmlEntities(normalized)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sourceProvenance({ sourceKind, sourcePath, fingerprint, extractor, details = {} }) {
  return Object.freeze({
    status: 'REVIEW',
    sourceKind,
    sourcePath,
    fingerprint,
    extractor,
    calculationMutationAllowed: false,
    ...details
  });
}

async function parseDocxFile(file, sourcePath, buffer, fingerprint) {
  const module = await import('jszip');
  const JSZip = module.default || module;
  const zip = await JSZip.loadAsync(buffer);
  const candidates = Object.keys(zip.files)
    .filter(path => /^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/i.test(path))
    .sort((a, b) => {
      if (/document\.xml$/i.test(a)) return -1;
      if (/document\.xml$/i.test(b)) return 1;
      return a.localeCompare(b);
    });
  if (!candidates.some(path => /word\/document\.xml$/i.test(path))) {
    throw new Error(`DOCX không có word/document.xml hợp lệ: ${file.name}`);
  }
  const sections = [];
  for (const path of candidates) {
    const xml = await zip.file(path)?.async('string');
    if (!xml) continue;
    const text = wordXmlToText(xml);
    if (!text) continue;
    const label = /document\.xml$/i.test(path) ? 'Nội dung chính' : path.replace(/^word\//i, '').replace(/\.xml$/i, '');
    sections.push(`[${label}]\n${text}`);
  }
  const fullText = sections.join('\n\n').trim();
  const pages = splitTextPages(fullText).map(page => ({ ...page, sourceKind: 'word' }));
  return {
    id: crypto.randomUUID(),
    fingerprint,
    name: file.name,
    standard: file.name.replace(/\.[^.]+$/, ''),
    pageCount: pages.length,
    size: file.size,
    type: file.type || officeMimeForName(file.name),
    createdAt: new Date().toISOString(),
    blob: file,
    textChars: fullText.length,
    scannedLikely: false,
    pages,
    viewerKind: 'text',
    sourceKind: 'word',
    sourcePath,
    officeMeta: { format: 'docx', parts: candidates },
    provenance: sourceProvenance({ sourceKind: 'word', sourcePath, fingerprint, extractor: 'DOCX_OOXML_TEXT' })
  };
}

function formatPrimitive(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  return '';
}

function excelCellText(cell) {
  const value = cell?.value;
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value.richText)) return value.richText.map(part => part?.text || '').join('');
  if (typeof value.formula === 'string') {
    const result = formatPrimitive(value.result);
    return `=${value.formula}${result ? ` → ${result}` : ''}`;
  }
  if (typeof value.sharedFormula === 'string') {
    const result = formatPrimitive(value.result);
    return `=${value.sharedFormula}${result ? ` → ${result}` : ''}`;
  }
  if (typeof value.text === 'string') return value.text;
  if (typeof value.hyperlink === 'string') return value.text ? `${value.text} (${value.hyperlink})` : value.hyperlink;
  if (value.error) return String(value.error);
  return cell?.text || formatPrimitive(value) || JSON.stringify(value);
}

async function parseExcelFile(file, sourcePath, buffer, fingerprint) {
  const module = await import('exceljs');
  const ExcelJS = module.default || module;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  if (workbook.worksheets.length > EXCEL_MAX_SHEETS) {
    throw new Error(`Excel có ${workbook.worksheets.length} sheet, vượt giới hạn an toàn ${EXCEL_MAX_SHEETS}.`);
  }

  const pages = [];
  const sheetMeta = [];
  let pageNo = 1;
  let nonEmptyCells = 0;
  let formulaCells = 0;
  let totalTextChars = 0;

  for (const [sheetIndex, worksheet] of workbook.worksheets.entries()) {
    const lines = [`[Sheet: ${worksheet.name}]`];
    let rowCount = 0;
    worksheet.eachRow({ includeEmpty: false }, row => {
      rowCount += 1;
      const cells = [];
      row.eachCell({ includeEmpty: false }, cell => {
        nonEmptyCells += 1;
        if (nonEmptyCells > EXCEL_MAX_NONEMPTY_CELLS) return;
        if (cell?.value && typeof cell.value === 'object' && (cell.value.formula || cell.value.sharedFormula)) formulaCells += 1;
        cells.push(`${cell.address}: ${excelCellText(cell)}`);
      });
      if (cells.length) lines.push(`Hàng ${row.number}\t${cells.join('\t')}`);
    });
    if (nonEmptyCells > EXCEL_MAX_NONEMPTY_CELLS) {
      throw new Error(`Excel vượt giới hạn an toàn ${EXCEL_MAX_NONEMPTY_CELLS.toLocaleString('en-US')} ô có dữ liệu.`);
    }
    const sheetText = lines.join('\n').trim();
    totalTextChars += sheetText.length;
    const chunks = splitTextPages(sheetText);
    for (const chunk of chunks) {
      pages.push({ page: pageNo++, text: chunk.text, sourceKind: 'excel', sheetName: worksheet.name, sheetIndex: sheetIndex + 1 });
    }
    sheetMeta.push({ name: worksheet.name, rows: rowCount, pages: chunks.length });
  }

  return {
    id: crypto.randomUUID(),
    fingerprint,
    name: file.name,
    standard: file.name.replace(/\.[^.]+$/, ''),
    pageCount: pages.length,
    size: file.size,
    type: file.type || officeMimeForName(file.name),
    createdAt: new Date().toISOString(),
    blob: file,
    textChars: totalTextChars,
    scannedLikely: false,
    pages,
    viewerKind: 'text',
    sourceKind: 'excel',
    sourcePath,
    officeMeta: { format: file.name.toLowerCase().endsWith('.xlsm') ? 'xlsm' : 'xlsx', sheets: sheetMeta, formulaCells, nonEmptyCells },
    provenance: sourceProvenance({
      sourceKind: 'excel', sourcePath, fingerprint, extractor: 'EXCELJS_WORKBOOK_TEXT',
      details: { formulaCells, nonEmptyCells, sheets: sheetMeta.map(sheet => sheet.name) }
    })
  };
}

export async function parseOfficeFile(file, { sourcePath = '' } = {}) {
  const name = String(file?.name || '');
  if (isLegacyOfficeFileName(name)) {
    throw new Error(`Định dạng Office cũ ${name.match(/\.[^.]+$/)?.[0] || ''} chưa được đọc trực tiếp. Hãy Save As sang DOCX/XLSX để giữ dữ liệu và provenance chính xác.`);
  }
  if (!isModernOfficeFileName(name)) throw new Error(`Không phải file Office được hỗ trợ: ${name}`);
  if (Number(file?.size || 0) > OFFICE_MAX_BYTES) throw new Error(`File Office vượt giới hạn an toàn ${Math.round(OFFICE_MAX_BYTES / 1024 / 1024)} MB: ${name}`);
  const buffer = await file.arrayBuffer();
  const fingerprint = await sha256Hex(buffer);
  const resolvedPath = sourcePath || name;
  if (DOCX_EXT.test(name)) return parseDocxFile(file, resolvedPath, buffer, fingerprint);
  return parseExcelFile(file, resolvedPath, buffer, fingerprint);
}
