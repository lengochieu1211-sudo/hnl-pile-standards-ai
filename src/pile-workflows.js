import { linear1DStrict, bilinear2DStrict } from './interpolation-engine.js';
import { calculatePileGeometry } from './pile-geometry-engine.js';
import { splitBoreholeInterval, findLayerAtDepth } from './borehole-engine.js';
import { lookupRockKs10304, lookupTable6GammaRf10304, lookupTable7Alphas10304, lookupTable8Qb10304, lookupSptTipResistance10304, lookupSptShaftResistance10304, sptEta10304, sptTipWindow10304, averageMeasuredSptN10304 } from './tcvn10304-table-engine.js';
// HNL deterministic engineering workflows.
// Numerical automation is restricted to data/formulas transcribed from the user-provided standards.
// Every returned lookup keeps provenance and distinguishes AUTO/VERIFIED from MANUAL overrides.

export const TCVN10304_QB_DEPTHS = [3,4,5,7,10,15,20,25,30,35,40];
export const TCVN10304_QB = {
  sand_gravelly: [7500,8300,8800,9700,10500,11700,12600,13400,14200,15000,15800],
  sand_coarse:   [6600,6800,7000,7300,7700,8200,8500,9000,9500,10000,10500],
  sand_medium:   [3100,3200,3400,3700,4000,4400,4800,5200,5600,6000,6400],
  sand_fine:     [2000,2100,2200,2400,2600,2900,3200,3500,3800,4100,4400],
  sand_silty:    [1100,1250,1300,1400,1500,1650,1800,1950,2100,2250,2400],
  clay_0_0:      [7500,8300,8800,9700,10500,11700,12600,13400,14200,15000,15800],
  clay_0_1:      [4000,5100,6200,6900,7300,7500,8500,9000,9500,10000,10500],
  clay_0_2:      [3000,3800,4000,4300,5000,5600,6200,6800,7400,8000,8600],
  clay_0_3:      [2000,2500,2800,3300,3500,4000,4500,5200,5600,6000,6400],
  clay_0_4:      [1200,1600,2000,2200,2400,2900,3200,3500,3800,4100,4400],
  clay_0_5:      [1100,1250,1300,1400,1500,1650,1800,1950,2100,2250,2400],
  clay_0_6:      [600,700,800,850,900,1000,1100,1200,1300,1400,1500]
};

export const TCVN10304_FI_DEPTHS = [1,2,3,4,5,6,8,10,15,20,25,30,35,40];
export const TCVN10304_FI = {
  sand_coarse_medium: [35,42,48,53,56,58,62,65,72,79,86,93,100,107],
  sand_fine:          [23,30,35,38,40,42,44,46,51,56,61,66,70,74],
  sand_silty:         [15,21,25,27,29,31,33,34,38,41,44,47,50,53],
  clay_0_2:           [35,42,48,53,56,58,62,65,72,79,86,93,100,107],
  clay_0_3:           [23,30,35,38,40,42,44,46,51,56,61,66,70,74],
  clay_0_4:           [15,21,25,27,29,31,33,34,38,41,44,47,50,53],
  clay_0_5:           [12,17,20,22,24,25,26,27,28,30,32,34,36,38],
  clay_0_6:           [8,12,14,16,17,18,19,19,20,20,20,21,22,23],
  clay_0_7:           [4,7,8,9,10,10,10,10,11,12,12,12,13,14],
  clay_0_8:           [4,5,7,8,8,8,8,8,8,8,8,9,9,9],
  clay_0_9:           [3,4,6,7,7,7,7,7,7,7,7,8,8,8],
  clay_1_0:           [2,4,5,5,6,6,6,6,6,6,6,7,7,7]
};

const PROV_QB = { standard:'TCVN 10304:2025', edition:2025, clause:'7.2.2.1', table:'Bảng 2', standardPage:'32-33', pdfPage:'32-33', status:'VERIFIED', unit:'kPa' };
const PROV_FI = { standard:'TCVN 10304:2025', edition:2025, clause:'7.2.2.1', table:'Bảng 3', standardPage:'33-34', pdfPage:'33-34', status:'VERIFIED', unit:'kPa' };
const PROV_GAMMA = { standard:'TCVN 10304:2025', edition:2025, clause:'7.2.2.1', table:'Bảng 4', standardPage:'34-35', pdfPage:'34-35', status:'VERIFIED', unit:'-' };
const PROV_RK = { standard:'TCVN 10304:2025', edition:2025, clause:'7.2.2.1', formula:'(9)', standardPage:31, pdfPage:31, status:'VERIFIED', unit:'kN' };

function num(v){ if(v===null||v===undefined||String(v).trim()==='') return null; const n=Number(v); return Number.isFinite(n)?n:null; }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function axisGrid(map, keys, depths){
  return depths.map((_,i)=>keys.map(([,k])=>map[k][i]));
}
function interpolationNote(r){
  const parts=[`mode=${r.mode}`];
  if(r.xBracket) parts.push(`z:[${r.xBracket.x1};${r.xBracket.x2}], t=${Number(r.xBracket.t||0).toFixed(4)}`);
  else if(r.x1!=null) parts.push(`x:[${r.x1};${r.x2}], t=${Number(r.t||0).toFixed(4)}`);
  if(r.yBracket) parts.push(`IL:[${r.yBracket.y1};${r.yBracket.y2}], t=${Number(r.yBracket.t||0).toFixed(4)}`);
  return parts.join(' · ');
}

