// HNL v1.25.3 — TCVN 10304:2025 table policies verified against project PDF.
// Only policies explicitly supported by table notes are automated.
import { linear1DStrict, bilinear2DStrict, exactOrEdgeBand } from './interpolation-engine.js';

export const T10304_INTERPOLATION_POLICIES = [
  {table:'Bảng 2',page:'32-33',mode:'LINEAR-1D / BILINEAR-2D',axes:'chiều sâu + IL',outside:'z<3: BLOCK; z>40: dùng hàng 40 theo Chú thích 1; IL ngoài 0,0–0,6: BLOCK',sourceNote:'Bảng 2 Chú thích 4; Chú thích 1'},
  {table:'Bảng 3',page:'33-34',mode:'LINEAR-1D / BILINEAR-2D',axes:'z trung bình + IL',outside:'z ngoài 1–40: BLOCK; IL≤0,2: cột ≤0,2; IL>1,0: BLOCK',sourceNote:'Bảng 2 Chú thích 4 + Bảng 3 Chú thích 2'},
  {table:'Bảng 4',page:'34-35',mode:'DISCRETE',axes:'phương pháp hạ cọc + loại/trạng thái đất',outside:'không nội suy',sourceNote:'Bảng phân loại rời rạc'},
  {table:'Bảng 6',page:'39',mode:'DISCRETE',axes:'phương pháp thi công + nhóm đất',outside:'không nội suy',sourceNote:'Bảng phân loại rời rạc'},
  {table:'Bảng 7',page:'41',mode:'LINEAR-1D / BILINEAR-2D',axes:'φ; h/d; d',outside:'φ ngoài 23–39: BLOCK; h/d<4: BLOCK; h/d≥25: hàng ≥25; d≤0,8: hàng ≤0,8; d>4: BLOCK',sourceNote:'Bảng 7 Chú thích 2'},
  {table:'Bảng 8',page:'41-42',mode:'BILINEAR-2D',axes:'chiều sâu + IL',outside:'z<3: BLOCK; z≥40: hàng ≥40; ô gạch ngang: BLOCK; IL ngoài 0–0,6: BLOCK',sourceNote:'Bảng 8 Chú thích 2'},
  {table:'Bảng 12',page:'54',mode:'DISCRETE',axes:'loại đất dưới mũi',outside:'không nội suy; cát chặt ở hàng 2–4 tăng 60%',sourceNote:'Bảng 12 Chú thích'},
  {table:'Bảng 15',page:'57',mode:'EXACT / EDGE-BAND',axes:'qs hoặc fs',outside:'không tự nội suy vì bảng không ghi phép nội suy; ≤mốc đầu và ≥mốc cuối chỉ dùng khi chính bảng ghi dấu ≤/≥',sourceNote:'Không có chú thích cho phép nội suy'},
  {table:'Bảng 16',page:'58',mode:'LINEAR-1D',axes:'qc',outside:'không nội suy qua ô “–”; không ngoại suy ngoài dải có số',sourceNote:'Bảng 16 Chú thích 1'},
  {table:'Bảng 17',page:'60',mode:'FORMULA + LINEAR-1D(mv)',axes:'ν',outside:'ν ngoài 0–0,5: BLOCK',sourceNote:'kv dùng CT (33), ζ0 dùng CT (34); mv chỉ có bảng'}
];

