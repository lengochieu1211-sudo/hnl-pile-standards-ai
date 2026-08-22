import './styles.css';
import { parsePdf, renderPdfPage, clearPdfCache } from './pdf.js';
import { saveDocument, getDocuments, deleteDocument } from './db.js';
import { searchChunks, localSummary, localAnswer } from './search.js';
import { PROVIDERS, buildRagPrompt, callBridge, callDirect, bridgeHealth, testDirectProvider } from './ai.js';
import { annulusAreaMm2, axialResistance, loadClassSigmaCe, tcvn7888Checklist } from './calculators.js';
import { diameters7888, lookup7888, classesForDiameter7888 } from './tcvn7888.js';

const STORAGE = {
  provider: 'hnl.provider.v11',
  connection: 'hnl.connection.v11',
  model: 'hnl.model.v11',
  bridge: 'hnl.bridge.v11',
  ollama: 'hnl.ollama.v11',
  strict: 'hnl.strict.v11',
  checklist: 'hnl.checklist.v11'
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
  lookup: { query: '', hits: [] },
  compare: { query: '', text: '', hits: [] },
  tableResult: null,
  checklist: loadJson(STORAGE.checklist, {}),
  settings: {
    provider: localStorage.getItem(STORAGE.provider) || 'local',
    connection: localStorage.getItem(STORAGE.connection) || 'direct',
    model: localStorage.getItem(STORAGE.model) || '',
    bridgeUrl: localStorage.getItem(STORAGE.bridge) || 'http://127.0.0.1:8787',
    ollamaUrl: localStorage.getItem(STORAGE.ollama) || 'http://127.0.0.1:11434',
    strict: localStorage.getItem(STORAGE.strict) !== 'false'
  },
  progress: null,
  toast: null,
  busy: false,
  connectionStatus: null,
  diagnosticHtml: ''
};

if (!PROVIDERS[state.settings.provider]) state.settings.provider = 'local';
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
  const selected = selectedDocs();
  if (selected.length) return selected;
  const active = activeDoc();
  return active ? [active] : [];
}
function is7888(doc) {
  return Boolean(doc && (/TCVN\s*7888\s*:\s*2014/i.test(doc.standard || '') || /7888/.test(doc.name || '')));
}
function sourceHas7888() { return sourceDocs().some(is7888); }
function providerModel() { return state.settings.model || PROVIDERS[state.settings.provider]?.model || ''; }
function sessionKeyName(provider) { return `hnl.apiKey.${provider}`; }
function currentApiKey() { return sessionStorage.getItem(sessionKeyName(state.settings.provider)) || ''; }

