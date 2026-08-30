import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createP4ExtractionPacket, compileSafeExcelFormula, classifyP4Trust } from '../src/p4-pdf-excel-intelligence.js';
import { createP4ReviewConfirmation, validateP4ReviewConfirmation } from '../src/pdf-excel-intelligence/confirmation-contract.js';
import { createP4ReviewedNativeExportPacket, evaluateP4ReviewProductionExport, P4_REVIEW_PRODUCTION_MODE, P4_REVIEW_PRODUCTION_STATE, P4_REVIEW_PRODUCTION_SCOPE } from '../src/pdf-excel-intelligence/review-production-export.js';

const SHA=String(process.env.HNL_SOURCE_SHA||'71b5fd1cb7375046b4c831bf941cb18ae2e80d03');
const cases=[];
function run(name,fn){try{fn();cases.push({name,state:'PASS'});console.log(`PASS ${name}`);}catch(error){cases.push({name,state:'FAIL',error:String(error?.stack||error)});console.error(`FAIL ${name}`,error);}}
function source(extra={}){return {file:'TCVN.pdf',documentId:'doc-1',standard:'TCVN',page:10,bbox:[.1,.1,.9,.5],sourceType:'pdf-native',engine:'pdfjs-native-region',route:'native',state:'REVIEW',status:'P4_UI_SELECTION_REVIEW',confidence:null,confidenceUsable:false,userConfirmed:false,sourceSha:SHA,fingerprint:'fixture-doc-1',...extra};}
function packet(extraSource={},content='D = 600 mm'){return createP4ExtractionPacket({provenance:source(extraSource),text:content});}
function confirm(p,value=p.text,extra={}){return createP4ReviewConfirmation({source:p.source,fieldKey:'__packet__',value,confirmedBy:'user',confirmedAt:new Date().toISOString(),...extra});}
function derive(p,c){return createP4ReviewedNativeExportPacket(p,c,{fieldKey:'__packet__',value:p.text});}

