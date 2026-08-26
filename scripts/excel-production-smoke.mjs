#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { resolveCliOutputPath } from './cross-platform-paths.mjs';
import { export10304AdvancedWorkflowWorkbook, exportDrivenPileWorkflowWorkbook } from '../src/excel-export-compat.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const releaseMeta=JSON.parse(fs.readFileSync(path.join(root,'public/release-meta.json'),'utf8'));
assert.equal(pkg.version,'1.26.0','Excel Production smoke yêu cầu App Version 1.26.0');
assert.equal(releaseMeta.appVersion,pkg.version);
assert.equal(releaseMeta.goldenBaseline,'1.25.7');
assert.equal(releaseMeta.searchBrain,'1.9.23');
assert.equal(releaseMeta.searchBrainStatus,'LOCKED');

// Windows DCE absolute-path regression: never create D:\\D:\\...
{
  const abs='D:\\a\\hnl-pile-standards-ai\\hnl-pile-standards-ai\\artifacts\\dce-udf-behavioral\\dce-udf-behavioral-golden-v1.25.7.json';
  const cwd='D:\\a\\hnl-pile-standards-ai\\hnl-pile-standards-ai';
  assert.equal(resolveCliOutputPath(abs,'unused',{cwd,pathImpl:path.win32}),path.win32.normalize(abs));
}

async function hasNativeChart(buffer){
  const zip=await JSZip.loadAsync(buffer);
  return Object.keys(zip.files).some(n=>/^xl\/drawings\/charts\/chart\d+\.xml$/.test(n));
}
function rowByLabel(ws,label){
  for(let r=1;r<=ws.rowCount;r++) if(String(ws.getCell(r,1).value??'').trim()===label) return r;
  return null;
}

// Excel Production Pass 1: explicit SPT summary — Vietnamese dropdown + legacy formula + native chart.
const spt=await export10304AdvancedWorkflowWorkbook('spt',{
  inputMode:'EXPLICIT_SPT_SUMMARY',pileType:'driven',eta:1,nBarTip:20,nsShaft:20,
  areaM2:0.16,perimeterM:1.6,shaftLengthM:10,gammaK:1.5,gammaN:1.15
},{returnBuffer:true});
assert.ok(spt?.buffer,'Không tạo được buffer SPT explicit');
{
  const wb=new ExcelJS.Workbook(); await wb.xlsx.load(spt.buffer);
  const inp=wb.getWorksheet('01_INPUT'),calc=wb.getWorksheet('02_CALC'),map=wb.getWorksheet('99_MA_NOI_BO'),vis=wb.getWorksheet('08_BIEU_DO');
  assert.ok(inp&&calc&&map&&vis,'SPT explicit thiếu sheet Excel Production');
  assert.equal(map.state,'veryHidden');
  const pile=rowByLabel(inp,'Loại cọc'),qb=rowByLabel(calc,'q_b'),fs=rowByLabel(calc,'f_s');
  assert.equal(String(inp.getCell(pile,2).value),'Cọc đóng/ép');
  assert.equal(inp.getCell(pile,2).dataValidation?.type,'list');
  const qbf=String(calc.getCell(qb,2).value?.formula||''),fsf=String(calc.getCell(fs,2).value?.formula||'');
  assert.match(qbf,/VLOOKUP\(/i); assert.match(qbf,/MIN\(/i);
  assert.match(fsf,/VLOOKUP\(/i); assert.match(fsf,/MIN\(/i);
  assert.doesNotMatch(qbf,/\b(?:LET|XLOOKUP|LAMBDA)\s*\(/i);
  assert.doesNotMatch(fsf,/\b(?:LET|XLOOKUP|LAMBDA)\s*\(/i);
  assert.ok(await hasNativeChart(spt.buffer),'SPT explicit thiếu native chart');
}

// Excel Production Pass 2: driven pile — Vietnamese finite-choice dropdowns + hidden codes + native chart.
const driven=await exportDrivenPileWorkflowWorkbook({
  shape:'square',sideM:.4,lengthM:12,tipDepthM:12,method:'hammer',gammaC:1,gammaK:1.4,gammaN:1.15,
  layers:[
    {top:0,bottom:4,soilGroup:'clay',IL:.6},
    {top:4,bottom:8,soilGroup:'sand',sandType:'fine'},
    {top:8,bottom:15,soilGroup:'sand',sandType:'medium'}
  ]
},{returnBuffer:true});
assert.ok(driven?.buffer,'Không tạo được buffer cọc đóng/ép');
{
  const wb=new ExcelJS.Workbook(); await wb.xlsx.load(driven.buffer);
  const inp=wb.getWorksheet('01_INPUT'),geo=wb.getWorksheet('02_DIA_CHAT'),map=wb.getWorksheet('99_MA_NOI_BO'),vis=wb.getWorksheet('09_BIEU_DO');
  assert.ok(inp&&geo&&map&&vis,'Driven thiếu sheet Excel Production');
  assert.equal(map.state,'veryHidden');
  const shape=rowByLabel(inp,'Tiết diện'),method=rowByLabel(inp,'Phương pháp');
  assert.equal(String(inp.getCell(shape,2).value),'Vuông');
  assert.equal(String(inp.getCell(method,2).value),'Đóng bằng búa');
  assert.equal(inp.getCell(shape,2).dataValidation?.type,'list');
  assert.equal(inp.getCell(method,2).dataValidation?.type,'list');
  assert.equal(String(geo.getCell(2,4).value),'Đất dính');
  assert.equal(String(geo.getCell(3,4).value),'Đất cát');
  assert.equal(String(geo.getCell(3,5).value),'Cát mịn');
  assert.equal(geo.getCell(2,4).dataValidation?.type,'list');
  assert.equal(geo.getCell(2,5).dataValidation?.type,'list');
  assert.equal(inp.getColumn(5).hidden,true);
  assert.equal(geo.getColumn(9).hidden,true);
  assert.equal(geo.getColumn(10).hidden,true);
  const areaFormula=String(wb.getWorksheet('05_CALC_10304').getCell('B2').value?.formula||'');
  assert.match(areaFormula,/'01_INPUT'!E2|E\d+/);
  assert.ok(await hasNativeChart(driven.buffer),'Driven thiếu native chart');
}

console.log(JSON.stringify({
  ok:true,
  appVersion:pkg.version,
  goldenBaseline:releaseMeta.goldenBaseline,
  searchBrain:`${releaseMeta.searchBrain} ${releaseMeta.searchBrainStatus}`,
  windowsPathPortable:true,
  explicitSpt:{vietnameseDropdown:true,legacyFormula:true,nativeChart:true},
  driven:{vietnameseDropdowns:true,hiddenInternalCodes:true,nativeChart:true}
},null,2));
