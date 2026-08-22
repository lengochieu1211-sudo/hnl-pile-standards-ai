import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const app = express();
const PORT = Number(process.env.PORT || 8787);
app.use(cors({ origin: process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',') : true }));
app.use(express.json({ limit: '32mb' }));

const configured = (ollamaReady = false) => ({
  ollama: ollamaReady,
  openai: Boolean(process.env.OPENAI_API_KEY),
  gemini: Boolean(process.env.GEMINI_API_KEY),
  claude: Boolean(process.env.ANTHROPIC_API_KEY),
  grok: Boolean(process.env.XAI_API_KEY)
});

app.get('/api/health', async (_req, res) => {
  let ollamaReady = false;
  try {
    const base = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/,'');
    const r = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(2500) });
    ollamaReady = r.ok;
  } catch { ollamaReady = false; }
  res.json({ ok: true, service: 'HNL AI Bridge', providers: configured(ollamaReady), localUrl:`http://127.0.0.1:${PORT}` });
});

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

async function askOpenAI(model, messages, images = []) {
  const key = requireKey('OPENAI_API_KEY');
  const data = await jsonFetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: model || 'gpt-4.1-mini', messages: messages.map((m, i) => (images.length && i === messages.length - 1 && m.role === 'user') ? ({ ...m, content: [{ type:'text', text:m.content }, ...images.map(x => ({ type:'image_url', image_url:{ url:`data:${x.mimeType || 'image/jpeg'};base64,${x.data}` } }))] }) : m), temperature: 0.1 })
  });
  return data.choices?.[0]?.message?.content || 'OpenAI không trả về nội dung văn bản.';
}

