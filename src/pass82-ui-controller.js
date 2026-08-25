/**
 * P1 Pass 8.2 — Production UI controller.
 * UI-only orchestration: draft -> Pass 8 request -> locked router -> Vietnamese view model -> dynamic Excel transport.
 * NO engineering formula is implemented here.
 */
import { runPass8OneClickCalculation } from './pass8-workflow-router.js';
import { requestPass8VietnameseExcel } from './pass8-excel-export-client.js';

export const PASS82_UI_STATUS = Object.freeze({
  id: 'p1-pass8.2-production-ui-controller',
  version: '1.25.7',
  status: 'FULL_SOURCE_MERGE_GATE',
  language: 'vi-VN',
  role: 'PRODUCTION_UI_ORCHESTRATION_ONLY',
  forbidden: ['ENGINEERING_FORMULA_REIMPLEMENTATION','TRUST_CLIENT_ENGINEERING_RESULT','SILENT_UNIT_GUESS']
});

export function createPass82DefaultDraft(){
  return {
    constructionMethod:'driven', shape:'square', sideMm:400, lengthM:12, tipDepthM:12,
    shaftStartDepthM:0, maxSegmentM:2, gammaN:1.15, mechanicalGammaK:1.4, sptGammaK:1.5,
    grade:'B30', steel:'CB400-V', AsTotMm2:1600, L0Mm:4000, e0Mm:400/30,
    loadDuration:'long', boreholesJson:'[]', combinationIdsText:'EULS'
  };
}

const num=(v,name)=>{const n=Number(v); if(!Number.isFinite(n)) throw new Error(`${name} phải là số hợp lệ.`); return n;};

export function parsePass82BoreholesJson(text){
  let value; try{value=JSON.parse(String(text??'').trim()||'[]');}catch{throw new Error('JSON địa chất/lỗ khoan không hợp lệ.');}
  if(!Array.isArray(value)) throw new Error('Dữ liệu địa chất phải là mảng lỗ khoan JSON.');
  return value;
}

export function buildPass82Request({draft,structural}){
  if(!structural) throw new Error('Chưa chọn file kết cấu đã chuẩn hóa Pass 5.');
  const d={...createPass82DefaultDraft(),...(draft??{})};
  const boreholes=Array.isArray(d.boreholes)?d.boreholes:parsePass82BoreholesJson(d.boreholesJson);
  const combos=String(d.combinationIdsText??'').split(',').map(x=>x.trim()).filter(Boolean);
  return {
    pile:{constructionMethod:d.constructionMethod,shape:d.shape,sideMm:num(d.sideMm,'Cạnh cọc'),lengthM:num(d.lengthM,'Chiều dài cọc'),tipDepthM:num(d.tipDepthM,'Độ sâu mũi'),shaftStartDepthM:num(d.shaftStartDepthM,'Độ sâu bắt đầu ma sát'),maxSegmentM:num(d.maxSegmentM,'Đoạn chia lớn nhất')},
    soil:{mechanicalGammaK:num(d.mechanicalGammaK,'γk cơ lý'),sptGammaK:num(d.sptGammaK,'γk SPT'),boreholes},
    material:{grade:String(d.grade||'').trim(),steel:String(d.steel||'').trim(),AsTotMm2:num(d.AsTotMm2,'As,tot'),L0Mm:num(d.L0Mm,'L0'),e0Mm:num(d.e0Mm,'e0'),loadDuration:d.loadDuration||'long'},
    design:{gammaN:num(d.gammaN,'γn')}, structural, combinationIds:combos.length?combos:undefined
  };
}

export function runPass82UiCalculation(input){
  const request=buildPass82Request(input);
  const output=runPass8OneClickCalculation(request);
  return {request,output,view:pass82ViewModel(output)};
}

export function pass82ViewModel(output){
  const s=output?.result?.summary??{}; const c=output?.result?.conclusion??{};
  return {
    statusVi:c.statusVi??'KHÓA TÍNH',
    kpis:[
      ['Rsoil',s.RsoilKn,'kN'],['Rmaterial',s.RmaterialKn,'kN'],['Rpile',s.RpileKn,'kN'],
      ['Nd,max/cọc',s.NdMaxPerPileKn,'kN'],['Cọc bất lợi',s.governingPileId,'-'],['Hệ số sử dụng',s.governingUtilization,'-']
    ],
    steps:Array.isArray(output?.steps)?output.steps:[],
    conclusion:c.text??'',
    exportEnabled:Boolean(output?.excelExport?.enabled),
    blockedReason:output?.excelExport?.blockedReason??''
  };
}

function resolveUrl(baseUrl, endpoint){
  if(/^https?:\/\//i.test(endpoint)) return endpoint;
  const base=String(baseUrl??'').trim().replace(/\/$/,'');
  if(!base) return endpoint;
  return `${base}${endpoint.startsWith('/')?'':'/'}${endpoint}`;
}

export async function checkPass82Exporter({bridgeUrl='',fetchImpl=globalThis.fetch}={}){
  if(typeof fetchImpl!=='function') throw new Error('Không có fetch để kiểm tra dịch vụ Excel.');
  const response=await fetchImpl(resolveUrl(bridgeUrl,'/api/hnl/pile/export-health'),{method:'GET',cache:'no-store'});
  if(!response.ok) throw new Error(`Dịch vụ Excel chưa sẵn sàng (HTTP ${response.status}).`);
  const data=await response.json();
  if(data?.ok!==true) throw new Error(data?.error||'Dịch vụ Excel chưa sẵn sàng.');
  return data;
}

export async function exportPass82Excel({output,bridgeUrl='',fetchImpl=globalThis.fetch}={}){
  if(!output?.excelExport) throw new Error('Chưa có kết quả TÍNH để xuất Excel.');
  return requestPass8VietnameseExcel(output.excelExport,{fetchImpl,baseUrl:bridgeUrl});
}
