#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const outDir=path.join(root,'artifacts/master-system-audit');
const enforceP0=process.argv.includes('--enforce-p0');
const enforceAll=process.argv.includes('--enforce-all');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const json=p=>JSON.parse(read(p));
const normalizedHash=p=>crypto.createHash('sha256').update(read(p).replace(/\r\n/g,'\n')).digest('hex');
const rows=[];
function add(id,area,priority,status,evidence,recommendation=''){
  rows.push({id,area,priority,status,evidence,recommendation});
}
function requireFile(p,priority='P0',area='Repository'){
  const ok=exists(p); add(`FILE:${p}`,area,priority,ok?'PASS':'OPEN',ok?`Có ${p}`:`Thiếu ${p}`,ok?'':`Khôi phục/tạo ${p}`); return ok;
}

const required=[
  'package.json','package-lock.json','public/release-meta.json','README.md','docs/RELEASE_V1.27.0.md',
  'src/search.js','src/excel-export.js','src/excel-export-compat.js','src/excel-formula-compat.js','src/engineering-router.js','src/production-status-registry.js',
  'src/pile-capacity-engine.js','src/pile-material-engine.js','src/multi-borehole-engine.js',
  'scripts/check-version-sync.mjs','scripts/generate-build-info.mjs','scripts/excel-production-smoke.mjs',
  'tools/pass83-source-sync-gate.mjs','tools/pass83-test-count-gate.mjs','tools/release-sync-gate.mjs',
  '.github/workflows/pages.yml','.github/workflows/desktop-win.yml','.github/workflows/pass83-runtime-cert.yml',
  '.github/workflows/rc-final.yml','.github/workflows/master-system-audit.yml'
];
for(const p of required) requireFile(p);

let pkg={},meta={};
try{pkg=json('package.json');meta=json('public/release-meta.json');}catch{}
const version=String(pkg.version||'');
const singleVersionOk=version==='1.27.0'&&String(meta.appVersion)==='1.27.0'&&!('engineeringRelease' in meta);
add('VERSION:SINGLE','Version/Release','P0',singleVersionOk?'PASS':'OPEN',`package=${version}; release-meta=${meta.appVersion||''}; engineeringRelease=${meta.engineeringRelease??'absent'}`,'Chỉ dùng v1.27.0 làm version sản phẩm.');
const goldenOk=String(meta.goldenBaseline)==='1.25.7';
add('VERSION:GOLDEN_BASELINE','Version/Release','P0',goldenOk?'PASS':'OPEN',`Golden Baseline=${meta.goldenBaseline||''}`,'Giữ danh tính evidence v1.25.7 cho đến khi tái-baseline có chứng nhận riêng.');
const searchIdentity=String(meta.searchBrain)==='1.9.23'&&String(meta.searchBrainStatus)==='LOCKED';
add('SEARCH:IDENTITY','Search Brain','P0',searchIdentity?'PASS':'OPEN',`Search Brain=${meta.searchBrain||''} ${meta.searchBrainStatus||''}`,'Khóa Search Brain v1.9.23.');
if(exists('src/search.js')){
  const got=normalizedHash('src/search.js'); const want='f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2';
  add('SEARCH:HASH','Search Brain','P0',got===want?'PASS':'OPEN',`SHA256(normalized)=${got}`,'Không sửa src/search.js; phục hồi source LOCKED nếu hash lệch.');
}

