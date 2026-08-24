import { linear1DStrict, bilinear2DStrict } from './interpolation-engine.js';
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
    const key={coarse:'sand_coarse_medium',medium:'sand_coarse_medium',fine:'sand_fine',silty:'sand_silty'}[sandType];
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

export function squarePileGeometry(sideM){ const a=num(sideM); if(a==null||a<=0) throw new Error('Cạnh cọc vuông phải > 0 m.'); return { areaM2:a*a, perimeterM:4*a }; }
export function circularPileGeometry(diameterM){ const d=num(diameterM); if(d==null||d<=0) throw new Error('Đường kính cọc phải > 0 m.'); return { areaM2:Math.PI*d*d/4, perimeterM:Math.PI*d }; }

export function splitSoilLayers10304(layers=[], tipDepthM, maxSegmentM=2){
  const tip=num(tipDepthM); if(!(tip>0)) throw new Error('Độ sâu mũi phải >0 để chia phân đoạn Bảng 3.');
  const out=[];
  for(const layer of layers){
    const top=Math.max(0,num(layer.top)??0), bottom=Math.min(tip,num(layer.bottom)??top);
    if(!(bottom>top)) continue;
    let z=top, seg=1;
    while(z<bottom-1e-9){
      const z2=Math.min(bottom,z+maxSegmentM);
      out.push({...layer,parentIndex:layer.index,segmentIndex:seg,top:z,bottom:z2,hM:z2-z,avgDepthM:(z+z2)/2});
      z=z2; seg++;
    }
  }
  return out;
}

export function calculateDrivenPile10304(input={}) {
  const L=num(input.lengthM); if(L==null||L<=0) throw new Error('Chiều dài cọc phải > 0 m.');
  const geometry=input.shape==='circle' ? circularPileGeometry(input.diameterM) : squarePileGeometry(input.sideM);
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
  const segments=splitSoilLayers10304(layers,tipDepth,2);
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
  const manual=qb.provenance.status==='MANUAL'||tipFactors.provenance.status==='MANUAL'||segmentResults.some(x=>x.fiProvenance.status==='MANUAL'||x.factorProvenance.status==='MANUAL');
  return {ok:true,geometry,tipDepthM:tipDepth,tipLayer:tip,qbKpa:qb.value,gammaRR:tipFactors.gammaRR,tipResistanceKn,layerResults,segmentResults,sideResistanceKn,gammaC,RkKn,gammaK:reliability,RdKn,status:manual?'MIXED/MANUAL':'VERIFIED',provenance:PROV_RK,qbProvenance:qb.provenance,tipFactorProvenance:tipFactors.provenance};
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
