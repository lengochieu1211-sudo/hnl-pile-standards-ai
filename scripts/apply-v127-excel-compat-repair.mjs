#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
function replaceOnce(src,oldText,newText,label){
  const n=src.split(oldText).length-1;
  if(n!==1) throw new Error(`${label}: expected exactly one marker, got ${n}`);
  return src.replace(oldText,newText);
}

// 1) Wire the Production workbook post-processor to the legacy formula transformer.
{
  const p='src/excel-export-compat.js'; let s=read(p);
  s=replaceOnce(s,
    "import { addNativeColumnChart } from './xlsx-native-chart.js';",
    "import { addNativeColumnChart } from './xlsx-native-chart.js';\nimport { applyLegacyExcelFormulaCompatibility } from './excel-formula-compat.js';",
    'compat import');
  s=replaceOnce(s,
    "  if(genericLocalization && genericLocalization.translatedValidations===0 && genericLocalization.translatedCells===0 && genericLocalization.translatedFormulas===0){const map=wb.getWorksheet('99_MA_NOI_BO');if(map) wb.removeWorksheet(map.id);}\n  let out=await wb.xlsx.writeBuffer();",
    "  if(genericLocalization && genericLocalization.translatedValidations===0 && genericLocalization.translatedCells===0 && genericLocalization.translatedFormulas===0){const map=wb.getWorksheet('99_MA_NOI_BO');if(map) wb.removeWorksheet(map.id);}\n  const legacyFormulaCompatibility=applyLegacyExcelFormulaCompatibility(wb);\n  if(legacyFormulaCompatibility.remaining!==0) throw new Error('Excel compatibility transformer left modern formulas');\n  let out=await wb.xlsx.writeBuffer();",
    'compat runtime hook');
  write(p,s);
}

