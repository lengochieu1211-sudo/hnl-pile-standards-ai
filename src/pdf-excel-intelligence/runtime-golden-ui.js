const SCHEMA='HNL_P4_RUNTIME_GOLDEN_V1';
const EVENT_SCHEMA='HNL_P4_RUNTIME_EVENT_V1';
const KEY=`hnl:p4-runtime-golden-v1:${location.host}`;
const CASES=[
  ['P4_WEB_ENV','Web staging đúng SHA + Search Brain lock'],
  ['P4_REAL_PDF_SCAN','Quét thư viện PDF thật không lỗi'],
  ['P4_FULL_SCAN_XLSX','Xuất workbook REVIEW từ quét PDF thật'],
  ['P4_PDF_REGION_XLSX','Xuất workbook từ vùng PDF thật có provenance'],
  ['P4_IMAGE_REVIEW_XLSX','Xuất workbook REVIEW từ ảnh thật']
];
let panel=null;

function now(){return new Date().toISOString();}
function fresh(){return{schema:SCHEMA,host:location.host,startedAt:now(),updatedAt:now(),environment:null,cases:Object.fromEntries(CASES.map(([id,title])=>[id,{id,title,state:'PENDING',capturedAt:null,evidence:null}])),events:[],overallState:'PENDING',promotionState:'SHADOW_ONLY',productionMutationAllowed:false,calculationEngineMutationAllowed:false};}
function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x?.schema===SCHEMA)return x;}catch{}return fresh();}
let state=load();
function save(){state.updatedAt=now();const pass=CASES.filter(([id])=>state.cases[id]?.state==='RUNTIME_PASS').length;state.overallState=pass===CASES.length?'COMPLETE':pass?'PARTIAL':'PENDING';localStorage.setItem(KEY,JSON.stringify(state));render();}
function clipText(v,n=260){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n);}
function sameSha(v=''){return Boolean(state.environment?.commit)&&String(v||'')===String(state.environment.commit);}
function mark(id,evidence,ok=true,reason=''){
  const c=state.cases[id];if(!c||c.state==='RUNTIME_PASS')return;
  c.state=ok?'RUNTIME_PASS':'REVIEW';c.capturedAt=now();c.evidence={...evidence,reason:reason||undefined};save();
}
function logEvent(type,detail){state.events.push({type,at:now(),detail});if(state.events.length>60)state.events.shift();}
function envSafe(info={}){return info.target==='web'&&Boolean(info.commit)&&String(info.searchBrain)==='1.9.23'&&String(info.searchBrainStatus)==='LOCKED';}
async function preflight(){
  try{
    const r=await fetch(`./build-info.json?t=${Date.now()}`,{cache:'no-store'});const info=r.ok?await r.json():{};
    state.environment={app:info.app||'',version:info.version||'',target:info.target||'',edition:info.edition||'',branch:info.branch||'',commit:info.commit||'',commitShort:info.commitShort||'',searchBrain:info.searchBrain||'',searchBrainStatus:info.searchBrainStatus||'',builtAt:info.builtAt||'',stagingProject:info.stagingProject||'',ciArtifactDigest:info.ciArtifactDigest||''};
    mark('P4_WEB_ENV',state.environment,envSafe(info),envSafe(info)?'':'build-info không đạt Web/Search Brain lock');
  }catch(error){mark('P4_WEB_ENV',{error:String(error?.message||error)},false,'Không đọc được build-info.json');}
}
function isRegionBox(b){if(!Array.isArray(b)||b.length!==4||!b.every(Number.isFinite))return false;const w=b[2]-b[0],h=b[3]-b[1];return w>0&&h>0&&w<0.985&&h<0.985;}
function sourceEvidence(s={}){return{file:s.file||'',documentId:s.documentId||'',standard:s.standard||'',page:s.page??null,bbox:Array.isArray(s.bbox)?s.bbox:null,sourceType:s.sourceType||'',engine:s.engine||'',route:s.route||'',state:s.state||'',status:s.status||'',confidence:s.confidence??null,confidenceUsable:s.confidenceUsable===true,userConfirmed:s.userConfirmed===true,sourceSha:s.sourceSha||'',fingerprint:s.fingerprint||''};}
function onScan(detail={}){
  if(detail.schema!==EVENT_SCHEMA)return;logEvent('scan',detail);
  const ok=detail.documentCount>0&&Array.isArray(detail.variables)&&detail.variables.length>0&&sameSha(detail.build?.commit)&&detail.safety?.productionMutationAllowed===false&&detail.safety?.calculationEngineMutationAllowed===false;
  mark('P4_REAL_PDF_SCAN',{build:detail.build,question:clipText(detail.question,180),variables:detail.variables,documentCount:detail.documentCount,candidateCount:detail.candidateCount,issueCount:detail.issueCount,sample:(detail.candidatesSample||[]).slice(0,8)},ok,ok?'':'Cần ít nhất 1 PDF thật + 1 biến truy vấn và đúng SHA');
}
function onExport(detail={}){
  if(detail.schema!==EVENT_SCHEMA)return;logEvent('export',detail);
  if(detail.kind==='full-scan-xlsx'){
    const ok=detail.ok===true&&detail.documentCount>0&&sameSha(detail.build?.commit)&&sameSha(detail.sourceSha)&&detail.safety?.productionMutationAllowed===false&&detail.safety?.calculationEngineMutationAllowed===false;
    mark('P4_FULL_SCAN_XLSX',{build:detail.build,fileName:detail.fileName||'',documentCount:detail.documentCount,variables:detail.variables||[],candidateCount:detail.candidateCount??0,sourceSha:detail.sourceSha||''},ok,ok?'':'Workbook full-scan chưa đủ evidence/dúng SHA');
  }
  if(detail.kind==='pdf-region-xlsx'){
    const src=sourceEvidence(detail.source||{}),trust=detail.trust||{};
    const ok=detail.ok===true&&Boolean(src.file)&&Number(src.page)>0&&isRegionBox(src.bbox)&&sameSha(src.sourceSha)&&trust.calculationEligible===false&&detail.safety?.productionMutationAllowed===false&&detail.safety?.calculationEngineMutationAllowed===false;
    mark('P4_PDF_REGION_XLSX',{fileName:detail.fileName||'',source:src,trust:{semanticState:trust.semanticState||'',calculationEligible:trust.calculationEligible===true,excelFormulaEligible:trust.excelFormulaEligible===true,requiresReview:trust.requiresReview===true,reason:trust.reason||''},textPreview:clipText(detail.textPreview||'',300)},ok,ok?'':'Phải xuất từ vùng PDF thật (không phải cả trang), đủ file/page/bbox/sourceSha và vẫn chặn Calculation Engine');
  }
  if(detail.kind==='image-review-xlsx'){
    const src=sourceEvidence(detail.source||{}),trust=detail.trust||{};
    const ok=detail.ok===true&&src.sourceType==='image'&&Boolean(src.file)&&Number(detail.parameterCount)>0&&sameSha(src.sourceSha)&&trust.calculationEligible===false&&detail.safety?.productionMutationAllowed===false&&detail.safety?.calculationEngineMutationAllowed===false;
    mark('P4_IMAGE_REVIEW_XLSX',{fileName:detail.fileName||'',source:src,parameterCount:detail.parameterCount||0,figureCount:detail.figureCount||0,trust:{semanticState:trust.semanticState||'',calculationEligible:trust.calculationEligible===true,requiresReview:trust.requiresReview===true,reason:trust.reason||''}},ok,ok?'':'Cần ảnh thật có ít nhất 1 trường kỹ thuật và Calculation Engine phải bị chặn');
  }
}
function exportJson(){
  const data={...state,exportedAt:now(),caseOrder:CASES.map(([id])=>id)};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`HNL_P4_RUNTIME_GOLDEN_${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1200);
}
function reset(){if(!confirm('Xóa toàn bộ evidence P4 Runtime Golden trên trình duyệt này?'))return;state=fresh();localStorage.setItem(KEY,JSON.stringify(state));preflight();render();}
function esc(s=''){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function ensureStyle(){if(document.querySelector('#hnl-p4-runtime-style'))return;const st=document.createElement('style');st.id='hnl-p4-runtime-style';st.textContent=`.hnl-p4-runtime{position:fixed;left:12px;bottom:12px;z-index:2147483000;width:min(560px,calc(100vw - 24px));max-height:min(760px,calc(100vh - 24px));overflow:auto;background:#fff;color:#14213d;border:2px solid #17365d;border-radius:14px;box-shadow:0 18px 52px #0005;font:13px/1.45 system-ui}.hnl-p4-runtime header{position:sticky;top:0;display:flex;align-items:center;gap:8px;background:#17365d;color:#fff;padding:10px 12px;z-index:2}.hnl-p4-runtime header b{flex:1}.hnl-p4-runtime header button{border:0;background:transparent;color:#fff;font-size:18px;cursor:pointer}.hnl-p4-runtime .b{padding:12px}.hnl-p4-runtime .env{font-size:11px;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:7px}.hnl-p4-runtime .case{display:grid;grid-template-columns:28px 1fr auto;gap:8px;align-items:start;padding:8px 0;border-bottom:1px solid #e5e7eb}.hnl-p4-runtime .dot{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-weight:800;background:#e5e7eb}.hnl-p4-runtime .pass .dot{background:#dcfce7;color:#166534}.hnl-p4-runtime .review .dot{background:#ffedd5;color:#9a3412}.hnl-p4-runtime .state{font-size:10px;font-weight:800;border-radius:999px;padding:2px 6px;background:#eef2ff}.hnl-p4-runtime .steps{margin:10px 0;padding:9px 10px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px}.hnl-p4-runtime .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.hnl-p4-runtime .row button{border:0;border-radius:8px;padding:8px 10px;font-weight:700;cursor:pointer}.hnl-p4-runtime .primary{background:#166534;color:#fff}.hnl-p4-runtime .secondary{background:#e2e8f0;color:#172033}.hnl-p4-runtime .complete{background:#ecfdf5;border:1px solid #86efac;border-radius:8px;padding:9px;margin-top:10px;font-weight:700}`;document.head.appendChild(st);}
function open(){ensureStyle();if(panel?.isConnected){panel.style.display='block';render();return;}panel=document.createElement('section');panel.className='hnl-p4-runtime';document.body.appendChild(panel);render();}
function render(){if(!panel?.isConnected)return;const pass=CASES.filter(([id])=>state.cases[id]?.state==='RUNTIME_PASS').length;const env=state.environment||{};panel.innerHTML=`<header><b>P4 Runtime Golden · ${pass}/${CASES.length}</b><span>SHADOW</span><button data-x>×</button></header><div class="b"><div class="env">Web: <b>${esc(location.host)}</b><br>SHA: <code>${esc(env.commitShort||env.commit||'—')}</code> · ${esc(env.target||'—')} · Search Brain ${esc(env.searchBrain||'—')} ${esc(env.searchBrainStatus||'')}</div><div class="steps"><b>Thứ tự thao tác thật</b><br>1) Nhập/mở ít nhất 1 PDF thật → <b>PDF → Excel</b> → Quét.<br>2) Bấm <b>Xuất Excel REVIEW</b> của kết quả quét.<br>3) Trong PDF dùng chọn vùng/OCR vùng, kéo một vùng nhỏ thật → <b>Xuất Excel thông minh</b>.<br>4) Tải một ảnh kỹ thuật thật vào AI, chờ card Image Engineering có trường → <b>⇩ Xuất Excel REVIEW</b>.<br><small>Panel chỉ quan sát. Không tự gọi OCR/Vision, không tự nâng VERIFIED, không gọi Calculation Engine.</small></div>${CASES.map(([id,title],i)=>{const c=state.cases[id]||{};const cls=c.state==='RUNTIME_PASS'?'pass':c.state==='REVIEW'?'review':'';return `<div class="case ${cls}"><div class="dot">${c.state==='RUNTIME_PASS'?'✓':c.state==='REVIEW'?'!':i+1}</div><div><b>${esc(title)}</b><div style="font-size:11px;color:#64748b">${esc(c.evidence?.reason||c.capturedAt||'Chưa ghi evidence')}</div></div><span class="state">${esc(c.state||'PENDING')}</span></div>`}).join('')}${pass===CASES.length?'<div class="complete">ĐỦ 5/5 RUNTIME EVIDENCE · Có thể xuất JSON để audit cuối.</div>':''}<div class="row"><button class="primary" data-export ${pass===CASES.length?'':'disabled'}>Xuất evidence JSON</button><button class="secondary" data-reset>Reset Runtime</button></div></div>`;panel.querySelector('[data-x]').onclick=()=>panel.style.display='none';panel.querySelector('[data-export]').onclick=exportJson;panel.querySelector('[data-reset]').onclick=reset;}
function install(){window.addEventListener('hnl:p4-runtime-scan',e=>onScan(e.detail||{}));window.addEventListener('hnl:p4-runtime-export',e=>onExport(e.detail||{}));window.addEventListener('keydown',e=>{if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==='x'){e.preventDefault();open();}});if(new URLSearchParams(location.search).get('p4golden')==='1')open();window.__HNL_P4_RUNTIME_GOLDEN__={open,exportJson,getState:()=>JSON.parse(JSON.stringify(state)),reset};preflight();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
