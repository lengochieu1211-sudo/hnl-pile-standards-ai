#!/usr/bin/env node
import fs from 'node:fs';

function spliceBetween(text,startMarker,endMarker,replacement,label){
  const a=text.indexOf(startMarker); if(a<0) throw new Error('Missing start '+label);
  const b=text.indexOf(endMarker,a); if(b<0) throw new Error('Missing end '+label);
  return text.slice(0,a)+replacement+text.slice(b);
}

// Runtime compat generic localization. Dedicated SPT/driven paths keep their hidden-code wiring.
{
  const file='src/excel-export-compat.js';
  let s=fs.readFileSync(file,'utf8');
  if(!s.includes('function applyGenericVietnameseCodeLists(wb)')){
    const block=[
      '',
      '// Generic Production post-processor for finite-choice workbooks not handled by dedicated adapters.',
      '// Core has already materialized the workbook, so exact code tokens can be translated consistently',
      '// in values, formulas and literal list validations. Original code mapping stays veryHidden.',
      'const GENERIC_CODE_LABELS = Object.freeze({',
      "  square:'Vuông', circle:'Tròn', rectangle:'Chữ nhật',",
      "  hammer:'Đóng bằng búa', press:'Ép tĩnh',",
      "  clay:'Đất dính', sand:'Đất cát', sandyClay:'Sét pha cát', clayeySand:'Cát pha sét',",
      "  gravelly:'Cát lẫn sỏi', coarse:'Cát thô', medium:'Cát vừa', fine:'Cát mịn', silty:'Cát bụi',",
      "  bored:'Cọc khoan nhồi', 'vibro-pipe':'Cọc ống hạ bằng rung', screw:'Cọc vít', driven:'Cọc đóng/ép',",
      "  YES:'Có', NO:'Không', yes:'Có', no:'Không', long:'Dài hạn', short:'Ngắn hạn',",
      "  Tension:'Kéo', Compression:'Nén', plain:'Trơn', coldRibbed:'Gân nguội', hotRibbed:'Gân cán nóng'",
      '});',
      'function translateFormulaCodes(formula){',
      "  let out=String(formula||'');",
      '  for(const [code,label] of Object.entries(GENERIC_CODE_LABELS)) out=out.split(\'"\'+code+\'"\').join(\'"\'+label+\'"\');',
      '  return out;',
      '}',
      'function translateLiteralListFormula(formula){',
      "  const text=String(formula||'');",
      "  if(text.length<2 || text[0]!=='\"' || text[text.length-1]!=='\"') return text;",
      "  const items=text.slice(1,-1).split(',').map(x=>x.trim());",
      '  let changed=false;',
      '  const translated=items.map(v=>{const t=GENERIC_CODE_LABELS[v]; if(t){changed=true;return t;} return v;});',
      "  return changed?'\"'+translated.join(',')+'\"':text;",
      '}',
      'function applyGenericVietnameseCodeLists(wb){',
      '  ensureMapSheet(wb);',
      '  let translatedCells=0,translatedFormulas=0,translatedValidations=0;',
      '  for(const ws of wb.worksheets){',
      "    if(ws.name==='99_MA_NOI_BO') continue;",
      '    ws.eachRow({includeEmpty:false},row=>row.eachCell({includeEmpty:false},cell=>{',
      "      if(typeof cell.value==='string' && GENERIC_CODE_LABELS[cell.value]){cell.value=GENERIC_CODE_LABELS[cell.value];translatedCells++;}",
      "      else if(cell.value && typeof cell.value==='object' && typeof cell.value.formula==='string'){const next=translateFormulaCodes(cell.value.formula);if(next!==cell.value.formula){cell.value={...cell.value,formula:next};translatedFormulas++;}}",
      '      const dv=cell.dataValidation;',
      "      if(dv?.type==='list' && Array.isArray(dv.formulae)){const next=dv.formulae.map(translateLiteralListFormula);if(next.some((v,i)=>v!==dv.formulae[i])){cell.dataValidation={...dv,formulae:next,showErrorMessage:true,errorTitle:dv.errorTitle||'Giá trị không hợp lệ',error:dv.error||'Vui lòng chọn giá trị tiếng Việt trong danh sách.'};translatedValidations++;}}",
      '    }));',
      '  }',
      '  return {translatedCells,translatedFormulas,translatedValidations};',
      '}',
      ''
    ].join('\n');
    s=s.replace('function applyExplicitSptVietnameseAndCompatibility(wb){',block+'function applyExplicitSptVietnameseAndCompatibility(wb){');
  }
  const oldPost="  const explicitSpt=applyExplicitSptVietnameseAndCompatibility(wb);\n  const driven=applyDrivenVietnamese(wb);\n  let out=await wb.xlsx.writeBuffer();";
  const newPost=[
    '  const explicitSpt=applyExplicitSptVietnameseAndCompatibility(wb);',
    '  const driven=applyDrivenVietnamese(wb);',
    '  const genericLocalization=(!explicitSpt&&!driven)?applyGenericVietnameseCodeLists(wb):null;',
    "  if(genericLocalization && genericLocalization.translatedValidations===0 && genericLocalization.translatedCells===0 && genericLocalization.translatedFormulas===0){const map=wb.getWorksheet('99_MA_NOI_BO');if(map) wb.removeWorksheet(map.id);}",
    '  let out=await wb.xlsx.writeBuffer();'
  ].join('\n');
  if(!s.includes('const genericLocalization=(!explicitSpt&&!driven)')){
    if(!s.includes(oldPost)) throw new Error('Missing compat postProcess marker');
    s=s.replace(oldPost,newPost);
  }
  fs.writeFileSync(file,s);
}