export const T10304_TABLE6 = [
  {caseId:'bored-64a-64b',label:'Cọc nhồi 6.4a/6.4b hoặc khoan mở rộng bằng tấm đá để lại/nút bê tông',sand:1.0,sandyClay:1.0,clayeySand:1.0,clay:0.9},
  {caseId:'vibro-bored',label:'Cọc nhồi ép rung',sand:0.9,sandyClay:0.9,clayeySand:0.9,clay:0.9},
  {caseId:'drilled-dry-cfa',label:'Cọc khoan khô / CFA',sand:0.7,sandyClay:0.7,clayeySand:0.7,clay:0.6},
  {caseId:'drilled-water-bentonite',label:'Cọc khoan dưới nước/bentonite',sand:0.6,sandyClay:0.6,clayeySand:0.6,clay:0.6},
  {caseId:'drilled-stiff-mix',label:'Hỗn hợp bê tông cứng + đầm sâu, khô',sand:0.8,sandyClay:0.8,clayeySand:0.8,clay:0.7},
  {caseId:'barrette',label:'Barrette 6.5c',sand:0.6,sandyClay:0.6,clayeySand:0.6,clay:0.6},
  {caseId:'vibro-pipe-excavated',label:'Cọc-ống rung có moi đất',sand:1.0,sandyClay:0.9,clayeySand:0.7,clay:0.6},
  {caseId:'pier',label:'Cọc-trụ',sand:0.7,sandyClay:0.7,clayeySand:0.7,clay:0.6},
  {caseId:'jet-grout-pressure',label:'Khoan phun ống vách/bentonite áp lực ≥200 kPa',sand:0.9,sandyClay:0.8,clayeySand:0.8,clay:0.8},
  {caseId:'jet-grout-pdt',label:'Khoan phun xung điện PDT',sand:1.3,sandyClay:1.3,clayeySand:1.1,clay:1.1}
];
export function lookupTable6GammaRf10304({caseId,soil='clay'}){
  const row=T10304_TABLE6.find(r=>r.caseId===caseId); if(!row) throw new Error('Bảng 6: cần chọn đúng phương pháp thi công.');
  const key={sand:'sand','cát':'sand',sandyClay:'sandyClay','cát pha':'sandyClay',clayeySand:'clayeySand','sét pha':'clayeySand',clay:'clay','sét':'clay'}[soil]||soil;
  const value=row[key]; if(value==null) throw new Error('Bảng 6: nhóm đất không hợp lệ.');
  return {value,mode:'DISCRETE',row:row.label,provenance:'TCVN 10304:2025 · Bảng 6 · trang 39'};
}

export const T10304_TABLE7_PHI=[23,25,27,29,31,33,35,37,39];
export const T10304_TABLE7_A1=[9.5,12.6,17.3,24.4,34.6,48.6,71.3,108.0,163.0];
export const T10304_TABLE7_A2=[18.6,24.8,32.8,45.5,64.0,87.6,127.0,185.0,260.0];
export const T10304_TABLE7_HD=[4,5,7.5,10,12.5,15,17.5,20,22.5,25];
export const T10304_TABLE7_A3=[
  [0.78,0.79,0.80,0.82,0.84,0.85,0.85,0.85,0.87],
  [0.75,0.76,0.77,0.79,0.81,0.82,0.83,0.84,0.85],
  [0.68,0.70,0.71,0.74,0.76,0.78,0.80,0.82,0.84],
  [0.62,0.65,0.67,0.70,0.73,0.75,0.77,0.79,0.81],
  [0.58,0.61,0.63,0.67,0.70,0.73,0.75,0.78,0.80],
  [0.55,0.58,0.61,0.65,0.68,0.71,0.73,0.76,0.79],
  [0.51,0.55,0.58,0.62,0.66,0.69,0.72,0.75,0.78],
  [0.49,0.53,0.57,0.61,0.65,0.68,0.72,0.75,0.78],
  [0.46,0.51,0.55,0.60,0.64,0.67,0.71,0.74,0.77],
  [0.44,0.49,0.54,0.59,0.63,0.67,0.70,0.74,0.77]
];
export const T10304_TABLE7_D=[0.8,4.0];
export const T10304_TABLE7_A4=[
  [0.34,0.31,0.29,0.27,0.26,0.25,0.24,0.23,0.22],
  [0.25,0.24,0.23,0.22,0.21,0.20,0.19,0.18,0.17]
];
export function lookupTable7Alphas10304({phi,hdRatio,dM}){
  const a1=linear1DStrict({x:phi,xs:T10304_TABLE7_PHI,ys:T10304_TABLE7_A1,label:'Bảng 7 α1'});
  const a2=linear1DStrict({x:phi,xs:T10304_TABLE7_PHI,ys:T10304_TABLE7_A2,label:'Bảng 7 α2'});
  const a3=bilinear2DStrict({x:hdRatio,y:phi,xs:T10304_TABLE7_HD,ys:T10304_TABLE7_PHI,grid:T10304_TABLE7_A3,highX:'plateau',label:'Bảng 7 α3'});
  const dForTable=Number(dM)<=0.8?0.8:Number(dM);
  const a4=bilinear2DStrict({x:dForTable,y:phi,xs:T10304_TABLE7_D,ys:T10304_TABLE7_PHI,grid:T10304_TABLE7_A4,lowX:'plateau',label:'Bảng 7 α4'});
  return {alpha1:a1.value,alpha2:a2.value,alpha3:a3.value,alpha4:a4.value,modes:{alpha1:a1.mode,alpha2:a2.mode,alpha3:a3.mode,alpha4:a4.mode},details:{a1,a2,a3,a4},provenance:'TCVN 10304:2025 · Bảng 7 · trang 41 · Chú thích 2'};
}

