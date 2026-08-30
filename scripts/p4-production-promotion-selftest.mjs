import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createP4ExtractionPacket, compileSafeExcelFormula, classifyP4Trust } from '../src/p4-pdf-excel-intelligence.js';
import { createP4ReviewConfirmation, validateP4ReviewConfirmation } from '../src/pdf-excel-intelligence/confirmation-contract.js';
import { evaluateP4ReviewProductionExport } from '../src/pdf-excel-intelligence/review-production-export.js';

const SHA=String(process.env.HNL_SOURCE_SHA||'42139bb2bc889eb329c7fc1813f50c1124b26472');
const cases=[];
function run(name,fn){try{fn();cases.push({name,state:'PASS'});console.log(`PASS ${name}`);}catch(error){cases.push({name,state:'FAIL',error:String(error?.stack||error)});console.error(`FAIL ${name}`,error);}}
function source(extra={}){return {file:'TCVN.pdf',documentId:'doc-1',standard:'TCVN',page:10,bbox:[.1,.1,.9,.5],sourceType:'pdf-native',engine:'pdfjs-native-region',route:'native',state:'VERIFIED',status:'VERIFIED',confidence:1,confidenceUsable:true,userConfirmed:false,sourceSha:SHA,fingerprint:'fixture-doc-1',...extra};}
function packet(extraSource={},text='D = 600 mm'){return createP4ExtractionPacket({provenance:source(extraSource),text});}
function confirm(p,value=p.text,extra={}){return createP4ReviewConfirmation({source:p.source,fieldKey:'__packet__',value,confirmedBy:'user',confirmedAt:new Date().toISOString(),...extra});}

run('verified native + bound confirmation => exporter candidate ready',()=>{
  const p=packet(),c=confirm(p),g=evaluateP4ReviewProductionExport(p,c,{fieldKey:'__packet__',value:p.text});
  assert.equal(g.ready,true);assert.equal(g.workbookProductionExportAllowed,true);assert.equal(g.calculationEngineMutationAllowed,false);assert.equal(g.productionMutationAllowed,false);
});
run('raw boolean userConfirmed without confirmation record is not enough',()=>{
  const p=packet({userConfirmed:true}),g=evaluateP4ReviewProductionExport(p,{}, {fieldKey:'__packet__',value:p.text});assert.equal(g.ready,false);assert.ok(g.reasons.some(x=>x.startsWith('CONFIRMATION_')));
});
run('BENCHMARKED source remains blocked',()=>{
  const p=packet({state:'BENCHMARKED'}),c=confirm(p),g=evaluateP4ReviewProductionExport(p,c,{fieldKey:'__packet__',value:p.text});assert.equal(g.ready,false);assert.ok(g.reasons.includes('SOURCE_NOT_VERIFIED'));
});
run('low confidence remains blocked even when user confirms',()=>{
  const p=packet({sourceType:'ocr',engine:'vietocr',route:'ocr',confidence:.42,confidenceUsable:true}),c=confirm(p),g=evaluateP4ReviewProductionExport(p,c,{fieldKey:'__packet__',value:p.text});assert.equal(g.ready,false);assert.ok(g.reasons.includes('SOURCE_CONFIDENCE_BELOW_075'));
});
run('source SHA mismatch invalidates confirmation',()=>{
  const p=packet(),c=confirm(p);const live=packet({sourceSha:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'});const r=validateP4ReviewConfirmation(c,{source:live.source,fieldKey:'__packet__',value:live.text});assert.equal(r.ok,false);assert.ok(r.errors.includes('CONFIRMATION_SOURCE_MISMATCH'));
});
run('value change invalidates confirmation',()=>{
  const p=packet(),c=confirm(p);const r=validateP4ReviewConfirmation(c,{source:p.source,fieldKey:'__packet__',value:'D = 700 mm'});assert.equal(r.ok,false);assert.ok(r.errors.includes('CONFIRMATION_VALUE_MISMATCH'));
});
run('missing PDF bbox is blocked before confirmation',()=>{
  const bad=source({bbox:null});assert.throws(()=>createP4ReviewConfirmation({source:bad,fieldKey:'__packet__',value:'x'}),/SOURCE_BBOX_MISSING/);
});
run('image without fingerprint is blocked',()=>{
  const bad=source({page:null,bbox:null,sourceType:'image',engine:'image-review',route:'image',fingerprint:''});assert.throws(()=>createP4ReviewConfirmation({source:bad,fieldKey:'__packet__',value:'x'}),/SOURCE_IMAGE_FINGERPRINT_MISSING/);
});
run('dangerous external formula remains BLOCK',()=>{
  const trust=classifyP4Trust(source());const r=compileSafeExcelFormula({rhs:'WEBSERVICE("https://example.com")'},{},{trust});assert.equal(r.ok,false);assert.equal(r.state,'BLOCK');
});
run('unsafe cell mapping remains BLOCK',()=>{
  const trust=classifyP4Trust(source());const r=compileSafeExcelFormula({rhs:'A+B'},{A:"'04_THAM_SO'!$D$2",B:'WEBSERVICE("x")'},{trust});assert.equal(r.ok,false);assert.equal(r.state,'BLOCK');
});
run('unexpected source-side mutation flags block exporter candidate',()=>{
  const p=packet(),c=confirm(p);p.calculationEngineMutationAllowed=true;const g=evaluateP4ReviewProductionExport(p,c,{fieldKey:'__packet__',value:p.text});assert.equal(g.ready,false);assert.ok(g.reasons.includes('SOURCE_CALCULATION_BARRIER_MISSING'));
});
run('unexpected promotion state blocks exporter candidate',()=>{
  const p=packet(),c=confirm(p);p.promotionState='PRODUCTION';const g=evaluateP4ReviewProductionExport(p,c,{fieldKey:'__packet__',value:p.text});assert.equal(g.ready,false);assert.ok(g.reasons.includes('UNEXPECTED_SOURCE_PROMOTION_STATE'));
});

const pass=cases.filter(x=>x.state==='PASS').length,fail=cases.length-pass;
const report={schema:'HNL_P4_PRODUCTION_PROMOTION_SELFTEST_V1',generatedAt:new Date().toISOString(),sourceSha:SHA,total:cases.length,pass,fail,cases,hardLocks:{searchBrain:'1.9.23 LOCKED',p4State:'SHADOW_ONLY',productionMutationAllowed:false,calculationEngineMutationAllowed:false}};
const out=path.resolve('artifacts/p4-production-promotion');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'P4_PROMOTION_SELFTEST.json'),JSON.stringify(report,null,2));
if(fail)process.exitCode=1;else console.log(`P4 PRODUCTION PROMOTION SELFTEST: PASS ${pass}/${cases.length}`);
