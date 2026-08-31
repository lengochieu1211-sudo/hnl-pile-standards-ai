#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import ExcelJS from 'exceljs';
import { export10304AdvancedWorkflowWorkbook } from '../src/excel-export-compat.js';
import { calculateSptSummary10304 } from '../src/pile-workflows.js';

const ROOT=path.resolve('artifacts/spt-spreadsheet-runtime');
fs.rmSync(ROOT,{recursive:true,force:true});
fs.mkdirSync(ROOT,{recursive:true});

const base={
  inputMode:'EXPLICIT_SPT_SUMMARY',pileType:'driven',sectionType:'square',
  widthM:.4,heightM:.4,sideM:.4,lengthM:10,shaftStartDepthM:0,shaftLengthM:10,
  soilGroup:'sand',nBarTip:20,nsShaft:20,eta:1,closedTip:true,gammaK:1.5,gammaN:1.15
};
const shapeLabel={square:'Vuông',rectangle:'Chữ nhật',circle:'Tròn'};

function labelRow(ws,label){
  for(let r=1;r<=ws.rowCount;r++) if(String(ws.getCell(r,1).value??'').trim()===label) return r;
  throw new Error(`Missing row ${label} in ${ws.name}`);
}
function num(v){
  if(v && typeof v==='object' && 'result' in v) return Number(v.result);
  return Number(v);
}
function near(actual,expected,tol,name){
  if(!Number.isFinite(actual)||Math.abs(actual-expected)>tol) throw new Error(`${name}: expected ${expected}, got ${actual}`);
}
function runSoffice(inputPath,outDir){
  fs.mkdirSync(outDir,{recursive:true});
  const candidates=process.platform==='win32'?['soffice.exe','libreoffice.exe']:['libreoffice','soffice'];
  let last='';
  for(const exe of candidates){
    const p=spawnSync(exe,['--headless','--convert-to','xlsx:Calc MS Excel 2007 XML','--outdir',outDir,inputPath],{encoding:'utf8',timeout:120000});
    last=`${p.stdout||''}\n${p.stderr||''}`;
    if(!p.error && p.status===0){
      const output=path.join(outDir,path.basename(inputPath));
      if(fs.existsSync(output)) return {output,log:last.trim()};
    }
    if(p.error?.code!=='ENOENT') throw new Error(`Spreadsheet runtime failed via ${exe}: ${p.error?.message||`exit ${p.status}`}\n${last}`);
  }
  throw new Error(`LibreOffice/soffice runtime not available. Install libreoffice-calc before this mandatory gate. ${last}`);
}

const cases=[
  {id:'A_BASIC_400',input:{...base}},
  {id:'B_NBAR_30',input:{...base,nBarTip:30}},
  {id:'C_SQUARE_300',input:{...base,widthM:.3,heightM:.3,sideM:.3}},
  {id:'D_CAPS',input:{...base,nBarTip:80,nsShaft:70}},
  {id:'E_RECT_400x600',input:{...base,sectionType:'rectangle',widthM:.4,heightM:.6,sideM:null}},
  {id:'F_CIRCLE_D600',input:{...base,sectionType:'circle',shape:'circle',widthM:null,heightM:null,sideM:null,diameterM:.6}}
];

const initial=await export10304AdvancedWorkflowWorkbook('spt',base,{returnBuffer:true});
if(!initial?.buffer?.byteLength) throw new Error('Production SPT exporter returned no workbook buffer');
const templatePath=path.join(ROOT,'HNL_SPT_TEMPLATE.xlsx');
fs.writeFileSync(templatePath,Buffer.from(initial.buffer));

