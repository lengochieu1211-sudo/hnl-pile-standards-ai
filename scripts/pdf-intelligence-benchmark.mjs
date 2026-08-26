import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { inspectWithHnlPdfJs } from '../src/pdf-intelligence/hnl-pdfjs-baseline.js';
import { createFirecrawlPdfInspector } from '../src/pdf-intelligence/firecrawl-adapter.js';
import { compareClassifications, safeError } from '../src/pdf-intelligence/contracts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const out = { files: [], output: path.join(ROOT, 'artifacts/pdf-intelligence/p0-benchmark.json') };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') out.output = path.resolve(argv[++i]);
    else if (arg === '--dir') out.dir = path.resolve(argv[++i]);
    else if (arg === '--probe') (out.probes ||= []).push(String(argv[++i] || ''));
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

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function normalizeSearch(text) {
  return String(text || '').toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ');
}

function probeCoverage(text, probes = []) {
  const haystack = normalizeSearch(text);
  return probes.map(probe => ({ probe, found: haystack.includes(normalizeSearch(probe)) }));
}

async function inspectOne(file, adapter, probes) {
  const bytes = new Uint8Array(await fs.readFile(file));
  const record = {
    file: path.relative(ROOT, file).replaceAll('\\', '/'),
    absoluteFile: file,
    sha256: sha256(bytes),
    sizeBytes: bytes.byteLength,
    hnl: null,
    firecrawl: null,
    comparison: null,
    status: 'REVIEW'
  };
  try {
    const hnl = await inspectWithHnlPdfJs(bytes.slice());
    record.hnl = {
      engine: hnl.engine,
      pageCount: hnl.pageCount,
      pdfType: hnl.pdfType,
      scannedLikely: hnl.scannedLikely,
      usablePages: hnl.usablePages,
      pagesNeedingOcr: hnl.pagesNeedingOcr,
      textChars: hnl.textChars,
      elapsedMs: hnl.elapsedMs,
      probes: probeCoverage(hnl.pages.map(page => page.text).join('\n'), probes)
    };
  } catch (error) {
    record.hnl = { status: 'ERROR', error: safeError(error) };
  }

  if (!adapter.available) {
    record.firecrawl = { status: 'DEPENDENCY_NOT_INSTALLED', packageName: adapter.packageName, error: adapter.error };
    record.status = 'BLOCK_DEPENDENCY';
    return record;
  }

  try {
    const started = performance.now();
    const classification = await adapter.classify(bytes.slice());
    const processed = await adapter.process(bytes.slice());
    const elapsedMs = performance.now() - started;
    record.firecrawl = {
      status: 'OK',
      ...classification,
      markdownChars: processed.markdown.length,
      elapsedMs: Number(elapsedMs.toFixed(3)),
      probes: probeCoverage(processed.markdown, probes)
    };
    if (record.hnl?.pageCount) record.comparison = compareClassifications(record.hnl, record.firecrawl);
    record.status = record.comparison?.pageCountMatch ? 'MEASURED' : 'REVIEW_PAGE_COUNT';
  } catch (error) {
    record.firecrawl = { status: 'ERROR', error: safeError(error) };
    record.status = 'BLOCK_ENGINE';
  }
  return record;
}

function summarize(records, adapter) {
  const measured = records.filter(r => r.status === 'MEASURED');
  const pageCountMatches = measured.filter(r => r.comparison?.pageCountMatch).length;
  const typeMatches = measured.filter(r => r.comparison?.typeMatch).length;
  const faster = measured.filter(r => Number(r.firecrawl?.elapsedMs) < Number(r.hnl?.elapsedMs)).length;
  const enoughCorpus = records.length >= 6;
  const mixedCoverage = new Set(measured.map(r => r.firecrawl?.pdfType)).size >= 2;
  return {
    corpusCount: records.length,
    measuredCount: measured.length,
    pageCountMatches,
    typeMatches,
    firecrawlFasterCount: faster,
    firecrawlAvailable: adapter.available,
    enoughCorpus,
    mixedPdfTypeCoverage: mixedCoverage,
    promotionEligible: Boolean(adapter.available && enoughCorpus && mixedCoverage && measured.length === records.length && pageCountMatches === measured.length),
    decision: adapter.available ? (enoughCorpus ? 'REVIEW_GOLDEN_REQUIRED' : 'BLOCK_CORPUS_TOO_SMALL') : 'BLOCK_DEPENDENCY_NOT_INSTALLED'
  };
}

const args = parseArgs(process.argv.slice(2));
const files = await collectPdfs(args);
const adapter = await createFirecrawlPdfInspector({ runtime: 'node' });
const records = [];
for (const file of files) {
  console.log(`[PDF-INTEL] ${path.basename(file)}`);
  records.push(await inspectOne(file, adapter, args.probes || []));
}
const report = {
  schemaVersion: 1,
  project: 'HNL Pile Standards AI',
  track: 'v1.27.0 PDF Intelligence Engine P0/P1 Shadow',
  productionDefaultChanged: false,
  searchBrainChanged: false,
  generatedAt: new Date().toISOString(),
  adapter: { available: adapter.available, runtime: adapter.runtime, packageName: adapter.packageName, capabilities: adapter.capabilities, error: adapter.error || null },
  probes: args.probes || [],
  summary: summarize(records, adapter),
  records
};
await fs.mkdir(path.dirname(args.output), { recursive: true });
await fs.writeFile(args.output, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report.summary, null, 2));
console.log(`Report: ${args.output}`);
if (!files.length) process.exitCode = 2;
