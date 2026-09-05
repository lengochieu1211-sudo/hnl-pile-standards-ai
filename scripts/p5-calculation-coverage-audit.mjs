#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'artifacts', 'p5-calculation-coverage');
const enforceExisting = process.argv.includes('--enforce-existing');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const exists = p => fs.existsSync(path.join(root, p));
const normalizeHash = p => crypto.createHash('sha256').update(read(p).replace(/\r\n/g, '\n')).digest('hex');

const registryText = read('src/production-status-registry.js');
const packageJson = JSON.parse(read('package.json'));

function parseRegistryEntry(id) {
  const marker = `'${id}'`;
  const pos = registryText.indexOf(marker);
  if (pos < 0) return null;
  const slice = registryText.slice(pos, pos + 850);
  const status = slice.match(/status\s*:\s*['"]([^'"]+)['"]/)?.[1] || 'UNKNOWN';
  const productionNumeric = /productionNumeric\s*:\s*true/.test(slice);
  const source = slice.match(/source\s*:\s*['"]([^'"]+)['"]/)?.[1] || '';
  return { id, status, productionNumeric, source };
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, acc);
    else if (/\.(?:js|mjs|cjs|md|json)$/i.test(name)) acc.push(full);
  }
  return acc;
}

const sourceFiles = walk(path.join(root, 'src'));
const sourceCorpus = sourceFiles.map(file => ({
  file: path.relative(root, file).replaceAll('\\', '/'),
  text: fs.readFileSync(file, 'utf8')
}));

function tokenEvidence(tokens) {
  const hits = [];
  for (const item of sourceCorpus) {
    const lower = item.text.toLowerCase();
    if (tokens.some(t => lower.includes(t.toLowerCase()))) hits.push(item.file);
  }
  return [...new Set(hits)].slice(0, 8);
}

const roadmap = [
  {
    key: 'driven',
    label: 'Cọc đóng/ép theo đất nền',
    registryIds: ['10304-driven'],
    tokens: ['driven', 'pile-capacity'],
    target: 'Giữ Production LOCKED; không thay đổi engine nếu Golden không yêu cầu.'
  },
  {
    key: 'bored',
    label: 'Cọc khoan nhồi/cọc ma sát',
    registryIds: ['10304-bored-raw', '10304-end-bearing-rock'],
    tokens: ['bored', 'end-bearing-rock'],
    target: 'Giữ Production LOCKED; mở rộng case matrix thay vì viết lại công thức.'
  },
  {
    key: 'screw',
    label: 'Cọc vít / helical pile',
    registryIds: ['10304-screw'],
    tokens: ['screw', 'helical', 'cọc vít', 'coc vit'],
    target: 'Reverse-engineer theo TCVN/PDF authority, tạo deterministic engine + Excel + Golden trước Production.'
  },
  {
    key: 'static-load-test',
    label: 'Thí nghiệm tải trọng tĩnh',
    registryIds: ['10304-static-load-test'],
    tokens: ['static load', 'tải tĩnh', 'tai tinh'],
    target: 'Tách module đọc dữ liệu thí nghiệm khỏi sức chịu tải tính toán; provenance từng điểm tải/chuyển vị.'
  },
  {
    key: 'dynamic-test',
    label: 'Thử động / PDA',
    registryIds: ['10304-dynamic-test'],
    tokens: ['dynamic', 'pda', 'thử động', 'thu dong'],
    target: 'REVIEW trước; chỉ Production sau khi có tiêu chí/Golden độc lập.'
  },
  {
    key: 'cpt',
    label: 'Sức chịu tải theo CPT',
    registryIds: ['10304-cpt'],
    tokens: ['cpt', 'cone penetration', 'qc'],
    target: 'Engine CPT độc lập, bảng/hệ số có provenance, Excel công thức thật và boundary Golden.'
  },
  {
    key: 'spt',
    label: 'Sức chịu tải theo SPT',
    registryIds: ['10304-spt-raw', '10304-spt-summary-explicit'],
    tokens: ['spt', 'nbar', 'Ns'],
    target: 'Giữ geometry-first + layer integration + workbook parity hiện tại.'
  },
  {
    key: 'single-pile-settlement',
    label: 'Độ lún cọc đơn',
    registryIds: ['10304-settlement-single'],
    tokens: ['settlement', 'lún cọc đơn', 'lun coc don'],
    target: 'Deterministic settlement workflow + soil profile integration + Excel + Golden.'
  },
  {
    key: 'pile-group-settlement',
    label: 'Độ lún nhóm cọc',
    registryIds: ['10304-settlement-group'],
    tokens: ['pile group', 'group settlement', 'lún nhóm', 'lun nhom'],
    target: 'Tách geometry nhóm, tương tác nền và kiểm tra điều kiện áp dụng.'
  },
  {
    key: 'equivalent-block',
    label: 'Khối móng quy ước',
    registryIds: ['10304-equivalent-block'],
    tokens: ['equivalent block', 'khối quy ước', 'khoi quy uoc'],
    target: 'Engine hình học + ứng suất + lún với provenance và boundary tests.'
  },
  {
    key: 'piled-raft',
    label: 'Bè-cọc / piled raft',
    registryIds: ['10304-piled-raft'],
    tokens: ['piled raft', 'bè-cọc', 'be coc'],
    target: 'Giữ ở REVIEW cho tới khi có mô hình tính được khóa bằng benchmark độc lập.'
  }
];

