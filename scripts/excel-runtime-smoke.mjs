import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { export7888WorkflowWorkbook, exportDrivenPileWorkflowWorkbook, export5574WorkflowWorkbook, export10304AdvancedWorkflowWorkbook, exportIntegratedPileCapacityWorkbook, exportMultiBoreholePileCapacityWorkbook } from '../src/excel-export.js';

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
await export10304AdvancedWorkflowWorkbook('end-bearing',{
  shape:'circle',diameterM:1,rockCompressiveStrengthKpa:31300,rqdPercent:30,gammaG:1.4,
  embedmentLengthM:5,embeddedOuterDiameterM:1,minimumQbKpa:1000,gammaK:1.4,gammaN:1.15
});
await export10304AdvancedWorkflowWorkbook('bored',{
  shape:'circle',diameterM:1,tipDepthM:12,shaftStartDepthM:0,maxSegmentM:2,methodCaseId:'drilled-water-bentonite',gammaK:1.4,gammaN:1.15,
  layers:[
    {top:0,bottom:6,soilGroup:'clay',soilClass:'clay',IL:.4,gammaKnM3:18,Sr:.9},
    {top:6,bottom:15,soilGroup:'sand',soilClass:'sand',sandType:'medium',phiDeg:31,gammaKnM3:18,gammaEffectiveKnM3:10}
  ]
});
await export10304AdvancedWorkflowWorkbook('spt',{
  pileType:'bored',shape:'circle',diameterM:1,lengthM:12,tipDepthM:12,shaftStartDepthM:0,gammaK:1.5,gammaN:1.15,
  layers:[{top:0,bottom:6,soilGroup:'sand'},{top:6,bottom:15,soilGroup:'sand'}],
  // PDF Decision fixture: depth=6 belongs to deeper shaft layer; depth=12 is tip-window input but excluded from shaft [6,12).
  sptPoints:[{depthM:2,N:10},{depthM:5.5,N:15},{depthM:6,N:20},{depthM:8,N:25},{depthM:11.5,N:20},{depthM:12,N:30},{depthM:12.5,N:40}]
});
await exportIntegratedPileCapacityWorkbook({
  soilWorkflowId:'10304-end-bearing',
  soilInput:{shape:'square',sideM:.4,rockCompressiveStrengthKpa:50000,rqdPercent:100,gammaG:1.1,embedmentLengthM:5,embeddedOuterDiameterM:.4,minimumQbKpa:1000,gammaK:1.2,gammaN:1.15},
  materialInput:{grade:'B20',steel:'CB400-V',shape:'square',sideMm:400,widthMm:400,heightMm:400,AsTotMm2:800,L0Mm:4000,e0Mm:400/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long'}
});

const mbMaterial={grade:'B30',steel:'CB400-V',shape:'square',sideMm:400,widthMm:400,heightMm:400,AsTotMm2:1600,L0Mm:4000,e0Mm:400/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long'};
const mbBh=(id,type,N1,N2,N3)=>({id,layers:[{top:0,bottom:4,soilGroup:'sand',sandType:type,sptN:N1},{top:4,bottom:9,soilGroup:'sand',sandType:type,sptN:N2},{top:9,bottom:15,soilGroup:'sand',sandType:type,sptN:N3}],sptPoints:[{depthM:10,N:N3-5},{depthM:11,N:N3},{depthM:12,N:N3+5},{depthM:13,N:N3},{depthM:14,N:N3-5}]});
await exportMultiBoreholePileCapacityWorkbook({
  mechanicalWorkflowId:'10304-driven',
  pileInput:{shape:'square',sideM:.4,lengthM:12,tipDepthM:12,shaftStartDepthM:0,maxSegmentM:2,gammaN:1.15},
  mechanicalInput:{method:'hammer',gammaK:1.4},sptInput:{gammaK:1.5,pileType:'driven'},materialInput:mbMaterial,gammaN:1.15,
  boreholes:[mbBh('HK1','medium',18,24,30),mbBh('HK2','fine',10,15,20),mbBh('HK3','coarse',25,35,45)]
});
await export5574WorkflowWorkbook('5574-bending-rect',{grade:'B30',steel:'CB400-V',b:300,h0:550,As:1800,Asp:0,ap:40,M:200});
delete globalThis.__HNL_CAPTURE_XLSX__;

const expectations=[
  {match:'TCVN7888',required:['00_TONG_QUAN','01_INPUT','02_BANG_TRA','03_TINH_TOAN','04_KET_QUA','05_THUYET_MINH','06_NGUON'],forbidden:['10304','5574'],formulaMin:10,inputRef:/01_INPUT/},
  {match:'Coc_Dong_Ep',required:['00_HUONG_DAN','01_INPUT','02_DIA_CHAT','03_PHAN_DOAN','04_TRA_BANG_10304','05_CALC_10304','07_KET_QUA','08_THUYET_MINH_NGUON'],forbidden:['7888','5574','BENCHMARK'],formulaMin:40,inputRef:/01_INPUT|02_DIA_CHAT/},
  {match:'Rock_EndBearing_P0Pass3',required:['00_HUONG_DAN','01_DAU_VAO','LOOKUP_BANG1','CALC_ROCK','98_NGUON'],forbidden:['_xll'],formulaMin:8,inputRef:/01_DAU_VAO|LOOKUP_BANG1/},
  {match:'Bored_Raw_P0Pass3',required:['00_HUONG_DAN','01_DAU_VAO','SOIL_PROFILE','LOOKUP_BANG3_6','LOOKUP_MUI','SHAFT_SEGMENTS','CALC_TIP_RK_RD','98_NGUON'],forbidden:['_xll'],formulaMin:100,inputRef:/01_DAU_VAO|SOIL_PROFILE|LOOKUP_BANG3_6|LOOKUP_MUI/},
  {match:'SPT_Raw_P0Pass3',required:['00_HUONG_DAN','01_DAU_VAO','SOIL_PROFILE','SPT_POINTS','LOOKUP_D1','CALC_TIP','CALC_SHAFT','CALC_RK_RD','98_NGUON'],forbidden:['_xll'],formulaMin:100,inputRef:/01_DAU_VAO|SOIL_PROFILE|SPT_POINTS|LOOKUP_D1/},
  {match:'Pile_Capacity_Rsoil_Rmaterial_E2E',required:['00_HUONG_DAN','01_DAU_VAO','LOOKUP_BANG1','CALC_ROCK','98_NGUON','MATERIAL_INPUT','MATERIAL_LOOKUP','MATERIAL_CALC','PILE_GOVERNING','E2E_SOURCE'],forbidden:['_xll'],formulaMin:25,inputRef:/01_DAU_VAO|LOOKUP_BANG1|MATERIAL_INPUT/},
  {match:'Multi_Borehole_CoLy_SPT_Rmaterial',required:['00_HUONG_DAN','BATCH_INPUT','BOREHOLE_BATCH','BATCH_SOURCE'],forbidden:['_xll'],formulaMin:250,inputRef:/B0\d[MS]_/},
  {match:'TCVN5574',required:['00_TONG_QUAN','01_INPUT','02_VAT_LIEU','03_TINH_TOAN','04_KIEM_TRA','05_THUYET_MINH','06_NGUON'],forbidden:['7888','10304','BENCHMARK'],formulaMin:10,inputRef:/01_INPUT|02_VAT_LIEU/}
]
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
    if(f){ formulas++; if((rule.inputRef||/01_INPUT|02_DIA_CHAT/).test(f)) inputRefs++; }
  }));
  if(formulas<rule.formulaMin) throw new Error(`${path.basename(file)} chỉ có ${formulas} formula`);
  if(inputRefs<2) throw new Error(`${path.basename(file)} thiếu liên kết formula tới input`);
  reports.push({file:path.basename(file),sheets:names,formulas,inputRefs,size:fs.statSync(file).size});
}
fs.writeFileSync(path.join(outDir,'excel-runtime-smoke.json'),JSON.stringify({ok:true,reports},null,2));
console.log(JSON.stringify({ok:true,reports},null,2));
