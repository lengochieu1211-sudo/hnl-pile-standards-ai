// HNL Universal Engineering Router v1.24.0
// Purpose: recognize technical problem intent across the 3 built-in standards,
// run deterministic VERIFIED calculations when enough data exists, otherwise
// return the exact workflow/source/status/missing inputs. AI never owns the math.

import { calculateDrivenPile10304 } from './pile-workflows.js';
import { lookupPileType7888, classesForPileType7888 } from './tcvn7888.js';
import { annulusAreaMm2, axialResistance } from './calculators.js';
import { lookup5574Concrete, lookup5574Steel, lookup5574ConcreteSls, lookup5574SteelSls } from './codepack-tables.js';
import { calcDynamic10304, calcSingleSettlement10304, calcGroupSettlement10304, calcEquivalentBlock10304, verifyPiledRaft10304, calcConstructionEffect10304 } from './tcvn10304-advanced.js';
import { lookupTable7Alphas10304, lookupTable8Qb10304, lookupTable15Beta1, lookupTable15SideBeta } from './tcvn10304-table-engine.js';
import { normalizeEngineeringText, extractEngineeringNumber, inferPileGeometry } from './engineering-text-normalizer.js';
import { calcBendingRect5574, calcBendingT5574, calcEccentricRect5574, calcShear5574, calcTorsion5574, calcLocalCompression5574, calcPunching5574, calcCrackFlexure5574, calcDeflectionSimple5574, calcDeflectionCracked5574, calcShearDeflectionUdl5574, calcPrestressLosses5574, calcPrestressFriction5574, calcPrestressCreep5574, calcAnchorage5574, calcLapSplice5574, calcConcreteShearKey5574, calcShortCorbel5574, calcAnnularColumn5574, calcCircularColumn5574, calcEmbeddedPlateAnchorsD5574, calcInclinedAnchorD75574, lookupAnnexLGamma5574, calcAnnexMVerticalLimit5574, calcAnnexMPsychophysicalDeflection5574, calcAnnexMGenericLimit5574, calcAnnexMCraneHorizontalLimit5574, calcAnnexMStructuralDrift5574 } from './tcvn5574-core.js';

const n = (s='') => normalizeEngineeringText(s).toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
const number = s => Number(String(s).replace(',','.'));
const grab = (text, re) => { for(const candidate of [normalizeEngineeringText(text),String(text)]){ const m=String(candidate).match(re); if(m) return number(m[1]); } return null; };

export const WORKFLOW_REGISTRY = [
  {id:'7888-material',standard:'TCVN 7888:2014',title:'Cọc PC/PHC/NPH theo vật liệu',status:'VERIFIED',source:'Điều 6.2 · Bảng 1/2 · Phụ lục B',keywords:/\b(pc|phc|nph)\b|coc be tong ly tam|suc khang nen doc truc/i},
  {id:'10304-end-bearing',standard:'TCVN 10304:2025',title:'Cọc chống',status:'VERIFIED',source:'7.2.1 · CT (5)–(8) · Bảng 1',keywords:/coc chong|tua (?:tren )?da|mui coc (?:tua|dat) (?:tren |vao )?da(?:\b|\s)/i},
  {id:'10304-driven',standard:'TCVN 10304:2025',title:'Cọc đóng/ép không moi đất',status:'VERIFIED',source:'7.2.2.1 · CT (9) · Bảng 2–4',keywords:/coc (dong|ep)|khong moi dat|suc chiu tai.*coc/i},
  {id:'10304-bored',standard:'TCVN 10304:2025',title:'Cọc nhồi/khoan',status:'VERIFIED',source:'7.2.3 · CT (13)–(16) · Bảng 6–8',keywords:/coc (nhoi|khoan)|barrette/i},
  {id:'10304-screw',standard:'TCVN 10304:2025',title:'Cọc vít',status:'VERIFIED',source:'7.2.4 · CT (17)–(19) · Bảng 9–10',keywords:/coc vit/i},
  {id:'10304-static',standard:'TCVN 10304:2025',title:'Thử tải tĩnh',status:'VERIFIED',source:'7.3.2 · CT (20)–(21)',keywords:/tai tinh|thu tai.*tinh/i},
  {id:'10304-dynamic',standard:'TCVN 10304:2025',title:'Thử động',status:'VERIFIED',source:'7.3.3 · CT (22)–(24) · Bảng 11–14',keywords:/thu dong|thi nghiem dong|do choi/i},
  {id:'10304-cpt',standard:'TCVN 10304:2025',title:'CPT',status:'VERIFIED',source:'7.3.4 · CT (25)–(29) · Bảng 15–16',keywords:/\bcpt\b|xuyen tinh/i},
  {id:'10304-spt',standard:'TCVN 10304:2025',title:'SPT',status:'VERIFIED',source:'7.3.5 · Phụ lục D',keywords:/\bspt\b|xuyen tieu chuan/i},
  {id:'10304-settlement-single',standard:'TCVN 10304:2025',title:'Độ lún cọc đơn',status:'VERIFIED',source:'7.4.2 · CT (30)–(35) · Bảng 17',keywords:/lun coc don|do lun.*coc don/i},
  {id:'10304-settlement-group',standard:'TCVN 10304:2025',title:'Độ lún nhóm cọc',status:'VERIFIED',source:'7.4.3 · CT (36)–(40)',keywords:/lun nhom coc|do lun.*nhom/i},
  {id:'10304-equivalent-block',standard:'TCVN 10304:2025',title:'Móng khối quy ước',status:'VERIFIED',source:'7.4.4 · CT (41)–(46)',keywords:/khoi quy uoc|mong quy uoc/i},
  {id:'10304-piled-raft',standard:'TCVN 10304:2025',title:'Bè-cọc',status:'VERIFIED_METHOD',source:'7.4.5',keywords:/be.?coc|mong be coc/i},
  {id:'10304-construction-effect',standard:'TCVN 10304:2025',title:'Ảnh hưởng thi công',status:'VERIFIED',source:'7.6.5–7.6.7 · CT (47)–(48) · Bảng 18',keywords:/anh huong thi cong|dao dong|luc ep coc/i},
  {id:'5574-material',standard:'TCVN 5574:2018',title:'Vật liệu bê tông/cốt thép',status:'VERIFIED',source:'Điều 6 · Bảng 7, 10, 13, 14',keywords:/\brb\b|\brbt\b|\beb\b|\brs\b|\brsc\b|\brsw\b|\bb\d{2,3}\b|cb\d{3}/i},
  {id:'5574-bending-rect',standard:'TCVN 5574:2018',title:'Uốn tiết diện chữ nhật/T/I theo nội lực giới hạn',status:'VERIFIED',source:'8.1.2.2.3; 8.1.2.3 · CT (31)–(38) · trang chuẩn 56–58 / PDF 54–56',keywords:/dam|chiu uon|tiet dien chu nhat|tiet dien chu t|tiet dien chu i|mo men uon/i},
  {id:'5574-eccentric',standard:'TCVN 5574:2018',title:'Nén lệch tâm tiết diện chữ nhật',status:'VERIFIED',source:'8.1.2.2.4; 8.1.2.4 · CT (40)–(48)',keywords:/nen lech tam|cot.*nen|cot btct|luc doc.*mo men/i},
  {id:'5574-shear',standard:'TCVN 5574:2018',title:'Lực cắt – dải bê tông và tiết diện nghiêng',status:'VERIFIED',source:'8.1.3.2–8.1.3.3 · CT (88)–(98)',keywords:/luc cat|chiu cat|\bq\s*[=:]/i},
  {id:'5574-torsion',standard:'TCVN 5574:2018',title:'Xoắn thuần – tiết diện chữ nhật',status:'VERIFIED',source:'8.1.4.2 · CT (102)–(113)',keywords:/xoan|mo men xoan|\bT\s*[=:]/i},
  {id:'5574-local',standard:'TCVN 5574:2018',title:'Nén cục bộ không lưới thép',status:'VERIFIED',source:'8.1.5.2 · CT (116)–(118)',keywords:/nen cuc bo|ep cuc bo/i},
  {id:'5574-punch',standard:'TCVN 5574:2018',title:'Chọc thủng do lực tập trung',status:'VERIFIED',source:'8.1.6.2 · CT (123)–(128)',keywords:/choc thung/i},
  {id:'5574-crack',standard:'TCVN 5574:2018',title:'Nứt – uốn tiết diện chữ nhật',status:'VERIFIED',source:'8.2.2 · CT (158)-(176)',keywords:/vet nut|acrc|mcrc|chieu rong.*nut|kiem tra.*nut|^nut\b/i},
  {id:'5574-deformation',standard:'TCVN 5574:2018',title:'Biến dạng/độ võng – tự chọn không nứt/có nứt/trượt',status:'VERIFIED',source:'8.2.3 · CT (177)-(204) · Bảng 9,11',keywords:/bien dang|do vong|chuyen vi/i},
  {id:'5574-prestress',standard:'TCVN 5574:2018',title:'Ứng suất trước – hao tổn gồm ma sát và từ biến',status:'VERIFIED',source:'9.1 · CT (207)-(220) · Bảng 18',keywords:/ung suat truoc|du ung luc|hao ton/i},
  {id:'5574-anchorage',standard:'TCVN 5574:2018',title:'Neo cốt thép',status:'VERIFIED',source:'10.3.5 · CT (255)–(258) · trang chuẩn 139–141 / PDF 137–139',keywords:/neo thep|neo cot thep|chieu dai neo/i},
  {id:'5574-lap-splice',standard:'TCVN 5574:2018',title:'Nối chồng cốt thép',status:'VERIFIED',source:'10.3.6 · CT (259) · trang chuẩn 141 / PDF 139',keywords:/noi thep|noi chong|chieu dai noi/i},
  {id:'5574-circular',standard:'TCVN 5574:2018',title:'Tiết diện tròn/vành khuyên',status:'VERIFIED',source:'Phụ lục F · F.1–F.10 · trang chuẩn 166–168 / PDF 164–166',keywords:/tiet dien tron\b|vanh khuyen/i},
  {id:'5574-annex-g',standard:'TCVN 5574:2018',title:'Chốt bê tông',status:'VERIFIED',source:'Phụ lục G · G.1–G.3',keywords:/chot be tong|shear key/i},
  {id:'5574-corbel',standard:'TCVN 5574:2018',title:'Công xôn ngắn',status:'VERIFIED',source:'Phụ lục H · H.1 · trang chuẩn 171–172 / PDF 169–170',keywords:/cong xon ngan|vai cot/i},
  {id:'5574-annex-d',standard:'TCVN 5574:2018',title:'Chi tiết đặt sẵn – neo hàn',status:'VERIFIED_BRANCH',source:'Phụ lục D · D.1–D.7 · trang chuẩn 160–162 / PDF 158–160',keywords:/chi tiet dat san|neo han|embedded plate|phu luc d/i},
  {id:'5574-annex-l',standard:'TCVN 5574:2018',title:'Hệ số mô men kháng uốn đàn dẻo γ',status:'VERIFIED_BRANCH',source:'Phụ lục L · Bảng L.1 mục 1–3 · trang chuẩn 179 / PDF 177',keywords:/phu luc l|he so.*mo men khang uon|gamma.*dan deo|momen khang uon dan deo/i},
  {id:'5574-annex-m',standard:'TCVN 5574:2018',title:'Giới hạn độ võng/chuyển vị',status:'VERIFIED_BRANCH',source:'Phụ lục M · M.4 · Bảng M.1–M.4 · trang chuẩn 185–190 / PDF 183–188',keywords:/phu luc m|gioi han do vong|do vong gioi han|chuyen vi gioi han|tam sinh ly|cau truc.*chuyen vi/i},
];

