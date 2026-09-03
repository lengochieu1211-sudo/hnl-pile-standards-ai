const ACCEPT = [
  '.pdf','.docx','.xlsx','.xlsm',
  '.zip','.rar','.7z','.tar','.tgz','.gz','.bz2','.xz',
  '.png','.jpg','.jpeg','.webp','.bmp','.gif',
  '.txt','.md','.csv','.json','.xml','.html','.htm','.yaml','.yml'
].join(',');

const LABEL = 'PDF · Word DOCX · Excel XLSX/XLSM · ảnh · ZIP · TXT/CSV/JSON';

function syncDocumentInputUi() {
  const input = document.querySelector('#dataInput');
  if (input && input.getAttribute('accept') !== ACCEPT) {
    input.setAttribute('accept', ACCEPT);
    input.setAttribute('title', 'Nguồn hỗ trợ: PDF, DOCX, XLSX/XLSM, ảnh, ZIP và file văn bản. DOC/XLS cũ cần Save As sang DOCX/XLSX.');
  }
  const label = input?.closest('.upload-box')?.querySelector('small');
  if (label && label.textContent !== LABEL) label.textContent = LABEL;
}

let queued = false;
function queueSync() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    syncDocumentInputUi();
  });
}

if (typeof document !== 'undefined') {
  syncDocumentInputUi();
  const observer = new MutationObserver(queueSync);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('beforeunload', () => observer.disconnect(), { once: true });
}

export { ACCEPT as DOCUMENT_INPUT_ACCEPT, LABEL as DOCUMENT_INPUT_LABEL, syncDocumentInputUi };
