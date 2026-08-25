import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readZip, writeZip } from './pass81-zip.js';

export const PASS81_EXCEL_EXPORTER_STATUS = Object.freeze({
  id: 'p1-pass8.1-v18-dynamic-excel-exporter',
  version: '1.25.7',
  status: 'CORE_LOCKED_DYNAMIC_EXPORTER_PATCH',
  language: 'vi-VN',
  templateFile: 'HNL_P1_Pass7_Bao_Cao_Tinh_Toan_Coc_San_Xuat_v18.xlsx',
  templateSha256: '582e897788d3aa96895f7ff63e604899ad489cbe2d5fb59238bb186a4b62b9d1',
  limits: Object.freeze({ maxStructuralRows: 70, maxSoilBranchRows: 50, maxSegmentRows: 70, maxGeologyRows: 70 }),
  invariant: 'Exporter chỉ ánh xạ request/result đã được Pass 8 server-side xác minh vào template v18; không tính lại công thức kỹ thuật.'
});

const SHEETS = Object.freeze({
  huongDan: 'xl/worksheets/sheet1.xml',
  tongHop: 'xl/worksheets/sheet2.xml',
  dauVao: 'xl/worksheets/sheet3.xml',
  diaChat: 'xl/worksheets/sheet4.xml',
  tinhDat: 'xl/worksheets/sheet5.xml',
  vatLieu: 'xl/worksheets/sheet6.xml',
  sucChiuTai: 'xl/worksheets/sheet7.xml',
  duLieuKetCau: 'xl/worksheets/sheet8.xml',
  kiemTraCoc: 'xl/worksheets/sheet9.xml',
  cocBatLoi: 'xl/worksheets/sheet10.xml',
  nguon: 'xl/worksheets/sheet11.xml',
  bangTra: 'xl/worksheets/sheet12.xml',
  golden: 'xl/worksheets/sheet13.xml'
});

const escapeXml = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unescapeXml = (v) => String(v ?? '').replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
const escapeRe = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function finiteOrNull(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function textOrBlank(v) { return v == null ? '' : String(v); }
function excelFormula(f) { return String(f ?? '').replace(/^=/, ''); }

function cellPattern(ref) {
  return new RegExp(`<x:c\\b(?=[^>]*\\br="${escapeRe(ref)}")[^>]*(?:\\/>|>[\\s\\S]*?<\\/x:c>)`);
}

function makeCell(existing, ref, { value = null, formula = null, type = null, blank = false } = {}) {
  const open = existing.match(/^<x:c\b([^>]*?)(?:\/>|>)/)?.[1] ?? '';
  const s = open.match(/\bs="([^"]+)"/)?.[1];
  const style = s ? ` s="${s}"` : '';
  if (blank) return `<x:c r="${ref}"${style} />`;
  let t = type;
  if (!t) t = typeof value === 'number' ? 'n' : 'str';
  const typeAttr = t ? ` t="${t}"` : '';
  const f = formula != null ? `<x:f>${escapeXml(excelFormula(formula))}</x:f>` : '';
  const v = value == null ? '' : escapeXml(value);
  return `<x:c r="${ref}"${style}${typeAttr}>${f}<x:v>${v}</x:v></x:c>`;
}

function colIndex(ref) {
  const letters=String(ref).match(/^[A-Z]+/)?.[0]??'A';
  return [...letters].reduce((n,ch)=>n*26+(ch.charCodeAt(0)-64),0);
}

function setCell(xml, ref, spec) {
  const re = cellPattern(ref);
  const m = xml.match(re);
  if (m) return xml.replace(re, makeCell(m[0], ref, spec));

  // artifact_tool may omit physically empty cells. Insert a cell into the existing row
  // rather than treating that as a broken template. The template hash is already checked.
  const rowNo=Number(String(ref).match(/\d+$/)?.[0]);
  const rowRe=new RegExp(`<x:row\\b(?=[^>]*\\br="${rowNo}")[^>]*>[\\s\\S]*?<\\/x:row>`);
  let row=xml.match(rowRe)?.[0];
  if(!row){
    const newCell=makeCell(`<x:c r="${ref}" s="154" />`,ref,spec);
    const newRow=`<x:row r="${rowNo}">${newCell}</x:row>`;
    return xml.replace('</x:sheetData>',`${newRow}</x:sheetData>`);
  }
  const styles=[...row.matchAll(/<x:c\b[^>]*\bs="([^"]+)"[^>]*(?:\/>|>[\s\S]*?<\/x:c>)/g)].map(x=>x[1]);
  const style=styles[0]??'154';
  const newCell=makeCell(`<x:c r="${ref}" s="${style}" />`,ref,spec);
  const target=colIndex(ref);
  const cells=[...row.matchAll(/<x:c\b(?=[^>]*\br="([A-Z]+\d+)")[^>]*(?:\/>|>[\s\S]*?<\/x:c>)/g)];
  let inserted=false;
  for(const cm of cells){
    const cref=cm[1];
    if(colIndex(cref)>target){ row=row.replace(cm[0],newCell+cm[0]); inserted=true; break; }
  }
  if(!inserted) row=row.replace('</x:row>',newCell+'</x:row>');
  return xml.replace(rowRe,row);
}