export function selectEngineeringWorkflow(question='') {
  const q=n(question);
  const matches=WORKFLOW_REGISTRY.filter(w=>w.keywords.test(q));
  // More specific workflow first.
  const order=['7888-material','10304-end-bearing','10304-cpt','10304-spt','10304-static','10304-dynamic','10304-bored','10304-screw','10304-settlement-single','10304-settlement-group','10304-equivalent-block','10304-piled-raft','10304-construction-effect','10304-driven','5574-anchorage','5574-lap-splice','5574-annex-d','5574-annex-l','5574-annex-m','5574-circular','5574-corbel','5574-annex-g','5574-crack','5574-deformation','5574-prestress','5574-punch','5574-local','5574-torsion','5574-shear','5574-eccentric','5574-bending-rect','5574-material'];
  matches.sort((a,b)=>(order.indexOf(a.id)<0?999:order.indexOf(a.id))-(order.indexOf(b.id)<0?999:order.indexOf(b.id)));
  return matches[0] || null;
}


function parse7888Material(question='') {
  const q=String(question||''); const norm=n(q);
  const type=(norm.match(/\bnph\b/) ? 'NPH' : norm.match(/\bphc\b/) ? 'PHC' : norm.match(/\bpc\b/) ? 'PC' : null);
  const cls=((q.match(/(?:^|[-\s])(AB|A|B|C)(?=$|[-\s,;])/i)||[])[1]||'').toUpperCase() || null;
  let diameter=null;
  if(type==='NPH') {
    const pair=q.match(/(?:NPH\s*[-:]?\s*)?(?:Dk\s*)?(\d{3,4})\s*[-/]\s*(\d{3,4})(?:\s*[-/]\s*(?:AB|A|B|C))?/i);
    if(pair) diameter=Number(pair[2]);
  }
  if(diameter==null){
    const m=q.match(/(?:\bD\s*=?\s*|đường\s*kính(?:\s*thân)?\s*=?\s*)(\d{3,4})(?:\s*mm)?/i) || q.match(/\b(?:PC|PHC|NPH)\s*[-:]?\s*[A-C]{1,2}?\s*[-/]?\s*(\d{3,4})\b/i);
    if(m) diameter=Number(m[1]);
  }
  if(diameter==null && type==='NPH') {
    const m=q.match(/\bNPH\s*[-:]?\s*(?:AB|A|B|C)?\s*[-/]?\s*(\d{3,4})\b/i); if(m) diameter=Number(m[1]);
  }
  const lengthM=grab(q,/(?:\bL\s*=?\s*|d[aà]i\s*)(\d+(?:[.,]\d+)?)\s*m\b/i);
  const sigmaCu=extractEngineeringNumber(q,[
      'sigma_cu','sigmacu','sigma cu','σcu','σ_cu',
      'cường độ nén bê tông','cường độ chịu nén bê tông','cường độ chịu nén',
      'cuong do nen be tong','cuong do chiu nen be tong','cuong do chiu nen'
    ],'(?:MPa|N/mm2)')
    ?? grab(q,/\b(?:R|f)c?\s*[=:]\s*(\d+(?:[.,]\d+)?)\s*MPa\b/i);
  return {type,loadClass:cls,diameter,lengthM,sigmaCu};
}

