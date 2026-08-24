import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p));
const fail = msg => { console.error(`VERSION GATE FAIL: ${msg}`); process.exitCode = 1; };

const pkg = json('package.json');
const version = String(pkg.version || '').trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`package.json version không phải SemVer x.y.z: ${version}`);

const readme = read('README.md');
const firstHeading = readme.split(/\r?\n/).find(line => line.trim()) || '';
if (firstHeading.trim() !== `# HNL Pile Standards AI v${version}`) fail(`README heading lệch version: ${firstHeading}`);

const changelog = json('public/changelog.json');
if (String(changelog.current) !== version) fail(`changelog.current=${changelog.current}, package=${version}`);
if (!Array.isArray(changelog.releases) || String(changelog.releases[0]?.version) !== version) fail('Release đầu tiên trong changelog không phải version hiện hành.');
const releaseVersions = changelog.releases.map(x => String(x.version || ''));
if (new Set(releaseVersions).size !== releaseVersions.length) fail('Changelog có version release bị trùng.');

const releasePath = `docs/RELEASE_V${version}.md`;
if (!fs.existsSync(path.join(root, releasePath))) fail(`Thiếu ${releasePath}`);
else if (!read(releasePath).split(/\r?\n/, 1)[0].includes(`v${version}`)) fail(`${releasePath} có heading sai version.`);

const buildDoc = read('docs/BUILD_METADATA.md');
if (!new RegExp(`"version"\\s*:\\s*"${version.replaceAll('.', '\\.') }"`).test(buildDoc)) fail('BUILD_METADATA.md chưa cập nhật version hiện hành.');

const vite = read('vite.config.js');
if (!/pkg\.version/.test(vite) || !/__HNL_APP_VERSION__/.test(vite)) fail('Vite không lấy version từ package.json.');
const gen = read('scripts/generate-build-info.mjs');
if (!/pkg\.version/.test(gen)) fail('generate-build-info.mjs không lấy version từ package.json.');

const main = read('src/main.js');
const sw = read('public/sw.js');
if (!/__HNL_APP_VERSION__/.test(main) || !/SOURCE_META\.version/.test(main)) fail('Runtime UI chưa lấy version từ Vite/package source.');
if (!/serviceWorker\.register\(`\.\/sw\.js\?v=\$\{encodeURIComponent\(SOURCE_META\.version\)\}`/.test(main)) fail('Service Worker registration chưa dùng version runtime.');
if (!/params\.get\('v'\)/.test(sw) || !/hnl-pile-ai-/.test(sw)) fail('Service Worker cache chưa khóa theo version query.');
if (/release:\s*['"]v\d+\.\d+\.\d+/.test(main)) fail('SOURCE_META.release không nên hard-code version hiện hành; dùng SOURCE_META.version để tránh lệch.');

for (const [group, deps] of Object.entries({ dependencies:pkg.dependencies || {}, devDependencies:pkg.devDependencies || {} })) {
  for (const [name, spec] of Object.entries(deps)) {
    if (/^[~^*]|latest/i.test(String(spec))) fail(`${group}.${name}=${spec} chưa pin exact version; build có thể trôi dependency.`);
  }
}

const setupName = String(pkg.build?.nsis?.artifactName || '');
const portableName = String(pkg.build?.portable?.artifactName || '');
if (!setupName.includes('${version}') || !/Setup/.test(setupName)) fail('Tên NSIS Setup không dùng ${version} hoặc thiếu Setup.');
if (!portableName.includes('${version}') || !/Portable/.test(portableName)) fail('Tên Portable không dùng ${version} hoặc thiếu Portable.');
if (String(pkg.build?.win?.artifactName || '').includes('${target}')) fail('win.artifactName còn macro ${target} không hỗ trợ.');

// Generate metadata into a temporary directory and verify the produced version.
try {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hnl-version-'));
  const out = path.join(tmp, 'build-info.json');
  execFileSync(process.execPath, [path.join(root, 'scripts/generate-build-info.mjs'), '--target', 'web', '--output', out], { cwd: root, stdio: 'ignore' });
  const info = JSON.parse(fs.readFileSync(out, 'utf8'));
  if (String(info.version) !== version) fail(`build-info generated=${info.version}, package=${version}`);
  fs.rmSync(tmp, { recursive: true, force: true });
} catch (error) {
  fail(`Không kiểm tra được build-info: ${error.message}`);
}

if (!process.exitCode) console.log(`VERSION GATE PASS: v${version} đồng bộ package → README → changelog → release → build metadata → Service Worker → Windows artifacts.`);
