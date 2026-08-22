import './styles.css';
import { renderPdfPage, clearPdfCache } from './pdf.js';
import { expandInputItems, parseInputFile, fileToBase64, extractArchiveViaLocalBridge } from './ingest.js';
import { saveDocument, getDocuments, deleteDocument } from './db.js';
import { searchChunks, searchEveryPage, smartSearchChunks, localSummary, localAnswer, corpusStats, isBroadQuery, clearSearchCache } from './search.js';
import { PROVIDERS, buildRagPrompt, callBridge, callDirect, bridgeHealth, testDirectProvider, listAvailableModels } from './ai.js';
import { annulusAreaMm2, axialResistance, loadClassSigmaCe, tcvn7888Checklist } from './calculators.js';
import { diameters7888, lookup7888, classesForDiameter7888 } from './tcvn7888.js';

const STORAGE = {
  provider: 'hnl.provider.v12',
  connection: 'hnl.connection.v12',
  model: 'hnl.model.v12',
  bridge: 'hnl.bridge.v12',
  ollama: 'hnl.ollama.v12',
  strict: 'hnl.strict.v12',
  checklist: 'hnl.checklist.v12',
  visionModel: 'hnl.visionModel.v14',
  scope: 'hnl.scope.v14'
};

const state = {
  docs: [],
  selected: new Set(),
  activeDocId: null,
  page: 1,
  zoom: 1.08,
  tab: 'summary',
  mobile: 'library',
  chat: [],
  chatDraft: '',
  lookup: { query: '', draft: '', hits: [] },
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
    scope: localStorage.getItem(STORAGE.scope) || 'all'
  },
  progress: null,
  toast: null,
  busy: false,
  connectionStatus: null,
  diagnosticHtml: '',
  modelOptions: [],
  modelStatus: '',
  searchStats: null
};

if (!PROVIDERS[state.settings.provider]) state.settings.provider = 'local';
if (new URLSearchParams(location.search).get('offline') === '1' && ['localhost','127.0.0.1','::1'].includes(location.hostname)) {
  state.settings.provider = 'ollama';
  state.settings.connection = 'bridge';
  state.settings.bridgeUrl = location.origin;
}
const app = document.querySelector('#app');

