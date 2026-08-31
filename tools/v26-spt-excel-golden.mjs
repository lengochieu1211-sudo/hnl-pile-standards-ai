import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { engineeringExcelPayload } from '../src/engineering-router.js';
import { exportUnifiedEngineeringWorkbook } from '../src/excel-export-compat.js';

const QUESTION=`Tính sức chịu tải cọc đóng/ép vuông 400×400 mm, L=10 m theo SPT, Phụ lục D TCVN 10304:2025.
Cọc mũi kín, η=1,0.
Đất cát.
Giá trị SPT trung bình vùng mũi N̄=20.
Giá trị Ns trên toàn thân cọc =20.
γn=1,15 và γk=1,50.
Tính qb, fs, sức kháng mũi, sức kháng thân, Rc,k và tải cho phép.
Nguồn số hóa thể hiện phương pháp SPT với qb = 300ηN̄, giới hạn qb ≤ 18000 kPa, và với cát fs = 2Ns ≤100 kPa.`;

const payload=engineeringExcelPayload(QUESTION);
assert.equal(payload.recognized,true);
assert.equal(payload.canExport,true);
assert.equal(payload.workflow.id,'10304-spt');
assert.equal(payload.input.inputMode,'EXPLICIT_SPT_SUMMARY');
assert.equal(payload.input.sectionType,'square');
assert.ok(Math.abs(Number(payload.input.widthM)-0.4)<1e-12);
assert.ok(Math.abs(Number(payload.input.heightM)-0.4)<1e-12);
assert.ok(Math.abs(Number(payload.input.lengthM)-10)<1e-12);

let captured=null;
globalThis.__HNL_CAPTURE_XLSX__=(buf,name)=>{
  captured={buffer:Buffer.from(buf),fileName:String(name||'')};
  return captured;
};
await exportUnifiedEngineeringWorkbook(payload);
assert.ok(captured?.buffer?.length>1000,'Production Excel exporter did not return a workbook buffer');

const mod=await import('exceljs');
const ExcelJS=mod.default||mod;
const wb=new ExcelJS.Workbook();
await wb.xlsx.load(captured.buffer);
for(const sheet of ['00_HUONG_DAN','01_INPUT','02_CALC','04_BANG_D1']) assert.ok(wb.getWorksheet(sheet),`missing sheet ${sheet}`);
assert.ok(wb.getWorksheet('98_NGUON')||wb.getWorksheet('03_NGUON')||wb.worksheets.find(s=>/NGUON|SOURCE/i.test(s.name)),'missing provenance/source sheet');
const input=wb.getWorksheet('01_INPUT'),calc=wb.getWorksheet('02_CALC'),d1=wb.getWorksheet('04_BANG_D1');
const findRow=(ws,label)=>{
  let found=null;
  ws.eachRow(row=>{if(String(row.getCell(1).value??'').trim()===label) found=row;});
  assert.ok(found,`missing row ${label} in ${ws.name}`);
  return found;
};
const num=v=>Number(v?.result??v?.value??v);
const formula=(ws,label)=>String(findRow(ws,label).getCell(2).value?.formula||'');

assert.equal(num(findRow(input,'N̄ vùng mũi').getCell(2).value),20);
assert.equal(num(findRow(input,'Ns thân cọc').getCell(2).value),20);
assert.equal(num(findRow(input,'η').getCell(2).value),1);
assert.equal(String(findRow(input,'Tiết diện').getCell(2).value),'Vuông');
assert.equal(num(findRow(input,'b').getCell(2).value),400);
assert.equal(num(findRow(input,'h').getCell(2).value),400);
assert.equal(num(findRow(input,'L').getCell(2).value),10);
assert.equal(num(findRow(input,'γk').getCell(2).value),1.5);
assert.equal(num(findRow(input,'γn').getCell(2).value),1.15);

