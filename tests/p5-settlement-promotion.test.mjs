import test from 'node:test';
import assert from 'node:assert/strict';
import { calcSingleSettlement10304, calcGroupSettlement10304, calcEquivalentBlock10304 } from '../src/tcvn10304-advanced.js';
import { engineeringExcelPayload } from '../src/engineering-router.js';
const close=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);

test('P5.5 single short branch CT34/Table17 independent Golden',()=>{
  const x=calcSingleSettlement10304('N=1 MN G1=10 MPa G2=30 MPa L=10 m d=0.5 m v1=0.3 v2=0.3');
  assert.equal(x.ok,true); assert.equal(x.branch,'short');
  close(x.k,6.666666666666667); close(x.mv,1.607); close(x.settlementM,0.004405922609927312);
});

test('P5.5 single long branch CT30-33 independent Golden',()=>{
  const x=calcSingleSettlement10304('N=1 MN G1=20 MPa G2=20 MPa L=10 m d=0.5 m v1=0.25 v2=0.35 EA=5000 MN');
  assert.equal(x.ok,true); assert.equal(x.branch,'long');
  close(x.k,20); close(x.settlementM,0.0038263888459508667);
  assert.ok(x.provenance.some(v=>v.includes('CT (30)-(33)')));
});

test('P5.5 single applicability guard blocks invalid geometry',()=>{
  const x=calcSingleSettlement10304('N=1 MN G1=10 MPa G2=30 MPa L=2 m d=0.5 m v1=0.3 v2=0.3');
  assert.equal(x.ok,false); assert.equal(x.invalid,true); assert.ok(x.missing.some(v=>v.includes('L/d > 5')));
});

test('P5.5 Table17 Poisson domain is blocking and never extrapolated',()=>{
  const x=calcSingleSettlement10304('N=1 MN G1=10 MPa G2=30 MPa L=10 m d=0.5 m v1=0.6 v2=0.3');
  assert.equal(x.ok,false); assert.equal(x.invalid,true); assert.ok(x.missing.some(v=>v.includes('không ngoại suy')));
});

test('P5.5 group CT37/38 independent Golden',()=>{
  const x=calcGroupSettlement10304('G1=10 MPa G2=30 MPa L=10 m v1=0.3 v2=0.3 s_single=0.004405922609927312 m a1=2 m N1=0.5 MN; a2=3 m N2=0.7 MN');
  assert.equal(x.ok,true); assert.equal(x.interactionFormula,'CT37');
  close(x.interactionSumMN,0.04357408085944199); close(x.settlementM,0.004841663418521732);
});

test('P5.5 group CT39 and CT40 optional branches remain deterministic',()=>{
  const x=calcGroupSettlement10304('G1=10 MPa G2=30 MPa L=10 m v1=0.3 v2=0.3 s_single=0.004405922609927312 m sum_deltaN=0.04 MN Li=8 m Lj=10 m kw0=100 MN/m Nu=200 MN m_corr=2');
  assert.equal(x.ok,true); close(x.equivalentLengthM,9.055385138137417); close(x.kw,89.44271909999159);
});

test('P5.5 CT46 irregular-layout interaction independent Golden and provenance',()=>{
  const x=calcGroupSettlement10304('bố trí không đều CT46 G1=10 MPa G2=30 MPa L=10 m d=0.5 m v1=0.3 v2=0.3 s_single=0.004405922609927312 m a1=2 m N1=0.5 MN');
  assert.equal(x.ok,true); assert.equal(x.interactionFormula,'CT46');
  close(x.pairs[0].k1,0.11140846016432673); close(x.pairs[0].k2,0.15525751541904825); close(x.pairs[0].delta,0.14751056148380423);
  close(x.settlementM,0.0051434754173463335); assert.ok(x.provenance.some(v=>v.includes('CT (46)')));
});

test('P5.5 CT46 refuses missing pile diameter instead of inventing d',()=>{
  const x=calcGroupSettlement10304('CT46 G1=10 MPa G2=30 MPa L=10 m v1=0.3 v2=0.3 s_single=0.0044 m a1=2 m N1=0.5 MN');
  assert.equal(x.ok,false); assert.ok(x.missing.some(v=>v.includes('d (m)')));
});

test('P5.5 equivalent block CT41-45 exact Golden and export safety',()=>{
  const q='khối quy ước sef=0.01 m E1=20 MPa E2=30 MPa v2=0.3 p=200 kPa a=2 m d=0.5 m L=10 m Epile=30000 MPa Apile=0.19635 m2';
  const x=calcEquivalentBlock10304(q); assert.equal(x.ok,true);
  close(x.P,800); close(x.dsp,0.00825827552238443); close(x.dsc,0.0010864952041422628); close(x.settlementM,0.019344770726526694);
  assert.equal(engineeringExcelPayload(q).canExport,true);
  assert.equal(engineeringExcelPayload('khối quy ước sef=0.01 m E1=20 MPa').canExport,false);
});
