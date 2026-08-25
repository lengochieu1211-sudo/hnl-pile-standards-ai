import fs from 'node:fs';
import crypto from 'node:crypto';

// HNL P1 Pass 8.3 source synchronization gate refreshed for V26.
// Release-bound UI/calculation integration files below are intentionally changed by
// V26 AI Input Interpreter + SPT Formula Guard and were certified by the dedicated
// V26 Golden/574/1242/SPT/Vite/Windows workflow before this hash refresh.
// Search Brain / PDF / AI and normative table sources remain independently locked.
const expected = {
  'src/codepack-tables.js':'3118da3c167cdb7a9acac74a83864d564849b173cb8a644cd11849f82d5293fc',
  'src/tcvn10304-table-engine.js':'3e5aab020ac2f910e6301dbb64aa745d3fac12ecd83cbdc3c3d3a2b511ef794f',
  'src/pile-workflows.js':'e47f37b940857e079bb8031d574cc5ea79f84379a0553ecd69f860cd1cf39805',
  'src/excel-export.js':'32048bc31f5c32bfad553479a651998bc32fa7b419e2a9fe7858ffcb533530ea',
  'src/main.js':'b70689d4688480955f90458e70110a4be4bb5c0aeb3f224e454cb46c2b5a34fd',
  'tests/v1.25.6.test.mjs':'22700e80dda3f2f2fc5fcc20554b7f23cf60f383f042f1eee3e19a2922233e06',
  'src/search.js':'f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2',
  'src/pdf.js':'5f9dd85f1c932b49f82def27d0c8c4002825a917c490ff11b3922ff5555b11a3',
  'src/ai.js':'711f9dbe5e2c2e4255a980b8b59fa3fc4b801fad78e5e5dd1b7cd223538a7f11'
};
let fail = 0;
for (const [file, want] of Object.entries(expected)) {
  if (!fs.existsSync(file)) { console.error(`MISSING ${file}`); fail++; continue; }
  const got = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const ok = got === want;
  console.log(`${ok?'PASS':'FAIL'} ${file} ${got}`);
  if (!ok) fail++;
}
if (fail) {
  console.error(`PASS83 SOURCE SYNC GATE: FAIL (${fail})`);
  process.exit(1);
}
console.log('PASS83 SOURCE SYNC GATE: PASS (V26 certified integration source synchronized; Search/PDF/AI preserved)');
