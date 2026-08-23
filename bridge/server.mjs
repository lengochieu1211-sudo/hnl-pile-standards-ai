import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { spawnSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const app = express();
const PORT = Number(process.env.PORT || 8787);
const configuredOrigins = String(process.env.ALLOWED_ORIGIN || '').split(',').map(x=>x.trim()).filter(Boolean);
function allowCorsOrigin(origin, callback) {
  if (!origin || origin === 'null') return callback(null, true); // same-origin/non-browser/file:// Electron fallback
  if (configuredOrigins.includes(origin)) return callback(null, true);
  try {
    const u = new URL(origin);
    if (['localhost','127.0.0.1','::1'].includes(u.hostname)) return callback(null, true);
  } catch { /* invalid origin */ }
  return callback(new Error('Origin không được phép truy cập HNL Bridge.'));
}
app.use(cors({ origin: allowCorsOrigin }));
app.use(express.json({ limit: '32mb' }));

const configured = (ollamaReady = false) => ({
  ollama: ollamaReady,
  openai: Boolean(process.env.OPENAI_API_KEY),
  gemini: Boolean(process.env.GEMINI_API_KEY),
  claude: Boolean(process.env.ANTHROPIC_API_KEY),
  grok: Boolean(process.env.XAI_API_KEY)
});

let OLLAMA_HEALTH = { ready:false, checkedAt:0, checking:false };
async function refreshOllamaHealth() {
  if (OLLAMA_HEALTH.checking) return;
  OLLAMA_HEALTH.checking = true;
  try {
    const base = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/,'');
    const r = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(500) });
    OLLAMA_HEALTH.ready = r.ok;
  } catch { OLLAMA_HEALTH.ready = false; }
  finally { OLLAMA_HEALTH.checkedAt = Date.now(); OLLAMA_HEALTH.checking = false; }
}

app.get('/api/health', (_req, res) => {
  // Identity/health must answer immediately so Electron can distinguish HNL Bridge
  // from an unrelated server on the same port. Ollama probing happens in background.
  if (Date.now() - OLLAMA_HEALTH.checkedAt > 2500) refreshOllamaHealth().catch(()=>{});
  res.json({ ok:true, service:'HNL AI Bridge', providers:configured(OLLAMA_HEALTH.ready), ollamaCheckedAt:OLLAMA_HEALTH.checkedAt || null, localUrl:`http://127.0.0.1:${PORT}` });
});

function requireKey(name, override = '') {
  const value = String(override || process.env[name] || '').trim();
  if (!value) throw new Error(`Thiếu API key cho ${name}`);
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
    const error = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    error.status = r.status;
    error.code = data?.error?.status || data?.error?.code || data?.code || '';
    error.payload = data;
    throw error;
  }
  return data;
}

async function askOpenAI(model, messages, images = [], apiKey = '') {
  const key = requireKey('OPENAI_API_KEY', apiKey);
  const data = await jsonFetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: model || 'gpt-4.1-mini', messages: messages.map((m, i) => (images.length && i === messages.length - 1 && m.role === 'user') ? ({ ...m, content: [{ type:'text', text:m.content }, ...images.map(x => ({ type:'image_url', image_url:{ url:`data:${x.mimeType || 'image/jpeg'};base64,${x.data}` } }))] }) : m), temperature: 0.1 })
  });
  return data.choices?.[0]?.message?.content || 'OpenAI không trả về nội dung văn bản.';
}

