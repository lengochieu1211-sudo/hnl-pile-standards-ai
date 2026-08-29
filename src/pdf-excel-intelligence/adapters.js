import { createP4ExtractionPacket, attachAutoDetections } from '../p4-pdf-excel-intelligence.js';

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
      file:source.docName||source.file||'PDF đang mở',documentId:source.docId||'',standard:source.standard||'',
      page:Number(source.page)||1,bbox,sourceType:sourceType(method),engine:engine(method),
      route:method==='vision-ai'?'vision':method==='local-ocr'?'local-ocr':'native',
      state:'REVIEW',status:'P4_UI_SELECTION_REVIEW',confidence:null,confidenceUsable:false,userConfirmed:false,
      sourceSha:String(info.commit||info.sourceSha||''),fingerprint:String(source.fingerprint||'')
    },
    text:String(source.text||'').trim(),
    figures:figData?[{title:`Vùng nguồn · trang ${Number(source.page)||1}`,sourceImage:source.docName||'',dataUrl:figData,bbox,caption:`Ảnh vùng dùng để ${method==='vision-ai'?'Vision đọc':method==='local-ocr'?'OCR cục bộ':'đối chiếu nguồn'}.`,status:'REVIEW'}]:[],
    warnings:['P4 chỉ xuất Excel REVIEW-first; không tự xác minh số liệu và không gọi Calculation Engine.',...(method==='local-ocr'||method==='vision-ai'?['OCR/Vision-readable không đồng nghĩa VERIFIED; cần người dùng/Golden xác nhận trước khi dùng tính toán.']:[])]
  }));
}

export function p4PacketFromImageReview(review={},info={}){
  const fields=Array.isArray(review.fields)?review.fields:[];
  const figures=Array.isArray(review.figures)?review.figures:[];
  const sourceNames=[...new Set(fields.map(x=>String(x.sourceName||'').trim()).filter(Boolean))];
  const file=sourceNames.join(' · ')||String(review.file||'Ảnh đính kèm');
  const base={file,documentId:'',standard:String(review.standard||''),page:null,bbox:null,sourceType:'image',engine:'image-engineering-review',route:'vision-ocr-review',state:'REVIEW',status:'P4_IMAGE_EXTRACTION_REVIEW',confidence:null,confidenceUsable:false,userConfirmed:false,sourceSha:String(info.commit||info.sourceSha||''),fingerprint:''};
  const parameters=fields.map((f,i)=>({
    symbol:String(f.key||`field_${i+1}`).trim(),label:String(f.label||f.key||`Trường ${i+1}`).trim(),value:f.value===''?null:f.value,unit:String(f.unit||'').trim(),
    contextId:`image-review-${i+1}`,context:String(f.sourceName||file),state:'REVIEW',choices:Array.isArray(f.choices)?f.choices:[],
    provenance:{...base,confidence:Number.isFinite(Number(f.confidence))?Number(f.confidence):null,confidenceUsable:Number.isFinite(Number(f.confidence))}
  }));
  return createP4ExtractionPacket({provenance:base,parameters,figures:figures.map((x,i)=>({title:String(x.title||x.name||`Ảnh nguồn ${i+1}`),sourceImage:String(x.name||x.sourceImage||''),dataUrl:String(x.dataUrl||''),bbox:null,caption:'Ảnh nguồn Vision/OCR để đối chiếu; không phải input tính tự động.',status:'REVIEW'})),warnings:['Dữ liệu ảnh đang CHỜ XÁC NHẬN; workbook P4 là REVIEW-first và không gọi Calculation Engine.']});
}
