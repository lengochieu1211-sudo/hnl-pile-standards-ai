#!/usr/bin/env node
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
function replaceOnce(text,from,to,label){
  const n=text.split(from).length-1;
  if(n!==1) throw new Error(`${label}: expected exactly 1 match, got ${n}`);
  return text.replace(from,to);
}
function replaceRegexOnce(text,re,to,label){
  const m=[...text.matchAll(new RegExp(re.source,re.flags.includes('g')?re.flags:re.flags+'g'))];
  if(m.length!==1) throw new Error(`${label}: expected exactly 1 regex match, got ${m.length}`);
  return text.replace(re,to);
}

// 1) Engineering Input Interpreter: deterministic geometry + mm/m length normalization.
{
  const p='src/engineering-input-interpreter.js'; let s=read(p);
  s=replaceOnce(s,
    "import { normalizeEngineeringText, extractEngineeringNumber } from './engineering-text-normalizer.js';",
    "import { normalizeEngineeringText, extractEngineeringNumber } from './engineering-text-normalizer.js';\nimport { buildNormalizedSptGeometryInput, parseSptPileLength } from './spt-shared-spec.js';",
    'interpreter import');
  s=replaceOnce(s,
    "  const length = deterministicOrAi(raw, scalarWithSource(raw, ['L', 'chiều dài', 'chieu dai'], '(?:m)?'), aiExtraction, 'lengthM');",
    "  const normalizedGeometry=buildNormalizedSptGeometryInput(raw);\n  const deterministicLength=parseSptPileLength(raw);\n  const length = deterministicLength ? {value:deterministicLength.lengthM,sourceText:deterministicLength.sourceText,origin:deterministicLength.origin} : deterministicOrAi(raw, scalarWithSource(raw, ['L', 'chiều dài', 'chieu dai'], '(?:m)?'), aiExtraction, 'lengthM');",
    'interpreter length');
  s=replaceOnce(s,
    "    lengthM: length?.value ?? null,\n    eta: eta?.value ?? null,",
    "    lengthM: length?.value ?? normalizedGeometry.lengthM ?? null,\n    sectionType: normalizedGeometry.sectionType,\n    widthM: normalizedGeometry.widthM,\n    heightM: normalizedGeometry.heightM,\n    sideM: normalizedGeometry.sideM,\n    diameterM: normalizedGeometry.diameterM,\n    geometryOrigin: normalizedGeometry.geometryOrigin,\n    geometrySourceText: normalizedGeometry.geometrySourceText,\n    unitAssumption: normalizedGeometry.unitAssumption,\n    eta: eta?.value ?? null,",
    'interpreter normalized fields');
  s=replaceOnce(s,
    "    shaftLengthM: fullShaft && length?.value != null ? length.value : null,",
    "    shaftLengthM: fullShaft && (length?.value ?? normalizedGeometry.lengthM) != null ? (length?.value ?? normalizedGeometry.lengthM) : null,",
    'interpreter shaft length');
  write(p,s);
}

