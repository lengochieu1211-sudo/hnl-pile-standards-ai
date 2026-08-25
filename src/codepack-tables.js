import { TCVN10304_QB_DEPTHS, TCVN10304_QB, TCVN10304_FI_DEPTHS, TCVN10304_FI } from './pile-workflows.js';
// Structured lookup data transcribed from user-provided standards and manually verified.
// Only tables listed here are safe for automatic lookup/export. Other Code Pack tables stay Indexed.

export const TCVN5574_CONCRETE_HEAVY = [
  ['B3.5',2.1,0.26,9500],['B5',2.8,0.37,13000],['B7.5',4.5,0.48,16000],['B10',6.0,0.56,19000],
  ['B12.5',7.5,0.66,21500],['B15',8.5,0.75,24000],['B20',11.5,0.90,27500],['B25',14.5,1.05,30000],
  ['B30',17.0,1.15,32500],['B35',19.5,1.30,34500],['B40',22.0,1.40,36000],['B45',25.0,1.50,37000],
  ['B50',27.5,1.60,38000],['B55',30.0,1.70,39000],['B60',33.0,1.80,39500],['B70',37.0,1.90,41000],
  ['B80',41.0,2.10,42000],['B90',44.0,2.15,42500],['B100',47.5,2.20,43000]
].map(([grade,Rb,Rbt,Eb])=>({grade,Rb,Rbt,Eb,standard:'TCVN 5574:2018',sources:['Bảng 7 · trang chuẩn 35 · PDF 33','Bảng 10 · trang chuẩn 38 · PDF 36'],standardPages:[35,38],pdfPages:[33,36],status:'Verified'}));

export const TCVN5574_STEEL = [
  ['CB240-T',210,210,170],['CB300-T',260,260,210],['CB300-V',260,260,210],['CB400-V',350,350,280],['CB500-V',435,435,300]
].map(([grade,Rs,Rsc,Rsw])=>({grade,Rs,Rsc,Rsw,standard:'TCVN 5574:2018',sources:['Bảng 13 · trang chuẩn 47 · PDF 45','Bảng 14 · trang chuẩn 48 · PDF 46'],standardPages:[47,48],pdfPages:[45,46],status:'Verified'}));


// TCVN 5574:2018 – TTGH2/SLS tables verified from user PDF.
export const TCVN5574_CONCRETE_SLS_HEAVY = [
  ['B3.5',2.7,0.39],['B5',3.5,0.55],['B7.5',5.5,0.70],['B10',7.5,0.85],['B12.5',9.5,1.00],['B15',11.0,1.10],
  ['B20',15.0,1.35],['B25',18.5,1.55],['B30',22.0,1.75],['B35',25.5,1.95],['B40',29.0,2.10],['B45',32.0,2.25],
  ['B50',36.0,2.45],['B55',39.5,2.60],['B60',43.0,2.75],['B70',50.0,3.00],['B80',57.0,3.30],['B90',64.0,3.60],['B100',71.0,3.80]
].map(([grade,RbSer,RbtSer])=>({grade,RbSer,RbtSer,unit:'MPa',standard:'TCVN 5574:2018',table:'Bảng 6',clause:'6.1.2.1',standardPage:'34',pdfPage:'32',status:'Verified'}));

export const TCVN5574_STEEL_SLS = [
  ['CB240-T',240,'Thép thanh'],['CB300-T',300,'Thép thanh'],['CB300-V',300,'Thép thanh'],['CB400-V',400,'Thép thanh'],['CB500-V',500,'Thép thanh'],
  ['YS835',835,'Thép thanh giới hạn chảy quy ước'],['YS930',930,'Thép thanh giới hạn chảy quy ước'],['YS1080',1080,'Thép thanh giới hạn chảy quy ước'],
  ['WIRE1470',1200,'Dây thép giới hạn bền 1470 MPa'],['WIRE1570',1300,'Dây thép giới hạn bền 1570 MPa'],['WIRE1670',1400,'Dây thép giới hạn bền 1670 MPa'],['WIRE1770',1500,'Dây thép giới hạn bền 1770 MPa'],
  ['COLD-DRAWN-500',500,'Dây thép vuốt nguội TCVN 6288'],
  ['STRAND7-1720',1450,'Cáp 7 sợi thường 1720 MPa'],['STRAND7-1860',1550,'Cáp 7 sợi thường 1860 MPa'],
  ['STRAND7C-1700',1500,'Cáp 7 sợi nén chặt 1700 MPa'],['STRAND7C-1820',1600,'Cáp 7 sợi nén chặt 1820 MPa'],['STRAND7C-1960',1700,'Cáp 7 sợi nén chặt 1960 MPa'],
  ['STRAND19-1810',1500,'Cáp 19 sợi 1810 MPa'],['STRAND19-1860',1600,'Cáp 19 sợi 1860 MPa']
].map(([grade,RsSer,description])=>({grade,RsSer,description,unit:'MPa',standard:'TCVN 5574:2018',table:'Bảng 12',clause:'6.2.2.1',standardPage:'45-46',pdfPage:'43-44',status:'Verified'}));

