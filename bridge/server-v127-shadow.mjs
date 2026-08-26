import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startPdfIntelligenceShadowServer } from './pdf-intelligence-shadow-server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const mainServerFile = path.join(here, 'server.mjs');
const basePort = Number(process.env.PORT || 8787);
const shadowPort = Number(process.env.HNL_PDF_SHADOW_PORT || (basePort + 1000));
let shuttingDown = false;
let shadow = null;

// Shadow is best-effort by design. Failure to bind or missing DeepDoc must never
// prevent the v1.26 Production Bridge from starting.
try {
  shadow = await startPdfIntelligenceShadowServer({ port: shadowPort });
} catch (error) {
  console.warn(`[P3.1 shadow] service unavailable: ${error?.message || error}`);
}

const main = spawn(process.execPath, [mainServerFile], {
  cwd: root,
  windowsHide: true,
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: process.env.ELECTRON_RUN_AS_NODE || '1',
    PORT: String(basePort)
  },
  stdio: 'inherit'
});

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  try { main.kill(); } catch { /* noop */ }
  try { await shadow?.close?.(); } catch { /* noop */ }
  setTimeout(() => process.exit(code), 40).unref?.();
}

main.on('error', error => {
  console.error(`[HNL bridge] ${error?.stack || error?.message || error}`);
  shutdown(2).catch(() => process.exit(2));
});
main.on('exit', (code, signal) => {
  if (shuttingDown) return;
  if (signal) console.warn(`[HNL bridge] exited by ${signal}`);
  shutdown(Number.isInteger(code) ? code : 1).catch(() => process.exit(1));
});

process.on('SIGTERM', () => { shutdown(0).catch(() => process.exit(0)); });
process.on('SIGINT', () => { shutdown(0).catch(() => process.exit(0)); });