export function lookupQb10304({ depthM, soilGroup='clay', sandType='', IL=null, override=null }) {
  if(num(override)!=null) return { value:Number(override), provenance:{...PROV_QB,status:'MANUAL',note:'Giá trị người dùng nhập tay; không ghi là tra Bảng 2.'} };
  const z=num(depthM); if(z==null||z<=0) throw new Error('Chiều sâu mũi cọc phải > 0 m.');
  let r;
  if(soilGroup==='sand') {
    const key={gravelly:'sand_gravelly',coarse:'sand_coarse',medium:'sand_medium',fine:'sand_fine',silty:'sand_silty'}[sandType];
    if(!key) throw new Error('Thiếu loại cát ở lớp mũi (gravelly/coarse/medium/fine/silty).');
    r=linear1DStrict({x:z,xs:TCVN10304_QB_DEPTHS,ys:TCVN10304_QB[key],high:'plateau',label:'TCVN 10304 Bảng 2 q_b'});
  } else {
    const il=num(IL); if(il==null) throw new Error('Đất dính ở mũi cọc cần chỉ số chảy IL để tra Bảng 2.');
    const keys=[[0,'clay_0_0'],[0.1,'clay_0_1'],[0.2,'clay_0_2'],[0.3,'clay_0_3'],[0.4,'clay_0_4'],[0.5,'clay_0_5'],[0.6,'clay_0_6']];
    const grid=axisGrid(TCVN10304_QB,keys,TCVN10304_QB_DEPTHS);
    r=bilinear2DStrict({x:z,y:il,xs:TCVN10304_QB_DEPTHS,ys:keys.map(x=>x[0]),grid,highX:'plateau',label:'TCVN 10304 Bảng 2 q_b'});
  }
  return { value:r.value, interpolation:r, provenance:{...PROV_QB, interpolation:r.mode, note:interpolationNote(r)} };
}

export function lookupFi10304({ avgDepthM, soilGroup='clay', sandType='', IL=null, override=null }) {
  if(num(override)!=null) return { value:Number(override), provenance:{...PROV_FI,status:'MANUAL',note:'Giá trị người dùng nhập tay; không ghi là tra Bảng 3.'} };
  const z=num(avgDepthM); if(z==null||z<=0) throw new Error('Chiều sâu trung bình lớp đất phải > 0 m.');
  let r;
  if(soilGroup==='sand') {
    const key={gravelly:'sand_coarse_medium',coarse:'sand_coarse_medium',medium:'sand_coarse_medium',fine:'sand_fine',silty:'sand_silty'}[sandType];
    if(!key) throw new Error('Thiếu loại cát để tra Bảng 3.');
    r=linear1DStrict({x:z,xs:TCVN10304_FI_DEPTHS,ys:TCVN10304_FI[key],label:'TCVN 10304 Bảng 3 f_i'});
  } else {
    const il=num(IL); if(il==null) throw new Error('Đất dính cần chỉ số chảy IL để tra Bảng 3.');
    const keys=[[0.2,'clay_0_2'],[0.3,'clay_0_3'],[0.4,'clay_0_4'],[0.5,'clay_0_5'],[0.6,'clay_0_6'],[0.7,'clay_0_7'],[0.8,'clay_0_8'],[0.9,'clay_0_9'],[1.0,'clay_1_0']];
    const grid=axisGrid(TCVN10304_FI,keys,TCVN10304_FI_DEPTHS);
    r=bilinear2DStrict({x:z,y:il,xs:TCVN10304_FI_DEPTHS,ys:keys.map(x=>x[0]),grid,lowY:'plateau',label:'TCVN 10304 Bảng 3 f_i'});
  }
  return { value:r.value, interpolation:r, provenance:{...PROV_FI, interpolation:r.mode, note:interpolationNote(r)} };
}

export function workFactors10304({ method='hammer', soilGroup='clay', sandType='', IL=null, gammaRR=null, gammaRf=null }) {
  const rr=num(gammaRR), rf=num(gammaRf);
  if(rr!=null||rf!=null) return { gammaRR:rr??1, gammaRf:rf??1, provenance:{...PROV_GAMMA,status:'MANUAL',note:'Có override hệ số người dùng nhập tay.'} };
  if(method==='hammer') return {gammaRR:1.0,gammaRf:1.0,provenance:{...PROV_GAMMA,row:'1 · hạ bằng búa cơ khí/hơi/diesel'}};
  if(method==='press') {
    if(soilGroup==='sand') return sandType==='silty'
      ? {gammaRR:1.1,gammaRf:0.8,provenance:{...PROV_GAMMA,row:'7b · ép vào cát bụi'}}
      : {gammaRR:1.1,gammaRf:1.0,provenance:{...PROV_GAMMA,row:'7a · ép vào cát thô/vừa/mịn'}};
    const il=num(IL); if(il==null) throw new Error('Cọc ép vào đất dính cần IL để chọn hệ số Bảng 4.');
    return il<0.5 ? {gammaRR:1.1,gammaRf:1.0,provenance:{...PROV_GAMMA,row:'7c · đất loại sét IL<0,5'}} : {gammaRR:1.0,gammaRf:1.0,provenance:{...PROV_GAMMA,row:'7d · đất loại sét IL≥0,5'}};
  }
  throw new Error('Workflow tự động hiện Verified cho phương pháp hammer hoặc press. Phương pháp khác dùng REVIEW/nhập hệ số thủ công sau khi đối chiếu Bảng 4.');
}

