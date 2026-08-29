// HNL P4 UI adapter — isolated from Search Brain / Calculation Engine / main.js state.
import { createP4ExtractionPacket, attachAutoDetections, exportP4ExcelWorkbook } from './p4-pdf-excel-intelligence.js';

let buildInfoCache=null;
async function buildInfo(){
  if(buildInfoCache) return buildInfoCache;
  try{const r=await fetch(`./build-info.json?t=${Date.now()}`,{cache:'no-store'});buildInfoCache=r.ok?await r.json():{};}catch{buildInfoCache={};}
  return buildInfoCache;
}
function normBox(source={}){
  const r=source.sourceRectNorm;
  if(!r||![r.x,r.y,r.width,r.height].every(Number.isFinite)) return null;
  const x0=Math.max(0,Math.min(1,r.x)),y0=Math.max(0,Math.min(1,r.y));
  const x1=Math.max(x0,Math.min(1,r.x+r.width)),y1=Math.max(y0,Math.min(1,r.y+r.height));
  return x1>x0&&y1>y0?[x0,y0,x1,y1]:null;
}
function sourceType(method=''){
  if(method==='text-layer'||!method) return 'pdf-native';
  if(method==='local-ocr') return 'ocr';
  if(method==='vision-ai') return 'vision-reuse';
  return 'pdf-scan';
}
function engine(method=''){
  if(method==='text-layer'||!method) return 'pdfjs-native-region';
  if(method==='local-ocr') return 'chromium-textdetector-region';
  if(method==='vision-ai') return 'vision-region-user-approved';
  return method||'pdf-region';
}
function sourceImageDataUrl(source={}){
  const data=source.image?.data,mime=source.image?.mimeType||'image/png';
  if(!data) return '';
  return String(data).startsWith('data:')?String(data):`data:${mime};base64,${data}`;
}

export function p4PacketFromSelectionSource(source={},info={}){
  const method=String(source.method||'');
  const bbox=normBox(source);
  const figData=sourceImageDataUrl(source);
  return attachAutoDetections(createP4ExtractionPacket({
    provenance:{
      file:source.docName||source.file||'PDF đang mở',
      documentId:source.docId||'',
      standard:source.standard||'',
      page:Number(source.page)||1,
      bbox,
      sourceType:sourceType(method),
      engine:engine(method),
      route:method==='vision-ai'?'vision':method==='local-ocr'?'local-ocr':'native',
      state:'REVIEW',
      status:'P4_UI_SELECTION_REVIEW',
      confidence:null,
      confidenceUsable:false,
      userConfirmed:false,
      sourceSha:String(info.commit||info.sourceSha||''),
      fingerprint:String(source.fingerprint||'')
    },
    text:String(source.text||'').trim(),
    figures:figData?[{
      title:`Vùng nguồn · trang ${Number(source.page)||1}`,
      sourceImage:source.docName||'',
      dataUrl:figData,
      bbox,
      caption:`Ảnh vùng được dùng để ${method==='vision-ai'?'Vision đọc':method==='local-ocr'?'OCR cục bộ':'đối chiếu nguồn'}.`,
      status:'REVIEW'
    }]:[],
    warnings:[
      'P4 UI export chỉ tạo Excel REVIEW-first; không tự xác minh số liệu và không gọi Calculation Engine.',
      ...(method==='local-ocr'||method==='vision-ai'?['OCR/Vision-readable không đồng nghĩa VERIFIED; cần người dùng/Golden xác nhận trước khi dùng tính toán.']:[])
    ]
  }));
}


