import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TCVN10304_QB_DEPTHS, TCVN10304_QB, TCVN10304_FI_DEPTHS, TCVN10304_FI,
  lookupQb10304, lookupFi10304, workFactors10304
} from '../src/pile-workflows.js';
import {
  T10304_TABLE6, T10304_TABLE7_PHI, T10304_TABLE7_A1, T10304_TABLE7_A2,
  T10304_TABLE7_HD, T10304_TABLE7_A3, T10304_TABLE7_D, T10304_TABLE7_A4,
  T10304_TABLE8_DEPTH, T10304_TABLE8_IL, T10304_TABLE8_QB, T10304_TABLE12,
  T10304_TABLE16_QC, T10304_TABLE16, T10304_TABLE17_V, T10304_TABLE17_MV,
  lookupTable6GammaRf10304, lookupTable7Alphas10304, lookupTable8Qb10304,
  lookupTable12M10304, lookupTable15Beta1, lookupTable15SideBeta,
  lookupTable16Cpt10304, lookupTable17Mv10304, kvTable17Formula10304,
  zeta0Table17Formula10304, lookupRockKs10304, lookupSptTipResistance10304,
  lookupSptShaftResistance10304, sptEta10304
} from '../src/tcvn10304-table-engine.js';

const EPS=1e-9;
const close=(a,b,tol=1e-9)=>typeof a==='number'&&typeof b==='number'&&Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b));
const valEq=(a,b)=>a===b || close(a,b);
const mid=(a,b)=>(a+b)/2;

function run(fn){ try{return {ok:true,value:fn()};}catch(error){return {ok:false,error:String(error?.message||error)};} }
function push(cases,row){ cases.push({id:`G${String(cases.length+1).padStart(4,'0')}`, ...row}); }
function exactExpected(v){return {kind:'EXACT',expected:v,v1:v};}
function lineExpected(x,x1,x2,v1,v2){return {kind:'LINEAR-1D',x,x1,x2,v1,v2,expected:v1+(x-x1)*(v2-v1)/(x2-x1)};}
function bilinearExpected(x,y,x1,x2,y1,y2,q11,q12,q21,q22){
  const tx=(x-x1)/(x2-x1),ty=(y-y1)/(y2-y1);
  const lo=q11+tx*(q21-q11),hi=q12+tx*(q22-q12);
  return {kind:'BILINEAR-2D',x,y,x1,x2,y1,y2,q11,q12,q21,q22,expected:lo+ty*(hi-lo)};
}
function blockExpected(){return {kind:'BLOCK',expected:'BLOCK'};}
function plateauExpected(v){return {kind:'BOUNDARY-PLATEAU',expected:v,v1:v};}
function edgeExpected(v){return {kind:'EDGE-BAND',expected:v,v1:v};}

function record(cases,{table,branch,category,input,calc,expected,source}){
  const r=run(calc); const hnl=r.ok?r.value:'BLOCK';
  const status=valEq(hnl,expected.expected)?'PASS':'FAIL';
  push(cases,{table,branch,category,input,hnl,...expected,status,source,error:r.ok?'':r.error});
}

function qbClayKey(il){return `clay_${il.toFixed(1).replace('.','_')}`;}
function fiClayKey(il){return `clay_${il.toFixed(1).replace('.','_')}`;}