export const TCVN5574_CRACK_LIMIT_TABLE17 = [
  {group:'CB-bars',label:'CB240-T/CB300-T/CB300-V/CB400-V/CB500-V và dây thép vuốt nguội',longMm:0.3,shortMm:0.4},
  {group:'high-strength-wire',label:'Thép thanh cường độ cao; dây kéo nguội; cáp 7 sợi d≥12,4 mm; cáp 19 sợi',longMm:0.2,shortMm:0.3},
  {group:'small-7wire',label:'Cáp 7 sợi d<12,4 mm',longMm:0.1,shortMm:0.2},
  {group:'watertight',label:'Theo điều kiện hạn chế thấm cho kết cấu',longMm:0.2,shortMm:0.3}
].map(r=>({...r,unit:'mm',standard:'TCVN 5574:2018',table:'Bảng 17',clause:'8.2.2.1.3',standardPage:'98-99',pdfPage:'96-97',status:'Verified'}));

export const TCVN5574_PRESTRESS_FRICTION_TABLE18 = [
  {surface:'metal-duct',label:'Rãnh/ống lồng bề mặt kim loại',omega:0.0030,deltaCable:0.35,deltaBar:0.40},
  {surface:'rigid-concrete-duct',label:'Bề mặt bê tông tạo bởi khuôn lõi cứng',omega:0.0000,deltaCable:0.55,deltaBar:0.65},
  {surface:'soft-concrete-duct',label:'Bề mặt bê tông tạo bởi khuôn lõi mềm',omega:0.0015,deltaCable:0.55,deltaBar:0.65},
  {surface:'concrete-surface',label:'Bề mặt bê tông',omega:0.0000,deltaCable:0.55,deltaBar:0.65}
].map(r=>({...r,standard:'TCVN 5574:2018',table:'Bảng 18',clause:'9.1.7',standardPage:'117',pdfPage:'115',status:'Verified'}));

export const TCVN5574_TABLE9_LONG_STRAIN = [
  {humidityBand:'>75',epsB1Red:0.0024},
  {humidityBand:'40-75',epsB1Red:0.0028},
  {humidityBand:'<40',epsB1Red:0.0034}
].map(r=>({...r,standard:'TCVN 5574:2018',table:'Bảng 9',clause:'6.1.4.3',standardPage:'36',pdfPage:'34',status:'Verified'}));

export const TCVN10304_TABLE_1 = [
  ['>90–100',1.00],['>75–90','≥0.60 và <1.00'],['>50–75','>0.32 và <0.60'],['>25–50','>0.22 và ≤0.32'],['0–25',0.22]
].map(([rqd,Kr])=>({rqd,Kr,standard:'TCVN 10304:2025',table:'Bảng 1',page:29,status:'Verified'}));



export const TCVN10304_TABLE_2_QB = TCVN10304_QB_DEPTHS.map((depth,i)=>({
  depthM:depth,
  sandGravelly:TCVN10304_QB.sand_gravelly[i], sandCoarse:TCVN10304_QB.sand_coarse[i], sandMedium:TCVN10304_QB.sand_medium[i], sandFine:TCVN10304_QB.sand_fine[i], sandSilty:TCVN10304_QB.sand_silty[i],
  clayIL0_0:TCVN10304_QB.clay_0_0[i], clayIL0_1:TCVN10304_QB.clay_0_1[i], clayIL0_2:TCVN10304_QB.clay_0_2[i], clayIL0_3:TCVN10304_QB.clay_0_3[i], clayIL0_4:TCVN10304_QB.clay_0_4[i], clayIL0_5:TCVN10304_QB.clay_0_5[i], clayIL0_6:TCVN10304_QB.clay_0_6[i],
  unit:'kPa', standard:'TCVN 10304:2025', table:'Bảng 2', clause:'7.2.2.1', standardPage:'32-33', pdfPage:'32-33', status:'Verified'
}));

