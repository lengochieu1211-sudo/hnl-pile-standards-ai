import './ui.css';
import { getDocuments } from '../db.js';
import { collectCandidates, chooseBestCandidates, buildAuditSummary, analyzeCandidateAmbiguity } from './core.js';
import { exportPdfExcelWorkbook } from './exporter.js';
import { exportP4ExcelWorkbook } from '../p4-pdf-excel-intelligence.js';
import { p4PacketFromSelectionSource, p4PacketFromImageReview } from './adapters.js';

const EVENT_SCHEMA='HNL_P4_RUNTIME_EVENT_V1';
const reports=[]; let panel=null; let latest=null; let buildInfoCache=null;
window.addEventListener('hnl:p31-shadow-result',e=>{if(e.detail){reports.push(e.detail);if(reports.length>80)reports.shift();}});
if(window.__HNL_PDF_SHADOW_LAST__) reports.push(window.__HNL_PDF_SHADOW_LAST__);

async function buildInfo(){
  if(buildInfoCache)return buildInfoCache;
  try{const r=await fetch(`./build-info.json?t=${Date.now()}`,{cache:'no-store'});buildInfoCache=r.ok?await r.json():{};}catch{buildInfoCache={};}
  return buildInfoCache;
}
function emitRuntime(name,detail={}){window.dispatchEvent(new CustomEvent(name,{detail:{schema:EVENT_SCHEMA,at:new Date().toISOString(),...detail}}));}
function buildSummary(info={}){return{commit:String(info.commit||''),commitShort:String(info.commitShort||''),branch:String(info.branch||''),target:String(info.target||''),searchBrain:String(info.searchBrain||''),searchBrainStatus:String(info.searchBrainStatus||'')};}
function safety(){return{promotionState:'SHADOW_ONLY',productionMutationAllowed:false,calculationEngineMutationAllowed:false};}
function safeCandidate(c={}){return{variable:c.variable||'',value:c.value??c.valueRaw??null,unit:c.unit||'',document:c.document||c.fileName||'',page:c.page||null,engine:c.engine||'',source:c.source||'',bbox:Array.isArray(c.bbox)?c.bbox:null,status:c.status||''};}
function esc(s=''){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function safeFilePart(v='HNL'){return String(v||'HNL').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').replace(/[^A-Za-z0-9._-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,70)||'HNL';}
function notice(message,type='info'){
  document.querySelector('#hnl-p4-toast')?.remove();const el=document.createElement('div');el.id='hnl-p4-toast';el.textContent=message;
  Object.assign(el.style,{position:'fixed',right:'18px',bottom:'18px',zIndex:'2147483647',maxWidth:'520px',padding:'11px 14px',borderRadius:'9px',background:type==='error'?'#7f1d1d':type==='success'?'#14532d':'#17365d',color:'#fff',font:'13px system-ui',boxShadow:'0 8px 28px #0005'});document.body.appendChild(el);setTimeout(()=>el.remove(),5200);
}

function open(){
  if(panel?.isConnected){panel.style.display='block';return;}
  panel=document.createElement('section');panel.className='hnl-p4-panel';panel.innerHTML=`<header><b>P4 · PDF/Ảnh → Excel Intelligence</b><span>SHADOW</span><button class="close">×</button></header><div class="body"><div class="muted">Hỏi: “Tìm giá trị a, b trong tài liệu rồi xuất Excel”. HNL ưu tiên PDF.js; OCR/Vision là evidence CẦN RÀ SOÁT và không tự đi vào Calculation Engine.</div><textarea id="p4q">Tìm giá trị a, b trong tài liệu rồi xuất Excel</textarea><div class="row"><label>Hình minh họa <select id="p4img"><option value="relevant">Chỉ hình liên quan</option><option value="all">Đầy đủ</option><option value="none">Không chèn</option></select></label></div><div class="row"><button class="primary" id="p4scan">Quét & tìm tham số</button><button class="secondary" id="p4excel" disabled>Xuất Excel REVIEW</button></div><div id="p4status" class="warn">Chưa quét.</div><div id="p4result"></div></div>`;
  document.body.appendChild(panel);panel.querySelector('.close').onclick=()=>panel.style.display='none';panel.querySelector('#p4scan').onclick=scan;panel.querySelector('#p4excel').onclick=exportXlsx;
}

async function scan(){
  const status=panel.querySelector('#p4status'),out=panel.querySelector('#p4result'),btn=panel.querySelector('#p4excel');btn.disabled=true;status.className='warn';status.textContent='Đang đọc thư viện PDF và evidence OCR/Vision…';
  try{
    const docs=(await getDocuments()).filter(d=>d?.viewerKind==='pdf'||d?.blob),question=panel.querySelector('#p4q').value,info=await buildInfo();
    latest=collectCandidates({docs,question,shadowReports:reports,sourceSha:String(info.commit||'')});latest.docs=docs;
    const best=chooseBestCandidates(latest),audit=buildAuditSummary(latest),issues=analyzeCandidateAmbiguity(latest);
    status.className=best.length?'ok':'warn';status.textContent=`Tìm ${audit.candidateCount} ứng viên · ${best.length}/${latest.variables.length} biến có đề xuất · ${issues.length} mục cần rà soát. OCR/Vision không tự VERIFIED.`;
    out.innerHTML=`<table><thead><tr><th>Biến</th><th>Giá trị đề xuất</th><th>Trang</th><th>Nguồn</th><th>Rà soát</th></tr></thead><tbody>${(latest.variables||[]).map(v=>{const c=best.find(x=>x.variable===v),issue=issues.find(x=>x.variable===v);return `<tr><td><b>${esc(v)}</b></td><td>${esc(c?.value??c?.valueRaw??'—')} ${esc(c?.unit||'')}</td><td>${esc(c?.page||'—')}</td><td>${esc(c?.engine||'Chưa thấy')}</td><td>${esc(issue?.message||'Cần xác nhận trước khi dùng thiết kế')}</td></tr>`}).join('')}</tbody></table>`;
    btn.disabled=!latest.variables?.length;window.__HNL_P4_PDF_EXCEL_LAST__=latest;
    emitRuntime('hnl:p4-runtime-scan',{kind:'full-scan',build:buildSummary(info),question,variables:[...(latest.variables||[])],documentCount:docs.length,candidateCount:audit.candidateCount,issueCount:issues.length,candidatesSample:(latest.candidates||[]).slice(0,20).map(safeCandidate),safety:safety()});
  }catch(e){status.className='warn';status.textContent=`Lỗi: ${e?.message||e}`;emitRuntime('hnl:p4-runtime-error',{kind:'full-scan',message:String(e?.message||e)});}
}

async function exportXlsx(){
  if(!latest)return;const btn=panel.querySelector('#p4excel'),status=panel.querySelector('#p4status');btn.disabled=true;status.className='warn';status.textContent='Đang tạo workbook Excel REVIEW + provenance + hình minh họa…';
  try{const info=await buildInfo(),question=panel.querySelector('#p4q').value;const outcome=await exportPdfExcelWorkbook({docs:latest.docs,result:latest,question,imageMode:panel.querySelector('#p4img').value,includeText:true,includeFormulas:true,sourceSha:String(info.commit||'')});status.className='ok';status.textContent='Đã xuất Excel REVIEW. OCR/Vision và ứng viên PDF chưa được tự nâng thành VERIFIED.';emitRuntime('hnl:p4-runtime-export',{kind:'full-scan-xlsx',ok:outcome?.ok!==false,fileName:outcome?.fileName||'',build:buildSummary(info),sourceSha:String(info.commit||''),documentCount:latest.docs?.length||0,variables:[...(latest.variables||[])],candidateCount:latest.candidates?.length||0,safety:safety()});}catch(e){status.className='warn';status.textContent=`Xuất Excel lỗi: ${e?.message||e}`;emitRuntime('hnl:p4-runtime-error',{kind:'full-scan-xlsx',message:String(e?.message||e)});}finally{btn.disabled=false;}
}

async function imageUrlToDataUrl(url=''){
  if(!url)return'';if(String(url).startsWith('data:'))return String(url);
  try{const r=await fetch(url);if(!r.ok)return'';const blob=await r.blob();return await new Promise(resolve=>{const fr=new FileReader();fr.onload=()=>resolve(String(fr.result||''));fr.onerror=()=>resolve('');fr.readAsDataURL(blob);});}catch{return'';}
}
async function collectImageReview(card){
  const fields=[...card.querySelectorAll('.image-review-row')].map(row=>{const input=row.querySelector('[data-image-field-path]'),rawStrong=String(row.querySelector('strong')?.textContent||'').replace('%','').trim(),confidence=Number(rawStrong),small=String(row.querySelector('small')?.textContent||'').trim(),sourceName=(small.split(' · ').find(x=>/^Ảnh\s|\.(?:png|jpe?g|webp|bmp|gif)$/i.test(x.trim()))||'').trim();return{key:String(input?.dataset.imageFieldPath||'').trim(),label:String(row.querySelector('span > b')?.textContent||input?.dataset.imageFieldPath||'').trim(),value:String(input?.value??'').trim(),unit:String(row.querySelector('em')?.textContent||'').trim(),confidence:Number.isFinite(confidence)?confidence/100:null,sourceName};}).filter(x=>x.key);
  const figures=[];for(const [i,img] of [...document.querySelectorAll('.chat-image-chip img')].entries()){const chip=img.closest('.chat-image-chip'),name=String(chip?.querySelector('span > b')?.textContent||`Ảnh ${i+1}`).trim(),dataUrl=await imageUrlToDataUrl(img.src);figures.push({name,title:name,dataUrl});}
  return{fields,figures,file:figures.map(x=>x.name).join(' · ')};
}
async function exportImageReview(card){const review=await collectImageReview(card);if(!review.fields.length)throw new Error('Chưa có trường kỹ thuật nào để xuất.');const info=await buildInfo(),packet=p4PacketFromImageReview(review,info),name=`HNL_P4_IMAGE_REVIEW_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.xlsx`,outcome=await exportP4ExcelWorkbook([packet],{fileName:name});return{outcome,packet,name,review,info};}

function sourceFromCurrentTextLayer(){const page=Number(document.querySelector('#pageInput')?.value||1),shell=document.querySelector(`.pdf-page-shell[data-page="${page}"]`)||document.querySelector('.pdf-page-shell.single'),layer=shell?.querySelector('.pdf-text-layer'),raw=String(layer?.innerText||layer?.textContent||'').replace(/\s+\n/g,'\n').trim();if(!raw)return null;const title=String(document.querySelector('.viewer-title')?.textContent||'PDF đang mở').trim();return{docName:title,standard:title,page,text:raw,method:'text-layer',sourceRectNorm:{x:0,y:0,width:1,height:1}};}
async function onExportSelection(source){try{notice('Đang tạo Excel P4…');const info=await buildInfo(),packet=p4PacketFromSelectionSource(source,info),name=`HNL_P4_${safeFilePart(source.standard||source.docName)}_P${Number(source.page)||1}_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.xlsx`,outcome=await exportP4ExcelWorkbook([packet],{fileName:name});emitRuntime('hnl:p4-runtime-export',{kind:'pdf-region-xlsx',ok:outcome?.ok!==false,fileName:name,build:buildSummary(info),source:packet.source,trust:packet.trust,textPreview:String(packet.text||'').slice(0,360),safety:safety()});notice('Đã xuất Excel P4 REVIEW; chưa đưa vào Calculation Engine.','success');}catch(e){notice(`Không xuất được Excel P4: ${e?.message||e}`,'error');emitRuntime('hnl:p4-runtime-error',{kind:'pdf-region-xlsx',message:String(e?.message||e)});}}
function enhancePopup(popup){if(!popup||popup.dataset.p4Excel==='1')return;const actions=popup.querySelector('.pdf-selection-actions');if(!actions)return;const b=document.createElement('button');b.type='button';b.textContent='Xuất Excel thông minh';b.dataset.p4UiAction='excel';b.title='P4 · vùng PDF → bảng/công thức/tham số/provenance → Excel REVIEW-first';actions.appendChild(b);popup.dataset.p4Excel='1';}
function enhanceToolbar(){const anchor=document.querySelector('#pdfSmartSelect');if(!anchor||document.querySelector('#p4ExportCurrentPage'))return;const b=document.createElement('button');b.type='button';b.className='icon-btn';b.id='p4ExportCurrentPage';b.textContent='XL';b.title='P4 · Xuất trang/vùng PDF hiện tại sang Excel REVIEW';anchor.insertAdjacentElement('afterend',b);}
function enhanceImageReview(card){if(!card||card.dataset.p4Excel==='1')return;const actions=card.querySelector('.image-review-actions')||card;const b=document.createElement('button');b.type='button';b.dataset.p4ImageAction='excel';b.textContent='⇩ Xuất Excel REVIEW';b.title='Xuất dữ liệu Vision/OCR đang chờ xác nhận sang P4 Excel; không tính tự động';actions.appendChild(b);card.dataset.p4Excel='1';}

function install(){
  const b=document.createElement('button');b.className='hnl-p4-toggle';b.textContent='PDF → Excel';b.title='P4 PDF/Ảnh → Excel Intelligence';b.onclick=open;document.body.appendChild(b);
  if(new URLSearchParams(location.search).get('pdfexcel')==='1')open();window.addEventListener('keydown',e=>{if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==='e'){e.preventDefault();open();}});
  const mo=new MutationObserver(()=>{enhanceToolbar();document.querySelectorAll('.pdf-selection-popup').forEach(enhancePopup);document.querySelectorAll('.image-engineering-review').forEach(enhanceImageReview);});mo.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',async e=>{const excelBtn=e.target?.closest?.('[data-p4-ui-action="excel"]');if(excelBtn){e.preventDefault();const popup=excelBtn.closest('.pdf-selection-popup'),source=popup?._hnlSource;if(source)await onExportSelection(source);return;}const imgBtn=e.target?.closest?.('[data-p4-image-action="excel"]');if(imgBtn){e.preventDefault();try{notice('Đang tạo Excel REVIEW từ ảnh…');const r=await exportImageReview(imgBtn.closest('.image-engineering-review'));emitRuntime('hnl:p4-runtime-export',{kind:'image-review-xlsx',ok:r.outcome?.ok!==false,fileName:r.name,build:buildSummary(r.info),source:r.packet.source,trust:r.packet.trust,parameterCount:r.packet.parameters?.length||0,figureCount:r.packet.figures?.length||0,safety:safety()});notice('Đã xuất Excel REVIEW từ ảnh.','success');}catch(err){notice(`Không xuất được Excel ảnh: ${err?.message||err}`,'error');emitRuntime('hnl:p4-runtime-error',{kind:'image-review-xlsx',message:String(err?.message||err)});}return;}if(e.target?.closest?.('#p4ExportCurrentPage')){e.preventDefault();const source=sourceFromCurrentTextLayer();if(!source)return notice('Trang hiện tại chưa có text-layer. Hãy kéo vùng OCR/Vision rồi chọn “Xuất Excel thông minh”.','error');await onExportSelection(source);}},true);
  enhanceToolbar();document.querySelectorAll('.pdf-selection-popup').forEach(enhancePopup);document.querySelectorAll('.image-engineering-review').forEach(enhanceImageReview);
  window.__HNL_P4_PDF_EXCEL__={open,scan:()=>{open();return scan();}};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