if(exists('src/production-status-registry.js')){
  const reg=read('src/production-status-registry.js');
  const productionIds=['10304-driven','10304-end-bearing-rock','10304-bored-raw','10304-spt-raw','10304-spt-summary-explicit','5574-pile-material-near-centered-rect','pile-capacity-integrated-square','pile-capacity-multiborehole-square'];
  for(const id of productionIds){
    const pos=reg.indexOf(`'${id}'`); const slice=pos>=0?reg.slice(pos,pos+500):''; const ok=pos>=0&&/productionNumeric\s*:\s*true/.test(slice)&&/status\s*:\s*['"](?:LOCKED|VERIFIED)['"]/.test(slice);
    add(`REGISTRY:${id}`,'Calculation Engine','P0',ok?'PASS':'OPEN',ok?`${id} cho phép Production theo registry`:`${id} thiếu/không khóa Production`,'Đối chiếu registry ↔ PDF/Golden trước khi mở numeric production.');
  }
  const xllUnsafe=[...reg.matchAll(/'xll-[^']+'\s*:\s*\{[^}]*productionNumeric\s*:\s*true/gs)].map(m=>m[0]);
  add('REGISTRY:DCE_XLL_BLOCK','Provenance/DCE','P0',xllUnsafe.length===0?'PASS':'OPEN',xllUnsafe.length?`Có ${xllUnsafe.length} XLL đang productionNumeric=true`:'Mọi XLL/DCE proprietary vẫn non-production','DCE chỉ REFERENCE/REVIEW; PDF là authority.');
  const legacyPos=reg.indexOf("'10304-2014'"); const legacySlice=legacyPos>=0?reg.slice(legacyPos,legacyPos+300):'';
  add('REGISTRY:LEGACY_2014','Calculation Engine','P0',/productionNumeric\s*:\s*false/.test(legacySlice)?'PASS':'OPEN','TCVN 10304:2014 phải bị cô lập khỏi Production 2025','Khóa legacy edition nếu phát hiện numeric production.');
}

if(exists('src/engineering-router.js')&&exists('src/production-status-registry.js')){
  const router=read('src/engineering-router.js'); const reg=read('src/production-status-registry.js');
  const start=router.indexOf('function productionRegistryIdForResult');
  const end=router.indexOf('export function canExportEngineeringResult',start);
  const registryMapBlock=start>=0&&end>start?router.slice(start,end):'';
  const ids=[...registryMapBlock.matchAll(/return\s+['"]([^'"]+)['"]/g)].map(m=>m[1]).filter(x=>/^(10304|5574|pile-capacity)/.test(x));
  const missing=[...new Set(ids)].filter(id=>!reg.includes(`'${id}'`));
  add('CROSS:ROUTER_REGISTRY','Cross-workflow','P0',missing.length===0?'PASS':'OPEN',missing.length?`Router trả registry ID chưa đăng ký: ${missing.join(', ')}`:'Router production IDs đều có registry entry','Đồng bộ router ↔ registry; không để canExport bypass safety gate.');
  const exportGuard=/result\?\.ok!==true/.test(router)&&/isProductionNumericAllowed/.test(router)&&/designFinal===false/.test(router);
  add('CROSS:EXPORT_GUARD','Cross-workflow','P0',exportGuard?'PASS':'OPEN','canExport phải cần result.ok + production registry + preliminary guard','Khôi phục export safety guard.');
}

for(const [file,needles] of [
  ['src/pile-capacity-engine.js',['Math.min','gammaN']],
  ['src/pile-material-engine.js',['Rmaterial']],
  ['src/multi-borehole-engine.js',['governing']]
]){
  if(exists(file)){
    const txt=read(file); const miss=needles.filter(x=>!txt.includes(x));
    add(`CROSS:${file}`,'Cross-workflow','P0',miss.length===0?'PASS':'OPEN',miss.length?`Thiếu marker: ${miss.join(', ')}`:`Có marker khóa: ${needles.join(', ')}`,'Audit sâu Engine ↔ Excel nếu marker lõi biến mất.');
  }
}

if(exists('src/excel-export.js')){
  const xls=read('src/excel-export.js');
  const critical={LET:(xls.match(/\bLET\s*\(/g)||[]).length,XLOOKUP:(xls.match(/\bXLOOKUP\s*\(/g)||[]).length,LAMBDA:(xls.match(/\bLAMBDA\s*\(/g)||[]).length};
  const criticalCount=Object.values(critical).reduce((a,b)=>a+b,0);
  const modern={SWITCH:(xls.match(/\bSWITCH\s*\(/g)||[]).length,IFS:(xls.match(/\bIFS\s*\(/g)||[]).length};
  const modernCount=modern.SWITCH+modern.IFS;
  const compatFormula=exists('src/excel-formula-compat.js')?read('src/excel-formula-compat.js'):'';
  const compatRuntime=exists('src/excel-export-compat.js')?read('src/excel-export-compat.js'):'';
  const compatSmoke=exists('scripts/excel-production-smoke.mjs')?read('scripts/excel-production-smoke.mjs'):'';
  const runtimeLegacyCompat=/applyLegacyExcelFormulaCompatibility/.test(compatRuntime)&&/downgradeModernExcelFormula/.test(compatFormula)&&/MODERN_EXCEL_FORMULA_RE/.test(compatFormula)&&/assertLegacyFormulaCompatibility/.test(compatSmoke)&&/compatCases/.test(compatSmoke);
  const criticalOk=criticalCount===0||runtimeLegacyCompat;
  const modernOk=modernCount===0||runtimeLegacyCompat;
  add('EXCEL:365_CRITICAL','Excel Production','P1',criticalOk?'PASS':'OPEN',`Core LET=${critical.LET}; XLOOKUP=${critical.XLOOKUP}; LAMBDA=${critical.LAMBDA}; Production legacy-transform=${runtimeLegacyCompat?'CERTIFIED-RUNTIME':'MISSING'}`,'Production phải xuất 0 LET/XLOOKUP/LAMBDA; core chỉ được giữ khi compat transformer + runtime smoke chứng nhận workbook đầu ra.');
  add('EXCEL:MODERN_REVIEW','Excel Production','P2',modernOk?'PASS':'OPEN',`Core SWITCH=${modern.SWITCH}; IFS=${modern.IFS}; Production legacy-transform=${runtimeLegacyCompat?'CERTIFIED-RUNTIME':'MISSING'}`,'Production phải xuất 0 SWITCH/IFS; runtime smoke phải quét workbook đầu ra.');
  const names=[...xls.matchAll(/addWorksheet\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m=>m[1]);
  const englishTokens=/\b(INPUT|CALC|LOOKUP|SOURCE|RESULT|GUIDE|README|PROFILE|POINTS|SHAFT|TIP|SUMMARY)\b/i;
  const englishNames=[...new Set(names.filter(n=>englishTokens.test(n)))];
  add('EXCEL:SHEET_LANGUAGE','Excel Production','P1',englishNames.length===0?'PASS':'OPEN',englishNames.length?`Sheet còn mã/tên Anh: ${englishNames.slice(0,18).join(', ')}${englishNames.length>18?'…':''}`:'Không phát hiện sheet user-facing tiếng Anh','Việt hóa tên sheet user-facing; mapping/code nội bộ dùng veryHidden.');
  const codeLists=[...xls.matchAll(/formulae\s*:\s*\[\s*['"]"([^"\n]+)"['"]\s*\]/g)].map(m=>m[1]).filter(v=>/(square|circle|hammer|press|sand|clay|bored|driven|yes|no|long|short)/i.test(v));
  const compat=exists('src/excel-export-compat.js')?read('src/excel-export-compat.js'):'';
  const compatRuntimeLocalization=/applyGenericVietnameseCodeLists\s*\(/.test(compat)&&/GENERIC_CODE_LABELS/.test(compat)&&/99_MA_NOI_BO/.test(compat)&&/veryHidden/.test(compat);
  const dropdownOk=codeLists.length===0||compatRuntimeLocalization;
  add('EXCEL:DROPDOWN_INTERNAL_CODE','Excel Production','P1',dropdownOk?'PASS':'OPEN',codeLists.length?(compatRuntimeLocalization?`Core còn ${codeLists.length} code-list kỹ thuật nhưng Production compat localize runtime + giữ mapping 99_MA_NOI_BO veryHidden`:`Dropdown code nội bộ còn lộ: ${codeLists.slice(0,12).join(' | ')}`):'Không phát hiện dropdown lộ internal code','Dropdown hiển thị tiếng Việt; mapping code nội bộ chỉ ở 99_MA_NOI_BO veryHidden và phải có Excel Production smoke runtime.');
  const provenanceMarkers=(xls.match(/(?:Nguồn|Bảng|Điều|CT \(|Trang|Provenance)/g)||[]).length;
  add('EXCEL:PROVENANCE_STATIC','Provenance','P0',provenanceMarkers>=20?'PASS':'OPEN',`Provenance/source markers=${provenanceMarkers}`,'Mọi workbook numeric phải có Điều/Bảng/CT/Trang và trạng thái nguồn.');
}

if(exists('src/excel-export-compat.js')){
  const compat=read('src/excel-export-compat.js');
  const chartWorkflows=(compat.match(/addNativeColumnChart\(/g)||[]).length;
  add('EXCEL:CHART_COVERAGE','Excel Production','P2',chartWorkflows>=2?'PASS':'OPEN',`Native chart injection paths=${chartWorkflows}; hiện tập trung SPT explicit + driven`,'Mở rộng chart theo workflow sau khi P0/P1 ổn; không ép chart khi dữ liệu không phù hợp.');
  const hidden=/veryHidden/.test(compat)&&/99_MA_NOI_BO/.test(compat);
  add('EXCEL:HIDDEN_CODES','Excel Production','P1',hidden?'PASS':'OPEN','Internal mapping phải nằm trong 99_MA_NOI_BO veryHidden','Không để code engine lộ ở vùng user-facing.');
}

const ciRequirements={
  '.github/workflows/pass83-runtime-cert.yml':['npm ci','gate:release-sync','gate:pass83-source-sync','gate:pass83-tests','golden:tables','golden:workflows','golden:material','golden:dce-udf','golden:spt-decision','excel:smoke','excel:production-smoke','build:web'],
  '.github/workflows/rc-final.yml':['npm ci','gate:release-sync','golden:tables','golden:workflows','golden:material','golden:dce-udf','golden:spt-decision','excel:smoke','excel:production-smoke','master-system-audit.mjs --enforce-all','dist:win'],
  '.github/workflows/master-system-audit.yml':['npm ci','check:version','gate:release-sync','gate:pass83-source-sync','gate:pass83-tests','golden:tables','golden:workflows','golden:material','golden:dce-udf','golden:spt-decision','golden:material-e2e','golden:multiborehole','excel:smoke','excel:production-smoke','master-system-audit.mjs --enforce-p0','build:web','dist:win']
};
for(const [file,needles] of Object.entries(ciRequirements)){
  if(!exists(file)) continue; const txt=read(file); const miss=needles.filter(n=>!txt.includes(n));
  add(`CI:${path.basename(file)}`,'CI/Release','P0',miss.length===0?'PASS':'OPEN',miss.length?`Thiếu step/command: ${miss.join(', ')}`:'Đủ chuỗi gate bắt buộc','Không promotion nếu thiếu gate nền tảng.');
}

if(exists('.github/workflows/pages.yml')){
  const p=read('.github/workflows/pages.yml');
  const ok=p.includes('check:version')&&p.includes('golden:tables')&&p.includes('excel:smoke')&&p.includes('build:web');
  add('CI:PAGES','Web/CI','P0',ok?'PASS':'OPEN','Pages phải chạy Version + Tests/Golden + Excel smoke + build trước deploy','Không deploy Pages từ build chưa qua gate.');
}
if(exists('.github/workflows/desktop-win.yml')){
  const p=read('.github/workflows/desktop-win.yml'); const ok=p.includes('check:version')&&p.includes('golden:tables')&&p.includes('excel:smoke')&&p.includes('dist:win');
  add('CI:DESKTOP','Windows/CI','P0',ok?'PASS':'OPEN','Windows standalone build phải qua version/golden/excel trước EXE','Không phát hành EXE chỉ vì electron-builder chạy được.');
}

add('SCOPE:RAW_SPT_NEXT','Scope Control','P2','DEFERRED','Raw SPT Pass tiếp theo được chủ đích hoãn trong Master Audit hiện tại.','Chỉ bắt đầu sau khi Gap Matrix P0/P1 của Master Audit được xử lý theo thứ tự.');
add('SCOPE:VBA','Scope Control','P2','DEFERRED','VBA Advanced chưa thuộc vòng Master Audit hiện tại.','Giữ core .xlsx formula-only trước; VBA chỉ tự động hóa sau certification.');

const open=p=>rows.filter(r=>r.priority===p&&r.status==='OPEN');
const p0=open('P0'),p1=open('P1'),p2=open('P2');
const state=p0.length?'BLOCKED_P0':p1.length?'AUDIT_OPEN_P1':p2.length?'AUDIT_OPEN_P2':'READY_FOR_RC';
const report={
  schema:'HNL_MASTER_SYSTEM_AUDIT_V1',
  appVersion:version||null,
  certificationStage:meta.certificationStage||null,
  goldenBaseline:meta.goldenBaseline||null,
  searchBrain:meta.searchBrain?`${meta.searchBrain} ${meta.searchBrainStatus||''}`.trim():null,
  generatedAt:new Date().toISOString(),
  state,
  summary:{total:rows.length,pass:rows.filter(r=>r.status==='PASS').length,openP0:p0.length,openP1:p1.length,openP2:p2.length,deferred:rows.filter(r=>r.status==='DEFERRED').length},
  gaps:rows
};
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,'HNL_MASTER_CERTIFICATION_v1.27.0.json'),JSON.stringify(report,null,2)+'\n');
const md=[
  '# HNL v1.27.0 — Master System Audit & Golden Gap Matrix','',
  `- Trạng thái: **${state}**`,
  `- P0 mở: **${p0.length}** · P1 mở: **${p1.length}** · P2 mở: **${p2.length}** · Deferred: **${report.summary.deferred}**`,
  `- Golden Baseline: **${meta.goldenBaseline||''}**`,
  `- Search Brain: **${meta.searchBrain||''} ${meta.searchBrainStatus||''}**`,'',
  '| ID | Area | Priority | Status | Evidence | Action |','|---|---|---:|---|---|---|',
  ...rows.map(r=>`| ${r.id.replace(/\|/g,'/')} | ${r.area.replace(/\|/g,'/')} | ${r.priority} | ${r.status} | ${String(r.evidence).replace(/\|/g,'/')} | ${String(r.recommendation).replace(/\|/g,'/')} |`),
  '',
  '## Quy tắc đóng lỗi','',
  '- P0: sửa nguyên nhân gốc + thêm gate/regression trước khi tiếp tục promotion.',
  '- P1: xử lý theo cụm workflow; không sửa từng ô/công thức rời rạc.',
  '- P2: xử lý sau P0/P1; mục DEFERRED chỉ mở lại khi scope control cho phép.',
  '- Không gọi Production Verified chỉ từ một Actions xanh; RC Final phải chạy `--enforce-all`.',''
].join('\n');
fs.writeFileSync(path.join(outDir,'MASTER_GAP_MATRIX.md'),md);
console.log(JSON.stringify(report.summary));
console.log(`MASTER SYSTEM AUDIT: ${state}`);
console.log(`Gap Matrix: ${path.relative(root,path.join(outDir,'MASTER_GAP_MATRIX.md'))}`);
if((enforceP0&&p0.length)||(enforceAll&&(p0.length||p1.length||p2.length))) process.exit(1);