export function squarePileGeometry(sideM,options={}){
  return calculatePileGeometry({shape:'square',sideM,...options});
}
export function circularPileGeometry(diameterM,options={}){
  return calculatePileGeometry({shape:'circle',diameterM,...options});
}

export function splitSoilLayers10304(layers=[], tipDepthM, maxSegmentM=2, shaftStartDepthM=0){
  const tip=num(tipDepthM); if(!(tip>0)) throw new Error('Độ sâu mũi phải >0 để chia phân đoạn Bảng 3.');
  const start=num(shaftStartDepthM)??0;
  if(start<0) throw new Error('Độ sâu bắt đầu tính ma sát hông không được âm.');
  if(start>=tip) return [];
  return splitBoreholeInterval(layers,{startDepthM:start,endDepthM:tip,maxSegmentM});
}

export function calculateDrivenPile10304(input={}) {
  const L=num(input.lengthM); if(L==null||L<=0) throw new Error('Chiều dài cọc phải > 0 m.');
  const geometry=input.shape==='circle'
    ? circularPileGeometry(input.diameterM,{tipInnerDiameterM:input.tipInnerDiameterM,massInnerDiameterM:input.massInnerDiameterM,lengthM:L,unitWeightKnM3:input.unitWeightKnM3})
    : squarePileGeometry(input.sideM,{tipInnerSideM:input.tipInnerSideM,massInnerSideM:input.massInnerSideM,lengthM:L,unitWeightKnM3:input.unitWeightKnM3});
  const layers=(input.layers||[]).map((raw,index)=>({index:index+1,top:num(raw.top),bottom:num(raw.bottom),soilGroup:raw.soilGroup||'clay',sandType:raw.sandType||'',IL:num(raw.IL),fiOverride:num(raw.fiOverride)}))
    .filter(x=>x.top!=null&&x.bottom!=null&&x.bottom>x.top).sort((a,b)=>a.top-b.top);
  if(!layers.length) return {ok:false,missing:['Cần địa chất theo lớp: cao độ/độ sâu từ–đến và IL cho đất dính (hoặc loại cát cho đất rời).'],geometry,steps:[],provenance:PROV_RK};
  const tipDepth=num(input.tipDepthM)??L;
  const tip=layers.find(x=>tipDepth>=x.top-1e-9&&tipDepth<=x.bottom+1e-9);
  if(!tip) return {ok:false,missing:[`Không có lớp địa chất chứa mũi cọc tại z=${tipDepth} m.`],geometry,steps:[],provenance:PROV_RK};
  const missing=[];
  for(const layer of layers) if(layer.soilGroup!=='sand'&&layer.IL==null&&layer.fiOverride==null) missing.push(`Lớp ${layer.index}: thiếu IL để tra f_i Bảng 3.`);
  if(tip.soilGroup!=='sand'&&tip.IL==null&&num(input.qbOverride)==null) missing.push(`Lớp mũi ${tip.index}: thiếu IL để tra q_b Bảng 2.`);
  if(missing.length) return {ok:false,missing,geometry,tipLayer:tip,steps:[],provenance:PROV_RK};

  const qb=lookupQb10304({depthM:tipDepth,soilGroup:tip.soilGroup,sandType:tip.sandType,IL:tip.IL,override:input.qbOverride});
  const tipFactors=workFactors10304({method:input.method||'hammer',soilGroup:tip.soilGroup,sandType:tip.sandType,IL:tip.IL,gammaRR:input.gammaRR});
  const tipResistanceKn=tipFactors.gammaRR*qb.value*geometry.areaM2;
  const segmentResults=[];
  const shaftStartDepthM=num(input.shaftStartDepthM)??0;
  const maxSegmentM=num(input.maxSegmentM)??2;
  if(!(maxSegmentM>0&&maxSegmentM<=2)) return {ok:false,missing:['Phân đoạn ma sát hông phải có 0 < maxSegmentM ≤ 2 m.'],geometry,tipLayer:tip,steps:[],provenance:PROV_RK};
  const segments=splitSoilLayers10304(layers,tipDepth,maxSegmentM,shaftStartDepthM);
  for(const layer of segments){
    const fi=lookupFi10304({avgDepthM:layer.avgDepthM,soilGroup:layer.soilGroup,sandType:layer.sandType,IL:layer.IL,override:layer.fiOverride});
    const factor=workFactors10304({method:input.method||'hammer',soilGroup:layer.soilGroup,sandType:layer.sandType,IL:layer.IL,gammaRf:input.gammaRf});
    const resistanceKn=geometry.perimeterM*factor.gammaRf*fi.value*layer.hM;
    segmentResults.push({...layer,fiKpa:fi.value,gammaRf:factor.gammaRf,resistanceKn,fiProvenance:fi.provenance,factorProvenance:factor.provenance});
  }
  // Giữ API layerResults theo lớp gốc để không phá UI/history cũ; segmentResults là chi tiết Bảng 3 <=2 m.
  const layerResults=layers.map(layer=>{
    const parts=segmentResults.filter(x=>x.parentIndex===layer.index);
    const hM=parts.reduce((s,x)=>s+x.hM,0);
    const resistanceKn=parts.reduce((s,x)=>s+x.resistanceKn,0);
    const fiWeighted=hM?parts.reduce((s,x)=>s+x.fiKpa*x.hM,0)/hM:0;
    const gammaWeighted=hM?parts.reduce((s,x)=>s+x.gammaRf*x.hM,0)/hM:0;
    const manual=parts.some(x=>x.fiProvenance?.status==='MANUAL'||x.factorProvenance?.status==='MANUAL');
    return {...layer,hM,avgDepthM:hM?parts.reduce((s,x)=>s+x.avgDepthM*x.hM,0)/hM:(layer.top+layer.bottom)/2,fiKpa:fiWeighted,gammaRf:gammaWeighted,resistanceKn,segmentCount:parts.length,fiProvenance:{...PROV_FI,status:manual?'MANUAL':'VERIFIED',note:`Tổng hợp ${parts.length} phân đoạn ≤2 m; xem segmentResults để audit từng đoạn.`}};
  });
  const sideResistanceKn=segmentResults.reduce((s,x)=>s+x.resistanceKn,0);
  const gammaC=num(input.gammaC)??1.0;
  const RkKn=gammaC*(tipResistanceKn+sideResistanceKn);
  const reliability=num(input.gammaK);
  const RdKn=reliability&&reliability>0 ? RkKn/reliability : null;
  const gammaN=num(input.gammaN);
  const NdMaxKn=RdKn!=null&&gammaN&&gammaN>0 ? RdKn/gammaN : null;
  const manual=qb.provenance.status==='MANUAL'||tipFactors.provenance.status==='MANUAL'||segmentResults.some(x=>x.fiProvenance.status==='MANUAL'||x.factorProvenance.status==='MANUAL');
  return {ok:true,geometry,tipDepthM:tipDepth,shaftStartDepthM,maxSegmentM,tipLayer:tip,qbKpa:qb.value,gammaRR:tipFactors.gammaRR,tipResistanceKn,layerResults,segmentResults,sideResistanceKn,gammaC,RkKn,gammaK:reliability,RdKn,gammaN,NdMaxKn,status:manual?'MIXED/MANUAL':'VERIFIED',provenance:PROV_RK,qbProvenance:qb.provenance,tipFactorProvenance:tipFactors.provenance};
}

