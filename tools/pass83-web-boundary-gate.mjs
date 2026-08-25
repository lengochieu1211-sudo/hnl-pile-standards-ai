import fs from 'node:fs';

const pass6 = fs.readFileSync('src/pass6-structural-workflow.js', 'utf8');
const csv = fs.readFileSync('src/structural-csv-importer.js', 'utf8');
const csi = fs.readFileSync('src/csi-live-bridge.js', 'utf8');

const failures = [];
if (/from\s+['"]\.\/csi-live-bridge\.js['"]/.test(pass6)) {
  failures.push('Pass 6 must not import Node-only csi-live-bridge.js in browser graph');
}
if (!/from\s+['"]\.\/structural-csv-importer\.js['"]/.test(pass6)) {
  failures.push('Pass 6 must import browser-safe structural-csv-importer.js');
}
if (/node:(fs|child_process|util|path|os)/.test(csv)) {
  failures.push('structural-csv-importer.js must remain browser-safe and contain no Node built-ins');
}
if (!/export\s+\{\s*parseCsvText\s*,\s*importStructuralCsvBundle\s*\}\s+from\s+['"]\.\/structural-csv-importer\.js['"]/.test(csi)) {
  failures.push('csi-live-bridge.js must preserve legacy CSV exports via browser-safe adapter');
}

if (failures.length) {
  for (const x of failures) console.error(`FAIL ${x}`);
  process.exit(1);
}
console.log('PASS83 WEB BOUNDARY GATE: PASS (browser graph excludes Node-only CSi runtime; CSV adapter remains compatible)');