async function askGemini(model, messages, images = [], apiKey = '') {
  const key = requireKey('GEMINI_API_KEY', apiKey);
  const system = messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
  const nonSystem = messages.filter(m=>m.role!=='system');
  const contents = nonSystem.map((m, i)=>({ role: m.role === 'assistant' ? 'model' : 'user', parts:[{text:m.content}, ...(images.length && i === nonSystem.length - 1 && m.role !== 'assistant' ? images.map(x => ({ inlineData:{ mimeType:x.mimeType || 'image/jpeg', data:x.data } })) : [])] }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || 'gemini-3.7-flash')}:generateContent`;
  const data = await jsonFetch(url, {
    method:'POST',
    headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({ systemInstruction: system ? { parts:[{text:system}] } : undefined, contents })
  });
  return data.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('') || 'Gemini không trả về nội dung văn bản.';
}

async function askClaude(model, messages, images = [], apiKey = '') {
  const key = requireKey('ANTHROPIC_API_KEY', apiKey);
  const system = messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
  const nonSystem = messages.filter(m=>m.role!=='system');
  const chat = nonSystem.map((m, i)=>({ role:m.role==='assistant'?'assistant':'user', content:(images.length && i === nonSystem.length - 1 && m.role !== 'assistant') ? [...images.map(x => ({ type:'image', source:{ type:'base64', media_type:x.mimeType || 'image/jpeg', data:x.data } })), { type:'text', text:m.content }] : m.content }));
  const data = await jsonFetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
    body:JSON.stringify({ model:model || 'claude-haiku-4-5', max_tokens:2200, system, messages:chat })
  });
  return data.content?.filter(x=>x.type==='text').map(x=>x.text).join('\n') || 'Claude không trả về nội dung văn bản.';
}

async function askGrok(model, messages, images = [], apiKey = '') {
  const key = requireKey('XAI_API_KEY', apiKey);
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


let OLLAMA_EXE_CACHE;
function findOllamaExecutable() {
  if (OLLAMA_EXE_CACHE !== undefined) return OLLAMA_EXE_CACHE || null;
  const candidates = [process.env.OLLAMA_EXE];
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || '';
    const pf = process.env.ProgramFiles || process.env.PROGRAMFILES || '';
    candidates.push(
      local && path.join(local, 'Programs', 'Ollama', 'ollama.exe'),
      local && path.join(local, 'Ollama', 'ollama.exe'),
      pf && path.join(pf, 'Ollama', 'ollama.exe')
    );
  }
  for (const candidate of candidates.filter(Boolean)) {
    try { if (fs.existsSync(candidate)) return (OLLAMA_EXE_CACHE = candidate); } catch {}
  }
  try {
    const cmd = process.platform === 'win32' ? 'where.exe' : 'which';
    const r = spawnSync(cmd, ['ollama'], { encoding:'utf8', windowsHide:true, timeout:2500 });
    const found = String(r.stdout || '').split(/\r?\n/).map(x=>x.trim()).find(Boolean);
    if (r.status === 0 && found) return (OLLAMA_EXE_CACHE = found);
  } catch {}
  OLLAMA_EXE_CACHE = '';
  return null;
}
function requireOllamaExecutable() {
  const exe = findOllamaExecutable();
  if (!exe) {
    const error = new Error('Máy chưa cài Ollama hoặc HNL không tìm thấy ollama.exe. Hãy cài Ollama trước rồi mở lại HNL Desktop AI.');
    error.code = 'OLLAMA_NOT_INSTALLED';
    throw error;
  }
  return exe;
}


const OLLAMA_INSTALL = { status:'idle', progress:0, method:'', message:'', error:'', startedAt:null, finishedAt:null };
function resetOllamaExecutableCache() { OLLAMA_EXE_CACHE = undefined; }
function waitChild(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve(code) : reject(new Error(`Tiến trình kết thúc với mã ${code}`)));
  });
}
async function waitForOllamaExecutable(timeoutMs=90000) {
  const started=Date.now();
  while(Date.now()-started < timeoutMs) {
    resetOllamaExecutableCache();
    const exe=findOllamaExecutable();
    if(exe) return exe;
    await new Promise(r=>setTimeout(r,1500));
  }
  return null;
}
async function verifyWindowsSignature(file) {
  if(process.platform!=='win32') return true;
  const escaped=String(file).replaceAll("'", "''");
  const script=`$s=Get-AuthenticodeSignature -LiteralPath '${escaped}'; if($s.Status -ne 'Valid'){Write-Error ('Signature='+$s.Status); exit 2}; Write-Output $s.SignerCertificate.Subject`;
  const r=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',script],{encoding:'utf8',windowsHide:true,timeout:30000});
  if(r.status!==0) throw new Error(`Không xác minh được chữ ký số Ollama: ${(r.stderr||r.stdout||'Unknown signature').trim()}`);
  return true;
}
async function tryWingetInstallOllama() {
  if(process.platform!=='win32') return false;
  const exists=spawnSync('where.exe',['winget.exe'],{encoding:'utf8',windowsHide:true,timeout:3000});
  if(exists.status!==0) return false;
  OLLAMA_INSTALL.method='winget'; OLLAMA_INSTALL.message='Đang cài Ollama bằng Windows Package Manager…'; OLLAMA_INSTALL.progress=20;
  const child=spawn('winget.exe',['install','--id','Ollama.Ollama','-e','--silent','--accept-package-agreements','--accept-source-agreements'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let out=''; child.stdout?.on('data',d=>{out+=String(d); OLLAMA_INSTALL.progress=Math.min(85,OLLAMA_INSTALL.progress+1);}); child.stderr?.on('data',d=>{out+=String(d);});
  try { await waitChild(child); return true; } catch(error) { console.warn('winget Ollama install failed:', out.slice(-2000), error.message); return false; }
}
async function downloadOfficialOllamaInstaller() {
  const url='https://ollama.com/download/OllamaSetup.exe';
  OLLAMA_INSTALL.method='official-installer'; OLLAMA_INSTALL.message='Đang tải OllamaSetup.exe từ ollama.com…'; OLLAMA_INSTALL.progress=25;
  const response=await fetch(url,{redirect:'follow'});
  if(!response.ok) throw new Error(`Tải OllamaSetup.exe thất bại: HTTP ${response.status}`);
  const total=Number(response.headers.get('content-length')||0);
  const reader=response.body?.getReader?.();
  const chunks=[]; let got=0;
  if(reader){ while(true){ const {done,value}=await reader.read(); if(done)break; chunks.push(value); got+=value.byteLength; if(total) OLLAMA_INSTALL.progress=Math.min(65,25+Math.round(got/total*40)); } }
  else { const b=new Uint8Array(await response.arrayBuffer()); chunks.push(b); got=b.byteLength; }
  const installer=path.join(os.tmpdir(),`HNL-OllamaSetup-${Date.now()}.exe`);
  fs.writeFileSync(installer, Buffer.concat(chunks.map(c=>Buffer.from(c))));
  await verifyWindowsSignature(installer);
  return installer;
}
async function installOllamaJob() {
  if(process.platform!=='win32') throw new Error('Cài Ollama tự động hiện chỉ hỗ trợ Windows.');
  if(findOllamaExecutable()) return findOllamaExecutable();
  OLLAMA_INSTALL.status='running'; OLLAMA_INSTALL.progress=5; OLLAMA_INSTALL.error=''; OLLAMA_INSTALL.startedAt=new Date().toISOString(); OLLAMA_INSTALL.finishedAt=null;
  let installed=await tryWingetInstallOllama();
  let installer='';
  if(!installed){
    installer=await downloadOfficialOllamaInstaller();
    OLLAMA_INSTALL.message='Đang cài Ollama im lặng…'; OLLAMA_INSTALL.progress=70;
    const child=spawn(installer,['/S'],{windowsHide:true,stdio:'ignore'});
    await waitChild(child);
  }
  OLLAMA_INSTALL.message='Đang xác nhận Ollama sau khi cài…'; OLLAMA_INSTALL.progress=90;
  const exe=await waitForOllamaExecutable(120000);
  if(!exe) throw new Error('Đã chạy trình cài nhưng HNL chưa tìm thấy ollama.exe. Hãy đăng xuất/khởi động lại Windows hoặc cài Ollama thủ công.');
  try { if(installer) fs.rmSync(installer,{force:true}); } catch {}
  OLLAMA_INSTALL.status='done'; OLLAMA_INSTALL.progress=100; OLLAMA_INSTALL.message='Ollama đã cài xong.'; OLLAMA_INSTALL.finishedAt=new Date().toISOString();
  return exe;
}

app.post('/api/local/install-ollama', async (_req,res)=>{
  if(findOllamaExecutable()) return res.json({ok:true,status:'done',progress:100,message:'Ollama đã được cài.',executable:findOllamaExecutable()});
  if(OLLAMA_INSTALL.status==='running') return res.json({ok:true,...OLLAMA_INSTALL});
  OLLAMA_INSTALL.status='running'; OLLAMA_INSTALL.progress=1; OLLAMA_INSTALL.message='Đang chuẩn bị cài Ollama…'; OLLAMA_INSTALL.error='';
  installOllamaJob().catch(error=>{OLLAMA_INSTALL.status='error';OLLAMA_INSTALL.error=error.message;OLLAMA_INSTALL.message='Cài Ollama thất bại.';OLLAMA_INSTALL.finishedAt=new Date().toISOString();console.error('Ollama install failed:',error);});
  res.json({ok:true,...OLLAMA_INSTALL});
});
app.get('/api/local/ollama-install-status',(_req,res)=>res.json({ok:true,installed:Boolean(findOllamaExecutable()),...OLLAMA_INSTALL}));

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
  try{const exe=requireOllamaExecutable();const child=spawn(exe,['serve'],{detached:true,windowsHide:true,stdio:'ignore',env:{...process.env}});child.once('error',()=>{});child.unref();}catch(err){return {ok:false,message:err.message,code:err.code};}
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

let BUILTIN_UNRAR = undefined;
function loadBuiltinUnrar() {
  if (BUILTIN_UNRAR !== undefined) return BUILTIN_UNRAR;
  try { BUILTIN_UNRAR = require('node-unrar-js'); }
  catch (error) { console.warn('HNL built-in RAR runtime unavailable:', error.message); BUILTIN_UNRAR = null; }
  return BUILTIN_UNRAR;
}
function safeArchiveEntryName(name='') {
  const clean = String(name || '').replaceAll('\\','/').replace(/^[A-Za-z]:/, '').replace(/^\/+/, '');
  const parts = clean.split('/').filter(part => part && part !== '.' && part !== '..');
  return parts.join('/');
}
async function extractRarBuiltIn(input, output, password='') {
  const unrar = loadBuiltinUnrar();
  if (!unrar?.createExtractorFromFile) return { ok:false, code:'BUILTIN_UNRAR_MISSING', text:'node-unrar-js chưa được đóng gói.' };
  try {
    const extractor = await unrar.createExtractorFromFile({
      filepath: input, targetPath: output, password: password || undefined,
      filenameTransform: safeArchiveEntryName
    });
    const listed = extractor.getFileList();
    const headers = [...listed.fileHeaders]; // exhaust iterator to release native/WASM objects
    const encrypted = headers.some(h => Boolean(h?.flags?.encrypted));
    if (encrypted && !password) return { ok:false, code:'PASSWORD_REQUIRED', text:'RAR có mục được mã hóa.' };
    const result = extractor.extract();
    const files = [...result.files]; // must traverse iterator fully
    const failed = files.find(f => f?.extraction === null && !f?.fileHeader?.flags?.directory);
    if (failed) return { ok:false, code:password ? 'BAD_PASSWORD' : 'ARCHIVE_ERROR', text:`Không giải nén được ${failed.fileHeader?.name || 'mục RAR'}.` };
    return { ok:true, tool:'HNL Built-in RAR (node-unrar-js)' };
  } catch (error) {
    const text = `${error?.reason || ''} ${error?.message || error}`.trim();
    if (looksPasswordError(text) || /password|encrypted|ERAR_BAD_PASSWORD/i.test(text)) return { ok:false, code:password ? 'BAD_PASSWORD' : 'PASSWORD_REQUIRED', text };
    return { ok:false, code:'BUILTIN_RAR_ERROR', text };
  }
}
async function extractWithTool(input, output, password='') {
  const ext = path.basename(input).toLowerCase();
  let found = false;
  let passwordIssue = false;
  let lastText = '';
  const candidates = archiveToolCandidates();

  const runExternal = tool => {
    const isUnrar = /unrar/i.test(path.basename(tool));
    const args = isUnrar
      ? ['x','-y', password ? `-p${password}` : '-p-', input, `${output}${path.sep}`]
      : ['x','-y', password ? `-p${password}` : '-p', `-o${output}`, input];
    const result = spawnSync(tool, args, { encoding:'utf8', windowsHide:true, timeout:120000 });
    if (result.error?.code === 'ENOENT') return null;
    found = true;
    lastText = `${result.stdout || ''}\n${result.stderr || ''}`;
    if (looksPasswordError(lastText)) passwordIssue = true;
    return result.status === 0 ? { ok:true, tool } : null;
  };

  // Requested priority: 7-Zip first for every archive format.
  for (const tool of candidates.filter(x => !/unrar/i.test(path.basename(x)))) {
    const ok = runExternal(tool);
    if (ok) return ok;
  }

  // Then WinRAR/UnRAR for RAR archives.
  if (/\.rar$/i.test(ext)) {
    for (const tool of candidates.filter(x => /unrar/i.test(path.basename(x)))) {
      const ok = runExternal(tool);
      if (ok) return ok;
    }
  }

  // Windows/libarchive tar is the no-install fallback for formats it supports.
  if (!/\.7z$/i.test(ext)) {
    const tar = spawnSync('tar', ['-xf', input, '-C', output], { encoding:'utf8', windowsHide:true, timeout:120000 });
    if (tar.error?.code !== 'ENOENT') {
      found = true;
      lastText = `${tar.stdout || ''}\n${tar.stderr || ''}`;
      if (tar.status === 0) return { ok:true, tool:'tar' };
      if (looksPasswordError(lastText)) passwordIssue = true;
    }
  }

  // Finally use the bundled RAR runtime so RAR still works without extra installs.
  if (/\.rar$/i.test(ext)) {
    const builtin = await extractRarBuiltIn(input, output, password);
    if (builtin.ok || ['PASSWORD_REQUIRED','BAD_PASSWORD'].includes(builtin.code)) return builtin;
    lastText = builtin.text || lastText;
  }

  if (passwordIssue) return { ok:false, code:password ? 'BAD_PASSWORD':'PASSWORD_REQUIRED', text:lastText };
  if (!found && !/\.rar$/i.test(ext)) return { ok:false, code:'TOOL_MISSING', text:'Không tìm thấy 7-Zip/WinRAR/tar phù hợp cho archive này.' };
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
    const extracted = await extractWithTool(input, output, password);
    if (!extracted.ok) {
      const status = ['PASSWORD_REQUIRED','BAD_PASSWORD'].includes(extracted.code) ? 401 : 400;
      const lowerName = original.toLowerCase();
      const msg = extracted.code === 'PASSWORD_REQUIRED' ? 'Archive có mật khẩu.'
        : extracted.code === 'BAD_PASSWORD' ? 'Mật khẩu archive không đúng.'
        : extracted.code === 'TOOL_MISSING' ? 'Thiếu engine phù hợp. Hãy cài 7-Zip (ưu tiên) hoặc WinRAR/UnRAR; RAR thường vẫn có HNL Built-in dự phòng.'
        : lowerName.endsWith('.7z') ? 'Không giải nén được 7Z. Hãy kiểm tra/cài 7-Zip trong Cài đặt → Bộ giải nén Desktop.'
        : lowerName.endsWith('.zip') ? 'Không giải nén được ZIP. Nếu file có mật khẩu hoặc phương thức nén đặc biệt, hãy cài 7-Zip rồi thử lại.'
        : lowerName.endsWith('.rar') ? 'Không giải nén được RAR bằng các engine hiện có. Hãy kiểm tra HNL Built-in RAR hoặc cài 7-Zip/WinRAR.'
        : 'Không giải nén được archive. File có thể hỏng hoặc dùng phương thức nén chưa được engine trên máy hỗ trợ.';
      return res.status(status).json({ error:msg, code:extracted.code });
    }
    const allowed = /\.(pdf|png|jpe?g|webp|bmp|gif|txt|md|csv|json|xml|html?|yaml|yml|zip|rar|7z|tar|tgz|gz|bz2|xz)$/i;
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


app.get('/api/local/archive-engines', (_req,res) => {
  const candidates = archiveToolCandidates();
  const available = candidates.filter(commandExists);
  let builtinRar = false;
  try { builtinRar = Boolean(loadBuiltinUnrar()); } catch { builtinRar = false; }
  res.json({
    ok:true,
    builtinRar,
    sevenZip:available.filter(x=>/7z/i.test(path.basename(x))),
    unrar:available.filter(x=>/unrar/i.test(path.basename(x))),
    tar:commandExists('tar'),
    priority:['7-Zip','WinRAR/UnRAR','Windows tar','HNL Built-in RAR']
  });
});

const MODEL_PULL_JOBS = new Map();
app.post('/api/local/pull-model', (req, res) => {
  try {
    const model = String(req.body?.model || '').trim();
    if (!model || !/^[a-zA-Z0-9._:/-]{2,120}$/.test(model)) return res.status(400).json({ error:'Tên model Ollama không hợp lệ.' });
    if (MODEL_PULL_JOBS.get(model)?.status === 'running') return res.json({ ok:true, model, status:'running' });
    const exe = requireOllamaExecutable();
    const child = spawn(exe, ['pull', model], { windowsHide:true, stdio:['ignore','pipe','pipe'] });
    const job = { status:'running', startedAt:new Date().toISOString(), output:'', progress:0, pid:child.pid, child };
    MODEL_PULL_JOBS.set(model, job);
    const add = chunk => updatePullProgress(job, chunk);
    child.stdout?.on('data', add); child.stderr?.on('data', add);
    child.on('error', err => { job.status='error'; job.error=err.message; });
    child.on('exit', code => { job.status = code === 0 ? 'done' : (job.status === 'cancelled' ? 'cancelled' : 'error'); job.progress = code === 0 ? 100 : job.progress; job.exitCode=code; job.finishedAt=new Date().toISOString(); delete job.child; });
    res.json({ ok:true, model, status:'running' });
  } catch (err) { res.status(err.code === 'OLLAMA_NOT_INSTALLED' ? 503 : 500).json({ error:err.message || 'Không chạy được ollama pull.', code:err.code || 'OLLAMA_PULL_ERROR' }); }
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
  res.json({ok:true,ollama,ollamaInstalled:Boolean(findOllamaExecutable()),ollamaInstall:{...OLLAMA_INSTALL},ollamaVersion:version,models,modelsDir,disk,installedBytes:models.reduce((n,m)=>n+(Number(m.size)||0),0),drives:windowsDrives(),jobs});
});
app.post('/api/local/delete-model',(req,res)=>{
  const model=String(req.body?.model||'').trim(); if(!model||!/^[a-zA-Z0-9._:/-]{2,120}$/.test(model))return res.status(400).json({error:'Tên model không hợp lệ.'}); if(MODEL_PULL_JOBS.get(model)?.status==='running')return res.status(409).json({error:'Model đang tải. Hãy hủy tải trước khi xóa.'});
  try{const exe=requireOllamaExecutable();const r=spawnSync(exe,['rm',model],{encoding:'utf8',windowsHide:true,timeout:120000});if(r.error)throw r.error;if(r.status!==0)throw new Error((r.stderr||r.stdout||'ollama rm thất bại').trim());res.json({ok:true,model});}catch(err){res.status(500).json({error:err.message||'Không xóa được model.'});}
});
app.post('/api/local/model-directory',async(req,res)=>{
  try{if([...MODEL_PULL_JOBS.values()].some(j=>j.status==='running'))return res.status(409).json({error:'Đang có model được tải. Hãy chờ hoặc hủy tải trước khi đổi thư mục model.'});const requested=String(req.body?.path||'').trim();if(!requested)return res.status(400).json({error:'Thiếu đường dẫn thư mục model.'});const dir=path.resolve(requested);fs.mkdirSync(dir,{recursive:true});setUserModelsDir(dir);const restart=req.body?.restart!==false;const rr=restart?await restartOllamaServer():{ok:true};res.json({ok:true,path:dir,restartOk:rr.ok,message:rr.ok?`Đã dùng thư mục model: ${dir}`:`Đã đặt OLLAMA_MODELS=${dir}. ${rr.message||'Hãy khởi động lại Ollama.'}`});}catch(err){res.status(500).json({error:err.message||'Không đổi được thư mục model.'});}
});
app.post('/api/local/open-model-directory',(_req,res)=>{
  try{const dir=currentModelsDir();fs.mkdirSync(dir,{recursive:true});if(process.platform==='win32')spawn('explorer.exe',[dir],{detached:true,windowsHide:true,stdio:'ignore'}).unref();else if(process.platform==='darwin')spawn('open',[dir],{detached:true,stdio:'ignore'}).unref();else spawn('xdg-open',[dir],{detached:true,stdio:'ignore'}).unref();res.json({ok:true,path:dir});}catch(err){res.status(500).json({error:err.message||'Không mở được thư mục model.'});}
});

const BRIDGE_FALLBACK_MODELS = {
  ollama: [],
  gemini: ['gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite','gemini-3.1-pro-preview','gemini-3.1-flash-lite','gemini-3-flash-preview','gemini-2.5-pro','gemini-2.5-flash','gemini-2.5-flash-lite','gemini-flash-latest'],
  openai: ['gpt-5.6-sol','gpt-5.6-terra','gpt-5.6-luna','gpt-5.4-mini','gpt-4.1-mini'],
  claude: ['claude-opus-4-1','claude-sonnet-4-5','claude-haiku-4-5'],
  grok: ['grok-4-1-fast-reasoning','grok-4-1-fast-non-reasoning','grok-4','grok-3-mini']
};

function uniqueModels(list=[]) { return [...new Set(list.map(x=>String(x||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b)); }
function isGeminiChatModel(model) {
  const id=String(model||'').toLowerCase();
  return id.startsWith('gemini-') && !/(?:embedding|image|imagen|veo|lyria|tts|live|robotics|omni|aqa)/.test(id);
}
function sortGeminiModels(list=[]) {
  const clean=[...new Set(list.map(x=>String(x||'').trim()).filter(Boolean))];
  const score=id=>{const x=id.toLowerCase();const m=x.match(/^gemini-(\d+)(?:\.(\d+))?/);let n=m?Number(m[1])*10000+Number(m[2]||0)*1000:0;if(x==='gemini-3.7-flash')n+=900;if(x==='gemini-3.6-flash')n+=850;if(x.includes('pro'))n+=70;if(x.includes('flash'))n+=50;if(x.includes('lite'))n-=10;if(x.includes('preview'))n-=20;if(x.includes('latest'))n-=30;return n;};
  return clean.sort((a,b)=>score(b)-score(a)||a.localeCompare(b));
}

async function providerModels(provider, apiKey = '') {
  try {
    if (provider === 'ollama') {
      const base = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/,'');
      const data = await jsonFetch(`${base}/api/tags`, { method:'GET' });
      return { models:uniqueModels((data.models || []).map(x=>x.name || x.model)), verified:true, source:'ollama', warning:'' };
    }
    if (provider === 'gemini') {
      const key = requireKey('GEMINI_API_KEY', apiKey);
      const all=[]; let pageToken='';
      for (let page=0; page<20; page++) {
        const params=new URLSearchParams({pageSize:'100'});
        if(pageToken) params.set('pageToken',pageToken);
        const data=await jsonFetch(`https://generativelanguage.googleapis.com/v1beta/models?${params.toString()}`, {headers:{'x-goog-api-key':key}});
        all.push(...(data.models||[]));
        pageToken=String(data.nextPageToken||'');
        if(!pageToken) break;
      }
      const generationModels=all.filter(m=>!m.supportedGenerationMethods||m.supportedGenerationMethods.includes('generateContent')).map(m=>String(m.name||'').replace(/^models\//,''));
      const chatModels=generationModels.filter(isGeminiChatModel);
      return {models:sortGeminiModels(chatModels),verified:true,source:'gemini-api',warning:'',discoveredCount:uniqueModels(generationModels).length,compatibleCount:uniqueModels(chatModels).length,filteredCount:Math.max(0,uniqueModels(generationModels).length-uniqueModels(chatModels).length)};
    }
    if (provider === 'openai') {
      const key = requireKey('OPENAI_API_KEY', apiKey);
      const data = await jsonFetch('https://api.openai.com/v1/models', { headers:{Authorization:`Bearer ${key}`} });
      return { models:uniqueModels((data.data || []).map(x=>x.id).filter(id=>/^(gpt-|o\d|chat-)/.test(id))), verified:true, source:'openai-api', warning:'' };
    }
    if (provider === 'claude') {
      const key = requireKey('ANTHROPIC_API_KEY', apiKey);
      const data = await jsonFetch('https://api.anthropic.com/v1/models?limit=100', { headers:{'x-api-key':key,'anthropic-version':'2023-06-01'} });
      return { models:uniqueModels((data.data || []).map(x=>x.id)), verified:true, source:'anthropic-api', warning:'' };
    }
    if (provider === 'grok') {
      const key = requireKey('XAI_API_KEY', apiKey);
      const data = await jsonFetch('https://api.x.ai/v1/models', { headers:{Authorization:`Bearer ${key}`} });
      return { models:uniqueModels((data.data || data.models || []).map(x=>x.id || x.name)), verified:true, source:'xai-api', warning:'' };
    }
  } catch (err) {
    console.warn(`Model list ${provider} failed:`, err.message);
    return { models:BRIDGE_FALLBACK_MODELS[provider] || [], verified:false, source:'catalog', warning:`Không xác minh được danh sách model.${err?.message ? ` ${err.message}` : ''}` };
  }
  return { models:BRIDGE_FALLBACK_MODELS[provider] || [], verified:false, source:'catalog', warning:'Không xác minh được danh sách model: Provider không hỗ trợ xác minh danh sách model.' };
}

