#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const OLD='1.26.0', VER='1.27.0';
const BASE='787e34003dc53218f64a6c28cffd8bd4001e5a07';
const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
const hash=p=>crypto.createHash('sha256').update(read(p).replace(/\r\n/g,'\n')).digest('hex');
const replaceVersion=p=>{let s=read(p); if(!s.includes(OLD)) throw new Error(`${p}: missing ${OLD}`); write(p,s.split(OLD).join(VER));};

// Current product identity / certification files only. Historical release v1.26.0 and PR3 evidence stay untouched.
const currentTextFiles=[
  '.github/workflows/desktop-win.yml',
  '.github/workflows/master-system-audit.yml',
  '.github/workflows/pages.yml',
  '.github/workflows/pass83-runtime-cert.yml',
  '.github/workflows/rc-final.yml',
  '.github/workflows/v26-spt-input-cert.yml',
  '00_HUONG_DAN_DAN_DE.md',
  'FULL_OVERWRITE_INFO.txt',
  'MASTER_AUDIT_PLAN.md',
  'MASTER_AUDIT_PREFLIGHT.json',
  'MASTER_AUDIT_PRELIMINARY_GAP_MATRIX.md',
  'README.md',
  'UPDATE_INFO.txt',
  'docs/BUILD_METADATA.md',
  'scripts/check-version-sync.mjs',
  'scripts/excel-production-smoke.mjs',
  'scripts/master-system-audit.mjs',
  'src/excel-export-compat.js',
  'tools/release-sync-gate.mjs',
  'vite.config.js'
];
for(const p of currentTextFiles) replaceVersion(p);

// package identity
for(const p of ['package.json','package-lock.json']){
  const j=JSON.parse(read(p));
  j.version=VER;
  if(p==='package-lock.json'&&j.packages?.['']) j.packages[''].version=VER;
  write(p,JSON.stringify(j,null,2)+'\n');
}

// release metadata
{
  const p='public/release-meta.json',m=JSON.parse(read(p));
  m.appVersion=VER;
  m.releaseDate='2026-08-30';
  m.releaseTitle='PDF Intelligence Shadow + Excel Legacy Compatibility + Production Release';
  m.baselineCommit=BASE;
  if(m.searchBrain!=='1.9.23'||m.searchBrainStatus!=='LOCKED') throw new Error('Search Brain identity changed');
  if(m.goldenBaseline!=='1.25.7') throw new Error('Golden baseline changed');
  write(p,JSON.stringify(m,null,2)+'\n');
}

// changelog: preserve v1.26 history and prepend official v1.27.0
{
  const p='public/changelog.json',c=JSON.parse(read(p));
  if(c.releases?.some(x=>String(x.version)===VER)) throw new Error('v1.27.0 already exists in changelog');
  c.current=VER;
  c.releases=[{
    version:VER,
    date:'2026-08-30',
    title:'PDF Intelligence Shadow + Excel Legacy Compatibility + Production Release',
    changes:[
      'Nâng App Version chính thức lên v1.27.0 trên Web, Desktop, PWA, EXE, release metadata và certification artifacts.',
      'P4 PDF/Image → Excel Intelligence đã có trong main nhưng vẫn giữ SHADOW_ONLY/REVIEW-first; không tự đưa BENCHMARKED hoặc OCR/Vision chưa xác nhận vào Calculation Engine.',
      'Excel Production đã Việt hóa tên sheet và dropdown hữu hạn; mã nội bộ tiếp tục được giữ trong sheet 99_MA_NOI_BO veryHidden.',
      'Excel Production bổ sung compatibility transformer: workbook phát hành không còn phụ thuộc LET/XLOOKUP/LAMBDA/SWITCH/IFS trong các workflow được chứng nhận; runtime smoke quét workbook đầu ra.',
      'Master Audit --enforce-all đóng EXCEL:365_CRITICAL và EXCEL:MODERN_REVIEW bằng runtime evidence, không hạ gate.',
      'Golden Baseline vẫn là v1.25.7; Search Brain v1.9.23 vẫn LOCKED; Calculation Engine không bị sửa bởi pass compatibility.'
    ]
  },...(c.releases||[])];
  write(p,JSON.stringify(c,null,2)+'\n');
}

