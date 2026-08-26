import JSZip from 'jszip';

const REL_NS='http://schemas.openxmlformats.org/package/2006/relationships';
const DRAWING_REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing';
const CHART_REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart';
const CT_DRAWING='application/vnd.openxmlformats-officedocument.drawing+xml';
const CT_CHART='application/vnd.openxmlformats-officedocument.drawingml.chart+xml';

function esc(s=''){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function xmlDecode(s=''){
  return String(s).replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&');
}
function quoteSheet(name){ return `'${String(name).replace(/'/g,"''")}'`; }
function normalizeTarget(baseDir,target){
  if(target.startsWith('/')) return target.replace(/^\//,'');
  const parts=(baseDir+'/'+target).split('/'); const out=[];
  for(const p of parts){ if(!p||p==='.') continue; if(p==='..') out.pop(); else out.push(p); }
  return out.join('/');
}
function nextIndex(zip,re){
  let max=0; zip.forEach((name)=>{ const m=name.match(re); if(m) max=Math.max(max,Number(m[1])||0); }); return max+1;
}
function addOverride(ct,part,contentType){
  if(ct.includes(`PartName="${part}"`)) return ct;
  return ct.replace(/<\/Types>\s*$/,`<Override PartName="${part}" ContentType="${contentType}" /></Types>`);
}
function relationshipId(xml,prefix='rIdHNL'){
  let i=1; while(xml.includes(`Id="${prefix}${i}"`)) i++; return `${prefix}${i}`;
}
function resolveWorksheet(zip,sheetName){
  const wb=zip.file('xl/workbook.xml'); const rel=zip.file('xl/_rels/workbook.xml.rels');
  if(!wb||!rel) throw new Error('XLSX thiếu workbook.xml hoặc workbook.xml.rels');
  return Promise.all([wb.async('string'),rel.async('string')]).then(([wbXml,relXml])=>{
    const sheetTagRe=/<(?:\w+:)?sheet\b[^>]*\bname="([^"]+)"[^>]*\br:id="([^"]+)"[^>]*\/?\s*>/g;
    let m, rid='';
    while((m=sheetTagRe.exec(wbXml))){ if(xmlDecode(m[1])===sheetName){rid=m[2];break;} }
    if(!rid) throw new Error(`Không tìm thấy sheet ${sheetName}`);
    const relRe=/<Relationship\b[^>]*\/?\s*>/g;
    let target='';
    while((m=relRe.exec(relXml))){
      const tag=m[0]; const idm=tag.match(/\bId="([^"]+)"/); const tm=tag.match(/\bTarget="([^"]+)"/);
      if(idm?.[1]===rid){target=tm?.[1]||'';break;}
    }
    if(!target) throw new Error(`Không resolve được relationship ${rid} của sheet ${sheetName}`);
    return normalizeTarget('xl',target);
  });
}

function drawingXml({drawingRelId,fromCol=3,fromRow=1,toCol=11,toRow=18}){
  return `<?xml version="1.0" encoding="utf-8"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"><xdr:twoCellAnchor><xdr:from><xdr:col>${fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="1" name="HNL Chart" /><xdr:cNvGraphicFramePr /></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" /><a:ext cx="0" cy="0" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" /></xdr:xfrm><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="${drawingRelId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" /></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData /></xdr:twoCellAnchor></xdr:wsDr>`;
}

function chartXml({sheetName,title='Biểu đồ',categoryRange,valueRange,seriesName='Giá trị',axisTitle='kN'}){
  const cat=`${quoteSheet(sheetName)}!${categoryRange}`;
  const val=`${quoteSheet(sheetName)}!${valueRange}`;
  const ax1=48650112,ax2=48672768;
  return `<?xml version="1.0" encoding="utf-8"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:lang val="vi-VN" /><c:roundedCorners val="0" /><c:chart><c:title><c:tx><c:rich><a:bodyPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" /><a:lstStyle xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" /><a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:r><a:t>${esc(title)}</a:t></a:r></a:p></c:rich></c:tx></c:title><c:plotArea><c:barChart><c:barDir val="col" /><c:grouping val="clustered" /><c:varyColors val="0" /><c:ser><c:idx val="0" /><c:order val="0" /><c:tx><c:v>${esc(seriesName)}</c:v></c:tx><c:cat><c:strRef><c:f>${esc(cat)}</c:f><c:strCache><c:ptCount val="0" /></c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>${esc(val)}</c:f><c:numCache><c:formatCode>0.00</c:formatCode><c:ptCount val="0" /></c:numCache></c:numRef></c:val></c:ser><c:axId val="${ax1}" /><c:axId val="${ax2}" /></c:barChart><c:catAx><c:axId val="${ax1}" /><c:scaling><c:orientation val="minMax" /></c:scaling><c:delete val="0" /><c:axPos val="b" /><c:majorTickMark val="none" /><c:minorTickMark val="none" /><c:tickLblPos val="nextTo" /><c:crossAx val="${ax2}" /><c:lblAlgn val="ctr" /><c:lblOffset val="100" /><c:noMultiLvlLbl val="0" /></c:catAx><c:valAx><c:axId val="${ax2}" /><c:scaling><c:orientation val="minMax" /></c:scaling><c:delete val="0" /><c:axPos val="l" /><c:title><c:tx><c:rich><a:bodyPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" /><a:lstStyle xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" /><a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:r><a:t>${esc(axisTitle)}</a:t></a:r></a:p></c:rich></c:tx></c:title><c:majorGridlines /><c:numFmt formatCode="0.00" sourceLinked="0" /><c:majorTickMark val="none" /><c:minorTickMark val="none" /><c:crossAx val="${ax1}" /><c:crossBetween val="between" /></c:valAx></c:plotArea><c:legend><c:legendPos val="b" /><c:overlay val="0" /></c:legend><c:plotVisOnly val="1" /></c:chart></c:chartSpace>`;
}

export async function addNativeColumnChart(buffer,{sheetName,title,categoryRange='$A$2:$A$6',valueRange='$B$2:$B$6',seriesName='Giá trị',axisTitle='kN',fromCol=3,fromRow=1,toCol=11,toRow=18}={}){
  if(!sheetName) throw new Error('addNativeColumnChart: thiếu sheetName');
  const zip=await JSZip.loadAsync(buffer);
  const sheetPath=await resolveWorksheet(zip,sheetName);
  const sheetFile=zip.file(sheetPath); if(!sheetFile) throw new Error(`Thiếu ${sheetPath}`);
  let sheetXml=await sheetFile.async('string');
  if(/<(?:\w+:)?drawing\b/.test(sheetXml)) throw new Error(`${sheetName} đã có drawing; Pass 1 không chèn chart thứ hai để tránh ghi đè.`);

  const drawN=nextIndex(zip,/^xl\/drawings\/drawing(\d+)\.xml$/);
  const chartN=nextIndex(zip,/^xl\/drawings\/charts\/chart(\d+)\.xml$/);
  const drawingPath=`xl/drawings/drawing${drawN}.xml`;
  const drawingRelsPath=`xl/drawings/_rels/drawing${drawN}.xml.rels`;
  const chartPath=`xl/drawings/charts/chart${chartN}.xml`;
  const sheetRelPath=sheetPath.replace(/^xl\/worksheets\//,'xl/worksheets/_rels/')+'.rels';
  let sheetRels=zip.file(sheetRelPath)?await zip.file(sheetRelPath).async('string'):`<?xml version="1.0" encoding="utf-8"?><Relationships xmlns="${REL_NS}"></Relationships>`;
  const sheetRid=relationshipId(sheetRels,'rIdHNLChartDrawing');
  sheetRels=sheetRels.replace(/<\/Relationships>\s*$/,`<Relationship Type="${DRAWING_REL}" Target="/xl/drawings/drawing${drawN}.xml" Id="${sheetRid}" /></Relationships>`);
  sheetXml=sheetXml.replace(/<\/((?:\w+:)?worksheet)>\s*$/,(_m,tag)=>{ const pfx=tag.includes(':')?tag.split(':')[0]+':':''; return `<${pfx}drawing r:id="${sheetRid}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" /></${tag}>`; });

  const chartRid='rIdHNLChart1';
  zip.file(sheetPath,sheetXml);
  zip.file(sheetRelPath,sheetRels);
  zip.file(drawingPath,drawingXml({drawingRelId:chartRid,fromCol,fromRow,toCol,toRow}));
  zip.file(drawingRelsPath,`<?xml version="1.0" encoding="utf-8"?><Relationships xmlns="${REL_NS}"><Relationship Type="${CHART_REL}" Target="/xl/drawings/charts/chart${chartN}.xml" Id="${chartRid}" /></Relationships>`);
  zip.file(chartPath,chartXml({sheetName,title,categoryRange,valueRange,seriesName,axisTitle}));

  const ctFile=zip.file('[Content_Types].xml'); if(!ctFile) throw new Error('XLSX thiếu [Content_Types].xml');
  let ct=await ctFile.async('string');
  ct=addOverride(ct,`/xl/drawings/drawing${drawN}.xml`,CT_DRAWING);
  ct=addOverride(ct,`/xl/drawings/charts/chart${chartN}.xml`,CT_CHART);
  zip.file('[Content_Types].xml',ct);
  return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
