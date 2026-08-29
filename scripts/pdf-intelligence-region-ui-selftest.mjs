import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0;
const check = fn => { fn(); passed++; };

const index = read('index.html');
const ui = read('src/pdf-intelligence/region-shadow-ui.js');
const css = read('src/pdf-intelligence/region-shadow-ui.css');
const wrapper = read('bridge/server-v127-shadow.mjs');
const shadowServer = read('bridge/pdf-intelligence-shadow-server.mjs');
const electron = read('electron/main.cjs');
const workflow = read('.github/workflows/v127-pdf-intelligence-shadow.yml');
const pkg = read('package.json');
const runtimeSmoke = read('scripts/pdf-intelligence-region-ui-runtime-smoke.mjs');

check(() => assert.match(index, /region-shadow-ui\.js/));
check(() => assert.match(ui, /inspectSelectedPdfRegionInShadow/));
check(() => assert.match(ui, /addEventListener\('pointerup',[\s\S]*true\)/));
check(() => assert.match(ui, /mode:\s*'shadow'/));
check(() => assert.match(ui, /productionMutationAllowed:\s*false/));
check(() => assert.match(ui, /source\.method\s*===\s*'vision-ai'/));
check(() => assert.doesNotMatch(ui, /source\.text\s*=/));
check(() => assert.doesNotMatch(ui, /_hnlSource\s*=/));
check(() => assert.match(ui, /api\/pdf-intelligence\/region-ocr/));
check(() => assert.match(ui, /basePort\s*\+\s*1000/));
check(() => assert.match(css, /pdf-shadow-badge/));
check(() => assert.match(shadowServer, /runDeepDocRegionOcr/));
check(() => assert.match(shadowServer, /SHADOW_ONLY/));
check(() => assert.match(shadowServer, /productionMutationAllowed:\s*false/));
check(() => assert.doesNotMatch(shadowServer, /saveDocument|saveCalculation|saveChatSession/));
check(() => assert.match(wrapper, /server\.mjs/));
check(() => assert.match(wrapper, /startPdfIntelligenceShadowServer/));
check(() => assert.match(electron, /server-v127-shadow\.mjs/));
check(() => assert.match(electron, /fs\.existsSync\(shadowWrapper\)\s*\?\s*shadowWrapper\s*:\s*productionServer/));
check(() => assert.match(workflow, /P3\.1 UI Integration Shadow selftest/));
check(() => assert.match(runtimeSmoke, /HNL PDF Intelligence Shadow/));
check(() => {
  assert.match(pkg, /src\/pdf-intelligence\/contracts\.js/);
  assert.match(pkg, /src\/pdf-intelligence\/deepdoc-vietocr-adapter\.js/);
  assert.match(pkg, /src\/pdf-intelligence\/deepdoc-region-bridge\.js/);
});

assert.equal(passed, 22);
console.log(`PDF INTELLIGENCE P3.1 UI INTEGRATION SHADOW SELFTEST: PASS · ${passed}/22`);
