// HNL P0 XLSM reverse-engineering — deterministic pile geometry engine.
// This module contains geometry identities only. It does not infer TCVN design factors.
// Benchmark basis: visible formulas in DCE workbook sheets 7.2.1/7.2.2/7.2.3 and SCT VatLieu.

export const PILE_GEOMETRY_STATUS = Object.freeze({
  status: 'VERIFIED',
  scope: 'DETERMINISTIC_GEOMETRY',
  basis: 'Independent geometry identities + visible XLSM formula benchmark; no XLL/VBA dependency.'
});

function finite(v){
  if(v===null||v===undefined||String(v).trim()==='') return null;
  const n=Number(v); return Number.isFinite(n)?n:null;
}
function positive(v,label){
  const n=finite(v); if(!(n>0)) throw new Error(`${label} phải > 0 m.`); return n;
}
function nonnegative(v,label){
  const n=finite(v) ?? 0; if(n<0) throw new Error(`${label} không được âm.`); return n;
}
function validateInner(inner,outer,label){
  if(inner>=outer-1e-12) throw new Error(`${label} phải nhỏ hơn kích thước ngoài của cọc.`);
}

export function calculatePileGeometry(input={}){
  const shape=String(input.shape||'circle').toLowerCase();
  const suppliedLength=finite(input.lengthM);
  const head=finite(input.headLevelM ?? input.headCoordinateM ?? input.headDepthM);
  const tip=finite(input.tipLevelM ?? input.tipCoordinateM ?? input.tipDepthM);
  const derivedLength=head!=null&&tip!=null ? Math.abs(tip-head) : null;
  const lengthM=suppliedLength!=null ? suppliedLength : derivedLength;
  if(lengthM!=null && !(lengthM>0)) throw new Error('Chiều dài cọc phải > 0 m.');

  let tipAreaM2, concreteAreaM2, perimeterM, secondMomentM4;
  let outerDimensionM, tipInnerDimensionM=0, massInnerDimensionM=0;

  if(shape==='circle' || shape==='circular' || shape==='round'){
    const d=positive(input.outerDiameterM ?? input.diameterM,'Đường kính ngoài');
    const diTip=nonnegative(input.tipInnerDiameterM ?? input.innerDiameterTipM,'Đường kính trong dùng cho diện tích mũi');
    const diMass=nonnegative(input.massInnerDiameterM ?? input.innerDiameterMassM ?? diTip,'Đường kính trong dùng cho thể tích/trọng lượng');
    validateInner(diTip,d,'Di_tip'); validateInner(diMass,d,'Di_mass');
    outerDimensionM=d; tipInnerDimensionM=diTip; massInnerDimensionM=diMass;
    tipAreaM2=Math.PI*(d*d-diTip*diTip)/4;
    concreteAreaM2=Math.PI*(d*d-diMass*diMass)/4;
    perimeterM=Math.PI*d;
    secondMomentM4=Math.PI*(d**4-diMass**4)/64;
  } else if(shape==='square' || shape==='rect-square'){
    const a=positive(input.sideM ?? input.outerSideM,'Cạnh ngoài cọc vuông');
    const aiTip=nonnegative(input.tipInnerSideM ?? input.innerSideTipM,'Cạnh rỗng dùng cho diện tích mũi');
    const aiMass=nonnegative(input.massInnerSideM ?? input.innerSideMassM ?? aiTip,'Cạnh rỗng dùng cho thể tích/trọng lượng');
    validateInner(aiTip,a,'Kích thước rỗng mũi'); validateInner(aiMass,a,'Kích thước rỗng khối lượng');
    outerDimensionM=a; tipInnerDimensionM=aiTip; massInnerDimensionM=aiMass;
    tipAreaM2=a*a-aiTip*aiTip;
    concreteAreaM2=a*a-aiMass*aiMass;
    perimeterM=4*a;
    secondMomentM4=(a**4-aiMass**4)/12;
  } else {
    throw new Error(`Chưa hỗ trợ hình dạng cọc: ${input.shape}.`);
  }

  const volumeM3=lengthM!=null ? concreteAreaM2*lengthM : null;
  const unitWeightKnM3=finite(input.unitWeightKnM3);
  const selfWeightKn=volumeM3!=null&&unitWeightKnM3!=null ? volumeM3*unitWeightKnM3 : null;
  const lengthConflict=suppliedLength!=null&&derivedLength!=null ? Math.abs(suppliedLength-derivedLength)>1e-6 : false;

  return {
    shape: shape==='square'||shape==='rect-square' ? 'square' : 'circle',
    outerDimensionM, tipInnerDimensionM, massInnerDimensionM,
    tipAreaM2, areaM2:tipAreaM2,
    concreteAreaM2, perimeterM, secondMomentM4,
    lengthM:lengthM??null, derivedLengthM:derivedLength,
    volumeM3, unitWeightKnM3, selfWeightKn,
    headCoordinateM:head, tipCoordinateM:tip,
    lengthConflict,
    verification:PILE_GEOMETRY_STATUS
  };
}

export function circlePileGeometry(input={}){
  return calculatePileGeometry({...input,shape:'circle'});
}
export function squarePileGeometryDeterministic(input={}){
  return calculatePileGeometry({...input,shape:'square'});
}
