import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { spawnSync, spawn } from 'node:child_process';
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


// ---- v1.7 Local Intelligence Engine ---------------------------------------
const EMBEDDING_CACHE = new Map();
const EMBEDDING_CACHE_MAX = 4000;

function cacheEmbedding(key, value) {
  if (EMBEDDING_CACHE.size >= EMBEDDING_CACHE_MAX) {
    const first = EMBEDDING_CACHE.keys().next().value;
    if (first) EMBEDDING_CACHE.delete(first);
  }
  EMBEDDING_CACHE.set(key, value);
}

function cosineSimilarity(a=[], b=[]) {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let dot=0, aa=0, bb=0;
  for (let i=0;i<n;i++) { const x=Number(a[i]||0), y=Number(b[i]||0); dot+=x*y; aa+=x*x; bb+=y*y; }
  return aa && bb ? dot / Math.sqrt(aa*bb) : 0;
}

async function ollamaEmbed(model, inputs=[]) {
  const base = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/,'');
  const clean = inputs.map(x=>String(x||'').slice(0, 12000));
  if (!clean.length) return [];
  try {
    const data = await jsonFetch(`${base}/api/embed`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ model:model || 'bge-m3', input:clean, truncate:true })
    });
    if (Array.isArray(data.embeddings) && data.embeddings.length === clean.length) return data.embeddings;
  } catch (error) {
    // Compatibility fallback for older Ollama versions exposing /api/embeddings.
    if (!/404|not found/i.test(String(error.message||''))) throw error;
  }
  const out=[];
  for (const text of clean) {
    const data = await jsonFetch(`${base}/api/embeddings`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ model:model || 'bge-m3', prompt:text })
    });
    if (!Array.isArray(data.embedding)) throw new Error('Ollama không trả embedding hợp lệ.');
    out.push(data.embedding);
  }
  return out;
}

async function cachedEmbeddings(model, texts=[]) {
  const out = new Array(texts.length);
  const missing=[]; const missingIndex=[];
  for (let i=0;i<texts.length;i++) {
    const text=String(texts[i]||'');
    const key=`${model}:${crypto.createHash('sha1').update(text).digest('hex')}`;
    if (EMBEDDING_CACHE.has(key)) out[i]=EMBEDDING_CACHE.get(key);
    else { missing.push(text); missingIndex.push([i,key]); }
  }
  const batchSize=24;
  for (let start=0; start<missing.length; start+=batchSize) {
    const batch=missing.slice(start,start+batchSize);
    const vectors=await ollamaEmbed(model,batch);
    vectors.forEach((vec,j)=>{
      const [idx,key]=missingIndex[start+j]; out[idx]=vec; cacheEmbedding(key,vec);
    });
  }
  return out;
}

app.post('/api/local/semantic-rerank', async (req,res)=>{
  try {
    const query=String(req.body?.query||'').trim();
    const model=String(req.body?.model||'bge-m3').trim() || 'bge-m3';
    const candidates=Array.isArray(req.body?.candidates) ? req.body.candidates.slice(0,160) : [];
    const limit=Math.max(1,Math.min(Number(req.body?.limit||44), candidates.length || 1));
    if (!query || !candidates.length) return res.json({ model, results:[] });
    const vectors=await cachedEmbeddings(model,[query,...candidates.map(x=>String(x.text||''))]);
    const qv=vectors[0];
    const maxLex=Math.max(1,...candidates.map(x=>Number(x.score||0)));
    const results=candidates.map((c,i)=>{
      const semantic=cosineSimilarity(qv,vectors[i+1]);
      const lexical=Math.max(0,Number(c.score||0))/maxLex;
      // Semantic dominates while retaining exact engineering-number matches.
      const hybrid=semantic*0.72 + lexical*0.28;
      return { id:String(c.id), semanticScore:semantic, lexicalScore:lexical, hybridScore:hybrid };
    }).sort((a,b)=>b.hybridScore-a.hybridScore).slice(0,limit);
    res.json({ model, results, cacheSize:EMBEDDING_CACHE.size });
  } catch (err) {
    res.status(500).json({ error:err.message || 'Semantic rerank thất bại.' });
  }
});


