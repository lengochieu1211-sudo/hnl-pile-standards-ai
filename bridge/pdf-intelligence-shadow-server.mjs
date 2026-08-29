import express from 'express';
import cors from 'cors';
import { pathToFileURL } from 'node:url';
import { runDeepDocRegionOcr } from '../src/pdf-intelligence/deepdoc-region-bridge.js';

const MAX_BASE64_CHARS = 16 * 1024 * 1024;

function allowLocalOrigin(origin, callback) {
  if (!origin || origin === 'null') return callback(null, true);
  try {
    const url = new URL(origin);
    if (['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) return callback(null, true);
  } catch { /* invalid origin */ }
  return callback(new Error('P3.1 Shadow chỉ cho phép HNL localhost/Desktop.'));
}

function safeNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export async function startPdfIntelligenceShadowServer({
  port = Number(process.env.HNL_PDF_SHADOW_PORT || (Number(process.env.PORT || 8787) + 1000)),
  host = '127.0.0.1'
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: allowLocalOrigin }));
  app.use(express.json({ limit: '18mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'HNL PDF Intelligence Shadow',
      version: 'v1.27.0-P3.1',
      promotionState: 'SHADOW_ONLY',
      productionMutationAllowed: false,
      deepdocConfigured: Boolean(String(process.env.HNL_DEEPDOC_HOME || '').trim())
    });
  });

  app.post('/api/pdf-intelligence/region-ocr', async (req, res) => {
    const image = req.body?.image || {};
    const mimeType = String(image?.mimeType || '').toLowerCase();
    const data = String(image?.data || '');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType) || !data) {
      return res.status(400).json({
        available: false,
        code: 'REGION_IMAGE_REQUIRED',
        message: 'P3.1 cần ảnh crop JPEG/PNG/WebP của đúng vùng đã chọn.',
        promotionState: 'SHADOW_ONLY',
        productionMutationAllowed: false
      });
    }
    if (data.length > MAX_BASE64_CHARS) {
      return res.status(413).json({
        available: false,
        code: 'REGION_IMAGE_TOO_LARGE',
        message: 'Ảnh crop vượt giới hạn Shadow.',
        promotionState: 'SHADOW_ONLY',
        productionMutationAllowed: false
      });
    }

    try {
      const result = await runDeepDocRegionOcr(image, {
        deepdocHome: String(process.env.HNL_DEEPDOC_HOME || '').trim() || undefined,
        threshold: safeNumber(req.body?.threshold, 0.5, 0.05, 0.95),
        tableStructure: req.body?.tableStructure !== false,
        dpi: Math.round(safeNumber(req.body?.dpi, 216, 96, 360))
      });
      // Unavailable DeepDoc is a controlled shadow state. Return HTTP 200 so
      // the browser router can continue to Local OCR/Vision without treating it
      // as a Production Bridge failure.
      return res.status(200).json({
        ...result,
        page: Number(req.body?.page || 0),
        fingerprint: req.body?.fingerprint || null,
        regionKind: String(req.body?.regionKind || 'auto'),
        promotionState: 'SHADOW_ONLY',
        productionMutationAllowed: false
      });
    } catch (error) {
      return res.status(200).json({
        available: false,
        code: error?.code || 'DEEPOCR_SHADOW_FAILED',
        message: String(error?.message || error),
        page: Number(req.body?.page || 0),
        fingerprint: req.body?.fingerprint || null,
        promotionState: 'SHADOW_ONLY',
        productionMutationAllowed: false
      });
    }
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      console.log(`HNL PDF Intelligence Shadow: http://${host}:${port}`);
      resolve({ app, server, port, host, close: () => new Promise(done => server.close(() => done())) });
    });
    server.once('error', reject);
  });
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  startPdfIntelligenceShadowServer().catch(error => {
    console.error(`HNL_PDF_SHADOW_START_FAILED ${error?.stack || error?.message || error}`);
    process.exitCode = 2;
  });
}
