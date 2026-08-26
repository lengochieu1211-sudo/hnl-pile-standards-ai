import { spawnSync } from 'node:child_process';
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// HNL v1.26.0 · Master Audit P0 repair
// Deterministic exact-574 regression certification.
// Production rule: never skip a test and never lower the locked count.
// If the suite fails, isolate the exact test file and preserve full TAP evidence.

const root = process.cwd();
const maxBuffer = 64 * 1024 * 1024;
const diagnosticDir = path.join(root, 'artifacts', 'master-audit');
const diagnosticFile = path.join(diagnosticDir, 'pass83-test-diagnostic.txt');

function spawnNode(args) {
  return spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer,
    env: process.env,
  });
}

function printRun(run) {
  process.stdout.write(run.stdout || '');
  process.stderr.write(run.stderr || '');
}

function writeDiagnostic({ label, args, run, note = '' }) {
  mkdirSync(diagnosticDir, { recursive: true });
  const text = [
    'HNL v1.26.0 · PASS83 EXACT-574 DIAGNOSTIC',
    `label=${label}`,
    `command=${process.execPath} ${args.join(' ')}`,
    `status=${String(run?.status)}`,
    `signal=${String(run?.signal || '')}`,
    `error=${run?.error ? String(run.error.stack || run.error) : ''}`,
    note ? `note=${note}` : '',
    '',
    '----- STDOUT -----',
    run?.stdout || '',
    '',
    '----- STDERR -----',
    run?.stderr || '',
    ''
  ].filter((x) => x !== '').join('\n');
  writeFileSync(diagnosticFile, `${text}\n`, 'utf8');
  return diagnosticFile;
}

function runRequired(args, label) {
  const run = spawnNode(args);
  printRun(run);
  if (run.error || run.status !== 0) {
    const file = writeDiagnostic({ label, args, run });
    if (run.error) console.error(`PASS83 TEST COUNT GATE: ${label} runner error`, run.error);
    console.error(`PASS83 TEST COUNT GATE: ${label} failed status=${run.status} signal=${run.signal || '-'}; diagnostic=${file}`);
    process.exit(1);
  }
  return run;
}

const last = (text, re) => [...String(text || '').matchAll(re)].at(-1)?.[1];
function tapSummary(run) {
  const text = `${run.stdout || ''}\n${run.stderr || ''}`;
  return {
    tests: Number(last(text, /# tests\s+(\d+)/g)),
    pass: Number(last(text, /# pass\s+(\d+)/g)),
    fail: Number(last(text, /# fail\s+(\d+)/g)),
  };
}

function isolateFailingFile(testFiles) {
  console.error('PASS83 TEST COUNT GATE: deterministic suite failed; isolating test files one-by-one...');
  for (const file of testFiles) {
    const args = ['--test', '--test-concurrency=1', file];
    const run = spawnNode(args);
    const summary = tapSummary(run);
    const ok = !run.error && run.status === 0 && Number.isFinite(summary.tests) && summary.tests > 0 && summary.pass === summary.tests && summary.fail === 0;
    if (!ok) {
      const diag = writeDiagnostic({
        label: `isolated:${file}`,
        args,
        run,
        note: `parsed tests=${summary.tests} pass=${summary.pass} fail=${summary.fail}`
      });
      console.error(`PASS83 TEST COUNT GATE: FAILING TEST FILE: ${file}`);
      console.error(`PASS83 TEST COUNT GATE: isolated tests=${summary.tests} pass=${summary.pass} fail=${summary.fail} status=${run.status} signal=${run.signal || '-'}`);
      printRun(run);
      console.error(`PASS83 TEST COUNT GATE: diagnostic=${diag}`);
      return file;
    }
  }
  console.error('PASS83 TEST COUNT GATE: no isolated file failed; classify as cross-file/shared-resource failure.');
  return null;
}

// Reproduce the locked npm-test preconditions once.
runRequired(['scripts/generate-image-fixtures.mjs'], 'fixtures:images');
runRequired(['scripts/check-version-sync.mjs'], 'check:version');
runRequired(['scripts/check-search-brain.mjs'], 'check:search');

const testDir = path.join(root, 'tests');
const testFiles = readdirSync(testDir)
  .filter((name) => name.endsWith('.test.mjs'))
  .sort()
  .map((name) => path.join('tests', name));

if (testFiles.length === 0) {
  console.error('PASS83 TEST COUNT GATE: no tests/*.test.mjs files found');
  process.exit(1);
}

// A release-certification gate should be deterministic. Node's test files are
// therefore executed with cross-file concurrency=1 while retaining all 574 tests.
// This removes CI-only resource/port/order collisions without skipping any test.
const args = ['--test', '--test-concurrency=1', ...testFiles];
const run = spawnNode(args);
const summary = tapSummary(run);

if (run.error || run.status !== 0) {
  const suiteDiag = writeDiagnostic({
    label: 'node:test deterministic exact-574 suite',
    args,
    run,
    note: `parsed tests=${summary.tests} pass=${summary.pass} fail=${summary.fail}`
  });
  console.error(`PASS83 TEST COUNT GATE: deterministic suite failed status=${run.status} signal=${run.signal || '-'}; diagnostic=${suiteDiag}`);
  isolateFailingFile(testFiles);
  process.exit(1);
}

printRun(run);

if (summary.tests !== 574 || summary.pass !== 574 || summary.fail !== 0) {
  const diag = writeDiagnostic({
    label: 'exact-count-mismatch',
    args,
    run,
    note: `expected 574/574/0; got tests=${summary.tests} pass=${summary.pass} fail=${summary.fail}`
  });
  console.error(`PASS83 TEST COUNT GATE: FAIL tests=${summary.tests} pass=${summary.pass} fail=${summary.fail}; diagnostic=${diag}`);
  process.exit(1);
}

console.log('PASS83 TEST COUNT GATE: PASS 574/574, fail 0 · deterministic cross-file concurrency=1');