function setValue(xml, ref, value) {
  if (value == null || value === '') return setCell(xml, ref, { blank: true });
  if (typeof value === 'number' && Number.isFinite(value)) return setCell(xml, ref, { value, type: 'n' });
  return setCell(xml, ref, { value: textOrBlank(value), type: 'str' });
}

function setFormula(xml, ref, formula, cached) {
  const type = typeof cached === 'number' && Number.isFinite(cached) ? 'n' : 'str';
  return setCell(xml, ref, { value: cached ?? '', formula, type });
}

function clearCells(xml, cols, rowStart, rowEnd) {
  for (let r = rowStart; r <= rowEnd; r++) for (const c of cols) xml = setCell(xml, `${c}${r}`, { blank: true });
  return xml;
}

function colLetters(a, b) {
  const toN = (s) => [...s].reduce((n,ch)=>n*26+(ch.charCodeAt(0)-64),0);
  const toS = (n) => { let s=''; while(n){ n--; s=String.fromCharCode(65+n%26)+s; n=Math.floor(n/26);} return s; };
  const out=[]; for(let n=toN(a);n<=toN(b);n++) out.push(toS(n)); return out;
}

function getXml(entries, name) {
  const e = entries.get(name); if (!e) throw new Error(`Template thiếu ${name}.`); return e.data.toString('utf8');
}
function putXml(entries, name, xml) { const e=entries.get(name); if(!e) throw new Error(`Template thiếu ${name}.`); e.data=Buffer.from(xml,'utf8'); }

function viSoilTip(v) {
  const soil = v?.soilGroup ?? v?.group ?? '';
  const sand = v?.sandType ?? '';
  const sm = { sand:'Cát', clay:'Sét', silt:'Bụi', medium:'vừa', fine:'mịn', coarse:'thô', gravelly:'lẫn sỏi' };
  const a=sm[String(soil).toLowerCase()] ?? soil; const b=sm[String(sand).toLowerCase()] ?? sand;
  return [a,b].filter(Boolean).join('/');
}

function materialCached(batch) {
  const m=batch.materialResult ?? {}; const i=m.inputs ?? {}; const mats=m.materials ?? {};
  const A=Number(i.concreteAreaMm2 ?? (i.widthMm*i.heightMm));
  return { inputs:i, area:A, slender:Number(m.slendernessRatio), gradeNum:Number(String(i.grade??'').replace(/[^0-9.]/g,'')), Rb:Number(mats.RbMpa), Rsc:Number(mats.RscMpa), phi:Number(m.phi), conc:Number(m.concreteContributionKn), steel:Number(m.steelContributionKn), Nu:Number(m.materialResistanceKn ?? m.NuKn) };
}

function patchInputs(xml, request, result) {
  const p=request.pile??{}, soil=request.soil??{}, mat=request.material??{}, d=request.design??{};
  const rows={C4:'Cọc vuông',C5:p.sideMm,C6:p.lengthM,C7:p.shaftStartDepthM??0,C8:p.maxSegmentM??2,C9:result.route?.labelVi??p.constructionMethod,C10:soil.mechanicalGammaK??soil.mechanicalInput?.gammaK,C11:soil.sptGammaK??soil.sptInput?.gammaK,C12:d.gammaN??p.gammaN,C13:mat.grade,C14:mat.steel,C15:mat.AsTotMm2,C16:mat.L0Mm,C17:mat.e0Mm,C18:mat.loadDuration==='short'?'Ngắn hạn':'Dài hạn',C19:result.route?.structuralSourceKind??request.structural?.kind,C20:request.structural?.nodalReactionCompressionSign==='compression-negative'?'Nén âm':'Nén dương',C21:(request.combinationIds??[]).join(', ')||'Tất cả'};
  for(const [ref,v] of Object.entries(rows)) xml=setValue(xml,ref,v); return xml;
}

