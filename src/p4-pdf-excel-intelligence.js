// HNL Pile Standards AI v1.27.0 P4 — PDF/Image -> Excel Intelligence
// SHADOW/REVIEW first. This module MUST NOT mutate Search Brain or Calculation Engine.

export const P4_SCHEMA = 'HNL_P4_PDF_EXCEL_INTELLIGENCE_V1';
export const P4_EXPORT_SCHEMA = 'HNL_P4_EXCEL_EXPORT_PLAN_V1';
export const P4_PROMOTION_STATE = 'SHADOW_ONLY';

const SAFE_EXCEL_FUNCTIONS = new Set([
  'SUM','AVERAGE','MIN','MAX','ROUND','IF','AND','OR','NOT','ABS','SQRT','POWER','PI'
]);

const SOURCE_STATES = new Set(['VERIFIED','BENCHMARKED','REVIEW','BLOCK']);
const SOURCE_TYPES = new Set(['pdf-native','pdf-scan','image','ocr','vision-reuse','manual']);

function text(v='') { return String(v ?? '').replace(/\r\n?/g,'\n').trim(); }
function clip(v, lo=0, hi=1) { const n=Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo,n)) : null; }
function asciiFold(v='') {
  return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D');
}
function technicalFold(v='') {
  return asciiFold(v).toLowerCase()
    .replace(/(?<=\d)\s+(?=\d)/g,'')
    .replace(/\(\s+/g,'(').replace(/\s+\)/g,')')
    .replace(/([a-z0-9])\s*([.:,/_-])\s*(?=[a-z0-9])/g,'$1$2')
    .replace(/\s+/g,' ').trim();
}
function slug(v='ctx') {
  return technicalFold(v).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,64) || 'ctx';
}
function unique(arr=[]) { return [...new Set(arr.filter(Boolean))]; }
function isFiniteNumber(v){ return Number.isFinite(Number(v)); }
function asNumberOrNull(v){ const n=Number(String(v ?? '').replace(',','.')); return Number.isFinite(n)?n:null; }
function cleanUnit(v=''){ return String(v||'').replace(/m2\b/gi,'m²').replace(/mm2\b/gi,'mm²').trim(); }

function normalizeBbox(v) {
  if(!Array.isArray(v) || v.length!==4) return null;
  const a=v.map(Number); if(!a.every(Number.isFinite)) return null;
  const [x0,y0,x1,y1]=a;
  if(x0<0||y0<0||x1>1||y1>1||x1<=x0||y1<=y0) return null;
  return a.map(x=>Number(x.toFixed(8)));
}

export function normalizeP4Provenance(input={}) {
  const sourceType=SOURCE_TYPES.has(input.sourceType)?input.sourceType:'manual';
  const state=SOURCE_STATES.has(input.state)?input.state:'REVIEW';
  return {
    file:text(input.file||input.name),
    documentId:text(input.documentId||input.corpusDocumentId),
    standard:text(input.standard),
    section:text(input.section||input.article),
    table:text(input.table),
    formula:text(input.formula),
    page:Number.isInteger(Number(input.page)) && Number(input.page)>0 ? Number(input.page) : null,
    bbox:normalizeBbox(input.bbox||input.normalizedBbox),
    sourceType,
    engine:text(input.engine||sourceType),
    route:text(input.route),
    state,
    status:text(input.status||state),
    confidence:clip(input.confidence),
    confidenceUsable:input.confidenceUsable===true,
    userConfirmed:input.userConfirmed===true,
    sourceSha:text(input.sourceSha),
    fingerprint:text(input.fingerprint),
  };
}

function provenanceComplete(p={}) {
  return Boolean(p.file && p.page && p.engine && p.state && p.sourceType && (p.bbox || p.sourceType==='manual'));
}

