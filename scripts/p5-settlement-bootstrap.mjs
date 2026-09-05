import fs from 'node:fs';

const path='src/tcvn10304-advanced.js';
let s=fs.readFileSync(path,'utf8');
if(s.includes('interactionDeltaCt46')) {
  console.log('P5.5 CT46 patch already applied.');
  process.exit(0);
}
const oldFn="function interactionDelta(G1,G2,L,v,a){ const kv=2.82-3.78*v+2.18*v*v; const r=kv*G1*L/(2*G2*a); return r>1?0.17*Math.log(r):0; }";
const newFn=`function interactionDeltaCt37(G1,G2,L,v,a){ const kv=2.82-3.78*v+2.18*v*v; const r=kv*G1*L/(2*G2*a); return {delta:r>1?0.17*Math.log(r):0,kv,r}; }
function interactionDeltaCt46(G1,G2,L,v,a,d){
  const k1=(1-v)/(2*Math.PI);
  const k2=(0.34-0.29*v)*Math.pow(L/d,-0.163);
  const delta=k1/(k2+G2*a/(G1*L));
  return {delta,k1,k2};
}`;
if(!s.includes(oldFn)) throw new Error('P5.5 anchor interactionDelta not found');
s=s.replace(oldFn,newFn);
const oldStart="  const v=(v1+v2)/2; let sum=0; const pairs=[];";
const newStart=`  const v=(v1+v2)/2;
  if(v<0||v>0.5||v1<0||v1>0.5||v2<0||v2>0.5) return {ok:false,invalid:true,missing:['CT (37)/(46): ν1, ν2 và ν trung bình phải trong 0–0,5; không ngoại suy.']};
  const useCt46=/\\bct\\s*46\\b|cong\\s*thuc\\s*46|công\\s*thức\\s*46|bo\\s*tri\\s*khong\\s*deu|bố\\s*trí\\s*không\\s*đều/i.test(q);
  const dCt46=useCt46?pick(q,['d'],'m?'):null;
  if(useCt46 && !(dCt46>0)) return {ok:false,missing:['d (m) của cọc để dùng CT (46) cho bố trí không đều']};
  let sum=0; const pairs=[];`;
if(!s.includes(oldStart)) throw new Error('P5.5 anchor group start not found');
s=s.replace(oldStart,newStart);
const oldLoop="  while((m=re.exec(q))){ const a=num(m[2]),Nj=num(m[3]),delta=interactionDelta(G1,G2,L,v,a); sum+=delta*Nj; pairs.push({a,Nj,delta}); }";
const newLoop=`  while((m=re.exec(q))){
    const a=num(m[2]),Nj=num(m[3]);
    const meta=useCt46?interactionDeltaCt46(G1,G2,L,v,a,dCt46):interactionDeltaCt37(G1,G2,L,v,a);
    const delta=meta.delta; sum+=delta*Nj;
    pairs.push({a,Nj,delta,...(useCt46?{k1:meta.k1,k2:meta.k2}:{kv:meta.kv,r:meta.r})});
  }`;
if(!s.includes(oldLoop)) throw new Error('P5.5 anchor group loop not found');
s=s.replace(oldLoop,newLoop);
const oldSteps="  const steps=[`CT (36),(37): tính δ cho từng khoảng cách cọc.`,`Σ(δij·Nj)=${sum.toFixed(5)} MN.`,`CT (38): s_i=s_single+Σδij·Nj/(G1L)=${s.toFixed(6)} m = ${(s*1000).toFixed(2)} mm.`];";
const newSteps="  const steps=[useCt46?`CT (46): bố trí không đều → dùng δ=k1/(k2+G2·a/(G1·L)) thay CT (37).`:`CT (36),(37): tính δ cho từng khoảng cách cọc.`,`Σ(δij·Nj)=${sum.toFixed(5)} MN.`,`CT (38): s_i=s_single+Σδij·Nj/(G1L)=${s.toFixed(6)} m = ${(s*1000).toFixed(2)} mm.`];";
if(!s.includes(oldSteps)) throw new Error('P5.5 anchor group steps not found');
s=s.replace(oldSteps,newSteps);
const oldReturn="  return {ok:true,settlementM:s,interactionSumMN:sum,pairs,equivalentLengthM,kw,inputs:{G1,G2,L,v1,v2,sSingle,Ni,sumDeltaN:sum,pairs,Li,Lj,kw0,Nu,mCorr},steps,provenance:['TCVN 10304:2025 · 7.4.3.1-7.4.3.4 · CT (36)-(40) · trang 61-62']};";
const newReturn="  return {ok:true,settlementM:s,interactionSumMN:sum,pairs,equivalentLengthM,kw,interactionFormula:useCt46?'CT46':'CT37',inputs:{G1,G2,L,v1,v2,sSingle,Ni,sumDeltaN:sum,pairs,Li,Lj,kw0,Nu,mCorr,d:dCt46},steps,provenance:useCt46?['TCVN 10304:2025 · 7.4.4.5 · CT (46) · trang 64-65','CT (46) thay CT (37) trong điều kiện bố trí cọc không đều nêu tại 7.4.4.5']:['TCVN 10304:2025 · 7.4.3.1-7.4.3.4 · CT (36)-(40) · trang 61-62']};";
if(!s.includes(oldReturn)) throw new Error('P5.5 anchor group return not found');
s=s.replace(oldReturn,newReturn);
fs.writeFileSync(path,s,'utf8');
console.log('P5.5 CT46 patch applied.');
