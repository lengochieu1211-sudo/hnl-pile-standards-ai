import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { calculateDrivenPile10304, calculateRockEndBearing10304, calculateBoredPile10304, calculateSptPile10304 } from '../src/pile-workflows.js';
import { calculateNearCenteredRectPileCapacity5574, calculateCircularPileMaterialCheck5574 } from '../src/pile-material-engine.js';
import { combineLockedPileResistance } from '../src/pile-capacity-engine.js';
import { evaluateIntegratedPileCapacityExcelModel } from '../src/p1-material-e2e-excel-model.js';

const outPath=resolve(process.argv[2]||'artifacts/p1-material-e2e/material-e2e-golden-v1.25.7.json');
const relTol=1e-10,absTol=1e-9;
const close=(a,b)=>Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Math.abs(Number(a)-Number(b))<=Math.max(absTol,relTol*Math.max(1,Math.abs(Number(a)),Math.abs(Number(b))));
const material=(over={})=>({grade:'B30',steel:'CB400-V',shape:'square',sideMm:400,widthMm:400,heightMm:400,AsTotMm2:1600,L0Mm:4000,e0Mm:400/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long',...over});
const driven={shape:'square',sideM:.4,lengthM:12,tipDepthM:12,method:'hammer',layers:[{top:0,bottom:3,soilGroup:'clay',IL:.7},{top:3,bottom:8,soilGroup:'clay',IL:.5},{top:8,bottom:15,soilGroup:'clay',IL:.3}],gammaK:1.4,gammaN:1.15};
const rock={shape:'square',sideM:.4,rockCompressiveStrengthKpa:50000,rqdPercent:100,gammaG:1.1,embedmentLengthM:5,embeddedOuterDiameterM:.4,minimumQbKpa:1000,gammaK:1.2,gammaN:1.15};
const bored={shape:'square',sideM:.4,tipDepthM:12,shaftStartDepthM:12,maxSegmentM:1,layers:[{top:0,bottom:15,soilGroup:'clay',soilClass:'clay',IL:.3}],methodCaseId:'bored-64a-64b',gammaK:1.4,gammaN:1.15};
const spt={pileType:'bored',shape:'square',sideM:.4,lengthM:12,tipDepthM:12,shaftStartDepthM:0,layers:[{top:0,bottom:6,soilGroup:'sand',sptN:10},{top:6,bottom:15,soilGroup:'sand',sptN:20}],sptPoints:[{depthM:11.5,N:20},{depthM:12,N:30},{depthM:12.5,N:40}],gammaK:1.5,gammaN:1.15};
const defs=[
  {id:'DRIVEN-SOIL-GOVERNS',soilWorkflowId:'10304-driven',soilInput:driven,soilFn:calculateDrivenPile10304,materialInput:material(),expectedGoverning:'SOIL'},
  {id:'ROCK-MATERIAL-GOVERNS',soilWorkflowId:'10304-end-bearing',soilInput:rock,soilFn:calculateRockEndBearing10304,materialInput:material({grade:'B20',AsTotMm2:800}),expectedGoverning:'MATERIAL'},
  {id:'BORED-SOIL-GOVERNS',soilWorkflowId:'10304-bored',soilInput:bored,soilFn:calculateBoredPile10304,materialInput:material(),expectedGoverning:'SOIL'},
  {id:'SPT-SOIL-GOVERNS',soilWorkflowId:'10304-spt',soilInput:spt,soilFn:calculateSptPile10304,materialInput:material(),expectedGoverning:'SOIL'}
];
const cases=[];
for(const d of defs){
  const soil=d.soilFn(d.soilInput),mat=calculateNearCenteredRectPileCapacity5574(d.materialInput);
  const engine=combineLockedPileResistance({soilWorkflowId:d.soilWorkflowId,soilResult:soil,soilInput:d.soilInput,materialResult:mat});
  const excel=evaluateIntegratedPileCapacityExcelModel({soilWorkflowId:d.soilWorkflowId,soilInput:d.soilInput,materialInput:d.materialInput});
  const metrics=[
    ['Rsoil',engine.soilResistanceKn,excel.soilResistanceKn,'kN'],['Rmaterial',engine.materialResistanceKn,excel.materialResistanceKn,'kN'],['Rpile',engine.pileResistanceKn,excel.pileResistanceKn,'kN'],['gammaN',engine.gammaN,excel.gammaN,'-'],['NdMaxFinal',engine.demandLimitKn,excel.demandLimitKn,'kN']
  ].map(([name,a,b,unit])=>({name,engine:a,excelFormulaModel:b,diff:Number(a)-Number(b),unit,pass:close(a,b)}));
  cases.push({id:d.id,soilWorkflowId:d.soilWorkflowId,soilStatus:soil.status,materialStatus:mat.status,engineOk:engine.ok,excelOk:excel.ok,governingEngine:engine.governing,governingExcel:excel.governing,expectedGoverning:d.expectedGoverning,metrics,pass:Boolean(engine.ok&&excel.ok&&engine.governing===d.expectedGoverning&&excel.governing===d.expectedGoverning&&metrics.every(m=>m.pass))});
}

const boundary=[];
const baseSoil=calculateDrivenPile10304(driven),baseMat=calculateNearCenteredRectPileCapacity5574(material());
const addBoundary=(id,result,pattern=null,extraPass=true)=>{const text=(result.issues||[]).join(' ');boundary.push({id,ok:result.ok,issues:result.issues||[],pass:result.ok===false&&extraPass&&(!pattern||pattern.test(text))});};
addBoundary('MISSING-GAMMAK',combineLockedPileResistance({soilWorkflowId:'10304-driven',soilResult:{...baseSoil,gammaK:null,RdKn:null},soilInput:driven,materialResult:baseMat}),/γk|Rd/);
addBoundary('MIXED-MANUAL-SOIL',combineLockedPileResistance({soilWorkflowId:'10304-driven',soilResult:{...baseSoil,status:'MIXED\/MANUAL'},soilInput:driven,materialResult:baseMat}),/VERIFIED/);
const preliminary=calculateRockEndBearing10304({shape:'square',sideM:.4,rockCompressiveStrengthKpa:31300,rqdPercent:30,gammaG:1.4,embedmentLengthM:5,embeddedOuterDiameterM:.4,gammaK:1.4});
addBoundary('ROCK-PRELIMINARY',combineLockedPileResistance({soilWorkflowId:'10304-end-bearing',soilResult:preliminary,soilInput:{shape:'square',sideM:.4},materialResult:baseMat}),/sơ bộ|VERIFIED/);
addBoundary('GEOMETRY-MISMATCH',combineLockedPileResistance({soilWorkflowId:'10304-driven',soilResult:baseSoil,soilInput:driven,materialResult:calculateNearCenteredRectPileCapacity5574(material({sideMm:450,widthMm:450,heightMm:450,e0Mm:15}))}),/không đồng nhất/);
const circleMaterial=calculateCircularPileMaterialCheck5574({grade:'B30',steel:'CB400-V',r:300,rs:250,AsTot:3000,N:2000,M:300,barCount:8});
addBoundary('CIRCULAR-NM-NOT-SCALAR',combineLockedPileResistance({soilWorkflowId:'10304-driven',soilResult:{...baseSoil,geometry:{shape:'circle',diameterM:.6}},soilInput:{...driven,shape:'circle',diameterM:.6,sideM:null},materialResult:circleMaterial}),/cọc vuông|Rmaterial/);
const gammaSeparate=combineLockedPileResistance({soilWorkflowId:'10304-driven',soilResult:baseSoil,soilInput:driven,materialResult:baseMat,gammaN:2});
boundary.push({id:'GAMMAN-AFTER-MIN',ok:gammaSeparate.ok,Rpile:gammaSeparate.pileResistanceKn,Rsoil:gammaSeparate.soilResistanceKn,Rmaterial:gammaSeparate.materialResistanceKn,gammaN:gammaSeparate.gammaN,NdMax:gammaSeparate.demandLimitKn,pass:Boolean(gammaSeparate.ok&&close(gammaSeparate.pileResistanceKn,Math.min(gammaSeparate.soilResistanceKn,gammaSeparate.materialResistanceKn))&&close(gammaSeparate.demandLimitKn,gammaSeparate.pileResistanceKn/2))});

const normativeBenchmarks=[
  {id:'B30-CB400-CT50',actual:baseMat.NuKn,expected:2952,unit:'kN',source:'TCVN 5574:2018 · Bảng 7/13/16 · CT (50)',pass:close(baseMat.NuKn,2952)},
  {id:'ROCK-RD',actual:calculateRockEndBearing10304(rock).RdKn,expected:2666.666666666667,unit:'kN',source:'Locked TCVN 10304 rock child workflow',pass:close(calculateRockEndBearing10304(rock).RdKn,2666.666666666667)},
  {id:'ROCK-MIN',actual:cases.find(c=>c.id==='ROCK-MATERIAL-GOVERNS')?.metrics.find(m=>m.name==='Rpile')?.engine,expected:1908,unit:'kN',source:'Rpile=min(Rd,10304, Nu,5574)',pass:close(cases.find(c=>c.id==='ROCK-MATERIAL-GOVERNS')?.metrics.find(m=>m.name==='Rpile')?.engine,1908)}
];
const summary={workflowCases:cases.length,workflowPass:cases.filter(c=>c.pass).length,intermediateMetrics:cases.reduce((n,c)=>n+c.metrics.length,0),intermediatePass:cases.reduce((n,c)=>n+c.metrics.filter(m=>m.pass).length,0),boundaryCases:boundary.length,boundaryPass:boundary.filter(b=>b.pass).length,normativeBenchmarks:normativeBenchmarks.length,normativeBenchmarkPass:normativeBenchmarks.filter(b=>b.pass).length};
summary.pass=cases.every(c=>c.pass)&&boundary.every(b=>b.pass)&&normativeBenchmarks.every(b=>b.pass);
const report={schema:'HNL-P1-MATERIAL-RSOIL-RMATERIAL-E2E-GOLDEN',version:'1.25.7',generatedAt:new Date().toISOString(),sourceHierarchy:['TCVN PDF is normative','Each soil child Calculation Engine is independently LOCKED','PileMaterialEngine CT49–50 is independently LOCKED','Integrated composition only performs Rpile=min(Rsoil,Rmaterial)','γn is applied after min; it never changes Rsoil/Rmaterial'],scope:'Square piles only for scalar integrated capacity; circular/annular material is N–M demand-check and is intentionally blocked from scalar min.',tolerance:{relative:relTol,absolute:absTol},workflowCases:cases,boundaryCases:boundary,normativeBenchmarks,summary};
mkdirSync(dirname(outPath),{recursive:true});writeFileSync(outPath,JSON.stringify(report,null,2)+'\n','utf8');console.log(JSON.stringify(summary,null,2));if(!summary.pass)process.exitCode=1;
