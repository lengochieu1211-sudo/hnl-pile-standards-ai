import './real-pdf-golden-ui.css';
import { getDocuments } from '../db.js';
import {
  cropCanvasRegionToBase64,
  extractTextFromLayerRegion,
  ocrImageBase64Locally
} from '../pdf.js';
import { assessRegionText } from './region-selective-core.js';
import { REAL_PDF_CORPUS, REAL_PDF_DOCUMENTS, REAL_PDF_CASES } from './real-pdf-golden-corpus.js';
import {
  anchorCoverage,
  buildEvidenceReport,
  compareCandidateMatrix,
  findCorpusDocument,
  normalizeBbox,
  normalizeCandidate
} from './real-pdf-golden-core.js';

const STORE_KEY = 'hnl:p32-real-pdf-golden-v1';
const P32_NAME = 'P3.2 Real PDF UI Golden';
const DEEPOCR_TIMEOUT_MS = 150_000;
let panel = null;
let selectedCaseId = REAL_PDF_CASES[0]?.id || '';
let runsByCase = loadRuns();

function esc(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function loadRuns() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function saveRuns() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(runsByCase)); } catch {}
}

function setActive(value) {
  window.__HNL_P32_REAL_GOLDEN_ACTIVE__ = Boolean(value);
  document.documentElement.dataset.hnlP32 = value ? 'active' : 'off';
  if (value) renderPanel();
  else panel?.remove(), panel = null;
}

function isActive() {
  return Boolean(window.__HNL_P32_REAL_GOLDEN_ACTIVE__);
}

function localShadowOrigin() {
  try {
    const host = String(location.hostname || '').toLowerCase();
    if (!['127.0.0.1', 'localhost', '::1'].includes(host)) return null;
    const basePort = Number(location.port || 0);
    if (!Number.isInteger(basePort) || basePort < 8787 || basePort > 8799) return null;
    return `http://127.0.0.1:${basePort + 1000}`;
  } catch { return null; }
}

function caseDef() {
  return REAL_PDF_CASES.find(item => item.id === selectedCaseId) || REAL_PDF_CASES[0] || null;
}

async function docForFingerprint(fingerprint) {
  try {
    const docs = await getDocuments();
    return docs.find(doc => doc?.fingerprint && doc.fingerprint === fingerprint) || null;
  } catch { return null; }
}

function sourceRectFromReport(report) {
  const rect = report?.provenance?.pageRectCss;
  if (rect && [rect.x, rect.y, rect.width, rect.height].every(v => Number.isFinite(Number(v)))) {
    return { x:Number(rect.x), y:Number(rect.y), width:Number(rect.width), height:Number(rect.height) };
  }
  const box = normalizeBbox(report?.provenance?.normalizedBbox);
  const size = report?.provenance?.pageSizeCss || {};
  if (!box || !Number(size.width) || !Number(size.height)) return null;
  return {
    x: box[0] * Number(size.width),
    y: box[1] * Number(size.height),
    width: (box[2] - box[0]) * Number(size.width),
    height: (box[3] - box[1]) * Number(size.height)
  };
}

function livePageShell(page) {
  return [...document.querySelectorAll('.pdf-page-shell')]
    .find(shell => Number(shell.dataset.page || 0) === Number(page || 0)) || null;
}

async function callDeepDoc(image, meta = {}) {
  const origin = localShadowOrigin();
  if (!origin) return { available:false, engine:'deepdoc-vietocr-region', code:'DESKTOP_ONLY', text:'', confidenceUsable:false };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEEPOCR_TIMEOUT_MS);
  const started = performance.now();
  try {
    const response = await fetch(`${origin}/api/pdf-intelligence/region-ocr`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      signal:controller.signal,
      body:JSON.stringify({ image, page:Number(meta.page)||0, fingerprint:meta.fingerprint||null, regionKind:meta.regionKind||'auto' })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.available === false) {
      return {
        available:false, engine:'deepdoc-vietocr-region',
        code:data?.code || `HTTP_${response.status}`,
        text:String(data?.text || ''),
        confidence:null, confidenceUsable:false,
        elapsedMs:Math.round(performance.now()-started)
      };
    }
    return {
      available:true,
      engine:'deepdoc-vietocr-region',
      text:String(data?.text || ''),
      confidence:null,
      confidenceUsable:false,
      elapsedMs:Math.round(performance.now()-started),
      ocrLines:Array.isArray(data?.ocrLines) ? data.ocrLines : []
    };
  } catch (error) {
    return {
      available:false, engine:'deepdoc-vietocr-region',
      code:error?.name === 'AbortError' ? 'TIMEOUT' : 'UNAVAILABLE',
      text:'', confidence:null, confidenceUsable:false,
      elapsedMs:Math.round(performance.now()-started)
    };
  } finally { clearTimeout(timer); }
}

