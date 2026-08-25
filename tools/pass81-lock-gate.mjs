import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runPass8OneClickCalculation } from '../src/pass8-workflow-router.js';
import { executePass81Export } from '../server/pass81-excel-route.mjs';
import { readZip } from '../src/pass81-zip.js';
import { PASS81_EXCEL_EXPORTER_STATUS } from '../src/pass81-v18-dynamic-exporter.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const art=path.join(root,'artifacts');
const runtime=path.join(art,'pass81-runtime');
fs.mkdirSync(runtime,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=n=>JSON.parse(fs.readFileSync(path.join(art,n),'utf8'));
const base=read('p1-pass81-export-request-golden-v20.json');
const templatePath=path.join(art,'HNL_P1_Pass7_Bao_Cao_Tinh_Toan_Coc_San_Xuat_v18.xlsx');
const template=fs.readFileSync(templatePath);
const checks=[];
const add=(name,ok,detail)=>checks.push({name,status:ok?'PASS':'FAIL',detail});

// 1) Full current regression.
const tr=spawnSync(process.execPath,['--test','tests/*.test.mjs'],{cwd:root,shell:true,encoding:'utf8'});
const stdout=tr.stdout??'';
const num=(label)=>Number(stdout.match(new RegExp(`# ${label} (\\d+)`))?.[1]??NaN);
const tests=num('tests'), pass=num('pass'), fail=num('fail');
add('CURRENT_NODE_REGRESSION',tr.status===0&&tests>=188&&pass===tests&&fail===0,{tests,pass,fail,status:tr.status});
fs.writeFileSync(path.join(art,'p1-pass81-test-v20.log'),stdout+'\n'+(tr.stderr??''));

// 2) Exact template hash.
const templateSha=sha(template);
add('TEMPLATE_V18_SHA256',templateSha===PASS81_EXCEL_EXPORTER_STATUS.templateSha256,{actual:templateSha,expected:PASS81_EXCEL_EXPORTER_STATUS.templateSha256});

// 3) Server-side golden export.
const golden=executePass81Export(base,{templatePath});
const goldenPath=path.join(art,'HNL_P1_Pass8_1_Dynamic_Excel_Golden_v20.xlsx');
fs.writeFileSync(goldenPath,golden.buffer);
const entries=readZip(golden.buffer);
const summaryXml=entries.get('xl/worksheets/sheet2.xml').data.toString('utf8');
const guideXml=entries.get('xl/worksheets/sheet1.xml').data.toString('utf8');
const s=golden.serverOut.result.summary;
const hasGolden=[s.RsoilKn,s.RmaterialKn,s.RpileKn,s.gammaN,s.NdMaxPerPileKn,s.governingUtilization].every(v=>summaryXml.includes(String(v)))
  && summaryXml.includes(`>${s.governingPileId}</x:v>`) && summaryXml.includes(`>${s.governingCombinationId}</x:v>`)
  && guideXml.includes(golden.exportId);
add('DYNAMIC_GOLDEN_XLSX_SERVER_VERIFIED',hasGolden&&golden.compare.pass===true,{summary:s,exportId:golden.exportId,sha256:sha(golden.buffer),bytes:golden.buffer.length});

// 4) Dynamic variant: gammaN 1.20 must change results, not template/style identity.
const req2=structuredClone(base.request); req2.design.gammaN=1.20;
const out2=runPass8OneClickCalculation(req2); const s2=out2.result.summary;
const body2={...base,request:req2,clientSummary:{RsoilKn:s2.RsoilKn,RmaterialKn:s2.RmaterialKn,RpileKn:s2.RpileKn,gammaN:s2.gammaN,NdMaxPerPileKn:s2.NdMaxPerPileKn,boreholeBranches:s2.boreholeBranches,pileChecks:s2.pileChecks,governingPileId:s2.governingPileId,governingCombinationId:s2.governingCombinationId,governingUtilization:s2.governingUtilization,conclusion:out2.result.conclusion.statusVi}};
const variant=executePass81Export(body2,{templatePath});
const variantPath=path.join(runtime,'HNL_Dynamic_Variant_GammaN_1_20_v20.xlsx'); fs.writeFileSync(variantPath,variant.buffer);
const expectedNd=s2.RpileKn/1.20;
const variantPass=Math.abs(s2.NdMaxPerPileKn-expectedNd)<1e-9 && Math.abs(s2.NdMaxPerPileKn-s.NdMaxPerPileKn)>1e-6 && Math.abs(s2.governingUtilization-s.governingUtilization)>1e-9 && sha(variant.buffer)!==sha(golden.buffer);
add('TRUE_DYNAMIC_VARIANT_GAMMAN_1_20',variantPass,{base:{gammaN:s.gammaN,NdMaxPerPileKn:s.NdMaxPerPileKn,governingUtilization:s.governingUtilization,sha256:sha(golden.buffer)},variant:{gammaN:s2.gammaN,NdMaxPerPileKn:s2.NdMaxPerPileKn,governingUtilization:s2.governingUtilization,sha256:sha(variant.buffer)}});

// 5) Runtime HTTP endpoint + tamper blocking.
const port=18891;
const child=spawn(process.execPath,['server/pass81-http-server.mjs'],{cwd:root,env:{...process.env,HNL_PASS81_PORT:String(port)},stdio:['ignore','pipe','pipe']});
let serverLog=''; child.stdout.on('data',d=>serverLog+=d); child.stderr.on('data',d=>serverLog+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitHealth(){for(let i=0;i<40;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/hnl/pile/export-health`);if(r.ok)return await r.json();}catch{}await sleep(100);}throw new Error('HTTP server health timeout');}
try{
  const health=await waitHealth();
  const okRes=await fetch(`http://127.0.0.1:${port}/api/hnl/pile/export-excel`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(base)});
  const okBuf=Buffer.from(await okRes.arrayBuffer());
  const httpPass=okRes.status===200&&okRes.headers.get('x-hnl-server-verified')==='true'&&okRes.headers.get('x-hnl-template-sha256')===templateSha&&okBuf.subarray(0,2).toString()==='PK';
  add('HTTP_ENDPOINT_REAL_XLSX',httpPass,{status:okRes.status,serverVerified:okRes.headers.get('x-hnl-server-verified'),exportId:okRes.headers.get('x-hnl-export-id'),templateSha256:okRes.headers.get('x-hnl-template-sha256'),bytes:okBuf.length,health});
  fs.writeFileSync(path.join(runtime,'HNL_HTTP_Export_Golden_v20.xlsx'),okBuf);
  const tampered=structuredClone(base); tampered.clientSummary.RpileKn=999999;
  const bad=await fetch(`http://127.0.0.1:${port}/api/hnl/pile/export-excel`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(tampered)});
  const badText=await bad.text();
  add('HTTP_TAMPERED_RESULT_BLOCKED',bad.status===422&&/PASS81_EXPORT_BLOCKED|client\/server không khớp/i.test(badText),{status:bad.status,response:badText.slice(0,500)});
} finally { child.kill('SIGTERM'); await sleep(150); fs.writeFileSync(path.join(runtime,'server-gate.log'),serverLog); }

// 6) Architectural boundaries.
const exporterSrc=fs.readFileSync(path.join(root,'src/pass81-v18-dynamic-exporter.js'),'utf8');
const uiSrc=fs.readFileSync(path.join(root,'ui/pass8/app.js'),'utf8');
const forbidden=['calculateMultiBoreholePileCapacity','calculateDrivenPile10304','calculateSptPile10304','checkImportedNodalPileReactionEnvelope'];
add('EXPORTER_NO_ENGINE_DUPLICATION',forbidden.every(x=>!exporterSrc.includes(x)),{forbidden});
add('UI_CALLS_REAL_EXPORT_ENDPOINT',/requestPass8VietnameseExcel/.test(uiSrc)&&/export-health/.test(uiSrc),{endpoint:'/api/hnl/pile/export-excel'});
add('NO_EXTERNAL_RUNTIME_DEPENDENCIES',!fs.existsSync(path.join(root,'node_modules'))&&Object.keys(JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).dependencies??{}).length===0,{nodeBuiltinsOnly:true});

// 7) Prior locked gates carried forward.
const oldGate=read('gate-status-v1.25.7.json').pureNode??{};
add('PRIOR_REGRESSION_388',oldGate.regression?.status==='PASS'&&oldGate.regression?.passed===388&&oldGate.regression?.failed===0,oldGate.regression);
add('PRIOR_FULL_TABLE_1242',oldGate.fullTableGolden?.status==='PASS'&&oldGate.fullTableGolden?.passed===1242&&oldGate.fullTableGolden?.failed===0,oldGate.fullTableGolden);
add('PRIOR_SEARCH_BRAIN',oldGate.searchBrain?.status==='PASS'&&oldGate.searchBrain?.sha256==='f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2',oldGate.searchBrain);

const failed=checks.filter(x=>x.status!=='PASS');
const gate={schema:'HNL-P1-PASS8.1-DYNAMIC-EXCEL-LOCK-GATE',version:'1.25.7',pass:failed.length===0,status:failed.length===0?'CORE_LOCKED_DYNAMIC_EXCEL_EXPORTER':'BLOCKED',generatedAt:new Date().toISOString(),checks,failed:failed.map(x=>x.name),scope:'Scoped patch runtime: Pass8 UI + local HTTP endpoint + server-side router rerun + v18 dynamic OOXML exporter.',fullSourceMerge:'NOT_CLAIMED_SEPARATE_GATE'};
fs.writeFileSync(path.join(art,'P1_PASS8_1_DYNAMIC_EXCEL_LOCK_GATE_V20.json'),JSON.stringify(gate,null,2));
console.log(JSON.stringify(gate,null,2));
process.exitCode=gate.pass?0:2;
