#!/usr/bin/env node
// HNL v1.25.7 — SPT PDF Decision Golden.
// Normative authority: TCVN 10304:2025 Appendix D / Table D.1.
// DCE is behavior reference only and can never override the PDF decision.
import fs from 'node:fs';
import path from 'node:path';
import { calculateSptPile10304 } from '../src/pile-workflows.js';
import { evaluateSptExcelModel10304 } from '../src/p0-pass3-excel-model.js';
import { sptTipWindow10304, averageMeasuredSptN10304 } from '../src/tcvn10304-table-engine.js';
import { productionStatusFor } from '../src/production-status-registry.js';

const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const out=path.resolve(process.argv[2]||path.join(ROOT,'artifacts/spt-pdf-decision/spt-pdf-decision-v1.25.7.json'));
const evidence=JSON.parse(fs.readFileSync(path.join(ROOT,'artifacts/dce-udf-behavioral/dce-udf-observed-v1.25.7.json'),'utf8'));
const EPS=1e-9;
const close=(a,b,t=EPS)=>Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Math.abs(Number(a)-Number(b))<=t;
const checks=[];
const add=(id,actual,expected,status='PASS',extra={})=>checks.push({id,actual,expected,status,...extra});
const base={pileType:'bored',shape:'circle',diameterM:1,lengthM:10,tipDepthM:10,shaftStartDepthM:0,gammaK:1.5,gammaN:1.15};

// 1. Tip N: actual measured points in the Table D.1 window, arithmetic mean, cap at 100.
const w=sptTipWindow10304({pileType:'bored',tipDepthM:10,diameterM:1});
const tipAudit=averageMeasuredSptN10304([{depthM:8.9,N:1},{depthM:9,N:150},{depthM:10,N:120},{depthM:11,N:90},{depthM:11.1,N:1}],w);
add('TIP-WINDOW-START',w.startDepthM,9,close(w.startDepthM,9)?'PASS':'FAIL',{source:'Bảng D.1'});
add('TIP-WINDOW-END',w.endDepthM,11,close(w.endDepthM,11)?'PASS':'FAIL',{source:'Bảng D.1'});
add('TIP-MEASURED-COUNT',tipAudit.count,3,tipAudit.count===3?'PASS':'FAIL');
add('TIP-MEAN-RAW',tipAudit.raw,120,close(tipAudit.raw,120)?'PASS':'FAIL');
add('TIP-MEAN-CAP100',tipAudit.value,100,close(tipAudit.value,100)?'PASS':'FAIL',{decision:'CAP applies to tip mean N'});

// 2. Layer partition / boundary policy, engine ↔ independent formula-model.
const boundaryInput={...base,layers:[{top:0,bottom:5,soilGroup:'sand'},{top:5,bottom:12,soilGroup:'sand'}],sptPoints:[{depthM:2,N:10},{depthM:5,N:100},{depthM:8,N:20},{depthM:9.5,N:30},{depthM:10.5,N:30}]};
const e=calculateSptPile10304(boundaryInput),x=evaluateSptExcelModel10304(boundaryInput);
if(!e.ok)throw new Error(`Boundary decision case failed: ${(e.missing||[]).join('; ')}`);
add('SHAFT-LAYER1-N',e.segmentResults[0].NUsed,10,close(e.segmentResults[0].NUsed,10)?'PASS':'FAIL',{boundary:'[0,5)'});
add('SHAFT-LAYER2-N',e.segmentResults[1].NUsed,50,close(e.segmentResults[1].NUsed,50)?'PASS':'FAIL',{boundary:'[5,10) after shaft clipping'});
add('BOUNDARY-DEPTH5-NOT-IN-LAYER1',e.segmentResults[0].NMeasuredPoints.some(p=>close(p.depthM,5)),false,!e.segmentResults[0].NMeasuredPoints.some(p=>close(p.depthM,5))?'PASS':'FAIL');
add('BOUNDARY-DEPTH5-IN-DEEPER-LAYER',e.segmentResults[1].NMeasuredPoints.some(p=>close(p.depthM,5)),true,e.segmentResults[1].NMeasuredPoints.some(p=>close(p.depthM,5))?'PASS':'FAIL');
add('ENGINE-EXCEL-LAYER1-N',e.segmentResults[0].NUsed,x.segmentResults[0].NUsed,close(e.segmentResults[0].NUsed,x.segmentResults[0].NUsed)?'PASS':'FAIL');
add('ENGINE-EXCEL-LAYER2-N',e.segmentResults[1].NUsed,x.segmentResults[1].NUsed,close(e.segmentResults[1].NUsed,x.segmentResults[1].NUsed)?'PASS':'FAIL');
add('ENGINE-EXCEL-QS',e.RufKn,x.RufKn,close(e.RufKn,x.RufKn)?'PASS':'FAIL',{unit:'kN'});
add('ENGINE-EXCEL-RK',e.RkKn,x.RkKn,close(e.RkKn,x.RkKn)?'PASS':'FAIL',{unit:'kN'});
add('POLICY-METADATA',e.sptDataPolicy?.decision,'PDF-DECISION-LOCKED',e.sptDataPolicy?.decision==='PDF-DECISION-LOCKED'?'PASS':'FAIL');
add('CONTINUOUS-INTERPOLATION',e.sptDataPolicy?.continuousInterpolation,false,e.sptDataPolicy?.continuousInterpolation===false?'PASS':'FAIL');

