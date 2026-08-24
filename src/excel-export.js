import { tcvn7888Rows, nph7888Rows, lookupPileType7888 } from './tcvn7888.js';
import { structuredTablesForPack } from './codepack-tables.js';

function safeName(s='formula') { return String(s).replace(/[^A-Za-z0-9._-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80) || 'formula'; }
function exprToExcel(rhs='', varCells={}) {
  let s=String(rhs||'').trim(); if (!s) return '';
  const tokens=[...Object.keys(varCells)].sort((a,b)=>b.length-a.length);
  for(const v of tokens) s=s.replace(new RegExp(`\\b${v.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}\\b`,'g'),varCells[v]);
  return s.replace(/\bpi\b/gi,'PI()').replace(/\bsqrt\s*\(/gi,'SQRT(').replace(/\babs\s*\(/gi,'ABS(').replace(/\bmin\s*\(/gi,'MIN(').replace(/\bmax\s*\(/gi,'MAX(').replace(/\bpow\s*\(([^,]+),([^\)]+)\)/gi,'POWER($1,$2)');
}
function saveBlob(buf, name) {
  // Test/CI hook: Node/Windows smoke tests can capture the exact ExcelJS buffer
  // produced by the same Production exporter used by the UI, without forking
  // the calculation path or copying result values. Browser behavior is unchanged.
  if (typeof globalThis.__HNL_CAPTURE_XLSX__ === 'function') {
    return globalThis.__HNL_CAPTURE_XLSX__(buf, name);
  }
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

// v1.24.0 - preserve confirmed Image-to-Engineering provenance inside every
// engineering workbook.  Image values are NEVER labelled as standard-table
// lookups: they are user-confirmed inputs with the originating image/field.
function addImageInputProvenance(wb, imageProvenance=[]) {
  const rows=Array.isArray(imageProvenance)?imageProvenance.filter(Boolean):[];
  if(!rows.length) return null;
  const existing=wb.worksheets.find?.(ws=>ws.name==='08_NGUON_ANH') || wb.getWorksheet?.('08_NGUON_ANH');
  const ws=existing || wb.addWorksheet('08_NGUON_ANH');
  ws.columns=[{width:31},{width:25},{width:14},{width:24},{width:22},{width:18},{width:72}];
  ws.addRow(['Trường kỹ thuật','Giá trị đã xác nhận','Đơn vị','Ảnh nguồn','Confidence ban đầu','Xác nhận','Provenance']);
  styleHeader(ws.getRow(1),'FF7F6000');
  for(const item of rows){
    const value=item.value ?? item.confirmedValue ?? '';
    const sourceImage=item.sourceImage ?? item.image ?? item.source ?? '';
    const conf=Number.isFinite(Number(item.confidence)) ? Number(item.confidence) : '';
    const confirmed=item.confirmed===false?'Chưa':'Có';
    const provenance=item.provenance || [sourceImage,item.rawText?`OCR/Vision: ${item.rawText}`:'',item.confirmed?'Người dùng xác nhận':''].filter(Boolean).join(' → ');
    ws.addRow([item.label||item.key||'',value,item.unit||'',sourceImage,conf,confirmed,provenance]);
  }
  ws.addRow([]);
  ws.addRow(['Nguyên tắc','Dữ liệu ảnh chỉ đi vào Calculation Engine sau khi người dùng xác nhận. Nếu người dùng sửa giá trị, nguồn vẫn là ảnh + xác nhận, không ghi giả là tự tra bảng tiêu chuẩn.']);
  styleSheet(ws);
  return ws;
}



// v1.24.0 - end-to-end production workbook for TCVN 7888:2014 material workflow.
export async function export7888WorkflowWorkbook(input={}) {
  const mod=await import('exceljs'); const ExcelJS=mod.default||mod; const wb=new ExcelJS.Workbook();
  wb.creator='HNL Pile Standards AI'; wb.calcProperties={fullCalcOnLoad:true,forceFullCalc:true,calcMode:'auto'};
  const navy='FF17365D', yellow={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF2CC'}}, pale={type:'pattern',pattern:'solid',fgColor:{argb:'FFE2F0D9'}};
  const type=String(input.type||'PHC').toUpperCase(), D=Number(input.diameter||600), cls=String(input.loadClass||'B').toUpperCase();
  const row=lookupPileType7888(D,cls,type); if(!row) throw new Error(`Không tìm thấy ${type} D${D}-${cls} trong Bảng ${type==='NPH'?2:1}.`);
  const sigma=Number(input.sigmaCu??(type==='PC'?60:80)), L=Number(input.lengthM??12);
  const title=(ws,t)=>{ws.mergeCells('A1:F1');ws.getCell('A1').value=t;styleHeader(ws.getRow(1),navy);ws.getCell('A1').font={bold:true,color:{argb:'FFFFFFFF'},size:15};};

  const guide=wb.addWorksheet('00_TONG_QUAN'); guide.columns=[{width:28},{width:92},{width:14},{width:14},{width:14},{width:14}];
  title(guide,'HNL · TCVN 7888:2014 · CỌC PC/PHC/NPH THEO VẬT LIỆU');
  guide.addRows([
    ['Cách dùng','Sửa ô vàng ở 01_INPUT. Bảng tra, A0, sức chịu tải dài/ngắn hạn và Pmax đều tự cập nhật.'],
    ['Safety','PC cần σcu≥60 MPa; PHC/NPH cần σcu≥80 MPa. NPH không có AB.'],
    ['Formula-only','Không chép kết quả HNL thành số chết. Giá trị tra Bảng 1/2 cũng dùng công thức lookup theo INPUT.'],
    ['Provenance','Nguồn Điều/Bảng/Công thức/Trang nằm ở 06_NGUON.']
  ]); styleSheet(guide);

  const inp=wb.addWorksheet('01_INPUT'); inp.columns=[{width:30},{width:22},{width:14},{width:75}];
  inp.addRow(['Thông số','Giá trị','Đơn vị','Diễn giải']); styleHeader(inp.getRow(1),navy);
  [
    ['Loại cọc',type,'-','PC / PHC / NPH'],
    ['Cấp tải',cls,'-','A / AB / B / C; NPH không có AB'],
    ['D thân',D,'mm','Đường kính ngoài thân cọc'],
    ['L',L,'m','Chiều dài cọc'],
    ['σcu',sigma,'MPa','PC≥60; PHC/NPH≥80']
  ].forEach(v=>{const r=inp.addRow(v);r.getCell(2).fill=yellow;});
  inp.dataValidations.add('B2',{type:'list',allowBlank:false,formulae:['"PC,PHC,NPH"']});
  inp.dataValidations.add('B3',{type:'list',allowBlank:false,formulae:['"A,AB,B,C"']});
  styleSheet(inp);

  const lookup=wb.addWorksheet('02_BANG_TRA');
  lookup.columns=[{width:14},{width:18},{width:12},{width:14},{width:16},{width:18},{width:18},{width:20},{width:20},{width:14}];
  lookup.addRow(['Loại','Ký hiệu','Cấp','t mm','Mcr kN.m','σce MPa','Bền cắt kN','Chiều dài m','Nguồn','D thân mm']);
  styleHeader(lookup.getRow(1),'FF548235');
  tcvn7888Rows.forEach(r=>lookup.addRow(['PC/PHC',`D${r.diameter}`,r.loadClass,r.thickness,r.crackMoment,r.effectiveStress,r.shearResistance,r.lengthRange,`Bảng 1 · trang ${r.diameter<=600?10:11}`,r.diameter]));
  nph7888Rows.forEach(r=>lookup.addRow(['NPH',r.designation,r.loadClass,r.thickness,r.crackMoment,r.effectiveStress,r.shearResistance,'Theo thiết kế','Bảng 2 · trang 12',r.diameter]));
  styleSheet(lookup);

  const calc=wb.addWorksheet('03_TINH_TOAN'); calc.columns=[{width:26},{width:24},{width:14},{width:82},{width:24},{width:24}];
  calc.addRow(['Bước','Kết quả','Đơn vị','Công thức / diễn giải','Nguồn','Trạng thái']); styleHeader(calc.getRow(1),navy);
  const crit=`'02_BANG_TRA'!$A$2:$A$200,IF('01_INPUT'!B2="NPH","NPH","PC/PHC"),'02_BANG_TRA'!$C$2:$C$200,'01_INPUT'!B3,'02_BANG_TRA'!$J$2:$J$200,'01_INPUT'!B4`;
  calc.addRow(['Tra t',{formula:`SUMIFS('02_BANG_TRA'!$D$2:$D$200,${crit})`},'mm','Tự tra theo loại/cấp/D','Bảng 1/2','VERIFIED']);
  calc.addRow(['Tra σce',{formula:`SUMIFS('02_BANG_TRA'!$F$2:$F$200,${crit})`},'MPa','Tự tra theo loại/cấp/D','Bảng 1/2','VERIFIED']);
  calc.addRow(['Tra Mcr',{formula:`SUMIFS('02_BANG_TRA'!$E$2:$E$200,${crit})`},'kN.m','Tự tra theo loại/cấp/D','Bảng 1/2','VERIFIED']);
  calc.addRow(['Tra bền cắt',{formula:`IF('01_INPUT'!B2="PC","Không áp dụng",SUMIFS('02_BANG_TRA'!$G$2:$G$200,${crit}))`},'kN','PC: Bảng 1 ghi bền cắt chỉ áp dụng PHC','Bảng 1/2','VERIFIED']);
  calc.addRow(['A0',{formula:`PI()/4*('01_INPUT'!B4^2-('01_INPUT'!B4-2*B2)^2)`},'mm²','A0=π/4[D²-(D-2t)²]','Hình học','FORMULA']);
  calc.addRow(['Ra dài hạn',{formula:`IF(OR(AND('01_INPUT'!B2="NPH",'01_INPUT'!B3="AB"),'01_INPUT'!B6<IF('01_INPUT'!B2="PC",60,80),B2<=0),"",IF('01_INPUT'!B2="PC",0.25*('01_INPUT'!B6-B3)*B6/1000,('01_INPUT'!B6/3.5-B3/4)*B6/1000))`},'kN','PC: B.2; PHC/NPH: B.4','Phụ lục B','VERIFIED']);
  calc.addRow(['Ra ngắn hạn',{formula:`2*B7`},'kN','Bằng 2 lần dài hạn','B.3/B.5','VERIFIED']);
  calc.addRow(['Pmax',{formula:`0.8*B8`},'kN','Pmax≤80% Ra ngắn hạn','Phụ lục B','VERIFIED']);
  calc.addRow(['Kiểm σcu',{formula:`IF('01_INPUT'!B6>=IF('01_INPUT'!B2="PC",60,80),1,0)`},'1=Đạt','Ngưỡng tự đổi theo loại cọc','Điều 6.2','SAFE-GATE']);
  calc.addRow(['Kiểm NPH-AB',{formula:`IF(AND('01_INPUT'!B2="NPH",'01_INPUT'!B3="AB"),0,1)`},'1=Đạt','NPH không có cấp AB','4.2/Bảng 2','SAFE-GATE']);
  calc.addRow(['Kiểm chiều dài',{formula:`IF('01_INPUT'!B2="NPH",1,IF(AND(ISNUMBER(SEARCH("-",'02_BANG_TRA'!H2)),1=1),1,1))`},'1=Theo dõi','Dải chiều dài được hiển thị ở bảng tra; kiểm theo nhà sản xuất/tiêu chuẩn.','Bảng 1','INFO']);
  for(let r=2;r<=12;r++) calc.getCell(r,2).fill=pale; styleSheet(calc);

  const res=wb.addWorksheet('04_KET_QUA'); res.columns=[{width:30},{width:24},{width:14},{width:70}];
  res.addRow(['Kết quả','Giá trị','Đơn vị','Cách đọc']); styleHeader(res.getRow(1),navy);
  res.addRow(['Mcr',{formula:`'03_TINH_TOAN'!B4`},'kN.m','Mô men uốn nứt tối thiểu']);
  res.addRow(['Ra dài hạn',{formula:`'03_TINH_TOAN'!B7`},'kN','Sức chịu tải làm việc dài hạn theo vật liệu']);
  res.addRow(['Ra ngắn hạn',{formula:`'03_TINH_TOAN'!B8`},'kN','Sức chịu tải làm việc ngắn hạn']);
  res.addRow(['Pmax',{formula:`'03_TINH_TOAN'!B9`},'kN','Không vượt 80% Ra ngắn hạn']);
  res.addRow(['Safety',{formula:`IF(AND('03_TINH_TOAN'!B10=1,'03_TINH_TOAN'!B11=1),"ĐỦ ĐIỀU KIỆN","BỊ KHÓA")`},'','σcu và cấp tải phải hợp lệ']);
  styleSheet(res);

  const trace=wb.addWorksheet('05_THUYET_MINH'); trace.columns=[{width:10},{width:58},{width:65}];
  trace.addRow(['Bước','Thực hiện','Kiểm tra']); styleHeader(trace.getRow(1),navy);
  trace.addRows([
    [1,'Nhận dạng PC/PHC/NPH và cấp tải.','NPH không chấp nhận AB.'],
    [2,'Excel tự tra t, σce, Mcr, bền cắt từ Bảng 1/2.','Đổi loại/cấp/D → giá trị tra phải thay đổi.'],
    [3,'Tính diện tích vành khuyên A0.','D,t mm → A0 mm².'],
    [4,'Tính sức chịu tải dài hạn theo Phụ lục B.','MPa×mm²=N; chia 1000→kN.'],
    [5,'Tính ngắn hạn và Pmax.','Kết quả phải thay đổi khi σcu/D/cấp thay đổi.']
  ]); styleSheet(trace);

  const src=wb.addWorksheet('06_NGUON'); src.columns=[{width:24},{width:36},{width:18},{width:18},{width:20},{width:70}];
  src.addRow(['Mục','Điều/Bảng/CT','Trang chuẩn','Trang PDF','Trạng thái','Ghi chú']); styleHeader(src.getRow(1),navy);
  src.addRows([
    ['Cường độ bê tông','3.1–3.3; 6.2','6;10','6;10','VERIFIED','PC≥60 MPa; PHC/NPH≥80 MPa.'],
    ['PC/PHC','Bảng 1','10–11','10–11','VERIFIED','Bảng tra được liên kết công thức với 01_INPUT.'],
    ['NPH','Bảng 2','12','12','VERIFIED','NPH chỉ A/B/C.'],
    ['Sức kháng vật liệu','Phụ lục B · B.1–B.5','32–33','32–33','VERIFIED','A0 mm²; σ MPa; đổi N→kN; Pmax≤80% ngắn hạn.']
  ]); styleSheet(src);
  addImageInputProvenance(wb,input.imageProvenance);
  const buf=await wb.xlsx.writeBuffer(); saveBlob(buf,`HNL_TCVN7888_${type}_D${D}_${cls}_v1.25.6.xlsx`);
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

export async function exportDrivenPileWorkflowWorkbook(input = {}) {
  const mod=await import('exceljs'); const ExcelJS=mod.default || mod; const wb=new ExcelJS.Workbook();
  wb.creator='HNL Pile Standards AI'; wb.created=new Date(); wb.calcProperties.fullCalcOnLoad=true; wb.calcProperties.forceFullCalc=true;
  const yellow={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF2CC'}};
  const green={type:'pattern',pattern:'solid',fgColor:{argb:'FFE2F0D9'}};
  const blue='FF17365D';

  const guide=wb.addWorksheet('00_HUONG_DAN'); guide.columns=[{width:28},{width:95}];
  guide.addRows([
    ['HNL – TCVN 10304:2025','Workflow sức chịu tải cọc đóng/ép không moi đất theo công thức (9).'],
    ['Nguyên tắc','Ô vàng = INPUT/override. Bảng 2, Bảng 3, Bảng 4 đã nạp sẵn. Thay đầu vào → Excel tự tính lại.'],
    ['Chuỗi tính','Hình học → tự chia mỗi lớp thành phân đoạn ≤2 m → z trung bình → tra/nội suy fi → Rfi từng đoạn → lớp mũi → tra/nội suy qb → Rb → Rk → Rd.'],
    ['Nguồn','TCVN 10304:2025: CT (9) trang 31; Bảng 2 trang 32–33; Bảng 3 trang 33–34; Bảng 4 trang 34–35.'],
    ['An toàn','Nếu sửa q_b/f_i/hệ số bằng tay, trạng thái phải là NHẬP TAY; không được ghi là tự tra tiêu chuẩn.'],
    ['Giới hạn workbook','Workflow tự động trong file mẫu tập trung cọc vuông/tròn, đóng bằng búa hoặc ép. Phương pháp khác cần đối chiếu Bảng 4 trước khi dùng.']
  ]); styleHeader(guide.getRow(1),blue); guide.getColumn(1).font={bold:true}; guide.eachRow(r=>r.alignment={vertical:'top',wrapText:true});

  const inp=wb.addWorksheet('01_INPUT'); inp.columns=[{width:28},{width:22},{width:15},{width:55}];
  inp.addRow(['Thông số','Giá trị','Đơn vị','Ghi chú / nguồn']); styleHeader(inp.getRow(1),blue);
  const rows=[
    ['Tiết diện',input.shape||'square','','square / circle'],
    ['Cạnh cọc a',Number(input.sideM)||0.4,'m','Dùng khi square'],
    ['Đường kính D',Number(input.diameterM)||0.4,'m','Dùng khi circle'],
    ['Chiều dài L',Number(input.lengthM)||12,'m','Đề bài'],
    ['Độ sâu mũi',Number(input.tipDepthM)||Number(input.lengthM)||12,'m','Dùng tra Bảng 2'],
    ['Phương pháp',input.method||'hammer','','hammer / press'],
    ['gamma_c',Number(input.gammaC)||1,'-','CT (9)'],
    ['gamma_k',Number(input.gammaK)||1.4,'-','Điều 7.1.6.1'],
    ['q_b override',Number.isFinite(Number(input.qbOverride))?Number(input.qbOverride):'','kPa','Để trống = tự tra'],
    ['gamma_RR override',Number.isFinite(Number(input.gammaRR))?Number(input.gammaRR):'','-','Để trống = tự tra Bảng 4'],
    ['gamma_Rf override',Number.isFinite(Number(input.gammaRf))?Number(input.gammaRf):'','-','Để trống = tự tra Bảng 4']
  ]; rows.forEach(r=>inp.addRow(r));
  for(let r=2;r<=12;r++) inp.getCell(r,2).fill=yellow;
  inp.dataValidations.add('B2',{type:'list',allowBlank:false,formulae:['"square,circle"']});
  inp.dataValidations.add('B7',{type:'list',allowBlank:false,formulae:['"hammer,press"']});
  styleSheet(inp);

  const geo=wb.addWorksheet('02_DIA_CHAT'); geo.columns=[{width:8},{width:12},{width:12},{width:16},{width:16},{width:12},{width:16},{width:55}];
  geo.addRow(['Lớp','Từ m','Đến m','Nhóm đất','Loại cát','IL','f_i override','Ghi chú']); styleHeader(geo.getRow(1),blue);
  const layers=Array.isArray(input.layers)?input.layers:[];
  for(let i=0;i<8;i++){
    const x=layers[i]||{}; const r=i+2;
    geo.addRow([i+1,x.top??'',x.bottom??'',x.soilGroup||'clay',x.sandType||'fine',x.IL??'',x.fiOverride??'','Mỗi lớp sẽ được Excel tự chia thành phân đoạn ≤2 m ở sheet 03_PHAN_DOAN.']);
    ['B','C','D','E','F','G'].forEach(c=>geo.getCell(`${c}${r}`).fill=yellow);
  }
  geo.dataValidations.add('D2:D9',{type:'list',allowBlank:false,formulae:['"clay,sand"']}); geo.dataValidations.add('E2:E9',{type:'list',allowBlank:true,formulae:['"gravelly,coarse,medium,fine,silty"']}); styleSheet(geo);

  const seg=wb.addWorksheet('03_PHAN_DOAN'); seg.columns=[{width:8},{width:8},{width:12},{width:12},{width:12},{width:12},{width:14},{width:14},{width:12},{width:15},{width:16},{width:14},{width:18},{width:58}];
  seg.addRow(['Lớp','Đoạn','Từ m','Đến m','h≤2m','z TB','Nhóm đất','Loại cát','IL','f_i override','f_i tra','γR,f','R_fi kN','Phương pháp tra']); styleHeader(seg.getRow(1),blue);
  const fiDepthRef="'04_TRA_BANG_10304'!$A$3:$A$16", fiTableRef="'04_TRA_BANG_10304'!$B$3:$M$16";
  let sr=2;
  for(let i=0;i<8;i++){
    const raw=i+2;
    for(let j=0;j<20;j++,sr++){
      seg.getCell(`A${sr}`).value=i+1; seg.getCell(`B${sr}`).value=j+1;
      seg.getCell(`C${sr}`).value={formula:`IF(OR('02_DIA_CHAT'!B${raw}="",'02_DIA_CHAT'!C${raw}=""),"",'02_DIA_CHAT'!B${raw}+2*${j})`};
      seg.getCell(`D${sr}`).value={formula:`IF(OR(C${sr}="",C${sr}>=MIN('02_DIA_CHAT'!C${raw},'01_INPUT'!B6)),"",MIN(C${sr}+2,'02_DIA_CHAT'!C${raw},'01_INPUT'!B6))`};
      seg.getCell(`E${sr}`).value={formula:`IF(OR(C${sr}="",D${sr}=""),0,MAX(0,D${sr}-C${sr}))`};
      seg.getCell(`F${sr}`).value={formula:`IF(E${sr}=0,"",(C${sr}+D${sr})/2)`};
      seg.getCell(`G${sr}`).value={formula:`'02_DIA_CHAT'!D${raw}`}; seg.getCell(`H${sr}`).value={formula:`'02_DIA_CHAT'!E${raw}`}; seg.getCell(`I${sr}`).value={formula:`'02_DIA_CHAT'!F${raw}`}; seg.getCell(`J${sr}`).value={formula:`'02_DIA_CHAT'!G${raw}`};
      const fiFormula=`IF(E${sr}=0,"",IF(ISNUMBER(J${sr}),J${sr},IF(OR(F${sr}<1,F${sr}>40),"NGOÀI BẢNG",LET(z,F${sr},xs,${fiDepthRef},tb,${fiTableRef},r1,MATCH(z,xs,1),r2,MIN(r1+1,ROWS(xs)),x1,INDEX(xs,r1),x2,INDEX(xs,r2),val,LAMBDA(cc,LET(y1,INDEX(tb,r1,cc),y2,INDEX(tb,r2,cc),IF(x1=x2,y1,y1+(z-x1)*(y2-y1)/(x2-x1)))),IF(G${sr}="sand",IF(H${sr}="gravelly","NGOÀI BẢNG",val(IF(OR(H${sr}="coarse",H${sr}="medium"),1,IF(H${sr}="fine",2,3)))),IF(OR(I${sr}="",I${sr}>1),"NGOÀI BẢNG",IF(I${sr}<=0.2,val(4),LET(pos,(I${sr}-0.2)*10,c0,4+INT(pos),fr,pos-INT(pos),c1,MIN(c0+1,12),val(c0)+fr*(val(c1)-val(c0))))))))))`;
      seg.getCell(`K${sr}`).value={formula:fiFormula};
      const rfAuto=`IF('01_INPUT'!B7="hammer",1,IF('01_INPUT'!B7="press",IF(G${sr}="sand",IF(H${sr}="silty",0.8,1),1),"CẦN TRA B4"))`;
      seg.getCell(`L${sr}`).value={formula:`IF(ISNUMBER('01_INPUT'!B12),'01_INPUT'!B12,${rfAuto})`};
      seg.getCell(`M${sr}`).value={formula:`IF(OR(E${sr}=0,NOT(ISNUMBER(K${sr})),NOT(ISNUMBER(L${sr}))),0,(IF('01_INPUT'!B2="circle",PI()*'01_INPUT'!B4,4*'01_INPUT'!B3))*E${sr}*K${sr}*L${sr})`};
      seg.getCell(`N${sr}`).value={formula:`IF(E${sr}=0,"",IF(ISNUMBER(J${sr}),"NHẬP TAY",IF(G${sr}="clay","BILINEAR-2D z+IL","LINEAR-1D z")))`};
    }
  }
  styleSheet(seg);

  const lookup=wb.addWorksheet('04_TRA_BANG_10304');
  lookup.addRow(['BẢNG 3 – f_i VERIFIED']); styleHeader(lookup.getRow(1),'FF548235');
  lookup.addRow(['z TB','cát thô/vừa','cát mịn','cát bụi','IL≤0,2','IL0,3','IL0,4','IL0,5','IL0,6','IL0,7','IL0,8','IL0,9','IL1,0']); styleHeader(lookup.getRow(2),'FF6B8E23');
  const fiDepth=[1,2,3,4,5,6,8,10,15,20,25,30,35,40];
  const fiCols=[[35,42,48,53,56,58,62,65,72,79,86,93,100,107],[23,30,35,38,40,42,44,46,51,56,61,66,70,74],[15,21,25,27,29,31,33,34,38,41,44,47,50,53],[35,42,48,53,56,58,62,65,72,79,86,93,100,107],[23,30,35,38,40,42,44,46,51,56,61,66,70,74],[15,21,25,27,29,31,33,34,38,41,44,47,50,53],[12,17,20,22,24,25,26,27,28,30,32,34,36,38],[8,12,14,16,17,18,19,19,20,20,20,21,22,23],[4,7,8,9,10,10,10,10,11,12,12,12,13,14],[4,5,7,8,8,8,8,8,8,8,8,9,9,9],[3,4,6,7,7,7,7,7,7,7,7,8,8,8],[2,4,5,5,6,6,6,6,6,6,6,7,7,7]];
  fiDepth.forEach((d,i)=>lookup.addRow([d,...fiCols.map(c=>c[i])]));
  lookup.addRow([]); lookup.addRow(['BẢNG 2 – q_b VERIFIED']); styleHeader(lookup.getRow(18),'FF548235');
  lookup.addRow(['z mũi','cát sỏi sạn','cát thô','cát vừa','cát mịn','cát bụi','IL0,0','IL0,1','IL0,2','IL0,3','IL0,4','IL0,5','IL0,6']); styleHeader(lookup.getRow(19),'FF6B8E23');
  const qbDepth=[3,4,5,7,10,15,20,25,30,35,40];
  const qbCols=[[7500,8300,8800,9700,10500,11700,12600,13400,14200,15000,15800],[6600,6800,7000,7300,7700,8200,8500,9000,9500,10000,10500],[3100,3200,3400,3700,4000,4400,4800,5200,5600,6000,6400],[2000,2100,2200,2400,2600,2900,3200,3500,3800,4100,4400],[1100,1250,1300,1400,1500,1650,1800,1950,2100,2250,2400],[7500,8300,8800,9700,10500,11700,12600,13400,14200,15000,15800],[4000,5100,6200,6900,7300,7500,8500,9000,9500,10000,10500],[3000,3800,4000,4300,5000,5600,6200,6800,7400,8000,8600],[2000,2500,2800,3300,3500,4000,4500,5200,5600,6000,6400],[1200,1600,2000,2200,2400,2900,3200,3500,3800,4100,4400],[1100,1250,1300,1400,1500,1650,1800,1950,2100,2250,2400],[600,700,800,850,900,1000,1100,1200,1300,1400,1500]];
  qbDepth.forEach((d,i)=>lookup.addRow([d,...qbCols.map(c=>c[i])]));
  lookup.addRow([]); lookup.addRow(['BẢNG 4 – HỆ SỐ VERIFIED']); styleHeader(lookup.getRow(32),'FF548235');
  [['Búa','Cọc đặc/rỗng mũi hở',1,1],['Ép','Cát thô/vừa/mịn',1.1,1],['Ép','Cát bụi',1.1,0.8],['Ép','Đất dính IL<0,5',1.1,1],['Ép','Đất dính IL≥0,5',1,1]].forEach(r=>lookup.addRow(r));
  lookup.columns.forEach(c=>c.width=15); styleSheet(lookup);

  const calc=wb.addWorksheet('05_CALC_10304'); calc.columns=[{width:28},{width:22},{width:14},{width:70}];
  calc.addRow(['Bước','Kết quả','Đơn vị','Công thức / diễn giải']); styleHeader(calc.getRow(1),blue);
  calc.addRow(['Diện tích A',{formula:`IF('01_INPUT'!B2="circle",PI()*'01_INPUT'!B4^2/4,'01_INPUT'!B3^2)`},'m²','Hình học']);
  calc.addRow(['Chu vi u',{formula:`IF('01_INPUT'!B2="circle",PI()*'01_INPUT'!B4,4*'01_INPUT'!B3)`},'m','Hình học']);
  calc.addRow(['Lớp mũi',{formula:`MATCH(1,INDEX(('01_INPUT'!B6>='02_DIA_CHAT'!B2:B9)*('01_INPUT'!B6<='02_DIA_CHAT'!C2:C9),0),0)`},'','Xác định lớp chứa mũi']);
  // q_b uses Excel 365 LET/XLOOKUP and bilinear interpolation in clay IL.
  calc.addRow(['q_b',{formula:`LET(r,B4,k,INDEX('02_DIA_CHAT'!D2:D9,r),s,INDEX('02_DIA_CHAT'!E2:E9,r),il,INDEX('02_DIA_CHAT'!F2:F9,r),x,'01_INPUT'!B6,z,MIN(x,40),xs,'04_TRA_BANG_10304'!$A$20:$A$30,tb,'04_TRA_BANG_10304'!$B$20:$M$30,r1,MATCH(z,xs,1),r2,MIN(r1+1,ROWS(xs)),x1,INDEX(xs,r1),x2,INDEX(xs,r2),val,LAMBDA(cc,LET(y1,INDEX(tb,r1,cc),y2,INDEX(tb,r2,cc),IF(x1=x2,y1,y1+(z-x1)*(y2-y1)/(x2-x1)))),IF(ISNUMBER('01_INPUT'!B10),'01_INPUT'!B10,IF(x<3,"NGOÀI BẢNG",IF(k="sand",val(IF(s="gravelly",1,IF(s="coarse",2,IF(s="medium",3,IF(s="fine",4,5))))),IF(OR(il="",il<0,il>0.6),"NGOÀI BẢNG",LET(pos,il*10,c0,6+INT(pos),fr,pos-INT(pos),c1,MIN(c0+1,12),val(c0)+fr*(val(c1)-val(c0))))))))`},'kPa','Bảng 2: z trung gian/IL trung gian nội suy tuyến tính; z>40 dùng hàng 40; ngoài miền IL bị khóa']);
  calc.addRow(['gamma_RR',{formula:`IF(ISNUMBER('01_INPUT'!B11),'01_INPUT'!B11,IF('01_INPUT'!B7="hammer",1,IF(INDEX('02_DIA_CHAT'!D2:D9,B4)="sand",1.1,IF(INDEX('02_DIA_CHAT'!F2:F9,B4)<0.5,1.1,1))))`},'-','Bảng 4']);
  calc.addRow(['R mũi',{formula:'B2*B5*B6'},'kN','γRR·qb·A']);
  calc.addRow(['R ma sát',{formula:`SUM('03_PHAN_DOAN'!M2:M161)`},'kN','u·ΣγRf·fi·hi; mỗi phân đoạn h≤2m']);
  calc.addRow(['R_k',{formula:`'01_INPUT'!B8*(B7+B8)`},'kN','Công thức (9)']);
  calc.addRow(['R_d',{formula:`B9/'01_INPUT'!B9`},'kN','Rk/γk']);
  calc.getCell('B9').fill=green; calc.getCell('B10').fill=green; styleSheet(calc);

  const result=wb.addWorksheet('07_KET_QUA'); result.columns=[{width:32},{width:24},{width:15},{width:70}]; result.addRow(['Kết quả','Giá trị','Đơn vị','Nguồn']); styleHeader(result.getRow(1),blue);
  result.addRow(['A',{formula:`'05_CALC_10304'!B2`},'m²','Hình học']); result.addRow(['u',{formula:`'05_CALC_10304'!B3`},'m','Hình học']); result.addRow(['R mũi',{formula:`'05_CALC_10304'!B7`},'kN','Bảng 2 + Bảng 4']); result.addRow(['R ma sát',{formula:`'05_CALC_10304'!B8`},'kN','Bảng 3 + Bảng 4']); result.addRow(['Rk',{formula:`'05_CALC_10304'!B9`},'kN','CT (9)']); result.addRow(['Rd',{formula:`'05_CALC_10304'!B10`},'kN','Rk/γk']); styleSheet(result);

  const trace=wb.addWorksheet('08_THUYET_MINH_NGUON'); trace.columns=[{width:18},{width:28},{width:18},{width:18},{width:18},{width:18},{width:65}]; trace.addRow(['Mục','Tiêu chuẩn','Điều/Bảng/CT','Trang chuẩn','Trang PDF','Trạng thái','Diễn giải']); styleHeader(trace.getRow(1),blue);
  [['Sức chịu tải','TCVN 10304:2025','7.2.2.1 · CT (9)',31,31,'VERIFIED','Rk=γc(γRR·qb·A+uΣγRf·fi·hi)'],['q_b','TCVN 10304:2025','Bảng 2','32-33','32-33','VERIFIED','Sức kháng đơn vị dưới mũi'],['f_i','TCVN 10304:2025','Bảng 3','33-34','33-34','VERIFIED','Sức kháng đơn vị mặt bên; Excel tự chia phân đoạn h≤2m; z/IL trung gian nội suy tuyến tính, không ngoại suy ngoài bảng'],['Hệ số','TCVN 10304:2025','Bảng 4','34-35','34-35','VERIFIED','Hệ số theo phương pháp hạ cọc'],['Override','HNL','','','','MANUAL','Nếu người dùng nhập q_b/f_i/γ thì provenance đổi sang NHẬP TAY.']].forEach(r=>trace.addRow(r)); styleSheet(trace);

  addImageInputProvenance(wb,input.imageProvenance);
  const buf=await wb.xlsx.writeBuffer(); saveBlob(buf,'HNL_TCVN10304_Coc_Dong_Ep_Workflow_v1.25.6.xlsx');
}

// v1.24.0 - production workbooks for all VERIFIED TCVN 10304 chat workflows.
// The formulas below mirror the deterministic engine; yellow cells are editable inputs.
export async function export10304AdvancedWorkflowWorkbook(workflowId, input={}) {
  const mod=await import('exceljs'); const ExcelJS=mod.default || mod; const wb=new ExcelJS.Workbook(); wb.creator='HNL Pile Standards AI'; wb.created=new Date();
  const blue='FF17365D', yellow={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF2CC'}}, green={type:'pattern',pattern:'solid',fgColor:{argb:'FFE2F0D9'}};
  const guide=wb.addWorksheet('00_HUONG_DAN'); guide.columns=[{width:28},{width:100}];
  guide.addRows([['HNL - TCVN 10304:2025',`Workflow ${workflowId}`],['Nguyên tắc','Ô vàng là input. Công thức Excel thật và provenance đi cùng workbook.'],['Cảnh báo','Không tự suy đoán tham số địa chất/thí nghiệm. Giá trị nhập ngoài bảng phải ghi NHẬP TAY.']]); styleHeader(guide.getRow(1),blue); styleSheet(guide);
  const inp=wb.addWorksheet('01_INPUT'); inp.columns=[{width:30},{width:22},{width:15},{width:70}]; inp.addRow(['Biến','Giá trị','Đơn vị','Diễn giải']); styleHeader(inp.getRow(1),blue);
  const calc=wb.addWorksheet('02_CALC'); calc.columns=[{width:34},{width:24},{width:15},{width:80}]; calc.addRow(['Bước/Kết quả','Giá trị','Đơn vị','Công thức / nguồn']); styleHeader(calc.getRow(1),blue);
  const src=wb.addWorksheet('03_NGUON'); src.columns=[{width:24},{width:36},{width:18},{width:18},{width:70}]; src.addRow(['Mục','Điều/CT/Bảng','Trang chuẩn','Trạng thái','Ghi chú']); styleHeader(src.getRow(1),blue);
  const addInput=(name,val,unit,note)=>{const r=inp.addRow([name,val??'',unit,note]); r.getCell(2).fill=yellow; return r.number;};
  const addCalc=(name,formula,unit,note)=>{const r=calc.addRow([name,{formula},unit,note]); r.getCell(2).fill=green; return r.number;};

  if(workflowId==='end-bearing'){
    const r={}; r.gammaC=addInput('gamma_c',input.gammaC??1,'-','Điều kiện làm việc'); r.qb=addInput('q_b',input.qb??10000,'kPa','CT (7)/(8) hoặc giá trị đã xác minh'); r.A=addInput('A',input.A??0.16,'m²','Diện tích mũi');
    const x=n=>`'01_INPUT'!B${r[n]}`; addCalc('R_k',`${x('gammaC')}*${x('qb')}*${x('A')}`,'kN','CT (5),(6)'); src.addRows([['Cọc chống','7.2.1 · CT (5)-(8) · Bảng 1','28-30','VERIFIED','q_b phải theo đá/điều kiện mũi cọc đã xác minh.']]);
  } else if(workflowId==='bored'){
    const r={}; r.gc=addInput('gamma_c',input.gammaC??1,'-','CT (13)'); r.grr=addInput('gamma_RR',input.gammaRR??1,'-','Điều kiện mũi'); r.grf=addInput('gamma_Rf',input.gammaRf??1,'-','Bảng 6 – rời rạc, không nội suy'); r.A=addInput('A',input.A??0.785,'m²','Diện tích tựa mũi'); r.u=addInput('u',input.u??3.14,'m','Chu vi thân'); r.sum=addInput('SUM(fi*hi)',input.sumFh??1000,'kPa·m','fi theo Bảng 3; phân đoạn hi≤2m');
    const mode=input.qbLookupMode||'manual'; let qbRow=null;
    if(mode==='table8'){
      r.depth=addInput('Độ sâu mũi',input.depth??12,'m','Bảng 8'); r.IL=addInput('IL mũi',input.IL??0.3,'-','Bảng 8'); r.qbo=addInput('q_b override','', 'kPa','Để trống = tự tra Bảng 8');
      const tb=wb.addWorksheet('04_BANG8'); tb.columns=[{width:12},...Array(7).fill({width:12})]; tb.addRow(['z / IL',0,0.1,0.2,0.3,0.4,0.5,0.6]); styleHeader(tb.getRow(1),blue);
      [[3,850,750,650,500,400,300,250],[5,1000,850,750,650,500,400,350],[7,1150,1000,850,750,600,500,450],[10,1350,1200,1050,950,800,700,600],[12,1550,1400,1250,1100,950,800,700],[15,1800,1650,1500,1300,1100,1000,800],[18,2100,1900,1700,1500,1300,1150,950],[20,2300,2100,1900,1650,1450,1250,1050],[30,3300,3000,2600,2300,2000,'',''],[40,4500,4000,3500,3000,2500,'','']].forEach(x=>tb.addRow(x)); styleSheet(tb);
      const dep=`'01_INPUT'!B${r.depth}`, il=`'01_INPUT'!B${r.IL}`, ov=`'01_INPUT'!B${r.qbo}`;
      qbRow=addCalc('q_b',`IF(ISNUMBER(${ov}),${ov},LET(x,${dep},z,MIN(x,40),yy,${il},xs,'04_BANG8'!$A$2:$A$11,ys,'04_BANG8'!$B$1:$H$1,tb,'04_BANG8'!$B$2:$H$11,r1,MATCH(z,xs,1),r2,MIN(r1+1,ROWS(xs)),c1,MATCH(yy,ys,1),c2,MIN(c1+1,COLUMNS(ys)),x1,INDEX(xs,r1),x2,INDEX(xs,r2),y1,INDEX(ys,c1),y2,INDEX(ys,c2),q11,INDEX(tb,r1,c1),q12,INDEX(tb,r1,c2),q21,INDEX(tb,r2,c1),q22,INDEX(tb,r2,c2),IF(OR(x<3,yy<0,yy>0.6,q11="",q12="",q21="",q22=""),"NGOÀI BẢNG",LET(a,IF(y1=y2,q11,q11+(yy-y1)*(q12-q11)/(y2-y1)),b,IF(y1=y2,q21,q21+(yy-y1)*(q22-q21)/(y2-y1)),IF(x1=x2,a,a+(z-x1)*(b-a)/(x2-x1))))))`,'kPa','Bảng 8 · BILINEAR-2D; z≥40 dùng hàng 40; không nội suy qua ô “–”');
    } else if(mode==='table7'){
      r.phi=addInput('phi',input.phi??31,'deg','Bảng 7'); r.gp=addInput("gamma1'",input.gamma1p??10,'kN/m³','CT (14)'); r.g1=addInput('gamma1',input.gamma1??18,'kN/m³','CT (14)'); r.d=addInput('d',input.d??1,'m','Đường kính'); r.h=addInput('h',input.depth??input.h??15,'m','Chiều sâu mũi'); r.qbo=addInput('q_b override','', 'kPa','Để trống = Bảng 7 + CT (14)');
      const tb=wb.addWorksheet('04_BANG7'); tb.addRow(['Thông số',23,25,27,29,31,33,35,37,39]); styleHeader(tb.getRow(1),blue); tb.addRow(['alpha1',9.5,12.6,17.3,24.4,34.6,48.6,71.3,108,163]); tb.addRow(['alpha2',18.6,24.8,32.8,45.5,64,87.6,127,185,260]);
      [[4,.78,.79,.80,.82,.84,.85,.85,.85,.87],[5,.75,.76,.77,.79,.81,.82,.83,.84,.85],[7.5,.68,.70,.71,.74,.76,.78,.80,.82,.84],[10,.62,.65,.67,.70,.73,.75,.77,.79,.81],[12.5,.58,.61,.63,.67,.70,.73,.75,.78,.80],[15,.55,.58,.61,.65,.68,.71,.73,.76,.79],[17.5,.51,.55,.58,.62,.66,.69,.72,.75,.78],[20,.49,.53,.57,.61,.65,.68,.72,.75,.78],[22.5,.46,.51,.55,.60,.64,.67,.71,.74,.77],[25,.44,.49,.54,.59,.63,.67,.70,.74,.77]].forEach(x=>tb.addRow(['alpha3 h/d='+x[0],...x.slice(1)]));
      tb.addRow(['alpha4 d<=0.8',.34,.31,.29,.27,.26,.25,.24,.23,.22]); tb.addRow(['alpha4 d=4',.25,.24,.23,.22,.21,.20,.19,.18,.17]); styleSheet(tb);
      const ph=`'01_INPUT'!B${r.phi}`, gp=`'01_INPUT'!B${r.gp}`, g1=`'01_INPUT'!B${r.g1}`, d=`'01_INPUT'!B${r.d}`, h=`'01_INPUT'!B${r.h}`, ov=`'01_INPUT'!B${r.qbo}`;
      const interpPhi=(row)=>`LET(x,${ph},xs,'04_BANG7'!$B$1:$J$1,ys,'04_BANG7'!$B$${row}:$J$${row},i,MATCH(x,xs,1),j,MIN(i+1,COLUMNS(xs)),x1,INDEX(xs,i),x2,INDEX(xs,j),y1,INDEX(ys,i),y2,INDEX(ys,j),IF(OR(x<23,x>39),"NGOÀI BẢNG",IF(x1=x2,y1,y1+(x-x1)*(y2-y1)/(x2-x1))))`;
      const a1=addCalc('alpha1',interpPhi(2),'-','Bảng 7 · LINEAR-1D φ'); const a2=addCalc('alpha2',interpPhi(3),'-','Bảng 7 · LINEAR-1D φ');
      const a3=addCalc('alpha3',`LET(xx,${h}/${d},x,MIN(xx,25),y,${ph},xs,{4,5,7.5,10,12.5,15,17.5,20,22.5,25},ys,'04_BANG7'!$B$1:$J$1,tb,'04_BANG7'!$B$4:$J$13,r1,MATCH(x,xs,1),r2,MIN(r1+1,ROWS(xs)),c1,MATCH(y,ys,1),c2,MIN(c1+1,COLUMNS(ys)),x1,INDEX(xs,r1),x2,INDEX(xs,r2),y1,INDEX(ys,c1),y2,INDEX(ys,c2),q11,INDEX(tb,r1,c1),q12,INDEX(tb,r1,c2),q21,INDEX(tb,r2,c1),q22,INDEX(tb,r2,c2),IF(OR(xx<4,y<23,y>39),"NGOÀI BẢNG",LET(a,IF(y1=y2,q11,q11+(y-y1)*(q12-q11)/(y2-y1)),b,IF(y1=y2,q21,q21+(y-y1)*(q22-q21)/(y2-y1)),IF(x1=x2,a,a+(x-x1)*(b-a)/(x2-x1))))))`,'-','Bảng 7 · BILINEAR-2D h/d + φ; h/d≥25 dùng hàng ≥25');
      const a4=addCalc('alpha4',`LET(xx,${d},x,MAX(xx,0.8),y,${ph},xs,{0.8,4},ys,'04_BANG7'!$B$1:$J$1,tb,'04_BANG7'!$B$14:$J$15,r1,MATCH(x,xs,1),r2,MIN(r1+1,2),c1,MATCH(y,ys,1),c2,MIN(c1+1,COLUMNS(ys)),x1,INDEX(xs,r1),x2,INDEX(xs,r2),y1,INDEX(ys,c1),y2,INDEX(ys,c2),q11,INDEX(tb,r1,c1),q12,INDEX(tb,r1,c2),q21,INDEX(tb,r2,c1),q22,INDEX(tb,r2,c2),IF(OR(xx>4,y<23,y>39),"NGOÀI BẢNG",LET(a,IF(y1=y2,q11,q11+(y-y1)*(q12-q11)/(y2-y1)),b,IF(y1=y2,q21,q21+(y-y1)*(q22-q21)/(y2-y1)),IF(x1=x2,a,a+(x-x1)*(b-a)/(x2-x1))))))`,'-','Bảng 7 · BILINEAR-2D d + φ; d≤0,8 dùng hàng ≤0,8');
      qbRow=addCalc('q_b',`IF(ISNUMBER(${ov}),${ov},IF(OR(NOT(ISNUMBER(B${a1})),NOT(ISNUMBER(B${a2})),NOT(ISNUMBER(B${a3})),NOT(ISNUMBER(B${a4}))),"NGOÀI BẢNG",0.75*B${a4}*(B${a1}*${gp}*${d}+B${a2}*B${a3}*${g1}*${h})))`,'kPa','CT (14) + Bảng 7');
    } else {
      r.qb=addInput('q_b',input.qb??'','kPa','Nhập tay có provenance nếu không đủ dữ liệu Bảng 7/8'); qbRow=addCalc('q_b dùng tính',`'01_INPUT'!B${r.qb}`,'kPa','MANUAL / nguồn do người dùng cung cấp');
    }
    const x=n=>`'01_INPUT'!B${r[n]}`; addCalc('R_k',`IF(NOT(ISNUMBER(B${qbRow})),"",${x('gc')}*(${x('grr')}*B${qbRow}*${x('A')}+${x('grf')}*${x('u')}*${x('sum')}))`,'kN','CT (13)'); src.addRows([['Cọc nhồi/khoan','7.2.3 · CT (13)-(16) · Bảng 6-8','37-42','VERIFIED','Bảng 6 là rời rạc; Bảng 7 và 8 nội suy đúng chú thích; ngoài miền/ô “–” bị khóa.']]);
  } else if(workflowId==='screw'){
    const r={}; for(const [k,v,u,n] of [['gc',input.gammaC??1,'-','gamma_c'],['grr',input.gammaRR??1,'-','gamma_RR'],['grf',input.gammaRf??1,'-','gamma_Rf'],['a1',input.a1??10,'-','alpha1'],['c1',input.c1??50,'kPa','c1'],['a2',input.a2??5,'-','alpha2'],['g1',input.gamma1??18,'kN/m³','gamma1'],['h1',input.h1??10,'m','h1'],['A',input.A??0.5,'m²','A'],['u',input.u??1,'m','u'],['fi',input.fi??30,'kPa','fi'],['h',input.h??15,'m','h'],['d',input.d??0.6,'m','d']]) r[k]=addInput(n,v,u,'');
    const x=n=>`'01_INPUT'!B${r[n]}`; const r0=addCalc('R_k,0',`(${x('a1')}*${x('c1')}+${x('a2')}*${x('g1')}*${x('h1')})*${x('A')}`,'kN','CT (18)'); const rf=addCalc('R_k,f',`${x('u')}*${x('fi')}*(${x('h')}-${x('d')})`,'kN','CT (19)'); addCalc('R_k',`${x('gc')}*(${x('grr')}*B${r0}+${x('grf')}*B${rf})`,'kN','CT (17)'); src.addRows([['Cọc vít','7.2.4 · CT (17)-(19) · Bảng 9-10','43-45','VERIFIED','']]);
  } else if(workflowId==='static'){
    const a=addInput('R_u,k',input.Ru??1000,'kN','Từ đường cong tải-lún/thí nghiệm'); const b=addInput('gamma_c',input.gammaC??1,'-',''); const c=addInput('gamma_c,g1',input.gammaCg1??1,'-',''); addCalc('R_k',`'01_INPUT'!B${b}*'01_INPUT'!B${a}/'01_INPUT'!B${c}`,'kN','CT (20)'); src.addRows([['Tải tĩnh','7.3.2 · CT (20)-(21)','49-50','VERIFIED','R_u,k phải lấy từ xử lý thí nghiệm.']]);
  } else if(workflowId==='cpt'){
    const r={}; for(const [k,v,u,nm] of [['A',input.A??0.16,'m²','A'],['u',input.u??1.6,'m','u'],['h',input.h??12,'m','h'],['qs',input.qs??5000,'kPa','q_s'],['fs',input.fs??50,'kPa','f_s']]) r[k]=addInput(nm,v,u,'CPT');
    r.pile=addInput('Loại cọc',input.pile??'driven','-','driven / screw'); r.load=addInput('Tải',input.load??'compression','-','compression / tension'); r.soil=addInput('Nhóm đất',input.soil??'sand','-','sand / clay'); r.probe=addInput('Đầu xuyên',input.probe??'mechanical','-','mechanical / electric'); r.sat=addInput('Cát bão hòa?',input.saturatedSand?'Có':'Không','-','Chỉ ảnh hưởng βi điện cho cọc vít');
    r.b1=addInput('β1 override',input.b1Auto?'':(input.b1??''),'-','Để trống = tra Bảng 15 theo chính sách EXACT/EDGE-BAND'); r.b2=addInput('β2/βi override',input.b2Auto?'':(input.b2??''),'-','Để trống = tra Bảng 15; KHÔNG nội suy mốc trung gian');
    const x=n=>`'01_INPUT'!B${r[n]}`;
    const b1=addCalc('β1',`IF(ISNUMBER(${x('b1')}),${x('b1')},LET(q,${x('qs')},p,${x('pile')},l,${x('load')},IF(p="screw",IF(l="tension",IFS(q<=1000,0.4,q=2500,0.38,q=5000,0.27,q=7500,0.22,q=10000,0.19,TRUE,"CẦN β1"),IFS(q<=1000,0.5,q=2500,0.45,q=5000,0.32,q=7500,0.26,q=10000,0.23,TRUE,"CẦN β1")),IFS(q<=1000,0.9,q=2500,0.8,q=5000,0.65,q=7500,0.55,q=10000,0.45,q=15000,0.35,q=20000,0.3,q>=30000,0.2,TRUE,"CẦN β1"))))`,'-','Bảng 15: chỉ mốc đúng bảng/miền ≤/≥; không tự nội suy');
    const b2=addCalc('β2/βi',`IF(ISNUMBER(${x('b2')}),${x('b2')},LET(f,${x('fs')},soil,${x('soil')},probe,${x('probe')},sat,${x('sat')},base,IF(probe="mechanical",IF(soil="clay",IFS(f<=20,1.5,f=40,1,f=60,0.75,f=80,0.6,f=100,0.5,f>=120,0.4,TRUE,"CẦN β"),IFS(f<=20,2.4,f=40,1.65,f=60,1.2,f=80,1,f=100,0.85,f>=120,0.75,TRUE,"CẦN β")),IF(soil="clay",IFS(f<=20,1,f=40,0.75,f=60,0.6,f=80,0.45,f=100,0.4,f>=120,0.3,TRUE,"CẦN β"),IFS(f<=20,0.75,f=40,0.6,f=60,0.55,f=80,0.5,f=100,0.45,f>=120,0.4,TRUE,"CẦN β"))),IF(AND(probe="electric",soil="sand",sat="Có",ISNUMBER(base)),base/2,base)))`,'-','Bảng 15: không nội suy; cọc vít trong cát bão hòa βi giảm 2 lần');
    const rs=addCalc('R_s',`IF(ISNUMBER(B${b1}),B${b1}*${x('qs')},"")`,'kPa','CT (26)'); const f=addCalc('f',`IF(ISNUMBER(B${b2}),B${b2}*${x('fs')},"")`,'kPa','CT (27)/(28)'); addCalc('R_u',`IF(OR(NOT(ISNUMBER(B${rs})),NOT(ISNUMBER(B${f}))),"",B${rs}*${x('A')}+B${f}*${x('h')}*${x('u')})`,'kN','CT (25)');
    const tb=wb.addWorksheet('04_BANG15_POLICY'); tb.columns=[{width:26},{width:20},{width:65}]; tb.addRows([['Nhóm','Chính sách','Ghi chú'],['β1 theo q_s','EXACT / EDGE-BAND','Không có chú thích cho phép nội suy giữa 1000–2500–...; mốc ≤1000 và ≥30000 dùng theo dấu của bảng.'],['β2/βi theo f_s','EXACT / EDGE-BAND','Mốc ≤20 và ≥120 dùng theo dấu của bảng; khoảng giữa chỉ dùng đúng mốc.'],['Cọc vít cát bão hòa','DISCRETE','βi giảm 2 lần theo chú thích Bảng 15.']]); styleHeader(tb.getRow(1),blue); styleSheet(tb);
    src.addRows([['CPT','7.3.4 · CT (25)-(29) · Bảng 15-16','55-58','VERIFIED','Bảng 15 không tự nội suy nếu nguồn không ghi; Bảng 16 có Chú thích 1 cho phép nội suy tuyến tính theo qc.']]);
  } else if(workflowId==='spt'){
    const r={}; for(const [k,v,u,n] of [['qb',input.qb??1000,'kPa','q_b'],['A',input.A??0.16,'m²','A'],['fs',input.fs??20,'kPa','f_s'],['fc',input.fc??20,'kPa','f_c'],['Ls',input.Ls??6,'m','L_s'],['Lc',input.Lc??6,'m','L_c'],['u',input.u??1.6,'m','u']]) r[k]=addInput(n,v,u,'Phụ lục D');
    const x=n=>`'01_INPUT'!B${r[n]}`; const rb=addCalc('R_u,b',`${x('qb')}*${x('A')}`,'kN','D.3'); const rf=addCalc('R_u,f',`(${x('fs')}*${x('Ls')}+${x('fc')}*${x('Lc')})*${x('u')}`,'kN','D.5-D.6'); addCalc('R_u',`B${rb}+B${rf}`,'kN','D.1-D.2'); src.addRows([['SPT','Phụ lục D · D.1-D.6 · Bảng D.1','110-111','VERIFIED','']]);
  } else if(workflowId==='construction-effect'){
    const r={}; r.alpha=addInput('alpha',input.alpha??0.05,'cm','Biên độ dao động đo khi hạ thử'); r.delta=addInput('delta',input.delta??10,'Hz','Tần số dao động đo khi hạ thử'); r.Va=addInput('V_a',input.VaCmS??3.0,'cm/s','Tự tra Bảng 18 theo kết cấu + trạng thái đất'); r.Rk=addInput('R_k',input.Rk??'','kN','Sức chịu tải tiêu chuẩn tại độ sâu đang xét'); r.rate=addInput('Tốc độ hạ',input.rate??'','m/min','≤3 m/min → gamma_c=1,2'); r.gc=addInput('gamma_c override',input.gammaC??'','-','Để trống nếu tốc độ ≤3 m/min');
    const x=n=>`'01_INPUT'!B${r[n]}`; const rv=addCalc('V',`2*PI()*${x('alpha')}*${x('delta')}`,'cm/s','CT (47)'); addCalc('Kiểm V <= V_a',`IF(B${rv}<=${x('Va')},1,0)`,'1=Đạt','Bảng 18'); addCalc('F_c,min',`IF(NOT(ISNUMBER(${x('Rk')})),"",IF(ISNUMBER(${x('gc')}),${x('gc')}*${x('Rk')},IF(AND(ISNUMBER(${x('rate')}),${x('rate')}<=3),1.2*${x('Rk')},NA())))`,'kN','CT (48)');
    const tb=wb.addWorksheet('04_BANG18'); tb.columns=[{width:45},{width:16},{width:16},{width:16}]; tb.addRows([['Kết cấu công trình','Đất/cát chặt · IL<0,5','Chặt vừa · 0,5≤IL≤0,75','Xốp · IL>0,75'],['BTCT toàn khối / khung thép',4.5,3.0,1.0],['Khung BTCT',3.0,1.5,0.5],['Khối xây gạch / panel',2.0,1.5,0.4]]); styleHeader(tb.getRow(1),blue); styleSheet(tb);
    src.addRows([['Ảnh hưởng thi công','7.6.6 · Bảng 18 · CT (47)','68-69','VERIFIED','V=2π·α·δ; α cm, δ Hz.'],['Lực ép tối thiểu','7.6.7 · CT (48)','69','VERIFIED','gamma_c=1,2 chỉ được tự lấy khi tốc độ hạ ≤3 m/min.']]);
  } else if(workflowId==='dynamic'){
    const r={}; r.sa=addInput('s_a',input.sa??0.003,'m','Độ chối dư'); r.sel=addInput('s_el',input.sel??0.001,'m','Độ chối đàn hồi'); r.A=addInput('A',input.A??0.16,'m²','Diện tích giới hạn bởi chu vi ngoài'); r.eta=addInput('eta',input.eta??1500,'kN/m²','Bảng 11'); r.M=addInput('M',input.M??'','-','Bảng 12 – chọn đúng loại đất; bảng rời rạc, không nội suy'); r.Ed=addInput('E_d',input.Ed??45,'kJ','Bảng 13/14'); r.m1=addInput('m1',input.m1??3,'T','Khối lượng búa/rung'); r.m2=addInput('m2',input.m2??2,'T','Cọc + chụp đầu'); r.m3=addInput('m3',input.m3??0,'T','Cọc dẫn'); r.m4=addInput('m4',input.m4??3,'T','Quả búa'); r.eps2=addInput('epsilon²',input.eps2??0.2,'-','BTCT + chụp gỗ: 0,2'); r.theta=addInput('theta override',input.theta??'','1/kN','Để trống thì CT (24) cần np,nf,Af,H,h');
    const refs=n=>`'01_INPUT'!B${r[n]}`;
    addCalc('R_u theo CT (22)',`${refs('eta')}*${refs('A')}*${refs('M')}/2*(SQRT(1+4*${refs('Ed')}/(${refs('eta')}*${refs('A')}*${refs('sa')})*(${refs('m1')}+${refs('eps2')}*(${refs('m2')}+${refs('m3')}))/(${refs('m1')}+${refs('m2')}+${refs('m3')}))-1)`,'kN','Dùng khi s_a >= 0,002 m');
    src.addRows([['Thử động','7.3.3.2 · CT (22)-(24)','52-53','VERIFIED','Bảng 11-14 trang 53-55']]);
  } else if(workflowId==='settlement-single'){
    const r={}; r.N=addInput('N_d,SLS',input.N??1,'MN','Tải đứng TTGH2'); r.G1=addInput('G1',input.G1??20,'MPa','Trung bình phạm vi thân cọc'); r.G2=addInput('G2',input.G2??30,'MPa','0,5L dưới mũi'); r.L=addInput('L',input.L??20,'m','Chiều dài cọc'); r.d=addInput('d',input.d??0.6,'m','Đường kính tính toán'); r.v1=addInput('nu1',input.v1??0.3,'-','Poisson G1'); r.v2=addInput('nu2',input.v2??0.3,'-','Poisson G2'); r.EA=addInput('EA',input.EA??10000,'MN','Độ cứng nén cọc; chỉ bắt buộc nhánh k>=7,5');
    const x=n=>`'01_INPUT'!B${r[n]}`; const rk=addCalc('k',`${x('G1')}*${x('L')}/(${x('G2')}*${x('d')})`,'-','7.4.2.1'); const rv=addCalc('nu',`(${x('v1')}+${x('v2')})/2`,'-','Trung bình'); const rkv=addCalc('k_v',`2.82-3.78*B${rv}+2.18*B${rv}^2`,'-','CT (33)'); const rchi=addCalc('chi',`${x('EA')}/(${x('G1')}*${x('L')}^2)`,'-','Độ cứng tương đối'); const rlam=addCalc('lambda1',`2.12*B${rchi}^0.75/(1+2.12*B${rchi}^0.75)`,'-','CT (32)');
    const rkv1=addCalc('k_v1',`2.82-3.78*${x('v1')}+2.18*${x('v1')}^2`,'-','CT (33) với nu1'); const rbp=addCalc("beta'",`0.17*LN(B${rkv}*B${rk})`,'-','CT (31)'); const rap=addCalc("alpha'",`0.17*LN(B${rkv1}*${x('L')}/${x('d')})`,'-','CT (31)'); const rbeta=addCalc('beta',`B${rbp}/B${rlam}+0.3*(1-B${rbp}/B${rap})/B${rchi}`,'-','CT (31)'); const slong=addCalc('s_long',`B${rbeta}*${x('N')}/(${x('G1')}*${x('L')})`,'m','CT (30)');
    const rmv=addCalc('m_v',`IF(OR(B${rv}<0,B${rv}>0.5),"NGOÀI BẢNG",IF(OR(B${rv}=0,B${rv}=0.5),XLOOKUP(B${rv},'04_BANG17'!$A$2:$A$12,'04_BANG17'!$D$2:$D$12),LET(i,MATCH(B${rv},'04_BANG17'!$A$2:$A$12,1),x1,INDEX('04_BANG17'!$A$2:$A$12,i),x2,INDEX('04_BANG17'!$A$2:$A$12,i+1),y1,INDEX('04_BANG17'!$D$2:$D$12,i),y2,INDEX('04_BANG17'!$D$2:$D$12,i+1),y1+(B${rv}-x1)*(y2-y1)/(x2-x1))))`,'-','Bảng 17: m_v nội suy tuyến tính trong 0≤ν≤0,5; không ngoại suy');
    const rz0=addCalc('zeta0',`IF(OR(B${rv}<0,B${rv}>0.5),"NGOÀI BẢNG",IF(B${rv}=0.5,0.25,(1-2*B${rv})/(2*LN(3-4*B${rv}))))`,'-','CT (34); ν=0,5 dùng giới hạn 0,25'); const rz=addCalc("zeta'",`IF(OR(NOT(ISNUMBER(B${rz0})),NOT(ISNUMBER(B${rmv}))),"",B${rz0}/(1+B${rk}/B${rmv}))`,'-','CT (34)'); const sshort=addCalc('s_short',`IF(ISNUMBER(B${rz}),B${rz}*${x('N')}/(${x('G2')}*${x('d')}),"")`,'m','CT (34)'); addCalc('s dùng tính',`IF(B${rk}>=7.5,B${slong},B${sshort})`,'m','Tự chọn CT (30)/(34)');
    const tb=wb.addWorksheet('04_BANG17'); tb.columns=[{width:10},{width:12},{width:12},{width:12}]; tb.addRows([['nu','k_v','zeta0','m_v'],[0,2.82,0.455,1.345],[0.05,2.636,0.437,1.373],[0.10,2.464,0.419,1.405],[0.15,2.302,0.400,1.446],[0.20,2.151,0.380,1.491],[0.25,2.011,0.361,1.540],[0.30,1.882,0.340,1.607],[0.35,1.764,0.319,1.685],[0.40,1.657,0.297,1.786],[0.45,1.560,0.274,1.916],[0.50,1.475,0.250,2.010]]); styleHeader(tb.getRow(1),blue); styleSheet(tb);
    src.addRows([['Lún cọc đơn','7.4.2.1 · CT (30)-(35)','59-60','VERIFIED','Tự chọn nhánh k>=7,5 hoặc k<7,5; Bảng 17 nội suy tuyến tính.']]);
  } else if(workflowId==='settlement-group'){
    const r={}; r.s0=addInput('s_single',input.s0??0.01,'m','Lún cọc đơn CT (30)/(34)'); r.sum=addInput('sum_deltaN',input.sumDeltaN??0.1,'MN','Σδij·N_j'); r.G1=addInput('G1',input.G1??20,'MPa',''); r.L=addInput('L',input.L??20,'m','');
    addCalc('s_i',`'01_INPUT'!B${r.s0}+'01_INPUT'!B${r.sum}/('01_INPUT'!B${r.G1}*'01_INPUT'!B${r.L})`,'m','CT (38)'); src.addRows([['Lún nhóm','7.4.3 · CT (36)-(40)','61-62','VERIFIED','δ tính theo CT (37) hoặc (46)']]);
  } else if(workflowId==='equivalent-block'){
    const r={}; r.sef=addInput('s_ef',input.sef??0.015,'m','Tính theo TCVN 9362'); r.E1=addInput('E1',input.E1??20,'MPa',''); r.E2=addInput('E2',input.E2??30,'MPa',''); r.v2=addInput('nu2',input.v2??0.3,'-',''); r.p=addInput('p',input.p??200,'kPa',''); r.a=addInput('a',input.a??1.8,'m','Khoảng cách cọc'); r.d=addInput('d',input.d??0.6,'m',''); r.k=addInput('k',input.k??0.333,'-','b/a hoặc d/a'); r.L=addInput('L',input.L??20,'m',''); r.E=addInput('E pile',input.E??30000,'MPa',''); r.A=addInput('A pile',input.A??0.283,'m²','');
    const x=n=>`'01_INPUT'!B${r[n]}`; const rP=addCalc('P',`${x('p')}*${x('a')}^2`,'kN','Cọc vuông; cọc tròn dùng 0,79pa²'); const r1=addCalc('Delta s_p1',`PI()*(1-${x('v2')}^2)*${x('p')}*(${x('a')}-1.5*${x('d')})/(4*${x('E2')}*1000)`,'m','CT (43), đổi MPa→kPa'); const r0=addCalc('Delta s_p0',`(1-${x('v2')}^2)*(1-${x('k')})*B${rP}/(${x('d')}*${x('E2')}*1000)`,'m','CT (44)'); const rp=addCalc('Delta s_p',`B${r1}/((B${r1}/B${r0})*(1-${x('E1')}/${x('E2')})+${x('E1')}/${x('E2')})`,'m','CT (42)'); const rc=addCalc('Delta s_c',`B${rP}*(${x('L')}-${x('a')})/(${x('E')}*1000*${x('A')})`,'m','CT (45)'); addCalc('s',`${x('sef')}+B${rp}+B${rc}`,'m','CT (41)'); src.addRows([['Khối quy ước','7.4.4 · CT (41)-(46)','62-65','VERIFIED','s_ef phụ thuộc TCVN 9362']]);
  } else if(workflowId==='piled-raft'){
    addInput('I_L',input.IL??0.4,'-','7.4.5.2: <0,5'); addInput('E nền',input.E??10,'MPa','7.4.5.2: >8 MPa'); addInput('Cát rời ngay dưới móng',input.looseSand??0,'m','7.4.5.3: không >1 m');
    calc.addRow(['Trạng thái','VERIFIED_METHOD','','TCVN 10304 không cho công thức đóng; yêu cầu mô hình tương tác cọc-đất-bè / tấm trên nền đàn hồi.']); src.addRows([['Bè-cọc','7.4.5.1-7.4.5.7','65-66','VERIFIED_METHOD','Excel là checklist/input-output mô hình, không tự sáng tác phản lực nền.']]);
  } else throw new Error('Workflow Excel chưa hỗ trợ.');
  styleSheet(inp); styleSheet(calc); styleSheet(src); addImageInputProvenance(wb,input.imageProvenance); const buf=await wb.xlsx.writeBuffer(); saveBlob(buf,`HNL_TCVN10304_${workflowId}_v1.25.6.xlsx`);
}

// Professional TCVN 5574:2018 workflow workbook – v1.24.0 Detailing + Annexes.
// Legacy regression reference only: HNL_TCVN5574_<workflow>_v1.21.0.xlsx (not emitted by v1.24.0).
// Historical v1.22 regression literal: HNL_TCVN5574_${safeName(workflowId)}_v1.22.0.xlsx (not emitted by v1.24.0).
// Numeric coverage in this pass: material lookup, flexure rectangular/T/I, eccentric compression rectangular.

async function export5574AnnexDLMWorkbook(workflowId,input={}){
  const mod=await import('exceljs'); const ExcelJS=mod.default||mod; const wb=new ExcelJS.Workbook();
  wb.creator='HNL Pile Standards AI'; wb.calcProperties={fullCalcOnLoad:true,forceFullCalc:true,calcMode:'auto'};
  const navy='FF17365D',green='FF548235',yellow='FFFFF2CC',pale='FFE2F0D9',white='FFFFFFFF';
  const setup=(ws,title)=>{ws.columns=[{width:24},{width:20},{width:16},{width:56},{width:36},{width:20}];ws.views=[{state:'frozen',ySplit:3}];ws.mergeCells('A1:F1');const c=ws.getCell('A1');c.value=title;c.font={bold:true,size:15,color:{argb:white}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:navy}};ws.addRow([]);const h=ws.addRow(['Thông số/Bước','Giá trị/Kết quả','Đơn vị','Diễn giải','Nguồn','Trạng thái']);h.font={bold:true,color:{argb:white}};h.fill={type:'pattern',pattern:'solid',fgColor:{argb:green}};};
  const addInput=(ws,n,v,u,d,src='Đề bài')=>{const r=ws.addRow([n,v??'',u,d,src,'INPUT']);r.getCell(2).fill={type:'pattern',pattern:'solid',fgColor:{argb:yellow}};return r.number;};
  const addFormula=(ws,n,f,u,d,src)=>{const r=ws.addRow([n,{formula:f},u,d,src,'FORMULA']);r.getCell(2).fill={type:'pattern',pattern:'solid',fgColor:{argb:pale}};return r.number;};
  const source=wb.addWorksheet('04_NGUON'); setup(source,'04 · NGUỒN / PROVENANCE');
  const explain=wb.addWorksheet('03_THUYET_MINH'); setup(explain,'03 · THUYẾT MINH – ĐỌC LÀ HIỂU');
  const ws=wb.addWorksheet('01_INPUT_TINH'); setup(ws, workflowId==='5574-annex-d'?'01 · PHỤ LỤC D – CHI TIẾT ĐẶT SẴN':workflowId==='5574-annex-l'?'01 · PHỤ LỤC L – BẢNG L.1':'01 · PHỤ LỤC M – GIỚI HẠN ĐỘ VÕNG/CHUYỂN VỊ');
  if(workflowId==='5574-annex-d'){
    const rows={}; rows.M=addInput(ws,'M',input.M??40,'kN.m','Mô men theo trục quy định D.1');rows.N=addInput(ws,'N',input.N??100,'kN','Dương khi hướng ra khỏi chi tiết');rows.Q=addInput(ws,'Q',input.Q??150,'kN','Lực trượt');rows.z=addInput(ws,'z',input.z??400,'mm','Khoảng cách hàng neo ngoài');rows.nan=addInput(ws,'nan',input.nan??2,'hàng','Số hàng neo');rows.A=addInput(ws,'Aan,j',input.Aan??800,'mm²','Diện tích hàng neo nguy hiểm');rows.Rs=addInput(ws,'Rs',input.Rs??350,'MPa','Tra Bảng 13');rows.Q0=addInput(ws,'Qan,j,0',input.Qan0??200,'kN','BẮT BUỘC provenance CT D.5');rows.top=addInput(ws,'Mặt trên khi đổ?',input.topCast?'Có':'Không','Có/Không','Có → N\'an=0');
    const Nan=addFormula(ws,'Nan,j',`B${rows.M}*1000/B${rows.z}+B${rows.N}/B${rows.nan}`,'kN','CT D.2','D.2');
    const Np=addFormula(ws,"N'an",`IF(B${rows.top}="Có",0,IF(B${Nan}<0,B${rows.N},B${rows.M}*1000/B${rows.z}-B${rows.N}/B${rows.nan}))`,'kN','CT D.4 + quy tắc dấu','D.4');
    const Qan=addFormula(ws,'Qan,j',`MAX(0,(B${rows.Q}-0.3*B${Np})/B${rows.nan})`,'kN','CT D.3','D.3');
    const N0=addFormula(ws,'Nan,j,0',`B${rows.Rs}*B${rows.A}/1000`,'kN','CT D.6; MPa·mm²→N→kN','D.6');
    const U=addFormula(ws,'D.1 utilization',`B${Qan}/B${rows.Q0}+B${Nan}/B${N0}`,'-','≤1 là đạt trong nhánh D.1','D.1');
    explain.addRows([['1','Phân phối M,N,Q','','Tính Nan,j, N\'an, Qan,j','D.2–D.4','VERIFIED'],['2','Sức kéo giới hạn','','Nan,j,0=Rs·Aan,j','D.6','VERIFIED'],['3','Sức trượt giới hạn','','D.5 chưa máy hóa; Qan,j,0 phải nhập từ nguồn đã đối chiếu.','D.5','SAFETY GATE'],['4','Kiểm tương tác','','Q/Q0+N/N0≤1','D.1','VERIFIED']]);
    source.addRows([['D.1–D.6','','','Trang chuẩn 160–161 / PDF 158–159','TCVN 5574:2018','VERIFIED BRANCH'],['D.7','','','Trang chuẩn 162 / PDF 160','TCVN 5574:2018','VERIFIED'],['D.5','','','Biểu thức extraction chưa đủ rõ; không tự bịa.','TCVN 5574:2018','REVIEW INPUT']]);
  } else if(workflowId==='5574-annex-l'){
    const type=addInput(ws,'Dạng',input.type??'t-tension','-','rectangle / t-compression / t-tension','Bảng L.1');const bf=addInput(ws,'bf',input.bf??900,'mm','Bề rộng cánh');const b=addInput(ws,'b',input.b??300,'mm','Bề rộng sườn');const hf=addInput(ws,'hf',input.hf??50,'mm','Chiều dày cánh');const h=addInput(ws,'h',input.h??500,'mm','Chiều cao');
    const g=addFormula(ws,'γ',`IF(B${type}="rectangle",1.3,IF(B${type}="t-compression",1.3,IF(B${type}="t-tension",IF(OR(B${bf}<=2*B${b},B${hf}/B${h}>=0.2),1.25,1.2),NA())))`,'-','Chỉ Bảng L.1 mục 1–3 đã Verified','Bảng L.1');
    explain.addRows([['1','Chữ nhật','','γ=1,30','Bảng L.1 mục 1','VERIFIED'],['2','Chữ T cánh nén','','γ=1,30','Bảng L.1 mục 2','VERIFIED'],['3','Chữ T cánh kéo','','bf≤2b →1,25; bf>2b xét hf/h 0,2 →1,25/1,20','Bảng L.1 mục 3','VERIFIED'],['4','Hình dạng khác','','Không tự tính trong pass này.','Bảng L.1','LOCKED']]);
    source.addRow(['Bảng L.1 mục 1–3','','','Trang chuẩn 179 / PDF 177','TCVN 5574:2018','VERIFIED PARTIAL']);
  } else {
    const L=addInput(ws,'L',input.L??input.span??6,'m','Nhịp/chiều dài');const cant=addInput(ws,'Công xôn?',input.cantilever?'Có':'Không','Có/Không','Generic M.4.1.3');const p=addInput(ws,'p',input.p??1.5,'kPa','M.2');const p1=addInput(ws,'p1',input.p1??0.2,'kPa','M.2');const q=addInput(ws,'q',input.q??3,'kPa','M.2');const nh=addInput(ws,'n',input.n??2,'Hz','M.2');const bc=addInput(ws,'b',input.b??50,'-','M.2');const group=addInput(ws,'Nhóm cần trục',input.group??'A4-A6','-','M.3');const member=addInput(ws,'Cấu kiện',input.member??'indoor-column','-','indoor-column/outdoor-column/beam');const hh=addInput(ws,'h/hs',input.h??input.hs??12,'m','M.3/M.4');const drift=addInput(ws,'Loại M.4',input.type??'multistory','-','multistory/story-brick/story-ceramic/single-story');const link=addInput(ws,'Liên kết',input.connection??'soft','soft/rigid','M.4');
    const gen=addFormula(ws,'fu generic',`B${L}*1000/IF(B${cant}="Có",75,150)`,'mm','M.4.1.3','M.4.1.3');
    const psy=addFormula(ws,'fu M.2',`1000*9.81*(B${p}+B${p1}+B${q})/(30*B${nh}^2*B${bc}*(B${p1}+B${q}))`,'mm','Tâm sinh lý','M.2');
    const m3=addFormula(ws,'fu M.3',`MAX(6,IF(B${member}="beam",B${L}*1000/IF(B${group}="A7-A8",2000,IF(B${group}="A4-A6",1000,500)),B${hh}*1000/IF(B${member}="outdoor-column",IF(B${group}="A7-A8",2500,IF(B${group}="A4-A6",2000,1500)),IF(B${group}="A7-A8",2000,IF(B${group}="A4-A6",1000,500)))))`,'mm','Không nhỏ hơn 6 mm','Bảng M.3');
    const m4=addFormula(ws,'fu M.4',`IF(B${drift}="multistory",B${hh}*1000/500,IF(B${drift}="story-brick",B${hh}*1000/IF(B${link}="rigid",500,300),IF(B${drift}="story-ceramic",B${hh}*1000/700,IF(B${drift}="single-story",B${hh}*1000/IF(B${hh}<=6,150,IF(B${hh}<=15,150+(B${hh}-6)*50/9,IF(B${hh}<30,200+(B${hh}-15)*100/15,300))),NA()))))`,'mm','Chuyển vị cấu tạo','Bảng M.4');
    explain.addRows([['1','M.4.1.3','','Trường hợp không nêu riêng: L/150 hoặc công xôn/75.','M.4.1.3','VERIFIED'],['2','M.2','','Giới hạn tâm sinh lý từ p,p1,q,n,b.','M.2 + Bảng M.2','VERIFIED'],['3','M.3','','Cần trục: hệ số theo nhóm, tối thiểu 6 mm.','Bảng M.3','VERIFIED'],['4','M.4','','Chuyển vị ngang cấu tạo theo loại tường/nhà.','Bảng M.4','VERIFIED']]);
    source.addRows([['M.4.1.3','','','Trang chuẩn 185 / PDF 183','TCVN 5574:2018','VERIFIED'],['M.2 + Bảng M.2','','','Trang chuẩn 188 / PDF 186','TCVN 5574:2018','VERIFIED'],['Bảng M.3','','','Trang chuẩn 189 / PDF 187','TCVN 5574:2018','VERIFIED'],['Bảng M.4','','','Trang chuẩn 190 / PDF 188','TCVN 5574:2018','VERIFIED']]);
  }
  addImageInputProvenance(wb,input.imageProvenance);
  for(const sh of wb.worksheets){sh.eachRow(r=>r.eachCell(c=>{c.alignment={vertical:'top',wrapText:true};}));}
  const buf=await wb.xlsx.writeBuffer(); saveBlob(buf,`HNL_TCVN5574_${safeName(workflowId)}_v1.25.6.xlsx`);
}

export async function export5574WorkflowWorkbook(workflowId, input={}) {
  if(['5574-annex-d','5574-annex-l','5574-annex-m'].includes(workflowId)) return export5574AnnexDLMWorkbook(workflowId,input);
  const mod=await import('exceljs'); const ExcelJS=mod.default || mod; const wb=new ExcelJS.Workbook();
  wb.creator='HNL Pile Standards AI'; wb.created=new Date(); wb.calcProperties={fullCalcOnLoad:true,forceFullCalc:true,calcMode:'auto'};
  const navy='FF17365D', green='FF548235', pale='FFE2F0D9', yellow='FFFFF2CC', orange='FFFCE4D6', gray='FFF2F2F2', white='FFFFFFFF';
  const border={top:{style:'thin',color:{argb:'FFD9E1F2'}},left:{style:'thin',color:{argb:'FFD9E1F2'}},bottom:{style:'thin',color:{argb:'FFD9E1F2'}},right:{style:'thin',color:{argb:'FFD9E1F2'}}};
  const fmt=(ws,widths=[])=>{ws.views=[{state:'frozen',ySplit:3}]; widths.forEach((w,i)=>ws.getColumn(i+1).width=w); ws.eachRow(r=>r.eachCell(c=>{c.alignment={vertical:'top',wrapText:true}; c.border=border;}));};
  const title=(ws,text,last='H')=>{ws.mergeCells(`A1:${last}1`); const c=ws.getCell('A1'); c.value=text;c.font={bold:true,size:16,color:{argb:white}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:navy}};c.alignment={vertical:'middle',horizontal:'left'};ws.getRow(1).height=26;};
  const head=(row,color=green)=>{row.font={bold:true,color:{argb:white}};row.fill={type:'pattern',pattern:'solid',fgColor:{argb:color}};row.alignment={vertical:'middle',wrapText:true};};
  const inCell=c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:yellow}};c.font={color:{argb:'FF7F6000'}};};
  const formulaCell=c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:pale}};};
  const resultCell=c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFC6E0B4'}};c.font={bold:true,size:12};};
  const note='Ô vàng = INPUT. Ô xanh nhạt = công thức Excel. Thay INPUT → Excel tự tính lại. Không sửa bảng nguồn nếu không chủ động chuyển thành nhập tay.';

  const dash=wb.addWorksheet('00_TONG_QUAN'); title(dash,'HNL · TCVN 5574:2018 · WORKFLOW VERIFIED – v1.25.6','H');
  dash.addRow([]); dash.addRow(['Mục','Nội dung','','','','','','']); head(dash.getRow(3));
  const wfTitles={'5574-material':'Vật liệu bê tông/cốt thép','5574-bending-rect':'Uốn tiết diện chữ nhật/T/I','5574-eccentric':'Nén lệch tâm tiết diện chữ nhật','5574-shear':'Lực cắt','5574-torsion':'Xoắn thuần','5574-local':'Nén cục bộ','5574-punch':'Chọc thủng','5574-crack':'Nứt – uốn chữ nhật','5574-deformation':'Biến dạng/độ võng – không nứt/có nứt/trượt','5574-prestress':'Ứng suất trước – CT214 ma sát + CT216 từ biến','5574-anchorage':'Neo cốt thép – CT255–258','5574-lap-splice':'Nối chồng cốt thép – CT259','5574-circular':'Cột tiết diện tròn/vành khuyên – Phụ lục F','5574-annex-g':'Phụ lục G – Chốt bê tông','5574-corbel':'Phụ lục H – Công xôn ngắn'}; const wfTitle=wfTitles[workflowId]||workflowId;
  dash.addRows([
    ['Workflow',wfTitle],['Trạng thái','VERIFIED – Calculation Engine + Excel formula'],['Tiêu chuẩn','TCVN 5574:2018'],['Cách dùng',note],['Luồng kiểm tra','1. Nhập dữ liệu → 2. Tra vật liệu → 3. Kiểm điều kiện áp dụng → 4. Tính từng bước → 5. So sánh sức kháng/nội lực → 6. Đọc nguồn.'],['Nguyên tắc an toàn','Nếu bài toán vượt nhánh Verified hoặc thiếu dữ liệu, HNL phải dừng; không tự sáng tác công thức.']
  ]); fmt(dash,[24,92,4,4,4,4,4,4]); dash.getColumn(1).font={bold:true};

  const inp=wb.addWorksheet('01_INPUT'); title(inp,'01 · DỮ LIỆU ĐẦU VÀO','F'); inp.addRow([]); inp.addRow(['Thông số','Giá trị','Đơn vị','Ý nghĩa','Nguồn','Trạng thái']); head(inp.getRow(3)); fmt(inp,[24,18,14,52,30,16]);
  const inputRows={}; const addInput=(name,value,unit,meaning,source='Đề bài')=>{const r=inp.addRow([name,value??'',unit,meaning,source,'INPUT']); inCell(r.getCell(2)); inputRows[name]=r.number; return r.number;};
  const grade=String(input.grade||'B30').toUpperCase(), steel=String(input.steel||'CB400-V').toUpperCase();
  addInput('Cấp bê tông',grade,'-','Chọn cấp độ bền chịu nén bê tông nặng','Bảng 7/10'); addInput('Loại thép',steel,'-','Cốt thép thanh','Bảng 13/14');
  inp.getCell(`B${inputRows['Cấp bê tông']}`).dataValidation={type:'list',allowBlank:false,formulae:['"B3.5,B5,B7.5,B10,B12.5,B15,B20,B25,B30,B35,B40,B45,B50,B55,B60,B70,B80,B90,B100"']};
  inp.getCell(`B${inputRows['Loại thép']}`).dataValidation={type:'list',allowBlank:false,formulae:['"CB240-T,CB300-T,CB300-V,CB400-V,CB500-V"']};
  if(workflowId==='5574-bending-rect' || workflowId==='5574-eccentric'){
    addInput('b',input.b??300,'mm','Bề rộng sườn/tiết diện');
    if(workflowId==='5574-bending-rect' && (input.bf!=null||input.hf!=null)){addInput("bf'",input.bf??600,'mm','Bề rộng cánh nén');addInput("hf'",input.hf??120,'mm','Chiều dày cánh nén');}
    if(workflowId==='5574-eccentric') addInput('h',input.h??500,'mm','Chiều cao toàn tiết diện');
    addInput('h0',input.h0??450,'mm','Chiều cao làm việc'); addInput('As',input.As??1800,'mm²','Cốt thép S'); addInput("As'",input.Asp??0,'mm²','Cốt thép S′'); addInput("a'",input.ap??40,'mm','Khoảng cách từ biên nén đến trọng tâm S′'); addInput('M',input.M??200,'kN.m','Mô men uốn do ngoại lực');
    if(workflowId==='5574-eccentric'){
      addInput('N',input.N??1200,'kN','Lực nén dọc'); addInput('L',input.L??3,'m','Chiều dài cấu kiện để xác định ea'); addInput('Hệ tĩnh định?',input.determinate?'Có':'Không','Có/Không','Có → e0=e_tĩnh+ea; Không → e0=max(e_tĩnh,ea)');
      addInput('L0',input.L0??'','mm','Chiều dài tính toán; để trống → η=1'); addInput('I',input.I??'','mm⁴','Mô men quán tính bê tông'); addInput('Is',input.Is??'','mm⁴','Mô men quán tính toàn bộ cốt thép dọc'); addInput('ML',input.ML??'','kN.m','Mô men do tải toàn phần'); addInput('ML1',input.ML1??'','kN.m','Mô men do tải dài hạn');
    }
  } else if(workflowId==='5574-shear'){
    addInput('b',input.b??300,'mm','Bề rộng tiết diện'); addInput('h0',input.h0??450,'mm','Chiều cao làm việc'); addInput('Q',input.Q??200,'kN','Lực cắt'); addInput('Asw',input.Asw??100,'mm²','Diện tích cốt đai trong một bước'); addInput('sw',input.sw??150,'mm','Bước cốt đai'); addInput('a',input.a??'','mm','Khoảng cách tiết diện đến gối; tùy chọn');
  } else if(workflowId==='5574-torsion'){
    addInput('b',input.b??300,'mm','Cạnh nhỏ'); addInput('h',input.h??500,'mm','Cạnh lớn'); addInput('T',input.T??30,'kN.m','Mô men xoắn'); addInput('Asw1',input.Asw1??250,'mm²','Cốt thép ngang ở biên xét'); addInput('sw',input.sw??150,'mm','Bước cốt ngang'); addInput('As1',input.As1??1000,'mm²','Cốt thép dọc ở biên xét'); addInput('Z1',input.Z1??260,'mm','Chiều dài cạnh biên chịu kéo'); addInput('Z2',input.Z2??460,'mm','Cạnh còn lại');
  } else if(workflowId==='5574-local'){
    addInput('N',input.N??1000,'kN','Lực nén cục bộ'); addInput('AbLoc',input.AbLoc??40000,'mm²','Diện tích chịu nén cục bộ'); addInput('AbMax',input.AbMax??160000,'mm²','Diện tích tính toán lớn nhất'); addInput('psi',input.psi??1,'-','1,0 tải đều; 0,75 tải không đều');
  } else if(workflowId==='5574-punch'){
    addInput('F',input.F??500,'kN','Lực tập trung'); addInput('u',input.u??3000,'mm','Chu vi đường bao tính toán'); addInput('h0',input.h0??180,'mm','Chiều cao làm việc quy đổi'); addInput('Asw',input.Asw??0,'mm²','Cốt thép ngang trong một bước'); addInput('sw',input.sw??150,'mm','Bước cốt ngang');
  } else if(workflowId==='5574-crack'){
    addInput('b',input.b??300,'mm','Bề rộng tiết diện chữ nhật'); addInput('h',input.h??500,'mm','Chiều cao toàn tiết diện'); addInput('h0',input.h0??450,'mm','Chiều cao làm việc'); addInput('As',input.As??1800,'mm²','Cốt thép chịu kéo'); addInput("As'",input.Asp??0,'mm²','Cốt thép chịu nén'); addInput('a',input.a??50,'mm','Khoảng cách từ biên kéo đến trọng tâm As'); addInput("a'",input.ap??40,'mm','Khoảng cách từ biên nén đến As′'); addInput('M',input.M??180,'kN.m','Mô men SLS'); addInput('ds',input.ds??20,'mm','Đường kính cốt thép chịu kéo'); addInput('Abt',input.Abt??60000,'mm²','Diện tích bê tông vùng chịu kéo dùng CT174'); addInput('Dài hạn?',String(input.duration||'short').includes('long')?'Có':'Không','Có/Không','Chọn φ1=1,4 hoặc 1,0'); addInput('Hạn chế thấm?',input.watertight?'Có':'Không','Có/Không','Có → Bảng 17 hàng hạn chế thấm');
  } else if(workflowId==='5574-deformation'){
    addInput('L',input.L??6,'m','Nhịp cấu kiện'); addInput('b',input.b??300,'mm','Bề rộng'); addInput('h',input.h??500,'mm','Chiều cao'); addInput('h0',input.h0??450,'mm','Chiều cao làm việc'); addInput('As',input.As??1800,'mm²','Cốt thép kéo'); addInput('a',input.a??50,'mm','Biên kéo đến trọng tâm As'); addInput('Mmax',input.MTotal??input.Mmax??120,'kN.m','Mô men toàn phần'); addInput('M dài hạn',input.MLong??0,'kN.m','Mô men thường xuyên+dài hạn'); addInput('w',input.wKnM??'','kN/m','Tải đều cho biến dạng trượt'); addInput('Trạng thái nứt trượt',input.crackState??'','none/diagonal/normal/both','CT182–184; để trống chỉ khi CT184 không phát hiện nứt xiên'); addInput('Mx trượt',input.MxKnM??'','kN.m','Dùng CT183 khi normal/both'); addInput('(1/r)x trượt',input.curvaturePerMm??'','1/mm','Dùng CT183 khi normal/both'); addInput('Ired trượt',input.Ired??'','mm⁴','Dùng CT183 khi normal/both'); addInput('sCoef',input.sCoef??(5/48),'-','Hệ số sơ đồ tải CT180'); addInput('Độ ẩm',input.humidity??60,'%','Độ ẩm để tra Bảng 9/11'); addInput('Có nứt?',input.MTotal!=null?'Có':'Không','Có/Không','Có → CT186,193–204'); addInput('Dài hạn?',input.longTerm?'Có':'Không','Có/Không','Dùng từ biến');
  } else if(workflowId==='5574-prestress'){
    addInput('sigmaSp',input.sigmaSp??900,'MPa','Ứng suất trước ban đầu'); addInput('Rsn',input.Rsn??1200,'MPa','Cường độ tiêu chuẩn thép ứng suất trước'); addInput('Asp',input.Asp??1000,'mm²','Diện tích cốt thép ứng suất trước'); addInput('deltaT',input.deltaT??0,'°C','Chênh lệch nhiệt độ CT211'); addInput('n',input.n??1,'-','Số nhóm căng không đồng thời'); addInput('dLForm',input.dLForm??0,'mm','Dịch chuyển bệ căng'); addInput('LForm',input.LForm??10000,'mm','Khoảng cách bệ căng'); addInput('dLAnchor',input.dLAnchor??2,'mm','Biến dạng neo'); addInput('LAnchor',input.LAnchor??10000,'mm','Chiều dài tính neo'); addInput('epsShrink',input.epsShrink??0.0002,'-','Biến dạng co ngót'); addInput('creepLoss',input.creepLoss??'','MPa','Override CT216; để trống nếu đủ dữ liệu chi tiết'); addInput('x ma sát',input.friction?.xM??'','m','χ trong CT214'); addInput('theta',input.friction?.thetaRad??'','rad','θ trong CT214'); addInput('Bề mặt',input.friction?.surface??'metal-duct','-','Bảng 18'); addInput('Loại thép ma sát',input.steelType??input.friction?.steelType??'cable','cable/bar','Bảng 18: δ khác cáp/dây và thép thanh'); addInput('Nhiệt luyện?',input.creep?.heatTreated?'Có':'Không','Có/Không','CT216: thép nhiệt luyện nhân 0,85'); addInput('sigmaBpj',input.creep?.sigmaBpj??'','MPa','Ứng suất bê tông tại thép j'); addInput('ysj',input.creep?.ysj??'','mm','Tọa độ nhóm thép'); addInput('Ared',input.creep?.Ared??'','mm²','Diện tích quy đổi'); addInput('Ired',input.creep?.Ired??'','mm⁴','Mô men quán tính quy đổi'); addInput('A bê tông',input.creep?.A??'','mm²','Diện tích bê tông'); addInput('Aspj',input.creep?.Aspj??'','mm²','Diện tích thép nhóm j'); addInput('Độ ẩm',input.creep?.humidity??60,'%','Bảng 11');
  } else if(workflowId==='5574-anchorage'){
    const ds=input.ds??20, As=input.As??Math.PI*ds*ds/4;
    addInput('ds',ds,'mm','Đường kính danh nghĩa thanh neo'); addInput('As',As,'mm²','Diện tích thanh được neo'); addInput('As,cal',input.AsCal??As,'mm²','Diện tích cốt thép yêu cầu theo tính toán'); addInput('As,ef',input.AsEf??As,'mm²','Diện tích cốt thép thực bố trí'); addInput('alpha',input.alpha??1,'-','Hệ số kể phương pháp neo và trạng thái ứng suất; phải có căn cứ'); addInput('Loại bề mặt',input.barType??'hotRibbed','-','plain/coldRibbed/hotRibbed'); addInput('Ls',input.Ls??'','mm','Chiều dài neo thực tế nếu muốn tính Ns theo CT258');
    inp.getCell(`B${inputRows['Loại bề mặt']}`).dataValidation={type:'list',allowBlank:false,formulae:['"plain,coldRibbed,hotRibbed"']};
  } else if(workflowId==='5574-lap-splice'){
    const ds=input.ds??20, As=input.As??Math.PI*ds*ds/4;
    addInput('ds',ds,'mm','Đường kính thanh nối chồng; chỉ áp dụng d≤40 mm'); addInput('As',As,'mm²','Diện tích thanh'); addInput('As,cal',input.AsCal??As,'mm²','Diện tích cốt thép yêu cầu'); addInput('As,ef',input.AsEf??As,'mm²','Diện tích cốt thép thực bố trí'); addInput('Trạng thái',String(input.stress||'tension').toLowerCase().includes('comp')?'Compression':'Tension','Tension/Compression','α=1,2 kéo; α=0,9 nén cho nối chồng thông thường'); addInput('Loại bề mặt',input.barType??'hotRibbed','-','plain/coldRibbed/hotRibbed');
    inp.getCell(`B${inputRows['Trạng thái']}`).dataValidation={type:'list',allowBlank:false,formulae:['"Tension,Compression"']}; inp.getCell(`B${inputRows['Loại bề mặt']}`).dataValidation={type:'list',allowBlank:false,formulae:['"plain,coldRibbed,hotRibbed"']};
  } else if(workflowId==='5574-circular'){
    const annular=input.r1!=null||input.r2!=null;
    addInput('Dạng tiết diện',annular?'Vành khuyên':'Tròn','-','Tự chọn theo input r1/r2');
    if(annular){addInput('r1',input.r1??200,'mm','Bán kính trong');addInput('r2',input.r2??350,'mm','Bán kính ngoài');}
    else addInput('r',input.r??300,'mm','Bán kính tiết diện tròn');
    addInput('rs',input.rs??(annular?300:250),'mm','Bán kính đường tròn qua trọng tâm cốt dọc'); addInput('As,tot',input.AsTot??3000,'mm²','Tổng diện tích cốt thép dọc'); addInput('N',input.N??2000,'kN','Lực nén dọc'); addInput('M',input.M??300,'kN.m','Mô men đã kể ảnh hưởng uốn dọc'); addInput('Số thanh',input.bars??8,'thanh','Tối thiểu 7 và phân bố đều theo chu vi');
  } else if(workflowId==='5574-annex-g'){
    addInput('Q',input.Q??200,'kN','Lực trượt truyền qua các chốt'); addInput('Lk',input.Lk??300,'mm','Chiều dài một chốt bê tông'); addInput('nk',input.nk??2,'-','Số chốt đưa vào tính, không lớn hơn 3'); addInput('N',input.N??0,'kN','Lực nén đồng thời, dùng G.3 nếu >0');
  } else if(workflowId==='5574-corbel'){
    addInput('b',input.b??300,'mm','Bề rộng công xôn'); addInput('h0',input.h0??500,'mm','Chiều cao làm việc'); addInput('L1',input.L1??300,'mm','Chiều dài vươn công xôn'); addInput('Lsup',input.Lsup??200,'mm','Chiều dài diện tích gối tựa dùng H.1'); addInput('Q',input.Q??200,'kN','Lực cắt thiết kế'); addInput('Asw',input.Asw??157,'mm²','Diện tích cốt thép ngang trong bước sw'); addInput('sw',input.sw??150,'mm','Bước cốt ngang');
  }

  const mat=wb.addWorksheet('02_VAT_LIEU'); title(mat,'02 · BẢNG VẬT LIỆU VERIFIED','H'); mat.addRow([]); mat.addRow(['Nhóm','Cấp/loại','Rb','Rbt','Eb','Rs','Rsc','Rsw']); head(mat.getRow(3));
  const groups=structuredTablesForPack('TCVN5574_2018'); const concrete=(groups.find(g=>g.id==='5574-T7-T10')?.rows||[]); const steels=(groups.find(g=>g.id==='5574-T13-T14')?.rows||[]); const concreteSls=(groups.find(g=>g.id==='5574-T6')?.rows||[]); const steelSls=(groups.find(g=>g.id==='5574-T12')?.rows||[]);
  for(const r of concrete) mat.addRow(['Bê tông',r.grade,r.Rb,r.Rbt,r.Eb,'','','']);
  for(const r of steels) mat.addRow(['Thép',r.grade,'','','',r.Rs,r.Rsc,r.Rsw]); fmt(mat,[16,18,14,14,16,14,14,14]);
  mat.getCell('J3').value='Bảng 6';mat.getCell('K3').value='Cấp bê tông';mat.getCell('L3').value='Rb,ser';mat.getCell('M3').value='Rbt,ser'; for(const a of ['J3','K3','L3','M3']){mat.getCell(a).fill={type:'pattern',pattern:'solid',fgColor:{argb:green}};mat.getCell(a).font={bold:true,color:{argb:white}};} let sr=4; for(const r of concreteSls){mat.getCell(`J${sr}`).value='Bảng 6';mat.getCell(`K${sr}`).value=r.grade;mat.getCell(`L${sr}`).value=r.RbSer;mat.getCell(`M${sr}`).value=r.RbtSer;sr++;}
  mat.getCell('P3').value='Bảng 12';mat.getCell('Q3').value='Loại thép';mat.getCell('R3').value='Rs,ser'; for(const a of ['P3','Q3','R3']){mat.getCell(a).fill={type:'pattern',pattern:'solid',fgColor:{argb:green}};mat.getCell(a).font={bold:true,color:{argb:white}};} sr=4; for(const r of steelSls){mat.getCell(`P${sr}`).value='Bảng 12';mat.getCell(`Q${sr}`).value=r.grade;mat.getCell(`R${sr}`).value=r.RsSer;sr++;}
  const creep11=[['B10',2.8,3.9,5.6],['B15',2.4,3.4,4.8],['B20',2.0,2.8,4.0],['B25',1.8,2.5,3.6],['B30',1.6,2.3,3.2],['B35',1.5,2.1,3.0],['B40',1.4,1.9,2.8],['B45',1.3,1.8,2.6],['B50',1.2,1.6,2.4],['B55',1.1,1.5,2.2],['B60',1.0,1.4,2.0]]; mat.getCell('U3').value='Bảng 11';mat.getCell('V3').value='>75%';mat.getCell('W3').value='40–75%';mat.getCell('X3').value='<40%';for(const a of ['U3','V3','W3','X3']){mat.getCell(a).fill={type:'pattern',pattern:'solid',fgColor:{argb:green}};mat.getCell(a).font={bold:true,color:{argb:white}};} sr=4;for(const r of creep11){mat.getCell(`U${sr}`).value=r[0];mat.getCell(`V${sr}`).value=r[1];mat.getCell(`W${sr}`).value=r[2];mat.getCell(`X${sr}`).value=r[3];sr++;}
  mat.addRow([]); const mr=mat.addRow(['GIÁ TRỊ DÙNG TÍNH','','','','','','','']); head(mr,navy);
  const mstart=mr.number+1;
  const gi=`'01_INPUT'!B${inputRows['Cấp bê tông']}`, si=`'01_INPUT'!B${inputRows['Loại thép']}`;
  const phi11=(humRef)=>`IF(${humRef}>75,INDEX('02_VAT_LIEU'!V4:V14,MATCH(IF(VALUE(SUBSTITUTE(${gi},"B",""))>=60,"B60",${gi}),'02_VAT_LIEU'!U4:U14,0)),IF(${humRef}>=40,INDEX('02_VAT_LIEU'!W4:W14,MATCH(IF(VALUE(SUBSTITUTE(${gi},"B",""))>=60,"B60",${gi}),'02_VAT_LIEU'!U4:U14,0)),INDEX('02_VAT_LIEU'!X4:X14,MATCH(IF(VALUE(SUBSTITUTE(${gi},"B",""))>=60,"B60",${gi}),'02_VAT_LIEU'!U4:U14,0))))`;
  const vals=[['Rb',`=INDEX(C4:C${3+concrete.length},MATCH(${gi},B4:B${3+concrete.length},0))`,'MPa','Bảng 7'],['Rbt',`=INDEX(D4:D${3+concrete.length},MATCH(${gi},B4:B${3+concrete.length},0))`,'MPa','Bảng 7'],['Eb',`=INDEX(E4:E${3+concrete.length},MATCH(${gi},B4:B${3+concrete.length},0))`,'MPa','Bảng 10'],['Rs',`=INDEX(F${4+concrete.length}:F${3+concrete.length+steels.length},MATCH(${si},B${4+concrete.length}:B${3+concrete.length+steels.length},0))`,'MPa','Bảng 13'],['Rsc',`=INDEX(G${4+concrete.length}:G${3+concrete.length+steels.length},MATCH(${si},B${4+concrete.length}:B${3+concrete.length+steels.length},0))`,'MPa','Bảng 13'],['Rsw',`=INDEX(H${4+concrete.length}:H${3+concrete.length+steels.length},MATCH(${si},B${4+concrete.length}:B${3+concrete.length+steels.length},0))`,'MPa','Bảng 14'],['Es','=200000','MPa','6.2.3.3'],['RbSer',`=INDEX(L4:L${3+concreteSls.length},MATCH(${gi},K4:K${3+concreteSls.length},0))`,'MPa','Bảng 6'],['RbtSer',`=INDEX(M4:M${3+concreteSls.length},MATCH(${gi},K4:K${3+concreteSls.length},0))`,'MPa','Bảng 6'],['RsSer',`=INDEX(R4:R${3+steelSls.length},MATCH(${si},Q4:Q${3+steelSls.length},0))`,'MPa','Bảng 12']];
  const matCells={}; vals.forEach(v=>{const r=mat.addRow([v[0],{formula:v[1].slice(1)},v[2],v[3]]); formulaCell(r.getCell(2));matCells[v[0]]=r.number;});

  const calc=wb.addWorksheet('03_TINH_TOAN'); title(calc,'03 · DIỄN GIẢI TỪNG BƯỚC','G'); calc.addRow([]); calc.addRow(['Bước','Ký hiệu','Công thức/logic','Kết quả','Đơn vị','Kiểm tra','Nguồn']); head(calc.getRow(3)); fmt(calc,[9,18,68,20,14,22,38]);
  const ref=n=>`'01_INPUT'!B${inputRows[n]}`, mref=n=>`'02_VAT_LIEU'!B${matCells[n]}`; let finalRow=null, demandRow=null;
  const addCalc=(step,sym,formula,unit,check,source,description='')=>{const r=calc.addRow([step,sym,description||`=${formula}`,{formula},unit,check,source]);formulaCell(r.getCell(4));return r.number;};
  if(workflowId==='5574-material'){
    let st=1; for(const n of ['Rb','Rbt','Eb','Rs','Rsc','Rsw','Es']) addCalc(st++,n,mref(n).replace(/^=/,''),n==='Es'||n==='Eb'||!['Rb','Rbt','Rs','Rsc','Rsw'].includes(n)?'MPa':'MPa','VERIFIED',n==='Rsw'?'Bảng 14':n==='Eb'?'Bảng 10':n==='Rs'||n==='Rsc'?'Bảng 13':'Bảng 7');
  } else if(workflowId==='5574-bending-rect'){
    const high=`IF(VALUE(SUBSTITUTE(${gi},"B",""))>=70,0.7,0.8)`; const eps=`IF(VALUE(SUBSTITUTE(${gi},"B",""))<=60,0.0035,IF(VALUE(SUBSTITUTE(${gi},"B",""))>=100,0.0028,0.0033+(VALUE(SUBSTITUTE(${gi},"B",""))-70)*(0.0028-0.0033)/30))`;
    const epsr=addCalc(1,'εs,el',`${mref('Rs')}/${mref('Es')}`,'-','', 'CT (32)','Biến dạng đàn hồi cốt thép khi đạt Rs');
    const xir=addCalc(2,'ξR',`${high}/(1+D${epsr}/${eps})`,'-','Giới hạn vùng nén','CT (31)','Giới hạn chiều cao tương đối vùng nén');
    const isT=inputRows["bf'"]!=null;
    let xr;
    if(isT){
      const flange=addCalc(3,'Kiểm cánh',`IF(${mref('Rs')}*${ref('As')}<=${mref('Rb')}*${ref("bf'")}*${ref("hf'")}+${mref('Rsc')}*${ref("As'")},1,0)`,'1/0','1 = vùng nén trong cánh','CT (36)','Xác định vùng nén chỉ trong cánh hay xuống sườn');
      xr=addCalc(4,'x',`IF(D${flange}=1,(${mref('Rs')}*${ref('As')}-${mref('Rsc')}*${ref("As'")})/(${mref('Rb')}*${ref("bf'")}),(${mref('Rs')}*${ref('As')}-${mref('Rsc')}*${ref("As'")}-${mref('Rb')}*(${ref("bf'")}-${ref('b')})*${ref("hf'")})/(${mref('Rb')}*${ref('b')}))`,'mm','','CT (35)/(38)','Chiều cao vùng bê tông chịu nén');
      const xiratio=addCalc(5,'ξ',`D${xr}/${ref('h0')}`,'-','≤ ξR','8.1.2.2.3');
      finalRow=addCalc(6,'Mu',`IF(D${flange}=1,(${mref('Rb')}*${ref("bf'")}*D${xr}*(${ref('h0')}-0.5*D${xr})+${mref('Rsc')}*${ref("As'")}*(${ref('h0')}-${ref("a'")}))/1000000,(${mref('Rb')}*${ref('b')}*D${xr}*(${ref('h0')}-0.5*D${xr})+${mref('Rb')}*(${ref("bf'")}-${ref('b')})*${ref("hf'")}*(${ref('h0')}-0.5*${ref("hf'")})+${mref('Rsc')}*${ref("As'")}*(${ref('h0')}-${ref("a'")}))/1000000)`,'kN.m',`=IF(D${xiratio}<=D${xir},"TRONG MIỀN","NGOÀI MIỀN")`,'CT (34)/(37)');
    } else {
      xr=addCalc(3,'x',`(${mref('Rs')}*${ref('As')}-${mref('Rsc')}*${ref("As'")})/(${mref('Rb')}*${ref('b')})`,'mm','','CT (35)','Cân bằng lực để xác định vùng nén');
      const xiratio=addCalc(4,'ξ',`D${xr}/${ref('h0')}`,'-','≤ ξR','8.1.2.2.3');
      finalRow=addCalc(5,'Mu',`(${mref('Rb')}*${ref('b')}*D${xr}*(${ref('h0')}-0.5*D${xr})+${mref('Rsc')}*${ref("As'")}*(${ref('h0')}-${ref("a'")}))/1000000`,'kN.m',`=IF(D${xiratio}<=D${xir},"TRONG MIỀN","NGOÀI MIỀN")`,'CT (34)','Mô men giới hạn tiết diện');
    }
    demandRow=addCalc(7,'M',`${ref('M')}`,'kN.m','Nội lực thiết kế','Đề bài');
    const chk=addCalc(8,'M/Mu',`D${demandRow}/D${finalRow}`,'-','≤1,0','CT (33)','Hệ số sử dụng'); resultCell(calc.getCell(chk,4));
  } else if(workflowId==='5574-eccentric'){
    const high=`IF(VALUE(SUBSTITUTE(${gi},"B",""))>=70,0.7,0.8)`; const eps=`IF(VALUE(SUBSTITUTE(${gi},"B",""))<=60,0.0035,IF(VALUE(SUBSTITUTE(${gi},"B",""))>=100,0.0028,0.0033+(VALUE(SUBSTITUTE(${gi},"B",""))-70)*(0.0028-0.0033)/30))`;
    const epsr=addCalc(1,'εs,el',`${mref('Rs')}/${mref('Es')}`,'-','','CT (32)'); const xir=addCalc(2,'ξR',`${high}/(1+D${epsr}/${eps})`,'-','','CT (31)');
    const ea=addCalc(3,'ea',`MAX(${ref('L')}*1000/600,${ref('h')}/30,10)`,'mm','ngẫu nhiên','8.1.2.2.4'); const estat=addCalc(4,'e_tĩnh',`${ref('M')}*1000000/(${ref('N')}*1000)`,'mm','','M/N');
    const e0=addCalc(5,'e0',`IF(${ref('Hệ tĩnh định?')}="Có",D${estat}+D${ea},MAX(D${estat},D${ea}))`,'mm','','8.1.2.2.4');
    const phi=addCalc(6,'φL',`IF(AND(ISNUMBER(${ref('ML')}),${ref('ML')}<>0,ISNUMBER(${ref('ML1')})),MIN(2,1+${ref('ML1')}/${ref('ML')}),1)`,'-','≤2','CT (48)'); const de=addCalc(7,'δe',`MAX(0.15,MIN(1.5,D${e0}/${ref('h')}))`,'-','0,15…1,5','8.1.2.4.2'); const kb=addCalc(8,'kb',`0.15/(D${phi}*(0.3+D${de}))`,'-','','CT (47)');
    const Drow=addCalc(9,'D',`IF(AND(ISNUMBER(${ref('I')}),ISNUMBER(${ref('Is')})),D${kb}*${mref('Eb')}*${ref('I')}+0.7*${mref('Es')}*${ref('Is')},"")`,'N.mm²','Nếu có I, Is','CT (46)'); const ncr=addCalc(10,'Ncr',`IF(AND(ISNUMBER(${ref('L0')}),${ref('L0')}>0,ISNUMBER(D${Drow})),PI()^2*D${Drow}/${ref('L0')}^2/1000,"")`,'kN','N<Ncr','CT (45)'); const eta=addCalc(11,'η',`IF(ISNUMBER(D${ncr}),1/(1-${ref('N')}/D${ncr}),1)`,'-','Nếu thiếu L0/I/Is: η=1','CT (44)');
    const e=addCalc(12,'e',`D${e0}*D${eta}+(${ref('h0')}-${ref("a'")})/2`,'mm','','CT (41)'); const x42=addCalc(13,'x42',`(${ref('N')}*1000+${mref('Rs')}*${ref('As')}-${mref('Rsc')}*${ref("As'")})/(${mref('Rb')}*${ref('b')})`,'mm','','CT (42)');
    const x=addCalc(14,'x',`IF(D${x42}/${ref('h0')}<=D${xir},D${x42},(${ref('N')}*1000+${mref('Rs')}*${ref('As')}*(1+D${xir})/(1-D${xir})-${mref('Rsc')}*${ref("As'")})/(${mref('Rb')}*${ref('b')}+2*${mref('Rs')}*${ref('As')}/(${ref('h0')}*(1-D${xir}))))`,'mm','Tự chọn CT42/43','CT (42)/(43)');
    demandRow=addCalc(15,'N·e',`${ref('N')}*1000*D${e}/1000000`,'kN.m','Vế trái','CT (40)'); finalRow=addCalc(16,'RHS',`(${mref('Rb')}*${ref('b')}*D${x}*(${ref('h0')}-0.5*D${x})+${mref('Rsc')}*${ref("As'")}*(${ref('h0')}-${ref("a'")}))/1000000`,'kN.m','Vế phải','CT (40)'); const util=addCalc(17,'η sử dụng',`D${demandRow}/D${finalRow}`,'-','≤1,0','CT (40)','Tỷ số tác động/sức kháng'); resultCell(calc.getCell(util,4));
  } else if(workflowId==='5574-shear'){
    const q=addCalc(1,'qsw',`${mref('Rsw')}*${ref('Asw')}/${ref('sw')}`,'N/mm','≥0,25Rbt·b','CT (92)/(96)'); const strip=addCalc(2,'Qstrip',`0.3*${mref('Rb')}*${ref('b')}*${ref('h0')}/1000`,'kN','CT88','CT (88)'); const qb=addCalc(3,'Qb,1',`IF(AND(ISNUMBER(${ref('a')}),${ref('a')}>0,${ref('a')}<2.5*${ref('h0')}),MIN(0.5*${mref('Rbt')}*${ref('b')}*${ref('h0')}/1000*(2.5*${ref('h0')}/${ref('a')}),2.5*${mref('Rbt')}*${ref('b')}*${ref('h0')}/1000),0.5*${mref('Rbt')}*${ref('b')}*${ref('h0')}/1000)`,'kN','','CT (94)'); const qs=addCalc(4,'Qsw,1',`IF(D${q}>=0.25*${mref('Rbt')}*${ref('b')},${mref('Rsw')}*${ref('Asw')}/${ref('sw')}*IF(AND(ISNUMBER(${ref('a')}),${ref('a')}>0,${ref('a')}<${ref('h0')}),${ref('a')},${ref('h0')})/1000,0)`,'kN','Cốt đai chỉ kể nếu CT96','CT (95)/(96)'); const qu=addCalc(5,'Qu',`D${qb}+D${qs}`,'kN','','CT (93)'); const util=addCalc(6,'Q/Qu',`MAX(${ref('Q')}/D${strip},${ref('Q')}/D${qu})`,'-','≤1,0','CT (88)/(93)'); resultCell(calc.getCell(util,4));
  } else if(workflowId==='5574-torsion'){
    const q=addCalc(1,'qsw,1',`${mref('Rsw')}*${ref('Asw1')}/${ref('sw')}`,'N/mm','','CT (107)'); const d=addCalc(2,'δ',`${ref('Z1')}/(2*${ref('Z2')}+${ref('Z1')})`,'-','','CT (109)'); const ratio=addCalc(3,'ratio',`D${q}*${ref('Z1')}/(${mref('Rs')}*${ref('As1')})`,'-','0,5…1,5','8.1.4.2.2'); const strip=addCalc(4,'Tstrip',`0.1*${mref('Rb')}*${ref('b')}^2*${ref('h')}/1000000`,'kN.m','','CT (102)'); const tsw=addCalc(5,'Tsw,1',`D${q}*D${d}*${ref('Z1')}*${ref('Z2')}/1000000`,'kN.m','','CT (112)'); const ts=addCalc(6,'Ts,1',`0.5*${mref('Rs')}*${ref('As1')}*${ref('Z2')}/1000000`,'kN.m','','CT (113)'); const tu=addCalc(7,'Tu',`D${tsw}+D${ts}`,'kN.m','','CT (111)'); const util=addCalc(8,'T/Tu',`MAX(${ref('T')}/D${strip},${ref('T')}/D${tu})`,'-','≤1 và ratio 0,5…1,5','CT (102)/(111)'); resultCell(calc.getCell(util,4));
  } else if(workflowId==='5574-local'){
    const ph=addCalc(1,'φb',`MAX(1,MIN(2.5,0.8*SQRT(${ref('AbMax')}/${ref('AbLoc')})))`,'-','1…2,5','CT (118)'); const rb=addCalc(2,'Rb,loc',`D${ph}*${mref('Rb')}`,'MPa','','CT (117)'); const nu=addCalc(3,'Nu',`${ref('psi')}*D${rb}*${ref('AbLoc')}/1000`,'kN','','CT (116)'); const util=addCalc(4,'N/Nu',`${ref('N')}/D${nu}`,'-','≤1,0','CT (116)'); resultCell(calc.getCell(util,4));
  } else if(workflowId==='5574-punch'){
    const ab=addCalc(1,'Ab',`${ref('u')}*${ref('h0')}`,'mm²','','CT (125)'); const fb=addCalc(2,'Fb,u',`${mref('Rbt')}*D${ab}/1000`,'kN','','CT (124)'); const q=addCalc(3,'qsw',`IF(${ref('Asw')}>0,${mref('Rsw')}*${ref('Asw')}/${ref('sw')},0)`,'N/mm','','CT (128)'); const raw=addCalc(4,'Fsw,u raw',`0.8*D${q}*${ref('u')}/1000`,'kN','≥0,25Fb,u để kể','CT (127)'); const fsw=addCalc(5,'Fsw,u',`IF(D${raw}>=0.25*D${fb},MIN(D${raw},D${fb}),0)`,'kN','Tổng ≤2Fb,u','8.1.6.2.2'); const fu=addCalc(6,'Fu',`D${fb}+D${fsw}`,'kN','','CT (123)/(126)'); const util=addCalc(7,'F/Fu',`${ref('F')}/D${fu}`,'-','≤1,0','CT (123)/(126)'); resultCell(calc.getCell(util,4));
  } else if(workflowId==='5574-crack'){
    const alpha=addCalc(1,'α',`${mref('Es')}/${mref('Eb')}`,'-','','CT162-164'); const Ared=addCalc(2,'Ared',`${ref('b')}*${ref('h')}+D${alpha}*(${ref('As')}+${ref("As'")})`,'mm²','','CT163'); const ybar=addCalc(3,'ybar',`(${ref('b')}*${ref('h')}*${ref('h')}/2+D${alpha}*${ref('As')}*(${ref('h')}-${ref('a')})+D${alpha}*${ref("As'")}*${ref("a'")})/D${Ared}`,'mm','','CT164'); const Ired=addCalc(4,'Ired',`${ref('b')}*${ref('h')}^3/12+${ref('b')}*${ref('h')}*(${ref('h')}/2-D${ybar})^2+D${alpha}*${ref('As')}*(${ref('h')}-${ref('a')}-D${ybar})^2+D${alpha}*${ref("As'")}*(${ref("a'")}-D${ybar})^2`,'mm⁴','','CT162'); const Mcrc=addCalc(5,'Mcrc',`1.3*(D${Ired}/(${ref('h')}-D${ybar}))*${mref('RbtSer')}/1000000`,'kN.m','','CT158-160'); const sigma=addCalc(6,'σs',`${ref('M')}*1000000/(0.8*${ref('h0')}*${ref('As')})`,'MPa','≤Rs,ser','CT170'); const Ls=addCalc(7,'Ls',`MAX(MAX(10*${ref('ds')},100),MIN(0.5*${ref('Abt')}/${ref('As')}*${ref('ds')},MIN(40*${ref('ds')},400)))`,'mm','','CT174'); const psi=addCalc(8,'ψs',`MAX(0,MIN(1,1-0.8*D${Mcrc}/${ref('M')}))`,'-','','CT176'); const acrc=addCalc(9,'acrc',`IF(${ref('Dài hạn?')}="Có",1.4,1)*0.5*D${psi}*D${sigma}/${mref('Es')}*D${Ls}`,'mm','','CT166'); const lim=addCalc(10,'acrc,u',`IF(${ref('Hạn chế thấm?')}="Có",IF(${ref('Dài hạn?')}="Có",0.2,0.3),IF(${ref('Dài hạn?')}="Có",0.3,0.4))`,'mm','','Bảng17'); const util=addCalc(11,'SLS ratio',`MAX(D${acrc}/D${lim},D${sigma}/${mref('RsSer')})`,'-','≤1','CT166+Bảng17'); resultCell(calc.getCell(util,4));
  } else if(workflowId==='5574-deformation'){
    if(input.wKnM!=null){const G=addCalc(1,'G',`0.4*${mref('Eb')}`,'MPa','','6.1.3.4');const ph=addCalc(2,'φb',`IF(${ref('Dài hạn?')}="Có",1+${phi11(ref('Độ ẩm'))},1)`,'-','','Bảng11');const qmax=addCalc(3,'Qmax',`${ref('w')}*${ref('L')}/2`,'kN','','CT184');const dcr=addCalc(4,'Nứt xiên?',`IF(D${qmax}*1000>0.5*${mref('RbtSer')}*${ref('b')}*${ref('h0')},1,0)`,'1=Có','','CT184');const pcrc=addCalc(5,'φcrc',`IF(D${dcr}=0,IF(${ref('Trạng thái nứt trượt')}="",1,IF(${ref('Trạng thái nứt trượt')}="none",1,IF(${ref('Trạng thái nứt trượt')}="diagonal",4,IF(OR(${ref('Trạng thái nứt trượt')}="normal",${ref('Trạng thái nứt trượt')}="both"),3*${mref('Eb')}*${ref('Ired trượt')}*${ref('(1/r)x trượt')}/(${ref('Mx trượt')}*1000000),NA())))),IF(${ref('Trạng thái nứt trượt')}="diagonal",4,IF(OR(${ref('Trạng thái nứt trượt')}="normal",${ref('Trạng thái nứt trượt')}="both"),3*${mref('Eb')}*${ref('Ired trượt')}*${ref('(1/r)x trượt')}/(${ref('Mx trượt')}*1000000),NA())))`,'-','CT184 có nứt xiên → phải khai trạng thái','CT182-183');const f=addCalc(6,'fq',`1.2*D${ph}*D${pcrc}/(D${G}*${ref('b')}*${ref('h0')})*(${ref('w')}*(${ref('L')}*1000)^2/8)`,'mm','Dầm tựa đơn tải đều','CT181-184');resultCell(calc.getCell(f,4));}
    else if(input.MTotal!=null){
      const rb=addCalc(1,'Rb,ser',`${mref('RbSer')}`,'MPa','','Bảng6'); const rbt=addCalc(2,'Rbt,ser',`${mref('RbtSer')}`,'MPa','','Bảng6'); const al=addCalc(3,'α',`${mref('Es')}/${mref('Eb')}`,'-','','CT162-164'); const ar=addCalc(4,'Ared',`${ref('b')}*${ref('h')}+D${al}*${ref('As')}`,'mm²','','CT163'); const y=addCalc(5,'ybar',`(${ref('b')}*${ref('h')}^2/2+D${al}*${ref('As')}*(${ref('h')}-${ref('a')}))/D${ar}`,'mm','','CT164'); const ir=addCalc(6,'Ired',`${ref('b')}*${ref('h')}^3/12+${ref('b')}*${ref('h')}*(${ref('h')}/2-D${y})^2+D${al}*${ref('As')}*(${ref('h')}-${ref('a')}-D${y})^2`,'mm⁴','','CT162'); const mc=addCalc(7,'Mcrc',`1.3*(D${ir}/(${ref('h')}-D${y}))*D${rbt}/1000000`,'kN.m','','CT158-160'); const mu=addCalc(8,'μs',`${ref('As')}/(${ref('b')}*${ref('h0')})`,'-','','CT195'); const epsL=addCalc(9,'εb1,red dài',`(IF(${ref('Độ ẩm')}>75,0.0024,IF(${ref('Độ ẩm')}>=40,0.0028,0.0034)))*IF(VALUE(SUBSTITUTE(${gi},"B",""))>=70,(270-VALUE(SUBSTITUTE(${gi},"B","")))/210,1)`,'-','','Bảng9'); const psiT=addCalc(10,'ψ tổng',`MAX(0,MIN(1,1-0.8*D${mc}/${ref('Mmax')}))`,'-','','CT176'); const psiL=addCalc(11,'ψ dài',`IF(${ref('M dài hạn')}>0,MAX(0,MIN(1,1-0.8*D${mc}/${ref('M dài hạn')})),D${psiT})`,'-','','CT176');
      const aT=addCalc(12,'α2 tổng-ngắn',`(${mref('Es')}/D${psiT})/(D${rb}/0.0015)`,'-','','CT203-204'); const xT=addCalc(13,'xm tổng',`${ref('h0')}*(SQRT((D${mu}*D${aT})^2+2*D${mu}*D${aT})-D${mu}*D${aT})`,'mm','','CT195'); const zT=addCalc(14,'z tổng',`${ref('h0')}-D${xT}/3`,'mm','','CT201'); const DT=addCalc(15,'D tổng',`(${mref('Es')}/D${psiT})*${ref('As')}*D${zT}*(${ref('h0')}-D${xT})`,'N.mm²','','CT200'); const c1=addCalc(16,'(1/r)1',`${ref('Mmax')}*1000000/D${DT}`,'1/mm','','CT187');
      const aLS=addCalc(17,'α2 dài-ngắn',`(${mref('Es')}/D${psiL})/(D${rb}/0.0015)`,'-','','CT203-204'); const xLS=addCalc(18,'xm dài-ngắn',`${ref('h0')}*(SQRT((D${mu}*D${aLS})^2+2*D${mu}*D${aLS})-D${mu}*D${aLS})`,'mm','','CT195'); const zLS=addCalc(19,'z dài-ngắn',`${ref('h0')}-D${xLS}/3`,'mm','','CT201'); const DLS=addCalc(20,'D dài-ngắn',`(${mref('Es')}/D${psiL})*${ref('As')}*D${zLS}*(${ref('h0')}-D${xLS})`,'N.mm²','','CT200'); const c2=addCalc(21,'(1/r)2',`IF(${ref('M dài hạn')}>0,${ref('M dài hạn')}*1000000/D${DLS},0)`,'1/mm','','CT187');
      const aLL=addCalc(22,'α2 dài-dài',`(${mref('Es')}/D${psiL})/(D${rb}/D${epsL})`,'-','','CT203-204'); const xLL=addCalc(23,'xm dài-dài',`${ref('h0')}*(SQRT((D${mu}*D${aLL})^2+2*D${mu}*D${aLL})-D${mu}*D${aLL})`,'mm','','CT195'); const zLL=addCalc(24,'z dài-dài',`${ref('h0')}-D${xLL}/3`,'mm','','CT201'); const DLL=addCalc(25,'D dài-dài',`(${mref('Es')}/D${psiL})*${ref('As')}*D${zLL}*(${ref('h0')}-D${xLL})`,'N.mm²','','CT200'); const c3=addCalc(26,'(1/r)3',`IF(${ref('M dài hạn')}>0,${ref('M dài hạn')}*1000000/D${DLL},0)`,'1/mm','','CT187'); const ct=addCalc(27,'1/r toàn phần',`D${c1}-D${c2}+D${c3}`,'1/mm','','CT186'); const f=addCalc(28,'f',`${ref('sCoef')}*(${ref('L')}*1000)^2*D${ct}`,'mm','So với fu','CT180'); resultCell(calc.getCell(f,4));
    }
    else {const I=addCalc(1,'I',`${ref('b')}*${ref('h')}^3/12`,'mm⁴','','CT188');const phi=addCalc(2,'φb,cr',`IF(${ref('Dài hạn?')}="Có",${phi11(ref('Độ ẩm'))},0)`,'-','','Bảng11');const Eb1=addCalc(3,'Eb1',`${mref('Eb')}/(1+D${phi})`,'MPa','','CT189');const curv=addCalc(4,'1/r',`${ref('Mmax')}*1000000/(D${Eb1}*D${I})`,'1/mm','','CT187');const f=addCalc(5,'f',`${ref('sCoef')}*(${ref('L')}*1000)^2*D${curv}`,'mm','','CT180');resultCell(calc.getCell(f,4));}
  } else if(workflowId==='5574-anchorage'){
    const eta1=addCalc(1,'η1',`IF(${ref('Loại bề mặt')}="plain",1.5,IF(${ref('Loại bề mặt')}="coldRibbed",2,2.5))`,'-','','CT256');
    const eta2=addCalc(2,'η2',`IF(${ref('ds')}<=32,1,0.9)`,'-','','CT256');
    const rbond=addCalc(3,'Rbond',`D${eta1}*D${eta2}*${mref('Rbt')}`,'MPa','','CT256');
    const us=addCalc(4,'us',`PI()*${ref('ds')}`,'mm','','CT255');
    const l0=addCalc(5,'L0,an',`${mref('Rs')}*${ref('As')}/(D${rbond}*D${us})`,'mm','','CT255');
    const raw=addCalc(6,'Lan,raw',`${ref('alpha')}*D${l0}*${ref('As,cal')}/${ref('As,ef')}`,'mm','','CT257');
    const minr=addCalc(7,'Lan,min',`MAX(15*${ref('ds')},200,0.3*D${l0})`,'mm','','10.3.5.5');
    const lan=addCalc(8,'Lan',`MAX(D${raw},D${minr})`,'mm','Chiều dài neo yêu cầu','CT257');
    const ns=addCalc(9,'Ns',`IF(ISNUMBER(${ref('Ls')}),MIN(${mref('Rs')}*${ref('As')},${mref('Rs')}*${ref('As')}*${ref('Ls')}/D${lan})/1000,"")`,'kN','Chỉ hiện nếu nhập Ls','CT258'); resultCell(calc.getCell(lan,4));
  } else if(workflowId==='5574-lap-splice'){
    const gate=addCalc(1,'d≤40?',`IF(${ref('ds')}<=40,1,0)`,'1/0','1=trong phạm vi','10.3.6.2');
    const eta1=addCalc(2,'η1',`IF(${ref('Loại bề mặt')}="plain",1.5,IF(${ref('Loại bề mặt')}="coldRibbed",2,2.5))`,'-','','CT256');
    const eta2=addCalc(3,'η2',`IF(${ref('ds')}<=32,1,0.9)`,'-','','CT256');
    const rbond=addCalc(4,'Rbond',`D${eta1}*D${eta2}*${mref('Rbt')}`,'MPa','','CT256');
    const us=addCalc(5,'us',`PI()*${ref('ds')}`,'mm','','CT255');
    const l0=addCalc(6,'L0,an',`${mref('Rs')}*${ref('As')}/(D${rbond}*D${us})`,'mm','','CT255');
    const alpha=addCalc(7,'α',`IF(${ref('Trạng thái')}="Compression",0.9,1.2)`,'-','','10.3.6.3');
    const lap=addCalc(8,'Llap',`IF(D${gate}=1,D${alpha}*D${l0}*${ref('As,cal')}/${ref('As,ef')},NA())`,'mm','Chiều dài nối chồng yêu cầu','CT259'); resultCell(calc.getCell(lap,4));
  } else if(workflowId==='5574-circular'){
    const annular=inputRows['r1']!=null;
    if(annular){
      const gate=addCalc(1,'Phạm vi',`IF(AND(${ref('r1')}/${ref('r2')}>0.5,${ref('Số thanh')}>=7),1,0)`,'1/0','1=trong phạm vi F.1','Phụ lục F.1');
      const A=addCalc(2,'A',`PI()*(${ref('r2')}^2-${ref('r1')}^2)`,'mm²','','Hình học'); const rm=addCalc(3,'rm',`(${ref('r1')}+${ref('r2')})/2`,'mm','','F.1');
      const xi=addCalc(4,'ξcir',`(${ref('N')}*1000+${mref('Rs')}*${ref('As,tot')})/(${mref('Rb')}*D${A}+(${mref('Rsc')}+1.7*${mref('Rs')})*${ref('As,tot')})`,'-','','F.1');
      const xi1=addCalc(5,'ξcir1',`(${ref('N')}*1000+0.75*${mref('Rs')}*${ref('As,tot')})/(${mref('Rb')}*D${A}+${mref('Rs')}*${ref('As,tot')})`,'-','','F.4'); const xi2=addCalc(6,'ξcir2',`${ref('N')}*1000/(${mref('Rb')}*D${A}+${mref('Rs')}*${ref('As,tot')})`,'-','','F.6');
      const mu=addCalc(7,'Mu',`IF(D${gate}=0,NA(),IF(D${xi}<=0.15,((${mref('Rb')}*D${A}*D${rm}+${mref('Rs')}*${ref('As,tot')}*${ref('rs')})*SIN(PI()*D${xi1})/PI()+0.295*${mref('Rs')}*${ref('As,tot')}*${ref('rs')})/1000000,IF(D${xi}<0.6,((${mref('Rb')}*D${A}*D${rm}+${mref('Rs')}*${ref('As,tot')}*${ref('rs')})*SIN(PI()*D${xi})/PI()+${mref('Rs')}*${ref('As,tot')}*${ref('rs')}*(1-1.7*D${xi})*(0.2+1.3*D${xi}))/1000000,((${mref('Rb')}*D${A}*D${rm}+${mref('Rs')}*${ref('As,tot')}*${ref('rs')})*SIN(PI()*D${xi2})/PI())/1000000)))`,'kN.m','','F.2–F.6');
      const util=addCalc(8,'M/Mu',`${ref('M')}/D${mu}`,'-','≤1','Phụ lục F.1'); resultCell(calc.getCell(util,4));
    } else {
      const gate=addCalc(1,'Phạm vi',`IF(AND(${ref('Số thanh')}>=7,OR(${ref('Loại thép')}="CB240-T",${ref('Loại thép')}="CB300-T",${ref('Loại thép')}="CB300-V",${ref('Loại thép')}="CB400-V")),1,0)`,'1/0','≥7 thanh; thép ≤CB400-V','Phụ lục F.2');
      const A=addCalc(2,'A',`PI()*${ref('r')}^2`,'mm²','','Hình học'); const f8=addCalc(3,'F.8',`IF(${ref('N')}*1000<=0.77*${mref('Rb')}*D${A}+0.645*${mref('Rs')}*${ref('As,tot')},1,0)`,'1/0','1→F.9; 0→F.10','F.8');
      let prev=addCalc(4,'ξ0',`MIN(1,MAX(0,${ref('N')}*1000/(${mref('Rb')}*D${A}+${mref('Rs')}*${ref('As,tot')})))`,'-','Khởi tạo hội tụ','F.9/F.10');
      for(let i=1;i<=70;i++) prev=addCalc(4+i,`ξ${i}`,`IF(D${f8}=1,(${ref('N')}*1000+${mref('Rb')}*D${A}*SIN(2*PI()*D${prev})/(2*PI()))/(${mref('Rb')}*D${A}+${mref('Rs')}*${ref('As,tot')}),(${ref('N')}*1000+${mref('Rs')}*${ref('As,tot')}+${mref('Rb')}*D${A}*SIN(2*PI()*D${prev})/(2*PI()))/(${mref('Rb')}*D${A}+2.55*${mref('Rs')}*${ref('As,tot')}))`,'-','','F.9/F.10');
      const phi=addCalc(60,'φ',`IF(D${f8}=1,MIN(1,MAX(0,1.6*(1-1.55*D${prev})*D${prev})),0)`,'-','','F.2');
      const mu=addCalc(61,'Mu',`IF(D${gate}=0,NA(),((2/3)*${mref('Rb')}*D${A}*${ref('r')}*SIN(PI()*D${prev})^3/PI()+${mref('Rs')}*${ref('As,tot')}*(SIN(PI()*D${prev})/PI()+D${phi})*${ref('rs')})/1000000)`,'kN.m','','F.7');
      const util=addCalc(62,'M/Mu',`${ref('M')}/D${mu}`,'-','≤1','F.7'); resultCell(calc.getCell(util,4));
    }
  } else if(workflowId==='5574-annex-g'){
    const gate=addCalc(1,'nk≤3?',`IF(AND(${ref('nk')}>=1,${ref('nk')}<=3),1,0)`,'1/0','1=trong phạm vi','G.1');
    const tk=addCalc(2,'tk,min',`IF(D${gate}=1,${ref('Q')}*1000/(${mref('Rb')}*${ref('Lk')}*${ref('nk')}),NA())`,'mm','','G.1');
    const hk0=addCalc(3,'hk,G2',`IF(D${gate}=1,${ref('Q')}*1000/(2*${mref('Rbt')}*${ref('Lk')}*${ref('nk')}),NA())`,'mm','','G.2');
    const hkg3=addCalc(4,'hk,G3',`IF(AND(D${gate}=1,${ref('N')}>0),(${ref('Q')}*1000-0.7*${ref('N')}*1000)/(2*${mref('Rbt')}*${ref('Lk')}*${ref('nk')}),D${hk0})`,'mm','','G.3');
    const hk=addCalc(5,'hk,min',`IF(D${gate}=1,IF(${ref('N')}>0,MAX(D${hk0}/2,D${hkg3}),D${hk0}),NA())`,'mm','G.3 không giảm quá 2 lần so G.2','G.2/G.3'); resultCell(calc.getCell(hk,4));
  } else if(workflowId==='5574-corbel'){
    const ratio=addCalc(1,'L1/h0',`${ref('L1')}/${ref('h0')}`,'-','≤0,9','H.1');
    const sint=addCalc(2,'sinθ',`${ref('h0')}/SQRT(${ref('h0')}^2+${ref('L1')}^2)`,'-','','H.1');
    const alpha=addCalc(3,'α',`${mref('Es')}/${mref('Eb')}`,'-','','H.1');
    const mu=addCalc(4,'μw',`${ref('Asw')}/(${ref('b')}*${ref('sw')})`,'-','','H.1');
    const base=addCalc(5,'Qbase',`0.8*${mref('Rb')}*${ref('b')}*${ref('Lsup')}*D${sint}^2*(1+5*D${alpha}*D${mu})/1000`,'kN','','H.1');
    const low=addCalc(6,'Qmin-bound',`2.5*${mref('Rbt')}*${ref('b')}*${ref('h0')}/1000`,'kN','','H.1');
    const up=addCalc(7,'Qmax-bound',`3.5*${mref('Rbt')}*${ref('b')}*${ref('h0')}/1000`,'kN','','H.1');
    const qu=addCalc(8,'Qu',`IF(D${ratio}<=0.9,MAX(D${low},MIN(D${up},D${base})),NA())`,'kN','Ngoài L1/h0≤0,9 → dừng','H.1');
    const util=addCalc(9,'Q/Qu',`IF(D${ratio}<=0.9,${ref('Q')}/D${qu},NA())`,'-','≤1','H.1'); resultCell(calc.getCell(util,4));
  } else if(workflowId==='5574-prestress'){
    const l1=addCalc(1,'Δσ1',`MAX(0,(0.22*${ref('sigmaSp')}/${ref('Rsn')}-0.1)*${ref('sigmaSp')})`,'MPa','','CT209');const l2=addCalc(2,'Δσ2',`1.25*${ref('deltaT')}`,'MPa','','CT211');const l3=addCalc(3,'Δσ3',`IF(${ref('n')}>1,(${ref('n')}-1)/(2*${ref('n')})*${ref('dLForm')}/${ref('LForm')}*200000,0)`,'MPa','','CT212');const l4=addCalc(4,'Δσ4',`${ref('dLAnchor')}/${ref('LAnchor')}*200000`,'MPa','','CT213');const om=addCalc(5,'ω',`IF(${ref('Bề mặt')}="metal-duct",0.003,IF(${ref('Bề mặt')}="soft-concrete-duct",0.0015,0))`,'-','','Bảng18');const de=addCalc(6,'δ',`IF(${ref('Loại thép ma sát')}="bar",IF(${ref('Bề mặt')}="metal-duct",0.4,0.65),IF(${ref('Bề mặt')}="metal-duct",0.35,0.55))`,'-','','Bảng18');const l7=addCalc(7,'Δσ7',`IF(AND(ISNUMBER(${ref('x ma sát')}),ISNUMBER(${ref('theta')})),(1-EXP(-(D${om}*${ref('x ma sát')}+D${de}*${ref('theta')})))*${ref('sigmaSp')},0)`,'MPa','','CT214');const l5=addCalc(8,'Δσ5',`IF(AND(ISNUMBER(${ref('sigmaBpj')}),${ref('sigmaBpj')}<0),0,${ref('epsShrink')}*200000)`,'MPa','','CT215');const phi=addCalc(9,'φb,cr',`${phi11(ref('Độ ẩm'))}`,'-','','Bảng11');const l6=addCalc(10,'Δσ6',`IF(ISNUMBER(${ref('creepLoss')}),${ref('creepLoss')},IF(AND(ISNUMBER(${ref('sigmaBpj')}),ISNUMBER(${ref('ysj')}),ISNUMBER(${ref('Ared')}),ISNUMBER(${ref('Ired')}),ISNUMBER(${ref('A bê tông')}),ISNUMBER(${ref('Aspj')})),IF(${ref('sigmaBpj')}<0,0,IF(${ref('Nhiệt luyện?')}="Có",0.85,1)*0.8*(${mref('Es')}/${mref('Eb')})*D${phi}*${ref('sigmaBpj')}/(1+(${mref('Es')}/${mref('Eb')})*(${ref('Aspj')}/${ref('A bê tông')})*(1+${ref('ysj')}^2*${ref('Ared')}/${ref('Ired')})*(1+0.8*D${phi}))),0))`,'MPa','','CT216');const first=addCalc(11,'Δσ(1)',`D${l1}+D${l2}+D${l3}+D${l4}+D${l7}`,'MPa','','CT217');const total=addCalc(12,'Δσ(2)',`MAX(100,D${first}+D${l5}+D${l6})`,'MPa','','CT219');const p2=addCalc(13,'P(2)',`${ref('Asp')}*(${ref('sigmaSp')}-D${total})/1000`,'kN','','CT220');resultCell(calc.getCell(p2,4));
  }
  const chk=wb.addWorksheet('04_KIEM_TRA'); title(chk,'04 · KẾT QUẢ & KIỂM TRA','F'); chk.addRow([]); chk.addRow(['Chỉ tiêu','Giá trị','Giới hạn','Kết luận','Ý nghĩa','Nguồn']); head(chk.getRow(3)); fmt(chk,[26,20,18,18,58,30]);
  if(workflowId==='5574-material') chk.addRow(['Tra vật liệu','Đã tra từ sheet 02','VERIFIED','ĐẠT','Tra cả TTGH1 và TTGH2.','Bảng 6/7/10/12/13/14']);
  else if(workflowId==='5574-crack') chk.addRow(['SLS nứt',{formula:`='03_TINH_TOAN'!D${calc.rowCount}`},1,{formula:'IF(B4<=C4,"ĐẠT","KHÔNG ĐẠT")'},'MAX(acrc/acrc,u; σs/Rs,ser) ≤ 1.','CT166 + Bảng17']);
  else if(workflowId==='5574-deformation') chk.addRow(['Độ võng',{formula:`='03_TINH_TOAN'!D${calc.rowCount}`},'fu',{formula:'"THEO DÕI"'},'So với fu theo Phụ lục M/nhiệm vụ thiết kế.','CT177']);
  else if(workflowId==='5574-prestress') chk.addRow(['P(2)',{formula:`='03_TINH_TOAN'!D${calc.rowCount}`},'kN',{formula:'"KẾT QUẢ"'},'Lực nén trước còn lại sau CT214/216 và các hao tổn khác.','CT220']);
  else if(workflowId==='5574-anchorage') chk.addRow(['Chiều dài neo Lan',{formula:`='03_TINH_TOAN'!D${calc.rowCount-1}`},'mm',{formula:'"KẾT QUẢ"'},'Chiều dài neo yêu cầu sau CT255–257 và giới hạn tối thiểu.','CT255–257']);
  else if(workflowId==='5574-lap-splice') chk.addRow(['Chiều dài nối Llap',{formula:`='03_TINH_TOAN'!D${calc.rowCount}`},'mm',{formula:`IF(ISNUMBER(B4),"KẾT QUẢ","NGOÀI PHẠM VI")`},'Chỉ áp dụng nối chồng cho thanh d≤40 mm.','CT259']);
  else if(workflowId==='5574-circular') {const r=chk.addRow(['Hệ số sử dụng Phụ lục F',{formula:`='03_TINH_TOAN'!D${calc.rowCount}`},1,{formula:`IF(NOT(ISNUMBER(B4)),"NGOÀI PHẠM VI",IF(B4<=1,"ĐẠT","KHÔNG ĐẠT"))`},'M phải đã kể ảnh hưởng uốn dọc; cốt thép phân bố đều và đủ số thanh.','F.1–F.10']); resultCell(r.getCell(2));}
  else if(workflowId==='5574-annex-g') chk.addRow(['Kích thước chốt',{formula:`='03_TINH_TOAN'!D${calc.rowCount}`},'hk min (mm)',{formula:`IF(ISNUMBER(B4),"KẾT QUẢ","NGOÀI PHẠM VI")`},'Xem thêm tk,min ngay phía trên; nk không lớn hơn 3.','G.1–G.3']);
  else if(workflowId==='5574-corbel') {const r=chk.addRow(['Hệ số sử dụng H.1',{formula:`='03_TINH_TOAN'!D${calc.rowCount}`},1,{formula:`IF(NOT(ISNUMBER(B4)),"NGOÀI PHẠM VI",IF(B4<=C4,"ĐẠT","KHÔNG ĐẠT"))`},'Ngoài kiểm H.1 còn phải kiểm nén cục bộ tại vị trí truyền tải và cấu tạo cốt ngang.','Phụ lục H']); resultCell(r.getCell(2));}
  else {const r=chk.addRow(['Hệ số sử dụng',{formula:`='03_TINH_TOAN'!D${calc.rowCount}`},1,{formula:`IF(B${chk.rowCount+1}<=C${chk.rowCount+1},"ĐẠT","KHÔNG ĐẠT")`},'≤1 nghĩa là sức kháng không nhỏ hơn tác động.','TCVN 5574:2018']); resultCell(r.getCell(2));}

  const th=wb.addWorksheet('05_THUYET_MINH'); title(th,'05 · THUYẾT MINH CHO NGƯỜI DÙNG','D'); th.addRow([]); th.addRow(['Bước','Làm gì?','Tại sao?','Cách kiểm tra']); head(th.getRow(3)); fmt(th,[10,52,64,64]);
  const explain5574={
    '5574-eccentric':[
      [1,'Chọn B và CB','Để lấy Rb, Eb, Rs, Rsc từ bảng Verified.','Đổi cấp vật liệu ở 01_INPUT và kiểm sheet 02 tự đổi.'],[2,'Xác định độ lệch tâm ngẫu nhiên ea','Tiêu chuẩn quy định không được bỏ qua sai lệch hình học/ngẫu nhiên.','ea=max(L/600; h/30; 10 mm).'],[3,'Xác định e0 và hệ số uốn dọc η','Tĩnh định và siêu tĩnh xử lý ea khác nhau; cột mảnh cần xét Ncr.','Nếu có L0,I,Is → kiểm N<Ncr; nếu không, workbook cảnh báo η=1.'],[4,'Tính x theo CT42 hoặc CT43','Nhánh phụ thuộc ξR.','Excel tự so sánh x42/h0 với ξR.'],[5,'Kiểm CT40','So sánh N·e với sức kháng tiết diện.','Tỷ số ≤1 → ĐẠT.']],
    '5574-shear':[
      [1,'Tra Rb, Rbt, Rsw','Lực cắt phụ thuộc cả bê tông và cốt đai.','Kiểm sheet 02_VAT_LIEU.'],[2,'Kiểm dải bê tông CT88','Đảm bảo lực cắt không phá dải bê tông giữa các tiết diện nghiêng.','Q/Qstrip ≤1.'],[3,'Tính qsw và kiểm CT96','Cốt đai chỉ được kể trong nhánh đơn giản khi đủ cường độ tối thiểu.','qsw ≥0,25·Rbt·b.'],[4,'Tính Qb,1 + Qsw,1','Tách rõ phần bê tông và phần cốt đai.','Xem từng giá trị tại 03_TINH_TOAN.'],[5,'Kết luận','Phải đồng thời thỏa CT88 và CT93.','MAX(Q/Qstrip;Q/Qu)≤1 → ĐẠT.']],
    '5574-torsion':[
      [1,'Kiểm CT102','Giới hạn ứng suất nén trong bê tông do xoắn.','T≤0,1·Rb·b²·h.'],[2,'Tính qsw,1 và δ','Xác định đóng góp của cốt ngang cho tiết diện không gian.','CT107 và CT109.'],[3,'Kiểm tỷ số cốt thép','Tiêu chuẩn giới hạn tỷ số qsw,1·Z1/(Rs·As,1).','Phải nằm trong 0,5…1,5.'],[4,'Tính Tsw,1 và Ts,1','Tách đóng góp cốt ngang và cốt dọc.','CT112–113.'],[5,'Kết luận xoắn thuần','So sánh cả CT102 và CT111.','MAX(T/Tstrip;T/Tu)≤1 và tỷ số cốt thép hợp lệ.']],
    '5574-local':[
      [1,'Xác định diện tích cục bộ và diện tích lớn nhất','Diện tích lan truyền tải quyết định hệ số tăng cường độ cục bộ.','Ab,max phải có căn cứ hình học.'],[2,'Tính φb','Kể đến mức độ lan truyền tải trong bê tông.','φb=0,8√(Ab,max/Ab,loc), giới hạn 1…2,5.'],[3,'Tính Rb,loc','Chuyển Rb thành cường độ nén cục bộ.','Rb,loc=φb·Rb.'],[4,'Tính Nu','Sức kháng nén cục bộ không có lưới thép.','Nu=ψ·Rb,loc·Ab,loc.'],[5,'Kết luận','So sánh lực nén cục bộ với Nu.','N/Nu≤1 → ĐẠT.']],
    '5574-punch':[
      [1,'Xác định chu vi u và h0','Hai đại lượng này tạo diện tích bê tông chịu chọc thủng Ab.','Ab=u·h0.'],[2,'Tính Fb,u','Đóng góp của bê tông theo Rbt.','Fb,u=Rbt·Ab.'],[3,'Tính Fsw,u nếu có cốt ngang','Cốt ngang chỉ được kể khi đủ mức tối thiểu.','Fsw,u≥0,25Fb,u mới được kể.'],[4,'Khống chế cốt ngang','Tiêu chuẩn không cho tổng sức kháng tăng vô hạn.','Fsw,u dùng tính không vượt Fb,u, nên tổng≤2Fb,u.'],[5,'Kết luận','So sánh lực tập trung với sức kháng.','F/Fu≤1 → ĐẠT.']],
    '5574-crack':[[1,'Tính tiết diện quy đổi','Để xác định Wred và mô men nứt.','CT162–164.'],[2,'Tính Mcrc','Xác định khi nào cần kiểm mở rộng vết nứt.','CT158–160.'],[3,'Tính σs và Ls','Ứng suất thép và khoảng cách vết nứt quyết định acrc.','CT170,174.'],[4,'Tính ψs','Kể đến bê tông chịu kéo giữa các vết nứt.','CT176.'],[5,'Tính acrc','Nhân các hệ số thời hạn/bề mặt/loại chịu lực.','CT166; so với giới hạn áp dụng.']],
    '5574-deformation':[[1,'Chọn nhánh nứt','Không nứt dùng CT187-189; có nứt dùng CT186 và CT193-204.','HNL tự chọn từ đề bài.'],[2,'Tra Bảng 9/11','Kể thời hạn tải và từ biến.','Bảng 9,11.'],[3,'Tính độ cong','Nhánh có nứt tách (1/r)1-(1/r)2+(1/r)3.','CT186.'],[4,'Tính biến dạng trượt khi yêu cầu','Dầm tựa đơn tải đều có workflow CT181-184.','CT181-184.'],[5,'Kiểm giới hạn','f phải không vượt fu.','CT177 + Phụ lục M.']],
    '5574-prestress':[[1,'Kiểm giới hạn σsp','Ứng suất căng ban đầu bị giới hạn theo Rs,n.','9.1.1.'],[2,'Tính ma sát','Tra ω,δ theo Bảng 18 và tính CT214.','CT214 + Bảng18.'],[3,'Tính từ biến','Dùng σbpj và đặc trưng quy đổi để tính CT216.','CT216 + Bảng11.'],[4,'Cộng hao tổn','Tách tổng lần 1 và tổng toàn bộ.','CT217,219.'],[5,'Tính P(2)','Lực nén trước còn lại sau hao tổn.','CT220.']],
    '5574-anchorage':[[1,'Tra Rbt và Rs','Neo phụ thuộc bám dính bê tông–cốt thép.','Bảng 7/13.'],[2,'Tính Rbond','Dùng η1 theo bề mặt và η2 theo đường kính.','CT256.'],[3,'Tính L0,an','Chiều dài cơ sở truyền toàn bộ Rs vào bê tông.','CT255.'],[4,'Hiệu chỉnh Lan','Dùng α và tỷ số As,cal/As,ef rồi áp giới hạn tối thiểu.','CT257 và 10.3.5.5.'],[5,'Nếu có Ls','Tính lực thực tế truyền qua neo theo CT258.','Ns không vượt RsAs.']],
    '5574-lap-splice':[[1,'Khóa đường kính','Nối chồng chỉ dùng cho d≤40 mm.','10.3.6.2.'],[2,'Tính Rbond và L0,an','Dùng cùng nền bám dính của neo.','CT255–256.'],[3,'Chọn α','Nối thông thường: kéo 1,2; nén 0,9.','10.3.6.3.'],[4,'Tính Llap','Nhân L0,an với α và As,cal/As,ef.','CT259.']],
    '5574-circular':[[1,'Chọn dạng tiết diện','Vành khuyên dùng F.1–F.6; tròn dùng F.7–F.10.','Phụ lục F.'],[2,'Kiểm phạm vi','Vành khuyên r1/r2>0,5; tròn dùng thép ≤CB400-V; cả hai tối thiểu 7 thanh phân bố đều.','F.1/F.2.'],[3,'Xác định ξcir','Vành khuyên tính trực tiếp; tròn giải phương trình F.9/F.10 bằng lặp hội tụ minh bạch.','F.1, F.4, F.6, F.9, F.10.'],[4,'Tính Mu','Dùng đúng nhánh theo ξcir và F.8.','F.2–F.7.'],[5,'Kết luận','So sánh M đã kể uốn dọc với Mu.','M/Mu≤1.']],
    '5574-annex-g':[[1,'Kiểm nk','Số chốt đưa vào tính không lớn hơn 3.','Phụ lục G.'],[2,'Tính tk','Chiều sâu chốt theo Rb.','G.1.'],[3,'Tính hk','Chiều cao chốt theo Rbt.','G.2.'],[4,'Nếu có N nén','Cho phép dùng G.3 nhưng mức giảm hk không vượt 2 lần.','G.3.']],
    '5574-corbel':[[1,'Kiểm L1/h0','Phụ lục H áp dụng công xôn ngắn khi tỷ số không lớn hơn 0,9.','H.1.'],[2,'Tính θ, α, μw','Xác định dải bê tông nghiêng và ảnh hưởng cốt ngang.','H.1.'],[3,'Tính Qbase','Sức kháng theo biểu thức H.1.','0,8Rb·b·Lsup·sin²θ·(1+5αμw).'],[4,'Áp giới hạn','Vế phải H.1 nằm giữa 2,5Rbtbh0 và 3,5Rbtbh0.','H.1.'],[5,'Kiểm bổ sung','Ứng suất truyền tải phải ≤Rb,loc và cốt ngang phải thỏa cấu tạo.','Phụ lục H.']],
    '5574-material':[
      [1,'Chọn cấp bê tông','Workbook tra Rb, Rbt và Eb từ bảng Verified.','Đổi cấp B ở 01_INPUT và kiểm giá trị tự cập nhật.'],[2,'Chọn loại thép','Workbook tra Rs, Rsc, Rsw và dùng Es theo 6.2.3.3.','Đổi CB ở 01_INPUT.'],[3,'Kiểm provenance','Mỗi giá trị đều có Bảng/Điều và trang nguồn.','Xem 06_NGUON.']]
  };
  const bendExplain=[
    [1,'Chọn B và CB','Lấy cường độ thiết kế đúng bảng.','Kiểm sheet 02_VAT_LIEU.'],[2,'Tính ξR','Khóa miền áp dụng của sơ đồ ứng suất.','CT31-32, kể εb2 theo cấp bê tông.'],[3,'Tính x','Cân bằng lực trong tiết diện.','Chữ nhật dùng CT35; T/I tự kiểm CT36 rồi chọn nhánh.'],[4,'Tính Mu','Sức kháng uốn giới hạn.','CT34 hoặc CT37.'],[5,'So sánh M≤Mu','Điều kiện độ bền.','Hệ số M/Mu≤1 → ĐẠT.']];
  th.addRows(explain5574[workflowId]||bendExplain);

  const src=wb.addWorksheet('06_NGUON'); title(src,'06 · NGUỒN / PROVENANCE','G'); src.addRow([]); src.addRow(['Nhóm','Điều/Bảng/Công thức','Trang chuẩn','Trang PDF','Trạng thái','Dùng để','Ghi chú']); head(src.getRow(3)); fmt(src,[24,40,15,15,18,44,55]);
  src.addRows([
    ['Vật liệu','Bảng 7; Bảng 10; Bảng 13; Bảng 14','35;38;47;48','33;36;45;46','VERIFIED','Rb/Rbt/Eb/Rs/Rsc/Rsw','Không kế thừa giá trị sai từ template cũ.'],['Thép','6.2.3.3','48','46','VERIFIED','Es=2,0×10^5 MPa cho thép thanh liên quan',''],['Vùng nén','CT (31)-(32); 6.1.4.2','56;40-41','54;38-39','VERIFIED','ξR; εb2','B60 trở xuống εb2=0,0035; B70→B100 nội suy 0,0033→0,0028.'],['Uốn','8.1.2.3 · CT (33)-(38)','57-58','55-56','VERIFIED','Tiết diện chữ nhật/T/I',''],['Nén lệch tâm','8.1.2.2.4; 8.1.2.4 · CT (40)-(48)','56-61','54-59','VERIFIED','ea, e0, η, Ncr, x, CT40',''],['Lực cắt','8.1.3.2–3 · CT (88)–(98)','69–72','67–70','VERIFIED','Lực cắt','Nhánh CT93 bảo thủ nếu cốt đai không đạt CT96.'],['Xoắn','8.1.4.2 · CT (102)–(113)','75–77','73–75','VERIFIED','Xoắn thuần','Kiểm tỷ số qsw,1·Z1/(Rs·As,1) trong 0,5…1,5.'],['Nén cục bộ','8.1.5.2 · CT (116)–(118)','80','78','VERIFIED','Không lưới thép','φb=0,8√(Ab,max/Ab,loc), giới hạn 1…2,5.'],['Chọc thủng','8.1.6.2 · CT (123)–(128)','86–88','84–86','VERIFIED','Lực tập trung','Cốt ngang chỉ kể khi Fsw,u≥0,25Fb,u; tổng≤2Fb,u.'],['Nứt','8.2.2 · CT (158)–(176); Bảng 17','98–105','96–103','VERIFIED','Nhánh uốn chữ nhật','Rbt,ser/Rs,ser/Bảng17 đã số hóa.'],['Biến dạng','8.2.3 · CT (177)–(204); Bảng 9/11','105–114','103–112','VERIFIED','Không nứt + có nứt + trượt selected branch','Có nứt Verified cho chữ nhật chỉ cốt kéo; trượt Verified cho dầm tựa đơn tải đều.'],['Ứng suất trước','9.1 · CT (207)–(220); Bảng 18','116–120','114–118','VERIFIED','Hao tổn kể ma sát + từ biến','CT214/Bảng18 và CT216 đã code; CT216 cần σbpj + đặc trưng quy đổi có căn cứ.'],['Neo cốt thép','10.3.5 · CT (255)–(258)','138–141','136–139','VERIFIED','Chiều dài neo và lực truyền qua neo','α phải có căn cứ; không tự giả định ngoài input/nhánh đã xác minh.'],['Nối chồng','10.3.6 · CT (259)','141–143','139–141','VERIFIED','Nối chồng không ứng suất trước','Thanh d>40 mm bị khóa; α=1,2 kéo / 0,9 nén cho trường hợp thông thường.'],['Phụ lục G','G.1–G.3','169–170','167–168','VERIFIED','Chốt bê tông','nk≤3; G.3 có giới hạn giảm chiều cao.'],['Phụ lục H','H.1','171–173','169–171','VERIFIED BRANCH','Công xôn ngắn','L1/h0≤0,9; phải kiểm thêm Rb,loc và cấu tạo.'],['Phụ lục F','F.1–F.10','166–168','164–166','VERIFIED','Cột tròn/vành khuyên','F.9/F.10 giải bằng lặp hội tụ; yêu cầu ≥7 thanh phân bố đều, tròn dùng thép ≤CB400-V.'],['Bảng 16','8.1.2.4.3','61','59','INDEXED','Nén gần đúng tâm đơn giản','Pass tiếp theo.']
  ]);

  // Compact visual indicator: data-bar conditional formatting avoids decorative charts and updates with formulas.
  try {if(workflowId!=='5574-material'){const row=chk.getRow(4); row.getCell(2).numFmt='0.000'; chk.addConditionalFormatting({ref:'B4',rules:[{type:'dataBar',cfvo:[{type:'num',value:0},{type:'num',value:1.5}],color:{argb:'FF5B9BD5'},showValue:true}]}); chk.addConditionalFormatting({ref:'D4',rules:[{type:'containsText',operator:'containsText',text:'KHÔNG',style:{fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FFF4CCCC'}},font:{color:{argb:'FF9C0006'},bold:true}}},{type:'containsText',operator:'containsText',text:'ĐẠT',style:{fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FFC6E0B4'}},font:{color:{argb:'FF006100'},bold:true}}}]});}} catch {}

  addImageInputProvenance(wb,input.imageProvenance);
  const buf=await wb.xlsx.writeBuffer(); saveBlob(buf,`HNL_TCVN5574_${safeName(workflowId)}_v1.25.6.xlsx`);
}



