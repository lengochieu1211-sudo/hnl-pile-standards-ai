const STOP = new Set('và là của cho được trong theo các một những với tại từ khi về hoặc có không để này đó trên dưới như thì bởi bằng do vào ra đến'.split(' '));

export function tokenize(text = '') {
  return text
    .toLocaleLowerCase('vi')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9.%/-]+/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP.has(t));
}

export function buildChunks(doc, chunkSize = 1600, overlap = 260) {
  const chunks = [];
  for (const p of doc.pages) {
    const text = (p.text || '').trim();
    if (!text) continue;
    if (text.length <= chunkSize) {
      chunks.push({ docId: doc.id, docName: doc.name, standard: doc.standard, page: p.page, text });
      continue;
    }
    let start = 0;
    while (start < text.length) {
      const end = Math.min(text.length, start + chunkSize);
      chunks.push({ docId: doc.id, docName: doc.name, standard: doc.standard, page: p.page, text: text.slice(start, end) });
      if (end >= text.length) break;
      start = Math.max(start + 1, end - overlap);
    }
  }
  return chunks;
}

export function searchChunks(query, docs, limit = 8) {
  const q = tokenize(query);
  const qRaw = query.toLocaleLowerCase('vi');
  const chunks = docs.flatMap(buildChunks);
  return chunks
    .map(chunk => {
      const textNorm = chunk.text.toLocaleLowerCase('vi');
      const tokens = tokenize(chunk.text);
      const freq = new Map();
      for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
      let score = 0;
      for (const term of q) {
        const f = freq.get(term) || 0;
        if (f) score += 3 + Math.log2(1 + f);
      }
      if (qRaw.length > 4 && textNorm.includes(qRaw)) score += 18;
      const standardQuery = qRaw.match(/(?:tcvn|qcvn|astm|en|jis|bs)[^\n,;]*/i)?.[0];
      if (standardQuery && `${chunk.standard} ${chunk.docName}`.toLowerCase().includes(standardQuery.trim())) score += 8;
      return { ...chunk, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function localSummary(doc) {
  const lines = doc.pages.flatMap(p => p.text.split('\n').map(text => ({ page: p.page, text: text.trim() }))).filter(x => x.text.length > 4);
  const headingRx = /^(?:\d+(?:\.\d+)*\s+|phụ lục|mục lục|lời nói đầu|phạm vi|tài liệu viện dẫn|thuật ngữ|yêu cầu|phương pháp|nghiệm thu|ghi nhãn|bảo quản|vận chuyển)/i;
  const headings = lines.filter(x => headingRx.test(x.text) && x.text.length < 180).slice(0, 24);
  const importantRx = /(không nhỏ hơn|không lớn hơn|sai lệch|cho phép|bắt buộc|phải |được chấp nhận|không vượt quá|cường độ|tải trọng|mômen|vết nứt|hệ số an toàn)/i;
  const important = lines.filter(x => importantRx.test(x.text) && x.text.length < 360).slice(0, 16);
  return { headings, important };
}
