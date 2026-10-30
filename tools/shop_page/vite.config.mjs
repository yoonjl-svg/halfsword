// 상점 시험 페이지 빌드 (사장님 10/30 — 본판에 올리기 전에 사장님이 해 보는 하위 경로 /shop/ · 생사전 시험판 tools/saengsa_page 와 같은 꼴)
//  npx vite build --config tools/shop_page/vite.config.mjs --outDir <폴더> --emptyOutDir
//   → <폴더> 를 개발 가지 위 따로 가지(wk/shop-page)의 public/shop/ 에 그대로 넣는다 (/saengsa/ · /wb/ 시험판과 같은 꼴 — 본 게임 오프라인 저장에선 뺌: tools/pwa/build.mjs EXCLUDED_DIRS).
//  본판 vite.config.js 와 다른 점:
//   - VITE_SHOP_TEST=1 → config SHOP.testMode · SHOP.enabled 참(상점 켬 · 주소 스위치 · '다음 갱신') · src/shop_test.js 가 저장 열쇠를 가름('stillness.test.shop.') · pwa.js 등록 안 함 ·
//     게임이 뜨면 곧바로 대기실 상점 칸(game_entry.js)
//   - 게임 페이지(index.html) 하나만 · 소스맵 없음 · base './'(하위 경로에서 그대로 열림)
//   - public 은 게임이 쓰는 것만: fonts · sfx · ui · 탭 아이콘 셋을 .tmp/shop_public 에 모아 그 폴더를 public 으로 (옛 실험판 · 검토용 · 다른 시험판 · 매니페스트는 뺌)
//   - 매니페스트 링크를 뺀다(시험판이 또 하나의 'Stillness' 앱으로 설치되지 않게) · 탭 제목에 '상점 시험판'
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

process.env.VITE_SHOP_TEST = '1';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC_DIRS = ['fonts', 'sfx', 'ui'];
const PUBLIC_FILES = ['icons/tree-sword-orig-20261020-favicon-32.png', 'icons/tree-sword-orig-20261020-favicon-64.png', 'icons/tree-sword-orig-20261020-apple-touch-icon.png'];

const staged = path.join(root, '.tmp', 'shop_public');
fs.rmSync(staged, { recursive: true, force: true });
for (const d of PUBLIC_DIRS) fs.cpSync(path.join(root, 'public', d), path.join(staged, d), { recursive: true });
for (const f of PUBLIC_FILES) { fs.mkdirSync(path.dirname(path.join(staged, f)), { recursive: true }); fs.copyFileSync(path.join(root, 'public', f), path.join(staged, f)); }

const testPage = () => ({
  name: 'shop-test-page',
  transformIndexHtml: {
    order: 'pre',
    handler: (html) => {
      const out = html.replace(/\s*<link rel="manifest"[^>]*>(\s*<!--.*?-->)?/, '').replace('<title>Stillness</title>', '<title>Stillness · 상점 시험판</title>');
      if (out.includes('rel="manifest"') || !out.includes('상점 시험판')) throw new Error('시험 페이지: index.html 머리를 못 고침');
      return out;
    },
  },
});

export default defineConfig({
  root,
  base: './',
  publicDir: staged,
  plugins: [testPage()],
  build: {
    sourcemap: false,
    rolldownOptions: { input: { main: path.join(root, 'index.html') } },
  },
});