// Master Audit recognizes the actual Production runtime compat layer, not an unprocessed core literal alone.
{
  const file='scripts/master-system-audit.mjs';
  let s=fs.readFileSync(file,'utf8');
  if(!s.includes('compatRuntimeLocalization')){
    const replacement=[
      "  const codeLists=[...xls.matchAll(/formulae\\s*:\\s*\\[\\s*['\"]\"([^\"\\n]+)\"['\"]\\s*\\]/g)].map(m=>m[1]).filter(v=>/(square|circle|hammer|press|sand|clay|bored|driven|yes|no|long|short)/i.test(v));",
      "  const compat=exists('src/excel-export-compat.js')?read('src/excel-export-compat.js'):'';",
      "  const compatRuntimeLocalization=/applyGenericVietnameseCodeLists\\s*\\(/.test(compat)&&/GENERIC_CODE_LABELS/.test(compat)&&/99_MA_NOI_BO/.test(compat)&&/veryHidden/.test(compat);",
      '  const dropdownOk=codeLists.length===0||compatRuntimeLocalization;',
      "  add('EXCEL:DROPDOWN_INTERNAL_CODE','Excel Production','P1',dropdownOk?'PASS':'OPEN',codeLists.length?(compatRuntimeLocalization?`Core còn ${codeLists.length} code-list kỹ thuật nhưng Production compat localize runtime + giữ mapping 99_MA_NOI_BO veryHidden`:`Dropdown code nội bộ còn lộ: ${codeLists.slice(0,12).join(' | ')}`):'Không phát hiện dropdown lộ internal code','Dropdown hiển thị tiếng Việt; mapping code nội bộ chỉ ở 99_MA_NOI_BO veryHidden và phải có Excel Production smoke runtime.');",
      ''
    ].join('\n');
    s=spliceBetween(s,'  const codeLists=','  const provenanceMarkers=',replacement,'dropdown audit');
  }
  fs.writeFileSync(file,s);
}

// Production smoke proves an actual non-dedicated workbook has Vietnamese dropdowns and hidden map.
{
  const file='scripts/excel-production-smoke.mjs';
  let s=fs.readFileSync(file,'utf8');
  if(!s.includes('function assertNoInternalCodeDropdowns')){
    const helper=[
      'function assertNoInternalCodeDropdowns(wb,label){',
      "  const internal=/^(?:square|circle|rectangle|hammer|press|sand|clay|sandyClay|clayeySand|bored|vibro-pipe|screw|driven|yes|no|YES|NO|long|short|Tension|Compression|plain|coldRibbed|hotRibbed)$/i;",
      '  const bad=[];',
      "  for(const ws of wb.worksheets){if(ws.name==='99_MA_NOI_BO') continue;ws.eachRow({includeEmpty:false},row=>row.eachCell({includeEmpty:false},cell=>{const dv=cell.dataValidation;if(dv?.type==='list'&&Array.isArray(dv.formulae)) for(const f of dv.formulae){const text=String(f||'');if(text.length>=2&&text[0]==='\"'&&text[text.length-1]==='\"'){const list=text.slice(1,-1);if(list.split(',').some(v=>internal.test(v.trim()))) bad.push(ws.name+'!'+cell.address+':'+list);}}}));}",
      "  assert.deepEqual(bad,[],label+' còn dropdown internal code: '+bad.join(' | '));",
      '}',
      ''
    ].join('\n');
    s=s.replace('function rowByLabel(ws,label){',helper+'function rowByLabel(ws,label){');
  }
  if(!s.includes('Excel Production Pass 3:')){
    const proof=[
      '',
      '// Excel Production Pass 3: generic finite-choice localization outside dedicated SPT/driven adapters.',
      "const rock=await export10304AdvancedWorkflowWorkbook('end-bearing',{shape:'circle',diameterM:1,rockCompressiveStrengthKpa:31300,rqdPercent:30,gammaG:1.4,embedmentLengthM:5,embeddedOuterDiameterM:1,minimumQbKpa:1000,gammaK:1.4,gammaN:1.15},{returnBuffer:true});",
      "assert.ok(rock?.buffer,'Không tạo được buffer end-bearing compat');",
      '{',
      '  const wb=new ExcelJS.Workbook(); await wb.xlsx.load(rock.buffer);',
      "  const inp=wb.getWorksheet('01_DAU_VAO'),map=wb.getWorksheet('99_MA_NOI_BO');",
      "  assert.ok(inp&&map,'End-bearing compat thiếu 01_DAU_VAO hoặc 99_MA_NOI_BO');",
      "  assert.equal(map.state,'veryHidden');",
      "  assertNoInternalCodeDropdowns(wb,'End-bearing compat');",
      "  const shape=rowByLabel(inp,'Tiết diện');",
      "  assert.equal(String(inp.getCell(shape,2).value),'Tròn');",
      "  assert.match(String(inp.getCell(shape,2).dataValidation?.formulae?.[0]||''),/Tròn/);",
      '}',
      ''
    ].join('\n');
    s=s.replace('\nconsole.log(JSON.stringify({',proof+'\nconsole.log(JSON.stringify({');
    s=s.replace('  driven:{vietnameseDropdowns:true,hiddenInternalCodes:true,nativeChart:true}\n','  driven:{vietnameseDropdowns:true,hiddenInternalCodes:true,nativeChart:true},\n  genericCompat:{vietnameseDropdowns:true,hiddenInternalCodeMap:true}\n');
  }
  fs.writeFileSync(file,s);
}

console.log('EXCEL P1 DROPDOWN RUNTIME LOCALIZATION PATCH V2: APPLIED');
