import { tcvn7888Rows, nph7888Rows } from './tcvn7888.js';
import { structuredTablesForPack } from './codepack-tables.js';

function safeName(s='formula') { return String(s).replace(/[^A-Za-z0-9._-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80) || 'formula'; }
function exprToExcel(rhs='', varCells={}) {
  let s=String(rhs||'').trim(); if (!s) return '';
  const tokens=[...Object.keys(varCells)].sort((a,b)=>b.length-a.length);
  for(const v of tokens) s=s.replace(new RegExp(`\\b${v.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}\\b`,'g'),varCells[v]);
  return s.replace(/\bpi\b/gi,'PI()').replace(/\bsqrt\s*\(/gi,'SQRT(').replace(/\babs\s*\(/gi,'ABS(').replace(/\bmin\s*\(/gi,'MIN(').replace(/\bmax\s*\(/gi,'MAX(').replace(/\bpow\s*\(([^,]+),([^\)]+)\)/gi,'POWER($1,$2)');
}
function saveBlob(buf, name) {
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1200);
}
function styleHeader(row, color='FF17365D'){ row.font={bold:true,color:{argb:'FFFFFFFF'}}; row.fill={type:'pattern',pattern:'solid',fgColor:{argb:color}}; row.alignment={vertical:'middle',wrapText:true}; }
function styleSheet(ws){ ws.eachRow(r=>{r.alignment={vertical:'top',wrapText:true};}); ws.views=[{state:'frozen',ySplit:1}]; }
function addObjectRows(ws, rows, source=''){
  if(!rows?.length) return;
  const keys=[...new Set(rows.flatMap(r=>Object.keys(r).filter(k=>!['standard','status'].includes(k))))];
  ws.addRow([...keys,'Nguồn','Trạng thái']); styleHeader(ws.getRow(1),'FF548235');
  for(const r of rows) ws.addRow([...keys.map(k=>r[k]??''), source || r.table || (r.sources||[]).join(' · '), r.status||'Verified']);
  ws.columns.forEach(c=>c.width=Math.min(42,Math.max(12,Math.round((c.values||[]).reduce((m,v)=>Math.max(m,String(v??'').length),0)*0.9))));
  styleSheet(ws);
}
function addPackTables(wb, pack){
  if(pack?.id==='TCVN7888_2014'){
    const ws=wb.addWorksheet('BẢNG TRA 7888'); ws.columns=[{width:15},{width:14},{width:12},{width:14},{width:18},{width:18},{width:18},{width:20}];
    ws.addRow(['Loại','Ký hiệu/D','Cấp','t (mm)','M nứt (kN.m)','σce (MPa)','Bền cắt (kN)','Nguồn']); styleHeader(ws.getRow(1),'FF548235');
    for(const r of tcvn7888Rows) ws.addRow(['PC/PHC',`D${r.diameter}`,r.loadClass,r.thickness,r.crackMoment,r.effectiveStress,r.shearResistance,`Bảng 1 · trang ${r.diameter<=600?10:11}`]);
    for(const r of nph7888Rows) ws.addRow(['NPH',r.designation,r.loadClass,r.thickness,r.crackMoment,r.effectiveStress,r.shearResistance,'Bảng 2 · trang 12']); styleSheet(ws); return;
  }
  const groups=structuredTablesForPack(pack?.id);
  groups.forEach((g,i)=>{const ws=wb.addWorksheet(`TRA ${i+1}-${String(g.id).slice(0,20)}`); addObjectRows(ws,g.rows,(g.sources||[]).join(' · ')); ws.getCell('A1').note=`${g.title} | ${(g.sources||[]).join(' · ')}`;});
}

export async function exportFormulaWorkbook(item, { values={}, codePack=null } = {}) {
  const mod=await import('exceljs'); const ExcelJS=mod.default || mod; const wb=new ExcelJS.Workbook(); wb.creator='HNL Pile Standards AI'; wb.created=new Date();
  const guide=wb.addWorksheet('HƯỚNG DẪN'); guide.columns=[{width:27},{width:95}];
  guide.addRows([
    ['HNL – Công thức tiêu chuẩn','Excel có trace nguồn. Chỉ công thức VERIFIED mới có công thức Excel thực thi.'],
    ['Tiêu chuẩn',item.standard||item.docName||''],['Công thức',item.label||''],['Trang',item.page||''],['Trạng thái',item.verified?'VERIFIED':'INDEXED / REVIEW'],
    ['Cách dùng','Ô vàng = nhập liệu. Kết quả Excel chỉ chạy với công thức Verified. Khi sửa giá trị bảng tra, phải xem là giá trị nhập tay/override.'],
    ['Nguồn',`${item.standard||item.docName||''} · ${item.title||''} · trang ${item.page||''}`],['Điều kiện',item.conditions||'Đối chiếu trang PDF gốc trước khi phát hành hồ sơ.']
  ]); guide.getRow(1).font={bold:true,size:15}; guide.getColumn(1).font={bold:true}; guide.eachRow(r=>r.alignment={vertical:'top',wrapText:true});

  const calc=wb.addWorksheet('TÍNH TOÁN'); calc.columns=[{width:12},{width:22},{width:20},{width:14},{width:40},{width:58}];
  calc.addRow(['Bước','Biến','Giá trị','Đơn vị','Công thức Excel','Diễn giải / nguồn']); styleHeader(calc.getRow(1)); const varCells={}; const vars=Array.isArray(item.variables)?item.variables:[]; let row=2;
  for(const v of vars){ calc.getCell(row,1).value=row-1; calc.getCell(row,2).value=v; calc.getCell(row,3).value=Number.isFinite(Number(values[v]))?Number(values[v]):0; calc.getCell(row,4).value=item.variableUnits?.[v]||''; calc.getCell(row,3).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF2CC'}}; calc.getCell(row,6).value='Nhập/kiểm tra theo hồ sơ và bảng tra. Nếu override số tra, ghi chú rõ.'; varCells[v]=`C${row}`; row++; }
  calc.getCell(row,1).value='KQ'; calc.getCell(row,2).value=item.lhs||'Kết quả'; calc.getCell(row,4).value=item.outputUnit||''; const excelRhs=exprToExcel(item.rhs||'',varCells); const scale=Number(item.resultScale||1);
  if(item.computable && item.verified && excelRhs){ calc.getCell(row,3).value={formula:`(${excelRhs})*${scale}`}; calc.getCell(row,5).value=`=(${excelRhs})*${scale}`; calc.getCell(row,6).value=`${item.label||''} · ${item.title||''} · Trang ${item.page||''}`; }
  else { calc.getCell(row,3).value='CHƯA VERIFIED'; calc.getCell(row,5).value=item.expression||item.raw||''; calc.getCell(row,6).value='Chỉ xuất tham chiếu; không tạo công thức Excel chạy số học cho mục chưa xác minh.'; }
  calc.getCell(row,3).font={bold:true}; calc.getCell(row,3).fill={type:'pattern',pattern:'solid',fgColor:{argb:item.computable&&item.verified?'FFE2F0D9':'FFFCE4D6'}}; styleSheet(calc);

  const trace=wb.addWorksheet('THUYẾT MINH'); trace.columns=[{width:28},{width:100}]; trace.addRows([['Mục','Nội dung'],['Tiêu chuẩn',item.standard||item.docName||''],['Điều / nhóm',item.title||''],['Công thức',item.label||''],['Biểu thức nguồn',item.raw||item.expression||''],['Biểu thức chuẩn hóa',item.expression||''],['Đơn vị kết quả',item.outputUnit||''],['Điều kiện áp dụng',item.conditions||''],['Trang nguồn',item.page||''],['Trạng thái',item.verified?'Verified':'Indexed/Review'],['Nguyên tắc','Kết quả số học không thay thế việc kiểm tra giả thiết, điều kiện giới hạn và phiên bản tiêu chuẩn.']]); styleHeader(trace.getRow(1)); trace.getColumn(1).font={bold:true}; trace.eachRow(r=>r.alignment={vertical:'top',wrapText:true});
  if(codePack) addPackTables(wb,codePack);
  const buf=await wb.xlsx.writeBuffer(); saveBlob(buf,`HNL_${safeName(item.standard||'TCVN')}_${safeName(item.label||'Formula')}.xlsx`);
}

export async function exportCodePackWorkbook(pack){
  if(!pack) throw new Error('Không có Code Pack để xuất.');
  const mod=await import('exceljs'); const ExcelJS=mod.default || mod; const wb=new ExcelJS.Workbook(); wb.creator='HNL Pile Standards AI'; wb.created=new Date();
  const guide=wb.addWorksheet('HƯỚNG DẪN'); guide.columns=[{width:28},{width:100}]; guide.addRows([
    ['HNL CODE PACK',`${pack.standard} – ${pack.title}`],['Mục đích','Danh mục công thức/bảng/Điều đã cấu trúc. Công thức Indexed chỉ để tìm nguồn; chỉ Verified + computable mới được dùng số học tự động.'],['Số công thức',pack.formulas?.length||0],['Số bảng',pack.tables?.length||0],['Số mục/Điều',pack.sections?.length||0],['PDF gốc','Giữ PDF tiêu chuẩn của người dùng để kiểm tra nguyên văn, điều kiện, hình/bảng và citation.']]); guide.getRow(1).font={bold:true,size:15}; guide.getColumn(1).font={bold:true}; guide.eachRow(r=>r.alignment={vertical:'top',wrapText:true});
  const fs=wb.addWorksheet('CÔNG THỨC'); fs.columns=[{width:13},{width:12},{width:18},{width:65},{width:18},{width:18},{width:55}]; fs.addRow(['Nhãn','Trang','Điều','Tên / mục đích','Trạng thái','Cho tính','Biểu thức chuẩn hóa']); styleHeader(fs.getRow(1)); for(const f of pack.formulas||[]) fs.addRow([f.label,f.page,f.section||'',f.title||'',f.status||'Indexed',f.computable?'Có':'Không',f.rhs||'']); styleSheet(fs);
  const ts=wb.addWorksheet('MỤC LỤC BẢNG'); ts.columns=[{width:13},{width:12},{width:75},{width:18}]; ts.addRow(['Bảng','Trang','Tên bảng','Trạng thái']); styleHeader(ts.getRow(1),'FF548235'); for(const t of pack.tables||[]) ts.addRow([`Bảng ${t.number}`,t.page,t.title,t.status||'Indexed']); styleSheet(ts);
  const ss=wb.addWorksheet('ĐIỀU-PHỤ LỤC'); ss.columns=[{width:16},{width:12},{width:90}]; ss.addRow(['Điều/Phụ lục','Trang','Tên']); styleHeader(ss.getRow(1),'FF7F6000'); for(const s of pack.sections||[]) ss.addRow([s.section,s.page,s.title]); styleSheet(ss);
  addPackTables(wb,pack);
  const buf=await wb.xlsx.writeBuffer(); saveBlob(buf,`HNL_CodePack_${safeName(pack.standard)}.xlsx`);
}
