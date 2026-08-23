import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const pkgMeta = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const CURRENT_VERSION = pkgMeta.version;

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

test('v1.9.4 service worker gets cache version from registration and keeps metadata network-first', () => {
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


test('v1.9.4 reads version from package and runtime build metadata instead of hard-coded date', () => {
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


test('build generator and workflows stamp GitHub build identity', () => {
  const gen = fs.readFileSync(new URL('../scripts/generate-build-info.mjs', import.meta.url), 'utf8');
  const pages = fs.readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  const desktop = fs.readFileSync(new URL('../.github/workflows/desktop-win.yml', import.meta.url), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.version, CURRENT_VERSION);
  assert.match(gen, /GITHUB_RUN_NUMBER/);
  assert.match(gen, /GITHUB_SHA/);
  assert.match(gen, /builtAt/);
  assert.match(pages, /dist\/build-info\.json/);
  assert.match(desktop, /APP_VERSION/);
  assert.match(desktop, /github\.run_number/);
});

test('v1.9.4 update and diagnostic actions are wired', () => {
  for (const token of ['checkAppUpdate','copyBuildDiagnostics','loadBuildMetadata','loadChangelog','currentBuildSummary']) assert.match(source, new RegExp(token));
  assert.match(source, /api\.github\.com\/repos/);
  assert.match(source, /releases\/latest/);
});

test('v1.9.4 Windows identity uses optimized multi-size HNL icon', () => {
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


test('v1.9.4 side panels always have recovery controls and unique viewer toggles', () => {
  for (const token of ['reopenLibrary','reopenAssistant','viewerToggleLibrary','viewerToggleAssistant','resetLayout']) assert.match(source, new RegExp(token));
  assert.match(source, /state\.focusReader=false; state\.leftCollapsed=false/);
  assert.match(source, /state\.focusReader=false; state\.rightCollapsed=false/);
  assert.match(source, /hnl\.leftCollapsed\.v194/);
  assert.match(source, /hnl\.rightCollapsed\.v194/);
});

test('v1.9.4 medium desktop toolbar has anti-overlap responsive CSS', () => {
  const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(css, /max-width:1500px/);
  assert.match(css, /grid-template-areas:"title controls" "search search"/);
  assert.match(css, /panel-recovery-left/);
  assert.match(css, /max-width:1366px/);
});


test('v1.9.5 settings tab is always reachable and Windows EXE autobuilds on main', () => {
  const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  const desktop = fs.readFileSync(new URL('../.github/workflows/desktop-win.yml', import.meta.url), 'utf8');
  assert.match(source, /assistantSettingsQuick/);
  assert.match(source, /data-tab=\"\$\{id\}\"/);
  assert.match(css, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /panel-body.*overflow:auto/s);
  assert.match(desktop, /branches:\s*\n\s*- main/);
  assert.match(desktop, /Build NSIS and Portable EXE/);
  assert.match(desktop, /release\/HNL-Pile-Standards-AI-Setup-\*\.exe/);
  assert.match(desktop, /release\/HNL-Pile-Standards-AI-Portable-\*\.exe/);
});


test('v1.9.7 desktop layout fluidly shrinks without auto-hiding side panels', () => {
  const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(source, /--left-user-w:\$\{state\.layout\.left\}px/);
  assert.match(source, /--right-user-w:\$\{state\.layout\.right\}px/);
  assert.match(css, /--left-effective:\s*max\(220px,\s*min\(var\(--left-user-w/);
  assert.match(css, /--right-effective:\s*max\(300px,\s*min\(var\(--right-user-w/);
  assert.match(css, /grid-template-columns:\s*var\(--left-effective\)\s+minmax\(340px,\s*1fr\)\s+var\(--right-effective\)/);
  assert.match(css, /max-width:980px[\s\S]*min-width:881px[\s\S]*--left-effective:\s*215px[\s\S]*--right-effective:\s*290px/);
  assert.match(css, /max-width:880px[\s\S]*mobile-nav/);
});

test('v1.9.7 resize preserves explicit panel state and splitters follow effective widths', () => {
  const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(css, /splitter-left\s*\{\s*left:\s*calc\(var\(--left-effective\)/);
  assert.match(css, /splitter-right\s*\{\s*right:\s*calc\(var\(--right-effective\)/);
  assert.match(source, /--left-user-w' : '--right-user-w/);
  assert.doesNotMatch(source, /resize[\s\S]{0,240}leftCollapsed\s*=\s*true/i);
  assert.doesNotMatch(source, /resize[\s\S]{0,240}rightCollapsed\s*=\s*true/i);
});


test('Windows artifact names are target-specific and avoid unsupported target macro', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.version, CURRENT_VERSION);
  assert.ok(!String(pkg.build?.win?.artifactName || '').includes('${target}'));
  assert.match(pkg.build?.nsis?.artifactName || '', /Setup/);
  assert.match(pkg.build?.portable?.artifactName || '', /Portable/);
});

test('Windows workflow verifies both Setup and Portable EXEs', () => {
  const workflow = fs.readFileSync(new URL('../.github/workflows/desktop-win.yml', import.meta.url), 'utf8');
  assert.match(workflow, /Verify Windows EXEs/);
  assert.match(workflow, /HNL-Pile-Standards-AI-Setup-\*\.exe/);
  assert.match(workflow, /HNL-Pile-Standards-AI-Portable-\*\.exe/);
});


test('model picker is visible in assistant and refresh never silently switches model', () => {
  assert.match(source, /quickProviderSelect/);
  assert.match(source, /openQuickModelPicker/);
  assert.match(source, /refreshModelsQuick/);
  assert.match(source, /HNL không tự đổi model/);
  assert.doesNotMatch(source, /models\.length && !models\.includes\(state\.settings\.model\)\) state\.settings\.model =/);
});

test('v1.9.8 every fallback model switch requires explicit OK confirmation', () => {
  assert.match(source, /chooseApprovedFallbackModel/);
  assert.match(source, /Bấm OK để chuyển sang model này và thử lại/);
  assert.match(source, /Bấm Cancel để GIỮ NGUYÊN model hiện tại/);
  assert.match(source, /confirmModelSwitch/);
  assert.match(source, /HNL sẽ CHỈ chuyển model khi bạn bấm OK/);
});

test('v1.9.8 bridge preserves upstream AI status for quota and transient error handling', () => {
  const ai = fs.readFileSync(new URL('../src/ai.js', import.meta.url), 'utf8');
  const bridge = fs.readFileSync(new URL('../bridge/server.mjs', import.meta.url), 'utf8');
  assert.match(ai, /error\.status = response\.status/);
  assert.match(bridge, /upstreamStatus/);
  assert.match(bridge, /429/);
  assert.match(source, /retryDelays = \[0, 1200, 3000\]/);
});


test('current release version is synchronized across all active metadata', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const changelog = JSON.parse(fs.readFileSync(new URL('../public/changelog.json', import.meta.url), 'utf8'));
  const buildDoc = fs.readFileSync(new URL('../docs/BUILD_METADATA.md', import.meta.url), 'utf8');
  const versionGate = fs.readFileSync(new URL('../scripts/check-version-sync.mjs', import.meta.url), 'utf8');
  const release = fs.readFileSync(new URL(`../docs/RELEASE_V${CURRENT_VERSION}.md`, import.meta.url), 'utf8');
  assert.match(CURRENT_VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(readme.split(/\r?\n/)[0], `# HNL Pile Standards AI v${CURRENT_VERSION}`);
  assert.equal(changelog.current, CURRENT_VERSION);
  assert.equal(changelog.releases[0]?.version, CURRENT_VERSION);
  assert.match(release, new RegExp(`^# HNL Pile Standards AI v${CURRENT_VERSION.replaceAll('.', '\\.')}`));
  assert.match(buildDoc, new RegExp(`"version"\\s*:\\s*"${CURRENT_VERSION.replaceAll('.', '\\.') }"`));
  assert.match(versionGate, /VERSION GATE PASS/);
});

test('refresh model and connection test do not commit draft settings', () => {
  const refreshStart = source.indexOf('async function refreshModels()');
  const refreshEnd = source.indexOf('async function applyRecommendedLocalModels()', refreshStart);
  const refreshBody = source.slice(refreshStart, refreshEnd);
  assert.doesNotMatch(refreshBody, /saveSettings\(/);
  assert.doesNotMatch(refreshBody, /sessionStorage\.setItem/);

  const testStart = source.indexOf('async function testConnection()');
  const testEnd = source.indexOf('function bindWorkspaceSplitters()', testStart);
  const testBody = source.slice(testStart, testEnd);
  assert.doesNotMatch(testBody, /saveSettings\(/);
  assert.doesNotMatch(testBody, /sessionStorage\.setItem/);
  assert.match(testBody, /Cài đặt nháp chưa được lưu/);
});

test('all current model-changing paths require explicit user confirmation', () => {
  assert.match(source, /function confirmModelSwitch/);
  assert.match(source, /Chuyển nhà cung cấp AI\?/);
  assert.match(source, /Đổi cấu hình model AI\?/);
  assert.match(source, /HNL đề xuất cấu hình theo máy/);
  assert.match(source, /Cài và đặt bộ AI Offline/);
  assert.match(source, /Bấm OK để chuyển sang model này và thử lại/);
});


test('v1.9.11 assistant model picker avoids native dropdown overlap', () => {
  const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(source, /openQuickModelPicker/);
  assert.match(source, /model-picker-dialog/);
  assert.match(source, /modelPickerSearch/);
  assert.doesNotMatch(source, /id="quickModelSelect"/);
  assert.match(css, /\.tabs\s*\{[\s\S]*display:flex\s*!important[\s\S]*overflow-x:auto\s*!important/);
  assert.match(css, /\.model-picker-overlay\s*\{/);
});

test('v1.9.11 Gemini catalog and API discovery cover current model families and pagination', () => {
  const ai = fs.readFileSync(new URL('../src/ai.js', import.meta.url), 'utf8');
  assert.match(ai, /gemini-3\.7-flash/);
  assert.match(ai, /gemini-3\.1-flash-lite/);
  assert.match(ai, /gemini-2\.5-pro/);
  assert.match(ai, /gemini-flash-latest/);
  assert.match(ai, /nextPageToken/);
  assert.match(ai, /pageToken/);
  assert.match(ai, /supportedGenerationMethods\.includes\('generateContent'\)/);
});

test('v1.9.11 Windows validation is PowerShell-safe and does not inline target macro in node -e', () => {
  const workflow = fs.readFileSync(new URL('../.github/workflows/desktop-win.yml', import.meta.url), 'utf8');
  assert.match(workflow, /ConvertFrom-Json/);
  assert.match(workflow, /\$targetMacro = '\$' \+ '\{target\}'/);
  assert.doesNotMatch(workflow, /node -e .*target macro/);
});

test('v1.9.12 PDF toolbar uses viewer container queries and grouped controls to prevent overlap', () => {
  const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(source, /toolbar-mode-group/);
  assert.match(source, /toolbar-zoom-group/);
  assert.match(source, /toolbar-page-group/);
  assert.match(source, /toolbar-layout-group/);
  assert.match(css, /container-name:viewer/);
  assert.match(css, /@container viewer \(max-width:1050px\)/);
  assert.match(css, /grid-template-areas:"title search" "controls controls"/);
  assert.match(css, /@container viewer \(max-width:620px\)/);
  assert.match(css, /grid-template-areas:"title" "search" "controls"/);
});

test('v1.9.12 desktop panel budget preserves both panels while guaranteeing PDF space', () => {
  const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(css, /--left-effective:max\(235px, min\(var\(--left-user-w, 290px\), 21vw\)\)/);
  assert.match(css, /--right-effective:max\(350px, min\(var\(--right-user-w, 440px\), 30vw\)\)/);
  assert.match(css, /grid-template-columns:var\(--left-effective\) minmax\(360px,1fr\) var\(--right-effective\)/);
  assert.doesNotMatch(source, /resize[\s\S]{0,240}leftCollapsed\s*=\s*true/i);
  assert.doesNotMatch(source, /resize[\s\S]{0,240}rightCollapsed\s*=\s*true/i);
});

test('v1.9.12 Gemini defaults and catalog are synchronized between Web and Bridge', () => {
  const ai = fs.readFileSync(new URL('../src/ai.js', import.meta.url), 'utf8');
  const bridge = fs.readFileSync(new URL('../bridge/server.mjs', import.meta.url), 'utf8');
  for (const id of ['gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite','gemini-3.1-pro-preview','gemini-3.1-flash-lite','gemini-2.5-pro','gemini-2.5-flash','gemini-2.5-flash-lite']) {
    assert.match(ai, new RegExp(id.replaceAll('.', '\\.')));
    assert.match(bridge, new RegExp(id.replaceAll('.', '\\.')));
  }
  assert.match(ai, /model:\s*'gemini-3\.7-flash'/);
  assert.match(bridge, /model \|\| 'gemini-3\.7-flash'/);
  assert.match(bridge, /nextPageToken/);
  assert.match(bridge, /isGeminiChatModel/);
});

test('v1.9.12 provider defaults remain aligned across direct and bridge paths', () => {
  const ai = fs.readFileSync(new URL('../src/ai.js', import.meta.url), 'utf8');
  const bridge = fs.readFileSync(new URL('../bridge/server.mjs', import.meta.url), 'utf8');
  assert.match(ai, /model:\s*'claude-haiku-4-5'/);
  assert.match(bridge, /model:model \|\| 'claude-haiku-4-5'/);
  assert.match(ai, /model:\s*'grok-3-mini'/);
  assert.match(bridge, /model:model \|\| 'grok-3-mini'/);
});


test('v1.9.13 top and settings text model are a single synchronized source', () => {
  assert.match(source, /function syncCommittedModelEverywhere/);
  assert.match(source, /#openQuickModelPicker, #openSettingsModelPicker/);
  assert.match(source, /id="modelInput"[^>]*readonly/);
  assert.match(source, /syncCommittedModelEverywhere\(next\)/);
  assert.doesNotMatch(source, /else if \(el\.id === 'modelInput'\) state\.settingsDraft\.model/);
});

test('v1.9.13 Settings tab stays visible using assistant container queries', () => {
  const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(css, /container-name:assistant/);
  assert.match(css, /@container assistant \(max-width:390px\)/);
  assert.match(css, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /@container assistant \(max-width:315px\)/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('v1.9.13 Desktop startup fits Windows work area and does not block on Ollama', () => {
  const electron = fs.readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
  const bridge = fs.readFileSync(new URL('../bridge/server.mjs', import.meta.url), 'utf8');
  assert.match(electron, /screen\.getPrimaryDisplay\(\)\.workAreaSize/);
  assert.match(electron, /checkHnlBridge/);
  assert.match(electron, /8787, 8788, 8789, 8790, 8791/);
  assert.match(electron, /await win\.loadURL\(localUrl\(\)\)/);
  assert.match(electron, /ensureOllama\(\)\.catch/);
  assert.match(electron, /child\.once\('error'/);
  assert.match(bridge, /AbortSignal\.timeout\(450\)/);
});
