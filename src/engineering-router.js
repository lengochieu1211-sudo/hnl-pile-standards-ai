// HNL Universal Engineering Router v1.24.0
// Purpose: recognize technical problem intent across the 3 built-in standards,
// run deterministic VERIFIED calculations when enough data exists, otherwise
// return the exact workflow/source/status/missing inputs. AI never owns the math.

import { calculateDrivenPile10304, calculateRockEndBearing10304, calculateBoredPile10304, calculateSptPile10304, calculateSptSummary10304 } from './pile-workflows.js';
import { lookupPileType7888, classesForPileType7888 } from './tcvn7888.js';
import { annulusAreaMm2, axialResistance } from './calculators.js';
import { lookup5574Concrete, lookup5574Steel, lookup5574ConcreteSls, lookup5574SteelSls } from './codepack-tables.js';
import { calcDynamic10304, calcSingleSettlement10304, calcGroupSettlement10304, calcEquivalentBlock10304, verifyPiledRaft10304, calcConstructionEffect10304 } from './tcvn10304-advanced.js';
import { lookupTable7Alphas10304, lookupTable8Qb10304, lookupTable15Beta1, lookupTable15SideBeta, lookupTable16Cpt10304 } from './tcvn10304-table-engine.js';
import { normalizeEngineeringText, extractEngineeringNumber, inferPileGeometry } from './engineering-text-normalizer.js';
import { extractEngineeringScalarNumber, extractSptSummaryInputV26 } from './engineering-input-interpreter.js';
import { buildNormalizedSptGeometryInput, deriveSptSectionGeometry } from './spt-shared-spec.js';
import { productionStatusFor, isProductionNumericAllowed } from './production-status-registry.js';
import { calculateNearCenteredRectPileCapacity5574, combineSoilAndMaterialResistance } from './pile-material-engine.js';
import { combineLockedPileResistance } from './pile-capacity-engine.js';
import { calculateMultiBoreholePileCapacity } from './multi-borehole-engine.js';
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
  {id:'pile-capacity-multiborehole',standard:'TCVN 10304:2025 + TCVN 5574:2018',title:'Multi-Borehole – cùng một cọc trên nhiều lỗ khoan · Cơ lý + SPT + vật liệu',status:'VERIFIED',source:'P1 Pass 2 · child workflows LOCKED · batch governing composition',keywords:/multi[- ]?borehole|nhieu\s+lo\s+khoan|nhiều\s+lỗ\s+khoan|lo\s+khoan\s+bat\s+loi|lỗ\s+khoan\s+bất\s+lợi|\bhk1\b[\s\S]{0,600}\bhk2\b/i},
  {id:'pile-capacity-integrated',standard:'TCVN 10304:2025 + TCVN 5574:2018',title:'Sức chịu tải cọc tổng hợp – đất nền ↔ vật liệu',status:'VERIFIED',source:'10304 Rd đã LOCKED + 5574 CT (49)–(50) đã LOCKED · HNL governing composition',keywords:/kiem.*(?:ca\s*)?dat.*vat\s*lieu|r_?soil.*r_?material|dat.*vat\s*lieu.*khong\s*che|suc\s*chiu\s*tai.*dat.*vat\s*lieu/i},
  {id:'5574-pile-material',standard:'TCVN 5574:2018',title:'Sức chịu tải vật liệu cọc – nén gần đúng tâm',status:'VERIFIED',source:'8.1.2.4.3 · CT (49)–(50) · Bảng 16; Bảng 7/13',keywords:/suc chiu tai.*vat lieu.*coc|sct\s*vat\s*lieu|r_?material|pile material/i},
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
  // Natural Vietnamese often describes the member first ("cọc vuông 400x400 ... đóng bằng búa")
  // instead of the compact phrase "cọc đóng". Treat a pile + explicit driven/pressed
  // construction verb as the same 10304-driven intent. More-specific workflows below
  // (cọc chống, cọc khoan, CPT...) still win through the priority order.
  if(/\bcoc\b/.test(q) && /\b(?:dong|ep)\b/.test(q) && !matches.some(w=>w.id==='10304-driven')) {
    const driven=WORKFLOW_REGISTRY.find(w=>w.id==='10304-driven');
    if(driven) matches.push(driven);
  }
  // More specific workflow first.
  const order=['pile-capacity-multiborehole','pile-capacity-integrated','7888-material','10304-end-bearing','10304-cpt','10304-spt','10304-static','10304-dynamic','10304-bored','10304-screw','10304-settlement-single','10304-settlement-group','10304-equivalent-block','10304-piled-raft','10304-construction-effect','5574-pile-material','10304-driven','5574-anchorage','5574-lap-splice','5574-annex-d','5574-annex-l','5574-annex-m','5574-circular','5574-corbel','5574-annex-g','5574-crack','5574-deformation','5574-prestress','5574-punch','5574-local','5574-torsion','5574-shear','5574-eccentric','5574-bending-rect','5574-material'];
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
  // Accept both compact ranges ("Lớp 1: 0-3 m") and prose copied from PDF/Word
  // ("Lớp 1: Từ 0 m đến 3 m (dày 3 m), đất sét có I_L=0,7").
  // Parse one whole layer block at a time so punctuation/semicolons inside a layer
  // do not truncate IL or manual f_i before the next "Lớp N" heading.
  const source=normalizeEngineeringText(text);
  const rows=[];
  const blockRe=/(?:lop|lớp)\s*(\d+)\s*[:\-]?\s*([\s\S]*?)(?=(?:lop|lớp)\s*\d+\s*[:\-]?|$)/gi;
  let m;
  while((m=blockRe.exec(source))){
    const index=Number(m[1]);
    const body=String(m[2]||'').trim();
    const range=body.match(/(?:(?:tu|từ)\s*)?(\d+(?:[.,]\d+)?)\s*m?\s*(?:-|(?:den|đến))\s*(\d+(?:[.,]\d+)?)\s*m?\b/i);
    if(!range) continue;
    const tail=body.toLocaleLowerCase('vi');
    const sandyClay=/c[aá]t\s*pha|sandy\s*clay/.test(tail), clayeySand=/s[eé]t\s*pha|clayey\s*sand/.test(tail);
    const soil=(sandyClay||clayeySand)?'clay':(/c[aá]t|sand/.test(tail)?'sand':'clay');
    const soilClass=sandyClay?'sandyClay':(clayeySand?'clayeySand':(soil==='sand'?'sand':'clay'));
    let sandType=''; if(/s[oỏ]i|gravel/.test(tail)) sandType='gravelly'; else if(/bụi|bui|silty/.test(tail)) sandType='silty'; else if(/mịn|min|fine/.test(tail)) sandType='fine'; else if(/thô|tho|coarse/.test(tail)) sandType='coarse'; else if(/vừa|vua|medium/.test(tail)) sandType='medium';
    const IL=extractEngineeringNumber(tail,['IL','I_L']);
    const fiOverride=extractEngineeringNumber(tail,[`f${index}`,`f_${index}`,'fi','f_i'],'(?:kPa|kN/m2)');
    const phiDeg=extractEngineeringNumber(tail,['phi','φ'],'(?:deg|°)?');
    const gammaKnM3=extractEngineeringNumber(tail,['gamma','γ','gamma1','γ1'],'(?:kN/m3|kN/m³)?');
    const gammaEffectiveKnM3=extractEngineeringNumber(tail,["gamma'","γ'","gamma1'","γ1'"],'(?:kN/m3|kN/m³)?');
    const sptN=extractEngineeringNumber(tail,['N-SPT','NSPT','N_spt','N']);
    const cuKpa=extractEngineeringNumber(tail,['cu','c_u'],'(?:kPa)?');
    const Sr=extractEngineeringNumber(tail,['Sr','S_r']);
    rows.push({index,top:number(range[1]),bottom:number(range[2]),soilGroup:soil,soilClass,sandType,IL,fiOverride,phiDeg,gammaKnM3,gammaEffectiveKnM3,sptN,cuKpa,Sr});
  }
  return rows;
}


