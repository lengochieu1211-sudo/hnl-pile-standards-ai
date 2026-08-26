import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { inspectWithHnlPdfJs } from '../src/pdf-intelligence/hnl-pdfjs-baseline.js';
import { createDeepDocVietOcrAdapter } from '../src/pdf-intelligence/deepdoc-vietocr-adapter.js';
import { safeError } from '../src/pdf-intelligence/contracts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const out = { files: [], output: path.join(ROOT, 'artifacts/pdf-intelligence/deepdoc-vietocr-shadow.json'), maxPages: 30, threshold: 0.5, dpi: 216 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') out.output = path.resolve(argv[++i]);
    else if (arg === '--dir') out.dir = path.resolve(argv[++i]);
    else if (arg === '--deepdoc-home') out.deepdocHome = path.resolve(argv[++i]);
    else if (arg === '--probe') (out.probes ||= []).push(String(argv[++i] || ''));
    else if (arg === '--max-pages') out.maxPages = Math.max(1, Number(argv[++i] || 30));
    else if (arg === '--threshold') out.threshold = Number(argv[++i] || 0.5);
    else if (arg === '--dpi') out.dpi = Number(argv[++i] || 216);
    else if (arg === '--force-all') out.forceAll = true;
    else if (arg === '--no-tsr') out.tableStructure = false;
    else out.files.push(path.resolve(arg));
  }
  return out;
}