export const TCVN10304_TABLE_3_FI = TCVN10304_FI_DEPTHS.map((depth,i)=>({
  avgDepthM:depth, sandCoarseMedium:TCVN10304_FI.sand_coarse_medium[i], sandFine:TCVN10304_FI.sand_fine[i], sandSilty:TCVN10304_FI.sand_silty[i],
  clayIL0_2:TCVN10304_FI.clay_0_2[i], clayIL0_3:TCVN10304_FI.clay_0_3[i], clayIL0_4:TCVN10304_FI.clay_0_4[i], clayIL0_5:TCVN10304_FI.clay_0_5[i], clayIL0_6:TCVN10304_FI.clay_0_6[i], clayIL0_7:TCVN10304_FI.clay_0_7[i], clayIL0_8:TCVN10304_FI.clay_0_8[i], clayIL0_9:TCVN10304_FI.clay_0_9[i], clayIL1_0:TCVN10304_FI.clay_1_0[i],
  unit:'kPa', standard:'TCVN 10304:2025', table:'Bảng 3', clause:'7.2.2.1', standardPage:'33-34', pdfPage:'33-34', status:'Verified'
}));

export const TCVN10304_TABLE_4 = [
  {method:'Búa cơ khí/hơi/diesel',condition:'Cọc đặc hoặc cọc rỗng mũi hở',gammaRR:1.0,gammaRf:1.0,row:'1'},
  {method:'Hố khoan dẫn',condition:'Đường kính hố bằng cạnh/đường kính cọc',gammaRR:1.0,gammaRf:0.5,row:'2a'},
  {method:'Hố khoan dẫn',condition:'Nhỏ hơn 0,05 m',gammaRR:1.0,gammaRf:0.6,row:'2b'},
  {method:'Hố khoan dẫn',condition:'Nhỏ hơn 0,15 m',gammaRR:1.0,gammaRf:1.0,row:'2c'},
  {method:'Xói nước giai đoạn cuối',condition:'Đóng vỗ đến chiều sâu >=1 m',gammaRR:1.0,gammaRf:0.9,row:'3'},
  {method:'Rung/ép rung',condition:'Cát thô và vừa',gammaRR:1.2,gammaRf:1.0,row:'4a1'},
  {method:'Rung/ép rung',condition:'Cát mịn',gammaRR:1.1,gammaRf:1.0,row:'4a2'},
  {method:'Rung/ép rung',condition:'Cát bụi',gammaRR:1.0,gammaRf:1.0,row:'4a3'},
  {method:'Rung/ép rung',condition:'Cát pha, IL=0,5',gammaRR:0.9,gammaRf:0.9,row:'4b1'},
  {method:'Rung/ép rung',condition:'Sét pha, IL=0,5',gammaRR:0.8,gammaRf:0.9,row:'4b2'},
  {method:'Rung/ép rung',condition:'Sét, IL=0,5',gammaRR:0.7,gammaRf:0.9,row:'4b3'},
  {method:'Rung/ép rung',condition:'Đất loại sét IL<=0',gammaRR:1.0,gammaRf:1.0,row:'4c'},
  {method:'Cọc BTCT rỗng mũi hở bằng búa',condition:'Đường kính lòng <0,4 m',gammaRR:1.0,gammaRf:1.0,row:'5a'},
  {method:'Cọc BTCT rỗng mũi hở bằng búa',condition:'Đường kính lòng 0,4–0,8 m',gammaRR:0.7,gammaRf:1.0,row:'5b'},
  {method:'Mũi cọc nổ mở rộng',condition:'D mở rộng 1,0 m',gammaRR:0.9,gammaRf:1.0,row:'6a'},
  {method:'Mũi cọc nổ mở rộng',condition:'D mở rộng 1,5 m trong cát/cát pha',gammaRR:0.8,gammaRf:1.0,row:'6b'},
  {method:'Mũi cọc nổ mở rộng',condition:'D mở rộng 1,5 m trong sét pha/sét',gammaRR:0.7,gammaRf:1.0,row:'6c'},
  {method:'Ép',condition:'Cát thô, vừa, mịn',gammaRR:1.1,gammaRf:1.0,row:'7a'},
  {method:'Ép',condition:'Cát bụi',gammaRR:1.1,gammaRf:0.8,row:'7b'},
  {method:'Ép',condition:'Đất loại sét IL<0,5',gammaRR:1.1,gammaRf:1.0,row:'7c'},
  {method:'Ép',condition:'Đất loại sét IL>=0,5',gammaRR:1.0,gammaRf:1.0,row:'7d'}
].map(r=>({...r,standard:'TCVN 10304:2025',table:'Bảng 4',clause:'7.2.2.1',standardPage:'34-35',pdfPage:'34-35',status:'Verified'}));