function parseSptPoints(text=''){
  const src=normalizeEngineeringText(text); const out=[];
  const re=/(?:z|depth|độ\s*sâu|do\s*sau)\s*[=:]?\s*(\d+(?:[.,]\d+)?)\s*m?\s*[,;:)\- ]+\s*(?:N(?:-?SPT)?|N_spt)\s*[=:]?\s*(\d+(?:[.,]\d+)?)/gi;
  let m; while((m=re.exec(src))) out.push({depthM:number(m[1]),N:number(m[2])});
  // Also accept compact tuples "(1,5m; N=4)".
  const tuple=/\(?\s*(\d+(?:[.,]\d+)?)\s*m\s*[,;]\s*N\s*[=:]\s*(\d+(?:[.,]\d+)?)\s*\)?/gi;
  while((m=tuple.exec(src))) if(!out.some(p=>Math.abs(p.depthM-number(m[1]))<1e-12&&Math.abs(p.N-number(m[2]))<1e-12)) out.push({depthM:number(m[1]),N:number(m[2])});
  return out.sort((a,b)=>a.depthM-b.depthM);
}

function parseDrivenPile(question='') {
  const q=normalizeEngineeringText(question);
  const norm=n(q);
  const geometry=inferPileGeometry(q);
  const L=grab(q,/(?:\bL\s*=?\s*|(?:dài|dai)(?:\s+L)?\s*=?\s*)(\d+(?:[.,]\d+)?)\s*m\b/i);
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
    gammaN:extractEngineeringNumber(q,['gamma_n','γn']),
    layers:parsePileLayers(q),
    geometryAudit:geometry
  };
}


function explicit(q, names, unit='') { return extractEngineeringNumber(q,names,unit); }

