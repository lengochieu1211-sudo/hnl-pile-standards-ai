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
const lock = json('package-lock.json');
const meta = json('public/release-meta.json');
const version = String(pkg.version || '').trim();
const goldenBaseline = String(meta.goldenBaseline || '').trim();

if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`package.json version không phải SemVer x.y.z: ${version}`);
if (String(lock.version) !== version || String(lock.packages?.['']?.version) !== version) fail(`package-lock lệch package: lock=${lock.version}/${lock.packages?.['']?.version}, package=${version}`);
if (String(meta.appVersion) !== version) fail(`release-meta.appVersion=${meta.appVersion}, package=${version}`);
if (!/^\d+\.\d+\.\d+$/.test(goldenBaseline)) fail(`goldenBaseline không đúng SemVer: ${goldenBaseline}`);
if (String(meta.searchBrain) !== '1.9.23' || String(meta.searchBrainStatus) !== 'LOCKED') fail('Search Brain identity phải giữ 1.9.23 / LOCKED.');
if (String(meta.certificationStage) !== 'MASTER_SYSTEM_AUDIT') fail(`certificationStage không đúng: ${meta.certificationStage}`);
if ('engineeringRelease' in meta) fail('release-meta không được chứa engineeringRelease; appVersion là version sản phẩm duy nhất.');

const readme = read('README.md');
const firstHeading = readme.split(/\r?\n/).find(line => line.trim()) || '';
if (firstHeading.trim() !== `# HNL Pile Standards AI v${version}`) fail(`README heading lệch version: ${firstHeading}`);
if (!readme.includes(`Version duy nhất của ứng dụng:** v${version}`)) fail('README chưa khóa quy tắc một version duy nhất.');
if (/Engineering Release:\*\*/i.test(readme)) fail('README còn nhãn Engineering Release song song.');
if (!readme.includes(`Golden Baseline:** v${goldenBaseline}`)) fail('README thiếu Golden Baseline hiện hành.');

const changelog = json('public/changelog.json');
if (String(changelog.current) !== version) fail(`changelog.current=${changelog.current}, package=${version}`);
if (!Array.isArray(changelog.releases) || String(changelog.releases[0]?.version) !== version) fail('Release đầu tiên trong changelog không phải version hiện hành.');
const releaseVersions = changelog.releases.map(x => String(x.version || ''));
if (new Set(releaseVersions).size !== releaseVersions.length) fail('Changelog có version release bị trùng.');
if (/V26\.3\.1|Engineering Release/i.test(JSON.stringify(changelog.releases[0] || {}))) fail('Changelog hiện hành còn version kỹ thuật song song.');

const releasePath = `docs/RELEASE_V${version}.md`;
if (!fs.existsSync(path.join(root, releasePath))) fail(`Thiếu ${releasePath}`);
else {
  const release = read(releasePath);
  if (!release.split(/\r?\n/, 1)[0].includes(`v${version}`)) fail(`${releasePath} có heading sai version.`);
  if (/V26\.3\.1|Engineering Release/i.test(release)) fail(`${releasePath} còn version kỹ thuật song song.`);
  if (!release.includes(`Golden Baseline: **${goldenBaseline}**`)) fail(`${releasePath} thiếu Golden Baseline ${goldenBaseline}.`);
}

const buildDoc = read('docs/BUILD_METADATA.md');
if (!new RegExp(`"version"\\s*:\\s*"${version.replaceAll('.', '\\.') }"`).test(buildDoc)) fail('BUILD_METADATA.md chưa cập nhật App Version.');
if (/engineeringRelease|V26\.3\.1/i.test(buildDoc)) fail('BUILD_METADATA.md còn version kỹ thuật song song.');
if (!buildDoc.includes(goldenBaseline)) fail('BUILD_METADATA.md thiếu Golden Baseline.');

const vite = read('vite.config.js');
if (!/pkg\.version/.test(vite) || !/__HNL_APP_VERSION__/.test(vite)) fail('Vite không lấy App Version từ package.json.');
if (!/__HNL_CERTIFICATION_STAGE__/.test(vite) || !/release-meta\.json/.test(vite)) fail('Vite chưa khóa certification stage từ release-meta.json.');
if (/ENGINEERING_RELEASE|engineeringRelease/i.test(vite)) fail('Vite còn engineering release song song.');
const gen = read('scripts/generate-build-info.mjs');
if (!/pkg\.version/.test(gen) || !/certificationStage/.test(gen) || !/goldenBaseline/.test(gen)) fail('generate-build-info.mjs thiếu version/stage/baseline.');
if (/engineeringRelease/i.test(gen)) fail('generate-build-info.mjs còn engineeringRelease.');

