import { safeError } from './contracts.js';

function nodeRuntime() {
  return typeof process !== 'undefined' && Boolean(process?.versions?.node);
}

function defaultPython() {
  if (!nodeRuntime()) return { command: null, args: [] };
  const explicit = String(process.env.HNL_PYTHON || '').trim();
  if (explicit) return { command: explicit, args: [] };
  return process.platform === 'win32' ? { command: 'py', args: ['-3'] } : { command: 'python3', args: [] };
}

function normalizeBbox(value) {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const out = value.map(Number);
  return out.every(Number.isFinite) ? out : null;
}

export function normalizeDeepDocResult(raw = {}) {
  const pages = Array.isArray(raw.pages) ? raw.pages.map(page => ({
    page: Number(page?.page || 0),
    width: Number(page?.width || 0) || null,
    height: Number(page?.height || 0) || null,
    text: String(page?.text || ''),
    ocrLines: Array.isArray(page?.ocrLines) ? page.ocrLines.map(line => ({
      text: String(line?.text || ''),
      bbox: normalizeBbox(line?.bbox),
      score: Number.isFinite(Number(line?.score)) ? Number(line.score) : null,
      scoreSemantics: String(line?.scoreSemantics || 'synthetic-current-deepdoc-vietocr')
    })) : [],
    layouts: Array.isArray(page?.layouts) ? page.layouts.map(region => ({
      type: String(region?.type || region?.label || 'unknown'),
      bbox: normalizeBbox(region?.bbox),
      score: Number.isFinite(Number(region?.score)) ? Number(region.score) : null
    })) : [],
    tableStructures: Array.isArray(page?.tableStructures) ? page.tableStructures : []
  })) : [];

  const textChars = pages.reduce((sum, page) => sum + page.text.length, 0);
  const layoutCounts = {};
  let tableRegionCount = 0;
  let equationRegionCount = 0;
  for (const page of pages) {
    for (const region of page.layouts) {
      const key = region.type.toLowerCase();
      layoutCounts[key] = (layoutCounts[key] || 0) + 1;
      if (key === 'table') tableRegionCount++;
      if (key === 'equation') equationRegionCount++;
    }
  }

  return {
    engine: 'deepdoc-vietocr-external',
    sourcePageCount: Number(raw.sourcePageCount || raw.pageCount || 0),
    processedPages: pages.map(page => page.page).filter(Boolean),
    textChars,
    pages,
    layoutCounts,
    tableRegionCount,
    equationRegionCount,
    elapsedMs: Number.isFinite(Number(raw.elapsedMs)) ? Number(raw.elapsedMs) : null,
    threshold: Number.isFinite(Number(raw.threshold)) ? Number(raw.threshold) : null,
    recognizerConfidenceUsable: false,
    recognizerConfidenceReason: 'Current deepdoc_vietocr TextRecognizer returns score=1.0 for recognized text; HNL must not treat it as calibrated confidence.',
    licenseState: 'REVIEW_EXTERNAL_REPO_NO_ROOT_LICENSE_VERIFIED',
    rawMeta: raw.meta || null
  };
}

async function resolveRunnerPath(explicit) {
  if (explicit) return explicit;
  const { fileURLToPath } = await import('node:url');
  const path = await import('node:path');
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../offline/pdf-intelligence/deepdoc_vietocr_runner.py');
}

async function runProcess(command, args, { timeoutMs = 15 * 60 * 1000, cwd, env } = {}) {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...(env || {}) }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      const err = new Error(`DeepDoc runner timeout after ${timeoutMs} ms.`);
      err.code = 'DEEPOCR_TIMEOUT';
      reject(err);
    }, timeoutMs);
    child.stdout.on('data', chunk => { stdout += String(chunk); });
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => {
      clearTimeout(timer);
      if (code === 0) return resolve({ stdout, stderr, code });
      const err = new Error(`DeepDoc runner exited ${code}: ${(stderr || stdout).slice(-3000)}`);
      err.code = 'DEEPOCR_RUNNER_FAILED';
      err.exitCode = code;
      reject(err);
    });
  });
}

