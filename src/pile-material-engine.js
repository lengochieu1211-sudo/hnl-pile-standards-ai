// HNL P1 Pass 1 — pile material capacity / governing engine.
// XLSM is REFERENCE only. Numeric production is unlocked only for TCVN branches
// independently verified from the standard and benchmarked Engine <-> Excel.

import { lookup5574Concrete, lookup5574Steel, lookup5574Table16LongTermPhi } from './codepack-tables.js';
import { calcCircularColumn5574, calcAnnularColumn5574 } from './tcvn5574-core.js';

const num=v=>{ if(v==null||v==='') return null; const n=Number(v); return Number.isFinite(n)?n:null; };
const gradeNum=g=>Number(String(g||'').toUpperCase().replace('B','').replace(',','.'));

export const PILE_MATERIAL_PROVENANCE = Object.freeze({
  nearCenteredRect:{standard:'TCVN 5574:2018',clause:'8.1.2.4.3',formula:'(49)–(50)',table:'Bảng 16',standardPage:'61–62',pdfPage:'59–60',status:'VERIFIED'},
  materials:{standard:'TCVN 5574:2018',tables:'Bảng 7, 10, 13, 14',standardPage:'35, 38, 47, 48',pdfPage:'33, 36, 45, 46',status:'VERIFIED'},
  circular:{standard:'TCVN 5574:2018',clause:'Phụ lục F',formula:'F.1–F.10',standardPage:'166–168',pdfPage:'164–166',status:'VERIFIED'},
  xlsm:{file:'10.1 DCE_SctCoc_10304 2025.xlsm',sheet:'SCT VatLieu',status:'REFERENCE/BUGGED',note:'Không phải nguồn pháp lý; công thức φ và các hệ số workbook không được dùng để mở Production.'}
});

export function shortTermPhi5574(slendernessRatio){
  const x=num(slendernessRatio);
  if(x==null||x<10||x>20) return {ok:false,error:'CT49_SHORT_TERM_OUTSIDE_VERIFIED_ANCHORS',domain:[10,20]};
  // 8.1.2.4.3: chỉ hai mốc được nêu rõ cho tải ngắn hạn: 10→0.90 và 20→0.85.
  // HNL nội suy giữa hai mốc và không ngoại suy ra ngoài [10,20].
  return {ok:true,value:0.95-0.005*x,mode:'LINEAR_1D',anchors:[[10,0.90],[20,0.85]]};
}