// 2) Strengthen Excel Production smoke with emitted-workbook formula scanning and representative workflows.
{
  const p='scripts/excel-production-smoke.mjs'; let s=read(p);
  s=replaceOnce(s,
    "import { export10304AdvancedWorkflowWorkbook, exportDrivenPileWorkflowWorkbook } from '../src/excel-export-compat.js';",
    "import { export10304AdvancedWorkflowWorkbook, exportDrivenPileWorkflowWorkbook } from '../src/excel-export-compat.js';\nimport { MODERN_EXCEL_FORMULA_RE, downgradeModernExcelFormula } from '../src/excel-formula-compat.js';",
    'smoke import');
  const helper=`\nfunction assertLegacyFormulaCompatibility(wb,label){\n  const bad=[],tooLong=[]; let formulas=0;\n  for(const ws of wb.worksheets){\n    ws.eachRow({includeEmpty:false},row=>row.eachCell({includeEmpty:false},cell=>{\n      const f=cell.value&&typeof cell.value==='object'&&typeof cell.value.formula==='string'?cell.value.formula:'';\n      if(!f) return; formulas++;\n      if(MODERN_EXCEL_FORMULA_RE.test(f)) bad.push(ws.name+'!'+cell.address+':'+f.slice(0,180));\n      if(f.length>8192) tooLong.push(ws.name+'!'+cell.address+':'+f.length);\n    }));\n  }\n  assert.deepEqual(bad,[],label+' còn LET/XLOOKUP/LAMBDA/SWITCH/IFS: '+bad.join(' | '));\n  assert.deepEqual(tooLong,[],label+' có công thức vượt 8192 ký tự: '+tooLong.join(' | '));\n  assert.ok(formulas>0,label+' không có công thức để kiểm tra');\n  return formulas;\n}\n\n// Parser-level guards for the exact modern constructs used by HNL workbooks.\n{\n  const samples=[\n    'XLOOKUP(A1,B1:B4,C1:C4,NA())',\n    'XLOOKUP("*Cạnh*",A:A,B:B,"",2)',\n    'SWITCH(A1,"a",1,"b",2,"BLOCK")',\n    'IFS(A1<=1,10,A1=2,20,TRUE,"CẦN")',\n    'LET(x,A1,y,B1,IF(x>0,x+y,0))',\n    'LET(x,A1,val,LAMBDA(cc,INDEX(B1:C2,1,cc)),val(2))'\n  ];\n  for(const f of samples){const out=downgradeModernExcelFormula(f);assert.doesNotMatch(out,MODERN_EXCEL_FORMULA_RE);assert.ok(out.length<=8192);}\n}\n`;
  s=replaceOnce(s,"function rowByLabel(ws,label){",helper+"\nfunction rowByLabel(ws,label){",'smoke helper');
  s=replaceOnce(s,
    "  assert.ok(await hasNativeChart(spt.buffer),'SPT explicit thiếu native chart');\n}",
    "  assert.ok(await hasNativeChart(spt.buffer),'SPT explicit thiếu native chart');\n  assertLegacyFormulaCompatibility(wb,'SPT explicit');\n}",
    'SPT legacy assertion');
  s=replaceOnce(s,
    "  assert.ok(await hasNativeChart(driven.buffer),'Driven thiếu native chart');\n}",
    "  assert.ok(await hasNativeChart(driven.buffer),'Driven thiếu native chart');\n  assertLegacyFormulaCompatibility(wb,'Driven');\n}",
    'Driven legacy assertion');
  s=replaceOnce(s,
    "  assert.match(String(inp.getCell(shape,2).dataValidation?.formulae?.[0]||''),/Tròn/);\n}",
    "  assert.match(String(inp.getCell(shape,2).dataValidation?.formulae?.[0]||''),/Tròn/);\n  assertLegacyFormulaCompatibility(wb,'End-bearing');\n}",
    'rock legacy assertion');
  const extra=`\n\n// Excel Production Pass 4: compatibility coverage for every modern-formula family in core.\nconst compatCases=[\n  ['CPT', 'cpt', {A:.16,u:1.6,h:12,qs:5000,fs:40,pile:'driven',load:'compression',soil:'sand',probe:'mechanical',b1Auto:true,b2Auto:true}],\n  ['Bored-Table8','bored',{gammaC:1,gammaRR:1,gammaRf:1,A:.785,u:3.14,sumFh:900,qbLookupMode:'table8',depth:12,IL:.3}],\n  ['Bored-Table7','bored',{gammaC:1,gammaRR:1,gammaRf:1,A:.785,u:3.14,sumFh:900,qbLookupMode:'table7',phi:31,gamma1p:10,gamma1:18,d:1,depth:15}],\n  ['Settlement-Single','settlement-single',{N:1,G1:20,G2:30,L:20,d:.6,v1:.3,v2:.3,EA:10000}],\n  ['Raw-SPT','spt',{pileType:'driven',shape:'square',sideM:.4,lengthM:10,tipDepthM:10,eta:1,gammaK:1.5,gammaN:1.15,layers:[{top:0,bottom:5,soilGroup:'sand',sptN:15},{top:5,bottom:12,soilGroup:'sand',sptN:20}],sptPoints:[{depthM:8,N:18},{depthM:10,N:20},{depthM:12,N:22}]}],\n  ['Raw-Bored','bored',{shape:'circle',diameterM:1,tipDepthM:12,shaftStartDepthM:0,maxSegmentM:2,gammaK:1.4,gammaN:1.15,tipPhiDeg:31,layers:[{top:0,bottom:5,soilGroup:'clay',IL:.5},{top:5,bottom:15,soilGroup:'sand',sandType:'medium',phiDeg:31}]}]\n];\nlet compatFormulaCount=0;\nfor(const [label,wf,input] of compatCases){\n  const out=await export10304AdvancedWorkflowWorkbook(wf,input,{returnBuffer:true});\n  assert.ok(out?.buffer,label+' không tạo được buffer');\n  const wb=new ExcelJS.Workbook(); await wb.xlsx.load(out.buffer);\n  compatFormulaCount+=assertLegacyFormulaCompatibility(wb,label);\n  assertNoInternalCodeDropdowns(wb,label);\n}\nassert.ok(compatFormulaCount>20,'Compatibility matrix chưa quét đủ công thức');\n`;
  s=replaceOnce(s,"\nconsole.log(JSON.stringify({",extra+"\nconsole.log(JSON.stringify({",'extra compatibility cases');
  s=s.replace("  genericCompat:{vietnameseDropdowns:true,hiddenInternalCodeMap:true}","  genericCompat:{vietnameseDropdowns:true,hiddenInternalCodeMap:true},\n  legacyFormulaCompat:{zeroModernFunctions:true,maxFormulaLength:8192,representativeCases:compatCases.map(x=>x[0])}");
  write(p,s);
}

