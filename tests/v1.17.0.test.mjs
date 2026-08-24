import test from 'node:test';
import assert from 'node:assert/strict';
import { calcGroupSettlement10304, calcSingleSettlement10304, calcEquivalentBlock10304, calcDynamic10304, calcConstructionEffect10304 } from '../src/tcvn10304-advanced.js';
import { solveEngineeringQuestion, WORKFLOW_REGISTRY } from '../src/engineering-router.js';

test('v1.17 group settlement covers CT39 and CT40 optional branches',()=>{
 const q='lún nhóm cọc s_single=0.01 m G1=20 MPa G2=20 MPa L=20 m v1=0.3 v2=0.3 a1=1.8 m N1=1 MN Li=20 m Lj=24 m kw0=50 MN/m Nu=100 MN m_corr=2';
 const r=calcGroupSettlement10304(q); assert.equal(r.ok,true); assert.ok(r.equivalentLengthM>20); assert.ok(r.kw>0); assert.match(r.provenance[0],/\(36\)-\(40\)/);
});

test('v1.17 advanced numeric benchmarks are finite and dimensionally plausible',()=>{
 const cases=[
  calcDynamic10304('sa=0.003 m A=0.16 m2 eta=1500 M=1 Ed=45 kJ m1=3 T m2=2 T m3=0 T eps2=0.2'),
  calcSingleSettlement10304('lún cọc đơn N=1 MN G1=20 MPa G2=15 MPa L=20 m d=0.6 m v1=0.3 v2=0.3 EA=10000 MN'),
  calcEquivalentBlock10304('móng khối quy ước sef=0.015 m E1=20 MPa E2=30 MPa v2=0.3 p=200 kPa a=1.8 m d=0.6 m L=20 m E=30000 MPa A=0.283 m2 b=0.6 m'),
  calcConstructionEffect10304('ảnh hưởng thi công kết cấu khung bê tông cốt thép đất sét IL=0.6 alpha=0.02 cm delta=10 Hz Rk=1200 kN tốc độ ép=3 m/min')
 ];
 for(const r of cases){ assert.equal(r.ok,true); const nums=Object.values(r).filter(x=>typeof x==='number'); assert.ok(nums.every(Number.isFinite)); }
});

test('v1.17 all TCVN10304 workflows remain recognized and no numeric REVIEW workflow leaks',()=>{
 const list=WORKFLOW_REGISTRY.filter(x=>x.id.startsWith('10304-')); assert.ok(list.length>=13);
 assert.equal(list.filter(x=>x.status==='REVIEW').length,0);
 assert.equal(list.find(x=>x.id==='10304-piled-raft').status,'VERIFIED_METHOD');
});

test('v1.17 driven natural-language layer parser keeps IL for every semicolon-separated layer',()=>{
 const q='tính sức chịu tải cọc vuông cạnh 0.4 m dài 12 m đóng lớp 1: 0-4m sét IL=0.5; lớp 2: 4-12m sét IL=0.3';
 const r=solveEngineeringQuestion(q); assert.equal(r.workflow.id,'10304-driven'); assert.equal(r.result.ok,true); assert.equal(r.result.layerResults.length,2); assert.ok(r.result.RkKn>0);
});