async function collectPdfs(args) {
  const files = [...args.files];
  if (args.dir) {
    const stack = [args.dir];
    while (stack.length) {
      const current = stack.pop();
      for (const entry of await fs.readdir(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else if (/\.pdf$/i.test(entry.name)) files.push(full);
      }
    }
  }
  return [...new Set(files.filter(file => /\.pdf$/i.test(file)))].sort();
}

function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function normalizeSearch(text) {
  return String(text || '').toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
}
function probeCoverage(text, probes = []) {
  const haystack = normalizeSearch(text);
  return probes.map(probe => ({ probe, found: haystack.includes(normalizeSearch(probe)) }));
}
function textStats(text) {
  const raw = String(text || '');
  return {
    chars: raw.length,
    words: raw.trim() ? raw.trim().split(/\s+/).length : 0,
    replacementChars: (raw.match(/�/g) || []).length,
    vietnameseMarkedChars: (raw.match(/[À-ỹĐđ]/g) || []).length,
    digits: (raw.match(/\d/g) || []).length,
    engineeringSymbols: (raw.match(/[γΓΣ∑ηφΦ≤≥±√]/g) || []).length
  };
}

async function inspectOne(file, adapter, args) {
  const bytes = new Uint8Array(await fs.readFile(file));
  const record = {
    file: path.relative(ROOT, file).replaceAll('\\', '/'),
    sha256: sha256(bytes),
    sizeBytes: bytes.byteLength,
    baseline: null,
    deepdoc: null,
    routing: null,
    status: 'REVIEW'
  };
  try {
    const baseline = await inspectWithHnlPdfJs(bytes.slice());
    record.baseline = {
      pageCount: baseline.pageCount,
      pdfType: baseline.pdfType,
      scannedLikely: baseline.scannedLikely,
      usablePages: baseline.usablePages,
      pagesNeedingOcr: baseline.pagesNeedingOcr,
      textChars: baseline.textChars,
      elapsedMs: baseline.elapsedMs,
      probes: probeCoverage(baseline.pages.map(page => page.text).join('\n'), args.probes || [])
    };
    const allPages = Array.from({ length: baseline.pageCount }, (_, i) => i + 1);
    const requested = (args.forceAll ? allPages : baseline.pagesNeedingOcr).slice(0, args.maxPages);
    record.routing = {
      policy: args.forceAll ? 'FORCE_ALL_BENCHMARK_ONLY' : 'HNL_SELECTIVE_DEFICIENT_PAGES_ONLY',
      requestedPages: requested,
      cappedAt: args.maxPages,
      productionMutationAllowed: false
    };
    if (!requested.length) {
      record.status = 'SKIP_NATIVE_TEXT_GOOD';
      return record;
    }
    if (!adapter.available) {
      record.deepdoc = { status: 'DEPENDENCY_NOT_INSTALLED', health: adapter.health };
      record.status = 'BLOCK_EXTERNAL_RUNTIME';
      return record;
    }
    const result = await adapter.process(bytes.slice(), {
      fileName: path.basename(file),
      pages: requested,
      threshold: args.threshold,
      tableStructure: args.tableStructure !== false,
      dpi: args.dpi
    });
    const ocrText = result.pages.map(page => page.text).join('\n');
    record.deepdoc = {
      status: 'MEASURED',
      sourcePageCount: result.sourcePageCount,
      processedPages: result.processedPages,
      textChars: result.textChars,
      elapsedMs: result.elapsedMs,
      layoutCounts: result.layoutCounts,
      tableRegionCount: result.tableRegionCount,
      equationRegionCount: result.equationRegionCount,
      recognizerConfidenceUsable: result.recognizerConfidenceUsable,
      textStats: textStats(ocrText),
      probes: probeCoverage(ocrText, args.probes || []),
      pageEvidence: result.pages.map(page => ({
        page: page.page,
        ocrLineCount: page.ocrLines.length,
        layoutCount: page.layouts.length,
        tableStructureCount: page.tableStructures.length,
        textStats: textStats(page.text)
      }))
    };
    record.status = result.sourcePageCount === baseline.pageCount ? 'MEASURED_SHADOW' : 'REVIEW_PAGE_COUNT_MISMATCH';
  } catch (error) {
    record.status = 'BLOCK_ENGINE';
    record.error = safeError(error);
  }
  return record;
}

function summarize(records, adapter) {
  const measured = records.filter(record => record.status === 'MEASURED_SHADOW');
  const skipped = records.filter(record => record.status === 'SKIP_NATIVE_TEXT_GOOD');
  const blocked = records.filter(record => record.status.startsWith('BLOCK'));
  const tableDocs = measured.filter(record => Number(record.deepdoc?.tableRegionCount) > 0).length;
  const equationDocs = measured.filter(record => Number(record.deepdoc?.equationRegionCount) > 0).length;
  const enoughCorpus = records.length >= 6;
  return {
    corpusCount: records.length,
    measuredCount: measured.length,
    nativeTextSkippedCount: skipped.length,
    blockedCount: blocked.length,
    tableDocs,
    equationDocs,
    externalRuntimeAvailable: adapter.available,
    enoughCorpus,
    productionPromotionEligible: false,
    decision: !adapter.available ? 'BLOCK_EXTERNAL_RUNTIME_NOT_INSTALLED' : (!enoughCorpus ? 'REVIEW_CORPUS_TOO_SMALL' : 'REVIEW_GOLDEN_AND_LICENSE_REQUIRED'),
    hardBlocksBeforePromotion: [
      'External repository/license/model provenance review',
      'Real TCVN scan/mixed corpus Golden',
      'Vietnamese OCR phrase/number accuracy benchmark',
      'Table reconstruction Golden',
      'Equation/formula extraction Golden',
      'Windows sidecar packaging/performance certification',
      'No Search Brain or Calculation Engine regression'
    ]
  };
}

const args = parseArgs(process.argv.slice(2));
const files = await collectPdfs(args);
const adapter = await createDeepDocVietOcrAdapter({ deepdocHome: args.deepdocHome });
const records = [];
for (const file of files) {
  console.log(`[DEEPOCR-SHADOW] ${path.basename(file)}`);
  records.push(await inspectOne(file, adapter, args));
}
const report = {
  schemaVersion: 1,
  project: 'HNL Pile Standards AI',
  track: 'v1.27.0 PDF Intelligence Engine · DeepDoc/VietOCR Shadow',
  generatedAt: new Date().toISOString(),
  productionDefaultChanged: false,
  searchBrainChanged: false,
  calculationEngineChanged: false,
  thirdPartyCodeBundled: false,
  licenseState: 'REVIEW_EXTERNAL_REPO_NO_ROOT_LICENSE_VERIFIED',
  adapter: {
    available: adapter.available,
    runtime: adapter.runtime,
    engine: adapter.engine,
    health: adapter.health,
    capabilities: adapter.capabilities
  },
  probes: args.probes || [],
  summary: summarize(records, adapter),
  records
};
await fs.mkdir(path.dirname(args.output), { recursive: true });
await fs.writeFile(args.output, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report.summary, null, 2));
console.log(`Report: ${args.output}`);
if (!files.length) process.exitCode = 2;