const main = read('src/main.js');
const sw = read('public/sw.js');
if (!/__HNL_APP_VERSION__/.test(main) || !/SOURCE_META\.version/.test(main)) fail('Runtime UI chưa lấy version từ Vite/package source.');
if (!/serviceWorker\.register\(`\.\/sw\.js\?v=\$\{encodeURIComponent\(SOURCE_META\.version\)\}`/.test(main)) fail('Service Worker registration chưa dùng App Version runtime.');
if (!/params\.get\('v'\)/.test(sw) || !/hnl-pile-ai-/.test(sw)) fail('Service Worker cache chưa khóa theo version query.');

for (const [group, deps] of Object.entries({ dependencies:pkg.dependencies || {}, devDependencies:pkg.devDependencies || {} })) {
  for (const [name, spec] of Object.entries(deps)) {
    if (/^[~^*]|latest/i.test(String(spec))) fail(`${group}.${name}=${spec} chưa pin exact version; build có thể trôi dependency.`);
  }
}
if (String(pkg.dependencies?.jszip) !== '3.10.1') fail('jszip phải là dependency trực tiếp exact 3.10.1 cho chart/smoke.');
if (String(lock.packages?.['']?.dependencies?.jszip) !== '3.10.1') fail('package-lock root chưa khóa jszip=3.10.1.');

const setupName = String(pkg.build?.nsis?.artifactName || '');
const portableName = String(pkg.build?.portable?.artifactName || '');
if (!setupName.includes('${version}') || !/Setup/.test(setupName)) fail('Tên NSIS Setup không dùng ${version} hoặc thiếu Setup.');
if (!portableName.includes('${version}') || !/Portable/.test(portableName)) fail('Tên Portable không dùng ${version} hoặc thiếu Portable.');

for (const wf of ['.github/workflows/pass83-runtime-cert.yml','.github/workflows/rc-final.yml','.github/workflows/v26-spt-input-cert.yml','.github/workflows/master-system-audit.yml']) {
  if (!fs.existsSync(path.join(root,wf))) { fail(`Thiếu workflow ${wf}`); continue; }
  const text=read(wf);
  if (/V26\.3\.1|v26\.3\.1|Engineering Release/i.test(text)) fail(`${wf} còn version kỹ thuật song song.`);
}
const rc = read('.github/workflows/rc-final.yml');
if (!rc.includes(`HNL v${version} RC Final Gate`) || !rc.includes(`hnl-v${version}-web-golden-excel`) || !rc.includes(`hnl-v${version}-windows-setup-portable-excel`)) fail('RC Final workflow chưa đồng bộ App Version.');

// Golden filenames intentionally keep the declared evidence baseline.
for (const [name, cmd] of Object.entries(pkg.scripts || {})) {
  if (name.startsWith('golden:') && /v\d+\.\d+\.\d+/.test(cmd) && !cmd.includes(`v${goldenBaseline}`)) {
    fail(`${name} dùng Golden filename khác release-meta.goldenBaseline=${goldenBaseline}: ${cmd}`);
  }
}

try {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hnl-version-'));
  const out = path.join(tmp, 'build-info.json');
  execFileSync(process.execPath, [path.join(root, 'scripts/generate-build-info.mjs'), '--target', 'web', '--output', out], { cwd: root, stdio: 'ignore' });
  const info = JSON.parse(fs.readFileSync(out, 'utf8'));
  if (String(info.version) !== version) fail(`build-info generated=${info.version}, package=${version}`);
  if (String(info.certificationStage) !== String(meta.certificationStage)) fail(`build-info certificationStage=${info.certificationStage}`);
  if (String(info.goldenBaseline) !== goldenBaseline) fail(`build-info goldenBaseline=${info.goldenBaseline}`);
  if (String(info.searchBrain) !== String(meta.searchBrain)) fail(`build-info searchBrain=${info.searchBrain}`);
  if ('engineeringRelease' in info) fail('build-info không được chứa engineeringRelease.');
  fs.rmSync(tmp, { recursive: true, force: true });
} catch (error) {
  fail(`Không kiểm tra được build-info: ${error.message}`);
}

if (!process.exitCode) console.log(`VERSION GATE PASS: single App Version v${version} · ${meta.certificationStage} · Golden ${goldenBaseline} · Search Brain ${meta.searchBrain} LOCKED.`);