export const TCVN10304_TABLE_5 = [
  ['Cát chặt pha',null,0.5],['Sét pha',null,0.6],['Sét',18,0.7],['Sét',25,0.9]
].map(([soil,Ip,ki])=>({soil,Ip,ki,standard:'TCVN 10304:2025',table:'Bảng 5',page:36,status:'Verified'}));

export const TCVN10304_TABLE_9 = [
  ['Đất sét/sét pha','Cứng, nửa cứng, dẻo cứng',0.8,0.7,0.7],
  ['Đất sét/sét pha','Dẻo mềm',0.8,0.7,0.6],
  ['Đất sét/sét pha','Dẻo chảy',0.7,0.6,0.4],
  ['Cát/cát pha','Ít ẩm / sét pha cứng',0.8,0.7,0.5],
  ['Cát/cát pha','Ẩm / sét pha dẻo',0.7,0.6,0.4],
  ['Cát/cát pha','Bão hòa / sét pha chảy',0.6,0.5,0.3]
].map(([group,state,compression,tension,pullout])=>({group,state,compression,tension,pullout,standard:'TCVN 10304:2025',table:'Bảng 9',page:43,status:'Verified'}));

export const TCVN10304_TABLE_10 = [
  [13,7.8,2.8],[15,8.4,3.3],[16,9.4,3.8],[18,10.1,4.5],[20,12.1,5.5],[22,15.0,7.0],
  [24,18.0,9.2],[26,23.1,12.3],[28,29.5,16.5],[30,38.0,22.5],[32,48.4,31.0],[34,64.9,44.4]
].map(([phi,alpha1,alpha2])=>({phi,alpha1,alpha2,standard:'TCVN 10304:2025',table:'Bảng 10',page:45,status:'Verified'}));

export const TCVN10304_TABLE_14 = [[100,45],[200,90],[300,130],[400,175],[500,220],[600,265],[700,310],[800,350]]
  .map(([force,energy])=>({force,energy,forceUnit:'kN',energyUnit:'kJ',standard:'TCVN 10304:2025',table:'Bảng 14',page:55,status:'Verified'}));

export const TCVN10304_TABLE_17 = [
  [0,2.82,0.455,1.345],[0.05,2.636,0.437,1.373],[0.10,2.464,0.419,1.405],[0.15,2.302,0.400,1.446],
  [0.20,2.151,0.380,1.491],[0.25,2.011,0.361,1.540],[0.30,1.882,0.340,1.607],[0.35,1.764,0.319,1.685],
  [0.40,1.657,0.297,1.786],[0.45,1.560,0.274,1.916],[0.50,1.475,0.250,2.010]
].map(([nu,kv,kc,eta])=>({nu,kv,kc,eta,standard:'TCVN 10304:2025',table:'Bảng 17',page:60,status:'Verified'}));

export const TCVN10304_TABLE_18 = [
  ['Kết cấu BTCT toàn khối / khung thép',4.5,3.0,1.0],['Kết cấu khung bê tông cốt thép',3.0,1.5,0.5],['Kết cấu khối xây / panel ghép',2.0,1.5,0.4]
].map(([structure,dense,medium,loose])=>({structure,dense,medium,loose,unit:'cm/s',standard:'TCVN 10304:2025',table:'Bảng 18',page:69,status:'Verified'}));

