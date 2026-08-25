import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const maxBuffer = 64 * 1024 * 1024;

function runNode(args, label) {
  const run = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer,
    env: process.env,
  });

  process.stdout.write(run.stdout || '');
  process.stderr.write(run.stderr || '');

  if (run.error) {
    console.error(`PASS83 TEST COUNT GATE: ${label} runner error`, run.error);
    process.exit(1);
  }
  if (run.status !== 0) {
    console.error(`PASS83 TEST COUNT GATE: ${label} failed status=${run.status}`);
    process.exit(1);
  }
  return run;
}

// Reproduce the locked npm test lifecycle without spawning npm/npm.cmd.
// Using process.execPath makes the gate identical on Linux and Windows.
runNode(['scripts/generate-image-fixtures.mjs'], 'fixtures:images');
runNode(['scripts/check-version-sync.mjs'], 'check:version');
runNode(['scripts/check-search-brain.mjs'], 'check:search');

const testDir = path.join(root, 'tests');
const testFiles = readdirSync(testDir)
  .filter((name) => name.endsWith('.test.mjs'))
  .sort()
  .map((name) => path.join('tests', name));

if (testFiles.length === 0) {
  console.error('PASS83 TEST COUNT GATE: no tests/*.test.mjs files found');
  process.exit(1);
}

const run = runNode(['--test', ...testFiles], 'node:test');
const text = `${run.stdout || ''}\n${run.stderr || ''}`;
const last = (re) => [...text.matchAll(re)].at(-1)?.[1];
const tests = Number(last(/# tests\s+(\d+)/g));
const pass = Number(last(/# pass\s+(\d+)/g));
const fail = Number(last(/# fail\s+(\d+)/g));

if (tests !== 574 || pass !== 574 || fail !== 0) {
  console.error(`PASS83 TEST COUNT GATE: FAIL tests=${tests} pass=${pass} fail=${fail}`);
  process.exit(1);
}

console.log('PASS83 TEST COUNT GATE: PASS 574/574, fail 0');