// 3. Missing shaft layer must block; adjacent N is not interpolated into it.
const missing=calculateSptPile10304({...base,layers:[{top:0,bottom:5,soilGroup:'sand'},{top:5,bottom:12,soilGroup:'sand'}],sptPoints:[{depthM:8,N:20},{depthM:9.5,N:20},{depthM:10.5,N:20}]});
add('MISSING-SHAFT-LAYER-BLOCK',missing.ok,false,missing.ok===false?'PASS':'FAIL',{message:(missing.missing||[]).join('; ')});
add('MISSING-SHAFT-NO-NOISUY',/N_s/.test((missing.missing||[]).join(' ')),true,/N_s/.test((missing.missing||[]).join(' '))?'PASS':'FAIL');

// 4. Shaft representative N is not subject to the tip N<=100 cap; resistance has its own D.1 cap.
const high=calculateSptPile10304({...base,layers:[{top:0,bottom:5,soilGroup:'sand'},{top:5,bottom:12,soilGroup:'sand',sptN:20}],sptPoints:[{depthM:1,N:150},{depthM:4,N:200},{depthM:9.5,N:20},{depthM:10.5,N:20}]});
if(!high.ok)throw new Error(`High shaft N case failed: ${(high.missing||[]).join('; ')}`);
add('SHAFT-N-NOT-CAPPED',high.segmentResults[0].NUsed,175,close(high.segmentResults[0].NUsed,175)?'PASS':'FAIL');
add('SHAFT-F-CAPPED-BY-D1',high.segmentResults[0].unitResistanceKpa,165,close(high.segmentResults[0].unitResistanceKpa,165)?'PASS':'FAIL',{unit:'kPa'});

// 5. Explicit report/layer representative wins over raw point averaging.
const rep=calculateSptPile10304({...base,layers:[{top:0,bottom:5,soilGroup:'sand',sptN:25},{top:5,bottom:12,soilGroup:'sand',sptN:20}],sptPoints:[{depthM:1,N:100},{depthM:4,N:120},{depthM:9.5,N:20},{depthM:10.5,N:20}]});
if(!rep.ok)throw new Error('Explicit representative case failed');
add('REPORT-REPRESENTATIVE-OVERRIDES-RAW',rep.segmentResults[0].NUsed,25,close(rep.segmentResults[0].NUsed,25)?'PASS':'FAIL');
add('REPORT-REPRESENTATIVE-PROVENANCE',rep.segmentResults[0].NSource,'REPORT-LAYER-REPRESENTATIVE',rep.segmentResults[0].NSource==='REPORT-LAYER-REPRESENTATIVE'?'PASS':'FAIL');