// 2) Pile workflows: rectangle-aware geometry and SPT A/u derived only from b/h/D.
{
  const p='src/pile-workflows.js'; let s=read(p);
  s=replaceOnce(s,
    "import { calculatePileGeometry } from './pile-geometry-engine.js';",
    "import { calculatePileGeometry } from './pile-geometry-engine.js';\nimport { deriveSptSectionGeometry } from './spt-shared-spec.js';",
    'workflow shared geometry import');
  s=replaceRegexOnce(s,/function geometryFromInput\(input=\{\}\)\{[\s\S]*?\n\}/,
`function geometryFromInput(input={}){
  const L=num(input.lengthM);
  if(input.shape==='circle'||input.sectionType==='circle'||num(input.diameterM)!=null) return calculatePileGeometry({shape:'circle',diameterM:num(input.diameterM),lengthM:L,innerDiameterTipM:num(input.innerDiameterM)});
  if(input.shape==='rectangle'||input.sectionType==='rectangle') return calculatePileGeometry({shape:'rectangle',widthM:num(input.widthM??input.bM),heightM:num(input.heightM??input.hM),lengthM:L});
  if(input.shape==='square'||input.sectionType==='square'||num(input.sideM)!=null||num(input.widthM)!=null) return calculatePileGeometry({shape:'square',sideM:num(input.sideM??input.widthM??input.bM),heightM:num(input.heightM??input.hM),lengthM:L});
  const area=num(input.areaM2),perimeter=num(input.perimeterM);
  return {areaM2:area,tipAreaM2:area,perimeterM:perimeter,lengthM:L,verification:{status:'INPUT'}};
}`,'geometryFromInput');
  s=replaceOnce(s,
    "  const geometry=geometryFromInput(input),A=num(input.areaM2)??num(geometry.tipAreaM2)??num(geometry.areaM2),u=num(input.perimeterM)??num(geometry.perimeterM);",
    "  let geometry; try{geometry=deriveSptSectionGeometry(input);}catch(e){return {ok:false,missing:[e.message],inputMode:'EXPLICIT_SPT_SUMMARY',provenance:PROV_SPT};}\n  const A=num(geometry.tipAreaM2)??num(geometry.areaM2),u=num(geometry.perimeterM);",
    'summary geometry first');
  s=replaceOnce(s,
    "  if(!(A>0))missing.push('A diện tích mũi');if(!(u>0))missing.push('u chu vi');if(!(L>0))missing.push('chiều dài cọc L');",
    "  if(!(A>0))missing.push('A diện tích mũi dẫn xuất từ b/h/D');if(!(u>0))missing.push('u chu vi dẫn xuất từ b/h/D');if(!(L>0))missing.push('chiều dài cọc L');",
    'summary validation labels');
  s=replaceOnce(s,
    "  return {ok:true,status:'VERIFIED_SUMMARY_INPUT',inputMode:'EXPLICIT_SPT_SUMMARY',summaryInputPolicy,inputs:{...input,areaM2:A,perimeterM:u,lengthM:L,shaftStartDepthM:shaftStart,shaftLengthM:shaftLength,pileType,eta:eta.value},geometry,pileType,eta:eta.value,nBarTip,nsShaft,qbKpa:qb.value,shaftUnitResistanceKpa:shaft.value,qbLookup:qb,shaftLookup:shaft,RubKn,RufKn,RkKn,gammaK,RdKn,gammaN,NdMaxKn,noInterpolationPolicy:true,steps:",
    "  return {ok:true,status:'VERIFIED_SUMMARY_INPUT',inputMode:'EXPLICIT_SPT_SUMMARY',summaryInputPolicy,inputs:{...input,areaM2:A,perimeterM:u,lengthM:L,shaftStartDepthM:shaftStart,shaftLengthM:shaftLength,pileType,eta:eta.value},geometry,pileType,eta:eta.value,nBarTip,nsShaft,qbKpa:qb.value,shaftUnitResistanceKpa:shaft.value,qbLookup:qb,shaftLookup:shaft,RubKn,RufKn,RkKn,RcKKn:RkKn,gammaK,RdKn,gammaN,NdMaxKn,noInterpolationPolicy:true,steps:",
    'summary Rc alias');
  s=replaceOnce(s,
    "export function calculateSptPile10304(input={}){\n  const geometry=geometryFromInput(input),A=num(input.areaM2)??num(geometry.tipAreaM2)??num(geometry.areaM2),u=num(input.perimeterM)??num(geometry.perimeterM),tipDepth=num(input.tipDepthM)??num(input.lengthM),shaftStart=num(input.shaftStartDepthM)??0,pileType=input.pileType||'bored',layers=normalizeGeoLayers10304(input.layers),points=input.sptPoints||[];\n  const d=num(input.diameterM)??num(input.sideM);",
    "export function calculateSptPile10304(input={}){\n  let geometry; try{geometry=deriveSptSectionGeometry(input);}catch(e){return {ok:false,missing:[e.message],provenance:PROV_SPT};}\n  const A=num(geometry.tipAreaM2)??num(geometry.areaM2),u=num(geometry.perimeterM),tipDepth=num(input.tipDepthM)??num(input.lengthM),shaftStart=num(input.shaftStartDepthM)??0,pileType=input.pileType||'bored',layers=normalizeGeoLayers10304(input.layers),points=input.sptPoints||[];\n  const d=num(geometry.characteristicM)??num(input.diameterM)??num(input.sideM);",
    'raw SPT geometry first');
  s=replaceOnce(s,
    "  const RubKn=qb.value*A,RufKn=segmentResults.reduce((s,x)=>s+x.resistanceKn,0),RkKn=RubKn+RufKn,gammaK=num(input.gammaK),RdKn=gammaK&&gammaK>0?RkKn/gammaK:null,gammaN=num(input.gammaN),NdMaxKn=RdKn!=null&&gammaN&&gammaN>0?RdKn/gammaN:null;",
    "  const RubKn=qb.value*A,RufKn=segmentResults.reduce((s,x)=>s+x.resistanceKn,0),RkKn=RubKn+RufKn,gammaK=num(input.gammaK),RdKn=gammaK&&gammaK>0?RkKn/gammaK:null,gammaN=num(input.gammaN),NdMaxKn=RdKn!=null&&gammaN&&gammaN>0?RdKn/gammaN:null;\n  const coveredLengthM=segmentResults.reduce((sum,x)=>sum+x.hM,0),requiredShaftLengthM=Math.max(0,tipDepth-shaftStart),coverageGapM=Math.max(0,requiredShaftLengthM-coveredLengthM),warnings=coverageGapM>1e-6?[`Địa tầng chỉ phủ ${coveredLengthM.toFixed(3)} / ${requiredShaftLengthM.toFixed(3)} m chiều dài thân cọc; thiếu ${coverageGapM.toFixed(3)} m.`]:[];",
    'raw SPT coverage audit');
  s=replaceOnce(s,
    "  return {ok:true,status:'VERIFIED',inputs:{...input,areaM2:A,perimeterM:u,tipDepthM:tipDepth,shaftStartDepthM:shaftStart,pileType,eta:eta.value},geometry,pileType,eta:eta.value,tipDepthM:tipDepth,shaftStartDepthM:shaftStart,tipLayer:tip,tipN,tipNAudit,qbKpa:qb.value,qbLookup:qb,RubKn,segmentResults,RufKn,RkKn,gammaK,RdKn,gammaN,NdMaxKn,noInterpolationPolicy:true,sptDataPolicy,steps:",
    "  return {ok:true,status:'VERIFIED',inputs:{...input,areaM2:A,perimeterM:u,tipDepthM:tipDepth,shaftStartDepthM:shaftStart,pileType,eta:eta.value},geometry,pileType,eta:eta.value,tipDepthM:tipDepth,shaftStartDepthM:shaftStart,tipLayer:tip,tipN,tipNAudit,qbKpa:qb.value,qbLookup:qb,RubKn,segmentResults,RufKn,RkKn,RcKKn:RkKn,gammaK,RdKn,gammaN,NdMaxKn,coveredLengthM,requiredShaftLengthM,coverageGapM,warnings,noInterpolationPolicy:true,sptDataPolicy,steps:",
    'raw SPT coverage return');
  write(p,s);
}

