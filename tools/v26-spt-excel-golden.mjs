import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { engineeringExcelPayload } from '../src/engineering-router.js';
import { exportUnifiedEngineeringWorkbook } from '../src/excel-export.js';

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

let captured=null;
globalThis.__HNL_CAPTURE_XLSX__=(buf,name)=>{
  captured={buffer:Buffer.from(buf),fileName:String(name||'')};
  return captured;
};
await exportUnifiedEngineeringWorkbook(payload);
assert.ok(captured?.buffer?.length>1000,'Excel exporter did not return a workbook buffer');

const mod=await import('exceljs');
const ExcelJS=mod.default||mod;
const wb=new ExcelJS.Workbook();
await wb.xlsx.load(captured.buffer);
for(const sheet of ['00_HUONG_DAN','01_INPUT','02_CALC','03_NGUON','04_BANG_D1']) assert.ok(wb.getWorksheet(sheet),`missing sheet ${sheet}`);
const input=wb.getWorksheet('01_INPUT'),calc=wb.getWorksheet('02_CALC'),d1=wb.getWorksheet('04_BANG_D1');
const findRow=(ws,label)=>{
  let found=null;
  ws.eachRow(row=>{if(String(row.getCell(1).value??'').trim()===label) found=row;});
  assert.ok(found,`missing row ${label} in ${ws.name}`);
  return found;
};
const num=v=>Number(v?.result??v?.value??v);
assert.equal(num(findRow(input,'N̄ vùng mũi').getCell(2).value),20);
assert.equal(num(findRow(input,'Ns thân cọc').getCell(2).value),20);
assert.equal(num(findRow(input,'η').getCell(2).value),1);
assert.ok(Math.abs(num(findRow(input,'A').getCell(2).value)-0.16)<1e-9);
assert.ok(Math.abs(num(findRow(input,'u').getCell(2).value)-1.6)<1e-9);
assert.equal(num(findRow(input,'Ls').getCell(2).value),10);
assert.equal(num(findRow(input,'γk').getCell(2).value),1.5);
assert.equal(num(findRow(input,'γn').getCell(2).value),1.15);

const qbFormula=String(findRow(calc,'q_b').getCell(2).value?.formula||'');
const fsFormula=String(findRow(calc,'f_s').getCell(2).value?.formula||'');
const rkFormula=String(findRow(calc,'R_c,k / R_k').getCell(2).value?.formula||'');
const ndFormula=String(findRow(calc,'N_d,max').getCell(2).value?.formula||'');
assert.match(qbFormula,/XLOOKUP/); assert.match(qbFormula,/MIN\(/); assert.match(qbFormula,/Nbar|B\d+/i);
assert.match(fsFormula,/XLOOKUP/); assert.match(fsFormula,/MIN\(/);
assert.match(rkFormula,/\+/); assert.match(ndFormula,/γn|B\d+/i);

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
  sheets:wb.worksheets.map(s=>s.name),
  verifiedInputs:{Nbar:20,Ns:20,eta:1,A:0.16,u:1.6,Ls:10,gammaK:1.5,gammaN:1.15},
  formulaChecks:{qb:qbFormula,fs:fsFormula,Rk:rkFormula,NdMax:ndFormula},
  note:'Workbook stores editable inputs and real Excel formulas; V26 Golden does not rely on cached numeric results.'
};
fs.writeFileSync(path.resolve('artifacts/v26/V26_SPT_EXCEL_GOLDEN_RESULT.json'),JSON.stringify(evidence,null,2)+'\n');
console.log(`V26 SPT Excel Golden: PASS · ${captured.buffer.length} bytes · ${out}`);
