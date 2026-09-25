import { defineConfig } from 'vite';

// base: './' 로 두면 GitHub Pages 같은 하위 경로에서도 그대로 동작한다.
export default defineConfig({
  base: './',
  server: { host: true },
});
