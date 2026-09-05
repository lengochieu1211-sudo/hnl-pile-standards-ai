import fs from 'node:fs';
import crypto from 'node:crypto';

// HNL P1 Pass 8.3 source synchronization gate refreshed through P5.2 CPT promotion.
// Release-bound integration hashes are changed only after dedicated exact-head Golden
// certification. Search Brain / PDF / AI and normative table sources remain independently locked.
const expected = {
  'src/codepack-tables.js':'3118da3c167cdb7a9acac74a83864d564849b173cb8a644cd11849f82d5293fc',
  'src/tcvn10304-table-engine.js':'3e5aab020ac2f910e6301dbb64aa745d3fac12ecd83cbdc3c3d3a2b511ef794f',
  'src/pile-workflows.js':'7a30166a35026c0c6e01069ba586a2ca73b2ac14e90d4796c776b58b4ddceb5a',
  'src/excel-export.js':'c611cbb5243b1530366eee0913473b66c025cd430dc2db5f25ce7e9416baaefb',
  'src/main.js':'b70689d4688480955f90458e70110a4be4bb5c0aeb3f224e454cb46c2b5a34fd',
  'tests/v1.25.6.test.mjs':'22700e80dda3f2f2fc5fcc20554b7f23cf60f383f042f1eee3e19a2922233e06',
  'src/search.js':'f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2',
  'src/pdf.js':'5f9dd85f1c932b49f82def27d0c8c4002825a917c490ff11b3922ff5555b11a3',
  'src/ai.js':'711f9dbe5e2c2e4255a980b8b59fa3fc4b801fad78e5e5dd1b7cd223538a7f11',
  'src/pile-geometry-engine.js':'6ea077c65c98d6649060a8c4ddfd76095679efa7bb16c5ee9c0f32e995e22561',
  'src/engineering-input-interpreter.js':'a62e4d2550584caf19a600c204e90ed7b2a32af77fe0012ebaf3f993e98df45d',
  'src/engineering-router.js':'236442d07a8ade6303e6e9aa0038b083776ad1cc13c8282e77dfdae7cdaf54eb',
  'src/spt-shared-spec.js':'6e59289ddd2b74d2f6478cf8e323a18e1f62d8c86cbaa76eeadacec026d0aff8'

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
console.log('PASS83 SOURCE SYNC GATE: PASS (P5.2 CPT-certified integration source synchronized; Search/PDF/AI preserved)');
