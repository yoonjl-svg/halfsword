// 물리 2.0 시험 페이지 빌드 (사장님 11/25 '아까 말한 1번도 동시에 수행해' — 새 다리를 본판에 넣기 전에 사장님이 해 보는 하위 경로 /physics2/ · docs/strike/physics2_trial_page_2026-11-25.md)
//  node tools/physics2_page/build.mjs <빈 폴더(outDir)>
//   1) 이 저장소의 게임(src · index.html · test.html · sounds.html · voices.html · public 가운데 게임이 쓰는 것)을 .tmp/physics2_src 에 베낀다
//   2) 새 다리 패치(docs/strike/physics2_proto/legs_b5.patch)의 src 몫만 그 사본에 붙인다 — 이 가지의 src 는 건드리지 않는다
//   3) 그 사본을 vite 로 빌드해 outDir 에 낸다
//  본판 빌드(vite.config.js)와 다른 점 — 모두 이 파일 안에서 빌드 때만 한다(게임 코드에 켬/끔이 생기지 않는다):
//   - 저장 가르기: 페이지 머리에 trial_storage.js 를 그대로 넣는다 → 같은 출처의 본 게임 저장(localStorage)을 읽지도 고치지도 않는다.
//     그 바로 뒤에 지킴 글을 넣는다: 가르기가 돌지 않았으면(글이 깨졌으면) 페이지를 멈춘다 — 가르지 않은 채 게임이 뜨는 일이 없다
//   - 서비스 워커를 등록하지 않는다(설치 · 오프라인 없음) · 매니페스트 링크와 '앱으로 깔기' 메타를 뺀다(또 하나의 'Stillness' 앱으로 설치되지 않게)
//   - 탭 제목과 화면 아래 가운데에 '물리 2.0 시험판' 표시(첫 화면 · 대기실에서도 보이게) · 고르기 화면의 '← 본판으로' 글을 '← 시험판 처음으로'로
//  빌드를 멈추는 점검: 가르기 글을 가짜 저장으로 실제로 돌려 본다 · 게임 소스에 가르기가 못 막는 저장 접근(localStorage['열쇠'] 꼴 · storage 이벤트)이 있으면 멈춘다
//  배포: 본판 배포(.github/workflows/deploy.yml)가 이 가지의 정해 둔 커밋을 따로 받아 이 파일을 돌리고 결과를 public/physics2 에 둔다 — 붙이는 법은 위 문서
//  결정적: 같은 소스 → 같은 결과(시각 · 난수 없음)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const outArg = process.argv[2];
if (!outArg) { console.error('쓰는 법: node tools/physics2_page/build.mjs <빈 폴더>'); process.exit(2); }
const outDir = path.resolve(process.cwd(), outArg);
if (fs.existsSync(outDir) && fs.readdirSync(outDir).length) { console.error('시험 페이지: 낼 폴더가 비어 있지 않다 — ' + outDir); process.exit(2); }

const PATCH = 'docs/strike/physics2_proto/legs_b5.patch';
const LABEL = '물리 2.0 시험판';
const PREFIX = 'stillness.p2trial.';
const PAGES = ['index.html', 'test.html', 'sounds.html', 'voices.html'];
const PUBLIC_DIRS = ['fonts', 'sfx', 'ui'];
const PUBLIC_FILES = ['icons/tree-sword-orig-20261020-favicon-32.png', 'icons/tree-sword-orig-20261020-favicon-64.png', 'icons/tree-sword-orig-20261020-apple-touch-icon.png'];

