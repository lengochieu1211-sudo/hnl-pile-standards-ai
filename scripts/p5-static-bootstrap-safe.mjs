import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const src = fs.readFileSync('scripts/p5-static-bootstrap.mjs','utf8');
let safe = src;
// GitHub Actions GITHUB_TOKEN here has contents:write but not workflows permission.
// Strip all workflow-file mutations from the temporary execution copy; connector writes handle workflows afterward.
safe = safe.replace(/const finalWorkflow=`[\s\S]*?write\('\.github\/workflows\/p5-static-load-golden\.yml',finalWorkflow\);\n\n/, '');
safe = safe.replace("manifest.files['.github/workflows/p5-static-load-golden.yml']=sha('.github/workflows/p5-static-load-golden.yml');\n", '');
safe = safe.replace("fs.rmSync('scripts/p5-static-bootstrap.mjs');\n", '');
safe = safe.replace("fs.rmSync('.github/workflows/p5-static-bootstrap.yml');\n", '');
fs.writeFileSync('/tmp/p5-static-bootstrap-safe-exec.mjs', safe, 'utf8');
const r = spawnSync(process.execPath, ['/tmp/p5-static-bootstrap-safe-exec.mjs'], {stdio:'inherit'});
process.exit(r.status ?? 1);