const supportWorkflows = [
  '5574-pile-material-near-centered-rect',
  'pile-capacity-integrated-square',
  'pile-capacity-multiborehole-square'
];

const rows = roadmap.map(item => {
  const entries = item.registryIds.map(parseRegistryEntry).filter(Boolean);
  const production = entries.filter(e => e.productionNumeric && ['LOCKED', 'VERIFIED'].includes(e.status));
  const review = entries.filter(e => !e.productionNumeric || !['LOCKED', 'VERIFIED'].includes(e.status));
  const evidenceFiles = tokenEvidence(item.tokens);
  let coverageStatus = 'MISSING_PRODUCTION_GATE';
  if (production.length === item.registryIds.length) coverageStatus = 'PRODUCTION_LOCKED_OR_VERIFIED';
  else if (entries.length || evidenceFiles.length) coverageStatus = 'PARTIAL_OR_REVIEW';
  return {
    key: item.key,
    label: item.label,
    expectedRegistryIds: item.registryIds,
    registryEntries: entries,
    productionCount: production.length,
    reviewCount: review.length,
    evidenceFiles,
    coverageStatus,
    target: item.target
  };
});

const existingRequired = [
  '10304-driven',
  '10304-end-bearing-rock',
  '10304-bored-raw',
  '10304-spt-raw',
  '10304-spt-summary-explicit',
  ...supportWorkflows
];

const existingFailures = existingRequired.filter(id => {
  const e = parseRegistryEntry(id);
  return !e || !e.productionNumeric || !['LOCKED', 'VERIFIED'].includes(e.status);
});

const searchHash = exists('src/search.js') ? normalizeHash('src/search.js') : null;
const lockedSearchHash = 'f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2';
const searchLocked = searchHash === lockedSearchHash;
const versionOk = String(packageJson.version) === '1.27.0';

const report = {
  schema: 'HNL_P5_CALCULATION_COVERAGE_AUDIT_V1',
  generatedAt: new Date().toISOString(),
  appVersion: packageJson.version,
  safety: {
    searchBrainExpected: '1.9.23 LOCKED',
    searchHash,
    searchLocked,
    calculationRegistryExistingFailures: existingFailures,
    versionOk
  },
  summary: {
    roadmapCount: rows.length,
    productionCovered: rows.filter(r => r.coverageStatus === 'PRODUCTION_LOCKED_OR_VERIFIED').length,
    partialOrReview: rows.filter(r => r.coverageStatus === 'PARTIAL_OR_REVIEW').length,
    missingProductionGate: rows.filter(r => r.coverageStatus === 'MISSING_PRODUCTION_GATE').length
  },
  rows,
  nextOrder: [
    'P5.2 CPT',
    'P5.3 Static load test',
    'P5.4 Single-pile settlement',
    'P5.5 Pile-group settlement + equivalent block',
    'P5.6 Screw pile',
    'P5.7 Dynamic/PDA',
    'P5.8 Piled raft',
    'P5.9 Full cross-workflow Golden + Excel parity + release gate'
  ]
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'coverage.json'), JSON.stringify(report, null, 2) + '\n');

const md = [];
md.push('# HNL P5 — Full Calculation Coverage Audit');
md.push('');
md.push(`Generated: ${report.generatedAt}`);
md.push(`Version: ${report.appVersion}`);
md.push(`Search Brain hash lock: ${searchLocked ? 'PASS' : 'FAIL'}`);
md.push(`Existing Production registry gate: ${existingFailures.length ? 'FAIL: ' + existingFailures.join(', ') : 'PASS'}`);
md.push('');
md.push('| Workflow | Coverage | Registry | Source evidence |');
md.push('|---|---|---|---|');
for (const row of rows) {
  const reg = row.registryEntries.length ? row.registryEntries.map(e => `${e.id}:${e.status}/${e.productionNumeric ? 'PROD' : 'NONPROD'}`).join('<br>') : '—';
  const ev = row.evidenceFiles.length ? row.evidenceFiles.join('<br>') : '—';
  md.push(`| ${row.label} | ${row.coverageStatus} | ${reg} | ${ev} |`);
}
md.push('');
md.push('## Rule');
md.push('MISSING/PARTIAL is a roadmap finding, not a release failure. The gate fails only if an already-certified Production workflow regresses, the Search Brain lock changes, or the product version identity drifts.');
md.push('');
md.push('## Recommended implementation order');
for (const x of report.nextOrder) md.push(`- ${x}`);
md.push('');
fs.writeFileSync(path.join(outDir, 'coverage.md'), md.join('\n'));

console.log(JSON.stringify(report.summary));
console.log(`P5 existing Production lock: ${existingFailures.length ? 'FAIL' : 'PASS'}`);
console.log(`Search Brain lock: ${searchLocked ? 'PASS' : 'FAIL'}`);

if (enforceExisting && (!searchLocked || !versionOk || existingFailures.length)) process.exit(1);
