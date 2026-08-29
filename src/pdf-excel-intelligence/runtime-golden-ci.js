const ACTIVE=new URLSearchParams(location.search).get('p4ci')==='1';

function pdfBytes(lines=['HNL P4 Runtime Golden Fixture','a = 0.70','b = 1.25 kPa','A0 = PI()/4*(D^2-(D-2*t)^2)']){
  const esc=s=>String(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
  const ops=['BT','/F1 14 Tf','72 720 Td'];
  lines.forEach((line,i)=>{if(i)ops.push('0 -24 Td');ops.push(`(${esc(line)}) Tj`);});ops.push('ET');
  const stream=ops.join('\n');
  const objs=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  const enc=new TextEncoder();let body='%PDF-1.4\n',offsets=[0];
  objs.forEach((obj,i)=>{offsets.push(enc.encode(body).length);body+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
  const xref=enc.encode(body).length;
  body+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=objs.length;i++)body+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
  body+=`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return enc.encode(body);
}

function makePngDataUrl(){
  const c=document.createElement('canvas');c.width=480;c.height=220;const x=c.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#111827';x.font='bold 28px sans-serif';x.fillText('HNL P4 Runtime Golden',28,52);x.font='24px sans-serif';x.fillText('Pile D = 600 mm',28,108);x.fillText('Length L = 12 m',28,154);x.strokeStyle='#334155';x.lineWidth=3;x.strokeRect(18,18,444,178);return c.toDataURL('image/png');
}

async function install(){
  if(!ACTIVE)return;
  const {saveDocument,deleteDocument}=await import('../db.js');
  const DOC_ID='p4-ci-runtime-golden-pdf';
  const fileName='P4_Runtime_Golden_Fixture.pdf';
  async function seedPdf(){
    const bytes=pdfBytes();
    const blob=new Blob([bytes],{type:'application/pdf'});
    const doc={id:DOC_ID,fingerprint:'p4-ci-fixture-v1',name:fileName,standard:'HNL P4 Runtime Golden Fixture',pageCount:1,size:blob.size,type:'application/pdf',createdAt:new Date().toISOString(),blob,viewerKind:'pdf',textChars:92,scannedLikely:false,textIndexVersion:3,pages:[{page:1,text:'HNL P4 Runtime Golden Fixture\na = 0.70\nb = 1.25 kPa\nA0 = PI()/4*(D^2-(D-2*t)^2)'}]};
    await saveDocument(doc);return{fileName,size:blob.size,pageCount:1};
  }
  function regionPopup(){
    document.querySelector('[data-p4-ci-region]')?.remove();
    const popup=document.createElement('div');popup.className='pdf-selection-popup';popup.dataset.p4CiRegion='1';
    popup.style.cssText='position:fixed;left:24px;top:24px;z-index:2147483600;display:block;background:#fff;padding:12px;border:1px solid #94a3b8;border-radius:8px;box-shadow:0 8px 24px #0003';
    popup.innerHTML='<div class="pdf-selection-actions"></div>';
    popup._hnlSource={docId:DOC_ID,docName:fileName,standard:'HNL P4 Runtime Golden Fixture',page:1,text:'a = 0.70; b = 1.25 kPa',method:'text-layer',sourceRectNorm:{x:0.10,y:0.20,width:0.50,height:0.30},fingerprint:'p4-ci-fixture-v1'};
    document.body.appendChild(popup);return true;
  }
  function imageReview(){
    document.querySelector('[data-p4-ci-image-chip]')?.remove();document.querySelector('[data-p4-ci-image-review]')?.remove();
    const chip=document.createElement('div');chip.className='chat-image-chip';chip.dataset.p4CiImageChip='1';
    chip.innerHTML=`<img alt="P4 fixture" src="${makePngDataUrl()}"><span><b>P4_Runtime_Golden_Image.png</b></span>`;document.body.appendChild(chip);
    const card=document.createElement('div');card.className='image-engineering-review';card.dataset.p4CiImageReview='1';
    card.style.cssText='position:fixed;left:24px;top:110px;z-index:2147483600;display:block;background:#fff;padding:12px;border:1px solid #94a3b8;border-radius:8px;box-shadow:0 8px 24px #0003';
    card.innerHTML='<div class="image-review-row"><span><b>Đường kính thân cọc</b> <em>mm</em></span><input data-image-field-path="pile.diameterMm" value="600"><strong>96%</strong><small>P4_Runtime_Golden_Image.png · fixture</small></div><div class="image-engineering-review-actions"></div>';
    document.body.appendChild(card);return true;
  }
  async function cleanup(){try{await deleteDocument(DOC_ID);}catch{}document.querySelector('[data-p4-ci-region]')?.remove();document.querySelector('[data-p4-ci-image-chip]')?.remove();document.querySelector('[data-p4-ci-image-review]')?.remove();}
  window.__HNL_P4_RUNTIME_CI__={seedPdf,regionPopup,imageReview,cleanup,fixture:{documentId:DOC_ID,fileName,imageName:'P4_Runtime_Golden_Image.png'}};
}
install().catch(error=>{console.error('P4 runtime CI helper failed',error);window.__HNL_P4_RUNTIME_CI_ERROR__=String(error?.stack||error);});
