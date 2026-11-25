// Stillness PWA: vite build 뒤에 dist/sw.js 와 dist/pwa-build.json 을 만든다 (npm run build 가 부른다 — docs/pwa_2026-10-13.md)
//  node tools/pwa/build.mjs [dist 폴더]
//  - 오프라인 목록 = dist − 생사전 시험판(saengsa) − 생성 파일 − 옛 주소 아이콘(LEGACY — 서버에는 남음). 파일마다 크기·SHA-256
//  - 판 번호 = (목록 + 워커 틀)의 해시 앞 24 자 → 내용이 바뀐 빌드마다 캐시 이름이 바뀐다. 같은 내용이면 같은 판(쓸데없이 다시 받지 않는다)
//  - 의존성·네트워크·시각 없음 (같은 dist → 같은 sw.js)
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dist = path.resolve(root, process.argv[2] || 'dist');
// 옛 실험판(corr · r2p · support · wb) · 상점 시험판(shop) · 검토용 사진(encounters)은 11/21 public/ 에서 지움 (감사 N-005)
const EXCLUDED_DIRS = new Set(['saengsa', 'physics2']); // physics2 = 물리 2.0 시험판 (11/25 — 배포 때 physics-2 가지에서 빌드 · 본 게임 오프라인 저장에서 뺌) · saengsa = 생사전 시험판 (10/29 — 본 게임 오프라인 저장에서 뺌 · 11/21 부터 커밋하지 않고 배포 때 빌드 — .github/workflows/deploy.yml · 없어도 빌드는 그대로)
const GENERATED = new Set(['sw.js', 'pwa-build.json']);
const BUDGET_BYTES = 30 * 1024 * 1024; // 넘으면 담을 목록을 다시 보라고 멈춘다
const NAV_TIMEOUT_MS = 10000; // 화면 요청이 이보다 늦으면 깔린 판으로 연다 (깔린 판이 있을 때만) — 사장님 확인 전
const REQUIRED = ['index.html', 'manifest.webmanifest', 'icons/tree-sword-orig-20261020-icon-192.png', 'icons/tree-sword-orig-20261020-icon-maskable-512.png', 'icons/tree-sword-orig-20261020-apple-touch-icon.png', 'icons/tree-sword-orig-20261020-favicon-32.png', 'icons/tree-sword-orig-20261020-favicon-64.png', 'stillness-20261018.webmanifest']; // 오프라인 목록에 꼭 들 것 = 지금 index.html · 두 매니페스트가 거는 것 — 10/17 새 이름 (docs/import/app_icon_2026-10-17.md) · 10/18 32 × 32 도트판 새 이름 + 새 매니페스트 이름 (docs/import/app_icon_px32_2026-10-18.md) · 11/22 같은 이름 여섯이 두 번 적혀 있던 것을 하나로 (감사 N-016)
// 옛 주소 아이콘 (감사 N-040 — 11/22): 이미 설치한 폰 · 옛 매니페스트가 부를 수 있어 dist(서버)에는 꼭 두되, 오프라인 목록(첫 설치 때 받는 것)에는 넣지 않는다 — 워커는 목록 밖 주소를 네트워크로 그냥 보낸다(sw-template.js fetch).
//  옛 이름 다섯(10/17 전 매니페스트 · index.html) + 512 'any' 새 이름(11/22 부터 매니페스트의 any · maskable 두 줄이 같은 바이트의 maskable 주소 하나를 씀). index.html · 두 매니페스트가 이 가운데 하나라도 걸면 빌드를 멈춘다
const LEGACY = ['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png', 'icons/tree-sword-orig-20261020-icon-512.png'];
const MANIFESTS = ['stillness-20261018.webmanifest', 'manifest.webmanifest']; // index.html 이 거는 것 · 옛 이름(같은 내용)

const sha = (b) => createHash('sha256').update(b).digest('hex');
const files = [];
const legacy = [];
async function walk(dir, prefix = '') {
  const entries = (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const e of entries) {
    if (!prefix && (EXCLUDED_DIRS.has(e.name) || GENERATED.has(e.name))) continue;
    const rel = prefix + e.name;
    if (e.isSymbolicLink()) throw new Error('PWA: dist 안에 심볼릭 링크가 있으면 안 된다: ' + rel);
    if (e.isDirectory()) await walk(path.join(dir, e.name), rel + '/');
    else if (e.isFile()) {
      const bytes = await fs.readFile(path.join(dir, e.name));
      (LEGACY.includes(rel) ? legacy : files).push({ path: rel, bytes: bytes.length, sha256: sha(bytes) });
    }
  }
}
await walk(dist);
for (const r of REQUIRED) if (!files.some((f) => f.path === r)) throw new Error('PWA: 빠진 파일 ' + r);
for (const r of LEGACY) if (!legacy.some((f) => f.path === r)) throw new Error('PWA: 빠진 옛 주소 파일 ' + r + ' (설치한 폰이 부를 수 있어 서버에 둔다)');
const html = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
if (!/rel="manifest"/.test(html)) throw new Error('PWA: index.html 에 manifest 링크가 없다');
// 지금 거는 아이콘 · 매니페스트는 모두 오프라인 목록에 (옛 주소로 빠지면 안 됨)
const linked = [...html.matchAll(/<link\b[^>]*\brel="(?:icon|apple-touch-icon|manifest)"[^>]*>/g)].map((m) => m[0].match(/\bhref="\.\/([^"]+)"/)?.[1]).filter(Boolean);
for (const m of MANIFESTS) for (const ic of JSON.parse(await fs.readFile(path.join(dist, m), 'utf8')).icons ?? []) linked.push(ic.src.replace(/^\.\//, ''));
for (const r of linked) if (!files.some((f) => f.path === r)) throw new Error('PWA: 거는 파일이 오프라인 목록에 없다 ' + r + (LEGACY.includes(r) ? ' (LEGACY 에서 뺄 것)' : ''));
const totalBytes = files.reduce((n, f) => n + f.bytes, 0);
if (totalBytes > BUDGET_BYTES) throw new Error(`PWA: 오프라인 목록이 ${(totalBytes / 1048576).toFixed(1)} MB — 30 MB 넘음, 목록을 다시 볼 것`);

const template = await fs.readFile(new URL('./sw-template.js', import.meta.url), 'utf8');
const version = sha(JSON.stringify(files) + template + NAV_TIMEOUT_MS).slice(0, 24);
const worker = template
  .replace('__PWA_VERSION__', () => JSON.stringify(version))
  .replace('__PWA_FILES__', () => JSON.stringify(files))
  .replace('__PWA_NAV_TIMEOUT_MS__', () => String(NAV_TIMEOUT_MS));
if (/__PWA_[A-Z_]+__/.test(worker)) throw new Error('PWA: 워커 틀 자리표가 남았다');
await fs.writeFile(path.join(dist, 'sw.js'), worker);
const legacyBytes = legacy.reduce((n, f) => n + f.bytes, 0);
await fs.writeFile(path.join(dist, 'pwa-build.json'), JSON.stringify({ version, files: files.length, totalBytes, excludedDirectories: [...EXCLUDED_DIRS], legacyFiles: legacy.length, legacyBytes, commit: process.env.GITHUB_SHA || null }, null, 2) + '\n');
console.log(JSON.stringify({ pwa: true, version, files: files.length, totalBytes, legacyFiles: legacy.length, legacyBytes }));
