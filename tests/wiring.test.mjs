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

test('v1.9.3 service worker gets cache version from registration and keeps metadata network-first', () => {
  const sw = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(sw, /params\.get\('v'\)/);
  assert.match(sw, /build-info\.json/);
  assert.match(sw, /changelog\.json/);
  assert.match(sw, /cache: 'no-store'/);
  assert.match(source, /sw\.js\?v=/);
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


test('v1.9.3 reads version from package and runtime build metadata instead of hard-coded date', () => {
  assert.match(source, /__HNL_APP_VERSION__/);
  assert.match(source, /build-info\.json/);
  assert.match(source, /formatBuildTime/);
  assert.match(source, /Build #/);
  assert.match(source, /Phiên bản & bản build/);
  assert.doesNotMatch(source, /23\/08\/2026 05:49 GMT\+7/);
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


test('v1.8 dual edition separates Web from Desktop Ollama provider', () => {
  assert.match(source, /VITE_HNL_EDITION/);
  assert.match(source, /IS_DESKTOP_EDITION/);
  assert.match(source, /id !== 'ollama'/);
  assert.match(source, /HNL Desktop AI/);
  assert.match(source, /HNL Web/);
});

test('v1.8 desktop has local model install controls and bridge endpoints', () => {
  assert.match(source, /installCurrentLocalModel/);
  assert.match(source, /installLocalAiPack/);
  assert.match(source, /api\/local\/pull-model/);
  const bridge = fs.readFileSync(new URL('../bridge/server.mjs', import.meta.url), 'utf8');
  assert.match(bridge, /api\/local\/pull-model/);
  assert.match(bridge, /ollama.*pull/);
  const desktop = fs.readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
  assert.match(desktop, /ELECTRON_RUN_AS_NODE/);
  assert.match(desktop, /127\.0\.0\.1:8787/);
});


test('v1.9 Reader Pro supports continuous PDF, pan, search and focus mode', () => {
  assert.match(source, /readerMode/);
  assert.match(source, /readerContinuous/);
  assert.match(source, /pdf-continuous/);
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /bindReaderPanAndZoom/);
  assert.match(source, /pdfSearchInput/);
  assert.match(source, /findNextInActive/);
  assert.match(source, /focusReader/);
  assert.match(source, /pageRange/);
});

test('v1.9 layout has collapsible and resizable side panels', () => {
  assert.match(source, /toggleLibrary/);
  assert.match(source, /toggleAssistant/);
  assert.match(source, /bindWorkspaceSplitters/);
  assert.match(source, /leftWidth/);
  assert.match(source, /rightWidth/);
});


test('v1.9.1 desktop model manager exposes storage, disk and model actions', () => {
  const bridge = fs.readFileSync(new URL('../bridge/server.mjs', import.meta.url), 'utf8');
  for (const token of ['localModelManagerHtml','refreshLocalModelManager','applyModelDirectory','deleteLocalModel','installModelPack','openModelDirectory']) assert.match(source,new RegExp(token));
  assert.match(bridge,/api\/local\/model-manager/);assert.match(bridge,/api\/local\/model-directory/);assert.match(bridge,/api\/local\/delete-model/);assert.match(bridge,/api\/local\/open-model-directory/);assert.match(bridge,/OLLAMA_MODELS/);assert.match(bridge,/statfsSync/);
});

test('v1.9.1 local model download jobs expose progress and cancel', () => {
  const bridge = fs.readFileSync(new URL('../bridge/server.mjs', import.meta.url), 'utf8');
  assert.match(source,/data-cancel-local-model/);assert.match(source,/job-progress/);assert.match(bridge,/updatePullProgress/);assert.match(bridge,/api\/local\/cancel-model-pull/);
});


test('v1.9.3 build generator and workflows stamp GitHub build identity', () => {
  const gen = fs.readFileSync(new URL('../scripts/generate-build-info.mjs', import.meta.url), 'utf8');
  const pages = fs.readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  const desktop = fs.readFileSync(new URL('../.github/workflows/desktop-win.yml', import.meta.url), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.version, '1.9.3');
  assert.match(gen, /GITHUB_RUN_NUMBER/);
  assert.match(gen, /GITHUB_SHA/);
  assert.match(gen, /builtAt/);
  assert.match(pages, /dist\/build-info\.json/);
  assert.match(desktop, /APP_VERSION/);
  assert.match(desktop, /github\.run_number/);
});

test('v1.9.3 update and diagnostic actions are wired', () => {
  for (const token of ['checkAppUpdate','copyBuildDiagnostics','loadBuildMetadata','loadChangelog','currentBuildSummary']) assert.match(source, new RegExp(token));
  assert.match(source, /api\.github\.com\/repos/);
  assert.match(source, /releases\/latest/);
});

test('v1.9.3 Windows identity uses optimized multi-size HNL icon', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const electron = fs.readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const manifest = fs.readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8');
  assert.equal(pkg.build.win.icon, 'build/icon.ico');
  assert.match(electron, /setAppUserModelId\('com\.hnl\.pilestandardsai'\)/);
  assert.match(html, /favicon\.ico/);
  assert.match(html, /hnl-mark-32\.png/);
  assert.match(manifest, /hnl-mark-64\.png/);
});
