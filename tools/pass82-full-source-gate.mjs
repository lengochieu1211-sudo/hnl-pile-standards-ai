import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const art=path.join(root,'artifacts'); fs.mkdirSync(art,{recursive:true});
const sh=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const expected={
  'src/search.js':'f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2',
  'src/pdf.js':'5f9dd85f1c932b49f82def27d0c8c4002825a917c490ff11b3922ff5555b11a3',
  'src/ai.js':'711f9dbe5e2c2e4255a980b8b59fa3fc4b801fad78e5e5dd1b7cd223538a7f11'
};
const checks=[]; const add=(name,ok,detail={})=>checks.push({name,status:ok?'PASS':'FAIL',detail});
function run(name,cmd){
  const r=spawnSync('bash',['-lc',cmd],{cwd:root,encoding:'utf8',env:{...process.env,TERM:'xterm'}});
  fs.writeFileSync(path.join(art,`pass82-${name}.log`),(r.stdout||'')+(r.stderr||''));
  add(name,r.status===0,{exitCode:r.status,log:`artifacts/pass82-${name}.log`});
  return r;
}
for(const [f,h] of Object.entries(expected)) add(`IMMUTABLE_${f}`,sh(f)===h,{actual:sh(f),expected:h});
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
add('DESKTOP_PACKAGES_SERVER_ROUTE',pkg.build?.files?.includes('server/**/*')===true,{files:pkg.build?.files});
add('VIETNAMESE_TEMPLATE_PACKAGED',fs.existsSync(path.join(root,'bridge/templates/HNL_P1_Pass7_Bao_Cao_Tinh_Toan_Coc_San_Xuat_v18.xlsx')));
const main=fs.readFileSync(path.join(root,'src/main.js'),'utf8'); const bridge=fs.readFileSync(path.join(root,'bridge/server.mjs'),'utf8');
add('PRODUCTION_UI_WIRING',['pass8CalculateBtn','pass8ExportBtn','pass8StructuralFile','pass82-ui-controller.js'].every(x=>main.includes(x)));
add('PRODUCTION_BRIDGE_WIRING',bridge.includes("/api/hnl/pile/export-excel")&&bridge.includes('executePass81Export')&&bridge.includes('x-hnl-server-verified'));
const tmpl=fs.readFileSync(path.join(root,'bridge/templates/HNL_P1_Pass7_Bao_Cao_Tinh_Toan_Coc_San_Xuat_v18.xlsx'));
add('TEMPLATE_V18_SHA',crypto.createHash('sha256').update(tmpl).digest('hex')==='582e897788d3aa96895f7ff63e604899ad489cbe2d5fb59238bb186a4b62b9d1',{actual:crypto.createHash('sha256').update(tmpl).digest('hex')});
const node=run('node-full-suite','node --test tests/*.test.mjs');
const mt=(node.stdout||'').match(/# tests (\d+)[\s\S]*?# pass (\d+)[\s\S]*?# fail (\d+)/); if(mt) checks.find(x=>x.name==='node-full-suite').detail.summary={tests:+mt[1],pass:+mt[2],fail:+mt[3]};
run('search-gate','npm run check:search');
run('version-gate','npm run check:version');
run('golden-tables','npm run golden:tables');
run('golden-workflows','npm run golden:workflows');
run('golden-material','npm run golden:material');
run('golden-dce-udf','npm run golden:dce-udf');
run('golden-spt','npm run golden:spt-decision');
run('golden-material-e2e','npm run golden:material-e2e');
run('golden-multiborehole','npm run golden:multiborehole');
run('pass4-fingerprint-python','python tests/p1-pass4-fingerprint-extractor.test.py');
const viteExists=fs.existsSync(path.join(root,'node_modules/.bin/vite'));
const runtime={webBuild:viteExists?'NOT_RUN_BY_SOURCE_GATE':'ENVIRONMENT_BLOCKED_NO_NODE_MODULES_VITE',electronRuntime:'NOT_RUN_LINUX_SANDBOX',windowsRuntime:'NOT_RUN_LINUX_SANDBOX'};
const failed=checks.filter(x=>x.status!=='PASS');
const result={
  schema:'HNL-P1-PASS8.2-FULL-SOURCE-PRODUCTION-UI-E2E-GATE',version:'1.25.7',release:'v21',generatedAt:new Date().toISOString(),
  base:{repository:'lengochieu1211-sudo/hnl-pile-standards-ai',githubMainObservedCommit:'0e956d36cbb63c45c24978993bf50da68d43d883',fullSourceBase:'P1 Pass2 full app + Pass3–8.1 locked overlays'},
  checks,pass:failed.length===0,failed:failed.map(x=>x.name),sourceMergeStatus:failed.length?'BLOCKED':'FULL_SOURCE_MERGED_SOURCE_LOCKED',runtimeCertification:runtime,
  invariant:'Pass 8.2 adds UI/route orchestration only; engineering values remain in locked Pass 7 and child engines. Search Brain/PDF/AI are byte-identical to pre-merge baseline.'
};
fs.writeFileSync(path.join(art,'P1_PASS8_2_FULL_SOURCE_PRODUCTION_UI_E2E_GATE_V21.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
process.exitCode=result.pass?0:2;