function currentModelsDir() { return process.env.OLLAMA_MODELS || path.join(os.homedir(), '.ollama', 'models'); }
function directoryDiskInfo(targetPath='') {
  try { let probe=path.resolve(targetPath||currentModelsDir()); while(!fs.existsSync(probe)){ const parent=path.dirname(probe); if(parent===probe) break; probe=parent; } if(!fs.existsSync(probe)||typeof fs.statfsSync!=='function') return {freeBytes:0,totalBytes:0,path:probe}; const s=fs.statfsSync(probe); return {freeBytes:Number(s.bavail||s.bfree||0)*Number(s.bsize||0),totalBytes:Number(s.blocks||0)*Number(s.bsize||0),path:probe}; } catch { return {freeBytes:0,totalBytes:0,path:targetPath}; }
}
function windowsDrives() {
  if(process.platform!=='win32') return [];
  try { const script='Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,FreeSpace,Size | ConvertTo-Json -Compress'; const r=spawnSync('powershell.exe',['-NoProfile','-Command',script],{encoding:'utf8',windowsHide:true,timeout:5000}); if(r.status!==0||!r.stdout?.trim()) return []; const raw=JSON.parse(r.stdout.trim()); return (Array.isArray(raw)?raw:[raw]).map(x=>({device:String(x.DeviceID||''),freeBytes:Number(x.FreeSpace||0),totalBytes:Number(x.Size||0)})).filter(x=>x.device); } catch { return []; }
}
function setUserModelsDir(dir) {
  process.env.OLLAMA_MODELS=dir;
  if(process.platform==='win32'){ const script=`[Environment]::SetEnvironmentVariable('OLLAMA_MODELS', ${JSON.stringify(dir)}, 'User')`; const r=spawnSync('powershell.exe',['-NoProfile','-Command',script],{encoding:'utf8',windowsHide:true,timeout:8000}); if(r.status!==0) throw new Error((r.stderr||r.stdout||'Không đặt được OLLAMA_MODELS').trim()); }
}
async function restartOllamaServer() {
  if(process.platform!=='win32') return {ok:false,message:'Tự khởi động lại Ollama hiện chỉ hỗ trợ Windows.'};
  try{spawnSync('taskkill',['/IM','ollama.exe','/F'],{encoding:'utf8',windowsHide:true,timeout:5000});}catch{}
  try{const child=spawn('ollama',['serve'],{detached:true,windowsHide:true,stdio:'ignore',env:{...process.env}});child.unref();}catch(err){return {ok:false,message:err.message};}
  const base=(process.env.OLLAMA_BASE_URL||'http://127.0.0.1:11434').replace(/\/$/,''); for(let i=0;i<12;i++){await new Promise(r=>setTimeout(r,500));try{const resp=await fetch(`${base}/api/tags`,{signal:AbortSignal.timeout(900)});if(resp.ok)return {ok:true};}catch{}} return {ok:false,message:'Đã đặt thư mục nhưng Ollama chưa phản hồi sau khi khởi động lại.'};
}
function stripAnsi(text=''){return String(text).replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g,'').replace(/\r/g,'\n');}
function updatePullProgress(job,chunk){const text=stripAnsi(chunk);job.output=(job.output+text).slice(-12000);const matches=[...text.matchAll(/(\d{1,3})\s*%/g)];if(matches.length)job.progress=Math.max(job.progress||0,Math.min(99,Number(matches.at(-1)[1])||0));}
function gpuInfo() {
  try {
    const r=spawnSync('nvidia-smi',['--query-gpu=name,memory.total','--format=csv,noheader,nounits'],{encoding:'utf8',windowsHide:true,timeout:3000});
    if (r.status!==0 || !r.stdout?.trim()) return [];
    return r.stdout.trim().split(/\r?\n/).map(line=>{
      const parts=line.split(',').map(x=>x.trim());
      return { name:parts[0]||'NVIDIA GPU', vramMB:Number(parts[1]||0) };
    });
  } catch { return []; }
}