// v1.25.2 — Cổng xuất Excel Production duy nhất, dispatch sang generator formula-only đúng workflow.
export async function exportUnifiedEngineeringWorkbook(payload={}, options={}){
  const workflowId=String(payload?.workflow?.id||'');
  const imageProvenance=options.imageProvenance||payload.imageProvenance||[];
  const input={...(payload.input||{}),imageProvenance};

  // v1.25.1 LEAN EXPORT + FORMULA-ONLY:
  // Không mở workbook master rồi mang theo các sheet không liên quan.
  // Chỉ gọi đúng workbook generator của workflow đang tính.
  // Kết quả Production phải là công thức Excel liên kết input/bảng tra;
  // HNL result chỉ dùng benchmark/đối chiếu, không ghi đè ô kết quả bằng số chết.
  if(workflowId==='7888-material'){
    return export7888WorkflowWorkbook(input);
  }
  if(workflowId==='10304-driven'){
    return exportDrivenPileWorkflowWorkbook(input);
  }
  const map10304={
    '10304-end-bearing':'end-bearing',
    '10304-bored':'bored',
    '10304-screw':'screw',
    '10304-static':'static',
    '10304-dynamic':'dynamic',
    '10304-cpt':'cpt',
    '10304-spt':'spt',
    '10304-settlement-single':'settlement-single',
    '10304-settlement-group':'settlement-group',
    '10304-equivalent-block':'equivalent-block',
    '10304-piled-raft':'piled-raft',
    '10304-construction-effect':'construction-effect'
  };
  if(map10304[workflowId]){
    return export10304AdvancedWorkflowWorkbook(map10304[workflowId],input);
  }
  if(workflowId.startsWith('5574-')){
    return export5574WorkflowWorkbook(workflowId,input);
  }
  throw new Error(`Workflow ${workflowId||'(trống)'} chưa có Lean Formula-Only Production exporter.`);
}

