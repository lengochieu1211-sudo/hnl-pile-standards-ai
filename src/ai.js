export const PROVIDERS = {
  local: {
    label: 'Tra cứu cục bộ',
    short: 'Local',
    model: '',
    needsKey: false,
    description: 'Không dùng AI, tìm và trích đúng nội dung PDF trên máy.'
  },
  ollama: {
    label: 'Ollama · Offline',
    short: 'Ollama',
    model: 'qwen3:8b',
    needsKey: false,
    description: 'AI chạy trên máy. Khuyến nghị dùng HNL Bridge khi mở app từ GitHub Pages.'
  },
  gemini: {
    label: 'Google Gemini',
    short: 'Gemini',
    model: 'gemini-2.5-flash',
    needsKey: true,
    description: 'Có thể gọi trực tiếp bằng API key của chính người dùng hoặc qua HNL Bridge.'
  },
  openai: {
    label: 'ChatGPT / OpenAI',
    short: 'OpenAI',
    model: 'gpt-4.1-mini',
    needsKey: true,
    description: 'Có thể gọi trực tiếp bằng API key của chính người dùng hoặc qua HNL Bridge.'
  },
  claude: {
    label: 'Anthropic Claude',
    short: 'Claude',
    model: 'claude-3-5-haiku-latest',
    needsKey: true,
    description: 'Gọi trực tiếp hoặc qua HNL Bridge. Nếu trình duyệt chặn CORS, chuyển sang Bridge.'
  },
  grok: {
    label: 'xAI Grok',
    short: 'Grok',
    model: 'grok-3-mini',
    needsKey: true,
    description: 'Gọi trực tiếp hoặc qua HNL Bridge. Model có thể thay đổi theo tài khoản.'
  }
};

export function buildRagPrompt(question, hits, strict = true) {
  const sources = hits.map((h, i) =>
    `[Nguồn ${i + 1}] ${h.standard || h.docName} | File: ${h.docName} | Trang ${h.page}\n${h.text}`
  ).join('\n\n');

  return `Bạn là trợ lý kỹ thuật chuyên tra cứu tiêu chuẩn xây dựng và cọc.\n\nQUY TẮC BẮT BUỘC:\n- Chỉ kết luận dựa trên các nguồn PDF được cung cấp${strict ? '' : ', trừ khi phần giải thích ngoài tài liệu được ghi nhãn rõ'}.\n- Không tự bịa số liệu, công thức, điều khoản, bảng hoặc số trang.\n- Mỗi kết luận kỹ thuật phải kèm nguồn dạng [Tên tiêu chuẩn/file · Trang X].\n- Nếu nguồn không đủ, phải nói: “Không tìm thấy đủ căn cứ trong các tài liệu đang chọn”.\n- Khi có số liệu, giữ nguyên đơn vị và điều kiện áp dụng.\n- Nếu các nguồn khác nhau, tách riêng từng nguồn và không tự hòa giải mâu thuẫn.\n\nCÂU HỎI:\n${question}\n\nNGỮ CẢNH TỪ PDF:\n${sources}`;
}

async function jsonFetch(url, options, timeoutMs = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || data?.error || data?.message || `${response.status} ${response.statusText}`;
      throw new Error(String(message));
    }
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Hết thời gian chờ phản hồi AI.');
    if (error instanceof TypeError) throw new Error('Không kết nối được API. Có thể do CORS, mạng hoặc URL không hợp lệ. Hãy thử HNL Bridge.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function callBridge({ bridgeUrl, provider, model, prompt }) {
  const base = String(bridgeUrl || '').replace(/\/$/, '');
  if (!base) throw new Error('Chưa cấu hình HNL Bridge URL.');
  const data = await jsonFetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      model,
      messages: [
        { role: 'system', content: 'Trả lời bằng tiếng Việt, chính xác, ưu tiên ngắn gọn và luôn giữ citation nguồn tài liệu.' },
        { role: 'user', content: prompt }
      ]
    })
  });
  return data.text || '';
}

export async function callDirect({ provider, model, apiKey, prompt, ollamaUrl = 'http://127.0.0.1:11434' }) {
  if (provider === 'ollama') {
    if (location.protocol === 'https:' && !/^https:\/\//i.test(ollamaUrl)) {
      throw new Error('GitHub Pages dùng HTTPS nên trình duyệt có thể chặn Ollama HTTP cục bộ. Hãy dùng HNL Bridge hoặc chạy frontend trên localhost.');
    }
    const base = String(ollamaUrl || 'http://127.0.0.1:11434').replace(/\/$/, '');
    const data = await jsonFetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'qwen3:8b',
        stream: false,
        messages: [
          { role: 'system', content: 'Trả lời bằng tiếng Việt, chỉ dựa trên nguồn đã cung cấp.' },
          { role: 'user', content: prompt }
        ],
        options: { temperature: 0.1 }
      })
    });
    return data.message?.content || '';
  }

  if (!apiKey) throw new Error('Chưa nhập API key cho nhà cung cấp AI này.');

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || 'gemini-2.5-flash')}:generateContent`;
    const data = await jsonFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'Trả lời bằng tiếng Việt, chính xác và giữ citation nguồn PDF.' }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 }
      })
    });
    return data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  }

  if (provider === 'openai') {
    const data = await jsonFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model || 'gpt-4.1-mini',
        temperature: 0.1,
        messages: [
          { role: 'system', content: 'Trả lời bằng tiếng Việt, chính xác và giữ citation nguồn PDF.' },
          { role: 'user', content: prompt }
        ]
      })
    });
    return data.choices?.[0]?.message?.content || '';
  }

  if (provider === 'claude') {
    const data = await jsonFetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-haiku-latest',
        max_tokens: 2400,
        temperature: 0.1,
        system: 'Trả lời bằng tiếng Việt, chính xác và giữ citation nguồn PDF.',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    return data.content?.filter(x => x.type === 'text').map(x => x.text).join('\n') || '';
  }

  if (provider === 'grok') {
    const data = await jsonFetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model || 'grok-3-mini',
        temperature: 0.1,
        messages: [
          { role: 'system', content: 'Trả lời bằng tiếng Việt, chính xác và giữ citation nguồn PDF.' },
          { role: 'user', content: prompt }
        ]
      })
    });
    return data.choices?.[0]?.message?.content || '';
  }

  throw new Error(`Nhà cung cấp không hỗ trợ chế độ trực tiếp: ${provider}`);
}

export async function bridgeHealth(bridgeUrl) {
  const base = String(bridgeUrl || '').replace(/\/$/, '');
  if (!base) throw new Error('Chưa cấu hình Bridge URL.');
  return jsonFetch(`${base}/api/health`, { method: 'GET' }, 5000);
}

export async function testDirectProvider({ provider, model, apiKey, ollamaUrl }) {
  if (provider === 'local') return { ok: true, message: 'Tra cứu cục bộ luôn sẵn sàng.' };
  const text = await callDirect({
    provider,
    model,
    apiKey,
    ollamaUrl,
    prompt: 'Chỉ trả lời đúng một từ: OK'
  });
  return { ok: Boolean(text), message: text || 'Không có phản hồi.' };
}
