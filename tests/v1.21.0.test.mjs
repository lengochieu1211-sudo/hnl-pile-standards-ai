import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcAnchorage5574, calcLapSplice5574, calcConcreteShearKey5574,
  calcShortCorbel5574, calcAnnularColumn5574, calcCircularColumn5574, TCVN5574_ANNEX_INDEX
} from '../src/tcvn5574-core.js';
import { solveEngineeringQuestion, selectEngineeringWorkflow } from '../src/engineering-router.js';

const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol, `${a} != ${b}`);

test('v1.21 anchorage CT255-258 benchmark',()=>{
  const ds=20,As=Math.PI*ds*ds/4;
  const r=calcAnchorage5574({grade:'B30',steel:'CB400-V',ds,As,AsCal:As,AsEf:As,alpha:1,barType:'hotRibbed'});
  assert.equal(r.ok,true); close(r.RbondMpa,2.875); close(r.L0anMm,608.695652173913); close(r.LanMm,608.695652173913);
});

test('v1.21 anchorage refuses missing alpha',()=>{
  const r=calcAnchorage5574({grade:'B30',steel:'CB400-V',ds:20,As:Math.PI*100,barType:'hotRibbed'});
  assert.equal(r.ok,false); assert.match(r.missing.join(' '),/α/);
});

test('v1.21 lap CT259 benchmark and diameter gate',()=>{
  const ds=20,As=Math.PI*ds*ds/4;
  const r=calcLapSplice5574({grade:'B30',steel:'CB400-V',ds,As,stress:'tension',barType:'hotRibbed'});
  assert.equal(r.ok,true); close(r.LlapMm,730.4347826086956);
  const bad=calcLapSplice5574({grade:'B30',steel:'CB400-V',ds:41,As:1320,stress:'tension'});
  assert.equal(bad.ok,false); assert.match(bad.missing.join(' '),/40/);
});

test('v1.21 Annex G benchmark, G.3 and nk gate',()=>{
  const r=calcConcreteShearKey5574({grade:'B30',Q:200,Lk:300,nk:2,N:0});
  assert.equal(r.ok,true); close(r.tkMm,19.607843137254903); close(r.hkMm,144.92753623188406);
  const rn=calcConcreteShearKey5574({grade:'B30',Q:200,Lk:300,nk:2,N:50}); close(rn.hkMm,119.56521739130434);
  assert.equal(calcConcreteShearKey5574({grade:'B30',Q:200,Lk:300,nk:4}).ok,false);
});

test('v1.21 short corbel H.1 benchmark and domain gate',()=>{
  const r=calcShortCorbel5574({grade:'B30',b:300,h0:500,L1:300,Lsup:200,Q:200,Asw:157,sw:150});
  assert.equal(r.ok,true); close(r.QuKn,603.75); close(r.utilization,200/603.75); assert.equal(r.pass,true);
  assert.equal(calcShortCorbel5574({grade:'B30',b:300,h0:500,L1:500,Lsup:200,Q:200,Asw:157,sw:150}).ok,false);
});

test('v1.21 Annex F annular and circular benchmarks',()=>{
  const a=calcAnnularColumn5574({grade:'B30',steel:'CB400-V',r1:200,r2:350,rs:300,AsTot:3000,N:2000,M:300,bars:8});
  assert.equal(a.ok,true); close(a.xiCir,0.42120767108478063); close(a.MuKnM,538.0081855371169); close(a.utilization,0.5576123339099329);
  const c=calcCircularColumn5574({grade:'B30',steel:'CB400-V',r:300,rs:250,AsTot:3000,N:2000,M:300,bars:8});
  assert.equal(c.ok,true); assert.equal(c.conditionF8,true); close(c.xiCir,0.4108754644924474,1e-11); close(c.MuKnM,414.5939702926483);
  const h=calcCircularColumn5574({grade:'B30',steel:'CB400-V',r:300,rs:250,AsTot:3000,N:5000,M:300,bars:8});
  assert.equal(h.ok,true); assert.equal(h.conditionF8,false); close(h.xiCir,0.7094586170899703,1e-11); close(h.MuKnM,217.66583497935164);
  assert.equal(calcCircularColumn5574({grade:'B30',steel:'CB500-V',r:300,rs:250,AsTot:3000,N:2000,M:300,bars:8}).ok,false);
});

test('v1.21 annex statuses reflect verified F/G/H and method E',()=>{
  const by=Object.fromEntries(TCVN5574_ANNEX_INDEX.map(x=>[x.annex,x.status]));
  assert.equal(by.F,'VERIFIED'); assert.equal(by.G,'VERIFIED'); assert.equal(by.H,'VERIFIED'); assert.equal(by.E,'VERIFIED_METHOD');
});

test('v1.21 router selects new verified workflows including Annex F',()=>{
  assert.equal(selectEngineeringWorkflow('tính chiều dài neo cốt thép B30 CB400-V ds=20 alpha=1')?.id,'5574-anchorage');
  assert.equal(selectEngineeringWorkflow('tính nối chồng cốt thép B30 CB400-V ds=20')?.id,'5574-lap-splice');
  assert.equal(selectEngineeringWorkflow('tính công xôn ngắn B30 b=300 h0=500 L1=300 Lsup=200 Q=200 Asw=157 sw=150')?.id,'5574-corbel');
  assert.equal(selectEngineeringWorkflow('tính chốt bê tông phụ lục G B30 Q=200 Lk=300 nk=2')?.id,'5574-annex-g');
  const f=solveEngineeringQuestion('tính tiết diện tròn B30 CB400-V r=300 rs=250 AsTot=3000 N=2000 M=300 bars=8');
  assert.equal(f.workflow.id,'5574-circular'); assert.equal(f.workflow.status,'VERIFIED'); assert.equal(f.result?.ok,true); close(f.result.MuKnM,414.5939702926483);
});

test('v1.21 router numeric new workflows',()=>{
  const a=solveEngineeringQuestion('tính chiều dài neo cốt thép B30 CB400-V ds=20 alpha=1');
  assert.equal(a.result?.ok,true); close(a.result.LanMm,608.695652173913);
  const l=solveEngineeringQuestion('tính nối chồng cốt thép chịu kéo B30 CB400-V ds=20');
  assert.equal(l.result?.ok,true); close(l.result.LlapMm,730.4347826086956);
  const h=solveEngineeringQuestion('tính công xôn ngắn B30 b=300 h0=500 L1=300 Lsup=200 Q=200 Asw=157 sw=150');
  assert.equal(h.result?.ok,true); close(h.result.QuKn,603.75);
  const g=solveEngineeringQuestion('tính chốt bê tông phụ lục G B30 Q=200 Lk=300 nk=2');
  assert.equal(g.result?.ok,true); close(g.result.hkMm,144.92753623188406);
});
