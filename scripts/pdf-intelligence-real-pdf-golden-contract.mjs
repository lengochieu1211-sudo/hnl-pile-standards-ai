import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  anchorCoverage, bboxIou, buildEvidenceReport, evaluateCase,
  findCorpusDocument, matchDocumentToCorpus, normalizeBbox, tokenJaccard
} from '../src/pdf-intelligence/real-pdf-golden-core.js';

const corpus=JSON.parse(fs.readFileSync(new URL('../artifacts/pdf-intelligence/real-pdf-corpus-v1.27.json', import.meta.url),'utf8'));
let pass=0;
const ok=fn=>{fn();pass++;};

ok(()=>assert.equal(corpus.containsPdfBytes,false));
ok(()=>assert.equal(corpus.documents.length,3));
ok(()=>assert.equal(corpus.cases.length,9));
ok(()=>assert.equal(new Set(corpus.cases.map(x=>x.id)).size,9));
ok(()=>assert.ok(corpus.cases.some(x=>x.profile.includes('scan-or-weak-text'))));
ok(()=>assert.ok(corpus.cases.some(x=>x.profile.includes('table'))));
ok(()=>assert.ok(corpus.cases.some(x=>x.profile.includes('formula'))));
ok(()=>assert.ok(corpus.cases.some(x=>x.profile.includes('zoom-invariance'))));
ok(()=>assert.ok(corpus.cases.some(x=>x.profile.includes('multi-page'))));
ok(()=>assert.equal(matchDocumentToCorpus({name:'TCVN 10304-2025 Móng cọc.pdf'},corpus.documents[0]),true));
ok(()=>assert.equal(findCorpusDocument({name:'TCVN 5574-2018.pdf'},corpus.documents)?.id,'TCVN5574_2018'));
ok(()=>assert.deepEqual(normalizeBbox([.1,.2,.4,.6]),[.1,.2,.4,.6]));
ok(()=>assert.equal(normalizeBbox([-.1,.2,.4,.6]),null));
ok(()=>assert.equal(Number(bboxIou([.1,.1,.5,.5],[.1,.1,.5,.5]).toFixed(3)),1));
ok(()=>assert.ok(tokenJaccard('Bảng 10 mô đun đàn hồi Eb','Bảng 10 Eb')>0.3));
ok(()=>assert.equal(anchorCoverage('Phụ lục B B.4 và B.5',['B.4','B.5']).matched.length,2));

const baseRun={
  promotionState:'SHADOW_ONLY',productionMutationAllowed:false,fingerprint:'abc',page:36,
  provenance:{normalizedBbox:[.1,.1,.6,.4],pageSizeCss:{width:900,height:1200}},
  candidates:[
    {engine:'deepdoc-vietocr-region',confidenceUsable:false,available:true,text:'Bảng 10 Eb',anchorCoverage:{ratio:1}},
    {engine:'vision-region-reused',available:false,reusedExistingVision:false,text:''}
  ],
  bestAnchorRatio:1
};
const zoomCase={id:'z',title:'zoom',requiredRuns:2,pageHints:[36,38],requireDistinctViewports:true,bboxIouThreshold:.7};
const r2={...baseRun,provenance:{...baseRun.provenance,pageSizeCss:{width:1350,height:1800},normalizedBbox:[.11,.105,.61,.405]}};
ok(()=>assert.equal(evaluateCase(zoomCase,[baseRun,r2]).state,'BENCHMARKED'));

const multiCase={id:'m',title:'multi',requiredRuns:2,pageHints:[110,111],requireDistinctPages:true};
const m1={...baseRun,page:110},m2={...baseRun,page:111};
ok(()=>assert.equal(evaluateCase(multiCase,[m1,m2]).distinctPagesPass,true));

const report=buildEvidenceReport({corpus:{...corpus,cases:[zoomCase]},runsByCase:{z:[baseRun,r2]}});
ok(()=>assert.equal(report.overallState,'BENCHMARKED'));
ok(()=>assert.equal(report.promotionState,'SHADOW_ONLY'));
ok(()=>assert.equal(report.productionMutationAllowed,false));
ok(()=>assert.notEqual(report.overallState,'VERIFIED'));

const forbidden=JSON.stringify(corpus).match(/data:application\/pdf|JVBERi0/i);
ok(()=>assert.equal(forbidden,null));

assert.equal(pass,23);
console.log(`P3.2 REAL PDF GOLDEN CONTRACT: PASS · ${pass}/23 · 3 standards · 9 cases · no PDF bytes bundled`);