function patchGeology(xml, request) {
  xml=clearCells(xml,colLetters('A','J'),4,75);
  const boreholes=request.soil?.boreholes??[]; let r=4;
  for(const b of boreholes) for(let i=0;i<(b.layers??[]).length;i++){
    if(r>PASS81_EXCEL_EXPORTER_STATUS.limits.maxGeologyRows) throw new Error('Quá giới hạn dòng địa chất của template v18.');
    const l=b.layers[i]; const vals=[b.id??b.name??'',i+1,l.top,l.bottom,l.soilGroup==='sand'?'Cát':l.soilGroup,l.sandType??'',l.sptN??'',l.IL??'','Hồ sơ địa chất','Dữ liệu đầu vào Pass 8'];
    for(let c=0;c<10;c++) xml=setValue(xml,`${String.fromCharCode(65+c)}${r}`,vals[c]); r++;
  }
  if(r+2>75) throw new Error('Không đủ vùng ghi SPT trong template v18.');
  const hdr=['Lỗ khoan','Độ sâu z (m)','N-SPT','Loại dữ liệu','Chính sách'];
  for(let c=0;c<5;c++) xml=setValue(xml,`${String.fromCharCode(65+c)}${r}`,hdr[c]); r++;
  for(const b of boreholes) for(const pt of (b.sptPoints??[])){
    if(r>75) throw new Error('Quá giới hạn điểm SPT của template v18.');
    const vals=[b.id??b.name??'',pt.depthM,pt.N,'Điểm đo thực','Không nội suy liên tục'];
    for(let c=0;c<5;c++) xml=setValue(xml,`${String.fromCharCode(65+c)}${r}`,vals[c]); r++;
  }
  return xml;
}

function segmentRows(batch) {
  const out=[];
  for(const br of batch.rows??[]){
    const method=String(br.methodLabel??br.methodId??''); const sr=br.soilResult??{};
    for(let i=0;i<(sr.segmentResults??[]).length;i++){
      const seg=sr.segmentResults[i]; const mechanical=String(br.methodId).includes('10304-');
      out.push({borehole:br.boreholeId,method,idx:i+1,top:seg.top,bottom:seg.bottom,h:seg.hM,ztb:seg.avgDepthM??((Number(seg.top)+Number(seg.bottom))/2),fi:seg.fiKpa??seg.unitResistanceKpa??seg.tauKpa,gamma:seg.gammaRf??1,u:sr.geometry?.perimeterM,resistance:seg.resistanceKn,source:mechanical?'TCVN 10304:2025 · Bảng 3 + Bảng 4':'TCVN 10304:2025 · Phụ lục D · Bảng D.1'});
    }
  }
  return out;
}