export function p4PacketFromImageReview(review={},info={}){
  const fields=Array.isArray(review.fields)?review.fields:[];
  const figures=Array.isArray(review.figures)?review.figures:[];
  const sourceNames=[...new Set(fields.map(x=>String(x.sourceName||'').trim()).filter(Boolean))];
  const file=sourceNames.join(' · ')||String(review.file||'Ảnh đính kèm');
  const baseProvenance={
    file,
    documentId:'',
    standard:String(review.standard||''),
    page:null,
    bbox:null,
    sourceType:'image',
    engine:'image-engineering-review',
    route:'vision-ocr-review',
    state:'REVIEW',
    status:'P4_IMAGE_EXTRACTION_REVIEW',
    confidence:null,
    confidenceUsable:false,
    userConfirmed:false,
    sourceSha:String(info.commit||info.sourceSha||''),
    fingerprint:''
  };
  const parameters=fields.map((f,i)=>({
    symbol:String(f.key||`field_${i+1}`).trim(),
    label:String(f.label||f.key||`Trường ${i+1}`).trim(),
    value:f.value===''?null:f.value,
    unit:String(f.unit||'').trim(),
    contextId:`image-review-${i+1}`,
    context:String(f.sourceName||file),
    state:'REVIEW',
    choices:Array.isArray(f.choices)?f.choices:[],
    provenance:{...baseProvenance,confidence:Number.isFinite(Number(f.confidence))?Number(f.confidence):null,confidenceUsable:Number.isFinite(Number(f.confidence))}
  }));
  return createP4ExtractionPacket({
    provenance:baseProvenance,
    parameters,
    figures:figures.map((x,i)=>({
      title:String(x.title||x.name||`Ảnh nguồn ${i+1}`),
      sourceImage:String(x.name||x.sourceImage||''),
      dataUrl:String(x.dataUrl||''),
      bbox:null,
      caption:'Ảnh nguồn của bước Vision/OCR; giữ để đối chiếu, không phải input tính tự động.',
      status:'REVIEW'
    })),
    warnings:[
      'Dữ liệu ảnh đang ở bước CHỜ XÁC NHẬN; Excel này là REVIEW-first và không gọi Calculation Engine.',
      'Người dùng cần kiểm tra/sửa giá trị trong ứng dụng trước khi dùng cho workflow tính toán.'
    ]
  });
}

async function imageUrlToDataUrl(url=''){
  if(!url) return '';
  if(String(url).startsWith('data:')) return String(url);
  try{
    const r=await fetch(url); if(!r.ok) return '';
    const blob=await r.blob();
    return await new Promise(resolve=>{const fr=new FileReader();fr.onload=()=>resolve(String(fr.result||''));fr.onerror=()=>resolve('');fr.readAsDataURL(blob);});
  }catch{return '';}
}

async function collectImageReview(card){
  const fields=[...card.querySelectorAll('.image-review-row')].map(row=>{
    const input=row.querySelector('[data-image-field-path]');
    const rawStrong=String(row.querySelector('strong')?.textContent||'').replace('%','').trim();
    const confidence=Number(rawStrong);
    const small=String(row.querySelector('small')?.textContent||'').trim();
    const sourceName=(small.split(' · ').find(x=>/^Ảnh\s|\.(?:png|jpe?g|webp|bmp|gif)$/i.test(x.trim()))||'').trim();
    return {
      key:String(input?.dataset.imageFieldPath||'').trim(),
      label:String(row.querySelector('span > b')?.textContent||input?.dataset.imageFieldPath||'').trim(),
      value:String(input?.value??'').trim(),
      unit:String(row.querySelector('em')?.textContent||'').trim(),
      confidence:Number.isFinite(confidence)?confidence/100:null,
      sourceName
    };
  }).filter(x=>x.key);
  const imageEls=[...document.querySelectorAll('.chat-image-chip img')];
  const figures=[];
  for(let i=0;i<imageEls.length;i++){
    const img=imageEls[i],chip=img.closest('.chat-image-chip');
    const name=String(chip?.querySelector('span > b')?.textContent||`Ảnh ${i+1}`).trim();
    const dataUrl=await imageUrlToDataUrl(img.src);
    figures.push({name,title:name,dataUrl});
  }
  return {fields,figures,file:figures.map(x=>x.name).join(' · ')};
}

async function exportImageReview(card){
  const review=await collectImageReview(card);
  if(!review.fields.length) throw new Error('Chưa có trường kỹ thuật nào để xuất.');
  const info=await buildInfo();
  const packet=p4PacketFromImageReview(review,info);
  const name=`HNL_P4_IMAGE_REVIEW_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.xlsx`;
  return exportP4ExcelWorkbook([packet],{fileName:name});
}