export function missingDataForPileQuestion(question=''){
  const q=String(question).toLocaleLowerCase('vi');
  const looksPile=/c[oọ]c/.test(q)&&/(sức chịu tải|tính|chịu tải)/.test(q);
  if(!looksPile) return [];
  const missing=[];
  if(/đất dính/.test(q)&&!/\bil\s*[=:]?\s*\d/i.test(q)) missing.push('Đất dính: cần chỉ số chảy IL theo từng lớp để tra Bảng 2/Bảng 3.');
  if(!/(lớp|0\s*[-–]\s*\d|từ\s*\d|đến\s*\d)/i.test(question)) missing.push('Cần phân lớp địa chất và chiều sâu từng lớp dọc thân cọc.');
  return missing;
}

export function engineeringQuestionContext(question='') {
  const q=String(question||'');
  const norm=q.toLocaleLowerCase('vi');
  if(!/c[oọ]c/.test(norm)||!/(sức chịu tải|tính|chịu tải)/.test(norm)) return '';
  const lengthMatch=norm.match(/(?:dài|l\s*=?)\s*(\d+(?:[.,]\d+)?)\s*m\b/i);
  const sideMatch=norm.match(/(?:cạnh|a\s*=?)\s*(\d+(?:[.,]\d+)?)\s*m\b/i);
  const L=lengthMatch?Number(lengthMatch[1].replace(',','.')):null;
  const a=sideMatch?Number(sideMatch[1].replace(',','.')):null;
  const lines=['HNL ENGINEERING GUARDRAIL · TCVN 10304:2025:'];
  if(a&&a>0){ const g=squarePileGeometry(a); lines.push(`- Hình học xác định được: cọc vuông a=${a} m → A=${g.areaM2.toFixed(4)} m²; u=${g.perimeterM.toFixed(4)} m.`); }
  if(L&&L>0) lines.push(`- Chiều dài/độ sâu mũi cọc theo đề bài: ${L} m (chỉ dùng như độ sâu mũi nếu cao độ đầu cọc và mặt đất quy ước không làm thay đổi).`);
  if(/đ[oó]ng/.test(norm)) lines.push('- Phương pháp: cọc đóng/hạ không moi đất → workflow 7.2.2.1, công thức (9), Bảng 2 + Bảng 3 + Bảng 4.');
  const missing=missingDataForPileQuestion(q); if(missing.length) lines.push(...missing.map(x=>`- THIẾU DỮ LIỆU: ${x}`));
  lines.push('- Nếu thiếu địa chất thì KHÔNG được bịa qb/fi và KHÔNG được nói các bảng không có: Bảng 2 ở trang 32–33, Bảng 3 ở trang 33–34, Bảng 4 ở trang 34–35 đã được nạp Code Pack.');
  lines.push('- Khi đủ dữ liệu phải diễn giải từng lớp: h_i, z_tb, f_i, γRf, Rfi; lớp mũi: qb, γRR, Rb; sau đó tổng theo công thức (9).');
  return lines.join('\n');
}


const PROV_ROCK = {standard:'TCVN 10304:2025',edition:2025,clause:'7.2.1',formula:'(5)–(8)',table:'Bảng 1',standardPage:'28-30',pdfPage:'28-30',status:'VERIFIED',unit:'kN'};
const PROV_BORED = {standard:'TCVN 10304:2025',edition:2025,clause:'7.2.3',formula:'(13)–(15)',tables:'Bảng 3, 6, 7, 8; cap Bảng 2',standardPage:'37-42',pdfPage:'37-42',status:'VERIFIED',unit:'kN'};
const PROV_SPT = {standard:'TCVN 10304:2025',edition:2025,clause:'Phụ lục D',formula:'D.1–D.6',table:'Bảng D.1',standardPage:'110-111',pdfPage:'110-111',status:'VERIFIED',unit:'kN'};

