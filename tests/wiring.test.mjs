import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

const criticalControls = [
  ['sourceBadge', 'sourceBadge'],
  ['openSettings', 'openSettings'],
  ['selectAll', 'selectAll'],
  ['clearSelection', 'clearSelection'],
  ['prevPage', 'prevPage'],
  ['nextPage', 'nextPage'],
  ['zoomOut', 'zoomOut'],
  ['zoomIn', 'zoomIn'],
  ['fitWidth', 'fitWidth'],
  ['aiSummary', 'aiSummary'],
  ['askBtn', 'askQuestion'],
  ['lookupBtn', 'runLookup'],
  ['tableLookupBtn', 'runTableLookup'],
  ['calcBtn', 'runCalc'],
  ['calcFill7888', 'fillCalcFrom7888'],
  ['formulaScanBtn', 'scanAllFormulasSmart'],
  ['formulaCalcBtn', 'runDynamicFormula'],
  ['compareBtn', 'runCompare'],
  ['copyChecklist', 'copyChecklist'],
  ['resetChecklist', 'resetChecklist'],
  ['aiChecklist', 'aiChecklist'],
  ['saveSettings', 'updateSettingsFromForm'],
  ['testConnection', 'testConnection'],
  ['refreshModels', 'refreshModels'],
  ['autoLocalModels', 'applyRecommendedLocalModels'],
  ['runDiagnostics', 'runDiagnostics']
];

test('all critical visible buttons have delegated click actions', () => {
  assert.match(source, /app\.onclick\s*=\s*async event/);
  for (const [id, handler] of criticalControls) {
    assert.match(source, new RegExp(`id=\\"${id}\\"|#${id}`), `${id} missing from UI`);
    assert.match(source, new RegExp(`el\\.id === '${id}'|${handler}\\(`), `${id} has no delegated handler`);
  }
});