function patchSoil(xml, out) {
  const batch=out.result.capacityBatch, branches=batch.rows??[], material=out.result.summary.RmaterialKn, gammaN=out.result.summary.gammaN;
  if(branches.length>PASS81_EXCEL_EXPORTER_STATUS.limits.maxSoilBranchRows) throw new Error(`Có ${branches.length} nhánh địa chất, vượt giới hạn ${PASS81_EXCEL_EXPORTER_STATUS.limits.maxSoilBranchRows}.`);
  const segs=segmentRows(batch); if(segs.length>PASS81_EXCEL_EXPORTER_STATUS.limits.maxSegmentRows) throw new Error(`Có ${segs.length} phân đoạn thân cọc, vượt giới hạn ${PASS81_EXCEL_EXPORTER_STATUS.limits.maxSegmentRows}.`);
  xml=clearCells(xml,colLetters('V','AG'),4,75);
  let sr=4;
  for(const seg of segs){
    const vals=[seg.borehole,seg.method,seg.idx,seg.top,seg.bottom,seg.h,seg.ztb,seg.fi,seg.gamma,seg.u,seg.resistance,seg.source];
    const cols=colLetters('V','AG'); for(let i=0;i<cols.length;i++) xml=setValue(xml,`${cols[i]}${sr}`,vals[i]);
    xml=setFormula(xml,`AF${sr}`,`=AA${sr}*AC${sr}*AD${sr}*AE${sr}`,finiteOrNull(seg.resistance)); sr++;
  }
  // Main six rows: include critical branch even when branch count > 6.
  xml=clearCells(xml,colLetters('A','S'),4,9);
  let shown=branches.slice(0,6); const critIndex=branches.findIndex(x=>x.boreholeId===batch.criticalBoreholeId&&x.methodId===batch.criticalMethodId);
  if(branches.length>6 && critIndex>=6) shown=[...branches.slice(0,5),branches[critIndex]];
  const detailEnd=Math.max(4,sr-1);
  for(let i=0;i<shown.length;i++){
    const r=4+i, br=shown[i], sr0=br.soilResult??{}, area=sr0.geometry?.tipAreaM2??sr0.geometry?.areaM2, per=sr0.geometry?.perimeterM, qb=sr0.qbKpa, gm=sr0.gammaRR??1;
    const vals=[i+1,br.boreholeId,br.methodLabel,area,per,qb,gm,null,null,null,sr0.gammaK,null,null,null,null,null,null,viSoilTip(br.soilAtTip),br.methodId==='10304-driven'?'TCVN 10304:2025 · §7.2.2':'TCVN 10304:2025 · Phụ lục D'];
    const cols=colLetters('A','S'); for(let c=0;c<cols.length;c++) if(vals[c]!=null) xml=setValue(xml,`${cols[c]}${r}`,vals[c]);
    xml=setFormula(xml,`H${r}`,`=D${r}*F${r}*G${r}`,finiteOrNull(br.QbKn));
    xml=setFormula(xml,`I${r}`,`=SUMIFS($AF$4:$AF$${detailEnd},$V$4:$V$${detailEnd},B${r},$W$4:$W$${detailEnd},C${r})`,finiteOrNull(br.QsKn));
    xml=setFormula(xml,`J${r}`,`=H${r}+I${r}`,finiteOrNull(br.RkKn));
    xml=setFormula(xml,`L${r}`,`=J${r}/K${r}`,finiteOrNull(br.RdKn));
    xml=setFormula(xml,`M${r}`,`='05_VẬT_LIỆU'!$B$23`,finiteOrNull(br.RmaterialKn??material));
    xml=setFormula(xml,`N${r}`,`=MIN(L${r},M${r})`,finiteOrNull(br.RpileKn));
    xml=setValue(xml,`O${r}`,gammaN);
    xml=setFormula(xml,`P${r}`,`=N${r}/O${r}`,finiteOrNull(br.NdMaxFinalKn));
    xml=setFormula(xml,`Q${r}`,`=IF(L${r}<=M${r},"ĐẤT NỀN","VẬT LIỆU")`,br.governing==='SOIL'?'ĐẤT NỀN':'VẬT LIỆU');
  }
  // Full branch continuation table when > 6.
  xml=clearCells(xml,colLetters('A','S'),24,75);
  let fullStart=null, fullEnd=null;
  if(branches.length>6){
    const hdr=['STT','Lỗ khoan','Phương pháp','A mũi (m²)','u (m)','q_b (kPa)','γ mũi','Qb (kN)','Qs (kN)','Rk (kN)','γk','Rd=Rsoil (kN)','Rmaterial (kN)','Rpile (kN)','γn','Nd,max (kN)','Khống chế','Lớp đất mũi','Nguồn'];
    for(let c=0;c<hdr.length;c++) xml=setValue(xml,`${colLetters('A','S')[c]}24`,hdr[c]);
    fullStart=25;
    for(let i=0;i<branches.length;i++){
      const r=25+i, br=branches[i], sr0=br.soilResult??{}; if(r>75) throw new Error('Quá giới hạn bảng nhánh địa chất mở rộng.');
      const vals=[i+1,br.boreholeId,br.methodLabel,sr0.geometry?.tipAreaM2??sr0.geometry?.areaM2,sr0.geometry?.perimeterM,sr0.qbKpa,sr0.gammaRR??1,br.QbKn,br.QsKn,br.RkKn,sr0.gammaK,br.RdKn,br.RmaterialKn,br.RpileKn,gammaN,br.NdMaxFinalKn,br.governing==='SOIL'?'ĐẤT NỀN':'VẬT LIỆU',viSoilTip(br.soilAtTip),br.methodId];
      const cols=colLetters('A','S'); for(let c=0;c<cols.length;c++) xml=setValue(xml,`${cols[c]}${r}`,vals[c]);
    }
    fullEnd=24+branches.length;
  }
  const s=out.result.summary;
  xml=setFormula(xml,'B13',branches.length>6?`=MIN(L${fullStart}:L${fullEnd})`:`=MIN(L4:L${3+shown.length})`,s.RsoilKn);
  xml=setFormula(xml,'B14',`='05_VẬT_LIỆU'!B23`,s.RmaterialKn);
  xml=setFormula(xml,'B15','=MIN(B13,B14)',s.RpileKn);
  xml=setValue(xml,'B16',s.gammaN);
  xml=setFormula(xml,'B17','=B15/B16',s.NdMaxPerPileKn);
  xml=setValue(xml,'B18',batch.criticalBoreholeId??'');
  xml=setValue(xml,'B19',batch.criticalMethodLabel??batch.criticalMethodId??'');
  xml=setValue(xml,'B20','VERIFIED');
  for(const [ref,val] of [['F13',0],['F14',0],['F15',0],['F16',0],['F17',0]]) xml=setFormula(xml,ref,`=B${ref.slice(1)}-E${ref.slice(1)}`,val);
  return xml;
}

