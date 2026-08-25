// HNL P1 Pass 2 — deterministic Multi-Borehole batch engine.
// One pile geometry/material branch is evaluated against many boreholes and
// both Mechanical (7.2.2/7.2.3) + SPT Appendix D methods. AI never owns math.

import { calculateDrivenPile10304, calculateBoredPile10304, calculateSptPile10304 } from './pile-workflows.js';
import { calculateNearCenteredRectPileCapacity5574 } from './pile-material-engine.js';
import { combineLockedPileResistance } from './pile-capacity-engine.js';
import { boreholeCoverageAudit, findLayerAtDepth, normalizeBoreholeLayers } from './borehole-engine.js';
import { productionStatusFor } from './production-status-registry.js';

const num=v=>{ if(v==null||v==='') return null; const n=Number(v); return Number.isFinite(n)?n:null; };
const TOL=1e-8;

export const MULTI_BOREHOLE_STATUS=Object.freeze({
  status:'LOCKED',
  productionNumeric:true,
  scope:'SQUARE_PILE_MULTI_BOREHOLE_MECHANICAL_PLUS_SPT',
  basis:'Each child workflow is independently LOCKED; batch only orchestrates, compares and selects minima.'
});

function methodLabel(workflowId){
  return workflowId==='10304-driven'?'CƠ LÝ · 7.2.2 CỌC ĐÓNG/ÉP':workflowId==='10304-bored'?'CƠ LÝ · 7.2.3 CỌC KHOAN/NHỒI':workflowId==='10304-spt'?'SPT · PHỤ LỤC D':workflowId;
}
function sptPileTypeForMechanical(workflowId,explicit){
  if(explicit) return explicit;
  return workflowId==='10304-driven'?'driven':'bored';
}
function resultComponents(workflowId,result={}){
  if(workflowId==='10304-spt') return {QbKn:num(result.RubKn),QsKn:num(result.RufKn)};
  return {QbKn:num(result.tipResistanceKn),QsKn:num(result.sideResistanceKn)};
}
function tipSoil(result={},layers=[]){
  const t=result?.tipLayer || findLayerAtDepth(layers,num(result?.tipDepthM),{boundaryPolicy:'deeper'});
  if(!t) return null;
  return {index:t.index??null,top:num(t.top),bottom:num(t.bottom),soilGroup:t.soilGroup||null,soilClass:t.soilClass||null,sandType:t.sandType||null,IL:num(t.IL),sptN:num(t.sptN),cuKpa:num(t.cuKpa)};
}
function rowKey(r){return `${r.boreholeId}:${r.methodId}`;}
function minRows(rows,field){
  const valid=rows.filter(r=>r.ok&&Number.isFinite(num(r[field])));
  if(!valid.length) return {value:null,rows:[]};
  const value=Math.min(...valid.map(r=>num(r[field])));
  return {value,rows:valid.filter(r=>Math.abs(num(r[field])-value)<=Math.max(TOL,TOL*Math.max(1,Math.abs(value))))};
}
function soilCause(row){
  if(row.governing==='MATERIAL') return 'VẬT LIỆU KHỐNG CHẾ';
  const q1=num(row.QbKn),q2=num(row.QsKn);
  if(q1==null||q2==null) return 'ĐẤT NỀN KHỐNG CHẾ';
  if(q1<q2) return 'ĐẤT NỀN KHỐNG CHẾ · THÀNH PHẦN MŨI NHỎ HƠN';
  if(q2<q1) return 'ĐẤT NỀN KHỐNG CHẾ · THÀNH PHẦN THÂN NHỎ HƠN';
  return 'ĐẤT NỀN KHỐNG CHẾ · MŨI/THÂN TƯƠNG ĐƯƠNG';
}

function calculateSoil(methodId,input){
  if(methodId==='10304-driven') return calculateDrivenPile10304(input);
  if(methodId==='10304-bored') return calculateBoredPile10304(input);
  if(methodId==='10304-spt') return calculateSptPile10304(input);
  return {ok:false,status:'REVIEW',missing:[`Multi-Borehole chưa LOCKED cho workflow ${methodId}.`]};
}

