// Independent Excel-like evaluator for P1 Pass 2 Multi-Borehole Golden.
// It uses the previously locked formula-models, not the batch engine.
import { evaluateIntegratedPileCapacityExcelModel } from './p1-material-e2e-excel-model.js';

const num=v=>{if(v==null||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};
const tol=1e-8;
const minSet=(rows,field)=>{const xs=rows.filter(r=>r.ok&&Number.isFinite(num(r[field])));if(!xs.length)return{value:null,rows:[]};const v=Math.min(...xs.map(r=>num(r[field])));return{value:v,rows:xs.filter(r=>Math.abs(num(r[field])-v)<=Math.max(tol,tol*Math.max(1,Math.abs(v))))};};
const sptPileType=(id,explicit)=>explicit||(id==='10304-driven'?'driven':'bored');

export function evaluateMultiBoreholeExcelModel({mechanicalWorkflowId='10304-driven',pileInput={},mechanicalInput={},sptInput={},boreholes=[],materialInput={},gammaN=null}={}){
  if(!['10304-driven','10304-bored'].includes(mechanicalWorkflowId)||!Array.isArray(boreholes)||boreholes.length<2)return{ok:false};
  const rows=[];
  for(let i=0;i<boreholes.length;i++){
    const bh=boreholes[i],id=String(bh.id||bh.name||`HK${i+1}`),common={...pileInput,layers:bh.layers||[]};
    for(const methodId of [mechanicalWorkflowId,'10304-spt']){
      const input={...common,...(methodId==='10304-spt'?sptInput:mechanicalInput),...(methodId==='10304-spt'?(bh.sptInput||{}):(bh.mechanicalInput||{})),layers:bh.layers||[]};
      if(methodId==='10304-spt'){input.sptPoints=bh.sptPoints||[];input.pileType=sptPileType(mechanicalWorkflowId,input.pileType);}
      if(gammaN!=null)input.gammaN=gammaN;
      const x=evaluateIntegratedPileCapacityExcelModel({soilWorkflowId:methodId,soilInput:input,materialInput});
      const soil=x.soil||{};
      rows.push({boreholeId:id,methodId,ok:x.ok===true,QbKn:num(methodId==='10304-spt'?soil.RubKn:soil.tipResistanceKn),QsKn:num(methodId==='10304-spt'?soil.RufKn:soil.sideResistanceKn),RkKn:num(soil.RkKn),RdKn:num(x.soilResistanceKn),RmaterialKn:num(x.materialResistanceKn),RpileKn:num(x.pileResistanceKn),NdMaxFinalKn:num(x.demandLimitKn),governing:x.governing||null});
    }
  }
  if(rows.some(r=>!r.ok))return{ok:false,rows};
  const p=minSet(rows,'RpileKn'),s=minSet(rows,'RdKn'),qb=minSet(rows,'QbKn'),qs=minSet(rows,'QsKn');
  const materialTie=p.rows.length>1&&p.rows.every(r=>r.governing==='MATERIAL');
  const derivedGamma=(num(rows[0]?.NdMaxFinalKn)>0&&num(rows[0]?.RpileKn)>0)?num(rows[0].RpileKn)/num(rows[0].NdMaxFinalKn):null;
  const gn=num(gammaN??derivedGamma);
  return{ok:true,rows,pileResistanceMinKn:p.value,criticalRows:p.rows.map(r=>`${r.boreholeId}:${r.methodId}`),criticalBoreholeId:materialTie?null:(p.rows[0]?.boreholeId??null),criticalMethodId:materialTie?null:(p.rows[0]?.methodId??null),criticalTie:p.rows.length>1,materialTie,soilMinimumKn:s.value,soilMinimumRows:s.rows.map(r=>`${r.boreholeId}:${r.methodId}`),tipMinimumKn:qb.value,shaftMinimumKn:qs.value,gammaN:gn,NdMaxBatchKn:gn>0?p.value/gn:null};
}