function saveSettings() {
  localStorage.setItem(STORAGE.provider, state.settings.provider);
  localStorage.setItem(STORAGE.connection, state.settings.connection);
  localStorage.setItem(STORAGE.model, state.settings.model);
  localStorage.setItem(STORAGE.bridge, state.settings.bridgeUrl);
  localStorage.setItem(STORAGE.ollama, state.settings.ollamaUrl);
  localStorage.setItem(STORAGE.strict, String(state.settings.strict));
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
        <label class="upload-box" ${state.busy ? 'aria-disabled="true"' : ''}>
          <span class="upload-icon">＋</span>
          <span><b>Thêm PDF</b><small>1 hoặc nhiều tiêu chuẩn</small></span>
          <input id="pdfInput" type="file" accept="application/pdf,.pdf" multiple ${state.busy ? 'disabled' : ''}>
        </label>
        <div class="library-note">PDF được phân tích và lưu cục bộ trong trình duyệt này.</div>
        <div class="doc-list">${state.docs.length ? state.docs.map(docItem).join('') : emptyLibraryHtml()}</div>
        <div class="source-rule">
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
        ${doc ? '<div class="canvas-wrap"><canvas id="pdfCanvas"></canvas></div>' : emptyViewerHtml()}
      </section>

      <aside class="assistant-panel">
        <div class="assistant-head">
          <div><div class="section-kicker">Kỹ thuật</div><h2>Trợ lý tiêu chuẩn</h2></div>
          <span class="mode-chip">${state.settings.provider === 'local' ? 'Không AI' : esc(PROVIDERS[state.settings.provider]?.short)}</span>
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
function emptyViewerHtml() {
  return `<div class="empty-view">
    <img src="./hnl-mark-192.png" alt="HNL" />
    <h1>Đọc tiêu chuẩn nhanh hơn</h1>
    <p>Tải PDF để tra cứu đúng trang, hỏi đáp theo nguồn, kiểm tra bảng cọc và tính toán kỹ thuật.</p>
    <div class="feature-row"><span>PDF nhiều file</span><span>Citation theo trang</span><span>AI tùy chọn</span></div>
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
        <span class="pdf-badge">PDF</span>
        <span class="doc-copy"><b>${esc(d.standard || d.name)}</b><small>${d.pageCount} trang · ${fmtBytes(d.size)}</small>${d.scannedLikely ? '<em>Có thể cần OCR</em>' : ''}</span>
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
  return `<div class="empty-panel"><b>Chưa chọn nguồn</b><p>Chọn checkbox một PDF trong Thư viện để ${action}. Nếu không chọn, tài liệu đang mở sẽ được dùng tự động.</p></div>`;
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
      <div class="action-row"><button class="btn primary" id="aiSummary" ${state.busy ? 'disabled' : ''}>${state.settings.provider === 'local' ? 'Tạo tóm tắt cục bộ' : 'Tóm tắt bằng AI'}</button><button class="btn" data-find="nghiệm thu">Mở phần nghiệm thu</button></div>
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
    <div class="chat-composer"><textarea id="chatQuestion" placeholder="${hasSources ? 'Nhập câu hỏi theo tiêu chuẩn đang chọn…' : 'Chọn PDF làm nguồn trước…'}" ${!hasSources ? 'disabled' : ''}></textarea><button class="send-btn" id="askBtn" ${!hasSources || state.busy ? 'disabled' : ''}>Gửi</button></div>
    <div class="composer-hint">Ctrl + Enter để gửi · ${state.settings.strict ? 'Khóa nguồn đang bật' : 'Cho phép giải thích ngoài nguồn'}</div>
  </div>`;
}

function lookupHtml() {
  const docs = sourceDocs();
  const resultHtml = state.lookup.hits.length
    ? state.lookup.hits.map(h => `<div class="search-result"><div class="search-result-head"><button class="source-chip" data-hit-doc="${h.docId}" data-hit-page="${h.page}">${esc(h.standard || h.docName)} · P.${h.page}</button><span>điểm ${h.score.toFixed(1)}</span></div><p>${esc(h.text.slice(0, 900))}</p></div>`).join('')
    : (state.lookup.query ? '<div class="empty-panel compact">Không tìm thấy nội dung phù hợp.</div>' : '');
  return `${docs.length ? '' : noSourceCard('tra cứu')}
    <div class="panel-section">
      <div class="panel-section-title"><h3>Tìm trong PDF</h3><span>${docs.length} nguồn</span></div>
      <div class="search-box"><input id="lookupQuery" value="${esc(state.lookup.query)}" placeholder="Ví dụ: sai lệch đường kính, vết nứt, D600 cấp B…"><button id="lookupBtn" ${!docs.length ? 'disabled' : ''}>Tìm</button></div>
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
    <label class="field"><span>Nội dung cần so sánh</span><textarea id="compareQuestion" placeholder="Ví dụ: So sánh yêu cầu nghiệm thu, giới hạn vết nứt và tần suất thử nghiệm.">${esc(state.compare.query)}</textarea></label>
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
    <div class="action-row"><button class="btn" id="copyChecklist">Sao chép checklist</button><button class="btn" id="resetChecklist">Bỏ đánh dấu</button><button class="btn primary" id="aiChecklist" ${state.busy ? 'disabled' : ''}>Mở rộng bằng AI</button></div>
    <div class="footnote">Nguồn chính: Điều 8.2 và Phụ lục C. <button class="text-link" data-find="8.2 Hồ sơ nghiệm thu">Mở nguồn</button></div>
  </div>`;
}

function settingsHtml() {
  const provider = PROVIDERS[state.settings.provider];
  const options = Object.entries(PROVIDERS).map(([id, p]) => `<option value="${id}" ${id === state.settings.provider ? 'selected' : ''}>${esc(p.label)}</option>`).join('');
  const directNeedsKey = state.settings.connection === 'direct' && provider?.needsKey;
  const isOllama = state.settings.provider === 'ollama';
  return `<div class="panel-section">
    <div class="panel-section-title"><h3>AI & kết nối</h3><span>${state.connectionStatus?.ok ? 'Sẵn sàng' : 'Chưa kiểm tra'}</span></div>
    <label class="field"><span>Nhà cung cấp</span><select id="providerSelect">${options}</select></label>
    ${state.settings.provider === 'local' ? '<div class="notice success">Tra cứu cục bộ hoạt động ngay trên GitHub Pages và không cần API.</div>' : `
      <div class="segmented"><button data-connection="direct" class="${state.settings.connection === 'direct' ? 'active' : ''}">Trực tiếp</button><button data-connection="bridge" class="${state.settings.connection === 'bridge' ? 'active' : ''}">HNL Bridge</button></div>
      <label class="field"><span>Model</span><input id="modelInput" value="${esc(providerModel())}" placeholder="Tên model"></label>
      ${directNeedsKey ? `<label class="field"><span>API key · chỉ lưu trong phiên tab này</span><input id="apiKeyInput" type="password" value="${esc(currentApiKey())}" autocomplete="off" placeholder="Nhập API key của bạn"></label>` : ''}
      ${isOllama && state.settings.connection === 'direct' ? `<label class="field"><span>Ollama URL</span><input id="ollamaInput" value="${esc(state.settings.ollamaUrl)}"></label><div class="notice warning">Nếu mở từ GitHub Pages (HTTPS), trình duyệt có thể chặn Ollama chạy HTTP trên máy. Khi đó dùng Bridge hoặc chạy app bằng localhost.</div>` : ''}
      ${state.settings.connection === 'bridge' ? `<label class="field"><span>HNL Bridge URL</span><input id="bridgeInput" value="${esc(state.settings.bridgeUrl)}"></label><div class="notice">Bridge phù hợp khi muốn giữ API key ngoài trình duyệt. GitHub Pages chỉ là frontend tĩnh.</div>` : ''}
    `}
    <label class="switch-row"><input id="strictInput" type="checkbox" ${state.settings.strict ? 'checked' : ''}><span><b>Khóa nguồn PDF</b><small>AI không được tự thêm quy định ngoài tài liệu.</small></span></label>
    <div class="action-row"><button class="btn primary" id="saveSettings">Lưu cài đặt</button><button class="btn" id="testConnection" ${state.settings.provider === 'local' ? '' : ''}>Kiểm tra kết nối</button></div>
    ${state.connectionStatus ? `<div class="notice ${state.connectionStatus.ok ? 'success' : 'error'}"><b>${state.connectionStatus.ok ? 'Kết nối OK' : 'Kết nối lỗi'}</b><br>${esc(state.connectionStatus.message || '')}</div>` : ''}
  </div>
  <div class="panel-section"><div class="panel-section-title"><h3>Chẩn đoán ứng dụng</h3><span>v1.1</span></div><p class="muted">Kiểm tra nhanh bộ nhớ trình duyệt, PDF, nguồn đang chọn và cấu hình AI.</p><button class="btn" id="runDiagnostics">Chạy chẩn đoán</button>${state.diagnosticHtml}</div>`;
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
  document.querySelector('#pdfInput')?.addEventListener('change', uploadPdfs);
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { state.tab = b.dataset.tab; render(); });
  document.querySelectorAll('[data-mobile]').forEach(b => b.onclick = () => { state.mobile = b.dataset.mobile; render(); });
  document.querySelector('#sourceBadge')?.addEventListener('click', () => { state.mobile = 'library'; render(); });
  document.querySelector('#openSettings')?.addEventListener('click', () => { state.tab = 'settings'; state.mobile = 'assistant'; render(); });
  document.querySelector('#selectAll')?.addEventListener('click', () => { state.docs.forEach(d => state.selected.add(d.id)); render(); });
  document.querySelector('#clearSelection')?.addEventListener('click', () => { state.selected.clear(); render(); });
  document.querySelectorAll('[data-select]').forEach(c => c.onchange = () => { c.checked ? state.selected.add(c.dataset.select) : state.selected.delete(c.dataset.select); render(); });
  document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openDoc(b.dataset.open));
  document.querySelectorAll('[data-delete]').forEach(b => b.onclick = () => removeDoc(b.dataset.delete));
  bindSourceButtons();
  document.querySelector('#strictSide')?.addEventListener('change', e => { state.settings.strict = e.target.checked; saveSettings(); render(); });

  document.querySelector('#prevPage')?.addEventListener('click', () => jumpPage(state.page - 1));
  document.querySelector('#nextPage')?.addEventListener('click', () => jumpPage(state.page + 1));
  document.querySelector('#pageInput')?.addEventListener('change', e => jumpPage(Number(e.target.value)));
  document.querySelector('#pageInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') jumpPage(Number(e.target.value)); });
  document.querySelector('#zoomOut')?.addEventListener('click', () => setZoom(state.zoom - 0.1));
  document.querySelector('#zoomIn')?.addEventListener('click', () => setZoom(state.zoom + 0.1));
  document.querySelector('#fitWidth')?.addEventListener('click', fitPageWidth);

  document.querySelector('#aiSummary')?.addEventListener('click', aiSummary);
  document.querySelector('#askBtn')?.addEventListener('click', askQuestion);
  document.querySelector('#chatQuestion')?.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') askQuestion(); });
  document.querySelectorAll('[data-suggest]').forEach(b => b.onclick = () => { const q = document.querySelector('#chatQuestion'); if (q) { q.value = b.dataset.suggest; q.focus(); } });
  document.querySelector('#lookupBtn')?.addEventListener('click', runLookup);
  document.querySelector('#lookupQuery')?.addEventListener('keydown', e => { if (e.key === 'Enter') runLookup(); });
  document.querySelector('#tableDiameter')?.addEventListener('change', updateTableClassOptions);
  document.querySelector('#tableLookupBtn')?.addEventListener('click', runTableLookup);

  document.querySelector('#calcBtn')?.addEventListener('click', runCalc);
  document.querySelector('#calcFill7888')?.addEventListener('click', fillCalcFrom7888);
  document.querySelector('#cType')?.addEventListener('change', syncCalcDefaults);
  document.querySelector('#cClass')?.addEventListener('change', syncCalcDefaults);
  document.querySelector('#compareBtn')?.addEventListener('click', runCompare);

  document.querySelectorAll('[data-check]').forEach(c => c.onchange = () => updateChecklist(Number(c.dataset.check), c.checked));
  document.querySelector('#copyChecklist')?.addEventListener('click', copyChecklist);
  document.querySelector('#resetChecklist')?.addEventListener('click', resetChecklist);
  document.querySelector('#aiChecklist')?.addEventListener('click', aiChecklist);

  document.querySelector('#providerSelect')?.addEventListener('change', providerChanged);
  document.querySelectorAll('[data-connection]').forEach(b => b.onclick = () => { state.settings.connection = b.dataset.connection; state.connectionStatus = null; render(); });
  document.querySelector('#saveSettings')?.addEventListener('click', updateSettingsFromForm);
  document.querySelector('#testConnection')?.addEventListener('click', testConnection);
  document.querySelector('#runDiagnostics')?.addEventListener('click', runDiagnostics);
}

