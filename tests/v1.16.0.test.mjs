import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { solveEngineeringQuestion, engineeringExcelPayload, WORKFLOW_REGISTRY } from '../src/engineering-router.js';
import { calcConstructionEffect10304 } from '../src/tcvn10304-advanced.js';
import { CODEPACK_10304 } from '../src/codepacks.js';
import { TCVN10304_TABLE_18 } from '../src/codepack-tables.js';

test('v1.16 CT47 + Table 18 checks vibration deterministically',()=>{
  const r=calcConstructionEffect10304('ảnh hưởng thi công kết cấu khung bê tông cốt thép đất sét IL=0.6 alpha=0.02 cm delta=10 Hz');
  assert.equal(r.ok,true); assert.equal(r.VaCmS,1.5); assert.ok(Math.abs(r.VcmS-2*Math.PI*0.02*10)<1e-12); assert.equal(r.vibrationOk,true);
});
test('v1.16 CT48 uses gamma_c=1.2 only for rate <=3m/min',()=>{
  const r=calcConstructionEffect10304('ảnh hưởng thi công kết cấu BTCT toàn khối đất sét IL=0.4 alpha=0.02 cm delta=10 Hz Rk=1200 kN tốc độ ép=3 m/min');
  assert.equal(r.ok,true); assert.equal(r.gammaC,1.2); assert.equal(r.FcMinKn,1440);
  const x=calcConstructionEffect10304('ảnh hưởng thi công kết cấu BTCT toàn khối đất sét IL=0.4 alpha=0.02 cm delta=10 Hz Rk=1200 kN tốc độ ép=4 m/min');
  assert.equal(x.ok,false); assert.ok(x.missing.some(v=>v.includes('γc')));
});
test('v1.16 Table 18 exact verified rows',()=>{
  assert.deepEqual(TCVN10304_TABLE_18.map(x=>[x.dense,x.medium,x.loose]),[[4.5,3,1],[3,1.5,0.5],[2,1.5,0.4]]);
});
test('v1.16 code pack CT47-48 numeric verified',()=>{
  for(const label of ['(47)','(48)']){ const f=CODEPACK_10304.formulas.find(x=>x.label===label); assert.equal(f.status,'Verified'); assert.equal(f.computable,true); assert.ok(f.rhs); }
});
test('v1.16 router construction effect is VERIFIED and excel payload exists',()=>{
  const q='ảnh hưởng thi công kết cấu khung bê tông cốt thép đất sét IL=0.6 alpha=0.02 cm delta=10 Hz Rk=1000 kN tốc độ ép=3 m/min';
  const r=solveEngineeringQuestion(q); assert.equal(r.workflow.id,'10304-construction-effect'); assert.equal(r.workflow.status,'VERIFIED'); assert.equal(r.result.ok,true);
  const e=engineeringExcelPayload(q); assert.equal(e.recognized,true); assert.equal(e.workflow.id,'10304-construction-effect'); assert.ok(e.input);
});
test('v1.16 all TCVN10304 registry workflows have chat Excel mapping/wiring',()=>{
  const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8'); const excel=fs.readFileSync(new URL('../src/excel-export.js',import.meta.url),'utf8');
  assert.match(main,/data-engineering-excel/); assert.match(main,/exportEngineeringMessageExcel/);
  const ids=WORKFLOW_REGISTRY.filter(x=>x.id.startsWith('10304-')).map(x=>x.id);
  for(const id of ids){ assert.match(main,new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),`missing UI Excel map for ${id}`); }
  for(const wid of ['end-bearing','bored','screw','static','dynamic','cpt','spt','settlement-single','settlement-group','equivalent-block','piled-raft','construction-effect']) assert.ok(excel.includes(`workflowId==='${wid}'`),`missing exporter ${wid}`);
});