function patchMaterial(xml, out) {
  const m=materialCached(out.result.capacityBatch); const i=m.inputs;
  const vals={B4:i.grade,B5:i.steel,B6:i.widthMm,B7:i.heightMm,B8:i.AsTotMm2,B9:i.L0Mm,B10:i.e0Mm};
  for(const [r,v] of Object.entries(vals)) xml=setValue(xml,r,v);
  xml=setFormula(xml,'B15','=B6*B7',m.area);
  xml=setFormula(xml,'B16','=B9/B7',m.slender);
  xml=setFormula(xml,'B17','=VALUE(SUBSTITUTE(B4,"B",""))',m.gradeNum);
  xml=setFormula(xml,'B18',`=VLOOKUP(B4,'11_BẢNG_TRA'!$A$4:$D$22,2,FALSE)`,m.Rb);
  xml=setFormula(xml,'B19',`=VLOOKUP(B5,'11_BẢNG_TRA'!$F$4:$I$8,3,FALSE)`,m.Rsc);
  // Keep existing formula body for B20; replace only cached value.
  const b20=xml.match(cellPattern('B20'))?.[0]; const f20=unescapeXml(b20?.match(/<x:f>([\s\S]*?)<\/x:f>/)?.[1]??'');
  xml=setFormula(xml,'B20',f20,m.phi);
  xml=setFormula(xml,'B21','=B20*B18*B15/1000',m.conc);
  xml=setFormula(xml,'B22','=B20*B19*B8/1000',m.steel);
  xml=setFormula(xml,'B23','=B21+B22',m.Nu);
  xml=setValue(xml,'B24',m.Nu);
  xml=setFormula(xml,'B25','=B23-B24',0);
  xml=setFormula(xml,'G15','=IF(B16<=20,"ĐẠT","KHÓA TÍNH")',m.slender<=20?'ĐẠT':'KHÓA TÍNH');
  xml=setFormula(xml,'G16','=IF(B10<=B7/30,"ĐẠT","KHÓA TÍNH")',Number(i.e0Mm)<=Number(i.heightMm)/30+1e-9?'ĐẠT':'KHÓA TÍNH');
  xml=setFormula(xml,'G17','=IF(AND(B16>=6,B16<=20),"ĐẠT","KHÓA TÍNH")',(m.slender>=6&&m.slender<=20)?'ĐẠT':'KHÓA TÍNH');
  xml=setFormula(xml,'G18','=IF(ABS(B25)<1E-6,"ĐẠT","KHÔNG KHỚP")','ĐẠT');
  xml=setFormula(xml,'G19','=IF(COUNTIF(G15:G18,"ĐẠT")=4,"VERIFIED","KHÓA TÍNH")',out.result.capacityBatch.materialResult?.status??'VERIFIED');
  return xml;
}

function patchCapacity(xml, out) {
  const s=out.result.summary, batch=out.result.capacityBatch;
  xml=setFormula(xml,'B4',`='04_TÍNH_ĐẤT'!B13`,s.RsoilKn);
  xml=setFormula(xml,'B5',`='05_VẬT_LIỆU'!B23`,s.RmaterialKn);
  xml=setFormula(xml,'B6','=MIN(B4,B5)',s.RpileKn);
  xml=setValue(xml,'B7',s.gammaN);
  xml=setFormula(xml,'B8','=B6/B7',s.NdMaxPerPileKn);
  xml=setFormula(xml,'E4','=IF(B4<=B5,"ĐẤT NỀN","VẬT LIỆU")',s.RsoilKn<=s.RmaterialKn?'ĐẤT NỀN':'VẬT LIỆU');
  xml=setFormula(xml,'E5','=IF(B5<B4,"VẬT LIỆU","KHÔNG KHỐNG CHẾ")',s.RmaterialKn<s.RsoilKn?'VẬT LIỆU':'KHÔNG KHỐNG CHẾ');
  xml=setFormula(xml,'E6','=IF(B4<=B5,"ĐẤT NỀN KHỐNG CHẾ","VẬT LIỆU KHỐNG CHẾ")',s.RsoilKn<=s.RmaterialKn?'ĐẤT NỀN KHỐNG CHẾ':'VẬT LIỆU KHỐNG CHẾ');
  xml=setValue(xml,'B9',batch.criticalBoreholeId??''); xml=setValue(xml,'B10',batch.criticalMethodLabel??batch.criticalMethodId??'');
  const vals=[s.RsoilKn,s.RmaterialKn,s.RpileKn,s.gammaN,s.NdMaxPerPileKn];
  for(let i=0;i<5;i++){const r=13+i;xml=setFormula(xml,`B${r}`,`=B${4+i}`,vals[i]);xml=setValue(xml,`C${r}`,vals[i]);xml=setFormula(xml,`D${r}`,`=B${r}-C${r}`,0);xml=setFormula(xml,`E${r}`,`=IF(ABS(D${r})<1E-6,"ĐẠT","KHÔNG KHỚP")`,'ĐẠT');}
  xml=setFormula(xml,'B18','=IF(COUNTIF(E13:E17,"ĐẠT")=5,"ĐẠT","KHÓA TÍNH")','ĐẠT'); return xml;
}

