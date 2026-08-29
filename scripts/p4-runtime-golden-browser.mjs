import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import JSZip from 'jszip';
import { chromium } from 'playwright';

const args=Object.fromEntries(process.argv.slice(2).map((v,i,a)=>v.startsWith('--')?[v.slice(2),a[i+1]]:null).filter(Boolean));
const expectedSha=String(args.sha||process.env.HNL_SOURCE_SHA||'').trim();
if(!/^[0-9a-f]{40}$/i.test(expectedSha))throw new Error(`Invalid --sha: ${expectedSha}`);
const outDir=path.resolve(args.out||'artifacts/p4-runtime-golden');
fs.mkdirSync(outDir,{recursive:true});
const progressFile=path.join(outDir,'PROGRESS.json');
const port=Number(args.port||4173);
const base=`http://127.0.0.1:${port}`;
const serverLog=[];
const server=spawn(process.execPath,[path.join('node_modules','vite','bin','vite.js'),'preview','--host','127.0.0.1','--port',String(port)],{stdio:['ignore','pipe','pipe'],env:process.env});
server.stdout.on('data',d=>{const s=String(d);serverLog.push(`[vite] ${s}`);process.stdout.write(`[vite] ${s}`);});
server.stderr.on('data',d=>{const s=String(d);serverLog.push(`[vite:err] ${s}`);process.stderr.write(`[vite] ${s}`);});