// New current release document; keep docs/RELEASE_V1.26.0.md as immutable history.
write('docs/RELEASE_V1.27.0.md',`# HNL Pile Standards AI v1.27.0\n\nRelease date: **2026-08-30**  \nCertification Stage: **MASTER_SYSTEM_AUDIT**  \nGolden Baseline: **1.25.7**  \nSearch Brain: **1.9.23 LOCKED**\n\n## Release scope\n\n1. App Version chính thức thống nhất **1.27.0** cho Web, Desktop, PWA, EXE và build metadata.\n2. P4 PDF/Image → Excel Intelligence đã được merge vào main nhưng tiếp tục **SHADOW_ONLY / REVIEW-first**; OCR/Vision chưa người dùng xác nhận không được đi thẳng vào Calculation Engine.\n3. Excel Production: tên sheet và dropdown user-facing bằng tiếng Việt; mã kỹ thuật nội bộ giữ trong **99_MA_NOI_BO** ở trạng thái veryHidden.\n4. Excel legacy compatibility: workbook Production được hậu xử lý để loại LET/XLOOKUP/LAMBDA/SWITCH/IFS khỏi các workflow đã được runtime-certify; công thức legacy vốn không cần đổi được giữ nguyên.\n5. Master Audit **--enforce-all** phải PASS; release-sync, source-sync, regression, Full Table Golden, workflow/material/DCE/SPT/E2E/Multi-borehole Golden và Excel smoke đều là release gate.\n\n## Safety / provenance\n\n- Không sửa Search Brain v1.9.23.\n- Không sửa Calculation Engine trong pass Excel compatibility/version promotion.\n- P3.2 vẫn là **BENCHMARKED**, không được ghi thành full formula/table VERIFIED.\n- P4_PROMOTION_STATE vẫn **SHADOW_ONLY**; release v1.27.0 không đồng nghĩa tự động cho phép production mutation từ dữ liệu OCR/Vision.\n\n## Version policy\n\nChỉ **appVersion = 1.27.0** là version sản phẩm hiện hành. Golden Baseline, Search Brain version và các Pass/P-stage là danh tính bằng chứng hoặc nhãn kiểm toán, không phải version ứng dụng song song.\n`);

// RELEASE_SYNC_MANIFEST: promote identity, point at current release doc, then refresh every tracked hash.
{
  const p='RELEASE_SYNC_MANIFEST.json',m=JSON.parse(read(p));
  m.appVersion=VER; m.baselineCommit=BASE;
  if(m.searchBrain!=='1.9.23 LOCKED'||m.goldenBaseline!=='1.25.7') throw new Error('Release manifest lock identity changed');
  if(m.files['docs/RELEASE_V1.26.0.md']){delete m.files['docs/RELEASE_V1.26.0.md'];m.files['docs/RELEASE_V1.27.0.md']='';}
  for(const f of Object.keys(m.files)){
    if(!fs.existsSync(f)) throw new Error(`Release sync tracked file missing: ${f}`);
    m.files[f]=hash(f);
  }
  write(p,JSON.stringify(m,null,2)+'\n');
}

// FULL_OVERWRITE_MANIFEST: current delivery inventory; keep historical release doc outside current overwrite set.
{
  const p='FULL_OVERWRITE_MANIFEST.json',m=JSON.parse(read(p));
  m.appVersion=VER; m.baselineCommit=BASE;
  if(m.searchBrain!=='1.9.23 LOCKED'||m.goldenBaseline!=='1.25.7') throw new Error('Full overwrite lock identity changed');
  if(m.files['docs/RELEASE_V1.26.0.md']){delete m.files['docs/RELEASE_V1.26.0.md'];m.files['docs/RELEASE_V1.27.0.md']='';}
  if(!m.files['src/excel-formula-compat.js']) m.files['src/excel-formula-compat.js']='';
  // RELEASE_SYNC_MANIFEST changed after the previous source files; refresh all current overwrite hashes now.
  for(const f of Object.keys(m.files)){
    if(!fs.existsSync(f)) throw new Error(`Full overwrite tracked file missing: ${f}`);
    m.files[f]=hash(f);
  }
  m.fileCount=Object.keys(m.files).length;
  write(p,JSON.stringify(m,null,2)+'\n');
}

// Final identity assertions.
const pkg=JSON.parse(read('package.json')), meta=JSON.parse(read('public/release-meta.json')), cl=JSON.parse(read('public/changelog.json'));
if(pkg.version!==VER||meta.appVersion!==VER||cl.current!==VER||cl.releases?.[0]?.version!==VER) throw new Error('Single version identity failed');
if(read('src/p4-pdf-excel-intelligence.js').includes("P4_PROMOTION_STATE = 'SHADOW_ONLY'")===false) throw new Error('P4 safety state drifted');
if(read('scripts/check-search-brain.mjs').length<10) throw new Error('Search lock guard missing');
console.log('V1.27 RELEASE PROMOTION: APPLIED · P4 SHADOW_ONLY preserved · Search Brain LOCKED');
