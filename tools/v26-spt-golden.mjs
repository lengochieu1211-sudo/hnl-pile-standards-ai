import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { solveEngineeringQuestion, engineeringExcelPayload } from '../src/engineering-router.js';
import {
  extractEngineeringScalarNumber,
  extractSptSummaryInputV26,
  buildEngineeringInputInterpreterPrompt,
  parseEngineeringInputInterpreterResponse
} from '../src/engineering-input-interpreter.js';

const QUESTION = `Tính sức chịu tải cọc đóng/ép vuông 400×400 mm, L=10 m theo SPT, Phụ lục D TCVN 10304:2025.
Cọc mũi kín, η=1,0.
Đất cát.
Giá trị SPT trung bình vùng mũi N̄=20.
Giá trị Ns trên toàn thân cọc =20.
γn=1,15 và γk=1,50.
Tính qb, fs, sức kháng mũi, sức kháng thân, Rc,k và tải cho phép.
Nguồn số hóa thể hiện phương pháp SPT với qb = 300ηN̄, giới hạn qb ≤ 18000 kPa, và với cát fs = 2Ns ≤100 kPa.`;

const near=(a,b,tol=1e-9,msg='')=>assert.ok(Math.abs(Number(a)-Number(b))<=tol,`${msg}: ${a} != ${b}`);
const checks=[];
const check=(name,fn)=>{fn();checks.push({name,status:'PASS'});};

check('Formula Guard rejects qb coefficient from qb=300ηNbar',()=>{
  assert.equal(extractEngineeringScalarNumber('qb = 300ηN̄, giới hạn qb ≤ 18000 kPa',['qb'],'(?:kPa)?'),null);
});
check('Formula Guard rejects fs coefficient from fs=2Ns',()=>{
  assert.equal(extractEngineeringScalarNumber('fs = 2Ns ≤100 kPa',['fs'],'(?:kPa)?'),null);
});
check('Formula Guard accepts true scalar qb',()=>{
  assert.equal(extractEngineeringScalarNumber('qb = 6000 kPa',['qb'],'(?:kPa)?'),6000);
});

const interpreted=extractSptSummaryInputV26(QUESTION);
check('Natural-language extraction recognizes explicit SPT summary',()=>{
  assert.equal(interpreted.lengthM,10);
  assert.equal(interpreted.nBarTip,20);
  assert.equal(interpreted.nsShaft,20);
  assert.equal(interpreted.eta,1);
  assert.equal(interpreted.gammaK,1.5);
  assert.equal(interpreted.gammaN,1.15);
  assert.equal(interpreted.pileType,'driven');
  assert.equal(interpreted.soilGroup,'sand');
  assert.equal(interpreted.fullShaft,true);
  assert.equal(interpreted.shaftLengthM,10);
  assert.equal(interpreted.formulaGuard.qb.rejectedCoefficient,true);
  assert.equal(interpreted.formulaGuard.fs.rejectedCoefficient,true);
});

const solved=solveEngineeringQuestion(QUESTION);
check('Exact production regression question routes to SPT deterministic summary engine',()=>{
  assert.equal(solved.recognized,true);
  assert.equal(solved.workflow.id,'10304-spt');
  assert.equal(solved.result.ok,true);
  assert.equal(solved.result.inputMode,'EXPLICIT_SPT_SUMMARY');
  assert.equal(solved.result.summaryInputPolicy.formulaCoefficientsAreNotInputs,true);
});
check('Exact Golden numeric result',()=>{
  near(solved.result.qbKpa,6000,1e-9,'qb');
  near(solved.result.shaftUnitResistanceKpa,40,1e-9,'fs');
  near(solved.result.RubKn,960,1e-8,'Rb');
  near(solved.result.RufKn,640,1e-8,'Rs');
  near(solved.result.RkKn,1600,1e-8,'Rk');
  near(solved.result.RdKn,1600/1.5,1e-8,'Rd');
  near(solved.result.NdMaxKn,(1600/1.5)/1.15,1e-8,'NdMax');
  assert.notEqual(Math.round(solved.result.RkKn),80,'Regression Rk=80 must never return');
});
check('Excel is unlocked only from deterministic result',()=>{
  const excel=engineeringExcelPayload(QUESTION);
  assert.equal(excel.canExport,true);
  near(excel.result.RkKn,1600,1e-8,'Excel Rk');
  near(excel.result.qbKpa,6000,1e-9,'Excel qb');
});

