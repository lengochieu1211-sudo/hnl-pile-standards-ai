import { spawnSync } from 'node:child_process';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = spawnSync(npm, ['test'], { encoding:'utf8', maxBuffer:64*1024*1024 });
process.stdout.write(run.stdout || '');
process.stderr.write(run.stderr || '');
if (run.error) { console.error(run.error); process.exit(1); }
const text = `${run.stdout||''}\n${run.stderr||''}`;
const last = (re) => [...text.matchAll(re)].at(-1)?.[1];
const tests = Number(last(/# tests\s+(\d+)/g));
const pass = Number(last(/# pass\s+(\d+)/g));
const fail = Number(last(/# fail\s+(\d+)/g));
if (run.status !== 0 || tests !== 574 || pass !== 574 || fail !== 0) {
  console.error(`PASS83 TEST COUNT GATE: FAIL status=${run.status} tests=${tests} pass=${pass} fail=${fail}`);
  process.exit(1);
}
console.log('PASS83 TEST COUNT GATE: PASS 574/574, fail 0');