test('dynamic source, suggestion, navigation and checklist controls use delegation', () => {
  for (const token of ['data-suggest', 'data-jump', 'data-find', 'data-hit-doc', 'data-open', 'data-delete', 'data-connection', 'data-check', 'data-select']) {
    assert.match(source, new RegExp(token), `${token} missing`);
  }
  assert.match(source, /app\.onchange/);
  assert.match(source, /updateChecklist\(Number\(el\.dataset\.check\)/);
});

test('chat send has explicit blank-input feedback and Enter-to-send', () => {
  assert.match(source, /Hãy nhập câu hỏi trước khi gửi/);
  assert.match(source, /el\.id === 'chatQuestion'.*event\.key === 'Enter'/s);
  assert.match(source, /!event\.shiftKey/);
  assert.match(source, /askQuestion\(state\.chatDraft\)/);
});

test('AI citations remain connected to PDF navigation', () => {
  assert.match(source, /data-hit-doc/);
  assert.match(source, /data-hit-page/);
  assert.match(source, /state\.activeDocId = el\.dataset\.hitDoc/);
});

test('service worker uses v1.7.1 cache and network-first navigation', () => {
  const sw = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(sw, /hnl-pile-ai-v1\.7\.1/);
  assert.match(sw, /req\.mode === 'navigate'/);
  assert.match(sw, /fetch\(req\)/);
});

test('v1.4 multi-import and folder controls are wired', () => {
  assert.match(source, /id="dataInput"/);
  assert.match(source, /id="folderInput"/);
  assert.match(source, /webkitdirectory/);
  assert.match(source, /uploadInputs\(event\)/);
  assert.match(source, /expandInputItems/);
  assert.match(source, /parseInputFile/);
});

test('offline Ollama mode explains GitHub HTTPS limitation and local launcher', () => {
  assert.match(source, /START_HNL_OFFLINE_AI\.bat/);
  assert.match(source, /http:\/\/127\.0\.0\.1:8787/);
  assert.match(source, /HNL Offline AI/);
  const bridge = fs.readFileSync(new URL('../bridge/server.mjs', import.meta.url), 'utf8');
  assert.match(bridge, /express\.static\(dist\)/);
  assert.match(bridge, /api\/tags/);
});


test('v1.4 full-library scope and all-page lookup are wired', () => {
  assert.match(source, /scopeSelect/);
  assert.match(source, /value="all"/);
  assert.match(source, /searchEveryPage\(query, docs, 100\)/);
  assert.match(source, /corpusStats\(docs\)/);
  assert.match(source, /Toàn bộ tài liệu đã tải/);
});

test('v1.4 dynamic model picker is wired', () => {
  assert.match(source, /refreshModels/);
  assert.match(source, /modelOptionsList/);
  assert.match(source, /listAvailableModels/);
});


test('v1.7.1 shows version and release update timestamp in the UI', () => {
  assert.match(source, /version: '1\.7\.1'/);
  assert.match(source, /22\/08\/2026 23:26 GMT\+7/);
  assert.match(source, /build-meta/);
  assert.match(source, /Phiên bản ứng dụng/);
});

test('v1.6 calculator includes verified and auto-scanned formula libraries', () => {
  assert.match(source, /Thư viện công thức tự quét/);
  assert.match(source, /extractFormulaLibrary/);
  assert.match(source, /evaluateExpression/);
  assert.match(source, /TCVN 7888:2014/);
});

test('v1.6 deep RAG and archive password flow are wired', () => {
  assert.match(source, /deepSearchChunks/);
  assert.match(source, /planEngineeringQueries/);
  assert.match(source, /extractArchiveWithPassword/);
  assert.match(source, /PASSWORD_REQUIRED/);
  assert.match(source, /BAD_PASSWORD/);
});


test('v1.6 archive formats and password-capable bridge are present', () => {
  const ingest = fs.readFileSync(new URL('../src/ingest.js', import.meta.url), 'utf8');
  const bridge = fs.readFileSync(new URL('../bridge/server.mjs', import.meta.url), 'utf8');
  assert.match(ingest, /\.rar/);
  assert.match(ingest, /\.7z/);
  assert.match(ingest, /\.tar/);
  assert.match(ingest, /X-HNL-Archive-Password/);
  assert.match(bridge, /PASSWORD_REQUIRED/);
  assert.match(bridge, /BAD_PASSWORD/);
  assert.match(bridge, /7-Zip/);
});


test('v1.7 local intelligence engine wires hybrid semantic RAG', () => {
  const ai = fs.readFileSync(new URL('../src/ai.js', import.meta.url), 'utf8');
  const bridge = fs.readFileSync(new URL('../bridge/server.mjs', import.meta.url), 'utf8');
  assert.match(source, /retrievalModeInput/);
  assert.match(source, /embeddingModelInput/);
  assert.match(source, /semanticRerankInput/);
  assert.match(source, /semanticRerank\(/);
  assert.match(ai, /api\/local\/semantic-rerank/);
  assert.match(bridge, /app\.post\('\/api\/local\/semantic-rerank'/);
  assert.match(bridge, /api\/embed/);
  assert.match(bridge, /cosineSimilarity/);
});

test('v1.7 local diagnostics recommends model by hardware', () => {
  const bridge = fs.readFileSync(new URL('../bridge/server.mjs', import.meta.url), 'utf8');
  const installer = fs.readFileSync(new URL('../offline/INSTALL_OFFLINE_MODELS.bat', import.meta.url), 'utf8');
  assert.match(source, /localEngineDiagnostics/);
  assert.match(bridge, /api\/local\/diagnostics/);
  assert.match(bridge, /nvidia-smi/);
  assert.match(bridge, /recommendedText/);
  assert.match(installer, /bge-m3/);
  assert.match(installer, /qwen3:14b/);
});

test('v1.7 ingest fileToBase64 declaration is not duplicated', () => {
  const ingest = fs.readFileSync(new URL('../src/ingest.js', import.meta.url), 'utf8');
  const count = (ingest.match(/export async function fileToBase64/g) || []).length;
  assert.equal(count, 1);
});


test('v1.7.1 AI formula scanner is wired for uploaded PDF/image/text sources', () => {
  const formulas = fs.readFileSync(new URL('../src/formulas.js', import.meta.url), 'utf8');
  assert.match(source, /formulaScanMode/);
  assert.match(source, /scanAllFormulasSmart/);
  assert.match(source, /scanFormulaPageWithAi/);
  assert.match(source, /renderPdfPageToBase64/);
  assert.match(source, /AI\/Vision.*nhận diện/s);
  assert.match(formulas, /aiFormulaCandidates/);
  assert.match(formulas, /aiFormulaItems/);
});

test('AI detected formulas require explicit source verification before calculation', () => {
  assert.match(source, /formulaVerifyBtn/);
  assert.match(source, /verifySelectedAiFormula/);
  assert.match(source, /đối chiếu.*trang.*gốc/is);
});
