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
const port=Number(args.port||4173);
const base=`http://127.0.0.1:${port}`;
const serverLog=[];
const server=spawn(process.execPath,[path.join('node_modules','vite','bin','vite.js'),'preview','--host','127.0.0.1','--port',String(port)],{stdio:['ignore','pipe','pipe'],env:process.env});
server.stdout.on('data',d=>{const s=String(d);serverLog.push(`[vite] ${s}`);process.stdout.write(`[vite] ${s}`);});
server.stderr.on('data',d=>{const s=String(d);serverLog.push(`[vite:err] ${s}`);process.stderr.write(`[vite] ${s}`);});

async function waitHttp(url,timeout=30000){const start=Date.now();let last;while(Date.now()-start<timeout){try{const r=await fetch(url);if(r.ok)return;}catch(e){last=e;}await new Promise(r=>setTimeout(r,300));}throw new Error(`Server not ready: ${url} ${last||''}`);}
function sha256(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
async function validateXlsx(file,requiredSheets=[]){
  const buf=fs.readFileSync(file);if(buf.length<1500)throw new Error(`XLSX too small: ${file} ${buf.length}`);
  if(buf[0]!==0x50||buf[1]!==0x4b)throw new Error(`Not ZIP/XLSX: ${file}`);
  const zip=await JSZip.loadAsync(buf);if(!zip.file('xl/workbook.xml'))throw new Error(`Missing workbook.xml: ${file}`);
  const xml=await zip.file('xl/workbook.xml').async('string');for(const s of requiredSheets)if(!xml.includes(`name="${s}"`))throw new Error(`Missing sheet ${s} in ${file}`);
  return{file:path.basename(file),bytes:buf.length,sha256:sha256(file),sheets:requiredSheets};
}
async function waitCase(page,id,state='RUNTIME_PASS',timeout=30000){await page.waitForFunction(({id,state})=>window.__HNL_P4_RUNTIME_GOLDEN__?.getState?.().cases?.[id]?.state===state,{id,state},{timeout});}
async function saveDownload(download,name){const p=path.join(outDir,name);await download.saveAs(p);return p;}
function mark(next,extra={}){stage=next;console.log(`P4 RUNTIME GOLDEN STAGE: ${stage}${Object.keys(extra).length?` · ${JSON.stringify(extra)}`:''}`);}

let browser,page,stage='BOOT';
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
  if(await page.evaluate(()=>window.__HNL_P4_RUNTIME_CI_ERROR__||''))throw new Error(await page.evaluate(()=>window.__HNL_P4_RUNTIME_CI_ERROR__));
  mark('WEB_ENV');
  await waitCase(page,'P4_WEB_ENV');
  const env=await page.evaluate(()=>window.__HNL_P4_RUNTIME_GOLDEN__.getState().environment);
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
  await waitCase(page,'P4_REAL_PDF_SCAN');
  await page.waitForFunction(()=>!document.querySelector('#p4excel')?.disabled,null,{timeout:20000});

  mark('FULL_XLSX');
  const fullPromise=page.waitForEvent('download',{timeout:30000});
  await page.locator('#p4excel').click();
  const full=await saveDownload(await fullPromise,'P4_FULL_SCAN_REVIEW.xlsx');
  await waitCase(page,'P4_FULL_SCAN_XLSX');
  const fullAudit=await validateXlsx(full,['00_TONG_QUAN','01_THAM_SO','03_NGUON']);

  mark('REGION_XLSX');
  await page.evaluate(()=>window.__HNL_P4_RUNTIME_CI__.regionPopup());
  await page.locator('[data-p4-ui-action="excel"]').waitFor({state:'visible',timeout:10000});
  const regionPromise=page.waitForEvent('download',{timeout:30000});
  await page.locator('[data-p4-ui-action="excel"]').click();
  const region=await saveDownload(await regionPromise,'P4_PDF_REGION_REVIEW.xlsx');
  await waitCase(page,'P4_PDF_REGION_XLSX');
  const regionAudit=await validateXlsx(region,['00_TONG_QUAN','01_NGUON','05_REVIEW']);

  mark('IMAGE_XLSX');
  await page.evaluate(()=>window.__HNL_P4_RUNTIME_CI__.imageReview());
  await page.locator('[data-p4-image-action="excel"]').waitFor({state:'visible',timeout:10000});
  const imagePromise=page.waitForEvent('download',{timeout:30000});
  await page.locator('[data-p4-image-action="excel"]').click();
  const image=await saveDownload(await imagePromise,'P4_IMAGE_REVIEW.xlsx');
  await waitCase(page,'P4_IMAGE_REVIEW_XLSX');
  const imageAudit=await validateXlsx(image,['00_TONG_QUAN','01_NGUON','04_THAM_SO','05_REVIEW']);

  mark('FINAL_AUDIT');
  await page.waitForFunction(()=>window.__HNL_P4_RUNTIME_GOLDEN__.getState().overallState==='COMPLETE',null,{timeout:10000});
  const state=await page.evaluate(()=>window.__HNL_P4_RUNTIME_GOLDEN__.getState());
  const pass=Object.values(state.cases||{}).filter(x=>x.state==='RUNTIME_PASS').length;
  if(pass!==5||state.productionMutationAllowed!==false||state.calculationEngineMutationAllowed!==false)throw new Error(`Golden state invalid: ${JSON.stringify({pass,overall:state.overallState})}`);
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
  try{if(page){failure.url=page.url();failure.runtimeState=await page.evaluate(()=>window.__HNL_P4_RUNTIME_GOLDEN__?.getState?.()||null);failure.ciError=await page.evaluate(()=>window.__HNL_P4_RUNTIME_CI_ERROR__||null);await page.screenshot({path:path.join(outDir,'P4_RUNTIME_GOLDEN_FAILURE.png'),fullPage:true});}}catch(captureError){failure.captureError=String(captureError?.stack||captureError);}
  fs.writeFileSync(path.join(outDir,'FAILURE.json'),JSON.stringify(failure,null,2));
  console.error(`P4 RUNTIME GOLDEN BROWSER: FAIL at ${stage}:`,error);
  process.exitCode=1;
} finally {
  try{await browser?.close();}catch{}
  try{server.kill();}catch{}
}