export const T10304_TABLE8_DEPTH=[3,5,7,10,12,15,18,20,30,40];
export const T10304_TABLE8_IL=[0,0.1,0.2,0.3,0.4,0.5,0.6];
export const T10304_TABLE8_QB=[
  [850,750,650,500,400,300,250],
  [1000,850,750,650,500,400,350],
  [1150,1000,850,750,600,500,450],
  [1350,1200,1050,950,800,700,600],
  [1550,1400,1250,1100,950,800,700],
  [1800,1650,1500,1300,1100,1000,800],
  [2100,1900,1700,1500,1300,1150,950],
  [2300,2100,1900,1650,1450,1250,1050],
  [3300,3000,2600,2300,2000,null,null],
  [4500,4000,3500,3000,2500,null,null]
];
export function lookupTable8Qb10304({depthM,IL}){
  const z=Number(depthM)>=40?40:Number(depthM);
  const r=bilinear2DStrict({x:z,y:IL,xs:T10304_TABLE8_DEPTH,ys:T10304_TABLE8_IL,grid:T10304_TABLE8_QB,highX:'plateau',label:'Bảng 8 qb'});
  return {...r,provenance:'TCVN 10304:2025 · Bảng 8 · trang 41-42 · Chú thích 2'};
}

export const T10304_TABLE12 = [
  {id:'gravel-sand',label:'Đất hòn lớn lẫn cát',M:1.3,denseBonus:false},
  {id:'medium-coarse',label:'Cát vừa, thô chặt vừa và cát pha cứng',M:1.2,denseBonus:true},
  {id:'fine',label:'Cát mịn chặt vừa',M:1.1,denseBonus:true},
  {id:'silty',label:'Cát bụi chặt vừa',M:1.0,denseBonus:true},
  {id:'soft-hard-clay',label:'Cát pha dẻo, sét pha và sét cứng',M:0.9,denseBonus:false},
  {id:'semi-hard',label:'Sét pha và sét nửa cứng',M:0.8,denseBonus:false},
  {id:'stiff-plastic',label:'Sét pha và sét dẻo cứng',M:0.7,denseBonus:false}
];
export function lookupTable12M10304({soilId,dense=false}){
  const row=T10304_TABLE12.find(r=>r.id===soilId); if(!row) throw new Error('Bảng 12: cần chọn đúng loại đất dưới mũi cọc.');
  const value=row.M*(dense&&row.denseBonus?1.6:1);
  return {value,mode:'DISCRETE',row:row.label,note:dense&&row.denseBonus?'Cát chặt: tăng 60% theo Chú thích Bảng 12.':'',provenance:'TCVN 10304:2025 · Bảng 12 · trang 54'};
}

