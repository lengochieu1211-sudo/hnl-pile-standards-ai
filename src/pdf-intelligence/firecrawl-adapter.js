import { normalizePdfType, safeError } from './contracts.js';

const NODE_PACKAGE = '@firecrawl/pdf-inspector';
const WASM_PACKAGE = '@firecrawl/pdf-inspector-wasm';
let wasmInitPromise = null;

function runtimeKind(requested = 'auto') {
  if (requested === 'node' || requested === 'browser') return requested;
  return typeof window === 'undefined' || typeof document === 'undefined' ? 'node' : 'browser';
}

async function optionalImport(specifier) {
  // Keep the experimental adapter completely outside the v1.26 production
  // dependency graph. Vite/Node resolves it only when shadow mode is invoked.
  return import(/* @vite-ignore */ specifier);
}

async function loadNodeModule() {
  const mod = await optionalImport(NODE_PACKAGE);
  if (typeof mod.classifyPdf !== 'function' || typeof mod.processPdf !== 'function') {
    throw new Error(`${NODE_PACKAGE} does not expose classifyPdf/processPdf.`);
  }
  return mod;
}

async function loadWasmModule() {
  const mod = await optionalImport(WASM_PACKAGE);
  if (!wasmInitPromise) {
    wasmInitPromise = typeof mod.default === 'function' ? Promise.resolve(mod.default()) : Promise.resolve();
  }
  await wasmInitPromise;
  if (typeof mod.classifyPdf !== 'function' || typeof mod.processPdf !== 'function') {
    throw new Error(`${WASM_PACKAGE} does not expose classifyPdf/processPdf.`);
  }
  return mod;
}

function asUint8Array(bytes) {
  if (bytes instanceof Uint8Array) return bytes;
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
  if (ArrayBuffer.isView(bytes)) return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  throw new TypeError('PDF bytes must be ArrayBuffer or Uint8Array.');
}

function asNodeBuffer(bytes) {
  const array = asUint8Array(bytes);
  if (typeof Buffer === 'undefined') return array;
  return Buffer.from(array.buffer, array.byteOffset, array.byteLength);
}

function normalizeClassification(raw = {}) {
  return {
    engine: 'firecrawl-pdf-inspector',
    pdfType: normalizePdfType(raw.pdfType),
    pageCount: Number(raw.pageCount || 0),
    pagesNeedingOcr: [...(raw.pagesNeedingOcr || raw.pages_needing_ocr || [])].map(Number),
    confidence: Number.isFinite(Number(raw.confidence)) ? Number(raw.confidence) : null
  };
}

export async function createFirecrawlPdfInspector({ runtime = 'auto' } = {}) {
  const kind = runtimeKind(runtime);
  try {
    const mod = kind === 'node' ? await loadNodeModule() : await loadWasmModule();
    return {
      available: true,
      runtime: kind,
      packageName: kind === 'node' ? NODE_PACKAGE : WASM_PACKAGE,
      capabilities: {
        classification: true,
        markdown: true,
        regionExtraction: kind === 'node' && typeof mod.extractTextInRegions === 'function',
        selectiveOcr: kind === 'node' && typeof mod.processPdfWithOcr === 'function'
      },
      async classify(bytes) {
        const input = kind === 'node' ? asNodeBuffer(bytes) : asUint8Array(bytes);
        return normalizeClassification(mod.classifyPdf(input));
      },
      async process(bytes, options) {
        const input = kind === 'node' ? asNodeBuffer(bytes) : asUint8Array(bytes);
        const raw = mod.processPdf(input, options);
        const value = raw && typeof raw.then === 'function' ? await raw : raw;
        return {
          engine: 'firecrawl-pdf-inspector',
          pdfType: normalizePdfType(value?.pdfType),
          pageCount: Number(value?.pageCount || 0),
          markdown: String(value?.markdown || ''),
          pagesNeedingOcr: [...(value?.pagesNeedingOcr || value?.pagesRecommendedForOcr || [])].map(Number),
          processingTimeMs: Number.isFinite(Number(value?.processingTimeMs)) ? Number(value.processingTimeMs) : null,
          raw: value
        };
      },
      async extractRegions(bytes, pageRegions) {
        if (typeof mod.extractTextInRegions !== 'function') {
          return { supported: false, reason: 'REGION_EXTRACTION_UNAVAILABLE_IN_RUNTIME' };
        }
        const input = kind === 'node' ? asNodeBuffer(bytes) : asUint8Array(bytes);
        return { supported: true, result: mod.extractTextInRegions(input, pageRegions) };
      }
    };
  } catch (error) {
    return {
      available: false,
      runtime: kind,
      packageName: kind === 'node' ? NODE_PACKAGE : WASM_PACKAGE,
      capabilities: { classification: false, markdown: false, regionExtraction: false, selectiveOcr: false },
      error: safeError(error)
    };
  }
}