app.get('/api/local/diagnostics', async (_req,res)=>{
  const base=(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/,'');
  let ollama=false, version='', models=[];
  try {
    const tags=await jsonFetch(`${base}/api/tags`,{method:'GET'}); ollama=true;
    models=(tags.models||[]).map(x=>x.name||x.model).filter(Boolean);
    try { const v=await jsonFetch(`${base}/api/version`,{method:'GET'}); version=String(v.version||''); } catch { /* optional */ }
  } catch { ollama=false; }
  const ramGB=Math.round(os.totalmem()/1024/1024/1024*10)/10;
  const gpus=gpuInfo();
  const maxVram=Math.max(0,...gpus.map(x=>x.vramMB||0));
  let recommendedText='qwen3:4b';
  if (maxVram>=12000 || ramGB>=48) recommendedText='qwen3:14b';
  else if (maxVram>=7000 || ramGB>=24) recommendedText='qwen3:8b';
  const recommendedEmbedding='bge-m3';
  const recommendedVision=maxVram>=7000 || ramGB>=24 ? 'gemma3:4b' : 'gemma3:4b';
  res.json({
    ok:true, ollama, ollamaVersion:version, ramGB, gpus, models,
    recommended:{ text:recommendedText, embedding:recommendedEmbedding, vision:recommendedVision },
    installed:{ text:models.some(x=>x.startsWith(recommendedText)), embedding:models.some(x=>x.startsWith(recommendedEmbedding)), vision:models.some(x=>x.startsWith(recommendedVision)) },
    embeddingCache:EMBEDDING_CACHE.size
  });
});


function walkFiles(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink?.()) continue;
    if (entry.isDirectory()) walkFiles(full, base, out);
    else if (entry.isFile()) out.push({ full, rel:path.relative(base, full).replaceAll('\\','/') });
  }
  return out;
}

function commandExists(command) {
  try { return spawnSync(command, ['--help'], { encoding:'utf8', windowsHide:true, timeout:2500 }).error?.code !== 'ENOENT'; }
  catch { return false; }
}
function archiveToolCandidates() {
  const out = [];
  if (process.platform === 'win32') {
    for (const exe of [
      '7z',
      'C:\\Program Files\\7-Zip\\7z.exe',
      'C:\\Program Files (x86)\\7-Zip\\7z.exe',
      'C:\\Program Files\\WinRAR\\UnRAR.exe',
      'C:\\Program Files (x86)\\WinRAR\\UnRAR.exe'
    ]) if (!out.includes(exe)) out.push(exe);
  } else out.push('7z','7zz','unrar');
  return out;
}
function looksPasswordError(text='') {
  return /(wrong password|password is incorrect|encrypted|enter password|data error.*password|headers error|can not open encrypted)/i.test(text);
}
function extractWithTool(input, output, password='') {
  const ext = path.basename(input).toLowerCase();
  if (/\.(?:tar|tgz|tar\.gz|gz|bz2|xz)$/i.test(ext) || !/\.(?:rar|7z)$/i.test(ext)) {
    const tar = spawnSync('tar', ['-xf', input, '-C', output], { encoding:'utf8', windowsHide:true, timeout:120000 });
    if (tar.status === 0) return { ok:true, tool:'tar' };
  }
  let found = false;
  let passwordIssue = false;
  let lastText = '';
  for (const tool of archiveToolCandidates()) {
    const isUnrar = /unrar/i.test(path.basename(tool));
    const args = isUnrar
      ? ['x','-y', password ? `-p${password}` : '-p-', input, `${output}${path.sep}`]
      : ['x','-y', password ? `-p${password}` : '-p', `-o${output}`, input];
    const result = spawnSync(tool, args, { encoding:'utf8', windowsHide:true, timeout:120000 });
    if (result.error?.code === 'ENOENT') continue;
    found = true;
    lastText = `${result.stdout || ''}\n${result.stderr || ''}`;
    if (result.status === 0) return { ok:true, tool };
    if (looksPasswordError(lastText)) passwordIssue = true;
  }
  if (passwordIssue) return { ok:false, code:password ? 'BAD_PASSWORD':'PASSWORD_REQUIRED', text:lastText };
  if (!found) return { ok:false, code:'TOOL_MISSING', text:'Không tìm thấy 7-Zip/WinRAR/unrar.' };
  return { ok:false, code:'ARCHIVE_ERROR', text:lastText };
}