export function calculateNearCenteredRectPileCapacity5574(input={}){
  const grade=String(input.grade||'B30').toUpperCase();
  const steel=String(input.steel||'CB400-V').toUpperCase();
  const concrete=lookup5574Concrete(grade), rebar=lookup5574Steel(steel);
  const shape=String(input.shape||'square').toLowerCase();
  const sideMm=num(input.sideMm ?? (num(input.sideM)!=null?num(input.sideM)*1000:null));
  const widthMm=num(input.widthMm ?? sideMm);
  const heightMm=num(input.heightMm ?? sideMm);
  const areaMm2=num(input.concreteAreaMm2) ?? (widthMm!=null&&heightMm!=null?widthMm*heightMm:null);
  const AsTotMm2=num(input.AsTotMm2 ?? input.AsMm2 ?? input.As);
  const L0Mm=num(input.L0Mm ?? (num(input.L0M)!=null?num(input.L0M)*1000:null));
  const memberLengthMm=num(input.memberLengthMm ?? (num(input.memberLengthM)!=null?num(input.memberLengthM)*1000:null));
  const staticEccentricityMm=num(input.staticEccentricityMm ?? (num(input.staticEccentricityM)!=null?num(input.staticEccentricityM)*1000:null));
  const structuralSystem=String(input.structuralSystem||'').toLowerCase();
  let e0Mm=num(input.e0Mm ?? (num(input.e0M)!=null?num(input.e0M)*1000:null));
  let e0IncludesRandom=input.e0IncludesRandom===true||input.eccentricityIncludesRandom===true;
  let eaMm=null;
  if(e0Mm==null && heightMm>0 && memberLengthMm>=0 && staticEccentricityMm>=0 && structuralSystem){
    eaMm=Math.max(memberLengthMm/600,heightMm/30,10);
    if(/indeterminate|sieu tinh|siêu tĩnh/.test(structuralSystem)) e0Mm=Math.max(staticEccentricityMm,eaMm);
    else if(/determinate|tinh dinh|tĩnh định/.test(structuralSystem)) e0Mm=staticEccentricityMm+eaMm;
    if(e0Mm!=null) e0IncludesRandom=true;
  }
  const reinforcementOppositeSides=input.reinforcementOppositeSides===true||input.reinforcementSymmetricPerimeter===true;
  const duration=String(input.loadDuration||'long').toLowerCase();
  const missing=[];
  if(!concrete) missing.push('Cấp bê tông phải có trong Bảng 7/10 VERIFIED.');
  if(!rebar) missing.push('Cấp thép phải có trong Bảng 13/14 VERIFIED.');
  if(!['square','rectangle','rectangular'].includes(shape)) missing.push('CT (49)–(50) chỉ mở Production cho tiết diện chữ nhật/vuông.');
  if(!(widthMm>0&&heightMm>0&&areaMm2>0)) missing.push('Kích thước/diện tích tiết diện bê tông.');
  if(!(AsTotMm2>=0)) missing.push('As,tot (mm²).');
  if(!(L0Mm>=0)) missing.push('Chiều dài tính toán L0.');
  if(!(e0Mm>=0)) missing.push('e0 cuối cùng theo 8.1.2.2.4, đã kể độ lệch tâm ngẫu nhiên ea; hoặc cung cấp L, e tĩnh học và loại hệ để HNL tự tính.');
  if(e0Mm>=0 && !e0IncludesRandom) missing.push('Phải xác nhận e0 đã kể độ lệch tâm ngẫu nhiên ea theo 8.1.2.2.4.');
  if(!reinforcementOppositeSides) missing.push('Phải xác nhận cốt thép dọc nằm ở các phía đối diện nhau trong mặt phẳng uốn theo 8.1.2.4.3.');
  if(missing.length) return {ok:false,missing,status:'REVIEW'};
  const ratio=L0Mm/heightMm;
  const minimumEaWithoutLength=Math.max(heightMm/30,10);
  if(e0Mm<minimumEaWithoutLength-1e-3) return {ok:false,missing:[`e0=${e0Mm.toFixed(3)} mm nhỏ hơn giới hạn tối thiểu của ea=max(L/600,h/30,10 mm); ngay cả khi chưa biết L thì ea ≥ ${minimumEaWithoutLength.toFixed(3)} mm.`],status:'OUT_OF_SCOPE',e0Mm,minimumEaWithoutLength};
  if(ratio>20+1e-12) return {ok:false,missing:['8.1.2.4.3 yêu cầu L0/h ≤ 20.'],status:'OUT_OF_SCOPE',slendernessRatio:ratio};
  if(e0Mm>heightMm/30+1e-3) return {ok:false,missing:['8.1.2.4.3 yêu cầu e0 ≤ h/30.'],status:'OUT_OF_SCOPE',e0Mm,limitE0Mm:heightMm/30};
  let phiLookup;
  if(duration.startsWith('short')||duration.includes('ngan')||duration.includes('ngắn')) phiLookup=shortTermPhi5574(ratio);
  else phiLookup=lookup5574Table16LongTermPhi(grade,ratio);
  if(!phiLookup?.ok){
    const msg=phiLookup?.error==='SLENDERNESS_OUTSIDE_TABLE16'
      ? 'Bảng 16 dài hạn chỉ có miền L0/h=6…20; HNL không ngoại suy ra ngoài bảng.'
      : phiLookup?.error==='CT49_SHORT_TERM_OUTSIDE_VERIFIED_ANCHORS'
        ? 'Tải ngắn hạn chỉ nội suy giữa hai mốc VERIFIED L0/h=10…20; HNL không ngoại suy.'
        : 'Không tra được φ trong phạm vi VERIFIED của CT (49)–(50)/Bảng 16.';
    return {ok:false,missing:[msg],status:'REVIEW',slendernessRatio:ratio,phiLookup};
  }
  const concretePartN=concrete.Rb*areaMm2;
  const steelPartN=rebar.Rsc*AsTotMm2;
  const NuKn=phiLookup.value*(concretePartN+steelPartN)/1000;
  return {ok:true,workflow:'pile-material-5574-near-centered-rect',status:'VERIFIED',productionNumeric:true,
    inputs:{grade,steel,shape,widthMm,heightMm,concreteAreaMm2:areaMm2,AsTotMm2,L0Mm,e0Mm,e0IncludesRandom,reinforcementOppositeSides,memberLengthMm,staticEccentricityMm,structuralSystem,loadDuration:duration},
    materials:{RbMpa:concrete.Rb,EbMpa:concrete.Eb,RscMpa:rebar.Rsc,RsMpa:rebar.Rs},
    randomEccentricityMm:eaMm,minimumRandomEccentricityWithoutLengthMm:minimumEaWithoutLength,
    slendernessRatio:ratio,phi:phiLookup.value,phiMode:phiLookup.mode,phiBracket:phiLookup.bracket||phiLookup.anchors,
    concreteContributionKn:phiLookup.value*concretePartN/1000,steelContributionKn:phiLookup.value*steelPartN/1000,
    materialResistanceKn:NuKn,NuKn,capacityBasis:'DESIGN_RESISTANCE_TTGH1',
    steps:[`Bảng 7/13: Rb=${concrete.Rb} MPa; Rsc=${rebar.Rsc} MPa.`,`8.1.2.2.4: e0=${e0Mm.toFixed(3)} mm đã kể ea; ea tối thiểu không xét L là ${minimumEaWithoutLength.toFixed(3)} mm.`,`8.1.2.4.3: cốt dọc ở các phía đối diện; e0≤h/30=${(heightMm/30).toFixed(3)} mm; L0/h=${ratio.toFixed(4)}≤20.`,`φ=${phiLookup.value.toFixed(6)} (${phiLookup.mode}${phiLookup.bracket?`, bracket ${phiLookup.bracket.join('–')}`:''}).`,`CT (50): Nu=φ(Rb·A+Rsc·As,tot)=${NuKn.toFixed(3)} kN.`],
    provenance:[PILE_MATERIAL_PROVENANCE.nearCenteredRect,PILE_MATERIAL_PROVENANCE.materials,...concrete.sources,...rebar.sources]};
}
export function calculateCircularPileMaterialCheck5574(input={}){
  const isAnnular=num(input.r1)!=null||num(input.innerRadiusMm)!=null;
  const normalized={...input,AsTot:num(input.AsTot??input.AsTotMm2),bars:num(input.bars??input.barCount)};
  const result=isAnnular?calcAnnularColumn5574({...normalized,r1:num(input.r1??input.innerRadiusMm),r2:num(input.r2??input.outerRadiusMm)}):calcCircularColumn5574({...normalized,r:num(input.r??input.radiusMm)});
  if(!result.ok) return {...result,status:'REVIEW',productionNumeric:false};
  return {...result,status:'VERIFIED',productionNumeric:true,capacityBasis:'DEMAND_CHECK_ONLY',materialResistanceKn:null,warning:'Phụ lục F kiểm N–M cho trước; không biến thành một Nu dọc trục duy nhất để so min với Rsoil.'};
}

