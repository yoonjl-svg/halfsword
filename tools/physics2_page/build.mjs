// 물리 2.0 시험 페이지 빌드 (사장님 11/25 '아까 말한 1번도 동시에 수행해' — 새 다리를 본판에 넣기 전에 사장님이 해 보는 하위 경로 /physics2/ · docs/strike/physics2_trial_page_2026-11-25.md)
//  node tools/physics2_page/build.mjs <빈 폴더(outDir)>
//   1) 이 저장소의 게임(src · index.html · test.html · sounds.html · voices.html · public 가운데 게임이 쓰는 것)을 .tmp/physics2_src 에 베낀다
//   2) 새 다리 패치(docs/strike/physics2_proto/legs_b4.patch)의 src 몫만 그 사본에 붙인다 — 이 가지의 src 는 건드리지 않는다
//   3) 그 사본을 vite 로 빌드해 outDir 에 낸다
//  본판 빌드(vite.config.js)와 다른 점 — 모두 이 파일 안에서 빌드 때만 한다(게임 코드에 켬/끔이 생기지 않는다):
//   - 저장 가르기: 페이지 머리에 trial_storage.js 를 그대로 넣는다 → 같은 출처의 본 게임 저장(localStorage)을 읽지도 고치지도 않는다
//   - 서비스 워커를 등록하지 않는다(설치 · 오프라인 없음) · 매니페스트 링크를 뺀다(또 하나의 'Stillness' 앱으로 설치되지 않게)
//   - 탭 제목과 화면 아래 가운데에 '물리 2.0 시험판' 표시
//  배포: 본판 배포(.github/workflows/deploy.yml)가 이 가지를 따로 받아 이 파일을 돌리고 결과를 public/physics2 에 둔다 — 붙이는 법은 위 문서
//  결정적: 같은 소스 → 같은 결과(시각 · 난수 없음)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const outArg = process.argv[2];
if (!outArg) { console.error('쓰는 법: node tools/physics2_page/build.mjs <빈 폴더>'); process.exit(2); }
const outDir = path.resolve(process.cwd(), outArg);
if (fs.existsSync(outDir) && fs.readdirSync(outDir).length) { console.error('시험 페이지: 낼 폴더가 비어 있지 않다 — ' + outDir); process.exit(2); }

const PATCH = 'docs/strike/physics2_proto/legs_b4.patch';
const LABEL = '물리 2.0 시험판';
const PAGES = ['index.html', 'test.html', 'sounds.html', 'voices.html'];
const PUBLIC_DIRS = ['fonts', 'sfx', 'ui'];
const PUBLIC_FILES = ['icons/tree-sword-orig-20261020-favicon-32.png', 'icons/tree-sword-orig-20261020-favicon-64.png', 'icons/tree-sword-orig-20261020-apple-touch-icon.png'];

// 1) 사본
const stage = path.join(root, '.tmp', 'physics2_src');
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
fs.cpSync(path.join(root, 'src'), path.join(stage, 'src'), { recursive: true });
for (const p of PAGES) fs.copyFileSync(path.join(root, p), path.join(stage, p));
for (const d of PUBLIC_DIRS) fs.cpSync(path.join(root, 'public', d), path.join(stage, 'public', d), { recursive: true });
for (const f of PUBLIC_FILES) { fs.mkdirSync(path.dirname(path.join(stage, 'public', f)), { recursive: true }); fs.copyFileSync(path.join(root, 'public', f), path.join(stage, 'public', f)); }