function calc7888Material(question='') {
  const input=parse7888Material(question); const missing=[];
  if(!input.type) missing.push('Loại cọc PC / PHC / NPH');
  if(!input.loadClass) missing.push('Cấp tải A / AB / B / C');
  if(input.diameter==null) missing.push('Đường kính thân D (mm)');
  if(input.lengthM==null) missing.push('Chiều dài L (m)');
  if(input.sigmaCu==null) missing.push('σcu / cường độ nén bê tông (MPa)');
  if(missing.length) return {ok:false,inputs:input,missing};
  const allowed=classesForPileType7888(input.diameter,input.type);
  if(!allowed.includes(input.loadClass)) return {ok:false,inputs:input,missing:[`${input.type} D${input.diameter} không có cấp ${input.loadClass} trong ${input.type==='NPH'?'Bảng 2':'Bảng 1'}. Cấp hợp lệ: ${allowed.join(', ')||'không có dữ liệu'}.`]};
  const row=lookupPileType7888(input.diameter,input.loadClass,input.type);
  if(!row) return {ok:false,inputs:input,missing:[`Không tìm thấy ${input.type} D${input.diameter}-${input.loadClass} trong bảng Verified.`]};
  const minSigma=input.type==='PC'?60:80;
  if(input.sigmaCu<minSigma) return {ok:false,inputs:input,lookup:row,missing:[`${input.type} yêu cầu σcu ≥ ${minSigma} MPa theo Điều 3/6.2; đề bài đang ${input.sigmaCu} MPa.`]};
  const lengthRange=String(row.lengthRange||'');
  let lengthOk=true, lengthWarning='';
  if(lengthRange){
    const nums=(lengthRange.match(/\d+(?:[.,]\d+)?/g)||[]).map(number);
    if(nums.length>=2 && (input.lengthM<nums[0] || input.lengthM>nums[1])) {lengthOk=false; lengthWarning=`L=${input.lengthM} m ngoài khoảng Bảng 1 ${nums[0]}–${nums[1]} m; chú thích tiêu chuẩn cho phép chiều dài lớn hơn tùy thiết kế/thiết bị/thi công, nên phải có căn cứ riêng.`;}
  }
  const areaMm2=annulusAreaMm2({diameterMm:input.diameter,thicknessMm:row.thickness});
  const alpha=input.type==='PC'?4:3.5;
  const res=axialResistance({areaMm2,sigmaCu:input.sigmaCu,sigmaCe:row.effectiveStress,alpha});
  const longTermKn=input.type==='PC' ? 0.25*(input.sigmaCu-row.effectiveStress)*areaMm2/1000 : res.longTermKn;
  const shortTermKn=2*longTermKn, pmaxKn=0.8*shortTermKn;
  const steps=[
    `Chọn ${input.type} D${input.diameter}-${input.loadClass}; ${input.type==='NPH'?'Bảng 2':'Bảng 1'}: t=${row.thickness} mm, σce=${row.effectiveStress} MPa, Mcr=${row.crackMoment} kN.m${input.type==='PC'?'':`, V=${row.shearResistance} kN`}.`,
    `A0=π/4·[D²-(D-2t)²]=${areaMm2.toFixed(3)} mm².`,
    `${input.type==='PC'?'CT (B.2)':'CT (B.4)'}: Ra,dài hạn=${longTermKn.toFixed(3)} kN.`,
    `${input.type==='PC'?'CT (B.3)':'CT (B.5)'}: Ra,ngắn hạn=2·Ra,dài hạn=${shortTermKn.toFixed(3)} kN.`,
    `Pmax≤0,8·Ra,ngắn hạn=${pmaxKn.toFixed(3)} kN.`
  ];
  if(lengthWarning) steps.push(`CẢNH BÁO CHIỀU DÀI: ${lengthWarning}`);
  return {ok:true,inputs:{...input,thicknessMm:row.thickness,sigmaCe:row.effectiveStress,alpha,areaMm2},lookup:row,areaMm2,longTermKn,shortTermKn,pmaxKn,lengthOk,lengthWarning,steps,provenance:[`TCVN 7888:2014 · Điều 6.2 · ${input.type==='NPH'?'Bảng 2 trang 12':'Bảng 1 trang 10–11'}`,`TCVN 7888:2014 · Phụ lục B · CT ${input.type==='PC'?'(B.2)–(B.3)':'(B.4)–(B.5)'} · trang 32–33`]};
}

function parsePileLayers(text='') {
  // v1.25.6: tolerate PDF/Word forms such as "Lớp 1 (0 - 6 m): ... f_1 = 20 kPa".
  const source=normalizeEngineeringText(text);
  const rows=[];
  const re=/(?:lop|lớp)\s*(\d+)\s*[:\-]?\s*\(?\s*(\d+(?:[.,]\d+)?)\s*[-]\s*(\d+(?:[.,]\d+)?)\s*m?\s*\)?([^;\n]*)(?:;|\n|$)/gi;
  let m;
  while((m=re.exec(source))){
    const index=Number(m[1]);
    const tail=String(m[4]||'').toLocaleLowerCase('vi');
    const soil=/c[aá]t|sand/.test(tail)?'sand':'clay';
    let sandType=''; if(/bụi|bui|silty/.test(tail)) sandType='silty'; else if(/mịn|min|fine/.test(tail)) sandType='fine'; else if(/thô|tho|coarse/.test(tail)) sandType='coarse'; else if(/vừa|vua|medium/.test(tail)) sandType='medium';
    const IL=extractEngineeringNumber(tail,['IL','I_L']);
    const fiOverride=extractEngineeringNumber(tail,[`f${index}`,`f_${index}`,'fi','f_i'],'(?:kPa|kN/m2)');
    rows.push({index,top:number(m[2]),bottom:number(m[3]),soilGroup:soil,sandType,IL,fiOverride});
  }
  return rows;
}

function parseDrivenPile(question='') {
  const q=normalizeEngineeringText(question);
  const norm=n(q);
  const geometry=inferPileGeometry(q);
  const L=grab(q,/(?:dài|dai|\bl\s*=?)\s*(\d+(?:[.,]\d+)?)\s*m\b/i);
  const method=/\bep\b|ép/.test(norm)?'press':(/\bdong\b|đóng/.test(norm)?'hammer':null);
  return {
    shape:geometry.shape || (geometry.diameterM?'circle':'square'),
    lengthM:L, tipDepthM:L,
    sideM:geometry.sideM, diameterM:geometry.diameterM,
    areaM2:geometry.areaM2, perimeterM:geometry.perimeterM,
    method,
    qbOverride:extractEngineeringNumber(q,['qb','q_b'],'(?:kPa|kN/m2)'),
    gammaC:extractEngineeringNumber(q,['gamma_c','γc']),
    gammaRR:extractEngineeringNumber(q,['gamma_RR','γRR','gamma_R,R','γR,R']),
    gammaRf:extractEngineeringNumber(q,['gamma_Rf','γRf','gamma_R,f','γR,f']),
    gammaK:extractEngineeringNumber(q,['gamma_k','γk']),
    layers:parsePileLayers(q),
    geometryAudit:geometry
  };
}


function explicit(q, names, unit='') { return extractEngineeringNumber(q,names,unit); }

function calcEndBearing10304(q='') {
  const Rkb=explicit(q,['Rkb','R_kb'],'(?:kN)?');
  const gammaC=explicit(q,['gamma_c','γc']) ?? 1;
  const geometry=inferPileGeometry(q);
  const A=explicit(q,['Ap','A_p','A','diện tích mũi','dien tich mui','diện tích tiết diện mũi','dien tich tiet dien mui'],'(?:m2|mm2)?') ?? geometry.areaM2;
  let qb=explicit(q,['qb','q_b'],'(?:kPa)?');
  const Rm=explicit(q,['Rm','R_m'],'(?:kPa)?'); const Ld=explicit(q,['Ld','L_d'],'m?'); const df=explicit(q,['df','d_f'],'m?');
  if(qb==null && Rm!=null){ qb=(Ld!=null&&df!=null)?Rm*(1+0.4*Ld/df):Rm; }
  if(Rkb!=null) return {ok:true,RkKn:Rkb,inputs:{Rkb},steps:[`CT (5): Rk=Rk,b=${Rkb.toFixed(3)} kN.`],provenance:['TCVN 10304:2025 · 7.2.1.1 · CT (5) · trang 28']};
  const missing=[]; if(A==null) missing.push('A diện tích mũi (m²)'); if(qb==null) missing.push('q_b (kPa), hoặc R_m và L_d/d_f theo CT (7)/(8)');
  if(missing.length) return {ok:false,missing};
  if(geometry.areaConflict) return {ok:false,missing:[`Diện tích nhập và diện tích suy từ hình học không khớp; cần xác nhận trước khi tính.`],inputs:{gammaC,A,qb,Rm,Ld,df,geometryAudit:geometry}};
  const Rk=gammaC*qb*A;
  return {ok:true,RkKn:Rk,inputs:{gammaC,A,qb,Rm,Ld,df,geometryAudit:geometry},steps:[`CT (6): Rk,b=γc·q_b·A=${gammaC}×${qb}×${A}=${Rk.toFixed(3)} kN.`],provenance:['TCVN 10304:2025 · 7.2.1.1 · CT (5)–(8) · trang 28-30','Bảng 1 · trang 29']};
}