export function calculateXlsmSctVatLieuReference(input={}){
  const shape=String(input.shape||'circle').toLowerCase();
  const Dm=num(input.diameterM??1),Dim=num(input.innerDiameterM??0),sideM=num(input.sideM);
  const areaM2=shape==='circle'?Math.PI*(Dm*Dm-Dim*Dim)/4:sideM*sideM;
  const inertiaM4=shape==='circle'?Math.PI*(Dm**4-Dim**4)/64:sideM**4/12;
  const grade=String(input.grade||'B30').toUpperCase(),steel=String(input.steel||'CB400-V').toUpperCase();
  const concrete=lookup5574Concrete(grade),rebar=lookup5574Steel(steel);
  const barDiameterMm=num(input.barDiameterMm??25),barCount=num(input.barCount??26),AsMm2=num(input.AsTotMm2)??barCount*Math.PI*barDiameterMm**2/4;
  const gcb=num(input.gammaCb??0.85),gcbPrime=num(input.gammaCbPrime??0.7),bp=num(input.bp??2),k=num(input.k??7000),gammaC=num(input.gammaC??3),startL0M=num(input.startL0M??0);
  if(!concrete||!rebar||!(areaM2>0&&inertiaM4>0&&AsMm2>=0)) return {ok:false,missing:['Input/reference XLSM không hợp lệ.']};
  const alphaE=Math.pow(k*bp/(gammaC*concrete.Eb*1000*inertiaM4),1/5);
  const L1M=startL0M+2/alphaE;
  const lambda=L1M/Math.sqrt(inertiaM4/areaM2);
  const phi=lambda<=14?1:1.028-0.0000288*lambda**2-0.0016*lambda;
  const cachedRscMpa=num(input.workbookLookupRscMpa??350); // F23 thực tế lấy cột Rs.
  const workbookOwnTableRscMpa=num(input.workbookOwnTableRscMpa??365); // BANGTRA!I21.
  const calc=rsc=>phi*(gcb*gcbPrime*concrete.Rb*areaM2*1e6+rsc*AsMm2)/1000;
  return {ok:true,workflow:'xlsm-sct-vatlieu-reference',status:'REFERENCE/BUGGED',productionNumeric:false,
    inputs:{shape,Dm,Dim,sideM,grade,steel,barDiameterMm,barCount,AsMm2,gcb,gcbPrime,bp,k,gammaC,startL0M},
    areaM2,inertiaM4,EbMpa:concrete.Eb,RbMpa:concrete.Rb,pdfRscMpa:rebar.Rsc,alphaE,L1M,lambda,phi,
    workbookAsCalculatedRscMpa:cachedRscMpa,workbookAsCalculatedKn:calc(cachedRscMpa),workbookOwnTableRscMpa,workbookIfLookupFixedToOwnTableKn:calc(workbookOwnTableRscMpa),
    pdfCorrectRscMpa:rebar.Rsc,pdfMaterialValueSubstitutionKn:calc(rebar.Rsc),
    warnings:['F23 nhãn Rsc nhưng VLOOKUP chỉ tới cột H=Rs.','BANGTRA của XLSM ghi CB400-V Rsc=365 MPa nhưng TCVN 5574:2018 Bảng 13 là 350 MPa.','Công thức φ/gcb/gcb\'/k/bp của XLSM chưa được xác nhận là CT (49)–(50)/Bảng 16; không dùng Production.'],
    provenance:[PILE_MATERIAL_PROVENANCE.xlsm,PILE_MATERIAL_PROVENANCE.materials]};
}

