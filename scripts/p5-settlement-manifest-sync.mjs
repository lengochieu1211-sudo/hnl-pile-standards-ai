import fs from 'node:fs';
import crypto from 'node:crypto';
const manifestPath='RELEASE_SYNC_MANIFEST.json';
const targets=[
  'src/tcvn10304-advanced.js',
  'tools/pass83-test-count-gate.mjs',
  'tests/p5-settlement-promotion.test.mjs',
  '.github/workflows/p5-settlement-golden.yml',
  'docs/P5.5-SETTLEMENT-PROMOTION-EVIDENCE.md'
];
const m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
for(const file of targets){
  if(!fs.existsSync(file)) throw new Error(`Missing target: ${file}`);
  const sha=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  m.files[file]=sha;
  console.log(`${file} ${sha}`);
}
fs.writeFileSync(manifestPath,JSON.stringify(m,null,2)+'\n','utf8');