// 6. DCE full scenario remains a deliberate reference difference after PDF decision.
const ds=evidence.sptScenario;
const dceInput={pileType:'bored',diameterM:ds.diameterM,areaM2:ds.areaM2,perimeterM:ds.perimeterM,shaftStartDepthM:ds.shaftStartDepthM,tipDepthM:ds.tipDepthM,lengthM:ds.lengthM,layers:ds.soilLayers.map(a=>({top:a.topDepthM,bottom:a.bottomDepthM,soilGroup:a.soilGroup})),sptPoints:ds.sptPoints.map(a=>({depthM:a.depthM,N:a.N})),gammaK:ds.gammaK,gammaN:ds.gammaN};
const hd=calculateSptPile10304(dceInput); if(!hd.ok)throw new Error(`DCE-reference HNL case failed: ${(hd.missing||[]).join('; ')}`);
const dceQs=Number(ds.fluAtTipKn)-Number(ds.fluAtHeadKn),dceRk=Number(ds.RkKn);
add('DCE-TIP-QB-REFERENCE',hd.RubKn,Number(ds.QbKn),close(hd.RubKn,Number(ds.QbKn),1e-6)?'PASS':'FAIL',{classification:'REFERENCE-CONSISTENT'});
add('DCE-SHAFT-DIFFERENCE-REMAINS',Math.abs(hd.RufKn-dceQs)>100,true,Math.abs(hd.RufKn-dceQs)>100?'PASS':'FAIL',{dceQsKn:dceQs,hnlQsKn:hd.RufKn,deltaKn:hd.RufKn-dceQs,classification:'DIFFERENT_BY_NORMATIVE_POLICY_DECISION'});
add('DCE-RK-DIFFERENCE-CLASSIFIED',hd.RkKn-dceRk,hd.RkKn-dceRk,'PASS',{classification:'DIFFERENT_BY_NORMATIVE_POLICY_DECISION',decision:'DCE NoiSuySPT + right-end rectangle remain REFERENCE-only'});

// 7. Registry safety.
const prod=productionStatusFor('10304-spt-raw'),dce=productionStatusFor('xll-NoiSuySPT');
add('SPT-PRODUCTION-LOCKED',prod.productionNumeric,true,prod.productionNumeric===true&&prod.status==='LOCKED'?'PASS':'FAIL',{registry:prod});
add('DCE-NOISUY-REFERENCE-ONLY',dce.productionNumeric,false,dce.productionNumeric===false&&dce.status==='REFERENCE'?'PASS':'FAIL',{registry:dce});

const fail=checks.filter(c=>c.status!=='PASS');
const report={
  schema:'HNL-SPT-PDF-DECISION-GOLDEN-V1',version:'1.25.7',generatedAt:new Date().toISOString(),
  normativeSource:{standard:'TCVN 10304:2025',scope:'Phụ lục D · D.1–D.6 · Bảng D.1',standardPages:'110–111'},
  decision:{
    status:'LOCKED',
    tipN:'Arithmetic mean of actual measured SPT points in the prescribed tip window; mean capped at 100.',
    shaftN:'Per geological layer: explicit representative N with provenance, otherwise arithmetic mean of actual measured SPT points in that layer.',
    shaftBoundary:'Half-open [top,bottom); a point exactly at a layer boundary belongs to the deeper layer.',
    noSyntheticN:'No continuous interpolation/extrapolation creates SPT points for Production.',
    d56Partition:'D.5/D.6 are applied piecewise by homogeneous geological layer and summed. This is an HNL deterministic partition of the standard identity, not a newly claimed TCVN formula.',
    dce:'NoiSuySPT and DCE right-end rectangle accumulation remain REFERENCE-only.'
  },
  dceReference:{xlsmSha256:evidence.source.xlsmSha256,behavioralEvidence:'artifacts/dce-udf-behavioral/dce-udf-observed-v1.25.7.json'},
  summary:{checks:checks.length,pass:checks.length-fail.length,fail:fail.length,status:fail.length?'FAIL':'PASS'},
  checks
};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(`SPT PDF Decision Golden: ${report.summary.pass}/${report.summary.checks} PASS; ${report.summary.fail} FAIL`);
console.log(`DCE reference: Qs HNL=${hd.RufKn.toFixed(6)} kN vs DCE=${dceQs.toFixed(6)} kN; Δ=${(hd.RufKn-dceQs).toFixed(6)} kN → DIFFERENT_BY_NORMATIVE_POLICY_DECISION`);
console.log(`Report: ${out}`);
if(fail.length)process.exit(1);
