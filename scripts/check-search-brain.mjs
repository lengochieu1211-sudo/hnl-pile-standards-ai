import fs from 'node:fs';
import crypto from 'node:crypto';
const EXPECTED='f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2';
const raw=fs.readFileSync(new URL('../src/search.js',import.meta.url),'utf8');
const normalized=raw.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
const actual=crypto.createHash('sha256').update(normalized,'utf8').digest('hex');
if(actual!==EXPECTED){console.error(`SEARCH BRAIN FAIL: normalized SHA-256 ${actual} != ${EXPECTED}`);process.exit(1);}
console.log(`SEARCH BRAIN PASS: normalized SHA-256 ${actual}; line endings do not affect guard.`);
