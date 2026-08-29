import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const VERSION='1.27.0';
const PREVIOUS='1.26.0';
const DATE='2026-08-29';
const PRE_RELEASE_SHA='f40fb68e8a087db87b033242198200798746cb37';
const GOLDEN='1.25.7';
const SEARCH='1.9.23';
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),s.endsWith('\n')?s:`${s}\n`,'utf8');};
const json=p=>JSON.parse(read(p));
const writeJson=(p,v)=>write(p,JSON.stringify(v,null,2));
const replaceRequired=(src,from,to,label)=>{if(!src.includes(from))throw new Error(`Missing ${label}: ${from}`);return src.replace(from,to);};

// 1) Single app version identity.
const pkg=json('package.json');
if(pkg.version!==PREVIOUS) throw new Error(`Expected package ${PREVIOUS}, got ${pkg.version}`);
pkg.version=VERSION;
writeJson('package.json',pkg);

const lock=json('package-lock.json');
lock.version=VERSION;
if(!lock.packages?.['']) throw new Error('package-lock missing root package');
lock.packages[''].version=VERSION;
writeJson('package-lock.json',lock);

const meta=json('public/release-meta.json');
meta.appVersion=VERSION;
meta.releaseDate=DATE;
meta.releaseTitle='PDF/Image → Excel Intelligence + Runtime Golden + Windows/Web Certification';
meta.baselineCommit=PRE_RELEASE_SHA;
meta.certificationStage='MASTER_SYSTEM_AUDIT';
meta.goldenBaseline=GOLDEN;
meta.searchBrain=SEARCH;
meta.searchBrainStatus='LOCKED';
delete meta.engineeringRelease;
writeJson('public/release-meta.json',meta);

// 2) Changelog: preserve history, prepend v1.27.0 only once.
const changelog=json('public/changelog.json');
changelog.current=VERSION;
changelog.releases=(changelog.releases||[]).filter(x=>String(x.version)!==VERSION);
changelog.releases.unshift({
  version:VERSION,
  date:DATE,
  title:'PDF/Image → Excel Intelligence · Runtime Golden · Windows + Web',
  changes:[
    'P3.2 Real PDF Golden đóng 9/9 BENCHMARKED; không tự nâng thành numeric VERIFIED.',
    'P4 PDF/Ảnh → Excel Intelligence hỗ trợ quét PDF, vùng PDF và Image Engineering review với provenance file → page → bbox → engine → state/source SHA.',
    'OCR/Vision-readable vẫn REVIEW cho tới khi được xác nhận; không tự chảy vào Calculation Engine.',
    'P4 Runtime Golden chạy Chromium thật trên Windows CI đạt 5/5, gồm ba workbook XLSX thực tế.',
    'Full regression đạt 592/592; Search Brain v1.9.23 tiếp tục LOCKED và Calculation Engine không thay đổi.',
    'Sản phẩm phát hành chỉ nhắm Web và Windows x64; Windows đóng gói NSIS Setup + Portable.'
  ]
});
writeJson('public/changelog.json',changelog);

