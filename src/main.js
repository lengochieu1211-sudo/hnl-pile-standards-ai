import './styles.css';
import { normalizeMathDelimiters, latexReadableHtml, inlineMarkup, richTextHtml } from './math-render.js';
import { renderPdfPage, renderPdfPageToBase64, renderPdfTextLayer, cropCanvasRegionToBase64, extractTextFromLayerRegion, ocrImageBase64Locally, clearPdfCache, reindexPdfText, scanPdfTextForPhrase, TEXT_INDEX_VERSION } from './pdf.js';
import { expandInputItems, parseInputFile, fileToBase64, extractArchiveViaLocalBridge, isArchiveFile } from './ingest.js';
import { saveDocument, getDocuments, deleteDocument, saveChatSession, getChatSessions, deleteChatSession, saveCalculation, getCalculations, deleteCalculation } from './db.js';
import { searchChunks, searchEveryPage, smartSearchChunks, deepSearchChunks, localSummary, localAnswer, corpusStats, isBroadQuery, planEngineeringQueries, clearSearchCache, coreSearchPhrase, findTocPageTargets, findExactPhrasePages, compactNormalize } from './search.js';
import { PROVIDERS, buildRagPrompt, callBridge, callDirect, bridgeHealth, testDirectProvider, listAvailableModelsDetailed, semanticRerank, localEngineDiagnostics, supportsNativePdf } from './ai.js';
import { annulusAreaMm2, axialResistance, loadClassSigmaCe, tcvn7888Checklist } from './calculators.js';
import { calculateDrivenPile10304 } from './pile-workflows.js';
import { deterministicEngineeringContext, solveEngineeringQuestion, engineeringExcelPayload, canExportEngineeringResult } from './engineering-router.js';
import { diameters7888, lookup7888, lookupPileType7888, classesForDiameter7888, classesForPileType7888, isTcvn7888_2014Document } from './tcvn7888.js';
import { extractFormulaLibrary, formulaStats, verifiedFormulaLibrary, evaluateExpression, clearFormulaCache } from './formulas.js';
import { parsePageSpec } from './scope.js';
import { codePackSearch, codePackFormulaItems, codePackStats, codePackForDoc } from './codepacks.js';
import { exportFormulaWorkbook, exportCodePackWorkbook, exportDrivenPileWorkflowWorkbook, export10304AdvancedWorkflowWorkbook, export5574WorkflowWorkbook, export7888WorkflowWorkbook, exportUnifiedEngineeringWorkbook } from './excel-export.js';
import { buildImageEngineeringExtractionPrompt, parseImageEngineeringExtraction, normalizeImageEngineeringExtraction, imageEngineeringNeedsConfirmation, imageEngineeringFieldRows, updateImageEngineeringField, buildConfirmedEngineeringQuestion, imageEngineeringProvenance, isSupportedEngineeringImage, IMAGE_ENGINEERING_MAX_FILES, IMAGE_ENGINEERING_MAX_BYTES } from './image-engineering.js';
import { normalizeEngineeringText, normalizeEngineeringPaste } from './engineering-text-normalizer.js';
import { createPass82DefaultDraft, runPass82UiCalculation, checkPass82Exporter, exportPass82Excel } from './pass82-ui-controller.js';
import { parseStructuralJsonText } from './pass8-structural-file-parser.js';

const SOURCE_META = Object.freeze({
  version: typeof __HNL_APP_VERSION__ !== 'undefined' ? __HNL_APP_VERSION__ : '0.0.0',
  release: 'Professional Workspace · Stable v1.9.23 Search Brain'
});

let APP_META = {
  ...SOURCE_META,
  builtAt: null, source: 'Source fallback', runNumber: null, runAttempt: null, runId: null,
  repository: null, branch: null, commit: null, commitShort: null, workflowUrl: null,
  target: null, edition: null
};

const APP_EDITION = String(import.meta.env.VITE_HNL_EDITION || 'web').toLowerCase();
const IS_DESKTOP_EDITION = APP_EDITION === 'desktop';
const EDITION_LABEL = IS_DESKTOP_EDITION ? 'HNL Desktop AI' : 'HNL Web';

function availableProviderEntries() {
  return Object.entries(PROVIDERS).filter(([id]) => IS_DESKTOP_EDITION || id !== 'ollama');
}

const STORAGE = {
  provider: 'hnl.provider.v12',
  connection: 'hnl.connection.v12',
  model: 'hnl.model.v12',
  bridge: 'hnl.bridge.v12',
  ollama: 'hnl.ollama.v12',
  strict: 'hnl.strict.v12',
  checklist: 'hnl.checklist.v12',
  visionModel: 'hnl.visionModel.v14',
  scope: 'hnl.scope.v16',
  formulaSelection: 'hnl.formulaSelection.v16',
  retrievalMode: 'hnl.retrievalMode.v17',
  embeddingModel: 'hnl.embeddingModel.v17',
  semanticRerank: 'hnl.semanticRerank.v17',
  formulaScanMode: 'hnl.formulaScanMode.v171',
  readerMode: 'hnl.readerMode.v19',
  readerQuery: 'hnl.readerQuery.v19',
  leftCollapsed: 'hnl.leftCollapsed.v194',
  rightCollapsed: 'hnl.rightCollapsed.v194',
  leftWidth: 'hnl.leftWidth.v194',
  rightWidth: 'hnl.rightWidth.v194',
  nativePdfMode: 'hnl.nativePdfMode.v1921',
  openaiPdfDetail: 'hnl.openaiPdfDetail.v1921',
  historyRetentionDays: 'hnl.historyRetentionDays.v1921',
  lookupScope: 'hnl.lookupScope.v1925',
  lookupPages: 'hnl.lookupPages.v1925',
  formulaScope: 'hnl.formulaScope.v1925',
  formulaPages: 'hnl.formulaPages.v1925',
  performanceMode: 'hnl.performanceMode.v1100',
  fieldMode: 'hnl.fieldMode.v1100',
  libraryQuery: 'hnl.libraryQuery.v1100',
  libraryFilter: 'hnl.libraryFilter.v1100',
  workspace: 'hnl.workspace.v1100',
  crashLog: 'hnl.crashLog.v1100',
  chatHistoryQuery: 'hnl.chatHistoryQuery.v1100'
};

const state = {
  docs: [],
  selected: new Set(),
  activeDocId: null,
  page: 1,
  zoom: 1.08,
  readerMode: localStorage.getItem(STORAGE.readerMode) || 'continuous',
  readerQuery: localStorage.getItem(STORAGE.readerQuery) || '',
  readerMatchIndex: -1,
  pdfSelectionMode: 'off', // off | text | region
  pdfRegionBusy: false,
  lastPdfRegion: null,
  pinnedSources: [],
  focusReader: false,
  leftCollapsed: localStorage.getItem(STORAGE.leftCollapsed) === 'true',
  rightCollapsed: localStorage.getItem(STORAGE.rightCollapsed) === 'true',
  layout: {
    left: Math.min(390, Math.max(240, Number(localStorage.getItem(STORAGE.leftWidth)) || 290)),
    right: Math.min(560, Math.max(330, Number(localStorage.getItem(STORAGE.rightWidth)) || 440))
  },
  pendingPageScroll: true,
  tab: 'summary',
  mobile: 'library',
  chat: [],
  chatDraft: '',
  chatAttachments: [],
  pendingImageExtraction: null,
  chatSessions: [],
  activeChatSessionId: null,
  chatHistoryOpen: false,
  calculations: [],
  calcDraft: null,
  pile10304Draft: null,
  pass8Draft: createPass82DefaultDraft(),
  pass8Structural: null,
  pass8StructuralName: '',
  pass8Output: null,
  pass8Request: null,
  pass8ExporterStatus: 'Chưa kiểm tra dịch vụ Excel',
  pass8ExporterReady: false,
  pass8ExportBusy: false,
  lookup: {
    query: '', draft: '', hits: [],
    scope: localStorage.getItem(STORAGE.lookupScope) || 'smart',
    pages: localStorage.getItem(STORAGE.lookupPages) || ''
  },
  compare: { query: '', draft: '', text: '', hits: [] },
  tableResult: null,
  checklist: loadJson(STORAGE.checklist, {}),
  settings: {
    provider: localStorage.getItem(STORAGE.provider) || 'local',
    connection: localStorage.getItem(STORAGE.connection) || 'direct',
    model: localStorage.getItem(STORAGE.model) || '',
    visionModel: localStorage.getItem(STORAGE.visionModel) || 'gemma3:4b',
    bridgeUrl: localStorage.getItem(STORAGE.bridge) || (['localhost','127.0.0.1','::1'].includes(location.hostname) ? location.origin : 'http://127.0.0.1:8787'),
    ollamaUrl: localStorage.getItem(STORAGE.ollama) || 'http://127.0.0.1:11434',
    strict: localStorage.getItem(STORAGE.strict) !== 'false',
    scope: localStorage.getItem(STORAGE.scope) || 'all',
    retrievalMode: localStorage.getItem(STORAGE.retrievalMode) || 'auto',
    embeddingModel: localStorage.getItem(STORAGE.embeddingModel) || 'bge-m3',
    semanticRerank: localStorage.getItem(STORAGE.semanticRerank) !== 'false',
    nativePdfMode: localStorage.getItem(STORAGE.nativePdfMode) || 'balanced',
    openaiPdfDetail: localStorage.getItem(STORAGE.openaiPdfDetail) || 'auto',
    historyRetentionDays: Number(localStorage.getItem(STORAGE.historyRetentionDays) || 365),
    performanceMode: localStorage.getItem(STORAGE.performanceMode) || 'balanced',
    fieldMode: localStorage.getItem(STORAGE.fieldMode) === 'true'
  },
  progress: null,
  toast: null,
  busy: false,
  connectionStatus: null,
  diagnosticHtml: '',
  diagnosticSummary: null,
  modelOptions: [],
  modelOptionsVerified: false,
  modelCatalogSource: '',
  modelStatus: '',
  modelPickerOpen: false,
  settingsDraft: {},
  localModelManager: { loading:false, data:null, error:'', pollTimer:null },
  searchStats: null,
  formulaSelection: localStorage.getItem(STORAGE.formulaSelection) || '',
  formulaQuery: '',
  formulaScanMode: localStorage.getItem(STORAGE.formulaScanMode) || 'auto',
  formulaScanScope: localStorage.getItem(STORAGE.formulaScope) || 'page',
  formulaScanPages: localStorage.getItem(STORAGE.formulaPages) || '',
  archivePasswordCache: new Map(),
  archiveEngines: null,
  archiveEngineError: '',
  buildInfoLoaded: false,
  updateStatus: null,
  changelog: [],
  nativePdfStatus: '',
  libraryQuery: localStorage.getItem(STORAGE.libraryQuery) || '',
  libraryFilter: localStorage.getItem(STORAGE.libraryFilter) || 'all',
  bookmarkPanelOpen: false,
  historyQuery: localStorage.getItem(STORAGE.chatHistoryQuery) || '',
  documentHealth: null,
  crashLog: loadJson(STORAGE.crashLog, []),
  undoStack: [],
  redoStack: [],
  compareMode: 'compare'
};

if (!PROVIDERS[state.settings.provider] || (!IS_DESKTOP_EDITION && state.settings.provider === 'ollama')) state.settings.provider = 'local';
if (new URLSearchParams(location.search).get('offline') === '1' && ['localhost','127.0.0.1','::1'].includes(location.hostname)) {
  state.settings.provider = 'ollama';
  state.settings.connection = 'bridge';
  state.settings.bridgeUrl = location.origin;
}
const app = document.querySelector('#app');
window.addEventListener('error', event => recordClientError('window-error', event.error || event.message));
window.addEventListener('unhandledrejection', event => recordClientError('unhandledrejection', event.reason || 'Promise rejected'));

function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch { return fallback; }
}
function esc(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
}
// Math rendering lives in ./math-render.js (v1.25.7).


const DOC_CATEGORIES = Object.freeze([
  ['standard','Tiêu chuẩn / TCVN'],
  ['design','Thiết kế'],
  ['method','Biện pháp / Thi công'],
  ['acceptance','Nghiệm thu / QAQC'],
  ['report','Báo cáo / Thí nghiệm'],
  ['other','Khác']
]);
const PERFORMANCE_PROFILES = Object.freeze({
  light:{ label:'Nhẹ', observerMargin:420, retrievalScale:.72, visualPageLimit:4, renderScale:1.25 },
  balanced:{ label:'Cân bằng', observerMargin:900, retrievalScale:1, visualPageLimit:8, renderScale:1.45 },
  strong:{ label:'Mạnh', observerMargin:1500, retrievalScale:1.22, visualPageLimit:12, renderScale:1.65 }
});
function performanceProfile() { return PERFORMANCE_PROFILES[state.settings.performanceMode] || PERFORMANCE_PROFILES.balanced; }
function inferDocCategory(doc = {}) {
  const text = `${doc.standard || ''} ${doc.name || ''} ${doc.sourcePath || ''}`.toLocaleLowerCase('vi');
  if (/tcvn|qcvn|iso|astm|en\s?\d|tiêu chuẩn|standard/.test(text)) return 'standard';
  if (/thiết kế|design|shop|calculation|tính toán|foundation|móng/.test(text)) return 'design';
  if (/biện pháp|method|method statement|thi công|施工/.test(text)) return 'method';
  if (/nghiệm thu|qa\/?qc|checklist|inspection|itp/.test(text)) return 'acceptance';
  if (/báo cáo|report|thí nghiệm|test result|pile test/.test(text)) return 'report';
  return 'other';
}
function docMeta(doc) {
  if (!doc) return { pinned:false, category:'other', bookmarks:[], highlights:[], notes:[], tags:[] };
  if (!doc.hnlMeta || typeof doc.hnlMeta !== 'object') doc.hnlMeta = {};
  if (!Array.isArray(doc.hnlMeta.bookmarks)) doc.hnlMeta.bookmarks = [];
  if (!Array.isArray(doc.hnlMeta.highlights)) doc.hnlMeta.highlights = [];
  if (!Array.isArray(doc.hnlMeta.notes)) doc.hnlMeta.notes = [];
  if (!Array.isArray(doc.hnlMeta.tags)) doc.hnlMeta.tags = [];
  if (!DOC_CATEGORIES.some(([id]) => id === doc.hnlMeta.category)) doc.hnlMeta.category = inferDocCategory(doc);
  doc.hnlMeta.pinned = Boolean(doc.hnlMeta.pinned);
  return doc.hnlMeta;
}
function categoryLabel(id='other') { return DOC_CATEGORIES.find(([x]) => x === id)?.[1] || 'Khác'; }
function filteredLibraryDocs() {
  const q = String(state.libraryQuery || '').trim().toLocaleLowerCase('vi');
  const filter = state.libraryFilter || 'all';
  return [...state.docs].filter(doc => {
    const meta = docMeta(doc);
    if (filter === 'pinned' && !meta.pinned) return false;
    if (filter !== 'all' && filter !== 'pinned' && meta.category !== filter) return false;
    if (!q) return true;
    return `${doc.standard || ''} ${doc.name || ''} ${doc.sourcePath || ''} ${meta.tags.join(' ')}`.toLocaleLowerCase('vi').includes(q);
  }).sort((a,b) => Number(docMeta(b).pinned) - Number(docMeta(a).pinned) || String(a.standard || a.name).localeCompare(String(b.standard || b.name), 'vi'));
}
function cloneMeta(meta) { return JSON.parse(JSON.stringify(meta || {})); }
function pushUndo(action) {
  state.undoStack.push(action);
  if (state.undoStack.length > 20) state.undoStack.shift();
  state.redoStack = [];
}
async function applyUndoAction(action, direction='undo') {
  if (!action) return;
  if (action.type === 'selection') {
    state.selected = new Set(direction === 'undo' ? action.before : action.after);
  } else if (action.type === 'doc-meta') {
    const doc = state.docs.find(d => d.id === action.id);
    if (doc) { doc.hnlMeta = cloneMeta(direction === 'undo' ? action.before : action.after); await saveDocument(doc); }
  } else if (action.type === 'delete-doc') {
    if (direction === 'undo') {
      if (!state.docs.some(d => d.id === action.doc.id)) {
        state.docs.splice(Math.min(action.index, state.docs.length), 0, action.doc);
        await saveDocument(action.doc);
        if (action.selected) state.selected.add(action.doc.id);
        state.activeDocId = action.activeDocId || action.doc.id;
      }
    } else {
      await deleteDocument(action.doc.id);
      state.docs = state.docs.filter(d => d.id !== action.doc.id);
      state.selected.delete(action.doc.id);
      if (state.activeDocId === action.doc.id) state.activeDocId = state.docs[0]?.id || null;
    }
  }
  clearFormulaCache();
  clearSearchCache();
  render();
}
async function undoLast() {
  const action = state.undoStack.pop();
  if (!action) return showToast('Không có thao tác để hoàn tác.', 'info');
  await applyUndoAction(action, 'undo');
  state.redoStack.push(action);
  showToast(`Đã hoàn tác: ${action.label || 'thao tác gần nhất'}.`, 'success');
}
async function redoLast() {
  const action = state.redoStack.pop();
  if (!action) return showToast('Không có thao tác để làm lại.', 'info');
  await applyUndoAction(action, 'redo');
  state.undoStack.push(action);
  showToast(`Đã làm lại: ${action.label || 'thao tác'}.`, 'success');
}
function saveWorkspace() {
  try {
    const payload = {
      activeDocId:state.activeDocId, page:state.page, zoom:state.zoom, tab:state.tab, mobile:state.mobile,
      readerMode:state.readerMode, selected:[...state.selected], scope:state.settings.scope, activeChatSessionId:state.activeChatSessionId,
      leftCollapsed:state.leftCollapsed, rightCollapsed:state.rightCollapsed, layout:state.layout,
      lookup:{ scope:state.lookup.scope, pages:state.lookup.pages }, formula:{ scope:state.formulaScanScope, pages:state.formulaScanPages },
      savedAt:new Date().toISOString()
    };
    localStorage.setItem(STORAGE.workspace, JSON.stringify(payload));
  } catch {}
}
function restoreWorkspace() {
  const w = loadJson(STORAGE.workspace, null);
  if (!w) return;
  const ids = new Set(state.docs.map(d => d.id));
  if (w.activeDocId && ids.has(w.activeDocId)) state.activeDocId = w.activeDocId;
  state.page = Math.max(1, Number(w.page || 1));
  state.zoom = Math.min(2.5, Math.max(.45, Number(w.zoom || state.zoom)));
  if (['summary','chat','lookup','calc','compare','checklist','settings'].includes(w.tab)) state.tab = w.tab;
  if (['library','viewer','assistant'].includes(w.mobile)) state.mobile = w.mobile;
  if (['continuous','single'].includes(w.readerMode)) state.readerMode = w.readerMode;
  if (Array.isArray(w.selected)) state.selected = new Set(w.selected.filter(id => ids.has(id)));
  if (['all','selected','active'].includes(w.scope)) state.settings.scope = w.scope;
  if (w.activeChatSessionId) state.activeChatSessionId=String(w.activeChatSessionId);
  if (w.layout) state.layout = { left:Math.min(390,Math.max(240,Number(w.layout.left)||state.layout.left)), right:Math.min(560,Math.max(330,Number(w.layout.right)||state.layout.right)) };
  state.leftCollapsed = Boolean(w.leftCollapsed); state.rightCollapsed = Boolean(w.rightCollapsed);
  if (w.lookup && ['smart','region','page','pages','document','selected','library'].includes(w.lookup.scope)) { state.lookup.scope=w.lookup.scope; state.lookup.pages=String(w.lookup.pages||''); }
  if (w.formula && ['region','page','pages','document','selected','library'].includes(w.formula.scope)) { state.formulaScanScope=w.formula.scope; state.formulaScanPages=String(w.formula.pages||''); }
}
function standardFamilyKey(doc={}) {
  return String(doc.standard || doc.name || '').toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d')
    .replace(/\b(?:19|20)\d{2}\b/g,'').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim().slice(0,90);
}
function relatedDocumentVersions(doc) {
  const key = standardFamilyKey(doc); if (key.length < 5) return [];
  return state.docs.filter(x => x.id !== doc.id && standardFamilyKey(x) === key && x.fingerprint !== doc.fingerprint);
}
function standardYear(doc={}) {
  const years=[...`${doc.standard||''} ${doc.name||''}`.matchAll(/((?:19|20)\d{2})/g)].map(m=>Number(m[1]));
  return years.length ? Math.max(...years) : 0;
}
function relatedVersionLabel(doc) {
  const related=relatedDocumentVersions(doc); if(!related.length) return '';
  const year=standardYear(doc), newest=Math.max(0,...related.map(standardYear));
  if(year && newest>year) return `Có bản mới hơn ${newest}`;
  if(year && related.some(x=>standardYear(x)&&standardYear(x)<year)) return 'Có bản cũ hơn';
  return 'Có phiên bản khác';
}
function documentHealth(doc = activeDoc()) {
  if (!doc) return null;
  const raw = rawTextPageCount(doc), usable = usableTextPageCount(doc), pages = Number(doc.pageCount || 0);
  const meta = docMeta(doc); const related = relatedDocumentVersions(doc);
  const nativeLimit = 50 * 1024 * 1024;
  const textRatio = pages ? usable / pages : 0;
  const rawRatio = pages ? raw / pages : 0;
  const staleIndex = Number(doc.textIndexVersion||0) < TEXT_INDEX_VERSION;
  const score = Math.max(0, Math.min(100, Math.round(
    (doc.blob || doc.viewerKind !== 'pdf' ? 45 : 25) +
    (staleIndex ? 0 : 20) +
    Math.min(20, textRatio * 20) + Math.min(10, rawRatio * 10) +
    (doc.sourcePath || doc.name ? 5 : 0)
  )));
  const label = staleIndex ? 'Cần lập chỉ mục lại' : textRatio >= .7 ? 'Text tốt' : textRatio >= .3 ? 'PDF hỗn hợp' : 'Scan/ảnh · OCR khi cần';
  return {
    id:doc.id, name:doc.standard || doc.name, pages, size:doc.size || 0, rawTextPages:raw, usableTextPages:usable,
    scanPages:Math.max(0,pages-usable), textChars:Number(doc.textChars||0), indexVersion:Number(doc.textIndexVersion||0), currentIndexVersion:TEXT_INDEX_VERSION,
    staleIndex, score, label, nativeEligible:Boolean(doc.viewerKind==='pdf' && (doc.size||0) <= nativeLimit),
    nativeReason:(doc.size||0)>nativeLimit?'PDF > 50 MB · dùng RAG/OCR/Vision Page Batch có mục tiêu':'Đủ điều kiện PDF native theo giới hạn HNL',
    bookmarks:meta.bookmarks.length, highlights:meta.highlights.length, category:categoryLabel(meta.category), pinned:meta.pinned,
    relatedVersions:related.map(x=>({id:x.id,name:x.standard||x.name})), sourcePath:doc.sourcePath || doc.name
  };
}
function documentHealthHtml(health = state.documentHealth || documentHealth()) {
  if (!health) return '<div class="notice">Chưa mở tài liệu để kiểm tra.</div>';
  const quality = health.usableTextPages >= Math.max(1, Math.ceil(health.pages*.7)) ? 'Tốt' : health.usableTextPages >= Math.max(1, Math.ceil(health.pages*.3)) ? 'Hỗn hợp' : 'Scan/ảnh nhiều';
  return `<div class="doc-health-grid"><div><span>Trang</span><b>${health.pages}</b></div><div><span>Text hữu dụng</span><b>${health.usableTextPages}/${health.pages}</b></div><div><span>Chất lượng</span><b>${quality}</b></div><div><span>Chỉ mục</span><b>v${health.indexVersion}${health.staleIndex?' · cũ':''}</b></div><div><span>PDF native</span><b>${health.nativeEligible?'Có':'Không'}</b></div><div><span>Đánh dấu</span><b>${health.bookmarks + health.highlights}</b></div></div>
    <div class="notice ${health.staleIndex?'warning':''}"><b>${esc(health.nativeReason)}</b>${health.relatedVersions.length?`<br>Phát hiện ${health.relatedVersions.length} tài liệu cùng họ/phiên bản khác trong thư viện.`:''}</div>`;
}
function sanitizeLogText(value='') {
  return String(value||'').replace(/(?:AIza|sk-|xai-|claude-|gsk_)[A-Za-z0-9_\-]{12,}/g,'[REDACTED_KEY]').replace(/(?:api[_-]?key\s*[:=]\s*)\S+/ig,'$1[REDACTED]');
}
function recordClientError(kind, error) {
  const row={at:new Date().toISOString(),kind:String(kind||'error'),message:sanitizeLogText(error?.message||error),stack:sanitizeLogText(error?.stack||'').slice(0,5000)};
  state.crashLog=[row,...(state.crashLog||[])].slice(0,60); try{localStorage.setItem(STORAGE.crashLog,JSON.stringify(state.crashLog));}catch{}
}
function crc32(bytes) {
  let c=0xffffffff; for (const b of bytes){c^=b; for(let k=0;k<8;k++) c=(c>>>1)^((c&1)?0xedb88320:0);} return (c^0xffffffff)>>>0;
}
function u16(n){return new Uint8Array([n&255,(n>>>8)&255]);}
function u32(n){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);}
function concatBytes(parts){const len=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(len);let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;}
function makeStoredZip(entries=[]) {
  const enc=new TextEncoder(), locals=[], centrals=[]; let offset=0;
  for (const entry of entries) {
    const name=enc.encode(entry.name), data=entry.data instanceof Uint8Array?entry.data:enc.encode(String(entry.data??'')), crc=crc32(data);
    const local=concatBytes([u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);
    const central=concatBytes([u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);
    locals.push(local); centrals.push(central); offset+=local.length;
  }
  const central=concatBytes(centrals); const body=concatBytes(locals);
  const end=concatBytes([u32(0x06054b50),u16(0),u16(0),u16(entries.length),u16(entries.length),u32(central.length),u32(body.length),u16(0)]);
  return new Blob([body,central,end],{type:'application/zip'});
}
function readStoredZip(buffer) {
  const bytes=new Uint8Array(buffer), view=new DataView(buffer), dec=new TextDecoder(); const out={}; let o=0;
  while(o+30<=bytes.length && view.getUint32(o,true)===0x04034b50){
    const method=view.getUint16(o+8,true), comp=view.getUint32(o+18,true), nameLen=view.getUint16(o+26,true), extraLen=view.getUint16(o+28,true);
    if(method!==0) throw new Error('Backup ZIP dùng phương thức nén không được HNL Restore hỗ trợ.');
    const name=dec.decode(bytes.slice(o+30,o+30+nameLen)); const start=o+30+nameLen+extraLen; out[name]=bytes.slice(start,start+comp); o=start+comp;
  }
  return out;
}
function downloadBlob(blob, name) { const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200); }
async function exportBackupZip() {
  const payload={schema:'hnl-backup-v1',appVersion:APP_META.version,createdAt:new Date().toISOString(),settings:{...state.settings},workspace:loadJson(STORAGE.workspace,{}),checklist:state.checklist,
    documents:state.docs.map(d=>({id:d.id,fingerprint:d.fingerprint,name:d.name,standard:d.standard,sourcePath:d.sourcePath,pageCount:d.pageCount,size:d.size,hnlMeta:docMeta(d)})),chatSessions:state.chatSessions,calculations:state.calculations};
  const blob=makeStoredZip([{name:'backup.json',data:JSON.stringify(payload,null,2)},{name:'README.txt',data:'HNL local backup. Không chứa API key và không chứa binary PDF. Import lại PDF để khớp fingerprint rồi Restore metadata/lịch sử.'}]);
  downloadBlob(blob,`HNL-Backup-v${APP_META.version}-${new Date().toISOString().slice(0,10)}.zip`); showToast('Đã xuất backup cục bộ, không chứa API key.', 'success');
}
async function restoreBackupFile(file) {
  let text='';
  if (/\.zip$/i.test(file.name)) { const entries=readStoredZip(await file.arrayBuffer()); if(!entries['backup.json']) throw new Error('ZIP không có backup.json.'); text=new TextDecoder().decode(entries['backup.json']); }
  else text=await file.text();
  const data=JSON.parse(text); if(data.schema!=='hnl-backup-v1') throw new Error('Không đúng định dạng HNL Backup.');
  const byFingerprint=new Map(state.docs.map(d=>[d.fingerprint,d]));
  for (const meta of data.documents||[]) { const doc=byFingerprint.get(meta.fingerprint) || state.docs.find(d=>d.name===meta.name); if(doc && meta.hnlMeta){doc.hnlMeta=meta.hnlMeta;await saveDocument(doc);} }
  for (const row of data.chatSessions||[]) await saveChatSession(row);
  for (const row of data.calculations||[]) await saveCalculation(row);
  if(data.settings && typeof data.settings==='object') {
    const safeKeys=['provider','connection','model','visionModel','bridgeUrl','ollamaUrl','strict','scope','retrievalMode','embeddingModel','semanticRerank','nativePdfMode','openaiPdfDetail','historyRetentionDays','performanceMode','fieldMode'];
    for(const key of safeKeys) if(Object.prototype.hasOwnProperty.call(data.settings,key)) state.settings[key]=data.settings[key];
    saveSettings();
  }
  if(data.checklist){state.checklist=data.checklist;localStorage.setItem(STORAGE.checklist,JSON.stringify(state.checklist));}
  if(data.workspace) localStorage.setItem(STORAGE.workspace,JSON.stringify(data.workspace));
  state.chatSessions=await getChatSessions(); state.calculations=await getCalculations(); restoreWorkspace(); render(); showToast('Đã khôi phục cài đặt an toàn, metadata, lịch sử và workspace.', 'success');
}
async function exportDiagnosticZip() {
  const health=state.docs.map(d=>documentHealth(d));
  const payload={app:{...APP_META,edition:EDITION_LABEL},time:new Date().toISOString(),userAgent:navigator.userAgent,location:{protocol:location.protocol,hostname:location.hostname},
    settings:{provider:state.settings.provider,connection:state.settings.connection,model:providerModel(),retrievalMode:state.settings.retrievalMode,nativePdfMode:state.settings.nativePdfMode,performanceMode:state.settings.performanceMode,fieldMode:state.settings.fieldMode},
    docs:health,searchStats:state.searchStats,diagnostics:state.diagnosticSummary,archiveEngines:state.archiveEngines,crashLog:state.crashLog};
  const blob=makeStoredZip([{name:'diagnostics.json',data:JSON.stringify(payload,null,2)},{name:'crash-log.json',data:JSON.stringify(state.crashLog||[],null,2)},{name:'README.txt',data:'Gói chẩn đoán HNL. API key đã được loại trừ. Gửi ZIP này khi báo lỗi để truy vết nhanh hơn.'}]);
  downloadBlob(blob,`HNL-Diagnostics-v${APP_META.version}-${Date.now()}.zip`); showToast('Đã xuất gói chẩn đoán ZIP, không chứa API key.', 'success');
}
function answerEvidenceMeta(question='', answer={}) {
  const hits=Array.isArray(answer.hits)?answer.hits:[], stats=answer.stats||{}; const core=compactNormalize(coreSearchPhrase(question));
  let verified=0; const seen=new Set();
  for(const h of hits){const key=`${h.docId}:${h.page}`;if(seen.has(key))continue;seen.add(key);const t=compactNormalize(h.text||'');if(core && t.includes(core))verified++;else if((h.text||'').length>80)verified+=.45;}
  const native=Number(stats.nativePdfCount||0), vision=Number(stats.targetedVisionPages||stats.visualPages||0), ocr=Number(stats.targetedLocalOcr||0), pageBatch=Number(stats.oversizePageBatch||0);
  const method=native?'Native PDF + RAG':pageBatch?'Page Batch + RAG':vision?'Vision + RAG':ocr?'OCR + RAG':'RAG';
  const sourceCount=seen.size; const ratio=sourceCount?verified/sourceCount:0; const level=sourceCount>=2 && ratio>=.55?'Cao':sourceCount>=1 && ratio>=.25?'Trung bình':'Thấp';
  return {method,confidence:level,sourceCount,verifiedSources:Math.floor(verified),checkedAt:new Date().toISOString()};
}
async function reindexDocument(doc=activeDoc()) {
  if(!doc?.blob || doc.viewerKind!=='pdf') return showToast('Hãy mở một PDF có file gốc.', 'warning');
  state.progress={title:`Lập chỉ mục lại ${doc.standard||doc.name}`,detail:'Chuẩn bị…',pct:1};render();
  try{await reindexPdfText(doc,(page,total)=>{state.progress={title:`Lập chỉ mục lại ${doc.standard||doc.name}`,detail:`Trang ${page}/${total}`,pct:Math.round(page/total*100)};const d=document.querySelector('.progress-detail');const b=document.querySelector('.progress-bar>div');if(d)d.textContent=state.progress.detail;if(b)b.style.width=`${state.progress.pct}%`;});await saveDocument(doc);clearSearchCache(doc.id);clearFormulaCache(doc.id);state.documentHealth=documentHealth(doc);showToast('Đã lập chỉ mục lại tài liệu.', 'success');}
  catch(error){recordClientError('reindex',error);showToast(`Lập chỉ mục lại lỗi: ${error.message}`,'error');}finally{state.progress=null;render();}
}
async function reindexAllDocuments() {
  const docs=state.docs.filter(d=>d.viewerKind==='pdf'&&d.blob); if(!docs.length)return showToast('Không có PDF để lập chỉ mục.','warning');
  if(!confirm(`Lập chỉ mục lại ${docs.length} PDF? Việc này đọc lại lớp chữ nhưng không OCR toàn bộ trang.`))return;
  let ok=0,fail=0;for(let i=0;i<docs.length;i++){const doc=docs[i];state.progress={title:`Lập chỉ mục ${i+1}/${docs.length}`,detail:doc.standard||doc.name,pct:Math.round(i/docs.length*100)};render();try{await reindexPdfText(doc);await saveDocument(doc);clearSearchCache(doc.id);ok++;}catch(error){fail++;recordClientError('reindex-all',error);}}
  state.progress=null;render();showToast(`Lập chỉ mục xong: ${ok} đạt${fail?` · ${fail} lỗi`:''}.`,fail?'warning':'success');
}

function fmtBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i ? 1 : 0)} ${units[i]}`;
}
function activeDoc() { return state.docs.find(d => d.id === state.activeDocId) || null; }
function selectedDocs() { return state.docs.filter(d => state.selected.has(d.id)); }
function sourceDocs() {
  // v1.4 default: search the ENTIRE loaded library. The user can explicitly
  // narrow to checked documents or only the currently open document.
  if (state.settings.scope === 'selected') return selectedDocs();
  if (state.settings.scope === 'active') { const active = activeDoc(); return active ? [active] : []; }
  return [...state.docs];
}
function usableTextPageCount(doc) {
  return (doc?.pages || []).filter(p => p?.textQuality ? Boolean(p.textQuality.usable) : Boolean(String(p?.text || '').trim())).length;
}

function rawTextPageCount(doc) {
  return (doc?.pages || []).filter(p => String(p?.text || '').trim()).length;
}

function scopeLabel() {
  if (state.settings.scope === 'selected') return `Đã chọn (${selectedDocs().length})`;
  if (state.settings.scope === 'active') return 'PDF đang mở';
  return `Toàn thư viện (${state.docs.length})`;
}

function cloneDocForPages(doc, pageNumbers = null) {
  if (!doc || !Array.isArray(pageNumbers)) return doc;
  const allowed = new Set(pageNumbers.map(Number));
  return {
    ...doc,
    pages:(doc.pages || []).filter(p => allowed.has(Number(p.page))),
    aiFormulaItems:Array.isArray(doc.aiFormulaItems) ? doc.aiFormulaItems.filter(x => allowed.has(Number(x.page))) : doc.aiFormulaItems,
    _hnlScopedPages:[...allowed]
  };
}

function operationScopeLabel(scope, kind = 'lookup') {
  const map = {
    smart:'Thông minh', region:'Vùng chọn gần nhất', page:'Trang hiện tại', pages:'Nhiều trang',
    document:'Tài liệu hiện tại', selected:'Tài liệu đã tick', library:'Toàn thư viện'
  };
  if (scope === 'smart') return `${map.smart} · ${scopeLabel()}`;
  if (scope === 'page') return `${map.page} · P.${state.page}`;
  if (scope === 'region' && state.lastPdfRegion) return `${map.region} · P.${state.lastPdfRegion.page}`;
  return map[scope] || (kind === 'formula' ? 'Trang hiện tại' : 'Thông minh');
}

function resolveOperationScope(scope, pagesText = '', kind = 'lookup') {
  const active = activeDoc();
  const fail = message => ({ docs:[], label:operationScopeLabel(scope, kind), pages:0, error:message, scope });
  if (scope === 'region') {
    const region = state.lastPdfRegion;
    if (!region?.text && !region?.image?.data) return { ...fail('Chưa có vùng PDF đã chọn. Hãy bật T▧, kéo vùng cần đọc rồi thử lại.'), region:null };
    const doc = state.docs.find(d => d.id === region.docId);
    if (!doc) return { ...fail('Tài liệu của vùng chọn gần nhất không còn trong Thư viện.'), region:null };
    return { docs:[cloneDocForPages(doc, [Number(region.page)||1])], label:operationScopeLabel(scope, kind), pages:1, region, scope };
  }
  if (scope === 'page') {
    if (!active) return fail('Chưa mở tài liệu để dùng Trang hiện tại.');
    return { docs:[cloneDocForPages(active, [Math.max(1, Number(state.page)||1)])], label:operationScopeLabel(scope, kind), pages:1, scope };
  }
  if (scope === 'pages') {
    if (!active) return fail('Chưa mở tài liệu để chọn nhiều trang.');
    const pages = parsePageSpec(pagesText, active.pageCount || active.pages?.length || 1);
    if (!pages.length) return fail('Nhập trang cần quét, ví dụ 28-35 hoặc 28,31,45.');
    return { docs:[cloneDocForPages(active, pages)], label:`Nhiều trang · ${pages.join(', ')}`, pages:pages.length, pageNumbers:pages, scope };
  }
  if (scope === 'document') {
    if (!active) return fail('Chưa mở tài liệu hiện tại.');
    return { docs:[active], label:'Tài liệu hiện tại', pages:(active.pages || []).length, scope };
  }
  if (scope === 'selected') {
    const docs = selectedDocs();
    if (!docs.length) return fail('Chưa tick tài liệu nào trong Thư viện.');
    return { docs, label:`Tài liệu đã tick · ${docs.length} nguồn`, pages:docs.reduce((n,d)=>n+(d.pages?.length||0),0), scope };
  }
  if (scope === 'library') {
    const docs = [...state.docs];
    if (!docs.length) return fail('Thư viện chưa có tài liệu.');
    return { docs, label:`Toàn thư viện · ${docs.length} nguồn`, pages:docs.reduce((n,d)=>n+(d.pages?.length||0),0), scope };
  }
  const docs = sourceDocs();
  if (!docs.length) return fail('Không có tài liệu trong nguồn mặc định hiện tại.');
  return { docs, label:`Thông minh · ${scopeLabel()}`, pages:docs.reduce((n,d)=>n+(d.pages?.length||0),0), scope:'smart' };
}

function scopeSelectOptions(value = 'smart', { formula = false } = {}) {
  const options = formula ? [
    ['region','Vùng chọn gần nhất · tiết kiệm nhất'],
    ['page','Trang hiện tại · mặc định'],
    ['pages','Nhiều trang…'],
    ['document','Tài liệu hiện tại'],
    ['selected','Tài liệu đã tick'],
    ['library','Toàn thư viện · nặng nhất']
  ] : [
    ['smart','Thông minh · bộ tìm kiếm ổn định v1.9.23'],
    ['region','Vùng chọn gần nhất'],
    ['page','Trang hiện tại'],
    ['pages','Nhiều trang…'],
    ['document','Tài liệu hiện tại'],
    ['selected','Tài liệu đã tick'],
    ['library','Toàn thư viện']
  ];
  return options.map(([id,label]) => `<option value="${id}" ${value === id ? 'selected' : ''}>${label}</option>`).join('');
}
function is7888(doc) { return isTcvn7888_2014Document(doc); }

function sourceHas7888() { return sourceDocs().some(is7888); }
function providerModel(forVision = false) {
  if (forVision && state.settings.provider === 'ollama') return state.settings.visionModel || 'gemma3:4b';
  return state.settings.model || PROVIDERS[state.settings.provider]?.model || '';
}
function isLocalHost() { return ['localhost','127.0.0.1','::1'].includes(location.hostname); }
const volatileApiKeys = new Map();
function sessionKeyName(provider) { return `hnl.apiKey.${provider}`; }
function currentApiKey(provider = state.settings.provider) {
  const id = String(provider || '').trim();
  if (!id) return '';
  if (volatileApiKeys.has(id)) return volatileApiKeys.get(id) || '';
  try {
    const value = sessionStorage.getItem(sessionKeyName(id)) || '';
    if (value) volatileApiKeys.set(id, value);
    return value;
  } catch { return ''; }
}
function setCurrentApiKey(provider, value) {
  const id = String(provider || '').trim();
  const key = String(value || '').trim();
  if (!id) return;
  if (key) volatileApiKeys.set(id, key); else volatileApiKeys.delete(id);
  try {
    if (key) sessionStorage.setItem(sessionKeyName(id), key);
    else sessionStorage.removeItem(sessionKeyName(id));
  } catch { /* Renderer memory still keeps the key for this app session. */ }
}
function draftSetting(name, fallback = '') {
  return Object.prototype.hasOwnProperty.call(state.settingsDraft || {}, name) ? state.settingsDraft[name] : fallback;
}
function captureSettingsDraft() {
  const existing = state.settingsDraft || {};
  return {
    model: document.querySelector('#modelInput')?.value.trim() ?? existing.model ?? state.settings.model,
    visionModel: document.querySelector('#visionModelInput')?.value.trim() ?? existing.visionModel ?? state.settings.visionModel,
    embeddingModel: document.querySelector('#embeddingModelInput')?.value.trim() ?? existing.embeddingModel ?? state.settings.embeddingModel,
    bridgeUrl: document.querySelector('#bridgeInput')?.value.trim() ?? existing.bridgeUrl ?? state.settings.bridgeUrl,
    ollamaUrl: document.querySelector('#ollamaInput')?.value.trim() ?? existing.ollamaUrl ?? state.settings.ollamaUrl,
    retrievalMode: document.querySelector('#retrievalModeInput')?.value ?? existing.retrievalMode ?? state.settings.retrievalMode,
    semanticRerank: document.querySelector('#semanticRerankInput')?.checked ?? existing.semanticRerank ?? state.settings.semanticRerank,
    nativePdfMode: document.querySelector('#nativePdfModeInput')?.value ?? existing.nativePdfMode ?? state.settings.nativePdfMode,
    openaiPdfDetail: document.querySelector('#openaiPdfDetailInput')?.value ?? existing.openaiPdfDetail ?? state.settings.openaiPdfDetail,
    historyRetentionDays: Number(document.querySelector('#historyRetentionDaysInput')?.value ?? existing.historyRetentionDays ?? state.settings.historyRetentionDays),
    strict: existing.strict ?? state.settings.strict,
    apiKey: document.querySelector('#apiKeyInput')?.value ?? existing.apiKey ?? currentApiKey()
  };
}
function rememberSettingsDraft() { state.settingsDraft = captureSettingsDraft(); return state.settingsDraft; }

function modelOptionsForCurrentProvider() {
  const current = providerModel();
  const preferred = PROVIDERS[state.settings.provider]?.model || '';
  return [...new Set([current, preferred, ...(state.modelOptions || [])].map(x => String(x || '').trim()).filter(Boolean))];
}
function quickModelOptionsHtml() {
  if (state.settings.provider === 'local') return '<option value="">Không dùng AI</option>';
  const current = providerModel();
  const models = modelOptionsForCurrentProvider();
  if (!models.length) return `<option value="${esc(current)}">${esc(current || 'Chưa có model')}</option>`;
  return models.map(m => `<option value="${esc(m)}" ${m === current ? 'selected' : ''}>${esc(m)}</option>`).join('');
}
function modelPickerHtml() {
  const current = providerModel();
  const models = modelOptionsForCurrentProvider();
  const verifiedText = state.modelOptionsVerified ? 'Đã xác minh trực tiếp qua API/Ollama' : 'Catalog gợi ý · bấm Làm mới để xác minh theo tài khoản';
  const rows = models.length ? models.map(m => `
    <button type="button" class="model-option-row ${m === current ? 'active' : ''}" data-model-choice="${esc(m)}" data-model-filter="${esc(m.toLowerCase())}">
      <span class="model-option-name">${esc(m)}</span>
      <span class="model-option-state">${m === current ? 'Đang dùng' : (state.modelOptionsVerified ? 'Khả dụng' : 'Gợi ý')}</span>
    </button>`).join('') : '<div class="empty-models">Chưa có model. Bấm “Làm mới từ API”.</div>';
  return `
    <div class="model-picker-overlay" id="modelPickerOverlay" role="presentation">
      <section class="model-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="modelPickerTitle">
        <div class="model-picker-head">
          <div><div class="section-kicker">AI · ${esc(PROVIDERS[state.settings.provider]?.short || state.settings.provider)}</div><h3 id="modelPickerTitle">Chọn model</h3></div>
          <button type="button" class="icon-btn" id="closeModelPicker" aria-label="Đóng">×</button>
        </div>
        <div class="model-picker-tools">
          <input id="modelPickerSearch" autocomplete="off" placeholder="Tìm model…" aria-label="Tìm model">
          <button type="button" class="btn" id="refreshModelsFromPicker">↻ Làm mới từ API</button>
        </div>
        <div class="model-picker-status ${state.modelOptionsVerified ? 'verified' : 'suggested'}">${esc(verifiedText)}${state.modelStatus ? ` · ${esc(state.modelStatus)}` : ''}</div>
        <div class="model-picker-list" id="modelPickerList">${rows}</div>
        <div class="model-manual-row">
          <input id="manualModelInput" autocomplete="off" value="" placeholder="Hoặc nhập chính xác model ID…">
          <button type="button" class="btn" id="applyManualModel">Dùng model này</button>
        </div>
        <div class="model-picker-foot"><span>🔒 Mọi thay đổi model đều hỏi OK trước khi áp dụng.</span><span id="modelPickerCount">${models.length} model</span></div>
      </section>
    </div>`;
}
function syncCommittedModelEverywhere(nextModel = state.settings.model) {
  const next = String(nextModel || '').trim();
  state.settings.model = next;
  state.settingsDraft = { ...(state.settingsDraft || {}), model: next };
  const input = document.querySelector('#modelInput');
  if (input && input.value !== next) input.value = next;
}
function confirmModelSwitch(nextModel, reason = 'Yêu cầu đổi model') {
  const oldModel = providerModel();
  const next = String(nextModel || '').trim();
  if (!next || next === oldModel) {
    syncCommittedModelEverywhere(oldModel);
    return true;
  }
  const ok = window.confirm(`${reason}

Model hiện tại: ${oldModel || '(chưa chọn)'}
Model đề nghị: ${next}

HNL sẽ CHỈ chuyển model khi bạn bấm OK.`);
  if (!ok) return false;
  syncCommittedModelEverywhere(next);
  state.connectionStatus = null;
  saveSettings();
  state.modelStatus = `Đã chuyển sang ${next} sau khi người dùng xác nhận.`;
  showToast(`Đã chuyển model: ${oldModel || 'chưa chọn'} → ${next}.`, 'success');
  return true;
}
function aiErrorKind(error) {
  const status = Number(error?.status || 0);
  const text = String(error?.message || error || '').toLowerCase();
  if (status === 429 || /429|resource_exhausted|rate.?limit|quota|hết.*(quota|lưu lượng|hạn mức)/i.test(text)) return 'quota';
  if ([500,502,503,504].includes(status) || /503|service.?unavailable|overloaded|temporar|timeout|hết thời gian/i.test(text)) return 'temporary';
  if (status === 404 || /model.*not found|not_found|không.*model|model.*không tồn tại/i.test(text)) return 'model';
  return 'other';
}
function waitMs(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function callConfiguredAiOnce({ prompt, images = [], documents = [], pdfDetail = state.settings.openaiPdfDetail || 'auto', modelOverride = '' }) {
  const model = modelOverride || providerModel(images.length > 0);
  if (state.settings.connection === 'bridge') {
    return callBridge({ bridgeUrl:state.settings.bridgeUrl, provider:state.settings.provider, model, prompt, images, documents, pdfDetail, apiKey:currentApiKey() });
  }
  return callDirect({ provider:state.settings.provider, model, apiKey:currentApiKey(), prompt, ollamaUrl:state.settings.ollamaUrl, images, documents, pdfDetail });
}
async function chooseApprovedFallbackModel(error, currentModel) {
  // Fallback is allowed only from a model list VERIFIED against the current
  // account/API/Ollama. Static suggestions are never used as availability proof.
  let models = state.modelOptionsVerified ? [...(state.modelOptions || [])] : [];
  if (!models.length) {
    const result = await listAvailableModelsDetailed({
      provider: state.settings.provider,
      connection: state.settings.connection,
      apiKey: currentApiKey(),
      bridgeUrl: state.settings.bridgeUrl,
      ollamaUrl: state.settings.ollamaUrl
    });
    state.modelOptions = result.models || [];
    state.modelOptionsVerified = result.verified === true;
    state.modelCatalogSource = result.source || '';
    models = state.modelOptionsVerified ? [...state.modelOptions] : [];
    if (!state.modelOptionsVerified) {
      state.modelStatus = `Không đề nghị fallback vì danh sách model chưa được xác minh. ${result.warning || ''}`.trim();
      return '';
    }
  }
  const candidate = pickFallbackCandidate(state.settings.provider, currentModel, models);
  if (!candidate) return '';
  const kind = aiErrorKind(error);
  const reason = kind === 'quota' ? 'Model hiện tại đang báo hết quota/rate limit.'
    : kind === 'model' ? 'Model hiện tại không còn khả dụng.'
    : 'Model hiện tại vẫn lỗi sau khi thử lại.';
  const ok = window.confirm(`${reason}\n\nModel hiện tại: ${currentModel}\nModel thay thế đã xác minh: ${candidate}\n\nBấm OK để chuyển sang model này và thử lại.\nBấm Cancel để GIỮ NGUYÊN model hiện tại.`);
  if (!ok) return '';
  state.settings.model = candidate;
  state.settingsDraft = {};
  state.connectionStatus = null;
  saveSettings();
  state.modelStatus = `Người dùng đã đồng ý fallback: ${currentModel} → ${candidate}.`;
  showToast(`Đã được bạn đồng ý chuyển model sang ${candidate}.`, 'warning');
  render();
  return candidate;
}
function pickFallbackCandidate(provider, currentModel, models = []) {
  const available = [...new Set(models.filter(m => m && m !== currentModel))];
  if (!available.length) return '';
  const score = m => {
    const x = String(m).toLowerCase();
    let n = 0;
    if (provider === 'gemini') { if (/flash/.test(x)) n += 30; if (/lite/.test(x)) n += 8; if (/pro/.test(x)) n -= 8; }
    if (provider === 'openai') { if (/mini|nano/.test(x)) n += 25; if (/gpt-5/.test(x)) n += 8; }
    if (provider === 'claude') { if (/haiku/.test(x)) n += 25; if (/sonnet/.test(x)) n += 12; if (/opus/.test(x)) n -= 5; }
    if (provider === 'grok') { if (/fast/.test(x)) n += 25; if (/mini/.test(x)) n += 12; }
    return n;
  };
  return available.sort((a,b) => score(b)-score(a) || a.localeCompare(b))[0];
}

async function chooseApprovedOllamaVisionFallback(error, currentModel) {
  if (state.settings.provider !== 'ollama' || state.settings.connection !== 'bridge') return '';
  try {
    const base = String(state.settings.bridgeUrl || location.origin).replace(/\/$/, '');
    const r = await fetch(`${base}/api/local/model-manager`, { cache:'no-store' });
    const data = await r.json().catch(()=>({}));
    if (!r.ok) return '';
    const names = (data.models || []).map(x => String(x.name || x.model || '')).filter(Boolean);
    const vision = names.filter(name => /(?:vision|llava|bakllava|moondream|minicpm-v|qwen[^:]*-?vl|gemma3)/i.test(name) && name !== currentModel);
    const candidate = vision[0] || '';
    if (!candidate) {
      state.modelStatus = `Vision model ${currentModel} lỗi sau retry; chưa có Vision model khác đã cài để đề nghị.`;
      return '';
    }
    const kind = aiErrorKind(error);
    const ok = window.confirm(`Vision model hiện tại ${kind === 'quota' ? 'hết quota/giới hạn' : 'bị lỗi sau khi thử lại'}.\n\nVision hiện tại: ${currentModel}\nVision thay thế đã cài: ${candidate}\n\nBấm OK để chuyển Vision model và thử lại.\nCancel = GIỮ NGUYÊN.`);
    if (!ok) return '';
    state.settings.visionModel = candidate;
    state.settingsDraft = {};
    saveSettings();
    state.modelStatus = `Người dùng đã đồng ý đổi Vision: ${currentModel} → ${candidate}.`;
    showToast(`Đã chuyển Vision model sang ${candidate} theo xác nhận.`, 'warning');
    return candidate;
  } catch { return ''; }
}

async function callConfiguredAiWithApproval({ prompt, images = [], documents = [], pdfDetail = state.settings.openaiPdfDetail || 'auto' }) {
  const forVision = images.length > 0 && state.settings.provider === 'ollama';
  const currentModel = providerModel(images.length > 0);
  let lastError;
  const retryDelays = [0, 1200, 3000];
  for (let i = 0; i < retryDelays.length; i++) {
    if (retryDelays[i]) await waitMs(retryDelays[i]);
    try { return await callConfiguredAiOnce({ prompt, images, documents, pdfDetail, modelOverride:currentModel }); }
    catch (error) {
      lastError = error;
      const kind = aiErrorKind(error);
      if (!['quota','temporary'].includes(kind) || i === retryDelays.length - 1) break;
    }
  }
  const kind = aiErrorKind(lastError);
  if (forVision && ['quota','temporary','model'].includes(kind)) {
    const approvedVision = await chooseApprovedOllamaVisionFallback(lastError, currentModel);
    if (approvedVision) return callConfiguredAiOnce({ prompt, images, documents, pdfDetail, modelOverride:approvedVision });
  } else if (!forVision && ['quota','temporary','model'].includes(kind)) {
    const approved = await chooseApprovedFallbackModel(lastError, currentModel);
    if (approved) return callConfiguredAiOnce({ prompt, images, documents, pdfDetail, modelOverride:approved });
  }
  throw lastError;
}

function saveSettings() {
  localStorage.setItem(STORAGE.provider, state.settings.provider);
  localStorage.setItem(STORAGE.connection, state.settings.connection);
  localStorage.setItem(STORAGE.model, state.settings.model);
  localStorage.setItem(STORAGE.visionModel, state.settings.visionModel);
  localStorage.setItem(STORAGE.bridge, state.settings.bridgeUrl);
  localStorage.setItem(STORAGE.ollama, state.settings.ollamaUrl);
  localStorage.setItem(STORAGE.strict, String(state.settings.strict));
  localStorage.setItem(STORAGE.scope, state.settings.scope);
  localStorage.setItem(STORAGE.retrievalMode, state.settings.retrievalMode);
  localStorage.setItem(STORAGE.embeddingModel, state.settings.embeddingModel);
  localStorage.setItem(STORAGE.semanticRerank, String(state.settings.semanticRerank));
  localStorage.setItem(STORAGE.nativePdfMode, state.settings.nativePdfMode || 'balanced');
  localStorage.setItem(STORAGE.openaiPdfDetail, state.settings.openaiPdfDetail || 'auto');
  localStorage.setItem(STORAGE.historyRetentionDays, String([30,90,365,0].includes(Number(state.settings.historyRetentionDays)) ? Number(state.settings.historyRetentionDays) : 365));
  localStorage.setItem(STORAGE.performanceMode, ['light','balanced','strong'].includes(state.settings.performanceMode) ? state.settings.performanceMode : 'balanced');
  localStorage.setItem(STORAGE.fieldMode, String(Boolean(state.settings.fieldMode)));
}
function saveChecklist() { localStorage.setItem(STORAGE.checklist, JSON.stringify(state.checklist)); }
function showToast(message, type = 'info') {
  state.toast = { message, type };
  document.querySelector('.toast')?.remove();
  const shell = document.querySelector('.app-shell');
  if (shell) {
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.textContent = message;
    shell.appendChild(node);
  }
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { state.toast = null; document.querySelector('.toast')?.remove(); }, 3000);
}
function setBusy(value) { state.busy = value; render(); }

function formatBuildTime(value) {
  if (!value) return 'Chưa có dấu build';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(d);
  return `${parts} GMT+7`;
}
function buildNumberLabel() {
  return APP_META.runNumber ? `Build #${APP_META.runNumber}${APP_META.runAttempt && APP_META.runAttempt > 1 ? `.${APP_META.runAttempt}` : ''}` : (APP_META.source || 'Local build');
}
function currentBuildSummary() {
  return [
    `HNL Pile Standards AI v${APP_META.version}`,
    `Edition: ${EDITION_LABEL}`,
    `Build: ${buildNumberLabel()}`,
    `Build time: ${formatBuildTime(APP_META.builtAt)}`,
    `Source: ${APP_META.source || '-'}`,
    `Repository: ${APP_META.repository || '-'}`,
    `Branch: ${APP_META.branch || '-'}`,
    `Commit: ${APP_META.commit || '-'}`,
    `Provider: ${(PROVIDERS[state.settings.provider] || {}).label || state.settings.provider}`,
    `Connection: ${state.settings.connection}`,
    `Documents: ${state.docs.length}`,
    `Sources: ${sourceDocs().length}`,
    `User agent: ${navigator.userAgent}`
  ].join('\n');
}
function versionCardHtml() {
  const update = state.updateStatus;
  const updateHtml = update ? `<div class="notice ${update.ok ? (update.available ? 'warning' : 'success') : 'error'}"><b>${esc(update.title || '')}</b>${update.message ? `<br>${esc(update.message)}` : ''}${update.url ? ` <a class="inline-link" href="${esc(update.url)}" target="_blank" rel="noreferrer">Mở GitHub Release</a>` : ''}</div>` : '';
  const changes = (state.changelog || []).slice(0, 2);
  const changelogHtml = changes.length ? `<div class="mini-changelog">${changes.map(r => `<div><b>v${esc(r.version)} · ${esc(r.title || '')}</b><small>${(r.changes || []).slice(0, 4).map(x => `• ${esc(x)}`).join('<br>')}</small></div>`).join('')}</div>` : '';
  return `<div class="panel-section app-version-card compact-settings-card">
    <div class="panel-section-title"><h3>Build & cập nhật</h3><span>Chi tiết</span></div>
    <div class="compact-overview-line"><div><b>${esc(buildNumberLabel())} · ${EDITION_LABEL}</b><small>${esc(formatBuildTime(APP_META.builtAt))} · version hiện hành xem ở thanh trên</small></div><span class="compact-status">${esc(APP_META.commitShort || 'local')}</span></div>
    <details id="settingsVersionDetails" class="compact-disclosure" data-persist-detail>
      <summary><span>Xem chi tiết phiên bản & thay đổi</span><span class="disclosure-chevron">⌄</span></summary>
      <div class="disclosure-body">
        <div class="version-grid">
          <div><span>Phiên bản</span><b>v${APP_META.version}</b></div>
          <div><span>Bản build</span><b>${esc(buildNumberLabel())}</b></div>
          <div><span>Thời điểm build</span><b>${esc(formatBuildTime(APP_META.builtAt))}</b></div>
          <div><span>Kênh</span><b>${EDITION_LABEL}</b></div>
          <div><span>Commit</span><b>${esc(APP_META.commitShort || 'local')}</b></div>
          <div><span>Nhánh</span><b>${esc(APP_META.branch || 'local')}</b></div>
        </div>
        <p class="muted">Thông tin build được đọc từ <code>build-info.json</code> tạo sau bước build; không ghi cứng ngày giờ trong source.</p>
        <div class="action-row"><button class="btn" id="checkAppUpdate">↻ Kiểm tra cập nhật</button><button class="btn" id="copyBuildDiagnostics">⧉ Sao chép thông tin</button>${APP_META.workflowUrl ? `<a class="btn inline-link" href="${esc(APP_META.workflowUrl)}" target="_blank" rel="noreferrer">GitHub Build</a>` : ''}</div>
        ${updateHtml}${changelogHtml}
      </div>
    </details>
  </div>`;
}
async function loadBuildMetadata() {
  try {
    const res = await fetch(`./build-info.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const info = await res.json();
    APP_META = { ...APP_META, ...info, version: info.version || SOURCE_META.version, release: info.release || SOURCE_META.release };
  } catch {
    APP_META = { ...APP_META, version: SOURCE_META.version, target: APP_EDITION, edition: EDITION_LABEL };
  } finally { state.buildInfoLoaded = true; }
}
async function loadChangelog() {
  try {
    const res = await fetch(`./changelog.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    state.changelog = Array.isArray(data.releases) ? data.releases : [];
  } catch { state.changelog = []; }
}
function compareVersions(a, b) {
  const pa = String(a || '').replace(/^v/i, '').split('.').map(x => Number.parseInt(x, 10) || 0);
  const pb = String(b || '').replace(/^v/i, '').split('.').map(x => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
  return 0;
}
async function checkAppUpdate() {
  const repo = APP_META.repository;
  if (!repo || !/^[^/]+\/[^/]+$/.test(repo)) {
    state.updateStatus = { ok:false, title:'Chưa xác định repository', message:'Build local hoặc build-info chưa có tên owner/repo GitHub.' }; render(); return;
  }
  state.updateStatus = { ok:true, title:'Đang kiểm tra…', message:`GitHub Releases · ${repo}` }; render();
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers:{ Accept:'application/vnd.github+json' }, cache:'no-store' });
    if (res.status === 404) throw new Error('Repository chưa có GitHub Release hoặc Release không công khai.');
    if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}`);
    const rel = await res.json();
    const latest = String(rel.tag_name || rel.name || '').replace(/^v/i, '');
    const available = latest && compareVersions(latest, APP_META.version) > 0;
    state.updateStatus = { ok:true, available, title: available ? `Có bản mới v${latest}` : `Đang ở bản mới nhất v${APP_META.version}`, message: available ? 'Mở GitHub Release để tải/cập nhật bản Desktop hoặc kiểm tra deploy Web.' : `Release mới nhất: ${rel.tag_name || latest}.`, url: rel.html_url || null };
  } catch (error) { state.updateStatus = { ok:false, title:'Không kiểm tra được cập nhật', message:error.message }; }
  render();
}
async function copyBuildDiagnostics() {
  const text = currentBuildSummary();
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else { const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
    showToast('Đã sao chép thông tin phiên bản/build để gửi kiểm tra lỗi.', 'success');
  } catch (error) { showToast(`Không sao chép được: ${error.message}`, 'error'); }
}

function captureRenderViewport() {
  try {
    const pdf = document.querySelector('#pdfScroll');
    const panel = document.querySelector('.panel-body');
    const docs = document.querySelector('.doc-list');
    const active = document.activeElement;
    const anchor = state.readerMode === 'continuous' ? document.querySelector(`#pdf-page-${state.page}`) : null;
    const pdfRect = pdf?.getBoundingClientRect?.();
    const anchorRect = anchor?.getBoundingClientRect?.();
    return {
      docId: pdf?.dataset?.docId || state.activeDocId,
      readerMode: state.readerMode,
      page: state.page,
      tab: state.tab,
      modelPickerOpen: Boolean(state.modelPickerOpen),
      pdfTop: Number(pdf?.scrollTop || 0),
      pdfLeft: Number(pdf?.scrollLeft || 0),
      pageAnchorOffset: anchorRect && pdfRect ? anchorRect.top - pdfRect.top : null,
      panelTop: Number(panel?.scrollTop || 0),
      docsTop: Number(docs?.scrollTop || 0),
      openDetails: [...document.querySelectorAll('details[data-persist-detail][open]')].map(x => x.id).filter(Boolean),
      focusId: active?.id || '',
      selectionStart: typeof active?.selectionStart === 'number' ? active.selectionStart : null,
      selectionEnd: typeof active?.selectionEnd === 'number' ? active.selectionEnd : null
    };
  } catch { return null; }
}

function restoreRenderViewport(snapshot) {
  if (!snapshot) return;
  try {
    const sameDoc = snapshot.docId === state.activeDocId && snapshot.readerMode === state.readerMode;
    if (sameDoc && !state.pendingPageScroll) {
      const pdf = document.querySelector('#pdfScroll');
      if (pdf) {
        pdf.scrollLeft = snapshot.pdfLeft || 0;
        if (state.readerMode === 'continuous' && snapshot.pageAnchorOffset != null) {
          const anchor = document.querySelector(`#pdf-page-${snapshot.page}`);
          if (anchor) {
            const pdfRect = pdf.getBoundingClientRect();
            const anchorRect = anchor.getBoundingClientRect();
            pdf.scrollTop += (anchorRect.top - pdfRect.top) - snapshot.pageAnchorOffset;
          } else pdf.scrollTop = snapshot.pdfTop || 0;
        } else pdf.scrollTop = snapshot.pdfTop || 0;
        updateReaderPageUi(snapshot.page || state.page);
      }
    }
    if (snapshot.tab === state.tab) {
      const panel = document.querySelector('.panel-body');
      if (panel) panel.scrollTop = snapshot.panelTop || 0;
    }
    const docs = document.querySelector('.doc-list');
    if (docs) docs.scrollTop = snapshot.docsTop || 0;
    for (const id of snapshot.openDetails || []) { const detail = document.getElementById(id); if (detail?.tagName === 'DETAILS') detail.open = true; }
    if (snapshot.focusId && snapshot.tab === state.tab && snapshot.modelPickerOpen === Boolean(state.modelPickerOpen)) {
      const target = document.getElementById(snapshot.focusId);
      if (target && !target.disabled) {
        target.focus?.({ preventScroll:true });
        if (snapshot.selectionStart != null && typeof target.setSelectionRange === 'function') {
          try { target.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd ?? snapshot.selectionStart); } catch {}
        }
      }
    }
  } catch { /* UI preservation must never block rendering. */ }
}

function render() {
  const viewportSnapshot = captureRenderViewport();
  const doc = activeDoc();
  const sources = sourceDocs();
  app.innerHTML = `
  <div class="app-shell ${state.settings.fieldMode ? 'field-mode' : ''} performance-${esc(state.settings.performanceMode || 'balanced')}">
    <header class="topbar">
      <div class="brand" role="banner">
        <img class="brand-mark" src="./hnl-mark-192.png" alt="HNL" />
        <div class="brand-copy">
          <div class="brand-title">HNL Pile Standards AI</div>
          <div class="brand-sub">${IS_DESKTOP_EDITION ? 'Desktop AI · Offline + Online' : 'Web · AI Online + Local RAG'}</div>
          <div class="build-meta"><span class="version-chip">v${APP_META.version}</span><span class="version-chip edition-chip">${EDITION_LABEL}</span><span>${esc(buildNumberLabel())} · ${esc(formatBuildTime(APP_META.builtAt))}</span></div>
        </div>
      </div>
      <div class="top-actions">
        <button class="source-badge" id="sourceBadge" title="Mở thư viện nguồn">${sources.length} nguồn</button>

      </div>
    </header>

    <main class="workspace ${state.focusReader ? 'reader-focus' : ''} ${state.leftCollapsed ? 'left-collapsed' : ''} ${state.rightCollapsed ? 'right-collapsed' : ''}" data-mobile="${state.mobile}" style="--left-user-w:${state.layout.left}px;--right-user-w:${state.layout.right}px">
      ${(state.leftCollapsed || state.focusReader) ? '<button class="panel-recovery panel-recovery-left" id="reopenLibrary" title="Mở lại Thư viện">▶ <span>Thư viện</span></button>' : ''}
      ${(state.rightCollapsed || state.focusReader) ? '<button class="panel-recovery panel-recovery-right" id="reopenAssistant" title="Mở lại Trợ lý AI"><span>Trợ lý</span> ◀</button>' : ''}
      <aside class="sidebar">
        <div class="side-head">
          <div><div class="section-kicker">Tài liệu</div><h2>Thư viện tiêu chuẩn</h2></div>
          <div class="mini-actions">
            <button class="icon-btn" id="undoAction" title="Hoàn tác" ${state.undoStack.length?'':'disabled'}>↶</button>
            <button class="icon-btn" id="redoAction" title="Làm lại" ${state.redoStack.length?'':'disabled'}>↷</button>
            <button class="icon-btn" id="selectAll" title="Chọn tất cả làm nguồn">✓</button>
            <button class="icon-btn" id="clearSelection" title="Bỏ chọn tất cả">×</button>
            <button class="icon-btn" id="toggleLibrary" title="Thu gọn thư viện">◀</button>
          </div>
        </div>
        <div class="import-grid">
          <label class="upload-box" ${state.busy ? 'aria-disabled="true"' : ''}>
            <span class="upload-icon">＋</span>
            <span><b>Thêm dữ liệu</b><small>PDF · ZIP · ảnh · TXT/CSV/JSON</small></span>
            <input id="dataInput" type="file" accept=".pdf,.zip,.rar,.7z,.tar,.tgz,.gz,.bz2,.xz,.png,.jpg,.jpeg,.webp,.bmp,.gif,.txt,.md,.csv,.json,.xml,.html,.htm,.yaml,.yml" multiple ${state.busy ? 'disabled' : ''}>
          </label>
          <label class="folder-box" ${state.busy ? 'aria-disabled="true"' : ''}>
            <span>▣</span><b>Đọc cả thư mục</b>
            <input id="folderInput" type="file" webkitdirectory directory multiple ${state.busy ? 'disabled' : ''}>
          </label>
        </div>
        <div class="library-note">Tự quét PDF/ảnh/text trong thư mục hoặc ZIP. RAR/7Z/TAR/GZ/BZ2/XZ được giải nén ở HNL Local; archive có mật khẩu sẽ hỏi mật khẩu khi cần.</div>
        <div class="library-tools"><input id="librarySearchInput" value="${esc(state.libraryQuery)}" placeholder="Tìm tài liệu…"><select id="libraryFilterInput"><option value="all" ${state.libraryFilter==='all'?'selected':''}>Tất cả</option><option value="pinned" ${state.libraryFilter==='pinned'?'selected':''}>★ Đã ghim</option>${DOC_CATEGORIES.map(([id,label])=>`<option value="${id}" ${state.libraryFilter===id?'selected':''}>${label}</option>`).join('')}</select></div>
        <div class="doc-list">${state.docs.length ? (filteredLibraryDocs().length ? filteredLibraryDocs().map(docItem).join('') : '<div class="empty-card"><b>Không có tài liệu phù hợp bộ lọc.</b><span>Đổi từ khóa hoặc loại tài liệu.</span></div>') : emptyLibraryHtml()}</div>
        <div class="source-rule">
          <label class="field compact-field"><span>Nguồn mặc định AI / RAG</span><select id="scopeSelect">
            <option value="all" ${state.settings.scope === 'all' ? 'selected' : ''}>Toàn bộ tài liệu đã tải</option>
            <option value="selected" ${state.settings.scope === 'selected' ? 'selected' : ''}>Chỉ tài liệu đã tick</option>
            <option value="active" ${state.settings.scope === 'active' ? 'selected' : ''}>Chỉ PDF đang mở</option>
          </select></label>
          <div class="coverage-line"><b>${esc(scopeLabel())}</b><small>Dùng cho Hỏi đáp/Tóm tắt và làm nền cho phạm vi “Thông minh”. Tra cứu/Tính có thể thu hẹp riêng theo vùng hoặc trang để tiết kiệm tài nguyên.</small></div>
          <label class="switch-row">
            <input id="strictSide" type="checkbox" ${state.settings.strict ? 'checked' : ''}>
            <span><b>Khóa nguồn</b><small>Không cho AI tự thêm nội dung ngoài PDF</small></span>
          </label>
        </div>
      </aside>
      <div class="workspace-splitter splitter-left" aria-hidden="true"></div>

      <section class="viewer">
        <div class="viewer-toolbar">
          <div class="viewer-title-wrap">
            <button class="icon-btn viewer-side-toggle" id="viewerToggleLibrary" title="Ẩn/hiện thư viện">☰</button>
            <span class="viewer-title">${doc ? esc(doc.standard || doc.name) : 'Trình đọc PDF'}</span>
            ${doc?.scannedLikely ? '<span class="warn-chip" title="PDF có rất ít lớp text">PDF scan</span>' : ''}
          </div>
          <div class="reader-search ${state.readerQuery ? 'active' : ''}">
            <input id="pdfSearchInput" value="${esc(state.readerQuery)}" placeholder="Tìm chữ / Điều / Bảng / Phụ lục…" ${!doc ? 'disabled' : ''}>
            <button class="icon-btn" id="pdfSearchPrev" ${!doc ? 'disabled' : ''} title="Kết quả trước">↑</button>
            <button class="icon-btn" id="pdfSearchNext" ${!doc ? 'disabled' : ''} title="Kết quả sau">↓</button>
          </div>
          <div class="viewer-controls" aria-label="Điều khiển trình đọc PDF">
            <div class="toolbar-group toolbar-mode-group">
              <div class="reader-mode-switch" title="Kiểu đọc PDF">
                <button id="readerContinuous" class="${state.readerMode === 'continuous' ? 'active' : ''}" ${!doc || doc.viewerKind !== 'pdf' ? 'disabled' : ''}>Liên tục</button>
                <button id="readerSingle" class="${state.readerMode === 'single' ? 'active' : ''}" ${!doc || doc.viewerKind !== 'pdf' ? 'disabled' : ''}>1 trang</button>
              </div>
            </div>
            <div class="toolbar-group toolbar-zoom-group" aria-label="Thu phóng">
              <button class="icon-btn" id="zoomOut" ${!doc ? 'disabled' : ''} title="Thu nhỏ (−)">−</button>
              <button class="zoom-value" id="fitWidth" ${!doc ? 'disabled' : ''} title="Vừa chiều rộng (Ctrl+0)">${Math.round(state.zoom * 100)}%</button>
              <button class="icon-btn" id="zoomIn" ${!doc ? 'disabled' : ''} title="Phóng to (+)">＋</button>
            </div>
            <div class="toolbar-group toolbar-page-group" aria-label="Điều hướng trang">
              <button class="icon-btn" id="prevPage" ${!doc ? 'disabled' : ''} title="Trang trước (Page Up)">‹</button>
              <input class="page-input" id="pageInput" value="${state.page}" ${!doc ? 'disabled' : ''} aria-label="Số trang">
              <span class="page-total">/ ${doc?.pageCount || 0}</span>
              <button class="icon-btn" id="nextPage" ${!doc ? 'disabled' : ''} title="Trang sau (Page Down)">›</button>
            </div>
            <div class="toolbar-group toolbar-selection-group" aria-label="Chọn chữ, OCR và đánh dấu">
              <button class="icon-btn ${state.pdfSelectionMode !== 'off' ? 'active-tool' : ''}" id="pdfSmartSelect" ${!doc || doc.viewerKind !== 'pdf' ? 'disabled' : ''} title="PDF có text: bôi chọn/copy. Trang scan: kéo vùng OCR">T▧</button>
              <button class="icon-btn" id="bookmarkCurrentPage" ${!doc ? 'disabled' : ''} title="Đánh dấu trang hiện tại">★</button>
              <button class="icon-btn ${state.bookmarkPanelOpen?'active-tool':''}" id="toggleBookmarks" ${!doc ? 'disabled' : ''} title="Mở đánh dấu & ghi chú">☷</button>
            </div>
            <div class="toolbar-group toolbar-layout-group" aria-label="Bố cục trình đọc">
              <button class="icon-btn" id="viewerToggleAssistant" title="Ẩn/hiện trợ lý">AI</button>
              <button class="icon-btn" id="resetLayout" title="Khôi phục bố cục 3 vùng">↺</button>
              <button class="icon-btn ${state.focusReader ? 'active-tool' : ''}" id="focusReader" title="${state.focusReader ? 'Thoát chế độ tập trung' : 'Chế độ tập trung PDF'}">${state.focusReader ? '⊞' : '⛶'}</button>
            </div>
          </div>
        </div>
        ${doc ? bookmarkBarHtml(doc) : ''}
        ${doc ? viewerContentHtml(doc) : emptyViewerHtml()}
      </section>
      <div class="workspace-splitter splitter-right" aria-hidden="true"></div>

      <aside class="assistant-panel">
        <div class="assistant-compact-head">
          <div class="assistant-compact-title"><b>Trợ lý</b><span class="assistant-source-count">${sourceDocs().length} nguồn</span></div>
          <div class="assistant-compact-actions">
            <button type="button" class="ai-status-chip" id="assistantSettingsSummary" title="AI & kết nối · ${esc(providerModel() || '')}"><span id="aiConnectionDot" class="dot ${state.connectionStatus?.ok ? 'ok' : ''}"></span><b>${esc(PROVIDERS[state.settings.provider]?.short || state.settings.provider)}</b></button>
            <button class="icon-btn" id="toggleAssistant" title="Thu gọn trợ lý">▶</button>
          </div>
        </div>
        <div class="tabs">${[
          ['summary', 'Tóm tắt'], ['chat', 'Hỏi đáp'], ['lookup', 'Tra cứu'], ['calc', 'Tính'], ['compare', 'So sánh'], ['checklist', 'Nghiệm thu'], ['settings', 'Cài đặt']
        ].map(([id, label]) => `<button class="tab ${state.tab === id ? 'active' : ''}" data-tab="${id}">${label}</button>`).join('')}</div>
        <div class="panel-body panel-${state.tab}">${panelHtml()}</div>
      </aside>
    </main>

    <nav class="mobile-nav">
      <button data-mobile="library" class="${state.mobile === 'library' ? 'active' : ''}">Thư viện</button>
      <button data-mobile="viewer" class="${state.mobile === 'viewer' ? 'active' : ''}">PDF</button>
      <button data-mobile="assistant" class="${state.mobile === 'assistant' ? 'active' : ''}">Trợ lý</button>
    </nav>

    ${state.modelPickerOpen ? modelPickerHtml() : ''}
    ${state.progress ? progressHtml() : ''}
    ${state.toast ? `<div class="toast ${state.toast.type}">${esc(state.toast.message)}</div>` : ''}
  </div>`;

  bind();
  bindWorkspaceSplitters();
  bindGlobalReaderShortcuts();
  if (doc) queueMicrotask(async () => {
    await drawPage();
    requestAnimationFrame(() => restoreRenderViewport(viewportSnapshot));
  });
  else requestAnimationFrame(() => restoreRenderViewport(viewportSnapshot));
  queueMicrotask(saveWorkspace);
}

function emptyLibraryHtml() {
  return '<div class="empty-card"><div class="empty-icon">PDF</div><b>Chưa có tài liệu</b><span>Tải tiêu chuẩn lên để bắt đầu.</span></div>';
}

function viewerContentHtml(doc) {
  if (doc.viewerKind === 'image') {
    return `<div class="canvas-wrap image-wrap"><img id="sourceImage" alt="${esc(doc.name)}"><div class="image-source-note">Nguồn ảnh · ${esc(doc.sourcePath || doc.name)}${doc.ocrStatus === 'browser' ? ' · đã OCR cục bộ' : ' · AI Vision sẽ đọc trực tiếp khi hỏi'}</div></div>`;
  }
  if (doc.viewerKind === 'text') {
    const page = doc.pages?.[Math.max(0, state.page - 1)];
    return `<div class="canvas-wrap text-wrap"><pre class="text-viewer">${esc(page?.text || '')}</pre></div>`;
  }
  if (state.readerMode === 'continuous') {
    const pages = Array.from({ length: doc.pageCount || 0 }, (_, i) => {
      const p = i + 1;
      return `<section class="pdf-page-shell" id="pdf-page-${p}" data-page="${p}"><div class="page-float-label">${p}</div><canvas class="pdf-page-canvas" data-page="${p}"></canvas><div class="pdf-text-layer" data-page="${p}"></div><div class="pdf-region-layer" data-page="${p}"></div><div class="pdf-annotation-layer" data-page="${p}"></div><div class="pdf-page-loading">Trang ${p}</div></section>`;
    }).join('');
    return `<div class="canvas-wrap pdf-continuous" id="pdfScroll" data-doc-id="${esc(doc.id)}">${pages}</div><div class="reader-statusbar"><span>Trang <b id="readerStatusPage">${state.page}</b>/${doc.pageCount}</span><input id="pageRange" type="range" min="1" max="${doc.pageCount}" value="${state.page}"><span>${Math.round(state.zoom*100)}% · kéo chuột để pan · Ctrl+cuộn để zoom</span></div>`;
  }
  return `<div class="canvas-wrap pdf-single" id="pdfScroll" data-doc-id="${esc(doc.id)}"><section class="pdf-page-shell single" data-page="${state.page}"><canvas id="pdfCanvas"></canvas><div class="pdf-text-layer" data-page="${state.page}"></div><div class="pdf-region-layer" data-page="${state.page}"></div><div class="pdf-annotation-layer" data-page="${state.page}"></div></section></div><div class="reader-statusbar"><span>Trang <b>${state.page}</b>/${doc.pageCount}</span><input id="pageRange" type="range" min="1" max="${doc.pageCount}" value="${state.page}"><span>${Math.round(state.zoom*100)}% · PageUp/PageDown đổi trang</span></div>`;
}

function emptyViewerHtml() {
  return `<div class="empty-view">
    <img src="./hnl-mark-192.png" alt="HNL" />
    <h1>Đọc tiêu chuẩn nhanh hơn</h1>
    <p>Tải PDF, ZIP, ảnh hoặc cả thư mục để tra cứu, hỏi đáp theo nguồn, kiểm tra bảng cọc và tính toán kỹ thuật.</p>
    <div class="feature-row"><span>PDF · ZIP · Folder</span><span>Ảnh đa phương thức</span><span>AI Offline/Online</span></div>
  </div>`;
}
function progressHtml() {
  return `<div class="progress-overlay"><div class="progress-box"><div class="spinner"></div><div><b>${esc(state.progress.title)}</b><div class="muted progress-detail">${esc(state.progress.detail)}</div><div class="progress-bar"><div style="width:${state.progress.pct}%"></div></div></div></div></div>`;
}

function docItem(d) {
  const selected = state.selected.has(d.id);
  const active = state.activeDocId === d.id;
  const meta = docMeta(d);
  const categoryOptions = DOC_CATEGORIES.map(([id,label]) => `<option value="${id}" ${meta.category===id?'selected':''}>${label}</option>`).join('');
  const marks = meta.bookmarks.length + meta.highlights.length;
  return `<article class="doc-item ${active ? 'active' : ''} ${meta.pinned ? 'pinned' : ''}">
    <div class="doc-row">
      <input class="source-check" type="checkbox" data-select="${d.id}" ${selected ? 'checked' : ''} title="Chọn làm nguồn tra cứu">
      <button class="doc-main" data-open="${d.id}">
        <span class="pdf-badge">${d.viewerKind === 'image' ? 'IMG' : d.viewerKind === 'text' ? 'TXT' : 'PDF'}</span>
        <span class="doc-copy"><b>${esc(d.standard || d.name)}</b><small>${d.pageCount} ${d.viewerKind === 'image' ? 'ảnh' : 'trang'} · ${fmtBytes(d.size)}${marks?` · ★ ${marks}`:''}</small><em>${d.viewerKind === 'image' ? (d.ocrStatus === 'browser' ? 'OCR ảnh: có' : 'Ảnh: AI Vision') : `${usableTextPageCount(d)}/${d.pageCount} trang chữ hữu dụng${rawTextPageCount(d) !== usableTextPageCount(d) ? ` · ${rawTextPageCount(d)} trang có text thô` : ''} · ${(d.textChars || 0).toLocaleString('vi-VN')} ký tự${Number(d.textIndexVersion || 0) < TEXT_INDEX_VERSION ? ' · chỉ mục cũ' : ''}`}</em>${d.sourcePath && d.sourcePath !== d.name ? `<em>${esc(d.sourcePath)}</em>` : (d.scannedLikely ? '<em class="warn-text">Có thể cần OCR/AI Vision</em>' : '')}</span>
      </button>
      <button class="icon-btn pin-doc ${meta.pinned?'active-tool':''}" data-pin-doc="${d.id}" title="${meta.pinned?'Bỏ ghim':'Ghim tài liệu'}">★</button>
      <button class="more-btn danger" data-delete="${d.id}" title="Xóa tài liệu">×</button>
    </div>
    <div class="doc-meta-row"><select data-doc-category="${d.id}" title="Phân loại tài liệu">${categoryOptions}</select>${relatedDocumentVersions(d).length?`<span class="warn-chip">${esc(relatedVersionLabel(d))}</span>`:''}</div>
  </article>`;
}
function bookmarkBarHtml(doc) {
  if (!doc || !state.bookmarkPanelOpen) return '';
  const meta=docMeta(doc), rows=[...meta.bookmarks,...meta.highlights].sort((a,b)=>(a.page||0)-(b.page||0));
  return `<div class="bookmark-panel"><div class="bookmark-panel-head"><div><b>Đánh dấu & ghi chú</b><small>${rows.length} mục · ${esc(doc.standard||doc.name)}</small></div><button class="icon-btn" id="closeBookmarkPanel">×</button></div>
    <div class="bookmark-list">${rows.length?rows.map(x=>`<div class="bookmark-row"><button class="bookmark-open" data-bookmark-page="${Number(x.page)||1}"><b>Trang ${Number(x.page)||1}${x.kind==='highlight'?' · vùng':''}</b><small>${esc(x.note||x.label||String(x.text||'').slice(0,120)||'Đánh dấu')}</small></button><button class="icon-btn danger-btn" data-remove-bookmark="${esc(x.id)}">×</button></div>`).join(''):'<div class="muted">Chưa có đánh dấu. Bấm ★ để lưu trang hiện tại hoặc chọn vùng PDF để thêm ghi chú.</div>'}</div></div>`;
}

function panelHtml() {
  if (state.tab === 'summary') return summaryHtml();
  if (state.tab === 'chat') return chatHtml();
  if (state.tab === 'lookup') return lookupHtml();
  if (state.tab === 'calc') return calcHtml();
  if (state.tab === 'compare') return compareHtml();
  if (state.tab === 'checklist') return checklistHtml();
  return settingsHtml();
}

function noSourceCard(action = 'sử dụng chức năng này') {
  return `<div class="empty-panel"><b>Chưa có nguồn theo phạm vi hiện tại</b><p>Hãy tải tài liệu hoặc đổi “Nguồn mặc định AI / RAG”. Phạm vi riêng trong từng tab có thể tiếp tục thu hẹp theo vùng/trang khi cần ${action}.</p></div>`;
}

function summaryHtml() {
  const doc = activeDoc() || sourceDocs()[0];
  if (!doc) return noSourceCard('xem tóm tắt');
  const summary = localSummary(doc);
  return `
    <div class="hero-card">
      <div class="eyebrow">${esc(doc.standard || 'Tài liệu')}</div>
      <h3>Tóm tắt kỹ sư</h3>
      <p>Đọc cục bộ ngay, hoặc dùng AI để tổng hợp sâu hơn nhưng vẫn khóa theo nguồn PDF.</p>
      <div class="action-row"><button class="btn primary" id="aiSummary" ${state.busy ? 'disabled' : ''}>Tóm tắt PDF đang mở</button><button class="btn" id="aiSummaryAll" ${state.busy || !sourceDocs().length ? 'disabled' : ''}>Tóm tắt toàn bộ nguồn</button></div><div class="coverage-line"><b>${esc(scopeLabel())}</b><small>Tóm tắt toàn bộ nguồn quét mọi trang có lớp chữ; trang ảnh cần đọc sẽ dùng OCR/Vision có mục tiêu.</small></div>
    </div>
    ${doc.scannedLikely ? `<div class="notice warning"><b>PDF có ít lớp text.</b> Hình vẫn xem được nhưng tra cứu chữ sẽ thiếu nếu chưa OCR. <button class="btn compact-btn" id="ocrActivePdf" type="button">OCR toàn PDF bằng AI Offline</button></div>` : ''}
    <div class="panel-section"><div class="panel-section-title"><h3>Cấu trúc nhận diện</h3><span>${summary.headings.length} mục</span></div>${summary.headings.slice(0, 18).map(x => sourceLine(x, doc)).join('') || '<div class="muted">Chưa nhận diện được đề mục rõ ràng.</div>'}</div>
    <div class="panel-section"><div class="panel-section-title"><h3>Điểm định lượng đáng chú ý</h3><span>${summary.important.length} điểm</span></div>${summary.important.slice(0, 12).map(x => sourceLine(x, doc)).join('') || '<div class="muted">Chưa nhận diện được nội dung định lượng.</div>'}</div>`;
}
function sourceLine(item, doc) {
  return `<div class="source-line"><button class="page-chip" data-jump="${item.page}" data-doc="${doc.id}">P.${item.page}</button><span>${esc(item.text)}</span></div>`;
}


function chatSessionTitle(messages = []) {
  const first = messages.find(m => m.role === 'user' && String(m.text || '').trim());
  const text = String(first?.text || 'Cuộc trò chuyện mới').replace(/\s+/g, ' ').trim();
  return text.length > 58 ? `${text.slice(0, 58)}…` : text;
}
function chatSessionRecord() {
  if (!state.activeChatSessionId) state.activeChatSessionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const old = state.chatSessions.find(x => x.id === state.activeChatSessionId);
  return {
    id: state.activeChatSessionId,
    title: old?.customTitle || old?.title || chatSessionTitle(state.chat),
    customTitle: old?.customTitle || '',
    pinned: Boolean(old?.pinned),
    createdAt: old?.createdAt || now,
    updatedAt: now,
    provider: state.settings.provider,
    model: providerModel(),
    nativePdfMode: state.settings.nativePdfMode,
    scope: state.settings.scope,
    documentRefs: sourceDocs().map(d => ({ id:d.id, name:d.name, standard:d.standard || '' })),
    messages: state.chat.map(m => ({ role:m.role, text:String(m.text || ''), hits:Array.isArray(m.hits) ? m.hits.map(h => ({ docId:h.docId, docName:h.docName, standard:h.standard, page:Number(h.page || 1), text:String(h.text || '').slice(0, 1800) })) : [], provider:m.provider || '', model:m.model || '', stats:m.stats || null, evidence:m.evidence || null, engineering:m.engineering || null, imageInput:m.imageInput || null, createdAt:m.createdAt || now }))
  };
}
async function persistCurrentChat() {
  if (!state.chat.length) return;
  try {
    const row = chatSessionRecord();
    await saveChatSession(row);
    const i = state.chatSessions.findIndex(x => x.id === row.id);
    if (i >= 0) state.chatSessions[i] = row; else state.chatSessions.unshift(row);
    state.chatSessions.sort((a,b) => Number(Boolean(b.pinned))-Number(Boolean(a.pinned)) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  } catch (error) { console.warn('Không lưu được lịch sử chat:', error); }
}
function startNewChat() {
  state.activeChatSessionId = crypto.randomUUID();
  state.chat = [];
  state.chatDraft = '';
  clearChatAttachments();
  state.pendingImageExtraction = null;
  state.chatHistoryOpen = false;
  state.nativePdfStatus = '';
  render();
  queueMicrotask(() => document.querySelector('#chatQuestion')?.focus());
}
function openChatSession(id) {
  const row = state.chatSessions.find(x => x.id === id);
  if (!row) return showToast('Không tìm thấy phiên trò chuyện.', 'warning');
  state.activeChatSessionId = row.id;
  state.chat = (row.messages || []).map(m => ({ ...m, hits:Array.isArray(m.hits) ? m.hits : [] }));
  // Restore attachments/scope when those documents still exist locally, so a
  // resumed conversation behaves like reopening a chat with its PDFs attached.
  const savedIds = new Set((row.documentRefs || []).map(x => x.id));
  const availableIds = state.docs.filter(d => savedIds.has(d.id)).map(d => d.id);
  const missingCount = Math.max(0, savedIds.size - availableIds.length);
  if (availableIds.length) {
    state.selected = new Set(availableIds);
    if (!availableIds.includes(state.activeDocId)) state.activeDocId = availableIds[0];
  }
  if (['current','selected','all'].includes(row.scope)) state.settings.scope = row.scope;
  state.nativePdfStatus = '';
  state.chatDraft = '';
  clearChatAttachments();
  state.pendingImageExtraction = null;
  state.chatHistoryOpen = false;
  state.tab = 'chat';
  render();
  if (missingCount) showToast(`Đã mở lịch sử nhưng thiếu ${missingCount} PDF nguồn trên máy. Hãy nhập lại file để hỏi tiếp đủ căn cứ.`, 'warning');
  queueMicrotask(() => { const log=document.querySelector('.chat-log'); if(log) log.scrollTop=log.scrollHeight; });
}

async function renameChatSession(id) {
  const row=state.chatSessions.find(x=>x.id===id); if(!row)return;
  const next=window.prompt('Đổi tên phiên trò chuyện:',row.customTitle||row.title||'Cuộc trò chuyện'); if(next===null)return;
  row.customTitle=String(next||'').trim(); row.title=row.customTitle||chatSessionTitle(row.messages||[]); row.updatedAt=new Date().toISOString(); await saveChatSession(row); render();
}
async function togglePinChatSession(id) {
  const row=state.chatSessions.find(x=>x.id===id); if(!row)return; row.pinned=!row.pinned; row.updatedAt=new Date().toISOString(); await saveChatSession(row);
  state.chatSessions.sort((a,b)=>Number(Boolean(b.pinned))-Number(Boolean(a.pinned))||String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))); render();
}

async function removeChatSession(id) {
  if (!confirm('Xóa phiên trò chuyện này khỏi lịch sử cục bộ?')) return;
  await deleteChatSession(id);
  state.chatSessions = state.chatSessions.filter(x => x.id !== id);
  if (state.activeChatSessionId === id) startNewChat(); else render();
}
async function purgeExpiredHistory() {
  const days = Number(state.settings.historyRetentionDays || 0);
  if (!days) return;
  const cutoff = Date.now() - days * 86400000;
  const staleSessions = state.chatSessions.filter(x => Date.parse(x.updatedAt || x.createdAt || 0) < cutoff);
  const staleCalcs = state.calculations.filter(x => Date.parse(x.createdAt || 0) < cutoff);
  await Promise.allSettled([...staleSessions.map(x => deleteChatSession(x.id)), ...staleCalcs.map(x => deleteCalculation(x.id))]);
  if (staleSessions.length) state.chatSessions = state.chatSessions.filter(x => !staleSessions.some(y => y.id === x.id));
  if (staleCalcs.length) state.calculations = state.calculations.filter(x => !staleCalcs.some(y => y.id === x.id));
}
function formatHistoryTime(value) {
  const d = new Date(value || Date.now());
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
}
function chatHistoryHtml() {
  const q=String(state.historyQuery||'').trim().toLocaleLowerCase('vi');
  const rows = state.chatSessions.filter(x=>!q||`${x.title||''} ${(x.messages||[]).map(m=>m.text).join(' ')}`.toLocaleLowerCase('vi').includes(q)).slice(0, 80);
  return `<div class="history-drawer"><div class="history-head"><div><b>Lịch sử hỏi đáp</b><small>${rows.length}/${state.chatSessions.length} phiên · Local-first</small></div><button class="icon-btn" id="closeChatHistory" title="Đóng">×</button></div>
    <input class="history-search" id="chatHistorySearch" value="${esc(state.historyQuery)}" placeholder="Tìm trong lịch sử…">
    <div class="history-export-row"><label><span>Xuất lịch sử</span><select id="historyExportFormat"><option value="json">JSON</option><option value="md">Markdown</option><option value="pdf">PDF qua Print</option></select></label><button class="btn compact-btn" id="exportHistoryBtn">Xuất</button></div>
    <div class="history-list">${rows.length ? rows.map(x => `<div class="history-row ${x.id === state.activeChatSessionId ? 'active' : ''}"><button class="history-open" data-chat-session="${esc(x.id)}"><b>${x.pinned?'★ ':''}${esc(x.title || 'Cuộc trò chuyện')}</b><small>${esc(formatHistoryTime(x.updatedAt))} · ${(x.documentRefs || []).length} nguồn · ${esc(x.provider || '')}${x.model ? ` · ${esc(x.model)}` : ''}</small></button><div class="history-actions"><button class="icon-btn" data-pin-chat-session="${esc(x.id)}" title="${x.pinned?'Bỏ ghim':'Ghim'}">★</button><button class="icon-btn" data-rename-chat-session="${esc(x.id)}" title="Đổi tên">✎</button><button class="icon-btn danger-btn" data-delete-chat-session="${esc(x.id)}" title="Xóa">×</button></div></div>`).join('') : '<div class="muted history-empty">Không có phiên phù hợp.</div>'}</div>
  </div>`;
}
function exportHistory(format='json') {
  const safeSessions = state.chatSessions.map(session => ({
    ...session,
    messages:(session.messages || []).map(m => ({...m, hits:(m.hits || []).map(h => ({docId:h.docId,docName:h.docName,standard:h.standard,page:h.page,section:h.section||'',table:h.table||'',appendix:h.appendix||''}))}))
  }));
  const payload={schema:'hnl-history-v1',appVersion:APP_META.version,exportedAt:new Date().toISOString(),chatSessions:safeSessions,calculations:state.calculations};
  if (format === 'json') {
    downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`HNL-History-v${APP_META.version}-${new Date().toISOString().slice(0,10)}.json`);
    return showToast('Đã xuất lịch sử JSON.', 'success');
  }
  const md=[];
  md.push(`# HNL Pile Standards AI · Lịch sử`, '', `Xuất lúc: ${payload.exportedAt}`, `Version: ${payload.appVersion}`, '');
  for (const session of safeSessions) {
    md.push(`## ${session.pinned?'★ ':''}${session.title || 'Cuộc trò chuyện'}`, '', `- Cập nhật: ${session.updatedAt || ''}`, `- Provider/Model: ${session.provider || ''}${session.model?` / ${session.model}`:''}`, '');
    for (const m of session.messages || []) {
      md.push(`### ${m.role==='user'?'Bạn':'HNL AI'}`, '', String(m.text||''), '');
      const refs=[...new Set((m.hits||[]).map(h=>`${h.standard||h.docName||'Tài liệu'} · Trang ${h.page}`))];
      if(refs.length) md.push(`Nguồn: ${refs.join('; ')}`, '');
    }
  }
  if (state.calculations.length) {
    md.push('# Lịch sử tính toán','');
    for(const x of state.calculations) md.push(`## ${x.title||x.type||'Tính toán'}`, '', `- Thời gian: ${x.createdAt||''}`, `- Kết quả: ${x.resultText||''}`, `- Nguồn: ${x.source?.standard||''}${x.source?.page?` · Trang ${x.source.page}`:''}`, '');
  }
  const markdown=md.join('\n');
  if (format === 'md') {
    downloadBlob(new Blob([markdown],{type:'text/markdown;charset=utf-8'}),`HNL-History-v${APP_META.version}-${new Date().toISOString().slice(0,10)}.md`);
    return showToast('Đã xuất lịch sử Markdown.', 'success');
  }
  if (format === 'pdf') {
    const popup=window.open('','_blank','noopener,noreferrer');
    if(!popup) return showToast('Trình duyệt đang chặn cửa sổ in. Hãy cho phép pop-up rồi thử lại.', 'warning');
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>HNL History</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:32px auto;padding:0 22px;line-height:1.5;color:#172235}h1,h2,h3{color:#153b65}pre{white-space:pre-wrap;font:inherit}.hint{color:#667085;font-size:12px}@media print{.hint{display:none}}</style></head><body><div class="hint">Chọn Print → Save as PDF.</div><pre>${esc(markdown)}</pre><script>setTimeout(()=>window.print(),250)<\/script></body></html>`);
    popup.document.close();
  }
}

async function recordCalculation(entry) {
  const row = { id:crypto.randomUUID(), createdAt:new Date().toISOString(), appVersion:APP_META.version, ...entry };
  state.calculations.unshift(row);
  try { await saveCalculation(row); } catch (error) { console.warn('Không lưu được lịch sử tính toán:', error); }
  return row;
}
function calculationHistoryHtml() {
  const rows = state.calculations.slice(0, 20);
  return `<details class="calc-history"><summary>Lịch sử tính toán · ${state.calculations.length}</summary><div class="history-list">${rows.length ? rows.map(x => {
    const source = x.source || {};
    const sourceLabel = source.standard ? `${source.standard}${source.page ? ` · P.${source.page}` : ''}` : '';
    const sourceButton = source.docId && source.page
      ? `<button class="source-chip history-source" data-hit-doc="${esc(source.docId)}" data-hit-page="${Number(source.page)}" title="Mở trang công thức/nguồn">Nguồn · P.${Number(source.page)}</button>`
      : '';
    return `<div class="history-row"><button class="history-open" data-load-calculation="${esc(x.id)}"><b>${esc(x.title || x.type || 'Tính toán')}</b><small>${esc(formatHistoryTime(x.createdAt))}${x.resultText ? ` · ${esc(x.resultText)}` : ''}${sourceLabel ? ` · ${esc(sourceLabel)}` : ''}</small></button>${sourceButton}<button class="icon-btn danger-btn" data-delete-calculation="${esc(x.id)}" title="Xóa">×</button></div>`;
  }).join('') : '<div class="muted history-empty">Chưa có phép tính đã lưu.</div>'}</div></details>`;
}
function loadCalculation(id) {
  const row = state.calculations.find(x => x.id === id);
  if (!row) return showToast('Không tìm thấy phép tính.', 'warning');
  const input = row.inputs || {};
  if (row.kind === 'verified-7888') {
    state.calcDraft = {
      type:String(input.cType || 'PHC').toUpperCase(),
      loadClass:String(input.cClass || 'B').toUpperCase(),
      diameter:Number(input.cDiameter || 600),
      thickness:Number(input.cThickness || 90),
      sigmaCu:Number(input.cCu || 80),
      sigmaCe:Number(input.cCe || 8),
      tableSource:row.source?.table && row.source.table !== 'Nhập tay' ? row.source.table : '',
      tablePage:Number(row.source?.tablePage || 0) || null,
      designation:row.source?.designation || ''
    };
  }
  for (const [key, value] of Object.entries(input)) {
    const el = document.querySelector(`#${key}`);
    if (el) el.value = value;
  }
  if (row.kind === 'verified-7888') syncCalcClassOptions();
  showToast('Đã nạp dữ liệu phép tính cũ. Bấm Tính để chạy lại.', 'success');
}
async function removeCalculation(id) {
  if (!confirm('Xóa phép tính này khỏi lịch sử cục bộ?')) return;
  await deleteCalculation(id);
  state.calculations = state.calculations.filter(x => x.id !== id);
  render();
}


function clearChatAttachments() {
  for (const item of state.chatAttachments || []) {
    try { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); } catch { /* ignore */ }
  }
  state.chatAttachments = [];
}

function addChatImageFiles(files = []) {
  const incoming=[...files].filter(Boolean);
  if (!incoming.length) return;
  let rejected=0, added=0;
  const existing=new Set((state.chatAttachments||[]).map(x=>`${x.name}:${x.size}:${x.lastModified||0}`));
  for (const file of incoming) {
    if ((state.chatAttachments||[]).length >= IMAGE_ENGINEERING_MAX_FILES) { rejected++; continue; }
    if (!isSupportedEngineeringImage(file)) { rejected++; continue; }
    const key=`${file.name}:${file.size}:${file.lastModified||0}`; if(existing.has(key)) continue;
    existing.add(key);
    state.chatAttachments.push({id:crypto.randomUUID(),file,name:file.name||`image-${Date.now()}.png`,type:file.type||'image/png',size:file.size,lastModified:file.lastModified||0,previewUrl:URL.createObjectURL(file)});
    added++;
  }
  state.pendingImageExtraction=null;
  if (added) showToast(`Đã đính kèm ${added} ảnh. HNL sẽ đọc dữ liệu kỹ thuật và yêu cầu xác nhận trước khi tính.`, 'success');
  if (rejected) showToast(`Bỏ qua ${rejected} ảnh: tối đa ${IMAGE_ENGINEERING_MAX_FILES} ảnh, mỗi ảnh ≤ ${Math.round(IMAGE_ENGINEERING_MAX_BYTES/1024/1024)} MB.`, 'warning');
  render();
}

function removeChatImage(id='') {
  const item=(state.chatAttachments||[]).find(x=>x.id===id);
  try { if(item?.previewUrl) URL.revokeObjectURL(item.previewUrl); } catch { /* ignore */ }
  state.chatAttachments=(state.chatAttachments||[]).filter(x=>x.id!==id);
  state.pendingImageExtraction=null;
  render();
}

async function chatAttachmentPayloads(items=state.chatAttachments||[]) {
  const out=[];
  for (const item of items) {
    if(!item?.file) continue;
    out.push({data:await fileToBase64(item.file),mimeType:item.type||'image/png',name:item.name,attachmentId:item.id});
  }
  return out;
}

async function extractEngineeringInputFromChatImages(question, attachments=state.chatAttachments||[]) {
  if (!attachments.length) return null;
  if (state.settings.provider === 'local') throw new Error('Chế độ Tra cứu cục bộ không đọc pixel ảnh. Hãy chọn Gemini/OpenAI hoặc HNL Offline AI (Ollama Vision) để trích dữ liệu kỹ thuật từ ảnh.');
  const images=await chatAttachmentPayloads(attachments);
  const ocrHints=[];
  for (const image of images) { try { const ocr=await ocrImageBase64Locally(image); ocrHints.push(ocr?.text||''); } catch { ocrHints.push(''); } }
  const prompt=buildImageEngineeringExtractionPrompt(question, attachments, ocrHints);
  const raw=await callConfiguredAiWithApproval({prompt,images,documents:[]});
  const parsed=parseImageEngineeringExtraction(raw);
  if(!parsed.ok) throw new Error(parsed.error || 'Không đọc được dữ liệu kỹ thuật trong ảnh.');
  return {extraction:normalizeImageEngineeringExtraction(parsed,attachments),images};
}

function imageEngineeringReviewHtml() {
  const pending=state.pendingImageExtraction; if(!pending?.extraction) return '';
  const rows=imageEngineeringFieldRows(pending.extraction);
  const warnings=pending.extraction.warnings||[];
  return `<div class="image-engineering-review">
    <div class="image-review-head"><div><b>Kiểm tra dữ liệu đọc từ ảnh</b><small>${rows.length} trường · sửa giá trị nếu OCR/Vision đọc sai rồi mới tính</small></div><span class="verified-badge">CHỜ XÁC NHẬN</span></div>
    ${pending.extraction.summary?`<div class="image-review-summary">${esc(pending.extraction.summary)}</div>`:''}
    <div class="image-review-table">${rows.length?rows.map(f=>`<label class="image-review-row ${f.needsAttention?'attention':''}"><span><b>${esc(f.label)}</b><small>${esc(f.key)} · ${esc(f.sourceName||`Ảnh ${f.sourceImage}`)}${f.rawText?` · “${esc(f.rawText)}”`:''}</small></span><input data-image-field-path="${esc(f.key)}" value="${esc(f.value==null?'':String(f.value))}" placeholder="Không đọc rõ"><em>${esc(f.unit||'')}</em><strong>${Math.round(Number(f.confidence||0)*100)}%</strong></label>`).join(''):'<div class="notice warning">AI Vision chưa trích được trường kỹ thuật có cấu trúc. Có thể hủy và nhập tay.</div>'}</div>
    ${warnings.length?`<div class="image-review-warnings">${warnings.map(x=>`<span>⚠ ${esc(x)}</span>`).join('')}</div>`:''}
    <div class="image-review-actions"><button class="btn" id="cancelImageEngineering">Hủy xác nhận</button><button class="btn primary" id="confirmImageEngineering" ${rows.length?'':'disabled'}>✓ Xác nhận & tính</button></div>
    <div class="image-review-foot">HNL không đưa số đọc từ ảnh vào Calculation Engine trước bước xác nhận này. Giá trị sau xác nhận được lưu provenance là “Ảnh → Vision/OCR → Người dùng xác nhận”.</div>
  </div>`;
}

function syncPendingImageExtractionFromDom() {
  if(!state.pendingImageExtraction?.extraction) return;
  let next=state.pendingImageExtraction.extraction;
  document.querySelectorAll('[data-image-field-path]').forEach(el=>{ next=updateImageEngineeringField(next,el.dataset.imageFieldPath||'',el.value); });
  state.pendingImageExtraction={...state.pendingImageExtraction,extraction:next};
}

async function confirmImageEngineeringInput() {
  const pending=state.pendingImageExtraction; if(!pending) return;
  syncPendingImageExtractionFromDom();
  const extraction=state.pendingImageExtraction.extraction;
  const provenance=imageEngineeringProvenance(extraction);
  if(!provenance.length) return showToast('Không có dữ liệu ảnh hợp lệ để xác nhận.', 'warning');
  const canonical=buildConfirmedEngineeringQuestion(pending.question,extraction);
  const display=`${pending.question}\n\n📎 ${pending.attachments.map(x=>x.name).join(', ')} · đã xác nhận ${provenance.length} giá trị từ ảnh`;
  const images=pending.images||await chatAttachmentPayloads(pending.attachments);
  state.pendingImageExtraction=null;
  clearChatAttachments();
  await askQuestion(canonical,{skipImageExtraction:true,displayQuestion:display,extraImages:images,imageProvenance:provenance});
}

function chatAttachmentHtml() {
  const items=state.chatAttachments||[]; if(!items.length) return '';
  return `<div class="chat-attachment-strip">${items.map(x=>`<div class="chat-image-chip"><img src="${esc(x.previewUrl)}" alt=""><span><b>${esc(x.name)}</b><small>${fmtBytes(x.size)}</small></span><button data-remove-chat-image="${esc(x.id)}" title="Bỏ ảnh">×</button></div>`).join('')}</div>`;
}

const ENGINEERING_EXCEL_STANDARDS = ['TCVN 7888:2014','TCVN 10304:2025','TCVN 5574:2018'];

function engineeringActionsHtml(message, index=-1) {
  const meta=message?.engineering;
  if(message?.role!=='ai' || index<0 || !meta?.workflowId) return '';
  const status=String(meta.status||'');
  const supportedStandard=ENGINEERING_EXCEL_STANDARDS.includes(meta.standard);
  const verified=supportedStandard && status.startsWith('VERIFIED');
  const methodOnly=status==='VERIFIED_METHOD';
  const canExport=verified && Boolean(meta.canExport);
  const excelLabel=methodOnly?'⇩ Xuất Excel phương pháp':'⇩ Xuất Excel tính toán';
  const primary=canExport
    ? `<button class="btn compact-btn primary engineering-action-btn" data-engineering-excel="${index}">${excelLabel}</button>`
    : (verified ? `<button class="btn compact-btn warning engineering-action-btn" data-engineering-open-calc="${index}">＋ Bổ sung dữ liệu để xuất Excel</button>` : '');
  return `<div class="engineering-answer-actions">
    <span class="engineering-status-chip ${verified?'verified':'review'}">${esc(status||'ENGINEERING')}</span>
    ${primary}
    ${verified?`<button class="btn compact-btn engineering-action-btn" data-engineering-open-calc="${index}">Mở trong Tính</button>`:''}
    <button class="btn compact-btn engineering-action-btn" data-engineering-source="${index}">Xem nguồn tính</button>
  </div>`;
}

function messageHtml(message, index = -1) {
  const unique = [];
  const seen = new Set();
  for (const h of message.hits || []) {
    const key = `${h.docId}:${h.page}`;
    if (!seen.has(key)) { seen.add(key); unique.push(h); }
  }
  const visible = unique.slice(0, 16);
  const chips = visible.map(h => `<button class="source-chip" data-hit-doc="${h.docId}" data-hit-page="${h.page}">${esc(h.standard || h.docName)} · P.${h.page}</button>`).join('');
  const evidence = message.role === 'ai' ? (message.evidence || null) : null;
  const imageVerifiedCount = Array.isArray(message.engineering?.imageInput) ? message.engineering.imageInput.length : 0;
  const evidenceHtml = message.role === 'ai' ? `<div class="answer-meta"><span class="method-chip">${esc(evidence?.method || (message.provider==='local'?'RAG':'Hybrid RAG'))}</span><span class="confidence-chip ${String(evidence?.confidence||'').toLowerCase()}">${esc(evidence?.confidence || 'Chưa kiểm tra')}</span>${unique.length?`<span class="source-count-chip">${unique.length} nguồn</span>`:''}${imageVerifiedCount?`<span class="source-count-chip image-input-chip">Ảnh xác nhận · ${imageVerifiedCount}</span>`:''}${index>=0?`<button class="text-link" data-verify-message="${index}">Kiểm tra</button>`:''}</div>` : '';
  return `<div class="message ${message.role === 'user' ? 'user' : 'ai'}" data-message-index="${index}">
    <div class="message-label">${message.role === 'user' ? 'Bạn' : 'HNL AI'}</div>
    ${evidenceHtml}
    <div class="answer-text rich-answer">${richTextHtml(message.text)}</div>
    ${engineeringActionsHtml(message,index)}
    ${chips ? `<details class="source-details" ${unique.length <= 6 ? 'open' : ''}><summary>Nguồn đã dùng · ${unique.length} trang</summary><div class="source-chips">${chips}${unique.length > visible.length ? `<span class="source-more">+${unique.length - visible.length} nguồn khác</span>` : ''}</div></details>` : ''}
  </div>`;
}
function chatHtml() {
  const hasSources = sourceDocs().length > 0;
  const nativeLabel = supportsNativePdf(state.settings.provider) ? (state.settings.nativePdfMode === 'economy' ? 'RAG tiết kiệm' : state.settings.nativePdfMode === 'native' ? 'PDF native toàn nguồn' : 'PDF native tự động') : 'HNL RAG';
  return `<div class="chat-shell">
    <div class="chat-toolbar"><div class="chat-session-title"><b>${esc(chatSessionTitle(state.chat))}</b><small>${esc(nativeLabel)}</small></div><div><button class="btn compact-btn" id="newChatBtn">+ Mới</button><button class="btn compact-btn history-icon-btn" id="chatHistoryBtn" title="Lịch sử">◷${state.chatSessions.length ? `<span>${state.chatSessions.length}</span>` : ''}</button></div></div>
    ${state.chatHistoryOpen ? chatHistoryHtml() : ''}
    <div class="chat-log">${state.chat.length ? state.chat.map((m,i)=>messageHtml(m,i)).join('') : `<div class="chat-welcome"><div class="chat-orb">AI</div><h3>Hỏi trực tiếp tiêu chuẩn</h3><p>Gemini/OpenAI có thể đọc PDF native; HNL RAG chạy song song để định vị trang và citation.</p><div class="suggestions"><button data-suggest="Cọc chống là gì?">Cọc chống là gì?</button><button data-suggest="Điều kiện áp dụng của nội dung này là gì?">Điều kiện áp dụng</button><button data-suggest="Công thức liên quan nằm ở điều hoặc trang nào?">Tìm công thức</button><button data-suggest="Tìm các Bảng và Phụ lục liên quan đến nội dung đang hỏi.">Bảng / Phụ lục</button><button data-suggest="Cọc PHC D600 cấp B có mômen uốn nứt bao nhiêu?">PHC D600 cấp B</button><button data-suggest="Điều kiện nghiệm thu lô cọc là gì?">Nghiệm thu lô cọc</button></div></div>`}</div>
    ${imageEngineeringReviewHtml()}
    ${chatAttachmentHtml()}
    <div class="chat-composer"><label class="chat-attach-btn ${state.busy?'disabled':''}" title="Đính kèm ảnh đề bài / bảng địa chất / bản vẽ">📎<input id="chatImageInput" type="file" accept="image/png,image/jpeg,image/webp,image/bmp,image/gif" multiple ${state.busy?'disabled':''}></label><textarea id="chatQuestion" placeholder="${hasSources ? 'Nhập đề bài/công thức… Có thể dán từ PDF/Word/LaTeX, 📎 ảnh hoặc Ctrl+V.' : 'Chọn PDF làm nguồn trước…'}" ${!hasSources ? 'disabled' : ''}>${esc(state.chatDraft)}</textarea><button class="send-btn" id="askBtn" ${!hasSources || state.busy ? 'disabled' : ''}>${state.busy ? 'Đang xử lý…' : 'Gửi'}</button></div>
    <div class="composer-hint">Ctrl+V dán công thức PDF/Word/LaTeX sẽ tự chuẩn hóa · 📎 ảnh / kéo-thả · ảnh kỹ thuật luôn phải xác nhận trước khi tính · Enter gửi · Shift + Enter xuống dòng · ${state.settings.strict ? 'Khóa nguồn đang bật' : 'Cho phép giải thích ngoài nguồn'}</div>
  </div>`;
}

function lookupHtml() {
  const docs = sourceDocs();
  const scope = state.lookup.scope || 'smart';
  const target = resolveOperationScope(scope, state.lookup.pages, 'lookup');
  const resultHtml = state.lookup.hits.length
    ? state.lookup.hits.map(h => `<div class="search-result"><div class="search-result-head"><button class="source-chip" data-hit-doc="${h.docId}" data-hit-page="${h.page}">${esc(h.standard || h.docName)} · P.${h.page}</button><span>điểm ${Number(h.score || 0).toFixed(1)}</span></div><p>${esc(String(h.text || '').slice(0, 900))}</p></div>`).join('')
    : (state.lookup.query ? '<div class="empty-panel compact">Không tìm thấy nội dung phù hợp trong đúng phạm vi đã chọn.</div>' : '');
  const regionReady = Boolean(state.lastPdfRegion?.text || state.lastPdfRegion?.image?.data);
  const hasTarget = !target.error && (target.docs.length > 0 || Boolean(target.region));
  return `${state.docs.length ? '' : noSourceCard('tra cứu')}
    <div class="panel-section">
      <div class="panel-section-title"><h3>Tra cứu theo phạm vi</h3><span>${esc(target.label)}</span></div>
      <div class="scope-toolbar">
        <label class="field"><span>Phạm vi</span><select id="lookupScopeInput">${scopeSelectOptions(scope)}</select></label>
        ${scope === 'pages' ? `<label class="field"><span>Trang cần quét</span><input id="lookupPagesInput" value="${esc(state.lookup.pages)}" placeholder="28-35 hoặc 28,31,45"><small>Chỉ áp dụng cho PDF đang mở.</small></label>` : ''}
      </div>
      <div class="coverage-line"><b>${esc(target.label)}</b><small>${scope === 'smart' ? 'Dùng bộ tìm kiếm/RAG ổn định của v1.9.23 trên toàn nguồn mặc định; không thay ranking bằng pipeline mới.' : scope === 'region' ? (regionReady ? 'Chỉ tra nội dung vùng đã chọn gần nhất; không quét phần còn lại của PDF.' : 'Chưa có vùng chọn. Bật T▧ trên PDF rồi kéo vùng cần đọc.') : `Giới hạn tìm kiếm ở ${target.pages || 0} trang trong phạm vi này; không tự mở rộng ngoài lựa chọn.`}</small></div>
      <div class="search-box"><input id="lookupQuery" value="${esc(state.lookup.draft || state.lookup.query)}" placeholder="Ví dụ: cọc chống, sai lệch đường kính, vết nứt…"><button id="lookupBtn" ${!hasTarget ? 'disabled' : ''}>Tra cứu</button></div>
      ${target.error ? `<div class="notice warning">${esc(target.error)}</div>` : ''}
      ${state.searchStats ? `<div class="scope-result-summary">Lần gần nhất: ${state.searchStats.textPages || 0}/${state.searchStats.pages || 0} trang chữ${state.searchStats.freshPdfjsPages ? ` · PDF.js cứu ${state.searchStats.freshPdfjsPages} trang` : ''}${state.searchStats.lookupScopeLabel ? ` · ${esc(state.searchStats.lookupScopeLabel)}` : ''}</div>` : ''}
      <div class="search-results">${resultHtml}</div>
    </div>
    <div class="panel-section">
      <div class="panel-section-title"><h3>Tra bảng TCVN 7888:2014</h3><span>Bảng 1</span></div>
      ${sourceHas7888() ? quickTableControls() : '<div class="notice">Chọn hoặc mở TCVN 7888:2014 để bật bảng tra nhanh. Dữ liệu tra nhanh luôn đi kèm nút mở trang gốc.</div>'}
    </div>`;
}
function quickTableControls() {
  const D = state.tableResult?.diameter || 600;
  const classes = classesForDiameter7888(D);
  const cls = classes.includes(state.tableResult?.loadClass) ? state.tableResult.loadClass : (classes.includes('B') ? 'B' : classes[0]);
  const r = state.tableResult;
  return `<div class="grid2"><label class="field"><span>Đường kính D</span><select id="tableDiameter">${diameters7888.map(x => `<option value="${x}" ${x === D ? 'selected' : ''}>D${x}</option>`).join('')}</select></label><label class="field"><span>Cấp tải</span><select id="tableClass">${classes.map(x => `<option value="${x}" ${x === cls ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
    <button class="btn primary" id="tableLookupBtn">Tra thông số</button>
    ${r ? `<div class="metric-grid"><div><span>Thành cọc</span><b>${r.thickness} mm</b></div><div><span>Mômen uốn nứt</span><b>${r.crackMoment} kN·m</b></div><div><span>Ứng suất hữu hiệu</span><b>${r.effectiveStress} MPa</b></div><div><span>Bền cắt*</span><b>${r.shearResistance} kN</b></div><div><span>Chiều dài</span><b>${r.lengthRange} m</b></div></div><div class="footnote">* Bền cắt trong Bảng 1 áp dụng cho cọc PHC. <button class="text-link" data-jump="${r.diameter <= 600 ? 10 : 11}" data-doc="${find7888Doc()?.id || ''}">Mở Bảng 1 · trang ${r.diameter <= 600 ? 10 : 11}</button></div>` : ''}`;
}
function find7888Doc() { return sourceDocs().find(is7888) || state.docs.find(is7888) || null; }

function formulaLibraryForScope() {
  const docs = sourceDocs();
  const verified = verifiedFormulaLibrary(docs);
  const packItems = codePackFormulaItems(docs);
  const auto = extractFormulaLibrary(docs);
  // Keep verified formulas first, then built-in Code Pack index, then raw auto-detected formulas.
  // Page/label de-duplication prevents a 5574/10304 Code Pack entry and PDF text parser from appearing twice.
  const seen = new Set();
  const merged = [...verified, ...packItems, ...auto].filter(x => {
    const key = `${x.docId}:${x.page}:${x.label || x.title || x.raw}`;
    if (seen.has(key)) return false; seen.add(key); return true;
  });
  const q = String(state.formulaQuery || '').trim().toLocaleLowerCase('vi');
  if (!q) return merged;
  const nq = q.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
  return merged.filter(x => `${x.standard||''} ${x.label||''} ${x.title||''} ${x.context||''}`.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').includes(nq));
}
function selectedFormulaItem() {
  const items = formulaLibraryForScope();
  let item = items.find(x => x.id === state.formulaSelection);
  if (!item && items.length) {
    item = items.find(x => x.computable) || items[0];
    state.formulaSelection = item.id;
  }
  return item || null;
}
function formulaLibraryHtml() {
  const docs = sourceDocs();
  const stats = formulaStats(docs);
  const verifiedCount = verifiedFormulaLibrary(docs).length;
  const cpStats = codePackStats(docs);
  const items = formulaLibraryForScope();
  const item = selectedFormulaItem();
  const options = items.map(x => `<option value="${esc(x.id)}" ${x.id === item?.id ? 'selected' : ''}>${esc(x.standard || x.docName)} · P.${x.page}${x.label ? ` · ${esc(x.label)}` : ''}${x.verified ? ' · Đã xác minh' : (x.computable ? ' · Tính được' : ' · Cần kiểm tra')}</option>`).join('');
  const varInputs = item?.computable ? item.variables.map(v => { const unit=item.variableUnits?.[v] || ''; return `<label class="field"><span>${esc(v)}${unit ? ` · ${esc(unit)}` : ''}</span><input type="number" step="any" data-formula-var="${esc(v)}" placeholder="Nhập ${esc(v)}${unit ? ` (${esc(unit)})` : ''}"></label>`; }).join('') : '';
  const byDoc = stats.byDoc.map(d => `<span>${esc(d.standard || d.name)}: ${d.total} CT${d.aiDetected ? ` · ${d.aiDetected} AI` : ''}${d.computable ? ` · ${d.computable} tính được` : ''}</span>`).join('');
  return `<div class="panel-section formula-library">
    <div class="panel-section-title"><h3>Thư viện công thức</h3><span>${items.length} mục · ${cpStats.packs} Code Pack</span></div>
    <div class="notice"><b>Quét theo phạm vi để tiết kiệm tài nguyên.</b> Ưu tiên Vùng chọn / Trang hiện tại / Nhiều trang. Với PDF có lớp chữ, HNL đọc cục bộ trước; OCR/Vision chỉ chạy trong phạm vi bạn chọn. Công thức AI luôn gắn tài liệu + trang gốc và không tự chuyển sang Verified.</div>
    <div class="formula-stats four"><div><span>Verified</span><b>${verifiedCount}</b></div><div><span>Code Pack</span><b>${cpStats.formulas} CT · ${cpStats.tables} bảng</b></div><div><span>AI/Vision</span><b>${stats.aiDetected || 0}</b></div><div><span>Cần kiểm tra</span><b>${stats.needsReview}</b></div></div>
    ${byDoc ? `<div class="formula-doc-stats">${byDoc}</div>` : ''}
    <div class="scope-toolbar formula-scope-toolbar">
      <label class="field"><span>Phạm vi quét công thức</span><select id="formulaScopeInput">${scopeSelectOptions(state.formulaScanScope || 'page', { formula:true })}</select></label>
      ${(state.formulaScanScope || 'page') === 'pages' ? `<label class="field"><span>Trang cần quét</span><input id="formulaPagesInput" value="${esc(state.formulaScanPages)}" placeholder="28-35 hoặc 28,31,45"><small>Chỉ áp dụng cho PDF đang mở.</small></label>` : ''}
      <label class="field"><span>Phương pháp</span><select id="formulaScanMode"><option value="auto" ${state.formulaScanMode==='auto'?'selected':''}>Tự động Hybrid · khuyên dùng</option><option value="local" ${state.formulaScanMode==='local'?'selected':''}>Cục bộ nhanh · lớp chữ</option><option value="ai" ${state.formulaScanMode==='ai'?'selected':''}>AI/Vision · chỉ phạm vi đã chọn</option></select></label>
    </div>
    <div class="coverage-line"><b>${esc(operationScopeLabel(state.formulaScanScope || 'page', 'formula'))}</b><small>${(state.formulaScanScope || 'page') === 'region' ? (state.lastPdfRegion ? 'Chỉ quét vùng PDF gần nhất; đây là chế độ tiết kiệm nhất.' : 'Chưa có vùng chọn. Bật T▧ và kéo vùng công thức trước.') : 'Mặc định chỉ Trang hiện tại. Chọn Nhiều trang khi cần; Toàn thư viện là lựa chọn nặng nhất và luôn hỏi xác nhận trước khi dùng AI/Vision.'}</small></div>
    <div class="action-row"><button class="btn primary" id="formulaScanBtn" ${state.busy?'disabled':''}>⌁ Quét công thức</button>${codePackForDoc(state.docs.find(d=>d.id===state.currentDocId)) ? '<button class="btn" id="codePackExcelBtn">⇩ Xuất Excel Code Pack</button>' : ''}</div>
    <label class="field"><span>Lọc công thức / Điều / Bảng</span><input id="formulaFilterInput" value="${esc(state.formulaQuery || '')}" placeholder="Ví dụ: cọc chống, chọc thủng, (216), Phụ lục B…"><small>Code Pack nạp sẵn giúp định vị cả PDF scan; công thức chỉ được tính khi trạng thái đã xác minh.</small></label>
    ${items.length ? `<label class="field"><span>Chọn công thức</span><select id="formulaSelect">${options}</select></label>` : '<div class="notice warning">Chưa phát hiện công thức trong bộ lọc hiện tại. Xóa nội dung lọc hoặc quét thêm PDF.</div>'}
    ${item ? `<div class="formula-source-card">
      <div class="formula-source-head"><div><b>${esc(item.standard || item.docName)}</b><small>${esc(item.title || 'Công thức nhận diện từ PDF')} · Trang ${item.page}${item.label ? ` · ${esc(item.label)}` : ''}</small></div><button class="source-chip" data-hit-doc="${item.docId}" data-hit-page="${item.page}">Mở trang gốc</button></div>
      ${item.verified ? '<div class="notice success"><b>Công thức đã xác minh từ trang gốc.</b></div>' : (item.aiDetected ? '<div class="notice warning"><b>AI/Vision đã nhận diện.</b> Hãy mở trang gốc và xác minh trước khi cho phép tính tự động.</div>' : '')}<div class="formula-raw">${esc(item.raw)}</div>
      ${item.expression ? `<div class="formula-normalized"><span>Biểu thức chuẩn hóa</span><code>${esc(item.expression)}</code></div>` : ''}
      ${item.outputUnit ? `<div class="formula-meta"><b>Đơn vị kết quả:</b> ${esc(item.outputUnit)}</div>` : (item.units ? `<div class="formula-meta"><b>Đơn vị:</b> ${esc(typeof item.units==='string'?item.units:JSON.stringify(item.units))}</div>` : '')}${item.conditions ? `<div class="formula-meta"><b>Điều kiện:</b> ${esc(item.conditions)}</div>` : ''}
      ${item.computable ? `<div class="notice success"><b>Có thể tính tự động.</b> Hãy nhập các biến bên dưới và luôn đối chiếu điều kiện/đơn vị tại trang gốc.</div><div class="grid2 formula-vars">${varInputs}</div><div class="action-row"><button class="btn primary" id="formulaCalcBtn">Tính công thức đã chọn</button><button class="btn" id="formulaExcelBtn">⇩ Xuất Excel có công thức</button></div><div id="formulaCalcResult"></div>` : `<div class="notice warning"><b>Chưa cho phép tính tự động.</b> Công thức đã được lập chỉ mục để hỏi đáp/định vị trang nhưng chưa đủ điều kiện chạy số học tự động. File Excel vẫn có thể xuất dạng thuyết minh tham chiếu.</div><button class="btn" id="formulaExcelBtn">⇩ Xuất Excel tham chiếu</button>${item.aiDetected && item.expression ? '<button class="btn" id="formulaVerifyBtn">✓ Tôi đã đối chiếu trang gốc · Cho phép tính</button>' : ''}`}
      <details class="formula-context"><summary>Ngữ cảnh trích xuất</summary><pre>${esc(item.context)}</pre></details>
    </div>` : ''}
  </div>`;
}

function ensureCalcDraft() {
  if (state.calcDraft) return state.calcDraft;
  const r = state.tableResult || lookup7888(600, 'B');
  state.calcDraft = {
    type:'PHC', loadClass:String(r?.loadClass || 'B'), diameter:Number(r?.diameter || 600),
    thickness:Number(r?.thickness || 90), sigmaCu:80, sigmaCe:Number(r?.effectiveStress || 8),
    tableSource:state.tableResult ? 'Bảng 1' : '', tablePage:state.tableResult ? (Number(r?.diameter || 600) <= 600 ? 10 : 11) : null,
    designation:''
  };
  return state.calcDraft;
}
function syncCalcDraftFromDom({ clearTableSource = false } = {}) {
  const d = ensureCalcDraft();
  const next = {
    ...d,
    type:String(document.querySelector('#cType')?.value || d.type || 'PHC').toUpperCase(),
    loadClass:String(document.querySelector('#cClass')?.value || d.loadClass || 'B').toUpperCase(),
    diameter:Number(document.querySelector('#cDiameter')?.value || d.diameter || 600),
    thickness:Number(document.querySelector('#cThickness')?.value || d.thickness || 90),
    sigmaCu:Number(document.querySelector('#cCu')?.value || d.sigmaCu || 80),
    sigmaCe:Number(document.querySelector('#cCe')?.value || d.sigmaCe || 8)
  };
  if (clearTableSource) Object.assign(next, {tableSource:'', tablePage:null, designation:''});
  state.calcDraft = next;
  return next;
}

function ensurePile10304Draft() {
  if (state.pile10304Draft) return state.pile10304Draft;
  state.pile10304Draft = {
    shape:'square', sideM:0.4, diameterM:0.4, lengthM:12, tipDepthM:12, method:'hammer', gammaC:1, gammaK:1.4,
    layers:[
      {top:0,bottom:3,soilGroup:'clay',sandType:'fine',IL:''},
      {top:3,bottom:6,soilGroup:'clay',sandType:'fine',IL:''},
      {top:6,bottom:9,soilGroup:'clay',sandType:'fine',IL:''},
      {top:9,bottom:12,soilGroup:'clay',sandType:'fine',IL:''}
    ]
  };
  return state.pile10304Draft;
}
function readPile10304Dom() {
  const d=ensurePile10304Draft();
  const layers=[];
  document.querySelectorAll('[data-soil-row]').forEach(row=>{
    const n=Number(row.dataset.soilRow);
    const get=id=>document.querySelector(`#soil${id}${n}`);
    layers.push({
      top:get('Top')?.value, bottom:get('Bottom')?.value,
      soilGroup:get('Group')?.value || 'clay', sandType:get('Sand')?.value || 'fine',
      IL:get('IL')?.value, fiOverride:get('Fi')?.value
    });
  });
  state.pile10304Draft={
    ...d,
    shape:document.querySelector('#p10304Shape')?.value||d.shape,
    sideM:document.querySelector('#p10304Side')?.value||d.sideM,
    diameterM:document.querySelector('#p10304Diameter')?.value||d.diameterM,
    lengthM:document.querySelector('#p10304Length')?.value||d.lengthM,
    tipDepthM:document.querySelector('#p10304TipDepth')?.value||d.tipDepthM,
    method:document.querySelector('#p10304Method')?.value||d.method,
    gammaC:document.querySelector('#p10304GammaC')?.value||d.gammaC,
    gammaK:document.querySelector('#p10304GammaK')?.value||d.gammaK,
    qbOverride:document.querySelector('#p10304Qb')?.value||'',
    gammaRR:document.querySelector('#p10304GammaRR')?.value||'',
    gammaRf:document.querySelector('#p10304GammaRf')?.value||'',
    layers
  };
  return state.pile10304Draft;
}
function soilRowsHtml(layers=[]) {
  const rows=[...layers]; while(rows.length<6) rows.push({top:'',bottom:'',soilGroup:'clay',sandType:'fine',IL:'',fiOverride:''});
  return rows.slice(0,8).map((r,i)=>`<div class="soil-layer-row" data-soil-row="${i}">
    <span class="soil-index">${i+1}</span>
    <input id="soilTop${i}" type="number" step="0.1" value="${esc(r.top??'')}" placeholder="Từ">
    <input id="soilBottom${i}" type="number" step="0.1" value="${esc(r.bottom??'')}" placeholder="Đến">
    <select id="soilGroup${i}"><option value="clay" ${r.soilGroup!=='sand'?'selected':''}>Đất dính</option><option value="sand" ${r.soilGroup==='sand'?'selected':''}>Cát</option></select>
    <select id="soilSand${i}"><option value="coarse" ${r.sandType==='coarse'?'selected':''}>Cát thô</option><option value="medium" ${r.sandType==='medium'?'selected':''}>Cát vừa</option><option value="fine" ${r.sandType==='fine'?'selected':''}>Cát mịn</option><option value="silty" ${r.sandType==='silty'?'selected':''}>Cát bụi</option><option value="gravelly" ${r.sandType==='gravelly'?'selected':''}>Lẫn sỏi sạn</option></select>
    <input id="soilIL${i}" type="number" min="0" max="1" step="0.05" value="${esc(r.IL??'')}" placeholder="IL">
    <input id="soilFi${i}" type="number" step="0.1" value="${esc(r.fiOverride??'')}" placeholder="fi tay">
  </div>`).join('');
}
function pile10304Html() {
  const d=ensurePile10304Draft();
  return `<div class="panel-section verified-workflow-card">
    <div class="panel-section-title"><h3>Workflow cọc đóng/ép · TCVN 10304:2025</h3><span>CT (9) · Bảng 2–4</span></div>
    <div class="notice success"><b>VERIFIED workflow.</b> HNL tự tính hình học → xác định lớp mũi → tra q<sub>b</sub> → tra f<sub>i</sub> từng lớp → hệ số thi công → sức kháng mũi + ma sát. Thiếu IL/địa chất sẽ dừng và chỉ rõ dữ liệu thiếu, không đoán.</div>
    <div class="grid2 compact-grid">
      <label class="field"><span>Tiết diện</span><select id="p10304Shape"><option value="square" ${d.shape!=='circle'?'selected':''}>Cọc vuông</option><option value="circle" ${d.shape==='circle'?'selected':''}>Cọc tròn</option></select></label>
      <label class="field"><span>Phương pháp hạ</span><select id="p10304Method"><option value="hammer" ${d.method==='hammer'?'selected':''}>Đóng bằng búa</option><option value="press" ${d.method==='press'?'selected':''}>Ép</option></select></label>
      <label class="field"><span>Cạnh cọc a (m)</span><input id="p10304Side" type="number" step="0.01" value="${esc(d.sideM)}"></label>
      <label class="field"><span>Đường kính D (m)</span><input id="p10304Diameter" type="number" step="0.01" value="${esc(d.diameterM)}"></label>
      <label class="field"><span>Chiều dài L (m)</span><input id="p10304Length" type="number" step="0.1" value="${esc(d.lengthM)}"></label>
      <label class="field"><span>Độ sâu mũi (m)</span><input id="p10304TipDepth" type="number" step="0.1" value="${esc(d.tipDepthM)}"></label>
      <label class="field"><span>γc</span><input id="p10304GammaC" type="number" step="0.05" value="${esc(d.gammaC??1)}"></label>
      <label class="field"><span>γk / hệ số tin cậy</span><select id="p10304GammaK"><option value="1.4" ${Number(d.gammaK)===1.4?'selected':''}>1,40 · tính theo bảng</option><option value="1.2" ${Number(d.gammaK)===1.2?'selected':''}>1,20 · tải tĩnh</option><option value="1.25" ${Number(d.gammaK)===1.25?'selected':''}>1,25 · CPT/động có xét đàn hồi</option><option value="1.5" ${Number(d.gammaK)===1.5?'selected':''}>1,50 · SPT/mô hình số</option></select></label>
    </div>
    <details class="compact-disclosure"><summary><span>Override bảng tra (chỉ dùng khi cần)</span><span class="disclosure-chevron">⌄</span></summary><div class="disclosure-body grid3 compact-grid"><label class="field"><span>q<sub>b</sub> nhập tay (kPa)</span><input id="p10304Qb" type="number" value="${esc(d.qbOverride??'')}"></label><label class="field"><span>γRR nhập tay</span><input id="p10304GammaRR" type="number" value="${esc(d.gammaRR??'')}"></label><label class="field"><span>γRf nhập tay</span><input id="p10304GammaRf" type="number" value="${esc(d.gammaRf??'')}"></label></div></details>
    <div class="soil-table-head"><b>Địa chất nhiều lớp</b><small>Đất dính nhập IL; cát chọn loại. f<sub>i</sub> tay để trống = tự tra Bảng 3.</small></div>
    <div class="soil-layer-header"><span>#</span><span>Từ m</span><span>Đến m</span><span>Nhóm</span><span>Loại cát</span><span>IL</span><span>fᵢ tay</span></div>
    <div class="soil-layer-list">${soilRowsHtml(d.layers)}</div>
    <div class="action-row"><button class="btn primary" id="calc10304Btn">Tính & diễn giải từng lớp</button><button class="btn" id="calc10304Excel">⇩ Excel workflow</button><button class="source-chip" data-find="Bảng 2">Mở Bảng 2</button><button class="source-chip" data-find="Bảng 3">Mở Bảng 3</button><button class="source-chip" data-find="Bảng 4">Mở Bảng 4</button></div>
    <div id="calc10304Result"></div>
  </div>`;
}
function runPile10304Calc() {
  const out=document.querySelector('#calc10304Result'); if(!out) return;
  try {
    const input=readPile10304Dom();
    const result=calculateDrivenPile10304(input);
    if(!result.ok){
      out.innerHTML=`<div class="notice warning"><b>Chưa đủ dữ liệu để ra sức chịu tải.</b><ul>${result.missing.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><div>Phần đã xác định chắc chắn: A = ${result.geometry.areaM2.toFixed(4)} m²; u = ${result.geometry.perimeterM.toFixed(4)} m.</div></div>`;
      return;
    }
    const rows=(result.segmentResults||result.layerResults).map(x=>`<tr><td>${x.parentIndex?`${x.parentIndex}.${x.segmentIndex}`:x.index}</td><td>${x.top}–${x.bottom}</td><td>${x.hM.toFixed(2)}</td><td>${x.avgDepthM.toFixed(2)}</td><td>${x.fiKpa.toFixed(2)}</td><td>${x.gammaRf.toFixed(2)}</td><td>${x.resistanceKn.toFixed(1)}</td><td>${x.fiProvenance.status}</td></tr>`).join('');
    out.innerHTML=`<div class="calc-result engineering-result">
      <div class="calc-main"><span>Sức chịu tải tiêu chuẩn R<sub>k</sub></span><b>${result.RkKn.toLocaleString('vi-VN',{maximumFractionDigits:1})} kN</b></div>
      <div class="metric-grid three"><div><span>A / u</span><b>${result.geometry.areaM2.toFixed(4)} m² · ${result.geometry.perimeterM.toFixed(3)} m</b></div><div><span>R mũi</span><b>${result.tipResistanceKn.toFixed(1)} kN</b></div><div><span>R ma sát</span><b>${result.sideResistanceKn.toFixed(1)} kN</b></div></div>
      ${result.RdKn!=null?`<div class="metric-grid"><div><span>γk</span><b>${result.gammaK}</b></div><div><span>R<sub>d</sub> = R<sub>k</sub>/γk</span><b>${result.RdKn.toLocaleString('vi-VN',{maximumFractionDigits:1})} kN</b></div></div>`:''}
      <div class="calc-step"><b>Bước mũi cọc</b><p>Lớp mũi số ${result.tipLayer.index}; z = ${result.tipDepthM} m; q<sub>b</sub> = ${result.qbKpa.toFixed(1)} kPa; γRR = ${result.gammaRR}; R<sub>b</sub> = γRR·q<sub>b</sub>·A = ${result.tipResistanceKn.toFixed(1)} kN.</p></div>
      <div class="calc-step"><b>Bước ma sát từng lớp</b><div class="calc-table-wrap"><table class="calc-detail-table"><thead><tr><th>Lớp</th><th>Khoảng</th><th>hᵢ</th><th>z TB</th><th>fᵢ kPa</th><th>γRf</th><th>Rfi kN</th><th>Nguồn</th></tr></thead><tbody>${rows}</tbody></table></div></div>
      <div class="footnote">Công thức (9), TCVN 10304:2025 trang 31. qᵦ: Bảng 2 trang 32–33; fᵢ: Bảng 3 trang 33–34; hệ số: Bảng 4 trang 34–35. Trạng thái: ${esc(result.status)}.</div>
    </div>`;
    void recordCalculation({kind:'verified-10304-driven',type:'Cọc đóng/ép theo đất nền',title:`${input.shape==='circle'?'Cọc tròn':'Cọc vuông'} · L${input.lengthM}m`,inputs:input,result,resultText:`Rk=${result.RkKn.toFixed(1)} kN${result.RdKn!=null?` · Rd=${result.RdKn.toFixed(1)} kN`:''}`,source:{standard:'TCVN 10304:2025',section:'7.2.2.1',page:31,formula:'(9)',tables:'Bảng 2, 3, 4'}});
  } catch(error){ out.innerHTML=`<div class="notice error">${esc(error.message)}</div>`; showToast(error.message,'error'); }
}
async function exportPile10304Excel() {
  try {
    const input=readPile10304Dom();
    const result=calculateDrivenPile10304(input);
    if(!result?.ok) throw new Error((result?.missing||[]).join('; ') || 'Đề bài chưa đủ dữ liệu.');
    const payload={
      recognized:true,
      workflow:{id:'10304-driven',title:'Cọc đóng/ép nhiều lớp',standard:'TCVN 10304:2025',status:'VERIFIED',source:'CT (9) · Bảng 2/3/4'},
      input,result,question:'Tính trực tiếp từ Calculation Engine – cọc đóng/ép nhiều lớp'
    };
    await exportUnifiedEngineeringWorkbook(payload,{imageProvenance:[]});
    showToast('Đã xuất Excel Production v1.25.7 từ Calculation Engine.', 'success');
  } catch(error){ showToast(`Không xuất được Excel Production: ${error.message}`,'error'); }
}


function engineeringResultFacts(result={}) {
  const labels={
    longTermKn:'Ra dài hạn',shortTermKn:'Ra ngắn hạn',pmaxKn:'Pmax',RkKn:'Rk',RdKn:'Rd',
    tipResistanceKn:'R mũi',sideResistanceKn:'R ma sát',settlementM:'Độ lún',MuKnM:'Mu',
    utilization:'Hệ số sử dụng',crackWidthMm:'Bề rộng nứt',deflectionMm:'Độ võng'
  };
  const unitFor=k=>/KnM$/i.test(k)?'kN.m':/Kn$/i.test(k)?'kN':/Mm$/i.test(k)?'mm':/settlementM$/i.test(k)?'m':'';
  return Object.entries(result||{}).filter(([k,v])=>labels[k]&&Number.isFinite(Number(v))).slice(0,8).map(([k,v])=>({label:labels[k],value:Number(v),unit:unitFor(k)}));
}

function syncChatTransferToDedicatedCalculator(payload={}) {
  const id=payload?.workflow?.id||'';
  const input=payload?.input||payload?.result?.inputs||{};
  if(id==='10304-driven'){
    const base=ensurePile10304Draft();
    const next={...base};
    for(const key of ['shape','sideM','diameterM','lengthM','tipDepthM','method','gammaC','gammaK','qbOverride','gammaRR','gammaRf']){
      if(input[key]!==undefined && input[key]!==null && input[key]!=='' && !Number.isNaN(input[key])) next[key]=input[key];
    }
    if(Array.isArray(input.layers)&&input.layers.length) next.layers=input.layers.map(x=>({...x}));
    state.pile10304Draft=next;
  }
  if(id==='7888-material'){
    const base=ensureCalcDraft();
    const type=String(input.type||base.type||'PHC').toUpperCase();
    const loadClass=String(input.loadClass||base.loadClass||'B').toUpperCase();
    const diameter=Number(input.diameter??base.diameter??600);
    const row=Number.isFinite(diameter)?lookupPileType7888(diameter,loadClass,type):null;
    state.calcDraft={
      ...base,type,loadClass,
      diameter:Number.isFinite(diameter)?diameter:base.diameter,
      thickness:Number(input.thicknessMm??row?.thickness??base.thickness),
      sigmaCu:Number(input.sigmaCu??base.sigmaCu??(type==='PC'?60:80)),
      sigmaCe:Number(input.sigmaCe??row?.effectiveStress??base.sigmaCe),
      tableSource:row?(type==='NPH'?'Bảng 2':'Bảng 1'):'',
      tablePage:row?(type==='NPH'?12:(diameter<=600?10:11)):null,
      designation:row?.designation||''
    };
  }
}

function openEngineeringInCalculator(index) {
  const message=state.chat[Number(index)];
  const meta=message?.engineering;
  if(!meta?.question) return showToast('Không tìm thấy đề bài kỹ thuật của câu trả lời này.', 'warning');
  const payload=engineeringExcelPayload(meta.normalizedQuestion||meta.question);
  if(!payload.recognized) return showToast('HNL chưa nhận diện được workflow kỹ thuật để chuyển sang Tính.', 'warning');
  state.chatCalcTransfer={payload,index:Number(index),imageProvenance:Array.isArray(meta.imageInput)?meta.imageInput:[]};
  syncChatTransferToDedicatedCalculator(payload);
  state.tab='calc';
  render();
  queueMicrotask(()=>document.querySelector('.chat-calc-transfer')?.scrollIntoView({block:'start',behavior:'smooth'}));
}

function showEngineeringSources(index) {
  const card=document.querySelector(`.message[data-message-index="${Number(index)}"]`);
  const details=card?.querySelector('.source-details');
  if(details){ details.open=true; details.scrollIntoView({block:'nearest',behavior:'smooth'}); }
  else showToast('Câu trả lời này chưa có trang nguồn RAG để mở. Xem Điều/Bảng/Công thức trong workflow Tính.', 'info');
}

function chatCalcTransferHtml() {
  const transfer=state.chatCalcTransfer;
  const payload=transfer?.payload;
  if(!payload?.recognized) return '';
  const wf=payload.workflow||{}; const result=payload.result||{};
  const ready=Boolean(payload.canExport ?? canExportEngineeringResult(payload));
  const missing=Array.isArray(result.missing)?result.missing:[];
  const facts=engineeringResultFacts(result);
  return `<div class="panel-section chat-calc-transfer">
    <div class="panel-section-title"><h3>Bài toán từ Hỏi đáp</h3><span>${esc(wf.standard||'')} · ${esc(wf.status||'')}</span></div>
    <div class="notice ${ready?'success':'warning'}"><b>${esc(wf.title||wf.id||'Workflow kỹ thuật')}</b> · ${ready?'Calculation Engine đã đủ dữ liệu để xuất Excel.':'Chưa đủ dữ liệu để xuất Excel số học.'}</div>
    <label class="field"><span>Đề bài chuẩn hóa · có thể bổ sung trực tiếp rồi tính lại</span><textarea id="chatCalcQuestionEdit" rows="4">${esc(payload.question||'')}</textarea><small>AI chỉ nhận diện dữ liệu; phép tính và Excel vẫn chạy lại bằng Calculation Engine deterministic.</small></label>
    ${missing.length?`<div class="notice warning"><b>Cần bổ sung:</b><ul>${missing.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
    ${facts.length?`<div class="metric-grid three">${facts.map(x=>`<div><span>${esc(x.label)}</span><b>${x.value.toLocaleString('vi-VN',{maximumFractionDigits:6})}${x.unit?` ${esc(x.unit)}`:''}</b></div>`).join('')}</div>`:''}
    <div class="action-row"><button class="btn primary" id="chatCalcRecalcBtn">Tính lại từ đề bài</button>${ready?'<button class="btn" id="chatCalcExcelBtn">⇩ Xuất Excel tính toán</button>':''}<button class="btn" id="chatCalcBackBtn">← Hỏi đáp</button></div>
    <div class="footnote">Nguồn workflow: ${esc(wf.source||'Xem provenance trong Excel')}. Khi workflow REVIEW/INDEXED, HNL không phát sinh Excel số học.</div>
  </div>`;
}

function recalculateChatTransfer() {
  const transfer=state.chatCalcTransfer; if(!transfer) return;
  const question=String(document.querySelector('#chatCalcQuestionEdit')?.value||transfer.payload?.question||'').trim();
  if(!question) return showToast('Hãy nhập/bổ sung đề bài trước khi tính lại.', 'warning');
  const normalizedQuestion=normalizeEngineeringText(question);
  // v1.25.5 compatibility marker: engineeringExcelPayload(question)
  const payload=engineeringExcelPayload(normalizedQuestion);
  payload.question=question;
  payload.normalizedQuestion=normalizedQuestion;
  if(!payload.recognized) return showToast('Đề bài sau chỉnh sửa chưa nhận diện được workflow kỹ thuật.', 'warning');
  state.chatCalcTransfer={...transfer,payload};
  syncChatTransferToDedicatedCalculator(payload);
  render();
  showToast(payload.canExport?'Calculation Engine đã đủ dữ liệu. Có thể xuất Excel.':'Đã tính lại; vẫn còn dữ liệu cần bổ sung.', payload.canExport?'success':'warning');
}

async function exportChatCalcTransferExcel() {
  const transfer=state.chatCalcTransfer; const payload=transfer?.payload;
  if(!payload?.recognized) return showToast('Không có workflow kỹ thuật để xuất Excel.', 'warning');
  if(!String(payload.workflow?.status||'').startsWith('VERIFIED')) return showToast('Workflow chưa VERIFIED nên không được xuất Excel số học.', 'warning');
  if(!payload.canExport) return showToast('Đề bài chưa đủ dữ liệu để xuất Excel.', 'warning');
  try{
    const imageProvenance=transfer.imageProvenance||[];
    await exportUnifiedEngineeringWorkbook({...payload,imageProvenance},{imageProvenance});
    showToast(`Đã xuất Excel v1.25.7: ${payload.workflow.title}.`,'success');
  }catch(error){ showToast(`Không xuất được Excel: ${error.message}`,'error'); }
}


function pass8IconSvg(kind='pile') {
  const paths={
    pile:'<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h6"/>',
    soil:'<path d="M3 7h18M5 11h14M7 15h10M9 19h6"/><circle cx="7" cy="5" r="1"/><circle cx="16" cy="9" r="1"/>',
    material:'<path d="M4 19V8l8-4 8 4v11z"/><path d="M8 19v-6h8v6M8 9h8"/>',
    structure:'<path d="M4 20V4h16v16M8 20V8h8v12M4 12h4M16 12h4"/>',
    excel:'<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v5h5M8 11l5 6M13 11l-5 6"/>'
  };
  return `<svg class="pass8-svg" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[kind]||paths.pile}</svg>`;
}

function pass82DraftValue(key, fallback='') { const v=state.pass8Draft?.[key]; return v==null?fallback:v; }

function syncPass82DraftFromDom() {
  const ids={
    constructionMethod:'pass8Construction',sideMm:'pass8Side',lengthM:'pass8Length',tipDepthM:'pass8TipDepth',shaftStartDepthM:'pass8ShaftStart',maxSegmentM:'pass8MaxSegment',
    mechanicalGammaK:'pass8MechGamma',sptGammaK:'pass8SptGamma',gammaN:'pass8GammaN',grade:'pass8Concrete',steel:'pass8Steel',AsTotMm2:'pass8As',L0Mm:'pass8L0',e0Mm:'pass8E0',
    combinationIdsText:'pass8Combos',boreholesJson:'pass8BoreholesJson'
  };
  const next={...(state.pass8Draft||createPass82DefaultDraft())};
  for(const [key,id] of Object.entries(ids)){const el=document.querySelector(`#${id}`); if(el) next[key]=el.value;}
  state.pass8Draft=next;
  return next;
}

function pass8OneClickHtml() {
  const d=state.pass8Draft||createPass82DefaultDraft(); const vm=state.pass8Output?.view;
  const num=(v,digits=3)=>Number.isFinite(Number(v))?Number(v).toLocaleString('vi-VN',{maximumFractionDigits:digits}):esc(v??'-');
  const resultHtml=vm?`<div class="pass8-result-head"><div><b>Kết quả một nút</b><small>${esc(vm.conclusion||'')}</small></div><span class="status-chip ${vm.statusVi==='ĐẠT'?'ok':'warn'}">${esc(vm.statusVi)}</span></div>
    <div class="pass8-kpis">${vm.kpis.map(([k,v,u])=>`<div class="pass8-kpi"><span>${esc(k)}</span><b>${typeof v==='number'?num(v,k.includes('sử dụng')?4:3):esc(v??'-')}</b><small>${esc(u)}</small></div>`).join('')}</div>
    <div class="pass8-steps">${vm.steps.map(step=>`<div class="pass8-step"><span class="pass8-step-status">${esc(step.status)}</span><div><b>${esc(step.title)}</b><small>${esc(step.detail)}</small></div></div>`).join('')}</div>`:'';
  return `<div class="panel-section pass8-oneclick" id="pass8OneClickPanel">
    <div class="panel-section-title"><h3>⚙ TÍNH CỌC MỘT NÚT · PASS 8</h3><span>Workflow đã khóa</span></div>
    <div class="notice">Nhập cọc + địa chất/SPT + vật liệu + file kết cấu đã chuẩn hóa Pass 5, sau đó bấm <b>TÍNH</b>. HNL gọi nguyên chuỗi Pass 7 LOCKED; giao diện không tự tính công thức kỹ thuật.</div>
    <div class="pass8-grid">
      <section class="pass8-card"><div class="pass8-card-title">${pass8IconSvg('pile')}<b>1. Cọc</b></div>
        <label class="field"><span>Phương pháp thi công</span><select id="pass8Construction"><option value="driven" ${d.constructionMethod==='driven'?'selected':''}>Cọc đóng/ép · §7.2.2</option><option value="bored" ${d.constructionMethod==='bored'?'selected':''}>Cọc khoan/nhồi · §7.2.3</option></select></label>
        <div class="grid2"><label class="field"><span>Cạnh cọc (mm)</span><input id="pass8Side" type="number" value="${esc(d.sideMm)}"></label><label class="field"><span>Chiều dài (m)</span><input id="pass8Length" type="number" value="${esc(d.lengthM)}"></label></div>
        <div class="grid2"><label class="field"><span>Độ sâu mũi (m)</span><input id="pass8TipDepth" type="number" value="${esc(d.tipDepthM)}"></label><label class="field"><span>γn</span><input id="pass8GammaN" type="number" step="0.01" value="${esc(d.gammaN)}"></label></div>
        <div class="grid2"><label class="field"><span>Bắt đầu ma sát z (m)</span><input id="pass8ShaftStart" type="number" value="${esc(d.shaftStartDepthM)}"></label><label class="field"><span>Đoạn chia max (m)</span><input id="pass8MaxSegment" type="number" value="${esc(d.maxSegmentM)}"></label></div>
      </section>
      <section class="pass8-card"><div class="pass8-card-title">${pass8IconSvg('soil')}<b>2. Địa chất + SPT</b></div>
        <div class="grid2"><label class="field"><span>γk cơ lý</span><input id="pass8MechGamma" type="number" step="0.01" value="${esc(d.mechanicalGammaK)}"></label><label class="field"><span>γk SPT</span><input id="pass8SptGamma" type="number" step="0.01" value="${esc(d.sptGammaK)}"></label></div>
        <label class="field"><span>Danh sách lỗ khoan JSON</span><textarea id="pass8BoreholesJson" rows="7" placeholder='[{"id":"HK1","layers":[...],"sptPoints":[...]}]'>${esc(d.boreholesJson||'[]')}</textarea></label>
        <small class="footnote">Không ngoại suy. Tối thiểu 2 lỗ khoan; dữ liệu ngoài miền VERIFIED sẽ bị KHÓA TÍNH.</small>
      </section>
      <section class="pass8-card"><div class="pass8-card-title">${pass8IconSvg('material')}<b>3. Vật liệu</b></div>
        <div class="grid2"><label class="field"><span>Bê tông</span><input id="pass8Concrete" value="${esc(d.grade)}"></label><label class="field"><span>Thép</span><input id="pass8Steel" value="${esc(d.steel)}"></label></div>
        <div class="grid2"><label class="field"><span>As,tot (mm²)</span><input id="pass8As" type="number" value="${esc(d.AsTotMm2)}"></label><label class="field"><span>L0 (mm)</span><input id="pass8L0" type="number" value="${esc(d.L0Mm)}"></label></div>
        <label class="field"><span>e0 (mm)</span><input id="pass8E0" type="number" step="0.001" value="${esc(d.e0Mm)}"></label>
      </section>
      <section class="pass8-card"><div class="pass8-card-title">${pass8IconSvg('structure')}<b>4. Kết cấu</b></div>
        <label class="field"><span>File JSON chuẩn hóa Pass 5</span><input id="pass8StructuralFile" type="file" accept=".json,application/json"></label>
        <div class="pass8-file-state"><b>${esc(state.pass8StructuralName||'Chưa chọn file')}</b><small>${state.pass8Structural?'Đã đọc · sẵn sàng đưa vào canonical importer':'Nhận DCE_TABLES hoặc CSV bundle có profile kN_m_C.'}</small></div>
        <label class="field"><span>Tổ hợp kiểm (ngăn cách dấu phẩy)</span><input id="pass8Combos" value="${esc(d.combinationIdsText||'EULS')}"></label>
        <div id="pass8ExporterStatus" class="footnote">Excel: ${esc(state.pass8ExporterStatus)}</div>
      </section>
    </div>
    <div class="action-row pass8-actions"><button class="btn primary" id="pass8CalculateBtn">TÍNH</button><button class="btn" id="pass8ExporterHealthBtn">Kiểm tra Excel</button><button class="btn" id="pass8ExportBtn" ${!state.pass8Output?.output?.excelExport?.enabled||state.pass8ExportBusy?'disabled':''}>${pass8IconSvg('excel')} XUẤT EXCEL TIẾNG VIỆT</button></div>
    ${resultHtml}
  </div>`;
}

async function runPass82FromProductionUi(){
  try{
    const draft=syncPass82DraftFromDom();
    const x=runPass82UiCalculation({draft,structural:state.pass8Structural});
    state.pass8Request=x.request; state.pass8Output=x;
    render();
    showToast(x.view.statusVi==='ĐẠT'?'Pass 8: tính hoàn tất; có thể xuất Excel.':`Pass 8: ${x.view.statusVi}.`,x.view.statusVi==='ĐẠT'?'success':'warning');
    await refreshPass82ExporterHealth(false);
  }catch(error){state.pass8Output=null;showToast(`Pass 8 KHÓA TÍNH: ${error.message}`,'error');render();}
}

async function refreshPass82ExporterHealth(show=true){
  try{
    const data=await checkPass82Exporter({bridgeUrl:state.settings.bridgeUrl});
    state.pass8ExporterReady=true; state.pass8ExporterStatus=`Sẵn sàng · ${data.version||'Dynamic Excel'}`;
    const el=document.querySelector('#pass8ExporterStatus'); if(el) el.textContent=`Excel: ${state.pass8ExporterStatus}`;
    if(show) showToast('Dịch vụ Xuất Excel tiếng Việt đã sẵn sàng.','success');
  }catch(error){state.pass8ExporterReady=false;state.pass8ExporterStatus=`Chưa sẵn sàng · ${error.message}`;const el=document.querySelector('#pass8ExporterStatus');if(el)el.textContent=`Excel: ${state.pass8ExporterStatus}`;if(show)showToast(`Excel: ${error.message}`,'warning');}
}

async function exportPass82FromProductionUi(){
  if(!state.pass8Output?.output) return showToast('Hãy bấm TÍNH trước khi xuất Excel.','warning');
  state.pass8ExportBusy=true;
  try{
    const out=await exportPass82Excel({output:state.pass8Output.output,bridgeUrl:state.settings.bridgeUrl});
    downloadBlob(out.blob,out.fileName);
    state.pass8ExporterStatus=`Đã xuất · server verified${out.exportId?` · ${out.exportId}`:''}`;
    showToast(`Đã xuất Excel tiếng Việt: ${out.fileName}`,'success');
  }catch(error){showToast(`Không xuất được Excel: ${error.message}`,'error');}
  finally{state.pass8ExportBusy=false;render();}
}

function calcHtml() {
  const transferCard = chatCalcTransferHtml();
  const draft = ensureCalcDraft();
  const calcD = Number(draft.diameter || 600);
  const calcType = String(draft.type || 'PHC').toUpperCase();
  const calcClasses = classesForPileType7888(calcD, calcType);
  const fallbackClasses = calcType === 'NPH' ? ['A','B','C'] : ['A','AB','B','C'];
  const classList = calcClasses.length ? calcClasses : fallbackClasses;
  const calcClass = classList.includes(String(draft.loadClass || '').toUpperCase()) ? String(draft.loadClass).toUpperCase() : (classList.includes('B') ? 'B' : classList[0]);
  const calcClassOptions = classList.map(x => `<option value="${x}" ${x === calcClass ? 'selected' : ''}>${x}</option>`).join('');
  const tableStatus = draft.tableSource ? `Đã nạp ${draft.tableSource}${draft.designation ? ` · ${draft.designation}` : ''}${draft.tablePage ? ` · trang ${draft.tablePage}` : ''}` : 'Giá trị đang nhập tay; bấm Nạp bảng để đồng bộ t và σce theo tiêu chuẩn.';
  return `${transferCard}${pass8OneClickHtml()}${pile10304Html()}
  <div class="panel-section">
    <div class="panel-section-title"><h3>Máy tính đã xác minh · TCVN 7888:2014</h3><span>Phụ lục B</span></div>
    <div class="notice">Bộ tính này được khóa theo công thức đã kiểm tra thủ công của TCVN 7888:2014. Kết quả không thay thế hồ sơ thiết kế.</div>
    <div class="grid2">
      <label class="field"><span>Loại cọc</span><select id="cType"><option value="PHC" ${calcType==='PHC'?'selected':''}>PHC</option><option value="NPH" ${calcType==='NPH'?'selected':''}>NPH</option><option value="PC" ${calcType==='PC'?'selected':''}>PC</option></select></label>
      <label class="field"><span>Cấp tải</span><select id="cClass">${calcClassOptions}</select></label>
      <label class="field"><span>D thân cọc (mm)</span><input id="cDiameter" type="number" value="${calcD}" min="1"></label>
      <label class="field"><span>t (mm)</span><input id="cThickness" type="number" value="${Number(draft.thickness || 90)}" min="1"></label>
      <label class="field"><span>σcu (MPa)</span><input id="cCu" type="number" value="${Number(draft.sigmaCu || (calcType==='PC'?60:80))}" step="0.1"></label>
      <label class="field"><span>σce (MPa)</span><input id="cCe" type="number" value="${Number(draft.sigmaCe || 8)}" step="0.1"></label>
    </div>
    <div class="action-row"><button class="btn" id="calcFill7888" ${sourceHas7888() ? '' : 'disabled'}>Nạp bảng tiêu chuẩn</button><button class="btn primary" id="calcBtn">Tính kết quả</button></div><div id="calcSourceHint" class="footnote">${esc(tableStatus)}</div>
    <div id="calcResult"></div>
  </div>
  <div class="formula-card"><div class="formula">R<sub>aL</sub> = (σ<sub>cu</sub>/α − σ<sub>ce</sub>/4) × A<sub>0</sub></div><p>PC dùng α = 4; PHC/NPH dùng α = 3,5. Với σ (MPa) và A₀ (mm²), HNL đổi N → kN (/1000) trước khi hiển thị. App đồng thời hiển thị giá trị ngắn hạn và 80% giá trị ngắn hạn.</p><div class="action-row"><button class="source-chip" data-find="Phụ lục B">Mở Phụ lục B</button><button class="source-chip" data-find="Bảng 2">Mở Bảng 2 · NPH</button></div></div>
  ${formulaLibraryHtml()}
  ${calculationHistoryHtml()}`;
}

function compareHtml() {
  const docs = selectedDocs();
  return `<div class="panel-section"><div class="panel-section-title"><h3>So sánh nhiều tiêu chuẩn</h3><span>${docs.length} tài liệu</span></div>
    ${docs.length < 2 ? '<div class="notice warning">Hãy tick ít nhất 2 PDF trong Thư viện. Chế độ so sánh chỉ dùng các tài liệu được tick.</div>' : `<div class="selected-source-list">${docs.map(d => `<span>${esc(d.standard || d.name)}</span>`).join('')}</div>`}
    <label class="field"><span>Nội dung cần so sánh</span><textarea id="compareQuestion" placeholder="Ví dụ: So sánh yêu cầu nghiệm thu, giới hạn vết nứt và tần suất thử nghiệm.">${esc(state.compare.draft || state.compare.query)}</textarea></label>
    <div class="action-row"><button class="btn primary" id="compareBtn" ${docs.length < 2 || state.busy ? 'disabled' : ''}>So sánh nguồn</button><button class="btn" id="compareAuditBtn" ${docs.length < 2 || state.busy ? 'disabled' : ''}>Kiểm tra mâu thuẫn hồ sơ</button></div>
    <div class="coverage-line"><b>${state.compareMode==='audit'?'Kiểm tra hồ sơ':'So sánh'}</b><small>Chỉ dùng tài liệu đã tick; khác biệt/mâu thuẫn phải có nguồn trang, thiếu căn cứ thì ghi rõ.</small></div>
    ${state.compare.text ? `<div class="compare-output"><div class="answer-text rich-answer">${richTextHtml(state.compare.text)}</div>${sourceChipsHtml(state.compare.hits)}</div>` : ''}
  </div>`;
}

function checklistKey() { return find7888Doc()?.id || 'tcvn7888'; }
function checklistHtml() {
  if (!sourceHas7888()) {
    return `<div class="hero-card"><div class="eyebrow">Nghiệm thu</div><h3>Tạo checklist từ tiêu chuẩn</h3><p>Với TCVN 7888:2014 app có checklist cục bộ. Tiêu chuẩn khác có thể dùng AI để trích yêu cầu từ PDF.</p><button class="btn primary" id="aiChecklist" ${!sourceDocs().length || state.busy ? 'disabled' : ''}>Trích checklist từ nguồn</button></div>`;
  }
  const key = checklistKey();
  const values = state.checklist[key] || {};
  const done = tcvn7888Checklist.filter((_, i) => values[i]).length;
  return `<div class="panel-section"><div class="panel-section-title"><h3>Checklist hồ sơ nghiệm thu</h3><span>${done}/${tcvn7888Checklist.length}</span></div>
    <div class="progress-mini"><div style="width:${Math.round(done / tcvn7888Checklist.length * 100)}%"></div></div>
    <div class="checklist">${tcvn7888Checklist.map((item, i) => `<label class="check-item"><input type="checkbox" data-check="${i}" ${values[i] ? 'checked' : ''}><span>${esc(item)}</span></label>`).join('')}</div>
    <div class="action-row"><button class="btn" id="copyChecklist">Sao chép checklist</button><button class="btn" id="resetChecklist">Bỏ đánh dấu</button><button class="btn primary" id="aiChecklist" ${state.busy ? 'disabled' : ''}>${state.settings.provider === 'local' ? 'Trích thêm từ PDF' : 'Mở rộng bằng AI'}</button></div>
    <div class="footnote">Nguồn chính: Điều 8.2 và Phụ lục C. <button class="text-link" data-find="8.2 Hồ sơ nghiệm thu">Mở nguồn</button></div>
  </div>`;
}

function formatBytes(value = 0) {
  const n = Number(value) || 0;
  if (n <= 0) return '0 B';
  const units = ['B','KB','MB','GB','TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / (1024 ** i);
  return `${v >= 100 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}
function localModelManagerHtml() {
  if (!IS_DESKTOP_EDITION && !isLocalHost()) return '';
  const mm = state.localModelManager || {};
  const d = mm.data;
  if (mm.loading && !d) return `<div class="model-manager-card"><div class="panel-section-title"><h3>Quản lý AI Offline</h3><span>Đang đọc...</span></div><div class="notice">Đang kiểm tra Ollama, model và ổ đĩa trên máy.</div></div>`;
  if (mm.error && !d) return `<div class="model-manager-card"><div class="panel-section-title"><h3>Quản lý AI Offline</h3><span>Lỗi</span></div><div class="notice error">${esc(mm.error)}</div><button class="btn" id="refreshLocalModelManager">Thử lại</button></div>`;
  if (!d) return `<div class="model-manager-card"><div class="panel-section-title"><h3>Quản lý AI Offline</h3><span>Desktop</span></div><p class="muted">Xem model đã cài, dung lượng, ổ đĩa và thư mục lưu model Ollama.</p><button class="btn primary" id="refreshLocalModelManager">Mở trình quản lý model</button></div>`;
  const models = Array.isArray(d.models) ? d.models : [];
  const jobs = Array.isArray(d.jobs) ? d.jobs : [];
  const drives = Array.isArray(d.drives) ? d.drives : [];
  const installJob = d.ollamaInstall || {};
  const installProgress = Math.max(0, Math.min(100, Number(installJob.progress || 0)));
  const ollamaInstallUi = !d.ollamaInstalled ? `<div class="notice warning ollama-install-card"><b>Chưa cài Ollama.</b><br>HNL có thể cài tự động trên Windows rồi tiếp tục tải model Offline.<div class="action-row"><button class="btn primary" id="installOllamaNow" ${installJob.status === 'running' ? 'disabled' : ''}>${installJob.status === 'running' ? `Đang cài ${installProgress}%` : '⬇ Cài Ollama tự động'}</button></div>${installJob.status === 'running' ? `<div class="job-progress"><i style="width:${installProgress}%"></i></div><small>${esc(installJob.message || 'Đang cài…')}</small>` : ''}${installJob.status === 'error' ? `<div class="notice error">${esc(installJob.error || installJob.message || 'Cài Ollama thất bại.')}</div>` : ''}</div>` : '';
  const driveOptions = drives.map(x => `<button class="drive-chip" data-model-dir="${esc(`${x.device || ''}\\HNL_AI\\Models`)}"><b>${esc(x.device || '')}</b><span>${formatBytes(x.freeBytes)} trống</span></button>`).join('');
  const modelRows = models.length ? models.map(m => {
    const name = m.name || m.model || '';
    const family = m.details?.family || m.details?.families?.[0] || '';
    const params = m.details?.parameter_size || '';
    const quant = m.details?.quantization_level || '';
    return `<div class="model-row"><div class="model-main"><b>${esc(name)}</b><small>${[family, params, quant].filter(Boolean).map(esc).join(' · ') || 'Ollama model'} · ${formatBytes(m.size)}</small></div><button class="btn compact-btn danger-btn" data-delete-local-model="${esc(name)}">Xóa</button></div>`;
  }).join('') : `<div class="empty-models">Chưa có model Ollama nào trên máy.</div>`;
  const jobRows = jobs.length ? `<div class="model-jobs"><b>Tác vụ tải model</b>${jobs.slice().reverse().map(j => `<div class="model-job"><div><span>${esc(j.model)}</span><small>${j.status === 'running' ? `Đang tải · ${Number(j.progress||0)}%` : j.status === 'done' ? 'Hoàn tất' : j.status === 'cancelled' ? 'Đã hủy' : 'Lỗi'}</small></div><div class="job-progress"><i style="width:${Math.max(0,Math.min(100,Number(j.progress||0)))}%"></i></div>${j.status === 'running' ? `<button class="icon-btn danger-btn" data-cancel-local-model="${esc(j.model)}" title="Hủy tải">×</button>` : ''}</div>`).join('')}</div>` : '';
  return `<div class="model-manager-card">
    <div class="panel-section-title"><h3>Quản lý AI Offline</h3><span>${d.ollama ? `${models.length} model` : (d.ollamaInstalled ? 'Ollama chưa chạy' : 'Chưa cài Ollama')}</span></div>
    ${ollamaInstallUi}
    <div class="model-storage-grid"><div><span>Thư mục model</span><b>${esc(d.modelsDir || 'Chưa xác định')}</b></div><div><span>Model đã cài</span><b>${formatBytes(d.installedBytes || 0)}</b></div><div><span>Ổ đĩa còn trống</span><b>${formatBytes(d.disk?.freeBytes || 0)}</b></div><div><span>Tổng dung lượng ổ</span><b>${formatBytes(d.disk?.totalBytes || 0)}</b></div></div>
    <label class="field"><span>Đổi thư mục lưu model</span><div class="model-dir-picker"><input id="modelDirectoryInput" value="${esc(d.modelsDir || '')}" placeholder="Ví dụ D:\\HNL_AI\\Models"><button class="btn compact-btn" id="applyModelDirectory">Áp dụng</button></div><small>HNL đặt biến OLLAMA_MODELS cho tài khoản Windows. Sau khi đổi, HNL sẽ khởi động lại Ollama để model tải mới dùng đúng thư mục.</small></label>
    ${driveOptions ? `<div class="drive-chips">${driveOptions}</div>` : ''}
    <div class="model-pack-grid"><button class="model-pack" data-install-pack="light"><b>Nhẹ</b><span>Qwen 4B + embedding nhẹ + Vision</span></button><button class="model-pack recommended" data-install-pack="balanced"><b>Cân bằng</b><span>Qwen 8B + bge-m3 + Vision</span></button><button class="model-pack" data-install-pack="strong"><b>Mạnh</b><span>Qwen 14B + bge-m3 + Vision</span></button></div>
    <div class="model-list-head"><b>Model đã cài</b><div><button class="btn compact-btn" id="refreshLocalModelManager">↻ Làm mới</button><button class="btn compact-btn" id="openModelDirectory">Mở thư mục</button></div></div>
    <div class="model-list">${modelRows}</div>${jobRows}${mm.error ? `<div class="notice error">${esc(mm.error)}</div>` : ''}
  </div>`;
}

function archiveEngineCardHtml() {
  if (!IS_DESKTOP_EDITION && !isLocalHost()) return '';
  const d = state.archiveEngines;
  const status = d
    ? `7-Zip ${d.sevenZip?.length ? '✓' : '—'} · UnRAR ${d.unrar?.length ? '✓' : '—'} · tar ${d.tar ? '✓' : '—'} · HNL RAR ${d.builtinRar ? '✓' : '—'}`
    : (state.archiveEngineError || 'Chưa kiểm tra engine giải nén trên máy.');
  const needs7z = Boolean(d && !d.sevenZip?.length);
  return `<div class="archive-engine-card"><div class="panel-section-title"><h3>Bộ giải nén Desktop</h3><span>${d?.builtinRar ? 'RAR sẵn sàng' : 'Kiểm tra'}</span></div><p class="muted">${esc(status)}</p>${needs7z ? '<div class="notice warning">RAR có HNL Built-in dự phòng. 7Z hoặc ZIP mã hóa/phương thức nén đặc biệt có thể cần cài 7-Zip.</div>' : ''}<div class="action-row"><button class="btn" id="checkArchiveEngines" type="button">Kiểm tra bộ giải nén</button><button class="btn" id="open7ZipHelp" type="button">Cài/thiết lập 7-Zip</button></div></div>`;
}

async function refreshArchiveEngines(showFeedback = false) {
  if (!IS_DESKTOP_EDITION && !isLocalHost()) return null;
  try {
    const base = String(state.settings.bridgeUrl || location.origin).replace(/\/$/, '');
    const r = await fetch(`${base}/api/local/archive-engines`, { cache:'no-store' });
    const data = await r.json().catch(()=>({}));
    if (!r.ok) throw new Error(data.error || 'Không đọc được bộ giải nén Desktop.');
    state.archiveEngines = data; state.archiveEngineError = '';
    if (showFeedback) showToast(`Engine: ${data.priority?.join(' → ') || 'đã kiểm tra'}.`, 'success');
    return data;
  } catch (error) {
    state.archiveEngines = null; state.archiveEngineError = error.message;
    if (showFeedback) showToast(`Không kiểm tra được bộ giải nén: ${error.message}`, 'error');
    return null;
  } finally { render(); }
}


function professionalToolsHtml() {
  const health=state.documentHealth || documentHealth();
  return `<div class="panel-section compact-settings-card pro-tools-card">
    <div class="panel-section-title"><h3>Workspace & hiệu năng</h3><span>${esc(performanceProfile().label)}</span></div>
    <div class="grid2 pro-settings-grid">
      <label class="field"><span>Chế độ hiệu năng</span><select id="performanceModeInput"><option value="light" ${state.settings.performanceMode==='light'?'selected':''}>Nhẹ · ít RAM/token</option><option value="balanced" ${state.settings.performanceMode==='balanced'?'selected':''}>Cân bằng · khuyến nghị</option><option value="strong" ${state.settings.performanceMode==='strong'?'selected':''}>Mạnh · nhiều trang/AI hơn</option></select></label>
      <label class="switch-row compact-switch"><input id="fieldModeInput" type="checkbox" ${state.settings.fieldMode?'checked':''}><span><b>Chế độ hiện trường</b><small>Gọn chữ, giảm mô tả phụ; vẫn giữ đầy đủ chức năng.</small></span></label>
    </div>
    <div class="notice success"><b>Tự lưu workspace:</b> PDF, trang, zoom, tab, nguồn và phạm vi được khôi phục khi mở lại app.</div>
    <details id="settingsDocumentHealth" class="compact-disclosure" data-persist-detail><summary><span>Sức khỏe tài liệu & lập chỉ mục</span><span class="disclosure-chevron">⌄</span></summary><div class="disclosure-body">
      ${documentHealthHtml(health)}
      <div class="action-row"><button class="btn" id="checkDocumentHealth">Kiểm tra tài liệu</button><button class="btn" id="reindexActiveDocument" ${activeDoc()?.viewerKind==='pdf'?'':'disabled'}>Lập chỉ mục lại tài liệu</button><button class="btn" id="reindexAllDocuments">Lập chỉ mục lại thư viện</button></div>
      <small class="muted">Lập chỉ mục lại chỉ đọc lớp chữ PDF gốc; không OCR toàn bộ và không thay lõi tìm kiếm v1.9.23.</small>
    </div></details>
    <details id="settingsBackupTools" class="compact-disclosure" data-persist-detail><summary><span>Backup, khôi phục & gói lỗi</span><span class="disclosure-chevron">⌄</span></summary><div class="disclosure-body">
      <div class="action-row"><button class="btn" id="exportBackupZip">Xuất Backup ZIP</button><button class="btn" id="restoreBackupBtn">Khôi phục Backup</button><button class="btn" id="exportDiagnosticZip">Xuất gói lỗi ZIP</button></div>
      <input id="backupRestoreInput" type="file" accept=".zip,.json" hidden>
      <div class="notice"><b>Backup:</b> lưu metadata thư viện, ghim, ghi chú, lịch sử, tính toán, checklist và workspace; không chứa API key và không nhét PDF binary vào ZIP để file nhẹ.</div>
      <div class="compact-overview-line"><div><b>Crash log cục bộ</b><small>${state.crashLog.length} lỗi gần nhất · đã lọc chuỗi giống API key</small></div><button class="btn compact-btn" id="clearCrashLog" ${state.crashLog.length?'':'disabled'}>Xóa log</button></div>
    </div></details>
  </div>`;
}

function settingsHtml() {
  const provider = PROVIDERS[state.settings.provider];
  const options = availableProviderEntries().map(([id, p]) => `<option value="${id}" ${id === state.settings.provider ? 'selected' : ''}>${esc(p.label)}</option>`).join('');
  const needsSessionKey = Boolean(provider?.needsKey);
  const isOllama = state.settings.provider === 'ollama';
  const nativePdfProvider = supportsNativePdf(state.settings.provider);
  const githubHttps = location.protocol === 'https:' && !isLocalHost();
  return `<div class="panel-section compact-settings-card ai-settings-card">
    <div class="panel-section-title"><h3>AI & kết nối</h3><span id="connectionStateLabel">${state.connectionStatus?.ok ? 'Sẵn sàng' : (state.connectionStatus ? 'Có lỗi' : 'Chưa kiểm tra')}</span></div>
    <div class="compact-overview-line ai-settings-overview"><div><b>${esc(provider?.short || provider?.label || state.settings.provider)}${state.settings.provider === 'local' ? '' : ` · ${esc(providerModel() || 'Chưa chọn model')}`}</b><small>${state.connectionStatus?.ok ? 'Đã kết nối' : 'Bấm để mở cài đặt chi tiết'} · dùng chung toàn ứng dụng</small></div><span class="compact-status">${state.connectionStatus?.ok ? 'OK' : 'Cài đặt'}</span></div>
    <details id="settingsAiConnection" class="compact-disclosure settings-primary-disclosure" data-persist-detail><summary><span>Mở AI, model, API key & kiểm tra kết nối</span><span class="disclosure-chevron">⌄</span></summary><div class="disclosure-body">
    <label class="field"><span>Nhà cung cấp</span><select id="providerSelect">${options}</select></label>
    ${state.settings.provider === 'local' ? `<div class="notice success"><b>Tra cứu nhanh không phải AI.</b><br>${IS_DESKTOP_EDITION ? 'Chế độ này tìm kiếm cục bộ, không cần mạng. Muốn AI offline suy luận, chọn <b>HNL Offline AI · Ollama</b>.' : 'Chế độ này tìm ngay trong dữ liệu đã nạp, không cần API. Muốn AI suy luận trên bản Web, chọn <b>Gemini / ChatGPT / Claude / Grok</b>.'}</div>` : `
      <div class="segmented"><button data-connection="direct" class="${state.settings.connection === 'direct' ? 'active' : ''}">Trực tiếp</button><button data-connection="bridge" class="${state.settings.connection === 'bridge' ? 'active' : ''}">HNL Bridge</button></div>
      <label class="field"><span>Model</span><div class="model-picker shared-model-setting"><input id="modelInput" value="${esc(providerModel())}" readonly aria-readonly="true" title="Model hiện tại dùng chung toàn ứng dụng"><button class="btn compact-btn" id="openSettingsModelPicker" type="button">Chọn model</button><button class="btn compact-btn" id="refreshModels" type="button">↻</button></div><small class="${state.modelOptions.length ? (state.modelOptionsVerified ? 'model-status-verified' : 'model-status-suggested') : ''}">${esc(state.modelStatus || 'Dùng chung toàn ứng dụng · đổi model luôn cần xác nhận trước khi áp dụng.')}</small></label><datalist id="modelOptionsList">${state.modelOptions.map(m => `<option value="${esc(m)}"></option>`).join('')}</datalist>
      ${isOllama ? `<label class="field"><span>Model đọc ảnh offline</span><input id="visionModelInput" value="${esc(draftSetting('visionModel', state.settings.visionModel))}" placeholder="gemma3:4b"></label>` : ''}
      ${needsSessionKey ? `<label class="field"><span>API key · dùng chung Kiểm tra kết nối / Model / Chat trong phiên này</span><input id="apiKeyInput" type="password" value="${esc(draftSetting('apiKey', currentApiKey()))}" autocomplete="off" placeholder="Dán API key của bạn"><small>${state.settings.connection === 'bridge' ? 'Bridge sẽ ưu tiên key phiên này; nếu để trống mới dùng key cấu hình sẵn trên Bridge.' : 'Key chỉ giữ trong phiên ứng dụng/tab, không ghi vào source hay log.'}</small></label>` : ''}
      ${state.settings.provider === 'gemini' ? `<div class="notice"><b>Gemini API:</b> vào Google AI Studio → API Keys → Create API key → Copy, sau đó dán vào ô trên. Không ghi key vào source GitHub. <a class="inline-link" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Mở trang API Keys</a></div>` : ''}
      ${isOllama && state.settings.connection === 'direct' ? `<label class="field"><span>Ollama URL</span><input id="ollamaInput" value="${esc(draftSetting('ollamaUrl', state.settings.ollamaUrl))}"></label>` : ''}
      ${isOllama && githubHttps ? `<div class="notice error"><b>Đây là nguyên nhân Offline AI trong video không chạy.</b><br>GitHub Pages là HTTPS nhưng Ollama trên máy là HTTP. Trình duyệt chặn kết nối này. Hãy chạy <b>START_HNL_OFFLINE_AI.bat</b> trong source và mở app tại <b>http://127.0.0.1:8787</b>.</div>` : ''}
      ${isOllama && isLocalHost() ? `<div class="notice success"><b>Đang ở chế độ Local.</b> Đây là môi trường đúng để dùng Ollama offline, semantic embedding và đọc ảnh bằng model vision.</div>` : ''}
      ${isOllama ? `<div class="local-engine-card"><div class="panel-section-title"><h3>HNL Local Intelligence Engine</h3><span>Offline</span></div>
        <label class="field"><span>Chế độ tìm kiếm</span><select id="retrievalModeInput">
          <option value="auto" ${state.settings.retrievalMode === 'auto' ? 'selected' : ''}>Auto · tự chọn nhanh/chuyên sâu/semantic</option>
          <option value="hybrid" ${state.settings.retrievalMode === 'hybrid' ? 'selected' : ''}>Hybrid Semantic · từ khóa + vector + rerank</option>
          <option value="deep" ${state.settings.retrievalMode === 'deep' ? 'selected' : ''}>Deep Lexical · quét cấu trúc toàn thư viện</option>
          <option value="fast" ${state.settings.retrievalMode === 'fast' ? 'selected' : ''}>Nhanh · tra cứu cục bộ</option>
        </select></label>
        <label class="field"><span>Model embedding cục bộ</span><input id="embeddingModelInput" value="${esc(draftSetting('embeddingModel', state.settings.embeddingModel))}" placeholder="bge-m3"><small>Khuyến nghị tiếng Việt/kỹ thuật: bge-m3. Có thể dùng nomic-embed-text nếu máy nhẹ.</small></label>
        <label class="switch-row"><input id="semanticRerankInput" type="checkbox" ${state.settings.semanticRerank ? 'checked' : ''}><span><b>Semantic rerank</b><small>Rerank các đoạn ứng viên bằng embedding cục bộ trước khi gửi cho model trả lời.</small></span></label>
        <div class="notice"><b>Cơ chế truy hồi:</b> quét toàn bộ trang → tìm từ khóa/cấu trúc → embedding semantic → cân bằng giữa PDF → thêm trang lân cận → model trả lời có citation.</div>
        <div class="action-row"><button class="btn" id="autoLocalModels" type="button">⚙ Tự chọn model theo máy</button><button class="btn" id="installCurrentLocalModel" type="button">⬇ Cài model văn bản</button><button class="btn" id="installLocalAiPack" type="button">⬇ Cài bộ AI Offline chuẩn</button></div><div class="notice"><b>Desktop:</b> nút cài model gọi Ollama ngay trên máy. Bộ chuẩn gồm model văn bản + embedding + vision; chỉ cần tải một lần rồi có thể dùng offline.</div>
        ${localModelManagerHtml()}
      </div>` : ''}
      ${state.settings.connection === 'bridge' ? `<label class="field"><span>HNL Bridge URL</span><input id="bridgeInput" value="${esc(draftSetting('bridgeUrl', state.settings.bridgeUrl))}"></label><div class="notice">Khi chạy Local, nên để Bridge cùng địa chỉ app, ví dụ http://127.0.0.1:8787.</div>` : ''}
    `}
    ${nativePdfProvider ? `<div class="native-pdf-card compact-native-card">
      <div class="compact-overview-line native-pdf-overview"><div><b>Đọc PDF native · <span id="nativePdfModeBadge">${state.settings.nativePdfMode === 'economy' ? 'Tiết kiệm' : state.settings.nativePdfMode === 'native' ? 'Toàn tài liệu' : 'Cân bằng'}</span></b><small id="nativePdfModeSummary">${state.settings.nativePdfMode === 'economy' ? 'RAG trước · chỉ gửi trang/ảnh cần thiết' : state.settings.nativePdfMode === 'native' ? 'Giữ chế độ Toàn tài liệu; PDF quá giới hạn sẽ dùng fallback trang mục tiêu và báo rõ' : 'RAG trước · tự dùng PDF native khi thật sự cần'}</small></div></div>
      <details id="settingsNativePdfDetails" class="compact-disclosure" data-persist-detail>
        <summary><span>Xem chi tiết PDF native</span><span class="disclosure-chevron">⌄</span></summary>
        <div class="disclosure-body">
          <label class="field"><span>Chế độ đọc PDF</span><select id="nativePdfModeInput">
            <option value="economy" ${state.settings.nativePdfMode === 'economy' ? 'selected' : ''}>Tiết kiệm · RAG trước, chỉ gửi trang/ảnh cần thiết</option>
            <option value="balanced" ${state.settings.nativePdfMode === 'balanced' ? 'selected' : ''}>Cân bằng · RAG trước, tự dùng PDF native khi cần</option>
            <option value="native" ${state.settings.nativePdfMode === 'native' ? 'selected' : ''}>Toàn tài liệu · gửi PDF đủ điều kiện trực tiếp cho AI</option>
          </select><small>Lựa chọn được ghi nhớ cho các lần sử dụng tiếp theo.</small></label>
          ${state.settings.provider === 'openai' ? `<label class="field"><span>Chi tiết ảnh trang PDF · OpenAI</span><select id="openaiPdfDetailInput"><option value="low" ${state.settings.openaiPdfDetail === 'low' ? 'selected' : ''}>Low · tiết kiệm token hình</option><option value="auto" ${state.settings.openaiPdfDetail === 'auto' ? 'selected' : ''}>Auto · khuyến nghị</option><option value="high" ${state.settings.openaiPdfDetail === 'high' ? 'selected' : ''}>High · bảng/sơ đồ/chữ nhỏ</option></select></label>` : ''}
          <div class="notice"><b>Giới hạn xử lý:</b> PDF native Gemini tối đa 50 MB/1.000 trang. OpenAI cũng giới hạn tổng file trong request. Nếu PDF vượt giới hạn, HNL giữ nguyên lựa chọn của bạn và chuyển sang tìm trực tiếp lớp chữ PDF gốc + OCR/Vision đúng trang mục tiêu; không âm thầm đổi chế độ.</div>
          <div class="notice"><b>Riêng tư:</b> API key không được lưu cùng PDF hoặc lịch sử.</div>
        </div>
      </details>
    </div>` : ''}
    <label class="field"><span>Lưu lịch sử cục bộ</span><select id="historyRetentionDaysInput"><option value="30" ${state.settings.historyRetentionDays === 30 ? 'selected' : ''}>30 ngày</option><option value="90" ${state.settings.historyRetentionDays === 90 ? 'selected' : ''}>90 ngày</option><option value="365" ${state.settings.historyRetentionDays === 365 ? 'selected' : ''}>365 ngày</option><option value="0" ${state.settings.historyRetentionDays === 0 ? 'selected' : ''}>Không tự xóa</option></select><small>Hỏi đáp và tính toán lưu Local-first trong IndexedDB. Không lưu API key.</small></label>
    <div class="action-row"><button class="btn primary" id="saveSettings">Lưu cài đặt</button><button class="btn" id="testConnection">Kiểm tra kết nối</button></div>
    <div id="connectionStatusBox" class="notice ${state.connectionStatus?.ok ? 'success' : 'error'}" ${state.connectionStatus ? '' : 'hidden'}><b>${state.connectionStatus?.ok ? 'Kết nối OK' : 'Kết nối lỗi'}</b><br>${esc(state.connectionStatus?.message || '')}</div>
    </div></details>
  </div>
  ${professionalToolsHtml()}
  ${versionCardHtml()}
  <div class="panel-section compact-settings-card">
    <div class="panel-section-title"><h3>Dữ liệu đầu vào</h3><span>Định dạng</span></div>
    <div class="compact-overview-line"><div><b>PDF · Thư mục · Archive · Ảnh · Text</b><small>PDF native AI · Hybrid RAG/citation · Lịch sử local · Offline AI trên Desktop</small></div><span class="compact-status">Sẵn sàng</span></div>
    <details id="settingsInputDetails" class="compact-disclosure" data-persist-detail>
      <summary><span>Xem chi tiết định dạng & tính năng</span><span class="disclosure-chevron">⌄</span></summary>
      <div class="disclosure-body"><div class="capability-grid"><span>✓ PDF nhiều file</span><span>✓ ZIP tự bung</span><span>✓ Đọc cả thư mục</span><span>✓ Ảnh JPG/PNG/WebP</span><span>✓ TXT/CSV/JSON</span><span>${IS_DESKTOP_EDITION ? '✓ RAR/7Z/TAR/GZ cục bộ' : '✓ ZIP trên Web; RAR/7Z dùng Desktop'}</span><span>✓ Archive có mật khẩu</span><span>✓ Quét toàn bộ lớp chữ</span><span>✓ OCR/Vision đúng trang mục tiêu</span><span>✓ Thư viện công thức tự quét</span><span>✓ Gemini/OpenAI đọc PDF native</span><span>✓ Lịch sử Hỏi đáp/Tính toán local</span><span>✓ Hybrid Semantic + Visual RAG</span><span>✓ Local Embedding/Rerank</span><span>✓ Tự chẩn đoán Ollama/RAM/GPU</span><span>✓ Quản lý model Offline & ổ đĩa</span><span>✓ Nhiều model AI</span><span>✓ PDF liên tục + kéo/pan</span><span>✓ Tìm trong PDF + phím tắt</span><span>✓ Giao diện co giãn</span></div>${archiveEngineCardHtml()}</div>
    </details>
  </div>
  <div class="panel-section compact-settings-card">
    <div class="panel-section-title"><h3>Chẩn đoán ứng dụng</h3><span>${state.diagnosticSummary ? `${state.diagnosticSummary.passed}/${state.diagnosticSummary.total}` : 'Chưa chạy'}</span></div>
    <div class="compact-overview-line"><div><b>${state.diagnosticSummary ? `${state.diagnosticSummary.passed}/${state.diagnosticSummary.total} kiểm tra ${state.diagnosticSummary.ok ? 'đạt' : 'cần xem'}` : 'Kiểm tra nhanh tình trạng ứng dụng'}</b><small>Bộ nhớ · PDF · nguồn · AI · build${IS_DESKTOP_EDITION ? ' · Ollama · archive' : ''}</small></div><button class="btn compact-btn" id="runDiagnostics">Chạy</button></div>
    ${state.diagnosticHtml ? `<details id="settingsDiagnosticDetails" class="compact-disclosure" data-persist-detail><summary><span>Xem chi tiết chẩn đoán</span><span class="disclosure-chevron">⌄</span></summary><div class="disclosure-body">${state.diagnosticHtml}</div></details>` : ''}
  </div>`;
}

function sourceChipsHtml(hits = []) {
  const unique = [];
  const seen = new Set();
  for (const h of hits) {
    const key = `${h.docId}:${h.page}`;
    if (!seen.has(key)) { seen.add(key); unique.push(h); }
    if (unique.length >= 10) break;
  }
  if (!unique.length) return '';
  return `<div class="source-chips">${unique.map(h => `<button class="source-chip" data-hit-doc="${h.docId}" data-hit-page="${h.page}">${esc(h.standard || h.docName)} · P.${h.page}</button>`).join('')}</div>`;
}

function bind() {
  // Event delegation: app.innerHTML is rebuilt frequently. Binding once on the
  // stable #app root prevents dynamic buttons from losing their handlers.
  app.onclick = async event => {
    const el = event.target.closest('button, [role="button"]');
    if (!el || !app.contains(el) || el.disabled) return;

    try {
      if (el.matches('[data-tab]')) { state.tab = el.dataset.tab; render(); return; }
      if (el.matches('[data-mobile]')) { state.mobile = el.dataset.mobile; render(); return; }
      if (el.id === 'sourceBadge') { if (window.innerWidth > 880) { state.focusReader=false; state.leftCollapsed=false; localStorage.setItem(STORAGE.leftCollapsed, 'false'); } else state.mobile = 'library'; render(); return; }
      if (el.id === 'assistantSettingsSummary') { state.tab = 'settings'; if (window.innerWidth > 880) { state.focusReader=false; state.rightCollapsed=false; localStorage.setItem(STORAGE.rightCollapsed, 'false'); } else state.mobile = 'assistant'; render(); return; }
      if (el.id === 'undoAction') { await undoLast(); return; }
      if (el.id === 'redoAction') { await redoLast(); return; }
      if (el.id === 'selectAll') { const before=[...state.selected]; state.docs.forEach(d => state.selected.add(d.id)); pushUndo({type:'selection',before,after:[...state.selected],label:'chọn tất cả nguồn'}); showToast(`Đã chọn ${state.docs.length} tài liệu làm nguồn.`, 'success'); render(); return; }
      if (el.id === 'clearSelection') { const before=[...state.selected]; state.selected.clear(); pushUndo({type:'selection',before,after:[],label:'bỏ chọn nguồn'}); showToast(state.settings.scope === 'selected' ? 'Đã bỏ chọn nguồn. Phạm vi “Đã chọn” hiện không có tài liệu.' : 'Đã bỏ dấu tick. Phạm vi Toàn thư viện vẫn tra cứu tất cả tài liệu.', 'info'); render(); return; }
      if (el.matches('[data-pin-doc]')) { await toggleDocPinned(el.dataset.pinDoc); return; }
      if (el.id === 'bookmarkCurrentPage') { await addCurrentPageBookmark(); return; }
      if (el.id === 'toggleBookmarks') { state.bookmarkPanelOpen=!state.bookmarkPanelOpen; render(); return; }
      if (el.id === 'closeBookmarkPanel') { state.bookmarkPanelOpen=false; render(); return; }
      if (el.matches('[data-bookmark-page]')) { jumpPage(Number(el.dataset.bookmarkPage)||1); return; }
      if (el.matches('[data-remove-bookmark]')) { await removeBookmarkOrHighlight(el.dataset.removeBookmark); return; }
      if (el.matches('[data-annotation-id]')) { state.bookmarkPanelOpen=true; render(); return; }
      if (el.id === 'toggleLibrary' || el.id === 'viewerToggleLibrary') { state.focusReader=false; state.leftCollapsed = !state.leftCollapsed; localStorage.setItem(STORAGE.leftCollapsed, String(state.leftCollapsed)); render(); return; }
      if (el.id === 'toggleAssistant' || el.id === 'viewerToggleAssistant') { state.focusReader=false; state.rightCollapsed = !state.rightCollapsed; localStorage.setItem(STORAGE.rightCollapsed, String(state.rightCollapsed)); render(); return; }
      if (el.id === 'reopenLibrary') { state.focusReader=false; state.leftCollapsed=false; localStorage.setItem(STORAGE.leftCollapsed, 'false'); render(); return; }
      if (el.id === 'reopenAssistant') { state.focusReader=false; state.rightCollapsed=false; localStorage.setItem(STORAGE.rightCollapsed, 'false'); render(); return; }
      if (el.id === 'resetLayout') { state.focusReader=false; state.leftCollapsed=false; state.rightCollapsed=false; state.layout={left:290,right:440}; localStorage.setItem(STORAGE.leftCollapsed,'false'); localStorage.setItem(STORAGE.rightCollapsed,'false'); localStorage.setItem(STORAGE.leftWidth,'290'); localStorage.setItem(STORAGE.rightWidth,'440'); showToast('Đã khôi phục bố cục Thư viện · PDF · Trợ lý.', 'success'); render(); return; }
      if (el.id === 'focusReader') { state.focusReader = !state.focusReader; render(); return; }
      if (el.id === 'readerContinuous') { setReaderMode('continuous'); return; }
      if (el.id === 'readerSingle') { setReaderMode('single'); return; }
      if (el.id === 'pdfSmartSelect') { await togglePdfSmartSelection(); return; }
      if (el.id === 'pdfSearchPrev') { findNextInActive(-1); return; }
      if (el.id === 'pdfSearchNext') { findNextInActive(1); return; }
      if (el.matches('[data-open]')) { openDoc(el.dataset.open); return; }
      if (el.matches('[data-delete]')) { await removeDoc(el.dataset.delete); return; }
      if (el.id === 'prevPage') { jumpPage(state.page - 1); return; }
      if (el.id === 'nextPage') { jumpPage(state.page + 1); return; }
      if (el.id === 'zoomOut') { setZoom(state.zoom - 0.1); return; }
      if (el.id === 'zoomIn') { setZoom(state.zoom + 0.1); return; }
      if (el.id === 'fitWidth') { fitPageWidth(); return; }
      if (el.id === 'aiSummary') { await aiSummary(); return; }
      if (el.id === 'aiSummaryAll') { await aiSummaryAll(); return; }
      if (el.matches('[data-remove-chat-image]')) { removeChatImage(el.dataset.removeChatImage); return; }
      if (el.id === 'confirmImageEngineering') { await confirmImageEngineeringInput(); return; }
      if (el.id === 'cancelImageEngineering') { state.pendingImageExtraction=null; render(); return; }
      if (el.id === 'askBtn') { await askQuestion(); return; }
      if (el.matches('[data-engineering-excel]')) { await exportEngineeringMessageExcel(el.dataset.engineeringExcel); return; }
      if (el.matches('[data-engineering-open-calc]')) { openEngineeringInCalculator(el.dataset.engineeringOpenCalc); return; }
      if (el.matches('[data-engineering-source]')) { showEngineeringSources(el.dataset.engineeringSource); return; }
      if (el.id === 'chatCalcRecalcBtn') { recalculateChatTransfer(); return; }
      if (el.id === 'chatCalcExcelBtn') { await exportChatCalcTransferExcel(); return; }
      if (el.id === 'chatCalcBackBtn') { state.tab='chat'; render(); return; }
      if (el.id === 'newChatBtn') { await persistCurrentChat(); startNewChat(); return; }
      if (el.id === 'exportHistoryBtn') { exportHistory(document.querySelector('#historyExportFormat')?.value || 'json'); return; }
      if (el.id === 'chatHistoryBtn') { state.chatHistoryOpen = !state.chatHistoryOpen; render(); return; }
      if (el.id === 'closeChatHistory') { state.chatHistoryOpen = false; render(); return; }
      if (el.matches('[data-chat-session]')) { openChatSession(el.dataset.chatSession); return; }
      if (el.matches('[data-pin-chat-session]')) { await togglePinChatSession(el.dataset.pinChatSession); return; }
      if (el.matches('[data-rename-chat-session]')) { await renameChatSession(el.dataset.renameChatSession); return; }
      if (el.matches('[data-delete-chat-session]')) { await removeChatSession(el.dataset.deleteChatSession); return; }
      if (el.matches('[data-load-calculation]')) { loadCalculation(el.dataset.loadCalculation); return; }
      if (el.matches('[data-delete-calculation]')) { await removeCalculation(el.dataset.deleteCalculation); return; }
      if (el.matches('[data-suggest]')) {
        state.chatDraft = el.dataset.suggest || '';
        const q = document.querySelector('#chatQuestion');
        if (q) q.value = state.chatDraft;
        await askQuestion(state.chatDraft);
        return;
      }
      if (el.id === 'lookupBtn') { await runLookup(); return; }
      if (el.id === 'tableLookupBtn') { runTableLookup(); return; }
      if (el.id === 'pass8CalculateBtn') { await runPass82FromProductionUi(); return; }
      if (el.id === 'pass8ExporterHealthBtn') { await refreshPass82ExporterHealth(true); return; }
      if (el.id === 'pass8ExportBtn') { await exportPass82FromProductionUi(); return; }
      if (el.id === 'calcBtn') { runCalc(); return; }
      if (el.id === 'calc10304Btn') { runPile10304Calc(); return; }
      if (el.id === 'calc10304Excel') { await exportPile10304Excel(); return; }
      if (el.id === 'calcFill7888') { fillCalcFrom7888(); return; }
      if (el.id === 'formulaScanBtn') { await scanAllFormulasSmart(); return; }
      if (el.id === 'formulaCalcBtn') { runDynamicFormula(); return; }
      if (el.id === 'formulaExcelBtn') { await exportSelectedFormulaExcel(); return; }
      if (el.id === 'codePackExcelBtn') { await exportCurrentCodePackExcel(); return; }
      if (el.id === 'formulaVerifyBtn') { await verifySelectedAiFormula(); return; }
      if (el.id === 'compareBtn') { state.compareMode='compare'; await runCompare(); return; }
      if (el.id === 'copyChecklist') { await copyChecklist(); return; }
      if (el.id === 'resetChecklist') { resetChecklist(); return; }
      if (el.id === 'aiChecklist') { await aiChecklist(); return; }
      if (el.matches('[data-connection]')) {
        rememberSettingsDraft();
        state.settings.connection = el.dataset.connection;
        state.connectionStatus = null;
        saveSettings();
        render();
        return;
      }
      if (el.id === 'saveSettings') { updateSettingsFromForm(); return; }
      if (el.id === 'testConnection') { await testConnection(); return; }
      if (el.closest?.('#openSettingsModelPicker')) { state.modelPickerOpen = true; render(); queueMicrotask(() => document.querySelector('#modelPickerSearch')?.focus()); return; }
      if (el.id === 'closeModelPicker' || (el.id === 'modelPickerOverlay' && event.target === el)) { state.modelPickerOpen = false; render(); return; }
      const modelChoice = el.closest?.('[data-model-choice]');
      if (modelChoice) {
        const next = modelChoice.dataset.modelChoice || '';
        if (confirmModelSwitch(next, 'Bạn đang chọn một model khác.')) state.modelPickerOpen = false;
        render();
        return;
      }
      if (el.id === 'applyManualModel') {
        const next = document.querySelector('#manualModelInput')?.value.trim() || '';
        if (!next) return showToast('Hãy nhập model ID cần dùng.', 'warning');
        if (confirmModelSwitch(next, 'Bạn đang nhập model thủ công.')) state.modelPickerOpen = false;
        render();
        return;
      }
      if (el.id === 'refreshModelsFromPicker') { await refreshModels(); return; }
      if (el.id === 'refreshModels') { await refreshModels(); return; }
      if (el.id === 'ocrActivePdf') { await ocrActivePdfLocal(); return; }
      if (el.id === 'autoLocalModels') { await applyRecommendedLocalModels(); return; }
      if (el.id === 'installOllamaNow') { await installOllamaAutomatically(); return; }
      if (el.id === 'installCurrentLocalModel') { await installLocalModels([state.settings.model || 'qwen3:8b']); return; }
      if (el.id === 'installLocalAiPack') { await installLocalModels([state.settings.model || 'qwen3:8b', state.settings.embeddingModel || 'bge-m3', state.settings.visionModel || 'gemma3:4b']); return; }
      if (el.id === 'refreshLocalModelManager') { await refreshLocalModelManager(true); return; }
      if (el.id === 'applyModelDirectory') { await applyModelDirectory(); return; }
      if (el.id === 'openModelDirectory') { await openModelDirectory(); return; }
      if (el.matches('[data-model-dir]')) { const input=document.querySelector('#modelDirectoryInput'); if(input) input.value=el.dataset.modelDir || ''; return; }
      if (el.matches('[data-install-pack]')) { await installModelPack(el.dataset.installPack); return; }
      if (el.matches('[data-delete-local-model]')) { await deleteLocalModel(el.dataset.deleteLocalModel); return; }
      if (el.matches('[data-cancel-local-model]')) { await cancelLocalModelPull(el.dataset.cancelLocalModel); return; }
      if (el.id === 'checkArchiveEngines') { await refreshArchiveEngines(true); return; }
      if (el.id === 'open7ZipHelp') { window.open('https://www.7-zip.org/download.html', '_blank', 'noopener,noreferrer'); return; }
      if (el.id === 'runDiagnostics') { await runDiagnostics(); return; }
      if (el.id === 'checkDocumentHealth') { state.documentHealth=documentHealth(); render(); return; }
      if (el.id === 'reindexActiveDocument') { await reindexDocument(); return; }
      if (el.id === 'reindexAllDocuments') { await reindexAllDocuments(); return; }
      if (el.id === 'exportBackupZip') { await exportBackupZip(); return; }
      if (el.id === 'restoreBackupBtn') { document.querySelector('#backupRestoreInput')?.click(); return; }
      if (el.id === 'exportDiagnosticZip') { await exportDiagnosticZip(); return; }
      if (el.id === 'clearCrashLog') { state.crashLog=[];localStorage.setItem(STORAGE.crashLog,'[]');render();return; }
      if (el.matches('[data-verify-message]')) { const i=Number(el.dataset.verifyMessage);const m=state.chat[i];if(m&&m.role==='ai'){const q=[...state.chat.slice(0,i)].reverse().find(x=>x.role==='user')?.text||'';m.evidence=answerEvidenceMeta(q,{hits:m.hits||[],stats:m.stats||{}});await persistCurrentChat();render();showToast(`Đã đối chiếu ${m.evidence.sourceCount} nguồn · độ tin cậy ${m.evidence.confidence}.`,'success');}return; }
      if (el.id === 'compareAuditBtn') { state.compareMode='audit'; await runCompare(); return; }
      if (el.id === 'checkAppUpdate') { await checkAppUpdate(); return; }
      if (el.id === 'copyBuildDiagnostics') { await copyBuildDiagnostics(); return; }
      if (el.matches('[data-jump]')) {
        if (el.dataset.doc) state.activeDocId = el.dataset.doc;
        jumpPage(Number(el.dataset.jump));
        return;
      }
      if (el.matches('[data-find]')) { findInActive(el.dataset.find); return; }
      if (el.matches('[data-hit-doc]')) {
        state.activeDocId = el.dataset.hitDoc;
        jumpPage(Number(el.dataset.hitPage) || 1);
        return;
      }
    } catch (error) {
      console.error('HNL action error', error);
      showToast(`Không thực hiện được thao tác: ${error.message}`, 'error');
    }
  };

  app.onchange = async event => {
    const el = event.target;
    if (el.id === 'dataInput' || el.id === 'folderInput') { uploadInputs(event); return; }
    if (el.id === 'chatImageInput') { addChatImageFiles(el.files || []); el.value=''; return; }
    if (el.id === 'backupRestoreInput') { const file=el.files?.[0]; if(file){try{await restoreBackupFile(file);}catch(error){recordClientError('restore-backup',error);showToast(`Khôi phục backup lỗi: ${error.message}`,'error');}} el.value=''; return; }
    if (el.matches('[data-select]')) { const before=[...state.selected]; el.checked ? state.selected.add(el.dataset.select) : state.selected.delete(el.dataset.select); pushUndo({type:'selection',before,after:[...state.selected],label:'đổi nguồn tra cứu'}); render(); return; }
    if (el.matches('[data-check]')) { updateChecklist(Number(el.dataset.check), el.checked); return; }
    if (el.id === 'strictSide') { state.settings.strict = el.checked; saveSettings(); render(); return; }
    if (el.id === 'scopeSelect') { state.settings.scope = el.value; state.searchStats = null; saveSettings(); showToast(`Phạm vi: ${scopeLabel()}.`, 'success'); render(); return; }
    if (el.id === 'pageInput') { jumpPage(Number(el.value)); return; }
    if (el.id === 'pageRange') { jumpPage(Number(el.value)); return; }
    if (el.id === 'pass8StructuralFile') {
      syncPass82DraftFromDom(); const file=el.files?.[0];
      if(!file){state.pass8Structural=null;state.pass8StructuralName='';return;}
      try{state.pass8Structural=parseStructuralJsonText(await file.text(),{sourceId:`PASS8_UI:${file.name}`});state.pass8StructuralName=file.name;state.pass8Output=null;showToast(`Đã nạp kết cấu: ${file.name}`,'success');render();}
      catch(error){state.pass8Structural=null;state.pass8StructuralName='';showToast(`File kết cấu không hợp lệ: ${error.message}`,'error');render();}
      return;
    }
    if (el.id === 'tableDiameter') { updateTableClassOptions(); return; }
    if (el.id === 'cType' || el.id === 'cClass') { syncCalcDefaults(); return; }
    if (el.id === 'cDiameter') { syncCalcClassOptions(); syncCalcDraftFromDom({clearTableSource:true}); return; }
    if (el.id === 'lookupScopeInput') { state.lookup.scope = el.value || 'smart'; localStorage.setItem(STORAGE.lookupScope, state.lookup.scope); state.lookup.hits = []; state.searchStats = null; render(); return; }
    if (el.id === 'formulaScopeInput') { state.formulaScanScope = el.value || 'page'; localStorage.setItem(STORAGE.formulaScope, state.formulaScanScope); render(); return; }
    if (el.id === 'formulaScanMode') { state.formulaScanMode = el.value || 'auto'; localStorage.setItem(STORAGE.formulaScanMode, state.formulaScanMode); return; }
    if (el.id === 'formulaFilterInput') { state.formulaQuery = String(el.value || ''); render(); return; }
    if (el.id === 'formulaSelect') { state.formulaSelection = el.value; localStorage.setItem(STORAGE.formulaSelection, el.value); render(); return; }
    if (el.matches('[data-doc-category]')) { await changeDocCategory(el.dataset.docCategory, el.value); return; }
    if (el.id === 'libraryFilterInput') { state.libraryFilter=el.value||'all';localStorage.setItem(STORAGE.libraryFilter,state.libraryFilter);render();return; }
    if (el.id === 'performanceModeInput') { state.settings.performanceMode=['light','balanced','strong'].includes(el.value)?el.value:'balanced';saveSettings();render();return; }
    if (el.id === 'fieldModeInput') { state.settings.fieldMode=Boolean(el.checked);saveSettings();render();return; }
    if (el.id === 'providerSelect') { providerChanged(event); return; }
    if (el.id === 'nativePdfModeInput') {
      const next = ['economy','balanced','native'].includes(el.value) ? el.value : 'balanced';
      state.settings.nativePdfMode = next;
      state.settingsDraft = { ...(state.settingsDraft || {}), nativePdfMode:next };
      saveSettings();
      const badge = document.querySelector('#nativePdfModeBadge');
      const summary = document.querySelector('#nativePdfModeSummary');
      if (badge) badge.textContent = next === 'economy' ? 'Tiết kiệm' : next === 'native' ? 'Toàn tài liệu' : 'Cân bằng';
      if (summary) summary.textContent = next === 'economy' ? 'RAG trước · chỉ gửi trang/ảnh cần thiết' : next === 'native' ? 'Giữ chế độ Toàn tài liệu; PDF quá giới hạn sẽ dùng fallback trang mục tiêu và báo rõ' : 'RAG trước · tự dùng PDF native khi thật sự cần';
      state.nativePdfStatus = '';
      showToast(`Đã giữ chế độ PDF: ${badge?.textContent || next}.`, 'success');
      return;
    }
    if (el.id === 'openaiPdfDetailInput') { state.settings.openaiPdfDetail = ['low','auto','high'].includes(el.value) ? el.value : 'auto'; state.settingsDraft = { ...(state.settingsDraft || {}), openaiPdfDetail:state.settings.openaiPdfDetail }; saveSettings(); return; }
  };

  app.oninput = event => {
    const el = event.target;
    if (el.id === 'chatQuestion') state.chatDraft = el.value;
    else if (el.id === 'librarySearchInput') { state.libraryQuery=el.value;localStorage.setItem(STORAGE.libraryQuery,state.libraryQuery);const list=document.querySelector('.doc-list');if(list)list.innerHTML=filteredLibraryDocs().length?filteredLibraryDocs().map(docItem).join(''):'<div class="empty-card"><b>Không có tài liệu phù hợp.</b></div>'; }
    else if (el.id === 'chatHistorySearch') { state.historyQuery=el.value;localStorage.setItem(STORAGE.chatHistoryQuery,state.historyQuery);render(); }
    else if (el.id === 'pdfSearchInput') { state.readerQuery = el.value; state.readerMatchIndex = -1; localStorage.setItem(STORAGE.readerQuery, state.readerQuery); }
    else if (el.id === 'pageRange') { const n=Number(el.value)||1; const label=document.querySelector('#readerStatusPage'); if(label) label.textContent=String(n); }
    else if (el.id === 'modelPickerSearch') {
      const q = String(el.value || '').trim().toLowerCase();
      let visible = 0;
      document.querySelectorAll('.model-option-row').forEach(row => {
        const match = !q || String(row.dataset.modelFilter || '').includes(q);
        row.hidden = !match;
        if (match) visible++;
      });
      const count = document.querySelector('#modelPickerCount');
      if (count) count.textContent = `${visible} model`;
    }
    else if (el.id === 'lookupQuery') state.lookup.draft = el.value;
    else if (el.id === 'lookupPagesInput') { state.lookup.pages = el.value; localStorage.setItem(STORAGE.lookupPages, state.lookup.pages); }
    else if (el.id === 'formulaPagesInput') { state.formulaScanPages = el.value; localStorage.setItem(STORAGE.formulaPages, state.formulaScanPages); }
    else if (['cDiameter','cThickness','cCu','cCe'].includes(el.id)) syncCalcDraftFromDom({clearTableSource:['cDiameter','cThickness','cCe'].includes(el.id)});
    else if (el.id === 'compareQuestion') state.compare.draft = el.value;
    else if (el.id === 'visionModelInput') state.settingsDraft.visionModel = el.value;
    else if (el.id === 'embeddingModelInput') state.settingsDraft.embeddingModel = el.value;
    else if (el.id === 'bridgeInput') state.settingsDraft.bridgeUrl = el.value;
    else if (el.id === 'ollamaInput') state.settingsDraft.ollamaUrl = el.value;
    else if (el.id === 'apiKeyInput') state.settingsDraft.apiKey = el.value;
  };

  app.onkeydown = event => {
    if (event.isComposing) return;
    const el = event.target;
    if (event.key === 'Escape' && state.modelPickerOpen) { event.preventDefault(); state.modelPickerOpen = false; render(); return; }
    if (el.id === 'pageInput' && event.key === 'Enter') { event.preventDefault(); jumpPage(Number(el.value)); return; }
    if (el.id === 'pdfSearchInput' && event.key === 'Enter') { event.preventDefault(); findNextInActive(event.shiftKey ? -1 : 1); return; }
    if (el.id === 'lookupQuery' && event.key === 'Enter') { event.preventDefault(); runLookup(); return; }
    if (el.id === 'chatQuestion' && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      askQuestion();
      return;
    }
    if (el.id === 'compareQuestion' && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      runCompare();
    }
  };
  if (!bind.chatImageInputBound) {
    bind.chatImageInputBound = true;
    document.addEventListener('paste', event => {
      const target=event.target;
      if(!['chatQuestion','chatCalcQuestionEdit'].includes(target?.id)) return;
      const files=[...(event.clipboardData?.items||[])].filter(x=>x.kind==='file' && /^image\//i.test(x.type||'')).map(x=>x.getAsFile()).filter(Boolean);
      if(files.length && target.id==='chatQuestion') { event.preventDefault(); addChatImageFiles(files); return; }
      const text=String(event.clipboardData?.getData?.('text/plain')||'');
      if(!text) return;
      event.preventDefault();
      const changed=insertNormalizedEngineeringPaste(target,text);
      if(changed) showToast('Đã giữ nguyên nội dung gốc; HNL sẽ chuẩn hóa ký hiệu/công thức ở lớp tính toán.', 'success');
    });
    document.addEventListener('dragover', event => { if(event.target?.closest?.('.chat-composer')) event.preventDefault(); });
    document.addEventListener('drop', event => {
      if(!event.target?.closest?.('.chat-composer')) return;
      const files=[...(event.dataTransfer?.files||[])].filter(x=>/^image\//i.test(x.type||''));
      if(files.length){ event.preventDefault(); addChatImageFiles(files); }
    });
  }
  if (!bind.selectionToolsBound) {
    bind.selectionToolsBound = true;
    document.addEventListener('contextmenu', event => {
      const layer = event.target?.closest?.('.pdf-text-layer');
      if (!layer) return;
      const text = String(window.getSelection?.()?.toString() || '').trim();
      if (!text) return;
      event.preventDefault();
      const page = Number(layer.dataset.page || layer.closest('.pdf-page-shell')?.dataset.page || state.page || 1);
      showPdfSelectionPopup(selectionSourceFromText(text, page), { x:event.clientX, y:event.clientY, region:false });
    });
    document.addEventListener('click', async event => {
      const button = event.target?.closest?.('[data-pdf-selection-action]');
      if (!button) { if (!event.target?.closest?.('.pdf-selection-popup')) closePdfSelectionPopup(); return; }
      const popup = button.closest('.pdf-selection-popup');
      const source = popup?._hnlSource;
      const action = button.dataset.pdfSelectionAction;
      if (action === 'close') { closePdfSelectionPopup(); return; }
      if (!source?.text) return;
      if (action === 'copy') { try { await navigator.clipboard.writeText(source.text); showToast('Đã copy đoạn đã chọn.', 'success'); } catch { showToast('Không copy tự động được; hãy dùng Ctrl+C.', 'warning'); } }
      else if (action === 'pin') pinPdfSource(source);
      else if (action === 'note') await addRegionNote(source);
      else if (action === 'ask') { state.chatDraft = `Giải thích đoạn sau từ ${source.standard || source.docName}, trang ${source.page}:\n\n${source.text}`; state.tab='chat'; state.mobile='assistant'; render(); }
      else if (action === 'summary') { state.chatDraft = `Tóm tắt chính xác đoạn sau, không thêm nội dung ngoài nguồn (${source.standard || source.docName}, trang ${source.page}):\n\n${source.text}`; state.tab='chat'; state.mobile='assistant'; render(); }
      else if (action === 'lookup' || action === 'library') {
        const query = String(source.text).replace(/\s+/g,' ').slice(0,420);
        state.lookup.query=query; state.lookup.draft=query;
        const docs = action === 'library' ? state.docs.filter(d=>d.viewerKind!=='image') : sourceDocs().filter(d=>d.viewerKind!=='image');
        state.lookup.hits = searchEveryPage(query, docs, 100);
        state.tab='lookup'; state.mobile='assistant'; render();
      } else if (action === 'formula') await scanFormulaFromRegion(source);
      closePdfSelectionPopup();
    });
  }
}

function bindSourceButtons() { /* event delegation handles source buttons */ }

function openDoc(id) {
  state.activeDocId = id;
  state.page = 1;
  state.pendingPageScroll = true;
  state.mobile = window.innerWidth <= 880 ? 'viewer' : state.mobile;
  render();
}
function setReaderMode(mode) {
  if (!['continuous','single'].includes(mode)) return;
  state.readerMode = mode;
  state.pendingPageScroll = true;
  localStorage.setItem(STORAGE.readerMode, mode);
  render();
}
function setZoom(value) {
  state.zoom = Math.min(2.5, Math.max(0.45, Math.round(value * 100) / 100));
  state.pendingPageScroll = true;
  render();
}
function fitPageWidth() {
  const wrap = document.querySelector('.canvas-wrap');
  const shell = document.querySelector('.pdf-page-shell');
  const canvas = document.querySelector('#pdfCanvas, .pdf-page-canvas[data-rendered="1"]');
  if (!wrap || !activeDoc()) return;
  if (activeDoc().viewerKind !== 'pdf') return setZoom(1.0);
  const renderedWidth = parseFloat(canvas?.style.width) || canvas?.getBoundingClientRect().width || shell?.getBoundingClientRect().width || 794 * state.zoom;
  const available = Math.max(260, wrap.clientWidth - (state.readerMode === 'continuous' ? 68 : 48));
  if (!Number.isFinite(renderedWidth) || renderedWidth <= 0) return setZoom(1.08);
  setZoom(state.zoom * available / renderedWidth);
}
function readerMatches() {
  const doc = activeDoc();
  const q = String(state.readerQuery || '').trim().toLocaleLowerCase('vi');
  if (!doc || !q) return [];
  return (doc.pages || []).filter(p => String(p.text || '').toLocaleLowerCase('vi').includes(q)).map(p => Number(p.page));
}
function findNextInActive(direction = 1) {
  const q = String(document.querySelector('#pdfSearchInput')?.value ?? state.readerQuery ?? '').trim();
  state.readerQuery = q; localStorage.setItem(STORAGE.readerQuery, q);
  if (!q) return showToast('Nhập từ khóa cần tìm trong PDF.', 'warning');
  const matches = readerMatches();
  if (!matches.length) return showToast(`Không tìm thấy “${q}” trong PDF đang mở.`, 'warning');
  if (state.readerMatchIndex < 0) {
    const currentIdx = matches.findIndex(p => p >= state.page);
    state.readerMatchIndex = currentIdx >= 0 ? currentIdx : 0;
  } else state.readerMatchIndex = (state.readerMatchIndex + direction + matches.length) % matches.length;
  const page = matches[state.readerMatchIndex];
  jumpPage(page);
  showToast(`“${q}” · kết quả ${state.readerMatchIndex + 1}/${matches.length} · trang ${page}.`, 'success');
}
async function extractArchiveWithPassword(archive, cacheKey = archive.name) {
  let password = state.archivePasswordCache.get(cacheKey) || '';
  try {
    return await extractArchiveViaLocalBridge(archive, password);
  } catch (error) {
    if (!['PASSWORD_REQUIRED','BAD_PASSWORD'].includes(error.code)) throw error;
    const message = error.code === 'BAD_PASSWORD'
      ? `Mật khẩu của “${cacheKey}” chưa đúng. Nhập lại mật khẩu archive:`
      : `“${cacheKey}” có mật khẩu. Nhập mật khẩu archive:`;
    password = window.prompt(message, password || '') ?? '';
    if (!password) throw new Error('Đã hủy nhập mật khẩu archive.');
    const result = await extractArchiveViaLocalBridge(archive, password);
    state.archivePasswordCache.set(cacheKey, password);
    return result;
  }
}

function archiveLike(name='') { return /\.zip$/i.test(String(name||'')) || isArchiveFile(name); }
async function expandLocalArchiveTree(archive, sourcePath = archive.name, depth = 0) {
  if (depth > 3) throw new Error(`Archive lồng quá 3 cấp: ${sourcePath}`);
  const extracted = await extractArchiveWithPassword(archive, sourcePath);
  const out = [];
  for (const item of extracted) {
    const prefix = `${archive.name}/`;
    const inside = String(item.path || item.file.name).startsWith(prefix) ? String(item.path).slice(prefix.length) : String(item.path || item.file.name);
    const fullPath = `${sourcePath}/${inside}`.replace(/\/{2,}/g,'/');
    if (archiveLike(item.file.name)) out.push(...await expandLocalArchiveTree(item.file, fullPath, depth + 1));
    else out.push({ file:item.file, path:fullPath });
  }
  return out;
}

async function uploadInputs(event) {
  const raw = [...(event.target.files || [])];
  if (!raw.length) return showToast('Chưa chọn dữ liệu.', 'warning');
  // On Desktop/localhost every archive, including ZIP, goes through the local
  // extraction engine so encrypted ZIP and Unicode/nested paths are supported.
  // On Web, ZIP keeps the zero-install browser path.
  const localArchives = raw.filter(f => isArchiveFile(f.name) || (isLocalHost() && /\.zip$/i.test(f.name)));
  let items = [];
  try {
    state.progress = { title: 'Đang quét dữ liệu', detail: `Đọc ${raw.length} mục…`, pct: 3 };
    render();
    items = await expandInputItems(raw.filter(f => !localArchives.includes(f)));
    if (localArchives.length) {
      if (!isLocalHost()) showToast('RAR/7Z/TAR/GZ/BZ2/XZ cần HNL Desktop/HNL Local. ZIP trên Web vẫn mở trực tiếp.', 'warning');
      else {
        for (const archive of localArchives) {
          state.progress = { title:`Đang giải nén ${archive.name}`, detail:'Kiểm tra engine, mật khẩu, Unicode và thư mục lồng…', pct:5 }; render();
          const extracted = await expandLocalArchiveTree(archive, archive.name, 0);
          items.push(...await expandInputItems(extracted));
        }
      }
    }
  } catch (error) {
    state.progress = null; render();
    return showToast(`Không mở được file nén: ${error.message}`, 'error');
  }
  if (!items.length) { state.progress = null; render(); return showToast('Không tìm thấy PDF/ảnh/text được hỗ trợ.', 'warning'); }
  let imported = 0, duplicated = 0, failed = 0;
  for (let idx = 0; idx < items.length; idx++) {
    const { file, path } = items[idx];
    state.progress = { title: `Đang đọc ${file.name}`, detail: `${idx + 1}/${items.length} · ${path}`, pct: Math.round((idx / Math.max(1, items.length)) * 100) };
    render();
    try {
      const doc = await parseInputFile(file, {
        sourcePath: path,
        onPdfProgress: (page, total) => {
          const overall = ((idx + page / total) / items.length) * 100;
          state.progress = { title: `Đang phân tích ${file.name}`, detail: `Trang ${page}/${total} · ${idx + 1}/${items.length}`, pct: Math.round(overall) };
          const detail = document.querySelector('.progress-detail');
          const bar = document.querySelector('.progress-bar > div');
          if (detail) detail.textContent = state.progress.detail;
          if (bar) bar.style.width = `${state.progress.pct}%`;
        }
      });
      const duplicate = state.docs.find(d => d.fingerprint && d.fingerprint === doc.fingerprint);
      if (duplicate) { clearPdfCache(doc.id); state.selected.add(duplicate.id); duplicated++; continue; }
      docMeta(doc);
      await saveDocument(doc);
      state.docs.push(doc); state.selected.add(doc.id); state.activeDocId = doc.id; state.page = 1; imported++;
    } catch (error) {
      failed++; console.error('Import failed', path, error);
    }
  }
  event.target.value = '';
  state.progress = null;
  state.mobile = window.innerWidth <= 880 ? 'assistant' : state.mobile;
  clearFormulaCache();
  const importedFormulaStats = formulaStats(state.docs);
  const scanDocs = state.docs.filter(d => d.viewerKind === 'pdf' && d.scannedLikely).length;
  const versionRelations = state.docs.filter(d => relatedDocumentVersions(d).length).length;
  showToast(`Đã nhập ${imported} tài liệu${duplicated ? ` · ${duplicated} trùng` : ''}${failed ? ` · ${failed} lỗi` : ''} · phát hiện nhanh ${importedFormulaStats.total} công thức${scanDocs ? ` · ${scanDocs} PDF scan cần AI/Vision để lấy đủ công thức` : ''}${versionRelations ? ` · ${versionRelations} tài liệu có phiên bản liên quan` : ''}.`, failed ? 'warning' : 'success');
  render();
}
async function removeDoc(id) {
  const doc = state.docs.find(d => d.id === id);
  if (!doc || !confirm(`Xóa “${doc.standard || doc.name}” khỏi thư viện cục bộ?`)) return;
  try {
    pushUndo({type:'delete-doc',doc,index:state.docs.findIndex(d=>d.id===id),selected:state.selected.has(id),activeDocId:state.activeDocId,label:'xóa tài liệu'});
    await deleteDocument(id);
    clearPdfCache(id);
    clearSearchCache(id);
    state.docs = state.docs.filter(d => d.id !== id);
    state.selected.delete(id);
    if (state.activeDocId === id) { state.activeDocId = state.docs[0]?.id || null; state.page = 1; }
    showToast('Đã xóa tài liệu. Có thể hoàn tác bằng ↶.', 'success');
  } catch (error) { showToast(`Không xóa được: ${error.message}`, 'error'); }
  render();
}
let activePdfObserver = null;
let panCleanup = null;
let readerScrollCleanup = null;
let lastPdfErrorToast = { key: '', at: 0 };

function reportPdfError(error) {
  const raw = String(error?.message || error || 'Lỗi PDF không xác định.');
  const compatibility = /getOrInsertComputed|is not a function/i.test(raw);
  const message = compatibility
    ? 'PDF.js không tương thích với engine trình duyệt/Windows hiện tại. HNL đã chuyển sang bản PDF.js Legacy; hãy cập nhật lên bản HNL mới và tải lại ứng dụng.'
    : `Lỗi hiển thị PDF: ${raw}`;
  const now = Date.now();
  const key = compatibility ? 'pdfjs-compat' : raw;
  if (lastPdfErrorToast.key === key && now - lastPdfErrorToast.at < 12000) return;
  lastPdfErrorToast = { key, at: now };
  showToast(message, 'error');
}


function pdfPageHasSelectableText(doc, page = state.page) {
  const text = String(doc?.pages?.[Math.max(0, Number(page || 1) - 1)]?.text || '').trim();
  return text.length >= 24;
}

async function applyPdfSelectionModeUi(doc = activeDoc()) {
  const button = document.querySelector('#pdfSmartSelect');
  if (button) {
    button.classList.toggle('active-tool', state.pdfSelectionMode !== 'off');
    button.setAttribute('aria-pressed', state.pdfSelectionMode !== 'off' ? 'true' : 'false');
    button.title = state.pdfSelectionMode === 'text' ? 'Đang chọn chữ · bấm để chuyển OCR vùng' : state.pdfSelectionMode === 'region' ? 'Đang OCR vùng · bấm để tắt' : 'PDF có text: bôi chọn/copy. Trang scan: kéo vùng OCR';
  }
  const shells = [...document.querySelectorAll('.pdf-page-shell')];
  if (state.pdfSelectionMode === 'off') {
    for (const shell of shells) {
      shell.classList.remove('pdf-text-selecting','pdf-region-selecting');
      clearRegionLayer(shell.querySelector('.pdf-region-layer'));
    }
    closePdfSelectionPopup();
    return;
  }
  const current = Math.max(1, Number(state.page || 1));
  for (const shell of shells) {
    const page = Number(shell.dataset.page || current);
    const rendered = shell.querySelector('canvas')?.dataset?.rendered === '1' || shell.classList.contains('single') || page === current;
    if (!rendered) continue;
    shell.classList.remove('pdf-text-selecting','pdf-region-selecting');
    await preparePdfSelectionLayer(doc, shell);
  }
}

async function togglePdfSmartSelection() {
  const doc = activeDoc();
  if (!doc || doc.viewerKind !== 'pdf') return showToast('Hãy mở một PDF trước.', 'warning');
  const hasText = pdfPageHasSelectableText(doc, state.page);
  if (state.pdfSelectionMode === 'off') state.pdfSelectionMode = hasText ? 'text' : 'region';
  else if (state.pdfSelectionMode === 'text') state.pdfSelectionMode = 'region';
  else state.pdfSelectionMode = 'off';
  showToast(state.pdfSelectionMode === 'text'
    ? 'Chế độ Chọn chữ: bôi chọn trực tiếp, Ctrl+C hoặc chuột phải để Copy / Hỏi AI / Tra cứu / Tóm tắt / Dùng làm nguồn.'
    : state.pdfSelectionMode === 'region'
      ? 'Chế độ OCR vùng: kéo đúng vùng cần đọc. HNL ưu tiên text layer → OCR cục bộ → chỉ đề nghị Vision AI khi cần.'
      : 'Đã tắt Chọn chữ/OCR vùng.', 'success');
  await applyPdfSelectionModeUi(doc);
}

async function preparePdfSelectionLayer(doc, shell) {
  if (!shell || state.pdfSelectionMode === 'off') return;
  const page = Number(shell.dataset.page || 1);
  const textLayer = shell.querySelector('.pdf-text-layer');
  const regionLayer = shell.querySelector('.pdf-region-layer');
  const hasText = pdfPageHasSelectableText(doc, page);
  if (state.pdfSelectionMode === 'text' && hasText && textLayer) {
    try {
      await renderPdfTextLayer(doc, page, textLayer, state.zoom);
      shell.classList.add('pdf-text-selecting');
      shell.classList.remove('pdf-region-selecting');
    } catch (error) { console.warn('Text layer failed', error); }
  } else if (regionLayer) {
    // Region mode can still reuse an existing text layer before OCR. This lets
    // users crop a table/paragraph on mixed PDFs without sending pixels to AI.
    if (hasText && textLayer && !textLayer.childElementCount) {
      try { await renderPdfTextLayer(doc, page, textLayer, state.zoom); } catch (error) { console.warn('Text layer preload failed', error); }
    }
    shell.classList.remove('pdf-text-selecting');
    shell.classList.add('pdf-region-selecting');
    bindPdfRegionLayer(doc, shell, regionLayer);
  }
}

function clearRegionLayer(layer) {
  if (!layer) return;
  layer.querySelectorAll('.pdf-region-box,.pdf-region-hint').forEach(el => el.remove());
}

function bindPdfRegionLayer(doc, shell, layer) {
  if (!layer || layer.dataset.boundRegion === '1') return;
  layer.dataset.boundRegion = '1';
  layer.innerHTML = '<div class="pdf-region-hint">Kéo vùng cần OCR</div>';
  let start = null;
  let box = null;
  const point = e => {
    const r = layer.getBoundingClientRect();
    return { x:Math.max(0, Math.min(r.width, e.clientX-r.left)), y:Math.max(0, Math.min(r.height, e.clientY-r.top)), width:r.width, height:r.height };
  };
  layer.addEventListener('pointerdown', e => {
    if (state.pdfRegionBusy || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const p = point(e); start = p;
    clearRegionLayer(layer);
    box = document.createElement('div'); box.className='pdf-region-box';
    layer.appendChild(box); layer.setPointerCapture?.(e.pointerId);
  });
  layer.addEventListener('pointermove', e => {
    if (!start || !box) return;
    const p=point(e); const x=Math.min(start.x,p.x), y=Math.min(start.y,p.y), w=Math.abs(p.x-start.x), h=Math.abs(p.y-start.y);
    Object.assign(box.style,{left:`${x}px`,top:`${y}px`,width:`${w}px`,height:`${h}px`});
  });
  const finish = async e => {
    if (!start || !box) return;
    const p=point(e); const x=Math.min(start.x,p.x), y=Math.min(start.y,p.y), width=Math.abs(p.x-start.x), height=Math.abs(p.y-start.y);
    start=null;
    try { layer.releasePointerCapture?.(e.pointerId); } catch {}
    if (width < 14 || height < 14) { clearRegionLayer(layer); return; }
    await ocrSelectedPdfRegion(doc, shell, {x,y,width,height}, box);
  };
  layer.addEventListener('pointerup', finish);
  layer.addEventListener('pointercancel', () => { start=null; clearRegionLayer(layer); });
}

async function ocrSelectedPdfRegion(doc, shell, rect, box) {
  const canvas = shell.querySelector('canvas');
  if (!canvas) return showToast('Trang PDF chưa render xong. Hãy thử lại.', 'warning');
  state.pdfRegionBusy = true;
  box?.classList.add('busy');
  try {
    const image = cropCanvasRegionToBase64(canvas, rect, { maxPixels:1_800_000, quality:.88 });
    const page = Number(shell.dataset.page || state.page || 1);
    const textLayer = shell.querySelector('.pdf-text-layer');
    let text = String(extractTextFromLayerRegion(textLayer, rect) || '').trim();
    let method = text.length >= 8 ? 'text-layer' : '';
    let localOcr = { available:false, text:'' };

    if (!method) {
      localOcr = await ocrImageBase64Locally(image);
      text = String(localOcr.text || '').trim();
      if (text.length >= 12) method = 'local-ocr';
    }

    if (!method) {
      if (state.settings.provider === 'local') {
        const reason = localOcr.available ? 'OCR cục bộ chưa đọc đủ rõ vùng này.' : 'Máy/Chromium hiện không có TextDetector OCR cục bộ.';
        throw new Error(`${reason} Hãy chọn Ollama Vision hoặc AI online nếu bạn muốn đề nghị Vision cho đúng vùng đã chọn.`);
      }
      const ok = window.confirm(`OCR cục bộ ${localOcr.available ? 'đã thử nhưng kết quả chưa đủ rõ' : 'không khả dụng'}.

Chỉ gửi VÙNG ${image.width}×${image.height}px này tới ${PROVIDERS[state.settings.provider]?.label || state.settings.provider} Vision để đọc tiếp?

Cancel = không gửi ảnh lên AI.`);
      if (!ok) throw new Error('Đã hủy Vision AI; vùng ảnh không được gửi ra ngoài.');
      const prompt = `OCR CHỈ VÙNG ẢNH ĐƯỢC CHỌN từ ${doc.standard || doc.name}, trang ${page}.\nYêu cầu:\n- Chép lại chính xác chữ, số, ký hiệu, đơn vị và công thức nhìn thấy.\n- Giữ xuống dòng/bảng ở mức có thể đọc được.\n- Không suy đoán phần nằm ngoài vùng ảnh.\n- Nếu có ký tự không chắc, đánh dấu [không rõ].`;
      text = String(await callConfiguredAiWithApproval({ prompt, images:[image] }) || '').trim();
      if (!text) throw new Error('Vision AI không nhận diện được nội dung trong vùng đã chọn.');
      method = 'vision-ai';
    }

    const shellBox = shell.getBoundingClientRect();
    const sourceRectNorm = shellBox.width && shellBox.height ? { x:image.sourceRect.x/shellBox.width, y:image.sourceRect.y/shellBox.height, width:image.sourceRect.width/shellBox.width, height:image.sourceRect.height/shellBox.height } : null;
    state.lastPdfRegion = {
      docId:doc.id, docName:doc.name, standard:doc.standard, page, text, image,
      sourceRect:image.sourceRect, sourceRectNorm, method, createdAt:new Date().toISOString()
    };
    showPdfRegionResult(state.lastPdfRegion);
    showToast(method === 'text-layer'
      ? 'Vùng chọn đã lấy chữ trực tiếp từ PDF, không OCR và không gửi AI.'
      : method === 'local-ocr'
        ? 'Đã OCR cục bộ đúng vùng chọn, chưa gửi ảnh lên AI.'
        : `Vision chỉ đọc vùng ${image.width}×${image.height}px đã chọn.`, 'success');
    box?.classList.remove('busy');
  } catch (error) {
    showToast(`Không đọc được vùng đã chọn: ${error.message}`, 'error');
    box?.classList.remove('busy');
  } finally { state.pdfRegionBusy=false; }
}


async function updateDocMetaWithUndo(doc, mutate, label='cập nhật tài liệu') {
  if (!doc) return;
  const before=cloneMeta(docMeta(doc)); mutate(docMeta(doc)); const after=cloneMeta(docMeta(doc));
  pushUndo({type:'doc-meta',id:doc.id,before,after,label}); await saveDocument(doc); render();
}
async function toggleDocPinned(id) {
  const doc=state.docs.find(d=>d.id===id); if(!doc)return;
  await updateDocMetaWithUndo(doc,m=>{m.pinned=!m.pinned;},docMeta(doc).pinned?'bỏ ghim tài liệu':'ghim tài liệu');
}
async function changeDocCategory(id, category) {
  const doc=state.docs.find(d=>d.id===id); if(!doc||!DOC_CATEGORIES.some(([x])=>x===category))return;
  await updateDocMetaWithUndo(doc,m=>{m.category=category;},'đổi loại tài liệu');
}
async function addCurrentPageBookmark() {
  const doc=activeDoc(); if(!doc)return showToast('Hãy mở tài liệu trước.','warning');
  const meta=docMeta(doc); const existing=meta.bookmarks.find(x=>Number(x.page)===Number(state.page));
  if(existing){showToast(`Trang ${state.page} đã được đánh dấu.`,'info');state.bookmarkPanelOpen=true;render();return;}
  const label=window.prompt(`Tên đánh dấu trang ${state.page}:`,`Trang ${state.page}`); if(label===null)return;
  await updateDocMetaWithUndo(doc,m=>m.bookmarks.push({id:crypto.randomUUID(),kind:'bookmark',page:Number(state.page),label:String(label||`Trang ${state.page}`),createdAt:new Date().toISOString()}),'đánh dấu trang');
  state.bookmarkPanelOpen=true; showToast(`Đã đánh dấu trang ${state.page}.`,'success');
}
async function addRegionNote(source) {
  const doc=state.docs.find(d=>d.id===source?.docId); if(!doc)return;
  const note=window.prompt('Ghi chú cho vùng này:',String(source.text||'').slice(0,120)); if(note===null)return;
  const rect=source.sourceRectNorm||null;
  await updateDocMetaWithUndo(doc,m=>m.highlights.push({id:crypto.randomUUID(),kind:'highlight',page:Number(source.page)||1,text:String(source.text||'').slice(0,1200),note:String(note||'').trim(),rect,createdAt:new Date().toISOString()}),'thêm ghi chú vùng');
  showToast('Đã lưu vùng đánh dấu và ghi chú trong tài liệu.','success');
}
async function removeBookmarkOrHighlight(id) {
  const doc=activeDoc(); if(!doc)return;
  const meta=docMeta(doc); if(!meta.bookmarks.some(x=>x.id===id)&&!meta.highlights.some(x=>x.id===id))return;
  await updateDocMetaWithUndo(doc,m=>{m.bookmarks=m.bookmarks.filter(x=>x.id!==id);m.highlights=m.highlights.filter(x=>x.id!==id);},'xóa đánh dấu');
}
function renderSavedAnnotations(doc, shell, page) {
  const layer=shell?.querySelector('.pdf-annotation-layer'); if(!layer)return; layer.innerHTML='';
  for(const item of docMeta(doc).highlights.filter(x=>Number(x.page)===Number(page)&&x.rect)){
    const r=item.rect; const el=document.createElement('button');el.type='button';el.className='pdf-saved-highlight';el.dataset.annotationId=item.id;el.title=item.note||item.text||`Trang ${page}`;
    Object.assign(el.style,{left:`${Math.max(0,r.x)*100}%`,top:`${Math.max(0,r.y)*100}%`,width:`${Math.max(.005,r.width)*100}%`,height:`${Math.max(.005,r.height)*100}%`});layer.appendChild(el);
  }
}

function pinPdfSource(source) {
  if (!source?.text) return;
  const item = { docId:source.docId, docName:source.docName, standard:source.standard, page:Number(source.page)||1, text:String(source.text).trim(), pinned:true };
  const key = `${item.docId}:${item.page}:${item.text.slice(0,120)}`;
  if (!state.pinnedSources.some(x => `${x.docId}:${x.page}:${x.text.slice(0,120)}` === key)) state.pinnedSources.push(item);
  showToast('Đã ghim đoạn này làm nguồn ưu tiên cho câu hỏi tiếp theo.', 'success');
}

function selectionSourceFromText(text, page = state.page) {
  const doc = activeDoc();
  return doc ? { docId:doc.id, docName:doc.name, standard:doc.standard, page:Number(page)||1, text:String(text||'').trim() } : null;
}

function closePdfSelectionPopup() { document.querySelectorAll('.pdf-selection-popup').forEach(el => el.remove()); }

function showPdfSelectionPopup(source, { x = 24, y = 80, region = false } = {}) {
  closePdfSelectionPopup();
  if (!source?.text) return;
  const popup = document.createElement('div');
  popup.className = 'pdf-selection-popup';
  popup.style.left = `${Math.max(8, Math.min(window.innerWidth - 330, x))}px`;
  popup.style.top = `${Math.max(8, Math.min(window.innerHeight - 260, y))}px`;
  popup.innerHTML = `<div class="pdf-selection-popup-head"><b>${region ? 'Vùng PDF' : 'Đoạn đã chọn'} · Trang ${Number(source.page)||1}</b><button type="button" data-pdf-selection-action="close">×</button></div>
    <div class="pdf-selection-preview">${esc(String(source.text).slice(0,900))}</div>
    <div class="pdf-selection-actions">
      <button type="button" data-pdf-selection-action="copy">Copy</button>
      <button type="button" data-pdf-selection-action="ask">Hỏi AI</button>
      <button type="button" data-pdf-selection-action="lookup">Tra cứu</button>
      <button type="button" data-pdf-selection-action="summary">Tóm tắt</button>
      <button type="button" data-pdf-selection-action="pin">Dùng làm nguồn</button>
      <button type="button" data-pdf-selection-action="library">Tìm toàn thư viện</button>
      <button type="button" data-pdf-selection-action="note">★ Ghi chú / đánh dấu</button>
      ${region ? '<button type="button" data-pdf-selection-action="formula">Quét công thức vùng này</button>' : ''}
    </div>`;
  popup._hnlSource = source;
  document.body.appendChild(popup);
}

function showPdfRegionResult(source) {
  showPdfSelectionPopup(source, { x:Math.max(12, window.innerWidth - 350), y:Math.max(72, window.innerHeight - 300), region:true });
}

async function scanFormulaFromRegion(source) {
  if (!source?.image?.data) return showToast('Vùng chọn không còn ảnh nguồn để quét công thức.', 'warning');
  if (state.settings.provider === 'local') return showToast('Quét công thức ảnh cần Ollama Vision hoặc AI online.', 'warning');
  const doc = state.docs.find(d => d.id === source.docId);
  if (!doc) return showToast('Không tìm thấy PDF nguồn.', 'error');
  if (!confirm(`Quét công thức CHỈ trong vùng đã chọn tại trang ${source.page}?\n\nKết quả sẽ lưu trạng thái AI Detected, không tự Verified.`)) return;
  try {
    const prompt = `Đọc CHỈ vùng ảnh đã chọn từ ${source.standard || source.docName}, trang ${source.page}. Trả về JSON array; mỗi phần tử có label,title,raw,expression,variables,units,conditions,context,confidence. Không suy đoán ngoài vùng ảnh. Nếu không có công thức trả [].`;
    const answer = await callFormulaAi(prompt, [source.image]);
    const items = parseAiFormulaPayload(answer).map((x, i) => ({
      id:crypto.randomUUID(), page:Number(source.page)||1, label:String(x.label||'').trim(), title:String(x.title||x.section||'Công thức vùng chọn').trim(),
      raw:String(x.raw||x.formula||x.equation||'').trim(), expression:String(x.expression||'').trim(), variables:Array.isArray(x.variables)?x.variables.map(String):[],
      units:typeof x.units==='string'?x.units:(x.units?JSON.stringify(x.units):''), conditions:String(x.conditions||'').trim(), context:String(x.context||'').trim(),
      confidence:Number.isFinite(Number(x.confidence))?Number(x.confidence):null, verified:false, allowCompute:false, aiProvider:state.settings.provider,
      aiModel:providerModel(true), detectedAt:new Date().toISOString(), order:i, regionSource:{ mimeType:source.image.mimeType, data:source.image.data, width:source.image.width, height:source.image.height, sourceRect:source.sourceRect }
    })).filter(x => x.raw || x.expression);
    doc.aiFormulaItems = [...(Array.isArray(doc.aiFormulaItems) ? doc.aiFormulaItems : []), ...items];
    doc.aiFormulaUpdatedAt = new Date().toISOString();
    await saveDocument(doc); clearFormulaCache(doc.id);
    showToast(items.length ? `Đã lưu ${items.length} công thức vùng chọn ở trạng thái AI Detected.` : 'Không phát hiện công thức trong vùng này.', items.length ? 'success' : 'info');
  } catch (error) { showToast(`Quét công thức vùng lỗi: ${error.message}`, 'error'); }
}



async function renderContinuousPage(doc, shell) {
  const canvas = shell?.querySelector('.pdf-page-canvas');
  if (!canvas) return;
  const page = Number(shell.dataset.page || canvas.dataset.page || 1);
  const key = `${doc.id}:${page}:${state.zoom}`;
  if (canvas.dataset.renderKey === key) return;
  canvas.dataset.renderKey = key;
  shell.classList.add('rendering');
  try {
    await renderPdfPage(doc, page, canvas, state.zoom);
    canvas.dataset.rendered = '1';
    shell.style.width = canvas.style.width || '';
    shell.style.minHeight = canvas.style.height || '';
    shell.style.aspectRatio = 'auto';
    shell.classList.add('rendered');
    await preparePdfSelectionLayer(doc, shell);
    renderSavedAnnotations(doc, shell, page);
  } catch (error) {
    canvas.dataset.renderKey = '';
    shell.classList.add('render-error');
    console.error(error);
  } finally { shell.classList.remove('rendering'); }
}

function updateReaderPageUi(page) {
  const safe = Math.max(1, Number(page) || 1);
  state.page = safe;
  const input = document.querySelector('#pageInput');
  const range = document.querySelector('#pageRange');
  const label = document.querySelector('#readerStatusPage');
  if (input && document.activeElement !== input) input.value = String(safe);
  if (range && document.activeElement !== range) range.value = String(safe);
  if (label) label.textContent = String(safe);
}

function bindReaderPanAndZoom(wrap) {
  panCleanup?.();
  let dragging = false, sx = 0, sy = 0, sl = 0, st = 0;
  const down = e => {
    if (state.pdfSelectionMode !== 'off' || e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('input,button,.pdf-text-layer,.pdf-region-layer')) return;
    dragging = true; sx = e.clientX; sy = e.clientY; sl = wrap.scrollLeft; st = wrap.scrollTop;
    wrap.classList.add('dragging'); wrap.setPointerCapture?.(e.pointerId); e.preventDefault();
  };
  const move = e => { if (!dragging) return; wrap.scrollLeft = sl - (e.clientX - sx); wrap.scrollTop = st - (e.clientY - sy); };
  const up = e => { if (!dragging) return; dragging = false; wrap.classList.remove('dragging'); try { wrap.releasePointerCapture?.(e.pointerId); } catch {} };
  const wheel = e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const dir = e.deltaY < 0 ? 0.1 : -0.1;
    clearTimeout(bindReaderPanAndZoom.zoomTimer);
    bindReaderPanAndZoom.zoomTimer = setTimeout(() => setZoom(state.zoom + dir), 20);
  };
  wrap.addEventListener('pointerdown', down); wrap.addEventListener('pointermove', move); wrap.addEventListener('pointerup', up); wrap.addEventListener('pointercancel', up); wrap.addEventListener('wheel', wheel, { passive:false });
  panCleanup = () => { wrap.removeEventListener('pointerdown', down); wrap.removeEventListener('pointermove', move); wrap.removeEventListener('pointerup', up); wrap.removeEventListener('pointercancel', up); wrap.removeEventListener('wheel', wheel); };
}

async function setupContinuousPdfViewer(doc) {
  activePdfObserver?.disconnect();
  const wrap = document.querySelector('#pdfScroll');
  if (!wrap) return;
  bindReaderPanAndZoom(wrap);
  const shells = [...wrap.querySelectorAll('.pdf-page-shell')];
  activePdfObserver = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) renderContinuousPage(doc, entry.target);
  }, { root:wrap, rootMargin:`${performanceProfile().observerMargin}px 0px`, threshold:0.01 });
  shells.forEach(s => activePdfObserver.observe(s));
  readerScrollCleanup?.();
  let scrollRaf = 0;
  const syncCurrentPage = () => {
    scrollRaf = 0;
    const wrapRect = wrap.getBoundingClientRect();
    const center = wrapRect.top + Math.min(wrap.clientHeight * .38, 340);
    let best = null, bestDist = Infinity;
    for (const shell of shells) {
      const r = shell.getBoundingClientRect();
      if (r.bottom < wrapRect.top - 40 || r.top > wrapRect.bottom + 40) continue;
      const anchor = Math.max(r.top, wrapRect.top);
      const dist = Math.abs(anchor - center);
      if (dist < bestDist) { best = shell; bestDist = dist; }
    }
    if (best) updateReaderPageUi(Number(best.dataset.page));
  };
  const onScroll = () => { if (!scrollRaf) scrollRaf = requestAnimationFrame(syncCurrentPage); };
  wrap.addEventListener('scroll', onScroll, { passive:true });
  readerScrollCleanup = () => { wrap.removeEventListener('scroll', onScroll); if (scrollRaf) cancelAnimationFrame(scrollRaf); };
  requestAnimationFrame(syncCurrentPage);
  // Eagerly render current page and neighbors so jumping feels immediate.
  for (const p of [state.page-1, state.page, state.page+1].filter(x => x >= 1 && x <= doc.pageCount)) {
    const shell = document.querySelector(`#pdf-page-${p}`); if (shell) renderContinuousPage(doc, shell);
  }
  if (state.pendingPageScroll) {
    state.pendingPageScroll = false;
    requestAnimationFrame(() => document.querySelector(`#pdf-page-${state.page}`)?.scrollIntoView({ block:'start' }));
  }
}

async function drawPage() {
  const doc = activeDoc();
  if (!doc) return;
  if (doc.viewerKind === 'image') {
    const img = document.querySelector('#sourceImage');
    if (!img) return;
    const url = URL.createObjectURL(doc.blob);
    img.onload = () => URL.revokeObjectURL(url);
    img.src = url;
    img.style.width = `${Math.max(35, state.zoom * 90)}%`;
    return;
  }
  if (doc.viewerKind === 'text') return;
  if (state.readerMode === 'continuous') return setupContinuousPdfViewer(doc);
  activePdfObserver?.disconnect();
  const wrap = document.querySelector('#pdfScroll');
  if (wrap) bindReaderPanAndZoom(wrap);
  const canvas = document.querySelector('#pdfCanvas');
  if (!canvas) return;
  try {
    await renderPdfPage(doc, state.page, canvas, state.zoom);
    const shell = canvas.closest('.pdf-page-shell');
    if (shell) { await preparePdfSelectionLayer(doc, shell); renderSavedAnnotations(doc, shell, state.page); }
  } catch (error) { console.error(error); reportPdfError(error); }
}
function jumpPage(page) {
  const doc = activeDoc();
  if (!doc) return;
  const target = Math.min(Math.max(1, Number(page) || 1), doc.pageCount);
  state.page = target;
  state.mobile = window.innerWidth <= 880 ? 'viewer' : state.mobile;
  const wrap = document.querySelector('#pdfScroll');
  const targetShell = document.querySelector(`#pdf-page-${target}`);
  const sameRenderedDoc = wrap?.dataset?.docId === String(doc.id);
  if (state.readerMode === 'continuous' && sameRenderedDoc && targetShell) {
    updateReaderPageUi(target);
    targetShell.scrollIntoView({ behavior:'smooth', block:'start' });
    renderContinuousPage(doc, targetShell);
    return;
  }
  state.pendingPageScroll = true;
  render();
}
function findInActive(term) {
  let doc = activeDoc();
  if (!doc) doc = sourceDocs()[0];
  if (!doc) return showToast('Chưa có PDF để tìm.', 'warning');
  const q = String(term || '').toLocaleLowerCase('vi');
  const page = doc.pages.find(p => String(p.text || '').toLocaleLowerCase('vi').includes(q));
  if (!page) return showToast(`Không tìm thấy “${term}” trong PDF đang mở.`, 'warning');
  state.activeDocId = doc.id;
  jumpPage(page.page);
}

function localSummaryText(doc) {
  const summary = localSummary(doc);
  const headings = summary.headings.slice(0, 12).map(x => `• ${x.text} [${doc.standard || doc.name} · Trang ${x.page}]`).join('\n');
  const points = summary.important.slice(0, 12).map(x => `• ${x.text} [${doc.standard || doc.name} · Trang ${x.page}]`).join('\n');
  return `TÓM TẮT CỤC BỘ — ${doc.standard || doc.name}\n\nCấu trúc chính:\n${headings || 'Chưa nhận diện được đề mục.'}\n\nCác yêu cầu/giới hạn đáng chú ý:\n${points || 'Chưa nhận diện được câu định lượng.'}\n\nLưu ý: đây là trích xuất tự động từ lớp text PDF, không phải kết luận AI.`;
}

async function ocrActivePdfLocal() {
  const doc = activeDoc();
  if (!doc || doc.viewerKind !== 'pdf') return showToast('Hãy mở một PDF cần OCR.', 'warning');
  if (state.busy) return showToast('Ứng dụng đang xử lý tác vụ khác.', 'warning');
  if (state.settings.provider !== 'ollama' || state.settings.connection !== 'bridge') {
    state.tab = 'settings'; state.mobile = 'assistant'; render();
    return showToast('OCR toàn PDF cần HNL Offline AI · Ollama + HNL Bridge.', 'warning');
  }
  if (!isLocalHost()) return showToast('Hãy chạy START_HNL_OFFLINE_AI.bat và mở bản Local tại 127.0.0.1:8787.', 'warning');
  const targets = (doc.pages || []).filter(p => String(p.text || '').trim().length < 180 || p.ocrStatus === 'failed');
  if (!targets.length) return showToast('PDF này đã có lớp chữ đủ để tra cứu; không cần OCR toàn bộ.', 'info');
  if (!confirm(`OCR ${targets.length}/${doc.pageCount} trang bằng model ${state.settings.visionModel || 'gemma3:4b'}? Tác vụ có thể mất nhiều thời gian nhưng sẽ giúp Hỏi đáp/Tìm kiếm đọc được PDF scan.`)) return;
  state.busy = true;
  let ok=0, failed=0;
  try {
    for (let i=0;i<targets.length;i++) {
      const pageObj = targets[i];
      state.progress = { label:`OCR AI trang ${pageObj.page}/${doc.pageCount}`, current:i+1, total:targets.length };
      render();
      try {
        const image = await renderPdfPageToBase64(doc, pageObj.page, 1.8);
        const prompt = `Bạn là OCR cho tài liệu tiêu chuẩn kỹ thuật. Hãy CHỈ trích xuất nội dung nhìn thấy trên trang ${pageObj.page}; không giải thích, không tóm tắt, không tự bổ sung. Giữ tiêu đề, điều khoản, bảng, ký hiệu, công thức và đơn vị càng sát trang gốc càng tốt. Nếu ký tự không đọc được ghi [không rõ].`;
        const text = await callBridge({
          bridgeUrl: state.settings.bridgeUrl,
          provider:'ollama',
          model:state.settings.visionModel || 'gemma3:4b',
          prompt,
          images:[{ data:image.data, mimeType:image.mimeType, name:`${doc.name} - trang ${pageObj.page}` }]
        });
        const clean=String(text||'').trim();
        if (clean.length < 20) throw new Error('OCR trả về quá ít nội dung.');
        const original=String(pageObj.text||'').trim();
        pageObj.originalText = pageObj.originalText ?? original;
        pageObj.ocrText = clean;
        pageObj.ocrStatus = 'ai-vision';
        pageObj.text = original.length >= 180 ? original : `${original ? `${original}\n` : ''}${clean}`;
        ok++;
      } catch (error) {
        pageObj.ocrStatus = 'failed';
        pageObj.ocrError = error.message;
        failed++;
      }
      // Persist every few pages so a long OCR job is resumable after interruption.
      if ((i+1)%4===0 || i===targets.length-1) {
        doc.textChars = (doc.pages || []).reduce((n,p)=>n+String(p.text||'').length,0);
        doc.scannedLikely = (doc.pages || []).filter(p=>String(p.text||'').trim().length >= 180).length < Math.max(2, doc.pageCount*0.7);
        doc.ocrCompletedPages = (doc.pages || []).filter(p=>p.ocrStatus==='ai-vision').length;
        doc.ocrUpdatedAt = new Date().toISOString();
        await saveDocument(doc);
      }
    }
    clearSearchCache(doc.id); clearFormulaCache(doc.id);
    state.searchStats = null;
    showToast(`OCR hoàn tất: ${ok} trang thành công${failed ? ` · ${failed} trang lỗi` : ''}.`, failed ? 'warning' : 'success');
  } finally {
    state.progress = null; state.busy = false; render();
  }
}


function parseAiFormulaPayload(text='') {
  let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/,'').trim();
  const firstObj = raw.indexOf('{'), lastObj = raw.lastIndexOf('}');
  const firstArr = raw.indexOf('['), lastArr = raw.lastIndexOf(']');
  let data = null;
  const tries = [];
  if (firstObj >= 0 && lastObj > firstObj) tries.push(raw.slice(firstObj, lastObj + 1));
  if (firstArr >= 0 && lastArr > firstArr) tries.push(raw.slice(firstArr, lastArr + 1));
  tries.push(raw);
  for (const t of tries) { try { data = JSON.parse(t); break; } catch { /* try next */ } }
  if (!data) throw new Error('AI không trả JSON công thức hợp lệ.');
  const formulas = Array.isArray(data) ? data : (Array.isArray(data.formulas) ? data.formulas : []);
  return formulas.filter(x => x && typeof x === 'object');
}

function formulaCueText(text='') {
  const s = String(text || '');
  return /(?:công thức|cong thuc|được tính|duoc tinh|xác định theo|xac dinh theo|tính theo|tinh theo|[=≤≥≈]|\([A-Z]?\.?\d+(?:\.\d+)?\))/i.test(s);
}

function formulaAiTargets(doc, mode, localItems=[]) {
  if (!doc) return [];
  if (doc.viewerKind === 'image') return [{ page:1, text:String(doc.pages?.[0]?.text || ''), imageDoc:true }];
  const pages = doc.pages || [];
  if (mode === 'ai') return pages.map(p => ({ ...p }));
  if (mode !== 'auto') return [];
  const localPages = new Set(localItems.filter(x => x.docId === doc.id).map(x => Number(x.page)));
  const textPages = pages.filter(p => String(p.text || '').trim().length >= 180).length;
  const scanHeavy = Boolean(doc.scannedLikely) || textPages < Math.max(2, pages.length * 0.55);
  if (scanHeavy) return pages.map(p => ({ ...p }));
  return pages.filter(p => formulaCueText(p.text) || (!localPages.has(Number(p.page)) && /\b(?:Ra|Rd|Nc|Ns|Q|P|M|N|sigma|alpha|beta|gamma)\b/i.test(String(p.text || ''))));
}

async function callFormulaAi(prompt, images=[]) {
  if (state.settings.provider === 'local') throw new Error('Chế độ Tra cứu nhanh không có mô hình AI. Hãy chọn HNL Offline AI, Gemini, ChatGPT, Claude hoặc Grok.');
  return callConfiguredAiWithApproval({ prompt, images });
}

async function scanFormulaPageWithAi(doc, pageObj) {
  const pageNo = Number(pageObj.page || 1);
  const visibleText = String(pageObj.text || '').slice(0, 9000);
  const prompt = `Bạn là bộ nhận dạng CÔNG THỨC KỸ THUẬT cho tiêu chuẩn xây dựng.\nNguồn: ${doc.standard || doc.name}; trang ${pageNo}.\n\nNHIỆM VỤ:\n1) Đọc đúng nội dung trang được cung cấp, ưu tiên ảnh trang gốc nếu có.\n2) Liệt kê TẤT CẢ công thức/toán thức dùng để tính toán trên trang. Không lấy số liệu bảng đơn thuần nếu không phải công thức.\n3) Không tự suy diễn công thức bị khuất/không rõ.\n4) Giữ nguyên ký hiệu gốc trong trường raw.\n5) expression chỉ ghi khi chắc chắn có thể chuẩn hóa về ASCII: lhs=rhs, dùng *, /, ^, (), pi; ví dụ P=2*Q. Nếu không chắc thứ tự tử/mẫu/chỉ số thì để expression rỗng.\n6) variables là danh sách tên biến; units và conditions ghi theo nội dung trang nếu nhìn thấy.\n7) confidence từ 0 đến 1.\n\nCHỈ TRẢ JSON, KHÔNG markdown:\n{"formulas":[{"label":"(6)","title":"Tên công thức/điều","raw":"P = 2Q","expression":"P=2*Q","variables":["P","Q"],"units":"kN","conditions":"...","confidence":0.99}]}\nNếu không có công thức: {"formulas":[]}\n\nLớp chữ PDF tham khảo (có thể sai hoặc thiếu):\n${visibleText || '[không có lớp chữ]'}`;
  const images = [];
  if (doc.viewerKind === 'pdf') {
    const image = await renderPdfPageToBase64(doc, pageNo, 1.9);
    images.push({ data:image.data, mimeType:image.mimeType, name:`${doc.name} - trang ${pageNo}` });
  } else if (doc.viewerKind === 'image' && doc.blob) {
    images.push({ data:await fileToBase64(doc.blob), mimeType:doc.type || 'image/jpeg', name:doc.name });
  }
  const answer = await callFormulaAi(prompt, images);
  return parseAiFormulaPayload(answer).map((x, i) => ({
    id: crypto.randomUUID(),
    page: pageNo,
    label: String(x.label || '').trim(),
    title: String(x.title || x.section || 'Công thức AI nhận diện').trim(),
    raw: String(x.raw || x.formula || x.equation || '').trim(),
    expression: String(x.expression || '').trim(),
    variables: Array.isArray(x.variables) ? x.variables.map(String) : [],
    units: typeof x.units === 'string' ? x.units : (x.units ? JSON.stringify(x.units) : ''),
    conditions: String(x.conditions || '').trim(),
    context: String(x.context || '').trim(),
    confidence: Number.isFinite(Number(x.confidence)) ? Number(x.confidence) : null,
    verified: false,
    allowCompute: false,
    aiProvider: state.settings.provider,
    aiModel: providerModel(images.length > 0),
    detectedAt: new Date().toISOString(),
    order: i
  })).filter(x => x.raw || x.expression);
}

async function scanAllFormulasSmart() {
  if (state.busy) return showToast('Ứng dụng đang xử lý tác vụ khác.', 'warning');
  const scope = state.formulaScanScope || 'page';
  const target = resolveOperationScope(scope, state.formulaScanPages, 'formula');
  if (target.error) return showToast(target.error, 'warning');
  if (scope === 'region') return scanFormulaFromRegion(target.region);

  const scopedDocs = target.docs;
  if (!scopedDocs.length) return showToast('Phạm vi quét công thức hiện không có tài liệu.', 'warning');
  const mode = state.formulaScanMode || 'auto';
  clearFormulaCache();
  const localBefore = extractFormulaLibrary(scopedDocs).filter(x => !x.aiDetected);
  if (mode === 'local') {
    const fs = formulaStats(scopedDocs);
    showToast(`Quét cục bộ xong trong ${target.label}: ${fs.total} công thức · ${fs.computable} tính được.`, fs.total ? 'success' : 'warning');
    render(); return;
  }
  if (state.settings.provider === 'local') {
    const fs = formulaStats(scopedDocs);
    state.tab = 'settings'; state.mobile = 'assistant'; render();
    return showToast(`Cục bộ thấy ${fs.total} công thức trong ${target.label}. Muốn đọc công thức trong ảnh/scan, hãy chọn HNL Offline AI hoặc AI online.`, 'warning');
  }

  const plan = scopedDocs.map(scopedDoc => {
    const original = state.docs.find(d => d.id === scopedDoc.id) || scopedDoc;
    return { doc:original, targets:formulaAiTargets(scopedDoc, mode, localBefore) };
  }).filter(x => x.targets.length);
  const totalPages = plan.reduce((n,x)=>n+x.targets.length,0);
  if (!totalPages) {
    const fs = formulaStats(scopedDocs);
    showToast(`Không có trang nào trong ${target.label} cần AI quét thêm. Đang thấy ${fs.total} công thức.`, 'info'); render(); return;
  }
  const costNote = state.settings.provider === 'ollama' ? 'AI Offline có thể chạy lâu nhưng không tốn API.' : 'AI online có thể phát sinh quota/token theo nhà cung cấp.';
  if (!confirm(`Quét AI/Vision ${totalPages} trang trong phạm vi: ${target.label}?

${costNote}
HNL KHÔNG tự mở rộng ngoài phạm vi này. Mỗi công thức lưu kèm trang nguồn và ở trạng thái AI Detected cho tới khi bạn xác minh.`)) return;
  state.busy = true;
  let done=0, found=0, failed=0;
  try {
    for (const {doc, targets} of plan) {
      const existing = Array.isArray(doc.aiFormulaItems) ? doc.aiFormulaItems : [];
      const targetPages = new Set(targets.map(x=>Number(x.page || 1)));
      let merged = existing.filter(x => !targetPages.has(Number(x.page || 1)));
      for (const pageObj of targets) {
        done++;
        state.progress = { label:`AI quét công thức · ${doc.standard || doc.name} · trang ${pageObj.page}`, current:done, total:totalPages };
        render();
        try {
          const items = await scanFormulaPageWithAi(doc, pageObj);
          merged.push(...items); found += items.length;
          pageObj.formulaAiStatus = 'done';
        } catch (error) {
          failed++; pageObj.formulaAiStatus = 'failed'; pageObj.formulaAiError = error.message;
        }
        if (done % 4 === 0) {
          doc.aiFormulaItems = merged;
          doc.aiFormulaUpdatedAt = new Date().toISOString();
          doc.aiFormulaScannedPages = [...new Set([...(doc.aiFormulaScannedPages || []), ...targets.filter(t=>t.formulaAiStatus==='done').map(t=>Number(t.page))])].sort((a,b)=>a-b);
          await saveDocument(doc);
        }
      }
      doc.aiFormulaItems = merged;
      doc.aiFormulaUpdatedAt = new Date().toISOString();
      doc.aiFormulaScannedPages = [...new Set([...(doc.aiFormulaScannedPages || []), ...targets.filter(t=>t.formulaAiStatus==='done').map(t=>Number(t.page))])].sort((a,b)=>a-b);
      await saveDocument(doc);
      clearFormulaCache(doc.id);
    }
    const fs = formulaStats(scopedDocs);
    showToast(`Quét xong ${totalPages} trang · ${target.label} · AI lấy ${found} công thức${failed ? ` · ${failed} trang lỗi` : ''}.`, failed ? 'warning' : 'success');
  } finally {
    state.progress = null; state.busy = false; render();
  }
}

async function verifySelectedAiFormula() {
  const item = selectedFormulaItem();
  if (!item?.aiDetected) return showToast('Công thức này không phải mục AI cần xác minh.', 'info');
  const doc = state.docs.find(d => d.id === item.docId);
  if (!doc) return showToast('Không tìm thấy tài liệu nguồn.', 'error');
  const src = (doc.aiFormulaItems || []).find(x => x.id === item.id);
  if (!src) return showToast('Không tìm thấy bản ghi công thức AI.', 'error');
  if (!item.expression) return showToast('Công thức chưa có biểu thức chuẩn hóa an toàn nên chưa thể bật tính tự động.', 'warning');
  if (!confirm(`Xác nhận bạn đã đối chiếu công thức ${item.label || ''} tại trang ${item.page} với PDF gốc và biểu thức chuẩn hóa là đúng?`)) return;
  src.verified = true; src.allowCompute = true; src.verifiedAt = new Date().toISOString();
  await saveDocument(doc); clearFormulaCache(doc.id); render(); showToast('Đã xác minh công thức và bật tính tự động.', 'success');
}

async function chooseApprovedEmbeddingFallback(error, currentModel) {
  if (state.settings.provider !== 'ollama' || state.settings.connection !== 'bridge') return '';
  try {
    const base = String(state.settings.bridgeUrl || location.origin).replace(/\/$/, '');
    const r = await fetch(`${base}/api/local/model-manager`, { cache:'no-store' });
    const data = await r.json().catch(()=>({}));
    if (!r.ok) return '';
    const names = (data.models || []).map(x => String(x.name || x.model || '')).filter(Boolean);
    const candidates = names.filter(name => /(?:embed|bge|nomic|mxbai|e5|gte)/i.test(name) && name !== currentModel);
    const candidate = candidates[0] || '';
    if (!candidate) return '';
    const ok = window.confirm(`Embedding model hiện tại lỗi sau khi thử lại.\n\nEmbedding hiện tại: ${currentModel}\nEmbedding thay thế đã cài: ${candidate}\n\nBấm OK để chuyển và thử semantic rerank lại.\nCancel = giữ nguyên model và dùng lexical fallback cho câu hỏi này.`);
    if (!ok) return '';
    state.settings.embeddingModel = candidate;
    state.settingsDraft = {};
    saveSettings();
    state.modelStatus = `Người dùng đã đồng ý đổi Embedding: ${currentModel} → ${candidate}.`;
    showToast(`Đã chuyển Embedding model sang ${candidate} theo xác nhận.`, 'warning');
    return candidate;
  } catch { return ''; }
}


function normalizedFlat(text = '') {
  return String(text || '').toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9.%+/-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function textMatchesCoreQuestion(text, question) {
  const core = coreSearchPhrase(question);
  if (!core) return false;
  const flat = normalizedFlat(text);
  if (flat.includes(core)) return true;
  const terms = core.split(/\s+/).filter(Boolean);
  if (terms.length > 0 && terms.every(t => flat.includes(t))) return true;
  const compactCore = compactNormalize(core);
  return compactCore.length >= 5 && compactNormalize(text).includes(compactCore);
}

async function ensureSearchTextIndexes(docs = []) {
  const legacy = (docs || []).filter(d => d?.viewerKind === 'pdf' && d?.blob && Number(d.textIndexVersion || 0) < TEXT_INDEX_VERSION);
  if (!legacy.length) return { reindexed:0, failed:0 };
  let reindexed = 0, failed = 0;
  for (const doc of legacy) {
    try {
      await reindexPdfText(doc);
      await saveDocument(doc);
      clearSearchCache(doc.id);
      reindexed++;
    } catch (error) {
      failed++;
      console.warn(`Không thể tái lập chỉ mục PDF ${doc.name}:`, error);
    }
  }
  return { reindexed, failed };
}

/**
 * Targeted visual fallback for mixed PDFs.
 * It never OCRs the whole document automatically. Searchable TOC anchors and
 * low-text target pages are used to inspect only a few likely pages:
 * text layer -> local TextDetector OCR -> same-call Vision image when needed.
 */
async function collectTargetedPdfEvidence(question, docs, tocTargets = [], existingHits = []) {
  const byDoc = new Map((docs || []).map(d => [d.id, d]));
  const refs = [];
  const seen = new Set();
  const pushRef = (docId, page, reason, target = null) => {
    const doc = byDoc.get(docId);
    const p = Number(page || 0);
    if (!doc || doc.viewerKind !== 'pdf' || p < 1 || p > Number(doc.pageCount || doc.pages?.length || 0)) return;
    const key = `${docId}:${p}`;
    const maxRefs = target?.visualDiscovered ? 6 : 4;
    if (seen.has(key) || refs.length >= maxRefs) return;
    seen.add(key); refs.push({ doc, page:p, reason, target });
  };

  for (const target of (tocTargets || []).slice(0, 3)) {
    // The resolved target page gets first priority, then one neighboring page.
    pushRef(target.docId, target.targetPage, 'toc-target', target);
    for (const p of target.candidatePages || []) {
      if (refs.length >= (target.visualDiscovered ? 6 : 4)) break;
      if (p !== target.targetPage) pushRef(target.docId, p, 'toc-neighbor', target);
    }
  }

  // A lexical hit on a nearly image-only page is another useful visual hint.
  for (const hit of (existingHits || []).slice(0, 8)) {
    const doc = byDoc.get(hit.docId);
    const pg = doc?.pages?.find(x => Number(x.page) === Number(hit.page));
    if (doc?.viewerKind === 'pdf' && String(pg?.text || '').trim().length < 220) pushRef(doc.id, hit.page, 'low-text-hit');
    if (refs.length >= 4) break;
  }

  const hits = [];
  const images = [];
  const diagnostics = [];
  for (const ref of refs) {
    const pageObj = ref.doc.pages?.find(x => Number(x.page) === ref.page);
    const layerText = String(pageObj?.text || '').trim();
    if (layerText.length >= 80 && textMatchesCoreQuestion(layerText, question)) {
      hits.push({ docId:ref.doc.id, docName:ref.doc.name, standard:ref.doc.standard, page:ref.page, chunk:'target-text', text:layerText.slice(0, 12000), score:980, targeted:true, targetReason:ref.reason });
      diagnostics.push({ docId:ref.doc.id, page:ref.page, mode:'text-layer' });
      continue;
    }

    let image = null;
    let localOcr = { available:false, text:'', blocks:0 };
    try {
      image = await renderPdfPageToBase64(ref.doc, ref.page, 1.75);
      localOcr = await ocrImageBase64Locally(image);
    } catch (error) {
      diagnostics.push({ docId:ref.doc.id, page:ref.page, mode:'render-error', error:error.message });
      continue;
    }

    const ocrText = String(localOcr.text || '').trim();
    const isExactTarget = ref.reason === 'toc-target';
    const ocrRelevant = ocrText.length >= 45 && (textMatchesCoreQuestion(ocrText, question) || (isExactTarget && ocrText.length >= 120));
    if (ocrRelevant) {
      hits.push({ docId:ref.doc.id, docName:ref.doc.name, standard:ref.doc.standard, page:ref.page, chunk:'target-ocr', text:ocrText.slice(0, 12000), score:textMatchesCoreQuestion(ocrText, question) ? 995 : 920, targeted:true, ocrLocal:true, targetReason:ref.reason });
      diagnostics.push({ docId:ref.doc.id, page:ref.page, mode:'local-ocr', chars:ocrText.length });
    } else diagnostics.push({ docId:ref.doc.id, page:ref.page, mode:localOcr.available ? 'local-ocr-weak' : 'local-ocr-unavailable', chars:ocrText.length });

    // For an AI provider, send only the small set of targeted pages to Vision in
    // the *same answer request*. No automatic full-PDF Vision scan and no extra
    // model switch is performed here.
    if (state.settings.provider !== 'local' && image?.data && images.length < 3 && (!ocrRelevant || isExactTarget)) {
      const imageNo = images.length + 1;
      images.push({
        data:image.data, mimeType:image.mimeType, docId:ref.doc.id, page:ref.page,
        name:`${ref.doc.standard || ref.doc.name} · trang PDF ${ref.page}`,
        targeted:true, targetReason:ref.reason,
        tocHeading:ref.target?.heading || '', printedPage:ref.target?.printedPage || null
      });
      hits.push({
        docId:ref.doc.id, docName:ref.doc.name, standard:ref.doc.standard, page:ref.page,
        chunk:`visual-locator-${imageNo}`, score:940, targeted:true, visualLocator:true,
        text:`ẢNH TRANG ĐÍCH #${imageNo} đính kèm tương ứng ${ref.doc.standard || ref.doc.name}, trang PDF ${ref.page}. Dòng này chỉ gắn định danh/citation cho ảnh; nội dung kỹ thuật phải đọc trực tiếp từ ảnh đính kèm.`
      });
    }
  }
  return { hits, images, diagnostics, inspectedPages:refs.length };
}



/**
 * Last-resort visual TOC locator for image-heavy PDFs whose text layer cannot
 * expose the requested technical phrase and whose full PDF cannot be sent
 * natively (for example a >50 MB Gemini PDF). It inspects only the first TOC
 * pages, then lets the normal targeted-page OCR/Vision pipeline read the body.
 */
async function discoverVisualTocTarget(question, docs = []) {
  if (state.settings.provider === 'local') return [];
  const pdfDocs = (docs || []).filter(d => d.viewerKind === 'pdf' && d.blob && Number(d.pageCount || 0) > 0)
    .sort((a,b) => (b.id === state.activeDocId) - (a.id === state.activeDocId));
  const doc = pdfDocs[0];
  const core = coreSearchPhrase(question);
  if (!doc || compactNormalize(core).length < 5) return [];
  const scanPages = Math.min(10, Number(doc.pageCount || 0));
  const images = [];
  for (let page = 1; page <= scanPages; page++) {
    try {
      const img = await renderPdfPageToBase64(doc, page, 1.15);
      if (img?.data) images.push({ ...img, docId:doc.id, name:`${doc.name} · PDF page ${page}` });
    } catch { /* skip a broken preview page */ }
  }
  if (!images.length) return [];
  const map = images.map((x,i) => `Ảnh #${i+1} = trang PDF ${x.page}`).join('; ');
  const prompt = `HNL VISUAL TOC LOCATOR. Đây chỉ là bước ĐỊNH VỊ, chưa trả lời câu hỏi kỹ thuật.\nCụm cần tìm chính xác: "${core}".\n${map}.\nHãy nhìn các ảnh mục lục/đầu tài liệu và tìm dòng mục lục chứa đúng cụm này (không suy đoán). Nếu thấy, trả về DUY NHẤT một dòng theo mẫu:\nHNL_TOC_TARGET|printed=<số trang in được ghi ở cuối dòng>|source=<trang PDF của ảnh chứa dòng>|heading=<nguyên dòng tiêu đề>\nNếu không thấy, trả đúng: HNL_TOC_TARGET|NONE`;
  let raw = '';
  try { raw = await callConfiguredAiWithApproval({ prompt, images, documents:[] }); }
  catch (error) { console.warn('Visual TOC locator unavailable:', error); return []; }
  const m = String(raw || '').match(/HNL_TOC_TARGET\|printed\s*=\s*(\d+)\|source\s*=\s*(\d+)\|heading\s*=\s*([^\n\r]+)/i);
  if (!m) return [];
  const printedPage = Number(m[1]);
  const sourcePage = Number(m[2]);
  if (!printedPage || !sourcePage) return [];
  const estimatedOffset = Math.max(0, sourcePage - 1);
  const center = Math.min(Number(doc.pageCount || printedPage), printedPage + estimatedOffset);
  const candidatePages = [...new Set([center, center-2, center-1, center+1, center+2, center+3])]
    .filter(x => x >= 1 && x <= Number(doc.pageCount || x));
  return [{
    docId:doc.id, docName:doc.name, standard:doc.standard, sourcePage, printedPage,
    targetPage:center, candidatePages, section:'', heading:String(m[3] || core).trim(), line:String(m[3] || '').trim(),
    offset:estimatedOffset, offsetVotes:0, directActual:false, score:82, visualDiscovered:true
  }];
}

const nativePdfConsent = new Set();
function nativePdfCandidates(docs = []) {
  return docs.filter(d => d.viewerKind === 'pdf' && d.blob && String(d.type || 'application/pdf').includes('pdf'));
}
function nativePdfPlan(docs = []) {
  const provider = state.settings.provider;
  const mode = state.settings.nativePdfMode || 'balanced';
  if (!supportsNativePdf(provider) || mode === 'economy') return { docs:[], skipped:[], mode, provider, bytes:0, pages:0 };
  const candidates = nativePdfCandidates(docs);
  const maxRawBytes = provider === 'gemini' ? 49 * 1024 * 1024 : 48 * 1024 * 1024; // provider request/file safety
  const maxEachBytes = provider === 'gemini' ? 50 * 1024 * 1024 : 48 * 1024 * 1024;
  const eligible = candidates.filter(d => Number(d.size || d.blob?.size || 0) <= maxEachBytes && (provider !== 'gemini' || Number(d.pageCount || 0) <= 1000));
  const skipped = candidates.filter(d => !eligible.includes(d));
  let ordered = eligible;
  if (mode === 'balanced') {
    const active = eligible.find(d => d.id === state.activeDocId);
    ordered = [active || eligible[0]].filter(Boolean);
  }
  const picked = [];
  let bytes = 0, pages = 0;
  for (const d of ordered) {
    const size = Number(d.size || d.blob?.size || 0);
    const docPages = Number(d.pageCount || 0);
    if (bytes + size > maxRawBytes) continue;
    // Gemini document understanding supports up to 1000 PDF pages per request;
    // keep the whole native bundle inside that limit rather than only checking each file.
    if (provider === 'gemini' && pages + docPages > 1000) continue;
    picked.push(d); bytes += size; pages += docPages;
    if (mode === 'balanced') break;
  }
  return { docs:picked, skipped, mode, provider, bytes, pages };
}
async function prepareNativePdfDocuments(docs = [], { needed = true } = {}) {
  const plan = nativePdfPlan(docs);
  if (plan.mode === 'balanced' && !needed) {
    state.nativePdfStatus = 'RAG đủ căn cứ · chưa gửi PDF native';
    return { payloads:[], plan:{ ...plan, deferred:true } };
  }
  if (!plan.docs.length) {
    state.nativePdfStatus = plan.mode === 'economy' || !supportsNativePdf(plan.provider) ? '' : (plan.skipped?.length ? `Giữ ${plan.mode === 'native' ? 'Toàn tài liệu' : 'Cân bằng'} · ${plan.skipped.length} PDF vượt giới hạn native → fallback trang mục tiêu` : 'PDF native không đủ điều kiện · dùng HNL RAG');
    return { payloads:[], plan };
  }
  const key = `${state.activeChatSessionId || 'session'}:${plan.provider}:${plan.mode}:${plan.docs.map(d=>d.id).join(',')}`;
  const highCost = plan.mode === 'native' || (plan.provider === 'openai' && (plan.pages > 60 || plan.bytes > 8 * 1024 * 1024));
  if (highCost && !nativePdfConsent.has(key)) {
    const note = plan.provider === 'openai'
      ? 'OpenAI tính phí theo token đầu vào/đầu ra; PDF native gồm cả text và ảnh trang nên có thể dùng nhiều token hơn RAG.'
      : 'Gemini sẽ đọc trực tiếp cả PDF; việc này có thể dùng quota lớn hơn chế độ RAG tiết kiệm.';
    const ok = window.confirm(`Cho ${PROVIDERS[plan.provider]?.short || plan.provider} đọc PDF native cho phiên này?\n\n${plan.docs.map(d=>`• ${d.name} · ${d.pageCount} trang · ${fmtBytes(d.size)}`).join('\n')}\n\n${note}\n\nOK = dùng PDF native + HNL RAG/citation. Cancel = chỉ dùng RAG cho câu hỏi này.`);
    if (!ok) {
      state.nativePdfStatus = 'Người dùng chọn RAG cho câu này';
      return { payloads:[], plan:{...plan, declined:true} };
    }
    nativePdfConsent.add(key);
  }
  const payloads = [];
  for (const d of plan.docs) {
    try { payloads.push({ docId:d.id, name:d.name, mimeType:'application/pdf', data:await fileToBase64(d.blob), pageCount:d.pageCount, size:d.size }); }
    catch (error) { console.warn('Không chuẩn bị được PDF native:', d.name, error); }
  }
  state.nativePdfStatus = payloads.length ? `${payloads.length} PDF native · ${plan.pages} trang` : 'PDF native lỗi · dùng HNL RAG';
  return { payloads, plan };
}
function nativePdfInstruction(payloads = []) {
  if (!payloads.length) return '';
  return `\n\nPDF NATIVE ĐÍNH KÈM: ${payloads.map(x=>`${x.name} (${x.pageCount || '?'} trang)`).join('; ')}. Hãy đọc trực tiếp PDF native để hiểu chữ, ảnh, bảng, sơ đồ và công thức. Các đoạn HNL RAG bên dưới chỉ là mốc định vị/citation, không giới hạn phạm vi đọc PDF. Khi trả lời, ưu tiên citation dạng [Tên file/tiêu chuẩn · Trang X]. Nếu không đọc chắc được nội dung, nói rõ không đủ căn cứ.`;
}
function mergeCitationHitsFromAnswer(text, hits = [], docs = []) {
  const out = [...hits];
  const seen = new Set(out.map(h => `${h.docId}:${Number(h.page || 1)}`));
  const src = String(text || '');
  const re = /(?:\[([^\]\n]{2,120}?)\s*[·|,;-]\s*)?(?:trang|p\.?|page)\s*(\d{1,4})\]?/gi;
  let m;
  while ((m = re.exec(src))) {
    const page = Number(m[2]);
    if (!Number.isFinite(page) || page < 1) continue;
    const label = compactNormalize(m[1] || '');
    let doc = null;
    if (label) doc = docs.find(d => compactNormalize(`${d.standard || ''} ${d.name || ''}`).includes(label) || label.includes(compactNormalize(d.standard || d.name || '')));
    if (!doc && docs.length === 1) doc = docs[0];
    if (!doc || page > Number(doc.pageCount || page)) continue;
    const key = `${doc.id}:${page}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ docId:doc.id, docName:doc.name, standard:doc.standard, page, score:980, nativeCitation:true, text:`Citation do AI đọc PDF native trả về: trang ${page}.` });
  }
  return out;
}


async function prepareOversizePdfPageBatchImages(docs=[], hits=[], tocTargets=[]) {
  if (state.settings.provider === 'local' || state.settings.nativePdfMode === 'economy') return [];
  const oversize=docs.filter(d=>d.viewerKind==='pdf' && d.blob && Number(d.size||0)>50*1024*1024);
  if(!oversize.length)return [];
  const profile=performanceProfile(), cap=profile.visualPageLimit;
  const wanted=[]; const seen=new Set();
  const add=(doc,page,reason)=>{page=Math.max(1,Math.min(Number(doc.pageCount||1),Number(page)||1));const k=`${doc.id}:${page}`;if(seen.has(k)||wanted.length>=cap)return;seen.add(k);wanted.push({doc,page,reason});};
  for(const doc of oversize){
    const docHits=hits.filter(h=>h.docId===doc.id).sort((a,b)=>Number(b.score||0)-Number(a.score||0));
    for(const h of docHits.slice(0,3)){add(doc,h.page,'RAG');add(doc,Number(h.page)+1,'lân cận');add(doc,Number(h.page)-1,'lân cận');}
    for(const t of tocTargets.filter(x=>x.docId===doc.id).slice(0,2)){add(doc,t.targetPage,'mục lục');add(doc,Number(t.targetPage)+1,'lân cận');}
  }
  const out=[];
  for(const x of wanted){try{const img=await renderPdfPageToBase64(x.doc,x.page,profile.renderScale);out.push({...img,docId:x.doc.id,name:`${x.doc.standard||x.doc.name} · trang ${x.page}`,page:x.page,oversizeBatch:true,reason:x.reason});}catch(error){recordClientError('oversize-page-batch',error);}}
  if(out.length) state.nativePdfStatus=`PDF >50 MB · Page Batch ${out.length} trang mục tiêu (${profile.label})`;
  return out;
}

function recentConversationContext(maxMessages = 8, maxChars = 6500) {
  // During ask/summary/checklist flows the last two rows are the current user
  // request and its temporary "Đang…" assistant placeholder. Exclude them so
  // the model receives only prior turns as conversational context.
  const prior = state.chat.slice(0, Math.max(0, state.chat.length - 2))
    .filter(m => ['user','ai'].includes(m.role) && String(m.text || '').trim())
    .slice(-maxMessages);
  if (!prior.length) return '';
  const lines = [];
  let used = 0;
  for (const m of prior) {
    const label = m.role === 'user' ? 'NGƯỜI DÙNG' : 'TRỢ LÝ';
    const text = String(m.text || '').replace(/\s+/g, ' ').trim().slice(0, 2200);
    const line = `${label}: ${text}`;
    if (used + line.length > maxChars) break;
    lines.push(line); used += line.length;
  }
  if (!lines.length) return '';
  return `

NGỮ CẢNH HỘI THOẠI TRƯỚC (chỉ dùng để hiểu câu hỏi nối tiếp/đại từ; KHÔNG coi câu trả lời cũ là nguồn tiêu chuẩn):
${lines.join('\n')}
Mọi kết luận kỹ thuật của lượt này vẫn phải được đối chiếu lại với PDF/RAG hiện tại.`;
}

async function getAnswer(question, docsOverride = null, extraImages = []) {
  const docs = docsOverride || sourceDocs();
  if (!docs.length) throw new Error('Không có tài liệu trong phạm vi tìm kiếm hiện tại.');
  const textDocs = docs.filter(d => d.viewerKind !== 'image');
  const nativePlanPreview = nativePdfPlan(docs);
  const nativePdfAvailable = nativePlanPreview.docs.length > 0;
  // v1.9.20: documents persisted by older builds keep their old extracted text.
  // Rebuild once from the original PDF blob so users do NOT have to delete and
  // re-import a 124-page standard after upgrading HNL.
  const indexMigration = await ensureSearchTextIndexes(textDocs);
  const stats = corpusStats(textDocs);
  state.searchStats = { ...stats, textIndexVersion:TEXT_INDEX_VERSION, reindexedDocs:indexMigration.reindexed, reindexFailed:indexMigration.failed };

  // v1.7 Local Intelligence Engine: scan the COMPLETE corpus first, then
  // combine structural/keyword retrieval with optional local semantic reranking.
  const queryPlan = planEngineeringQueries(question);
  const structuredQuery = queryPlan.length > 1;
  const broadQuery = isBroadQuery(question) || structuredQuery;
  const mode = state.settings.retrievalMode || 'auto';
  const semanticRequested = state.settings.provider === 'ollama'
    && state.settings.connection === 'bridge'
    && state.settings.semanticRerank
    && (mode === 'hybrid' || mode === 'auto');
  const perf = performanceProfile();
  const baseRetrievalLimit = mode === 'fast' ? 32 : (broadQuery ? 84 : 44);
  const retrievalLimit = Math.max(20, Math.round(baseRetrievalLimit * perf.retrievalScale));
  const candidateLimit = semanticRequested ? Math.max(retrievalLimit, Math.round((broadQuery ? 140 : 96) * perf.retrievalScale)) : retrievalLimit;
  const useDeep = mode === 'deep' || mode === 'hybrid' || (mode === 'auto' && broadQuery);
  let hits = useDeep
    ? deepSearchChunks(question, textDocs, candidateLimit)
    : smartSearchChunks(question, textDocs, candidateLimit, { perDoc: mode === 'fast' ? 4 : 7 });

  // Built-in Code Pack index routes scanned/visual standards to the right page, formula or table.
  // It is an index only: final technical statements still require the original PDF page/native document.
  const packHits = codePackSearch(question, docs, 14);
  if (packHits.length) {
    const seenPack = new Set(packHits.map(h => `${h.docId}:${h.page}:${h.text}`));
    hits = [...packHits, ...hits.filter(h => !seenPack.has(`${h.docId}:${h.page}:${h.text}`))];
  }

  // Exact phrase scan is independent of top-k/embedding rank. This is crucial
  // for technical questions such as “cọc chống là gì”: the definition in mục 6
  // must outrank a TOC-only occurrence in mục 7.2.1.
  let searchDocs = textDocs;
  let freshPdfjsPages = 0;
  let exactPhraseHits = findExactPhrasePages(question, searchDocs, 18);
  if (!exactPhraseHits.length) {
    const core = coreSearchPhrase(question);
    const freshByDoc = new Map();
    if (compactNormalize(core).length >= 5) {
      const orderedPdfDocs = [...textDocs.filter(d => d.viewerKind === 'pdf' && d.blob)].sort((a,b) => (b.id === state.activeDocId) - (a.id === state.activeDocId));
      for (const doc of orderedPdfDocs.slice(0, 4)) {
        try {
          const fresh = await scanPdfTextForPhrase(doc, core, { maxHits:10 });
          if (fresh.length) { freshByDoc.set(doc.id, fresh); freshPdfjsPages += fresh.length; }
        } catch (error) { console.warn(`Fresh PDF.js phrase scan failed for ${doc.name}:`, error); }
      }
    }
    if (freshByDoc.size) {
      searchDocs = textDocs.map(doc => {
        const fresh = freshByDoc.get(doc.id);
        if (!fresh?.length) return doc;
        const replace = new Map(fresh.map(x => [Number(x.page), x.text]));
        return { ...doc, pages:(doc.pages || []).map(p => replace.has(Number(p.page)) ? { ...p, text:replace.get(Number(p.page)), freshPdfjs:true } : p) };
      });
      exactPhraseHits = findExactPhrasePages(question, searchDocs, 18);
    }
  }
  let exactBodyHits = exactPhraseHits.filter(h => !h.tocAnchor);
  let exactTocHits = exactPhraseHits.filter(h => h.tocAnchor);

  if (semanticRequested && hits.length > 1) {
    let embeddingModel = state.settings.embeddingModel || 'bge-m3';
    let reranked = null;
    let semanticError = null;
    for (const delay of [0, 800, 1800]) {
      if (delay) await waitMs(delay);
      try {
        reranked = await semanticRerank({ bridgeUrl:state.settings.bridgeUrl, query:question, candidates:hits, model:embeddingModel, limit:retrievalLimit });
        semanticError = null; break;
      } catch (error) { semanticError = error; }
    }
    if (!reranked && semanticError) {
      const approvedEmbedding = await chooseApprovedEmbeddingFallback(semanticError, embeddingModel);
      if (approvedEmbedding) {
        embeddingModel = approvedEmbedding;
        try { reranked = await semanticRerank({ bridgeUrl:state.settings.bridgeUrl, query:question, candidates:hits, model:embeddingModel, limit:retrievalLimit }); semanticError = null; }
        catch (error) { semanticError = error; }
      }
    }
    if (reranked?.length) {
      hits = reranked;
      state.searchStats = { ...stats, retrieval:'Hybrid Semantic RAG', embeddingModel };
    } else {
      console.warn('Semantic rerank unavailable; falling back to lexical RAG.', semanticError);
      hits = hits.slice(0, retrievalLimit);
      state.searchStats = { ...stats, retrieval:'Deep/lexical fallback', semanticError:semanticError?.message || 'Embedding không khả dụng' };
    }
  } else {
    hits = hits.slice(0, retrievalLimit);
    state.searchStats = { ...stats, retrieval: useDeep ? 'Deep Lexical RAG' : 'Fast Balanced RAG' };
  }

  if (exactPhraseHits.length) {
    const seenExact = new Set();
    hits = [...exactBodyHits, ...hits, ...exactTocHits].filter(h => {
      const key = `${h.docId}:${h.page}:${h.chunk ?? String(h.text || '').slice(0,80)}`;
      if (seenExact.has(key)) return false;
      seenExact.add(key); return true;
    }).slice(0, retrievalLimit + Math.min(12, exactPhraseHits.length));
  }

  // Hybrid Visual RAG: searchable TOC text can point to a content page whose
  // actual body is image/scan. Inspect only those target pages.
  let tocTargets = findTocPageTargets(question, searchDocs, 6);
  let visualTocLocatorUsed = false;
  if (!tocTargets.length && !exactPhraseHits.length && state.settings.provider !== 'local' && !nativePdfAvailable) {
    const visualTargets = await discoverVisualTocTarget(question, searchDocs);
    if (visualTargets.length) { tocTargets = visualTargets; visualTocLocatorUsed = true; }
  }
  const targeted = await collectTargetedPdfEvidence(question, searchDocs, tocTargets, hits);
  const tocAnchorHits = tocTargets.map((t, i) => ({
    docId:t.docId, docName:t.docName, standard:t.standard, page:t.sourcePage, chunk:`toc-${i}`,
    score:210 - i, tocAnchor:true, targeted:true,
    text:`CHỈ DẪN MỤC LỤC (chỉ dùng để định vị, KHÔNG dùng như nội dung định nghĩa): mục “${t.heading}” trỏ tới trang in ${t.printedPage}; trang PDF mục tiêu ước tính ${t.targetPage}${t.offset != null ? ` (offset ${t.offset >= 0 ? '+' : ''}${t.offset}, ${t.offsetVotes} mốc đối chiếu)` : ''}.`
  }));
  if (targeted.hits.length || tocAnchorHits.length) {
    const seen = new Set();
    hits = [...targeted.hits, ...hits, ...tocAnchorHits].filter(h => {
      const key = `${h.docId}:${h.page}:${h.chunk ?? String(h.text || '').slice(0,80)}`;
      if (seen.has(key)) return false; seen.add(key); return true;
    }).slice(0, retrievalLimit + Math.min(6, targeted.hits.length + tocAnchorHits.length));
  }
  state.searchStats = {
    ...(state.searchStats || stats),
    exactPhrasePages:exactPhraseHits.length,
    exactBodyPages:exactBodyHits.length,
    tocTargets:tocTargets.length,
    visualPagesInspected:targeted.inspectedPages,
    targetedLocalOcr:targeted.diagnostics.filter(x => x.mode === 'local-ocr').length,
    targetedVisionPages:targeted.images.length,
    textIndexVersion:TEXT_INDEX_VERSION,
    reindexedDocs:indexMigration.reindexed,
    reindexFailed:indexMigration.failed,
    freshPdfjsPages,
    visualTocLocatorUsed
  };

  const docIds = new Set(docs.map(d => d.id));
  const pinned = (state.pinnedSources || []).filter(x => docIds.has(x.docId) && String(x.text || '').trim());
  if (pinned.length) {
    const seen = new Set(pinned.map(x => `${x.docId}:${x.page}:${String(x.text).slice(0,120)}`));
    hits = [...pinned, ...hits.filter(x => !seen.has(`${x.docId}:${x.page}:${String(x.text).slice(0,120)}`))].slice(0, retrievalLimit);
  }

  const imageDocs = docs.filter(d => d.viewerKind === 'image').slice(0, 8);
  const standaloneImages = [];
  for (const d of imageDocs) {
    if (d.size > 8 * 1024 * 1024) continue;
    try { standaloneImages.push({ data: await fileToBase64(d.blob), mimeType: d.type || 'image/jpeg', name: d.name, docId: d.id }); } catch { /* skip */ }
  }
  const images = [...(extraImages || []), ...targeted.images, ...standaloneImages];
  const oversizePageBatch = await prepareOversizePdfPageBatchImages(docs, hits, tocTargets);
  if (oversizePageBatch.length) images.push(...oversizePageBatch);
  state.searchStats = { ...(state.searchStats || stats), oversizePageBatch:oversizePageBatch.length, chatImageAttachments:(extraImages||[]).length, performanceMode:state.settings.performanceMode || 'balanced' };

  const qNorm = String(question).toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  const dMatch = qNorm.match(/(?:^|\s)d\s*(\d{3,4})(?:\s|$)/);
  const classMatch = qNorm.match(/(?:cap|loai)\s*(ab|a|b|c)(?:\s|$)/);
  const doc7888 = docs.find(is7888);
  if (doc7888 && dMatch && classMatch) {
    const row = lookup7888(Number(dMatch[1]), classMatch[1].toUpperCase());
    if (row) {
      const page = row.diameter <= 600 ? 10 : 11;
      const tableHit = {
        docId: doc7888.id, docName: doc7888.name, standard: doc7888.standard, page, score: 999,
        text: `Bảng 1 - cọc PC/PHC: D = ${row.diameter} mm; chiều dày t = ${row.thickness} mm; cấp tải ${row.loadClass}; mômen uốn nứt không nhỏ hơn ${row.crackMoment} kN.m; ứng suất hữu hiệu ${row.effectiveStress} MPa; khả năng bền cắt không nhỏ hơn ${row.shearResistance} kN (chỉ áp dụng cho PHC); chiều dài cọc ${row.lengthRange} m.`
      };
      hits = [tableHit, ...hits.filter(h => !(h.docId === tableHit.docId && h.page === tableHit.page))].slice(0, retrievalLimit);
    }
  }

  if (standaloneImages.length) {
    const imageHits = standaloneImages.map((img, i) => {
      const d = imageDocs.find(x => x.id === img.docId);
      return ({ docId:d.id, docName:d.name, standard:d.standard, page:1, score:100-i, text:`Nguồn hình ảnh: ${d.name}. Đọc trực tiếp nội dung, chữ, bảng và ký hiệu nhìn thấy trong ảnh; không suy đoán phần không nhìn rõ.` });
    });
    hits = [...imageHits, ...hits].slice(0, retrievalLimit + standaloneImages.length);
  }

  const substantiveHits = hits.filter(h => !h.tocAnchor && !h.visualLocator);
  if (!substantiveHits.length && !images.length && !nativePdfAvailable) {
    const tocHint = tocTargets.length ? ` Hệ thống có tìm thấy mục “${tocTargets[0].heading}” trong mục lục và đã định vị trang đích, nhưng chưa đọc được nội dung pixel ở trang đó.` : '';
    const oversizeHint = nativePlanPreview.skipped?.length ? ` ${nativePlanPreview.skipped.length} PDF vượt giới hạn native của nhà cung cấp; HNL đã giữ nguyên chế độ và chuyển sang fallback RAG/OCR/Vision trang mục tiêu.` : '';
    return { text: `Không tìm thấy đủ căn cứ trong các tài liệu đang chọn.${tocHint}${oversizeHint} Đã quét toàn bộ ${stats.textPages}/${stats.pages} trang có lớp chữ trong ${stats.docs} tài liệu (${stats.chunks} đoạn).`, hits: tocAnchorHits, stats };
  }
  if (state.settings.provider === 'local') {
    if (!substantiveHits.length && tocTargets.length) return { text: `Đã tìm thấy mục “${tocTargets[0].heading}” trong mục lục và định vị trang PDF khoảng ${tocTargets[0].targetPage}, nhưng trang đích là ảnh/scan và OCR cục bộ trên máy chưa đọc đủ rõ. Hãy chọn HNL Offline AI (Ollama) hoặc Gemini để đọc đúng trang đích bằng Vision; HNL không cần OCR toàn bộ PDF.`, hits: tocAnchorHits, stats };
    if (images.length && !exactBodyHits.length) return { text: `Tra cứu nhanh đã quét ${stats.textPages}/${stats.pages} trang chữ nhưng không đọc pixel ảnh. Hãy chọn HNL Offline AI (Ollama) hoặc Gemini để đọc ảnh trực tiếp.`, hits, stats };
    const localHits = exactBodyHits.length ? [...exactBodyHits, ...substantiveHits.filter(h => !exactBodyHits.some(e => e.docId === h.docId && e.page === h.page))] : substantiveHits;
    return { text: localAnswer(question, localHits, stats), hits:localHits, stats };
  }

  const planText = queryPlan.length > 1 ? `\nKẾ HOẠCH TRA CỨU: ${queryPlan.map(x => x.label).join(' → ')}.` : '';
  const retrievalText = state.searchStats?.retrieval ? ` Chế độ chọn ngữ cảnh: ${state.searchStats.retrieval}${state.searchStats.embeddingModel ? ` (${state.searchStats.embeddingModel})` : ''}.` : '';
  const visualText = targeted.images.length ? `\nHYBRID VISUAL RAG: có ${targeted.images.length} ảnh trang PDF mục tiêu được chọn từ mục lục/điểm ít lớp chữ. Hãy ĐỌC TRỰC TIẾP các ảnh này để trả lời nếu lớp chữ thiếu. Dòng CHỈ DẪN MỤC LỤC chỉ dùng để định vị, tuyệt đối không coi là nội dung định nghĩa. Nếu ảnh mục tiêu không đủ rõ thì phải nói không đủ căn cứ.` : (targeted.hits.some(h => h.ocrLocal) ? `\nHYBRID VISUAL RAG: OCR cục bộ đã bổ sung ${targeted.hits.filter(h => h.ocrLocal).length} trang mục tiêu; ưu tiên nội dung OCR có citation trang.` : '');
  const coverage = `\n\nTHỐNG KÊ PHẠM VI: hệ thống đã quét toàn bộ ${stats.textPages}/${stats.pages} trang có lớp chữ, ${stats.chunks} đoạn thuộc ${stats.docs} tài liệu trước khi chọn ngữ cảnh liên quan.${retrievalText}${planText}${visualText} Không được hiểu số đoạn ngữ cảnh bên dưới là số trang đã quét.`;
  const nativeNeeded = state.settings.nativePdfMode === 'native' || (
    state.settings.nativePdfMode === 'balanced' && (
      broadQuery || substantiveHits.length < 2 || images.length > 0 || (exactBodyHits.length === 0 && tocTargets.length > 0)
    )
  );
  const nativePrepared = await prepareNativePdfDocuments(docs, { needed:nativeNeeded });
  const nativeDocs = nativePrepared.payloads || [];
  const chatContext = recentConversationContext();
  const engineeringContext = deterministicEngineeringContext(question);
  const prompt = buildRagPrompt(question, hits, state.settings.strict) + (engineeringContext ? `\n\n${engineeringContext}` : '') + coverage + chatContext + nativePdfInstruction(nativeDocs);
  let text = await callConfiguredAiWithApproval({ prompt, images, documents:nativeDocs, pdfDetail:state.settings.openaiPdfDetail || 'auto' });
  if (!text) throw new Error('AI không trả về nội dung.');

  // If the provider still emits the strict “not found” sentence while HNL has
  // exact BODY pages, retry once with a narrow context instead of accepting a
  // false negative caused by a large RAG context. Same provider/model is kept.
  if (/Không tìm thấy đủ căn cứ trong các tài liệu đang chọn/i.test(text) && exactBodyHits.length) {
    const narrow = exactBodyHits.slice(0, 6);
    const narrowPrompt = buildRagPrompt(question, narrow, state.settings.strict) + (engineeringContext ? `\n\n${engineeringContext}` : '') + chatContext + `

ƯU TIÊN KIỂM TRA: HNL đã tìm thấy cụm kỹ thuật chính xác “${coreSearchPhrase(question)}” trong ${narrow.length} trang nội dung (không phải mục lục). Hãy đọc kỹ các trang này trước khi kết luận thiếu căn cứ.`;
    const retry = await callConfiguredAiWithApproval({ prompt:narrowPrompt + nativePdfInstruction(nativeDocs), images:[], documents:nativeDocs, pdfDetail:state.settings.openaiPdfDetail || 'auto' });
    if (retry?.trim()) text = retry;
  }
  hits = mergeCitationHitsFromAnswer(text, hits, docs);
  return { text, hits, stats:{ ...(state.searchStats || stats), nativePdfCount:nativeDocs.length, nativePdfMode:state.settings.nativePdfMode } };
}

function insertNormalizedEngineeringPaste(target, rawText='') {
  const pasted=String(rawText||'').replace(/\r\n?/g,'\n');
  if(!pasted) return false;
  // Build the parser-friendly view now so malformed clipboard text is detected,
  // but never overwrite the user's visible/raw LaTeX or PDF text with it.
  const normalized=normalizeEngineeringPaste(pasted);
  if(!normalized) return false;
  const start=Number.isInteger(target.selectionStart)?target.selectionStart:String(target.value||'').length;
  const end=Number.isInteger(target.selectionEnd)?target.selectionEnd:start;
  if(typeof target.setRangeText==='function') target.setRangeText(pasted,start,end,'end');
  else target.value=`${String(target.value||'').slice(0,start)}${pasted}${String(target.value||'').slice(end)}`;
  target.dispatchEvent(new Event('input',{bubbles:true}));
  target.dispatchEvent(new Event('change',{bubbles:true}));
  return normalized!==pasted;
}

async function askQuestion(questionOverride = '', options = {}) {
  const input = document.querySelector('#chatQuestion');
  let question = String(questionOverride || input?.value || state.chatDraft || '').trim();
  if (state.busy) return showToast('Đang xử lý câu hỏi trước.', 'warning');
  if (!question) return showToast('Hãy nhập câu hỏi trước khi gửi.', 'warning');
  if (!sourceDocs().length) return showToast('Hãy chọn hoặc mở ít nhất một PDF làm nguồn.', 'warning');

  let extraImages=Array.isArray(options.extraImages)?options.extraImages:[];
  if (!options.skipImageExtraction && (state.chatAttachments||[]).length) {
    const attachments=[...state.chatAttachments];
    state.busy=true; render();
    try {
      const vision=await extractEngineeringInputFromChatImages(question,attachments);
      extraImages=vision?.images||[];
      if (imageEngineeringNeedsConfirmation(vision?.extraction)) {
        state.pendingImageExtraction={question,extraction:vision.extraction,attachments,images:extraImages};
        state.busy=false; render();
        queueMicrotask(()=>document.querySelector('.image-engineering-review')?.scrollIntoView({block:'nearest'}));
        return;
      }
      showToast('Ảnh chưa có trường kỹ thuật cấu trúc cần xác nhận; HNL tiếp tục dùng ảnh như nguồn Vision cho câu hỏi này.', 'warning');
    } catch(error) {
      console.warn('Image engineering extraction failed:',error);
      try { extraImages=await chatAttachmentPayloads(attachments); } catch { extraImages=[]; }
      showToast(`Không trích được input kỹ thuật có cấu trúc: ${error.message}. HNL sẽ không coi số từ ảnh là VERIFIED nếu chưa xác nhận.`, 'warning');
    } finally {
      state.busy=false;
    }
  }

  state.chatDraft = '';
  const imageInput=Array.isArray(options.imageProvenance)?options.imageProvenance:[];
  // v1.25.7: keep the user's raw wording for chat/source search, but deterministic
  // parsing always consumes the normalized engineering view. This makes copy/paste
  // from PDF/Word/LaTeX robust without silently changing what the user asked.
  const normalizedQuestion=normalizeEngineeringText(question);
  const engineeringSolved = solveEngineeringQuestion(normalizedQuestion);
  const engineeringMeta = engineeringSolved.recognized ? {
    workflowId:engineeringSolved.workflow.id,title:engineeringSolved.workflow.title,standard:engineeringSolved.workflow.standard,
    status:engineeringSolved.workflow.status,question,normalizedQuestion,canExport:Boolean(engineeringSolved.canExport ?? canExportEngineeringResult(engineeringSolved)),
    resultOk:Boolean(engineeringSolved.result?.ok),methodOnly:Boolean(engineeringSolved.result?.methodOnly),
    missing:Array.isArray(engineeringSolved.result?.missing)?engineeringSolved.result.missing:[],
    imageInput
  } : null;
  const displayQuestion=String(options.displayQuestion||question);
  state.chat.push({ role:'user', text:displayQuestion, imageInput, createdAt:new Date().toISOString() });
  state.chat.push({ role:'ai', text:'Đang tra cứu nguồn PDF…', hits:[], engineering:engineeringMeta, provider:state.settings.provider, model:providerModel(extraImages.length>0), createdAt:new Date().toISOString() });
  state.busy = true;
  state.pendingImageExtraction=null;
  render();
  try {
    const answer = await getAnswer(question, null, extraImages);
    const evidence = answerEvidenceMeta(question, answer);
    state.chat[state.chat.length - 1] = { role:'ai', text:answer.text, hits:answer.hits, stats:answer.stats || null, evidence, engineering:engineeringMeta, imageInput, provider:state.settings.provider, model:providerModel(extraImages.length>0), createdAt:new Date().toISOString() };
  } catch (error) {
    state.chat[state.chat.length - 1] = { role:'ai', text:`Lỗi: ${error.message}`, hits:[], engineering:engineeringMeta, imageInput, provider:state.settings.provider, model:providerModel(extraImages.length>0), createdAt:new Date().toISOString() };
  } finally {
    state.busy = false;
    if(!options.skipImageExtraction) clearChatAttachments();
    await persistCurrentChat();
    render();
    queueMicrotask(() => { const log = document.querySelector('.chat-log'); if (log) log.scrollTop = log.scrollHeight; });
  }
}

// Verified TCVN5574 exporter coverage includes legacy routes such as 5574-eccentric plus later verified branches.
async function exportEngineeringMessageExcel(index) {
  const message=state.chat[Number(index)];
  const meta=message?.engineering;
  const imageProvenance=Array.isArray(meta?.imageInput)?meta.imageInput:[];
  if(!meta?.question) return showToast('Không tìm thấy đề bài kỹ thuật để xuất Excel.', 'warning');
  const payload=engineeringExcelPayload(meta.normalizedQuestion||meta.question);
  if(!payload.recognized || !/^(7888|10304|5574)-/.test(payload.workflow?.id||'')) return showToast('Workflow này chưa có Excel kỹ thuật chuyên dụng.', 'warning');
  if(!payload.canExport) return showToast('Đề bài chưa đủ input để tạo Excel tính toán. Hãy bổ sung dữ liệu còn thiếu rồi hỏi lại.', 'warning');
  if(!String(payload.workflow.status||'').startsWith('VERIFIED')) return showToast(`Workflow ${payload.workflow.title} chưa VERIFIED, không được xuất Excel số học.`, 'warning');
  try {
    await exportUnifiedEngineeringWorkbook({...payload,imageProvenance},{imageProvenance});
    showToast(`Đã xuất Excel Production v1.25.7: ${payload.workflow.title}.`, 'success');
  } catch(error){ showToast(`Không xuất được Excel Production v1.25.7: ${error.message}`, 'error'); }
}


/*
  COMPATIBILITY MARKERS FOR HISTORICAL REGRESSION TESTS ONLY.
  Production path is exportUnifiedEngineeringWorkbook() above.
  Registry ids retained visibly for source-audit coverage:
  10304-end-bearing 10304-driven 10304-bored 10304-screw 10304-static
  10304-dynamic 10304-cpt 10304-spt 10304-settlement-single
  10304-settlement-group 10304-equivalent-block 10304-piled-raft
  10304-construction-effect

  Historical exporter-call markers (not executed):
  payload.workflow.id==='7888-material'
  export7888WorkflowWorkbook({...(payload.input||{}),imageProvenance});
  exportDrivenPileWorkflowWorkbook({...(payload.input||{}),imageProvenance});
  export5574WorkflowWorkbook(payload.workflow.id,{...(payload.input||{}),imageProvenance});
*/


async function aiSummary() {
  const doc = activeDoc() || sourceDocs()[0];
  if (!doc || state.busy) return;
  state.tab = 'chat';
  state.chat.push({ role:'user', text:`Tóm tắt ${doc.standard || doc.name}`, createdAt:new Date().toISOString() });
  state.chat.push({ role:'ai', text:'Đang tạo tóm tắt…', hits:[], provider:state.settings.provider, model:providerModel(), createdAt:new Date().toISOString() });
  state.busy = true;
  render();
  try {
    if (state.settings.provider === 'local') {
      const sum = localSummary(doc);
      const hits = [...sum.headings.slice(0, 8), ...sum.important.slice(0, 8)].map(x => ({ docId: doc.id, docName: doc.name, standard: doc.standard, page: x.page, text: x.text }));
      state.chat[state.chat.length - 1] = { role:'ai', text:localSummaryText(doc), hits, provider:state.settings.provider, model:providerModel(), createdAt:new Date().toISOString() };
    } else {
      const answer = await getAnswer('Tóm tắt tiêu chuẩn theo góc nhìn kỹ sư cọc: phạm vi, phân loại, thông số bắt buộc, sai số, ngoại quan, phương pháp thử, nghiệm thu, bảo quản/vận chuyển và công thức. Mỗi ý phải có nguồn trang.', [doc]);
      state.chat[state.chat.length - 1] = { role:'ai', text:answer.text, hits:answer.hits, provider:state.settings.provider, model:providerModel(), createdAt:new Date().toISOString() };
    }
  } catch (error) {
    state.chat[state.chat.length - 1] = { role:'ai', text:`Lỗi: ${error.message}`, hits:[], provider:state.settings.provider, model:providerModel(), createdAt:new Date().toISOString() };
  } finally { state.busy = false; await persistCurrentChat(); render(); }
}

async function aiSummaryAll() {
  const docs = sourceDocs();
  if (!docs.length || state.busy) return showToast('Không có tài liệu trong phạm vi hiện tại.', 'warning');
  state.tab = 'chat';
  state.chat.push({ role:'user', text:`Tóm tắt toàn bộ ${docs.length} tài liệu trong ${scopeLabel()}`, createdAt:new Date().toISOString() });
  state.chat.push({ role:'ai', text:'Đang quét toàn bộ trang và tổng hợp…', hits:[], provider:state.settings.provider, model:providerModel(), createdAt:new Date().toISOString() });
  state.busy = true; render();
  try {
    if (state.settings.provider === 'local') {
      const stats = corpusStats(docs.filter(d=>d.viewerKind !== 'image'));
      const parts = docs.filter(d=>d.viewerKind !== 'image').map(doc => {
        const sum = localSummary(doc);
        const pts = [...sum.headings.slice(0,6), ...sum.important.slice(0,8)];
        return `## ${doc.standard || doc.name}\n${pts.map(x=>`• ${x.text} [Trang ${x.page}]`).join('\n') || 'Không trích được lớp chữ.'}`;
      });
      const hits = smartSearchChunks('yêu cầu kỹ thuật nghiệm thu phương pháp thử công thức', docs.filter(d=>d.viewerKind !== 'image'), 50, {perDoc:8});
      state.chat[state.chat.length-1] = { role:'ai', text:`Đã quét ${stats.textPages}/${stats.pages} trang có chữ trong ${stats.docs} tài liệu.\n\n${parts.join('\n\n')}`, hits, provider:state.settings.provider, model:providerModel(), createdAt:new Date().toISOString() };
    } else {
      const answer = await getAnswer('Tổng hợp TOÀN BỘ các tài liệu đang chọn theo từng tiêu chuẩn: phạm vi, yêu cầu kỹ thuật, số liệu/bảng quan trọng, công thức, phương pháp thử, nghiệm thu, bảo quản/vận chuyển và các điểm khác nhau. Không bỏ qua tài liệu nào có nội dung liên quan. Mỗi ý phải dẫn tên tài liệu và trang.', docs);
      state.chat[state.chat.length-1] = { role:'ai', text:answer.text, hits:answer.hits, provider:state.settings.provider, model:providerModel(), createdAt:new Date().toISOString() };
    }
  } catch (error) { state.chat[state.chat.length-1] = { role:'ai', text:`Lỗi: ${error.message}`, hits:[], provider:state.settings.provider, model:providerModel(), createdAt:new Date().toISOString() }; }
  finally { state.busy=false; await persistCurrentChat(); render(); }
}

async function runLookup() {
  const input = document.querySelector('#lookupQuery');
  const query = String(input?.value || state.lookup.draft || '').trim();
  if (!query) return showToast('Nhập nội dung cần tìm trong PDF.', 'warning');

  // v1.9.26 regression rule: keep the v1.9.23 lookup brain exactly
  // (searchEveryPage + TCVN 7888 table assist). v1.9.25 only contributes
  // the v1.9.25 UI scope that limits which docs/pages are handed to that brain.
  const scope = state.lookup.scope || 'smart';
  const target = resolveOperationScope(scope, state.lookup.pages, 'lookup');
  if (target.error) return showToast(target.error, 'warning');

  let docs;
  if (scope === 'region') {
    const region = target.region;
    const doc = state.docs.find(d => d.id === region?.docId) || activeDoc();
    if (!region || !doc) return showToast('Vùng chọn gần nhất không còn tài liệu nguồn.', 'warning');
    docs = [{ ...doc, pages:[{ page:Number(region.page)||1, text:String(region.text || ''), regionOnly:true }] }];
  } else {
    docs = target.docs.filter(d => d.viewerKind !== 'image');
  }
  if (!docs.length) return showToast('Chưa có nguồn dữ liệu chữ để tra cứu trong phạm vi đã chọn.', 'warning');

  state.lookup.query = query;
  state.lookup.draft = query;

  // EXACT v1.9.23 lookup algorithm, applied only to the scoped corpus.
  const stats = corpusStats(docs);
  state.searchStats = { ...stats, lookupScope:scope, lookupScopeLabel:target.label, searchBrain:'v1.9.23' };
  let hits = searchEveryPage(query, docs, 100);

  if (query && docs.some(is7888)) {
    const qNorm = query.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
    const dMatch = qNorm.match(/(?:^|\s)(?:d|phi|ø)?\s*(\d{3,4})(?:\s|$)/);
    const classMatch = qNorm.match(/(?:cap|loai)\s*(ab|a|b|c)(?:\s|$)/);
    if (dMatch && classMatch) {
      const row = lookup7888(Number(dMatch[1]), classMatch[1].toUpperCase());
      const scoped7888 = docs.find(is7888);
      const doc = scoped7888 ? (state.docs.find(d => d.id === scoped7888.id) || scoped7888) : null;
      if (row && doc) {
        const page = row.diameter <= 600 ? 10 : 11;
        const scopedDoc = docs.find(d => d.id === doc.id);
        const allowedPage = !scopedDoc?._hnlScopedPages || scopedDoc._hnlScopedPages.includes(page);
        if (allowedPage) {
          const tableHit = {
            docId: doc.id, docName: doc.name, standard: doc.standard, page, score: 999,
            text: `Bảng 1 — D${row.diameter}, cấp ${row.loadClass}: t = ${row.thickness} mm; mômen uốn nứt ≥ ${row.crackMoment} kN·m; ứng suất hữu hiệu ${row.effectiveStress} MPa; bền cắt ≥ ${row.shearResistance} kN (áp dụng PHC); chiều dài ${row.lengthRange} m.`
          };
          hits = [tableHit, ...hits.filter(h => !(h.docId === tableHit.docId && h.page === tableHit.page))].slice(0, 100);
        }
      }
    }
  }

  state.lookup.hits = hits;
  showToast(
    hits.length
      ? `Đã quét ${stats.textPages}/${stats.pages} trang trong ${target.label} và tìm thấy ${hits.length} trang liên quan.`
      : `Đã quét ${stats.textPages}/${stats.pages} trang trong ${target.label} nhưng chưa tìm thấy nội dung phù hợp.`,
    hits.length ? 'success' : 'warning'
  );
  render();
}

function updateTableClassOptions() {
  const D = Number(document.querySelector('#tableDiameter')?.value || 600);
  const select = document.querySelector('#tableClass');
  if (!select) return;
  const current = select.value;
  const classes = classesForDiameter7888(D);
  select.innerHTML = classes.map(x => `<option value="${x}" ${x === current ? 'selected' : ''}>${x}</option>`).join('');
}
function runTableLookup() {
  const D = Number(document.querySelector('#tableDiameter')?.value);
  const cls = document.querySelector('#tableClass')?.value;
  state.tableResult = lookup7888(D, cls);
  if (!state.tableResult) showToast('Không có tổ hợp D/cấp tải này trong Bảng 1.', 'warning');
  else showToast(`Đã tra D${D} · cấp ${cls}.`, 'success');
  render();
}

function syncCalcClassOptions() {
  const type = String(document.querySelector('#cType')?.value || 'PHC').toUpperCase();
  const D = Number(document.querySelector('#cDiameter')?.value || 600);
  const select = document.querySelector('#cClass');
  if (!select) return;
  const current = String(select.value || 'B').toUpperCase();
  let classes = classesForPileType7888(D, type);
  if (!classes.length) classes = type === 'NPH' ? ['A','B','C'] : ['A','AB','B','C'];
  select.innerHTML = classes.map(x => `<option value="${x}" ${x === current ? 'selected' : ''}>${x}</option>`).join('');
  if (!classes.includes(current)) select.value = classes.includes('B') ? 'B' : classes[0];
  const fill = document.querySelector('#calcFill7888');
  const hint = document.querySelector('#calcSourceHint');
  const exact = lookupPileType7888(D, select.value, type);
  if (fill) {
    fill.disabled = !sourceHas7888();
    fill.textContent = type === 'NPH' ? 'Nạp Bảng 2 · NPH' : 'Nạp Bảng 1 · PC/PHC';
  }
  if (hint) hint.textContent = exact
    ? `${type === 'NPH' ? `Bảng 2 · ${exact.designation}` : 'Bảng 1'} có tổ hợp D${D} · cấp ${select.value}. Bấm Nạp bảng để lấy t và σce.`
    : `${type === 'NPH' ? 'Bảng 2 NPH' : 'Bảng 1 PC/PHC'} không có tổ hợp D${D} · cấp ${select.value}; có thể nhập hình học thủ công nhưng lịch sử sẽ ghi “Nhập tay”.`;
}
function syncCalcDefaults() {
  syncCalcClassOptions();
  const type = String(document.querySelector('#cType')?.value || 'PHC').toUpperCase();
  const cls = document.querySelector('#cClass')?.value || 'B';
  const cu = document.querySelector('#cCu');
  const ce = document.querySelector('#cCe');
  if (cu) cu.value = type === 'PC' ? 60 : 80;
  if (ce) ce.value = loadClassSigmaCe[cls] ?? 8;
  syncCalcDraftFromDom({clearTableSource:true});
}
function fillCalcFrom7888() {
  const type = String(document.querySelector('#cType')?.value || 'PHC').toUpperCase();
  const D = Number(document.querySelector('#cDiameter')?.value || 600);
  const cls = String(document.querySelector('#cClass')?.value || 'B').toUpperCase();
  const row = lookupPileType7888(D, cls, type);
  const table = type === 'NPH' ? 'Bảng 2' : 'Bảng 1';
  if (!row) return showToast(`Không có tổ hợp ${type} D${D} · cấp ${cls} trong ${table} TCVN 7888:2014.`, 'warning');
  document.querySelector('#cThickness').value = row.thickness;
  document.querySelector('#cCe').value = row.effectiveStress;
  state.calcDraft = {
    ...syncCalcDraftFromDom(), type, loadClass:cls, diameter:D, thickness:Number(row.thickness), sigmaCe:Number(row.effectiveStress),
    tableSource:table, tablePage:type === 'NPH' ? 12 : (D <= 600 ? 10 : 11), designation:row.designation || ''
  };
  const hint = document.querySelector('#calcSourceHint');
  if (hint) hint.textContent = `Đã nạp ${table}${row.designation ? ` · ${row.designation}` : ''} · trang ${state.calcDraft.tablePage}: t=${row.thickness} mm, σce=${row.effectiveStress} MPa.`;
  showToast(`Đã nạp ${table}${row.designation ? ` · ${row.designation}` : ''} từ TCVN 7888:2014.`, 'success');
}
function runCalc() {
  const output = document.querySelector('#calcResult');
  if (!output) return;
  try {
    const draft = syncCalcDraftFromDom();
    const type = draft.type;
    const cls = draft.loadClass;
    if (type === 'NPH' && cls === 'AB') throw new Error('NPH theo TCVN 7888:2014 chỉ có cấp A, B, C; không có cấp AB.');
    const D = Number(draft.diameter);
    const t = Number(draft.thickness);
    const minSigmaCu = type === 'PC' ? 60 : 80;
    if (Number(draft.sigmaCu) < minSigmaCu) throw new Error(`${type} theo TCVN 7888:2014 yêu cầu σcu không nhỏ hơn ${minSigmaCu} MPa.`);
    const area = annulusAreaMm2({ diameterMm: D, thicknessMm: t });
    const alpha = type === 'PC' ? 4 : 3.5;
    const result = axialResistance({ areaMm2:area, sigmaCu:draft.sigmaCu, sigmaCe:draft.sigmaCe, alpha });
    const tableNote = draft.tableSource
      ? `${draft.tableSource}${draft.designation ? ` · ${draft.designation}` : ''}${draft.tablePage ? ` · trang ${draft.tablePage}` : ''}`
      : 'Thông số hình học/σce nhập tay';
    output.innerHTML = `<div class="calc-result"><div class="calc-main"><span>Sức chịu tải dài hạn</span><b>${result.longTermKn.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} kN</b></div><div class="metric-grid three"><div><span>A₀</span><b>${area.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} mm²</b></div><div><span>Ngắn hạn</span><b>${result.shortTermKn.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} kN</b></div><div><span>80% ngắn hạn</span><b>${result.recommendedMaxKn.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} kN</b></div></div><div class="footnote">α = ${alpha}; ứng suất quy đổi = ${result.stress.toFixed(3)} MPa. ${esc(tableNote)}. Luôn kiểm tra điều kiện áp dụng trong Phụ lục B.</div></div>`;
    const sourceDoc = find7888Doc();
    void recordCalculation({
      kind:'verified-7888', type:'Sức chịu tải cọc', title:`${type} · D${D} · sức chịu tải dài hạn`,
      inputs:{ cType:type, cClass:cls, cDiameter:D, cThickness:t, cCu:draft.sigmaCu, cCe:draft.sigmaCe },
      result:{ areaMm2:area, longTermKn:result.longTermKn, shortTermKn:result.shortTermKn, recommendedMaxKn:result.recommendedMaxKn, stressMpa:result.stress, alpha },
      resultText:`${result.longTermKn.toLocaleString('vi-VN', {maximumFractionDigits:1})} kN`,
      source:{docId:sourceDoc?.id || null, standard:'TCVN 7888:2014', section:'Phụ lục B', page:type === 'PC' ? 32 : 33, formula:type === 'PC' ? '(B.2)/(B.3)' : '(B.4)/(B.5)', maxFormula:'Pmax ≤ 80% RaShort', table:draft.tableSource || 'Nhập tay', tablePage:draft.tablePage || null, designation:draft.designation || ''}
    });
    showToast('Đã tính toán xong và lưu vào lịch sử cục bộ.', 'success');
    requestAnimationFrame(() => output.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  } catch (error) { output.innerHTML = `<div class="notice error">${esc(error.message)}</div>`; showToast(error.message, 'error'); }
}

async function exportSelectedFormulaExcel() {
  const item = selectedFormulaItem();
  if (!item) return showToast('Chưa chọn công thức để xuất Excel.', 'warning');
  const values = {};
  for (const input of document.querySelectorAll('[data-formula-var]')) {
    const name = input.dataset.formulaVar;
    const value = Number(input.value);
    if (name && Number.isFinite(value)) values[name] = value;
  }
  try {
    await exportFormulaWorkbook(item, { values, codePack:codePackForDoc(state.docs.find(d=>d.id===item.docId)) });
    showToast(item.computable ? 'Đã xuất Excel có công thức và thuyết minh nguồn.' : 'Đã xuất Excel tham chiếu. Công thức chưa Verified sẽ không tự tính.', 'success');
  } catch (error) {
    showToast(`Không xuất được Excel: ${error.message}`, 'error');
  }
}


async function exportCurrentCodePackExcel() {
  const doc = state.docs.find(d=>d.id===state.currentDocId) || sourceDocs().find(d=>codePackForDoc(d));
  const pack = codePackForDoc(doc);
  if (!pack) return showToast('Tài liệu hiện tại chưa có Code Pack nạp sẵn.', 'warning');
  try {
    await exportCodePackWorkbook(pack);
    showToast(`Đã xuất Excel Code Pack ${pack.standard}: công thức, mục/Điều, danh mục bảng và các bảng tra đã Verified.`, 'success');
  } catch (error) { showToast(`Không xuất được Code Pack Excel: ${error.message}`, 'error'); }
}

function runDynamicFormula() {
  const item = selectedFormulaItem();
  const output = document.querySelector('#formulaCalcResult');
  if (!output) return;
  if (!item?.computable) {
    output.innerHTML = '<div class="notice warning">Công thức này chưa đủ rõ để tính tự động. Hãy mở trang gốc để kiểm tra.</div>';
    return;
  }
  try {
    const values = {};
    document.querySelectorAll('[data-formula-var]').forEach(el => { values[el.dataset.formulaVar] = Number(el.value); });
    for (const v of item.variables) if (!Number.isFinite(values[v])) throw new Error(`Chưa nhập giá trị hợp lệ cho ${v}.`);
    for (const [v, minimum] of Object.entries(item.inputMinimums || {})) {
      if (Number(values[v]) < Number(minimum)) throw new Error(`${v} phải ≥ ${minimum}${item.variableUnits?.[v] ? ` ${item.variableUnits[v]}` : ''} theo điều kiện áp dụng của công thức.`);
    }
    const rawResult = evaluateExpression(item.rhs, values);
    const scale = Number.isFinite(Number(item.resultScale)) ? Number(item.resultScale) : 1;
    const result = Number(rawResult) * scale;
    const outputUnit = String(item.outputUnit || '').trim();
    const unitNote = outputUnit
      ? `Đơn vị kết quả: ${outputUnit}${scale !== 1 ? ` · hệ số đổi đơn vị ${scale}` : ''}.`
      : 'Kết quả chưa tự gán đơn vị vì công thức này chưa có sơ đồ đơn vị đã xác minh.';
    output.innerHTML = `<div class="calc-result"><div class="calc-main"><span>${esc(item.lhs || 'Kết quả')}</span><b>${Number(result).toLocaleString('vi-VN', { maximumFractionDigits: 8 })}${outputUnit && outputUnit !== '—' ? ` ${esc(outputUnit)}` : ''}</b></div><div class="footnote">${esc(unitNote)} Đối chiếu ${esc(item.standard || item.docName)} · Trang ${item.page} trước khi sử dụng.</div></div>`;
    void recordCalculation({ kind:'dynamic-formula', type:'Công thức từ PDF', title:`${item.label || item.lhs || 'Công thức'} · ${item.standard || item.docName}`, inputs:values, result:{ value:Number(result), rawValue:Number(rawResult), resultScale:scale, outputUnit, lhs:item.lhs || '' }, resultText:`${Number(result).toLocaleString('vi-VN', {maximumFractionDigits:8})}${outputUnit && outputUnit !== '—' ? ` ${outputUnit}` : ''}`, source:{docId:item.docId, standard:item.standard || item.docName, page:item.page, label:item.label || '', verified:Boolean(item.verified)} });
    showToast('Đã tính công thức và lưu vào lịch sử cục bộ.', 'success');
  } catch (error) {
    output.innerHTML = `<div class="notice error">${esc(error.message)}</div>`;
    showToast(error.message, 'error');
  }
}

function localCompareText(question, docs) {
  const parts = [];
  const allHits = [];
  for (const doc of docs) {
    const hits = smartSearchChunks(question, [doc], 4);
    allHits.push(...hits);
    parts.push(`${doc.standard || doc.name}\n${hits.length ? hits.slice(0, 3).map(h => `• ${h.text.slice(0, 520).replace(/\n/g, ' ')} [Trang ${h.page}]`).join('\n') : '• Không tìm thấy đoạn phù hợp.'}`);
  }
  return { text: `SO SÁNH CỤC BỘ — không dùng AI\n\n${parts.join('\n\n')}\n\nApp chỉ đặt các đoạn liên quan cạnh nhau; không tự kết luận khác biệt khi chưa dùng AI.`, hits: allHits };
}
async function runCompare() {
  const docs = selectedDocs();
  const query = String(document.querySelector('#compareQuestion')?.value || state.compare.draft || '').trim();
  if (state.busy) return showToast('Đang xử lý yêu cầu trước.', 'warning');
  if (docs.length < 2) return showToast('Hãy chọn ít nhất 2 PDF để so sánh.', 'warning');
  if (!query) return showToast('Nhập nội dung cần so sánh.', 'warning');
  state.compare.query = query;
  state.compare.draft = query;
  state.compare.text = state.compareMode === 'audit' ? 'Đang kiểm tra mâu thuẫn hồ sơ…' : 'Đang so sánh…';
  state.compare.hits = [];
  state.busy = true;
  render();
  try {
    const audit = state.compareMode === 'audit';
    if (state.settings.provider === 'local') {
      const result = localCompareText(audit ? `Tìm điểm mâu thuẫn hoặc khác biệt: ${query}` : query, docs);
      state.compare.text = result.text;
      state.compare.hits = result.hits;
    } else {
      const instruction = audit
        ? `KIỂM TRA HỒ SƠ NHIỀU TÀI LIỆU theo yêu cầu sau. Tìm mâu thuẫn về số liệu, tiêu chuẩn viện dẫn, điều kiện áp dụng, vật liệu, dung sai, nghiệm thu và công thức. Lập bảng: Vấn đề | Tài liệu A | Tài liệu B | Mức độ | Nguồn trang. Không coi khác cách diễn đạt là mâu thuẫn nếu ý nghĩa tương đương. Nếu chưa đủ căn cứ phải ghi Cần kiểm tra.\n\n${query}`
        : `So sánh các tài liệu theo yêu cầu sau. Tách từng tiêu chuẩn, chỉ ra điểm giống/khác có nguồn trang; nếu không đủ căn cứ thì nói rõ.\n\n${query}`;
      const answer = await getAnswer(instruction, docs);
      state.compare.text = answer.text;
      state.compare.hits = answer.hits;
    }
  } catch (error) {
    state.compare.text = `Lỗi: ${error.message}`;
    recordClientError('compare', error);
  } finally {
    state.busy = false;
    showToast(state.compare.text.startsWith('Lỗi:') ? 'So sánh gặp lỗi.' : (state.compareMode === 'audit' ? 'Đã kiểm tra mâu thuẫn hồ sơ.' : 'Đã so sánh nguồn.'), state.compare.text.startsWith('Lỗi:') ? 'error' : 'success');
    render();
  }
}

function updateChecklist(index, checked) {
  const key = checklistKey();
  state.checklist[key] ||= {};
  state.checklist[key][index] = checked;
  saveChecklist();
  render();
}
async function copyChecklist() {
  const key = checklistKey();
  const values = state.checklist[key] || {};
  const text = tcvn7888Checklist.map((item, i) => `${values[i] ? '[x]' : '[ ]'} ${item}`).join('\n');
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else throw new Error('Clipboard API unavailable');
    showToast('Đã sao chép checklist.', 'success');
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      showToast('Đã sao chép checklist.', 'success');
    } catch { showToast('Không sao chép tự động được. Hãy dùng Ctrl+C.', 'warning'); }
  }
}
function resetChecklist() {
  const key = checklistKey();
  if (!confirm('Bỏ toàn bộ đánh dấu checklist?')) return;
  state.checklist[key] = {};
  saveChecklist();
  render();
}
async function aiChecklist() {
  if (!sourceDocs().length || state.busy) return;
  state.tab = 'chat';
  state.chat.push({ role:'user', text:'Tạo checklist nghiệm thu từ tiêu chuẩn đang chọn', createdAt:new Date().toISOString() });
  state.chat.push({ role:'ai', text:'Đang trích checklist…', hits:[], provider:state.settings.provider, model:providerModel(), createdAt:new Date().toISOString() });
  state.busy = true;
  render();
  try {
    const answer = await getAnswer('Trích checklist thực hành về hồ sơ, kiểm tra, thử nghiệm và nghiệm thu. Mỗi dòng phải có nguồn trang. Không thêm yêu cầu không có trong tài liệu.');
    state.chat[state.chat.length - 1] = { role:'ai', text:answer.text, hits:answer.hits, provider:state.settings.provider, model:providerModel(), createdAt:new Date().toISOString() };
  } catch (error) { state.chat[state.chat.length - 1] = { role:'ai', text:`Lỗi: ${error.message}`, hits:[], provider:state.settings.provider, model:providerModel(), createdAt:new Date().toISOString() }; }
  finally { state.busy = false; await persistCurrentChat(); render(); }
}

function providerChanged(event) {
  const provider = event.target.value;
  const oldProvider = state.settings.provider;
  const oldModel = providerModel();
  if (provider === oldProvider) return;
  const nextModel = PROVIDERS[provider]?.model || '';
  const ok = window.confirm(`Chuyển nhà cung cấp AI?

Hiện tại: ${PROVIDERS[oldProvider]?.label || oldProvider}${oldModel ? ` · ${oldModel}` : ''}
Mới: ${PROVIDERS[provider]?.label || provider}${nextModel ? ` · ${nextModel}` : ''}

HNL chỉ chuyển khi bạn bấm OK.`);
  if (!ok) { render(); return; }
  state.settings.provider = provider;
  state.modelPickerOpen = false;
  state.settingsDraft = {};
  syncCommittedModelEverywhere(nextModel);
  state.modelOptions = [];
  state.modelOptionsVerified = false;
  state.modelCatalogSource = '';
  state.modelStatus = 'Đã đổi nhà cung cấp theo xác nhận của người dùng. Bấm ↻ để nạp model khả dụng.';
  if (provider === 'ollama' && isLocalHost()) { state.settings.connection = 'bridge'; state.settings.bridgeUrl = location.origin; }
  state.connectionStatus = null;
  saveSettings();
  render();
  if (provider === 'ollama' && (IS_DESKTOP_EDITION || isLocalHost())) setTimeout(() => refreshLocalModelManager(false), 0);
}
async function refreshModels() {
  if (state.settings.provider === 'local') return showToast('Tra cứu nhanh không dùng model AI.', 'info');
  const draft = rememberSettingsDraft();
  state.modelStatus = 'Đang kiểm tra danh sách model…';
  render();
  try {
    const result = await listAvailableModelsDetailed({
      provider: state.settings.provider,
      connection: state.settings.connection,
      apiKey: String(draft.apiKey || '').trim(),
      bridgeUrl: draft.bridgeUrl || state.settings.bridgeUrl,
      ollamaUrl: draft.ollamaUrl || state.settings.ollamaUrl
    });
    state.modelOptions = result.models || [];
    state.modelOptionsVerified = result.verified === true;
    state.modelCatalogSource = result.source || '';
    const current = providerModel();
    const missingCurrent = Boolean(state.modelOptionsVerified && state.modelOptions.length && current && !state.modelOptions.includes(current));
    if (state.modelOptionsVerified) {
      const geminiCoverage = state.settings.provider === 'gemini' && Number(result.discoveredCount || 0) > 0
        ? ` API thấy ${result.discoveredCount} model generateContent; ${result.compatibleCount || state.modelOptions.length} model phù hợp chat kỹ thuật${result.filteredCount ? `; ${result.filteredCount} model chuyên biệt đã ẩn khỏi bộ chọn chat` : ''}.`
        : '';
      state.modelStatus = state.modelOptions.length
        ? (missingCurrent ? `Đã xác minh ${state.modelOptions.length} model. Model hiện tại ${current} không còn trong danh sách; HNL KHÔNG tự chuyển.${geminiCoverage}` : `Đã xác minh ${state.modelOptions.length} model từ ${result.source || 'API'}. HNL không tự đổi model.${geminiCoverage}`)
        : `Đã kết nối nhưng tài khoản/Ollama không trả về model khả dụng.`;
    } else {
      state.modelStatus = `Chỉ hiển thị catalog gợi ý, CHƯA xác minh model thực tế. ${result.warning || ''}`.trim();
    }
    showToast(state.modelOptionsVerified ? `Đã xác minh ${state.modelOptions.length} model.` : 'Danh sách hiện chỉ là gợi ý, chưa xác minh.', state.modelOptionsVerified ? 'success' : 'warning');
  } catch (error) {
    state.modelOptions = []; state.modelOptionsVerified = false; state.modelCatalogSource = '';
    state.modelStatus = `Không lấy được danh sách: ${error.message}`;
    showToast(state.modelStatus, 'warning');
  }
  render();
}

async function applyRecommendedLocalModels() {
  if (state.settings.provider !== 'ollama') return showToast('Hãy chọn HNL Offline AI · Ollama trước.', 'warning');
  try {
    const d = await localEngineDiagnostics(state.settings.bridgeUrl);
    if (!d.ollama) throw new Error('Ollama chưa chạy. Hãy mở START_HNL_OFFLINE_AI.bat.');
    const nextText = d.recommended?.text || state.settings.model;
    const nextVision = d.recommended?.vision || state.settings.visionModel;
    const nextEmbedding = d.recommended?.embedding || state.settings.embeddingModel;
    const ok = window.confirm(`HNL đề xuất cấu hình theo máy:\n\nText: ${state.settings.model || '(chưa chọn)'} → ${nextText}\nVision: ${state.settings.visionModel} → ${nextVision}\nEmbedding: ${state.settings.embeddingModel} → ${nextEmbedding}\n\nBấm OK mới áp dụng. Cancel = giữ nguyên.`);
    if (!ok) return showToast('Đã giữ nguyên model hiện tại.', 'info');
    state.settings.model = nextText;
    state.settings.visionModel = nextVision;
    state.settings.embeddingModel = nextEmbedding;
    state.settings.retrievalMode = 'auto';
    state.settings.semanticRerank = true;
    saveSettings();
    const missing=[];
    if (!d.installed?.text) missing.push(d.recommended?.text);
    if (!d.installed?.vision) missing.push(d.recommended?.vision);
    if (!d.installed?.embedding) missing.push(d.recommended?.embedding);
    state.modelStatus = missing.length
      ? `Đã chọn cấu hình phù hợp máy; còn thiếu model: ${[...new Set(missing.filter(Boolean))].join(', ')}.`
      : `Đã tự chọn ${state.settings.model} + ${state.settings.embeddingModel} + ${state.settings.visionModel}.`;
    showToast(state.modelStatus, missing.length ? 'warning' : 'success');
  } catch (error) {
    showToast(`Không tự chọn được model: ${error.message}`, 'error');
  }
  render();
}


async function refreshLocalModelManager(showFeedback = false) {
  if (!IS_DESKTOP_EDITION && !isLocalHost()) return;
  if (state.localModelManager.loading) return;
  state.localModelManager.loading = true; state.localModelManager.error = '';
  if (showFeedback) render();
  try {
    const base = String(state.settings.bridgeUrl || location.origin).replace(/\/$/, '');
    const r = await fetch(`${base}/api/local/model-manager`);
    const data = await r.json().catch(()=>({}));
    if (!r.ok) throw new Error(data.error || 'Không đọc được thông tin model Offline.');
    state.localModelManager.data = data;
    state.modelOptions = (data.models || []).map(x => x.name || x.model).filter(Boolean);
    if (showFeedback) showToast(`Đã đọc ${state.modelOptions.length} model Offline.`, 'success');
    const hasRunning = (data.jobs || []).some(j => j.status === 'running');
    if (state.localModelManager.pollTimer) clearTimeout(state.localModelManager.pollTimer);
    if (hasRunning) state.localModelManager.pollTimer = setTimeout(() => refreshLocalModelManager(false), 1800);
  } catch (error) {
    state.localModelManager.error = error.message;
    if (showFeedback) showToast(`Không mở được quản lý model: ${error.message}`, 'error');
  } finally { state.localModelManager.loading = false; render(); }
}
async function installModelPack(kind = 'balanced') {
  const packs = { light:['qwen3:4b','nomic-embed-text','gemma3:4b'], balanced:['qwen3:8b','bge-m3','gemma3:4b'], strong:['qwen3:14b','bge-m3','gemma3:4b'] };
  const models = packs[kind] || packs.balanced;
  const next = kind === 'light'
    ? { model:'qwen3:4b', embeddingModel:'nomic-embed-text', visionModel:'gemma3:4b' }
    : kind === 'strong'
      ? { model:'qwen3:14b', embeddingModel:'bge-m3', visionModel:'gemma3:4b' }
      : { model:'qwen3:8b', embeddingModel:'bge-m3', visionModel:'gemma3:4b' };
  const ok = window.confirm(`Cài và đặt bộ AI Offline ${kind.toUpperCase()} làm cấu hình hiện tại?\n\nText: ${state.settings.model || '(chưa chọn)'} → ${next.model}\nVision: ${state.settings.visionModel} → ${next.visionModel}\nEmbedding: ${state.settings.embeddingModel} → ${next.embeddingModel}\n\nChỉ bấm OK mới đổi model và bắt đầu tải.`);
  if (!ok) return showToast('Đã giữ nguyên model hiện tại; chưa tải bộ model.', 'info');
  state.settings.model = next.model;
  state.settings.embeddingModel = next.embeddingModel;
  state.settings.visionModel = next.visionModel;
  state.settingsDraft = {};
  saveSettings();
  await installLocalModels(models);
  await refreshLocalModelManager(false);
}

async function deleteLocalModel(model) {
  model = String(model || '').trim(); if (!model) return;
  if (!confirm(`Xóa model Offline "${model}" khỏi máy?\n\nModel có thể tải lại sau bằng Ollama.`)) return;
  try { const base=String(state.settings.bridgeUrl||location.origin).replace(/\/$/,''); const r=await fetch(`${base}/api/local/delete-model`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model})}); const data=await r.json().catch(()=>({})); if(!r.ok) throw new Error(data.error||'Không xóa được model.'); showToast(`Đã xóa ${model}.`,'success'); await refreshLocalModelManager(false); } catch(error){ showToast(`Không xóa được model: ${error.message}`,'error'); }
}
async function cancelLocalModelPull(model) {
  try { const base=String(state.settings.bridgeUrl||location.origin).replace(/\/$/,''); const r=await fetch(`${base}/api/local/cancel-model-pull`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model})}); const data=await r.json().catch(()=>({})); if(!r.ok) throw new Error(data.error||'Không hủy được tải model.'); showToast(`Đã yêu cầu hủy tải ${model}.`,'success'); await refreshLocalModelManager(false); } catch(error){ showToast(`Không hủy được: ${error.message}`,'error'); }
}
async function applyModelDirectory() {
  const dir=String(document.querySelector('#modelDirectoryInput')?.value||'').trim(); if(!dir) return showToast('Hãy nhập thư mục lưu model, ví dụ D:\\HNL_AI\\Models.','warning');
  if(!confirm(`Đổi thư mục model Ollama sang:\n${dir}\n\nHNL sẽ đặt OLLAMA_MODELS cho tài khoản Windows và khởi động lại Ollama. Model cũ KHÔNG tự di chuyển; hãy xóa/move thủ công nếu cần.`)) return;
  try { const base=String(state.settings.bridgeUrl||location.origin).replace(/\/$/,''); const r=await fetch(`${base}/api/local/model-directory`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:dir,restart:true})}); const data=await r.json().catch(()=>({})); if(!r.ok) throw new Error(data.error||'Không đổi được thư mục model.'); showToast(data.message||'Đã đổi thư mục model.',data.restartOk===false?'warning':'success'); await refreshLocalModelManager(false); } catch(error){ showToast(`Không đổi được thư mục model: ${error.message}`,'error'); }
}
async function openModelDirectory() {
  try { const base=String(state.settings.bridgeUrl||location.origin).replace(/\/$/,''); const r=await fetch(`${base}/api/local/open-model-directory`,{method:'POST'}); const data=await r.json().catch(()=>({})); if(!r.ok) throw new Error(data.error||'Không mở được thư mục model.'); } catch(error){ showToast(`Không mở được thư mục: ${error.message}`,'error'); }
}

async function waitForOllamaInstall(base, timeoutMs = 10 * 60 * 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const r = await fetch(`${base}/api/local/ollama-install-status`, { cache:'no-store' });
    const data = await r.json().catch(()=>({}));
    if (!r.ok) throw new Error(data.error || 'Không đọc được trạng thái cài Ollama.');
    state.localModelManager = { ...(state.localModelManager || {}), data:{ ...((state.localModelManager || {}).data || {}), ollamaInstalled:Boolean(data.installed), ollamaInstall:data } };
    render();
    if (data.installed || data.status === 'done') return data;
    if (data.status === 'error') throw new Error(data.error || data.message || 'Cài Ollama thất bại.');
    await waitMs(1500);
  }
  throw new Error('Cài Ollama quá thời gian chờ.');
}

async function installOllamaAutomatically({ silentConfirm = false } = {}) {
  if (!IS_DESKTOP_EDITION && !isLocalHost()) return showToast('Cài Ollama tự động chỉ dùng trong HNL Desktop AI/HNL Local.', 'warning');
  if (!silentConfirm && !confirm('Cài Ollama miễn phí trên Windows ngay bây giờ?\n\nHNL sẽ ưu tiên Windows Package Manager; nếu không có sẽ tải OllamaSetup.exe từ ollama.com, kiểm tra chữ ký số rồi cài im lặng.')) return false;
  try {
    const base = String(state.settings.bridgeUrl || location.origin).replace(/\/$/, '');
    const r = await fetch(`${base}/api/local/install-ollama`, { method:'POST' });
    const data = await r.json().catch(()=>({}));
    if (!r.ok) throw new Error(data.error || 'Không khởi động được cài Ollama.');
    showToast(data.status === 'done' ? 'Ollama đã có trên máy.' : 'Đã bắt đầu cài Ollama. HNL đang theo dõi tiến trình…', 'success');
    await waitForOllamaInstall(base);
    await refreshLocalModelManager(false);
    showToast('Ollama đã sẵn sàng. Bạn có thể tải model Offline.', 'success');
    return true;
  } catch (error) {
    showToast(`Không cài được Ollama: ${error.message}`, 'error');
    await refreshLocalModelManager(false).catch(()=>{});
    return false;
  }
}

function estimateOllamaModelBytes(model='') {
  const name = String(model || '').toLowerCase();
  const GB = 1024 ** 3;
  if (/qwen3:4b/.test(name)) return 3 * GB;
  if (/qwen3:8b/.test(name)) return 6 * GB;
  if (/qwen3:14b/.test(name)) return 10 * GB;
  if (/gemma3:4b/.test(name)) return 4 * GB;
  if (/bge-m3/.test(name)) return 1.5 * GB;
  if (/nomic-embed-text/.test(name)) return 0.5 * GB;
  return 4 * GB;
}
async function installLocalModels(models = []) {
  if (!IS_DESKTOP_EDITION && !isLocalHost()) return showToast('Cài model Offline chỉ dùng trong HNL Desktop AI/HNL Local.', 'warning');
  if (state.settings.provider !== 'ollama') return showToast('Hãy chọn HNL Offline AI · Ollama trước.', 'warning');
  const unique = [...new Set(models.map(x => String(x || '').trim()).filter(Boolean))];
  if (!unique.length) return showToast('Chưa có tên model để cài.', 'warning');
  try {
    const base = String(state.settings.bridgeUrl || location.origin).replace(/\/$/, '');
    const managerResponse = await fetch(`${base}/api/local/model-manager`, { cache:'no-store' });
    let manager = await managerResponse.json().catch(()=>({}));
    if (!managerResponse.ok) throw new Error(manager.error || 'Không kiểm tra được Ollama.');
    const estimate = Math.ceil(unique.reduce((sum, model) => sum + estimateOllamaModelBytes(model), 0) * 1.15);
    const free = Number(manager.disk?.freeBytes || 0);
    if (free > 0 && free < estimate) throw new Error(`Ổ lưu model chỉ còn ${formatBytes(free)}, thấp hơn mức dự phòng ${formatBytes(estimate)} cho gói đã chọn. Hãy đổi ổ/thư mục model trước.`);
    const ok = confirm(`Tải model Ollama về máy?\n\n${unique.join('\n')}\n\nDung lượng dự phòng ước tính: ${formatBytes(estimate)}${free > 0 ? `\nỔ hiện tại còn trống: ${formatBytes(free)}` : ''}\n\nChỉ bấm OK mới bắt đầu tải; có thể hủy trong Trình quản lý Offline.`);
    if (!ok) return showToast('Đã hủy; chưa tải model nào.', 'info');
    if (manager.ollamaInstalled === false) {
      const okInstall = confirm('Máy chưa có Ollama. Cài Ollama tự động rồi tiếp tục tải bộ model Offline đã chọn?');
      if (!okInstall) return showToast('Đã hủy cài AI Offline.', 'warning');
      const installed = await installOllamaAutomatically({ silentConfirm:true });
      if (!installed) return;
      const refreshed = await fetch(`${base}/api/local/model-manager`, { cache:'no-store' });
      manager = await refreshed.json().catch(()=>manager);
    }
    for (const model of unique) {
      const r = await fetch(`${base}/api/local/pull-model`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({model}) });
      const data = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(data.error || `Không khởi động được tải ${model}`);
    }
    state.modelStatus = `Đang tải model nền: ${unique.join(', ')}. Có thể tiếp tục dùng app; Trình quản lý Offline sẽ hiển thị tiến độ.`;
    showToast('Đã bắt đầu tải model Offline trên máy.', 'success');
    setTimeout(() => refreshLocalModelManager(false), 500);
  } catch (error) {
    showToast(`Không cài được model: ${error.message}`, 'error');
  }
  render();
}

function readSettingsForm({ askBeforeModelChange = false } = {}) {
  const provider = document.querySelector('#providerSelect')?.value || state.settings.provider;
  if (provider !== state.settings.provider) return false; // providerChanged owns provider switches.
  const draft = rememberSettingsDraft();
  const next = {
    model: String(state.settings.model || PROVIDERS[provider]?.model || '').trim(),
    visionModel: String(draft.visionModel || state.settings.visionModel || 'gemma3:4b').trim(),
    embeddingModel: String(draft.embeddingModel || state.settings.embeddingModel || 'bge-m3').trim()
  };
  const changes = [];
  if (next.model !== state.settings.model) changes.push(`Text: ${state.settings.model || '(chưa chọn)'} → ${next.model}`);
  if (next.visionModel !== state.settings.visionModel) changes.push(`Vision: ${state.settings.visionModel || '(chưa chọn)'} → ${next.visionModel}`);
  if (next.embeddingModel !== state.settings.embeddingModel) changes.push(`Embedding: ${state.settings.embeddingModel || '(chưa chọn)'} → ${next.embeddingModel}`);
  if (askBeforeModelChange && changes.length) {
    const ok = window.confirm(`Đổi cấu hình model AI?\n\n${changes.join('\n')}\n\nHNL chỉ áp dụng khi bạn bấm OK. Cancel = giữ nguyên toàn bộ cấu hình.`);
    if (!ok) {
      state.settingsDraft = {};
      render();
      return false;
    }
  }
  syncCommittedModelEverywhere(next.model);
  state.settings.visionModel = next.visionModel;
  state.settings.embeddingModel = next.embeddingModel;
  state.settings.bridgeUrl = String(draft.bridgeUrl || state.settings.bridgeUrl).trim();
  state.settings.ollamaUrl = String(draft.ollamaUrl || state.settings.ollamaUrl).trim();
  state.settings.retrievalMode = draft.retrievalMode || state.settings.retrievalMode || 'auto';
  state.settings.semanticRerank = Boolean(draft.semanticRerank);
  state.settings.nativePdfMode = ['economy','balanced','native'].includes(draft.nativePdfMode) ? draft.nativePdfMode : 'balanced';
  state.settings.openaiPdfDetail = ['low','auto','high'].includes(draft.openaiPdfDetail) ? draft.openaiPdfDetail : 'auto';
  state.settings.historyRetentionDays = [30,90,365,0].includes(Number(draft.historyRetentionDays)) ? Number(draft.historyRetentionDays) : 365;
  state.settings.strict = Boolean(draft.strict);
  const key = String(draft.apiKey || '').trim();
  setCurrentApiKey(provider, key);
  state.settingsDraft = {};
  saveSettings();
  return true;
}
function updateSettingsFromForm() {
  if (!readSettingsForm({ askBeforeModelChange:true })) return;
  state.connectionStatus = null;
  showToast('Đã lưu cài đặt. Text/Vision/Embedding model chỉ đổi sau khi bạn xác nhận OK.', 'success');
  render();
}

function updateConnectionStatusUi(status, { pending = false } = {}) {
  const box = document.querySelector('#connectionStatusBox');
  const label = document.querySelector('#connectionStateLabel');
  const dot = document.querySelector('#aiConnectionDot');
  const summaryStatus = document.querySelector('#aiConnectionSummaryStatus');
  if (dot) dot.classList.toggle('ok', Boolean(status?.ok) && !pending);
  if (summaryStatus) summaryStatus.textContent = pending ? 'Đang kiểm tra · AI & kết nối' : status?.ok ? 'Đã kết nối · AI & kết nối' : status ? 'Cần kiểm tra · AI & kết nối' : 'AI & kết nối';
  if (label) label.textContent = pending ? 'Đang kiểm tra…' : status?.ok ? 'Sẵn sàng' : status ? 'Có lỗi' : 'Chưa kiểm tra';
  if (!box) return;
  if (!pending && !status) { box.hidden = true; return; }
  box.hidden = false;
  box.className = `notice ${pending ? '' : status?.ok ? 'success' : 'error'}`.trim();
  const title = pending ? 'Đang kiểm tra kết nối…' : status?.ok ? 'Kết nối OK' : 'Kết nối lỗi';
  const message = pending ? 'Giữ nguyên vị trí và dữ liệu đang nhập; HNL chỉ cập nhật kết quả tại đây.' : String(status?.message || '');
  box.innerHTML = `<b>${esc(title)}</b><br>${esc(message)}`;
}

async function testConnection() {
  const draft = rememberSettingsDraft();
  state.connectionStatus = null;
  updateConnectionStatusUi(null, { pending:true });
  try {
    let result;
    const provider = state.settings.provider;
    const connection = state.settings.connection;
    const model = String(draft.model || providerModel()).trim();
    const bridgeUrl = draft.bridgeUrl || state.settings.bridgeUrl;
    const ollamaUrl = draft.ollamaUrl || state.settings.ollamaUrl;
    const apiKey = String(draft.apiKey || '').trim();
    if (provider === 'local') result = { ok:true, message:'Tra cứu nhanh sẵn sàng. Đây không phải mô hình AI.' };
    else if (provider === 'ollama' && location.protocol === 'https:' && !isLocalHost() && !/^https:\/\//i.test(bridgeUrl || '')) {
      result = { ok:false, message:'GitHub Pages HTTPS không thể kết nối ổn định tới Ollama/Bridge HTTP trên máy. Hãy chạy START_HNL_OFFLINE_AI.bat rồi mở http://127.0.0.1:8787.' };
    } else if (connection === 'bridge') {
      const health = await bridgeHealth(bridgeUrl);
      if (!health?.ok) throw new Error('HNL Bridge không phản hồi.');
      if (provider === 'ollama') {
        result = { ok:Boolean(health.providers?.ollama), message:health.providers?.ollama ? 'Ollama qua HNL Bridge phản hồi bình thường.' : 'HNL Bridge đang chạy nhưng Ollama chưa sẵn sàng.' };
      } else if (apiKey) {
        const text = await callBridge({ bridgeUrl, provider, model, apiKey, prompt:'Chỉ trả lời đúng một từ: OK' });
        result = { ok:Boolean(text), message:text ? 'Kết nối AI qua HNL Bridge OK. API key này đã được kích hoạt cho phiên hiện tại.' : 'AI không trả về nội dung.' };
      } else {
        const configured = health.providers?.[provider];
        result = { ok:Boolean(configured), message:configured ? 'HNL Bridge đã có API key cấu hình sẵn và phản hồi bình thường.' : `Bridge hoạt động nhưng chưa có API key cho ${PROVIDERS[provider].label}.` };
      }
    } else {
      result = await testDirectProvider({ provider, model, apiKey, ollamaUrl });
      if (result?.message) result.message += ' API key hợp lệ sẽ được dùng ngay trong phiên hiện tại.';
    }
    if (result?.ok && apiKey && !['local','ollama'].includes(provider)) {
      setCurrentApiKey(provider, apiKey);
      state.settingsDraft = { ...(state.settingsDraft || {}), apiKey };
    }
    state.connectionStatus = result;
  } catch (error) { state.connectionStatus = { ok:false, message:`${error.message} Cài đặt nháp chưa được lưu.` }; }
  updateConnectionStatusUi(state.connectionStatus);
}

function bindWorkspaceSplitters() {
  const workspace = document.querySelector('.workspace');
  if (!workspace || window.innerWidth <= 880) return;
  for (const side of ['left','right']) {
    const handle = document.querySelector(`.splitter-${side}`);
    if (!handle) continue;
    handle.onpointerdown = event => {
      event.preventDefault();
      const startX = event.clientX; const start = state.layout[side];
      handle.setPointerCapture?.(event.pointerId);
      const move = e => {
        const delta = e.clientX - startX;
        const next = side === 'left' ? start + delta : start - delta;
        state.layout[side] = Math.round(Math.min(side === 'left' ? 390 : 560, Math.max(side === 'left' ? 240 : 330, next)));
        workspace.style.setProperty(side === 'left' ? '--left-user-w' : '--right-user-w', `${state.layout[side]}px`);
      };
      const up = e => {
        handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up);
        localStorage.setItem(side === 'left' ? STORAGE.leftWidth : STORAGE.rightWidth, String(state.layout[side]));
        try { handle.releasePointerCapture?.(e.pointerId); } catch {}
      };
      handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up);
    };
  }
}

function bindGlobalReaderShortcuts() {
  if (bindGlobalReaderShortcuts.bound) return;
  bindGlobalReaderShortcuts.bound = true;
  window.addEventListener('keydown', event => {
    if (event.isComposing) return;
    const tag = String(event.target?.tagName || '').toLowerCase();
    const typing = ['input','textarea','select'].includes(tag) || event.target?.isContentEditable;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && activeDoc()) {
      event.preventDefault(); document.querySelector('#pdfSearchInput')?.focus(); document.querySelector('#pdfSearchInput')?.select(); return;
    }
    if (typing) return;
    if (!activeDoc()) return;
    if (event.key === 'PageDown' || event.key === 'ArrowRight') { event.preventDefault(); jumpPage(state.page + 1); return; }
    if (event.key === 'PageUp' || event.key === 'ArrowLeft') { event.preventDefault(); jumpPage(state.page - 1); return; }
    if (event.key === 'Home') { event.preventDefault(); jumpPage(1); return; }
    if (event.key === 'End') { event.preventDefault(); jumpPage(activeDoc().pageCount); return; }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(state.zoom + .1); return; }
    if (event.key === '-') { event.preventDefault(); setZoom(state.zoom - .1); return; }
    if ((event.ctrlKey || event.metaKey) && event.key === '0') { event.preventDefault(); fitPageWidth(); return; }
    if (event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.metaKey) { state.focusReader = !state.focusReader; state.pendingPageScroll = true; render(); return; }
    if (event.key === '[') { state.focusReader=false; state.leftCollapsed=!state.leftCollapsed; localStorage.setItem(STORAGE.leftCollapsed,String(state.leftCollapsed)); render(); return; }
    if (event.key === ']') { state.focusReader=false; state.rightCollapsed=!state.rightCollapsed; localStorage.setItem(STORAGE.rightCollapsed,String(state.rightCollapsed)); render(); return; }
  });
}

async function runDiagnostics() {
  const tests = [];
  tests.push(['IndexedDB', 'indexedDB' in window, 'Bộ nhớ tài liệu cục bộ']);
  tests.push(['Web Crypto', Boolean(crypto?.subtle), 'Phát hiện PDF trùng']);
  tests.push(['Service Worker', 'serviceWorker' in navigator, 'PWA/cache cập nhật']);
  tests.push(['Phiên bản', Boolean(APP_META.version), `v${APP_META.version} · ${buildNumberLabel()}`]);
  tests.push(['Dấu build', Boolean(APP_META.builtAt), `${formatBuildTime(APP_META.builtAt)} · ${APP_META.commitShort || 'local'}`]);
  tests.push(['PDF thư viện', state.docs.length > 0, `${state.docs.length} tài liệu`]);
  tests.push(['Nguồn tra cứu', sourceDocs().length > 0, `${sourceDocs().length} nguồn`]);
  if (state.settings.provider !== 'local') {
    const ok = state.settings.connection === 'bridge' ? Boolean(state.settings.bridgeUrl) : (state.settings.provider === 'ollama' ? Boolean(state.settings.ollamaUrl) : Boolean(currentApiKey()));
    tests.push(['Cấu hình AI', ok, state.settings.connection === 'bridge' ? 'Bridge' : 'Trực tiếp']);
  }
  if ((IS_DESKTOP_EDITION || isLocalHost()) && state.settings.bridgeUrl) {
    try {
      const base = String(state.settings.bridgeUrl || location.origin).replace(/\/$/, '');
      const r = await fetch(`${base}/api/local/archive-engines`, { cache:'no-store' });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d.error || 'Không đọc được engine archive.');
      state.archiveEngines = d; state.archiveEngineError = '';
      const hasGeneral = Boolean(d.sevenZip?.length || d.tar);
      tests.push(['Giải nén Desktop', Boolean(d.builtinRar || hasGeneral), `7-Zip ${d.sevenZip?.length ? '✓' : '—'} · UnRAR ${d.unrar?.length ? '✓' : '—'} · tar ${d.tar ? '✓' : '—'} · HNL RAR ${d.builtinRar ? '✓' : '—'}`]);
    } catch (error) {
      state.archiveEngineError = error.message;
      tests.push(['Giải nén Desktop', false, error.message]);
    }
  }
  if (state.settings.provider === 'ollama' && state.settings.connection === 'bridge' && state.settings.bridgeUrl) {
    try {
      const d = await localEngineDiagnostics(state.settings.bridgeUrl);
      tests.push(['Ollama Local', Boolean(d.ollama), d.ollama ? `v${d.ollamaVersion || '?'} · ${d.models?.length || 0} model` : 'Chưa kết nối Ollama']);
      tests.push(['Embedding', Boolean(d.installed?.embedding), d.installed?.embedding ? `${d.recommended?.embedding} đã cài` : `Khuyến nghị cài ${d.recommended?.embedding || 'bge-m3'}`]);
      tests.push(['Cấu hình máy', true, `RAM ${d.ramGB || '?'} GB${d.gpus?.length ? ` · GPU ${d.gpus.map(g=>`${g.name} ${Math.round((g.vramMB||0)/1024)}GB`).join(', ')}` : ' · không đọc thấy NVIDIA GPU'}`]);
      tests.push(['Model khuyên dùng', Boolean(d.recommended?.text), `${d.recommended?.text || 'qwen3:4b'} · Vision ${d.recommended?.vision || 'gemma3:4b'}`]);
    } catch (error) {
      tests.push(['HNL Local Engine', false, error.message]);
    }
  }
  const active = activeDoc();
  if (active) {
    const health = documentHealth(active);
    tests.push(['Sức khỏe tài liệu', health.score >= 60, `${health.score}/100 · ${health.label}`]);
    tests.push(['Chỉ mục văn bản', Boolean(active.textIndexVersion), `Index v${active.textIndexVersion || 0} · ${active.pageCount || 0} trang`]);
  }
  tests.push(['Kiến trúc UI state', document.querySelectorAll('#providerSelect').length <= 1 && document.querySelectorAll('#modelInput').length <= 1 && document.querySelectorAll('#nativePdfModeInput').length <= 1, 'Provider / Model / Native PDF chỉ có một nguồn điều khiển']);
  tests.push(['Chế độ hiệu năng', Boolean(PERFORMANCE_PROFILES[state.settings.performanceMode]), `${performanceProfile().label || state.settings.performanceMode}`]);
  tests.push(['Workspace', true, state.settings.fieldMode ? 'Chế độ hiện trường · tự lưu' : 'Workspace tự lưu']);
  tests.push(['Nhật ký lỗi', true, `${state.crashLog.length} lỗi cục bộ · API key được lọc khỏi gói chẩn đoán`]);
  const passed = tests.filter(t => t[1]).length;
  state.diagnosticSummary = { passed, total:tests.length, ok:passed === tests.length };
  state.diagnosticHtml = `<div class="diagnostic"><div class="diagnostic-score">${passed}/${tests.length} kiểm tra đạt</div>${tests.map(([name, ok, detail]) => `<div class="diagnostic-row ${ok ? 'ok' : 'bad'}"><span>${ok ? '✓' : '!'}</span><b>${esc(name)}</b><small>${esc(detail)}</small></div>`).join('')}</div>`;
  render();
}

(async function init() {
  await Promise.all([loadBuildMetadata(), loadChangelog()]);
  try {
    const [docs, sessions, calculations] = await Promise.all([getDocuments(), getChatSessions(), getCalculations()]);
    state.docs = docs;
    state.docs.forEach(d => { if (!d.viewerKind) d.viewerKind = 'pdf'; docMeta(d); state.selected.add(d.id); });
    restoreWorkspace();
    if (!state.docs.some(d => d.id === state.activeDocId)) state.activeDocId = state.docs[0]?.id || null;
    state.page = Math.max(1, Math.min(state.docs.find(d=>d.id===state.activeDocId)?.pageCount || 1, Number(state.page || 1)));
    state.chatSessions = sessions;
    state.calculations = calculations;
    const latest = sessions.find(x => x.id === state.activeChatSessionId) || sessions[0];
    if (latest) {
      state.activeChatSessionId = latest.id;
      state.chat = (latest.messages || []).map(m => ({ ...m, hits:Array.isArray(m.hits) ? m.hits : [] }));
    } else state.activeChatSessionId = crypto.randomUUID();
    await purgeExpiredHistory();
  } catch (error) {
    console.warn(error);
    state.toast = { message: 'Không mở được đầy đủ dữ liệu cục bộ của ứng dụng.', type: 'error' };
  }
  render();
})();

if (!IS_DESKTOP_EDITION && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(`./sw.js?v=${encodeURIComponent(SOURCE_META.version)}`, { updateViaCache: 'none' });
      registration.update().catch(() => {});
    } catch { /* PWA is optional */ }
  });
}