// Geometry-first contract: b/h/D are editable source inputs; A/u are live derived formulas.
const areaInputFormula=formula(input,'A_b (dẫn xuất)');
const perimeterInputFormula=formula(input,'u (dẫn xuất)');
const areaCalcFormula=formula(calc,'A_b');
const perimeterCalcFormula=formula(calc,'u');
assert.ok(areaInputFormula,'A_b input-side derived formula missing');
assert.ok(perimeterInputFormula,'u input-side derived formula missing');
assert.ok(areaCalcFormula,'A_b calc formula missing');
assert.ok(perimeterCalcFormula,'u calc formula missing');
assert.match(areaInputFormula,/\/1000/);
assert.match(perimeterInputFormula,/\/1000/);
assert.match(areaInputFormula,/PI\(\)/);
assert.match(perimeterInputFormula,/PI\(\)/);

const qbFormula=formula(calc,'q_b');
const fsFormula=formula(calc,'f_s');
const rubFormula=formula(calc,'R_u,b');
const rufFormula=formula(calc,'R_u,f');
const rkFormula=formula(calc,'R_c,k / R_k');
const rdFormula=formula(calc,'R_d');
const ndFormula=formula(calc,'N_d,max');
assert.match(qbFormula,/VLOOKUP/); assert.match(qbFormula,/MIN\(/); assert.match(qbFormula,/B\d+/i);
assert.match(fsFormula,/VLOOKUP/); assert.match(fsFormula,/MIN\(/);
assert.match(rubFormula,/B\d+\*B\d+/);
assert.match(rufFormula,/B\d+/);
assert.match(rkFormula,/\+/); assert.ok(rdFormula); assert.match(ndFormula,/B\d+/i);

const allFormulas=[];
for(const ws of wb.worksheets) ws.eachRow(row=>row.eachCell(cell=>{
  const v=cell.value;
  if(v&&typeof v==='object'&&typeof v.formula==='string') allFormulas.push(v.formula);
}));
for(const modern of ['XLOOKUP(','LET(','LAMBDA(','SWITCH(','IFS(']){
  assert.equal(allFormulas.some(f=>f.toUpperCase().includes(modern)),false,`Production workbook still contains ${modern}`);
}

const drivenRow=[];
d1.eachRow((row,index)=>{if(index>1&&String(row.getCell(1).value)==='driven') drivenRow.push(...row.values.slice(1));});
assert.equal(drivenRow[2],300,'Bảng D.1 driven tip coefficient');
assert.equal(drivenRow[3],18000,'Bảng D.1 driven tip cap');
assert.equal(drivenRow[4],2,'Bảng D.1 driven shaft coefficient');
assert.equal(drivenRow[5],100,'Bảng D.1 driven shaft cap');

const out=path.resolve(process.argv[2]||'artifacts/v26/HNL_V26_SPT_FORMULA_GOLDEN.xlsx');
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,captured.buffer);
const evidence={
  schema:'HNL-V26-SPT-EXCEL-GOLDEN',status:'PASS',fileName:captured.fileName,bytes:captured.buffer.length,
  contract:'GEOMETRY_FIRST_PRODUCTION_FORMULA_ONLY',
  sheets:wb.worksheets.map(s=>s.name),
  sourceInputs:{sectionType:'Vuông',bMm:400,hMm:400,lengthM:10,Nbar:20,Ns:20,eta:1,gammaK:1.5,gammaN:1.15},
  derivedFormulaChecks:{areaInput:areaInputFormula,perimeterInput:perimeterInputFormula,areaCalc:areaCalcFormula,perimeterCalc:perimeterCalcFormula},
  resistanceFormulaChecks:{qb:qbFormula,fs:fsFormula,Rub:rubFormula,Ruf:rufFormula,Rk:rkFormula,Rd:rdFormula,NdMax:ndFormula},
  note:'Production workbook keeps b/h/D as editable source geometry and A/u as formulas. Numeric recalculation parity is certified separately by the mandatory SPT spreadsheet runtime Golden.'
};
fs.writeFileSync(path.resolve('artifacts/v26/V26_SPT_EXCEL_GOLDEN_RESULT.json'),JSON.stringify(evidence,null,2)+'\n');
console.log(`V26 SPT Excel Golden: PASS · geometry-first Production contract · ${captured.buffer.length} bytes · ${out}`);