check('AI interpreter prompt forbids AI-owned calculations',()=>{
  const prompt=buildEngineeringInputInterpreterPrompt(QUESTION);
  assert.match(prompt,/KHÔNG tính kết quả kỹ thuật/);
  assert.match(prompt,/qb = 300ηN̄/);
  assert.match(prompt,/tuyệt đối không ghi qb=300/);
});
check('AI interpreter accepts input-only JSON',()=>{
  const parsed=parseEngineeringInputInterpreterResponse(JSON.stringify({
    schema:'HNL-V26-AI-INPUT',workflowHint:'10304-spt',
    scalars:{nBarTip:{value:20,sourceText:'N̄=20',confidence:.99}},
    semantics:{pileType:'driven',soilGroup:'sand',shaftCoverage:'full',closedTip:true},
    formulas:[{target:'qb',expression:'300*eta*nBarTip',limit:18000,unit:'kPa',sourceText:'qb = 300ηN̄'}]
  }));
  assert.equal(parsed.scalars.nBarTip.value,20);
});
check('AI interpreter rejects computed engineering results',()=>{
  assert.throws(()=>parseEngineeringInputInterpreterResponse(JSON.stringify({schema:'HNL-V26-AI-INPUT',RkKn:1600})),/vi phạm/);
});

check('AI-assisted extraction can fill unfamiliar wording without owning math',()=>{
  const qAi=`Tính cọc đóng vuông 400x400 mm L=10 m theo SPT. Đất cát. Chỉ số tại vùng mũi là 20. Chỉ số dọc thân là 20. γk=1,50; γn=1,15.`;
  const aiExtraction={
    scalars:{
      nBarTip:{value:20,sourceText:'Chỉ số tại vùng mũi là 20',confidence:.98},
      nsShaft:{value:20,sourceText:'Chỉ số dọc thân là 20',confidence:.98}
    },
    semantics:{pileType:'driven',soilGroup:'sand',shaftCoverage:'full',closedTip:true}
  };
  const aiSolved=solveEngineeringQuestion(qAi,{aiExtraction});
  assert.equal(aiSolved.result.ok,true);
  assert.equal(aiSolved.result.inputInterpretation.aiUsed,true);
  near(aiSolved.result.qbKpa,6000,1e-9,'AI-assisted qb');
  near(aiSolved.result.shaftUnitResistanceKpa,40,1e-9,'AI-assisted fs');
  near(aiSolved.result.RkKn,1600,1e-8,'AI-assisted Rk');
});

check('Vietnamese Formula-Only Excel source is wired for V26 summary input',()=>{
  const excelSrc=fs.readFileSync(new URL('../src/excel-export.js',import.meta.url),'utf8');
  for(const token of ["EXPLICIT_SPT_SUMMARY","04_BANG_D1","N̄ vùng mũi","Ns thân cọc","R_c,k / R_k","N_d,max","FORMULA+CAP","V26 summary input"]) assert.ok(excelSrc.includes(token),`missing Excel V26 token ${token}`);
  assert.match(excelSrc,/MIN\(coef\*N\*IF\(useEta=1,eta,1\),cap\*IF\(capEta=1,eta,1\)\)/);
  assert.match(excelSrc,/MIN\(coef\*N,cap\)/);
});
check('Raw text overrides conflicting AI scalar',()=>{
  const fakeAi={scalars:{nBarTip:{value:99,sourceText:'N̄=20',confidence:1}},semantics:{}};
  const merged=extractSptSummaryInputV26(QUESTION,fakeAi);
  assert.equal(merged.nBarTip,20);
  assert.equal(merged.origins.nBarTip.origin,'RAW_TEXT');
});

const evidence={
  schema:'HNL-V26-SPT-GOLDEN-RESULT',
  status:'PASS',
  checks,
  exactQuestion:QUESTION,
  expected:{qbKpa:6000,fsKpa:40,RbKn:960,RsKn:640,RkKn:1600,RdKn:1600/1.5,NdMaxKn:(1600/1.5)/1.15},
  actual:{qbKpa:solved.result.qbKpa,fsKpa:solved.result.shaftUnitResistanceKpa,RbKn:solved.result.RubKn,RsKn:solved.result.RufKn,RkKn:solved.result.RkKn,RdKn:solved.result.RdKn,NdMaxKn:solved.result.NdMaxKn},
  formulaGuard:solved.result.inputInterpretation.formulaGuard,
  calculationOwner:'DETERMINISTIC_ENGINE',
  aiRole:'INPUT_EXTRACTION_ONLY',
  searchBrainTouched:false
};
const out=path.resolve(process.argv[2]||'artifacts/v26/V26_SPT_GOLDEN_RESULT.json');
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(evidence,null,2)+'\n');
console.log(`V26 SPT Golden: ${checks.length}/${checks.length} PASS`);
console.log(`qb=${solved.result.qbKpa} kPa; fs=${solved.result.shaftUnitResistanceKpa} kPa; Rk=${solved.result.RkKn} kN; Rd=${solved.result.RdKn} kN; Nd,max=${solved.result.NdMaxKn} kN`);
console.log(`Evidence: ${out}`);