function patchStructural(xml, out) {
  const rows=out.result.structural.rows??[]; if(rows.length>PASS81_EXCEL_EXPORTER_STATUS.limits.maxStructuralRows) throw new Error(`Có ${rows.length} dòng kiểm cọc, vượt giới hạn ${PASS81_EXCEL_EXPORTER_STATUS.limits.maxStructuralRows}.`);
  xml=clearCells(xml,colLetters('A','N'),4,73);
  for(let i=0;i<rows.length;i++){const r=4+i,x=rows[i];const vals=[x.pileId??x.pointId,x.combinationId,x.x,x.y,x.z,x.rawFzKn,x.demandKn,x.FxKn,x.FyKn,x.MxKnm,x.MyKnm,x.MzKnm,x.checkType==='COMPRESSION'?'NÉN':x.checkType,`Pass 5 canonical · ${out.route.structuralSourceKind}`];const cols=colLetters('A','N');for(let c=0;c<cols.length;c++) xml=setValue(xml,`${cols[c]}${r}`,vals[c]);}
  return xml;
}

function patchChecks(xml, out) {
  const rows=out.result.structural.rows??[]; const end=3+rows.length; xml=clearCells(xml,colLetters('A','L'),4,73);
  for(let i=0;i<rows.length;i++){const r=4+i,x=rows[i];
    for(const [c,src] of [['A','A'],['B','B'],['C','C'],['D','D'],['E','M'],['F','G']]) xml=setFormula(xml,`${c}${r}`,`='07_DỮ_LIỆU_KẾT_CẤU'!${src}${r}`,c==='A'?(x.pileId??x.pointId):c==='B'?x.combinationId:c==='C'?x.x:c==='D'?x.y:c==='E'?(x.checkType==='COMPRESSION'?'NÉN':x.checkType):x.demandKn);
    xml=setFormula(xml,`G${r}`,`='06_SỨC_CHỊU_TẢI'!$B$8`,x.capacityKn);
    xml=setFormula(xml,`H${r}`,`=IF(G${r}>0,F${r}/G${r},1/0)`,x.utilization);
    const st=x.blockReason?'KHÓA TÍNH':x.pass?'ĐẠT':'KHÔNG ĐẠT';
    xml=setFormula(xml,`I${r}`,`=IF(K${r}<>"","KHÓA TÍNH",IF(H${r}<=1,"ĐẠT","KHÔNG ĐẠT"))`,st);
    xml=setFormula(xml,`J${r}`,`=IF(H${r}=MAX($H$4:$H$${end}),"CỌC BẤT LỢI","")`,String(x.pileId)===String(out.result.summary.governingPileId)&&x.combinationId===out.result.summary.governingCombinationId?'CỌC BẤT LỢI':'');
    xml=setValue(xml,`K${r}`,x.blockReason??''); xml=setValue(xml,`L${r}`,'Pass 2→7 LOCKED chain');
  }
  return xml;
}