// Archive extraction is intentionally local-only. ZIP remains browser-capable;
// RAR/7Z/TAR/GZ/BZ2/XZ use Windows tar/7-Zip/WinRAR when HNL Local is running.
app.post('/api/extract-archive', express.raw({ type:'application/octet-stream', limit:'500mb' }), async (req, res) => {
  const original = String(req.query.name || 'archive.rar');
  const passwordHeader = String(req.get('X-HNL-Archive-Password') || '');
  let password = '';
  try { password = passwordHeader ? decodeURIComponent(passwordHeader) : ''; } catch { password = passwordHeader; }
  const safeExt = (original.toLowerCase().endsWith('.tar.gz') ? '.tar.gz' : path.extname(original)).slice(0, 12) || '.bin';
  const root = path.join(os.tmpdir(), `hnl-archive-${crypto.randomUUID()}`);
  const input = path.join(root, `input${safeExt}`);
  const output = path.join(root, 'out');
  try {
    fs.mkdirSync(output, { recursive:true });
    fs.writeFileSync(input, req.body);
    const extracted = extractWithTool(input, output, password);
    if (!extracted.ok) {
      const status = ['PASSWORD_REQUIRED','BAD_PASSWORD'].includes(extracted.code) ? 401 : 400;
      const msg = extracted.code === 'PASSWORD_REQUIRED' ? 'Archive có mật khẩu.'
        : extracted.code === 'BAD_PASSWORD' ? 'Mật khẩu archive không đúng.'
        : extracted.code === 'TOOL_MISSING' ? 'Máy chưa có công cụ đọc RAR/7Z. Hãy cài 7-Zip miễn phí; TAR/GZ có thể dùng tar của Windows.'
        : 'Không giải nén được archive. File có thể hỏng hoặc dùng phương thức nén chưa được công cụ trên máy hỗ trợ.';
      return res.status(status).json({ error:msg, code:extracted.code });
    }
    const allowed = /\.(pdf|png|jpe?g|webp|bmp|gif|txt|md|csv|json|xml|html?|yaml|yml|zip)$/i;
    const files = walkFiles(output).filter(x => allowed.test(x.rel)).slice(0, 1200);
    let total = 0;
    const entries = [];
    for (const f of files) {
      const st = fs.statSync(f.full); total += st.size;
      if (total > 500 * 1024 * 1024) throw new Error('Dữ liệu sau giải nén vượt giới hạn 500 MB.');
      entries.push({ path:f.rel, data:fs.readFileSync(f.full).toString('base64') });
    }
    res.json({ entries, tool:extracted.tool, passwordUsed:Boolean(password) });
  } catch (err) {
    res.status(400).json({ error:err.message, code:'ARCHIVE_ERROR' });
  } finally {
    try { fs.rmSync(root, { recursive:true, force:true }); } catch { /* noop */ }
  }
});



const MODEL_PULL_JOBS = new Map();
app.post('/api/local/pull-model', (req, res) => {
  try {
    const model = String(req.body?.model || '').trim();
    if (!model || !/^[a-zA-Z0-9._:/-]{2,120}$/.test(model)) return res.status(400).json({ error:'Tên model Ollama không hợp lệ.' });
    if (MODEL_PULL_JOBS.get(model)?.status === 'running') return res.json({ ok:true, model, status:'running' });
    const child = spawn('ollama', ['pull', model], { windowsHide:true, stdio:['ignore','pipe','pipe'] });
    const job = { status:'running', startedAt:new Date().toISOString(), output:'', progress:0, pid:child.pid, child };
    MODEL_PULL_JOBS.set(model, job);
    const add = chunk => updatePullProgress(job, chunk);
    child.stdout?.on('data', add); child.stderr?.on('data', add);
    child.on('error', err => { job.status='error'; job.error=err.message; });
    child.on('exit', code => { job.status = code === 0 ? 'done' : (job.status === 'cancelled' ? 'cancelled' : 'error'); job.progress = code === 0 ? 100 : job.progress; job.exitCode=code; job.finishedAt=new Date().toISOString(); delete job.child; });
    res.json({ ok:true, model, status:'running' });
  } catch (err) { res.status(500).json({ error:err.message || 'Không chạy được ollama pull.' }); }
});
app.get('/api/local/model-jobs', (_req,res) => {
  res.json({ jobs:[...MODEL_PULL_JOBS.entries()].map(([model,j])=>({ model, status:j.status, startedAt:j.startedAt, finishedAt:j.finishedAt, progress:j.progress||0, error:j.error, exitCode:j.exitCode, output:j.output })) });
});
app.post('/api/local/cancel-model-pull', (req,res)=>{
  const model=String(req.body?.model||'').trim(); const job=MODEL_PULL_JOBS.get(model);
  if(!job||job.status!=='running') return res.status(404).json({error:'Không có tác vụ tải model đang chạy.'});
  try{job.status='cancelled';if(job.child&&!job.child.killed)job.child.kill();res.json({ok:true,model,status:'cancelled'});}catch(err){res.status(500).json({error:err.message});}
});

