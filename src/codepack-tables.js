// Structured lookup data transcribed from user-provided standards and manually verified.
// Only tables listed here are safe for automatic lookup/export. Other Code Pack tables stay Indexed.

export const TCVN5574_CONCRETE_HEAVY = [
  ['B3.5',2.1,0.26,9500],['B5',2.8,0.37,13000],['B7.5',4.5,0.48,16000],['B10',6.0,0.56,19000],
  ['B12.5',7.5,0.66,21500],['B15',8.5,0.75,24000],['B20',11.5,0.90,27500],['B25',14.5,1.05,30000],
  ['B30',17.0,1.15,32500],['B35',19.5,1.30,34500],['B40',22.0,1.40,36000],['B45',25.0,1.50,37000],
  ['B50',27.5,1.60,38000],['B55',30.0,1.70,39000],['B60',33.0,1.80,39500],['B70',37.0,1.90,41000],
  ['B80',41.0,2.10,42000],['B90',44.0,2.15,42500],['B100',47.5,2.20,43000]
].map(([grade,Rb,Rbt,Eb])=>({grade,Rb,Rbt,Eb,standard:'TCVN 5574:2018',sources:['Bảng 7 · trang 35','Bảng 10 · trang 38'],status:'Verified'}));

export const TCVN5574_STEEL = [
  ['CB240-T',210,210,170],['CB300-T',260,260,210],['CB300-V',260,260,210],['CB400-V',350,350,280],['CB500-V',435,435,300]
].map(([grade,Rs,Rsc,Rsw])=>({grade,Rs,Rsc,Rsw,standard:'TCVN 5574:2018',sources:['Bảng 13 · trang 47','Bảng 14 · trang 48'],status:'Verified'}));

export const TCVN10304_TABLE_1 = [
  ['>90–100',1.00],['>75–90','≥0.60 và <1.00'],['>50–75','>0.32 và <0.60'],['>25–50','>0.22 và ≤0.32'],['0–25',0.22]
].map(([rqd,Kr])=>({rqd,Kr,standard:'TCVN 10304:2025',table:'Bảng 1',page:29,status:'Verified'}));

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
].map(([structure,dense,clay,loose])=>({structure,dense,clay,loose,unit:'cm/s',standard:'TCVN 10304:2025',table:'Bảng 18',page:69,status:'Verified'}));

export const STRUCTURED_CODE_TABLES = {
  TCVN5574_2018: [
    {id:'5574-T7-T10',title:'Bê tông nặng: Rb, Rbt, Eb',sources:['Bảng 7 · trang 35','Bảng 10 · trang 38'],rows:TCVN5574_CONCRETE_HEAVY},
    {id:'5574-T13-T14',title:'Cốt thép thanh: Rs, Rsc, Rsw',sources:['Bảng 13 · trang 47','Bảng 14 · trang 48'],rows:TCVN5574_STEEL}
  ],
  TCVN10304_2025: [
    {id:'10304-T1',title:'Hệ số suy giảm cường độ đá Kr',sources:['Bảng 1 · trang 29'],rows:TCVN10304_TABLE_1},
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