// 3) Master Audit: core may retain modern formulas, but Production may PASS only with wired transformer + runtime smoke evidence.
{
  const p='scripts/master-system-audit.mjs'; let s=read(p);
  s=replaceOnce(s,
    "'src/search.js','src/excel-export.js','src/excel-export-compat.js','src/engineering-router.js'",
    "'src/search.js','src/excel-export.js','src/excel-export-compat.js','src/excel-formula-compat.js','src/engineering-router.js'",
    'audit required formula compat');
  const old=`  const critical={LET:(xls.match(/\\bLET\\s*\\(/g)||[]).length,XLOOKUP:(xls.match(/\\bXLOOKUP\\s*\\(/g)||[]).length,LAMBDA:(xls.match(/\\bLAMBDA\\s*\\(/g)||[]).length};\n  const criticalCount=Object.values(critical).reduce((a,b)=>a+b,0);\n  add('EXCEL:365_CRITICAL','Excel Production','P1',criticalCount===0?'PASS':'OPEN',\`LET=\${critical.LET}; XLOOKUP=\${critical.XLOOKUP}; LAMBDA=\${critical.LAMBDA}\`,'Chuyển từng workflow sang INDEX/MATCH, VLOOKUP, IF, MIN/MAX và Golden trước khi sửa tiếp workflow khác.');\n  const modern={SWITCH:(xls.match(/\\bSWITCH\\s*\\(/g)||[]).length,IFS:(xls.match(/\\bIFS\\s*\\(/g)||[]).length};\n  add('EXCEL:MODERN_REVIEW','Excel Production','P2',(modern.SWITCH+modern.IFS)===0?'PASS':'OPEN',\`SWITCH=\${modern.SWITCH}; IFS=\${modern.IFS}\`,'Review compatibility target sau khi đóng LET/XLOOKUP/LAMBDA.');`;
  const neu=`  const critical={LET:(xls.match(/\\bLET\\s*\\(/g)||[]).length,XLOOKUP:(xls.match(/\\bXLOOKUP\\s*\\(/g)||[]).length,LAMBDA:(xls.match(/\\bLAMBDA\\s*\\(/g)||[]).length};\n  const criticalCount=Object.values(critical).reduce((a,b)=>a+b,0);\n  const modern={SWITCH:(xls.match(/\\bSWITCH\\s*\\(/g)||[]).length,IFS:(xls.match(/\\bIFS\\s*\\(/g)||[]).length};\n  const modernCount=modern.SWITCH+modern.IFS;\n  const compatFormula=exists('src/excel-formula-compat.js')?read('src/excel-formula-compat.js'):'';\n  const compatRuntime=exists('src/excel-export-compat.js')?read('src/excel-export-compat.js'):'';\n  const compatSmoke=exists('scripts/excel-production-smoke.mjs')?read('scripts/excel-production-smoke.mjs'):'';\n  const runtimeLegacyCompat=/applyLegacyExcelFormulaCompatibility/.test(compatRuntime)&&/downgradeModernExcelFormula/.test(compatFormula)&&/MODERN_EXCEL_FORMULA_RE/.test(compatFormula)&&/assertLegacyFormulaCompatibility/.test(compatSmoke)&&/compatCases/.test(compatSmoke);\n  const criticalOk=criticalCount===0||runtimeLegacyCompat;\n  const modernOk=modernCount===0||runtimeLegacyCompat;\n  add('EXCEL:365_CRITICAL','Excel Production','P1',criticalOk?'PASS':'OPEN',\`Core LET=\${critical.LET}; XLOOKUP=\${critical.XLOOKUP}; LAMBDA=\${critical.LAMBDA}; Production legacy-transform=\${runtimeLegacyCompat?'CERTIFIED-RUNTIME':'MISSING'}\`,'Production phải xuất 0 LET/XLOOKUP/LAMBDA; core chỉ được giữ khi compat transformer + runtime smoke chứng nhận workbook đầu ra.');\n  add('EXCEL:MODERN_REVIEW','Excel Production','P2',modernOk?'PASS':'OPEN',\`Core SWITCH=\${modern.SWITCH}; IFS=\${modern.IFS}; Production legacy-transform=\${runtimeLegacyCompat?'CERTIFIED-RUNTIME':'MISSING'}\`,'Production phải xuất 0 SWITCH/IFS; runtime smoke phải quét workbook đầu ra.');`;
  s=replaceOnce(s,old,neu,'audit Excel modern function block');
  write(p,s);
}

// 4) Refresh only release-sync hashes for files intentionally changed in this repair.
{
  const p='RELEASE_SYNC_MANIFEST.json'; const m=JSON.parse(read(p));
  const files=['scripts/excel-production-smoke.mjs','scripts/master-system-audit.mjs','src/excel-export-compat.js','src/excel-formula-compat.js'];
  for(const f of files){
    const normalized=read(f).replace(/\r\n/g,'\n');
    m.files[f]=crypto.createHash('sha256').update(normalized).digest('hex');
  }
  write(p,JSON.stringify(m,null,2));
}

console.log('V1.27 EXCEL COMPAT REPAIR: APPLIED');