function patchGoverning(xml, out) {
  const s=out.result.summary, rows=out.result.structural.rows??[], end=3+rows.length, g=out.result.governing??{};
  xml=setFormula(xml,'B4',`=INDEX('08_KIỂM_TRA_CỌC'!A4:A${end},MATCH(MAX('08_KIỂM_TRA_CỌC'!H4:H${end}),'08_KIỂM_TRA_CỌC'!H4:H${end},0))`,s.governingPileId??'');
  xml=setFormula(xml,'B5',`=INDEX('08_KIỂM_TRA_CỌC'!B4:B${end},MATCH(MAX('08_KIỂM_TRA_CỌC'!H4:H${end}),'08_KIỂM_TRA_CỌC'!H4:H${end},0))`,s.governingCombinationId??'');
  xml=setFormula(xml,'B6',`=INDEX('08_KIỂM_TRA_CỌC'!F4:F${end},MATCH(MAX('08_KIỂM_TRA_CỌC'!H4:H${end}),'08_KIỂM_TRA_CỌC'!H4:H${end},0))`,g.demandKn??null);
  xml=setFormula(xml,'B7',`='06_SỨC_CHỊU_TẢI'!B8`,s.NdMaxPerPileKn); xml=setFormula(xml,'B8',`=MAX('08_KIỂM_TRA_CỌC'!H4:H${end})`,s.governingUtilization??null);
  xml=setFormula(xml,'B9',`='06_SỨC_CHỊU_TẢI'!B4`,s.RsoilKn); xml=setFormula(xml,'B10',`='06_SỨC_CHỊU_TẢI'!B5`,s.RmaterialKn); xml=setFormula(xml,'B11',`='06_SỨC_CHỊU_TẢI'!B6`,s.RpileKn);
  xml=setFormula(xml,'B12',`=IF(COUNTIF('08_KIỂM_TRA_CỌC'!I4:I${end},"KHÓA TÍNH")>0,"KHÓA TÍNH",IF(MAX('08_KIỂM_TRA_CỌC'!H4:H${end})<=1,"ĐẠT","KHÔNG ĐẠT"))`,out.result.conclusion.statusVi);
  xml=setValue(xml,'F4','Rsoil → Rmaterial → Rpile → γn → Nd,max → phản lực từng cọc'); xml=setValue(xml,'F5',`${out.result.capacityBatch.criticalBoreholeId??'-'} · ${out.result.capacityBatch.criticalMethodLabel??'-'}`); xml=setValue(xml,'F6',s.RsoilKn<=s.RmaterialKn?'Đất nền khống chế':'Vật liệu khống chế'); xml=setValue(xml,'F7',`Point ${s.governingPileId??'-'} · ${s.governingCombinationId??'-'}`); xml=setValue(xml,'F8',s.governingUtilization??''); xml=setValue(xml,'F9',out.result.conclusion.statusVi); xml=setValue(xml,'F10',out.result.conclusion.text);
  return xml;
}

function patchSummary(xml, out) {
  const s=out.result.summary;
  const vals={B4:s.RsoilKn,B5:s.RmaterialKn,B6:s.RpileKn,B7:s.gammaN,B8:s.NdMaxPerPileKn,B9:s.governingPileId??'',B10:s.governingCombinationId??'',B11:s.governingUtilization??'',B12:out.result.conclusion.statusVi};
  for(const [ref,v] of Object.entries(vals)){
    const old=xml.match(cellPattern(ref))?.[0]??''; const f=old.match(/<x:f>([\s\S]*?)<\/x:f>/)?.[1]; xml=f?setFormula(xml,ref,f,v):setValue(xml,ref,v);
  }
  xml=setValue(xml,'H4',`${s.boreholeBranches} nhánh lỗ khoan × phương pháp`); xml=setValue(xml,'H8',`${s.pileChecks} dòng kiểm cọc`); xml=setValue(xml,'H9',`Point ${s.governingPileId??'-'} (mã cọc/điểm)`); xml=setValue(xml,'A16',out.result.conclusion.text);
  return xml;
}

function patchGolden(xml, out) {
  const s=out.result.summary; const vals=[s.RsoilKn,s.RmaterialKn,s.RpileKn,s.gammaN,s.NdMaxPerPileKn,s.governingPileId??'',s.governingCombinationId??'',s.governingUtilization??'',out.result.conclusion.statusVi];
  for(let i=0;i<vals.length;i++){const r=4+i;const old=xml.match(cellPattern(`B${r}`))?.[0]??'';const f=old.match(/<x:f>([\s\S]*?)<\/x:f>/)?.[1];xml=f?setFormula(xml,`B${r}`,f,vals[i]):setValue(xml,`B${r}`,vals[i]);xml=setValue(xml,`C${r}`,vals[i]);if(i<=4||i===7)xml=setFormula(xml,`D${r}`,`=B${r}-C${r}`,0);xml=setFormula(xml,`E${r}`,i<=4||i===7?`=IF(ABS(D${r})<1E-6,"ĐẠT","KHÔNG KHỚP")`:`=IF(B${r}=C${r},"ĐẠT","KHÔNG KHỚP")`,'ĐẠT');}
  xml=setValue(xml,'B16','PASS 8.1 SERVER-SIDE EXPORT'); xml=setValue(xml,'B17','Kết quả vừa tính được ghi động vào template v18'); xml=setValue(xml,'B18','ĐẠT'); xml=setValue(xml,'B19','Không sửa'); xml=setValue(xml,'B20','RUNTIME GOLDEN'); return xml;
}

function patchProvenance(xml, meta, out) {
  const rows=[['Pass 8.1 exporter','Dynamic OOXML từ template v18','Không tính lại kỹ thuật'],['Mã lần xuất',meta.exportId,'UUID'],['Thời điểm xuất',meta.generatedAt,'ISO-8601'],['Template SHA-256',meta.templateSha256,'Exact'],['Kết quả server',out.status,'Pass 8 server-side'],['Nguồn kết cấu',out.route.structuralSourceKind,'Pass 5 canonical']];
  let r=14; for(const row of rows){for(let c=0;c<3;c++) xml=setValue(xml,`${String.fromCharCode(65+c)}${r}`,row[c]);r++;} return xml;
}

