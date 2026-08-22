const CHUNK_CACHE = new Map();

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

/**
 * Build chunks from EVERY text-bearing page in a document.
 * No page is skipped because of a global result limit; limits are applied only
 * after all pages/chunks have been scored.
 */
export function buildChunks(doc, chunkSize = 1400, overlap = 280) {
  const useCache = chunkSize === 1400 && overlap === 280 && doc?.id;
  const signature = `${doc?.pageCount || doc?.pages?.length || 0}:${doc?.textChars || (doc?.pages || []).reduce((n,p)=>n+String(p.text||'').length,0)}`;
  if (useCache) {
    const cached = CHUNK_CACHE.get(doc.id);
    if (cached?.signature === signature) return cached.chunks;
  }
  const chunks = [];
  for (const p of doc.pages || []) {
    const text = String(p.text || '').trim();
    if (!text) continue;
    if (text.length <= chunkSize) {
      chunks.push({ docId: doc.id, docName: doc.name, standard: doc.standard, page: p.page, chunk: 0, text });
      continue;
    }
    let start = 0;
    let chunk = 0;
    while (start < text.length) {
      let end = Math.min(text.length, start + chunkSize);
      if (end < text.length) {
        // Prefer cutting on a sentence/newline so formulas/tables are less likely
        // to be split in the middle. Fall back to the fixed boundary.
        const window = text.slice(start, end);
        const candidates = [window.lastIndexOf('\n'), window.lastIndexOf('. '), window.lastIndexOf('; ')];
        const best = Math.max(...candidates);
        if (best > chunkSize * 0.58) end = start + best + 1;
      }
      chunks.push({ docId: doc.id, docName: doc.name, standard: doc.standard, page: p.page, chunk: chunk++, text: text.slice(start, end).trim() });
      if (end >= text.length) break;
      start = Math.max(start + 1, end - overlap);
    }
  }
  if (useCache) CHUNK_CACHE.set(doc.id, { signature, chunks });
  return chunks;
}

export function clearSearchCache(docId = null) { if (docId) CHUNK_CACHE.delete(docId); else CHUNK_CACHE.clear(); }

export function corpusStats(docs = []) {
  let pages = 0, textPages = 0, chars = 0, chunks = 0;
  const byDoc = [];
  for (const doc of docs || []) {
    const docPages = doc.pages?.length || doc.pageCount || 0;
    const docTextPages = (doc.pages || []).filter(p => String(p.text || '').trim()).length;
    const docChars = (doc.pages || []).reduce((n, p) => n + String(p.text || '').length, 0);
    const docChunks = buildChunks(doc).length;
    pages += docPages; textPages += docTextPages; chars += docChars; chunks += docChunks;
    byDoc.push({ docId: doc.id, name: doc.name, standard: doc.standard, pages: docPages, textPages: docTextPages, chars: docChars, chunks: docChunks });
  }
  return { docs: docs.length, pages, textPages, chars, chunks, byDoc };
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
  score += (matched / qTokens.length) * 16;

  const qNorm = normalize(query).replace(/\s+/g, ' ').trim();
  const flatText = textNorm.replace(/\s+/g, ' ');
  if (qNorm.length > 4 && flatText.includes(qNorm)) score += 34;

  // Reward adjacent query-token pairs. This helps clauses and table labels even
  // when PDF extraction inserts extra spaces/newlines.
  for (let i = 0; i < qTokens.length - 1; i++) {
    const a = qTokens[i], b = qTokens[i + 1];
    if (flatText.includes(`${a} ${b}`)) score += 5;
  }

  // Engineering shorthand: D600 / Ø600 / phi 600 and load classes A/AB/B/C.
  const diameter = qNorm.match(/(?:^|\s)(?:d|phi)?\s*(\d{3,4})(?:\s|$)/)?.[1];
  if (diameter && new RegExp(`(?:^|[^0-9])${diameter}(?:[^0-9]|$)`).test(textNorm)) score += 16;
  const loadClass = qNorm.match(/(?:cap|loai)\s*(ab|a|b|c)(?:\s|$)/)?.[1];
  if (loadClass && new RegExp(`(?:cap\\s*(?:tai\\s*)?|loai\\s*)${loadClass}(?:\\s|$)`).test(flatText)) score += 14;

  const standardQuery = qNorm.match(/(?:tcvn|qcvn|astm|en|jis|bs)\s*[a-z0-9:/.-]+/i)?.[0];
  if (standardQuery && normalize(`${chunk.standard} ${chunk.docName}`).includes(normalize(standardQuery))) score += 12;

  // Prefer chunks where most unique query terms are covered, not one term many times.
  if (matched === qTokens.length && qTokens.length > 1) score += 18;
  return score;
}

