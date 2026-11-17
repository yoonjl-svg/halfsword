import { defineConfig } from 'vite';

// base: './' 로 두면 GitHub Pages 같은 하위 경로에서도 그대로 동작한다.
// 페이지가 셋: 게임(index.html) + 소리 들어보기(sounds.html) + 테스트 고르기(test.html — 무기·캐릭터를 골라 index.html?test=1… 로, docs/test_route_2026-10-10.md)
export default defineConfig({
  base: './',
  server: { host: true },
  build: {
    rolldownOptions: {
      input: { main: 'index.html', sounds: 'sounds.html', voices: 'voices.html', test: 'test.html' }, // voices: 인물 목소리·리볼버 소리 듣기 (10/12)
    },
  },
});