function bindSourceButtons() {
  document.querySelectorAll('[data-jump]').forEach(b => b.onclick = () => {
    if (b.dataset.doc) state.activeDocId = b.dataset.doc;
    jumpPage(Number(b.dataset.jump));
  });
  document.querySelectorAll('[data-find]').forEach(b => b.onclick = () => findInActive(b.dataset.find));
  document.querySelectorAll('[data-hit-doc]').forEach(b => b.onclick = () => {
    state.activeDocId = b.dataset.hitDoc;
    state.page = Number(b.dataset.hitPage) || 1;
    state.mobile = 'viewer';
    render();
  });
}

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
  if (!wrap || !canvas || !activeDoc()) return;
  const renderedWidth = parseFloat(canvas.style.width) || canvas.getBoundingClientRect().width;
  const available = Math.max(240, wrap.clientWidth - 48);
  if (!Number.isFinite(renderedWidth) || renderedWidth <= 0) return setZoom(1.08);
  setZoom(state.zoom * available / renderedWidth);
}
async function uploadPdfs(event) {
  const files = [...(event.target.files || [])].filter(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
  if (!files.length) return showToast('Không có file PDF hợp lệ.', 'warning');
  for (const file of files) {
    state.progress = { title: `Đang đọc ${file.name}`, detail: 'Khởi tạo PDF…', pct: 2 };
    render();
    try {
      const doc = await parsePdf(file, (page, total) => {
        state.progress = { title: `Đang phân tích ${file.name}`, detail: `Trang ${page}/${total}`, pct: Math.round(page / total * 100) };
        const detail = document.querySelector('.progress-detail');
        const bar = document.querySelector('.progress-bar > div');
        if (detail) detail.textContent = `Trang ${page}/${total}`;
        if (bar) bar.style.width = `${Math.round(page / total * 100)}%`;
      });
      const duplicate = state.docs.find(d => d.fingerprint && d.fingerprint === doc.fingerprint);
      if (duplicate) {
        clearPdfCache(doc.id);
        state.activeDocId = duplicate.id;
        state.selected.add(duplicate.id);
        showToast(`PDF “${file.name}” đã có trong thư viện.`, 'warning');
        continue;
      }
      await saveDocument(doc);
      state.docs.push(doc);
      state.selected.add(doc.id);
      state.activeDocId = doc.id;
      state.page = 1;
    } catch (error) {
      console.error(error);
      showToast(`Không đọc được ${file.name}: ${error.message}`, 'error');
    }
  }
  state.progress = null;
  state.mobile = window.innerWidth <= 880 ? 'assistant' : state.mobile;
  render();
}
async function removeDoc(id) {
  const doc = state.docs.find(d => d.id === id);
  if (!doc || !confirm(`Xóa “${doc.standard || doc.name}” khỏi thư viện cục bộ?`)) return;
  try {
    await deleteDocument(id);
    clearPdfCache(id);
    state.docs = state.docs.filter(d => d.id !== id);
    state.selected.delete(id);
    if (state.activeDocId === id) { state.activeDocId = state.docs[0]?.id || null; state.page = 1; }
    showToast('Đã xóa tài liệu.', 'success');
  } catch (error) { showToast(`Không xóa được: ${error.message}`, 'error'); }
  render();
}
async function drawPage() {
  const doc = activeDoc();
  const canvas = document.querySelector('#pdfCanvas');
  if (!doc || !canvas) return;
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
  if (!docs.length) throw new Error('Hãy chọn ít nhất một PDF làm nguồn.');
  let hits = searchChunks(question, docs, 12);
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
      hits = [tableHit, ...hits.filter(h => !(h.docId === tableHit.docId && h.page === tableHit.page))].slice(0, 12);
    }
  }
  if (!hits.length) return { text: 'Không tìm thấy nội dung phù hợp trong các tài liệu đang chọn.', hits: [] };
  if (state.settings.provider === 'local') return { text: localAnswer(question, hits), hits };

  const prompt = buildRagPrompt(question, hits, state.settings.strict);
  let text;
  if (state.settings.connection === 'bridge') {
    text = await callBridge({ bridgeUrl: state.settings.bridgeUrl, provider: state.settings.provider, model: providerModel(), prompt });
  } else {
    text = await callDirect({ provider: state.settings.provider, model: providerModel(), apiKey: currentApiKey(), prompt, ollamaUrl: state.settings.ollamaUrl });
  }
  if (!text) throw new Error('AI không trả về nội dung.');
  return { text, hits };
}

