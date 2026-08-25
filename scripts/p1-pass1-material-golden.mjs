import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  calculateNearCenteredRectPileCapacity5574,
  calculateCircularPileMaterialCheck5574,
  calculateXlsmSctVatLieuReference,
  combineSoilAndMaterialResistance
} from '../src/pile-material-engine.js';
import { evaluatePileMaterialExcelModel, evaluateGoverningExcelModel } from '../src/p1-material-excel-model.js';
import { lookup5574Concrete, lookup5574Steel, lookup5574Table16LongTermPhi } from '../src/codepack-tables.js';
import { productionStatusFor } from '../src/production-status-registry.js';

const outPath=resolve(process.argv[2]||'artifacts/p1-pass1/material-golden-v1.25.7.json');
const relTol=1e-10, absTol=1e-10;
const close=(a,b)=>Math.abs(Number(a)-Number(b))<=Math.max(absTol,relTol*Math.max(1,Math.abs(Number(a)),Math.abs(Number(b))));
const metric=(name,engine,excelModel,unit='')=>({name,engine,excelFormulaModel:excelModel,diff:Number(engine)-Number(excelModel),unit,pass:close(engine,excelModel),tolerance:{relative:relTol,absolute:absTol}});

const materialChecks=[];
for(const [grade,expected] of [['B30',{Rb:17,Eb:32500}],['B60',{Rb:33,Eb:39500}],['B100',{Rb:47.5,Eb:43000}]]){
  const c=lookup5574Concrete(grade);
  materialChecks.push({id:`${grade}-concrete`,actual:c?{Rb:c.Rb,Eb:c.Eb}:null,expected,pass:Boolean(c)&&close(c.Rb,expected.Rb)&&close(c.Eb,expected.Eb),source:'TCVN 5574:2018 Bảng 7/10'});
}
for(const [steel,expected] of [['CB400-V',{Rs:350,Rsc:350}],['CB500-V',{Rs:435,Rsc:435}]]){
  const s=lookup5574Steel(steel);
  materialChecks.push({id:`${steel}-steel`,actual:s?{Rs:s.Rs,Rsc:s.Rsc}:null,expected,pass:Boolean(s)&&close(s.Rs,expected.Rs)&&close(s.Rsc,expected.Rsc),source:'TCVN 5574:2018 Bảng 13'});
}

const table16Checks=[
  ['B30',6,0.92],['B30',10,0.90],['B30',12.5,0.865],['B30',15,0.83],['B60',15,0.80],['B80',20,0.64],['B100',20,0.63]
].map(([grade,ratio,expected])=>{
  const r=lookup5574Table16LongTermPhi(grade,ratio);
  return {grade,ratio,actual:r?.value,expected,mode:r?.mode,pass:Boolean(r?.ok)&&close(r.value,expected),source:'TCVN 5574:2018 Bảng 16'};
});

