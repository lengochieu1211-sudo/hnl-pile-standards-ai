// Independent Excel-like evaluator used by P1 Pass 1 Golden.
// It mirrors the Formula-Only workbook graph, not the PileMaterialEngine implementation.
import { lookup5574Concrete, lookup5574Steel, lookup5574Table16LongTermPhi } from './codepack-tables.js';

export function evaluatePileMaterialExcelModel(input={}){
  const c=lookup5574Concrete(String(input.grade||'B30').toUpperCase());
  const s=lookup5574Steel(String(input.steel||'CB400-V').toUpperCase());
  const w=Number(input.widthMm??input.sideMm),h=Number(input.heightMm??input.sideMm),As=Number(input.AsTotMm2),L0=Number(input.L0Mm),e0=Number(input.e0Mm),duration=String(input.loadDuration||'long').toLowerCase();
  const e0IncludesRandom=input.e0IncludesRandom===true||input.eccentricityIncludesRandom===true;
  const reinforcementOppositeSides=input.reinforcementOppositeSides===true||input.reinforcementSymmetricPerimeter===true;
  if(!c||!s||![w,h,As,L0,e0].every(Number.isFinite)||w<=0||h<=0||As<0||L0<0||e0<0||!e0IncludesRandom||!reinforcementOppositeSides) return {ok:false};
  const ratio=L0/h; if(ratio>20||e0>h/30+1e-3||e0<Math.max(h/30,10)-1e-3) return {ok:false};
  let phi;
  if(duration.startsWith('short')) { if(ratio<10||ratio>20) return {ok:false}; phi=0.95-0.005*ratio; }
  else { const r=lookup5574Table16LongTermPhi(c.grade,ratio); if(!r.ok) return {ok:false}; phi=r.value; }
  const A=w*h,Nu=phi*(c.Rb*A+s.Rsc*As)/1000;
  return {ok:true,Amm2:A,ratio,phi,Rb:c.Rb,Rsc:s.Rsc,NuKn:Nu};
}

export function evaluateGoverningExcelModel({soilRdKn,materialNuKn}={}){
  const a=Number(soilRdKn),b=Number(materialNuKn); if(!(a>0&&b>0)) return {ok:false};
  return {ok:true,pileResistanceKn:Math.min(a,b),governing:a<=b?'SOIL':'MATERIAL'};
}
