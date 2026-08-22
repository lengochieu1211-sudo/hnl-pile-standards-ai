import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function git(args, fallback = '') {
  try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return fallback; }
}

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const target = arg('target', process.env.VITE_HNL_EDITION || 'web');
const output = path.resolve(arg('output', 'dist/build-info.json'));
const github = String(process.env.GITHUB_ACTIONS || '').toLowerCase() === 'true';
const repository = process.env.GITHUB_REPOSITORY || git(['config', '--get', 'remote.origin.url'])
  .replace(/^.*github\.com[:/]/, '').replace(/\.git$/, '');
const sha = process.env.GITHUB_SHA || git(['rev-parse', 'HEAD']);
const branch = process.env.GITHUB_REF_NAME || git(['rev-parse', '--abbrev-ref', 'HEAD'], 'local');
const runNumber = process.env.GITHUB_RUN_NUMBER || '';
const runAttempt = process.env.GITHUB_RUN_ATTEMPT || '';
const runId = process.env.GITHUB_RUN_ID || '';
const server = process.env.GITHUB_SERVER_URL || 'https://github.com';
const builtAt = new Date().toISOString();

const info = {
  schema: 1,
  app: 'HNL Pile Standards AI',
  version: pkg.version,
  target,
  edition: target === 'desktop' ? 'HNL Desktop AI' : 'HNL Web',
  builtAt,
  source: github ? 'GitHub Actions' : 'Local build',
  runNumber: runNumber ? Number(runNumber) : null,
  runAttempt: runAttempt ? Number(runAttempt) : null,
  runId: runId || null,
  repository: repository || null,
  branch: branch || null,
  commit: sha || null,
  commitShort: sha ? sha.slice(0, 7) : null,
  workflowUrl: github && repository && runId ? `${server}/${repository}/actions/runs/${runId}` : null,
  release: 'Build Metadata · Update Diagnostics · PWA Freshness'
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(info, null, 2)}\n`, 'utf8');
console.log(`HNL build metadata -> ${output}`);
console.log(`${info.version} · ${info.edition} · ${info.source} · ${info.builtAt}`);