function geometryFromInput(input={}){
  const L=num(input.lengthM)??(num(input.tipDepthM)!=null&&num(input.headDepthM)!=null?Math.abs(num(input.tipDepthM)-num(input.headDepthM)):null);
  if(input.shape==='circle'||num(input.diameterM)!=null) return calculatePileGeometry({shape:'circle',diameterM:input.diameterM,lengthM:L,tipInnerDiameterM:input.tipInnerDiameterM,massInnerDiameterM:input.massInnerDiameterM});
  if(input.shape==='square'||num(input.sideM)!=null) return calculatePileGeometry({shape:'square',sideM:input.sideM,lengthM:L,tipInnerSideM:input.tipInnerSideM,massInnerSideM:input.massInnerSideM});
  const area=num(input.areaM2),perimeter=num(input.perimeterM);
  return {areaM2:area,tipAreaM2:area,perimeterM:perimeter,lengthM:L,diameterM:num(input.diameterM),sideM:num(input.sideM),verification:{status:'INPUT'}};
}
function normalizeGeoLayers10304(layers=[]){
  return (layers||[]).map((raw,index)=>({
    ...raw,index:Number(raw.index)||index+1,top:num(raw.top),bottom:num(raw.bottom),
    soilGroup:raw.soilGroup||'clay',sandType:raw.sandType||'',soilClass:raw.soilClass||(raw.soilGroup==='sand'?'sand':'clay'),
    IL:num(raw.IL),fiOverride:num(raw.fiOverride),phiDeg:num(raw.phiDeg),gammaKnM3:num(raw.gammaKnM3),gammaEffectiveKnM3:num(raw.gammaEffectiveKnM3),
    sptN:num(raw.sptN),cuKpa:num(raw.cuKpa),Sr:num(raw.Sr)
  })).filter(x=>x.top!=null&&x.bottom!=null&&x.bottom>x.top).sort((a,b)=>a.top-b.top);
}
function weightedGammaAboveTip(layers,tipDepthM){
  let sum=0,h=0;
  for(const l of layers){const a=Math.max(0,l.top),b=Math.min(tipDepthM,l.bottom);if(b<=a)continue;const g=num(l.gammaKnM3);if(g==null)return null;sum+=g*(b-a);h+=b-a;}
  return h>0?sum/h:null;
}
function boredGammaRR10304(input={}){
  const manual=num(input.gammaRR); if(manual!=null) return {value:manual,mode:'MANUAL'};
  const mode=String(input.tipConstruction||'general');
  const map={general:1,'blasted-enlarged':1.3,'jet-grout-pdt':1.3,'mechanical-enlarged-dry':.5,'mechanical-enlarged-underwater':.3,'dry-inspected':1,'wash-inspected':.9};
  if(map[mode]==null) throw new Error('7.2.3: chưa xác định γR,R theo phương pháp tạo mũi.');
  return {value:map[mode],mode:'DISCRETE',provenance:'TCVN 10304:2025 · 7.2.3.1 · trang 37–38'};
}

/** TCVN 10304:2025 §7.2.1, CT (5)–(8), Bảng 1. Preliminary rock branch. */
export function calculateRockEndBearing10304(input={}){
  const geometry=geometryFromInput(input); const A=num(input.areaM2)??num(geometry.tipAreaM2)??num(geometry.areaM2);
  const RcN=num(input.rockCompressiveStrengthKpa),rqd=num(input.rqdPercent),gammaG=num(input.gammaG)??1.4,Ld=num(input.embedmentLengthM)??0;
  const df=num(input.embeddedOuterDiameterM)??num(input.diameterM)??num(input.sideM);
  const missing=[]; if(!(A>0))missing.push('A diện tích mũi cọc (m²)');if(!(RcN>0))missing.push('Rc,n cường độ nén một trục mẫu đá (kPa)');if(rqd==null)missing.push('RQD (%)');if(!(gammaG>0))missing.push('γg');if(Ld>=.5&&!(df>0))missing.push('d_f đường kính ngoài phần cọc ngàm đá (m)');
  if(missing.length)return {ok:false,missing,geometry,provenance:PROV_ROCK};
  let ks; try{ks=lookupRockKs10304(rqd);}catch(e){return {ok:false,missing:[e.message],geometry,provenance:PROV_ROCK};}
  const RmKpa=RcN*ks.value/gammaG; const embedmentFactor=Ld<.5?1:Math.min(1+.4*Ld/df,3); const qbBeforeCapKpa=RmKpa*embedmentFactor; let qbKpa=Math.min(qbBeforeCapKpa,20000);
  const floor=num(input.minimumQbKpa); if(floor!=null) qbKpa=Math.max(qbKpa,floor);
  const RkKn=qbKpa*A; const gammaK=num(input.gammaK),RdKn=gammaK&&gammaK>0?RkKn/gammaK:null; const gammaN=num(input.gammaN),NdMaxKn=RdKn!=null&&gammaN&&gammaN>0?RdKn/gammaN:null;
  const warnings=[]; if(floor==null) warnings.push('CT (7)/(8) còn quy định q_b không nhỏ hơn sức kháng nền hạt thô pha cát với φI=32° theo 7.2.3.2; chưa có minimumQbKpa nên kết quả được gắn VERIFIED_PRELIMINARY, không phải thiết kế cuối.');
  if(input.rockWeathered===true) warnings.push('Đá phong hóa/mềm hóa: Rm cần xác định theo thí nghiệm nén tĩnh/plate-load phù hợp; không dùng nhánh RQD này làm giá trị thiết kế cuối.');
  if(['C2','C3'].includes(String(input.consequenceClass||'').toUpperCase())) warnings.push('Công trình C2/C3 trong điều kiện tiêu chuẩn nêu phải kiểm chứng sức chịu tải bằng thí nghiệm nén tĩnh.');
  return {ok:true,status:floor==null?'VERIFIED_PRELIMINARY':'VERIFIED',designFinal:floor!=null,geometry,inputs:{A,RcN,rqd,gammaG,Ld,df,minimumQbKpa:floor},Ks:ks.value,KsLookup:ks,RmKpa,embedmentFactor,qbBeforeCapKpa,qbKpa,RkKn,gammaK,RdKn,gammaN,NdMaxKn,warnings,steps:[`Bảng 1: RQD=${rqd}% → Ks=${ks.value.toFixed(6)} (${ks.mode}).`,`CT (7): Rm=Rc,n·Ks/γg=${RmKpa.toFixed(3)} kPa.`,Ld<.5?`Ld<0,5 m → q_b=Rm trước giới hạn.`:`CT (8): hệ số ngàm=min(1+0,4Ld/df;3)=${embedmentFactor.toFixed(4)}.`,`q_b=min(${qbBeforeCapKpa.toFixed(3)};20000)${floor!=null?` và ≥${floor}`:''}=${qbKpa.toFixed(3)} kPa.`,`CT (5)–(6), γc=1: Rk=q_b·A=${RkKn.toFixed(3)} kN.`],provenance:PROV_ROCK};
}