run('REVIEW native + bound confirmation => scoped VERIFIED_FOR_EXPORT',()=>{
  const p=packet(),c=confirm(p),r=derive(p,c),g=evaluateP4ReviewProductionExport(r,c,{fieldKey:'__packet__',value:r.text});
  assert.equal(r.source.state,'REVIEW');assert.equal(r.promotionState,'SHADOW_ONLY');assert.equal(r.reviewProduction.state,P4_REVIEW_PRODUCTION_STATE);assert.equal(r.reviewProduction.scope,P4_REVIEW_PRODUCTION_SCOPE);assert.equal(g.ready,true);assert.equal(g.mode,P4_REVIEW_PRODUCTION_MODE);assert.equal(g.workbookProductionExportAllowed,true);assert.equal(g.calculationEngineMutationAllowed,false);assert.equal(g.productionMutationAllowed,false);
});
run('scoped export does not upgrade source trust or calculation eligibility',()=>{
  const p=packet(),c=confirm(p),r=derive(p,c);assert.equal(r.trust.semanticState,'REVIEW');assert.equal(r.trust.calculationEligible,false);assert.equal(r.source.state,'REVIEW');assert.equal(r.calculationEngineMutationAllowed,false);
});
run('raw REVIEW packet without scoped marker remains blocked',()=>{
  const p=packet(),c=confirm(p),g=evaluateP4ReviewProductionExport(p,c,{fieldKey:'__packet__',value:p.text});assert.equal(g.ready,false);assert.ok(g.reasons.includes('SOURCE_NOT_VERIFIED_FOR_EXPORT'));
});
run('raw boolean userConfirmed without confirmation record is not enough',()=>{
  const p=packet({userConfirmed:true});assert.throws(()=>derive(p,{}),/CONFIRMATION_/);
});
run('OCR remains blocked even when user confirms',()=>{
  const p=packet({sourceType:'ocr',engine:'chromium-textdetector-region',route:'local-ocr',confidence:.98,confidenceUsable:true}),c=confirm(p);assert.throws(()=>derive(p,c),/REVIEW_PRODUCTION_NATIVE_PDF_ONLY/);
});
run('Vision remains blocked even when user confirms',()=>{
  const p=packet({sourceType:'vision-reuse',engine:'vision-region-user-approved',route:'vision',confidence:.99,confidenceUsable:true}),c=confirm(p);assert.throws(()=>derive(p,c),/REVIEW_PRODUCTION_NATIVE_PDF_ONLY/);
});
run('PDF scan remains blocked even when user confirms',()=>{
  const p=packet({sourceType:'pdf-scan',engine:'scan-engine',route:'scan'}),c=confirm(p);assert.throws(()=>derive(p,c),/REVIEW_PRODUCTION_NATIVE_PDF_ONLY/);
});
run('wrong native engine remains blocked',()=>{
  const p=packet({engine:'other-native-engine'}),c=confirm(p);assert.throws(()=>derive(p,c),/REVIEW_PRODUCTION_NATIVE_ENGINE_REQUIRED/);
});
run('wrong native route remains blocked',()=>{
  const p=packet({route:'other'}),c=confirm(p);assert.throws(()=>derive(p,c),/REVIEW_PRODUCTION_NATIVE_ROUTE_REQUIRED/);
});
run('source SHA mismatch invalidates confirmation',()=>{
  const p=packet(),c=confirm(p),live=packet({sourceSha:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'});const r=validateP4ReviewConfirmation(c,{source:live.source,fieldKey:'__packet__',value:live.text});assert.equal(r.ok,false);assert.ok(r.errors.includes('CONFIRMATION_SOURCE_MISMATCH'));
});
run('value change invalidates confirmation',()=>{
  const p=packet(),c=confirm(p),r=validateP4ReviewConfirmation(c,{source:p.source,fieldKey:'__packet__',value:'D = 700 mm'});assert.equal(r.ok,false);assert.ok(r.errors.includes('CONFIRMATION_VALUE_MISMATCH'));
});
run('missing PDF bbox is blocked before confirmation',()=>{
  const bad=source({bbox:null});assert.throws(()=>createP4ReviewConfirmation({source:bad,fieldKey:'__packet__',value:'x'}),/SOURCE_BBOX_MISSING/);
});
run('blank source value cannot be promoted for workbook export',()=>{
  const p=packet({},'   '),c=confirm(p,'   ');assert.throws(()=>derive(p,c),/SOURCE_VALUE_MISSING/);
});
run('dangerous external formula remains BLOCK',()=>{
  const trust=classifyP4Trust(source({state:'VERIFIED'})),r=compileSafeExcelFormula({rhs:'WEBSERVICE("https://example.com")'},{},{trust});assert.equal(r.ok,false);assert.equal(r.state,'BLOCK');
});
run('unexpected source-side mutation flags block activation',()=>{
  const p=packet(),c=confirm(p);p.calculationEngineMutationAllowed=true;assert.throws(()=>derive(p,c),/SOURCE_CALCULATION_BARRIER_MISSING/);
});
run('unexpected source promotion state blocks activation',()=>{
  const p=packet(),c=confirm(p);p.promotionState='PRODUCTION';assert.throws(()=>derive(p,c),/UNEXPECTED_SOURCE_PROMOTION_STATE/);
});
run('globally VERIFIED native still requires bound confirmation',()=>{
  const p=packet({state:'VERIFIED',status:'VERIFIED'}),c=confirm(p),g=evaluateP4ReviewProductionExport(p,c,{fieldKey:'__packet__',value:p.text});assert.equal(g.ready,true);assert.equal(g.calculationEngineMutationAllowed,false);assert.equal(g.productionMutationAllowed,false);
});
run('tampering scoped marker source SHA blocks export',()=>{
  const p=packet(),c=confirm(p),r=derive(p,c);r.reviewProduction.sourceSha='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';const g=evaluateP4ReviewProductionExport(r,c,{fieldKey:'__packet__',value:r.text});assert.equal(g.ready,false);assert.ok(g.reasons.includes('REVIEW_PRODUCTION_SOURCE_SHA_MISMATCH'));
});

const pass=cases.filter(x=>x.state==='PASS').length,fail=cases.length-pass;
const report={schema:'HNL_P4_REVIEW_PRODUCTION_ACTIVATION_SELFTEST_V1',generatedAt:new Date().toISOString(),sourceSha:SHA,total:cases.length,pass,fail,cases,activation:{mode:P4_REVIEW_PRODUCTION_MODE,state:P4_REVIEW_PRODUCTION_STATE,scope:P4_REVIEW_PRODUCTION_SCOPE,nativePdfOnly:true},hardLocks:{searchBrain:'1.9.23 LOCKED',p4CoreState:'SHADOW_ONLY',productionMutationAllowed:false,calculationEngineMutationAllowed:false}};
const out=path.resolve('artifacts/p4-production-promotion');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'P4_PROMOTION_SELFTEST.json'),JSON.stringify(report,null,2));
if(fail)process.exitCode=1;else console.log(`P4 REVIEW PRODUCTION ACTIVATION SELFTEST: PASS ${pass}/${cases.length}`);
