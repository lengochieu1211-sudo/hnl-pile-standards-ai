import './styles.css';
import { parsePdf, renderPdfPage } from './pdf.js';
import { saveDocument, getDocuments, deleteDocument } from './db.js';
import { searchChunks, localSummary } from './search.js';
import { PROVIDERS, buildRagPrompt, callBridge, bridgeHealth } from './ai.js';
import { axialResistance, tcvn7888Checklist } from './calculators.js';

const state = {
  docs: [],
  selected: new Set(),
  activeDocId: null,
  page: 1,
  tab: 'summary',
  mobile: 'assistant',
  chat: [],
  settings: {
    provider: localStorage.getItem('hnl.provider') || 'local',
    model: localStorage.getItem('hnl.model') || '',
    bridgeUrl: localStorage.getItem('hnl.bridge') || 'http://127.0.0.1:8787',
    strict: localStorage.getItem('hnl.strict') !== 'false'
  },
  progress: null,
  notice: '',
  bridge: null
};

const app = document.querySelector('#app');

function esc(s='') { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
function fmtBytes(n) { if (!n) return '0 B'; const u=['B','KB','MB','GB']; let i=0,v=n; while(v>=1024&&i<u.length-1){v/=1024;i++;} return `${v.toFixed(i?1:0)} ${u[i]}`; }
function activeDoc() { return state.docs.find(d => d.id === state.activeDocId) || null; }
function selectedDocs() { return state.docs.filter(d => state.selected.has(d.id)); }
function providerModel() { return state.settings.model || PROVIDERS[state.settings.provider]?.model || ''; }

function saveSettings() {
  localStorage.setItem('hnl.provider', state.settings.provider);
  localStorage.setItem('hnl.model', state.settings.model);
  localStorage.setItem('hnl.bridge', state.settings.bridgeUrl);
  localStorage.setItem('hnl.strict', String(state.settings.strict));
}

function render() {
  const doc = activeDoc();
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <img src="./hnl-logo.png" alt="HNL" />
          <div><div class="brand-title">HNL Pile Standards AI</div><div class="brand-sub">Trợ lý tiêu chuẩn & kỹ thuật cọc</div></div>
        </div>
        <div class="top-actions">
          <span class="status-pill">${esc(PROVIDERS[state.settings.provider]?.label || 'AI')}</span>
          <span class="status-pill ${state.bridge?.ok ? 'success' : 'muted'}">${state.settings.provider === 'local' ? 'Không cần Bridge' : (state.bridge?.ok ? 'Bridge sẵn sàng' : 'Bridge chưa kết nối')}</span>
        </div>
      </header>
      <main class="workspace" data-mobile="${state.mobile}">
        <aside class="sidebar">
          <div class="section-title">Thư viện tiêu chuẩn</div>
          <label class="upload-box">＋ Tải 1 hoặc nhiều PDF<input id="pdfInput" type="file" accept="application/pdf,.pdf" multiple></label>
          <div class="doc-list">${state.docs.length ? state.docs.map(docItem).join('') : '<div class="card muted">Chưa có PDF. Tài liệu được lưu cục bộ trong trình duyệt sau khi phân tích.</div>'}</div>
          <div class="section-title" style="margin-top:18px">Quy tắc nguồn</div>
          <label class="checkline"><input id="strictSide" type="checkbox" ${state.settings.strict?'checked':''}> Chỉ trả lời theo tài liệu đang chọn</label>
          <div class="card muted" style="font-size:11px;margin-top:10px">Không đưa API key vào mã nguồn GitHub. AI online đi qua HNL AI Bridge.</div>
        </aside>
        <section class="viewer">
          <div class="viewer-toolbar">
            <span class="title">${doc ? esc(doc.standard || doc.name) : 'Trình đọc PDF'}</span>
            <span style="margin-left:auto"></span>
            <button class="btn small" id="prevPage" ${!doc?'disabled':''}>←</button>
            <input id="pageInput" value="${state.page}" ${!doc?'disabled':''}>
            <span class="muted">/ ${doc?.pageCount || 0}</span>
            <button class="btn small" id="nextPage" ${!doc?'disabled':''}>→</button>
          </div>
          ${doc ? '<div class="canvas-wrap"><canvas id="pdfCanvas"></canvas></div>' : '<div class="empty-view"><h2>HNL Pile Standards AI</h2><p>Chọn hoặc tải một PDF tiêu chuẩn để bắt đầu đọc, tra cứu, hỏi AI, so sánh và tính toán.</p></div>'}
        </section>
        <aside class="assistant-panel">
          <div class="tabs">${[
            ['summary','Tóm tắt'],['chat','Hỏi AI'],['lookup','Tra nhanh'],['calc','Tính toán'],['compare','So sánh'],['checklist','Checklist'],['settings','Cài đặt']
          ].map(([id,label])=>`<button class="tab ${state.tab===id?'active':''}" data-tab="${id}">${label}</button>`).join('')}</div>
          <div class="panel-body">${panelHtml()}</div>
        </aside>
      </main>
      <nav class="mobile-nav">
        <button data-mobile="library" class="${state.mobile==='library'?'active':''}">📚 Thư viện</button>
        <button data-mobile="viewer" class="${state.mobile==='viewer'?'active':''}">📄 PDF</button>
        <button data-mobile="assistant" class="${state.mobile==='assistant'?'active':''}">🤖 Trợ lý</button>
      </nav>
      ${state.progress ? `<div class="progress-overlay"><div class="progress-box"><b>${esc(state.progress.title)}</b><div class="muted" style="margin-top:6px">${esc(state.progress.detail)}</div><div class="progress-bar"><div style="width:${state.progress.pct}%"></div></div></div></div>`:''}
    </div>`;
  bind();
  if (doc) queueMicrotask(() => drawPage());
}

function docItem(d) {
  return `<div class="doc-item">
    <div class="doc-row">
      <input type="checkbox" data-select="${d.id}" ${state.selected.has(d.id)?'checked':''} title="Chọn làm nguồn AI">
      <div style="min-width:0;flex:1"><div class="doc-name">${esc(d.standard || d.name)}</div><div class="doc-meta">${esc(d.name)} · ${d.pageCount} trang · ${fmtBytes(d.size)}</div></div>
    </div>
    <div class="doc-actions"><button class="btn small" data-open="${d.id}">Mở PDF</button><button class="btn small danger" data-delete="${d.id}">Xóa</button></div>
  </div>`;
}

function panelHtml() {
  if (state.tab === 'summary') return summaryHtml();
  if (state.tab === 'chat') return chatHtml();
  if (state.tab === 'lookup') return lookupHtml();
  if (state.tab === 'calc') return calcHtml();
  if (state.tab === 'compare') return compareHtml();
  if (state.tab === 'checklist') return checklistHtml();
  return settingsHtml();
}

function summaryHtml() {
  const docs = selectedDocs();
  const doc = docs[0] || activeDoc();
  if (!doc) return '<div class="card muted">Chọn ít nhất một PDF để xem tóm tắt.</div>';
  const sum = localSummary(doc);
  return `<div class="card"><h3>${esc(doc.standard || doc.name)}</h3><p class="muted">Tóm tắt cục bộ ưu tiên đề mục và các câu chứa yêu cầu định lượng. Dùng nút AI để có bản tóm tắt sâu hơn.</p><button class="btn primary" id="aiSummary">Tóm tắt chuyên sâu bằng AI</button></div>
  <div class="card"><h3>Cấu trúc nhận diện</h3>${sum.headings.slice(0,16).map(x=>`<p><button class="citation" data-jump="${x.page}">Trang ${x.page}</button> ${esc(x.text)}</p>`).join('') || '<p class="muted">Chưa nhận diện được đề mục rõ ràng.</p>'}</div>
  <div class="card"><h3>Điểm cần chú ý</h3>${sum.important.slice(0,12).map(x=>`<p><button class="citation" data-jump="${x.page}">Trang ${x.page}</button> ${esc(x.text)}</p>`).join('')}</div>`;
}

function chatHtml() {
  return `<div class="chat-log">${state.chat.length ? state.chat.map(m=>`<div class="message ${m.role==='user'?'user':'ai'}">${esc(m.text)}</div>`).join('') : '<div class="card muted">Ví dụ: “Cọc PHC D600 cấp B có mômen uốn nứt bao nhiêu?”, “Điều kiện nghiệm thu lô cọc là gì?”, “So sánh yêu cầu ngoại quan giữa các file đang chọn”.</div>'}</div>
  <div class="chat-input"><textarea id="chatQuestion" placeholder="Hỏi theo tiêu chuẩn đang chọn..."></textarea><button class="btn primary" id="askBtn">Gửi</button></div>`;
}

function lookupHtml() {
  return `<div class="field"><label>Từ khóa / thông số cần tra</label><input id="lookupQuery" placeholder="Ví dụ: PHC D600 loại B, vết nứt, sai lệch đường kính..."></div><button class="btn primary" id="lookupBtn">Tra trong PDF</button><div id="lookupResults" style="margin-top:10px"></div>`;
}

function calcHtml() {
  return `<div class="card"><h3>Sức kháng nén dọc trục theo vật liệu</h3><p class="muted">Công thức tham chiếu TCVN 7888:2014, Phụ lục B. Dùng để hỗ trợ kiểm tra; luôn đối chiếu bản tiêu chuẩn gốc và hồ sơ thiết kế.</p>
  <div class="grid2"><div class="field"><label>Diện tích Ao (mm²)</label><input id="cArea" type="number" placeholder="Ví dụ 180000"></div><div class="field"><label>σcu (MPa)</label><input id="cCu" type="number" placeholder="80"></div><div class="field"><label>σce (MPa)</label><input id="cCe" type="number" placeholder="8"></div><div class="field"><label>Hệ số α</label><select id="cAlpha"><option value="3.5">3.5 · PHC/NPH</option><option value="4">4.0 · PC</option></select></div></div>
  <button class="btn primary" id="calcBtn">Tính</button><div id="calcResult"></div></div>
  <div class="card"><h3>Nguyên tắc</h3><p>Ra = (σcu/α − σce/4) × Ao. Vì MPa = N/mm², kết quả được đổi sang kN.</p><button class="citation" data-find="Phụ lục B">Mở nguồn trong PDF</button></div>`;
}

function compareHtml() {
  const count = selectedDocs().length;
  return `<div class="card"><h3>So sánh nhiều tiêu chuẩn</h3><p>Đã chọn <b>${count}</b> tài liệu. Tích checkbox trong Thư viện để chọn nguồn.</p></div><div class="field"><label>Nội dung cần so sánh</label><textarea id="compareQuestion" placeholder="Ví dụ: So sánh yêu cầu thử tải, nghiệm thu và giới hạn vết nứt giữa các tiêu chuẩn."></textarea></div><button class="btn primary" id="compareBtn" ${count<2?'disabled':''}>So sánh</button><div id="compareResult"></div>`;
}

function checklistHtml() {
  const has7888 = selectedDocs().some(d => /TCVN\s*7888\s*:\s*2014/i.test(d.standard || '') || /7888/.test(d.name));
  if (!has7888) return `<div class="card"><h3>Checklist nghiệm thu</h3><p class="muted">Bản v1.0 có checklist cục bộ mẫu cho TCVN 7888:2014. Với tiêu chuẩn khác, dùng AI để sinh checklist có citation.</p><button class="btn primary" id="aiChecklist">Tạo checklist bằng AI</button></div>`;
  return `<div class="card"><h3>TCVN 7888:2014 · Hồ sơ nghiệm thu</h3><div class="checklist">${tcvn7888Checklist.map((x,i)=>`<label class="checkline"><input type="checkbox" data-check="${i}"> ${esc(x)}</label>`).join('')}</div></div><div class="card muted">Nguồn chính: Điều 8.2 và Phụ lục C của tài liệu. Nhấn AI nếu muốn tạo checklist chi tiết theo dự án.</div><button class="btn" id="aiChecklist">Mở rộng checklist bằng AI</button>`;
}

function settingsHtml() {
  const opts = Object.entries(PROVIDERS).map(([id,p])=>`<option value="${id}" ${state.settings.provider===id?'selected':''}>${esc(p.label)}</option>`).join('');
  return `<div class="field"><label>Nhà cung cấp AI</label><select id="providerSelect">${opts}</select></div>
  <div class="field"><label>Model</label><input id="modelInput" value="${esc(providerModel())}" placeholder="Tên model"></div>
  <div class="field"><label>HNL AI Bridge URL</label><input id="bridgeInput" value="${esc(state.settings.bridgeUrl)}"></div>
  <label class="checkline"><input id="strictInput" type="checkbox" ${state.settings.strict?'checked':''}> Khóa nguồn: AI chỉ dùng nội dung PDF đang chọn</label>
  <div style="display:flex;gap:8px;margin-top:12px"><button class="btn primary" id="saveSettings">Lưu cài đặt</button><button class="btn" id="testBridge">Kiểm tra Bridge</button></div>
  <div class="card" style="margin-top:12px"><h3>Bảo mật API</h3><p class="muted">API key không nhập trong giao diện web và không commit lên GitHub. Khai báo key trong file <code>bridge/.env</code> trên máy chạy Bridge hoặc biến môi trường của backend.</p></div>`;
}

function bind() {
  document.querySelector('#pdfInput')?.addEventListener('change', uploadPdfs);
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render();});
  document.querySelectorAll('[data-mobile]').forEach(b=>b.onclick=()=>{state.mobile=b.dataset.mobile;render();});
  document.querySelectorAll('[data-select]').forEach(c=>c.onchange=()=>{c.checked?state.selected.add(c.dataset.select):state.selected.delete(c.dataset.select);render();});
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{state.activeDocId=b.dataset.open;state.page=1;state.mobile='viewer';render();});
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>removeDoc(b.dataset.delete));
  document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>jumpPage(Number(b.dataset.jump)));
  document.querySelectorAll('[data-find]').forEach(b=>b.onclick=()=>findInActive(b.dataset.find));
  document.querySelector('#strictSide')?.addEventListener('change', e=>{state.settings.strict=e.target.checked;saveSettings();});
  document.querySelector('#prevPage')?.addEventListener('click',()=>jumpPage(state.page-1));
  document.querySelector('#nextPage')?.addEventListener('click',()=>jumpPage(state.page+1));
  document.querySelector('#pageInput')?.addEventListener('change',e=>jumpPage(Number(e.target.value)));
  document.querySelector('#askBtn')?.addEventListener('click',askQuestion);
  document.querySelector('#chatQuestion')?.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')askQuestion();});
  document.querySelector('#lookupBtn')?.addEventListener('click',runLookup);
  document.querySelector('#calcBtn')?.addEventListener('click',runCalc);
  document.querySelector('#compareBtn')?.addEventListener('click',runCompare);
  document.querySelector('#aiSummary')?.addEventListener('click',aiSummary);
  document.querySelector('#aiChecklist')?.addEventListener('click',aiChecklist);
  document.querySelector('#saveSettings')?.addEventListener('click',updateSettingsFromForm);
  document.querySelector('#testBridge')?.addEventListener('click',testBridge);
  document.querySelector('#providerSelect')?.addEventListener('change', e=>{
    const p=e.target.value; document.querySelector('#modelInput').value=PROVIDERS[p]?.model||'';
  });
}

async function uploadPdfs(e) {
  const files = [...e.target.files].filter(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
  for (let fIndex=0; fIndex<files.length; fIndex++) {
    const file = files[fIndex];
    state.progress={title:`Đang đọc ${file.name}`,detail:'Khởi tạo PDF...',pct:2}; render();
    try {
      const doc = await parsePdf(file,(page,total)=>{state.progress={title:`Đang phân tích ${file.name}`,detail:`Trang ${page}/${total}`,pct:Math.round(page/total*100)}; const box=document.querySelector('.progress-overlay'); if(box){box.querySelector('.progress-box .muted').textContent=`Trang ${page}/${total}`;box.querySelector('.progress-bar>div').style.width=`${Math.round(page/total*100)}%`;}});
      await saveDocument(doc);
      state.docs.push(doc); state.selected.add(doc.id); state.activeDocId=doc.id; state.page=1;
    } catch (err) { alert(`Không đọc được ${file.name}: ${err.message}`); }
  }
  state.progress=null; state.mobile='assistant'; render();
}

async function removeDoc(id) {
  if (!confirm('Xóa tài liệu này khỏi thư viện cục bộ?')) return;
  await deleteDocument(id); state.docs=state.docs.filter(d=>d.id!==id); state.selected.delete(id);
  if(state.activeDocId===id){state.activeDocId=state.docs[0]?.id||null;state.page=1;} render();
}

async function drawPage() {
  const doc=activeDoc(), canvas=document.querySelector('#pdfCanvas'); if(!doc||!canvas)return;
  try { await renderPdfPage(doc.blob,state.page,canvas,1.15); } catch(err) { console.error(err); }
}
function jumpPage(p){const doc=activeDoc();if(!doc)return;state.page=Math.min(Math.max(1,p||1),doc.pageCount);render();}
function findInActive(term){const doc=activeDoc();if(!doc)return;const p=doc.pages.find(x=>x.text.toLowerCase().includes(term.toLowerCase()));if(p)jumpPage(p.page);else alert('Không tìm thấy cụm từ trong PDF đang mở.');}

async function getAiAnswer(question, docsOverride=null) {
  const docs=docsOverride||selectedDocs(); if(!docs.length) throw new Error('Hãy chọn ít nhất một PDF làm nguồn.');
  const hits=searchChunks(question,docs,10); if(!hits.length) return {text:'Không tìm thấy nội dung phù hợp trong các tài liệu đang chọn.',hits:[]};
  if(state.settings.provider==='local'){
    return {text:`Chế độ tra cứu cục bộ tìm thấy các đoạn liên quan sau:\n\n${hits.slice(0,5).map(h=>`• [${h.standard||h.docName} · Trang ${h.page}] ${h.text.slice(0,420).replace(/\n/g,' ')}`).join('\n\n')}\n\nBật Ollama/Gemini/ChatGPT/Claude/Grok để AI tổng hợp thành câu trả lời hoàn chỉnh.`,hits};
  }
  const prompt=buildRagPrompt(question,hits,state.settings.strict);
  const text=await callBridge({bridgeUrl:state.settings.bridgeUrl,provider:state.settings.provider,model:providerModel(),prompt});
  return {text,hits};
}

async function askQuestion(){const el=document.querySelector('#chatQuestion');const q=el?.value.trim();if(!q)return;state.chat.push({role:'user',text:q});state.chat.push({role:'ai',text:'Đang tra tiêu chuẩn...'});render();try{const ans=await getAiAnswer(q);state.chat[state.chat.length-1]={role:'ai',text:ans.text};}catch(err){state.chat[state.chat.length-1]={role:'ai',text:`Lỗi: ${err.message}`};}render();}

function runLookup(){const q=document.querySelector('#lookupQuery')?.value.trim();const out=document.querySelector('#lookupResults');if(!q||!out)return;const hits=searchChunks(q,selectedDocs(),12);out.innerHTML=hits.length?hits.map(h=>`<div class="card"><button class="citation" data-hit-page="${h.page}" data-hit-doc="${h.docId}">${esc(h.standard||h.docName)} · Trang ${h.page}</button><p>${esc(h.text.slice(0,850))}</p></div>`).join(''):'<div class="card muted">Không tìm thấy nội dung phù hợp.</div>';out.querySelectorAll('[data-hit-page]').forEach(b=>b.onclick=()=>{state.activeDocId=b.dataset.hitDoc;state.page=Number(b.dataset.hitPage);state.mobile='viewer';render();});}

function runCalc(){const out=document.querySelector('#calcResult');try{const r=axialResistance({areaMm2:document.querySelector('#cArea').value,sigmaCu:document.querySelector('#cCu').value,sigmaCe:document.querySelector('#cCe').value,alpha:document.querySelector('#cAlpha').value});out.innerHTML=`<div class="result"><b>Sức chịu tải dài hạn theo vật liệu ≈ ${r.longTermKn.toLocaleString('vi-VN',{maximumFractionDigits:1})} kN</b><br>Sức chịu tải ngắn hạn tham khảo ≈ ${r.shortTermKn.toLocaleString('vi-VN',{maximumFractionDigits:1})} kN<br><span class="muted">Ứng suất quy đổi: ${r.stress.toFixed(3)} MPa. Kiểm tra lại điều kiện áp dụng của Phụ lục B.</span></div>`;}catch(err){out.innerHTML=`<div class="result error">${esc(err.message)}</div>`;}}

async function runCompare(){const q=document.querySelector('#compareQuestion')?.value.trim();const out=document.querySelector('#compareResult');if(!q||!out)return;out.innerHTML='<div class="card muted">Đang so sánh...</div>';try{const ans=await getAiAnswer(`Hãy so sánh các tài liệu theo yêu cầu sau. Trình bày dạng bảng nếu phù hợp và nêu rõ khác biệt, không tự kết luận khi tài liệu không đủ căn cứ.\n\n${q}`,selectedDocs());out.innerHTML=`<div class="message ai">${esc(ans.text)}</div>`;}catch(err){out.innerHTML=`<div class="card error">${esc(err.message)}</div>`;}}

async function aiSummary(){const doc=selectedDocs()[0]||activeDoc();if(!doc)return;state.tab='chat';state.chat.push({role:'user',text:`Tóm tắt chuyên sâu ${doc.standard||doc.name}`});state.chat.push({role:'ai',text:'Đang tóm tắt...'});render();try{const ans=await getAiAnswer('Tóm tắt tiêu chuẩn theo góc nhìn kỹ sư cọc: phạm vi, phân loại, thông số bắt buộc, sai số, ngoại quan, thử nghiệm, nghiệm thu, bảo quản/vận chuyển, công thức và các điểm cần đặc biệt chú ý. Mỗi mục phải có nguồn trang.',[doc]);state.chat[state.chat.length-1]={role:'ai',text:ans.text};}catch(err){state.chat[state.chat.length-1]={role:'ai',text:`Lỗi: ${err.message}`};}render();}

async function aiChecklist(){state.tab='chat';state.chat.push({role:'user',text:'Tạo checklist nghiệm thu từ tiêu chuẩn đang chọn'});state.chat.push({role:'ai',text:'Đang tạo checklist...'});render();try{const ans=await getAiAnswer('Tạo checklist thực hành cho kỹ sư về hồ sơ, kiểm tra, thử nghiệm và nghiệm thu theo các tài liệu đang chọn. Mỗi dòng phải có citation trang. Không thêm yêu cầu không có trong tài liệu.');state.chat[state.chat.length-1]={role:'ai',text:ans.text};}catch(err){state.chat[state.chat.length-1]={role:'ai',text:`Lỗi: ${err.message}`};}render();}

function updateSettingsFromForm(){state.settings.provider=document.querySelector('#providerSelect').value;state.settings.model=document.querySelector('#modelInput').value.trim();state.settings.bridgeUrl=document.querySelector('#bridgeInput').value.trim()||'http://127.0.0.1:8787';state.settings.strict=document.querySelector('#strictInput').checked;saveSettings();state.bridge=null;render();}
async function testBridge(){updateSettingsFromForm();if(state.settings.provider==='local'){alert('Chế độ cục bộ không cần AI Bridge.');return;}try{state.bridge=await bridgeHealth(state.settings.bridgeUrl);alert('Kết nối HNL AI Bridge thành công.');}catch(err){state.bridge=null;alert(`Chưa kết nối được Bridge: ${err.message}`);}render();}

(async function init(){try{state.docs=await getDocuments();state.docs.forEach(d=>state.selected.add(d.id));state.activeDocId=state.docs[0]?.id||null;}catch(e){console.warn(e);}render();})();

if ('serviceWorker' in navigator && location.protocol !== 'file:') { window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {})); }