/** TCVN 10304:2025 §7.2.3 layer-by-layer bored/drilled pile. */
export function calculateBoredPile10304(input={}){
  const geometry=geometryFromInput(input),A=num(input.areaM2)??num(geometry.tipAreaM2)??num(geometry.areaM2),u=num(input.perimeterM)??num(geometry.perimeterM);
  const tipDepth=num(input.tipDepthM)??num(input.lengthM),shaftStart=num(input.shaftStartDepthM)??0,maxSegment=num(input.maxSegmentM)??2,layers=normalizeGeoLayers10304(input.layers);
  const missing=[];if(!(A>0))missing.push('A diện tích mũi (m²)');if(!(u>0))missing.push('u chu vi thân (m)');if(!(tipDepth>0))missing.push('độ sâu mũi');if(!layers.length)missing.push('địa chất theo lớp');if(!(maxSegment>0&&maxSegment<=2))missing.push('0 < maxSegmentM ≤ 2 m');
  if(missing.length)return {ok:false,missing,geometry,provenance:PROV_BORED};
  const tip=findLayerAtDepth(layers,tipDepth,{boundaryPolicy:'deeper'})||findLayerAtDepth(layers,tipDepth,{boundaryPolicy:'shallower'});if(!tip)return {ok:false,missing:[`Không có lớp địa chất chứa mũi tại z=${tipDepth} m.`],geometry,provenance:PROV_BORED};
  const embedment=tipDepth-tip.top;if(embedment<2-1e-9)return {ok:false,missing:[`7.2.3.2: mũi cọc phải ngàm vào lớp chịu lực ít nhất 2 m; hiện ${embedment.toFixed(3)} m.`],tipLayer:tip,geometry,provenance:PROV_BORED};
  let qbLookup,qbKpa=num(input.qbOverride),qbCtKpa=null,qbCapKpa=null;
  try{
    if(qbKpa==null&&tip.soilGroup!=='sand'){if(tip.IL==null)throw new Error('Đất dính tại mũi cần IL để tra Bảng 8.');qbLookup=lookupTable8Qb10304({depthM:tipDepth,IL:tip.IL});qbKpa=qbLookup.value;}
    else if(qbKpa==null){
      const phi=num(input.tipPhiDeg)??tip.phiDeg,d=num(input.baseDiameterM)??num(input.diameterM)??num(input.sideM),gp=num(input.tipEffectiveGammaKnM3)??tip.gammaEffectiveKnM3??tip.gammaKnM3,g1=num(input.averageGammaAboveTipKnM3)??weightedGammaAboveTip(layers,tipDepth);
      if(phi==null||!(d>0)||gp==null||g1==null)throw new Error('Đất rời tại mũi cần φ, d, γ1′ và γ1 trung bình để tính CT (14)/(15).');
      const alpha=lookupTable7Alphas10304({phi,hdRatio:tipDepth/d,dM:d}); const coefficient=input.tipCoreRetained===true?1:.75; qbCtKpa=coefficient*alpha.alpha4*(alpha.alpha1*gp*d+alpha.alpha2*alpha.alpha3*g1*tipDepth);
      const cap=lookupQb10304({depthM:tipDepth,soilGroup:'sand',sandType:tip.sandType||'coarse'});qbCapKpa=cap.value;qbKpa=Math.min(qbCtKpa,qbCapKpa);qbLookup={mode:'CT14/15 + TABLE7 + TABLE2-CAP',alpha,raw:qbCtKpa,cap:qbCapKpa};
    }
  }catch(e){return {ok:false,missing:[e.message],tipLayer:tip,geometry,provenance:PROV_BORED};}
  let gammaRR;try{gammaRR=boredGammaRR10304(input);}catch(e){return {ok:false,missing:[e.message],tipLayer:tip,geometry,provenance:PROV_BORED};}
  const methodCaseId=input.methodCaseId||'bored-64a-64b',segments=shaftStart>=tipDepth?[]:splitBoreholeInterval(layers,{startDepthM:shaftStart,endDepthM:tipDepth,maxSegmentM:maxSegment}); const segmentResults=[];
  for(const seg of segments){
    // Expanded-base rule: sand resistance starts at least 1.5 d0 above the enlarged zone.
    if(input.enlargedTipDiameterM&&seg.soilGroup==='sand'){
      const cutoff=tipDepth-1.5*Number(input.enlargedTipDiameterM);if(seg.bottom>cutoff+1e-9) continue;
    }
    try{const fi=lookupFi10304({avgDepthM:seg.avgDepthM,soilGroup:seg.soilGroup,sandType:seg.sandType,IL:seg.IL,override:seg.fiOverride});const grf=lookupTable6GammaRf10304({caseId:methodCaseId,soil:seg.soilClass||seg.soilGroup});const resistanceKn=u*grf.value*fi.value*seg.hM;segmentResults.push({...seg,fiKpa:fi.value,gammaRf:grf.value,resistanceKn,fiProvenance:fi.provenance,gammaRfProvenance:grf.provenance});}catch(e){return {ok:false,missing:[`Lớp ${seg.parentIndex||seg.index}: ${e.message}`],tipLayer:tip,geometry,provenance:PROV_BORED};}
  }
  const gammaC=num(input.gammaC)??((tip.soilGroup!=='sand'&&tip.Sr!=null&&tip.Sr<.85)||input.loess===true?.8:1); const tipResistanceKn=gammaRR.value*qbKpa*A,sideResistanceKn=segmentResults.reduce((s,x)=>s+x.resistanceKn,0),RkKn=gammaC*(tipResistanceKn+sideResistanceKn); const gammaK=num(input.gammaK),RdKn=gammaK&&gammaK>0?RkKn/gammaK:null,gammaN=num(input.gammaN),NdMaxKn=RdKn!=null&&gammaN&&gammaN>0?RdKn/gammaN:null;
  return {ok:true,status:num(input.qbOverride)!=null||num(input.gammaRR)!=null?'MIXED/MANUAL':'VERIFIED',inputs:{...input,areaM2:A,perimeterM:u,tipDepthM:tipDepth,shaftStartDepthM:shaftStart,maxSegmentM:maxSegment,methodCaseId,qbKpa,gammaC,gammaRR:gammaRR.value},geometry,tipDepthM:tipDepth,shaftStartDepthM:shaftStart,maxSegmentM:maxSegment,tipLayer:tip,embedmentInBearingLayerM:embedment,qbKpa,qbCtKpa,qbCapKpa,qbLookup,gammaC,gammaRR:gammaRR.value,tipResistanceKn,segmentResults,sideResistanceKn,RkKn,gammaK,RdKn,gammaN,NdMaxKn,methodCaseId,steps:[`CT (13): Rk=γc[γR,R·qb·A + u·Σ(γR,f,i·fi·hi)].`,`Mũi: qb=${qbKpa.toFixed(3)} kPa; γR,R=${gammaRR.value}; Rb=${tipResistanceKn.toFixed(3)} kN.`,`Thân: ${segmentResults.length} phân đoạn ≤${maxSegment} m; Rf=${sideResistanceKn.toFixed(3)} kN.`,`Rk=${RkKn.toFixed(3)} kN.`],provenance:PROV_BORED};
}

