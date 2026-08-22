import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

const criticalControls = [
  ['pdfInput', 'uploadPdfs'],
  ['prevPage', 'jumpPage'],
  ['nextPage', 'jumpPage'],
  ['zoomOut', 'setZoom'],
  ['zoomIn', 'setZoom'],
  ['aiSummary', 'aiSummary'],
  ['askBtn', 'askQuestion'],
  ['lookupBtn', 'runLookup'],
  ['tableLookupBtn', 'runTableLookup'],
  ['calcBtn', 'runCalc'],
  ['compareBtn', 'runCompare'],
  ['aiChecklist', 'aiChecklist'],
  ['saveSettings', 'updateSettingsFromForm'],
  ['testConnection', 'testConnection'],
  ['runDiagnostics', 'runDiagnostics']
];

test('critical buttons are present and have handler functions', () => {
  for (const [id, handler] of criticalControls) {
    assert.match(source, new RegExp(`id=\\"${id}\\"|#${id}`), `${id} missing from UI`);
    assert.match(source, new RegExp(handler), `${handler} missing`);
  }
});

test('AI citations remain connected to PDF navigation', () => {
  assert.match(source, /data-hit-doc/);
  assert.match(source, /data-hit-page/);
  assert.match(source, /bindSourceButtons/);
});

test('service worker update avoids stale v1 cache behavior', () => {
  const sw = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(sw, /hnl-pile-ai-v1\.1\.0/);
  assert.match(sw, /req\.mode === 'navigate'/);
  assert.match(sw, /fetch\(req\)/);
});
