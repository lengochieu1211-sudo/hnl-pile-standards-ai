export const PROVIDERS = {
  local: { label: 'Offline · Tra cứu cục bộ', model: '' },
  ollama: { label: 'Offline · Ollama', model: 'qwen3:8b' },
  gemini: { label: 'Gemini', model: 'gemini-3.6-flash' },
  openai: { label: 'ChatGPT / OpenAI', model: 'gpt-5.6-luna' },
  claude: { label: 'Claude', model: 'claude-sonnet-4-5' },
  grok: { label: 'Grok / xAI', model: 'grok-4' }
};

export function buildRagPrompt(question, hits, strict = true) {
  const sources = hits.map((h, i) =>
    `[Nguồn ${i + 1}] ${h.standard || h.docName} | File: ${h.docName} | Trang ${h.page}\n${h.text}`
  ).join('\n\n');
  return `Bạn là trợ lý kỹ thuật chuyên về tiêu chuẩn và cọc xây dựng.\n\nQUY TẮC BẮT BUỘC:\n- Ưu tiên tuyệt đối nội dung tài liệu được cung cấp.\n- Không tự bịa số liệu, công thức, điều khoản hoặc tiêu chuẩn.\n- Mỗi kết luận kỹ thuật phải ghi nguồn dạng [Tên tiêu chuẩn/file · Trang X].\n- Nếu tài liệu không đủ căn cứ, nói rõ \"Không tìm thấy đủ căn cứ trong các tài liệu đang chọn\".\n${strict ? '- CHẾ ĐỘ KHÓA NGUỒN đang bật: không sử dụng kiến thức ngoài tài liệu.\n' : '- Có thể giải thích thêm bằng kiến thức chung nhưng phải tách rõ phần ngoài tài liệu.\n'}\nCÂU HỎI:\n${question}\n\nNGỮ CẢNH TỪ PDF:\n${sources}`;
}

export async function callBridge({ bridgeUrl, provider, model, prompt }) {
  const base = bridgeUrl.replace(/\/$/, '');
  const response = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      model,
      messages: [
        { role: 'system', content: 'Trả lời bằng tiếng Việt, chính xác, súc tích và luôn giữ citation nguồn tài liệu.' },
        { role: 'user', content: prompt }
      ]
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `AI Bridge lỗi ${response.status}`);
  return data.text || '';
}

export async function bridgeHealth(bridgeUrl) {
  const base = bridgeUrl.replace(/\/$/, '');
  const r = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(2500) });
  if (!r.ok) throw new Error('Bridge không phản hồi');
  return r.json();
}