// 2) 패치의 src 몫만 (패치에는 재는 도구 tools/ 몫도 들어 있다 — 시험 페이지에는 안 쓴다)
const blocks = fs.readFileSync(path.join(root, PATCH), 'utf8').split(/^(?=diff --git )/m).filter((b) => /^diff --git a\/src\//.test(b));
if (!blocks.length) throw new Error('시험 페이지: 패치에 src 몫이 없다 — ' + PATCH);
const srcPatch = path.join(root, '.tmp', 'physics2_src.patch');
fs.writeFileSync(srcPatch, blocks.join(''));
// git 은 저장소 안 하위 폴더에서 돌리면 그 폴더 밖 길을 말없이 건너뛴다 → 뿌리에서 돌리고 사본 폴더를 길 앞에 붙인다
execFileSync('git', ['apply', '--whitespace=nowarn', '--directory=' + path.relative(root, stage).replace(/\\/g, '/'), srcPatch], { cwd: root, stdio: 'inherit' });
if (!fs.existsSync(path.join(stage, 'src', 'legs_vmc.js'))) throw new Error('시험 페이지: 새 다리(src/legs_vmc.js)가 붙지 않았다');

// 3) 빌드
const storageSnippet = fs.readFileSync(path.join(here, 'trial_storage.js'), 'utf8');
const badge = `<div id="p2TrialBadge" aria-hidden="true" style="position:fixed;left:50%;bottom:2px;transform:translateX(-50%);z-index:2147483647;pointer-events:none;font:600 10px/1.2 system-ui,sans-serif;letter-spacing:.04em;color:#fff;opacity:.55;text-shadow:0 0 3px #000,0 0 3px #000">${LABEL}</div>`;
const trialPage = () => ({
  name: 'physics2-trial-page',
  enforce: 'pre',
  transformIndexHtml: {
    order: 'pre',
    handler(html, ctx) {
      const page = path.basename(ctx.filename);
      let out = html.replace(/\s*<link rel="manifest"[^>]*>(\s*<!--.*?-->)?/, '');
      if (out.includes('rel="manifest"')) throw new Error(`시험 페이지: ${page} 의 매니페스트 링크를 못 뺌`);
      const titled = out.replace(/<title>([^<]*)<\/title>/, (m, t) => `<title>${t} · ${LABEL}</title>`);
      if (titled === out) throw new Error(`시험 페이지: ${page} 의 제목을 못 고침`);
      out = titled;
      const headed = out.replace(/<head([^>]*)>/, (m) => `${m}\n    <script>\n${storageSnippet}\n    </script>`);
      if (headed === out) throw new Error(`시험 페이지: ${page} 머리에 저장 가르기를 못 넣음`);
      out = headed;
      const bodied = out.replace(/<\/body>/, `  ${badge}\n  </body>`);
      if (bodied === out) throw new Error(`시험 페이지: ${page} 에 표시를 못 넣음`);
      return bodied;
    },
  },
  // 서비스 워커 등록을 막는다: pwa.js 가 생사전 시험판에 쓰는 '등록 안 함' 갈래를 이 빌드에서 늘 타게 한다(그 줄이 없어지면 빌드를 멈춘다)
  transform(code, id) {
    if (!id.split('?')[0].replace(/\\/g, '/').endsWith('/src/pwa.js')) return null;
    const mark = "import.meta.env.VITE_SAENGSA_TEST === '1'";
    if (!code.includes(mark)) throw new Error('시험 페이지: src/pwa.js 에서 서비스 워커 등록을 막을 줄을 못 찾음');
    return { code: code.replace(mark, 'true'), map: null };
  },
});

await build({
  configFile: false,
  root: stage,
  base: './',
  publicDir: path.join(stage, 'public'),
  logLevel: 'warn',
  plugins: [trialPage()],
  build: {
    outDir,
    emptyOutDir: true,
    sourcemap: false,
    rolldownOptions: { input: Object.fromEntries(PAGES.map((p) => [p.replace('.html', '') === 'index' ? 'main' : p.replace('.html', ''), path.join(stage, p)])) },
  },
});

// 낸 것 점검: 네 페이지 · 저장 가르기 · 표시가 들어갔고 매니페스트 · 서비스 워커가 없다
for (const p of PAGES) {
  const html = fs.readFileSync(path.join(outDir, p), 'utf8');
  if (!html.includes('stillness.p2trial.') || !html.includes(LABEL) || html.includes('rel="manifest"')) throw new Error(`시험 페이지: ${p} 점검 실패`);
}
for (const f of ['sw.js', 'manifest.webmanifest', 'stillness-20261018.webmanifest']) if (fs.existsSync(path.join(outDir, f))) throw new Error('시험 페이지: 있으면 안 되는 파일 — ' + f);
const bytes = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? bytes(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
console.log(`물리 2.0 시험 페이지: ${outDir} · ${(bytes(outDir) / 1048576).toFixed(1)} MB · 패치 src 파일 ${blocks.length} 개`);