function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch { return fallback; }
}
function esc(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
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
function scopeLabel() {
  if (state.settings.scope === 'selected') return `Đã chọn (${selectedDocs().length})`;
  if (state.settings.scope === 'active') return 'PDF đang mở';
  return `Toàn thư viện (${state.docs.length})`;
}
function is7888(doc) {
  return Boolean(doc && (/TCVN\s*7888\s*:\s*2014/i.test(doc.standard || '') || /7888/.test(doc.name || '')));
}
function sourceHas7888() { return sourceDocs().some(is7888); }
function providerModel(forVision = false) {
  if (forVision && state.settings.provider === 'ollama') return state.settings.visionModel || 'gemma3:4b';
  return state.settings.model || PROVIDERS[state.settings.provider]?.model || '';
}
function isLocalHost() { return ['localhost','127.0.0.1','::1'].includes(location.hostname); }
function sessionKeyName(provider) { return `hnl.apiKey.${provider}`; }
function currentApiKey() { return sessionStorage.getItem(sessionKeyName(state.settings.provider)) || ''; }

function saveSettings() {
  localStorage.setItem(STORAGE.provider, state.settings.provider);
  localStorage.setItem(STORAGE.connection, state.settings.connection);
  localStorage.setItem(STORAGE.model, state.settings.model);
  localStorage.setItem(STORAGE.visionModel, state.settings.visionModel);
  localStorage.setItem(STORAGE.bridge, state.settings.bridgeUrl);
  localStorage.setItem(STORAGE.ollama, state.settings.ollamaUrl);
  localStorage.setItem(STORAGE.strict, String(state.settings.strict));
  localStorage.setItem(STORAGE.scope, state.settings.scope);
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

function render() {
  const doc = activeDoc();
  const sources = sourceDocs();
  const provider = PROVIDERS[state.settings.provider] || PROVIDERS.local;
  app.innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <div class="brand" role="banner">
        <img class="brand-mark" src="./hnl-mark-192.png" alt="HNL" />
        <div class="brand-copy">
          <div class="brand-title">HNL Pile Standards AI</div>
          <div class="brand-sub">Tra cứu tiêu chuẩn · kiểm tra kỹ thuật cọc</div>
        </div>
      </div>
      <div class="top-actions">
        <button class="source-badge" id="sourceBadge" title="Mở thư viện nguồn">${sources.length} nguồn</button>
        <button class="ai-badge ${state.connectionStatus?.ok ? 'ok' : ''}" id="openSettings" title="Mở cài đặt AI">
          <span class="dot"></span>${esc(provider.short)}
        </button>
      </div>
    </header>

    <main class="workspace" data-mobile="${state.mobile}">
      <aside class="sidebar">
        <div class="side-head">
          <div><div class="section-kicker">Tài liệu</div><h2>Thư viện tiêu chuẩn</h2></div>
          <div class="mini-actions">
            <button class="icon-btn" id="selectAll" title="Chọn tất cả làm nguồn">✓</button>
            <button class="icon-btn" id="clearSelection" title="Bỏ chọn tất cả">×</button>
          </div>
        </div>
        <div class="import-grid">
          <label class="upload-box" ${state.busy ? 'aria-disabled="true"' : ''}>
            <span class="upload-icon">＋</span>
            <span><b>Thêm dữ liệu</b><small>PDF · ZIP · ảnh · TXT/CSV/JSON</small></span>
            <input id="dataInput" type="file" accept=".pdf,.zip,.png,.jpg,.jpeg,.webp,.bmp,.gif,.txt,.md,.csv,.json,.xml,.html,.htm,.yaml,.yml,.rar,.7z" multiple ${state.busy ? 'disabled' : ''}>
          </label>
          <label class="folder-box" ${state.busy ? 'aria-disabled="true"' : ''}>
            <span>▣</span><b>Đọc cả thư mục</b>
            <input id="folderInput" type="file" webkitdirectory directory multiple ${state.busy ? 'disabled' : ''}>
          </label>
        </div>
        <div class="library-note">Tự quét file trong thư mục/ZIP. Ảnh được giữ làm nguồn thị giác cho Gemini hoặc Offline AI. RAR/7Z tự bung khi chạy HNL Local nếu máy có tar/7-Zip.</div>
        <div class="doc-list">${state.docs.length ? state.docs.map(docItem).join('') : emptyLibraryHtml()}</div>
        <div class="source-rule">
          <label class="field compact-field"><span>Phạm vi hỏi đáp / tìm kiếm</span><select id="scopeSelect">
            <option value="all" ${state.settings.scope === 'all' ? 'selected' : ''}>Toàn bộ tài liệu đã tải</option>
            <option value="selected" ${state.settings.scope === 'selected' ? 'selected' : ''}>Chỉ tài liệu đã tick</option>
            <option value="active" ${state.settings.scope === 'active' ? 'selected' : ''}>Chỉ PDF đang mở</option>
          </select></label>
          <div class="coverage-line"><b>${esc(scopeLabel())}</b><small>Mặc định v1.4 quét tất cả trang có lớp chữ trước khi xếp hạng kết quả.</small></div>
          <label class="switch-row">
            <input id="strictSide" type="checkbox" ${state.settings.strict ? 'checked' : ''}>
            <span><b>Khóa nguồn</b><small>Không cho AI tự thêm nội dung ngoài PDF</small></span>
          </label>
        </div>
      </aside>

      <section class="viewer">
        <div class="viewer-toolbar">
          <div class="viewer-title-wrap">
            <span class="viewer-title">${doc ? esc(doc.standard || doc.name) : 'Trình đọc PDF'}</span>
            ${doc?.scannedLikely ? '<span class="warn-chip" title="PDF có rất ít lớp text">Có thể là PDF scan</span>' : ''}
          </div>
          <div class="viewer-controls">
            <button class="icon-btn" id="zoomOut" ${!doc ? 'disabled' : ''} title="Thu nhỏ">−</button>
            <button class="zoom-value" id="fitWidth" ${!doc ? 'disabled' : ''} title="Về kích thước mặc định">${Math.round(state.zoom * 100)}%</button>
            <button class="icon-btn" id="zoomIn" ${!doc ? 'disabled' : ''} title="Phóng to">＋</button>
            <span class="toolbar-divider"></span>
            <button class="icon-btn" id="prevPage" ${!doc ? 'disabled' : ''} title="Trang trước">‹</button>
            <input class="page-input" id="pageInput" value="${state.page}" ${!doc ? 'disabled' : ''} aria-label="Số trang">
            <span class="page-total">/ ${doc?.pageCount || 0}</span>
            <button class="icon-btn" id="nextPage" ${!doc ? 'disabled' : ''} title="Trang sau">›</button>
          </div>
        </div>
        ${doc ? viewerContentHtml(doc) : emptyViewerHtml()}
      </section>

      <aside class="assistant-panel">
        <div class="assistant-head">
          <div><div class="section-kicker">Kỹ thuật</div><h2>Trợ lý tiêu chuẩn</h2></div>
          <span class="mode-chip">${state.settings.provider === 'local' ? 'Tra nhanh' : esc(PROVIDERS[state.settings.provider]?.short)}</span>
        </div>
        <div class="tabs">${[
          ['summary', 'Tóm tắt'], ['chat', 'Hỏi đáp'], ['lookup', 'Tra cứu'], ['calc', 'Tính'], ['compare', 'So sánh'], ['checklist', 'Nghiệm thu'], ['settings', 'Cài đặt']
        ].map(([id, label]) => `<button class="tab ${state.tab === id ? 'active' : ''}" data-tab="${id}">${label}</button>`).join('')}</div>
        <div class="panel-body">${panelHtml()}</div>
      </aside>
    </main>

    <nav class="mobile-nav">
      <button data-mobile="library" class="${state.mobile === 'library' ? 'active' : ''}">Thư viện</button>
      <button data-mobile="viewer" class="${state.mobile === 'viewer' ? 'active' : ''}">PDF</button>
      <button data-mobile="assistant" class="${state.mobile === 'assistant' ? 'active' : ''}">Trợ lý</button>
    </nav>

    ${state.progress ? progressHtml() : ''}
    ${state.toast ? `<div class="toast ${state.toast.type}">${esc(state.toast.message)}</div>` : ''}
  </div>`;

  bind();
  if (doc) queueMicrotask(drawPage);
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
  return '<div class="canvas-wrap"><canvas id="pdfCanvas"></canvas></div>';
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
  return `<article class="doc-item ${active ? 'active' : ''}">
    <div class="doc-row">
      <input class="source-check" type="checkbox" data-select="${d.id}" ${selected ? 'checked' : ''} title="Chọn làm nguồn tra cứu">
      <button class="doc-main" data-open="${d.id}">
        <span class="pdf-badge">${d.viewerKind === 'image' ? 'IMG' : d.viewerKind === 'text' ? 'TXT' : 'PDF'}</span>
        <span class="doc-copy"><b>${esc(d.standard || d.name)}</b><small>${d.pageCount} ${d.viewerKind === 'image' ? 'ảnh' : 'trang'} · ${fmtBytes(d.size)}</small><em>${d.viewerKind === 'image' ? (d.ocrStatus === 'browser' ? 'OCR ảnh: có' : 'Ảnh: AI Vision') : `${(d.pages || []).filter(p => String(p.text || '').trim()).length}/${d.pageCount} trang đã lấy chữ · ${(d.textChars || 0).toLocaleString('vi-VN')} ký tự`}</em>${d.sourcePath && d.sourcePath !== d.name ? `<em>${esc(d.sourcePath)}</em>` : (d.scannedLikely ? '<em class="warn-text">Có thể cần OCR/AI Vision</em>' : '')}</span>
      </button>
      <button class="more-btn danger" data-delete="${d.id}" title="Xóa tài liệu">×</button>
    </div>
  </article>`;
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
  return `<div class="empty-panel"><b>Chưa có nguồn theo phạm vi hiện tại</b><p>Hãy tải tài liệu hoặc đổi “Phạm vi hỏi đáp / tìm kiếm”. Mặc định Toàn bộ tài liệu sẽ quét tất cả file đã tải để ${action}.</p></div>`;
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
      <div class="action-row"><button class="btn primary" id="aiSummary" ${state.busy ? 'disabled' : ''}>Tóm tắt PDF đang mở</button><button class="btn" id="aiSummaryAll" ${state.busy || !sourceDocs().length ? 'disabled' : ''}>Tóm tắt toàn bộ nguồn</button></div><div class="coverage-line"><b>${esc(scopeLabel())}</b><small>Tóm tắt toàn bộ nguồn sẽ quét mọi trang có lớp chữ trong phạm vi hiện tại.</small></div>
    </div>
    ${doc.scannedLikely ? '<div class="notice warning"><b>PDF có ít lớp text.</b> Hình vẫn xem được nhưng tra cứu chữ có thể thiếu. Bản này chưa OCR ảnh scan tự động.</div>' : ''}
    <div class="panel-section"><div class="panel-section-title"><h3>Cấu trúc nhận diện</h3><span>${summary.headings.length} mục</span></div>${summary.headings.slice(0, 18).map(x => sourceLine(x, doc)).join('') || '<div class="muted">Chưa nhận diện được đề mục rõ ràng.</div>'}</div>
    <div class="panel-section"><div class="panel-section-title"><h3>Điểm định lượng đáng chú ý</h3><span>${summary.important.length} điểm</span></div>${summary.important.slice(0, 12).map(x => sourceLine(x, doc)).join('') || '<div class="muted">Chưa nhận diện được nội dung định lượng.</div>'}</div>`;
}
function sourceLine(item, doc) {
  return `<div class="source-line"><button class="page-chip" data-jump="${item.page}" data-doc="${doc.id}">P.${item.page}</button><span>${esc(item.text)}</span></div>`;
}

function messageHtml(message) {
  const chips = (message.hits || []).slice(0, 8).map(h => `<button class="source-chip" data-hit-doc="${h.docId}" data-hit-page="${h.page}">${esc(h.standard || h.docName)} · P.${h.page}</button>`).join('');
  return `<div class="message ${message.role === 'user' ? 'user' : 'ai'}">
    <div class="message-label">${message.role === 'user' ? 'Bạn' : (state.settings.provider === 'local' ? 'Tra cứu cục bộ' : 'HNL AI')}</div>
    <div class="answer-text">${esc(message.text)}</div>
    ${chips ? `<div class="source-chips">${chips}</div>` : ''}
  </div>`;
}
function chatHtml() {
  const hasSources = sourceDocs().length > 0;
  return `<div class="chat-shell">
    <div class="chat-log">${state.chat.length ? state.chat.map(messageHtml).join('') : `<div class="chat-welcome"><div class="chat-orb">AI</div><h3>Hỏi trực tiếp tiêu chuẩn</h3><p>Câu trả lời luôn kèm các trang PDF đã được dùng làm nguồn.</p><div class="suggestions"><button data-suggest="Cọc PHC D600 cấp B có mômen uốn nứt bao nhiêu?">PHC D600 cấp B</button><button data-suggest="Điều kiện nghiệm thu lô cọc là gì?">Nghiệm thu lô cọc</button><button data-suggest="Giới hạn vết nứt bề mặt cọc là bao nhiêu?">Giới hạn vết nứt</button></div></div>`}</div>
    <div class="chat-composer"><textarea id="chatQuestion" placeholder="${hasSources ? 'Nhập câu hỏi theo tiêu chuẩn đang chọn…' : 'Chọn PDF làm nguồn trước…'}" ${!hasSources ? 'disabled' : ''}>${esc(state.chatDraft)}</textarea><button class="send-btn" id="askBtn" ${!hasSources || state.busy ? 'disabled' : ''}>${state.busy ? 'Đang xử lý…' : 'Gửi'}</button></div>
    <div class="composer-hint">Enter để gửi · Shift + Enter xuống dòng · ${state.settings.strict ? 'Khóa nguồn đang bật' : 'Cho phép giải thích ngoài nguồn'}</div>
  </div>`;
}

function lookupHtml() {
  const docs = sourceDocs();
  const resultHtml = state.lookup.hits.length
    ? state.lookup.hits.map(h => `<div class="search-result"><div class="search-result-head"><button class="source-chip" data-hit-doc="${h.docId}" data-hit-page="${h.page}">${esc(h.standard || h.docName)} · P.${h.page}</button><span>điểm ${h.score.toFixed(1)}</span></div><p>${esc(h.text.slice(0, 900))}</p></div>`).join('')
    : (state.lookup.query ? '<div class="empty-panel compact">Không tìm thấy nội dung phù hợp.</div>' : '');
  return `${docs.length ? '' : noSourceCard('tra cứu')}
    <div class="panel-section">
      <div class="panel-section-title"><h3>Tìm trong dữ liệu</h3><span>${docs.length} nguồn</span></div>
      <div class="coverage-line"><b>${esc(scopeLabel())}</b><small>${state.searchStats ? `Lần tìm gần nhất đã quét ${state.searchStats.textPages}/${state.searchStats.pages} trang · ${state.searchStats.chunks} đoạn.` : 'Mỗi lần tìm sẽ quét toàn bộ trang có lớp chữ trong phạm vi rồi mới xếp hạng.'}</small></div>
      <div class="search-box"><input id="lookupQuery" value="${esc(state.lookup.draft || state.lookup.query)}" placeholder="Ví dụ: sai lệch đường kính, vết nứt, D600 cấp B…"><button id="lookupBtn" ${!docs.length ? 'disabled' : ''}>Quét tất cả trang</button></div>
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

function calcHtml() {
  const r = state.tableResult || lookup7888(600, 'B');
  return `<div class="panel-section">
    <div class="panel-section-title"><h3>Sức kháng nén theo vật liệu</h3><span>Phụ lục B</span></div>
    <div class="notice">Công cụ hỗ trợ kiểm tra theo công thức của TCVN 7888:2014. Kết quả không thay thế hồ sơ thiết kế.</div>
    <div class="grid2">
      <label class="field"><span>Loại cọc</span><select id="cType"><option value="PHC">PHC / NPH</option><option value="PC">PC</option></select></label>
      <label class="field"><span>Cấp tải</span><select id="cClass"><option>A</option><option>AB</option><option selected>B</option><option>C</option></select></label>
      <label class="field"><span>D (mm)</span><input id="cDiameter" type="number" value="${r?.diameter || 600}" min="1"></label>
      <label class="field"><span>t (mm)</span><input id="cThickness" type="number" value="${r?.thickness || 90}" min="1"></label>
      <label class="field"><span>σcu (MPa)</span><input id="cCu" type="number" value="80" step="0.1"></label>
      <label class="field"><span>σce (MPa)</span><input id="cCe" type="number" value="8" step="0.1"></label>
    </div>
    <div class="action-row"><button class="btn" id="calcFill7888" ${sourceHas7888() ? '' : 'disabled'}>Nạp từ Bảng 1</button><button class="btn primary" id="calcBtn">Tính kết quả</button></div>
    <div id="calcResult"></div>
  </div>
  <div class="formula-card"><div class="formula">R<sub>aL</sub> = (σ<sub>cu</sub>/α − σ<sub>ce</sub>/4) × A<sub>0</sub></div><p>PC dùng α = 4; PHC/NPH dùng α = 3,5. App đồng thời hiển thị giá trị ngắn hạn và 80% giá trị ngắn hạn.</p><button class="source-chip" data-find="Phụ lục B">Mở nguồn trong PDF</button></div>`;
}

function compareHtml() {
  const docs = selectedDocs();
  return `<div class="panel-section"><div class="panel-section-title"><h3>So sánh nhiều tiêu chuẩn</h3><span>${docs.length} tài liệu</span></div>
    ${docs.length < 2 ? '<div class="notice warning">Hãy tick ít nhất 2 PDF trong Thư viện. Chế độ so sánh chỉ dùng các tài liệu được tick.</div>' : `<div class="selected-source-list">${docs.map(d => `<span>${esc(d.standard || d.name)}</span>`).join('')}</div>`}
    <label class="field"><span>Nội dung cần so sánh</span><textarea id="compareQuestion" placeholder="Ví dụ: So sánh yêu cầu nghiệm thu, giới hạn vết nứt và tần suất thử nghiệm.">${esc(state.compare.draft || state.compare.query)}</textarea></label>
    <button class="btn primary" id="compareBtn" ${docs.length < 2 || state.busy ? 'disabled' : ''}>So sánh nguồn</button>
    ${state.compare.text ? `<div class="compare-output"><div class="answer-text">${esc(state.compare.text)}</div>${sourceChipsHtml(state.compare.hits)}</div>` : ''}
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

function settingsHtml() {
  const provider = PROVIDERS[state.settings.provider];
  const options = Object.entries(PROVIDERS).map(([id, p]) => `<option value="${id}" ${id === state.settings.provider ? 'selected' : ''}>${esc(p.label)}</option>`).join('');
  const directNeedsKey = state.settings.connection === 'direct' && provider?.needsKey;
  const isOllama = state.settings.provider === 'ollama';
  const githubHttps = location.protocol === 'https:' && !isLocalHost();
  return `<div class="panel-section">
    <div class="panel-section-title"><h3>AI & kết nối</h3><span>${state.connectionStatus?.ok ? 'Sẵn sàng' : 'Chưa kiểm tra'}</span></div>
    <label class="field"><span>Nhà cung cấp</span><select id="providerSelect">${options}</select></label>
    ${state.settings.provider === 'local' ? `<div class="notice success"><b>Tra cứu nhanh không phải AI.</b><br>Chế độ này tìm kiếm cục bộ, không cần mạng nhưng không suy luận như mô hình ngôn ngữ. Muốn AI offline thật, chọn <b>HNL Offline AI · Ollama</b>.</div>` : `
      <div class="segmented"><button data-connection="direct" class="${state.settings.connection === 'direct' ? 'active' : ''}">Trực tiếp</button><button data-connection="bridge" class="${state.settings.connection === 'bridge' ? 'active' : ''}">HNL Bridge</button></div>
      <label class="field"><span>Model văn bản</span><div class="model-picker"><input id="modelInput" list="modelOptionsList" value="${esc(providerModel())}" placeholder="Chọn hoặc nhập tên model"><button class="btn compact-btn" id="refreshModels" type="button">↻ Model</button></div><datalist id="modelOptionsList">${state.modelOptions.map(m => `<option value="${esc(m)}"></option>`).join('')}</datalist><small>${esc(state.modelStatus || 'Bấm ↻ Model để lấy danh sách model khả dụng của tài khoản/máy.')}</small></label>
      ${isOllama ? `<label class="field"><span>Model đọc ảnh offline</span><input id="visionModelInput" value="${esc(state.settings.visionModel)}" placeholder="gemma3:4b"></label>` : ''}
      ${directNeedsKey ? `<label class="field"><span>API key · chỉ lưu trong phiên tab này</span><input id="apiKeyInput" type="password" value="${esc(currentApiKey())}" autocomplete="off" placeholder="Dán API key của bạn"></label>` : ''}
      ${state.settings.provider === 'gemini' ? `<div class="notice"><b>Gemini API:</b> vào Google AI Studio → API Keys → Create API key → Copy, sau đó dán vào ô trên. Không ghi key vào source GitHub. <a class="inline-link" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Mở trang API Keys</a></div>` : ''}
      ${isOllama && state.settings.connection === 'direct' ? `<label class="field"><span>Ollama URL</span><input id="ollamaInput" value="${esc(state.settings.ollamaUrl)}"></label>` : ''}
      ${isOllama && githubHttps ? `<div class="notice error"><b>Đây là nguyên nhân Offline AI trong video không chạy.</b><br>GitHub Pages là HTTPS nhưng Ollama trên máy là HTTP. Trình duyệt chặn kết nối này. Hãy chạy <b>START_HNL_OFFLINE_AI.bat</b> trong source và mở app tại <b>http://127.0.0.1:8787</b>.</div>` : ''}
      ${isOllama && isLocalHost() ? `<div class="notice success"><b>Đang ở chế độ Local.</b> Đây là môi trường đúng để dùng Ollama offline và đọc ảnh bằng model vision.</div>` : ''}
      ${state.settings.connection === 'bridge' ? `<label class="field"><span>HNL Bridge URL</span><input id="bridgeInput" value="${esc(state.settings.bridgeUrl)}"></label><div class="notice">Khi chạy Local, nên để Bridge cùng địa chỉ app, ví dụ http://127.0.0.1:8787.</div>` : ''}
    `}
    <label class="switch-row"><input id="strictInput" type="checkbox" ${state.settings.strict ? 'checked' : ''}><span><b>Khóa nguồn tài liệu</b><small>AI không được tự thêm quy định ngoài PDF/ảnh/text đã chọn.</small></span></label>
    <div class="action-row"><button class="btn primary" id="saveSettings">Lưu cài đặt</button><button class="btn" id="testConnection">Kiểm tra kết nối</button></div>
    ${state.connectionStatus ? `<div class="notice ${state.connectionStatus.ok ? 'success' : 'error'}"><b>${state.connectionStatus.ok ? 'Kết nối OK' : 'Kết nối lỗi'}</b><br>${esc(state.connectionStatus.message || '')}</div>` : ''}
  </div>
  <div class="panel-section"><div class="panel-section-title"><h3>Dữ liệu đầu vào</h3><span>v1.4</span></div><div class="capability-grid"><span>✓ PDF nhiều file</span><span>✓ ZIP tự bung</span><span>✓ Đọc cả thư mục</span><span>✓ Ảnh JPG/PNG/WebP</span><span>✓ TXT/CSV/JSON</span><span>✓ RAR/7Z ở HNL Local*</span><span>✓ Quét toàn bộ trang</span><span>✓ Nhiều model AI</span></div></div>
  <div class="panel-section"><div class="panel-section-title"><h3>Chẩn đoán ứng dụng</h3><span>v1.4</span></div><p class="muted">Kiểm tra bộ nhớ trình duyệt, tài liệu, nguồn đang chọn và cấu hình AI.</p><button class="btn" id="runDiagnostics">Chạy chẩn đoán</button>${state.diagnosticHtml}</div>`;
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
      if (el.id === 'sourceBadge') { state.mobile = 'library'; render(); return; }
      if (el.id === 'openSettings') { state.tab = 'settings'; state.mobile = 'assistant'; render(); return; }
      if (el.id === 'selectAll') { state.docs.forEach(d => state.selected.add(d.id)); showToast(`Đã chọn ${state.docs.length} tài liệu làm nguồn.`, 'success'); render(); return; }
      if (el.id === 'clearSelection') { state.selected.clear(); showToast(state.settings.scope === 'selected' ? 'Đã bỏ chọn nguồn. Phạm vi “Đã chọn” hiện không có tài liệu.' : 'Đã bỏ dấu tick. Phạm vi Toàn thư viện vẫn tra cứu tất cả tài liệu.', 'info'); render(); return; }
      if (el.matches('[data-open]')) { openDoc(el.dataset.open); return; }
      if (el.matches('[data-delete]')) { await removeDoc(el.dataset.delete); return; }
      if (el.id === 'prevPage') { jumpPage(state.page - 1); return; }
      if (el.id === 'nextPage') { jumpPage(state.page + 1); return; }
      if (el.id === 'zoomOut') { setZoom(state.zoom - 0.1); return; }
      if (el.id === 'zoomIn') { setZoom(state.zoom + 0.1); return; }
      if (el.id === 'fitWidth') { fitPageWidth(); return; }
      if (el.id === 'aiSummary') { await aiSummary(); return; }
      if (el.id === 'aiSummaryAll') { await aiSummaryAll(); return; }
      if (el.id === 'askBtn') { await askQuestion(); return; }
      if (el.matches('[data-suggest]')) {
        state.chatDraft = el.dataset.suggest || '';
        const q = document.querySelector('#chatQuestion');
        if (q) q.value = state.chatDraft;
        await askQuestion(state.chatDraft);
        return;
      }
      if (el.id === 'lookupBtn') { runLookup(); return; }
      if (el.id === 'tableLookupBtn') { runTableLookup(); return; }
      if (el.id === 'calcBtn') { runCalc(); return; }
      if (el.id === 'calcFill7888') { fillCalcFrom7888(); return; }
      if (el.id === 'compareBtn') { await runCompare(); return; }
      if (el.id === 'copyChecklist') { await copyChecklist(); return; }
      if (el.id === 'resetChecklist') { resetChecklist(); return; }
      if (el.id === 'aiChecklist') { await aiChecklist(); return; }
      if (el.matches('[data-connection]')) {
        state.settings.connection = el.dataset.connection;
        state.connectionStatus = null;
        render();
        return;
      }
      if (el.id === 'saveSettings') { updateSettingsFromForm(); return; }
      if (el.id === 'testConnection') { await testConnection(); return; }
      if (el.id === 'refreshModels') { await refreshModels(); return; }
      if (el.id === 'runDiagnostics') { await runDiagnostics(); return; }
      if (el.matches('[data-jump]')) {
        if (el.dataset.doc) state.activeDocId = el.dataset.doc;
        jumpPage(Number(el.dataset.jump));
        return;
      }
      if (el.matches('[data-find]')) { findInActive(el.dataset.find); return; }
      if (el.matches('[data-hit-doc]')) {
        state.activeDocId = el.dataset.hitDoc;
        state.page = Number(el.dataset.hitPage) || 1;
        state.mobile = 'viewer';
        render();
        return;
      }
    } catch (error) {
      console.error('HNL action error', error);
      showToast(`Không thực hiện được thao tác: ${error.message}`, 'error');
    }
  };

  app.onchange = event => {
    const el = event.target;
    if (el.id === 'dataInput' || el.id === 'folderInput') { uploadInputs(event); return; }
    if (el.matches('[data-select]')) { el.checked ? state.selected.add(el.dataset.select) : state.selected.delete(el.dataset.select); render(); return; }
    if (el.matches('[data-check]')) { updateChecklist(Number(el.dataset.check), el.checked); return; }
    if (el.id === 'strictSide') { state.settings.strict = el.checked; saveSettings(); render(); return; }
    if (el.id === 'scopeSelect') { state.settings.scope = el.value; state.searchStats = null; saveSettings(); showToast(`Phạm vi: ${scopeLabel()}.`, 'success'); render(); return; }
    if (el.id === 'pageInput') { jumpPage(Number(el.value)); return; }
    if (el.id === 'tableDiameter') { updateTableClassOptions(); return; }
    if (el.id === 'cType' || el.id === 'cClass') { syncCalcDefaults(); return; }
    if (el.id === 'providerSelect') { providerChanged(event); return; }
    if (el.id === 'strictInput') { state.settings.strict = el.checked; }
  };

  app.oninput = event => {
    const el = event.target;
    if (el.id === 'chatQuestion') state.chatDraft = el.value;
    else if (el.id === 'lookupQuery') state.lookup.draft = el.value;
    else if (el.id === 'compareQuestion') state.compare.draft = el.value;
    else if (el.id === 'modelInput') state.settings.model = el.value;
    else if (el.id === 'visionModelInput') state.settings.visionModel = el.value;
    else if (el.id === 'bridgeInput') state.settings.bridgeUrl = el.value;
    else if (el.id === 'ollamaInput') state.settings.ollamaUrl = el.value;
    else if (el.id === 'apiKeyInput') {
      const provider = state.settings.provider;
      if (el.value.trim()) sessionStorage.setItem(sessionKeyName(provider), el.value.trim());
      else sessionStorage.removeItem(sessionKeyName(provider));
    }
  };

  app.onkeydown = event => {
    if (event.isComposing) return;
    const el = event.target;
    if (el.id === 'pageInput' && event.key === 'Enter') { event.preventDefault(); jumpPage(Number(el.value)); return; }
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
}

function bindSourceButtons() { /* event delegation handles source buttons */ }

function openDoc(id) {
  state.activeDocId = id;
  state.page = 1;
  state.mobile = window.innerWidth <= 880 ? 'viewer' : state.mobile;
  render();
}
function setZoom(value) {
  state.zoom = Math.min(2.2, Math.max(0.55, Math.round(value * 100) / 100));
  render();
}
function fitPageWidth() {
  const wrap = document.querySelector('.canvas-wrap');
  const canvas = document.querySelector('#pdfCanvas');
  if (!wrap || !activeDoc()) return;
  if (activeDoc().viewerKind !== 'pdf') return setZoom(1.0);
  if (!canvas) return;
  const renderedWidth = parseFloat(canvas.style.width) || canvas.getBoundingClientRect().width;
  const available = Math.max(240, wrap.clientWidth - 48);
  if (!Number.isFinite(renderedWidth) || renderedWidth <= 0) return setZoom(1.08);
  setZoom(state.zoom * available / renderedWidth);
}
async function uploadInputs(event) {
  const raw = [...(event.target.files || [])];
  if (!raw.length) return showToast('Chưa chọn dữ liệu.', 'warning');
  const unsupportedArchives = raw.filter(f => /\.(rar|7z)$/i.test(f.name));
  let items = [];
  try {
    state.progress = { title: 'Đang quét dữ liệu', detail: `Đọc ${raw.length} mục…`, pct: 3 };
    render();
    items = await expandInputItems(raw.filter(f => !/\.(rar|7z)$/i.test(f.name)));
    if (unsupportedArchives.length) {
      if (!isLocalHost()) showToast('RAR/7Z chỉ tự bung trong HNL Local. Trên GitHub Pages hãy giải nén trước hoặc dùng ZIP.', 'warning');
      else {
        for (const archive of unsupportedArchives) {
          state.progress = { title:`Đang giải nén ${archive.name}`, detail:'Dùng tar/7-Zip cục bộ…', pct:5 }; render();
          const extracted = await extractArchiveViaLocalBridge(archive);
          const expanded = await expandInputItems(extracted.map(x => x.file));
          // Giữ đường dẫn archive cho các file không phải ZIP lồng nhau.
          const pathMap = new Map(extracted.map(x => [x.file.name, x.path]));
          items.push(...expanded.map(x => ({ ...x, path:pathMap.get(x.file.name) || x.path })));
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
      await saveDocument(doc);
      state.docs.push(doc); state.selected.add(doc.id); state.activeDocId = doc.id; state.page = 1; imported++;
    } catch (error) {
      failed++; console.error('Import failed', path, error);
    }
  }
  event.target.value = '';
  state.progress = null;
  state.mobile = window.innerWidth <= 880 ? 'assistant' : state.mobile;
  showToast(`Đã nhập ${imported} tài liệu${duplicated ? ` · ${duplicated} trùng` : ''}${failed ? ` · ${failed} lỗi` : ''}.`, failed ? 'warning' : 'success');
  render();
}
async function removeDoc(id) {
  const doc = state.docs.find(d => d.id === id);
  if (!doc || !confirm(`Xóa “${doc.standard || doc.name}” khỏi thư viện cục bộ?`)) return;
  try {
    await deleteDocument(id);
    clearPdfCache(id);
    clearSearchCache(id);
    state.docs = state.docs.filter(d => d.id !== id);
    state.selected.delete(id);
    if (state.activeDocId === id) { state.activeDocId = state.docs[0]?.id || null; state.page = 1; }
    showToast('Đã xóa tài liệu.', 'success');
  } catch (error) { showToast(`Không xóa được: ${error.message}`, 'error'); }
  render();
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
  const canvas = document.querySelector('#pdfCanvas');
  if (!canvas) return;
  try { await renderPdfPage(doc, state.page, canvas, state.zoom); }
  catch (error) { console.error(error); showToast(`Lỗi hiển thị PDF: ${error.message}`, 'error'); }
}
function jumpPage(page) {
  const doc = activeDoc();
  if (!doc) return;
  state.page = Math.min(Math.max(1, Number(page) || 1), doc.pageCount);
  state.mobile = window.innerWidth <= 880 ? 'viewer' : state.mobile;
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

async function getAnswer(question, docsOverride = null) {
  const docs = docsOverride || sourceDocs();
  if (!docs.length) throw new Error('Không có tài liệu trong phạm vi tìm kiếm hiện tại.');
  const textDocs = docs.filter(d => d.viewerKind !== 'image');
  const stats = corpusStats(textDocs);
  state.searchStats = stats;

  // IMPORTANT v1.4: smartSearchChunks scores the COMPLETE corpus first. The final
  // context limit is applied only after every page/chunk has been checked.
  const retrievalLimit = isBroadQuery(question) ? 56 : 40;
  let hits = smartSearchChunks(question, textDocs, retrievalLimit, { perDoc: isBroadQuery(question) ? 7 : 5 });

  const imageDocs = docs.filter(d => d.viewerKind === 'image').slice(0, 8);
  const images = [];
  for (const d of imageDocs) {
    if (d.size > 8 * 1024 * 1024) continue;
    try { images.push({ data: await fileToBase64(d.blob), mimeType: d.type || 'image/jpeg', name: d.name, docId: d.id }); } catch { /* skip */ }
  }

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

  if (images.length) {
    const imageHits = images.map((img, i) => { const d = imageDocs.find(x => x.id === img.docId); return ({ docId:d.id, docName:d.name, standard:d.standard, page:1, score:100-i, text:`Nguồn hình ảnh: ${d.name}. Đọc trực tiếp nội dung, chữ, bảng và ký hiệu nhìn thấy trong ảnh; không suy đoán phần không nhìn rõ.` }); });
    hits = [...imageHits, ...hits].slice(0, retrievalLimit + images.length);
  }

  if (!hits.length) {
    return { text: `Không tìm thấy nội dung phù hợp. Đã quét toàn bộ ${stats.textPages}/${stats.pages} trang có lớp chữ trong ${stats.docs} tài liệu (${stats.chunks} đoạn).`, hits: [], stats };
  }
  if (state.settings.provider === 'local') {
    if (images.length) return { text: `Tra cứu nhanh đã quét ${stats.textPages}/${stats.pages} trang chữ nhưng không đọc pixel ảnh. Hãy chọn HNL Offline AI (Ollama) hoặc Gemini để đọc ảnh trực tiếp.`, hits, stats };
    return { text: localAnswer(question, hits, stats), hits, stats };
  }

  const coverage = `\n\nTHỐNG KÊ PHẠM VI: hệ thống đã quét toàn bộ ${stats.textPages}/${stats.pages} trang có lớp chữ, ${stats.chunks} đoạn thuộc ${stats.docs} tài liệu trước khi chọn ngữ cảnh liên quan. Không được hiểu số đoạn ngữ cảnh bên dưới là số trang đã quét.`;
  const prompt = buildRagPrompt(question, hits, state.settings.strict) + coverage;
  let text;
  if (state.settings.connection === 'bridge') {
    text = await callBridge({ bridgeUrl: state.settings.bridgeUrl, provider: state.settings.provider, model: providerModel(images.length > 0), prompt, images });
  } else {
    text = await callDirect({ provider: state.settings.provider, model: providerModel(images.length > 0), apiKey: currentApiKey(), prompt, ollamaUrl: state.settings.ollamaUrl, images });
  }
  if (!text) throw new Error('AI không trả về nội dung.');
  return { text, hits, stats };
}

async function askQuestion(questionOverride = '') {
  const input = document.querySelector('#chatQuestion');
  const question = String(questionOverride || input?.value || state.chatDraft || '').trim();
  if (state.busy) return showToast('Đang xử lý câu hỏi trước.', 'warning');
  if (!question) return showToast('Hãy nhập câu hỏi trước khi gửi.', 'warning');
  if (!sourceDocs().length) return showToast('Hãy chọn hoặc mở ít nhất một PDF làm nguồn.', 'warning');
  state.chatDraft = '';
  state.chat.push({ role: 'user', text: question });
  state.chat.push({ role: 'ai', text: 'Đang tra cứu nguồn PDF…', hits: [] });
  state.busy = true;
  render();
  try {
    const answer = await getAnswer(question);
    state.chat[state.chat.length - 1] = { role: 'ai', text: answer.text, hits: answer.hits };
  } catch (error) {
    state.chat[state.chat.length - 1] = { role: 'ai', text: `Lỗi: ${error.message}`, hits: [] };
  } finally {
    state.busy = false;
    render();
    queueMicrotask(() => { const log = document.querySelector('.chat-log'); if (log) log.scrollTop = log.scrollHeight; });
  }
}

async function aiSummary() {
  const doc = activeDoc() || sourceDocs()[0];
  if (!doc || state.busy) return;
  state.tab = 'chat';
  state.chat.push({ role: 'user', text: `Tóm tắt ${doc.standard || doc.name}` });
  state.chat.push({ role: 'ai', text: 'Đang tạo tóm tắt…', hits: [] });
  state.busy = true;
  render();
  try {
    if (state.settings.provider === 'local') {
      const sum = localSummary(doc);
      const hits = [...sum.headings.slice(0, 8), ...sum.important.slice(0, 8)].map(x => ({ docId: doc.id, docName: doc.name, standard: doc.standard, page: x.page, text: x.text }));
      state.chat[state.chat.length - 1] = { role: 'ai', text: localSummaryText(doc), hits };
    } else {
      const answer = await getAnswer('Tóm tắt tiêu chuẩn theo góc nhìn kỹ sư cọc: phạm vi, phân loại, thông số bắt buộc, sai số, ngoại quan, phương pháp thử, nghiệm thu, bảo quản/vận chuyển và công thức. Mỗi ý phải có nguồn trang.', [doc]);
      state.chat[state.chat.length - 1] = { role: 'ai', text: answer.text, hits: answer.hits };
    }
  } catch (error) {
    state.chat[state.chat.length - 1] = { role: 'ai', text: `Lỗi: ${error.message}`, hits: [] };
  } finally { state.busy = false; render(); }
}

async function aiSummaryAll() {
  const docs = sourceDocs();
  if (!docs.length || state.busy) return showToast('Không có tài liệu trong phạm vi hiện tại.', 'warning');
  state.tab = 'chat';
  state.chat.push({ role:'user', text:`Tóm tắt toàn bộ ${docs.length} tài liệu trong ${scopeLabel()}` });
  state.chat.push({ role:'ai', text:'Đang quét toàn bộ trang và tổng hợp…', hits:[] });
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
      state.chat[state.chat.length-1] = { role:'ai', text:`Đã quét ${stats.textPages}/${stats.pages} trang có chữ trong ${stats.docs} tài liệu.\n\n${parts.join('\n\n')}`, hits };
    } else {
      const answer = await getAnswer('Tổng hợp TOÀN BỘ các tài liệu đang chọn theo từng tiêu chuẩn: phạm vi, yêu cầu kỹ thuật, số liệu/bảng quan trọng, công thức, phương pháp thử, nghiệm thu, bảo quản/vận chuyển và các điểm khác nhau. Không bỏ qua tài liệu nào có nội dung liên quan. Mỗi ý phải dẫn tên tài liệu và trang.', docs);
      state.chat[state.chat.length-1] = { role:'ai', text:answer.text, hits:answer.hits };
    }
  } catch (error) { state.chat[state.chat.length-1] = { role:'ai', text:`Lỗi: ${error.message}`, hits:[] }; }
  finally { state.busy=false; render(); }
}

function runLookup() {
  const input = document.querySelector('#lookupQuery');
  const query = String(input?.value || state.lookup.draft || '').trim();
  if (!query) return showToast('Nhập nội dung cần tìm trong PDF.', 'warning');
  const docs = sourceDocs().filter(d => d.viewerKind !== 'image');
  if (!docs.length) return showToast('Chưa có nguồn dữ liệu chữ để tra cứu.', 'warning');
  state.lookup.query = query;
  state.lookup.draft = query;

  // v1.4 page search scans EVERY page first, then ranks the matching pages.
  const stats = corpusStats(docs);
  state.searchStats = stats;
  let hits = searchEveryPage(query, docs, 100);

  if (query && sourceHas7888()) {
    const qNorm = query.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
    const dMatch = qNorm.match(/(?:^|\s)(?:d|phi|ø)?\s*(\d{3,4})(?:\s|$)/);
    const classMatch = qNorm.match(/(?:cap|loai)\s*(ab|a|b|c)(?:\s|$)/);
    if (dMatch && classMatch) {
      const row = lookup7888(Number(dMatch[1]), classMatch[1].toUpperCase());
      const doc = find7888Doc();
      if (row && doc) {
        const page = row.diameter <= 600 ? 10 : 11;
        const tableHit = {
          docId: doc.id, docName: doc.name, standard: doc.standard, page, score: 999,
          text: `Bảng 1 — D${row.diameter}, cấp ${row.loadClass}: t = ${row.thickness} mm; mômen uốn nứt ≥ ${row.crackMoment} kN·m; ứng suất hữu hiệu ${row.effectiveStress} MPa; bền cắt ≥ ${row.shearResistance} kN (áp dụng PHC); chiều dài ${row.lengthRange} m.`
        };
        hits = [tableHit, ...hits.filter(h => !(h.docId === tableHit.docId && h.page === tableHit.page))].slice(0, 100);
      }
    }
  }
  state.lookup.hits = hits;
  showToast(hits.length ? `Đã quét ${stats.textPages}/${stats.pages} trang và tìm thấy ${hits.length} trang liên quan.` : `Đã quét ${stats.textPages}/${stats.pages} trang nhưng chưa tìm thấy nội dung phù hợp.`, hits.length ? 'success' : 'warning');
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

function syncCalcDefaults() {
  const type = document.querySelector('#cType')?.value || 'PHC';
  const cls = document.querySelector('#cClass')?.value || 'B';
  const cu = document.querySelector('#cCu');
  const ce = document.querySelector('#cCe');
  if (cu) cu.value = type === 'PC' ? 60 : 80;
  if (ce) ce.value = loadClassSigmaCe[cls] ?? 8;
}
function fillCalcFrom7888() {
  const D = Number(document.querySelector('#cDiameter')?.value || 600);
  const cls = document.querySelector('#cClass')?.value || 'B';
  const row = lookup7888(D, cls);
  if (!row) return showToast('Không có tổ hợp này trong Bảng 1.', 'warning');
  document.querySelector('#cThickness').value = row.thickness;
  document.querySelector('#cCe').value = row.effectiveStress;
  showToast('Đã nạp chiều dày và ứng suất hữu hiệu từ Bảng 1.', 'success');
}
function runCalc() {
  const output = document.querySelector('#calcResult');
  if (!output) return;
  try {
    const type = document.querySelector('#cType').value;
    const D = Number(document.querySelector('#cDiameter').value);
    const t = Number(document.querySelector('#cThickness').value);
    const area = annulusAreaMm2({ diameterMm: D, thicknessMm: t });
    const alpha = type === 'PC' ? 4 : 3.5;
    const result = axialResistance({
      areaMm2: area,
      sigmaCu: document.querySelector('#cCu').value,
      sigmaCe: document.querySelector('#cCe').value,
      alpha
    });
    output.innerHTML = `<div class="calc-result"><div class="calc-main"><span>Sức chịu tải dài hạn</span><b>${result.longTermKn.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} kN</b></div><div class="metric-grid three"><div><span>A₀</span><b>${area.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} mm²</b></div><div><span>Ngắn hạn</span><b>${result.shortTermKn.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} kN</b></div><div><span>80% ngắn hạn</span><b>${result.recommendedMaxKn.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} kN</b></div></div><div class="footnote">α = ${alpha}; ứng suất quy đổi = ${result.stress.toFixed(3)} MPa. Luôn kiểm tra điều kiện áp dụng trong Phụ lục B.</div></div>`;
    showToast('Đã tính toán xong.', 'success');
    requestAnimationFrame(() => output.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  } catch (error) { output.innerHTML = `<div class="notice error">${esc(error.message)}</div>`; showToast(error.message, 'error'); }
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
  state.compare.text = 'Đang so sánh…';
  state.compare.hits = [];
  state.busy = true;
  render();
  try {
    if (state.settings.provider === 'local') {
      const result = localCompareText(query, docs);
      state.compare.text = result.text;
      state.compare.hits = result.hits;
    } else {
      const answer = await getAnswer(`So sánh các tài liệu theo yêu cầu sau. Tách từng tiêu chuẩn, chỉ ra điểm giống/khác có nguồn trang; nếu không đủ căn cứ thì nói rõ.\n\n${query}`, docs);
      state.compare.text = answer.text;
      state.compare.hits = answer.hits;
    }
  } catch (error) { state.compare.text = `Lỗi: ${error.message}`; }
  finally { state.busy = false; showToast(state.compare.text.startsWith('Lỗi:') ? 'So sánh gặp lỗi.' : 'Đã so sánh nguồn.', state.compare.text.startsWith('Lỗi:') ? 'error' : 'success'); render(); }
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
  state.chat.push({ role: 'user', text: 'Tạo checklist nghiệm thu từ tiêu chuẩn đang chọn' });
  state.chat.push({ role: 'ai', text: 'Đang trích checklist…', hits: [] });
  state.busy = true;
  render();
  try {
    const answer = await getAnswer('Trích checklist thực hành về hồ sơ, kiểm tra, thử nghiệm và nghiệm thu. Mỗi dòng phải có nguồn trang. Không thêm yêu cầu không có trong tài liệu.');
    state.chat[state.chat.length - 1] = { role: 'ai', text: answer.text, hits: answer.hits };
  } catch (error) { state.chat[state.chat.length - 1] = { role: 'ai', text: `Lỗi: ${error.message}`, hits: [] }; }
  finally { state.busy = false; render(); }
}

function providerChanged(event) {
  const provider = event.target.value;
  state.settings.provider = provider;
  state.settings.model = PROVIDERS[provider]?.model || '';
  state.modelOptions = [];
  state.modelStatus = '';
  if (provider === 'ollama' && isLocalHost()) { state.settings.connection = 'bridge'; state.settings.bridgeUrl = location.origin; }
  state.connectionStatus = null;
  render();
}
async function refreshModels() {
  if (state.settings.provider === 'local') return showToast('Tra cứu nhanh không dùng model AI.', 'info');
  readSettingsForm();
  state.modelStatus = 'Đang lấy danh sách model…';
  render();
  try {
    const models = await listAvailableModels({
      provider: state.settings.provider,
      connection: state.settings.connection,
      apiKey: currentApiKey(),
      bridgeUrl: state.settings.bridgeUrl,
      ollamaUrl: state.settings.ollamaUrl
    });
    state.modelOptions = models;
    if (models.length && !models.includes(state.settings.model)) state.settings.model = models.includes(PROVIDERS[state.settings.provider]?.model) ? PROVIDERS[state.settings.provider].model : models[0];
    state.modelStatus = models.length ? `Có ${models.length} model khả dụng. Có thể chọn trong ô phía trên.` : 'Không lấy được danh sách model; vẫn có thể nhập tên model thủ công.';
    saveSettings();
    showToast(models.length ? `Đã tải ${models.length} model.` : 'Không lấy được model động.', models.length ? 'success' : 'warning');
  } catch (error) {
    state.modelStatus = `Không lấy được danh sách: ${error.message}`;
    showToast(state.modelStatus, 'warning');
  }
  render();
}

function readSettingsForm() {
  const provider = document.querySelector('#providerSelect')?.value || state.settings.provider;
  state.settings.provider = provider;
  state.settings.model = document.querySelector('#modelInput')?.value.trim() || PROVIDERS[provider]?.model || '';
  state.settings.visionModel = document.querySelector('#visionModelInput')?.value.trim() || state.settings.visionModel || 'gemma3:4b';
  state.settings.bridgeUrl = document.querySelector('#bridgeInput')?.value.trim() || state.settings.bridgeUrl;
  state.settings.ollamaUrl = document.querySelector('#ollamaInput')?.value.trim() || state.settings.ollamaUrl;
  state.settings.strict = document.querySelector('#strictInput')?.checked ?? state.settings.strict;
  const apiKeyInput = document.querySelector('#apiKeyInput');
  if (apiKeyInput) {
    const value = apiKeyInput.value.trim();
    if (value) sessionStorage.setItem(sessionKeyName(provider), value);
    else sessionStorage.removeItem(sessionKeyName(provider));
  }
  saveSettings();
}
function updateSettingsFromForm() {
  readSettingsForm();
  state.connectionStatus = null;
  showToast('Đã lưu cài đặt.', 'success');
}
async function testConnection() {
  readSettingsForm();
  state.connectionStatus = null;
  render();
  try {
    let result;
    if (state.settings.provider === 'local') result = { ok: true, message: 'Tra cứu nhanh sẵn sàng. Đây không phải mô hình AI.' };
    else if (state.settings.provider === 'ollama' && location.protocol === 'https:' && !isLocalHost() && !/^https:\/\//i.test(state.settings.bridgeUrl || '')) {
      result = { ok: false, message: 'GitHub Pages HTTPS không thể kết nối ổn định tới Ollama/Bridge HTTP trên máy. Hãy chạy START_HNL_OFFLINE_AI.bat rồi mở http://127.0.0.1:8787.' };
    }
    else if (state.settings.connection === 'bridge') {
      const health = await bridgeHealth(state.settings.bridgeUrl);
      const configured = health.providers?.[state.settings.provider];
      result = { ok: Boolean(health.ok && configured !== false), message: configured === false ? `Bridge hoạt động nhưng chưa cấu hình key cho ${PROVIDERS[state.settings.provider].label}.` : 'HNL Bridge phản hồi bình thường.' };
    } else {
      result = await testDirectProvider({ provider: state.settings.provider, model: providerModel(), apiKey: currentApiKey(), ollamaUrl: state.settings.ollamaUrl });
    }
    state.connectionStatus = result;
  } catch (error) { state.connectionStatus = { ok: false, message: error.message }; }
  render();
}

async function runDiagnostics() {
  const tests = [];
  tests.push(['IndexedDB', 'indexedDB' in window, 'Bộ nhớ tài liệu cục bộ']);
  tests.push(['Web Crypto', Boolean(crypto?.subtle), 'Phát hiện PDF trùng']);
  tests.push(['Service Worker', 'serviceWorker' in navigator, 'PWA/cache cập nhật']);
  tests.push(['PDF thư viện', state.docs.length > 0, `${state.docs.length} tài liệu`]);
  tests.push(['Nguồn tra cứu', sourceDocs().length > 0, `${sourceDocs().length} nguồn`]);
  if (state.settings.provider !== 'local') {
    const ok = state.settings.connection === 'bridge' ? Boolean(state.settings.bridgeUrl) : (state.settings.provider === 'ollama' ? Boolean(state.settings.ollamaUrl) : Boolean(currentApiKey()));
    tests.push(['Cấu hình AI', ok, state.settings.connection === 'bridge' ? 'Bridge' : 'Trực tiếp']);
  }
  const passed = tests.filter(t => t[1]).length;
  state.diagnosticHtml = `<div class="diagnostic"><div class="diagnostic-score">${passed}/${tests.length} kiểm tra đạt</div>${tests.map(([name, ok, detail]) => `<div class="diagnostic-row ${ok ? 'ok' : 'bad'}"><span>${ok ? '✓' : '!'}</span><b>${esc(name)}</b><small>${esc(detail)}</small></div>`).join('')}</div>`;
  render();
}

(async function init() {
  try {
    state.docs = await getDocuments();
    state.docs.forEach(d => { if (!d.viewerKind) d.viewerKind = 'pdf'; state.selected.add(d.id); });
    state.activeDocId = state.docs[0]?.id || null;
  } catch (error) {
    console.warn(error);
    state.toast = { message: 'Không mở được thư viện cục bộ của trình duyệt.', type: 'error' };
  }
  render();
})();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      registration.update().catch(() => {});
    } catch { /* PWA is optional */ }
  });
}