app.get('/api/models/:provider', async (req, res) => {
  const provider = String(req.params.provider || '');
  if (!['ollama','gemini','openai','claude','grok'].includes(provider)) return res.status(400).json({error:'Provider không hợp lệ.'});
  const result = await providerModels(provider, String(req.get('X-HNL-API-Key') || '').trim());
  res.json({ provider, ...result });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { provider, model, messages, images = [], apiKey = '' } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error:'Thiếu messages.' });
    let text;
    if (provider === 'openai') text = await askOpenAI(model, messages, images, apiKey);
    else if (provider === 'gemini') text = await askGemini(model, messages, images, apiKey);
    else if (provider === 'claude') text = await askClaude(model, messages, images, apiKey);
    else if (provider === 'grok') text = await askGrok(model, messages, images, apiKey);
    else if (provider === 'ollama') text = await askOllama(model, messages, images);
    else return res.status(400).json({ error:`Provider không hỗ trợ: ${provider}` });
    res.json({ text });
  } catch (err) {
    console.error(err);
    const status = Number(err?.status || 0);
    const safeStatus = [400,401,403,404,408,409,429,500,502,503,504].includes(status) ? status : 500;
    res.status(safeStatus).json({ error: err.message || 'AI Bridge lỗi không xác định.', code: err?.code || '', upstreamStatus: status || null });
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

app.listen(PORT, '127.0.0.1', () => { console.log(`HNL Local AI: http://127.0.0.1:${PORT}`); refreshOllamaHealth().catch(()=>{}); });

