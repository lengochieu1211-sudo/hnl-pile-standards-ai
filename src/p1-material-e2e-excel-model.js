// Independent Excel-like evaluator for P1 Material ↔ Soil E2E Golden.
// It mirrors the formula-only calculation graphs. It does not call the combined engine.
import { calculatePileGeometry } from './pile-geometry-engine.js';
import { splitBoreholeInterval } from './borehole-engine.js';
import { lookupQb10304, lookupFi10304, workFactors10304 } from './pile-workflows.js';
import { evaluateRockExcelModel10304, evaluateBoredExcelModel10304, evaluateSptExcelModel10304 } from './p0-pass3-excel-model.js';
import { evaluatePileMaterialExcelModel } from './p1-material-excel-model.js';

const num=v=>{ if(v==null||v==='') return null; const n=Number(v); return Number.isFinite(n)?n:null; };

export function evaluateDrivenExcelModel10304(input={}){
  const L=num(input.lengthM),tipDepth=num(input.tipDepthM)??L,shaftStart=num(input.shaftStartDepthM)??0,maxSegment=num(input.maxSegmentM)??2;
  if(!(L>0&&tipDepth>0&&maxSegment>0&&maxSegment<=2)) return {ok:false};
  let g;
  try{ g=calculatePileGeometry({shape:input.shape||'square',sideM:input.sideM,diameterM:input.diameterM,lengthM:L,tipInnerDiameterM:input.tipInnerDiameterM,massInnerDiameterM:input.massInnerDiameterM}); }catch{return {ok:false};}
  const layers=(input.layers||[]).map((r,i)=>({...r,index:i+1,top:num(r.top),bottom:num(r.bottom),IL:num(r.IL),fiOverride:num(r.fiOverride),soilGroup:r.soilGroup||'clay',sandType:r.sandType||''})).filter(x=>x.top!=null&&x.bottom!=null&&x.bottom>x.top).sort((a,b)=>a.top-b.top);
  const tip=layers.find(x=>tipDepth>=x.top-1e-9&&tipDepth<=x.bottom+1e-9); if(!tip)return {ok:false};
  let qb,tf; try{qb=lookupQb10304({depthM:tipDepth,soilGroup:tip.soilGroup,sandType:tip.sandType,IL:tip.IL,override:input.qbOverride});tf=workFactors10304({method:input.method||'hammer',soilGroup:tip.soilGroup,sandType:tip.sandType,IL:tip.IL,gammaRR:input.gammaRR});}catch{return {ok:false};}
  const tipResistanceKn=tf.gammaRR*qb.value*g.areaM2;
  const segments=shaftStart>=tipDepth?[]:splitBoreholeInterval(layers,{startDepthM:shaftStart,endDepthM:tipDepth,maxSegmentM:maxSegment});
  let sideResistanceKn=0;
  for(const seg of segments){try{const fi=lookupFi10304({avgDepthM:seg.avgDepthM,soilGroup:seg.soilGroup,sandType:seg.sandType,IL:seg.IL,override:seg.fiOverride});const wf=workFactors10304({method:input.method||'hammer',soilGroup:seg.soilGroup,sandType:seg.sandType,IL:seg.IL,gammaRf:input.gammaRf});sideResistanceKn+=g.perimeterM*wf.gammaRf*fi.value*seg.hM;}catch{return {ok:false};}}
  const gammaC=num(input.gammaC)??1,RkKn=gammaC*(tipResistanceKn+sideResistanceKn),gammaK=num(input.gammaK),RdKn=gammaK&&gammaK>0?RkKn/gammaK:null,gammaN=num(input.gammaN),NdMaxKn=RdKn!=null&&gammaN&&gammaN>0?RdKn/gammaN:null;
  return {ok:true,A:g.areaM2,u:g.perimeterM,qbKpa:qb.value,tipResistanceKn,sideResistanceKn,RkKn,gammaK,RdKn,gammaN,NdMaxKn};
}

export function evaluateIntegratedPileCapacityExcelModel({soilWorkflowId,soilInput={},materialInput={}}={}){
  let soil;
  if(soilWorkflowId==='10304-driven') soil=evaluateDrivenExcelModel10304(soilInput);
  else if(soilWorkflowId==='10304-end-bearing') { try{soil={ok:true,...evaluateRockExcelModel10304(soilInput)};}catch{soil={ok:false};} }
  else if(soilWorkflowId==='10304-bored') { try{soil={ok:true,...evaluateBoredExcelModel10304(soilInput)};}catch{soil={ok:false};} }
  else if(soilWorkflowId==='10304-spt') { try{soil={ok:true,...evaluateSptExcelModel10304(soilInput)};}catch{soil={ok:false};} }
  else return {ok:false,error:'UNSUPPORTED_SOIL_WORKFLOW'};
  const material=evaluatePileMaterialExcelModel(materialInput);
  const RsoilKn=num(soil?.RdKn),RmaterialKn=num(material?.NuKn);
  if(soil?.ok!==true||material?.ok!==true||!(RsoilKn>0&&RmaterialKn>0)) return {ok:false,soil,material};
  const pileResistanceKn=Math.min(RsoilKn,RmaterialKn),governing=RsoilKn<=RmaterialKn?'SOIL':'MATERIAL',gammaN=num(soilInput.gammaN),demandLimitKn=gammaN&&gammaN>0?pileResistanceKn/gammaN:null;
  return {ok:true,soil,material,soilResistanceKn:RsoilKn,materialResistanceKn:RmaterialKn,pileResistanceKn,governing,gammaN,demandLimitKn};
}
