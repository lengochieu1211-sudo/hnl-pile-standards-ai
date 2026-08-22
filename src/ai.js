export const PROVIDERS = {
  local: {
    label: 'Tra cứu nhanh · Không AI',
    short: 'Local',
    model: '',
    needsKey: false,
    description: 'Không dùng mô hình AI; tìm kiếm thông minh theo từ khóa/kỹ thuật trong dữ liệu đã nhập.'
  },
  ollama: {
    label: 'HNL Offline AI · Ollama',
    short: 'Ollama',
    model: 'qwen3:8b',
    needsKey: false,
    description: 'AI chạy hoàn toàn trên máy qua Ollama. Khuyến nghị mở bản HNL Local thay vì GitHub Pages để tránh chặn HTTPS → HTTP.'
  },
  gemini: {
    label: 'Google Gemini',
    short: 'Gemini',
    model: 'gemini-3.6-flash',
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
    model: 'claude-haiku-4-5',
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

  return `Bạn là trợ lý kỹ thuật chuyên tra cứu tiêu chuẩn xây dựng và cọc.\n\nQUY TẮC BẮT BUỘC:\n- Chỉ kết luận dựa trên các nguồn tài liệu được cung cấp${strict ? '' : ', trừ khi phần giải thích ngoài tài liệu được ghi nhãn rõ'}.\n- Không tự bịa số liệu, công thức, điều khoản, bảng hoặc số trang.\n- Mỗi kết luận kỹ thuật phải kèm nguồn dạng [Tên tiêu chuẩn/file · Trang X].\n- Nếu nguồn không đủ, phải nói: “Không tìm thấy đủ căn cứ trong các tài liệu đang chọn”.\n- Khi có số liệu, giữ nguyên đơn vị và điều kiện áp dụng.\n- Nếu các nguồn khác nhau, tách riêng từng nguồn và không tự hòa giải mâu thuẫn.\n\nCÂU HỎI:\n${question}\n\nNGỮ CẢNH TỪ TÀI LIỆU:\n${sources}`;
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

export async function callBridge({ bridgeUrl, provider, model, prompt, images = [] }) {
  const base = String(bridgeUrl || '').replace(/\/$/, '');
  if (!base) throw new Error('Chưa cấu hình HNL Bridge URL.');
  const data = await jsonFetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      model,
      images,
      messages: [
        { role: 'system', content: 'Trả lời bằng tiếng Việt, chính xác, ưu tiên ngắn gọn và luôn giữ citation nguồn tài liệu.' },
        { role: 'user', content: prompt }
      ]
    })
  });
  return data.text || '';
}

export async function callDirect({ provider, model, apiKey, prompt, ollamaUrl = 'http://127.0.0.1:11434', images = [] }) {
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
          { role: 'user', content: prompt, ...(images.length ? { images: images.map(x => x.data) } : {}) }
        ],
        options: { temperature: 0.1 }
      })
    });
    return data.message?.content || '';
  }

  if (!apiKey) throw new Error('Chưa nhập API key cho nhà cung cấp AI này.');

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || 'gemini-3.6-flash')}:generateContent`;
    const data = await jsonFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'Trả lời bằng tiếng Việt, chính xác và giữ citation nguồn tài liệu.' }] },
        contents: [{ role: 'user', parts: [{ text: prompt }, ...images.map(x => ({ inlineData: { mimeType: x.mimeType || 'image/jpeg', data: x.data } }))] }],
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
          { role: 'system', content: 'Trả lời bằng tiếng Việt, chính xác và giữ citation nguồn tài liệu.' },
          { role: 'user', content: images.length ? [{ type: 'text', text: prompt }, ...images.map(x => ({ type: 'image_url', image_url: { url: `data:${x.mimeType || 'image/jpeg'};base64,${x.data}` } }))] : prompt }
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
        model: model || 'claude-haiku-4-5',
        max_tokens: 2400,
        temperature: 0.1,
        system: 'Trả lời bằng tiếng Việt, chính xác và giữ citation nguồn tài liệu.',
        messages: [{ role: 'user', content: images.length ? [...images.map(x => ({ type: 'image', source: { type: 'base64', media_type: x.mimeType || 'image/jpeg', data: x.data } })), { type: 'text', text: prompt }] : prompt }]
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
          { role: 'system', content: 'Trả lời bằng tiếng Việt, chính xác và giữ citation nguồn tài liệu.' },
          { role: 'user', content: images.length ? [{ type: 'text', text: prompt }, ...images.map(x => ({ type: 'image_url', image_url: { url: `data:${x.mimeType || 'image/jpeg'};base64,${x.data}` } }))] : prompt }
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


const FALLBACK_MODELS = {
  ollama: [],
  gemini: ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview'],
  openai: ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.4-mini', 'gpt-4.1-mini'],
  claude: ['claude-opus-4-1', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
  grok: ['grok-4-1-fast-reasoning', 'grok-4-1-fast-non-reasoning', 'grok-4', 'grok-3-mini']
};

function uniqueModels(list = []) {
  return [...new Set(list.map(x => String(x || '').trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b));
}

/** List models available to the user's actual key/account when the provider exposes it. */
export async function listAvailableModels({ provider, connection = 'direct', apiKey = '', bridgeUrl = '', ollamaUrl = 'http://127.0.0.1:11434' }) {
  if (provider === 'local') return [];
  try {
    if (connection === 'bridge') {
      const base = String(bridgeUrl || '').replace(/\/$/, '');
      const data = await jsonFetch(`${base}/api/models/${encodeURIComponent(provider)}`, { method: 'GET' }, 12000);
      const models = uniqueModels(data.models || []);
      return models.length ? models : (FALLBACK_MODELS[provider] || []);
    }
    if (provider === 'ollama') {
      if (location.protocol === 'https:' && !/^https:\/\//i.test(ollamaUrl)) throw new Error('HTTPS chặn Ollama HTTP cục bộ');
      const base = String(ollamaUrl || 'http://127.0.0.1:11434').replace(/\/$/, '');
      const data = await jsonFetch(`${base}/api/tags`, { method:'GET' }, 8000);
      return uniqueModels((data.models || []).map(x => x.name || x.model));
    }
    if (!apiKey) return FALLBACK_MODELS[provider] || [];
    if (provider === 'gemini') {
      const data = await jsonFetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { headers:{ 'x-goog-api-key':apiKey } }, 12000);
      const models = (data.models || []).filter(m => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent')).map(m => String(m.name || '').replace(/^models\//,''));
      return uniqueModels(models);
    }
    if (provider === 'openai') {
      const data = await jsonFetch('https://api.openai.com/v1/models', { headers:{ Authorization:`Bearer ${apiKey}` } }, 12000);
      return uniqueModels((data.data || []).map(x => x.id).filter(id => /^(gpt-|o\d|chat-)/.test(id)));
    }
    if (provider === 'claude') {
      const data = await jsonFetch('https://api.anthropic.com/v1/models?limit=100', { headers:{ 'x-api-key':apiKey, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' } }, 12000);
      return uniqueModels((data.data || []).map(x => x.id));
    }
    if (provider === 'grok') {
      const data = await jsonFetch('https://api.x.ai/v1/models', { headers:{ Authorization:`Bearer ${apiKey}` } }, 12000);
      return uniqueModels((data.data || data.models || []).map(x => x.id || x.name));
    }
  } catch (error) {
    console.warn('Model listing failed; using fallback catalog.', error);
  }
  return FALLBACK_MODELS[provider] || [];
}