/** Score the complete corpus, then limit. */
export function searchChunks(query, docs, limit = 12) {
  if (!String(query || '').trim() || !Array.isArray(docs) || !docs.length) return [];
  const chunks = docs.flatMap(doc => buildChunks(doc));
  return chunks
    .map(chunk => ({ ...chunk, score: scoreChunk(query, chunk) }))
    .filter(x => x.score > 3)
    .sort((a, b) => b.score - a.score || a.docName.localeCompare(b.docName) || a.page - b.page || a.chunk - b.chunk)
    .slice(0, limit);
}

/**
 * Page-level search used by the "Tra cứu" tab. It scans every page in every
 * selected document, keeping the best chunk score for that page. This means a
 * query is never stopped after the first N pages.
 */
export function searchEveryPage(query, docs, limit = 80) {
  if (!String(query || '').trim() || !Array.isArray(docs) || !docs.length) return [];
  const expanded = expandEngineeringQuery(query);
  const all = docs.flatMap(doc => buildChunks(doc))
    .map(chunk => ({ ...chunk, score: scoreChunk(expanded, chunk) }))
    .filter(x => x.score > 3);
  const bestByPage = new Map();
  for (const hit of all) {
    const key = `${hit.docId}:${hit.page}`;
    const old = bestByPage.get(key);
    if (!old || hit.score > old.score) bestByPage.set(key, hit);
  }
  return [...bestByPage.values()]
    .sort((a, b) => b.score - a.score || a.docName.localeCompare(b.docName) || a.page - b.page)
    .slice(0, limit);
}

function bestSentence(text, query) {
  const terms = tokenize(query);
  const sentences = String(text).split(/(?<=[.!?;:])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 18);
  if (!sentences.length) return String(text).slice(0, 700).trim();
  let best = sentences[0], bestScore = -1;
  for (const sentence of sentences) {
    const norm = normalize(sentence);
    const score = terms.reduce((n, t) => n + (norm.includes(t) ? 1 : 0), 0);
    if (score > bestScore) { best = sentence; bestScore = score; }
  }
  return best.slice(0, 900);
}

