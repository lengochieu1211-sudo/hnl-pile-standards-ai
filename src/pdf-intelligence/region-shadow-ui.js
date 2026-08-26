import './region-shadow-ui.css';
import { getDocuments } from '../db.js';
import { inspectSelectedPdfRegionInShadow } from './region-selective-ocr.js';

const P31_NAME = 'P3.1 UI Integration Shadow';
const POPUP_TIMEOUT_MS = 180_000;
const DEEPOCR_TIMEOUT_MS = 150_000;
let selectionSequence = 0;
let activeDrag = null;

function esc(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function localShadowOrigin() {
  try {
    const host = String(location.hostname || '').toLowerCase();
    if (!['127.0.0.1', 'localhost', '::1'].includes(host)) return null;
    const basePort = Number(location.port || 0);
    if (!Number.isInteger(basePort) || basePort < 8787 || basePort > 8799) return null;
    return `http://127.0.0.1:${basePort + 1000}`;
  } catch {
    return null;
  }
}

function sourceRectFromBox(layer, box) {
  const lb = layer?.getBoundingClientRect?.();
  const bb = box?.getBoundingClientRect?.();
  if (!lb || !bb || !lb.width || !lb.height) return null;
  const x = Math.max(0, bb.left - lb.left);
  const y = Math.max(0, bb.top - lb.top);
  const width = Math.max(0, Math.min(lb.width - x, bb.width));
  const height = Math.max(0, Math.min(lb.height - y, bb.height));
  return width >= 14 && height >= 14 ? { x, y, width, height } : null;
}

function pointInLayer(layer, event) {
  const box = layer?.getBoundingClientRect?.();
  if (!box) return null;
  return {
    x: Math.max(0, Math.min(box.width, Number(event?.clientX || 0) - box.left)),
    y: Math.max(0, Math.min(box.height, Number(event?.clientY || 0) - box.top))
  };
}

function onPointerDownCapture(event) {
  const layer = event.target?.closest?.('.pdf-region-layer');
  const shell = layer?.closest?.('.pdf-region-selecting');
  if (!layer || !shell || event.button !== 0) return;
  const start = pointInLayer(layer, event);
  if (!start) return;
  activeDrag = { layer, shell, start, pointerId: event.pointerId, startedAt: Date.now() };
}

function routeLabel(value = '') {
  const key = String(value || '').toLowerCase();
  if (key === 'native' || key.includes('pdfjs-native')) return 'PDF.js Native';
  if (key === 'deepdoc-vietocr' || key.includes('deepdoc')) return 'DeepDoc/VietOCR';
  if (key === 'chromium-local-ocr' || key.includes('chromium')) return 'Local OCR';
  if (key === 'vision' || key.includes('vision')) return 'Vision';
  if (key === 'block' || key === 'none') return 'BLOCK';
  return value || '—';
}

function currentMethodLabel(value = '') {
  const key = String(value || '').toLowerCase();
  if (key === 'text-layer') return 'UI hiện tại · Text layer';
  if (key === 'local-ocr') return 'UI hiện tại · Local OCR';
  if (key === 'vision-ai') return 'UI hiện tại · Vision';
  return value ? `UI hiện tại · ${value}` : 'UI hiện tại · —';
}

function normalizedBboxFromSource(source = {}) {
  const n = source.sourceRectNorm;
  if (!n) return null;
  const x = Number(n.x), y = Number(n.y), w = Number(n.width), h = Number(n.height);
  if (![x, y, w, h].every(Number.isFinite)) return null;
  return [x, y, x + w, y + h].map(v => Math.max(0, Math.min(1, v)));
}

function compactCompare(value = '') {
  return String(value || '').normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('vi');
}

function renderPendingPanel(popup, source) {
  if (!popup?.isConnected) return;
  popup.querySelector('.pdf-shadow-meta')?.remove();
  const host = document.createElement('div');
  host.className = 'pdf-shadow-meta is-running';
  host.innerHTML = `
    <div class="pdf-shadow-head">
      <span class="pdf-shadow-badge">SHADOW P3.1</span>
      <strong>Đang benchmark vùng thật…</strong>
    </div>
    <div class="pdf-shadow-sub">${esc(currentMethodLabel(source?.method))} · không thay đổi dữ liệu Production</div>`;
  const actions = popup.querySelector('.pdf-selection-actions');
  if (actions) popup.insertBefore(host, actions);
  else popup.appendChild(host);
}

function renderShadowPanel(popup, source, report) {
  if (!popup?.isConnected) return;
  popup.querySelector('.pdf-shadow-meta')?.remove();

  const provenance = report?.provenance || {};
  const bbox = provenance.normalizedBbox || normalizedBboxFromSource(source);
  const bboxText = Array.isArray(bbox) && bbox.length === 4
    ? `[${bbox.map(v => Number(v).toFixed(4)).join(', ')}]`
    : '—';
  const selected = routeLabel(report?.selectedRoute || report?.result?.engine || 'block');
  const history = (report?.routeHistory || []).map(item => routeLabel(item?.engine)).filter(Boolean);
  const chain = history.length ? [...new Set(history)].join(' → ') : '—';
  const shadowText = String(report?.result?.text || '').trim();
  const currentText = String(source?.text || '').trim();
  const sameText = shadowText && currentText ? compactCompare(shadowText) === compactCompare(currentText) : null;
  const warnings = (report?.warnings || []).filter(Boolean).slice(0, 3);
  const successful = report?.status === 'SHADOW_RESULT';

  const host = document.createElement('div');
  host.className = `pdf-shadow-meta ${successful ? 'is-success' : 'is-review'}`;
  host.dataset.hnlP31 = '1';
  host.innerHTML = `
    <div class="pdf-shadow-head">
      <span class="pdf-shadow-badge">SHADOW P3.1</span>
      <strong>${esc(selected)}</strong>
      <span class="pdf-shadow-lock">KHÔNG GHI PRODUCTION</span>
    </div>
    <div class="pdf-shadow-grid">
      <span>Luồng hiện tại</span><b>${esc(currentMethodLabel(source?.method))}</b>
      <span>Shadow chọn</span><b>${esc(selected)}</b>
      <span>Provenance</span><b>P.${esc(source?.page || provenance.page || '—')} · bbox ${esc(bboxText)}</b>
      <span>Đã thử</span><b>${esc(chain)}</b>
      <span>Đối chiếu text</span><b>${sameText === true ? 'TRÙNG' : sameText === false ? 'KHÁC · REVIEW' : 'CHƯA SO SÁNH'}</b>
    </div>
    ${warnings.length ? `<div class="pdf-shadow-warning">${warnings.map(esc).join('<br>')}</div>` : ''}
    ${shadowText ? `<details class="pdf-shadow-details"><summary>Xem text Shadow</summary><pre>${esc(shadowText.slice(0, 12000))}</pre><button type="button" class="pdf-shadow-copy">Copy text Shadow</button></details>` : ''}
  `;
  const actions = popup.querySelector('.pdf-selection-actions');
  if (actions) popup.insertBefore(host, actions);
  else popup.appendChild(host);
  host.querySelector('.pdf-shadow-copy')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shadowText);
      const button = host.querySelector('.pdf-shadow-copy');
      if (button) { button.textContent = 'Đã copy'; setTimeout(() => { if (button.isConnected) button.textContent = 'Copy text Shadow'; }, 1200); }
    } catch { /* clipboard is best-effort in shadow UI */ }
  });
}