// 3) Router: use normalized geometry/length schema and stop passing A/u as primary SPT inputs.
{
  const p='src/engineering-router.js'; let s=read(p);
  s=replaceOnce(s,
    "import { extractEngineeringScalarNumber, extractSptSummaryInputV26 } from './engineering-input-interpreter.js';",
    "import { extractEngineeringScalarNumber, extractSptSummaryInputV26 } from './engineering-input-interpreter.js';\nimport { buildNormalizedSptGeometryInput, deriveSptSectionGeometry } from './spt-shared-spec.js';",
    'router shared schema import');
  s=replaceOnce(s,
    "  const geometry=inferPileGeometry(q),layers=parsePileLayers(q),points=parseSptPoints(q),norm=n(q); const L=explicit(q,['L','chiều dài','chieu dai'],'m?'),tipDepth=explicit(q,['z_tip','tipDepth','độ sâu mũi','do sau mui'],'m?')??L;",
    "  const geometry=inferPileGeometry(q),normalizedGeometry=buildNormalizedSptGeometryInput(q,geometry),layers=parsePileLayers(q),points=parseSptPoints(q),norm=n(q); const L=normalizedGeometry.lengthM??explicit(q,['L','chiều dài','chieu dai'],'m?'),tipDepth=explicit(q,['z_tip','tipDepth','độ sâu mũi','do sau mui'],'m?')??L;",
    'router normalized length');
  s=replaceOnce(s,
    "    const rawExcelInput={pileType,shape:geometry.shape,diameterM:geometry.diameterM,sideM:geometry.sideM,areaM2:geometry.areaM2,perimeterM:geometry.perimeterM,lengthM:L,tipDepthM:tipDepth,shaftStartDepthM:explicit(q,['shaftStart','z_head','độ sâu đầu cọc','do sau dau coc'],'m?')??0,layers,sptPoints:points,closedTip:!/hở mũi|ho mui|open tip/.test(norm),innerDiameterM:explicit(q,['d_in','dtrong','đường kính trong','duong kinh trong'],'m?'),gammaK:explicit(q,['gamma_k','γk']),gammaN:explicit(q,['gamma_n','γn'])};",
    "    const rawExcelInput={pileType,sectionType:normalizedGeometry.sectionType,shape:normalizedGeometry.sectionType,widthM:normalizedGeometry.widthM,heightM:normalizedGeometry.heightM,diameterM:normalizedGeometry.diameterM,sideM:normalizedGeometry.sideM,lengthM:L,tipDepthM:tipDepth,shaftStartDepthM:explicit(q,['shaftStart','z_head','độ sâu đầu cọc','do sau dau coc'],'m?')??0,layers,sptPoints:points,closedTip:!/hở mũi|ho mui|open tip/.test(norm),innerDiameterM:explicit(q,['d_in','dtrong','đường kính trong','duong kinh trong'],'m?'),gammaK:explicit(q,['gamma_k','γk']),gammaN:explicit(q,['gamma_n','γn'])};",
    'router raw SPT geometry');
  s=replaceOnce(s,
    "  const summaryReady=interpreted.soilGroup==='sand'&&interpreted.pileType!=='unknown'&&interpreted.fullShaft&&interpreted.lengthM>0&&interpreted.nBarTip!=null&&interpreted.nsShaft!=null&&geometry.areaM2>0&&geometry.perimeterM>0;",
    "  let summaryGeometry=null; try{summaryGeometry=deriveSptSectionGeometry(interpreted);}catch{}\n  const summaryReady=interpreted.soilGroup==='sand'&&interpreted.pileType!=='unknown'&&interpreted.fullShaft&&interpreted.lengthM>0&&interpreted.nBarTip!=null&&interpreted.nsShaft!=null&&summaryGeometry?.areaM2>0&&summaryGeometry?.perimeterM>0;",
    'router summary ready');
  s=replaceOnce(s,
    "      shape:geometry.shape,\n      diameterM:geometry.diameterM,\n      sideM:geometry.sideM,\n      areaM2:geometry.areaM2,\n      perimeterM:geometry.perimeterM,",
    "      sectionType:interpreted.sectionType,\n      shape:interpreted.sectionType,\n      widthM:interpreted.widthM,\n      heightM:interpreted.heightM,\n      diameterM:interpreted.diameterM,\n      sideM:interpreted.sideM,",
    'router summary geometry input');
  write(p,s);
}

