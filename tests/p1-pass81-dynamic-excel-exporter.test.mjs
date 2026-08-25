import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPass8OneClickCalculation, buildPass8ExcelExportContract } from '../src/pass8-workflow-router.js';
import { exportPass81WorkbookBuffer, PASS81_EXCEL_EXPORTER_STATUS } from '../src/pass81-v18-dynamic-exporter.js';
import { readZip, writeZip } from '../src/pass81-zip.js';
import { compareClientSummary, executePass81Export, PASS81_ROUTE_STATUS } from '../server/pass81-excel-route.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const a=(n)=>path.join(root,'artifacts',n);
const g=JSON.parse(fs.readFileSync(a('p1-pass7-full-calculation-golden-v18.json'),'utf8'));
const f=JSON.parse(fs.readFileSync(a('p1-pass5-dce-table-bundle-fixture-v13.json'),'utf8'));
const c=g.capacityInput;
const request={pile:{constructionMethod:'driven',shape:'square',sideMm:c.pileInput.sideM*1000,lengthM:c.pileInput.lengthM,tipDepthM:c.pileInput.tipDepthM,shaftStartDepthM:c.pileInput.shaftStartDepthM,maxSegmentM:c.pileInput.maxSegmentM},soil:{mechanicalGammaK:c.mechanicalInput.gammaK,sptGammaK:c.sptInput.gammaK,boreholes:c.boreholes,mechanicalInput:c.mechanicalInput,sptInput:c.sptInput},material:{...c.materialInput},design:{gammaN:c.gammaN},structural:{kind:'DCE_TABLES',tables:f.tables,sourceId:'PASS81_TEST',nodalReactionCompressionSign:'compression-positive',pierForceCompressionSign:'compression-negative'},combinationIds:['EULS']};
const out=runPass8OneClickCalculation(request);
const clientSummary={...out.excelExport.payload.clientSummary};
const template=fs.readFileSync(a('HNL_P1_Pass7_Bao_Cao_Tinh_Toan_Coc_San_Xuat_v18.xlsx'));

test('Pass 8.1 export contract posts request + summary, not trusted full result',()=>{
  const x=buildPass8ExcelExportContract(out.result,request);
  assert.equal(x.payload.schema,'HNL-P1-PASS8.1-EXCEL-EXPORT-REQUEST');
  assert.ok(x.payload.request);
  assert.ok(x.payload.clientSummary);
  assert.equal('result' in x.payload,false);
  assert.equal('report' in x.payload,false);
});

test('ZIP reader/writer roundtrip preserves workbook core entries',()=>{
  const e=readZip(template); const b=writeZip(e); const e2=readZip(b);
  for(const n of ['[Content_Types].xml','xl/workbook.xml','xl/worksheets/sheet2.xml']) assert.deepEqual(e2.get(n).data,e.get(n).data);
});

test('dynamic exporter rejects any template other than exact v18 hash',()=>{
  const bad=Buffer.from(template); bad[bad.length-1]^=1;
  assert.throws(()=>exportPass81WorkbookBuffer({templateBuffer:bad,request,pass8Output:out}),/Sai template v18 SHA-256/);
});

test('dynamic exporter writes server result into Vietnamese v18 workbook',()=>{
  const x=exportPass81WorkbookBuffer({templateBuffer:template,request,pass8Output:out,exportId:'TEST-EXPORT-ID',generatedAt:'2026-08-25T12:00:00.000Z'});
  assert.equal(x.buffer.subarray(0,2).toString(),'PK');
  const e=readZip(x.buffer);
  const summary=e.get('xl/worksheets/sheet2.xml').data.toString('utf8');
  const check=e.get('xl/worksheets/sheet9.xml').data.toString('utf8');
  const guide=e.get('xl/worksheets/sheet1.xml').data.toString('utf8');
  const material=e.get('xl/worksheets/sheet6.xml').data.toString('utf8');
  assert.match(summary,/843\.4285714285716/);
  assert.match(summary,/733\.4161490683232/);
  assert.match(summary,/>168<\/x:v>/);
  assert.match(check,/>EULS<\/x:v>/);
  assert.match(guide,/TEST-EXPORT-ID/);
  assert.doesNotMatch(material,/&amp;lt;/);
});

test('exporter does not import or call engineering child engines directly',()=>{
  const src=fs.readFileSync(path.join(root,'src/pass81-v18-dynamic-exporter.js'),'utf8');
  for(const forbidden of ['calculateMultiBoreholePileCapacity','calculateDrivenPile10304','calculateSptPile10304','checkImportedNodalPileReactionEnvelope']) assert.equal(src.includes(forbidden),false,forbidden);
  assert.match(src,/không tính lại công thức kỹ thuật/i);
});

test('client/server summary comparison passes exact calculation',()=>{
  const cmp=compareClientSummary(clientSummary,out); assert.equal(cmp.pass,true); assert.deepEqual(cmp.issues,[]);
});

test('client/server summary comparison blocks tampered Rpile',()=>{
  const cmp=compareClientSummary({...clientSummary,RpileKn:999999},out); assert.equal(cmp.pass,false); assert.match(cmp.issues.join(' '),/RpileKn/);
});

test('executePass81Export reruns Pass 8 server-side and returns verified XLSX',()=>{
  const body={schema:'HNL-P1-PASS8.1-EXCEL-EXPORT-REQUEST',version:'1.25.7',request,clientSummary,templateVersion:'v18'};
  const x=executePass81Export(body); assert.equal(x.compare.pass,true); assert.ok(x.buffer.length>100000); assert.equal(x.serverOut.result.summary.governingPileId,'168'); assert.equal(x.templateSha256,PASS81_EXCEL_EXPORTER_STATUS.templateSha256);
});

test('executePass81Export blocks tampered client summary',()=>{
  const body={schema:'HNL-P1-PASS8.1-EXCEL-EXPORT-REQUEST',version:'1.25.7',request,clientSummary:{...clientSummary,NdMaxPerPileKn:1},templateVersion:'v18'};
  assert.throws(()=>executePass81Export(body),/client\/server không khớp/i);
});

test('Pass 8.1 route remains the exact UI endpoint',()=>{
  assert.equal(PASS81_ROUTE_STATUS.endpoint,'/api/hnl/pile/export-excel'); assert.equal(PASS81_ROUTE_STATUS.method,'POST'); assert.equal(PASS81_ROUTE_STATUS.clientServerSummaryCheck,'MANDATORY');
});