export function calculateMultiBoreholePileCapacity({
  mechanicalWorkflowId='10304-driven', pileInput={}, mechanicalInput={}, sptInput={}, boreholes=[], materialInput={}, gammaN=null
}={}){
  const registry=productionStatusFor('pile-capacity-multiborehole-square');
  const issues=[];
  if(!['10304-driven','10304-bored'].includes(mechanicalWorkflowId)) issues.push('Cơ lý Multi-Borehole hiện LOCKED cho 7.2.2 cọc đóng/ép hoặc 7.2.3 cọc khoan/nhồi.');
  const xs=(Array.isArray(boreholes)?boreholes:[]).map((b,i)=>({
    ...b,id:String(b.id||b.name||`HK${i+1}`),layers:normalizeBoreholeLayers(b.layers||[]),sptPoints:Array.isArray(b.sptPoints)?b.sptPoints:[]
  }));
  if(xs.length<2) issues.push('Multi-Borehole cần ít nhất 2 lỗ khoan hợp lệ.');
  const duplicateIds=xs.map(x=>x.id).filter((id,i,a)=>a.indexOf(id)!==i); if(duplicateIds.length) issues.push(`Trùng mã lỗ khoan: ${[...new Set(duplicateIds)].join(', ')}.`);

  const materialResult=calculateNearCenteredRectPileCapacity5574(materialInput);
  if(materialResult?.ok!==true||materialResult?.productionNumeric!==true) issues.push(...(materialResult?.missing||['Rmaterial chưa VERIFIED.']));
  if(registry.productionNumeric!==true||registry.status!=='LOCKED') issues.push('Production Registry chưa khóa Multi-Borehole.');
  if(issues.length) return {ok:false,status:'REVIEW',productionNumeric:false,issues,materialResult,rows:[]};

  const rows=[];
  for(const bh of xs){
    const common={...pileInput,layers:bh.layers};
    const tipDepth=num(common.tipDepthM)??num(common.lengthM);
    const shaftStart=num(common.shaftStartDepthM)??0;
    let coverage={ok:false,gaps:[]};
    try{ coverage=boreholeCoverageAudit(bh.layers,{startDepthM:shaftStart,endDepthM:tipDepth}); }catch{ coverage={ok:false,gaps:[{top:shaftStart,bottom:tipDepth}]}; }
    for(const methodId of [mechanicalWorkflowId,'10304-spt']){
      const methodOverrides=methodId==='10304-spt'?sptInput:mechanicalInput;
      const input={...common,...methodOverrides,...(methodId==='10304-spt'?(bh.sptInput||{}):(bh.mechanicalInput||{})),layers:bh.layers};
      if(methodId==='10304-spt'){
        input.sptPoints=bh.sptPoints;
        input.pileType=sptPileTypeForMechanical(mechanicalWorkflowId,input.pileType);
      }
      if(gammaN!=null) input.gammaN=gammaN;
      let soilResult;
      if(!coverage.ok) soilResult={ok:false,status:'REVIEW',missing:[`Địa tầng ${bh.id} không phủ kín đoạn ${shaftStart}–${tipDepth} m.`],coverage};
      else soilResult=calculateSoil(methodId,input);
      const comp=resultComponents(methodId,soilResult);
      const combined=soilResult?.ok===true?combineLockedPileResistance({soilWorkflowId:methodId,soilResult,soilInput:input,materialResult,gammaN:gammaN??soilResult.gammaN}):{ok:false,issues:soilResult?.missing||[]};
      rows.push({
        boreholeId:bh.id,boreholeName:bh.name||bh.id,methodId,methodLabel:methodLabel(methodId),ok:combined.ok===true,
        coverage,soilInput:input,soilResult,materialResult,combined,
        QbKn:comp.QbKn,QsKn:comp.QsKn,RkKn:num(soilResult?.RkKn),RdKn:num(soilResult?.RdKn),RmaterialKn:num(materialResult?.materialResistanceKn??materialResult?.NuKn),
        RpileKn:num(combined?.pileResistanceKn),NdMaxFinalKn:num(combined?.demandLimitKn),governing:combined?.governing||null,
        soilAtTip:tipSoil(soilResult,bh.layers),issues:combined.ok===true?[]:[...(soilResult?.missing||[]),...(combined?.issues||[])]
      });
    }
  }

  const invalidRows=rows.filter(r=>!r.ok);
  if(invalidRows.length) return {ok:false,status:'REVIEW',productionNumeric:false,mechanicalWorkflowId,materialResult,rows,invalidRows,issues:[`${invalidRows.length}/${rows.length} nhánh HK×method chưa đủ điều kiện Production.`]};

  const pileMin=minRows(rows,'RpileKn'),soilMin=minRows(rows,'RdKn'),qbMin=minRows(rows,'QbKn'),qsMin=minRows(rows,'QsKn');
  const criticalRows=pileMin.rows;
  const materialTie=criticalRows.length>1&&criticalRows.every(r=>r.governing==='MATERIAL');
  const critical=materialTie?null:(criticalRows[0]||null);
  const soilCritical=soilMin.rows[0]||null;
  const perBorehole=xs.map(bh=>{
    const rs=rows.filter(r=>r.boreholeId===bh.id); const mm=minRows(rs,'RpileKn');
    return {boreholeId:bh.id,minimumPileResistanceKn:mm.value,adverseMethodIds:mm.rows.map(r=>r.methodId),tie:mm.rows.length>1,rows:rs.map(r=>rowKey(r))};
  });
  const cause=materialTie
    ?'VẬT LIỆU KHỐNG CHẾ CHUNG: Rpile bằng Rmaterial ở nhiều lỗ khoan/phương pháp; không gán giả một lỗ khoan khống chế. Xem soilCritical để biết HK/method bất lợi riêng về đất.'
    :critical?soilCause(critical):'KHÔNG XÁC ĐỊNH';

  return {
    ok:true,workflow:'pile-capacity-multiborehole',status:'VERIFIED',productionNumeric:true,mechanicalWorkflowId,
    materialResult,rows,perBorehole,pileResistanceMinKn:pileMin.value,criticalRows:criticalRows.map(r=>rowKey(r)),
    criticalBoreholeId:critical?.boreholeId??null,criticalMethodId:critical?.methodId??null,criticalMethodLabel:critical?.methodLabel??null,
    criticalTie:criticalRows.length>1,materialTie,governingCause:cause,
    soilMinimum:{valueKn:soilMin.value,rows:soilMin.rows.map(rowKey),boreholeId:soilCritical?.boreholeId??null,methodId:soilCritical?.methodId??null},
    tipMinimum:{valueKn:qbMin.value,rows:qbMin.rows.map(rowKey)},shaftMinimum:{valueKn:qsMin.value,rows:qsMin.rows.map(rowKey)},
    gammaN:num(gammaN??rows[0]?.combined?.gammaN),NdMaxBatchKn:num(gammaN??rows[0]?.combined?.gammaN)>0?pileMin.value/num(gammaN??rows[0]?.combined?.gammaN):null,
    steps:[
      `Chạy ${xs.length} lỗ khoan × 2 phương pháp = ${rows.length} nhánh deterministic.`,
      `Rpile,min=${pileMin.value.toFixed(3)} kN từ min[Rsoil(HK,method), Rmaterial].`,
      materialTie?cause:`Bất lợi tổng hợp: ${critical.boreholeId} · ${critical.methodLabel} · ${cause}.`,
      `Bất lợi riêng đất: ${soilCritical?.boreholeId||'-'} · ${soilCritical?.methodLabel||'-'} · Rd,min=${soilMin.value?.toFixed(3)} kN.`
    ],
    provenance:{
      batch:{status:'HNL-LOCKED-COMPOSITION',rule:'For each borehole: run Mechanical + SPT; Rpile=min(Rd, Rmaterial); batch governing=min(Rpile).'},
      material:materialResult?.provenance||[],
      boreholes:xs.map(b=>({id:b.id,source:b.source||'USER/PROJECT-BOREHOLE',layerCount:b.layers.length,sptPointCount:b.sptPoints.length}))
    }
  };
}
