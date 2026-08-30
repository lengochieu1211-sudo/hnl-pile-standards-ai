import { buildP4ExcelPlan, exportP4ExcelWorkbook } from '../p4-pdf-excel-intelligence.js';
import { validateP4ConfirmationSource, validateP4ReviewConfirmation } from './confirmation-contract.js';

export const P4_REVIEW_PRODUCTION_MODE='REVIEW_PRODUCTION_EXPORT_CANDIDATE';

function text(v=''){return String(v??'').trim();}
function lowConfidence(source={}){
  return source.confidenceUsable===true&&Number.isFinite(Number(source.confidence))&&Number(source.confidence)<0.75;
}

export function evaluateP4ReviewProductionExport(packet={},confirmation={},opts={}){
  const reasons=[];
  const source=packet?.source||{};
  const src=validateP4ConfirmationSource(source);
  if(!src.ok)reasons.push(...src.errors);
  if(text(source.state)!=='VERIFIED')reasons.push('SOURCE_NOT_VERIFIED');
  if(lowConfidence(source))reasons.push('SOURCE_CONFIDENCE_BELOW_075');
  if(packet?.promotionState!=='SHADOW_ONLY')reasons.push('UNEXPECTED_SOURCE_PROMOTION_STATE');
  if(packet?.productionMutationAllowed!==false)reasons.push('SOURCE_PRODUCTION_MUTATION_BARRIER_MISSING');
  if(packet?.calculationEngineMutationAllowed!==false)reasons.push('SOURCE_CALCULATION_BARRIER_MISSING');

  const confirmationCheck=validateP4ReviewConfirmation(confirmation,{
    source,
    fieldKey:text(opts.fieldKey||'__packet__'),
    value:opts.value??packet?.text??null,
    maxAgeMs:opts.maxAgeMs,
  });
  if(!confirmationCheck.ok)reasons.push(...confirmationCheck.errors);

  return {
    mode:P4_REVIEW_PRODUCTION_MODE,
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