function representativeNForLayer(points,layer){
  if(layer?.sptN!==null&&layer?.sptN!==undefined&&String(layer.sptN).trim()!==''&&Number.isFinite(Number(layer.sptN))) return {value:Number(layer.sptN),source:'REPORT-LAYER-REPRESENTATIVE',used:[]};
  // SPT PDF Decision Pass: shaft intervals are half-open [top,bottom), therefore
  // a test exactly on a geological boundary belongs to the deeper layer and is
  // never double-counted. Appendix D does not authorize synthetic N(z).
  const top=Number(layer?.top),bottom=Number(layer?.bottom),eps=1e-9;
  const used=(points||[]).map((p,i)=>({index:i+1,depthM:Number(p.depthM),N:Number(p.N)}))
    .filter(p=>Number.isFinite(p.depthM)&&Number.isFinite(p.N)&&p.N>=0&&p.depthM>=top-eps&&p.depthM<bottom-eps);
  if(!used.length)return {value:null,source:'MISSING-MEASURED-LAYER-N',used:[]};
  return {value:used.reduce((sum,p)=>sum+p.N,0)/used.length,source:'DERIVED-MEASURED-LAYER-MEAN',used};
}
/** Appendix D raw-profile SPT calculator. SPT PDF Decision Pass: no hidden continuous interpolation. */
export function calculateSptPile10304(input={}){
  const geometry=geometryFromInput(input),A=num(input.areaM2)??num(geometry.tipAreaM2)??num(geometry.areaM2),u=num(input.perimeterM)??num(geometry.perimeterM),tipDepth=num(input.tipDepthM)??num(input.lengthM),shaftStart=num(input.shaftStartDepthM)??0,pileType=input.pileType||'bored',layers=normalizeGeoLayers10304(input.layers),points=input.sptPoints||[];
  const d=num(input.diameterM)??num(input.sideM);const missing=[];if(!(A>0))missing.push('A diện tích mũi');if(!(u>0))missing.push('u chu vi');if(!(tipDepth>0))missing.push('độ sâu mũi');if(!(d>0))missing.push('đường kính/cạnh đặc trưng d');if(!layers.length)missing.push('địa chất theo lớp');if(missing.length)return {ok:false,missing,geometry,provenance:PROV_SPT};
  const tip=findLayerAtDepth(layers,tipDepth,{boundaryPolicy:'deeper'})||findLayerAtDepth(layers,tipDepth,{boundaryPolicy:'shallower'});if(!tip)return {ok:false,missing:[`Không có lớp chứa mũi tại ${tipDepth} m.`],geometry,provenance:PROV_SPT};
  let eta;try{eta=sptEta10304({pileType,closedTip:input.closedTip!==false,lengthM:num(input.lengthM),innerDiameterM:num(input.innerDiameterM),eta:input.eta});}catch(e){return {ok:false,missing:[e.message],geometry,provenance:PROV_SPT};}
  let tipN=null,tipNAudit=null,tipCu=tip.cuKpa;
  try{if(tip.soilGroup==='sand'||pileType==='screw'){const window=sptTipWindow10304({pileType,tipDepthM:tipDepth,diameterM:d});tipNAudit=averageMeasuredSptN10304(points,window);tipN=tipNAudit.value;}else if(tipCu==null&&tip.sptN!=null)tipCu=6.25*tip.sptN;}catch(e){return {ok:false,missing:[e.message],geometry,tipLayer:tip,provenance:PROV_SPT};}
  let qb;try{qb=lookupSptTipResistance10304({pileType,soilGroup:tip.soilGroup,N:tipN??tip.sptN,cuKpa:tipCu,eta:eta.value});}catch(e){return {ok:false,missing:[e.message],geometry,tipLayer:tip,provenance:PROV_SPT};}
  const clipped=layers.map(l=>({...l,top:Math.max(l.top,shaftStart),bottom:Math.min(l.bottom,tipDepth)})).filter(l=>l.bottom>l.top+1e-12); const segmentResults=[];
  for(const l of clipped){
    const nRep=representativeNForLayer(points,l),N=nRep.value;let r;
    try{r=lookupSptShaftResistance10304({pileType,soilGroup:l.soilGroup,N,cuKpa:l.cuKpa});}
    catch(e){return {ok:false,missing:[`Lớp ${l.index}: ${e.message}`],geometry,tipLayer:tip,sptDataPolicy:{decision:'PDF-DECISION-LOCKED',continuousInterpolation:false},provenance:PROV_SPT};}
    const hM=l.bottom-l.top,resistanceKn=r.value*hM*u;
    segmentResults.push({...l,hM,NUsed:N,NSource:nRep.source,NMeasuredPoints:nRep.used,unitResistanceKpa:r.value,resistanceKn,lookup:r});
  }
  const RubKn=qb.value*A,RufKn=segmentResults.reduce((s,x)=>s+x.resistanceKn,0),RkKn=RubKn+RufKn,gammaK=num(input.gammaK),RdKn=gammaK&&gammaK>0?RkKn/gammaK:null,gammaN=num(input.gammaN),NdMaxKn=RdKn!=null&&gammaN&&gammaN>0?RdKn/gammaN:null;
  const sptDataPolicy={
    decision:'PDF-DECISION-LOCKED',
    normativeSource:'TCVN 10304:2025 · Phụ lục D · D.1–D.6 · Bảng D.1 · trang 110–111',
    tipN:'MEASURED-WINDOW-ARITHMETIC-MEAN; CAP-100',
    shaftN:'REPORT-LAYER-REPRESENTATIVE / DERIVED-MEASURED-LAYER-MEAN',
    shaftBoundary:'HALF-OPEN [top,bottom); boundary point → deeper layer',
    continuousInterpolation:false,
    dceNoiSuySPT:'REFERENCE-ONLY',
    dceRightEndIntegration:'REFERENCE-ONLY',
    partitionedD56:true,
    partitionNote:'HNL áp dụng D.5/D.6 theo từng lớp địa chất đồng nhất rồi cộng; đây là phép phân hoạch deterministic, không phải công thức mới của TCVN.'
  };
  return {ok:true,status:'VERIFIED',inputs:{...input,areaM2:A,perimeterM:u,tipDepthM:tipDepth,shaftStartDepthM:shaftStart,pileType,eta:eta.value},geometry,pileType,eta:eta.value,tipDepthM:tipDepth,shaftStartDepthM:shaftStart,tipLayer:tip,tipN,tipNAudit,qbKpa:qb.value,qbLookup:qb,RubKn,segmentResults,RufKn,RkKn,gammaK,RdKn,gammaN,NdMaxKn,noInterpolationPolicy:true,sptDataPolicy,steps:[`Phụ lục D/Bảng D.1: N mũi là trung bình số học các điểm SPT đo thực trong cửa sổ quy định, giới hạn N≤100; không sinh điểm bằng nội suy.`,`Bảng D.1: qb=${qb.value.toFixed(3)} kPa; Ru,b=${RubKn.toFixed(3)} kN.`,`D.5–D.6: HNL phân hoạch theo từng lớp địa chất; Ns/Nc của lớp lấy từ giá trị đại diện có provenance hoặc trung bình điểm đo thực trong [top,bottom), không nội suy theo z; Ru,f=${RufKn.toFixed(3)} kN.`,`D.1–D.2: Rk=Ru=${RkKn.toFixed(3)} kN.`],provenance:PROV_SPT};
}