app.get('/api/local/model-manager', async (_req,res)=>{
  const base=(process.env.OLLAMA_BASE_URL||'http://127.0.0.1:11434').replace(/\/$/,''); let ollama=false,models=[],version='';
  try{const tags=await jsonFetch(`${base}/api/tags`,{method:'GET'});ollama=true;models=(tags.models||[]).map(m=>({name:m.name||m.model,size:Number(m.size||0),modifiedAt:m.modified_at||'',digest:m.digest||'',details:m.details||{}}));try{const v=await jsonFetch(`${base}/api/version`,{method:'GET'});version=String(v.version||'');}catch{}}catch{}
  const modelsDir=currentModelsDir(); const disk=directoryDiskInfo(modelsDir); const jobs=[...MODEL_PULL_JOBS.entries()].map(([model,j])=>({model,status:j.status,progress:j.progress||0,startedAt:j.startedAt,finishedAt:j.finishedAt,error:j.error,output:j.output}));
  res.json({ok:true,ollama,ollamaVersion:version,models,modelsDir,disk,installedBytes:models.reduce((n,m)=>n+(Number(m.size)||0),0),drives:windowsDrives(),jobs});
});
app.post('/api/local/delete-model',(req,res)=>{
  const model=String(req.body?.model||'').trim(); if(!model||!/^[a-zA-Z0-9._:/-]{2,120}$/.test(model))return res.status(400).json({error:'Tên model không hợp lệ.'}); if(MODEL_PULL_JOBS.get(model)?.status==='running')return res.status(409).json({error:'Model đang tải. Hãy hủy tải trước khi xóa.'});
  try{const r=spawnSync('ollama',['rm',model],{encoding:'utf8',windowsHide:true,timeout:120000});if(r.error)throw r.error;if(r.status!==0)throw new Error((r.stderr||r.stdout||'ollama rm thất bại').trim());res.json({ok:true,model});}catch(err){res.status(500).json({error:err.message||'Không xóa được model.'});}
});
app.post('/api/local/model-directory',async(req,res)=>{
  try{if([...MODEL_PULL_JOBS.values()].some(j=>j.status==='running'))return res.status(409).json({error:'Đang có model được tải. Hãy chờ hoặc hủy tải trước khi đổi thư mục model.'});const requested=String(req.body?.path||'').trim();if(!requested)return res.status(400).json({error:'Thiếu đường dẫn thư mục model.'});const dir=path.resolve(requested);fs.mkdirSync(dir,{recursive:true});setUserModelsDir(dir);const restart=req.body?.restart!==false;const rr=restart?await restartOllamaServer():{ok:true};res.json({ok:true,path:dir,restartOk:rr.ok,message:rr.ok?`Đã dùng thư mục model: ${dir}`:`Đã đặt OLLAMA_MODELS=${dir}. ${rr.message||'Hãy khởi động lại Ollama.'}`});}catch(err){res.status(500).json({error:err.message||'Không đổi được thư mục model.'});}
});
app.post('/api/local/open-model-directory',(_req,res)=>{
  try{const dir=currentModelsDir();fs.mkdirSync(dir,{recursive:true});if(process.platform==='win32')spawn('explorer.exe',[dir],{detached:true,windowsHide:true,stdio:'ignore'}).unref();else if(process.platform==='darwin')spawn('open',[dir],{detached:true,stdio:'ignore'}).unref();else spawn('xdg-open',[dir],{detached:true,stdio:'ignore'}).unref();res.json({ok:true,path:dir});}catch(err){res.status(500).json({error:err.message||'Không mở được thư mục model.'});}
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

