// HNL v1.27.0 Excel Production compatibility/UI layer.
// Keeps src/excel-export.js untouched. Vite aliases the app import to this module.
// Engineering formulas remain owned by the existing deterministic exporter; this
// layer only post-processes the generated XLSX for legacy Excel compatibility,
// Vietnamese finite-choice UX, and native dynamic charts.
import * as core from './excel-export.js?core';
import { addNativeColumnChart } from './xlsx-native-chart.js';
import { applyLegacyExcelFormulaCompatibility } from './excel-formula-compat.js';

export * from './excel-export.js?core';

const PILE_TYPE = Object.freeze({
  driven:'Cọc đóng/ép',
  bored:'Cọc khoan nhồi',
  'vibro-pipe':'Cọc ống hạ bằng rung',
  screw:'Cọc vít'
});
const SHAPE = Object.freeze({square:'Vuông',circle:'Tròn'});
const METHOD = Object.freeze({hammer:'Đóng bằng búa',press:'Ép tĩnh'});
const SOIL = Object.freeze({clay:'Đất dính',sand:'Đất cát'});
const SAND = Object.freeze({
  gravelly:'Cát lẫn sỏi',coarse:'Cát thô',medium:'Cát vừa',fine:'Cát mịn',silty:'Cát bụi'
});

function reverseMap(obj){ return Object.fromEntries(Object.entries(obj).map(([k,v])=>[v,k])); }
const PILE_TYPE_REV=reverseMap(PILE_TYPE),SHAPE_REV=reverseMap(SHAPE),METHOD_REV=reverseMap(METHOD),SOIL_REV=reverseMap(SOIL),SAND_REV=reverseMap(SAND);

