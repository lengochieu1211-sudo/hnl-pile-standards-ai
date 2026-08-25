import fs from 'node:fs';
import crypto from 'node:crypto';

const expected = {
  'src/codepack-tables.js':'3118da3c167cdb7a9acac74a83864d564849b173cb8a644cd11849f82d5293fc',
  'src/tcvn10304-table-engine.js':'3e5aab020ac2f910e6301dbb64aa745d3fac12ecd83cbdc3c3d3a2b511ef794f',
  'src/pile-workflows.js':'23338c7e3926d288baabf2cad2fbc2c5aa563e060b859fa1e2b2f42c77c4dedb',
  'src/excel-export.js':'cb0956addf7474f5bf98d799b875145b12dc7f75a904e576a715803aab956680',
  'src/main.js':'74a50f38786415f0eec56da0855f2b1bb14fa362c9d055c9edd459eb3eed7942',
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
console.log('PASS83 SOURCE SYNC GATE: PASS (critical source synchronized; Search/PDF/AI preserved)');
