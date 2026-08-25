import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculateMultiBoreholePileCapacity } from '../src/multi-borehole-engine.js';
import { evaluateMultiBoreholeExcelModel } from '../src/p1-multiborehole-excel-model.js';
import { engineeringExcelPayload, deterministicEngineeringContext } from '../src/engineering-router.js';
import { productionStatusFor } from '../src/production-status-registry.js';

const material=(over={})=>({grade:'B30',steel:'CB400-V',shape:'square',sideMm:400,widthMm:400,heightMm:400,AsTotMm2:1600,L0Mm:4000,e0Mm:400/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long',...over});
const sandBh=(id,type,N1,N2,N3)=>({id,layers:[{top:0,bottom:4,soilGroup:'sand',sandType:type,sptN:N1},{top:4,bottom:9,soilGroup:'sand',sandType:type,sptN:N2},{top:9,bottom:15,soilGroup:'sand',sandType:type,sptN:N3}],sptPoints:[{depthM:10,N:N3-5},{depthM:11,N:N3},{depthM:12,N:N3+5},{depthM:13,N:N3},{depthM:14,N:N3-5}]});
const drivenBatch=(over={})=>({mechanicalWorkflowId:'10304-driven',pileInput:{shape:'square',sideM:.4,lengthM:12,tipDepthM:12,shaftStartDepthM:0,maxSegmentM:2,gammaN:1.15},mechanicalInput:{method:'hammer',gammaK:1.4},sptInput:{gammaK:1.5,pileType:'driven'},materialInput:material(),gammaN:1.15,boreholes:[sandBh('HK1','medium',18,24,30),sandBh('HK2','fine',10,15,20),sandBh('HK3','coarse',25,35,45)],...over});

const close=(a,b,t=1e-8)=>Math.abs(Number(a)-Number(b))<=t*Math.max(1,Math.abs(Number(a)),Math.abs(Number(b)));

test('P1 Pass 2: 3 boreholes × Mechanical+SPT selects HK2 mechanical as adverse',()=>{
  const r=calculateMultiBoreholePileCapacity(drivenBatch());
  assert.equal(r.ok,true); assert.equal(r.rows.length,6); assert.equal(r.criticalBoreholeId,'HK2'); assert.equal(r.criticalMethodId,'10304-driven'); assert.equal(r.materialTie,false);
  assert.ok(close(r.pileResistanceMinKn,843.4285714285716));
  assert.equal(r.soilMinimum.boreholeId,'HK2'); assert.equal(r.soilMinimum.methodId,'10304-driven');
  assert.equal(r.rows.every(x=>x.soilAtTip&&x.RmaterialKn>0&&x.RpileKn>0),true);
});

test('P1 Pass 2: independent Excel-like batch model matches every intermediate and governing row',()=>{
  const input=drivenBatch(),e=calculateMultiBoreholePileCapacity(input),x=evaluateMultiBoreholeExcelModel(input);
  assert.equal(e.ok,true); assert.equal(x.ok,true); assert.ok(close(e.pileResistanceMinKn,x.pileResistanceMinKn)); assert.deepEqual(e.criticalRows,x.criticalRows);
  for(let i=0;i<e.rows.length;i++) for(const k of ['QbKn','QsKn','RkKn','RdKn','RmaterialKn','RpileKn','NdMaxFinalKn']) assert.ok(close(e.rows[i][k],x.rows[i][k]),`${i}:${k}`);
});

test('P1 Pass 2: material-controlled common tie does not fabricate an adverse borehole',()=>{
  const strong=[sandBh('HK1','coarse',35,45,55),sandBh('HK2','coarse',40,50,60),sandBh('HK3','coarse',45,55,65)];
  const r=calculateMultiBoreholePileCapacity(drivenBatch({boreholes:strong,materialInput:material({grade:'B20',AsTotMm2:0,L0Mm:8000,e0Mm:400/30})}));
  assert.equal(r.ok,true); assert.equal(r.materialTie,true); assert.equal(r.criticalBoreholeId,null); assert.equal(r.criticalMethodId,null); assert.match(r.governingCause,/VẬT LIỆU KHỐNG CHẾ CHUNG/); assert.ok(r.soilMinimum.boreholeId);
});

test('P1 Pass 2: borehole coverage gap blocks Production batch instead of silently skipping soil',()=>{
  const bad=drivenBatch({boreholes:[sandBh('HK1','medium',18,24,30),{id:'HK2',layers:[{top:0,bottom:4,soilGroup:'sand',sandType:'fine',sptN:10},{top:6,bottom:15,soilGroup:'sand',sandType:'fine',sptN:20}],sptPoints:[{depthM:11,N:20},{depthM:12,N:25}]}]});
  const r=calculateMultiBoreholePileCapacity(bad); assert.equal(r.ok,false); assert.ok(r.invalidRows.length>=2); assert.match(r.invalidRows[0].issues.join(' '),/không phủ kín/i);
});

test('P1 Pass 2: duplicate borehole IDs and single borehole are blocked',()=>{
  const one=calculateMultiBoreholePileCapacity(drivenBatch({boreholes:[sandBh('HK1','fine',10,15,20)]})); assert.equal(one.ok,false); assert.match(one.issues.join(' '),/ít nhất 2/i);
  const dup=calculateMultiBoreholePileCapacity(drivenBatch({boreholes:[sandBh('HK1','fine',10,15,20),sandBh('HK1','medium',20,25,30)]})); assert.equal(dup.ok,false); assert.match(dup.issues.join(' '),/Trùng mã/i);
});

test('P1 Pass 2: bored mechanical + SPT multi-borehole is supported',()=>{
  const clay=(id,IL,N)=>({id,layers:[{top:0,bottom:5,soilGroup:'clay',soilClass:'clay',IL:IL+.2,sptN:Math.max(5,N-5)},{top:5,bottom:9,soilGroup:'clay',soilClass:'clay',IL:IL+.1,sptN:N},{top:9,bottom:15,soilGroup:'clay',soilClass:'clay',IL,sptN:N+5}],sptPoints:[]});
  const input={mechanicalWorkflowId:'10304-bored',pileInput:{shape:'square',sideM:.4,lengthM:12,tipDepthM:12,shaftStartDepthM:0,maxSegmentM:2,gammaN:1.15},mechanicalInput:{methodCaseId:'bored-64a-64b',gammaK:1.4},sptInput:{gammaK:1.5,pileType:'bored'},materialInput:material(),gammaN:1.15,boreholes:[clay('HK1',.3,20),clay('HK2',.5,12)]};
  const r=calculateMultiBoreholePileCapacity(input); assert.equal(r.ok,true); assert.equal(r.rows.length,4); assert.ok(r.pileResistanceMinKn>0); assert.ok(['HK1','HK2'].includes(r.soilMinimum.boreholeId));
});

test('P1 Pass 2: natural language HK blocks route to multi-borehole and unlock export',()=>{
  const q=`Tính nhiều lỗ khoan cùng một cọc vuông 400x400 mm, dài L=12 m đóng bằng búa, kiểm cơ lý và SPT, B30 CB400-V As,tot=1600 mm2 L0=4 m e0=13.333333 mm đã kể lệch tâm ngẫu nhiên ea, cốt dọc ở hai phía đối diện, tải dài hạn, gamma_k_mech=1.4, gamma_k_spt=1.5, gamma_n=1.15.\nHK1: Lớp 1: 0-4 m cát vừa N=18. Lớp 2: 4-9 m cát vừa N=24. Lớp 3: 9-15 m cát vừa N=30. z=10 m, N-SPT=25; z=11 m, N-SPT=30; z=12 m, N-SPT=35; z=13 m, N-SPT=30.\nHK2: Lớp 1: 0-4 m cát mịn N=10. Lớp 2: 4-9 m cát mịn N=15. Lớp 3: 9-15 m cát mịn N=20. z=10 m, N-SPT=15; z=11 m, N-SPT=20; z=12 m, N-SPT=25; z=13 m, N-SPT=20.`;
  const p=engineeringExcelPayload(q); assert.equal(p.workflow.id,'pile-capacity-multiborehole'); assert.equal(p.result.ok,true); assert.equal(p.result.criticalBoreholeId,'HK2'); assert.equal(p.result.criticalMethodId,'10304-driven'); assert.equal(p.canExport,true); assert.equal(p.production.id,'pile-capacity-multiborehole-square');
  const ctx=deterministicEngineeringContext(q); assert.match(ctx,/KẾT QUẢ BATCH/); assert.match(ctx,/BẤT LỢI RIÊNG ĐẤT/);
});

test('P1 Pass 2 Production registry is locked and exporter is wired',()=>{
  const r=productionStatusFor('pile-capacity-multiborehole-square'); assert.equal(r.status,'LOCKED'); assert.equal(r.productionNumeric,true);
  const src=fs.readFileSync(new URL('../src/excel-export.js',import.meta.url),'utf8'); assert.match(src,/exportMultiBoreholePileCapacityWorkbook/); assert.match(src,/BOREHOLE_BATCH/); assert.match(src,/BATCH_INPUT/); assert.match(src,/MATERIAL_INPUT[\s\S]{0,1000}BATCH_INPUT/); assert.match(src,/pile-capacity-multiborehole/);
});
