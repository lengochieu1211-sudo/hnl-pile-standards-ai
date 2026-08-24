import test from 'node:test';
import assert from 'node:assert/strict';
import { solveEngineeringQuestion } from '../src/engineering-router.js';

test('v1.14 bored pile CT13 computes from verified explicit inputs',()=>{
 const x=solveEngineeringQuestion('cọc nhồi A=0.5 m2 u=2.5 m qb=1200 kPa sum_fh=500 gamma_c=1 gamma_RR=1 gamma_Rf=0.9');
 assert.equal(x.workflow.status,'VERIFIED'); assert.equal(x.result.ok,true); assert.ok(x.result.RkKn>0);
});
test('v1.14 screw pile CT17-19 computes from verified explicit inputs',()=>{
 const x=solveEngineeringQuestion('cọc vít c1=50 gamma1=18 h1=5 A=0.5 alpha1=10 alpha2=4 u=0.5 fi=30 h=8 d=1 gamma_c=0.8 gamma_RR=1 gamma_Rf=1');
 assert.equal(x.result.ok,true); assert.ok(x.result.RkKn>0);
});
test('v1.14 static load CT20 computes',()=>{
 const x=solveEngineeringQuestion('thử tải tĩnh Ru=2000 kN gamma_c=1 gamma_cg1=1.1');
 assert.equal(x.result.ok,true); assert.ok(Math.abs(x.result.RkKn-1818.1818)<0.01);
});
test('v1.14 CPT CT25-27 computes',()=>{
 const x=solveEngineeringQuestion('CPT A=0.16 m2 u=1.6 m h=12 m qs=5000 kPa fs=50 kPa beta1=0.65 beta2=1.2');
 assert.equal(x.result.ok,true); assert.ok(x.result.RkKn>0);
});
test('v1.14 SPT Appendix D computes explicit branch',()=>{
 const x=solveEngineeringQuestion('SPT qb=3000 kPa A=0.16 m2 u=1.6 m fs=80 kPa fc=50 kPa Ls=8 m Lc=4 m');
 assert.equal(x.result.ok,true); assert.ok(x.result.RkKn>0);
});