export function buildFullTableGoldenCases(){
  const cases=[];
  // BẢNG 2 — every exact numeric cell, every interval midpoint, bilinear cell centre, boundaries/outside.
  const sandTypes=['gravelly','coarse','medium','fine','silty'];
  for(const s of sandTypes){ const ys=TCVN10304_QB[`sand_${s}`];
    TCVN10304_QB_DEPTHS.forEach((z,i)=>record(cases,{table:'Bảng 2',branch:`sand:${s}`,category:'EXACT',input:{z},calc:()=>lookupQb10304({depthM:z,soilGroup:'sand',sandType:s}).value,expected:exactExpected(ys[i]),source:'TCVN 10304:2025 tr.32–33'}));
    for(let i=0;i<TCVN10304_QB_DEPTHS.length-1;i++){const x=mid(TCVN10304_QB_DEPTHS[i],TCVN10304_QB_DEPTHS[i+1]);record(cases,{table:'Bảng 2',branch:`sand:${s}`,category:'MID',input:{z:x},calc:()=>lookupQb10304({depthM:x,soilGroup:'sand',sandType:s}).value,expected:lineExpected(x,TCVN10304_QB_DEPTHS[i],TCVN10304_QB_DEPTHS[i+1],ys[i],ys[i+1]),source:'Chú thích 4'});}
  }
  const il2=[0,.1,.2,.3,.4,.5,.6];
  for(const il of il2){const ys=TCVN10304_QB[qbClayKey(il)]; TCVN10304_QB_DEPTHS.forEach((z,i)=>record(cases,{table:'Bảng 2',branch:`clay:IL=${il}`,category:'EXACT',input:{z,IL:il},calc:()=>lookupQb10304({depthM:z,soilGroup:'clay',IL:il}).value,expected:exactExpected(ys[i]),source:'TCVN 10304:2025 tr.32–33'}));}
  for(let ix=0;ix<TCVN10304_QB_DEPTHS.length-1;ix++) for(let iy=0;iy<il2.length-1;iy++){
    const x=mid(TCVN10304_QB_DEPTHS[ix],TCVN10304_QB_DEPTHS[ix+1]),y=mid(il2[iy],il2[iy+1]);
    const e=bilinearExpected(x,y,TCVN10304_QB_DEPTHS[ix],TCVN10304_QB_DEPTHS[ix+1],il2[iy],il2[iy+1],TCVN10304_QB[qbClayKey(il2[iy])][ix],TCVN10304_QB[qbClayKey(il2[iy+1])][ix],TCVN10304_QB[qbClayKey(il2[iy])][ix+1],TCVN10304_QB[qbClayKey(il2[iy+1])][ix+1]);
    record(cases,{table:'Bảng 2',branch:'clay',category:'MID-2D',input:{z:x,IL:y},calc:()=>lookupQb10304({depthM:x,soilGroup:'clay',IL:y}).value,expected:e,source:'Chú thích 4'});
  }
  record(cases,{table:'Bảng 2',branch:'clay',category:'NEAR-LOW',input:{z:3+1e-6,IL:.3},calc:()=>lookupQb10304({depthM:3+1e-6,soilGroup:'clay',IL:.3}).value,expected:lineExpected(3+1e-6,3,4,2000,2500),source:'Chú thích 4'});
  record(cases,{table:'Bảng 2',branch:'sand:coarse',category:'HIGH-PLATEAU',input:{z:45},calc:()=>lookupQb10304({depthM:45,soilGroup:'sand',sandType:'coarse'}).value,expected:plateauExpected(10500),source:'Chú thích 1'});
  for(const [z,IL] of [[2.999,.3],[12,-.001],[12,.601]]) record(cases,{table:'Bảng 2',branch:'clay',category:'OUTSIDE',input:{z,IL},calc:()=>lookupQb10304({depthM:z,soilGroup:'clay',IL}).value,expected:blockExpected(),source:'NO EXTRAPOLATION'});

  // BẢNG 3 — all exact cells + all midpoint intervals + bilinear centres + boundary/outside.
  const fiSand=[['coarse','sand_coarse_medium'],['medium','sand_coarse_medium'],['fine','sand_fine'],['silty','sand_silty']];
  for(const [s,key] of fiSand){const ys=TCVN10304_FI[key]; TCVN10304_FI_DEPTHS.forEach((z,i)=>record(cases,{table:'Bảng 3',branch:`sand:${s}`,category:'EXACT',input:{z},calc:()=>lookupFi10304({avgDepthM:z,soilGroup:'sand',sandType:s}).value,expected:exactExpected(ys[i]),source:'tr.33–34'})); for(let i=0;i<TCVN10304_FI_DEPTHS.length-1;i++){const x=mid(TCVN10304_FI_DEPTHS[i],TCVN10304_FI_DEPTHS[i+1]);record(cases,{table:'Bảng 3',branch:`sand:${s}`,category:'MID',input:{z:x},calc:()=>lookupFi10304({avgDepthM:x,soilGroup:'sand',sandType:s}).value,expected:lineExpected(x,TCVN10304_FI_DEPTHS[i],TCVN10304_FI_DEPTHS[i+1],ys[i],ys[i+1]),source:'Chú thích 2'});}}
  const il3=[.2,.3,.4,.5,.6,.7,.8,.9,1.0];
  for(const il of il3){const ys=TCVN10304_FI[fiClayKey(il)]; TCVN10304_FI_DEPTHS.forEach((z,i)=>record(cases,{table:'Bảng 3',branch:`clay:IL=${il}`,category:'EXACT',input:{z,IL:il},calc:()=>lookupFi10304({avgDepthM:z,soilGroup:'clay',IL:il}).value,expected:exactExpected(ys[i]),source:'tr.33–34'}));}
  for(let ix=0;ix<TCVN10304_FI_DEPTHS.length-1;ix++) for(let iy=0;iy<il3.length-1;iy++){
    const x=mid(TCVN10304_FI_DEPTHS[ix],TCVN10304_FI_DEPTHS[ix+1]),y=mid(il3[iy],il3[iy+1]);
    const e=bilinearExpected(x,y,TCVN10304_FI_DEPTHS[ix],TCVN10304_FI_DEPTHS[ix+1],il3[iy],il3[iy+1],TCVN10304_FI[fiClayKey(il3[iy])][ix],TCVN10304_FI[fiClayKey(il3[iy+1])][ix],TCVN10304_FI[fiClayKey(il3[iy])][ix+1],TCVN10304_FI[fiClayKey(il3[iy+1])][ix+1]);
    record(cases,{table:'Bảng 3',branch:'clay',category:'MID-2D',input:{z:x,IL:y},calc:()=>lookupFi10304({avgDepthM:x,soilGroup:'clay',IL:y}).value,expected:e,source:'Chú thích 2'});
  }
  record(cases,{table:'Bảng 3',branch:'clay',category:'LOW-IL-PLATEAU',input:{z:4,IL:.1},calc:()=>lookupFi10304({avgDepthM:4,soilGroup:'clay',IL:.1}).value,expected:plateauExpected(53),source:'IL≤0,2 dùng cột ≤0,2'});
  for(const [z,IL] of [[.999,.3],[40.001,.3],[10,1.001]]) record(cases,{table:'Bảng 3',branch:'clay',category:'OUTSIDE',input:{z,IL},calc:()=>lookupFi10304({avgDepthM:z,soilGroup:'clay',IL}).value,expected:blockExpected(),source:'NO EXTRAPOLATION'});

  // BẢNG 4 — automated verified subset; discrete only.
  const b4=[
    ['hammer-clay',()=>workFactors10304({method:'hammer',soilGroup:'clay',IL:.6}),{gammaRR:1,gammaRf:1}],
    ['press-sand-coarse',()=>workFactors10304({method:'press',soilGroup:'sand',sandType:'coarse'}),{gammaRR:1.1,gammaRf:1}],
    ['press-sand-fine',()=>workFactors10304({method:'press',soilGroup:'sand',sandType:'fine'}),{gammaRR:1.1,gammaRf:1}],
    ['press-sand-silty',()=>workFactors10304({method:'press',soilGroup:'sand',sandType:'silty'}),{gammaRR:1.1,gammaRf:.8}],
    ['press-clay-lowIL',()=>workFactors10304({method:'press',soilGroup:'clay',IL:.49}),{gammaRR:1.1,gammaRf:1}],
    ['press-clay-edgeIL',()=>workFactors10304({method:'press',soilGroup:'clay',IL:.5}),{gammaRR:1,gammaRf:1}],
    ['press-clay-highIL',()=>workFactors10304({method:'press',soilGroup:'clay',IL:.9}),{gammaRR:1,gammaRf:1}],
  ];
  for(const [branch,fn,e] of b4){const r=run(fn); const ok=r.ok&&close(r.value.gammaRR,e.gammaRR)&&close(r.value.gammaRf,e.gammaRf); push(cases,{id:`G${String(cases.length+1).padStart(4,'0')}`,table:'Bảng 4',branch,category:'DISCRETE',input:{},hnl:r.ok?`${r.value.gammaRR}|${r.value.gammaRf}`:'BLOCK',kind:'DISCRETE-PAIR',expected:`${e.gammaRR}|${e.gammaRf}`,status:ok?'PASS':'FAIL',source:'tr.34–35',error:r.ok?'':r.error});}
  record(cases,{table:'Bảng 4',branch:'unsupported-method',category:'OUTSIDE',input:{method:'unknown'},calc:()=>workFactors10304({method:'unknown'}).gammaRR,expected:blockExpected(),source:'không tự nội suy category'});

  // BẢNG 6 — every method x soil cell + invalid category.
  for(const row of T10304_TABLE6) for(const soil of ['sand','sandyClay','clayeySand','clay']) record(cases,{table:'Bảng 6',branch:`${row.caseId}:${soil}`,category:'DISCRETE',input:{caseId:row.caseId,soil},calc:()=>lookupTable6GammaRf10304({caseId:row.caseId,soil}).value,expected:exactExpected(row[soil]),source:'tr.39'});
  record(cases,{table:'Bảng 6',branch:'invalid-method',category:'OUTSIDE',input:{},calc:()=>lookupTable6GammaRf10304({caseId:'bad',soil:'clay'}).value,expected:blockExpected(),source:'DISCRETE'});
  record(cases,{table:'Bảng 6',branch:'invalid-soil',category:'OUTSIDE',input:{},calc:()=>lookupTable6GammaRf10304({caseId:T10304_TABLE6[0].caseId,soil:'bad'}).value,expected:blockExpected(),source:'DISCRETE'});

  // BẢNG 7 — exact grid coverage + midpoints + boundaries.
  for(let ip=0;ip<T10304_TABLE7_PHI.length;ip++) record(cases,{table:'Bảng 7',branch:'alpha1/2 exact phi',category:'EXACT',input:{phi:T10304_TABLE7_PHI[ip],hd:10,d:.8},calc:()=>{const r=lookupTable7Alphas10304({phi:T10304_TABLE7_PHI[ip],hdRatio:10,dM:.8});return r.alpha1+r.alpha2/1000;},expected:exactExpected(T10304_TABLE7_A1[ip]+T10304_TABLE7_A2[ip]/1000),source:'tr.41'});
  for(let ih=0;ih<T10304_TABLE7_HD.length;ih++) for(let ip=0;ip<T10304_TABLE7_PHI.length;ip++) record(cases,{table:'Bảng 7',branch:'alpha3 exact grid',category:'EXACT',input:{phi:T10304_TABLE7_PHI[ip],hd:T10304_TABLE7_HD[ih],d:.8},calc:()=>lookupTable7Alphas10304({phi:T10304_TABLE7_PHI[ip],hdRatio:T10304_TABLE7_HD[ih],dM:.8}).alpha3,expected:exactExpected(T10304_TABLE7_A3[ih][ip]),source:'tr.41'});
  for(let id=0;id<T10304_TABLE7_D.length;id++) for(let ip=0;ip<T10304_TABLE7_PHI.length;ip++) record(cases,{table:'Bảng 7',branch:'alpha4 exact grid',category:'EXACT',input:{phi:T10304_TABLE7_PHI[ip],hd:10,d:T10304_TABLE7_D[id]},calc:()=>lookupTable7Alphas10304({phi:T10304_TABLE7_PHI[ip],hdRatio:10,dM:T10304_TABLE7_D[id]}).alpha4,expected:exactExpected(T10304_TABLE7_A4[id][ip]),source:'tr.41'});
  for(let ip=0;ip<T10304_TABLE7_PHI.length-1;ip++){const p=mid(T10304_TABLE7_PHI[ip],T10304_TABLE7_PHI[ip+1]); record(cases,{table:'Bảng 7',branch:'alpha1 midpoint',category:'MID',input:{phi:p},calc:()=>lookupTable7Alphas10304({phi:p,hdRatio:10,dM:.8}).alpha1,expected:lineExpected(p,T10304_TABLE7_PHI[ip],T10304_TABLE7_PHI[ip+1],T10304_TABLE7_A1[ip],T10304_TABLE7_A1[ip+1]),source:'Chú thích 2'});}
  for(let ih=0;ih<T10304_TABLE7_HD.length-1;ih++){const h=mid(T10304_TABLE7_HD[ih],T10304_TABLE7_HD[ih+1]),p=30; const ip=3; const y1=29,y2=31; const e=bilinearExpected(h,p,T10304_TABLE7_HD[ih],T10304_TABLE7_HD[ih+1],y1,y2,T10304_TABLE7_A3[ih][ip],T10304_TABLE7_A3[ih][ip+1],T10304_TABLE7_A3[ih+1][ip],T10304_TABLE7_A3[ih+1][ip+1]); record(cases,{table:'Bảng 7',branch:'alpha3 midpoint',category:'MID-2D',input:{phi:p,hd:h},calc:()=>lookupTable7Alphas10304({phi:p,hdRatio:h,dM:1.2}).alpha3,expected:e,source:'Chú thích 2'});}
  record(cases,{table:'Bảng 7',branch:'alpha3-high-plateau',category:'BOUNDARY',input:{phi:31,hd:30,d:1},calc:()=>lookupTable7Alphas10304({phi:31,hdRatio:30,dM:1}).alpha3,expected:plateauExpected(T10304_TABLE7_A3.at(-1)[4]),source:'h/d≥25'});
  record(cases,{table:'Bảng 7',branch:'alpha4-low-plateau',category:'BOUNDARY',input:{phi:31,hd:10,d:.5},calc:()=>lookupTable7Alphas10304({phi:31,hdRatio:10,dM:.5}).alpha4,expected:plateauExpected(T10304_TABLE7_A4[0][4]),source:'d≤0,8'});
  for(const [phi,hd,d] of [[22.99,10,1],[39.01,10,1],[30,3.99,1],[30,10,4.01]]) record(cases,{table:'Bảng 7',branch:'outside',category:'OUTSIDE',input:{phi,hd,d},calc:()=>lookupTable7Alphas10304({phi,hdRatio:hd,dM:d}).alpha1,expected:blockExpected(),source:'NO EXTRAPOLATION'});

  // BẢNG 8 — every valid exact cell + every valid bilinear cell centre + sparse/outside + high plateau.
  for(let ix=0;ix<T10304_TABLE8_DEPTH.length;ix++) for(let iy=0;iy<T10304_TABLE8_IL.length;iy++) if(T10304_TABLE8_QB[ix][iy]!=null) record(cases,{table:'Bảng 8',branch:'exact grid',category:'EXACT',input:{z:T10304_TABLE8_DEPTH[ix],IL:T10304_TABLE8_IL[iy]},calc:()=>lookupTable8Qb10304({depthM:T10304_TABLE8_DEPTH[ix],IL:T10304_TABLE8_IL[iy]}).value,expected:exactExpected(T10304_TABLE8_QB[ix][iy]),source:'tr.41–42'});
  for(let ix=0;ix<T10304_TABLE8_DEPTH.length-1;ix++) for(let iy=0;iy<T10304_TABLE8_IL.length-1;iy++){const q=[T10304_TABLE8_QB[ix][iy],T10304_TABLE8_QB[ix][iy+1],T10304_TABLE8_QB[ix+1][iy],T10304_TABLE8_QB[ix+1][iy+1]]; if(q.some(v=>v==null))continue; const x=mid(T10304_TABLE8_DEPTH[ix],T10304_TABLE8_DEPTH[ix+1]),y=mid(T10304_TABLE8_IL[iy],T10304_TABLE8_IL[iy+1]); record(cases,{table:'Bảng 8',branch:'cell midpoint',category:'MID-2D',input:{z:x,IL:y},calc:()=>lookupTable8Qb10304({depthM:x,IL:y}).value,expected:bilinearExpected(x,y,T10304_TABLE8_DEPTH[ix],T10304_TABLE8_DEPTH[ix+1],T10304_TABLE8_IL[iy],T10304_TABLE8_IL[iy+1],...q),source:'Chú thích 2'});}
  record(cases,{table:'Bảng 8',branch:'high plateau valid',category:'BOUNDARY',input:{z:45,IL:.3},calc:()=>lookupTable8Qb10304({depthM:45,IL:.3}).value,expected:plateauExpected(3000),source:'z≥40'});
  for(const [z,IL] of [[2.99,.3],[15,-.01],[15,.61],[35,.55]]) record(cases,{table:'Bảng 8',branch:'outside/sparse',category:'OUTSIDE',input:{z,IL},calc:()=>lookupTable8Qb10304({depthM:z,IL}).value,expected:blockExpected(),source:'NO EXTRAPOLATION / sparse cell'});

  // BẢNG 12 — all rows normal + all bonus-eligible dense + invalid.
  for(const row of T10304_TABLE12) record(cases,{table:'Bảng 12',branch:row.id,category:'DISCRETE',input:{dense:false},calc:()=>lookupTable12M10304({soilId:row.id,dense:false}).value,expected:exactExpected(row.M),source:'tr.54'});
  for(const row of T10304_TABLE12.filter(r=>r.denseBonus)) record(cases,{table:'Bảng 12',branch:`${row.id}:dense`,category:'RULE+60%',input:{dense:true},calc:()=>lookupTable12M10304({soilId:row.id,dense:true}).value,expected:exactExpected(row.M*1.6),source:'Chú thích Bảng 12'});
  record(cases,{table:'Bảng 12',branch:'invalid',category:'OUTSIDE',input:{},calc:()=>lookupTable12M10304({soilId:'bad'}).value,expected:blockExpected(),source:'DISCRETE'});

  // BẢNG 15 — exact/edge only, all series + every midpoint blocked.
  const QS=[1000,2500,5000,7500,10000,15000,20000,30000], driven=[.90,.80,.65,.55,.45,.35,.30,.20], sc=[.50,.45,.32,.26,.23,null,null,null], st=[.40,.38,.27,.22,.19,null,null,null];
  for(const [pile,load,vals] of [['driven','compression',driven],['screw','compression',sc],['screw','tension',st]]){
    QS.forEach((q,i)=>record(cases,{table:'Bảng 15',branch:`β1:${pile}:${load}`,category:vals[i]==null?'NULL-CELL':'EXACT',input:{q},calc:()=>lookupTable15Beta1({qs:q,pile,load}).value,expected:vals[i]==null?blockExpected():exactExpected(vals[i]),source:'tr.57'}));
    for(let i=0;i<QS.length-1;i++){const q=mid(QS[i],QS[i+1]);record(cases,{table:'Bảng 15',branch:`β1:${pile}:${load}`,category:'MID-BLOCK',input:{q},calc:()=>lookupTable15Beta1({qs:q,pile,load}).value,expected:blockExpected(),source:'NO AUTO INTERPOLATION'});}
    record(cases,{table:'Bảng 15',branch:`β1:${pile}:${load}`,category:'LOW-EDGE',input:{q:500},calc:()=>lookupTable15Beta1({qs:500,pile,load}).value,expected:edgeExpected(vals[0]),source:'≤ first point'});
    record(cases,{table:'Bảng 15',branch:`β1:${pile}:${load}`,category:'HIGH-EDGE',input:{q:35000},calc:()=>lookupTable15Beta1({qs:35000,pile,load}).value,expected:pile==='driven'?edgeExpected(vals.at(-1)):blockExpected(),source:'≥ last only driven'});
  }
  const FS=[20,40,60,80,100,120], sideSeries={
    'mechanical:sand':[2.4,1.65,1.2,1,.85,.75], 'mechanical:clay':[1.5,1,.75,.6,.5,.4],
    'electric:sand':[.75,.6,.55,.5,.45,.4], 'electric:clay':[1,.75,.6,.45,.4,.3]
  };
  for(const [key,vals] of Object.entries(sideSeries)){const [probe,soil]=key.split(':');FS.forEach((f,i)=>record(cases,{table:'Bảng 15',branch:`side:${key}`,category:'EXACT',input:{f},calc:()=>lookupTable15SideBeta({fs:f,probe,soil}).value,expected:exactExpected(vals[i]),source:'tr.57'})); for(let i=0;i<FS.length-1;i++){const f=mid(FS[i],FS[i+1]);record(cases,{table:'Bảng 15',branch:`side:${key}`,category:'MID-BLOCK',input:{f},calc:()=>lookupTable15SideBeta({fs:f,probe,soil}).value,expected:blockExpected(),source:'NO AUTO INTERPOLATION'});} record(cases,{table:'Bảng 15',branch:`side:${key}`,category:'LOW-EDGE',input:{f:10},calc:()=>lookupTable15SideBeta({fs:10,probe,soil}).value,expected:edgeExpected(vals[0]),source:'≤ first'}); record(cases,{table:'Bảng 15',branch:`side:${key}`,category:'HIGH-EDGE',input:{f:150},calc:()=>lookupTable15SideBeta({fs:150,probe,soil}).value,expected:edgeExpected(vals.at(-1)),source:'≥ last'});}
  record(cases,{table:'Bảng 15',branch:'side:electric:sand:saturated',category:'RULE x0.5',input:{f:60},calc:()=>lookupTable15SideBeta({fs:60,probe:'electric',soil:'sand',saturatedSand:true}).value,expected:exactExpected(.55*.5),source:'Chú thích'});

  // BẢNG 16 — every numeric exact point, every numeric adjacent midpoint, outside/null blocks.
  for(const [key,vals] of Object.entries(T10304_TABLE16)){const component=key.startsWith('qb')?'qb':'fi',soil=key.endsWith('Clay')?'clay':'sand'; for(let i=0;i<T10304_TABLE16_QC.length;i++) if(vals[i]!=null) record(cases,{table:'Bảng 16',branch:key,category:'EXACT',input:{qc:T10304_TABLE16_QC[i]},calc:()=>lookupTable16Cpt10304({qc:T10304_TABLE16_QC[i],soil,component}).value,expected:exactExpected(vals[i]),source:'tr.58'}); for(let i=0;i<T10304_TABLE16_QC.length-1;i++) if(vals[i]!=null&&vals[i+1]!=null){const q=mid(T10304_TABLE16_QC[i],T10304_TABLE16_QC[i+1]);record(cases,{table:'Bảng 16',branch:key,category:'MID',input:{qc:q},calc:()=>lookupTable16Cpt10304({qc:q,soil,component}).value,expected:lineExpected(q,T10304_TABLE16_QC[i],T10304_TABLE16_QC[i+1],vals[i],vals[i+1]),source:'Chú thích 1'});}}
  // explicit outside/null tests per branch
  for(const [key,component,soil,qc] of [['qbSand','qb','sand',2500],['qbClay','qb','clay',13000],['fiSand','fi','sand',2500],['fiClay','fi','clay',13000],['qbSand','qb','sand',21000],['qbClay','qb','clay',500]]) record(cases,{table:'Bảng 16',branch:key,category:'OUTSIDE/NULL',input:{qc},calc:()=>lookupTable16Cpt10304({qc,soil,component}).value,expected:blockExpected(),source:'NO EXTRAPOLATION / null'});

  // BẢNG 17 — all exact mv + all mid mv + kv/zeta formula at grid and midpoints + outside.
  for(let i=0;i<T10304_TABLE17_V.length;i++){const v=T10304_TABLE17_V[i];record(cases,{table:'Bảng 17',branch:'m_v',category:'EXACT',input:{nu:v},calc:()=>lookupTable17Mv10304(v).value,expected:exactExpected(T10304_TABLE17_MV[i]),source:'tr.60'}); record(cases,{table:'Bảng 17',branch:'k_v',category:'FORMULA',input:{nu:v},calc:()=>kvTable17Formula10304(v),expected:{kind:'FORMULA-KV',x:v,expected:2.82-3.78*v+2.18*v*v},source:'CT (33)'}); record(cases,{table:'Bảng 17',branch:'zeta0',category:'FORMULA',input:{nu:v},calc:()=>zeta0Table17Formula10304(v),expected:{kind:'FORMULA-ZETA',x:v,expected:Math.abs(v-.5)<1e-12?.25:(1-2*v)/(2*Math.log(3-4*v))},source:'CT (34)'});}
  for(let i=0;i<T10304_TABLE17_V.length-1;i++){const v=mid(T10304_TABLE17_V[i],T10304_TABLE17_V[i+1]);record(cases,{table:'Bảng 17',branch:'m_v',category:'MID',input:{nu:v},calc:()=>lookupTable17Mv10304(v).value,expected:lineExpected(v,T10304_TABLE17_V[i],T10304_TABLE17_V[i+1],T10304_TABLE17_MV[i],T10304_TABLE17_MV[i+1]),source:'local linear'});record(cases,{table:'Bảng 17',branch:'k_v',category:'FORMULA-MID',input:{nu:v},calc:()=>kvTable17Formula10304(v),expected:{kind:'FORMULA-KV',x:v,expected:2.82-3.78*v+2.18*v*v},source:'CT (33)'});record(cases,{table:'Bảng 17',branch:'zeta0',category:'FORMULA-MID',input:{nu:v},calc:()=>zeta0Table17Formula10304(v),expected:{kind:'FORMULA-ZETA',x:v,expected:(1-2*v)/(2*Math.log(3-4*v))},source:'CT (34)'});}
  for(const v of [-.001,.501]) for(const [branch,calc] of [['m_v',()=>lookupTable17Mv10304(v).value],['k_v',()=>kvTable17Formula10304(v)],['zeta0',()=>zeta0Table17Formula10304(v)]]) record(cases,{table:'Bảng 17',branch,category:'OUTSIDE',input:{nu:v},calc,expected:blockExpected(),source:'NO EXTRAPOLATION'});


  // BẢNG 1 — RQD -> Ks. Exact anchors, local-linear midpoints, plateaus, outside block.
  const rqdX=[0,25,50,75,90,100],ksY=[.22,.22,.32,.60,1,1];
  rqdX.forEach((x,i)=>record(cases,{table:'Bảng 1',branch:'RQD→Ks',category:'EXACT',input:{RQD:x},calc:()=>lookupRockKs10304(x).value,expected:exactExpected(ksY[i]),source:'TCVN 10304:2025 Bảng 1 tr.29'}));
  for(let i=0;i<rqdX.length-1;i++){const x=mid(rqdX[i],rqdX[i+1]);record(cases,{table:'Bảng 1',branch:'RQD→Ks',category:ksY[i]===ksY[i+1]?'PLATEAU-MID':'MID',input:{RQD:x},calc:()=>lookupRockKs10304(x).value,expected:lineExpected(x,rqdX[i],rqdX[i+1],ksY[i],ksY[i+1]),source:'Bảng 1 Chú thích 1–2'});}
  for(const x of [-.001,100.001]) record(cases,{table:'Bảng 1',branch:'RQD→Ks',category:'OUTSIDE',input:{RQD:x},calc:()=>lookupRockKs10304(x).value,expected:blockExpected(),source:'RQD 0–100'});

  // PHỤ LỤC D — Bảng D.1. Golden duplicates the published coefficients here
  // so the production lookup cannot silently self-validate against itself.
  const d1={
    bored:{tipSand:120,tipCap:7500,tipClayCu:6,shaftSand:3.3,shaftSandCap:165,shaftClayCu:1,shaftClayCap:100},
    'vibro-pipe':{tipSand:150,tipCap:9000,tipClayCu:6,shaftSand:1.5,shaftSandCap:75,shaftClayCu:.4,shaftClayCap:50},
    screw:{tipSand:150,tipCap:9000,tipClayN:150,shaftSand:2,shaftSandCap:100,shaftClayCu:.5,shaftClayCap:62.5},
    driven:{tipSand:300,tipCap:18000,tipClayCu:6,shaftSand:2,shaftSandCap:100,shaftClayCu:.8,shaftClayCap:100}
  };
  const nCases=[0,1,10,25,50,100];
  for(const [pile,row] of Object.entries(d1)){
    for(const N of nCases){
      record(cases,{table:'Bảng D.1',branch:`tip-sand:${pile}`,category:'FORMULA+CAP',input:{N,eta:1},calc:()=>lookupSptTipResistance10304({pileType:pile,soilGroup:'sand',N,eta:1}).value,expected:exactExpected(Math.min(row.tipSand*N,row.tipCap)),source:'Phụ lục D tr.111'});
      record(cases,{table:'Bảng D.1',branch:`shaft-sand:${pile}`,category:'FORMULA+CAP',input:{N},calc:()=>lookupSptShaftResistance10304({pileType:pile,soilGroup:'sand',N}).value,expected:exactExpected(Math.min(row.shaftSand*N,row.shaftSandCap)),source:'Phụ lục D tr.111'});
    }
    if(row.tipClayN!=null){for(const N of nCases) record(cases,{table:'Bảng D.1',branch:`tip-clay:${pile}`,category:'FORMULA+CAP',input:{N},calc:()=>lookupSptTipResistance10304({pileType:pile,soilGroup:'clay',N,eta:1}).value,expected:exactExpected(Math.min(row.tipClayN*N,row.tipCap)),source:'Phụ lục D tr.111'});}
    else {for(const cu of [0,10,50,100,200]) record(cases,{table:'Bảng D.1',branch:`tip-clay:${pile}`,category:'FORMULA+CAP',input:{cu},calc:()=>lookupSptTipResistance10304({pileType:pile,soilGroup:'clay',cuKpa:cu,eta:1}).value,expected:exactExpected(Math.min(row.tipClayCu*cu,row.tipCap)),source:'Phụ lục D tr.111'});}
    for(const cu of [0,10,50,100,200]) record(cases,{table:'Bảng D.1',branch:`shaft-clay:${pile}`,category:'FORMULA+CAP',input:{cu},calc:()=>lookupSptShaftResistance10304({pileType:pile,soilGroup:'clay',cuKpa:cu}).value,expected:exactExpected(Math.min(row.shaftClayCu*cu,row.shaftClayCap)),source:'Phụ lục D tr.111'});
  }
  for(const N of [1,4,10,20]) record(cases,{table:'Bảng D.1',branch:'shaft-clay:bored:cu=6.25Nc',category:'DERIVED-CU',input:{N},calc:()=>lookupSptShaftResistance10304({pileType:'bored',soilGroup:'clay',N}).value,expected:exactExpected(Math.min(6.25*N,100)),source:'Phụ lục D tr.110–111'});
  const etaCases=[
    ['screw-closed',()=>sptEta10304({pileType:'screw',closedTip:true}).value,1],
    ['screw-open',()=>sptEta10304({pileType:'screw',closedTip:false}).value,.8],
    ['driven-closed',()=>sptEta10304({pileType:'driven',closedTip:true}).value,1],
    ['driven-open-r4',()=>sptEta10304({pileType:'driven',closedTip:false,lengthM:12,innerDiameterM:3}).value,.64],
    ['driven-open-r6',()=>sptEta10304({pileType:'driven',closedTip:false,lengthM:12,innerDiameterM:2}).value,.8]
  ];
  for(const [branch,calc,e] of etaCases) record(cases,{table:'Bảng D.1',branch:`eta:${branch}`,category:'ETA',input:{},calc,expected:exactExpected(e),source:'Bảng D.1 tr.111'});
  record(cases,{table:'Bảng D.1',branch:'eta:driven-open-r<2',category:'OUTSIDE',input:{},calc:()=>sptEta10304({pileType:'driven',closedTip:false,lengthM:1.5,innerDiameterM:1}).value,expected:blockExpected(),source:'Không có nhánh VERIFIED'});

  return cases;
}

export function summarizeFullTableGolden(cases){
  const by={}; for(const c of cases){const k=c.table; by[k]??={cases:0,pass:0,fail:0};by[k].cases++;if(c.status==='PASS')by[k].pass++;else by[k].fail++;}
  return {total:cases.length,pass:cases.filter(c=>c.status==='PASS').length,fail:cases.filter(c=>c.status!=='PASS').length,byTable:by};
}

const self=fileURLToPath(import.meta.url);
if(process.argv[1] && path.resolve(process.argv[1])===path.resolve(self)){
  const cases=buildFullTableGoldenCases(), summary=summarizeFullTableGolden(cases);
  const out=process.argv[2]||path.resolve(path.dirname(self),'../artifacts/full-table-golden-v1.25.7.json');
  fs.mkdirSync(path.dirname(out),{recursive:true}); fs.writeFileSync(out,JSON.stringify({version:'1.25.7',generatedAt:new Date().toISOString(),summary,cases},null,2));
  console.log(JSON.stringify(summary,null,2)); if(summary.fail) process.exitCode=1;
}