export function localAnswer(question, hits, stats = null) {
  if (!hits.length) {
    const scanned = stats ? ` Đã quét ${stats.textPages}/${stats.pages} trang có thể đọc chữ trong ${stats.docs} tài liệu.` : '';
    return `Không tìm thấy nội dung phù hợp trong các tài liệu đang chọn.${scanned}`;
  }
  const unique = [];
  const seen = new Set();
  for (const hit of hits) {
    const sentence = bestSentence(hit.text, question);
    const key = `${hit.docId}:${hit.page}:${sentence.slice(0, 100)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...hit, sentence });
    if (unique.length >= 14) break;
  }
  const coverage = stats ? `\n\nPhạm vi tìm kiếm: đã quét toàn bộ ${stats.textPages}/${stats.pages} trang có lớp chữ, ${stats.chunks} đoạn trong ${stats.docs} tài liệu.` : '';
  return `Tra cứu cục bộ tìm thấy ${unique.length} đoạn liên quan. Đây là trích xuất từ tài liệu, không phải nội dung AI suy diễn:\n\n${unique.map(h => `• ${h.sentence}\n  [${h.standard || h.docName} · Trang ${h.page}]`).join('\n\n')}${coverage}`;
}

export function localSummary(doc) {
  const lines = (doc.pages || [])
    .flatMap(p => String(p.text || '').split('\n').map(text => ({ page: p.page, text: text.trim() })))
    .filter(x => x.text.length > 4);
  const headingRx = /^(?:\d+(?:\.\d+)*\s+|phụ lục|mục lục|lời nói đầu|phạm vi|tài liệu viện dẫn|thuật ngữ|yêu cầu|phương pháp|nghiệm thu|ghi nhãn|bảo quản|vận chuyển)/i;
  const headings = lines.filter(x => headingRx.test(x.text) && x.text.length < 220).slice(0, 80);
  const importantRx = /(không nhỏ hơn|không lớn hơn|sai lệch|cho phép|bắt buộc|phải |được chấp nhận|không vượt quá|cường độ|tải trọng|mômen|vết nứt|hệ số an toàn|nghiệm thu|thí nghiệm|công thức|phụ lục)/i;
  const important = lines.filter(x => importantRx.test(x.text) && x.text.length < 520).slice(0, 80);
  return { headings, important };
}

const DOMAIN_SYNONYMS = [
  ['nghiem thu', 'chap nhan', 'ho so nghiem thu', 'xuat xuong'],
  ['vet nut', 'ran nut', 'be rong vet nut', 'uon nut'],
  ['suc chiu tai', 'suc khang nen', 'tai trong nen', 'nen doc truc'],
  ['sai so', 'sai lech', 'dung sai'],
  ['duong kinh', 'd', 'phi'],
  ['do ben cat', 'ben cat', 'kha nang ben cat'],
  ['moi noi', 'mang xong', 'mat bich'],
  ['bao quan', 'xep coc', 'van chuyen', 'nang chuyen'],
  ['cuong do be tong', 'cuong do nen', 'mpa'],
  ['cong thuc', 'tinh toan', 'phu luc', 'he so']
];

export function expandEngineeringQuery(query='') {
  const q = normalize(query).replace(/\s+/g, ' ').trim();
  const extras = new Set();
  for (const group of DOMAIN_SYNONYMS) {
    if (group.some(term => q.includes(normalize(term)))) group.forEach(term => extras.add(term));
  }
  return [query, ...extras].join(' ');
}

function addHit(out, seen, hit) {
  const key = `${hit.docId}:${hit.page}:${hit.chunk ?? 'p'}`;
  if (seen.has(key)) return false;
  seen.add(key); out.push(hit); return true;
}

/**
 * Full-library balanced RAG retrieval.
 * 1) Scores EVERY chunk from EVERY page.
 * 2) Reserves results across documents so one PDF cannot monopolize context.
 * 3) Adds neighboring pages after primary hits.
 * 4) Applies the final limit only after this complete-corpus pass.
 */
export function smartSearchChunks(query, docs, limit = 36, options = {}) {
  if (!String(query || '').trim() || !Array.isArray(docs) || !docs.length) return [];
  const expanded = expandEngineeringQuery(query);
  const perDoc = Math.max(2, Number(options.perDoc || Math.ceil(limit / Math.max(1, Math.min(docs.length, 6)))));
  const allScored = docs.flatMap(doc => buildChunks(doc))
    .map(chunk => ({ ...chunk, score: scoreChunk(expanded, chunk) }))
    .filter(x => x.score > 3)
    .sort((a,b) => b.score - a.score || a.page - b.page || a.chunk - b.chunk);

  const grouped = new Map(docs.map(d => [d.id, []]));
  for (const hit of allScored) grouped.get(hit.docId)?.push(hit);

  const out = [];
  const seen = new Set();
  // Round-robin across docs ensures relevant evidence from every matching PDF.
  for (let rank = 0; rank < perDoc && out.length < limit; rank++) {
    for (const doc of docs) {
      const hit = grouped.get(doc.id)?.[rank];
      if (hit) addHit(out, seen, hit);
      if (out.length >= limit) break;
    }
  }
  // Fill remaining capacity with globally strongest hits.
  for (const hit of allScored) {
    if (out.length >= limit) break;
    addHit(out, seen, hit);
  }

  const byDoc = new Map(docs.map(d => [d.id, d]));
  const primary = [...out];
  // Neighbor page context is useful for clauses/tables split across page breaks.
  for (const hit of primary) {
    if (out.length >= limit) break;
    const doc = byDoc.get(hit.docId);
    for (const pno of [hit.page - 1, hit.page + 1]) {
      if (out.length >= limit) break;
      const pg = doc?.pages?.find(x => x.page === pno);
      if (!pg?.text?.trim()) continue;
      addHit(out, seen, { docId: doc.id, docName: doc.name, standard: doc.standard, page: pno, chunk: 'neighbor', text: pg.text, score: Math.max(1, hit.score - 8), neighbor: true });
    }
  }
  return out.sort((a,b) => b.score - a.score || a.docName.localeCompare(b.docName) || a.page - b.page).slice(0, limit);
}

export function isBroadQuery(query='') {
  const q = normalize(query);
  return /(tat ca|toan bo|tong hop|day du|moi quy dinh|cac quy dinh|het cac|so sanh)/.test(q);
}
