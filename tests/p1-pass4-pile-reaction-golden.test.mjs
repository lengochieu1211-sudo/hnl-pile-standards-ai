import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePileReactions, calculatePileReactionEnvelope } from '../src/pile-reaction-engine.js';

const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t, `${a} != ${b}`);

function square4(cap=1000,tensionCapacityKn=null){
  return [
    {pileId:'P1',x:-1,y:-1,compressionCapacityKn:cap,tensionCapacityKn},
    {pileId:'P2',x: 1,y:-1,compressionCapacityKn:cap,tensionCapacityKn},
    {pileId:'P3',x:-1,y: 1,compressionCapacityKn:cap,tensionCapacityKn},
    {pileId:'P4',x: 1,y: 1,compressionCapacityKn:cap,tensionCapacityKn},
  ];
}

test('Golden 4-pile combined N+Mx+My exact hand values',()=>{
  const r=calculatePileReactions({
    loadCombination:{id:'G1',N:2000,Mx:400,My:200}, pilePoints:square4(1000)
  });
  const byId=Object.fromEntries(r.reactions.map(x=>[x.pileId,x.demandKn]));
  // centered 2x2: Ni=N/4 + My*x/4 + Mx*y/4
  near(byId.P1,350); near(byId.P2,450); near(byId.P3,550); near(byId.P4,650);
  near(r.equilibrium.sumNKn,2000); near(r.equilibrium.sumMxKnm,400); near(r.equilibrium.sumMyKnm,200);
});

test('Golden exact capacity boundary utilization=1 passes',()=>{
  const r=calculatePileReactions({loadCombination:{id:'BOUND',N:4000,Mx:0,My:0},pilePoints:square4(1000)});
  assert.equal(r.pass,true); near(r.governingPile.utilization,1);
});

test('Golden epsilon above capacity fails',()=>{
  const r=calculatePileReactions({loadCombination:{id:'OVER-EPS',N:4000.00001,Mx:0,My:0},pilePoints:square4(1000)});
  assert.equal(r.pass,false); assert.ok(r.governingPile.utilization>1);
});

test('Golden zero axial with pure moment creates equal compression/tension pairs',()=>{
  const pts=square4(1000,1000);
  const r=calculatePileReactions({loadCombination:{id:'PURE-M',N:0,Mx:400,My:0},pilePoints:pts});
  const vals=r.reactions.map(x=>x.demandKn).sort((a,b)=>a-b);
  assert.deepEqual(vals,[-100,-100,100,100]);
  assert.equal(r.hasTension,true); assert.equal(r.anyUnverifiedTension,false); assert.equal(r.pass,true);
});

test('Golden 3x3 centered grid pure N distributes equally',()=>{
  const pts=[]; let k=1;
  for(const y of [-1,0,1]) for(const x of [-1,0,1]) pts.push({pileId:`P${k++}`,x,y,compressionCapacityKn:500});
  const r=calculatePileReactions({loadCombination:{id:'GRID9',N:2700,Mx:0,My:0},pilePoints:pts});
  r.reactions.forEach(p=>near(p.demandKn,300)); assert.equal(r.pass,true);
});

test('Golden 3x3 Mx gradient matches hand solution',()=>{
  const pts=[]; let k=1;
  for(const y of [-1,0,1]) for(const x of [-1,0,1]) pts.push({pileId:`P${k++}`,x,y,compressionCapacityKn:1000});
  const r=calculatePileReactions({loadCombination:{id:'GRID9-MX',N:2700,Mx:600,My:0},pilePoints:pts});
  // sum y^2 = 6; c = Mx/6 = 100; Ni=300+100y
  const levels=new Map();
  for(const q of r.reactions){ if(!levels.has(q.y)) levels.set(q.y,[]); levels.get(q.y).push(q.demandKn); }
  levels.get(-1).forEach(v=>near(v,200)); levels.get(0).forEach(v=>near(v,300)); levels.get(1).forEach(v=>near(v,400));
});

test('Golden translation invariance when moments are about same global origin',()=>{
  const base=square4(2000);
  const shifted=base.map(p=>({...p,x:p.x+10,y:p.y-7}));
  // To represent same physical load line after coordinate shift, transform moments:
  // My' = My + N*dx ; Mx' = Mx + N*dy
  const N=2000, Mx=400, My=200, dx=10, dy=-7;
  const a=calculatePileReactions({loadCombination:{id:'A',N,Mx,My},pilePoints:base});
  const b=calculatePileReactions({loadCombination:{id:'B',N,Mx:Mx+N*dy,My:My+N*dx},pilePoints:shifted});
  for(let i=0;i<4;i++) near(a.reactions[i].demandKn,b.reactions[i].demandKn,1e-7);
});

test('Golden envelope governing utilization can differ from max compression if capacities differ',()=>{
  const pts=square4(1000);
  pts[0].compressionCapacityKn=400;
  const env=calculatePileReactionEnvelope({pilePoints:pts,loadCombinations:[
    {id:'C1',N:1200,Mx:0,My:0},
    {id:'C2',N:1600,Mx:400,My:400}
  ]});
  assert.equal(env.envelope.governing.pileId,'P1');
  assert.equal(env.envelope.governing.combinationId,'C1');
  near(env.envelope.governing.utilization,0.75);
  assert.equal(env.envelope.maxCompression.combinationId,'C2');
});

test('Golden compression-negative carries moment signs unchanged after only N normalization',()=>{
  const r=calculatePileReactions({
    loadCombination:{id:'ETABS-SIGN',N:-2000,Mx:400,My:200},
    pilePoints:square4(1000), compressionSign:'compression-negative'
  });
  const byId=Object.fromEntries(r.reactions.map(x=>[x.pileId,x.demandKn]));
  near(byId.P1,350); near(byId.P4,650);
});

test('Golden missing/zero compression capacity blocks input',()=>{
  assert.throws(()=>calculatePileReactions({loadCombination:{id:'BAD',N:100},pilePoints:[
    {pileId:'P1',x:0,y:0,compressionCapacityKn:0},
    {pileId:'P2',x:1,y:1,compressionCapacityKn:100}
  ]}),/> 0/);
});

test('Golden one pile is insufficient for moment distribution',()=>{
  assert.throws(()=>calculatePileReactions({loadCombination:{id:'ONE',N:100},pilePoints:[
    {pileId:'P1',x:0,y:0,compressionCapacityKn:1000}
  ]}),/At least 2 piles/);
});

test('Golden invalid compression sign blocks',()=>{
  assert.throws(()=>calculatePileReactions({loadCombination:{id:'SIGN',N:100},pilePoints:square4(),compressionSign:'bad'}),/Unsupported compressionSign/);
});
