import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { isModernOfficeFileName, isLegacyOfficeFileName, parseOfficeFile } from '../src/office-ingest.js';

function fakeFile(name, bytes, type = '') {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return {
    name,
    type,
    size: data.byteLength,
    lastModified: 1788147631000,
    async arrayBuffer() {
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }
  };
}

function allText(doc) {
  return (doc.pages || []).map(page => page.text || '').join('\n');
}

async function makeDocx() {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
      <w:p><w:r><w:t>TCVN 10304:2025 - Cọc BTCT 400x400, dài 10m</w:t></w:r></w:p>
      <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Lớp 1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Ns=20</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
    </w:body></w:document>`);
  zip.file('word/header1.xml', `<?xml version="1.0"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>HNL nguồn Word</w:t></w:r></w:p></w:hdr>`);
  return zip.generateAsync({ type: 'uint8array' });
}

async function makeXlsx() {
  const wb = new ExcelJS.Workbook();
  const input = wb.addWorksheet('INPUT_SPT');
  input.addRow(['Thông số', 'Giá trị']);
  input.addRow(['b (m)', 0.4]);
  input.addRow(['h (m)', 0.4]);
  input.addRow(['A_b (m2)', { formula: 'B2*B3', result: 0.16 }]);
  const layers = wb.addWorksheet('DIA_CHAT');
  layers.addRow(['Lớp', 'h_i', 'N_s']);
  layers.addRow(['Cát', 4, 20]);
  layers.addRow(['Sét', 6, 15]);
  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

console.log('DOCUMENT INGEST V2 GOLDEN · start');

assert.equal(isModernOfficeFileName('bao-cao.docx'), true);
assert.equal(isModernOfficeFileName('spt.xlsx'), true);
assert.equal(isModernOfficeFileName('spt.xlsm'), true);
assert.equal(isLegacyOfficeFileName('cu.xls'), true);
assert.equal(isLegacyOfficeFileName('cu.doc'), true);
console.log('PASS 1/5 · extension contract');

const docxBytes = await makeDocx();
const word = await parseOfficeFile(fakeFile('bao-cao.docx', docxBytes), { sourcePath: 'du-an/bao-cao.docx' });
const wordText = allText(word);
assert.equal(word.sourceKind, 'word');
assert.equal(word.viewerKind, 'text');
assert.equal(word.provenance.status, 'REVIEW');
assert.equal(word.provenance.calculationMutationAllowed, false);
assert.match(word.fingerprint, /^[0-9a-f]{64}$/);
assert.match(wordText, /Cọc BTCT 400x400, dài 10m/);
assert.match(wordText, /Lớp 1/);
assert.match(wordText, /Ns=20/);
assert.match(wordText, /HNL nguồn Word/);
console.log('PASS 2/5 · real DOCX text/table/header + provenance');

const xlsxBytes = await makeXlsx();
const excel = await parseOfficeFile(fakeFile('spt.xlsx', xlsxBytes), { sourcePath: 'du-an/spt.xlsx' });
const excelText = allText(excel);
assert.equal(excel.sourceKind, 'excel');
assert.equal(excel.viewerKind, 'text');
assert.equal(excel.provenance.status, 'REVIEW');
assert.equal(excel.provenance.calculationMutationAllowed, false);
assert.deepEqual(excel.officeMeta.sheets.map(sheet => sheet.name), ['INPUT_SPT', 'DIA_CHAT']);
assert.equal(excel.officeMeta.formulaCells, 1);
assert.match(excelText, /\[Sheet: INPUT_SPT\]/);
assert.match(excelText, /B4: =B2\*B3 → 0\.16/);
assert.match(excelText, /\[Sheet: DIA_CHAT\]/);
assert.match(excelText, /Cát/);
console.log('PASS 3/5 · real XLSX sheets/cells/formula + provenance');

const xlsm = await parseOfficeFile(fakeFile('spt.xlsm', xlsxBytes, 'application/vnd.ms-excel.sheet.macroEnabled.12'), { sourcePath: 'du-an/spt.xlsm' });
assert.equal(xlsm.officeMeta.format, 'xlsm');
assert.match(allText(xlsm), /B4: =B2\*B3 → 0\.16/);
console.log('PASS 4/5 · XLSM workbook content path');

await assert.rejects(
  () => parseOfficeFile(fakeFile('legacy.xls', new Uint8Array([1, 2, 3]))),
  /Save As sang DOCX\/XLSX/
);
const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const uiModule = await readFile(new URL('../src/document-input-ui.js', import.meta.url), 'utf8');
assert.match(indexHtml, /document-input-ui\.js/);
assert.match(uiModule, /\.docx/);
assert.match(uiModule, /\.xlsx/);
assert.match(uiModule, /\.xlsm/);
assert.doesNotMatch(uiModule, /'\.doc'/);
assert.doesNotMatch(uiModule, /'\.xls'/);
console.log('PASS 5/5 · legacy safety + production picker contract');

console.log('DOCUMENT INGEST V2 GOLDEN: PASS 5/5');
