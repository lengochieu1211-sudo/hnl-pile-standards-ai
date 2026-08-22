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
  ['compareBtn', 'runCompare'],
  ['copyChecklist', 'copyChecklist'],
  ['resetChecklist', 'resetChecklist'],
  ['aiChecklist', 'aiChecklist'],
  ['saveSettings', 'updateSettingsFromForm'],
  ['testConnection', 'testConnection'],
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

test('service worker uses v1.4 cache and network-first navigation', () => {
  const sw = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(sw, /hnl-pile-ai-v1\.4\.0/);
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
