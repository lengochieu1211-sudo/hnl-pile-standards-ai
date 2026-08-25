import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { calculateRockEndBearing10304, calculateBoredPile10304, calculateSptPile10304 } from '../src/pile-workflows.js';
import { evaluateRockExcelModel10304, evaluateBoredExcelModel10304, evaluateSptExcelModel10304 } from '../src/p0-pass3-excel-model.js';
import { productionStatusFor } from '../src/production-status-registry.js';

const outPath=resolve(process.argv[2]||'artifacts/p0-pass3/workflow-golden-v1.25.7.json');
const relTol=1e-9;
const absTol=1e-9;
const close=(a,b)=>Math.abs(Number(a)-Number(b))<=Math.max(absTol,relTol*Math.max(1,Math.abs(Number(a)),Math.abs(Number(b))));
const metric=(name,engine,excelModel,{unit='',xlsm=null,pdf='' }={})=>{
  const m={name,engine,excelFormulaModel:excelModel,diff:Number(engine)-Number(excelModel),tolerance:{relative:relTol,absolute:absTol},pass:close(engine,excelModel),unit,pdf,xlsm};
  if(xlsm && Number.isFinite(Number(xlsm.cached))){m.xlsmDiff=Number(engine)-Number(xlsm.cached);m.xlsmPass=close(engine,xlsm.cached);m.xlsm.status=m.xlsmPass?'MATCH':'MISMATCH';}
  return m;
};

const rockInput={shape:'circle',diameterM:1,rockCompressiveStrengthKpa:31300,rqdPercent:30,gammaG:1.4,embedmentLengthM:5,embeddedOuterDiameterM:1,minimumQbKpa:1000,gammaK:1.4,gammaN:1.15};
const rockE=calculateRockEndBearing10304(rockInput); const rockX=evaluateRockExcelModel10304(rockInput);
const rockMetrics=[
  metric('A',rockE.geometry.tipAreaM2,rockX.A,{unit:'m2',pdf:'§7.2.1 CT(6) geometry'}),
  metric('Ks',rockE.Ks,rockX.Ks,{unit:'-',pdf:'§7.2.1 Bảng 1 p29',xlsm:{sheet:'7.2.1-10304-Cọc Chống',cell:'F38',cached:0.24,status:'MATCH'}}),
  metric('Rm',rockE.RmKpa,rockX.RmKpa,{unit:'kPa',pdf:'§7.2.1 CT(7) p29',xlsm:{sheet:'7.2.1-10304-Cọc Chống',cell:'F40',cached:5365.714285714286,status:'MATCH'}}),
  metric('embedmentFactor',rockE.embedmentFactor,rockX.embedmentFactor,{unit:'-',pdf:'§7.2.1 CT(8)'}),
  metric('qbBeforeCap',rockE.qbBeforeCapKpa,rockX.qbBeforeCapKpa,{unit:'kPa',pdf:'§7.2.1 CT(8)'}),
  metric('qb',rockE.qbKpa,rockX.qbKpa,{unit:'kPa',pdf:'§7.2.1 CT(8)',xlsm:{sheet:'7.2.1-10304-Cọc Chống',cell:'F41',cached:16097.142857142859,status:'MATCH'}}),
  metric('Rk',rockE.RkKn,rockX.RkKn,{unit:'kN',pdf:'§7.2.1 CT(5)-(6)'}),
  metric('Rd',rockE.RdKn,rockX.RdKn,{unit:'kN',pdf:'§7.1.6.1 CT(2) + γk'}),
  metric('NdMax',rockE.NdMaxKn,rockX.NdMaxKn,{unit:'kN',pdf:'§7.1.6.1 CT(2) + γn'})
];

