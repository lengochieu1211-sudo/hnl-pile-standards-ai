#!/usr/bin/env node
// HNL v1.25.7 — DCE UDF Behavioral Golden.
// Purpose: characterize proprietary DCE behavior without making it a production authority.
import fs from 'node:fs';
import path from 'node:path';
import {
  lookupRockKs10304,
  lookupTable8Qb10304,
  lookupSptTipResistance10304,
  lookupSptShaftResistance10304
} from '../src/tcvn10304-table-engine.js';
import { calculateSptPile10304 } from '../src/pile-workflows.js';
import { productionStatusFor } from '../src/production-status-registry.js';

const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const evidencePath=path.resolve(ROOT,'artifacts/dce-udf-behavioral/dce-udf-observed-v1.25.7.json');
const outputPath=path.resolve(process.argv[2]||path.join(ROOT,'artifacts/dce-udf-behavioral/dce-udf-behavioral-golden-v1.25.7.json'));
const ev=JSON.parse(fs.readFileSync(evidencePath,'utf8'));
const EPS=1e-8;
const close=(a,b,tol=EPS)=>Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Math.abs(Number(a)-Number(b))<=tol;
const num=x=>typeof x==='number'&&Number.isFinite(x);

function dceReferenceLinear(points,z){
  const ps=points.map(p=>({z:Number(p.depthM),N:Number(p.N)})).filter(p=>Number.isFinite(p.z)&&Number.isFinite(p.N)).sort((a,b)=>a.z-b.z);
  for(const p of ps) if(Math.abs(z-p.z)<1e-10) return p.N;
  for(let i=0;i<ps.length-1;i++){
    const a=ps[i],b=ps[i+1]; if(z>a.z&&z<b.z) return a.N+(z-a.z)*(b.N-a.N)/(b.z-a.z);
  }
  return null;
}

const checks=[];
const add=(group,id,actual,expected,status='PASS',extra={})=>checks.push({group,id,actual,expected,status,...extra});

// 1) NoiSuySPT — cached DCE behavior is piecewise LINEAR-1D across measured points.
let noiPass=0;
for(const r of ev.sptScenario.diagnostics){
  if(!num(r.NInterpolated)) continue;
  const exp=dceReferenceLinear(ev.sptScenario.sptPoints,Number(r.depthM));
  const ok=exp!=null&&close(r.NInterpolated,exp,1e-9);
  if(ok)noiPass++;
  add('NoiSuySPT',`row-${r.row}`,r.NInterpolated,exp,ok?'PASS':'FAIL',{
    depthM:r.depthM,classification:'DCE_REFERENCE_BEHAVIOR',productionClone:false
  });
}

// 2) qb_SPT2025 — compare exposed cached behavior to Appendix D HNL primitive.
let qbPass=0,qbCount=0;
for(const r of ev.sptScenario.diagnostics){
  if(!num(r.NInterpolated))continue;
  const clay=r.dceSoilGroup==='Đất dính';
  const observed=clay?r.qbClayKpa:r.qbSandKpa;
  if(!num(observed))continue;
  const h=lookupSptTipResistance10304({pileType:'bored',soilGroup:clay?'clay':'sand',N:r.NInterpolated,cuKpa:clay?6.25*r.NInterpolated:null,eta:1});
  const ok=close(observed,h.value,1e-8);qbCount++;if(ok)qbPass++;
  add('qb_SPT2025',`row-${r.row}`,observed,h.value,ok?'PASS':'FAIL',{
    depthM:r.depthM,N:r.NInterpolated,soilGroup:clay?'clay':'sand',hnlProvenance:h.provenance
  });
}

// 3) flu_SPT2025 f — exposed unit shaft resistance vs Appendix D HNL primitive.
let fPass=0,fCount=0;
for(const r of ev.sptScenario.diagnostics){
  if(!num(r.NInterpolated))continue;
  const clay=r.dceSoilGroup==='Đất dính';
  const observed=clay?r.fClayKpa:r.fSandKpa;
  if(!num(observed))continue;
  const h=lookupSptShaftResistance10304({pileType:'bored',soilGroup:clay?'clay':'sand',N:r.NInterpolated});
  const ok=close(observed,h.value,1e-8);fCount++;if(ok)fPass++;
  add('flu_SPT2025-unit-f',`row-${r.row}`,observed,h.value,ok?'PASS':'FAIL',{
    depthM:r.depthM,N:r.NInterpolated,soilGroup:clay?'clay':'sand',hnlProvenance:h.provenance
  });
}