export function combineSoilAndMaterialResistance({soilResult,materialResult}={}){
  const soilRdKn=num(soilResult?.RdKn ?? soilResult?.soilDesignResistanceKn ?? soilResult?.RsoilKn);
  const materialKn=num(materialResult?.materialResistanceKn ?? materialResult?.NuKn ?? materialResult?.RmaterialKn);
  const issues=[];
  if(!(soilRdKn>0)) issues.push('Thiếu Rsoil/Rd đã VERIFIED trên cùng cơ sở sức kháng thiết kế.');
  if(!(materialKn>0)||materialResult?.productionNumeric!==true||!['VERIFIED','LOCKED'].includes(String(materialResult?.status||''))) issues.push('Rmaterial chưa phải numeric VERIFIED/LOCKED.');
  if(materialResult?.capacityBasis && materialResult.capacityBasis!=='DESIGN_RESISTANCE_TTGH1') issues.push('Rmaterial không ở basis DESIGN_RESISTANCE_TTGH1 để so trực tiếp.');
  if(issues.length) return {ok:false,status:'REVIEW',soilResistanceKn:soilRdKn,materialResistanceKn:materialKn,governing:null,pileResistanceKn:null,issues};
  const pileResistanceKn=Math.min(soilRdKn,materialKn);
  const governing=soilRdKn<=materialKn?'SOIL':'MATERIAL';
  return {ok:true,status:'VERIFIED',capacityBasis:'DESIGN_RESISTANCE',soilResistanceKn:soilRdKn,materialResistanceKn:materialKn,pileResistanceKn,governing,utilizationBasisNote:'So sánh Rd đất nền với Nu vật liệu; γn/Nd,max không tự trộn vào phép min.',steps:[`Rsoil=${soilRdKn.toFixed(3)} kN.`,`Rmaterial=${materialKn.toFixed(3)} kN.`,`Rpile=min(Rsoil,Rmaterial)=${pileResistanceKn.toFixed(3)} kN → ${governing==='SOIL'?'ĐẤT NỀN':'VẬT LIỆU'} khống chế.`]};
}
