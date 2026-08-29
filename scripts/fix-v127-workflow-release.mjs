import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const workflows=[
  '.github/workflows/pages.yml',
  '.github/workflows/desktop-win.yml',
  '.github/workflows/pass83-runtime-cert.yml',
  '.github/workflows/rc-final.yml',
  '.github/workflows/v26-spt-input-cert.yml',
  '.github/workflows/master-system-audit.yml',
  '.github/workflows/v127-pdf-intelligence-shadow.yml'
];
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>fs.writeFileSync(path.join(root,p),s.endsWith('\n')?s:`${s}\n`,'utf8');
for(const p of workflows){
  let s=read(p);
  s=s.replaceAll('1.26.0','1.27.0').replaceAll('574','592');
  write(p,s);
}
const manifestPath=path.join(root,'RELEASE_SYNC_MANIFEST.json');
const m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const hash=p=>crypto.createHash('sha256').update(read(p).replace(/\r\n/g,'\n')).digest('hex');
for(const p of Object.keys(m.files||{})){
  if(!fs.existsSync(path.join(root,p))) throw new Error(`Manifest file missing: ${p}`);
  m.files[p]=hash(p);
}
fs.writeFileSync(manifestPath,`${JSON.stringify(m,null,2)}\n`,'utf8');
for(const p of workflows){
  const s=read(p);
  if(s.includes('1.26.0')) throw new Error(`Residual 1.26.0 in ${p}`);
  if(/\b574\b/.test(s)) throw new Error(`Residual 574 in ${p}`);
}
console.log('v1.27 workflow release sync: PASS · no residual 1.26.0/574 · manifest hashes refreshed.');
