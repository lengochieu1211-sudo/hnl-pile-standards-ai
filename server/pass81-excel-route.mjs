import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runPass8OneClickCalculation } from '../src/pass8-workflow-router.js';
import { exportPass81WorkbookBuffer, PASS81_EXCEL_EXPORTER_STATUS } from '../src/pass81-v18-dynamic-exporter.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TEMPLATE = path.resolve(here, '../bridge/templates/HNL_P1_Pass7_Bao_Cao_Tinh_Toan_Coc_San_Xuat_v18.xlsx');
const MAX_BODY = 20 * 1024 * 1024;

const close = (a,b,tol=1e-9) => Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Math.abs(Number(a)-Number(b)) <= Math.max(tol,tol*Math.max(1,Math.abs(Number(a)),Math.abs(Number(b))));

export function compareClientSummary(client = {}, serverOut) {
  const s=serverOut.result.summary; const c=serverOut.result.conclusion.statusVi; const issues=[];
  const nums=['RsoilKn','RmaterialKn','RpileKn','gammaN','NdMaxPerPileKn','governingUtilization'];
  for(const k of nums) if(!close(client[k],s[k])) issues.push(`${k}: client=${client[k]} server=${s[k]}`);
  for(const k of ['boreholeBranches','pileChecks']) if(Number(client[k])!==Number(s[k])) issues.push(`${k}: client=${client[k]} server=${s[k]}`);
  for(const k of ['governingPileId','governingCombinationId']) if(String(client[k]??'')!==String(s[k]??'')) issues.push(`${k}: client=${client[k]} server=${s[k]}`);
  if(String(client.conclusion??'')!==String(c??'')) issues.push(`conclusion: client=${client.conclusion} server=${c}`);
  return { pass: issues.length===0, issues };
}

export function buildExportFileName(out) {
  const pile=String(out.result.summary.governingPileId??'KetQua').replace(/[^0-9A-Za-z_-]+/g,'_');
  return `HNL_Tinh_Toan_Coc_${pile}_v1.25.7.xlsx`;
}

export function executePass81Export(body, { templatePath = DEFAULT_TEMPLATE } = {}) {
  if(body?.schema!=='HNL-P1-PASS8.1-EXCEL-EXPORT-REQUEST') throw new Error('Sai schema yêu cầu xuất Excel Pass 8.1.');
  if(body?.templateVersion!=='v18') throw new Error('Pass 8.1 chỉ nhận templateVersion=v18.');
  if(!body.request || typeof body.request!=='object') throw new Error('Thiếu request gốc của lần tính.');
  const serverOut=runPass8OneClickCalculation(body.request);
  if(!serverOut.excelExport.enabled) throw new Error(serverOut.excelExport.blockedReason||'Kết quả server đang bị khóa xuất Excel.');
  const compare=compareClientSummary(body.clientSummary??{},serverOut);
  if(!compare.pass) throw new Error(`Kết quả client/server không khớp; không xuất Excel. ${compare.issues.join(' | ')}`);
  const templateBuffer=fs.readFileSync(templatePath);
  const exportId=crypto.randomUUID(); const generatedAt=new Date().toISOString();
  const x=exportPass81WorkbookBuffer({templateBuffer,request:body.request,pass8Output:serverOut,exportId,generatedAt});
  return { ...x, serverOut, fileName: buildExportFileName(serverOut), compare };
}

async function readJsonBody(req) {
  const chunks=[]; let size=0;
  for await (const chunk of req) { size += chunk.length; if(size>MAX_BODY) throw new Error('Payload xuất Excel vượt 20 MB.'); chunks.push(chunk); }
  let body; try { body=JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('JSON request không hợp lệ.'); }
  return body;
}

export async function handlePass81ExcelExport(req,res,{templatePath=DEFAULT_TEMPLATE}={}) {
  try {
    const body=await readJsonBody(req); const out=executePass81Export(body,{templatePath});
    res.writeHead(200,{
      'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-length':String(out.buffer.length),
      'content-disposition':`attachment; filename="${out.fileName}"; filename*=UTF-8''${encodeURIComponent(out.fileName)}`,
      'cache-control':'no-store',
      'x-hnl-export-id':out.exportId,
      'x-hnl-template-sha256':out.templateSha256,
      'x-hnl-server-verified':'true',
      'x-hnl-exporter-version':'Pass8.1-v20'
    });
    res.end(out.buffer);
  } catch (e) {
    const data=Buffer.from(JSON.stringify({ok:false,error:e?.message||String(e),code:'PASS81_EXPORT_BLOCKED'}));
    res.writeHead(422,{'content-type':'application/json; charset=utf-8','content-length':String(data.length),'cache-control':'no-store'}); res.end(data);
  }
}

export const PASS81_ROUTE_STATUS=Object.freeze({
  status:'CORE_LOCKED_DYNAMIC_EXPORTER_PATCH',
  endpoint:'/api/hnl/pile/export-excel',
  method:'POST',
  serverRecalculation:'Pass 8 router server-side',
  clientServerSummaryCheck:'MANDATORY',
  exporter:PASS81_EXCEL_EXPORTER_STATUS.id,
  templatePath:DEFAULT_TEMPLATE
});