function calcBored10304(q='') {
  const geometry=inferPileGeometry(q);
  const A=explicit(q,['Ap','A_p','A','diện tích mũi','dien tich mui','diện tích tựa mũi','dien tich tua mui'],'(?:m2|mm2)?') ?? geometry.areaM2;
  const u=explicit(q,['u','chu vi'],'(?:m|mm)?') ?? geometry.perimeterM; let qb=explicit(q,['qb','q_b'],'(?:kPa|kN/m2)?');
  const gammaC=explicit(q,['gamma_c','γc']) ?? 1; const gammaRR=explicit(q,['gamma_RR','γRR']) ?? 1;
  const gammaRf=explicit(q,['gamma_Rf','γRf']) ?? 1;
  const sumFh=explicit(q,['sum_fh','Σfihi','tong fihi','tổng fihi'],'(?:kPa\.?m)?');
  let qbLookup=null; const norm=n(q); const depth=explicit(q,['depth','z','h','chiều sâu mũi','chieu sau mui'],'m?'); const IL=explicit(q,['IL','I_L']); let phi=null,gp=null,g1=null,d=null;
  if(qb==null){
    if(/s[eé]t|đất dính|dat dinh/.test(q) && depth!=null && IL!=null){
      try{ qbLookup=lookupTable8Qb10304({depthM:depth,IL}); qb=qbLookup.value; }catch(e){ return {ok:false,missing:[e.message]}; }
    } else if(/c[aá]t/.test(q)){
      phi=explicit(q,['phi','φ'],'(?:deg|°)?'); gp=explicit(q,["gamma1'","γ1'",'gamma1p'],'(?:kN/m3|kN/m³)?'); g1=explicit(q,['gamma1','γ1'],'(?:kN/m3|kN/m³)?'); d=explicit(q,['d'],'m?'); const h=depth;
      if(phi!=null&&gp!=null&&g1!=null&&d!=null&&h!=null){
        try{ const a=lookupTable7Alphas10304({phi,hdRatio:h/d,dM:d}); qbLookup=a; qb=0.75*a.alpha4*(a.alpha1*gp*d+a.alpha2*a.alpha3*g1*h); }catch(e){ return {ok:false,missing:[e.message]}; }
      }
    }
  }
  const missing=[]; if(A==null) missing.push('A diện tích tựa mũi (m²)'); if(u==null) missing.push('u chu vi thân cọc (m)'); if(qb==null) missing.push('qb (kPa): đất sét có thể tự tra Bảng 8 bằng depth + IL; đất cát dùng φ, γ1′, γ1, d, h theo Bảng 7 + CT (14)/(15)'); if(sumFh==null) missing.push('Σ(fi·hi), với fi theo Bảng 3 và hi từng phân đoạn ≤2 m');
  if(missing.length) return {ok:false,missing};
  const Rb=gammaRR*qb*A, Rf=gammaRf*u*sumFh, Rk=gammaC*(Rb+Rf);
  return {ok:true,RkKn:Rk,inputs:{A,u,qb,gammaC,gammaRR,gammaRf,sumFh,depth,IL,phi,gamma1p:gp,gamma1:g1,d,qbLookupMode:qbLookup?.provenance?.includes?.('Bảng 8')?'table8':(qbLookup?'table7':'manual')},qbLookup,steps:[`CT (13): Rk=γc(γRR·qb·A+γRf·u·Σfi·hi).`,...(qbLookup?[`q_b tự tra/tính: ${qb.toFixed(3)} kPa (${qbLookup.mode||'Bảng 7/8'}).`]:[]),`Mũi: ${gammaRR}×${qb}×${A}=${Rb.toFixed(3)} kN.`,`Thân: ${gammaRf}×${u}×${sumFh}=${Rf.toFixed(3)} kN.`,`Rk=${Rk.toFixed(3)} kN.`],provenance:['TCVN 10304:2025 · 7.2.3.1 · CT (13) · tr.37-38','Bảng 6 · tr.39','CT (14),(15) + Bảng 7/8 · tr.40-42']};
}
function calcScrew10304(q='') {
  const c1=explicit(q,['c1','c_1']); const gamma1=explicit(q,['gamma1','γ1']); const h1=explicit(q,['h1','h_1'],'m?'); const A=explicit(q,['A','dien tich canh','diện tích cánh'],'(?:m2|m²)?');
  const a1=explicit(q,['alpha1','α1']); const a2=explicit(q,['alpha2','α2']); const u=explicit(q,['u','chu vi'],'m?'); const fi=explicit(q,['fi','f_i'],'(?:kPa)?'); const h=explicit(q,['h','chieu dai than','chiều dài thân'],'m?'); const d=explicit(q,['d','duong kinh canh','đường kính cánh'],'m?');
  const gammaC=explicit(q,['gamma_c','γc']) ?? 1; const gammaRR=explicit(q,['gamma_RR','γRR']) ?? 1; const gammaRf=explicit(q,['gamma_Rf','γRf']) ?? 1;
  const missing=[]; for (const [v,nm] of [[c1,'c1'],[gamma1,'γ1'],[h1,'h1'],[A,'A'],[a1,'α1 Bảng 10'],[a2,'α2 Bảng 10'],[u,'u'],[fi,'fi'],[h,'h'],[d,'d']]) if(v==null) missing.push(nm);
  if(missing.length) return {ok:false,missing};
  const R0=(a1*c1+a2*gamma1*h1)*A, Rf=u*fi*(h-d), Rk=gammaC*(gammaRR*R0+gammaRf*Rf);
  return {ok:true,RkKn:Rk,inputs:{c1,gamma1,h1,A,a1,a2,u,fi,h,d,gammaC,gammaRR,gammaRf},steps:[`CT (18): Rk,0=(α1·c1+α2·γ1·h1)A=${R0.toFixed(3)} kN.`,`CT (19): Rk,f=u·fi·(h−d)=${Rf.toFixed(3)} kN.`,`CT (17): Rk=γc(γRR·Rk,0+γRf·Rk,f)=${Rk.toFixed(3)} kN.`],provenance:['TCVN 10304:2025 · 7.2.4 · CT (17)-(19) · tr.43-44','Bảng 9 · tr.43','Bảng 10 · tr.45']};
}
function calcStatic10304(q='') {
  const Ru=explicit(q,['Ru,k','R_u,k','Ruk','Ru'],'(?:kN)?'); const gammaCg1=explicit(q,['gamma_cg1','γc,g1']) ?? 1; const gammaC=explicit(q,['gamma_c','γc']) ?? 1;
  if(Ru==null) return {ok:false,missing:['Ru,k sức chịu tải giới hạn từ đường cong tải-lún/thí nghiệm (kN)']};
  const Rk=gammaC*Ru/gammaCg1; return {ok:true,RkKn:Rk,inputs:{Ru,gammaCg1,gammaC},steps:[`CT (20): Rk=γc·Ru,k/γc,g1=${Rk.toFixed(3)} kN.`],provenance:['TCVN 10304:2025 · 7.3.2.1-7.3.2.3 · CT (20),(21) · tr.49-50']};
}
function calcCpt10304(q='') {
  const geometry=inferPileGeometry(q); const A=explicit(q,['Ap','A_p','A'],'(?:m2|mm2)?') ?? geometry.areaM2; const u=explicit(q,['u','chu vi'],'(?:m|mm)?') ?? geometry.perimeterM; const h=explicit(q,['h'],'m?'); const qs=explicit(q,['qs','q_s'],'(?:kPa)?'); const fs=explicit(q,['fs','f_s'],'(?:kPa)?'); let b1=explicit(q,['beta1','β1']); let b2=explicit(q,['beta2','β2']);
  const norm=n(q); const pile=/coc vit/.test(norm)?'screw':'driven'; const load=/keo|nh[oổ]/.test(norm)?'tension':'compression'; const soil=/s[eé]t|dat dinh/.test(norm)?'clay':'sand'; const probe=/dien|loai ii|loai iii/.test(norm)?'electric':'mechanical';
  let b1Lookup=null,b2Lookup=null;
  if(b1==null&&qs!=null){ try{b1Lookup=lookupTable15Beta1({qs,pile,load});b1=b1Lookup.value;}catch(e){return {ok:false,missing:[e.message,'Hoặc nhập β1 thủ công kèm provenance.']};} }
  if(b2==null&&fs!=null){ try{b2Lookup=lookupTable15SideBeta({fs,probe,soil,saturatedSand:/bao hoa/.test(norm)});b2=b2Lookup.value;}catch(e){return {ok:false,missing:[e.message,'Hoặc nhập β2/βi thủ công kèm provenance.']};} }
  const missing=[]; for(const [v,nm] of [[A,'A (m²)'],[u,'u (m)'],[h,'h (m)'],[qs,'qs (kPa)'],[fs,'fs (kPa)'],[b1,'β1 Bảng 15'],[b2,probe==='mechanical'?'β2 Bảng 15':'βi Bảng 15']]) if(v==null) missing.push(nm);
  if(missing.length) return {ok:false,missing}; const Rs=b1*qs, f=b2*fs, Ru=Rs*A+f*h*u;
  return {ok:true,RkKn:Ru,inputs:{A,u,h,qs,fs,b1,b2,pile,load,soil,probe,b1Auto:!!b1Lookup,b2Auto:!!b2Lookup,saturatedSand:/bao hoa/.test(norm)},tableLookups:{b1:b1Lookup,b2:b2Lookup},steps:[`Bảng 15: β1=${b1}${b1Lookup?` (${b1Lookup.mode})`:''}; ${probe==='mechanical'?'β2':'βi'}=${b2}${b2Lookup?` (${b2Lookup.mode})`:''}.`,`CT (26): Rs=β1·qs=${Rs.toFixed(3)} kPa.`,`CT (27)/(28): f=β·fs=${f.toFixed(3)} kPa.`,`CT (25): Ru=Rs·A+f·h·u=${Ru.toFixed(3)} kN.`],provenance:['TCVN 10304:2025 · 7.3.4.2 · CT (25)-(28) · tr.55-56','Bảng 15 · tr.57 · không tự nội suy nếu không có chú thích cho phép']};
}
function calcSpt10304(q='') {
  const qb=explicit(q,['qb','q_b'],'(?:kPa|kN/m2|kN/m²)?'); const geometry=inferPileGeometry(q); const A=explicit(q,['Ap','A_p','A'],'(?:m2|mm2)?') ?? geometry.areaM2; const fs=explicit(q,['fs','f_s'],'(?:kPa|kN/m2|kN/m²)?') ?? 0; const fc=explicit(q,['fc','f_c'],'(?:kPa|kN/m2|kN/m²)?') ?? 0; const Ls=explicit(q,['Ls','L_s'],'m?') ?? 0; const Lc=explicit(q,['Lc','L_c'],'m?') ?? 0; const u=explicit(q,['u','chu vi'],'(?:m|mm)?') ?? geometry.perimeterM;
  const missing=[]; if(qb==null) missing.push('qb từ Bảng D.1'); if(A==null) missing.push('A (m²)'); if(u==null) missing.push('u (m)'); if(!Ls&&!Lc) missing.push('Ls và/hoặc Lc');
  if(missing.length) return {ok:false,missing}; const Rub=qb*A, Ruf=fs*Ls*u+fc*Lc*u, Ru=Rub+Ruf;
  return {ok:true,RkKn:Ru,inputs:{qb,A,fs,fc,Ls,Lc,u},steps:[`D.3: Ru,b=qb·A=${Rub.toFixed(3)} kN.`,`D.5-D.6: Ru,f=fs·Ls·u+fc·Lc·u=${Ruf.toFixed(3)} kN.`,`D.2/D.1: Rk=Ru=${Ru.toFixed(3)} kN (trước xử lý thống kê nếu có nhiều điểm/thí nghiệm).`],provenance:['TCVN 10304:2025 · Phụ lục D · D.1-D.6 · tr.110','Bảng D.1 · tr.111']};
}