// 3) README current-release section only; historical v1.26 section stays intact.
let readme=read('README.md');
readme=replaceRequired(readme,'# HNL Pile Standards AI v1.26.0','# HNL Pile Standards AI v1.27.0','README heading');
readme=replaceRequired(readme,'**Version duy nhất của ứng dụng:** v1.26.0','**Version duy nhất của ứng dụng:** v1.27.0','README single version');
readme=replaceRequired(readme,'**Baseline source trước cập nhật:** `660bda57ca50a7326e13c3b858f05c4864875f3c`',`**Pre-release Runtime Golden SHA:** \`${PRE_RELEASE_SHA}\``,'README baseline');
const goals=/## Mục tiêu v1\.26\.0[\s\S]*?(?=## Quy ước version)/;
if(!goals.test(readme))throw new Error('README goals block missing');
readme=readme.replace(goals,`## Mục tiêu v1.27.0\n\n- Đưa PDF/Ảnh → Excel Intelligence vào một luồng REVIEW-first có provenance đầy đủ.\n- Giữ P3.2 ở mức BENCHMARKED; chỉ nguồn VERIFIED mới đủ điều kiện tạo công thức Excel thực thi.\n- Khóa OCR/Vision chưa xác nhận khỏi Calculation Engine.\n- Chứng nhận Web bằng Runtime Golden Chromium 5/5 và full regression 592/592.\n- Phát hành đúng hai đích: Web và Windows x64 (NSIS Setup + Portable).\n- Giữ Search Brain v1.9.23 LOCKED và Golden Baseline v1.25.7.\n\n`);
readme=replaceRequired(readme,'- **Chỉ có một version sản phẩm: `v1.26.0`.** Đây là version trên Web, EXE, PWA, package, changelog, release và artifact hiện hành.','- **Chỉ có một version sản phẩm: `v1.27.0`.** Đây là version trên Web, EXE, PWA, package, changelog, release và artifact hiện hành.','README version policy');
const updateSection=/## Cập nhật bằng GitHub Desktop[\s\S]*?(?=## Lịch sử phát hành)/;
if(!updateSection.test(readme))throw new Error('README update section missing');
readme=readme.replace(updateSection,`## Phát hành Web + Windows\n\n1. Mọi build release phải xuất phát từ đúng SHA đã qua CI.\n2. Web dùng artifact đã chứng nhận và được kiểm lại \`build-info.json\` trước khi cập nhật \`hnlpile.vercel.app\`.\n3. Windows phát hành đúng hai file x64: Setup NSIS và Portable.\n4. Runtime Golden, Web artifact, EXE và SHA-256 phải được sao lưu trước khi promotion.\n5. PR #4 / \`main\` chỉ merge khi có quyết định promotion riêng; bump version không tự đồng nghĩa Production promotion.\n\n`);
const history='## Lịch sử phát hành\n';
const v127History=`\n### v1.27.0 — PDF/Image → Excel Intelligence + Runtime Golden\nNgày: ${DATE}\n\n- P3.2: 9/9 BENCHMARKED, không numeric-promote.\n- P4: PDF scan / vùng PDF / ảnh review → Excel với provenance.\n- Runtime Golden Chromium: 5/5 PASS trên Windows CI tại pre-release SHA \`${PRE_RELEASE_SHA}\`.\n- Full regression: 592/592 PASS.\n- Search Brain v1.9.23 LOCKED; Calculation Engine không đổi.\n- Target phát hành: Web + Windows x64 Setup/Portable.\n`;
if(!readme.includes('### v1.27.0 —')) readme=replaceRequired(readme,history,history+v127History,'README history anchor');
write('README.md',readme);

// 4) Build metadata + release note.
let buildMeta=read('docs/BUILD_METADATA.md').replaceAll('v1.26.0','v1.27.0').replaceAll('"1.26.0"','"1.27.0"');
write('docs/BUILD_METADATA.md',buildMeta);
write('docs/RELEASE_V1.27.0.md',`# HNL Pile Standards AI v1.27.0\n\n## Release identity\n\n- Version sản phẩm duy nhất: **v1.27.0**\n- Giai đoạn chứng nhận: **Master System Audit**\n- Golden Baseline: **1.25.7**\n- Search Brain: **v1.9.23 LOCKED**\n- Pre-release Runtime Golden SHA: \`${PRE_RELEASE_SHA}\`\n\n## Thay đổi chính\n\n1. P3.2 Real PDF Golden đóng **9/9 BENCHMARKED**; không tự nâng thành numeric VERIFIED.\n2. P4 PDF/Ảnh → Excel Intelligence hỗ trợ quét toàn PDF, vùng PDF và Image Engineering review.\n3. Provenance giữ file → page → bbox → engine → state/confidence → source SHA/fingerprint khi có.\n4. OCR/Vision-readable không đồng nghĩa VERIFIED; dữ liệu chưa xác nhận không được tự đi vào Calculation Engine.\n5. Công thức Excel thực thi chỉ được tạo khi provenance VERIFIED, expression qua allowlist và biến đã ánh xạ input an toàn.\n6. Chromium Runtime Golden trên Windows CI đạt **5/5**; full regression đạt **592/592**.\n7. Sản phẩm phát hành chỉ nhắm **Web + Windows x64**; Windows gồm NSIS Setup và Portable.\n\n## Quy tắc chứng nhận\n\n- Golden Baseline v1.25.7 tiếp tục giữ nguyên tên để bảo toàn lịch sử benchmark.\n- Search Brain v1.9.23 tiếp tục LOCKED; không sửa \`src/search.js\`.\n- Calculation Engine không được thay đổi trong release bump này.\n- P4 tiếp tục REVIEW-first; bump v1.27.0 không tự động promotion PR #4 hoặc \`main\`.\n- Web/EXE chỉ được phát hành từ đúng release SHA sau khi CI, Runtime Golden và artifact verification đều PASS.\n`);

