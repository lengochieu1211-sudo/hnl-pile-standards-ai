import { buildP4ExcelPlan, exportP4ExcelWorkbook } from '../p4-pdf-excel-intelligence.js';
import { validateP4ConfirmationSource, validateP4ReviewConfirmation } from './confirmation-contract.js';

export const P4_REVIEW_PRODUCTION_MODE='REVIEW_PRODUCTION_EXPORT';
export const P4_REVIEW_PRODUCTION_SCHEMA='HNL_P4_REVIEW_PRODUCTION_EXPORT_V1';
export const P4_REVIEW_PRODUCTION_STATE='VERIFIED_FOR_EXPORT';
export const P4_REVIEW_PRODUCTION_SCOPE='WORKBOOK_EXPORT_ONLY';

function text(v=''){return String(v??'').trim();}
function lowConfidence(source={}){
  return source.confidenceUsable===true&&Number.isFinite(Number(source.confidence))&&Number(source.confidence)<0.75;
}
function valueFor(packet={},opts={}){return Object.prototype.hasOwnProperty.call(opts,'value')?opts.value:packet?.text??null;}
function fieldKeyFor(opts={}){return text(opts.fieldKey||'__packet__');}
function markerValid(packet={}){
  const m=packet?.reviewProduction||{};
  return m.schema===P4_REVIEW_PRODUCTION_SCHEMA&&m.state===P4_REVIEW_PRODUCTION_STATE&&m.scope===P4_REVIEW_PRODUCTION_SCOPE;
}
function barrierReasons(packet={}){
  const reasons=[];
  if(packet?.promotionState!=='SHADOW_ONLY')reasons.push('UNEXPECTED_SOURCE_PROMOTION_STATE');
  if(packet?.productionMutationAllowed!==false)reasons.push('SOURCE_PRODUCTION_MUTATION_BARRIER_MISSING');
  if(packet?.calculationEngineMutationAllowed!==false)reasons.push('SOURCE_CALCULATION_BARRIER_MISSING');
  return reasons;
}

export function createP4ReviewedNativeExportPacket(packet={},confirmation={},opts={}){
  const source=packet?.source||{};
  const src=validateP4ConfirmationSource(source);
  const reasons=[...barrierReasons(packet)];
  if(!src.ok)reasons.push(...src.errors);
  if(text(source.sourceType)!=='pdf-native')reasons.push('REVIEW_PRODUCTION_NATIVE_PDF_ONLY');
  if(!['REVIEW','VERIFIED'].includes(text(source.state)))reasons.push('SOURCE_STATE_NOT_REVIEW_ELIGIBLE');
  if(lowConfidence(source))reasons.push('SOURCE_CONFIDENCE_BELOW_075');
  const fieldKey=fieldKeyFor(opts),value=valueFor(packet,opts);
  const confirmed=validateP4ReviewConfirmation(confirmation,{source,fieldKey,value,maxAgeMs:opts.maxAgeMs});
  if(!confirmed.ok)reasons.push(...confirmed.errors);
  if(reasons.length){
    const error=new Error(`P4_REVIEW_PRODUCTION_DERIVATION_BLOCKED:${[...new Set(reasons)].join(',')}`);
    error.code='P4_REVIEW_PRODUCTION_DERIVATION_BLOCKED';
    error.reasons=[...new Set(reasons)];
    throw error;
  }
  return {
    ...packet,
    source:{...source},
    trust:packet?.trust?{...packet.trust}:packet?.trust,
    warnings:[...(Array.isArray(packet?.warnings)?packet.warnings:[]),'Đã xác nhận nguồn PDF native cho phạm vi xuất workbook בלבד; không phải xác nhận Calculation Engine.'],
    reviewProduction:{
      schema:P4_REVIEW_PRODUCTION_SCHEMA,
      state:P4_REVIEW_PRODUCTION_STATE,
      scope:P4_REVIEW_PRODUCTION_SCOPE,
      fieldKey,
      confirmedAt:confirmation.confirmedAt,
      sourceSha:src.source.sourceSha,
      confirmation,
      workbookProductionExportAllowed:true,
      productionMutationAllowed:false,
      calculationEngineMutationAllowed:false,
    },
  };
}

export function evaluateP4ReviewProductionExport(packet={},confirmation={},opts={}){
  const reasons=[...barrierReasons(packet)];
  const source=packet?.source||{};
  const src=validateP4ConfirmationSource(source);
  if(!src.ok)reasons.push(...src.errors);
  if(text(source.sourceType)!=='pdf-native')reasons.push('REVIEW_PRODUCTION_NATIVE_PDF_ONLY');
  if(lowConfidence(source))reasons.push('SOURCE_CONFIDENCE_BELOW_075');

  const marker=packet?.reviewProduction||{};
  const scoped=markerValid(packet);
  const globallyVerified=text(source.state)==='VERIFIED';
  if(!globallyVerified&&!scoped)reasons.push('SOURCE_NOT_VERIFIED_FOR_EXPORT');
  if(scoped){
    if(marker.productionMutationAllowed!==false)reasons.push('REVIEW_PRODUCTION_MUTATION_BARRIER_MISSING');
    if(marker.calculationEngineMutationAllowed!==false)reasons.push('REVIEW_CALCULATION_BARRIER_MISSING');
    if(text(marker.sourceSha)!==text(source.sourceSha).toLowerCase())reasons.push('REVIEW_PRODUCTION_SOURCE_SHA_MISMATCH');
  }

  const record=confirmation?.schema?confirmation:(scoped?marker.confirmation:{});
  const fieldKey=scoped?text(marker.fieldKey||fieldKeyFor(opts)):fieldKeyFor(opts);
  const confirmationCheck=validateP4ReviewConfirmation(record,{
    source,
    fieldKey,
    value:valueFor(packet,opts),
    maxAgeMs:opts.maxAgeMs,
  });
  if(!confirmationCheck.ok)reasons.push(...confirmationCheck.errors);

  return {
    mode:P4_REVIEW_PRODUCTION_MODE,
    state:scoped?P4_REVIEW_PRODUCTION_STATE:(globallyVerified?'SOURCE_VERIFIED':'BLOCKED'),
    scope:P4_REVIEW_PRODUCTION_SCOPE,
    ready:reasons.length===0,
    workbookProductionExportAllowed:reasons.length===0,
    productionMutationAllowed:false,
    calculationEngineMutationAllowed:false,
    reasons:[...new Set(reasons)],
    source:src.source,
  };
}

export async function exportP4ReviewedProductionWorkbook(packet={},confirmation={},opts={}){
  const gate=evaluateP4ReviewProductionExport(packet,confirmation,opts);
  if(!gate.ready){
    const error=new Error(`P4_REVIEW_PRODUCTION_EXPORT_BLOCKED:${gate.reasons.join(',')}`);
    error.code='P4_REVIEW_PRODUCTION_EXPORT_BLOCKED';
    error.gate=gate;
    throw error;
  }
  const plan=buildP4ExcelPlan([packet]);
  if(plan?.calculationEngineMutationAllowed!==false||plan?.productionMutationAllowed!==false){
    throw new Error('P4_REVIEW_PRODUCTION_EXPORT_BARRIER_REGRESSION');
  }
  const out=await exportP4ExcelWorkbook([packet],{...opts,validateOnly:opts.validateOnly!==false});
  return {...out,promotionGate:gate,mode:P4_REVIEW_PRODUCTION_MODE};
}