function calculate5574Material(question='') {
  const q=String(question).toUpperCase();
  const concrete=q.match(/\bB(?:3\.5|5|7\.5|10|12\.5|15|20|25|30|35|40|45|50|55|60|70|80|90|100)\b/)?.[0] || null;
  const steel=q.match(/\bCB(?:240-T|300-T|300-V|400-V|500-V)\b/)?.[0] || null;
  const c=concrete?lookup5574Concrete(concrete):null; const s=steel?lookup5574Steel(steel):null;
  if(!c&&!s) return {ok:false,missing:['Cần cấp bê tông B... hoặc nhóm thép CB... cần tra.']};
  return {ok:true,concrete:c,steel:s,steps:[
    ...(c?[`Tra ${c.grade}: Rb=${c.Rb} MPa; Rbt=${c.Rbt} MPa; Eb=${c.Eb} MPa.`]:[]),
    ...(s?[`Tra ${s.grade}: Rs=${s.Rs} MPa; Rsc=${s.Rsc} MPa; Rsw=${s.Rsw} MPa.`]:[])
  ],provenance:[...(c?c.sources:[]),...(s?s.sources:[])]};
}

function parse5574Common(question='') {
  const q=String(question); const upper=q.toUpperCase();
  const grade=(upper.match(/\bB(?:15|20|25|30|35|40|45|50|55|60|70|80|90|100)\b/)||[])[0] || null;
  const steel=(upper.match(/\bCB(?:240-T|300-T|300-V|400-V|500-V)\b/)||[])[0] || null;
  const val=(names,unit='')=>explicit(q,names,unit);
  return {q,grade,steel,
    b:val(['b'],'(?:mm)?'), h:val(['h'],'(?:mm)?'), h0:val(['h0','h_0'],'(?:mm)?'),
    As:val(['As','A_s'],'(?:mm2|mm²)?'), Asp:val(["As'","As′","A_s'",'Asp'],'(?:mm2|mm²)?') ?? 0,
    ap:val(["a'","a′",'ap'],'(?:mm)?') ?? 0,
    bf:val(["bf'","bf′",'bf'],'(?:mm)?'), hf:val(["hf'","hf′",'hf'],'(?:mm)?'),
    M:val(['M'],'(?:kN\\.?m|kNm)?'), N:val(['N'],'(?:kN)?'),
    L:val(['L'],'(?:m)?'), L0:val(['L0','L_0'],'(?:mm)?'), e0:val(['e0','e_0'],'(?:mm)?'),
    I:val(['I'],'(?:mm4|mm⁴)?'), Is:val(['Is','I_s'],'(?:mm4|mm⁴)?'), ML:val(['ML','M_L'],'(?:kN\\.?m|kNm)?'), ML1:val(['ML1','M_L1'],'(?:kN\\.?m|kNm)?'),
    determinate:/tĩnh định|tinh dinh|statically determinate/i.test(q)
  };
}