export function classifyP4Trust(provenance={}, opts={}) {
  const p=normalizeP4Provenance(provenance);
  const native = p.sourceType==='pdf-native';
  const machineVision = ['pdf-scan','image','ocr','vision-reuse'].includes(p.sourceType);
  const verified = p.state==='VERIFIED';
  const benchmarked = p.state==='BENCHMARKED';
  const explicitConfirm = p.userConfirmed || opts.userConfirmed===true;
  const lowConfidence = machineVision && p.confidenceUsable===true && p.confidence!=null && p.confidence<0.75 && !explicitConfirm;
  let semanticState='REVIEW';
  if(verified && provenanceComplete(p) && !lowConfidence) semanticState='VERIFIED';
  else if(benchmarked && provenanceComplete(p) && !lowConfidence) semanticState='BENCHMARKED';
  else if(p.state==='BLOCK') semanticState='BLOCK';
  const calculationEligible = semanticState==='VERIFIED' && (!machineVision || explicitConfirm);
  return {
    semanticState,
    calculationEligible,
    excelFormulaEligible: native && verified && provenanceComplete(p),
    requiresReview: semanticState!=='VERIFIED' || (machineVision && !explicitConfirm),
    reason: calculationEligible
      ? 'Nguồn VERIFIED và đủ provenance.'
      : lowConfidence
        ? `Confidence ${p.confidence} dưới ngưỡng 0.75; bắt buộc REVIEW.`
      : machineVision && !explicitConfirm
        ? 'OCR/Vision chưa được người dùng xác nhận; cấm đi thẳng vào Calculation Engine.'
        : semanticState==='BENCHMARKED'
          ? 'Nguồn mới BENCHMARKED; chỉ dùng benchmark/export review, chưa phải numeric VERIFIED.'
          : semanticState==='BLOCK'
            ? 'Nguồn BLOCK.'
            : 'Nguồn chưa đủ VERIFIED/provenance.'
  };
}

export function createP4ExtractionPacket(input={}) {
  const provenance=normalizeP4Provenance(input.provenance||input.source||{});
  const trust=classifyP4Trust(provenance,{userConfirmed:input.userConfirmed});
  const packet={
    schema:P4_SCHEMA,
    promotionState:P4_PROMOTION_STATE,
    productionMutationAllowed:false,
    calculationEngineMutationAllowed:false,
    source:provenance,
    trust,
    text:text(input.text),
    tables:Array.isArray(input.tables)?input.tables:[],
    formulas:Array.isArray(input.formulas)?input.formulas:[],
    figures:Array.isArray(input.figures)?input.figures:[],
    parameters:Array.isArray(input.parameters)?input.parameters:[],
    warnings:Array.isArray(input.warnings)?input.warnings.map(String):[],
    createdAt:input.createdAt||new Date().toISOString()
  };
  return packet;
}

export function packetFromP32Run(run={}, environment={}) {
  const p=run.provenance||{};
  const cands=Array.isArray(run.candidates)?run.candidates:[];
  const preferred=cands.find(x=>x?.available && x.engine===p.engine) || cands.find(x=>x?.available) || null;
  const srcType = p.route==='native' || p.engine==='pdfjs-native-region' ? 'pdf-native'
    : /vision/i.test(p.route||p.engine||'') ? 'vision-reuse'
    : /ocr|deepdoc|textdetector/i.test(p.engine||'') ? 'ocr' : 'pdf-scan';
  return createP4ExtractionPacket({
    provenance:{
      file:run.document?.name,
      documentId:run.document?.corpusDocumentId,
      standard:run.document?.standard,
      page:run.page,
      bbox:p.normalizedBbox,
      sourceType:srcType,
      engine:p.engine,
      route:p.route,
      state:run.promotionState==='SHADOW_ONLY'?'BENCHMARKED':'REVIEW',
      status:p.status,
      confidence:p.confidence,
      confidenceUsable:p.confidenceUsable,
      sourceSha:environment.sourceSha,
      fingerprint:run.fingerprint
    },
    text:preferred?.text || run.productionUi?.text || p.textQuality?.text || '',
    warnings:['Nguồn chuyển từ P3.2 chỉ là BENCHMARKED; không được tự nâng thành VERIFIED.']
  });
}

function splitDelimitedLine(line='') {
  if(/\|/.test(line)) return line.split('|').map(x=>x.trim()).filter((x,i,a)=>!(i===0&&x==='')&&!(i===a.length-1&&x===''));
  if(/\t/.test(line)) return line.split(/\t+/).map(x=>x.trim());
  if(/\s{2,}/.test(line)) return line.split(/\s{2,}/).map(x=>x.trim());
  return [line.trim()];
}