const boredLayers=[
  {top:0,bottom:1.5,soilGroup:'sand',sandType:'silty',soilClass:'sand',phiDeg:0,gammaKnM3:8},
  {top:1.5,bottom:7,soilGroup:'clay',soilClass:'clay',IL:.3,phiDeg:9.56,gammaKnM3:9},
  {top:7,bottom:10.5,soilGroup:'clay',soilClass:'clay',IL:.2,phiDeg:17.17,gammaKnM3:9.3},
  {top:10.5,bottom:12.2,soilGroup:'clay',soilClass:'clay',IL:.1,phiDeg:9.35,gammaKnM3:8},
  {top:12.2,bottom:27,soilGroup:'sand',sandType:'coarse',soilClass:'sand',phiDeg:9.22,gammaKnM3:8.7},
  {top:27,bottom:38.2,soilGroup:'sand',sandType:'coarse',soilClass:'sand',phiDeg:15.5,gammaKnM3:9},
  {top:38.2,bottom:50,soilGroup:'sand',sandType:'gravelly',soilClass:'sand',phiDeg:25.3,gammaKnM3:9}
];
const boredInput={shape:'circle',diameterM:1,tipDepthM:43.2,shaftStartDepthM:43.2,maxSegmentM:1,layers:boredLayers,methodCaseId:'drilled-water-bentonite',gammaK:1.4,gammaN:1.15};
const boredE=calculateBoredPile10304(boredInput); const boredX=evaluateBoredExcelModel10304(boredInput);
const boredMetrics=[
  metric('A',boredE.geometry.tipAreaM2,boredX.A,{unit:'m2',pdf:'§7.2.3 CT(13) geometry'}),
  metric('u',boredE.geometry.perimeterM,boredX.u,{unit:'m',pdf:'§7.2.3 CT(13) geometry'}),
  metric('embedmentInBearingLayer',boredE.embedmentInBearingLayerM,boredX.embedmentInBearingLayerM,{unit:'m',pdf:'§7.2.3 applicability'}),
  metric('qb',boredE.qbKpa,boredX.qbKpa,{unit:'kPa',pdf:'§7.2.3 CT(14)-(16), Bảng 7',xlsm:{sheet:'7.2.3-10304-Có moi đất',cached:1149.6421145496095,status:'MATCH_CT14_DIAGNOSTIC'}}),
  metric('gammaRR',boredE.gammaRR,boredX.gammaRR,{unit:'-',pdf:'§7.2.3'}),
  metric('gammaC',boredE.gammaC,boredX.gammaC,{unit:'-',pdf:'§7.2.3 CT(13)'}),
  metric('Qb',boredE.tipResistanceKn,boredX.tipResistanceKn,{unit:'kN',pdf:'§7.2.3 CT(13)',xlsm:{sheet:'7.2.3-10304-Có moi đất',cached:902.9268053316222,status:'MATCH_ISOLATED_TIP'}}),
  metric('Qs',boredE.sideResistanceKn,boredX.sideResistanceKn,{unit:'kN',pdf:'§7.2.3 CT(13)'}),
  metric('Rk',boredE.RkKn,boredX.RkKn,{unit:'kN',pdf:'§7.2.3 CT(13)'}),
  metric('Rd',boredE.RdKn,boredX.RdKn,{unit:'kN',pdf:'§7.1.6.1 CT(2)'})
];

const sptInput={pileType:'bored',shape:'circle',diameterM:1,lengthM:12,tipDepthM:12,shaftStartDepthM:0,layers:[{top:0,bottom:6,soilGroup:'sand',sptN:10},{top:6,bottom:15,soilGroup:'sand',sptN:20}],sptPoints:[{depthM:11.5,N:20},{depthM:12,N:30},{depthM:12.5,N:40}],gammaK:1.5,gammaN:1.15};
const sptE=calculateSptPile10304(sptInput); const sptX=evaluateSptExcelModel10304(sptInput);
const sptMetrics=[
  metric('A',sptE.geometry.tipAreaM2,sptX.A,{unit:'m2',pdf:'Phụ lục D geometry'}),
  metric('u',sptE.geometry.perimeterM,sptX.u,{unit:'m',pdf:'Phụ lục D geometry'}),
  metric('eta',sptE.eta,sptX.eta,{unit:'-',pdf:'Phụ lục D / Bảng D.1'}),
  metric('tipN',sptE.tipN,sptX.tipN,{unit:'blows',pdf:'Phụ lục D measured-window averaging'}),
  metric('qb',sptE.qbKpa,sptX.qbKpa,{unit:'kPa',pdf:'Phụ lục D, Bảng D.1'}),
  metric('Qb',sptE.RubKn,sptX.RubKn,{unit:'kN',pdf:'Phụ lục D'}),
  metric('Qs',sptE.RufKn,sptX.RufKn,{unit:'kN',pdf:'Phụ lục D'}),
  metric('Rk',sptE.RkKn,sptX.RkKn,{unit:'kN',pdf:'Phụ lục D'}),
  metric('Rd',sptE.RdKn,sptX.RdKn,{unit:'kN',pdf:'§7.1.6.1 γk for SPT'}),
  metric('NdMax',sptE.NdMaxKn,sptX.NdMaxKn,{unit:'kN',pdf:'§7.1.6.1 γn'})
];
sptE.segmentResults.forEach((s,i)=>{
  const x=sptX.segmentResults[i];
  sptMetrics.push(metric(`shaft[${i}].N`,s.NUsed,x.NUsed,{unit:'blows',pdf:'Phụ lục D'}));
  sptMetrics.push(metric(`shaft[${i}].unitResistance`,s.unitResistanceKpa,x.unitResistanceKpa,{unit:'kPa',pdf:'Bảng D.1'}));
  sptMetrics.push(metric(`shaft[${i}].Qsi`,s.resistanceKn,x.resistanceKn,{unit:'kN',pdf:'Phụ lục D'}));
});