function calculate5574RectBending(question='') {
  const input=parse5574Common(question);
  const isT=/tiết diện\s*(?:chữ\s*)?[ti]\b|tiet dien\s*(?:chu\s*)?[ti]\b|\bbf['′]?\s*[=:]|\bhf['′]?\s*[=:]/i.test(input.q);
  return isT?calcBendingT5574(input):calcBendingRect5574(input);
}

function calculate5574Eccentric(question='') {
  const input=parse5574Common(question);
  // Nếu L0 được nhập theo m (thường gặp) thì người dùng nên ghi rõ L0=...m; parser sau chuyển sang mm.
  const l0m=grab(input.q,/(?:\bL0|L_0)\s*[=:]?\s*(\d+(?:[.,]\d+)?)\s*m\b/i);
  if(l0m!=null) input.L0=l0m*1000;
  return calcEccentricRect5574(input);
}

function calculate5574Shear(question=''){
  const x=parse5574Common(question); return calcShear5574({...x,Q:explicit(x.q,['Q'],'(?:kN)?'),Asw:explicit(x.q,['Asw','A_sw'],'(?:mm2|mm²)?')??0,sw:explicit(x.q,['sw','s_w'],'(?:mm)?'),a:explicit(x.q,['a'],'(?:mm)?')});
}
function calculate5574Torsion(question=''){
  const x=parse5574Common(question); return calcTorsion5574({...x,T:explicit(x.q,['T'],'(?:kN\\.?m|kNm)?'),Asw1:explicit(x.q,['Asw1','Asw,1','A_sw1'],'(?:mm2|mm²)?'),sw:explicit(x.q,['sw','s_w'],'(?:mm)?'),As1:explicit(x.q,['As1','As,1','A_s1'],'(?:mm2|mm²)?'),Z1:explicit(x.q,['Z1','Z_1'],'(?:mm)?'),Z2:explicit(x.q,['Z2','Z_2'],'(?:mm)?')});
}
function calculate5574Local(question=''){
  const x=parse5574Common(question); return calcLocalCompression5574({...x,N:explicit(x.q,['N'],'(?:kN)?'),AbLoc:explicit(x.q,['AbLoc','Ab,loc','A_b,loc'],'(?:mm2|mm²)?'),AbMax:explicit(x.q,['AbMax','Ab,max','A_b,max'],'(?:mm2|mm²)?'),psi:explicit(x.q,['psi','ψ'])??(/không đều|khong deu/i.test(x.q)?0.75:1)});
}

function calculate5574Crack(question=''){
  const x=parse5574Common(question); return calcCrackFlexure5574({...x,h:explicit(x.q,['h'],'(?:mm)?'),a:explicit(x.q,['a'],'(?:mm)?'),ds:explicit(x.q,['ds','d_s'],'(?:mm)?'),Abt:explicit(x.q,['Abt','A_bt'],'(?:mm2|mm²)?'),RbtSer:explicit(x.q,['RbtSer','Rbt,ser','R_bt_ser'],'(?:MPa)?'),RsSer:explicit(x.q,['RsSer','Rs,ser','R_s_ser'],'(?:MPa)?'),duration:/dai han|dài hạn/i.test(x.q)?'long':'short',ribbed:!/tron|trơn/i.test(x.q)});
}
function calculate5574Deformation(question=''){
  const x=parse5574Common(question); const q=x.q;
  const base={...x,L:explicit(q,['L'],'(?:m)?'),h:explicit(q,['h'],'(?:mm)?'),h0:explicit(q,['h0','h_0'],'(?:mm)?'),a:explicit(q,['a'],'(?:mm)?'),Mmax:explicit(q,['Mmax','M'],'(?:kN\.?m|kNm)?'),MTotal:explicit(q,['MTotal','Mtotal','M'],'(?:kN\.?m|kNm)?'),MLong:explicit(q,['MLong','Mlong','M_l'],'(?:kN\.?m|kNm)?')??0,humidity:explicit(q,['humidity','do am','độ ẩm'],'(?:%)?')??60,longTerm:/dai han|dài hạn/i.test(q),sCoef:explicit(q,['sCoef','s'])};
  if(/bien dang truot|biến dạng trượt|fq\b|w\s*[=:]/i.test(q)) return calcShearDeflectionUdl5574({...base,wKnM:explicit(q,['w','q'],'(?:kN\/m)?'),phiCrc:explicit(q,['phiCrc','phi_crc']),crackState:/dong thoi|đồng thời|both/i.test(q)?'both':(/nut xien|nứt xiên|diagonal/i.test(q)?'diagonal':(/nut thang|nứt thẳng|normal/i.test(q)?'normal':'')),MxKnM:explicit(q,['Mx','M_x'],'(?:kN\.?m|kNm)?'),curvaturePerMm:explicit(q,['curvature','1/r'],'(?:1\/mm)?'),Ired:explicit(q,['Ired'],'(?:mm4|mm⁴)?')});
  if(/co nut|có nứt|da nut|đã nứt|cracked/i.test(q)) return calcDeflectionCracked5574(base);
  return calcDeflectionSimple5574(base);
}
function calculate5574Prestress(question=''){
  const q=n(question); const sigmaSp=explicit(q,['sigmaSp','sigma_sp','σsp'],'(?:MPa)?');
  const friction=(/ma sat|ma sát|friction|omega|theta|θ/i.test(q))?{xM:explicit(q,['x','chi','χ'],'(?:m)?')??0,thetaRad:explicit(q,['theta','θ'],'(?:rad)?')??0,surface:/loi mem|lõi mềm/i.test(q)?'soft-concrete-duct':(/loi cung|lõi cứng/i.test(q)?'rigid-concrete-duct':(/be tong|bê tông/i.test(q)?'concrete-surface':'metal-duct'))}:null;
  const creep=(/tu bien|từ biến|sigmaBpj|σbpj/i.test(q))?{grade:(q.match(/\bB\d+(?:\.\d+)?\b/i)||[])[0]||'B30',sigmaBpj:explicit(q,['sigmaBpj','σbpj'],'(?:MPa)?'),ysj:explicit(q,['ysj','y_sj'],'(?:mm)?'),Ared:explicit(q,['Ared'],'(?:mm2|mm²)?'),Ired:explicit(q,['Ired'],'(?:mm4|mm⁴)?'),A:explicit(q,['A'],'(?:mm2|mm²)?'),Aspj:explicit(q,['Aspj','A_spj'],'(?:mm2|mm²)?'),humidity:explicit(q,['humidity','do am','độ ẩm'],'(?:%)?')??60,heatTreated:/nhiet luyen|nhiệt luyện/i.test(q)}:null;
  if(/chi.*ma sat|chỉ.*ma sát/i.test(q)) return calcPrestressFriction5574({sigmaSp,...friction,steelType:/cap|cáp|strand|wire|day thep|dây thép/i.test(q)?'cable':'bar'});
  if(/chi.*tu bien|chỉ.*từ biến/i.test(q)) return calcPrestressCreep5574(creep||{});
  return calcPrestressLosses5574({sigmaSp,Rsn:explicit(q,['Rsn','Rs,n'],'(?:MPa)?'),Asp:explicit(q,['Asp','A_sp'],'(?:mm2|mm²)?'),deltaT:explicit(q,['deltaT','Δt'],'(?:C|°C)?')??0,n:explicit(q,['n'])??1,dLForm:explicit(q,['dLForm','deltaLForm'],'(?:mm)?')??0,LForm:explicit(q,['LForm'],'(?:mm)?'),dLAnchor:explicit(q,['dLAnchor','deltaLAnchor'],'(?:mm)?')??2,LAnchor:explicit(q,['LAnchor'],'(?:mm)?'),epsShrink:explicit(q,['epsShrink','epsilon_sh']),creepLoss:explicit(q,['creepLoss'],'(?:MPa)?'),friction,creep,steelType:/cap|cáp|strand|wire|day thep|dây thép/i.test(q)?'cable':'bar',method:/nhiet|nhiệt/i.test(q)?'thermal':'mechanical'});
}