function patchGuide(xml, meta) {
  const rows=[['Mã lần xuất',meta.exportId],['Thời điểm xuất',meta.generatedAt],['Template SHA-256',meta.templateSha256],['Chế độ','DYNAMIC_EXPORT_FROM_SERVER_VERIFIED_RESULT'],['Endpoint','/api/hnl/pile/export-excel']];
  let r=19; for(const [a,b] of rows){xml=setValue(xml,`A${r}`,a);xml=setValue(xml,`B${r}`,b);r++;} return xml;
}

function enableRecalc(xml) {
  xml=xml.replace(/<x:calcPr\b[^>]*\/>/g,'').replace(/<x:calcPr\b[^>]*>[\s\S]*?<\/x:calcPr>/g,'');
  return xml.replace('</x:workbook>','<x:calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1" /></x:workbook>');
}

export function exportPass81WorkbookBuffer({ templateBuffer, request, pass8Output, exportId = crypto.randomUUID(), generatedAt = new Date().toISOString() } = {}) {
  if (!Buffer.isBuffer(templateBuffer)) throw new Error('Thiếu templateBuffer v18.');
  const templateHash=sha256(templateBuffer); if(templateHash!==PASS81_EXCEL_EXPORTER_STATUS.templateSha256) throw new Error(`Sai template v18 SHA-256. Expected ${PASS81_EXCEL_EXPORTER_STATUS.templateSha256}, actual ${templateHash}.`);
  if(pass8Output?.schema!=='HNL-P1-PASS8-ONE-CLICK-RESULT') throw new Error('pass8Output không đúng schema Pass 8.');
  if(pass8Output.excelExport?.enabled===false) throw new Error(pass8Output.excelExport.blockedReason||'Kết quả đang bị khóa xuất Excel.');
  const entries=readZip(templateBuffer);
  let x;
  x=getXml(entries,SHEETS.dauVao); x=patchInputs(x,request,pass8Output); putXml(entries,SHEETS.dauVao,x);
  x=getXml(entries,SHEETS.diaChat); x=patchGeology(x,request); putXml(entries,SHEETS.diaChat,x);
  x=getXml(entries,SHEETS.tinhDat); x=patchSoil(x,pass8Output); putXml(entries,SHEETS.tinhDat,x);
  x=getXml(entries,SHEETS.vatLieu); x=patchMaterial(x,pass8Output); putXml(entries,SHEETS.vatLieu,x);
  x=getXml(entries,SHEETS.sucChiuTai); x=patchCapacity(x,pass8Output); putXml(entries,SHEETS.sucChiuTai,x);
  x=getXml(entries,SHEETS.duLieuKetCau); x=patchStructural(x,pass8Output); putXml(entries,SHEETS.duLieuKetCau,x);
  x=getXml(entries,SHEETS.kiemTraCoc); x=patchChecks(x,pass8Output); putXml(entries,SHEETS.kiemTraCoc,x);
  x=getXml(entries,SHEETS.cocBatLoi); x=patchGoverning(x,pass8Output); putXml(entries,SHEETS.cocBatLoi,x);
  x=getXml(entries,SHEETS.tongHop); x=patchSummary(x,pass8Output); putXml(entries,SHEETS.tongHop,x);
  x=getXml(entries,SHEETS.golden); x=patchGolden(x,pass8Output); putXml(entries,SHEETS.golden,x);
  const meta={exportId,generatedAt,templateSha256:templateHash};
  x=getXml(entries,SHEETS.nguon); x=patchProvenance(x,meta,pass8Output); putXml(entries,SHEETS.nguon,x);
  x=getXml(entries,SHEETS.huongDan); x=patchGuide(x,meta); putXml(entries,SHEETS.huongDan,x);
  let w=getXml(entries,'xl/workbook.xml'); putXml(entries,'xl/workbook.xml',enableRecalc(w));
  entries.delete('xl/calcChain.xml');
  return { buffer: writeZip(entries), exportId, generatedAt, templateSha256: templateHash };
}

export function exportPass81WorkbookFile({ templatePath, outputPath, request, pass8Output, exportId, generatedAt } = {}) {
  const templateBuffer=fs.readFileSync(templatePath); const out=exportPass81WorkbookBuffer({templateBuffer,request,pass8Output,exportId,generatedAt});
  fs.mkdirSync(path.dirname(outputPath),{recursive:true}); fs.writeFileSync(outputPath,out.buffer); return {...out,outputPath,sha256:sha256(out.buffer)};
}