export function detectTableFromText(raw='', opts={}) {
  const lines=text(raw).split('\n').map(x=>x.trim()).filter(Boolean);
  const rows=[];
  for(const line of lines){
    if(/^\|?\s*:?-{2,}/.test(line) && /\|/.test(line)) continue; // markdown separator
    const cells=splitDelimitedLine(line);
    if(cells.length>=2) rows.push(cells);
  }
  if(!rows.length) return {ok:false,state:'REVIEW',rows:[],reason:'Không phát hiện cấu trúc hàng/cột đáng tin cậy.'};
  const widths=rows.map(r=>r.length), mode=[...widths].sort((a,b)=>widths.filter(x=>x===b).length-widths.filter(x=>x===a).length)[0];
  const consistent=rows.filter(r=>r.length===mode);
  const ratio=consistent.length/rows.length;
  const confidence=Number(Math.min(1,0.45+0.5*ratio+Math.min(0.05,consistent.length/100)).toFixed(3));
  const state=confidence>=0.9 && consistent.length>=2?'BENCHMARKED':'REVIEW';
  return {ok:true,state,confidence,rows:consistent,columnCount:mode,droppedRows:rows.length-consistent.length,reason:state==='REVIEW'?'Cần REVIEW vì cấu trúc cột chưa đủ ổn định.':''};
}

export function normalizeStructuredTable(table={}, provenance={}) {
  const headers=Array.isArray(table.headers)?table.headers.map(x=>text(x)):[];
  const rows=Array.isArray(table.rows)?table.rows.map(r=>Array.isArray(r)?r.map(x=>x??''):[]):[];
  const width=Math.max(headers.length,...rows.map(r=>r.length),0);
  const valid=width>0 && rows.length>0 && rows.every(r=>r.length===width) && (!headers.length||headers.length===width);
  return {
    id:text(table.id||`table-${Date.now()}`),
    title:text(table.title),
    headers,
    rows,
    state:valid?(table.state||'BENCHMARKED'):'REVIEW',
    confidence:clip(table.confidence),
    provenance:normalizeP4Provenance(table.provenance||provenance),
    sourceImage:table.sourceImage||null,
    valid
  };
}