function calculate5574Anchorage(question=''){
  const x=parse5574Common(question), q=x.q;
  const ds=explicit(q,['ds','d_s','phi','Ø'],'(?:mm)?');
  const As=explicit(q,['As','A_s'],'(?:mm2|mm²)?') ?? (ds?Math.PI*ds*ds/4:null);
  const alpha=explicit(q,['alpha','α']);
  let barType='hotRibbed';
  if(/tron|trơn|plain/i.test(q)) barType='plainBar'; else if(/keo nguoi|kéo nguội|can nguoi|cán nguội/i.test(q)) barType='coldRibbed';
  return calcAnchorage5574({...x,ds,As,AsCal:explicit(q,['AsCal','As,cal','A_s_cal'],'(?:mm2|mm²)?')??As,AsEf:explicit(q,['AsEf','As,ef','A_s_ef'],'(?:mm2|mm²)?')??As,alpha,Ls:explicit(q,['Ls','L_s'],'(?:mm)?'),barType,prestressed:/ung suat truoc|ứng suất trước|prestress/i.test(q)});
}
function calculate5574Lap(question=''){
  const x=parse5574Common(question), q=x.q;
  const ds=explicit(q,['ds','d_s','phi','Ø'],'(?:mm)?');
  const As=explicit(q,['As','A_s'],'(?:mm2|mm²)?') ?? (ds?Math.PI*ds*ds/4:null);
  return calcLapSplice5574({...x,ds,As,AsCal:explicit(q,['AsCal','As,cal','A_s_cal'],'(?:mm2|mm²)?')??As,AsEf:explicit(q,['AsEf','As,ef','A_s_ef'],'(?:mm2|mm²)?')??As,alpha:explicit(q,['alpha','α']),stress:/nen|nén|compression/i.test(q)?'compression':'tension',barType:/tron|trơn|plain/i.test(q)?'plainBar':'hotRibbed',conventional:!(/alpha|α/.test(q))});
}
function calculate5574Circular(question=''){
  const x=parse5574Common(question),q=x.q;
  const common={...x,rs:explicit(q,['rs','r_s'],'(?:mm)?'),AsTot:explicit(q,['AsTot','As,tot','A_s_tot'],'(?:mm2|mm²)?'),N:explicit(q,['N'],'(?:kN)?'),M:explicit(q,['M'],'(?:kN\\.?m|kNm)?'),bars:explicit(q,['bars','so thanh','số thanh','nbar'])??7,uniform:!(/khong deu|không đều/i.test(q))};
  if(/vanh khuyen|vành khuyên/i.test(q)) return calcAnnularColumn5574({...common,r1:explicit(q,['r1','r_1'],'(?:mm)?'),r2:explicit(q,['r2','r_2'],'(?:mm)?')});
  return calcCircularColumn5574({...common,r:explicit(q,['r'],'(?:mm)?')});
}

function calculate5574Corbel(question=''){
  const x=parse5574Common(question), q=x.q;
  return calcShortCorbel5574({...x,Q:explicit(q,['Q'],'(?:kN)?'),L1:explicit(q,['L1','L_1'],'(?:mm)?'),Lsup:explicit(q,['Lsup','L_sup'],'(?:mm)?'),Asw:explicit(q,['Asw','A_sw'],'(?:mm2|mm²)?')??0,sw:explicit(q,['sw','s_w'],'(?:mm)?')});
}
function calculate5574AnnexG(question=''){
  const x=parse5574Common(question), q=x.q;
  return calcConcreteShearKey5574({...x,Q:explicit(q,['Q'],'(?:kN)?'),Lk:explicit(q,['Lk','L_k'],'(?:mm)?'),nk:explicit(q,['nk','n_k']),N:explicit(q,['N'],'(?:kN)?')??0});
}


function calculate5574AnnexD(question=''){
  const x=parse5574Common(question),q=x.q;
  if(/neo xien|neo xiên|inclined|D\.7/i.test(q)) return calcInclinedAnchorD75574({steel:x.steel,Q:explicit(q,['Q'],'(?:kN)?'),Nprime:explicit(q,["Nprime","N'","N_an_prime"],'(?:kN)?')??0,angle:explicit(q,['angle','goc','góc'],'(?:deg|°)?')??20});
  return calcEmbeddedPlateAnchorsD5574({...x,M:explicit(q,['M'],'(?:kN\\.?m|kNm)?'),N:explicit(q,['N'],'(?:kN)?')??0,Q:explicit(q,['Q'],'(?:kN)?'),z:explicit(q,['z'],'(?:mm)?'),nan:explicit(q,['nan','n_an']),Aan:explicit(q,['Aan','Aan,j','A_an'],'(?:mm2|mm²)?'),Qan0:explicit(q,['Qan0','Qan,j,0','Q_an0'],'(?:kN)?'),topCast:/mat tren|mặt trên|top cast/i.test(q)});
}
function calculate5574AnnexL(question=''){
  const q=String(question),qq=n(q); let type='rectangle';
  if(/chu t|chữ t|t-section/i.test(q)){ type=/canh.*keo|cánh.*kéo|tension flange/i.test(q)?'t-tension':'t-compression'; }
  return lookupAnnexLGamma5574({type,bf:explicit(q,['bf','b_f'],'(?:mm)?'),b:explicit(q,['b'],'(?:mm)?'),hf:explicit(q,['hf','h_f'],'(?:mm)?'),h:explicit(q,['h'],'(?:mm)?')});
}
function calculate5574AnnexM(question=''){
  const q=String(question),qq=n(q);
  if(/tam sinh ly|tâm sinh lý|M\.2|psychophysical/i.test(q)) return calcAnnexMPsychophysicalDeflection5574({p:explicit(q,['p'],'(?:kPa)?'),p1:explicit(q,['p1','p_1'],'(?:kPa)?'),q:explicit(q,['q'],'(?:kPa)?'),n:explicit(q,['n'],'(?:Hz)?'),b:explicit(q,['b'])});
  if(/cau truc.*chuyen vi|cấu trúc.*chuyển vị|tuong ngan|tường ngăn|M\.4|drift/i.test(q)){
    let type=/nha nhieu tang|nhà nhiều tầng/i.test(q)?'multistory':(/ceramic/i.test(q)?'story-ceramic':(/mot tang|một tầng/i.test(q)?'single-story':'story-brick'));
    return calcAnnexMStructuralDrift5574({type,connection:/cung|cứng|rigid/i.test(q)?'rigid':'soft',hs:explicit(q,['hs','h_s'],'(?:m)?'),h:explicit(q,['h'],'(?:m)?')});
  }
  if(/cau truc.*ham|cấu trúc.*hãm|cau truc.*can truc|cần trục|crane/i.test(q)){
    const group=(q.match(/A[1-8](?:\s*(?:den|đến|-)\s*A[1-8])?/i)||[])[0]||'A1-A3';
    const member=/dam|dầm|brake/i.test(q)?'beam':(/ngoai troi|ngoài trời/i.test(q)?'outdoor-column':'indoor-column');
    return calcAnnexMCraneHorizontalLimit5574({group,member,h:explicit(q,['h'],'(?:m)?'),L:explicit(q,['L'],'(?:m)?')});
  }
  let type='generic';
  if(/dam cau truc.*nen|dầm cầu trục.*nền|crane-floor/i.test(q))type='crane-floor';
  else if(/dam cau truc.*cabin|dầm cầu trục.*cabin|crane-cabin/i.test(q))type='crane-cabin';
  else if(/mai|san tang|sàn tầng|visible/i.test(q))type=/lop mat|lớp mặt|tach|tách/i.test(q)?'detachable-finishes':'visible-roof-floor';
  else if(/palang|pa lăng|can truc treo|cần trục treo/i.test(q))type=/cabin/i.test(q)?'suspended-hoist-cabin':'suspended-hoist-floor';
  else if(/ban thang|bản thang|chieu nghi|chiếu nghỉ/i.test(q))type='free-slab-stair';
  else if(/lanh to|lanh tô|tam tuong|tấm tường/i.test(q))type='lintel-wall-panel';
  const L=explicit(q,['L','span','nhip','nhịp'],'(?:m)?');
  if(type==='generic') return calcAnnexMGenericLimit5574({span:L,cantilever:/cong xon|công xôn|cantilever/i.test(q)});
  return calcAnnexMVerticalLimit5574({type,L,a:explicit(q,['a'],'(?:m)?'),roomHeight:explicit(q,['roomHeight','chieu cao phong','chiều cao phòng'],'(?:m)?'),group:(q.match(/A[1-8]/i)||[])[0]||'A1-A6'});
}