const evidence=[];
for(const tc of cases){
  const wb=new ExcelJS.Workbook(); await wb.xlsx.readFile(templatePath);
  const inp=wb.getWorksheet('01_INPUT'); if(!inp) throw new Error('Missing 01_INPUT');
  const section=labelRow(inp,'Tiết diện'), b=labelRow(inp,'b'), h=labelRow(inp,'h'), d=labelRow(inp,'D');
  const nbar=labelRow(inp,'N̄ vùng mũi'), ns=labelRow(inp,'Ns thân cọc'), L=labelRow(inp,'L');
  inp.getCell(section,2).value=shapeLabel[tc.input.sectionType];
  inp.getCell(b,2).value=Number(tc.input.widthM)>0?tc.input.widthM*1000:'';
  inp.getCell(h,2).value=Number(tc.input.heightM)>0?tc.input.heightM*1000:'';
  inp.getCell(d,2).value=Number(tc.input.diameterM)>0?tc.input.diameterM*1000:'';
  inp.getCell(nbar,2).value=tc.input.nBarTip;
  inp.getCell(ns,2).value=tc.input.nsShaft;
  inp.getCell(L,2).value=tc.input.lengthM;
  const inputPath=path.join(ROOT,`${tc.id}.xlsx`); await wb.xlsx.writeFile(inputPath);

  const outDir=path.join(ROOT,`${tc.id}-recalc`);
  const runtime=runSoffice(inputPath,outDir);
  const rw=new ExcelJS.Workbook(); await rw.xlsx.readFile(runtime.output);
  const calc=rw.getWorksheet('02_CALC'); if(!calc) throw new Error(`${tc.id}: missing 02_CALC after runtime recalc`);
  const rows={
    area:labelRow(calc,'A_b'), perimeter:labelRow(calc,'u'), qb:labelRow(calc,'q_b'), fs:labelRow(calc,'f_s'),
    Rub:labelRow(calc,'R_u,b'), Ruf:labelRow(calc,'R_u,f'), Rk:labelRow(calc,'R_c,k / R_k'), Rd:labelRow(calc,'R_d')
  };
  let ndRow=null; for(const label of ['N_d,max','Nd,max','Nđ,max']){try{ndRow=labelRow(calc,label);break}catch{}}
  const got={
    areaM2:num(calc.getCell(rows.area,2).value),perimeterM:num(calc.getCell(rows.perimeter,2).value),
    qbKpa:num(calc.getCell(rows.qb,2).value),shaftUnitResistanceKpa:num(calc.getCell(rows.fs,2).value),
    RubKn:num(calc.getCell(rows.Rub,2).value),RufKn:num(calc.getCell(rows.Ruf,2).value),
    RkKn:num(calc.getCell(rows.Rk,2).value),RdKn:num(calc.getCell(rows.Rd,2).value)
  };
  if(ndRow) got.NdMaxKn=num(calc.getCell(ndRow,2).value);
  const engine=calculateSptSummary10304(tc.input);
  if(!engine.ok) throw new Error(`${tc.id}: Web Engine blocked: ${JSON.stringify(engine)}`);
  const pairs=[
    ['areaM2',got.areaM2,engine.geometry.areaM2,1e-8],['perimeterM',got.perimeterM,engine.geometry.perimeterM,1e-8],
    ['qbKpa',got.qbKpa,engine.qbKpa,1e-6],['fsKpa',got.shaftUnitResistanceKpa,engine.shaftUnitResistanceKpa,1e-6],
    ['RubKn',got.RubKn,engine.RubKn,1e-5],['RufKn',got.RufKn,engine.RufKn,1e-5],
    ['RkKn',got.RkKn,engine.RkKn,1e-5],['RdKn',got.RdKn,engine.RdKn,1e-5]
  ];
  if(ndRow && Number.isFinite(engine.NdMaxKn)) pairs.push(['NdMaxKn',got.NdMaxKn,engine.NdMaxKn,1e-5]);
  for(const [name,a,e,tol] of pairs) near(a,e,tol,`${tc.id} ${name}`);

  // Runtime must preserve formulas; this is not a static value-export test.
  for(const r of Object.values(rows)){
    const v=calc.getCell(r,2).value;
    if(!(v&&typeof v==='object'&&typeof v.formula==='string')) throw new Error(`${tc.id}: formula lost at 02_CALC!B${r}`);
  }
  evidence.push({case:tc.id,input:tc.input,spreadsheet:got,webEngine:{areaM2:engine.geometry.areaM2,perimeterM:engine.geometry.perimeterM,qbKpa:engine.qbKpa,shaftUnitResistanceKpa:engine.shaftUnitResistanceKpa,RubKn:engine.RubKn,RufKn:engine.RufKn,RkKn:engine.RkKn,RdKn:engine.RdKn,NdMaxKn:engine.NdMaxKn},runtimeLog:runtime.log});
}

const report={schema:'HNL_SPT_SPREADSHEET_RUNTIME_GOLDEN_V1',generatedAt:new Date().toISOString(),runtime:'LibreOffice Calc headless (mandatory CI spreadsheet recalculation)',cases:evidence};
fs.writeFileSync(path.join(ROOT,'spt-spreadsheet-runtime-golden.json'),JSON.stringify(report,null,2));
console.log(`SPT SPREADSHEET RUNTIME GOLDEN: PASS (${cases.length} cases; Web ↔ workbook recalculation parity)`);