const boundaryCases=[];
const pushBoundary=(id,run,expectPattern)=>{
  try{const r=run(); const text=[...(r.missing||[]),...(r.warnings||[])].join(' '); boundaryCases.push({id,ok:r.ok===false && (!expectPattern||expectPattern.test(text)),resultOk:r.ok,message:text,status:(r.ok===false && (!expectPattern||expectPattern.test(text)))?'PASS':'FAIL'});}
  catch(e){boundaryCases.push({id,ok:expectPattern?expectPattern.test(String(e?.message||e)):true,thrown:String(e?.message||e),status:expectPattern?.test(String(e?.message||e))?'PASS':'FAIL'});}
};
pushBoundary('rock-rqd-outside',()=>calculateRockEndBearing10304({...rockInput,rqdPercent:101}),/0–100|RQD/);
pushBoundary('bored-tip-layer-boundary-needs-2m',()=>calculateBoredPile10304({shape:'circle',diameterM:1,tipDepthM:5,layers:[{top:0,bottom:5,soilGroup:'clay',soilClass:'clay',IL:.3},{top:5,bottom:10,soilGroup:'clay',soilClass:'clay',IL:.3}],methodCaseId:'bored-64a-64b'}),/2 m/);
pushBoundary('bored-table3-no-extrapolation',()=>calculateBoredPile10304({shape:'circle',diameterM:1,tipDepthM:45,shaftStartDepthM:39,layers:[{top:0,bottom:50,soilGroup:'sand',soilClass:'sand',sandType:'coarse',phiDeg:31,gammaKnM3:18,gammaEffectiveKnM3:10}],methodCaseId:'bored-64a-64b'}),/Bảng 3|ngoại suy/);
pushBoundary('spt-no-measured-tip-point',()=>calculateSptPile10304({pileType:'bored',shape:'circle',diameterM:1,lengthM:10,tipDepthM:10,layers:[{top:0,bottom:12,soilGroup:'sand',sptN:30}],sptPoints:[{depthM:5,N:50}]}),/không có điểm SPT/);
pushBoundary('spt-driven-open-tip-L-din-under-2',()=>calculateSptPile10304({pileType:'driven',shape:'circle',diameterM:1,lengthM:1.5,innerDiameterM:1,closedTip:false,tipDepthM:1.5,layers:[{top:0,bottom:3,soilGroup:'sand',sptN:20}],sptPoints:[{depthM:1.5,N:20}]}),/L\/d_trong <2/);

const cases=[
  {id:'ROCK-RQD-30',workflow:'10304-end-bearing-rock',status:productionStatusFor('10304-end-bearing-rock'),input:rockInput,engineStatus:rockE.status,metrics:rockMetrics,xlsmTrace:'F38→F40→F41 cached benchmark; XLSM is reference only'},
  {id:'BORED-CT14-ISOLATED-TIP',workflow:'10304-bored-raw',status:productionStatusFor('10304-bored-raw'),input:boredInput,engineStatus:boredE.status,metrics:boredMetrics,xlsmTrace:'CT14 tip diagnostic benchmark; shaft intentionally isolated to avoid XLL plateau beyond Bảng 3 domain'},
  {id:'SPT-D1-RAW-MEASURED-WINDOW',workflow:'10304-spt-raw',status:productionStatusFor('10304-spt-raw'),input:sptInput,engineStatus:sptE.status,metrics:sptMetrics,xlsmTrace:'No traceable same-input XLSM case; hidden XLL cached values are not used as verification evidence',xlsmReferenceStatus:'REFERENCE_UNAVAILABLE_FOR_SAME_INPUT'}
];
for(const c of cases){ c.pass=c.metrics.every(m=>m.pass); }
const allMetricPass=cases.every(c=>c.pass); const allBoundaryPass=boundaryCases.every(c=>c.status==='PASS');
const report={
  schema:'HNL-P0-PASS3-WORKFLOW-GOLDEN',version:'1.25.7',generatedAt:new Date().toISOString(),
  sourcePolicy:['TCVN PDF is normative source','XLSM is workflow/benchmark reference only','Excel formula model is independent from workflow wrapper and shares only LOCKED table primitives','No _xll.* is a production dependency'],
  tolerances:{relative:relTol,absolute:absTol},cases,boundaryCases,
  summary:{workflowCases:cases.length,workflowPass:cases.filter(x=>x.pass).length,metricCount:cases.reduce((n,c)=>n+c.metrics.length,0),metricPass:cases.reduce((n,c)=>n+c.metrics.filter(m=>m.pass).length,0),xlsmBenchmarks:cases.reduce((n,c)=>n+c.metrics.filter(m=>m.xlsmPass!==undefined).length,0),xlsmBenchmarkPass:cases.reduce((n,c)=>n+c.metrics.filter(m=>m.xlsmPass===true).length,0),boundaryCases:boundaryCases.length,boundaryPass:boundaryCases.filter(x=>x.status==='PASS').length,pass:allMetricPass&&allBoundaryPass&&cases.every(c=>c.metrics.every(m=>m.xlsmPass!==false))},
  excelJsRuntimeGate:'PENDING_EXTERNAL_DEPENDENCY_SMOKE'
};
mkdirSync(dirname(outPath),{recursive:true}); writeFileSync(outPath,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report.summary,null,2));
if(!report.summary.pass) process.exitCode=1;
