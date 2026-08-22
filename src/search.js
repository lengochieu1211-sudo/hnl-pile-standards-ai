const STOP = new Set('và là của cho được trong theo các một những với tại từ khi về hoặc có không để này đó trên dưới như thì bởi bằng do vào ra đến'.split(' '));

export function normalize(text = '') {
  return String(text)
    .toLocaleLowerCase('vi')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

export function tokenize(text = '') {
  return normalize(text)
    .replace(/[^a-z0-9.%+/-]+/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP.has(t));
}

export function buildChunks(doc, chunkSize = 1500, overlap = 260) {
  const chunks = [];
  for (const p of doc.pages || []) {
    const text = String(p.text || '').trim();
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

function scoreChunk(query, chunk) {
  const qTokens = tokenize(query);
  if (!qTokens.length) return 0;
  const textNorm = normalize(chunk.text);
  const words = tokenize(chunk.text);
  const freq = new Map();
  for (const word of words) freq.set(word, (freq.get(word) || 0) + 1);
  let score = 0;
  let matched = 0;
  for (const term of qTokens) {
    const f = freq.get(term) || 0;
    if (f) {
      matched++;
      score += 4 + Math.log2(1 + f);
      if (/^\d+(?:[.,]\d+)?$/.test(term)) score += 3;
    }
  }
  score += (matched / qTokens.length) * 12;
  const qNorm = normalize(query).replace(/\s+/g, ' ').trim();
  const flatText = textNorm.replace(/\s+/g, ' ');
  if (qNorm.length > 4 && flatText.includes(qNorm)) score += 28;

  // Engineering shorthand: D600 / Ø600 / phi 600 and load classes A/AB/B/C
  // must still match tables where OCR/text extraction separates the tokens.
  const diameter = qNorm.match(/(?:^|\s)(?:d|phi)?\s*(\d{3,4})(?:\s|$)/)?.[1];
  if (diameter && new RegExp(`(?:^|[^0-9])${diameter}(?:[^0-9]|$)`).test(textNorm)) score += 14;
  const loadClass = qNorm.match(/cap\s*(ab|a|b|c)(?:\s|$)/)?.[1];
  if (loadClass && new RegExp(`cap\s*(?:tai\s*)?${loadClass}(?:\s|$)`).test(flatText)) score += 14;

  const standardQuery = qNorm.match(/(?:tcvn|qcvn|astm|en|jis|bs)\s*[a-z0-9:/.-]+/i)?.[0];
  if (standardQuery && normalize(`${chunk.standard} ${chunk.docName}`).includes(normalize(standardQuery))) score += 10;
  return score;
}

export function searchChunks(query, docs, limit = 8) {
  if (!String(query || '').trim() || !Array.isArray(docs) || !docs.length) return [];
  const chunks = docs.flatMap(doc => buildChunks(doc));
  return chunks
    .map(chunk => ({ ...chunk, score: scoreChunk(query, chunk) }))
    .filter(x => x.score > 3)
    .sort((a, b) => b.score - a.score || a.page - b.page)
    .slice(0, limit);
}

function bestSentence(text, query) {
  const terms = tokenize(query);
  const sentences = String(text).split(/(?<=[.!?;:])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 18);
  if (!sentences.length) return String(text).slice(0, 520).trim();
  let best = sentences[0], bestScore = -1;
  for (const sentence of sentences) {
    const norm = normalize(sentence);
    const score = terms.reduce((n, t) => n + (norm.includes(t) ? 1 : 0), 0);
    if (score > bestScore) { best = sentence; bestScore = score; }
  }
  return best.slice(0, 720);
}

export function localAnswer(question, hits) {
  if (!hits.length) return 'Không tìm thấy nội dung phù hợp trong các tài liệu đang chọn.';
  const unique = [];
  const seen = new Set();
  for (const hit of hits) {
    const key = `${hit.docId}:${hit.page}:${bestSentence(hit.text, question).slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(hit);
    if (unique.length >= 6) break;
  }
  return `Tra cứu cục bộ tìm thấy ${unique.length} đoạn liên quan. Đây là trích xuất từ PDF, không phải nội dung AI suy diễn:\n\n${unique.map(h => `• ${bestSentence(h.text, question)}\n  [${h.standard || h.docName} · Trang ${h.page}]`).join('\n\n')}`;
}

export function localSummary(doc) {
  const lines = (doc.pages || [])
    .flatMap(p => String(p.text || '').split('\n').map(text => ({ page: p.page, text: text.trim() })))
    .filter(x => x.text.length > 4);
  const headingRx = /^(?:\d+(?:\.\d+)*\s+|phụ lục|mục lục|lời nói đầu|phạm vi|tài liệu viện dẫn|thuật ngữ|yêu cầu|phương pháp|nghiệm thu|ghi nhãn|bảo quản|vận chuyển)/i;
  const headings = lines.filter(x => headingRx.test(x.text) && x.text.length < 190).slice(0, 36);
  const importantRx = /(không nhỏ hơn|không lớn hơn|sai lệch|cho phép|bắt buộc|phải |được chấp nhận|không vượt quá|cường độ|tải trọng|mômen|vết nứt|hệ số an toàn|nghiệm thu|thí nghiệm)/i;
  const important = lines.filter(x => importantRx.test(x.text) && x.text.length < 460).slice(0, 24);
  return { headings, important };
}