function calculate5574Punch(question=''){
  const x=parse5574Common(question); return calcPunching5574({...x,F:explicit(x.q,['F'],'(?:kN)?'),u:explicit(x.q,['u'],'(?:mm)?'),h0:explicit(x.q,['h0','h_0'],'(?:mm)?'),Asw:explicit(x.q,['Asw','A_sw'],'(?:mm2|mm²)?')??0,sw:explicit(x.q,['sw','s_w'],'(?:mm)?')});
}

export function solveEngineeringQuestion(question='') {
  const workflow=selectEngineeringWorkflow(question);
  if(!workflow) return {recognized:false};
  let result=null;
  try {
    if(workflow.id==='10304-end-bearing') result=calcEndBearing10304(question);
    else if(workflow.id==='10304-driven') { const input=parseDrivenPile(question); result=!input.method && input.gammaRR==null && input.gammaRf==null ? {ok:false,inputs:input,missing:['Phương pháp thi công cọc (đóng hay ép), hoặc γR,R/γR,f có nguồn để chọn Bảng 4.']} : calculateDrivenPile10304(input); }
    else if(workflow.id==='10304-bored') result=calcBored10304(question);
    else if(workflow.id==='10304-screw') result=calcScrew10304(question);
    else if(workflow.id==='10304-static') result=calcStatic10304(question);
    else if(workflow.id==='10304-dynamic') result=calcDynamic10304(question);
    else if(workflow.id==='10304-cpt') result=calcCpt10304(question);
    else if(workflow.id==='10304-spt') result=calcSpt10304(question);
    else if(workflow.id==='10304-settlement-single') result=calcSingleSettlement10304(question);
    else if(workflow.id==='10304-settlement-group') result=calcGroupSettlement10304(question);
    else if(workflow.id==='10304-equivalent-block') result=calcEquivalentBlock10304(question);
    else if(workflow.id==='10304-piled-raft') result=verifyPiledRaft10304(question);
    else if(workflow.id==='10304-construction-effect') result=calcConstructionEffect10304(question);
    else if(workflow.id==='5574-material') result=calculate5574Material(question);
    else if(workflow.id==='5574-bending-rect') result=calculate5574RectBending(question);
    else if(workflow.id==='5574-eccentric') result=calculate5574Eccentric(question);
    else if(workflow.id==='5574-shear') result=calculate5574Shear(question);
    else if(workflow.id==='5574-torsion') result=calculate5574Torsion(question);
    else if(workflow.id==='5574-local') result=calculate5574Local(question);
    else if(workflow.id==='5574-punch') result=calculate5574Punch(question);
    else if(workflow.id==='5574-crack') result=calculate5574Crack(question);
    else if(workflow.id==='5574-deformation') result=calculate5574Deformation(question);
    else if(workflow.id==='5574-prestress') result=calculate5574Prestress(question);
    else if(workflow.id==='5574-anchorage') result=calculate5574Anchorage(question);
    else if(workflow.id==='5574-lap-splice') result=calculate5574Lap(question);
    else if(workflow.id==='5574-circular') result=calculate5574Circular(question);
    else if(workflow.id==='5574-corbel') result=calculate5574Corbel(question);
    else if(workflow.id==='5574-annex-g') result=calculate5574AnnexG(question);
    else if(workflow.id==='5574-annex-d') result=calculate5574AnnexD(question);
    else if(workflow.id==='5574-annex-l') result=calculate5574AnnexL(question);
    else if(workflow.id==='5574-annex-m') result=calculate5574AnnexM(question);
    else if(workflow.id==='7888-material') result=calc7888Material(question);
    else result={ok:false,review:true,missing:[`Workflow ${workflow.title} đang ${workflow.status}; chỉ được tra cứu/giải thích/mở nguồn, chưa tự tính số.`]};
  } catch(error){ result={ok:false,error:error.message,missing:[error.message]}; }
  return {recognized:true,workflow,result,normalization:{raw:String(question||''),normalized:normalizeEngineeringText(question)}};
}

export function engineeringExcelPayload(question='') {
  const solved=solveEngineeringQuestion(question);
  if(!solved.recognized) return {recognized:false};
  const id=solved.workflow.id;
  let input=solved.result?.inputs || {};
  if(id==='10304-driven') input=parseDrivenPile(question);
  if(id==='10304-settlement-single' || id==='10304-settlement-group' || id==='10304-equivalent-block' || id==='10304-dynamic') input={...(solved.result?.inputs||{}),question};
  if(id.startsWith('5574-')) input={...(solved.result?.inputs||{}),question};
  if(id==='7888-material') input={...(solved.result?.inputs||{}),question};
  return {...solved,input,question};
}

export function deterministicEngineeringContext(question='') {
  const solved=solveEngineeringQuestion(question); if(!solved.recognized) return '';
  const {workflow,result}=solved; const lines=[`HNL DETERMINISTIC ENGINE · ${workflow.standard} · ${workflow.title} · ${workflow.status}`,
    `- Nguồn workflow: ${workflow.source}.`,
    '- QUY TẮC: số học bên dưới do HNL Calculation Engine tạo. AI chỉ được diễn giải, KHÔNG được tự đổi số hoặc tự thay bảng.'];
  if(workflow.id==='10304-driven' && result?.geometry){
    lines.push(`- Hình học: A=${result.geometry.areaM2.toFixed(4)} m²; u=${result.geometry.perimeterM.toFixed(4)} m.`);
  }
  if(result?.ok){
    if(workflow.id==='7888-material'){
      lines.push(...(result.steps||[]).map(s=>`- ${s}`));
      lines.push(`- KẾT QUẢ ENGINE: Ra dài hạn=${result.longTermKn.toFixed(3)} kN; Ra ngắn hạn=${result.shortTermKn.toFixed(3)} kN; Pmax=${result.pmaxKn.toFixed(3)} kN.`);
    } else if(workflow.id==='10304-driven'){
      lines.push(...(result.steps||[]).map(s=>`- ${typeof s==='string'?s:JSON.stringify(s)}`));
      if(result.RkKn!=null) lines.push(`- KẾT QUẢ ENGINE: Rk=${result.RkKn.toFixed(3)} kN.`);
    } else lines.push(...(result.steps||[]).map(s=>`- ${s}`));
  } else {
    lines.push(...(result?.missing||[]).map(x=>`- THIẾU/LOCKED: ${x}`));
  }
  if(workflow.status==='VERIFIED_METHOD') lines.push('- SAFETY GATE: phương pháp đã đối chiếu, nhưng tiêu chuẩn yêu cầu mô hình số/đàn hồi tương tác nên không được tự bịa công thức đóng hoặc phản lực nền.');
  else if(!String(workflow.status).startsWith('VERIFIED')) lines.push('- SAFETY GATE: REVIEW/INDEXED tuyệt đối không phát sinh kết quả số và không xuất Excel tính toán tự động.');
  else if(workflow.status==='VERIFIED_BRANCH') lines.push('- VERIFIED BRANCH: chỉ nhánh/điều kiện đã nêu được phép phát sinh số; phần còn lại của Phụ lục vẫn khóa.');
  return lines.join('\n');
}