export async function createDeepDocVietOcrAdapter({
  deepdocHome = nodeRuntime() ? process.env.HNL_DEEPDOC_HOME : null,
  runnerPath,
  python,
  timeoutMs = 15 * 60 * 1000
} = {}) {
  if (!nodeRuntime()) {
    return {
      available: false,
      runtime: 'browser',
      capabilities: { ocr: false, layout: false, tableStructure: false, selectivePages: false },
      error: { code: 'NODE_ONLY', message: 'DeepDoc/VietOCR adapter is Desktop/Node-only in v1.27 shadow mode.' }
    };
  }

  const path = await import('node:path');
  const fs = await import('node:fs/promises');
  const py = python ? { command: python, args: [] } : defaultPython();
  const resolvedRunner = await resolveRunnerPath(runnerPath);
  const resolvedHome = deepdocHome ? path.resolve(deepdocHome) : null;

  async function probe() {
    if (!resolvedHome) return { available: false, code: 'HNL_DEEPDOC_HOME_NOT_SET', message: 'Set HNL_DEEPDOC_HOME to an external deepdoc_vietocr clone.' };
    try {
      await fs.access(resolvedRunner);
      await fs.access(path.join(resolvedHome, 'module', '__init__.py'));
      const args = [...py.args, resolvedRunner, '--probe', '--deepdoc-home', resolvedHome];
      const result = await runProcess(py.command, args, { timeoutMs: Math.min(timeoutMs, 60_000) });
      const payload = JSON.parse(result.stdout.trim() || '{}');
      return { available: Boolean(payload.available), ...payload };
    } catch (error) {
      return { available: false, ...safeError(error) };
    }
  }

  const health = await probe();
  return {
    available: Boolean(health.available),
    runtime: 'node',
    engine: 'deepdoc-vietocr-external',
    deepdocHome: resolvedHome,
    runnerPath: resolvedRunner,
    python: py,
    health,
    capabilities: {
      ocr: Boolean(health.available),
      vietnameseRecognition: Boolean(health.available),
      layout: Boolean(health.available),
      tableStructure: Boolean(health.available),
      selectivePages: Boolean(health.available),
      calibratedOcrConfidence: false
    },
    async process(bytes, {
      fileName = 'document.pdf',
      pages = [],
      threshold = 0.5,
      tableStructure = true,
      dpi = 216
    } = {}) {
      if (!health.available) {
        const error = new Error(health.message || 'DeepDoc/VietOCR external runtime is unavailable.');
        error.code = health.code || 'DEEPOCR_UNAVAILABLE';
        throw error;
      }
      const os = await import('node:os');
      const crypto = await import('node:crypto');
      const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hnl-deepdoc-'));
      const safeName = String(fileName || 'document.pdf').replace(/[^A-Za-z0-9._-]+/g, '_');
      const inputPath = path.join(tempRoot, safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`);
      const outputPath = path.join(tempRoot, 'result.json');
      try {
        const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        await fs.writeFile(inputPath, array);
        const args = [
          ...py.args,
          resolvedRunner,
          '--deepdoc-home', resolvedHome,
          '--input', inputPath,
          '--output-json', outputPath,
          '--threshold', String(threshold),
          '--dpi', String(dpi)
        ];
        if (Array.isArray(pages) && pages.length) args.push('--pages', pages.map(Number).filter(Number.isFinite).join(','));
        if (!tableStructure) args.push('--no-tsr');
        await runProcess(py.command, args, { timeoutMs });
        const raw = JSON.parse(await fs.readFile(outputPath, 'utf8'));
        return {
          ...normalizeDeepDocResult(raw),
          inputSha256: crypto.createHash('sha256').update(array).digest('hex')
        };
      } finally {
        await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
      }
    }
  };
}