async function buildCandidateMatrix(detail, currentSource, caseItem) {
  const page = Number(detail?.page || detail?.provenance?.page || 0);
  const shell = livePageShell(page);
  const canvas = shell?.querySelector('canvas');
  const textLayer = shell?.querySelector('.pdf-text-layer');
  const rect = sourceRectFromReport(detail);
  const anchors = caseItem?.anchorsAny || [];
  const candidates = [];

  let nativeText = '';
  if (textLayer && rect) nativeText = String(extractTextFromLayerRegion(textLayer, rect) || '');
  const nativeQuality = assessRegionText(nativeText, { kind:'auto' });
  candidates.push(normalizeCandidate({
    engine:'pdfjs-native-region', available:Boolean(nativeText.trim()), text:nativeText,
    quality:nativeQuality, confidence:null, confidenceUsable:false
  }, anchors));

  let image = currentSource?.image?.data ? currentSource.image : null;
  if (!image && canvas && rect) {
    try { image = cropCanvasRegionToBase64(canvas, rect, { maxPixels:1_800_000, quality:.88 }); } catch {}
  }

  if (image?.data) {
    const deep = await callDeepDoc(image, { page, fingerprint:detail?.provenance?.fingerprint });
    deep.quality = assessRegionText(deep.text || '', { kind:'auto' });
    candidates.push(normalizeCandidate(deep, anchors));

    const started = performance.now();
    const local = await ocrImageBase64Locally(image);
    candidates.push(normalizeCandidate({
      engine:'chromium-textdetector-region',
      available:Boolean(local?.available),
      code:local?.available ? null : 'TEXTDETECTOR_UNAVAILABLE',
      text:String(local?.text || ''),
      quality:assessRegionText(local?.text || '', { kind:'auto' }),
      confidence:null, confidenceUsable:false,
      elapsedMs:Math.round(performance.now()-started)
    }, anchors));
  } else {
    candidates.push(normalizeCandidate({engine:'deepdoc-vietocr-region',available:false,code:'NO_REGION_IMAGE',text:'',confidenceUsable:false}, anchors));
    candidates.push(normalizeCandidate({engine:'chromium-textdetector-region',available:false,code:'NO_REGION_IMAGE',text:'',confidenceUsable:false}, anchors));
  }

  // Vision is NEVER called by P3.2. It is recorded only when Production already
  // obtained a Vision result after the user's explicit consent.
  const visionReused = currentSource?.method === 'vision-ai' && String(currentSource?.text || '').trim();
  candidates.push(normalizeCandidate({
    engine:'vision-region-reused',
    available:Boolean(visionReused),
    code:visionReused ? null : 'NOT_PREVIOUSLY_USED',
    text:visionReused ? String(currentSource.text) : '',
    quality:assessRegionText(visionReused ? currentSource.text : '', { kind:'auto' }),
    confidence:null,
    confidenceUsable:false,
    reusedExistingVision:Boolean(visionReused)
  }, anchors));

  return { candidates, comparisons:compareCandidateMatrix(candidates) };
}

function bestAnchorRatio(candidates = []) {
  const values = candidates.map(x => x?.anchorCoverage?.ratio).filter(v => Number.isFinite(Number(v))).map(Number);
  return values.length ? Math.max(...values) : null;
}