// 4) Core Excel exporter: remove dead 0.16/1.6 defaults from explicit SPT summary.
{
  const p='src/excel-export.js'; let s=read(p);
  s=replaceOnce(s,"r.A=addInput('A',input.areaM2??input.A??0.16,'m²','Diện tích mũi');","r.A=addInput('A',input.areaM2??input.A??'','m²','Giá trị dẫn xuất hình học ở lớp Production; không phải input gốc');",'excel dead A');
  s=replaceOnce(s,"r.u=addInput('u',input.perimeterM??input.u??1.6,'m','Chu vi thân');","r.u=addInput('u',input.perimeterM??input.u??'','m','Giá trị dẫn xuất hình học ở lớp Production; không phải input gốc');",'excel dead u');
  write(p,s);
}

// 5) Excel compatibility adapter: rectangle mapping, context-aware SPT geometry-first formula workbook.
{
  const p='src/excel-export-compat.js'; let s=read(p);
  s=replaceOnce(s,"import { applyLegacyExcelFormulaCompatibility } from './excel-formula-compat.js';","import { applyLegacyExcelFormulaCompatibility } from './excel-formula-compat.js';\nimport { normalizeSptSectionType } from './spt-shared-spec.js';",'excel compat shared import');
  s=replaceOnce(s,"const SHAPE = Object.freeze({square:'Vuông',circle:'Tròn'});","const SHAPE = Object.freeze({square:'Vuông',rectangle:'Chữ nhật',circle:'Tròn'});",'excel shape map');
  s=replaceOnce(s,"function applyExplicitSptVietnameseAndCompatibility(wb){","function applyExplicitSptVietnameseAndCompatibility(wb,context={}){",'explicit SPT context');
  s=replaceOnce(s,
    "  ensureMapSheet(wb);\n  if(inp.columnCount<5) inp.getColumn(5).width=2;",
    `  ensureMapSheet(wb);
  const sourceInput=(context.fnName==='export10304AdvancedWorkflowWorkbook'?context.args?.[1]:context.args?.[0]?.input)||{};
  const sectionCode=normalizeSptSectionType(sourceInput.sectionType??sourceInput.shape) || (Number(sourceInput.diameterM)>0?'circle':(Number(sourceInput.widthM)>0&&Number(sourceInput.heightM)>0&&Math.abs(Number(sourceInput.widthM)-Number(sourceInput.heightM))>1e-12?'rectangle':'square'));
  const widthMm=Number(sourceInput.widthM??sourceInput.sideM)>0?Number(sourceInput.widthM??sourceInput.sideM)*1000:'';
  const heightMm=Number(sourceInput.heightM??sourceInput.sideM)>0?Number(sourceInput.heightM??sourceInput.sideM)*1000:'';
  const diameterMm=Number(sourceInput.diameterM)>0?Number(sourceInput.diameterM)*1000:'';
  const sectionRow=inp.addRow(['Tiết diện',SHAPE[sectionCode]||'Vuông','-','INPUT hình học gốc: Vuông / Chữ nhật / Tròn']).number;
  const bRow=inp.addRow(['b',widthMm,'mm','Bề rộng/cạnh; dùng cho vuông/chữ nhật']).number;
  const hRow=inp.addRow(['h',heightMm,'mm','Chiều cao/cạnh; dùng cho vuông/chữ nhật']).number;
  const dRow=inp.addRow(['D',diameterMm,'mm','Đường kính; chỉ dùng cho cọc tròn']).number;
  inp.getCell(sectionRow,2).dataValidation=listValidation(Object.values(SHAPE),'Vui lòng chọn Vuông, Chữ nhật hoặc Tròn.');
  [sectionRow,bRow,hRow,dRow].forEach(r=>inputFill(inp.getCell(r,2)));
  inp.getCell(sectionRow,5).value={formula:\`VLOOKUP(B\${sectionRow},'99_MA_NOI_BO'!$D$2:$E$4,2,FALSE)\`};
  inp.getCell(aRow,1).value='A_b (dẫn xuất)'; inp.getCell(uRow,1).value='u (dẫn xuất)'; inp.getCell(lsRow,1).value='L'; inp.getCell(lsRow,3).value='m';
  const areaFormula=\`IF('01_INPUT'!E\${sectionRow}="circle",PI()*('01_INPUT'!B\${dRow}/1000)^2/4,IF('01_INPUT'!E\${sectionRow}="rectangle",('01_INPUT'!B\${bRow}/1000)*('01_INPUT'!B\${hRow}/1000),('01_INPUT'!B\${bRow}/1000)^2))\`;
  const perimeterFormula=\`IF('01_INPUT'!E\${sectionRow}="circle",PI()*('01_INPUT'!B\${dRow}/1000),IF('01_INPUT'!E\${sectionRow}="rectangle",2*(('01_INPUT'!B\${bRow}/1000)+('01_INPUT'!B\${hRow}/1000)),4*('01_INPUT'!B\${bRow}/1000)))\`;
  inp.getCell(aRow,2).value={formula:areaFormula}; inp.getCell(uRow,2).value={formula:perimeterFormula};
  formulaFill(inp.getCell(aRow,2)); formulaFill(inp.getCell(uRow,2));
  inp.getCell(aRow,4).value='DERIVED — không nhập tay; tự đổi theo b/h/D.'; inp.getCell(uRow,4).value='DERIVED — không nhập tay; tự đổi theo b/h/D.';
  const abCalcRow=calc.addRow(['A_b',{formula:areaFormula},'m²','Hình học deterministic từ Tiết diện + b/h/D']).number;
  const uCalcRow=calc.addRow(['u',{formula:perimeterFormula},'m','Hình học deterministic từ Tiết diện + b/h/D']).number;
  formulaFill(calc.getCell(abCalcRow,2)); formulaFill(calc.getCell(uCalcRow,2));
  calc.getCell(rubRow,2).value={formula:\`IF(ISNUMBER(B\${qbRow}),B\${qbRow}*B\${abCalcRow},"")\`};
  calc.getCell(rufRow,2).value={formula:\`IF(ISNUMBER(B\${fsRow}),B\${fsRow}*'01_INPUT'!B\${lsRow}*B\${uCalcRow},"")\`};
  [rubRow,rufRow,rkRow,rdRow,ndRow,abCalcRow,uCalcRow].filter(Boolean).forEach(r=>{calc.getCell(r,2).numFmt='#,##0.00';});
  inp.getCell(aRow,2).numFmt='0.0000'; inp.getCell(uRow,2).numFmt='0.0000';
  inp.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}; inp.pageSetup.printArea=\`A1:E\${inp.rowCount}\`;
  calc.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}; calc.pageSetup.printArea=\`A1:D\${calc.rowCount}\`;
  if(inp.columnCount<5) inp.getColumn(5).width=2;`,
    'explicit SPT geometry formula block');
  s=replaceOnce(s,"  const explicitSpt=applyExplicitSptVietnameseAndCompatibility(wb);","  const explicitSpt=applyExplicitSptVietnameseAndCompatibility(wb,context);",'postprocess context');
  s=replaceOnce(s,"export async function postProcessHnlWorkbook(buffer,fileName='HNL.xlsx'){","export async function postProcessHnlWorkbook(buffer,fileName='HNL.xlsx',context={}){",'postprocess signature');
  s=replaceOnce(s,"  const processed=await postProcessHnlWorkbook(captured.buffer,captured.fileName);","  const processed=await postProcessHnlWorkbook(captured.buffer,captured.fileName,{fnName:fn?.name||'',args});",'run context');
  // Hidden shape mapping range grows from 2 rows to 3 rows.
  s=s.replaceAll("'99_MA_NOI_BO'!$D$2:$E$3","'99_MA_NOI_BO'!$D$2:$E$4");
  write(p,s);
}

console.log('SPT EXCEL GOLDEN HARDENING PATCH: APPLIED');
