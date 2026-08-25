// HNL P1 Material E2E — strict Rsoil ↔ Rmaterial governing engine.
// Numeric Production is allowed only when BOTH child branches are independently
// LOCKED/VERIFIED and use compatible design-resistance bases. AI never owns math.

import { productionStatusFor } from './production-status-registry.js';

const num=v=>{ if(v==null||v==='') return null; const n=Number(v); return Number.isFinite(n)?n:null; };

export const SOIL_PRODUCTION_ID_BY_WORKFLOW = Object.freeze({
  '10304-driven':'10304-driven',
  '10304-end-bearing':'10304-end-bearing-rock',
  '10304-bored':'10304-bored-raw',
  '10304-spt':'10304-spt-raw'
});

function soilGeometry(soilResult={},soilInput={}){
  const g=soilResult?.geometry||{};
  const shape=String(g.shape||soilInput.shape||'').toLowerCase();
  const sideM=num(g.sideM??soilInput.sideM);
  const diameterM=num(g.diameterM??soilInput.diameterM);
  const areaM2=num(g.tipAreaM2??g.areaM2??soilInput.areaM2);
  return {shape,sideM,diameterM,areaM2};
}
function materialGeometry(materialResult={}){
  const x=materialResult?.inputs||{};
  return {shape:String(x.shape||'').toLowerCase(),widthMm:num(x.widthMm),heightMm:num(x.heightMm),sideMm:num(x.sideMm)};
}

export function combineLockedPileResistance({soilWorkflowId,soilResult,soilInput={},materialResult,gammaN=null}={}){
  const soilRegistryId=SOIL_PRODUCTION_ID_BY_WORKFLOW[String(soilWorkflowId||'')]||null;
  const soilRegistry=soilRegistryId?productionStatusFor(soilRegistryId):{status:'REVIEW',productionNumeric:false,source:'Unsupported soil workflow'};
  const materialRegistry=productionStatusFor('5574-pile-material-near-centered-rect');
  const RsoilKn=num(soilResult?.RdKn ?? soilResult?.soilDesignResistanceKn ?? soilResult?.RsoilKn);
  const RmaterialKn=num(materialResult?.materialResistanceKn ?? materialResult?.NuKn ?? materialResult?.RmaterialKn);
  const issues=[];

  if(!soilRegistryId) issues.push('Workflow đất nền chưa thuộc tập P1 integrated đã khóa.');
  if(soilRegistry.productionNumeric!==true||!['LOCKED','VERIFIED'].includes(soilRegistry.status)) issues.push('Nhánh đất nền chưa LOCKED/VERIFIED Production.');
  if(soilResult?.ok!==true) issues.push('Calculation Engine đất nền chưa trả ok=true.');
  if(String(soilResult?.status||'')!=='VERIFIED') issues.push(`Trạng thái đất nền phải VERIFIED; hiện ${soilResult?.status||'UNKNOWN'}.`);
  if(soilResult?.designFinal===false||soilResult?.status==='VERIFIED_PRELIMINARY') issues.push('Nhánh đất nền mới sơ bộ, chưa phải sức kháng thiết kế cuối.');
  if(!(num(soilResult?.gammaK)>0)||!(RsoilKn>0)) issues.push('Thiếu γk/Rd đất nền đã VERIFIED; không được dùng Rk hoặc số nhập tay để so min.');

  if(materialRegistry.productionNumeric!==true||!['LOCKED','VERIFIED'].includes(materialRegistry.status)) issues.push('Nhánh vật liệu chưa LOCKED/VERIFIED Production.');
  if(materialResult?.ok!==true||materialResult?.productionNumeric!==true||String(materialResult?.status||'')!=='VERIFIED') issues.push('Rmaterial chưa phải numeric VERIFIED của PileMaterialEngine.');
  if(materialResult?.capacityBasis!=='DESIGN_RESISTANCE_TTGH1'||!(RmaterialKn>0)) issues.push('Rmaterial phải ở basis DESIGN_RESISTANCE_TTGH1.');

  const sg=soilGeometry(soilResult,soilInput),mg=materialGeometry(materialResult);
  // The soil engines in this release have shared deterministic geometry for circle/square.
  // CT(49)-(50) material Production is rectangular/square; therefore integrated scalar
  // governing is intentionally locked to square piles only in P1 Pass 1 E2E.
  if(sg.shape!=='square'||mg.shape!=='square') issues.push('P1 integrated Rsoil↔Rmaterial hiện LOCKED cho cọc vuông; cọc tròn phải kiểm vật liệu N–M theo Phụ lục F, không tạo Nu giả.');
  const soilSideMm=sg.sideM!=null?sg.sideM*1000:null;
  const materialSideMm=mg.sideMm??(mg.widthMm!=null&&mg.heightMm!=null&&Math.abs(mg.widthMm-mg.heightMm)<1e-9?mg.widthMm:null);
  if(!(soilSideMm>0&&materialSideMm>0)) issues.push('Thiếu cạnh cọc đồng nhất giữa nhánh đất và vật liệu.');
  else if(Math.abs(soilSideMm-materialSideMm)>1e-6) issues.push(`Hình học không đồng nhất: đất dùng a=${soilSideMm} mm, vật liệu dùng a=${materialSideMm} mm.`);

  if(issues.length) return {ok:false,status:'REVIEW',productionNumeric:false,soilWorkflowId,soilRegistryId,soilResistanceKn:RsoilKn,materialResistanceKn:RmaterialKn,pileResistanceKn:null,governing:null,issues,geometry:{soil:sg,material:mg}};

  const pileResistanceKn=Math.min(RsoilKn,RmaterialKn);
  const governing=RsoilKn<=RmaterialKn?'SOIL':'MATERIAL';
  const gn=num(gammaN??soilResult?.gammaN);
  const demandLimitKn=gn&&gn>0?pileResistanceKn/gn:null;
  return {
    ok:true,workflow:'pile-capacity-integrated',status:'VERIFIED',productionNumeric:true,capacityBasis:'DESIGN_RESISTANCE',
    soilWorkflowId,soilRegistryId,soilResistanceKn:RsoilKn,materialResistanceKn:RmaterialKn,pileResistanceKn,governing,
    gammaN:gn,demandLimitKn,NdMaxFinalKn:demandLimitKn,
    geometry:{soil:sg,material:mg},
    childStatus:{soil:{registry:soilRegistry,status:soilResult.status},material:{registry:materialRegistry,status:materialResult.status}},
    steps:[
      `Rsoil=Rd,10304=${RsoilKn.toFixed(3)} kN (sau γk).`,
      `Rmaterial=Nu,5574=${RmaterialKn.toFixed(3)} kN (TTGH1).`,
      `Rpile=min(Rsoil,Rmaterial)=${pileResistanceKn.toFixed(3)} kN → ${governing==='SOIL'?'ĐẤT NỀN':'VẬT LIỆU'} khống chế.`,
      ...(demandLimitKn!=null?[`γn=${gn}: giới hạn tác động Nd,max=Rpile/γn=${demandLimitKn.toFixed(3)} kN. γn không tham gia phép min sức kháng.`]:[])
    ],
    provenance:{
      soil:soilResult?.provenance||[],
      material:materialResult?.provenance||[],
      governing:{rule:'Rpile = min(Rsoil, Rmaterial)',status:'HNL-LOCKED-COMPOSITION',note:'Chỉ ghép hai sức kháng thiết kế đã VERIFIED; γn được áp dụng sau phép min nếu người dùng cần giới hạn tác động.'}
    }
  };
}