// 5) Make version gate release-dynamic instead of hardcoding v1.26.0.
let versionGate=read('scripts/check-version-sync.mjs');
versionGate=replaceRequired(versionGate,"if ('engineeringRelease' in meta) fail('release-meta không được chứa engineeringRelease; v1.26.0 là version sản phẩm duy nhất.');","if ('engineeringRelease' in meta) fail('release-meta không được chứa engineeringRelease; appVersion là version sản phẩm duy nhất.');",'version gate engineering text');
versionGate=replaceRequired(versionGate,"if (!readme.includes('Version duy nhất của ứng dụng:** v1.26.0')) fail('README chưa khóa quy tắc một version duy nhất.');","if (!readme.includes(`Version duy nhất của ứng dụng:** v${version}`)) fail('README chưa khóa quy tắc một version duy nhất.');",'version gate README');
write('scripts/check-version-sync.mjs',versionGate);

// 6) Release-sync gate stays strict but version is read dynamically.
write('tools/release-sync-gate.mjs',`#!/usr/bin/env node\nimport fs from 'node:fs';\nimport path from 'node:path';\nimport crypto from 'node:crypto';\nimport { fileURLToPath } from 'node:url';\n\nconst root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');\nconst manifestPath=path.join(root,'RELEASE_SYNC_MANIFEST.json');\nconst fail=[];\nconst read=p=>fs.readFileSync(path.join(root,p),'utf8');\nconst hash=p=>crypto.createHash('sha256').update(read(p).replace(/\\r\\n/g,'\\n')).digest('hex');\nif(!fs.existsSync(manifestPath)) fail.push('Thiếu RELEASE_SYNC_MANIFEST.json');\nlet m={};\nif(!fail.length){try{m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));}catch(e){fail.push(\`Manifest JSON lỗi: \${e.message}\`);}}\nlet pkg={},meta={};\ntry{pkg=JSON.parse(read('package.json'));meta=JSON.parse(read('public/release-meta.json'));}catch(e){fail.push(\`Không đọc được version metadata: \${e.message}\`);}\nconst version=String(pkg.version||'');\nif(!/^\\d+\\.\\d+\\.\\d+$/.test(version)) fail.push(\`package.json version không hợp lệ: \${version}\`);\nif(String(meta.appVersion)!==version) fail.push(\`release-meta appVersion=\${meta.appVersion}, package=\${version}\`);\nif(String(m.appVersion)!==version) fail.push(\`manifest appVersion=\${m.appVersion}, package=\${version}\`);\nif('engineeringRelease' in meta) fail.push('release-meta còn engineeringRelease song song');\nif(String(meta.certificationStage)!=='MASTER_SYSTEM_AUDIT'||String(m.certificationStage)!=='MASTER_SYSTEM_AUDIT') fail.push('certificationStage lệch MASTER_SYSTEM_AUDIT');\nif(String(meta.goldenBaseline)!=='${GOLDEN}'||String(m.goldenBaseline)!=='${GOLDEN}') fail.push('goldenBaseline lệch ${GOLDEN}');\nif(String(meta.searchBrain)!=='${SEARCH}'||String(meta.searchBrainStatus)!=='LOCKED'||String(m.searchBrain)!=='${SEARCH} LOCKED') fail.push('Search Brain identity lệch');\nfor(const [file,want] of Object.entries(m.files||{})){const abs=path.join(root,file);if(!fs.existsSync(abs)){fail.push(\`MISSING \${file}\`);continue;}const got=hash(file);if(got!==want)fail.push(\`HASH \${file} got=\${got} want=\${want}\`);}\nif(fail.length){for(const x of fail)console.error(\`FAIL \${x}\`);console.error(\`RELEASE SYNC GATE: FAIL (\${fail.length})\`);process.exit(1);}\nconsole.log(\`RELEASE SYNC GATE: PASS · HNL v\${version} · \${meta.certificationStage} · Golden \${meta.goldenBaseline} · Search Brain \${meta.searchBrain} LOCKED\`);\n`);