// 4) flu_SPT2025 cumulative behavior — right-end rectangle per exposed segment.
let cum=0,cumPass=0,cumCount=0;
for(const r of ev.sptScenario.diagnostics){
  const clay=r.dceSoilGroup==='Đất dính', fKpa=clay?r.fClayKpa:r.fSandKpa;
  if(!num(r.segmentLengthM)||!num(fKpa)||!num(r.fluCumulativeKn))continue;
  cum += Number(ev.sptScenario.perimeterM)*Number(r.segmentLengthM)*Number(fKpa);
  const ok=close(r.fluCumulativeKn,cum,2e-8);cumCount++;if(ok)cumPass++;
  add('flu_SPT2025-cumulative',`row-${r.row}`,r.fluCumulativeKn,cum,ok?'PASS':'FAIL',{
    depthM:r.depthM,segmentLengthM:r.segmentLengthM,fKpa,inferredBehavior:'RIGHT-END-RECTANGLE'
  });
}

// 5) Full reference SPT scenario: HNL intentionally differs in shaft integration policy.
const layers=ev.sptScenario.soilLayers.map(x=>({top:x.topDepthM,bottom:x.bottomDepthM,soilGroup:x.soilGroup}));
const points=ev.sptScenario.sptPoints.map(x=>({depthM:x.depthM,N:x.N}));
const hnlSpt=calculateSptPile10304({
  pileType:'bored',diameterM:Number(ev.sptScenario.diameterM),areaM2:Number(ev.sptScenario.areaM2),perimeterM:Number(ev.sptScenario.perimeterM),
  shaftStartDepthM:Number(ev.sptScenario.shaftStartDepthM),tipDepthM:Number(ev.sptScenario.tipDepthM),lengthM:Number(ev.sptScenario.lengthM),
  layers,sptPoints:points,gammaK:Number(ev.sptScenario.gammaK),gammaN:Number(ev.sptScenario.gammaN)
});
if(!hnlSpt.ok) throw new Error(`HNL SPT scenario failed: ${(hnlSpt.missing||[]).join('; ')}`);
const dceRuf=Number(ev.sptScenario.fluAtTipKn)-Number(ev.sptScenario.fluAtHeadKn);
const dceRk=Number(ev.sptScenario.RkKn);
const sptPolicy={
  dce:{QbKn:Number(ev.sptScenario.QbKn),RufKn:dceRuf,RkKn:dceRk},
  hnl:{QbKn:hnlSpt.RubKn,RufKn:hnlSpt.RufKn,RkKn:hnlSpt.RkKn,tipN:hnlSpt.tipN,noInterpolationPolicy:hnlSpt.noInterpolationPolicy},
  delta:{QbKn:hnlSpt.RubKn-Number(ev.sptScenario.QbKn),RufKn:hnlSpt.RufKn-dceRuf,RkKn:hnlSpt.RkKn-dceRk},
  classification:'DIFFERENT_BY_NORMATIVE_POLICY_DECISION',
  decision:'SPT_PDF_DECISION_LOCKED__NO_CONTINUOUS_N_INTERPOLATION__NO_DCE_RIGHT_END_INTEGRATION',
  pdfDecision:{tipN:'MEASURED-WINDOW-ARITHMETIC-MEAN',shaftN:'LAYER-REPRESENTATIVE_OR_MEASURED-LAYER-MEAN',boundary:'[top,bottom)',partition:'D.5/D.6 by geological layer'}
};
add('SPT-full-policy','tip-Qb',hnlSpt.RubKn,Number(ev.sptScenario.QbKn),close(hnlSpt.RubKn,Number(ev.sptScenario.QbKn),1e-6)?'PASS':'FAIL');
// Known shaft/full result mismatch is a PASS only if it remains explicitly classified, not silently equalized.
add('SPT-full-policy','shaft-policy-difference',hnlSpt.RufKn,dceRuf,Math.abs(hnlSpt.RufKn-dceRuf)>1e-6?'EXPECTED_DIFFERENCE':'UNEXPECTED_EQUAL',{
  deltaKn:hnlSpt.RufKn-dceRuf,classification:sptPolicy.classification
});

