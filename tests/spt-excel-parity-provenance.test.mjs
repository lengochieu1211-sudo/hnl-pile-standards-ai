import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { export10304AdvancedWorkflowWorkbook } from '../src/excel-export-compat.js';

const base={inputMode:'EXPLICIT_SPT_SUMMARY',pileType:'driven',sectionType:'square',widthM:.4,heightM:.4,sideM:.4,lengthM:10,shaftStartDepthM:0,shaftLengthM:10,soilGroup:'sand',nBarTip:20,nsShaft:20,eta:1,closedTip:true,gammaK:1.5,gammaN:1.15};
function labelRow(ws,label){for(let r=1;r<=ws.rowCount;r++)if(String(ws.getCell(r,1).value??'').trim()===label)return r;return null;}
async function workbook(){const out=await export10304AdvancedWorkflowWorkbook('spt',base,{returnBuffer:true});const wb=new ExcelJS.Workbook();await wb.xlsx.load(out.buffer);return wb;}
function allText(ws){const parts=[];ws.eachRow({includeEmpty:false},r=>r.eachCell({includeEmpty:false},c=>{const v=c.value;if(typeof v==='string')parts.push(v);else if(v&&typeof v==='object'&&typeof v.text==='string')parts.push(v.text);}));return parts.join('\n');}

test('SPT workbook provenance identifies standard, Annex D and Table D.1 without inventing a page',async()=>{
  const wb=await workbook();
  const source=wb.getWorksheet('98_NGUON')||wb.worksheets.find(ws=>/NGUON|SOURCE/i.test(ws.name));
  assert.ok(source,'missing provenance/source sheet');
  const text=allText(source)+'\n'+wb.worksheets.map(allText).join('\n');
  assert.match(text,/TCVN\s*10304\s*:\s*2025/i);
  assert.match(text,/Phụ\s*lục\s*D|Annex\s*D/i);
  assert.match(text,/Bảng\s*D\.1|Table\s*D\.1/i);
});

test('SPT workbook keeps source geometry as editable INPUT and A/u as derived formulas',async()=>{
  const wb=await workbook(),inp=wb.getWorksheet('01_INPUT'),calc=wb.getWorksheet('02_CALC');
  assert.ok(inp&&calc);
  const rows=Object.fromEntries(['Tiết diện','b','h','D','A_b (dẫn xuất)','u (dẫn xuất)','L'].map(x=>[x,labelRow(inp,x)]));
  for(const [k,r] of Object.entries(rows)) assert.ok(r,`missing ${k}`);
  for(const k of ['Tiết diện','b','h','D']){
    const c=inp.getCell(rows[k],2); assert.notEqual(c.fill?.fgColor?.argb,null,`${k} should be visually marked as input`);
  }
  for(const k of ['A_b (dẫn xuất)','u (dẫn xuất)']){
    const c=inp.getCell(rows[k],2); assert.equal(typeof c.value?.formula,'string',`${k} must be formula, not dead value`);
    assert.match(c.value.formula,/01_INPUT|PI\(\)|\/1000/);
  }
  const ar=labelRow(calc,'A_b'),ur=labelRow(calc,'u'),rub=labelRow(calc,'R_u,b'),ruf=labelRow(calc,'R_u,f');
  for(const r of [ar,ur,rub,ruf]) assert.ok(r);
  assert.equal(typeof calc.getCell(ar,2).value?.formula,'string');
  assert.equal(typeof calc.getCell(ur,2).value?.formula,'string');
  assert.match(calc.getCell(rub,2).value.formula,new RegExp(`B${ar}`));
  assert.match(calc.getCell(ruf,2).value.formula,new RegExp(`B${ur}`));
  assert.doesNotMatch(calc.getCell(rub,2).value.formula,/\b0\.16\b/);
  assert.doesNotMatch(calc.getCell(ruf,2).value.formula,/\b1\.6\b/);
});

test('SPT workbook section selector is Vietnamese and supports square rectangle circle',async()=>{
  const wb=await workbook(),inp=wb.getWorksheet('01_INPUT');
  const r=labelRow(inp,'Tiết diện'); assert.ok(r);
  assert.equal(inp.getCell(r,2).value,'Vuông');
  const dv=inp.getCell(r,2).dataValidation; assert.equal(dv?.type,'list');
  const formula=String(dv?.formulae?.[0]??'');
  for(const label of ['Vuông','Chữ nhật','Tròn']) assert.match(formula,new RegExp(label));
});