// 7) Current CI labels/version-specific artifact checks.
const currentWorkflows=[
  '.github/workflows/pages.yml','.github/workflows/desktop-win.yml','.github/workflows/pass83-runtime-cert.yml',
  '.github/workflows/rc-final.yml','.github/workflows/v26-spt-input-cert.yml','.github/workflows/master-system-audit.yml'
];
for(const p of currentWorkflows){let s=read(p);s=s.replaceAll('HNL v1.26.0','HNL v1.27.0').replaceAll('hnl-v1.26.0','hnl-v1.27.0').replaceAll('v1.26.0','v1.27.0').replaceAll('V1.26.0','V1.27.0').replaceAll('Exact 574 regression','Exact 592 regression');write(p,s);}

// 8) v1.27 Windows/Web certification now packages official Setup + Portable after Golden.
let v127=read('.github/workflows/v127-pdf-intelligence-shadow.yml');
if(!v127.includes('Build official Windows Setup + Portable x64')){
  const marker='\n# No Linux desktop target. Runtime Golden is executed in real Chromium on Windows CI.';
  if(!v127.includes(marker))throw new Error('v127 packaging marker missing');
  const steps=`\n      - name: Verify release identity v1.27.0\n        shell: pwsh\n        run: |\n          $pkg = Get-Content package.json -Raw | ConvertFrom-Json\n          if ($pkg.version -ne '1.27.0') { throw \"Expected release version 1.27.0, got $($pkg.version)\" }\n          npm run check:version\n          npm run gate:release-sync\n      - name: Build official Windows Setup + Portable x64\n        run: npm run dist:win\n      - name: Verify official Windows release artifacts + SHA256\n        shell: pwsh\n        run: |\n          $setup = 'release/HNL-Pile-Standards-AI-Setup-1.27.0-x64.exe'\n          $portable = 'release/HNL-Pile-Standards-AI-Portable-1.27.0-x64.exe'\n          if (!(Test-Path $setup)) { throw \"Missing $setup\" }\n          if (!(Test-Path $portable)) { throw \"Missing $portable\" }\n          $lines = @()\n          foreach ($f in @($setup,$portable)) {\n            $h = (Get-FileHash $f -Algorithm SHA256).Hash.ToLowerInvariant()\n            $lines += \"$h  $([IO.Path]::GetFileName($f))\"\n          }\n          $lines | Set-Content release/SHA256SUMS.txt -Encoding ascii\n          Get-Content release/SHA256SUMS.txt\n      - name: Upload official Windows v1.27.0 x64\n        uses: actions/upload-artifact@v4\n        with:\n          name: HNL-v1.27.0-Windows-x64-\${{ github.event.pull_request.head.sha || github.sha }}\n          path: |\n            release/HNL-Pile-Standards-AI-Setup-1.27.0-x64.exe\n            release/HNL-Pile-Standards-AI-Portable-1.27.0-x64.exe\n            release/SHA256SUMS.txt\n          if-no-files-found: error\n          retention-days: 30\n`;
  v127=v127.replace(marker,steps+marker.replace('Final NSIS + Portable x64 EXE packaging remains deferred until P4 Runtime Golden closes.','Official NSIS + Portable x64 packaging runs only after P4 Runtime Golden and release identity gates pass.'));
  write('.github/workflows/v127-pdf-intelligence-shadow.yml',v127);
}