async function waitForCurrentRegionPopup({ startedAt, page, token }) {
  const deadline = Date.now() + POPUP_TIMEOUT_MS;
  while (Date.now() < deadline && token === selectionSequence) {
    const popup = document.querySelector('.pdf-selection-popup');
    const source = popup?._hnlSource;
    const created = Date.parse(source?.createdAt || '') || 0;
    if (popup && source?.image?.data && Number(source?.page || 0) === Number(page || 0) && created >= startedAt - 1500) {
      return { popup, source };
    }
    await sleep(120);
  }
  return null;
}

async function callDeepDocShadow(image, meta = {}) {
  const origin = localShadowOrigin();
  if (!origin) return { available: false, code: 'DEEPOCR_SHADOW_SERVICE_NOT_LOCAL', message: 'DeepDoc Shadow chỉ chạy trong HNL Desktop/localhost.' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEEPOCR_TIMEOUT_MS);
  try {
    const response = await fetch(`${origin}/api/pdf-intelligence/region-ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        image,
        page: Number(meta.page) || 0,
        fingerprint: meta.fingerprint || null,
        regionKind: meta.regionKind || 'auto'
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { available: false, code: data?.code || `HTTP_${response.status}`, message: data?.message || data?.error || `HTTP ${response.status}` };
    }
    return data;
  } catch (error) {
    return {
      available: false,
      code: error?.name === 'AbortError' ? 'DEEPOCR_SHADOW_TIMEOUT' : 'DEEPOCR_SHADOW_UNAVAILABLE',
      message: error?.name === 'AbortError' ? 'DeepDoc Shadow timeout.' : String(error?.message || error)
    };
  } finally {
    clearTimeout(timer);
  }
}

async function findDocument(source) {
  try {
    const docs = await getDocuments();
    return docs.find(doc => doc?.id === source?.docId) || null;
  } catch {
    return null;
  }
}

function safePublicReport(report, source) {
  return {
    p31: P31_NAME,
    status: report?.status || 'UNKNOWN',
    selectedRoute: report?.selectedRoute || null,
    promotionState: report?.promotionState || 'SHADOW_ONLY',
    productionMutationAllowed: false,
    page: Number(source?.page || report?.page || 0),
    provenance: report?.provenance || null,
    routeHistory: report?.routeHistory || [],
    warnings: report?.warnings || [],
    result: report?.result ? {
      engine: report.result.engine || null,
      text: String(report.result.text || ''),
      quality: report.result.quality || null
    } : null,
    currentUiMethod: source?.method || null,
    createdAt: new Date().toISOString()
  };
}

async function benchmarkRealSelection({ token, startedAt, page, shell, rect }) {
  const current = await waitForCurrentRegionPopup({ startedAt, page, token });
  if (!current || token !== selectionSequence) return;
  const { popup, source } = current;
  renderPendingPanel(popup, source);

  const doc = await findDocument(source);
  const liveShell = shell?.isConnected ? shell : [...document.querySelectorAll('.pdf-page-shell')]
    .find(item => Number(item.dataset.page || 0) === Number(page || 0));
  const canvas = liveShell?.querySelector('canvas');
  const textLayer = liveShell?.querySelector('.pdf-text-layer');
  if (!doc?.blob || !canvas || !textLayer) {
    const report = {
      status: 'BLOCK', selectedRoute: 'block', promotionState: 'SHADOW_ONLY', productionMutationAllowed: false,
      page, routeHistory: [], warnings: ['Không lấy được PDF blob/canvas/text-layer thật để chạy P3.1 Shadow.'], result: null,
      provenance: { fingerprint: doc?.fingerprint || null, page, normalizedBbox: normalizedBboxFromSource(source), engine: 'none', route: 'block', status: 'BLOCK' }
    };
    renderShadowPanel(popup, source, report);
    return;
  }

  // If the current UI already used Vision after explicit consent, P3.1 reuses
  // that text as the final shadow fallback. It never sends the region twice.
  const visionRegionOcr = source.method === 'vision-ai'
    ? async () => ({ text: String(source.text || ''), confidence: null, confidenceUsable: false, reusedExistingVision: true })
    : null;
  const deepDocRegionOcr = localShadowOrigin() ? callDeepDocShadow : null;

  let report;
  try {
    report = await inspectSelectedPdfRegionInShadow({
      doc,
      pageNumber: Number(page) || 1,
      canvas,
      textLayer,
      rect,
      mode: 'shadow',
      regionKind: 'auto',
      deepDocRegionOcr,
      visionRegionOcr,
      allowChromiumFallback: true
    });
  } catch (error) {
    report = {
      status: 'BLOCK', selectedRoute: 'block', promotionState: 'SHADOW_ONLY', productionMutationAllowed: false,
      page, routeHistory: [], warnings: [String(error?.message || error)], result: null,
      provenance: { fingerprint: doc.fingerprint || null, page, normalizedBbox: normalizedBboxFromSource(source), engine: 'none', route: 'block', status: 'BLOCK' }
    };
  }

  if (token !== selectionSequence) return;
  const publicReport = safePublicReport(report, source);
  window.__HNL_PDF_SHADOW_LAST__ = publicReport;
  window.dispatchEvent(new CustomEvent('hnl:p31-shadow-result', { detail: publicReport }));
  renderShadowPanel(popup, source, report);
}

function onPointerUpCapture(event) {
  const layer = event.target?.closest?.('.pdf-region-layer');
  if (!layer || !layer.closest('.pdf-region-selecting')) return;
  const shell = layer.closest('.pdf-page-shell');
  const box = layer.querySelector('.pdf-region-box');
  let rect = null;
  let startedAt = Date.now();
  if (activeDrag?.layer === layer && (activeDrag.pointerId == null || activeDrag.pointerId === event.pointerId)) {
    const end = pointInLayer(layer, event);
    const start = activeDrag.start;
    startedAt = activeDrag.startedAt || startedAt;
    if (end && start) {
      rect = {
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y)
      };
      if (rect.width < 14 || rect.height < 14) rect = null;
    }
  }
  activeDrag = null;
  rect ||= sourceRectFromBox(layer, box);
  if (!shell || !rect) return;
  const page = Number(shell.dataset.page || 0);
  const token = ++selectionSequence;
  setTimeout(() => benchmarkRealSelection({ token, startedAt, page, shell, rect }).catch(() => {}), 0);
}

function install() {
  if (window.__HNL_P31_REGION_SHADOW_INSTALLED__) return;
  window.__HNL_P31_REGION_SHADOW_INSTALLED__ = true;
  document.documentElement.dataset.hnlPdfShadow = 'p3.1';
  document.addEventListener('pointerdown', onPointerDownCapture, true);
  document.addEventListener('pointerup', onPointerUpCapture, true);
  document.addEventListener('pointercancel', () => { activeDrag = null; }, true);
}

const disabled = new URLSearchParams(location.search).get('pdfshadow') === 'off';
if (!disabled) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
}
