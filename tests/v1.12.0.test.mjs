import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDrivenPile10304, lookupQb10304, lookupFi10304, workFactors10304, engineeringQuestionContext } from '../src/pile-workflows.js';
import { structuredTablesForPack } from '../src/codepack-tables.js';
import fs from 'node:fs';

const root=new URL('..',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');

test('v1.12.0 TCVN 10304 tables 2/3/4 are structured and verified',()=>{
  const groups=structuredTablesForPack('TCVN10304_2025');
  for(const id of ['10304-T2','10304-T3','10304-T4']){
    const g=groups.find(x=>x.id===id); assert.ok(g,`missing ${id}`); assert.ok(g.rows.length>0); assert.ok(g.rows.every(r=>String(r.status).toLowerCase()==='verified'));
  }
});

test('v1.12.0 Bảng 2 and Bảng 3 lookups reproduce anchor values',()=>{
  assert.equal(lookupQb10304({depthM:12,soilGroup:'clay',IL:0.3}).provenance.table,'Bảng 2');
  assert.equal(lookupQb10304({depthM:10,soilGroup:'clay',IL:0.3}).value,3500);
  assert.equal(lookupFi10304({avgDepthM:10,soilGroup:'clay',IL:0.5}).value,27);
  assert.equal(lookupFi10304({avgDepthM:40,soilGroup:'sand',sandType:'fine'}).value,74);
});

test('v1.12.0 Bảng 4 applies verified hammer and press factors',()=>{
  assert.deepEqual([workFactors10304({method:'hammer'}).gammaRR,workFactors10304({method:'hammer'}).gammaRf],[1,1]);
  assert.deepEqual([workFactors10304({method:'press',soilGroup:'clay',IL:0.4}).gammaRR,workFactors10304({method:'press',soilGroup:'clay',IL:0.4}).gammaRf],[1.1,1]);
  assert.deepEqual([workFactors10304({method:'press',soilGroup:'sand',sandType:'silty'}).gammaRR,workFactors10304({method:'press',soilGroup:'sand',sandType:'silty'}).gammaRf],[1.1,0.8]);
});

test('v1.12.0 incomplete square pile problem calculates geometry but refuses to invent soil values',()=>{
  const r=calculateDrivenPile10304({shape:'square',sideM:0.4,lengthM:12,tipDepthM:12,method:'hammer',layers:[{top:0,bottom:12,soilGroup:'clay'}]});
  assert.equal(r.ok,false); assert.ok(Math.abs(r.geometry.areaM2-0.16)<1e-12); assert.equal(r.geometry.perimeterM,1.6); assert.ok(r.missing.some(x=>/IL/.test(x)));
});

test('v1.12.0 multilayer driven pile computes each soil layer and total deterministically',()=>{
  const r=calculateDrivenPile10304({shape:'square',sideM:0.4,lengthM:12,tipDepthM:12,method:'hammer',gammaC:1,gammaK:1.4,layers:[
    {top:0,bottom:3,soilGroup:'clay',IL:0.7},{top:3,bottom:6,soilGroup:'clay',IL:0.6},{top:6,bottom:9,soilGroup:'clay',IL:0.5},{top:9,bottom:12,soilGroup:'clay',IL:0.3}
  ]});
  assert.equal(r.ok,true); assert.equal(r.layerResults.length,4); assert.ok(r.tipResistanceKn>0); assert.ok(r.sideResistanceKn>0); assert.ok(r.RkKn>r.tipResistanceKn); assert.ok(Math.abs(r.RdKn-r.RkKn/1.4)<1e-9); assert.equal(r.status,'VERIFIED');
});

test('v1.12.0 AI engineering guardrail identifies the exact missing data for user benchmark',()=>{
  const c=engineeringQuestionContext('tính toán sức chịu tải của một cọc vuông dài 12m và cạnh 0,4m được đóng vào đất dính');
  assert.match(c,/A=0\.1600 m²/); assert.match(c,/u=1\.6000 m/); assert.match(c,/Bảng 2/); assert.match(c,/Bảng 3/); assert.match(c,/THIẾU DỮ LIỆU/);
});

test('v1.12.0 assistant layout keeps chat composer in bottom flex flow and settings collapsed',()=>{
  const css=read('src/styles.css'); const main=read('src/main.js');
  assert.match(css,/panel-body\.panel-chat[\s\S]*overflow:hidden/);
  assert.match(css,/panel-body\.panel-chat \.chat-composer[\s\S]*flex:0 0 auto/);
  assert.match(main,/settingsAiConnection[\s\S]*compact-disclosure/);
  assert.match(main,/panel-\$\{state\.tab\}/);
});