// 9) Release sync manifest: preserve old locked files, move current release doc and add P3.2/P4 release-critical files.
const manifest=json('RELEASE_SYNC_MANIFEST.json');
manifest.appVersion=VERSION;
manifest.certificationStage='MASTER_SYSTEM_AUDIT';
manifest.goldenBaseline=GOLDEN;
manifest.searchBrain=`${SEARCH} LOCKED`;
manifest.baselineCommit=PRE_RELEASE_SHA;
if(manifest.files?.['docs/RELEASE_V1.26.0.md']) delete manifest.files['docs/RELEASE_V1.26.0.md'];
const critical=[
  'package.json','package-lock.json','README.md','public/changelog.json','public/release-meta.json','docs/RELEASE_V1.27.0.md','docs/BUILD_METADATA.md',
  'vite.config.js','scripts/check-version-sync.mjs','scripts/generate-build-info.mjs','scripts/cross-platform-paths.mjs','scripts/dce-udf-behavioral-golden.mjs','scripts/excel-production-smoke.mjs','scripts/master-system-audit.mjs',
  'src/excel-export-compat.js','src/excel-export-v26.js','src/xlsx-native-chart.js','tools/release-sync-gate.mjs','tools/v26.3.1-release-sync-gate.mjs',
  '.github/workflows/pages.yml','.github/workflows/desktop-win.yml','.github/workflows/pass83-runtime-cert.yml','.github/workflows/rc-final.yml','.github/workflows/v26-spt-input-cert.yml','.github/workflows/master-system-audit.yml','.github/workflows/v127-pdf-intelligence-shadow.yml',
  '00_HUONG_DAN_DAN_DE.md','UPDATE_INFO.txt','FULL_OVERWRITE_INFO.txt','MASTER_AUDIT_PLAN.md','MASTER_AUDIT_PRELIMINARY_GAP_MATRIX.md','MASTER_AUDIT_PREFLIGHT.json',
  'index.html','src/p4-pdf-excel-intelligence.js','src/pdf-excel-intelligence/core.js','src/pdf-excel-intelligence/adapters.js','src/pdf-excel-intelligence/exporter.js','src/pdf-excel-intelligence/ui.css','src/pdf-excel-intelligence/ui.js','src/pdf-excel-intelligence/runtime-golden-ui.js','src/pdf-excel-intelligence/runtime-golden-ci.js','scripts/pdf-excel-intelligence-selftest.mjs','scripts/p4-runtime-golden-browser.mjs','tests/p4-pdf-excel-intelligence.test.mjs',
  'src/pdf-intelligence/real-pdf-golden-core.js','src/pdf-intelligence/real-pdf-golden-corpus.js','src/pdf-intelligence/real-pdf-golden-ui.js'
];
manifest.files=manifest.files||{};
for(const p of critical){if(!fs.existsSync(path.join(root,p)))throw new Error(`Release critical file missing: ${p}`);manifest.files[p]='PENDING';}
const hash=p=>crypto.createHash('sha256').update(read(p).replace(/\r\n/g,'\n')).digest('hex');
for(const p of Object.keys(manifest.files)){if(!fs.existsSync(path.join(root,p)))throw new Error(`Manifest file missing: ${p}`);manifest.files[p]=hash(p);}
writeJson('RELEASE_SYNC_MANIFEST.json',manifest);

// Temporary preparation files must not remain in release tree.
for(const p of ['scripts/prepare-v127-release.mjs','.github/workflows/v127-release-prepare.yml']){
  try{fs.rmSync(path.join(root,p),{force:true});}catch{}
}

console.log(`HNL v${VERSION} release tree prepared from certified pre-release ${PRE_RELEASE_SHA}.`);