async function askQuestion() {
  const input = document.querySelector('#chatQuestion');
  const question = input?.value.trim();
  if (!question || state.busy) return;
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

function runLookup() {
  const input = document.querySelector('#lookupQuery');
  const query = input?.value.trim();
  state.lookup.query = query || '';
  let hits = query ? searchChunks(query, sourceDocs(), 16) : [];

  // Với câu tra kiểu D600 cấp B, bảng PDF thường bị tách text theo cột nên
  // search thuần văn bản có thể xếp sai trang. Bổ sung hit có cấu trúc từ
  // Bảng 1 nhưng chỉ khi chính TCVN 7888:2014 đang là nguồn.
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
        hits = [tableHit, ...hits.filter(h => !(h.docId === tableHit.docId && h.page === tableHit.page))].slice(0, 16);
      }
    }
  }
  state.lookup.hits = hits;
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
  } catch (error) { output.innerHTML = `<div class="notice error">${esc(error.message)}</div>`; }
}

function localCompareText(question, docs) {
  const parts = [];
  const allHits = [];
  for (const doc of docs) {
    const hits = searchChunks(question, [doc], 4);
    allHits.push(...hits);
    parts.push(`${doc.standard || doc.name}\n${hits.length ? hits.slice(0, 3).map(h => `• ${h.text.slice(0, 520).replace(/\n/g, ' ')} [Trang ${h.page}]`).join('\n') : '• Không tìm thấy đoạn phù hợp.'}`);
  }
  return { text: `SO SÁNH CỤC BỘ — không dùng AI\n\n${parts.join('\n\n')}\n\nApp chỉ đặt các đoạn liên quan cạnh nhau; không tự kết luận khác biệt khi chưa dùng AI.`, hits: allHits };
}
async function runCompare() {
  const docs = selectedDocs();
  const query = document.querySelector('#compareQuestion')?.value.trim();
  if (docs.length < 2 || !query || state.busy) return;
  state.compare.query = query;
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
  finally { state.busy = false; render(); }
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
  try { await navigator.clipboard.writeText(text); showToast('Đã sao chép checklist.', 'success'); }
  catch { showToast('Trình duyệt không cho phép sao chép tự động.', 'warning'); }
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
  state.connectionStatus = null;
  render();
}
function readSettingsForm() {
  const provider = document.querySelector('#providerSelect')?.value || state.settings.provider;
  state.settings.provider = provider;
  state.settings.model = document.querySelector('#modelInput')?.value.trim() || PROVIDERS[provider]?.model || '';
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
    if (state.settings.provider === 'local') result = { ok: true, message: 'Tra cứu cục bộ sẵn sàng, không cần kết nối AI.' };
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
    state.docs.forEach(d => state.selected.add(d.id));
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