// 6) GetKsFromRQD direct observed point.
const ks=lookupRockKs10304(ev.rockKsDirectObservation.RQD);
const ksOk=close(ks.value,ev.rockKsDirectObservation.Ks,1e-12);
add('GetKsFromRQD','direct-RQD-30',ev.rockKsDirectObservation.Ks,ks.value,ksOk?'PASS':'FAIL',{hnlProvenance:ks.provenance});

// 7) GetQbBang8 has no direct workbook call; compare indirect Qb_CocMaSatCMD qb diagnostics.
let b8Pass=0;
for(const x of ev.table8IndirectObservations){
  const h=lookupTable8Qb10304({depthM:x.depthM,IL:x.IL}); const ok=close(h.value,x.qbKpa,1e-8); if(ok)b8Pass++;
  add('GetQbBang8-indirect',`row-${x.row}`,x.qbKpa,h.value,ok?'PASS':'FAIL',{depthM:x.depthM,IL:x.IL,mode:h.mode,hnlProvenance:h.provenance});
}

// 8) EQ gamma UDFs: capture behavior only; Production must stay blocked until PDF provenance is resolved.
const eqReg=productionStatusFor('10304-seismic-eq');
const gqReg=productionStatusFor('xll-TinhGammaqbCMS');
const gfReg=productionStatusFor('xll-TinhGammafiCMS');
const eqBlocked=eqReg.productionNumeric===false&&gqReg.productionNumeric===false&&gfReg.productionNumeric===false;
add('EQ-gamma','production-safety-gate',eqBlocked,true,eqBlocked?'PASS':'FAIL',{
  observedUniqueTuples:ev.eqGammaUniqueObservations.length,workflowStatus:eqReg.status,gammaQbStatus:gqReg.status,gammaFiStatus:gfReg.status
});

const fail=checks.filter(x=>x.status==='FAIL'||x.status==='UNEXPECTED_EQUAL');
const report={
  schema:'HNL_DCE_UDF_BEHAVIORAL_GOLDEN_V1',hnlVersion:'1.25.7',generatedAt:new Date().toISOString(),
  authority:{normative:'TCVN 10304:2025 PDF',reference:'DCE XLSM cached runtime behavior + DCE Excel.dll signatures',productionRule:'DCE difference alone never modifies HNL Production.'},
  sourceEvidence:{xlsmSha256:ev.source.xlsmSha256,udfCallCounts:ev.udfCallCounts,evidenceStatus:ev.evidenceStatus},
  summary:{
    totalChecks:checks.length,failed:fail.length,
    NoiSuySPT:`${noiPass}/${ev.sptScenario.diagnostics.filter(x=>num(x.NInterpolated)).length}`,
    qbSPT:`${qbPass}/${qbCount}`,fluUnit:`${fPass}/${fCount}`,fluCumulative:`${cumPass}/${cumCount}`,
    GetKsFromRQD:ksOk?'1/1':'0/1',GetQbBang8Indirect:`${b8Pass}/${ev.table8IndirectObservations.length}`,
    eqGammaUniqueTuples:ev.eqGammaUniqueObservations.length,eqProductionBlocked:eqBlocked
  },
  sptPolicyDifference:sptPolicy,
  eqGammaObserved:ev.eqGammaUniqueObservations,
  checks
};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});fs.writeFileSync(outputPath,JSON.stringify(report,null,2));
console.log(`DCE UDF Behavioral Golden: ${checks.length-fail.length}/${checks.length} required checks acceptable; ${fail.length} FAIL`);
console.log(`NoiSuySPT ${report.summary.NoiSuySPT} | qb ${report.summary.qbSPT} | f ${report.summary.fluUnit} | cumulative ${report.summary.fluCumulative}`);
console.log(`SPT full: DCE Rk=${dceRk.toFixed(6)} kN, HNL Rk=${hnlSpt.RkKn.toFixed(6)} kN, Δ=${(hnlSpt.RkKn-dceRk).toFixed(6)} kN → ${sptPolicy.classification}`);
console.log(`EQ gamma: ${ev.eqGammaUniqueObservations.length} unique cached tuples; Production blocked=${eqBlocked}`);
console.log(`Report: ${outputPath}`);
if(fail.length)process.exit(1);
