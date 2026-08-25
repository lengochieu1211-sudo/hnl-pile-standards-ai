import { runPass8OneClickCalculation } from '../../src/pass8-workflow-router.js';
import { parseStructuralJsonText } from '../../src/pass8-structural-file-parser.js';
import { requestPass8VietnameseExcel } from '../../src/pass8-excel-export-client.js';

const $=(id)=>document.getElementById(id); let structural=null; let last=null; let exporterReady=false;
const val=(id)=>$(id).value; const num=(id)=>Number(val(id));

function error(msg=''){ $('error').textContent=msg; $('error').classList.toggle('show',Boolean(msg)); }
function buildRequest(){
 let boreholes; try{boreholes=JSON.parse(val('boreholes'));}catch{throw new Error('Dữ liệu lỗ khoan JSON chưa hợp lệ.');}
 if(!structural) throw new Error('Chưa chọn file kết cấu hoặc nạp dữ liệu Golden.');
 return { pile:{constructionMethod:val('construction'),shape:val('shape'),sideMm:num('sideMm'),lengthM:num('lengthM'),tipDepthM:num('tipDepthM'),shaftStartDepthM:0,maxSegmentM:2},
   soil:{mechanicalGammaK:num('mechanicalGammaK'),sptGammaK:num('sptGammaK'),boreholes},
   material:{grade:val('grade'),steel:val('steel'),AsTotMm2:num('AsTotMm2'),L0Mm:num('L0Mm'),e0Mm:num('e0Mm'),e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:val('loadDuration')},
   design:{gammaN:num('gammaN')}, structural, combinationIds:['EULS'] };
}
function render(out){
 const s=out.result.summary; const k=[['Rsoil',s.RsoilKn.toFixed(3)+' kN'],['Rmaterial',s.RmaterialKn.toFixed(3)+' kN'],['Rpile',s.RpileKn.toFixed(3)+' kN'],['Nd,max',s.NdMaxPerPileKn.toFixed(3)+' kN'],['Kết luận',out.result.conclusion.statusVi]];
 $('kpis').innerHTML=k.map(([a,b])=>`<div class="kpi"><span>${a}</span><b>${b}</b></div>`).join('');
 $('steps').innerHTML=out.steps.map((x,i)=>`<div class="step"><span class="num">${i+1}</span><div><b>${x.title}</b><div class="message">${x.detail}</div></div><span class="status ${x.status==='ĐẠT'?'ok':'bad'}">${x.status}</span></div>`).join('');
 $('result').classList.add('show'); $('export').disabled=!out.excelExport.enabled||!exporterReady; $('actionMsg').textContent=`${out.result.structural.summary.passRows}/${out.result.structural.summary.checkRows} kiểm tra ĐẠT · cọc bất lợi ${s.governingPileId}${exporterReady?' · Excel exporter sẵn sàng':' · Excel exporter chưa kết nối'}`;
}
$('structuralFile').addEventListener('change',async(e)=>{const f=e.target.files?.[0];if(!f)return;try{structural=parseStructuralJsonText(await f.text(),{sourceId:f.name});error();$('actionMsg').textContent=`Đã nạp ${f.name}`;}catch(e){error(e.message)}});
$('loadGolden').addEventListener('click',async()=>{try{const [f,g]=await Promise.all([fetch('../../artifacts/p1-pass5-dce-table-bundle-fixture-v13.json').then(r=>r.json()),fetch('../../artifacts/p1-pass7-full-calculation-golden-v18.json').then(r=>r.json())]);structural={kind:'DCE_TABLES',tables:f.tables,sourceId:'PASS8_UI_GOLDEN',nodalReactionCompressionSign:'compression-positive',pierForceCompressionSign:'compression-negative'};$('boreholes').value=JSON.stringify(g.capacityInput.boreholes,null,2);error();$('actionMsg').textContent='Đã nạp Golden v18.';}catch(e){error(e.message)}});
$('calculate').addEventListener('click',()=>{try{error();last=runPass8OneClickCalculation(buildRequest());render(last);}catch(e){last=null;$('export').disabled=true;error(e.message);$('actionMsg').textContent='KHÓA TÍNH';}});
$('export').addEventListener('click',async()=>{if(!last)return;try{$('actionMsg').textContent='Đang xuất Excel…';const {blob,fileName,exportId,serverVerified}=await requestPass8VietnameseExcel(last.excelExport);const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fileName;a.click();URL.revokeObjectURL(a.href);$('actionMsg').textContent=serverVerified?`Đã xuất Excel tiếng Việt · server đã xác minh · ${exportId||''}`:'Đã xuất Excel tiếng Việt.';}catch(e){error(`${e.message} Backend exporter phải ghi kết quả vào template v18; UI không tự tính lại.`);$('actionMsg').textContent='Chưa xuất Excel.';}});

async function checkExporterHealth(){try{const r=await fetch('/api/hnl/pile/export-health',{cache:'no-store'});const j=await r.json();exporterReady=Boolean(r.ok&&j?.ok);if(last)$('export').disabled=!last.excelExport.enabled||!exporterReady;if(exporterReady&&$('actionMsg').textContent==='Chưa tính.')$('actionMsg').textContent='Excel exporter v20 đã kết nối · chưa tính.';}catch{exporterReady=false;if(last)$('export').disabled=true;}}
checkExporterHealth();