export const STRUCTURED_CODE_TABLES = {
  TCVN5574_2018: [
    {id:'5574-T7-T10',title:'Bê tông nặng: Rb, Rbt, Eb',sources:['Bảng 7 · trang chuẩn 35 · PDF 33','Bảng 10 · trang chuẩn 38 · PDF 36'],rows:TCVN5574_CONCRETE_HEAVY},
    {id:'5574-T6',title:'TTGH2 bê tông nặng: Rb,ser và Rbt,ser',sources:['Bảng 6 · trang chuẩn 34 · PDF 32'],rows:TCVN5574_CONCRETE_SLS_HEAVY},
    {id:'5574-T13-T14',title:'Cốt thép thanh: Rs, Rsc, Rsw',sources:['Bảng 13 · trang chuẩn 47 · PDF 45','Bảng 14 · trang chuẩn 48 · PDF 46'],rows:TCVN5574_STEEL},
    {id:'5574-T12',title:'TTGH2 cốt thép: Rs,ser',sources:['Bảng 12 · trang chuẩn 45-46 · PDF 43-44'],rows:TCVN5574_STEEL_SLS},
    {id:'5574-T17',title:'Chiều rộng vết nứt giới hạn acrc,u',sources:['Bảng 17 · trang chuẩn 98-99 · PDF 96-97'],rows:TCVN5574_CRACK_LIMIT_TABLE17},
    {id:'5574-T18-PRESTRESS',title:'Hệ số ma sát cốt thép ứng suất trước',sources:['Bảng 18 · trang chuẩn 117 · PDF 115'],rows:TCVN5574_PRESTRESS_FRICTION_TABLE18},
    {id:'5574-T9-LONG',title:'εb1,red dài hạn',sources:['Bảng 9 · trang chuẩn 36 · PDF 34'],rows:TCVN5574_TABLE9_LONG_STRAIN}
  ],
  TCVN10304_2025: [
    {id:'10304-T1',title:'Hệ số suy giảm cường độ đá Kr',sources:['Bảng 1 · trang 29'],rows:TCVN10304_TABLE_1},
    {id:'10304-T2',title:'qb dưới mũi cọc đóng/ép không moi đất',sources:['Bảng 2 · trang chuẩn/PDF 32-33'],rows:TCVN10304_TABLE_2_QB},
    {id:'10304-T3',title:'fi trên mặt bên thân cọc đóng/ép không moi đất',sources:['Bảng 3 · trang chuẩn/PDF 33-34'],rows:TCVN10304_TABLE_3_FI},
    {id:'10304-T4',title:'Hệ số điều kiện làm việc γRR, γRf',sources:['Bảng 4 · trang chuẩn/PDF 34-35'],rows:TCVN10304_TABLE_4},
    {id:'10304-T5',title:'Hệ số ki',sources:['Bảng 5 · trang 36'],rows:TCVN10304_TABLE_5},
    {id:'10304-T9',title:'Hệ số điều kiện làm việc cọc vít',sources:['Bảng 9 · trang 43'],rows:TCVN10304_TABLE_9},
    {id:'10304-T10',title:'Hệ số α1, α2 theo góc ma sát trong',sources:['Bảng 10 · trang 45'],rows:TCVN10304_TABLE_10},
    {id:'10304-T14',title:'Năng lượng tương đương máy rung',sources:['Bảng 14 · trang 55'],rows:TCVN10304_TABLE_14},
    {id:'10304-T17',title:'Hệ số tính lún theo ν',sources:['Bảng 17 · trang 60'],rows:TCVN10304_TABLE_17},
    {id:'10304-T18',title:'Vận tốc dao động cho phép',sources:['Bảng 18 · trang 69'],rows:TCVN10304_TABLE_18}
  ]
};

export function structuredTablesForPack(packId){ return STRUCTURED_CODE_TABLES[packId] || []; }
export function lookup5574Concrete(grade){ return TCVN5574_CONCRETE_HEAVY.find(r=>r.grade===String(grade||'').toUpperCase()) || null; }
export function lookup5574Steel(grade){ return TCVN5574_STEEL.find(r=>r.grade===String(grade||'').toUpperCase()) || null; }

