import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { export7888WorkflowWorkbook, exportDrivenPileWorkflowWorkbook, export5574WorkflowWorkbook } from '../src/excel-export.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const outDir=path.resolve(process.argv[2]||path.join(root,'artifacts','excel-runtime-smoke'));
fs.mkdirSync(outDir,{recursive:true});
const captured=[];
globalThis.__HNL_CAPTURE_XLSX__=async(buf,name)=>{
  const file=path.join(outDir,name);
  fs.writeFileSync(file,Buffer.from(buf));
  captured.push(file);
};

await export7888WorkflowWorkbook({type:'PHC',loadClass:'B',diameter:600,lengthM:20,sigmaCu:80});
await exportDrivenPileWorkflowWorkbook({
  shape:'square',sideM:.4,lengthM:12,tipDepthM:12,method:'hammer',gammaC:1,gammaK:1.4,
  layers:[
    {top:0,bottom:3,soilGroup:'clay',IL:.7},
    {top:3,bottom:8,soilGroup:'clay',IL:.5},
    {top:8,bottom:15,soilGroup:'clay',IL:.3}
  ]
});
await export5574WorkflowWorkbook('5574-bending-rect',{grade:'B30',steel:'CB400-V',b:300,h0:550,As:1800,Asp:0,ap:40,M:200});
delete globalThis.__HNL_CAPTURE_XLSX__;

const expectations=[
  {match:'TCVN7888',required:['00_TONG_QUAN','01_INPUT','02_BANG_TRA','03_TINH_TOAN','04_KET_QUA','05_THUYET_MINH','06_NGUON'],forbidden:['10304','5574'],formulaMin:10},
  {match:'TCVN10304',required:['00_HUONG_DAN','01_INPUT','02_DIA_CHAT','03_PHAN_DOAN','04_TRA_BANG_10304','05_CALC_10304','07_KET_QUA','08_THUYET_MINH_NGUON'],forbidden:['7888','5574','BENCHMARK'],formulaMin:40},
  {match:'TCVN5574',required:['00_TONG_QUAN','01_INPUT','02_VAT_LIEU','03_TINH_TOAN','04_KIEM_TRA','05_THUYET_MINH','06_NGUON'],forbidden:['7888','10304','BENCHMARK'],formulaMin:10}
];
const reports=[];
for(const rule of expectations){
  const file=captured.find(f=>path.basename(f).includes(rule.match));
  if(!file) throw new Error(`Thiếu XLSX smoke ${rule.match}`);
  const wb=new ExcelJS.Workbook(); await wb.xlsx.readFile(file);
  const names=wb.worksheets.map(w=>w.name);
  for(const n of rule.required) if(!names.includes(n)) throw new Error(`${path.basename(file)} thiếu sheet ${n}`);
  for(const bad of rule.forbidden) if(names.some(n=>n.includes(bad))) throw new Error(`${path.basename(file)} có sheet thừa ${bad}`);
  let formulas=0,inputRefs=0;
  for(const ws of wb.worksheets) ws.eachRow(row=>row.eachCell(cell=>{
    const f=cell.value?.formula;
    if(f){ formulas++; if(/01_INPUT|02_DIA_CHAT/.test(f)) inputRefs++; }
  }));
  if(formulas<rule.formulaMin) throw new Error(`${path.basename(file)} chỉ có ${formulas} formula`);
  if(inputRefs<2) throw new Error(`${path.basename(file)} thiếu liên kết formula tới input`);
  reports.push({file:path.basename(file),sheets:names,formulas,inputRefs,size:fs.statSync(file).size});
}
fs.writeFileSync(path.join(outDir,'excel-runtime-smoke.json'),JSON.stringify({ok:true,reports},null,2));
console.log(JSON.stringify({ok:true,reports},null,2));