async function capture(detail) {
  if (!isActive()) return;
  const c = caseDef();
  if (!c) return;

  const fingerprint = detail?.provenance?.fingerprint || null;
  const doc = await docForFingerprint(fingerprint);
  const corpusDoc = doc ? findCorpusDocument(doc, REAL_PDF_DOCUMENTS) : null;
  const popup = document.querySelector('.pdf-selection-popup');
  const currentSource = popup?._hnlSource || null;
  const matrix = await buildCandidateMatrix(detail, currentSource, c);
  const run = {
    id:`${c.id}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    p32:P32_NAME,
    caseId:c.id,
    promotionState:'SHADOW_ONLY',
    productionMutationAllowed:false,
    createdAt:new Date().toISOString(),
    fingerprint,
    document:{
      name:doc?.name || null,
      standard:doc?.standard || null,
      corpusDocumentId:corpusDoc?.id || null,
      expectedCorpusDocumentId:c.documentId,
      matched:Boolean(corpusDoc?.id === c.documentId)
    },
    page:Number(detail?.page || detail?.provenance?.page || 0),
    expectedPageHints:c.pageHints || [],
    provenance:detail?.provenance || null,
    p31SelectedRoute:detail?.selectedRoute || null,
    p31Status:detail?.status || null,
    productionUi:{
      method:currentSource?.method || detail?.currentUiMethod || null,
      text:String(currentSource?.text || '').slice(0,12000),
      visionSentByP32:false
    },
    candidates:matrix.candidates,
    candidateComparisons:matrix.comparisons,
    bestAnchorRatio:bestAnchorRatio(matrix.candidates),
    safety:{
      shadowOnly:detail?.promotionState === 'SHADOW_ONLY',
      noProductionMutation:detail?.productionMutationAllowed === false,
      visionReusedOnly:matrix.candidates.find(x=>x.engine==='vision-region-reused')?.available
        ? matrix.candidates.find(x=>x.engine==='vision-region-reused')?.reusedExistingVision === true
        : true,
      deepDocConfidenceUnusable:matrix.candidates.find(x=>x.engine==='deepdoc-vietocr-region')?.confidenceUsable === false
    }
  };
  runsByCase[c.id] ||= [];
  runsByCase[c.id].push(run);
  if (runsByCase[c.id].length > 8) runsByCase[c.id] = runsByCase[c.id].slice(-8);
  saveRuns();
  window.__HNL_P32_LAST_RUN__ = run;
  renderPanel();
}

function environment() {
  return {
    userAgent:navigator.userAgent,
    href:location.href,
    localShadowService:Boolean(localShadowOrigin()),
    capturedAt:new Date().toISOString()
  };
}

function report() {
  return buildEvidenceReport({ corpus:REAL_PDF_CORPUS, runsByCase, environment:environment() });
}

function downloadReport() {
  const data = report();
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url;
  a.download=`HNL_P3.2_REAL_PDF_UI_GOLDEN_${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function statusClass(state='') {
  if (state === 'BENCHMARKED') return 'ok';
  if (state === 'REVIEW') return 'review';
  return 'pending';
}

function renderPanel() {
  if (!isActive()) return;
  const data = report();
  if (!panel?.isConnected) {
    panel=document.createElement('aside');
    panel.className='hnl-p32-panel';
    document.body.appendChild(panel);
  }
  const c = caseDef();
  const current = data.caseResults.find(x=>x.caseId===c?.id);
  panel.innerHTML=`
    <div class="hnl-p32-head">
      <div><b>P3.2 · REAL PDF GOLDEN</b><small>SHADOW ONLY · Ctrl+Shift+G</small></div>
      <button type="button" data-act="close">×</button>
    </div>
    <div class="hnl-p32-summary">
      <b>${esc(data.overallState)}</b>
      <span>${data.caseResults.filter(x=>x.state==='BENCHMARKED').length}/${data.caseResults.length} case BENCHMARKED</span>
    </div>
    <label>Case đang ghi
      <select data-act="case">${REAL_PDF_CASES.map(item=>`<option value="${esc(item.id)}" ${item.id===selectedCaseId?'selected':''}>${esc(item.title)}</option>`).join('')}</select>
    </label>
    <div class="hnl-p32-instruction">${esc(c?.manualInstruction || '')}</div>
    <div class="hnl-p32-current ${statusClass(current?.state)}">
      <b>${esc(current?.state || 'PENDING')}</b>
      <span>${current?.capturedRuns || 0}/${current?.requiredRuns || 1} run</span>
      ${current?.zoomIou != null ? `<span>bbox IoU: ${Number(current.zoomIou).toFixed(3)}</span>`:''}
    </div>
    <div class="hnl-p32-actions">
      <button type="button" data-act="clear-case">Xóa case</button>
      <button type="button" data-act="export">Xuất evidence JSON</button>
    </div>
    <details>
      <summary>Ma trận 9 case</summary>
      <div class="hnl-p32-case-list">${data.caseResults.map(item=>`
        <button type="button" data-case="${esc(item.caseId)}" class="${statusClass(item.state)}">
          <span>${esc(item.title)}</span><b>${esc(item.state)}</b>
        </button>`).join('')}</div>
    </details>
    <div class="hnl-p32-foot">Kéo vùng bằng công cụ OCR vùng hiện có. P3.2 tự ghi Native ↔ DeepDoc ↔ Local OCR ↔ Vision-reuse + provenance/bbox. Không gửi Vision mới.</div>
  `;
  panel.querySelector('[data-act="close"]')?.addEventListener('click',()=>setActive(false));
  panel.querySelector('[data-act="case"]')?.addEventListener('change',e=>{selectedCaseId=e.target.value;renderPanel();});
  panel.querySelector('[data-act="clear-case"]')?.addEventListener('click',()=>{runsByCase[selectedCaseId]=[];saveRuns();renderPanel();});
  panel.querySelector('[data-act="export"]')?.addEventListener('click',downloadReport);
  panel.querySelectorAll('[data-case]').forEach(btn=>btn.addEventListener('click',()=>{selectedCaseId=btn.dataset.case;renderPanel();}));
  window.__HNL_P32_REPORT__=data;
  window.__HNL_P32_EXPORT__=downloadReport;
}

function install() {
  if (window.__HNL_P32_INSTALLED__) return;
  window.__HNL_P32_INSTALLED__=true;
  window.__HNL_P32_REAL_GOLDEN_ACTIVE__=false;
  window.addEventListener('hnl:p31-shadow-result', event => capture(event.detail).catch(console.warn));
  document.addEventListener('keydown', event => {
    if (event.ctrlKey && event.shiftKey && String(event.key).toLowerCase()==='g') {
      event.preventDefault();
      setActive(!isActive());
    }
  }, true);
  const params=new URLSearchParams(location.search);
  if (params.get('pdfgolden')==='1') setActive(true);
}

if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
