import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const basePort = 18887;
const shadowPort = 19887;
const child = spawn(process.execPath, ['bridge/server-v127-shadow.mjs'], {
  env: {
    ...process.env,
    PORT: String(basePort),
    HNL_PDF_SHADOW_PORT: String(shadowPort),
    HNL_DEEPDOC_HOME: ''
  },
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe']
});
let output = '';
child.stdout.on('data', chunk => { output += String(chunk); });
child.stderr.on('data', chunk => { output += String(chunk); });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitJson(url, timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1200) });
      if (response.ok) return await response.json();
    } catch (error) { lastError = error; }
    await sleep(180);
  }
  throw new Error(`Timeout waiting ${url}: ${lastError?.message || output.slice(-2000)}`);
}

async function stop() {
  if (child.exitCode != null) return;
  try { child.kill(); } catch {}
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    sleep(2500)
  ]);
  if (child.exitCode == null) {
    try { child.kill('SIGKILL'); } catch {}
  }
}

try {
  const production = await waitJson(`http://127.0.0.1:${basePort}/api/health`);
  assert.equal(production.ok, true);
  assert.equal(production.service, 'HNL AI Bridge');

  const shadow = await waitJson(`http://127.0.0.1:${shadowPort}/api/health`);
  assert.equal(shadow.ok, true);
  assert.equal(shadow.service, 'HNL PDF Intelligence Shadow');
  assert.equal(shadow.promotionState, 'SHADOW_ONLY');
  assert.equal(shadow.productionMutationAllowed, false);

  const response = await fetch(`http://127.0.0.1:${shadowPort}/api/pdf-intelligence/region-ocr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: { mimeType: 'image/jpeg', data: 'AA==' }, page: 7, fingerprint: 'runtime-smoke' })
  });
  assert.equal(response.ok, true);
  const unavailable = await response.json();
  assert.equal(unavailable.available, false);
  assert.equal(unavailable.promotionState, 'SHADOW_ONLY');
  assert.equal(unavailable.productionMutationAllowed, false);
  assert.match(String(unavailable.code || ''), /HNL_DEEPDOC_HOME_NOT_SET|DEEPOCR_UNAVAILABLE/);

  console.log('PDF INTELLIGENCE P3.1 SHADOW RUNTIME SMOKE: PASS · Production Bridge + Shadow service + controlled DeepDoc fallback');
} finally {
  await stop();
}
