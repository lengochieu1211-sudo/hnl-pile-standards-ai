import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createPass82DefaultDraft, runPass82UiCalculation, checkPass82Exporter, exportPass82Excel } from '../src/pass82-ui-controller.js';
import { handlePass81ExcelExport } from '../server/pass81-excel-route.mjs';
import { readZip } from '../src/pass81-zip.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const readJson=n=>JSON.parse(fs.readFileSync(path.join(root,'artifacts',n),'utf8'));
const fixture=readJson('p1-pass5-dce-table-bundle-fixture-v13.json');
const p7=readJson('p1-pass7-full-calculation-golden-v18.json');
const c=p7.capacityInput;

function draft(){return {...createPass82DefaultDraft(),constructionMethod:'driven',shape:'square',sideMm:400,lengthM:12,tipDepthM:12,shaftStartDepthM:0,maxSegmentM:2,gammaN:1.15,mechanicalGammaK:1.4,sptGammaK:1.5,grade:'B30',steel:'CB400-V',AsTotMm2:1600,L0Mm:4000,e0Mm:400/30,boreholes:c.boreholes,combinationIdsText:'EULS'};}
function structural(){return {kind:'DCE_TABLES',tables:fixture.tables,sourceId:'PASS82_PRODUCTION_UI_E2E',nodalReactionCompressionSign:'compression-positive',pierForceCompressionSign:'compression-negative'};}
const close=(a,b,t=1e-10)=>Math.abs(Number(a)-Number(b))<=Math.max(t,t*Math.max(1,Math.abs(Number(a)),Math.abs(Number(b))));

async function withExporter(fn){
  const server=http.createServer(async(req,res)=>{
    if(req.method==='GET'&&req.url==='/api/hnl/pile/export-health'){
      res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,version:'Pass8.2-v21'}));return;
    }
    if(req.method==='POST'&&req.url==='/api/hnl/pile/export-excel'){await handlePass81ExcelExport(req,res);return;}
    res.writeHead(404);res.end();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const addr=server.address(); const base=`http://127.0.0.1:${addr.port}`;
  try{return await fn(base);}finally{await new Promise(resolve=>server.close(resolve));}
}

test('Pass8.2 production controller runs exact Golden from user inputs',()=>{
  const x=runPass82UiCalculation({draft:draft(),structural:structural()});
  assert.equal(x.view.steps.length,8); assert.equal(x.view.statusVi,'ĐẠT');
  assert.ok(close(x.output.result.summary.RsoilKn,843.4285714285716));
  assert.ok(close(x.output.result.summary.RmaterialKn,2952));
  assert.ok(close(x.output.result.summary.RpileKn,843.4285714285716));
  assert.ok(close(x.output.result.summary.NdMaxPerPileKn,733.4161490683232));
  assert.equal(x.output.result.summary.governingPileId,'168'); assert.equal(x.output.result.summary.governingCombinationId,'EULS');
});

test('Pass8.2 actual HTTP health + export + reopen workbook equals Golden',async()=>withExporter(async base=>{
  const x=runPass82UiCalculation({draft:draft(),structural:structural()});
  const health=await checkPass82Exporter({bridgeUrl:base}); assert.equal(health.ok,true);
  const exported=await exportPass82Excel({output:x.output,bridgeUrl:base});
  assert.equal(exported.serverVerified,true); assert.match(exported.fileName,/\.xlsx$/);
  const buffer=Buffer.from(await exported.blob.arrayBuffer()); assert.equal(buffer.subarray(0,2).toString(),'PK');
  const entries=readZip(buffer);
  const summary=entries.get('xl/worksheets/sheet2.xml').data.toString('utf8');
  const check=entries.get('xl/worksheets/sheet9.xml').data.toString('utf8');
  const guide=entries.get('xl/worksheets/sheet1.xml').data.toString('utf8');
  assert.match(summary,/843\.4285714285716/); assert.match(summary,/2952/); assert.match(summary,/733\.4161490683232/);
  assert.match(summary,/>168<\/x:v>/); assert.match(summary,/>EULS<\/x:v>/); assert.match(summary,/0\.4980692764464232/); assert.match(summary,/>ĐẠT<\/x:v>/);
  assert.match(check,/>EULS<\/x:v>/); assert.match(guide,/DYNAMIC_EXPORT_FROM_SERVER_VERIFIED_RESULT/);
}));

test('Pass8.2 dynamic endpoint blocks tampered client summary',async()=>withExporter(async base=>{
  const x=runPass82UiCalculation({draft:draft(),structural:structural()});
  const bad=structuredClone(x.output); bad.excelExport.payload.clientSummary.RpileKn=999999;
  await assert.rejects(()=>exportPass82Excel({output:bad,bridgeUrl:base}),/client\/server không khớp/i);
}));

test('production main UI is wired to Pass8.2 controller and exact button IDs',()=>{
  const src=fs.readFileSync(path.join(root,'src/main.js'),'utf8');
  assert.match(src,/pass82-ui-controller\.js/); assert.match(src,/pass8-structural-file-parser\.js/);
  for(const id of ['pass8CalculateBtn','pass8ExportBtn','pass8StructuralFile','pass8ExporterHealthBtn']) assert.match(src,new RegExp(id));
  assert.match(src,/state\.settings\.bridgeUrl/); assert.match(src,/pass8OneClickHtml\(\)/);
});

test('production bridge exposes exact dynamic Excel endpoints',()=>{
  const src=fs.readFileSync(path.join(root,'bridge/server.mjs'),'utf8');
  assert.match(src,/executePass81Export/); assert.match(src,/\/api\/hnl\/pile\/export-health/); assert.match(src,/\/api\/hnl\/pile\/export-excel/); assert.match(src,/x-hnl-server-verified/);
});

test('desktop build packages server route and Vietnamese v18 template',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  assert.ok(pkg.build.files.includes('server/**/*')); assert.ok(pkg.build.files.includes('bridge/**/*'));
  assert.ok(fs.existsSync(path.join(root,'bridge/templates/HNL_P1_Pass7_Bao_Cao_Tinh_Toan_Coc_San_Xuat_v18.xlsx')));
});

test('Search Brain/PDF/AI are byte-identical to pre-merge full source baseline',()=>{
  const expected={
    'src/search.js':'f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2',
    'src/pdf.js':'5f9dd85f1c932b49f82def27d0c8c4002825a917c490ff11b3922ff5555b11a3',
    'src/ai.js':'711f9dbe5e2c2e4255a980b8b59fa3fc4b801fad78e5e5dd1b7cd223538a7f11'
  };
  for(const [file,sha] of Object.entries(expected)){
    const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'); assert.equal(actual,sha,file);
  }
});

test('Pass8.2 UI controller contains no engineering child-engine calls',()=>{
  const src=fs.readFileSync(path.join(root,'src/pass82-ui-controller.js'),'utf8');
  for(const forbidden of ['calculateMultiBoreholePileCapacity','calculateDrivenPile10304','calculateSptPile10304','checkImportedNodalPileReactionEnvelope']) assert.equal(src.includes(forbidden),false,forbidden);
  assert.match(src,/runPass8OneClickCalculation/);
});