async function waitHttp(url,timeout=30000){const start=Date.now();let last;while(Date.now()-start<timeout){try{const r=await fetch(url);if(r.ok)return;}catch(e){last=e;}await new Promise(r=>setTimeout(r,300));}throw new Error(`Server not ready: ${url} ${last||''}`);}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function sha256(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
async function validateXlsx(file,requiredSheets=[]){
  const buf=fs.readFileSync(file);if(buf.length<1500)throw new Error(`XLSX too small: ${file} ${buf.length}`);
  if(buf[0]!==0x50||buf[1]!==0x4b)throw new Error(`Not ZIP/XLSX: ${file}`);
  const zip=await JSZip.loadAsync(buf);if(!zip.file('xl/workbook.xml'))throw new Error(`Missing workbook.xml: ${file}`);
  const xml=await zip.file('xl/workbook.xml').async('string');for(const s of requiredSheets)if(!xml.includes(`name="${s}"`))throw new Error(`Missing sheet ${s} in ${file}`);
  return{file:path.basename(file),bytes:buf.length,sha256:sha256(file),sheets:requiredSheets};
}
async function runtimeState(page){return await page.evaluate(()=>window.__HNL_P4_RUNTIME_GOLDEN__?.getState?.()||null);}
async function waitRuntimeCase(page,id,state='RUNTIME_PASS',timeout=30000){
  const start=Date.now();let last=null;
  while(Date.now()-start<timeout){
    last=await runtimeState(page);
    if(last?.cases?.[id]?.state===state)return last.cases[id];
    await sleep(150);
  }
  throw new Error(`Runtime case timeout: ${id} wanted=${state} got=${last?.cases?.[id]?.state||'MISSING'} evidence=${JSON.stringify(last?.cases?.[id]?.evidence||null)}`);
}
async function waitRuntimeEvent(page,kind,timeout=15000){
  const start=Date.now();let events=[];
  while(Date.now()-start<timeout){
    events=await page.evaluate(()=>Array.isArray(window.__HNL_P4_CI_EVENTS__)?window.__HNL_P4_CI_EVENTS__:[]);
    const hit=events.find(e=>e?.detail?.kind===kind);
    if(hit)return hit;
    await sleep(100);
  }
  throw new Error(`Runtime event timeout: ${kind}; events=${JSON.stringify(events.slice(-12))}`);
}
async function waitEnabled(page,selector,timeout=20000){
  const start=Date.now();
  while(Date.now()-start<timeout){const enabled=await page.locator(selector).evaluate(el=>!el.disabled).catch(()=>false);if(enabled)return;await sleep(120);}
  throw new Error(`Element did not enable: ${selector}`);
}
async function saveDownload(download,name){const p=path.join(outDir,name);await download.saveAs(p);return p;}
let browser,page,stage='BOOT';
function mark(next,extra={}){
  stage=next;
  const record={schema:'HNL_P4_RUNTIME_GOLDEN_PROGRESS_V1',updatedAt:new Date().toISOString(),stage,expectedSha,...extra};
  fs.writeFileSync(progressFile,JSON.stringify(record,null,2));
  console.log(`P4 RUNTIME GOLDEN STAGE: ${stage}${Object.keys(extra).length?` · ${JSON.stringify(extra)}`:''}`);
}

try{
  mark('WAIT_WEB');
  await waitHttp(`${base}/build-info.json`);
  mark('LAUNCH_CHROMIUM');
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1100}});
  page=await context.newPage();
  page.on('console',m=>console.log(`[browser:${m.type()}] ${m.text()}`));
  page.on('pageerror',e=>console.error('[browser:pageerror]',e));
  mark('LOAD_APP');
  await page.goto(`${base}/?p4golden=1&p4ci=1`,{waitUntil:'networkidle',timeout:60000});
  await page.waitForFunction(()=>window.__HNL_P4_RUNTIME_GOLDEN__&&window.__HNL_P4_RUNTIME_CI__&&window.__HNL_P4_PDF_EXCEL__,null,{timeout:30000});
  await page.evaluate(()=>{
    window.__HNL_P4_CI_EVENTS__=[];
    for(const name of ['hnl:p4-runtime-scan','hnl:p4-runtime-export','hnl:p4-runtime-error']){
      window.addEventListener(name,e=>window.__HNL_P4_CI_EVENTS__.push({name,at:new Date().toISOString(),detail:e.detail||null}));
    }
  });
  if(await page.evaluate(()=>window.__HNL_P4_RUNTIME_CI_ERROR__||''))throw new Error(await page.evaluate(()=>window.__HNL_P4_RUNTIME_CI_ERROR__));
  mark('WEB_ENV');
  await waitRuntimeCase(page,'P4_WEB_ENV');
  const env=(await runtimeState(page)).environment;
  if(env.commit!==expectedSha)throw new Error(`Web runtime SHA mismatch ${env.commit} != ${expectedSha}`);
  if(env.target!=='web'||env.searchBrain!=='1.9.23'||env.searchBrainStatus!=='LOCKED')throw new Error(`Web/Search Brain preflight failed: ${JSON.stringify(env)}`);

  mark('SEED_PDF');
  const fixture=await page.evaluate(()=>window.__HNL_P4_RUNTIME_CI__.seedPdf());
  if(!(fixture.size>300))throw new Error(`PDF fixture not materialized: ${JSON.stringify(fixture)}`);
  await page.evaluate(()=>window.__HNL_P4_PDF_EXCEL__.open());
  await page.locator('#p4q').fill('Tìm giá trị a, b trong tài liệu rồi xuất Excel');
  await page.locator('#p4img').selectOption('relevant');
  mark('SCAN_PDF');
  await page.locator('#p4scan').click();
  const scanEvent=await waitRuntimeEvent(page,'full-scan');
  if(scanEvent.name!=='hnl:p4-runtime-scan')throw new Error(`Unexpected scan event ${JSON.stringify(scanEvent)}`);
  await waitRuntimeCase(page,'P4_REAL_PDF_SCAN');
  await waitEnabled(page,'#p4excel');

  mark('FULL_XLSX_CLICK');
  const fullPromise=page.waitForEvent('download',{timeout:30000});
  await page.locator('#p4excel').click();
  const full=await saveDownload(await fullPromise,'P4_FULL_SCAN_REVIEW.xlsx');
  mark('FULL_XLSX_DOWNLOADED',{bytes:fs.statSync(full).size});
  const fullEvent=await waitRuntimeEvent(page,'full-scan-xlsx');
  if(fullEvent.name!=='hnl:p4-runtime-export'||fullEvent.detail?.ok!==true)throw new Error(`Full XLSX runtime event failed: ${JSON.stringify(fullEvent)}`);
  mark('FULL_XLSX_EVENT_PASS');
  await waitRuntimeCase(page,'P4_FULL_SCAN_XLSX');
  mark('FULL_XLSX_CASE_PASS');
  const fullAudit=await validateXlsx(full,['00_TONG_QUAN','01_THAM_SO','03_NGUON']);
  mark('FULL_XLSX_VALIDATED',fullAudit);

  mark('REGION_PREPARE');
  await page.evaluate(()=>window.__HNL_P4_RUNTIME_CI__.regionPopup());
  await page.locator('[data-p4-ui-action="excel"]').waitFor({state:'visible',timeout:10000});
  mark('REGION_XLSX_CLICK');
  const regionPromise=page.waitForEvent('download',{timeout:30000});
  await page.locator('[data-p4-ui-action="excel"]').click();
  const region=await saveDownload(await regionPromise,'P4_PDF_REGION_REVIEW.xlsx');
  mark('REGION_XLSX_DOWNLOADED',{bytes:fs.statSync(region).size});
  const regionEvent=await waitRuntimeEvent(page,'pdf-region-xlsx');
  if(regionEvent.name!=='hnl:p4-runtime-export'||regionEvent.detail?.ok!==true)throw new Error(`Region runtime event failed: ${JSON.stringify(regionEvent)}`);
  await waitRuntimeCase(page,'P4_PDF_REGION_XLSX');
  const regionAudit=await validateXlsx(region,['00_TONG_QUAN','01_NGUON','05_REVIEW']);
  mark('REGION_XLSX_VALIDATED',regionAudit);

  mark('IMAGE_PREPARE');
  await page.evaluate(()=>window.__HNL_P4_RUNTIME_CI__.imageReview());
  await page.locator('[data-p4-image-action="excel"]').waitFor({state:'visible',timeout:10000});
  mark('IMAGE_XLSX_CLICK');
  const imagePromise=page.waitForEvent('download',{timeout:30000});
  await page.locator('[data-p4-image-action="excel"]').click();
  const image=await saveDownload(await imagePromise,'P4_IMAGE_REVIEW.xlsx');
  mark('IMAGE_XLSX_DOWNLOADED',{bytes:fs.statSync(image).size});
  const imageEvent=await waitRuntimeEvent(page,'image-review-xlsx');
  if(imageEvent.name!=='hnl:p4-runtime-export'||imageEvent.detail?.ok!==true)throw new Error(`Image runtime event failed: ${JSON.stringify(imageEvent)}`);
  await waitRuntimeCase(page,'P4_IMAGE_REVIEW_XLSX');
  const imageAudit=await validateXlsx(image,['00_TONG_QUAN','01_NGUON','04_THAM_SO','05_REVIEW']);
  mark('IMAGE_XLSX_VALIDATED',imageAudit);

  mark('FINAL_AUDIT');
  const state=await runtimeState(page);
  const pass=Object.values(state?.cases||{}).filter(x=>x.state==='RUNTIME_PASS').length;
  if(pass!==5||state?.overallState!=='COMPLETE'||state.productionMutationAllowed!==false||state.calculationEngineMutationAllowed!==false)throw new Error(`Golden state invalid: ${JSON.stringify({pass,overall:state?.overallState})}`);
  const regionBox=state.cases?.P4_PDF_REGION_XLSX?.evidence?.source?.bbox;
  if(!Array.isArray(regionBox)||regionBox.length!==4||regionBox[2]-regionBox[0]>=0.985||regionBox[3]-regionBox[1]>=0.985)throw new Error(`Region evidence not selective: ${JSON.stringify(regionBox)}`);
  if(state.cases?.P4_IMAGE_REVIEW_XLSX?.evidence?.trust?.calculationEligible!==false)throw new Error('Image REVIEW became calculation eligible');

  const evidence={...state,exportedAt:new Date().toISOString(),automation:{engine:'Playwright Chromium',platform:process.platform,fixturePolicy:'deterministic real PDF Blob + PNG image; no OCR/Vision network call; production UI export paths only',expectedSha,downloads:[fullAudit,regionAudit,imageAudit]}};
  fs.writeFileSync(path.join(outDir,'HNL_P4_RUNTIME_GOLDEN_CI.json'),JSON.stringify(evidence,null,2));
  await page.screenshot({path:path.join(outDir,'P4_RUNTIME_GOLDEN_5_OF_5.png'),fullPage:true});
  await page.evaluate(()=>window.__HNL_P4_RUNTIME_CI__.cleanup());
  mark('PASS',{pass});
  console.log(`P4 RUNTIME GOLDEN BROWSER: PASS ${pass}/5 · SHA ${expectedSha}`);
  console.log(`Evidence: ${path.join(outDir,'HNL_P4_RUNTIME_GOLDEN_CI.json')}`);
} catch(error) {
  const failure={schema:'HNL_P4_RUNTIME_GOLDEN_FAILURE_V1',failedAt:new Date().toISOString(),stage,expectedSha,message:String(error?.message||error),stack:String(error?.stack||''),serverLog:serverLog.join('').slice(-20000)};
  try{if(page){failure.url=page.url();failure.runtimeState=await runtimeState(page);failure.runtimeEvents=await page.evaluate(()=>window.__HNL_P4_CI_EVENTS__||[]);failure.ciError=await page.evaluate(()=>window.__HNL_P4_RUNTIME_CI_ERROR__||null);}}catch(captureError){failure.captureError=String(captureError?.stack||captureError);}
  fs.writeFileSync(path.join(outDir,'FAILURE.json'),JSON.stringify(failure,null,2));
  try{if(page)await page.screenshot({path:path.join(outDir,'P4_RUNTIME_GOLDEN_FAILURE.png'),fullPage:true,timeout:8000});}catch{}
  console.error(`P4 RUNTIME GOLDEN BROWSER: FAIL at ${stage}:`,error);
  process.exitCode=1;
} finally {
  try{await browser?.close();}catch{}
  try{server.kill();}catch{}
}