const FORMULA_LINE=/^\s*(?:\(?[A-Za-zΑ-Ωα-ω][A-Za-z0-9_,'′″α-ωΑ-Ω.]*\)?\s*)=\s*(.+)$/u;

export function extractFormulaCandidates(raw='', provenance={}) {
  const out=[];
  const lines=text(raw).split('\n');
  for(let i=0;i<lines.length;i++){
    const line=lines[i].replace(/^\s*[$*`]+|[$*`]+\s*$/g,'').trim();
    const m=line.match(FORMULA_LINE); if(!m) continue;
    const eq=line.indexOf('=');
    const lhs=line.slice(0,eq).trim().replace(/^\(|\)$/g,'');
    const rhs=line.slice(eq+1).trim().replace(/\s*\((?:[A-Z]\.)?\d+(?:\.\d+)?\)\s*$/i,'').trim();
    out.push({
      id:`formula-${i+1}`,
      lhs,
      rhs,
      raw:line,
      context:lines.slice(Math.max(0,i-2),Math.min(lines.length,i+3)).join(' '),
      provenance:normalizeP4Provenance(provenance),
      state:'REVIEW'
    });
  }
  return out;
}

function normalizeMathExpr(expr='') {
  return String(expr)
    .replace(/[×·⋅]/g,'*').replace(/÷/g,'/')
    .replace(/[−–—]/g,'-')
    .replace(/π/g,'PI()')
    .replace(/√\s*\(([^()]*)\)/g,'SQRT($1)')
    .replace(/√\s*([A-Za-z0-9_.]+)/g,'SQRT($1)')
    .replace(/\^\s*\{?\s*([+-]?\d+(?:\.\d+)?)\s*\}?/g,'^$1')
    .replace(/\s+/g,' ')
    .trim();
}

function hasDangerousExcelToken(expr='') {
  return /(?:\[|\]|!|https?:|\\\\|DDE|WEBSERVICE|HYPERLINK|RTD|CALL|EXEC|REGISTER|IMPORTXML|FILTERXML|_xlfn\.)/i.test(expr);
}

function functionNames(expr='') {
  return [...expr.matchAll(/\b([A-Za-z][A-Za-z0-9_.]*)\s*\(/g)].map(m=>m[1].toUpperCase());
}

function variableTokens(expr='') {
  const fn=new Set(functionNames(expr));
  const toks=[...expr.matchAll(/\b([A-Za-z][A-Za-z0-9_']*)\b/g)].map(m=>m[1]);
  return unique(toks.filter(t=>!fn.has(t.toUpperCase()) && !['TRUE','FALSE'].includes(t.toUpperCase())));
}

export function compileSafeExcelFormula(candidate={}, variableCells={}, opts={}) {
  const rhs=normalizeMathExpr(candidate.rhs||candidate.expression||'');
  if(!rhs) return {ok:false,state:'REVIEW',reason:'Công thức rỗng.',excelFormula:null,variables:[]};
  if(hasDangerousExcelToken(rhs)) return {ok:false,state:'BLOCK',reason:'Công thức chứa external/dangerous token.',excelFormula:null,variables:variableTokens(rhs)};
  const fns=functionNames(rhs);
  const unsupported=fns.filter(x=>!SAFE_EXCEL_FUNCTIONS.has(x));
  if(unsupported.length) return {ok:false,state:'REVIEW',reason:`Hàm Excel chưa nằm trong allowlist: ${unsupported.join(', ')}`,excelFormula:null,variables:variableTokens(rhs)};
  const vars=variableTokens(rhs);
  const safeCellRef=/^(?:'[^']+'|[A-Za-z0-9_]+)!\$?[A-Z]{1,3}\$?\d+$|^\$?[A-Z]{1,3}\$?\d+$/;
  const invalidMappings=vars.filter(v=>variableCells[v] && !safeCellRef.test(String(variableCells[v])));
  if(invalidMappings.length) return {ok:false,state:'BLOCK',reason:`Ánh xạ ô Excel không an toàn: ${invalidMappings.join(', ')}`,excelFormula:null,variables:vars};
  const unresolved=vars.filter(v=>!variableCells[v]);
  if(unresolved.length) return {ok:false,state:'REVIEW',reason:`Thiếu ánh xạ input: ${unresolved.join(', ')}`,excelFormula:null,variables:vars,unresolved};
  let expr=rhs;
  for(const v of [...vars].sort((a,b)=>b.length-a.length)){
    const safe=v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    expr=expr.replace(new RegExp(`\\b${safe}\\b`,'g'),String(variableCells[v]));
  }
  if(!/^[A-Za-z0-9_.$(),+\-*/^ <>=!'\s]+$/.test(expr)) return {ok:false,state:'REVIEW',reason:'Biểu thức còn ký tự chưa được xác nhận.',excelFormula:null,variables:vars};
  const sourceTrust=opts.trust||candidate.trust||{};
  if(sourceTrust.excelFormulaEligible!==true && opts.allowBenchmarkedFormula!==true){
    return {ok:false,state:'REVIEW',reason:'Nguồn chưa VERIFIED cho công thức Excel thật.',excelFormula:null,variables:vars,previewFormula:`=${expr}`};
  }
  return {ok:true,state:'VERIFIED',reason:'Safe allowlist + đủ mapping + nguồn VERIFIED.',excelFormula:`=${expr}`,variables:vars,unresolved:[]};
}

export function collectContextualParameters(formulas=[], explicitParameters=[]) {
  const items=[];
  const explicit=[];
  for(const p of explicitParameters||[]){
    const symbol=text(p.symbol||p.key); if(!symbol) continue;
    const item={symbol,label:text(p.label||symbol),unit:cleanUnit(p.unit),value:p.value??null,contextId:text(p.contextId||'global'),context:text(p.context),provenance:normalizeP4Provenance(p.provenance||{}),state:p.state||'REVIEW',choices:Array.isArray(p.choices)?p.choices.map(x=>String(x)):[]};
    explicit.push(item); items.push(item);
  }
  const formulaUses=[];
  for(const f of formulas||[]){
    const vars=variableTokens(normalizeMathExpr(f.rhs||''));
    const ctx=text(f.provenance?.section||f.provenance?.formula||f.context||f.id);
    const contextId=slug(`${f.provenance?.page||'p'}-${ctx||f.id}`);
    for(const symbol of vars) formulaUses.push({symbol,contextId,context:ctx,provenance:normalizeP4Provenance(f.provenance||{})});
  }
  const contextCount=new Map();
  for(const u of formulaUses){ if(!contextCount.has(u.symbol)) contextCount.set(u.symbol,new Set()); contextCount.get(u.symbol).add(u.contextId); }
  for(const u of formulaUses){
    const exp=explicit.filter(x=>x.symbol===u.symbol);
    const exact=exp.some(x=>x.contextId===u.contextId);
    const singleUse=(contextCount.get(u.symbol)?.size||0)===1 && exp.length===1;
    if(exact||singleUse) continue;
    items.push({symbol:u.symbol,label:u.symbol,unit:'',value:null,contextId:u.contextId,context:u.context,provenance:u.provenance,state:'REVIEW',choices:[]});
  }
  const keyed=new Map();
  for(const it of items){const k=`${it.symbol}@@${it.contextId}`; if(!keyed.has(k)) keyed.set(k,it);}
  return [...keyed.values()];
}

export function buildParameterClarifications(parameters=[]) {
  const by=new Map();
  for(const p of parameters){ if(!by.has(p.symbol)) by.set(p.symbol,[]); by.get(p.symbol).push(p); }
  const questions=[];
  for(const [symbol, arr] of by){
    const unresolved=arr.filter(x=>x.value==null||x.value==='');
    if(!unresolved.length) continue;
    if(arr.length>1){
      questions.push({
        type:'AMBIGUOUS_SYMBOL',symbol,
        question:`Ký hiệu “${symbol}” xuất hiện ở ${arr.length} ngữ cảnh. Hãy nhập giá trị riêng cho từng ngữ cảnh thay vì dùng chung.`,
        contexts:arr.map(x=>({contextId:x.contextId,context:x.context,page:x.provenance?.page??null,section:x.provenance?.section||''}))
      });
    } else {
      const x=arr[0]; questions.push({type:'MISSING_PARAMETER',symbol,question:`Nhập giá trị ${symbol}${x.unit?` (${x.unit})`:''}${x.context?` cho ${x.context}`:''}.`,contexts:[{contextId:x.contextId,context:x.context,page:x.provenance?.page??null}]});
    }
  }
  return questions;
}

export function attachAutoDetections(packet={}, opts={}) {
  const p={...packet};
  if(!p.schema) p.schema=P4_SCHEMA;
  if((!p.tables||!p.tables.length) && p.text){
    const t=detectTableFromText(p.text);
    if(t.ok) p.tables=[normalizeStructuredTable({id:'auto-table-1',rows:t.rows,state:t.state,confidence:t.confidence},p.source)];
  }
  if(!p.formulas||!p.formulas.length) p.formulas=extractFormulaCandidates(p.text,p.source);
  p.parameters=collectContextualParameters(p.formulas,p.parameters);
  p.clarifications=buildParameterClarifications(p.parameters);
  p.warnings=unique([...(p.warnings||[]), ...(p.clarifications?.length?['Có tham số chưa rõ/ngữ cảnh trùng; Excel phải để REVIEW cho tới khi người dùng nhập/xác nhận.']:[])]);
  return p;
}

function statusLabel(state='REVIEW'){
  return ({VERIFIED:'ĐÃ XÁC MINH',BENCHMARKED:'ĐÃ BENCHMARK',REVIEW:'CẦN RÀ SOÁT',BLOCK:'CHẶN'})[state]||'CẦN RÀ SOÁT';
}
function sourceTypeLabel(type='manual'){
  return ({'pdf-native':'PDF có lớp chữ','pdf-scan':'PDF scan','image':'Ảnh','ocr':'OCR','vision-reuse':'Vision đã dùng trước','manual':'Nhập/xác nhận thủ công'})[type]||'Nguồn khác';
}

export function buildP4ExcelPlan(inputPackets=[], opts={}) {
  const packets=(Array.isArray(inputPackets)?inputPackets:[inputPackets]).filter(Boolean).map(x=>attachAutoDetections(x));
  const sourceRows=[], textRows=[], tableBlocks=[], formulaRows=[], parameterRows=[], reviewRows=[], figureRows=[];
  let pIndex=0;
  for(const packet of packets){
    pIndex++;
    const src=packet.source||{};
    sourceRows.push([
      pIndex,src.file,src.standard,src.page,src.section,src.table,src.formula,src.engine,sourceTypeLabel(src.sourceType),statusLabel(src.state),src.confidence??'',src.bbox?src.bbox.join(', '):'',src.sourceSha,src.fingerprint,
      packet.trust?.calculationEligible?'Có':'Không',packet.trust?.reason||''
    ]);
    if(packet.text) textRows.push([pIndex,src.file,src.standard,src.page,src.section||'',packet.text,src.engine,statusLabel(src.state),src.bbox?src.bbox.join(', '):'',src.sourceSha]);
    for(const table of packet.tables||[]) tableBlocks.push({packetIndex:pIndex,table});
    const packetParams=packet.parameters||[];
    const paramBaseRow=parameterRows.length+2;
    const formulaContexts=(packet.formulas||[]).map(f=>({f,contextId:slug(`${f.provenance?.page||'p'}-${text(f.provenance?.section||f.provenance?.formula||f.context||f.id)}`),vars:variableTokens(normalizeMathExpr(f.rhs||''))}));
    const usageCount=new Map();
    for(const x of formulaContexts) for(const v of x.vars){ if(!usageCount.has(v)) usageCount.set(v,new Set()); usageCount.get(v).add(x.contextId); }
    for(const {f,contextId,vars} of formulaContexts){
      const trust=packet.trust||{};
      const map={};
      for(const v of vars){
        const candidates=packetParams.map((par,i)=>({par,i})).filter(x=>x.par.symbol===v && x.par.value!=null && x.par.value!=='' && x.par.state==='VERIFIED');
        const exact=candidates.find(x=>x.par.contextId===contextId);
        const chosen=exact || (((usageCount.get(v)?.size||0)===1 && candidates.length===1)?candidates[0]:null);
        if(chosen) map[v]=`'04_THAM_SO'!$D$${paramBaseRow+chosen.i}`;
      }
      const compiled=compileSafeExcelFormula(f,map,{trust});
      formulaRows.push([pIndex,f.id,f.lhs,f.rhs,compiled.excelFormula||compiled.previewFormula||'',statusLabel(compiled.state),compiled.reason,src.file,src.page,src.section||src.formula||'']);
    }
    for(const par of packetParams){
      parameterRows.push([pIndex,par.symbol,par.label,par.value??'',par.unit,par.contextId,par.context,par.provenance?.page??src.page??'',par.provenance?.section||src.section||'',statusLabel(par.state||'REVIEW'),(par.choices||[]).join(' | ')]);
    }
    for(const q of packet.clarifications||[]) reviewRows.push([pIndex,q.type,q.symbol,q.question,(q.contexts||[]).map(x=>`${x.page?`tr.${x.page} `:''}${x.context||x.contextId}`).join(' | '),'CẦN NGƯỜI DÙNG']);
    for(const w of packet.warnings||[]) reviewRows.push([pIndex,'WARNING','',w,'','CẦN RÀ SOÁT']);
    for(const fig of packet.figures||[]) figureRows.push([pIndex,text(fig.title||fig.name),text(fig.sourceImage||fig.file),src.page||'',fig.bbox?fig.bbox.join(', '):'',text(fig.caption),statusLabel(fig.status||'REVIEW')]);
  }
  return {
    schema:P4_EXPORT_SCHEMA,
    generatedAt:new Date().toISOString(),
    promotionState:P4_PROMOTION_STATE,
    productionMutationAllowed:false,
    calculationEngineMutationAllowed:false,
    workbook:{
      title:'HNL · P4 PDF/Ảnh → Excel Intelligence',
      sheets:[
        {name:'00_TONG_QUAN',kind:'overview'},
        {name:'01_NGUON',kind:'sources',headers:['#','File','Tiêu chuẩn','Trang','Điều/Mục','Bảng','Công thức','Engine','Loại nguồn','Trạng thái nguồn','Confidence','BBox chuẩn hóa','Source SHA','Fingerprint','Được vào Calculation Engine?','Lý do'],rows:sourceRows},
        {name:'02_BANG_TRICH_XUAT',kind:'tables',blocks:tableBlocks},
        {name:'07_VAN_BAN_NGUON',kind:'text',headers:['Nguồn #','File','Tiêu chuẩn','Trang','Điều/Mục','Văn bản trích xuất','Engine','Trạng thái','BBox chuẩn hóa','Source SHA'],rows:textRows},
        {name:'03_CONG_THUC',kind:'formulas',headers:['Nguồn #','ID','Vế trái','Biểu thức nguồn','Excel formula/preview','Trạng thái','Lý do','File','Trang','Ngữ cảnh'],rows:formulaRows},
        {name:'04_THAM_SO',kind:'parameters',headers:['Nguồn #','Ký hiệu','Tên','Giá trị','Đơn vị','Context ID','Ngữ cảnh','Trang','Điều/Mục','Trạng thái','Lựa chọn hữu hạn'],rows:parameterRows},
        {name:'05_REVIEW',kind:'review',headers:['Nguồn #','Loại','Ký hiệu','Yêu cầu/Cảnh báo','Ngữ cảnh','Trạng thái'],rows:reviewRows},
        {name:'06_ANH_NGUON',kind:'figures',headers:['Nguồn #','Tên','Ảnh nguồn','Trang','BBox','Chú thích','Trạng thái'],rows:figureRows}
      ]
    },
    summary:{packets:packets.length,textBlocks:textRows.length,tables:tableBlocks.length,formulas:formulaRows.length,parameters:parameterRows.length,reviews:reviewRows.length,figures:figureRows.length,calculationEligiblePackets:packets.filter(x=>x.trust?.calculationEligible).length}
  };
}

function styleHeader(row, color='FF17365D'){
  row.font={bold:true,color:{argb:'FFFFFFFF'}};
  row.fill={type:'pattern',pattern:'solid',fgColor:{argb:color}};
  row.alignment={vertical:'middle',horizontal:'center',wrapText:true};
}
function styleSheet(ws){ ws.eachRow(r=>{r.alignment={vertical:'top',wrapText:true};}); ws.views=[{state:'frozen',ySplit:1}]; }
function widths(ws, max=48){ ws.columns.forEach(c=>{let m=10;for(const v of c.values||[])m=Math.max(m,String(v??'').length);c.width=Math.min(max,Math.max(11,Math.ceil(m*0.9)));}); }

export async function exportP4ExcelWorkbook(inputPackets=[], opts={}) {
  const plan=buildP4ExcelPlan(inputPackets,opts);
  const mod=await import('exceljs'); const ExcelJS=mod.default||mod;
  const wb=new ExcelJS.Workbook();
  wb.creator='HNL Pile Standards AI'; wb.subject='P4 PDF/Ảnh → Excel Intelligence';
  wb.calcProperties={fullCalcOnLoad:true,forceFullCalc:true,calcMode:'auto'};
  const navy='FF17365D', inputFill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF2CC'}}, reviewFill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFCE4D6'}}, resultFill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE2F0D9'}};

  const o=wb.addWorksheet('00_TONG_QUAN'); o.columns=[{width:28},{width:95}];
  o.addRow(['HNL · P4 PDF/Ảnh → Excel Intelligence','']); o.mergeCells('A1:B1'); styleHeader(o.getRow(1),navy); o.getCell('A1').font={bold:true,color:{argb:'FFFFFFFF'},size:15};
  o.addRows([
    ['Trạng thái','SHADOW_ONLY / REVIEW-first. P4 không tự nâng OCR-readable thành VERIFIED.'],
    ['Calculation Engine','CHẶN mặc định. Chỉ packet VERIFIED + đủ provenance; OCR/Vision còn cần người dùng xác nhận.'],
    ['Công thức Excel','Chỉ ghi formula thật nếu nguồn VERIFIED + hàm nằm allowlist + tất cả biến đã ánh xạ input.'],
    ['Nguồn','Mỗi dữ liệu giữ file → page → bbox → engine → state/confidence → source SHA/fingerprint.'],
    ['Bảng/Ảnh','Bảng được đưa thành cells. Ảnh/figure giữ metadata ở 06_ANH_NGUON; có thể embed nếu caller truyền sourceImage base64.'],
    ['Tổng packet',plan.summary.packets],['Văn bản nguồn',plan.summary.textBlocks],['Bảng',plan.summary.tables],['Công thức',plan.summary.formulas],['Tham số',plan.summary.parameters],['Mục REVIEW',plan.summary.reviews]
  ]); styleSheet(o);

  for(const spec of plan.workbook.sheets.filter(x=>x.kind!=='overview'&&x.kind!=='tables')){
    const ws=wb.addWorksheet(spec.name); ws.addRow(spec.headers); styleHeader(ws.getRow(1),spec.kind==='review'?'FFC65911':'FF548235');
    for(const row of spec.rows||[]) ws.addRow(row);
    if(spec.kind==='parameters'){
      for(let r=2;r<=ws.rowCount;r++){ws.getCell(r,4).fill=inputFill; ws.getCell(r,10).fill=reviewFill;}
      if(ws.rowCount>=2) ws.dataValidations.add(`J2:J${ws.rowCount}`,{type:'list',allowBlank:false,formulae:['"CẦN RÀ SOÁT,ĐÃ XÁC MINH"']});
      for(let r=2;r<=ws.rowCount;r++){
        const choices=String(ws.getCell(r,11).value||'').split('|').map(x=>x.trim()).filter(Boolean);
        if(choices.length){ const csv=choices.join(',').replace(/"/g,''); if(csv.length<=240) ws.dataValidations.add(`D${r}`,{type:'list',allowBlank:true,formulae:[`"${csv}"`]}); }
      }
    }
    if(spec.kind==='formulas'){
      for(let r=2;r<=ws.rowCount;r++){
        const v=String(ws.getCell(r,5).value||'');
        if(v.startsWith('=') && String(ws.getCell(r,6).value||'')==='ĐÃ XÁC MINH') ws.getCell(r,5).value={formula:v.slice(1)};
        ws.getCell(r,6).fill=String(ws.getCell(r,6).value||'').includes('XÁC MINH')?resultFill:reviewFill;
      }
    }
    styleSheet(ws); widths(ws);
  }

  const tws=wb.addWorksheet('02_BANG_TRICH_XUAT');
  let rr=1;
  if(!plan.workbook.sheets.find(x=>x.kind==='tables')?.blocks?.length){tws.addRow(['Không có bảng được phát hiện/truyền vào P4.']);}
  for(const block of plan.workbook.sheets.find(x=>x.kind==='tables')?.blocks||[]){
    const t=block.table;
    tws.getCell(rr,1).value=`Nguồn #${block.packetIndex} · ${t.title||t.id}`; styleHeader(tws.getRow(rr),'FF548235'); rr++;
    if(t.headers?.length){tws.getRow(rr).values=t.headers;styleHeader(tws.getRow(rr),'FF70AD47');rr++;}
    for(const row of t.rows||[]){tws.getRow(rr).values=row;rr++;}
    tws.getCell(rr,1).value=`Trạng thái: ${statusLabel(t.state)} · file ${t.provenance?.file||''} · trang ${t.provenance?.page||''} · engine ${t.provenance?.engine||''}`; rr+=2;
  }
  styleSheet(tws); widths(tws,36);

  // Optional source images: preserve source evidence without making it a calculation input.
  const figSheet=wb.getWorksheet('06_ANH_NGUON');
  let imageRow=Math.max(2,figSheet.rowCount+2);
  for(const packet of (Array.isArray(inputPackets)?inputPackets:[inputPackets]).filter(Boolean)){
    for(const fig of packet.figures||[]){
      const dataUrl=fig.dataUrl||fig.sourceImageDataUrl||'';
      const m=String(dataUrl).match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
      if(!m) continue;
      const ext=/png/i.test(m[1])?'png':'jpeg';
      try{
        const imageId=wb.addImage({base64:m[2],extension:ext});
        figSheet.addImage(imageId,{tl:{col:8,row:imageRow-1},ext:{width:420,height:260}});
        imageRow+=16;
      }catch{/* keep metadata rows even if image bytes fail */}
    }
  }
  const buffer=await wb.xlsx.writeBuffer();
  if(opts.validateOnly===true) return {ok:true,plan,buffer,workbook:wb};
  if(typeof globalThis.__HNL_CAPTURE_XLSX__==='function') return globalThis.__HNL_CAPTURE_XLSX__(buffer,opts.fileName||'HNL_P4_PDF_EXCEL_INTELLIGENCE.xlsx');
  if(typeof document!=='undefined'){
    const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download=opts.fileName||'HNL_P4_PDF_EXCEL_INTELLIGENCE.xlsx';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1200);return {ok:true,plan};
  }
  return {ok:true,plan,buffer};
}

export function assertP4CalculationBarrier(packet={}) {
  const trust=packet.trust||classifyP4Trust(packet.source||{});
  if(trust.calculationEligible!==true) throw new Error(`P4_CALCULATION_BLOCK: ${trust.reason||'Nguồn chưa VERIFIED.'}`);
  return true;
}