const capacityInputs=[
  {id:'B30-R6-LONG',grade:'B30',steel:'CB400-V',shape:'square',sideMm:400,AsTotMm2:1600,L0Mm:2400,e0Mm:400/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long'},
  {id:'B30-R10-LONG',grade:'B30',steel:'CB400-V',shape:'square',sideMm:400,AsTotMm2:1600,L0Mm:4000,e0Mm:400/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long'},
  {id:'B30-R12.5-LONG',grade:'B30',steel:'CB400-V',shape:'square',sideMm:400,AsTotMm2:1600,L0Mm:5000,e0Mm:400/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long'},
  {id:'B60-R15-LONG',grade:'B60',steel:'CB400-V',shape:'square',sideMm:400,AsTotMm2:1600,L0Mm:6000,e0Mm:400/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long'},
  {id:'B100-R20-LONG',grade:'B100',steel:'CB500-V',shape:'square',sideMm:400,AsTotMm2:1600,L0Mm:8000,e0Mm:400/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long'},
  {id:'B30-R15-SHORT',grade:'B30',steel:'CB400-V',shape:'square',sideMm:400,AsTotMm2:1600,L0Mm:6000,e0Mm:400/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'short'},
  {id:'RECT-R12.5-E10',grade:'B30',steel:'CB400-V',shape:'rectangle',widthMm:450,heightMm:500,AsTotMm2:2400,L0Mm:6250,e0Mm:500/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long'}
];
const cases=capacityInputs.map(input=>{
  const e=calculateNearCenteredRectPileCapacity5574(input);
  const x=evaluatePileMaterialExcelModel(input);
  const metrics=e.ok&&x.ok?[
    metric('A',e.inputs.concreteAreaMm2,x.Amm2,'mm2'),
    metric('L0/h',e.slendernessRatio,x.ratio,'-'),
    metric('phi',e.phi,x.phi,'-'),
    metric('Rb',e.materials.RbMpa,x.Rb,'MPa'),
    metric('Rsc',e.materials.RscMpa,x.Rsc,'MPa'),
    metric('Nu',e.NuKn,x.NuKn,'kN')
  ]:[];
  return {id:input.id,input,engineStatus:e.status,engineOk:e.ok,excelModelOk:x.ok,metrics,pass:Boolean(e.ok&&x.ok&&metrics.every(m=>m.pass))};
});

const benchmark=calculateNearCenteredRectPileCapacity5574({grade:'B30',steel:'CB400-V',shape:'square',sideMm:400,AsTotMm2:1600,L0Mm:4000,e0Mm:400/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long'});
const benchmarkCheck={id:'CT50-B30-CB400-400x400',actual:benchmark.NuKn,expected:2952,pass:Boolean(benchmark.ok)&&close(benchmark.NuKn,2952),source:'CT (50) + Bảng 7/13/16'};

const governingCases=[];
for(const soilRdKn of [2800,3200]){
  const e=combineSoilAndMaterialResistance({soilResult:{RdKn:soilRdKn},materialResult:benchmark});
  const x=evaluateGoverningExcelModel({soilRdKn,materialNuKn:benchmark.NuKn});
  governingCases.push({soilRdKn,engine:e,excelFormulaModel:x,pass:Boolean(e.ok&&x.ok&&close(e.pileResistanceKn,x.pileResistanceKn)&&e.governing===x.governing)});
}

const boundaryCases=[];
const boundary=(id,input,expect)=>{
  const r=calculateNearCenteredRectPileCapacity5574(input);
  const text=[...(r.missing||[]),...(r.warnings||[])].join(' ');
  boundaryCases.push({id,resultOk:r.ok,status:r.status,message:text,pass:r.ok===false&&expect.test(text)});
};
boundary('long-ratio-under-6',{grade:'B30',steel:'CB400-V',shape:'square',sideMm:400,AsTotMm2:1600,L0Mm:2000,e0Mm:400/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long'},/6…20|Bảng 16/);
boundary('long-ratio-over-20',{grade:'B30',steel:'CB400-V',shape:'square',sideMm:400,AsTotMm2:1600,L0Mm:8400,e0Mm:400/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long'},/L0\/h ≤ 20/);
boundary('short-ratio-under-10',{grade:'B30',steel:'CB400-V',shape:'square',sideMm:400,AsTotMm2:1600,L0Mm:3200,e0Mm:400/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'short'},/10…20|không ngoại suy/);
boundary('e0-over-h30',{grade:'B30',steel:'CB400-V',shape:'square',sideMm:400,AsTotMm2:1600,L0Mm:4000,e0Mm:14,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long'},/e0 ≤ h\/30/);
boundary('non-rectangular-ct50',{grade:'B30',steel:'CB400-V',shape:'circle',sideMm:400,AsTotMm2:1600,L0Mm:4000,e0Mm:400/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long'},/chữ nhật\/vuông/);

const circle=calculateCircularPileMaterialCheck5574({grade:'B30',steel:'CB400-V',r:300,rs:250,AsTot:3000,N:2000,M:300,barCount:8});
const circleCombine=combineSoilAndMaterialResistance({soilResult:{RdKn:2500},materialResult:circle});
const circularSafety={engineOk:circle.ok,capacityBasis:circle.capacityBasis,materialResistanceKn:circle.materialResistanceKn,combineOk:circleCombine.ok,pass:Boolean(circle.ok&&circle.capacityBasis==='DEMAND_CHECK_ONLY'&&circle.materialResistanceKn==null&&circleCombine.ok===false)};

const xlsm=calculateXlsmSctVatLieuReference();
const xlsmReference={
  status:xlsm.status,
  productionNumeric:xlsm.productionNumeric,
  workbookCachedKn:xlsm.workbookAsCalculatedKn,
  expectedWorkbookCachedKn:12012.497578072185,
  workbookOwnTableFixedKn:xlsm.workbookIfLookupFixedToOwnTableKn,
  expectedWorkbookOwnTableFixedKn:12197.78764512835,
  workbookLookupRscMpa:xlsm.workbookAsCalculatedRscMpa,
  workbookOwnTableRscMpa:xlsm.workbookOwnTableRscMpa,
  pdfCorrectRscMpa:xlsm.pdfCorrectRscMpa,
  expectedMismatch:true,
  pass:Boolean(xlsm.ok&&xlsm.productionNumeric===false&&close(xlsm.workbookAsCalculatedKn,12012.497578072185)&&close(xlsm.workbookIfLookupFixedToOwnTableKn,12197.78764512835)&&xlsm.workbookOwnTableRscMpa===365&&xlsm.pdfCorrectRscMpa===350),
  note:'XLSM là REFERENCE/BUGGED. Mismatch 365↔350 là bằng chứng lỗi, không phải Production failure.'
};

const registryChecks=[
  {id:'5574-pile-material-near-centered-rect',actual:productionStatusFor('5574-pile-material-near-centered-rect')},
  {id:'xlsm-sct-vatlieu',actual:productionStatusFor('xlsm-sct-vatlieu')}
].map(x=>({...x,pass:x.id==='5574-pile-material-near-centered-rect'?x.actual.status==='LOCKED'&&x.actual.productionNumeric===true:x.actual.status==='REFERENCE'&&x.actual.productionNumeric===false}));

const summary={
  materialChecks:materialChecks.length,materialPass:materialChecks.filter(x=>x.pass).length,
  table16Checks:table16Checks.length,table16Pass:table16Checks.filter(x=>x.pass).length,
  capacityCases:cases.length,capacityPass:cases.filter(x=>x.pass).length,
  capacityMetrics:cases.reduce((n,c)=>n+c.metrics.length,0),capacityMetricPass:cases.reduce((n,c)=>n+c.metrics.filter(m=>m.pass).length,0),
  governingCases:governingCases.length,governingPass:governingCases.filter(x=>x.pass).length,
  boundaryCases:boundaryCases.length,boundaryPass:boundaryCases.filter(x=>x.pass).length,
  benchmarkPass:benchmarkCheck.pass?1:0,circularSafetyPass:circularSafety.pass?1:0,xlsmReferencePass:xlsmReference.pass?1:0,registryPass:registryChecks.filter(x=>x.pass).length
};
summary.pass=materialChecks.every(x=>x.pass)&&table16Checks.every(x=>x.pass)&&cases.every(x=>x.pass)&&governingCases.every(x=>x.pass)&&boundaryCases.every(x=>x.pass)&&benchmarkCheck.pass&&circularSafety.pass&&xlsmReference.pass&&registryChecks.every(x=>x.pass);
const report={schema:'HNL-P1-PASS1-PILE-MATERIAL-GOLDEN',version:'1.25.7',generatedAt:new Date().toISOString(),sourceHierarchy:['TCVN 5574:2018 PDF is normative','Deterministic PileMaterialEngine is Production calculation source','Formula-Only Excel graph is independent benchmark','XLSM SCT VatLieu is workflow/bugged benchmark reference only'],tolerances:{relative:relTol,absolute:absTol},materialChecks,table16Checks,capacityCases:cases,benchmarkCheck,governingCases,boundaryCases,circularSafety,xlsmReference,registryChecks,summary,excelJsRuntimeGate:'PENDING_DEPENDENCY_RUNTIME_SMOKE'};
mkdirSync(dirname(outPath),{recursive:true});
writeFileSync(outPath,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(summary,null,2));
if(!summary.pass) process.exitCode=1;