function safeFilePart(v='HNL'){return String(v||'HNL').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').replace(/[^A-Za-z0-9._-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,70)||'HNL';}
function notice(message,type='info'){
  document.querySelector('#hnl-p4-toast')?.remove();
  const el=document.createElement('div');el.id='hnl-p4-toast';el.textContent=message;
  Object.assign(el.style,{position:'fixed',right:'18px',bottom:'18px',zIndex:'2147483647',maxWidth:'520px',padding:'11px 14px',borderRadius:'9px',background:type==='error'?'#7f1d1d':type==='success'?'#14532d':'#17365d',color:'#fff',font:'13px system-ui',boxShadow:'0 8px 28px #0005'});
  document.body.appendChild(el);setTimeout(()=>el.remove(),5200);
}

export async function exportSelectionSourceToP4(source={}){
  if(!String(source.text||'').trim() && !source.image?.data) throw new Error('Vùng/đoạn chọn chưa có nội dung để xuất.');
  const info=await buildInfo();
  const packet=p4PacketFromSelectionSource(source,info);
  const name=`HNL_P4_${safeFilePart(source.standard||source.docName)}_P${Number(source.page)||1}_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.xlsx`;
  return exportP4ExcelWorkbook([packet],{fileName:name});
}

function sourceFromCurrentTextLayer(){
  const page=Number(document.querySelector('#pageInput')?.value||1);
  const shell=document.querySelector(`.pdf-page-shell[data-page="${page}"]`)||document.querySelector('.pdf-page-shell.single');
  const layer=shell?.querySelector('.pdf-text-layer');
  const raw=String(layer?.innerText||layer?.textContent||'').replace(/\s+\n/g,'\n').trim();
  if(!raw) return null;
  const title=String(document.querySelector('.viewer-title')?.textContent||'PDF đang mở').trim();
  return {docName:title,standard:title,page,text:raw,method:'text-layer',sourceRectNorm:{x:0,y:0,width:1,height:1}};
}

async function onExport(source){
  try{notice('Đang tạo Excel P4…');await exportSelectionSourceToP4(source);notice('Đã xuất Excel P4. Dữ liệu REVIEW chưa được tự đưa vào Calculation Engine.','success');}
  catch(e){notice(`Không xuất được Excel P4: ${e?.message||e}`,'error');}
}

function enhancePopup(popup){
  if(!popup||popup.dataset.p4Excel==='1') return;
  const actions=popup.querySelector('.pdf-selection-actions'); if(!actions) return;
  const b=document.createElement('button');b.type='button';b.textContent='Xuất Excel thông minh';b.dataset.p4UiAction='excel';b.title='P4 · PDF/vùng → bảng, công thức, tham số, provenance → Excel REVIEW-first';actions.appendChild(b);popup.dataset.p4Excel='1';
}
function enhanceToolbar(){
  const anchor=document.querySelector('#pdfSmartSelect'); if(!anchor||document.querySelector('#p4ExportCurrentPage')) return;
  const b=document.createElement('button');b.type='button';b.className='icon-btn';b.id='p4ExportCurrentPage';b.textContent='XL';b.title='Xuất lớp chữ trang hiện tại → Excel thông minh P4';anchor.insertAdjacentElement('afterend',b);
}


function enhanceImageReview(card){
  if(!card||card.dataset.p4Excel==='1') return;
  const actions=card.querySelector('.image-review-actions'); if(!actions) return;
  const b=document.createElement('button');b.type='button';b.className='btn';b.textContent='⇩ Xuất Excel REVIEW';b.dataset.p4ImageExport='1';
  b.title='P4 · Xuất dữ liệu Vision/OCR hiện tại + provenance + ảnh nguồn sang Excel; không xác nhận và không tính tự động.';
  actions.insertBefore(b,actions.lastElementChild||null);card.dataset.p4Excel='1';
}

function init(){
  const observer=new MutationObserver(()=>{document.querySelectorAll('.pdf-selection-popup').forEach(enhancePopup);document.querySelectorAll('.image-engineering-review').forEach(enhanceImageReview);enhanceToolbar();});
  observer.observe(document.documentElement,{subtree:true,childList:true});
  document.addEventListener('click',async e=>{
    const imageBtn=e.target?.closest?.('[data-p4-image-export="1"]');
    if(imageBtn){e.preventDefault();e.stopPropagation();try{notice('Đang tạo Excel REVIEW từ ảnh…');await exportImageReview(imageBtn.closest('.image-engineering-review'));notice('Đã xuất Excel REVIEW từ ảnh. Chưa xác nhận và chưa gọi Calculation Engine.','success');}catch(err){notice(`Không xuất được Excel ảnh: ${err?.message||err}`,'error');}return;}
    const btn=e.target?.closest?.('[data-p4-ui-action="excel"]');
    if(btn){e.preventDefault();e.stopPropagation();const popup=btn.closest('.pdf-selection-popup');const source=popup?._hnlSource;if(source)await onExport(source);return;}
    if(e.target?.closest?.('#p4ExportCurrentPage')){e.preventDefault();const source=sourceFromCurrentTextLayer();if(!source)return notice('Trang hiện tại chưa có text-layer. Hãy bấm T▧ hoặc kéo vùng OCR rồi chọn “Xuất Excel thông minh”.','error');await onExport(source);}
  },true);
  enhanceToolbar();document.querySelectorAll('.pdf-selection-popup').forEach(enhancePopup);document.querySelectorAll('.image-engineering-review').forEach(enhanceImageReview);
}

if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
}
