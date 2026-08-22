import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = Number(process.env.PORT || 8787);
app.use(cors({ origin: process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',') : true }));
app.use(express.json({ limit: '4mb' }));

const configured = () => ({
  ollama: true,
  openai: Boolean(process.env.OPENAI_API_KEY),
  gemini: Boolean(process.env.GEMINI_API_KEY),
  claude: Boolean(process.env.ANTHROPIC_API_KEY),
  grok: Boolean(process.env.XAI_API_KEY)
});

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'HNL AI Bridge', providers: configured() }));

function requireKey(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Thiếu biến môi trường ${name}`);
  return value;
}

function messagesToText(messages = []) {
  return messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
}

async function jsonFetch(url, options) {
  const r = await fetch(url, options);
  const data = await r.json().catch(async () => ({ raw: await r.text().catch(()=>'') }));
  if (!r.ok) {
    const msg = data?.error?.message || data?.error || data?.message || data?.raw || `HTTP ${r.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data;
}

async function askOpenAI(model, messages) {
  const key = requireKey('OPENAI_API_KEY');
  const data = await jsonFetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: model || 'gpt-5.6-luna', input: messages })
  });
  if (data.output_text) return data.output_text;
  const texts = [];
  for (const item of data.output || []) for (const c of item.content || []) if (c.type === 'output_text' && c.text) texts.push(c.text);
  return texts.join('\n') || 'OpenAI không trả về nội dung văn bản.';
}

async function askGemini(model, messages) {
  const key = requireKey('GEMINI_API_KEY');
  const system = messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
  const contents = messages.filter(m=>m.role!=='system').map(m=>({ role: m.role === 'assistant' ? 'model' : 'user', parts:[{text:m.content}] }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || 'gemini-3.6-flash')}:generateContent`;
  const data = await jsonFetch(url, {
    method:'POST',
    headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({ systemInstruction: system ? { parts:[{text:system}] } : undefined, contents })
  });
  return data.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('') || 'Gemini không trả về nội dung văn bản.';
}

async function askClaude(model, messages) {
  const key = requireKey('ANTHROPIC_API_KEY');
  const system = messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
  const chat = messages.filter(m=>m.role!=='system').map(m=>({ role:m.role==='assistant'?'assistant':'user', content:m.content }));
  const data = await jsonFetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
    body:JSON.stringify({ model:model || 'claude-sonnet-4-5', max_tokens:2200, system, messages:chat })
  });
  return data.content?.filter(x=>x.type==='text').map(x=>x.text).join('\n') || 'Claude không trả về nội dung văn bản.';
}

async function askGrok(model, messages) {
  const key = requireKey('XAI_API_KEY');
  const data = await jsonFetch('https://api.x.ai/v1/chat/completions', {
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},
    body:JSON.stringify({ model:model || 'grok-4', messages, temperature:0.1 })
  });
  return data.choices?.[0]?.message?.content || 'Grok không trả về nội dung văn bản.';
}

async function askOllama(model, messages) {
  const base = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/,'');
  const data = await jsonFetch(`${base}/api/chat`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ model:model || 'qwen3:8b', messages, stream:false, options:{temperature:0.1} })
  });
  return data.message?.content || 'Ollama không trả về nội dung văn bản.';
}

app.post('/api/chat', async (req, res) => {
  try {
    const { provider, model, messages } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error:'Thiếu messages.' });
    let text;
    if (provider === 'openai') text = await askOpenAI(model, messages);
    else if (provider === 'gemini') text = await askGemini(model, messages);
    else if (provider === 'claude') text = await askClaude(model, messages);
    else if (provider === 'grok') text = await askGrok(model, messages);
    else if (provider === 'ollama') text = await askOllama(model, messages);
    else return res.status(400).json({ error:`Provider không hỗ trợ: ${provider}` });
    res.json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'AI Bridge lỗi không xác định.' });
  }
});

app.listen(PORT, () => console.log(`HNL AI Bridge: http://127.0.0.1:${PORT}`));