function styleHeader(row,color='FF17365D'){
  row.font={bold:true,color:{argb:'FFFFFFFF'}};
  row.fill={type:'pattern',pattern:'solid',fgColor:{argb:color}};
  row.alignment={vertical:'middle',wrapText:true};
}
function styleSheet(ws){
  ws.eachRow(r=>{r.alignment={vertical:'top',wrapText:true};});
  ws.views=[{state:'frozen',ySplit:1}];
}
function inputFill(cell){ cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF2CC'}}; }
function formulaFill(cell){ cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE2F0D9'}}; }
function labelRow(ws,label){
  for(let r=1;r<=ws.rowCount;r++) if(String(ws.getCell(r,1).value??'').trim()===label) return r;
  return null;
}
function labelRowAny(ws,patterns){
  for(let r=1;r<=ws.rowCount;r++){
    const v=String(ws.getCell(r,1).value??'').trim();
    if(patterns.some(p=>typeof p==='string'?v===p:p.test(v))) return r;
  }
  return null;
}
function rewriteExistingFormulas(wb,rewrite){
  for(const ws of wb.worksheets){
    ws.eachRow(row=>row.eachCell(cell=>{
      const v=cell.value;
      if(v && typeof v==='object' && typeof v.formula==='string'){
        const next=rewrite(v.formula,ws,cell);
        if(next!==v.formula) cell.value={...v,formula:next};
      }
    }));
  }
}
function ensureMapSheet(wb){
  let ws=wb.getWorksheet('99_MA_NOI_BO');
  if(ws) return ws;
  ws=wb.addWorksheet('99_MA_NOI_BO');
  ws.state='veryHidden';
  ws.columns=Array.from({length:11},()=>({width:28}));
  ws.addRow(['Loại cọc','Mã','','Tiết diện','Mã','','Nhóm đất','Mã','','Loại cát','Mã']);
  styleHeader(ws.getRow(1),'FF666666');
  const pileRows=Object.entries(PILE_TYPE); for(let i=0;i<pileRows.length;i++){ws.getCell(i+2,1).value=pileRows[i][1];ws.getCell(i+2,2).value=pileRows[i][0];}
  const shapeRows=Object.entries(SHAPE); for(let i=0;i<shapeRows.length;i++){ws.getCell(i+2,4).value=shapeRows[i][1];ws.getCell(i+2,5).value=shapeRows[i][0];}
  const soilRows=Object.entries(SOIL); for(let i=0;i<soilRows.length;i++){ws.getCell(i+2,7).value=soilRows[i][1];ws.getCell(i+2,8).value=soilRows[i][0];}
  const sandRows=Object.entries(SAND); for(let i=0;i<sandRows.length;i++){ws.getCell(i+2,10).value=sandRows[i][1];ws.getCell(i+2,11).value=sandRows[i][0];}
  ws.getCell('D6').value='Phương pháp';ws.getCell('E6').value='Mã';
  ws.getCell('D7').value=METHOD.hammer;ws.getCell('E7').value='hammer';
  ws.getCell('D8').value=METHOD.press;ws.getCell('E8').value='press';
  styleSheet(ws); return ws;
}
function listValidation(values,error){
  return {type:'list',allowBlank:false,formulae:[`"${values.join(',')}"`],showErrorMessage:true,errorTitle:'Giá trị không hợp lệ',error};
}
function translatedCode(value,map,rev,def){
  const raw=String(value??'').trim();
  if(map[raw]) return raw;
  if(rev[raw]) return rev[raw];
  return def;
}


// Generic Production post-processor for finite-choice workbooks not handled by dedicated adapters.
// Core has already materialized the workbook, so exact code tokens can be translated consistently
// in values, formulas and literal list validations. Original code mapping stays veryHidden.
const GENERIC_CODE_LABELS = Object.freeze({
  square:'Vuông', circle:'Tròn', rectangle:'Chữ nhật',
  hammer:'Đóng bằng búa', press:'Ép tĩnh',
  clay:'Đất dính', sand:'Đất cát', sandyClay:'Sét pha cát', clayeySand:'Cát pha sét',
  gravelly:'Cát lẫn sỏi', coarse:'Cát thô', medium:'Cát vừa', fine:'Cát mịn', silty:'Cát bụi',
  bored:'Cọc khoan nhồi', 'vibro-pipe':'Cọc ống hạ bằng rung', screw:'Cọc vít', driven:'Cọc đóng/ép',
  YES:'Có', NO:'Không', yes:'Có', no:'Không', long:'Dài hạn', short:'Ngắn hạn',
  Tension:'Kéo', Compression:'Nén', plain:'Trơn', coldRibbed:'Gân nguội', hotRibbed:'Gân cán nóng'
});
function translateFormulaCodes(formula){
  let out=String(formula||'');
  for(const [code,label] of Object.entries(GENERIC_CODE_LABELS)) out=out.split('"'+code+'"').join('"'+label+'"');
  return out;
}
function translateLiteralListFormula(formula){
  const text=String(formula||'');
  if(text.length<2 || text[0]!=='"' || text[text.length-1]!=='"') return text;
  const items=text.slice(1,-1).split(',').map(x=>x.trim());
  let changed=false;
  const translated=items.map(v=>{const t=GENERIC_CODE_LABELS[v]; if(t){changed=true;return t;} return v;});
  return changed?'"'+translated.join(',')+'"':text;
}
function applyGenericVietnameseCodeLists(wb){
  ensureMapSheet(wb);
  let translatedCells=0,translatedFormulas=0,translatedValidations=0;
  for(const ws of wb.worksheets){
    if(ws.name==='99_MA_NOI_BO') continue;
    ws.eachRow({includeEmpty:false},row=>row.eachCell({includeEmpty:false},cell=>{
      if(typeof cell.value==='string' && GENERIC_CODE_LABELS[cell.value]){cell.value=GENERIC_CODE_LABELS[cell.value];translatedCells++;}
      else if(cell.value && typeof cell.value==='object' && typeof cell.value.formula==='string'){const next=translateFormulaCodes(cell.value.formula);if(next!==cell.value.formula){cell.value={...cell.value,formula:next};translatedFormulas++;}}
      const dv=cell.dataValidation;
      if(dv?.type==='list' && Array.isArray(dv.formulae)){const next=dv.formulae.map(translateLiteralListFormula);if(next.some((v,i)=>v!==dv.formulae[i])){cell.dataValidation={...dv,formulae:next,showErrorMessage:true,errorTitle:dv.errorTitle||'Giá trị không hợp lệ',error:dv.error||'Vui lòng chọn giá trị tiếng Việt trong danh sách.'};translatedValidations++;}}
    }));
  }
  return {translatedCells,translatedFormulas,translatedValidations};
}
function applyExplicitSptVietnameseAndCompatibility(wb){
  const inp=wb.getWorksheet('01_INPUT'),calc=wb.getWorksheet('02_CALC'),d1=wb.getWorksheet('04_BANG_D1');
  if(!inp||!calc||!d1) return false;
  const pileRow=labelRow(inp,'Loại cọc'),etaRow=labelRow(inp,'η'),nbarRow=labelRow(inp,'N̄ vùng mũi'),nsRow=labelRow(inp,'Ns thân cọc');
  const aRow=labelRow(inp,'A'),uRow=labelRow(inp,'u'),lsRow=labelRow(inp,'Ls'),gkRow=labelRowAny(inp,['γk','gamma_k']),gnRow=labelRowAny(inp,['γn','gamma_n']);
  const qbRow=labelRow(calc,'q_b'),fsRow=labelRow(calc,'f_s');
  const rubRow=labelRowAny(calc,['R_u,b','Ru,b']),rufRow=labelRowAny(calc,['R_u,f','Ru,f']);
  const rkRow=labelRowAny(calc,['R_c,k / R_k','Rk','R_k']);
  const rdRow=labelRowAny(calc,['R_d','Rd']);
  const ndRow=labelRowAny(calc,[/N.*d.*max/i,/Nd,max/i]);
  if(![pileRow,etaRow,nbarRow,nsRow,aRow,uRow,lsRow,gkRow,qbRow,fsRow,rubRow,rufRow,rkRow,rdRow].every(Boolean)) return false;

  ensureMapSheet(wb);
  if(inp.columnCount<5) inp.getColumn(5).width=2;
  inp.getColumn(5).hidden=true;
  const code=translatedCode(inp.getCell(pileRow,2).value,PILE_TYPE,PILE_TYPE_REV,'driven');
  inp.getCell(pileRow,2).value=PILE_TYPE[code]; inputFill(inp.getCell(pileRow,2));
  inp.getCell(pileRow,2).dataValidation=listValidation(Object.values(PILE_TYPE),'Vui lòng chọn loại cọc trong danh sách.');
  inp.getCell(pileRow,5).value={formula:`VLOOKUP(B${pileRow},'99_MA_NOI_BO'!$A$2:$B$5,2,FALSE)`};
  inp.getCell(pileRow,4).value='Chọn trong danh sách: Cọc đóng/ép / Cọc khoan nhồi / Cọc ống hạ bằng rung / Cọc vít.';

  // Legacy-compatible formulas for the explicit SPT summary path.
  calc.getCell(qbRow,2).value={formula:`IF(OR(NOT(ISNUMBER('01_INPUT'!B${nbarRow})),NOT(ISNUMBER('01_INPUT'!B${etaRow}))),"BLOCK",MIN(VLOOKUP('01_INPUT'!E${pileRow},'04_BANG_D1'!$A$2:$H$5,3,FALSE)*'01_INPUT'!B${nbarRow}*IF(VLOOKUP('01_INPUT'!E${pileRow},'04_BANG_D1'!$A$2:$H$5,7,FALSE)=1,'01_INPUT'!B${etaRow},1),VLOOKUP('01_INPUT'!E${pileRow},'04_BANG_D1'!$A$2:$H$5,4,FALSE)*IF(VLOOKUP('01_INPUT'!E${pileRow},'04_BANG_D1'!$A$2:$H$5,8,FALSE)=1,'01_INPUT'!B${etaRow},1)))`};
  calc.getCell(fsRow,2).value={formula:`IF(NOT(ISNUMBER('01_INPUT'!B${nsRow})),"BLOCK",MIN(VLOOKUP('01_INPUT'!E${pileRow},'04_BANG_D1'!$A$2:$H$5,5,FALSE)*'01_INPUT'!B${nsRow},VLOOKUP('01_INPUT'!E${pileRow},'04_BANG_D1'!$A$2:$H$5,6,FALSE)))`};
  formulaFill(calc.getCell(qbRow,2)); formulaFill(calc.getCell(fsRow,2));
  calc.getCell(qbRow,4).value='Bảng D.1 · VLOOKUP + IF + MIN · tương thích Excel rộng';
  calc.getCell(fsRow,4).value='Bảng D.1 · VLOOKUP + IF + MIN · tương thích Excel rộng';

  const guide=wb.getWorksheet('00_HUONG_DAN');
  if(guide && !Array.from({length:guide.rowCount},(_,i)=>String(guide.getCell(i+1,1).value??'')).includes('Excel tương thích')){
    guide.addRow(['Excel tương thích','SPT Production không dùng LET/XLOOKUP/LAMBDA ở q_b và f_s; dùng VLOOKUP + IF + MIN để tránh #NAME? trên Excel cũ.']);
  }

  let vis=wb.getWorksheet('08_BIEU_DO'); if(vis) wb.removeWorksheet(vis.id);
  vis=wb.addWorksheet('08_BIEU_DO'); vis.columns=[{width:36},{width:20},{width:14},{width:58}];
  vis.addRow(['Chỉ tiêu','Giá trị','Đơn vị','Diễn giải']); styleHeader(vis.getRow(1));
  vis.addRow(['Sức kháng mũi Ru,b',{formula:`'02_CALC'!B${rubRow}`},'kN','Thành phần sức kháng mũi']);
  vis.addRow(['Sức kháng thân Ru,f',{formula:`'02_CALC'!B${rufRow}`},'kN','Thành phần ma sát thân']);
  vis.addRow(['Sức chịu tải đặc trưng Rc,k',{formula:`'02_CALC'!B${rkRow}`},'kN','Ru,b + Ru,f']);
  vis.addRow(['Sức chịu tải thiết kế Rd',{formula:`'02_CALC'!B${rdRow}`},'kN','Rc,k / γk']);
  vis.addRow(['Tải giới hạn Nd,max',ndRow?{formula:`'02_CALC'!B${ndRow}`}:'','kN',gnRow?'Rd / γn':'Chỉ hiện khi có γn']);
  styleSheet(vis);
  return true;
}

function applyDrivenVietnamese(wb){
  const inp=wb.getWorksheet('01_INPUT'),geo=wb.getWorksheet('02_DIA_CHAT'),calc=wb.getWorksheet('05_CALC_10304'),res=wb.getWorksheet('07_KET_QUA');
  if(!inp||!geo||!calc||!res) return false;
  const shapeRow=labelRow(inp,'Tiết diện'),methodRow=labelRow(inp,'Phương pháp');
  if(!shapeRow||!methodRow) return false;
  ensureMapSheet(wb);

  // Rewrite formulas before adding hidden mapping formulas, so no recursive rewrites occur.
  rewriteExistingFormulas(wb,(f)=>f
    .replaceAll(`'01_INPUT'!B${shapeRow}`,`'01_INPUT'!E${shapeRow}`)
    .replaceAll(`'01_INPUT'!B${methodRow}`,`'01_INPUT'!E${methodRow}`)
    .replace(/'02_DIA_CHAT'!D(\d+)/g,"'02_DIA_CHAT'!I$1")
    .replace(/'02_DIA_CHAT'!E(\d+)/g,"'02_DIA_CHAT'!J$1")
  );

  if(inp.columnCount<5) inp.getColumn(5).width=2; inp.getColumn(5).hidden=true;
  const shapeCode=translatedCode(inp.getCell(shapeRow,2).value,SHAPE,SHAPE_REV,'square');
  inp.getCell(shapeRow,2).value=SHAPE[shapeCode]; inputFill(inp.getCell(shapeRow,2));
  inp.getCell(shapeRow,2).dataValidation=listValidation(Object.values(SHAPE),'Vui lòng chọn tiết diện trong danh sách.');
  inp.getCell(shapeRow,5).value={formula:`VLOOKUP(B${shapeRow},'99_MA_NOI_BO'!$D$2:$E$3,2,FALSE)`};
  const methodCode=translatedCode(inp.getCell(methodRow,2).value,METHOD,METHOD_REV,'hammer');
  inp.getCell(methodRow,2).value=METHOD[methodCode]; inputFill(inp.getCell(methodRow,2));
  inp.getCell(methodRow,2).dataValidation=listValidation(Object.values(METHOD),'Vui lòng chọn phương pháp hạ cọc trong danh sách.');
  inp.getCell(methodRow,5).value={formula:`VLOOKUP(B${methodRow},'99_MA_NOI_BO'!$D$7:$E$8,2,FALSE)`};

  // Geology: visible Vietnamese choices in D/E, internal codes in hidden I/J.
  geo.getColumn(9).hidden=true; geo.getColumn(10).hidden=true;
  for(let r=2;r<=Math.max(9,geo.rowCount);r++){
    const soilCode=translatedCode(geo.getCell(r,4).value,SOIL,SOIL_REV,'clay');
    const sandCode=translatedCode(geo.getCell(r,5).value,SAND,SAND_REV,'fine');
    geo.getCell(r,4).value=SOIL[soilCode]; inputFill(geo.getCell(r,4));
    geo.getCell(r,5).value=SAND[sandCode]; inputFill(geo.getCell(r,5));
    geo.getCell(r,4).dataValidation=listValidation(Object.values(SOIL),'Vui lòng chọn nhóm đất trong danh sách.');
    geo.getCell(r,5).dataValidation={type:'list',allowBlank:true,formulae:[`"${Object.values(SAND).join(',')}"`],showErrorMessage:true,errorTitle:'Giá trị không hợp lệ',error:'Vui lòng chọn loại cát trong danh sách.'};
    geo.getCell(r,9).value={formula:`VLOOKUP(D${r},'99_MA_NOI_BO'!$G$2:$H$3,2,FALSE)`};
    geo.getCell(r,10).value={formula:`VLOOKUP(E${r},'99_MA_NOI_BO'!$J$2:$K$6,2,FALSE)`};
  }

  let vis=wb.getWorksheet('09_BIEU_DO'); if(vis) wb.removeWorksheet(vis.id);
  vis=wb.addWorksheet('09_BIEU_DO'); vis.columns=[{width:38},{width:20},{width:14},{width:58}];
  vis.addRow(['Chỉ tiêu','Giá trị','Đơn vị','Diễn giải']); styleHeader(vis.getRow(1));
  const rm=labelRow(res,'R mũi'),rf=labelRow(res,'R ma sát'),rk=labelRow(res,'Rk'),rd=labelRow(res,'Rd'),nd=labelRowAny(res,[/Nd,max/i]);
  vis.addRow(['Sức kháng mũi',rm?{formula:`'07_KET_QUA'!B${rm}`}:'','kN','Bảng 2 + Bảng 4']);
  vis.addRow(['Sức kháng thân',rf?{formula:`'07_KET_QUA'!B${rf}`}:'','kN','Bảng 3 + Bảng 4']);
  vis.addRow(['Sức chịu tải đặc trưng Rk',rk?{formula:`'07_KET_QUA'!B${rk}`}:'','kN','Công thức (9)']);
  vis.addRow(['Sức chịu tải thiết kế Rd',rd?{formula:`'07_KET_QUA'!B${rd}`}:'','kN','Rk / γk']);
  vis.addRow(['Tải giới hạn Nd,max',nd?{formula:`'07_KET_QUA'!B${nd}`}:'','kN','Rd / γn']);
  styleSheet(vis);
  return true;
}

export async function postProcessHnlWorkbook(buffer,fileName='HNL.xlsx'){
  const mod=await import('exceljs'); const ExcelJS=mod.default||mod;
  const wb=new ExcelJS.Workbook(); await wb.xlsx.load(buffer);
  const explicitSpt=applyExplicitSptVietnameseAndCompatibility(wb);
  const driven=applyDrivenVietnamese(wb);
  const genericLocalization=(!explicitSpt&&!driven)?applyGenericVietnameseCodeLists(wb):null;
  if(genericLocalization && genericLocalization.translatedValidations===0 && genericLocalization.translatedCells===0 && genericLocalization.translatedFormulas===0){const map=wb.getWorksheet('99_MA_NOI_BO');if(map) wb.removeWorksheet(map.id);}
  const legacyFormulaCompatibility=applyLegacyExcelFormulaCompatibility(wb);
  if(legacyFormulaCompatibility.remaining!==0) throw new Error('Excel compatibility transformer left modern formulas');
  let out=await wb.xlsx.writeBuffer();
  if(explicitSpt){
    out=await addNativeColumnChart(out,{sheetName:'08_BIEU_DO',title:'Thành phần và sức chịu tải cọc theo SPT',categoryRange:'$A$2:$A$6',valueRange:'$B$2:$B$6',seriesName:'Sức chịu tải',axisTitle:'kN',fromCol:4,fromRow:1,toCol:12,toRow:19});
  } else if(driven){
    out=await addNativeColumnChart(out,{sheetName:'09_BIEU_DO',title:'Thành phần và sức chịu tải cọc đóng/ép',categoryRange:'$A$2:$A$6',valueRange:'$B$2:$B$6',seriesName:'Sức chịu tải',axisTitle:'kN',fromCol:4,fromRow:1,toCol:12,toRow:19});
  }
  return {buffer:out,fileName};
}

function downloadBuffer(buffer,name){
  const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1200);
}
async function runProcessed(fn,args,{returnBuffer=false}={}){
  const previous=globalThis.__HNL_CAPTURE_XLSX__;
  let captured=null;
  globalThis.__HNL_CAPTURE_XLSX__=async(buf,name)=>{captured={buffer:buf,fileName:name};return captured;};
  let ret;
  try{ ret=await fn(...args); }
  finally{ if(previous===undefined) delete globalThis.__HNL_CAPTURE_XLSX__; else globalThis.__HNL_CAPTURE_XLSX__=previous; }
  if(!captured && ret?.buffer) captured={buffer:ret.buffer,fileName:ret.fileName||'HNL.xlsx'};
  if(!captured) return ret;
  const processed=await postProcessHnlWorkbook(captured.buffer,captured.fileName);
  if(returnBuffer) return processed;
  if(typeof previous==='function') return previous(processed.buffer,processed.fileName);
  return downloadBuffer(processed.buffer,processed.fileName);
}

export async function exportDrivenPileWorkflowWorkbook(input={},options={}){
  return runProcessed(core.exportDrivenPileWorkflowWorkbook,[input,{...options,returnBuffer:true}],{returnBuffer:Boolean(options?.returnBuffer)});
}
export async function export10304AdvancedWorkflowWorkbook(workflowId,input={},options={}){
  return runProcessed(core.export10304AdvancedWorkflowWorkbook,[workflowId,input,{...options,returnBuffer:true}],{returnBuffer:Boolean(options?.returnBuffer)});
}
export async function exportUnifiedEngineeringWorkbook(...args){
  return runProcessed(core.exportUnifiedEngineeringWorkbook,args,{returnBuffer:false});
}