function calcEndBearing10304(q='') {
  const Rkb=explicit(q,['Rkb','R_kb'],'(?:kN)?');
  const geometry=inferPileGeometry(q);
  const A=explicit(q,['Ap','A_p','A','diện tích mũi','dien tich mui','diện tích tiết diện mũi','dien tich tiet dien mui'],'(?:m2|mm2)?') ?? geometry.areaM2;
  // Prefer an independent PDF/Table-1 calculation whenever Rc,n + RQD are present,
  // even if the pasted text also contains a legacy/XLL "result for comparison".
  let RcN=explicit(q,['Rc,n','R_c,n','RcN','Rcn','cường độ nén một trục mẫu','cuong do nen mot truc mau'],'(?:MPa|kPa)?');
  if(RcN!=null && /(?:R[_\s]?c[, _]?n|RcN|cường độ nén một trục mẫu|cuong do nen mot truc mau)[\s\S]{0,40}\d+(?:[.,]\d+)?\s*MPa/i.test(q)) RcN*=1000;
  const rqd=explicit(q,['RQD'],'(?:%)?');
  if(RcN!=null&&rqd!=null){
    const Ld=explicit(q,['Ld','L_d','chiều sâu ngàm','chieu sau ngam'],'m?') ?? 0;
    const gammaG=explicit(q,['gamma_g','γg']) ?? 1.4;
    const df=explicit(q,['df','d_f'],'m?') ?? geometry.diameterM ?? geometry.sideM;
    const gammaK=explicit(q,['gamma_k','γk']),gammaN=explicit(q,['gamma_n','γn']);
    const minimumQbKpa=explicit(q,['minimum_qb','qb_min','q_b,min'],'(?:kPa)?');
    const rawExcelInput={shape:geometry.shape,diameterM:geometry.diameterM,sideM:geometry.sideM,areaM2:A,rockCompressiveStrengthKpa:RcN,rqdPercent:rqd,gammaG,embedmentLengthM:Ld,embeddedOuterDiameterM:df,minimumQbKpa,gammaK,gammaN,consequenceClass:(q.match(/\bC[123]\b/i)||[])[0]};
    const result=calculateRockEndBearing10304(rawExcelInput);
    if(result.ok){ result.inputs={...result.inputs,geometryAudit:geometry,legacyComparisonIgnored:/kết quả đối chiếu|ket qua doi chieu|phần mềm cũ|phan mem cu/i.test(q)}; result.excelInputs=rawExcelInput; }
    return result;
  }
  let qb=explicit(q,['qb','q_b'],'(?:kPa)?'); const gammaC=explicit(q,['gamma_c','γc']) ?? 1;
  const Rm=explicit(q,['Rm','R_m'],'(?:kPa)?'); const Ld=explicit(q,['Ld','L_d'],'m?'); const df=explicit(q,['df','d_f'],'m?');
  if(qb==null && Rm!=null){ qb=(Ld!=null&&df!=null)?Rm*Math.min(1+0.4*Ld/df,3):Rm; }
  if(Rkb!=null) return {ok:true,RkKn:Rkb,inputs:{Rkb},steps:[`CT (5): Rk=Rk,b=${Rkb.toFixed(3)} kN.`],provenance:['TCVN 10304:2025 · 7.2.1.1 · CT (5) · trang 28']};
  const missing=[]; if(A==null) missing.push('A diện tích mũi (m²)'); if(qb==null) missing.push('q_b (kPa), hoặc Rc,n + RQD + Ld/df để tính độc lập Bảng 1/CT (7)/(8)');
  if(missing.length) return {ok:false,missing};
  if(geometry.areaConflict) return {ok:false,missing:[`Diện tích nhập và diện tích suy từ hình học không khớp; cần xác nhận trước khi tính.`],inputs:{gammaC,A,qb,Rm,Ld,df,geometryAudit:geometry}};
  const Rk=gammaC*qb*A;
  return {ok:true,status:'MIXED/MANUAL',RkKn:Rk,inputs:{gammaC,A,qb,Rm,Ld,df,geometryAudit:geometry},steps:[`CT (6): Rk,b=γc·q_b·A=${gammaC}×${qb}×${A}=${Rk.toFixed(3)} kN.`],provenance:['TCVN 10304:2025 · 7.2.1.1 · CT (5)–(8) · trang 28-30','q_b nhập tay: giữ provenance MANUAL']};
}
function calcBored10304(q='') {
  const geometry=inferPileGeometry(q),layers=parsePileLayers(q),norm=n(q);
  const L=explicit(q,['L','chiều dài','chieu dai'],'m?'); const tipDepth=explicit(q,['z_tip','tipDepth','độ sâu mũi','do sau mui'],'m?') ?? L;
  const methodCaseId=/bentonite|dưới nước|duoi nuoc/.test(norm)?'drilled-water-bentonite':(/cfa|khoan khô|khoan kho/.test(norm)?'drilled-dry-cfa':(/barrette/.test(norm)?'barrette':'bored-64a-64b'));
  if(layers.length&&tipDepth!=null){
    const rawExcelInput={shape:geometry.shape,diameterM:geometry.diameterM,sideM:geometry.sideM,areaM2:geometry.areaM2,perimeterM:geometry.perimeterM,lengthM:L,tipDepthM:tipDepth,shaftStartDepthM:explicit(q,['shaftStart','z_head','độ sâu đầu cọc','do sau dau coc'],'m?')??0,maxSegmentM:explicit(q,['maxSegment','delta_z','Δz'],'m?')??2,layers,methodCaseId,gammaC:explicit(q,['gamma_c','γc']),gammaRR:explicit(q,['gamma_RR','γRR']),gammaK:explicit(q,['gamma_k','γk']),gammaN:explicit(q,['gamma_n','γn']),qbOverride:explicit(q,['qb','q_b'],'(?:kPa)?'),tipPhiDeg:explicit(q,['phi_tip','φ_tip','phi','φ'],'(?:deg|°)?'),tipEffectiveGammaKnM3:explicit(q,["gamma1'","γ1'"],'(?:kN/m3|kN/m³)?'),averageGammaAboveTipKnM3:explicit(q,['gamma1','γ1'],'(?:kN/m3|kN/m³)?'),baseDiameterM:explicit(q,['d','đường kính đáy','duong kinh day'],'m?'),tipCoreRetained:/lõi đất|loi dat|soil core/.test(norm),tipConstruction:/pdt/.test(norm)?'jet-grout-pdt':'general'};
    const result=calculateBoredPile10304(rawExcelInput); if(result.ok) result.excelInputs=rawExcelInput;
    if(result.ok||result.missing?.length) return result;
  }
  // Backward-compatible manual workflow when the question provides precomputed Σfi·hi.
  const A=explicit(q,['Ap','A_p','A','diện tích mũi','dien tich mui','diện tích tựa mũi','dien tich tua mui'],'(?:m2|mm2)?') ?? geometry.areaM2;
  const u=explicit(q,['u','chu vi'],'(?:m|mm)?') ?? geometry.perimeterM; let qb=explicit(q,['qb','q_b'],'(?:kPa|kN/m2)?');
  const gammaC=explicit(q,['gamma_c','γc']) ?? 1; const gammaRR=explicit(q,['gamma_RR','γRR']) ?? 1; const gammaRf=explicit(q,['gamma_Rf','γRf']) ?? 1; const sumFh=explicit(q,['sum_fh','Σfihi','tong fihi','tổng fihi'],'(?:kPa\.?m)?');
  let qbLookup=null; const depth=explicit(q,['depth','z','h','chiều sâu mũi','chieu sau mui'],'m?'); const IL=explicit(q,['IL','I_L']); let phi=null,gp=null,g1=null,d=null;
  if(qb==null){
    if(/s[eé]t|đất dính|dat dinh/.test(q) && depth!=null && IL!=null){ try{ qbLookup=lookupTable8Qb10304({depthM:depth,IL}); qb=qbLookup.value; }catch(e){ return {ok:false,missing:[e.message]}; } }
    else if(/c[aá]t/.test(q)){ phi=explicit(q,['phi','φ'],'(?:deg|°)?'); gp=explicit(q,["gamma1'","γ1'",'gamma1p'],'(?:kN/m3|kN/m³)?'); g1=explicit(q,['gamma1','γ1'],'(?:kN/m3|kN/m³)?'); d=explicit(q,['d'],'m?'); const h=depth; if(phi!=null&&gp!=null&&g1!=null&&d!=null&&h!=null){ try{ const a=lookupTable7Alphas10304({phi,hdRatio:h/d,dM:d}); qbLookup=a; qb=0.75*a.alpha4*(a.alpha1*gp*d+a.alpha2*a.alpha3*g1*h); }catch(e){ return {ok:false,missing:[e.message]}; } } }
  }
  const missing=[]; if(A==null) missing.push('A diện tích tựa mũi (m²)'); if(u==null) missing.push('u chu vi thân cọc (m)'); if(qb==null) missing.push('qb (kPa) hoặc địa tầng đủ để tự tính'); if(sumFh==null) missing.push('địa tầng từng lớp hoặc Σ(fi·hi) có provenance');
  if(missing.length) return {ok:false,missing}; const Rb=gammaRR*qb*A, Rf=gammaRf*u*sumFh, Rk=gammaC*(Rb+Rf);
  return {ok:true,status:'MIXED/MANUAL',RkKn:Rk,inputs:{A,u,qb,gammaC,gammaRR,gammaRf,sumFh,depth,IL,phi,gamma1p:gp,gamma1:g1,d},qbLookup,steps:[`CT (13): Rk=γc(γRR·qb·A+γRf·u·Σfi·hi).`,`Rk=${Rk.toFixed(3)} kN.`],provenance:['TCVN 10304:2025 · 7.2.3 · CT (13)–(15) · tr.37–42','Σfi·hi/qb nhập tay giữ MANUAL provenance']};
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
function parseStaticLoadCurve10304(q='') {
  const points=[]; const re=/(\d+(?:[.,]\d+)?)\s*kN\s*(?:@|:|\/|->|→)\s*(\d+(?:[.,]\d+)?)\s*mm/gi; let m;
  while((m=re.exec(String(q)))) points.push({loadKn:number(m[1]),settlementMm:number(m[2])});
  points.sort((a,b)=>a.settlementMm-b.settlementMm);
  return points;
}
function interpolateStaticLoadAtSettlement10304(points,targetMm){
  if(!Array.isArray(points)||points.length<2) return {ok:false,reason:'Cần ít nhất 2 điểm tải–lún dạng 500kN@10mm.'};
  for(let i=1;i<points.length;i++){
    if(!(points[i].settlementMm>points[i-1].settlementMm)) return {ok:false,reason:'Độ lún các điểm thử phải tăng nghiêm ngặt.'};
    if(points[i].loadKn+1e-9<points[i-1].loadKn) return {ok:false,reason:'Tải trọng đường cong nén phải không giảm theo độ lún.'};
  }
  if(targetMm<points[0].settlementMm-1e-9||targetMm>points.at(-1).settlementMm+1e-9) return {ok:false,reason:`Độ lún mục tiêu ${targetMm.toFixed(3)} mm nằm ngoài phạm vi đường cong ${points[0].settlementMm}–${points.at(-1).settlementMm} mm; không được ngoại suy.`};
  const exact=points.find(p=>Math.abs(p.settlementMm-targetMm)<=1e-9); if(exact) return {ok:true,loadKn:exact.loadKn,mode:'EXACT'};
  for(let i=1;i<points.length;i++){ const a=points[i-1],b=points[i]; if(targetMm>a.settlementMm&&targetMm<b.settlementMm){ const t=(targetMm-a.settlementMm)/(b.settlementMm-a.settlementMm); return {ok:true,loadKn:a.loadKn+t*(b.loadKn-a.loadKn),mode:'LINEAR_INTERPOLATION',bracket:[a,b]}; }}
  return {ok:false,reason:'Không xác định được tải tại độ lún mục tiêu.'};
}
function calcStatic10304(q='') {
  let Ru=explicit(q,['Ru,k','R_u,k','Ruk','Ru'],'(?:kN)?'); const gammaCg1=explicit(q,['gamma_cg1','γc,g1']) ?? 1; const gammaC=explicit(q,['gamma_c','γc']) ?? 1;
  let staticCriterion=null;
  if(Ru==null){
    const suMt=explicit(q,['su,mt','su_mt','s_u,mt','s_u_mt','su mt'],'(?:mm)?');
    const IL=explicit(q,['IL','I_L']); let zeta=explicit(q,['zeta','ζ']);
    if(zeta==null&&IL!=null) zeta=IL>0.5?0.2:0.35;
    const points=parseStaticLoadCurve10304(q);
    const missing=[]; if(!(suMt>0)) missing.push('su,mt độ lún giới hạn trung bình (mm)'); if(!(zeta>0)) missing.push('ζ hoặc IL để chọn ζ=0,2/0,35'); if(points.length<2) missing.push('ít nhất 2 điểm đường cong tải–lún, ví dụ 500kN@10mm');
    if(missing.length) return {ok:false,status:'REVIEW',missing};
    const targetSettlementMm=Math.min(zeta*suMt,40); const interp=interpolateStaticLoadAtSettlement10304(points,targetSettlementMm);
    if(!interp.ok) return {ok:false,status:'REVIEW',inputs:{suMt,IL,zeta,targetSettlementMm,curve:points},missing:[interp.reason]};
    Ru=interp.loadKn; staticCriterion={suMt,IL,zeta,targetSettlementMm,curve:points,interpolation:interp.mode,bracket:interp.bracket||null};
  }
  const Rk=gammaC*Ru/gammaCg1;
  const steps=[]; if(staticCriterion) steps.push(`CT (21): s= min(ζ·su,mt;40)=min(${staticCriterion.zeta}·${staticCriterion.suMt};40)=${staticCriterion.targetSettlementMm.toFixed(3)} mm → Ru,k=${Ru.toFixed(3)} kN (${staticCriterion.interpolation}).`);
  steps.push(`CT (20): Rk=γc·Ru,k/γc,g1=${Rk.toFixed(3)} kN.`);
  return {ok:true,status:'VERIFIED',staticMode:staticCriterion?'CURVE_CT21':'DIRECT_RU_CT20',formulaId:staticCriterion?21:20,RkKn:Rk,inputs:{Ru,gammaCg1,gammaC,...(staticCriterion||{})},steps,provenance:['TCVN 10304:2025 · 7.3.2.1-7.3.2.3 · CT (20),(21) · tr.49-50','CT (21): Ru lấy tại s=ζ·su,mt, khống chế s≤40 mm; nội suy tuyến tính chỉ trong miền đường cong đo được']};
}
function calcCpt10304(q='') {
  const geometry=inferPileGeometry(q);
  const norm=n(q);
  const isBored=/coc (?:khoan|nhoi)|bored|6\.5\s*a/.test(norm);
  const A=explicit(q,['Ap','A_p','A'],'(?:m2|mm2)?') ?? geometry.areaM2;
  const u=explicit(q,['u','chu vi'],'(?:m|mm)?') ?? geometry.perimeterM;

  // P5.2: CT (29) is a distinct CPT branch for bored piles under 6.5 a).
  // It must not be approximated by CT (25)-(28): Table 16 provides qb/fi
  // directly from qc and gammaR,f depends on concreting technology.
  if(isBored){
    const h=explicit(q,['h','L','chiều dài','chieu dai'],'m?');
    const qc=explicit(q,['qc','q_c'],'(?:kPa|MPa)?');
    const soil=/s[eé]t|dat dinh|clay/.test(norm)?'clay':'sand';
    const d=geometry.diameterM ?? explicit(q,['D','diameter','đường kính','duong kinh'],'m?');
    let qb=explicit(q,['qb','q_b'],'(?:kPa)?');
    let fi=explicit(q,['fi','f_i'],'(?:kPa)?');
    let qbLookup=null,fiLookup=null;
    if(qc!=null && qb==null){
      try{qbLookup=lookupTable16Cpt10304({qc,soil,component:'qb'});qb=qbLookup.value;}
      catch(e){return {ok:false,status:'REVIEW',cptMode:'BORED_CT29',missing:[e.message]};}
    }
    if(qc!=null && fi==null){
      try{fiLookup=lookupTable16Cpt10304({qc,soil,component:'fi'});fi=fiLookup.value;}
      catch(e){return {ok:false,status:'REVIEW',cptMode:'BORED_CT29',missing:[e.message]};}
    }
    let gammaRf=explicit(q,['gamma_Rf','gamma_R,f','γRf','γR,f']);
    const wet=/duoi nuoc|dưới nước|bentonite|dung dich set|dung dịch sét|ong vach|ống vách/.test(norm);
    if(gammaRf==null) gammaRf=wet?0.7:1.0;
    const missing=[];
    if(A==null) missing.push('A diện tích mũi (m²)');
    if(u==null) missing.push('u chu vi cọc (m)');
    if(!(h>0)) missing.push('h/L chiều dài cọc trong đất (m)');
    if(qb==null) missing.push('qc để tra qb Bảng 16 hoặc qb có provenance');
    if(fi==null) missing.push('qc để tra fi Bảng 16 hoặc fi có provenance');
    if(!(d>0)) missing.push('D đường kính cọc khoan để kiểm phạm vi Bảng 16');
    if(missing.length) return {ok:false,status:'REVIEW',cptMode:'BORED_CT29',missing};
    const applicability=[];
    if(d<0.6-1e-12||d>1.2+1e-12) applicability.push(`Bảng 16 áp dụng cho cọc khoan D=0,6–1,2 m; D đang là ${d} m.`);
    if(h<5-1e-12) applicability.push(`Bảng 16 yêu cầu cọc hạ trong đất tối thiểu 5 m; h đang là ${h} m.`);
    if(applicability.length) return {ok:false,status:'REVIEW',cptMode:'BORED_CT29',inputs:{A,u,h,qc,qb,fi,gammaRf,soil,d},missing:applicability};
    const segmentCount=Math.max(1,Math.ceil(h/2));
    const segmentThickness=h/segmentCount;
    const shaftSum=gammaRf*fi*h;
    const tip=qb*A;
    const shaft=u*shaftSum;
    const Ru=tip+shaft;
    return {
      ok:true,status:'VERIFIED',cptMode:'BORED_CT29',formulaId:29,RkKn:Ru,
      inputs:{A,u,h,qc,qb,fi,gammaRf,soil,d,segmentCount,segmentThicknessM:segmentThickness,qbAuto:!!qbLookup,fiAuto:!!fiLookup,concreting:wet?'water-bentonite-casing':'dry'},
      tableLookups:{qb:qbLookup,fi:fiLookup},
      steps:[
        `Bảng 16: qc=${qc} kPa → qb=${qb} kPa; fi=${fi} kPa.`,
        `Điều kiện CT (29): D=${d.toFixed(3)} m trong 0,6–1,2 m; h=${h.toFixed(3)} m ≥5 m; chia ${segmentCount} đoạn tính, mỗi đoạn ${segmentThickness.toFixed(3)} m ≤2 m.`,
        `γR,f=${gammaRf} (${wet?'đổ dưới nước/bentonite/ống vách':'đổ bê tông điều kiện khô'}).`,
        `CT (29): Rk,u=qb·A+u·Σ(γR,f·fi·hi)=${tip.toFixed(3)}+${shaft.toFixed(3)}=${Ru.toFixed(3)} kN.`
      ],
      provenance:[
        'TCVN 10304:2025 · 7.3.4.4 · CT (29) · tr.57',
        'TCVN 10304:2025 · Bảng 16 · tr.58 · Chú thích 1: qc trung gian nội suy tuyến tính; không nội suy qua ô “–”',
        'Bảng 16: cọc khoan D=600–1200 mm, chiều dài trong đất ≥5 m; hi≤2 m'
      ]
    };
  }

  // Existing CT (25)-(28) branch is intentionally preserved byte-for-byte in logic.
  const h=explicit(q,['h'],'m?');
  const qs=explicit(q,['qs','q_s'],'(?:kPa)?');
  const fs=explicit(q,['fs','f_s'],'(?:kPa)?');
  let b1=explicit(q,['beta1','β1']); let b2=explicit(q,['beta2','β2']);
  const pile=/coc vit/.test(norm)?'screw':'driven';
  const load=/keo|nh[oổ]/.test(norm)?'tension':'compression';
  const soil=/s[eé]t|dat dinh/.test(norm)?'clay':'sand';
  const probe=/dien|loai ii|loai iii/.test(norm)?'electric':'mechanical';
  let b1Lookup=null,b2Lookup=null;
  if(b1==null&&qs!=null){ try{b1Lookup=lookupTable15Beta1({qs,pile,load});b1=b1Lookup.value;}catch(e){return {ok:false,missing:[e.message,'Hoặc nhập β1 thủ công kèm provenance.']};} }
  if(b2==null&&fs!=null){ try{b2Lookup=lookupTable15SideBeta({fs,probe,soil,saturatedSand:/bao hoa/.test(norm)});b2=b2Lookup.value;}catch(e){return {ok:false,missing:[e.message,'Hoặc nhập β2/βi thủ công kèm provenance.']};} }
  const missing=[]; for(const [v,nm] of [[A,'A (m²)'],[u,'u (m)'],[h,'h (m)'],[qs,'qs (kPa)'],[fs,'fs (kPa)'],[b1,'β1 Bảng 15'],[b2,probe==='mechanical'?'β2 Bảng 15':'βi Bảng 15']]) if(v==null) missing.push(nm);
  if(missing.length) return {ok:false,missing};
  const Rs=b1*qs, f=b2*fs, Ru=Rs*A+f*h*u;
  return {ok:true,status:'VERIFIED',cptMode:'DRIVEN_CT25_28',formulaId:25,RkKn:Ru,inputs:{A,u,h,qs,fs,b1,b2,pile,load,soil,probe,b1Auto:!!b1Lookup,b2Auto:!!b2Lookup,saturatedSand:/bao hoa/.test(norm)},tableLookups:{b1:b1Lookup,b2:b2Lookup},steps:[`Bảng 15: β1=${b1}${b1Lookup?` (${b1Lookup.mode})`:''}; ${probe==='mechanical'?'β2':'βi'}=${b2}${b2Lookup?` (${b2Lookup.mode})`:''}.`,`CT (26): Rs=β1·qs=${Rs.toFixed(3)} kPa.`,`CT (27)/(28): f=β·fs=${f.toFixed(3)} kPa.`,`CT (25): Ru=Rs·A+f·h·u=${Ru.toFixed(3)} kN.`],provenance:['TCVN 10304:2025 · 7.3.4.2 · CT (25)-(28) · tr.55-56','Bảng 15 · tr.57 · không tự nội suy nếu không có chú thích cho phép']};
}
function calcSpt10304(q='', options={}) {
  const geometry=inferPileGeometry(q),normalizedGeometry=buildNormalizedSptGeometryInput(q,geometry),layers=parsePileLayers(q),points=parseSptPoints(q),norm=n(q); const L=normalizedGeometry.lengthM??explicit(q,['L','chiều dài','chieu dai'],'m?'),tipDepth=explicit(q,['z_tip','tipDepth','độ sâu mũi','do sau mui'],'m?')??L;
  const pileType=/coc vit/.test(norm)?'screw':(/rung.*moi dat|ống rung|ong rung/.test(norm)?'vibro-pipe':(/coc dong|coc ep|đóng|ép/.test(norm)?'driven':'bored'));
  if(layers.length&&tipDepth!=null&&(points.length||layers.some(x=>x.sptN!=null||x.cuKpa!=null))){
    const rawExcelInput={pileType,sectionType:normalizedGeometry.sectionType,shape:normalizedGeometry.sectionType,widthM:normalizedGeometry.widthM,heightM:normalizedGeometry.heightM,diameterM:normalizedGeometry.diameterM,sideM:normalizedGeometry.sideM,lengthM:L,tipDepthM:tipDepth,shaftStartDepthM:explicit(q,['shaftStart','z_head','độ sâu đầu cọc','do sau dau coc'],'m?')??0,layers,sptPoints:points,closedTip:!/hở mũi|ho mui|open tip/.test(norm),innerDiameterM:explicit(q,['d_in','dtrong','đường kính trong','duong kinh trong'],'m?'),gammaK:explicit(q,['gamma_k','γk']),gammaN:explicit(q,['gamma_n','γn'])};
    const result=calculateSptPile10304(rawExcelInput); if(result.ok) result.excelInputs=rawExcelInput; return result;
  }

  // V26: natural-language SPT summary route. The interpreter may use AI only to
  // identify inputs/semantics; the deterministic engine below owns all formulas.
  const interpreted=extractSptSummaryInputV26(q,options.aiExtraction||null);
  let summaryGeometry=null; try{summaryGeometry=deriveSptSectionGeometry(interpreted);}catch{}
  const summaryReady=interpreted.soilGroup==='sand'&&interpreted.pileType!=='unknown'&&interpreted.fullShaft&&interpreted.lengthM>0&&interpreted.nBarTip!=null&&interpreted.nsShaft!=null&&summaryGeometry?.areaM2>0&&summaryGeometry?.perimeterM>0;
  if(summaryReady){
    const summaryInput={
      inputMode:'EXPLICIT_SPT_SUMMARY',
      pileType:interpreted.pileType,
      sectionType:interpreted.sectionType,
      shape:interpreted.sectionType,
      widthM:interpreted.widthM,
      heightM:interpreted.heightM,
      diameterM:interpreted.diameterM,
      sideM:interpreted.sideM,
      lengthM:interpreted.lengthM,
      shaftStartDepthM:0,
      shaftLengthM:interpreted.shaftLengthM,
      soilGroup:'sand',
      nBarTip:interpreted.nBarTip,
      nsShaft:interpreted.nsShaft,
      eta:interpreted.eta,
      closedTip:interpreted.closedTip,
      gammaK:interpreted.gammaK,
      gammaN:interpreted.gammaN
    };
    const result=calculateSptSummary10304(summaryInput);
    result.inputInterpretation=interpreted;
    if(result.ok) result.excelInputs=summaryInput;
    return result;
  }

  // Legacy explicit-input compatibility: scalar values only. V26 Formula Guard
  // rejects coefficients embedded in formulas (qb=300ηNbar, fs=2Ns, ...).
  const qb=extractEngineeringScalarNumber(q,['qb','q_b'],'(?:kPa|kN/m2|kN/m²)?'); const A=explicit(q,['Ap','A_p','A'],'(?:m2|mm2)?') ?? geometry.areaM2; const fs=extractEngineeringScalarNumber(q,['fs','f_s'],'(?:kPa|kN/m2|kN/m²)?') ?? 0; const fc=extractEngineeringScalarNumber(q,['fc','f_c'],'(?:kPa|kN/m2|kN/m²)?') ?? 0; const Ls=explicit(q,['Ls','L_s'],'m?') ?? 0; const Lc=explicit(q,['Lc','L_c'],'m?') ?? 0; const u=explicit(q,['u','chu vi'],'(?:m|mm)?') ?? geometry.perimeterM;
  const missing=[]; if(qb==null) missing.push('N-SPT/c_u + địa tầng hoặc N̄/Ns tóm tắt có provenance để Calculation Engine tự tính Bảng D.1; qb chỉ được nhập tay khi là giá trị scalar'); if(A==null) missing.push('A (m²)'); if(u==null) missing.push('u (m)'); if(!Ls&&!Lc) missing.push('Ls và/hoặc Lc'); if(missing.length) return {ok:false,missing,inputInterpretation:interpreted}; const Rub=qb*A, Ruf=fs*Ls*u+fc*Lc*u, Ru=Rub+Ruf;
  return {ok:true,status:'MIXED/MANUAL',RkKn:Ru,inputs:{qb,A,fs,fc,Ls,Lc,u},inputInterpretation:interpreted,steps:[`D.3: Ru,b=qb·A=${Rub.toFixed(3)} kN.`,`D.5-D.6: Ru,f=${Ruf.toFixed(3)} kN.`,`D.1-D.2: Rk=Ru=${Ru.toFixed(3)} kN.`],provenance:['TCVN 10304:2025 · Phụ lục D · D.1-D.6 · tr.110','Bảng D.1 · tr.111','V26 Formula Guard: qb/fs/fc nhập tay phải là scalar; hệ số trong công thức không được coi là giá trị đầu vào.']};
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

function lengthMmFromQuestion(q='', aliases=[]){
  const names=aliases.map(a=>String(a).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
  if(!names) return null;
  const re=new RegExp(`(?:^|[^A-Za-z0-9_])(?:${names})\\s*(?:=|:|≈|~)?\\s*(-?\\d+(?:[.,]\\d+)?)\\s*(mm|m)\\b`,'i');
  const m=normalizeEngineeringText(q).match(re); if(!m) return null;
  const v=Number(String(m[1]).replace(',','.')); return /mm/i.test(m[2])?v:v*1000;
}

function calculate5574PileMaterial(question='') {
  const q=String(question), upper=q.toUpperCase();
  const grade=(upper.match(/\bB(?:20|25|30|35|40|45|50|55|60|70|80|90|100)\b/)||[])[0]||null;
  const steel=(upper.match(/\bCB(?:240-T|300-T|300-V|400-V|500-V)\b/)||[])[0]||null;
  const pair=normalizeEngineeringText(q).match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|m)\b/i);
  const conv=(v,u)=>/mm/i.test(u)?Number(String(v).replace(',','.')):Number(String(v).replace(',','.'))*1000;
  const geom=inferPileGeometry(q);
  let shape=/tron|tròn|circle/i.test(q)?'circle':(/chu nhat|chữ nhật|rectangle/i.test(q)?'rectangle':(/vuong|vuông|square/i.test(q)?'square':geom.shape));
  let widthMm=null,heightMm=null,sideMm=null;
  if(pair){ widthMm=conv(pair[1],pair[3]); heightMm=conv(pair[2],pair[3]); if(Math.abs(widthMm-heightMm)<=1e-9) {shape='square';sideMm=(widthMm+heightMm)/2;} else shape=shape==='circle'?'circle':'rectangle'; }
  if(sideMm==null && geom.sideM!=null) sideMm=geom.sideM*1000;
  widthMm=widthMm??sideMm; heightMm=heightMm??sideMm;
  const AsTotMm2=explicit(q,['As,tot','AsTot','A_s_tot','As'],'(?:mm2|mm²)?');
  const L0Mm=lengthMmFromQuestion(q,['L0','L_0','chiều dài tính toán','chieu dai tinh toan']);
  const e0Mm=lengthMmFromQuestion(q,['e0','e_0','độ lệch tâm','do lech tam']);
  const loadDuration=/dai han|dài hạn|long.?term/i.test(q)?'long':(/ngan han|ngắn hạn|short.?term/i.test(q)?'short':null);
  const soilRdKn=explicit(q,['Rsoil','R_soil','Rd_soil','Rd đất','Rd dat'],'(?:kN)?');
  const e0IncludesRandom=/(?:e0|e_0|độ lệch tâm|do lech tam)[^;\n]{0,80}(?:đã|da|có|co|bao gồm|bao gom)[^;\n]{0,40}(?:lệch tâm ngẫu nhiên|lech tam ngau nhien|\bea\b)|(?:đã|da)\s*kể\s*\bea\b/i.test(q);
  const reinforcementOppositeSides=/(?:cốt|cot)[^;\n]{0,80}(?:hai|2)[^.;\n]{0,20}(?:phía|phia)[^.;\n]{0,20}(?:đối diện|doi dien)|(?:cốt|cot)[^;\n]{0,80}(?:đối xứng|doi xung)[^;\n]{0,40}(?:hai|2)[^.;\n]{0,20}(?:phía|phia)|(?:cốt|cot)[^;\n]{0,80}(?:phân bố|phan bo)[^;\n]{0,40}(?:đối xứng|doi xung)[^;\n]{0,40}(?:chu vi|perimeter)/i.test(q);
  const missing=[];
  if(!grade) missing.push('Cấp bê tông B20…B100.'); if(!steel) missing.push('Cấp thép CB...');
  if(!loadDuration) missing.push('Thời hạn tải: dài hạn hoặc ngắn hạn.');
  if(shape==='circle') missing.push('Cọc tròn không dùng CT (49)–(50); phải kiểm N–M theo Phụ lục F, không tạo một Rmaterial dọc trục giả.');
  if(!['square','rectangle'].includes(shape||'')) missing.push('Tiết diện vuông/chữ nhật và kích thước.');
  if(!(widthMm>0&&heightMm>0)) missing.push('b×h hoặc cạnh cọc.'); if(!(AsTotMm2>=0)) missing.push('As,tot (mm²).');
  if(!(L0Mm>=0)) missing.push('L0 có đơn vị m/mm.'); if(!(e0Mm>=0)) missing.push('e0 cuối cùng có đơn vị m/mm.');
  if(!e0IncludesRandom) missing.push('Xác nhận e0 đã kể độ lệch tâm ngẫu nhiên ea theo 8.1.2.2.4.');
  if(!reinforcementOppositeSides) missing.push('Xác nhận cốt thép dọc nằm ở các phía đối diện nhau trong mặt phẳng uốn.');
  const parsed={grade,steel,shape,sideMm,widthMm,heightMm,AsTotMm2,L0Mm,e0Mm,e0IncludesRandom,reinforcementOppositeSides,loadDuration,soilRdKn};
  if(missing.length) return {ok:false,status:'REVIEW',inputs:parsed,missing};
  const result=calculateNearCenteredRectPileCapacity5574(parsed); result.excelInputs=parsed;
  if(result.ok && soilRdKn>0) result.governing=combineSoilAndMaterialResistance({soilResult:{RdKn:soilRdKn},materialResult:result});
  return result;
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



function parseBoreholeBlocks(question='') {
  const src=normalizeEngineeringText(question); const out=[];
  const re=/\b((?:HK|BH|LK)\s*[-_]?\s*\d+)\s*:\s*([\s\S]*?)(?=\b(?:HK|BH|LK)\s*[-_]?\s*\d+\s*:|$)/gi;
  let m;
  while((m=re.exec(src))){
    const id=String(m[1]).replace(/\s+/g,'').replace(/[_-]/g,'').toUpperCase();
    const body=String(m[2]||'').trim();
    const layers=parsePileLayers(body),sptPoints=parseSptPoints(body);
    out.push({id,name:id,layers,sptPoints,source:'QUESTION-BOREHOLE-BLOCK',raw:body});
  }
  return out;
}

function calculateMultiBoreholeFromQuestion(question='') {
  const q=String(question),norm=n(q),boreholes=parseBoreholeBlocks(q);
  if(boreholes.length<2) return {ok:false,status:'REVIEW',missing:['Cần ít nhất hai block lỗ khoan, ví dụ HK1: ... HK2: ...; mỗi block có địa tầng và dữ liệu SPT.']};
  const geometry=inferPileGeometry(q);
  const L=explicit(q,['L','chiều dài','chieu dai'],'m?');
  const tipDepth=explicit(q,['z_tip','tipDepth','độ sâu mũi','do sau mui'],'m?')??L;
  const shaftStart=explicit(q,['shaftStart','z_head','độ sâu đầu cọc','do sau dau coc'],'m?')??0;
  const genericGk=explicit(q,['gamma_k','γk']);
  const mechGk=explicit(q,['gamma_k_mech','gamma_k_co_ly','γk_cơ_lý','γk_co_ly'])??genericGk;
  const sptGk=explicit(q,['gamma_k_spt','γk_spt'])??genericGk;
  const gammaN=explicit(q,['gamma_n','γn']);
  const mechanicalWorkflowId=/coc (?:nhoi|khoan)|barrette/.test(norm)?'10304-bored':(/\bcoc\b/.test(norm)&&/\b(?:dong|ep)\b|khong moi dat/.test(norm)?'10304-driven':null);
  if(!mechanicalWorkflowId) return {ok:false,status:'REVIEW',missing:['Multi-Borehole cần nêu loại cọc cơ lý: đóng/ép (7.2.2) hoặc khoan/nhồi (7.2.3).']};
  if(!(tipDepth>0)) return {ok:false,status:'REVIEW',missing:['Cần chiều dài/độ sâu mũi cọc.']};
  const pileInput={shape:geometry.shape||'square',sideM:geometry.sideM,diameterM:geometry.diameterM,areaM2:geometry.areaM2,perimeterM:geometry.perimeterM,lengthM:L,tipDepthM:tipDepth,shaftStartDepthM:shaftStart,maxSegmentM:explicit(q,['maxSegment','delta_z','Δz'],'m?')??2,gammaN};
  const mechanicalInput=mechanicalWorkflowId==='10304-driven'
    ? {method:/\bep\b|ép/.test(norm)?'press':(/\bdong\b|đóng/.test(norm)?'hammer':null),gammaC:explicit(q,['gamma_c','γc']),gammaRR:explicit(q,['gamma_RR','γRR']),gammaRf:explicit(q,['gamma_Rf','γRf']),gammaK:mechGk}
    : {methodCaseId:/bentonite|dưới nước|duoi nuoc/.test(norm)?'drilled-water-bentonite':(/cfa|khoan khô|khoan kho/.test(norm)?'drilled-dry-cfa':(/barrette/.test(norm)?'barrette':'bored-64a-64b')),gammaC:explicit(q,['gamma_c','γc']),gammaRR:explicit(q,['gamma_RR','γRR']),gammaK:mechGk,tipPhiDeg:explicit(q,['phi_tip','φ_tip','phi','φ'],'(?:deg|°)?'),tipEffectiveGammaKnM3:explicit(q,["gamma1'","γ1'"],'(?:kN/m3|kN/m³)?'),averageGammaAboveTipKnM3:explicit(q,['gamma1','γ1'],'(?:kN/m3|kN/m³)?'),baseDiameterM:explicit(q,['d','đường kính đáy','duong kinh day'],'m?'),tipCoreRetained:/lõi đất|loi dat|soil core/.test(norm),tipConstruction:/pdt/.test(norm)?'jet-grout-pdt':'general'};
  if(mechanicalWorkflowId==='10304-driven'&&!mechanicalInput.method&&mechanicalInput.gammaRR==null&&mechanicalInput.gammaRf==null) return {ok:false,status:'REVIEW',missing:['Cần phương pháp đóng/ép hoặc γR,R/γR,f có nguồn cho nhánh cơ lý.']};
  const sptInput={pileType:mechanicalWorkflowId==='10304-driven'?'driven':'bored',closedTip:!/hở mũi|ho mui|open tip/.test(norm),innerDiameterM:explicit(q,['d_in','dtrong','đường kính trong','duong kinh trong'],'m?'),gammaK:sptGk,gammaN};
  const materialResult=calculate5574PileMaterial(q);
  if(materialResult?.ok!==true) return {ok:false,status:'REVIEW',materialResult,missing:materialResult?.missing||['Thiếu dữ liệu vật liệu cọc.']};
  const payload={mechanicalWorkflowId,pileInput,mechanicalInput,sptInput,boreholes,materialInput:materialResult.excelInputs||materialResult.inputs||{},gammaN};
  const result=calculateMultiBoreholePileCapacity(payload);
  result.excelInputs=payload;
  result.materialResult=materialResult;
  if(!result.ok) result.missing=result.issues||[];
  return result;
}

function calculateIntegratedPileCapacity(question='') {
  const q=String(question), norm=n(q);
  let soilWorkflowId=null, soilResult=null, soilInput=null;
  if(/coc chong|tua (?:tren )?da|mui coc (?:tua|dat) (?:tren |vao )?da/.test(norm)){
    soilWorkflowId='10304-end-bearing'; soilResult=calcEndBearing10304(q); soilInput=soilResult?.excelInputs||soilResult?.inputs||{};
  } else if(/\bspt\b|xuyen tieu chuan/.test(norm)){
    soilWorkflowId='10304-spt'; soilResult=calcSpt10304(q); soilInput=soilResult?.excelInputs||soilResult?.inputs||{};
  } else if(/coc (?:nhoi|khoan)|barrette/.test(norm)){
    soilWorkflowId='10304-bored'; soilResult=calcBored10304(q); soilInput=soilResult?.excelInputs||soilResult?.inputs||{};
  } else if(/\bcoc\b/.test(norm)&&/\b(?:dong|ep)\b|khong moi dat/.test(norm)){
    soilWorkflowId='10304-driven'; soilInput=parseDrivenPile(q); soilResult=!soilInput.method&&soilInput.gammaRR==null&&soilInput.gammaRf==null?{ok:false,inputs:soilInput,missing:['Phương pháp thi công cọc (đóng hay ép), hoặc γR,R/γR,f có nguồn.']}:calculateDrivenPile10304(soilInput);
  } else {
    return {ok:false,status:'REVIEW',missing:['Cần nêu rõ workflow đất nền: cọc đóng/ép, cọc chống đá, cọc khoan/nhồi hoặc SPT.']};
  }
  const materialResult=calculate5574PileMaterial(q);
  if(soilResult?.ok!==true || materialResult?.ok!==true){
    return {ok:false,status:'REVIEW',soilWorkflowId,soilResult,materialResult,missing:[...(soilResult?.missing||[]),...(materialResult?.missing||[])]};
  }
  const governing=combineLockedPileResistance({soilWorkflowId,soilResult,soilInput,materialResult,gammaN:soilResult?.gammaN});
  const excelInputs={soilWorkflowId,soilInput,materialInput:materialResult.excelInputs||materialResult.inputs||{},gammaN:soilResult?.gammaN};
  return {ok:governing.ok,status:governing.ok?'VERIFIED':'REVIEW',productionNumeric:governing.ok===true,workflow:'pile-capacity-integrated',soilWorkflowId,soilResult,materialResult,governing,...governing,excelInputs,missing:governing.ok?[]:(governing.issues||[])};
}

function productionRegistryIdForResult(workflow={},result={}) {
  if(workflow.id==='pile-capacity-multiborehole' && result?.workflow==='pile-capacity-multiborehole') return 'pile-capacity-multiborehole-square';
  if(workflow.id==='pile-capacity-integrated' && result?.workflow==='pile-capacity-integrated') return 'pile-capacity-integrated-square';
  if(workflow.id==='10304-driven') return '10304-driven';
  if(workflow.id==='10304-end-bearing' && result?.Ks!=null) return '10304-end-bearing-rock';
  if(workflow.id==='10304-bored' && Array.isArray(result?.segmentResults) && result?.tipLayer) return '10304-bored-raw';
  if(workflow.id==='10304-cpt' && result?.cptMode) return '10304-cpt';
  if(workflow.id==='10304-spt' && result?.inputMode==='EXPLICIT_SPT_SUMMARY') return '10304-spt-summary-explicit';
  if(workflow.id==='10304-spt' && result?.noInterpolationPolicy===true) return '10304-spt-raw';
  if(workflow.id==='5574-pile-material' && result?.workflow==='pile-material-5574-near-centered-rect') return '5574-pile-material-near-centered-rect';
  return null;
}

export function canExportEngineeringResult(payload={}) {
  const workflow=payload?.workflow||{};
  const result=payload?.result||{};
  const verified=Boolean(workflow?.id) && String(workflow.status||'').startsWith('VERIFIED');
  // methodOnly is descriptive only: an incomplete VERIFIED_METHOD result can still
  // carry methodOnly=true. Export is allowed only after the deterministic engine
  // itself confirms the required inputs with ok=true.
  if(!verified || result?.ok!==true) return false;
  // Rock CT (7)/(8) without the required normative lower-bound q_b is deliberately
  // preliminary. It may be displayed/explained but must not leave HNL as a final
  // production workbook.
  if(result?.designFinal===false || result?.status==='VERIFIED_PRELIMINARY') return false;
  const registryId=productionRegistryIdForResult(workflow,result);
  if(registryId && !isProductionNumericAllowed(registryId)) return false;
  return true;
}

export function solveEngineeringQuestion(question='', options={}) {
  const workflow=selectEngineeringWorkflow(question);
  if(!workflow) return {recognized:false};
  let result=null;
  try {
    if(workflow.id==='pile-capacity-multiborehole') result=calculateMultiBoreholeFromQuestion(question);
    else if(workflow.id==='pile-capacity-integrated') result=calculateIntegratedPileCapacity(question);
    else if(workflow.id==='10304-end-bearing') result=calcEndBearing10304(question);
    else if(workflow.id==='10304-driven') { const input=parseDrivenPile(question); result=!input.method && input.gammaRR==null && input.gammaRf==null ? {ok:false,inputs:input,missing:['Phương pháp thi công cọc (đóng hay ép), hoặc γR,R/γR,f có nguồn để chọn Bảng 4.']} : calculateDrivenPile10304(input); }
    else if(workflow.id==='10304-bored') result=calcBored10304(question);
    else if(workflow.id==='10304-screw') result=calcScrew10304(question);
    else if(workflow.id==='10304-static') result=calcStatic10304(question);
    else if(workflow.id==='10304-dynamic') result=calcDynamic10304(question);
    else if(workflow.id==='10304-cpt') result=calcCpt10304(question);
    else if(workflow.id==='10304-spt') result=calcSpt10304(question,options);
    else if(workflow.id==='10304-settlement-single') result=calcSingleSettlement10304(question);
    else if(workflow.id==='10304-settlement-group') result=calcGroupSettlement10304(question);
    else if(workflow.id==='10304-equivalent-block') result=calcEquivalentBlock10304(question);
    else if(workflow.id==='10304-piled-raft') result=verifyPiledRaft10304(question);
    else if(workflow.id==='10304-construction-effect') result=calcConstructionEffect10304(question);
    else if(workflow.id==='5574-pile-material') result=calculate5574PileMaterial(question);
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
  const registryId=productionRegistryIdForResult(workflow,result);
  const solved={recognized:true,workflow,result,production:registryId?{id:registryId,...productionStatusFor(registryId)}:null,normalization:{raw:String(question||''),normalized:normalizeEngineeringText(question)}};
  return {...solved,canExport:canExportEngineeringResult(solved)};
}

export function engineeringExcelPayload(question='', options={}) {
  const solved=solveEngineeringQuestion(question,options);
  if(!solved.recognized) return {recognized:false};
  const id=solved.workflow.id;
  let input=solved.result?.excelInputs || solved.result?.inputs || {};
  if(id==='pile-capacity-multiborehole') input={...(solved.result?.excelInputs||{}),question};
  if(id==='pile-capacity-integrated') input={...(solved.result?.excelInputs||{}),question};
  if(id==='10304-driven') input=parseDrivenPile(question);
  if(id==='10304-settlement-single' || id==='10304-settlement-group' || id==='10304-equivalent-block' || id==='10304-dynamic') input={...(solved.result?.inputs||{}),question};
  if(id.startsWith('5574-')) input={...input,question};
  if(id==='7888-material') input={...(solved.result?.inputs||{}),question};
  const payload={...solved,input,question};
  return {...payload,canExport:canExportEngineeringResult(payload)};
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
    } else if(workflow.id==='pile-capacity-multiborehole'){
      lines.push(...(result.steps||[]).map(s=>`- ${s}`));
      lines.push(`- KẾT QUẢ BATCH: Rpile,min=${result.pileResistanceMinKn.toFixed(3)} kN; ${result.materialTie?'tie do VẬT LIỆU chung':`HK bất lợi=${result.criticalBoreholeId}; method=${result.criticalMethodId}`}.`);
      lines.push(`- BẤT LỢI RIÊNG ĐẤT: HK=${result.soilMinimum?.boreholeId||'-'}; method=${result.soilMinimum?.methodId||'-'}; Rd,min=${Number(result.soilMinimum?.valueKn||0).toFixed(3)} kN.`);
    } else if(workflow.id==='pile-capacity-integrated'){
      lines.push(...(result.steps||[]).map(s=>`- ${s}`));
      lines.push(`- KẾT QUẢ ENGINE: Rsoil=${result.soilResistanceKn.toFixed(3)} kN; Rmaterial=${result.materialResistanceKn.toFixed(3)} kN; Rpile=${result.pileResistanceKn.toFixed(3)} kN; khống chế=${result.governing==='SOIL'?'ĐẤT NỀN':'VẬT LIỆU'}.`);
      if(result.demandLimitKn!=null) lines.push(`- GIỚI HẠN TÁC ĐỘNG: γn=${result.gammaN}; Nd,max(final)=${result.demandLimitKn.toFixed(3)} kN. γn áp dụng sau phép min, không thay đổi Rsoil/Rmaterial.`);
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