export function lookup5574ConcreteSls(grade){ return TCVN5574_CONCRETE_SLS_HEAVY.find(r=>r.grade===String(grade||'').toUpperCase()) || null; }
export function lookup5574SteelSls(grade){ return TCVN5574_STEEL_SLS.find(r=>r.grade===String(grade||'').toUpperCase()) || null; }
export function lookup5574CrackLimit({steel='',duration='short',watertight=false,group=''}={}){ const g=watertight?'watertight':(group||(/^CB/.test(String(steel).toUpperCase())?'CB-bars':'')); const r=TCVN5574_CRACK_LIMIT_TABLE17.find(x=>x.group===g); return r?{...r,acrcUMm:String(duration).toLowerCase().includes('long')?r.longMm:r.shortMm}:null; }
export function lookup5574PrestressFriction(surface='metal-duct',steelType='cable'){ const r=TCVN5574_PRESTRESS_FRICTION_TABLE18.find(x=>x.surface===surface); return r?{...r,delta:String(steelType).toLowerCase().includes('bar')?r.deltaBar:r.deltaCable}:null; }

// v1.25.3 — strict interpolation/table-policy registry for TCVN 10304:2025.
export { T10304_INTERPOLATION_POLICIES, T10304_TABLE6, T10304_TABLE7_PHI, T10304_TABLE7_A1, T10304_TABLE7_A2, T10304_TABLE7_HD, T10304_TABLE7_A3, T10304_TABLE7_D, T10304_TABLE7_A4, T10304_TABLE8_DEPTH, T10304_TABLE8_IL, T10304_TABLE8_QB, T10304_TABLE12, T10304_TABLE16_QC, T10304_TABLE16, T10304_TABLE17_V, T10304_TABLE17_MV } from './tcvn10304-table-engine.js';

// TCVN 5574:2018 · 8.1.2.4.3 · Bảng 16 — hệ số φ cho nén gần đúng tâm,
// tải trọng dài hạn. Chỉ dùng trong phạm vi CT (49)–(50): tiết diện chữ nhật,
// e0 <= h/30, L0/h <= 20. Giá trị trung gian L0/h nội suy tuyến tính.
export const TCVN5574_TABLE16_LONG_TERM_PHI = Object.freeze([
  {gradeMin:20,gradeMax:55,label:'B20–B55',ratios:[6,10,15,20],phi:[0.92,0.90,0.83,0.70]},
  {gradeMin:60,gradeMax:70,label:'B60–B70',ratios:[6,10,15,20],phi:[0.91,0.89,0.80,0.65]},
  {gradeMin:80,gradeMax:90,label:'B80–B90',ratios:[6,10,15,20],phi:[0.90,0.88,0.79,0.64]},
  {gradeMin:100,gradeMax:100,label:'B100',ratios:[6,10,15,20],phi:[0.89,0.87,0.78,0.63]}
].map(r=>Object.freeze({...r,standard:'TCVN 5574:2018',clause:'8.1.2.4.3',table:'Bảng 16',standardPage:62,pdfPage:60,status:'Verified'})));

export function lookup5574Table16LongTermPhi(grade='B30', slendernessRatio){
  const g=Number(String(grade||'').toUpperCase().replace('B','').replace(',','.'));
  const x=Number(slendernessRatio);
  if(!Number.isFinite(g)||!Number.isFinite(x)) return {ok:false,error:'INVALID_INPUT'};
  const row=TCVN5574_TABLE16_LONG_TERM_PHI.find(r=>g>=r.gradeMin&&g<=r.gradeMax);
  if(!row) return {ok:false,error:'GRADE_OUTSIDE_TABLE16',grade:g};
  if(x<row.ratios[0]||x>row.ratios[row.ratios.length-1]) return {ok:false,error:'SLENDERNESS_OUTSIDE_TABLE16',value:x,domain:[6,20],row};
  for(let i=0;i<row.ratios.length;i++) if(Math.abs(x-row.ratios[i])<1e-12) return {ok:true,value:row.phi[i],mode:'EXACT',row,bracket:[row.ratios[i],row.ratios[i]]};
  for(let i=0;i<row.ratios.length-1;i++) if(x>row.ratios[i]&&x<row.ratios[i+1]){
    const x1=row.ratios[i],x2=row.ratios[i+1],y1=row.phi[i],y2=row.phi[i+1];
    return {ok:true,value:y1+(x-x1)*(y2-y1)/(x2-x1),mode:'LINEAR_1D',row,bracket:[x1,x2]};
  }
  return {ok:false,error:'LOOKUP_FAILED'};
}