async function askGemini(model, messages, images = []) {
  const key = requireKey('GEMINI_API_KEY');
  const system = messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
  const nonSystem = messages.filter(m=>m.role!=='system');
  const contents = nonSystem.map((m, i)=>({ role: m.role === 'assistant' ? 'model' : 'user', parts:[{text:m.content}, ...(images.length && i === nonSystem.length - 1 && m.role !== 'assistant' ? images.map(x => ({ inlineData:{ mimeType:x.mimeType || 'image/jpeg', data:x.data } })) : [])] }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || 'gemini-3.6-flash')}:generateContent`;
  const data = await jsonFetch(url, {
    method:'POST',
    headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({ systemInstruction: system ? { parts:[{text:system}] } : undefined, contents })
  });
  return data.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('') || 'Gemini không trả về nội dung văn bản.';
}

async function askClaude(model, messages, images = []) {
  const key = requireKey('ANTHROPIC_API_KEY');
  const system = messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
  const nonSystem = messages.filter(m=>m.role!=='system');
  const chat = nonSystem.map((m, i)=>({ role:m.role==='assistant'?'assistant':'user', content:(images.length && i === nonSystem.length - 1 && m.role !== 'assistant') ? [...images.map(x => ({ type:'image', source:{ type:'base64', media_type:x.mimeType || 'image/jpeg', data:x.data } })), { type:'text', text:m.content }] : m.content }));
  const data = await jsonFetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
    body:JSON.stringify({ model:model || 'claude-3-5-haiku-latest', max_tokens:2200, system, messages:chat })
  });
  return data.content?.filter(x=>x.type==='text').map(x=>x.text).join('\n') || 'Claude không trả về nội dung văn bản.';
}

async function askGrok(model, messages, images = []) {
  const key = requireKey('XAI_API_KEY');
  const data = await jsonFetch('https://api.x.ai/v1/chat/completions', {
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},
    body:JSON.stringify({ model:model || 'grok-3-mini', messages: messages.map((m, i) => (images.length && i === messages.length - 1 && m.role === 'user') ? ({ ...m, content:[{type:'text',text:m.content}, ...images.map(x=>({type:'image_url',image_url:{url:`data:${x.mimeType || 'image/jpeg'};base64,${x.data}`}}))] }) : m), temperature:0.1 })
  });
  return data.choices?.[0]?.message?.content || 'Grok không trả về nội dung văn bản.';
}

async function askOllama(model, messages, images = []) {
  const base = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/,'');
  const data = await jsonFetch(`${base}/api/chat`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ model:model || 'qwen3:8b', messages: messages.map((m, i) => (images.length && i === messages.length - 1 && m.role === 'user') ? ({...m, images: images.map(x=>x.data)}) : m), stream:false, options:{temperature:0.1} })
  });
  return data.message?.content || 'Ollama không trả về nội dung văn bản.';
}


function walkFiles(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, base, out);
    else out.push({ full, rel:path.relative(base, full).replaceAll('\\','/') });
  }
  return out;
}

// RAR/7Z fallback chỉ dành cho HNL Local. Windows 11 có tar/libarchive trên nhiều máy;
// nếu tar không đọc được archive, endpoint thử 7z nếu người dùng đã cài 7-Zip.
app.post('/api/extract-archive', express.raw({ type:'application/octet-stream', limit:'500mb' }), async (req, res) => {
  const original = String(req.query.name || 'archive.rar');
  const safeExt = path.extname(original).slice(0, 8) || '.bin';
  const root = path.join(os.tmpdir(), `hnl-archive-${crypto.randomUUID()}`);
  const input = path.join(root, `input${safeExt}`);
  const output = path.join(root, 'out');
  try {
    fs.mkdirSync(output, { recursive:true });
    fs.writeFileSync(input, req.body);
    let ok = false;
    const tar = spawnSync('tar', ['-xf', input, '-C', output], { encoding:'utf8', windowsHide:true });
    if (tar.status === 0) ok = true;
    if (!ok) {
      const seven = spawnSync('7z', ['x', '-y', `-o${output}`, input], { encoding:'utf8', windowsHide:true });
      if (seven.status === 0) ok = true;
    }
    if (!ok) throw new Error('Máy chưa có công cụ đọc RAR/7Z phù hợp. Hãy cài 7-Zip miễn phí hoặc giải nén archive trước.');
    const allowed = /\.(pdf|png|jpe?g|webp|bmp|gif|txt|md|csv|json|xml|html?|yaml|yml|zip)$/i;
    const files = walkFiles(output).filter(x => allowed.test(x.rel)).slice(0, 800);
    let total = 0;
    const entries = [];
    for (const f of files) {
      const st = fs.statSync(f.full); total += st.size;
      if (total > 350 * 1024 * 1024) throw new Error('Dữ liệu sau giải nén vượt giới hạn 350 MB.');
      entries.push({ path:f.rel, data:fs.readFileSync(f.full).toString('base64') });
    }
    res.json({ entries });
  } catch (err) {
    res.status(400).json({ error:err.message });
  } finally {
    try { fs.rmSync(root, { recursive:true, force:true }); } catch { /* noop */ }
  }
});



const BRIDGE_FALLBACK_MODELS = {
  ollama: [],
  gemini: ['gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite','gemini-3.1-pro-preview'],
  openai: ['gpt-5.6-sol','gpt-5.6-terra','gpt-5.6-luna','gpt-5.4-mini','gpt-4.1-mini'],
  claude: ['claude-opus-4-1','claude-sonnet-4-5','claude-haiku-4-5'],
  grok: ['grok-4-1-fast-reasoning','grok-4-1-fast-non-reasoning','grok-4','grok-3-mini']
};

function uniqueModels(list=[]) { return [...new Set(list.map(x=>String(x||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b)); }

async function providerModels(provider) {
  try {
    if (provider === 'ollama') {
      const base = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/,'');
      const data = await jsonFetch(`${base}/api/tags`, { method:'GET' });
      return uniqueModels((data.models || []).map(x=>x.name || x.model));
    }
    if (provider === 'gemini') {
      const key = requireKey('GEMINI_API_KEY');
      const data = await jsonFetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { headers:{'x-goog-api-key':key} });
      return uniqueModels((data.models || []).filter(m=>!m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent')).map(m=>String(m.name||'').replace(/^models\//,'')));
    }
    if (provider === 'openai') {
      const key = requireKey('OPENAI_API_KEY');
      const data = await jsonFetch('https://api.openai.com/v1/models', { headers:{Authorization:`Bearer ${key}`} });
      return uniqueModels((data.data || []).map(x=>x.id).filter(id=>/^(gpt-|o\d|chat-)/.test(id)));
    }
    if (provider === 'claude') {
      const key = requireKey('ANTHROPIC_API_KEY');
      const data = await jsonFetch('https://api.anthropic.com/v1/models?limit=100', { headers:{'x-api-key':key,'anthropic-version':'2023-06-01'} });
      return uniqueModels((data.data || []).map(x=>x.id));
    }
    if (provider === 'grok') {
      const key = requireKey('XAI_API_KEY');
      const data = await jsonFetch('https://api.x.ai/v1/models', { headers:{Authorization:`Bearer ${key}`} });
      return uniqueModels((data.data || data.models || []).map(x=>x.id || x.name));
    }
  } catch (err) {
    console.warn(`Model list ${provider} failed:`, err.message);
  }
  return BRIDGE_FALLBACK_MODELS[provider] || [];
}

app.get('/api/models/:provider', async (req, res) => {
  const provider = String(req.params.provider || '');
  if (!['ollama','gemini','openai','claude','grok'].includes(provider)) return res.status(400).json({error:'Provider không hợp lệ.'});
  const models = await providerModels(provider);
  res.json({ provider, models });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { provider, model, messages, images = [] } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error:'Thiếu messages.' });
    let text;
    if (provider === 'openai') text = await askOpenAI(model, messages, images);
    else if (provider === 'gemini') text = await askGemini(model, messages, images);
    else if (provider === 'claude') text = await askClaude(model, messages, images);
    else if (provider === 'grok') text = await askGrok(model, messages, images);
    else if (provider === 'ollama') text = await askOllama(model, messages, images);
    else return res.status(400).json({ error:`Provider không hỗ trợ: ${provider}` });
    res.json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'AI Bridge lỗi không xác định.' });
  }
});


app.get('/api/ollama/tags', async (_req, res) => {
  try {
    const base = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/,'');
    const data = await jsonFetch(`${base}/api/tags`, { method:'GET' });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Khi đã `npm run build`, Bridge đồng thời phục vụ dist. Đây là cách ổn định
// nhất để dùng Ollama offline: mở http://127.0.0.1:8787 thay vì GitHub Pages HTTPS.
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/.*/, (req, res, next) => req.path.startsWith('/api/') ? next() : res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => console.log(`HNL Local AI: http://127.0.0.1:${PORT}`));