// 0) 저장 가르기 글을 가짜 저장으로 실제로 돌려 본다 (글자가 들어 있는지만 보면 깨진 글도 통과한다 — 검토 11/25)
const storageSnippet = fs.readFileSync(path.join(here, 'trial_storage.js'), 'utf8');
{
  class Storage {
    #m = new Map();
    get length() { return this.#m.size; }
    key(i) { return [...this.#m.keys()][i] ?? null; }
    getItem(k) { return this.#m.has(String(k)) ? this.#m.get(String(k)) : null; }
    setItem(k, v) { this.#m.set(String(k), String(v)); }
    removeItem(k) { this.#m.delete(String(k)); }
    clear() { this.#m.clear(); }
  }
  const raw = { get: Storage.prototype.getItem, set: Storage.prototype.setItem, key: Storage.prototype.key, len: Object.getOwnPropertyDescriptor(Storage.prototype, 'length').get };
  const local = new Storage();
  const session = new Storage();
  const names = [];
  class BroadcastChannel { constructor(name) { names.push(name); this.name = name; } }
  raw.set.call(local, 'main.key', 'main');
  const win = { localStorage: local, sessionStorage: session };
  const box = vm.createContext({ window: win, Storage, BroadcastChannel, Object });
  vm.runInContext(storageSnippet, box, { filename: 'trial_storage.js' });
  const fail = (why) => { throw new Error('시험 페이지: 저장 가르기 글이 제대로 돌지 않는다 — ' + why); };
  if (win.__stillnessP2TrialStorage !== 'on') fail('표가 on 이 아님');
  local.setItem('k', 'v');
  if (raw.get.call(local, PREFIX + 'k') !== 'v' || raw.get.call(local, 'k') !== null) fail('setItem 이 앞붙임 열쇠로 가지 않음');
  if (local.getItem('k') !== 'v' || local.getItem('main.key') !== null) fail('getItem 이 본판 열쇠를 읽음');
  if (local.length !== 1 || local.key(0) !== 'k') fail('length · key 가 본판 열쇠를 셈');
  local.clear();
  if (raw.get.call(local, 'main.key') !== 'main' || raw.len.call(local) !== 1) fail('clear 가 본판 열쇠를 지움');
  local.removeItem('main.key');
  if (raw.get.call(local, 'main.key') !== 'main') fail('removeItem 이 본판 열쇠를 지움');
  session.setItem('s', '1');
  if (raw.get.call(session, 's') !== '1') fail('sessionStorage 까지 앞붙임');
  new win.BroadcastChannel('chan');
  if (names[0] !== PREFIX + 'chan') fail('BroadcastChannel 이름에 앞붙임이 안 붙음');
  // 저장을 아예 안 주는 브라우저: 표 'none' (가를 것이 없다)
  const win2 = { get localStorage() { throw new Error('denied'); } };
  vm.runInContext(storageSnippet, vm.createContext({ window: win2, Storage, Object }), { filename: 'trial_storage.js' });
  if (win2.__stillnessP2TrialStorage !== 'none') fail('저장이 없는 브라우저에서 표가 none 이 아님');
}

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

// 2-1) 가르기가 못 막는 저장 접근이 게임 소스에 있으면 멈춘다 (메서드 호출만 돌리므로 — 검토 11/25). 가르기 글과 같은 꼴인 생사전 시험판 저장(test_storage.js)은 Storage.prototype 만 만진다
const LEAKS = [/localStorage\s*\[/, /localStorage\.(?!getItem\b|setItem\b|removeItem\b|key\b|clear\b|length\b)[A-Za-z_$]/, /Object\.(keys|entries|values|assign|getOwnPropertyNames)\(\s*(window\.|globalThis\.)?localStorage/, /\bin\s+(window\.|globalThis\.)?localStorage\b/, /delete\s+(window\.|globalThis\.)?localStorage/, /['"`]storage['"`]/, /\bonstorage\b/, /\bindexedDB\b/, /document\.cookie/];
const walkJs = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walkJs(path.join(dir, e.name)) : /\.(js|mjs|html)$/.test(e.name) ? [path.join(dir, e.name)] : []));
const leaks = [];
for (const f of [...walkJs(path.join(stage, 'src')), ...PAGES.map((p) => path.join(stage, p))]) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => { for (const re of LEAKS) if (re.test(line)) leaks.push(`${path.relative(stage, f)}:${i + 1} ${re}`); });
}
if (leaks.length) throw new Error('시험 페이지: 저장 가르기가 못 막는 접근이 게임 소스에 있다 —\n  ' + leaks.join('\n  '));

// 3) 빌드
const guard = `if(!window.__stillnessP2TrialStorage){try{window.stop()}catch(e){}var d=document.documentElement;d.innerHTML='';var p=document.createElement('p');p.setAttribute('style','margin:0;padding:24px;background:#111;color:#eee;font:16px/1.6 system-ui,sans-serif');p.textContent='${LABEL}: 저장 가르기가 돌지 않아 이 페이지를 멈췄습니다. 본 게임 저장은 건드리지 않았습니다.';(document.body||d).appendChild(p);throw new Error('p2 trial: storage split did not run')}`; // 꺾쇠 글자를 쓰지 않는다(페이지 글 바꾸기가 이 글 안을 건드리지 않게)
const badge = `<div id="p2TrialBadge" aria-hidden="true" style="position:fixed;left:50%;bottom:2px;transform:translateX(-50%);z-index:2147483647;pointer-events:none;visibility:visible!important;font:600 10px/1.2 system-ui,sans-serif;letter-spacing:.04em;color:#fff;opacity:.55;text-shadow:0 0 3px #000,0 0 3px #000">${LABEL}</div>`;
const must = (page, what, before, after) => { if (after === before) throw new Error(`시험 페이지: ${page} — ${what} 을(를) 못 고침`); return after; };
const trialPage = () => ({
  name: 'physics2-trial-page',
  enforce: 'pre',
  transformIndexHtml: {
    order: 'pre',
    handler(html, ctx) {
      const page = path.basename(ctx.filename);
      let out = html.replace(/\s*<link rel="manifest"[^>]*>(\s*<!--.*?-->)?/, '');
      if (out.includes('rel="manifest"')) throw new Error(`시험 페이지: ${page} 의 매니페스트 링크를 못 뺌`);
      out = out.replace(/\s*<meta name="(?:apple-)?mobile-web-app-capable"[^>]*>/g, '');
      out = must(page, '제목', out, out.replace(/<title>([^<]*)<\/title>/, (m, t) => `<title>${t} · ${LABEL}</title>`));
      out = must(page, '머리(저장 가르기)', out, out.replace(/<head([^>]*)>/, (m) => `${m}\n    <script>\n${storageSnippet}\n    </script>\n    <script>${guard}</script>`));
      const bodyEnd = out.lastIndexOf('</body>'); // 맨 끝의 것 (앞쪽 스크립트 글 안에 같은 글자가 있어도 거기에 넣지 않는다)
      if (bodyEnd < 0) throw new Error(`시험 페이지: ${page} — 표시를 넣을 자리가 없다`);
      out = out.slice(0, bodyEnd) + `  ${badge}\n  ` + out.slice(bodyEnd);
      if (page === 'test.html') out = must(page, "'← 본판으로' 글", out, out.replace('← 본판으로', '← 시험판 처음으로'));
      return out;
    },
  },
  // 서비스 워커 등록을 막는다: pwa.js 가 생사전 시험판에 쓰는 '등록 안 함' 갈래를 이 빌드에서 늘 타게 한다(그 줄이 없어지면 빌드를 멈춘다)
  transform(code, id) {
    const file = id.split('?')[0].replace(/\\/g, '/');
    // 스킬 다 배운 판 (11/26 사장님 '스킬을 다 배워놨어야 테스트를 하지'): 시험 페이지는 어느 길(첫 화면 여정 · 시험 화면)로 들어가도 모든 유파의 스킬트리 칸을 배운 것으로 읽는다
    if (file.endsWith('/src/skill_tree_store.js')) {
      const head = 'export function readLearned(progress = readProgress()) {';
      if (!code.includes(head)) throw new Error('시험 페이지: src/skill_tree_store.js 에서 readLearned 머리를 못 찾음');
      return { code: code.replace(head, head + '\n  return Object.fromEntries(TREE_SCHOOLS.map((s) => [s, new Set(allNodeIds(s))])); // 물리 2.0 시험판 — 스킬 다 배운 판'), map: null };
    }
    if (!file.endsWith('/src/pwa.js')) return null;
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

// 낸 것 점검: 네 페이지마다 가르기 글 · 지킴 글이 다른 어떤 스크립트보다 앞에 있고, 표시가 있고, 매니페스트 · 앱 메타 · 서비스 워커 등록이 없다
for (const p of PAGES) {
  const html = fs.readFileSync(path.join(outDir, p), 'utf8');
  const firstScript = html.indexOf('<script');
  const snippetAt = html.indexOf(PREFIX);
  const guardAt = html.indexOf('__stillnessP2TrialStorage){');
  const nextScript = html.indexOf('<script', guardAt);
  if (firstScript < 0 || snippetAt < firstScript || guardAt < snippetAt || html.slice(firstScript, snippetAt).includes('</script>')) throw new Error(`시험 페이지: ${p} — 저장 가르기가 첫 스크립트가 아니다`);
  if (nextScript >= 0 && nextScript < guardAt) throw new Error(`시험 페이지: ${p} — 지킴 글 앞에 다른 스크립트가 있다`);
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].slice(0, 2).map((m) => m[1]);
  if (inline.length < 2 || !inline[0].includes(PREFIX) || !inline[1].includes('__stillnessP2TrialStorage')) throw new Error(`시험 페이지: ${p} — 머리의 두 스크립트(가르기 · 지킴)를 못 찾음`);
  for (const code of inline) new vm.Script(code, { filename: p + ' (inline)' }); // 문법이 깨졌으면 여기서 멈춘다
  const badgeAt = html.lastIndexOf('id="p2TrialBadge"');
  if (badgeAt < html.indexOf('<body') || html.indexOf('</script>', badgeAt) >= 0 && html.slice(badgeAt).includes('<script')) throw new Error(`시험 페이지: ${p} — 표시가 몸(body) 끝에 있지 않다`);
  if (!html.includes(LABEL) || !html.includes('visibility:visible!important') || html.includes('rel="manifest"') || html.includes('mobile-web-app-capable')) throw new Error(`시험 페이지: ${p} 점검 실패`);
}
for (const f of ['sw.js', 'manifest.webmanifest', 'stillness-20261018.webmanifest']) if (fs.existsSync(path.join(outDir, f))) throw new Error('시험 페이지: 있으면 안 되는 파일 — ' + f);
const allFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? allFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]));
for (const f of allFiles(outDir).filter((x) => /\.(js|html)$/.test(x))) if (/serviceWorker\s*\.\s*register\s*\(/.test(fs.readFileSync(f, 'utf8'))) throw new Error('시험 페이지: 서비스 워커 등록 코드가 남았다 — ' + path.relative(outDir, f));
const bytes = allFiles(outDir).reduce((s, f) => s + fs.statSync(f).size, 0);
console.log(`물리 2.0 시험 페이지: ${outDir} · ${(bytes / 1048576).toFixed(1)} MB · 패치 src 파일 ${blocks.length} 개`);