const QS=[1000,2500,5000,7500,10000,15000,20000,30000];
const B1_DRIVEN=[0.90,0.80,0.65,0.55,0.45,0.35,0.30,0.20];
const B1_SCREW_C=[0.50,0.45,0.32,0.26,0.23,null,null,null];
const B1_SCREW_T=[0.40,0.38,0.27,0.22,0.19,null,null,null];
const FS=[20,40,60,80,100,120];
const B2_MECH_SAND=[2.40,1.65,1.20,1.00,0.85,0.75];
const B2_MECH_CLAY=[1.50,1.00,0.75,0.60,0.50,0.40];
const BI_ELEC_SAND=[0.75,0.60,0.55,0.50,0.45,0.40];
const BI_ELEC_CLAY=[1.00,0.75,0.60,0.45,0.40,0.30];
export function lookupTable15Beta1({qs,pile='driven',load='compression'}){
  const values=pile==='screw'?(load==='tension'?B1_SCREW_T:B1_SCREW_C):B1_DRIVEN;
  const r=exactOrEdgeBand({x:qs,points:QS,values,lowBand:true,highBand:pile==='driven',label:'Bảng 15 β1'});
  return {...r,provenance:'TCVN 10304:2025 · Bảng 15 · trang 57',policy:'NO-AUTO-INTERPOLATION'};
}
export function lookupTable15SideBeta({fs,probe='mechanical',soil='sand',saturatedSand=false}){
  const values=probe==='mechanical'?(soil==='clay'?B2_MECH_CLAY:B2_MECH_SAND):(soil==='clay'?BI_ELEC_CLAY:BI_ELEC_SAND);
  const r=exactOrEdgeBand({x:fs,points:FS,values,lowBand:true,highBand:true,label:`Bảng 15 ${probe==='mechanical'?'β2':'βi'}`});
  const factor=(probe!=='mechanical'&&soil==='sand'&&saturatedSand)?0.5:1;
  return {...r,value:r.value*factor,note:factor===0.5?'Cọc vít trong cát bão hòa: βi giảm 2 lần theo chú thích.':'',provenance:'TCVN 10304:2025 · Bảng 15 · trang 57',policy:'NO-AUTO-INTERPOLATION'};
}

export const T10304_TABLE16_QC=[1000,2500,5000,7500,10000,12000,15000,20000];
export const T10304_TABLE16={
  qbSand:[null,null,900,1100,1300,1400,1500,2000],
  qbClay:[200,580,900,1200,1400,null,null,null],
  fiSand:[null,null,30,40,50,60,70,70],
  fiClay:[15,25,35,45,60,null,null,null]
};
export function lookupTable16Cpt10304({qc,soil='sand',component='qb'}){
  const key=`${component}${soil==='clay'?'Clay':'Sand'}`;
  const r=linear1DStrict({x:qc,xs:T10304_TABLE16_QC,ys:T10304_TABLE16[key],low:'error',high:'error',label:`Bảng 16 ${key}`});
  return {...r,provenance:'TCVN 10304:2025 · Bảng 16 · trang 58 · Chú thích 1'};
}

export const T10304_TABLE17_V=[0,0.05,0.10,0.15,0.20,0.25,0.30,0.35,0.40,0.45,0.50];
export const T10304_TABLE17_MV=[1.345,1.373,1.405,1.446,1.491,1.540,1.607,1.685,1.786,1.916,2.010];
export function lookupTable17Mv10304(v){
  const r=linear1DStrict({x:v,xs:T10304_TABLE17_V,ys:T10304_TABLE17_MV,label:'Bảng 17 m_v'});
  return {...r,provenance:'TCVN 10304:2025 · Bảng 17 · trang 60'};
}
export function kvTable17Formula10304(v){ const x=Number(v); if(!(x>=0&&x<=0.5)) throw new Error('Bảng 17/CT (33): ν ngoài 0–0,5.'); return 2.82-3.78*x+2.18*x*x; }
export function zeta0Table17Formula10304(v){ const x=Number(v); if(!(x>=0&&x<=0.5)) throw new Error('CT (34): ν phải trong [0;0,5].'); if(Math.abs(x-0.5)<1e-12) return 0.25; return (1-2*x)/(2*Math.log(3-4*x)); }
